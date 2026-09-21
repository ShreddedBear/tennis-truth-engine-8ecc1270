/**
 * Immutable historical version-lineage layer for the independent Parlay Builder.
 *
 * Why this exists: `computeBuilderScore` (builderScoringService.ts) has only ever had ONE
 * algorithm configuration (`BUILDER_VERSION = "1.0.0"`, unchanged since introduction on
 * 2026-09-14), and its calibration lookup (`getActiveCalibration()`, calibrationCache.ts)
 * unconditionally returns whichever `calibration_models` row is CURRENTLY `active = true` --
 * with no notion of "as of a given date", even when the caller passes `BuilderSnapshot.asOfDate`
 * for a historical/backfill score. That silently applies TODAY's algorithm+calibration to
 * matches that occurred before either one existed, with no record that this happened.
 *
 * This module is the fix, modeled directly on the Prediction Engine's own proven pattern
 * (`getCalibrationMappingAsOf` in services/evaluation/shadowReplay.ts): load the full history
 * of a timeline table once, then binary-search it for "whichever entry was genuinely in force
 * at this exact instant", returning null (never a fallback to the current entry) when nothing
 * was yet in force.
 *
 * Two independent temporal dimensions are resolved separately, not as one bundled lookup:
 *   - algorithm/config lineage: `parlay_builder_version_manifests`, an effective_from/effective_to
 *     interval timeline (a version can be superseded, so it needs both ends).
 *   - calibration lineage: `calibration_models`, a fittedAt timeline (a model stays active until
 *     superseded by the next fit -- no explicit end needed, exactly as the Prediction Engine
 *     already treats it).
 * A manifest's own `calibrationModelId` is provenance ("which calibration was active when this
 * algorithm version was minted"), not the operative pairing used at scoring time -- a
 * recalibration with no algorithm change must still extend PIT-correct calibration coverage
 * without requiring a redundant new manifest row.
 */

import crypto from "node:crypto";
import { asc, eq } from "drizzle-orm";
import {
  db,
  calibrationModelsTable,
  builderVersionManifestsTable,
  builderLineageAuditTable,
  type CalibrationKnotJson,
} from "@workspace/db";

export type BuilderLineageStatus =
  | "VALID_HISTORICAL_LINEAGE"
  | "NO_BUILDER_DECISION"
  | "CALIBRATION_UNAVAILABLE"
  | "ALGORITHM_VERSION_UNAVAILABLE"
  | "CONFLICTING_LINEAGE"
  | "PIT_VIOLATION";

export interface BuilderVersionHistoryEntry {
  id: number;
  version: number;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  algorithmConfig: Record<string, unknown>;
  calibrationModelId: number | null;
  configFingerprint: string;
}

export interface CalibrationHistoryEntry {
  id: number;
  fittedAt: Date;
  active: boolean;
  mapping: CalibrationKnotJson[] | null;
}

export interface BuilderLineageResolution {
  status: BuilderLineageStatus;
  manifest: BuilderVersionHistoryEntry | null;
  calibration: CalibrationHistoryEntry | null;
  reason: string;
}

// ---------------------------------------------------------------------------
// Fingerprinting
// ---------------------------------------------------------------------------

/** Deep, key-order-independent JSON serialization so equal configs always fingerprint equal. */
function canonicalStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalStringify).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalStringify(v)}`).join(",")}}`;
}

/** sha256 fingerprint of an algorithm config object. Deterministic regardless of key order. */
export function computeConfigFingerprint(config: Record<string, unknown>): string {
  return crypto.createHash("sha256").update(canonicalStringify(config)).digest("hex");
}

// ---------------------------------------------------------------------------
// History loaders (DB-backed)
// ---------------------------------------------------------------------------

export async function loadBuilderVersionHistory(): Promise<BuilderVersionHistoryEntry[]> {
  const rows = await db
    .select({
      id: builderVersionManifestsTable.id,
      version: builderVersionManifestsTable.version,
      effectiveFrom: builderVersionManifestsTable.effectiveFrom,
      effectiveTo: builderVersionManifestsTable.effectiveTo,
      algorithmConfig: builderVersionManifestsTable.algorithmConfig,
      calibrationModelId: builderVersionManifestsTable.calibrationModelId,
      configFingerprint: builderVersionManifestsTable.configFingerprint,
    })
    .from(builderVersionManifestsTable)
    .orderBy(asc(builderVersionManifestsTable.effectiveFrom));
  return rows as BuilderVersionHistoryEntry[];
}

export async function loadCalibrationModelHistory(): Promise<CalibrationHistoryEntry[]> {
  const rows = await db
    .select({
      id: calibrationModelsTable.id,
      fittedAt: calibrationModelsTable.fittedAt,
      active: calibrationModelsTable.active,
      mapping: calibrationModelsTable.mapping,
    })
    .from(calibrationModelsTable)
    .orderBy(asc(calibrationModelsTable.fittedAt));
  return rows as CalibrationHistoryEntry[];
}

// ---------------------------------------------------------------------------
// Point-in-time lookups (pure -- no DB access, fully unit-testable)
// ---------------------------------------------------------------------------

/**
 * The Builder version manifest genuinely in force as of `asOf`: the LATEST entry whose
 * effectiveFrom is at or before `asOf`, AND whose effectiveTo is either null or strictly
 * after `asOf`. Returns null when `asOf` predates every manifest's effectiveFrom, or falls
 * in a gap between two closed intervals -- honestly absent, never backfilled with a later
 * version that did not exist yet. `history` must be sorted ascending by effectiveFrom.
 */
export function getBuilderVersionAsOf(history: BuilderVersionHistoryEntry[], asOf: Date): BuilderVersionHistoryEntry | null {
  const asOfMs = asOf.getTime();
  let lo = 0;
  let hi = history.length - 1;
  let candidateIdx = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (history[mid].effectiveFrom.getTime() <= asOfMs) {
      candidateIdx = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  if (candidateIdx === -1) return null;
  const candidate = history[candidateIdx];
  if (candidate.effectiveTo != null && candidate.effectiveTo.getTime() <= asOfMs) return null;
  return candidate;
}

/**
 * The calibration_models row genuinely active as of `asOf`: the LATEST entry whose fittedAt is
 * at or before `asOf`. Mirrors shadowReplay.ts's getCalibrationMappingAsOf exactly (same table,
 * same semantics), reimplemented independently here per the Builder's own architectural
 * principle of never depending on Prediction Engine internals. `history` must be sorted
 * ascending by fittedAt.
 */
export function getCalibrationModelAsOf(history: CalibrationHistoryEntry[], asOf: Date): CalibrationHistoryEntry | null {
  const asOfMs = asOf.getTime();
  let lo = 0;
  let hi = history.length - 1;
  let result: CalibrationHistoryEntry | null = null;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (history[mid].fittedAt.getTime() <= asOfMs) {
      result = history[mid];
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Lineage resolution
// ---------------------------------------------------------------------------

export interface ResolveBuilderLineageInput {
  cutoffAt: Date;
  versionHistory: BuilderVersionHistoryEntry[];
  calibrationHistory: CalibrationHistoryEntry[];
}

/**
 * Classifies exactly which of the six lineage states applies to scoring a match at `cutoffAt`,
 * with a human-readable reason. Never returns a generic pass/fail -- every non-valid outcome
 * names precisely what evidence is missing or in conflict, so a caller (or an auditor reading
 * `parlay_builder_lineage_audit`) never has to guess why a match was skipped.
 *
 * Algorithm and calibration lineage are resolved independently (see module doc), then combined:
 *   - both missing            -> NO_BUILDER_DECISION   (nothing existed yet, full stop)
 *   - algorithm missing only  -> ALGORITHM_VERSION_UNAVAILABLE
 *   - calibration missing only-> CALIBRATION_UNAVAILABLE
 *   - both present            -> VALID_HISTORICAL_LINEAGE (after a PIT self-check)
 * Overlapping manifest intervals are checked first and short-circuit to CONFLICTING_LINEAGE --
 * resolving a lookup against a corrupt timeline would be worse than refusing outright.
 */
export function resolveBuilderLineage(input: ResolveBuilderLineageInput): BuilderLineageResolution {
  const { cutoffAt, calibrationHistory } = input;
  const versionHistory = [...input.versionHistory].sort((a, b) => a.effectiveFrom.getTime() - b.effectiveFrom.getTime());

  for (let i = 1; i < versionHistory.length; i++) {
    const prev = versionHistory[i - 1];
    const cur = versionHistory[i];
    const prevEndsAt = prev.effectiveTo?.getTime() ?? Number.POSITIVE_INFINITY;
    if (prevEndsAt > cur.effectiveFrom.getTime()) {
      return {
        status: "CONFLICTING_LINEAGE",
        manifest: null,
        calibration: null,
        reason:
          `Builder version manifests v${prev.version} (${prev.effectiveFrom.toISOString()}–${prev.effectiveTo?.toISOString() ?? "open"}) ` +
          `and v${cur.version} (${cur.effectiveFrom.toISOString()}–${cur.effectiveTo?.toISOString() ?? "open"}) have overlapping effective ` +
          `intervals; refusing to resolve lineage for ${cutoffAt.toISOString()} until this is corrected.`,
      };
    }
  }

  const manifest = getBuilderVersionAsOf(versionHistory, cutoffAt);
  const calibration = getCalibrationModelAsOf(calibrationHistory, cutoffAt);

  if (manifest == null && calibration == null) {
    return {
      status: "NO_BUILDER_DECISION",
      manifest: null,
      calibration: null,
      reason:
        `No Builder version manifest and no calibration model were effective as of ${cutoffAt.toISOString()} -- ` +
        `neither the Builder algorithm nor a calibration model existed yet at this point in real history. ` +
        `No decision can be attributed to this match without fabricating state that was never active.`,
    };
  }

  if (manifest == null) {
    return {
      status: "ALGORITHM_VERSION_UNAVAILABLE",
      manifest: null,
      calibration,
      reason:
        `A calibration model (id ${calibration!.id}, fitted ${calibration!.fittedAt.toISOString()}) was active as of ` +
        `${cutoffAt.toISOString()}, but no Builder algorithm/config version manifest covers this instant -- the algorithm ` +
        `side of lineage is unavailable even though calibration evidence exists.`,
    };
  }

  if (calibration == null) {
    return {
      status: "CALIBRATION_UNAVAILABLE",
      manifest,
      calibration: null,
      reason:
        `Builder version v${manifest.version} (effective ${manifest.effectiveFrom.toISOString()}) was active as of ` +
        `${cutoffAt.toISOString()}, but no calibration_models row was fitted at or before this instant -- no honest ` +
        `calibrated probability can be produced for this match.`,
    };
  }

  if (manifest.effectiveFrom.getTime() > cutoffAt.getTime() || calibration.fittedAt.getTime() > cutoffAt.getTime()) {
    return {
      status: "PIT_VIOLATION",
      manifest,
      calibration,
      reason:
        `Resolved lineage (manifest v${manifest.version} effective ${manifest.effectiveFrom.toISOString()}, calibration ` +
        `${calibration.id} fitted ${calibration.fittedAt.toISOString()}) would use state from after the match cutoff ` +
        `(${cutoffAt.toISOString()}); refused rather than leak future information into a historical score.`,
    };
  }

  return {
    status: "VALID_HISTORICAL_LINEAGE",
    manifest,
    calibration,
    reason:
      `Builder version v${manifest.version} (effective ${manifest.effectiveFrom.toISOString()}) and calibration model ` +
      `${calibration.id} (fitted ${calibration.fittedAt.toISOString()}) were both genuinely active at or before this ` +
      `match's cutoff (${cutoffAt.toISOString()}).`,
  };
}

// ---------------------------------------------------------------------------
// Live-scoring integration
// ---------------------------------------------------------------------------

export interface BuilderCalibrationResolution {
  mapping: CalibrationKnotJson[] | null;
  calibrationModelId: number | null;
  lineageStatus: BuilderLineageStatus;
  lineageReason: string;
}

/**
 * The single entry point `computeBuilderScore` should use in place of a bare
 * `getActiveCalibration()` call.
 *
 * Live mode (`asOfDate == null`): behaves EXACTLY as before -- delegates straight to
 * `getActiveCalibration()`, so live scoring is unaffected by this change. PIT-correctness is
 * trivial here: "now" is definitionally at or after every existing manifest/calibration row.
 *
 * Backfill/historical mode (`asOfDate` set): resolves lineage via `resolveBuilderLineage`. Only
 * `VALID_HISTORICAL_LINEAGE` returns a usable mapping; every other status returns
 * `mapping: null` (the caller's existing raw-score fallback applies, unchanged) but surfaces the
 * exact `lineageStatus`/`lineageReason` so the caller can record WHY, instead of silently
 * looking identical to "no calibration was ever configured".
 */
export async function resolveBuilderCalibrationForScoring(asOfDate: Date | undefined): Promise<BuilderCalibrationResolution> {
  if (asOfDate == null) {
    const { getActiveCalibration } = await import("../evaluation/calibrationCache.js");
    const { mapping, modelId } = await getActiveCalibration();
    return {
      mapping,
      calibrationModelId: modelId,
      lineageStatus: "VALID_HISTORICAL_LINEAGE",
      lineageReason: "Live scoring always uses the currently active calibration; PIT-correctness is trivial for 'now'.",
    };
  }

  const [versionHistory, calibrationHistory] = await Promise.all([loadBuilderVersionHistory(), loadCalibrationModelHistory()]);
  const resolution = resolveBuilderLineage({ cutoffAt: asOfDate, versionHistory, calibrationHistory });

  if (resolution.status !== "VALID_HISTORICAL_LINEAGE" || resolution.calibration == null) {
    return {
      mapping: null,
      calibrationModelId: null,
      lineageStatus: resolution.status,
      lineageReason: resolution.reason,
    };
  }

  return {
    mapping: resolution.calibration.mapping,
    calibrationModelId: resolution.calibration.id,
    lineageStatus: resolution.status,
    lineageReason: resolution.reason,
  };
}

// ---------------------------------------------------------------------------
// Writing new manifest versions (append-only; DB enforces immutability on top of this)
// ---------------------------------------------------------------------------

export interface NewBuilderVersionManifest {
  version: number;
  effectiveFrom: Date;
  algorithmConfig: Record<string, unknown>;
  calibrationModelId: number | null;
  optimizerRunId: string | null;
  sourceCommit: string;
  reconstructionMethod: "observed_from_source" | "reconstructed_from_git_history" | "reconstructed_from_export";
  confidence: "high" | "partial" | "unavailable";
  provenance: Record<string, unknown>;
  createdBy?: string;
}

/**
 * Inserts a new manifest row and, in the SAME transaction, closes out the previously-open row's
 * effectiveTo (the one mutation the immutability trigger permits). Throws if a currently-open
 * row's effectiveFrom is not strictly before the new row's effectiveFrom (would create either an
 * overlap or a reversed timeline) -- callers must supply intervals in real chronological order,
 * never backdate around an existing row.
 */
export async function insertBuilderVersionManifest(entry: NewBuilderVersionManifest): Promise<number> {
  return db.transaction(async (tx: Parameters<Parameters<typeof db.transaction>[0]>[0]) => {
    const [openRow] = await tx
      .select({ id: builderVersionManifestsTable.id, version: builderVersionManifestsTable.version, effectiveFrom: builderVersionManifestsTable.effectiveFrom })
      .from(builderVersionManifestsTable)
      .where(eq(builderVersionManifestsTable.effectiveTo, null as unknown as Date))
      .limit(1);

    if (openRow != null) {
      if (openRow.effectiveFrom.getTime() >= entry.effectiveFrom.getTime()) {
        throw new Error(
          `Cannot insert manifest v${entry.version} effective ${entry.effectiveFrom.toISOString()}: currently-open manifest ` +
            `v${openRow.version} became effective ${openRow.effectiveFrom.toISOString()}, which is not strictly before it.`,
        );
      }
      await tx
        .update(builderVersionManifestsTable)
        .set({ effectiveTo: entry.effectiveFrom })
        .where(eq(builderVersionManifestsTable.id, openRow.id));
    }

    const [inserted] = await tx
      .insert(builderVersionManifestsTable)
      .values({
        version: entry.version,
        effectiveFrom: entry.effectiveFrom,
        effectiveTo: null,
        algorithmConfig: entry.algorithmConfig,
        calibrationModelId: entry.calibrationModelId,
        optimizerRunId: entry.optimizerRunId,
        sourceCommit: entry.sourceCommit,
        configFingerprint: computeConfigFingerprint(entry.algorithmConfig),
        reconstructionMethod: entry.reconstructionMethod,
        confidence: entry.confidence,
        provenance: entry.provenance,
        createdBy: entry.createdBy ?? null,
      })
      .returning({ id: builderVersionManifestsTable.id });

    return inserted.id;
  });
}

/** Appends one audit row. Never updates/deletes -- the DB trigger would reject it anyway. */
export async function recordBuilderLineageAudit(opts: {
  auditRunId: string;
  historicalMatchId: number;
  cutoffAt: Date;
  resolution: BuilderLineageResolution;
}): Promise<void> {
  await db.insert(builderLineageAuditTable).values({
    auditRunId: opts.auditRunId,
    historicalMatchId: opts.historicalMatchId,
    cutoffAt: opts.cutoffAt,
    status: opts.resolution.status,
    resolvedManifestId: opts.resolution.manifest?.id ?? null,
    resolvedManifestVersion: opts.resolution.manifest?.version ?? null,
    resolvedCalibrationModelId: opts.resolution.calibration?.id ?? null,
    reason: opts.resolution.reason,
  });
}
