/**
 * Standalone entrypoint for the double-sided Parlay Builder paper-trading cycle. Mirrors
 * `runPaperTradingJob.ts`'s shape exactly: one cycle to completion, one `job_runs` row per
 * attempt, standalone-only auto-run guard (same bundling-collision reasoning as that file's own
 * comment explains -- copied verbatim below since the risk is identical).
 *
 * Intended run command for a Replit Scheduled Deployment, e.g. every 15 minutes:
 *   PARLAY_PAPER_TRADING_JOB_STANDALONE=1 node --enable-source-maps dist/jobs/runParlayPaperTradingJob.mjs
 *
 * FIVE DELIBERATELY SEPARATE PHASES, each wrapped in its own try/catch so one phase's failure
 * (a provider outage during discovery, say) never prevents the OTHER phases from running this
 * same cycle -- settlement and grading of already-frozen trades must keep progressing even on a
 * day discovery itself is broken, and vice versa:
 *   1. discoverAndDecideFixtures — fetch upcoming fixtures, create/freeze new paper trades.
 *   2. markStartedFixtures       — close the PIT boundary for trades whose match has begun.
 *   3. settlePendingTrades       — attach real outcomes to completed matches.
 *   4. gradeSettledTrades        — compute accuracy (builder_picked_player_id only) for settled trades.
 * (Phase numbering above matches the project's own PHASE 4/5 separation: settlement and grading
 * are two phases, not one, specifically so a settlement failure can never block grading of
 * trades that were already settled in an earlier cycle, and a grading bug can never re-trigger
 * a redundant settlement lookup.)
 */
import { execSync } from "node:child_process";
import { db, jobRunsTable } from "@workspace/db";
import { discoverAndDecideFixtures, type DiscoverAndDecideSummary } from "../services/parlayPaperTrading/discoverFixtures.js";
import { markStartedFixtures, settlePendingTrades, gradeSettledTrades, type MarkStartedSummary, type SettleSummary, type GradeSummary } from "../services/parlayPaperTrading/settlement.js";
import { logger } from "../lib/logger.js";
import { PARLAY_PAPER_TRADING_JOB_NAME } from "./parlayPaperTradingJobName.js";

export { PARLAY_PAPER_TRADING_JOB_NAME };

interface PhaseResult<T> {
  ok: boolean;
  result: T | null;
  error: string | null;
}

async function runPhase<T>(name: string, fn: () => Promise<T>): Promise<PhaseResult<T>> {
  try {
    const result = await fn();
    return { ok: true, result, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err, phase: name }, `Parlay paper-trading job: phase '${name}' failed`);
    return { ok: false, result: null, error: message };
  }
}

export interface ParlayPaperTradingCycleSummary {
  discovery: PhaseResult<DiscoverAndDecideSummary>;
  markStarted: PhaseResult<MarkStartedSummary>;
  settlement: PhaseResult<SettleSummary>;
  grading: PhaseResult<GradeSummary>;
}

export async function runParlayPaperTradingCycle(sourceCommit: string): Promise<ParlayPaperTradingCycleSummary> {
  // Sequential, not parallel: each phase reads state the previous one may have just written
  // (e.g. grading reads rows settlement just marked COMPLETED this same cycle), and running
  // them concurrently would gain nothing (a single cycle is not itself under load) while adding
  // real risk of two phases racing over the same rows.
  const discovery = await runPhase("discover-and-decide", () => discoverAndDecideFixtures(sourceCommit));
  const markStarted = await runPhase("mark-started", () => markStartedFixtures());
  const settlement = await runPhase("settle", () => settlePendingTrades());
  const grading = await runPhase("grade", () => gradeSettledTrades());

  return { discovery, markStarted, settlement, grading };
}

export async function runParlayPaperTradingJob(sourceCommit: string): Promise<{ ok: boolean }> {
  const startedAt = new Date();
  const summary = await runParlayPaperTradingCycle(sourceCommit);
  const finishedAt = new Date();

  // The cycle as a whole is "success" as long as it completed (each phase already isolates its
  // own failure) -- job_runs.status='failed' is reserved for a genuinely unhandled exception
  // escaping runParlayPaperTradingCycle itself, which per-phase try/catch is designed to prevent.
  // Individual phase failures are still fully visible in summary.<phase>.error, not swallowed.
  const anyPhaseFailed = !summary.discovery.ok || !summary.markStarted.ok || !summary.settlement.ok || !summary.grading.ok;

  await db.insert(jobRunsTable).values({
    jobName: PARLAY_PAPER_TRADING_JOB_NAME,
    startedAt,
    finishedAt,
    status: "success",
    attempts: 1,
    summary: summary as unknown as object,
    errorMessage: anyPhaseFailed
      ? `One or more phases failed: ${[
          !summary.discovery.ok && `discovery: ${summary.discovery.error}`,
          !summary.markStarted.ok && `markStarted: ${summary.markStarted.error}`,
          !summary.settlement.ok && `settlement: ${summary.settlement.error}`,
          !summary.grading.ok && `grading: ${summary.grading.error}`,
        ].filter(Boolean).join("; ")}`
      : null,
  });

  logger.info({ summary, anyPhaseFailed }, "Parlay paper-trading cycle completed");
  return { ok: !anyPhaseFailed };
}

/** Real git SHA of the running checkout, best-effort -- "unknown" rather than a guessed env var when unavailable (e.g. a bundled dist/ deploy with no .git present). */
function resolveSourceCommit(): string {
  try {
    return execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

// See runPaperTradingJob.ts's identical comment for why this exact env-var guard (not
// import.meta.url vs process.argv[1]) is required once build.mjs bundles this into two
// separate entry points.
if (process.env["PARLAY_PAPER_TRADING_JOB_STANDALONE"] === "1") {
  const sourceCommit = resolveSourceCommit();
  runParlayPaperTradingJob(sourceCommit)
    .then(({ ok }) => process.exit(ok ? 0 : 1))
    .catch((err) => {
      logger.error({ err }, "Unhandled error running parlay paper-trading job");
      process.exit(1);
    });
}
