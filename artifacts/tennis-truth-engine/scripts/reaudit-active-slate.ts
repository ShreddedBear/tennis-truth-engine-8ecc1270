// CONTROLLED PRODUCTION RE-AUDIT of the current active slate.
//
// Exists to reprocess matches whose audit already completed BEFORE the producer/
// classification fix in audit-pipeline.ts's mergeMetricFindingSides /
// deterministic-batch1/2-standalone-metrics.server.ts (real failure reasons were being
// discarded as PRODUCER_FAILED_WITHOUT_REASON). A COMPLETE audit run is never touched by
// the normal drive loop (see ensureRun in audit-pipeline.ts -- a COMPLETE run is returned
// as-is, nothing re-executes), so the only way to make the fixed producer code run again
// for an already-COMPLETE match is runPipeline's forceNewRun option. This script is the
// one place that ever passes it.
//
// Everything below is built ONLY from the existing pipeline primitives
// (runPipeline/createRun/ensureRun, makeDeps, activeSlateMatchIds/activeRunIds) -- no new
// evidence path, no new classification rule, no change to the 25 active metric codes, the
// 60% threshold, or the Evidence Coverage denominator. A forced new run is an ADDITIVE
// audit_runs row (run_number = old + 1); the prior COMPLETE run's row, and everything
// scoped to its audit_run_id (metric_results, final_decisions, ...), is never mutated or
// deleted -- see runPipeline({forceNewRun:true})'s own regression tests in
// audit-pipeline.test.ts ("never mutates the prior COMPLETE run's own row", "never creates
// a second matches row").
//
// Read this file's exported functions before its `main()` at the bottom: the actual
// selection/orchestration logic is plain, dependency-injected functions so it can be
// exercised in reaudit-active-slate.test.ts without a real database; `main()` is a thin
// wrapper that wires the real db/makeDeps/runPipeline and is the only part that ever
// touches production.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { mapBounded } from "../src/lib/audit-batch";
import type { PipelineDeps, RunRow } from "../src/lib/audit-pipeline";
import { activeRunIds, activeSlateMatchIds } from "../src/lib/current-audit-state";

/** The already-confirmed size of the current active slate. See requirement 2: the script
 * must refuse to proceed on any other count rather than silently operate on a slate that
 * has grown, shrunk, or been reconfigured since this number was confirmed. */
export const EXPECTED_ACTIVE_SLATE_COUNT = 105;
const expectedActiveSlateCount = Math.max(
  1,
  Number(process.env["REAUDIT_EXPECTED_ACTIVE_SLATE_COUNT"] ?? EXPECTED_ACTIVE_SLATE_COUNT),
);

export interface ManifestEntry {
  matchId: string;
  newRunId: string;
  runNumber: number | null;
  status: string;
  completedAt: string;
}

export interface ManifestStore {
  has(matchId: string): boolean;
  record(matchId: string, entry: ManifestEntry): void;
}

/** In-memory manifest -- used by tests, and as the shape createFileManifestStore fulfills. */
export function createInMemoryManifestStore(): ManifestStore & { entries: Map<string, ManifestEntry> } {
  const entries = new Map<string, ManifestEntry>();
  return {
    entries,
    has: (matchId) => entries.has(matchId),
    record: (matchId, entry) => entries.set(matchId, entry),
  };
}

/**
 * Persistent, file-backed manifest so a second invocation of this script (after a crash,
 * a timeout, or a deliberate resume) can tell "I already created a re-audit run for this
 * match" apart from "this match has never been through this script" -- without adding a
 * column to audit_runs or repurposing an existing one (e.g. stale_reason already carries a
 * different, specific meaning -- rule-version invalidation -- and overloading it here would
 * make that column's real meaning ambiguous to anyone reading it later). The file lives
 * outside git (see .gitignore) since it is local run-tracking state, not application data.
 */
export function createFileManifestStore(filePath: string): ManifestStore {
  const load = (): Record<string, ManifestEntry> => {
    if (!existsSync(filePath)) return {};
    try {
      return JSON.parse(readFileSync(filePath, "utf8")) as Record<string, ManifestEntry>;
    } catch {
      return {};
    }
  };
  let data = load();
  return {
    has: (matchId) => Boolean(data[matchId]),
    record: (matchId, entry) => {
      data = { ...load(), [matchId]: entry }; // re-read before writing: tolerate a concurrent writer
      mkdirSync(path.dirname(filePath), { recursive: true });
      writeFileSync(filePath, JSON.stringify(data, null, 2));
    },
  };
}

export interface MatchLike { id: string }
export interface RunLike { id: string; match_id: string; status: string; run_number: number }
export interface SummaryVersionLike { match_id: string; is_active?: boolean | null }

/**
 * The application's own canonical "active slate" definition (current-audit-state.ts's
 * activeSlateMatchIds -- the same function Dashboard/Active Slate/Master Ranked Board all
 * filter through), narrowed to matches that also currently resolve to an active run
 * (activeRunIds, same resolveActiveRun rule the app uses everywhere). A match on the slate
 * with no active run at all has nothing to re-audit -- creating one here would be a FIRST
 * audit, not a re-audit, which is out of this script's scope.
 */
export function selectReauditMatchIds(
  matches: readonly MatchLike[],
  runs: readonly RunLike[],
  versions: readonly SummaryVersionLike[],
  sourceRunNumber?: number,
): string[] {
  const activeMatchIds = activeSlateMatchIds(versions);
  const activeRunIdSet = activeRunIds(runs, activeMatchIds);
  const matchIdsWithActiveRun = new Set(
    runs
      .filter((run) => activeRunIdSet.has(run.id) && (sourceRunNumber === undefined || run.run_number === sourceRunNumber))
      .map((run) => run.match_id),
  );
  return matches.map((match) => match.id).filter((id) => activeMatchIds.has(id) && matchIdsWithActiveRun.has(id));
}

export interface ReauditOutcome {
  matchId: string;
  ok: boolean;
  skipped: boolean;
  reason?: string;
  newRunId?: string;
  runNumber?: number | null;
  status?: string;
}

export interface ReauditPipelineResult {
  runId: string;
  complete: boolean;
  failures: Array<{ stage: string; message: string }>;
}

export interface ReauditOptions {
  matchIds: readonly string[];
  getLatestRun(matchId: string): Promise<RunRow | null>;
  runPipeline(matchId: string): Promise<ReauditPipelineResult>;
  manifest: ManifestStore;
  /** Sequential by default (requirement 9: never overwhelm research providers); capped at
   * 3 even if a caller asks for more. */
  concurrency?: number;
  log?: (line: string) => void;
}

function classifyFailure(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("timeout") || m.includes("timed out")) return "TIMEOUT";
  if (m.includes("rate limit") || m.includes("429")) return "RATE_LIMIT";
  if (m.includes("auth") || m.includes("401") || m.includes("403")) return "AUTH_OR_CONFIG";
  return "ERROR";
}

/**
 * Runs the controlled re-audit over exactly `options.matchIds`, one forceNewRun per match,
 * at most once per match per call (a `seen` guard here, on top of the manifest, on top of
 * runPipeline's own per-run lease) -- a failure on one match is recorded and never retried
 * within the same invocation, and never blocks any other match (mapBounded's worker always
 * returns a result object here, never throws, so one failure cannot abort the batch).
 */
export async function runControlledReaudit(options: ReauditOptions): Promise<{
  outcomes: ReauditOutcome[];
  ok: number;
  failed: number;
  skipped: number;
}> {
  const log = options.log ?? (() => {});
  const concurrency = Math.max(1, Math.min(3, Math.floor(options.concurrency ?? 1)));
  const seen = new Set<string>();
  const uniqueMatchIds = [...new Set(options.matchIds)];

  const outcomes = await mapBounded<string, ReauditOutcome>(uniqueMatchIds, concurrency, async (matchId) => {
    if (seen.has(matchId)) {
      log(`[reaudit] ${matchId}: already handled this invocation, skipping duplicate.`);
      return { matchId, ok: false, skipped: true, reason: "duplicate-in-invocation" };
    }
    seen.add(matchId);

    if (options.manifest.has(matchId)) {
      log(`[reaudit] ${matchId}: already re-audited by a prior invocation of this script (manifest hit), skipping.`);
      return { matchId, ok: false, skipped: true, reason: "already-in-manifest" };
    }

    let before: RunRow | null;
    try {
      before = await options.getLatestRun(matchId);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      log(`[reaudit] ${matchId}: FAILED to read current run -- ${reason.slice(0, 300)}`);
      return { matchId, ok: false, skipped: false, reason };
    }
    if (!before || before.status !== "COMPLETE") {
      const detail = before ? before.status : "MISSING";
      log(`[reaudit] ${matchId}: skipping -- current run is ${detail}, not COMPLETE. Re-audit only reprocesses already-completed runs; this one needs to resolve naturally first.`);
      return { matchId, ok: false, skipped: true, reason: `not-complete:${detail}` };
    }

    try {
      const result = await options.runPipeline(matchId);
      if (result.runId === before.id) {
        throw new Error("forceNewRun did not create a new audit_runs row as expected -- refusing to record this as re-audited.");
      }
      const after = await options.getLatestRun(matchId);
      const status = result.complete ? "COMPLETE" : result.failures.length ? "BLOCKED" : "RUNNING";
      options.manifest.record(matchId, { matchId, newRunId: result.runId, runNumber: after?.run_number ?? null, status, completedAt: new Date().toISOString() });
      log(`[reaudit] ${matchId}: OK run_number=${after?.run_number ?? "?"} status=${status}${result.failures.length ? ` failures=${result.failures.map((f) => `${f.stage}:${classifyFailure(f.message)}`).join(",")}` : ""}`);
      return { matchId, ok: true, skipped: false, newRunId: result.runId, runNumber: after?.run_number ?? null, status };
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      log(`[reaudit] ${matchId}: FAILED -- ${classifyFailure(reason)}: ${reason.slice(0, 500)}`);
      return { matchId, ok: false, skipped: false, reason };
    }
  });

  return {
    outcomes,
    ok: outcomes.filter((o) => o.ok).length,
    failed: outcomes.filter((o) => !o.ok && !o.skipped).length,
    skipped: outcomes.filter((o) => o.skipped).length,
  };
}

const MANIFEST_PATH = path.join(process.cwd(), ".reaudit-manifests", "active-slate-reaudit.json");
const CONCURRENCY = Math.max(1, Math.min(3, Number(process.env["REAUDIT_CONCURRENCY"] ?? 1)));
const BUDGET_MS = Math.max(10_000, Number(process.env["REAUDIT_BUDGET_MS"] ?? 60_000));
const SOURCE_RUN_NUMBER = process.env["REAUDIT_SOURCE_RUN_NUMBER"] === undefined
  ? undefined
  : Number(process.env["REAUDIT_SOURCE_RUN_NUMBER"]);

async function main(): Promise<void> {
  if (!process.env["DATABASE_URL"]) {
    console.error("[reaudit] DATABASE_URL is not set.");
    process.exitCode = 1;
    return;
  }

  const { db, closePool } = await import("../src/db/client.server");
  const { matchesTable, auditRunsTable, summaryVersionsTable } = await import("../src/db/schema");
  const { makeDeps } = await import("../src/lib/audit-repo.server");
  const { runPipeline } = await import("../src/lib/audit-pipeline");

  try {
    const [matches, runs, versions] = await Promise.all([
      db.select({ id: matchesTable.id }).from(matchesTable),
      db.select({ id: auditRunsTable.id, match_id: auditRunsTable.match_id, status: auditRunsTable.status, run_number: auditRunsTable.run_number }).from(auditRunsTable),
      db.select({ match_id: summaryVersionsTable.match_id, is_active: summaryVersionsTable.is_active }).from(summaryVersionsTable),
    ]);

    const matchIds = selectReauditMatchIds(matches, runs, versions, SOURCE_RUN_NUMBER);
    console.log(`[reaudit] active-slate re-audit candidate count: ${matchIds.length}`);
    if (matchIds.length !== expectedActiveSlateCount) {
      console.error(`[reaudit] REFUSING TO PROCEED: expected exactly ${expectedActiveSlateCount} matches, found ${matchIds.length}. The active slate has changed since that count was confirmed -- re-confirm before setting REAUDIT_EXPECTED_ACTIVE_SLATE_COUNT.`);
      process.exitCode = 1;
      return;
    }

    const deps: PipelineDeps = await makeDeps();
    const manifest = createFileManifestStore(MANIFEST_PATH);

    const summary = await runControlledReaudit({
      matchIds,
      concurrency: CONCURRENCY,
      manifest,
      getLatestRun: (matchId) => deps.getLatestRun(matchId),
      runPipeline: async (matchId) => {
        const result = await runPipeline(deps, matchId, { budgetMs: BUDGET_MS, forceNewRun: true });
        return { runId: result.runId, complete: result.complete, failures: result.failures };
      },
      log: (line) => console.log(line),
    });

    console.log(`[reaudit] done. ok=${summary.ok} failed=${summary.failed} skipped=${summary.skipped} total=${matchIds.length}`);
    if (summary.failed > 0) process.exitCode = 1;
  } finally {
    await closePool();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(async (error: unknown) => {
    console.error("[reaudit] fatal:", error instanceof Error ? error.message : String(error));
    const { closePool } = await import("../src/db/client.server");
    await closePool().catch(() => {});
    process.exit(1);
  });
}
