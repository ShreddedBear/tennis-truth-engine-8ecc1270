/**
 * ScreenshotImportService — the single global entry point for ALL screenshot OCR in the app.
 *
 * Every module that needs to import a screenshot (Prediction Engine, Parlay Builder,
 * Batch Import, etc.) must call this service. No module may call an OCR provider directly.
 *
 * Responsibilities:
 *   1. Image hash caching — identical images return instantly without an API call
 *   2. Provider health — quota-exhausted or auth-failed providers are skipped immediately
 *   3. Vision AI failover  — OpenAI → Gemini → Anthropic → Replit proxy (in key-priority order)
 *   4. OCR.Space fallback  — free REST fallback after all vision AI providers fail
 *   5. Player resolution   — resolves raw OCR names to real DB players (same as manual flow)
 *   6. Diagnostics         — full provider trace, timings, retry counts, cache hit status
 *
 * All health and cache state is in-process memory; it resets on server restart.
 */

import { logger } from "../../lib/logger.js";
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { writeFile, unlink } from "node:fs/promises";
import { promisify } from "node:util";
import {
  recognizeMatchupScreenshot,
  ScreenshotRecognitionUnavailableError,
  type RawScreenshotRecognitionWithDebug,
} from "../tennisData/screenshotRecognition.js";
import { resolveScreenshotMatchup } from "../tennisData/screenshotMatchupResolver.js";
import type { ScreenshotMatchupResult } from "../tennisData/screenshotMatchupResolver.js";
import { getTennisDataProvider } from "../tennisData/index.js";
import {
  isProviderSkippable,
  recordSuccess,
  recordPermanentFailure,
  recordTransientFailure,
  getAllProviderHealth,
  type ProviderHealth,
} from "./providerHealthMonitor.js";
import { imageHash, cacheGet, cacheSet, cacheStats, cacheClear } from "./imageHashCache.js";
import { callOcrSpace } from "./ocrSpaceProvider.js";
import { parseOcrText } from "./rawTextParser.js";

const execFileAsync = promisify(execFile);

async function extractTextLayerPdf(imageBase64: string): Promise<{
  matchups: ReturnType<typeof parseOcrText>;
  rawText: string;
} | null> {
  if (!imageBase64.startsWith("data:application/pdf;")) return null;
  const comma = imageBase64.indexOf(",");
  if (comma < 0) return null;
  const pdfBytes = Buffer.from(imageBase64.slice(comma + 1), "base64");
  if (pdfBytes.length === 0) return null;

  const inputPath = `/tmp/tennis-ocr-${randomUUID()}.pdf`;
  try {
    await writeFile(inputPath, pdfBytes);
    const { stdout } = await execFileAsync("pdftotext", ["-layout", inputPath, "-"], {
      encoding: "utf8",
      maxBuffer: 2 * 1024 * 1024,
      timeout: 10_000,
    });
    const rawText = stdout.trim();
    if (!rawText) return null;
    const matchups = parseOcrText(rawText);
    return matchups.length > 0 ? { matchups, rawText } : null;
  } catch {
    return null;
  } finally {
    await unlink(inputPath).catch(() => undefined);
  }
}

// One process-wide provider lane prevents simultaneous uploads from racing the
// same quota bucket. Player resolution and the rest of each request still run
// independently after OCR completes.
let visionQueue: Promise<void> = Promise.resolve();

async function withSerializedVision<T>(work: () => Promise<T>): Promise<T> {
  const previous = visionQueue;
  let release!: () => void;
  const current = new Promise<void>((resolve) => { release = resolve; });
  visionQueue = previous.then(() => current, () => current);
  await previous.catch(() => undefined);
  try {
    return await work();
  } finally {
    release();
  }
}

// ---------------------------------------------------------------------------
// Public interfaces
// ---------------------------------------------------------------------------

export interface ImportDiagnostics {
  /** Which OCR provider ultimately succeeded (or "all_failed"). */
  ocrProvider: string;
  ocrDurationMs: number;
  /** Total time including cache lookup, OCR, and player resolution. */
  totalDurationMs: number;
  retryCount: number;
  fromCache: boolean;
  /** Stage-by-stage pipeline trace from the recognition step. */
  debugLog: string[];
  rawText?: string;
}

export interface ImportScreenshotResult extends ScreenshotMatchupResult {
  diagnostics: ImportDiagnostics;
}

export interface ProviderHealthReport {
  providers: ProviderHealth[];
  cache: ReturnType<typeof cacheStats>;
  /** ISO timestamp of the report. */
  reportedAt: string;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Parse the debugLog entries emitted by recognizeMatchupScreenshot() to update
 * per-provider health state. This lets the health monitor learn which providers
 * are quota-exhausted WITHOUT requiring a separate reporting call from the caller.
 *
 * We look for [SKIP] lines that mention "permanent error" to identify exhausted
 * providers, and [RAW] lines to identify the provider that succeeded.
 */
function applyHealthFromDebugLog(debugLog: string[]): void {
  // Extract successful provider
  let lastTried: string | null = null;
  for (const line of debugLog) {
    const tryMatch = /\[TRY\] (\S+)/.exec(line);
    if (tryMatch) lastTried = tryMatch[1];

    // "[RAW] attempt=0 ..." — immediately after a successful API call
    if (line.startsWith("[RAW]") && lastTried) {
      recordSuccess(lastTried);
      lastTried = null;
    }

    // "[SKIP] LABEL: permanent error (quota/auth)"
    const skipMatch = /\[SKIP\] (\S+): permanent error/.exec(line);
    if (skipMatch) {
      const lbl = skipMatch[1];
      if (line.includes("quota")) recordPermanentFailure(lbl, "quota_exhausted");
      else if (line.includes("auth") || line.includes("key")) recordPermanentFailure(lbl, "auth_failed");
      else recordPermanentFailure(lbl, "quota_exhausted");
    }

    // "[SKIP] LABEL: non-retryable" — treat as offline/transient
    const skipTransient = /\[SKIP\] (\S+): non-retryable/.exec(line);
    if (skipTransient) recordTransientFailure(skipTransient[1]);
  }
}

/**
 * Build the set of provider labels that are currently known-skippable.
 * This is passed to recognizeMatchupScreenshot() so it skips exhausted
 * providers without even attempting them.
 */
function buildSkipSet(): Set<string> {
  const all = getAllProviderHealth();
  return new Set(
    all.filter((h) => isProviderSkippable(h.label)).map((h) => h.label)
  );
}

// ---------------------------------------------------------------------------
// Main service class
// ---------------------------------------------------------------------------

class ScreenshotImportService {
  /**
   * Import a screenshot: OCR → player resolution → cached result.
   *
   * @param imageBase64 Base64-encoded image (with or without data: prefix).
   * @param skipCache   Force a fresh OCR even if this image was processed before.
   */
  async importScreenshot(
    imageBase64: string,
    skipCache = false,
  ): Promise<ImportScreenshotResult> {
    const t0 = Date.now();
    const hash = imageHash(imageBase64);
    const debugLog: string[] = [];

    // 1. Cache check
    if (!skipCache) {
      const cached = cacheGet<ImportScreenshotResult>(hash);
      if (cached) {
        debugLog.push(`[CACHE] HIT — returning cached result (hash=${hash.slice(0, 8)}…)`);
        return {
          ...cached,
          diagnostics: { ...cached.diagnostics, fromCache: true, debugLog },
        };
      }
    }
    debugLog.push(`[CACHE] MISS — hash=${hash.slice(0, 8)}…`);

    // 2. Attempt vision AI providers. Provider health is checked only after
    // this request reaches the front of the queue, so it sees the final status
    // of earlier requests rather than a stale concurrent snapshot.
    let ocrResult: RawScreenshotRecognitionWithDebug | null = null;
    let ocrProvider = "unknown";
    let ocrDurationMs = 0;
    let retryCount = 0;

    const t1 = Date.now();
    const localPdf = await extractTextLayerPdf(imageBase64);
    if (localPdf) {
      ocrProvider = "PDF.TextLayer";
      ocrResult = {
        matchups: localPdf.matchups,
        rawText: localPdf.rawText,
        debugLog: [],
        providerUsed: ocrProvider,
      };
      ocrDurationMs = Date.now() - t1;
      debugLog.push(`[PDF.TEXT] Parsed ${localPdf.matchups.length} explicit matchup(s) locally; skipped vision API`);
    } else {
      try {
      ocrResult = await withSerializedVision(async () => {
        const skipLabels = buildSkipSet();
        if (skipLabels.size > 0) {
          debugLog.push(`[HEALTH] Pre-skipping known-bad providers: ${[...skipLabels].join(", ")}`);
        }
        return recognizeMatchupScreenshot(imageBase64, { skipLabels });
      });
      ocrDurationMs = Date.now() - t1;

      // Update health monitor from debug log
      applyHealthFromDebugLog(ocrResult.debugLog);
      debugLog.push(...ocrResult.debugLog);

      // Identify which provider succeeded by scanning the log
      for (const line of ocrResult.debugLog) {
        const tryMatch = /\[TRY\] (\S+)/.exec(line);
        if (tryMatch) ocrProvider = tryMatch[1];
        if (line.startsWith("[RAW]")) break; // last [TRY] before first [RAW] = winner
      }

      retryCount = ocrResult.debugLog.filter((l) => l.startsWith("[RETRY]")).length;
      } catch (err) {
        if (err instanceof ScreenshotRecognitionUnavailableError) {
        ocrDurationMs = Date.now() - t1;
        applyHealthFromDebugLog(err.debugLog ?? []);
        debugLog.push(...(err.debugLog ?? []));
        debugLog.push(`[VISION_AI] All vision AI providers exhausted — trying OCR.Space fallback`);

        // 3. OCR.Space fallback
        try {
          const t2 = Date.now();
          const spaceResult = await callOcrSpace(imageBase64);
          ocrDurationMs += Date.now() - t2;
          recordSuccess("OCR.Space");
          ocrProvider = "OCR.Space";
          debugLog.push(`[OCR.SPACE] Extracted ${spaceResult.matchups.length} matchup(s) in ${Date.now() - t2}ms`);

          ocrResult = {
            matchups: spaceResult.matchups,
            debugLog,
            rawText: spaceResult.rawText,
          };
        } catch (spaceErr) {
          const spaceMsg = String((spaceErr as { message?: string })?.message ?? spaceErr).slice(0, 120);
          debugLog.push(`[OCR.SPACE] Failed — ${spaceMsg}`);
          const spaceErrTyped = spaceErr as { status?: number };
          if (spaceErrTyped?.status === 401 || spaceErrTyped?.status === 403) {
            recordPermanentFailure("OCR.Space", "auth_failed");
          } else {
            recordTransientFailure("OCR.Space");
          }

          // 4. All providers exhausted — surface error with full diagnostics
          debugLog.push(`[FAILED] All OCR providers failed — no matchups extracted`);
          logger.error({ hash: hash.slice(0, 8), debugLog }, "ScreenshotImportService: all providers failed");

          const diagnostics: ImportDiagnostics = {
            ocrProvider: "all_failed",
            ocrDurationMs,
            totalDurationMs: Date.now() - t0,
            retryCount,
            fromCache: false,
            debugLog,
          };

          return {
            player1: { recognizedName: null, player: null, status: "not-found" },
            player2: { recognizedName: null, player: null, status: "not-found" },
            event: { recognizedName: null, surface: null, level: null, round: null, scheduledDate: null, matchFormat: null },
            warnings: [
              "All OCR providers are currently unavailable. Please try again later or enter player names manually.",
            ],
            matchups: [],
            diagnostics,
          };
        }
        } else {
          throw err;
        }
      }
    }

    // Vision models can return valid but incomplete JSON for very tall scroll captures. For
    // large images, compare the semantic result with OCR.Space's card parser and retain the
    // source that recovered more explicit matchup records. This never merges or re-pairs names.
    const rawBase64 = imageBase64.startsWith("data:")
      ? imageBase64.slice(imageBase64.indexOf(",") + 1)
      : imageBase64;
    const estimatedImageBytes = rawBase64.length * 0.75;
    const isLargeScrollCandidate = estimatedImageBytes >= 900 * 1024;
    if (isLargeScrollCandidate && ocrProvider !== "OCR.Space") {
      try {
        const supplementalStartedAt = Date.now();
        const spaceResult = await callOcrSpace(imageBase64);
        const supplementalDuration = Date.now() - supplementalStartedAt;
        ocrDurationMs += supplementalDuration;
        debugLog.push(
          `[OCR.SPACE] Completeness check extracted ${spaceResult.matchups.length} matchup(s) versus ${ocrResult.matchups.length} from ${ocrProvider}`,
        );
        if (spaceResult.matchups.length > ocrResult.matchups.length) {
          ocrProvider = "OCR.Space";
          ocrResult = {
            matchups: spaceResult.matchups,
            debugLog,
            rawText: spaceResult.rawText,
          };
          debugLog.push("[OCR.SPACE] Selected more complete explicit-card extraction");
        }
        recordSuccess("OCR.Space");
      } catch (spaceErr) {
        debugLog.push(
          `[OCR.SPACE] Completeness check unavailable — retaining ${ocrResult.matchups.length} vision matchup(s): ${String((spaceErr as { message?: string })?.message ?? spaceErr).slice(0, 120)}`,
        );
        recordTransientFailure("OCR.Space");
      }
    }

    // 5. Player resolution
    const { debugLog: ocrDebugLog, rawText, ...rawForResolver } = ocrResult;
    void ocrDebugLog; // already merged into debugLog above

    let resolved: ScreenshotMatchupResult;
    let resolutionThrew = false;
    try {
      resolved = await resolveScreenshotMatchup(getTennisDataProvider(), rawForResolver);
    } catch (resolveErr) {
      resolutionThrew = true;
      logger.warn({ err: resolveErr }, "ScreenshotImportService: player resolution failed");
      resolved = {
        player1: { recognizedName: null, player: null, status: "not-found" },
        player2: { recognizedName: null, player: null, status: "not-found" },
        event: { recognizedName: null, surface: null, level: null, round: null, scheduledDate: null, matchFormat: null },
        warnings: ["Player resolution failed — please verify names manually."],
        matchups: [],
      };
    }

    const totalDurationMs = Date.now() - t0;

    const result: ImportScreenshotResult = {
      ...resolved,
      diagnostics: {
        ocrProvider,
        ocrDurationMs,
        totalDurationMs,
        retryCount,
        fromCache: false,
        debugLog,
        rawText,
      },
    };

    // 6. Cache the result — but skip caching when the resolver itself threw (likely a transient
    //    provider failure such as a circuit-breaker open). Caching a "resolution failed" result
    //    would cause every subsequent upload of the same image to instantly return null names
    //    even after the provider recovers.
    // Empty recognition is not durable: OCR providers can recover after quota, transient,
    // or parser issues. Caching an empty result makes a corrected retry fail instantly.
    if (!resolutionThrew && (resolved.matchups?.length ?? 0) > 0) {
      cacheSet(hash, result);
    }
    logger.info(
      { provider: ocrProvider, durationMs: totalDurationMs, matchupCount: resolved.matchups?.length ?? 0 },
      "ScreenshotImportService: import complete",
    );

    return result;
  }

  /** Returns live health state for all known providers + cache stats. */
  getProviderHealthReport(): ProviderHealthReport {
    return {
      providers: getAllProviderHealth(),
      cache: cacheStats(),
      reportedAt: new Date().toISOString(),
    };
  }

  /** Clear the image cache (admin action). */
  clearCache(): void {
    cacheClear();
    logger.info("ScreenshotImportService: cache cleared by admin");
  }
}

// Singleton — one instance for the lifetime of the process.
export const screenshotImportService = new ScreenshotImportService();
