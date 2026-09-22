/**
 * runParlayBuilderResearchV1Backtest.ts — COUNTERFACTUAL_RESEARCH_V1
 *
 * Computes the counterfactual Research Builder V1 decision for every match in the frozen
 * Prediction Engine cohort, using ONLY information available strictly before each match's own
 * cutoffAt. Writes to parlay_builder_research_v1_runs / parlay_builder_research_v1_results ONLY
 * -- never touches historical_matches, predictions, evaluation_predictions, backtest_predictions,
 * parlay_leg_outcomes, builder_decision_log, evaluation_holdout_populations, or
 * evaluation_holdout_members.
 *
 * Two-phase, outcome-blind by construction:
 *   1. This script computes and freezes every decision (status -> 'decisions_frozen',
 *      decisionsFrozenAt set) WITHOUT ever reading historical_matches.winnerId.
 *   2. attachParlayBuilderResearchV1Outcomes.ts is a SEPARATE script/pass that only runs
 *      afterward, reading winnerId for the first time and writing it via the one-time-permitted
 *      outcome UPDATE the DB trigger allows.
 *
 * Usage:
 *   pnpm --filter @workspace/api-server exec tsx src/scripts/runParlayBuilderResearchV1Backtest.ts \
 *     --run-id=research-v1-run-a --start=2026-04-22 --end=2026-06-02
 *
 * Optional:
 *   --cohort-source=historical_matches (default) | backtest_run:<id>
 *     backtest_run:<id> resolves the cohort from an existing backtest_predictions set instead of
 *     re-deriving it from a date range -- use this once the authoritative backtest_runs row for
 *     this cohort has been identified, so both runs are provably scoring the exact same match set.
 */

import { asc, and, eq, gte, lte, inArray } from "drizzle-orm";
import crypto from "node:crypto";
import { writeFileSync } from "node:fs";
import {
  db,
  historicalMatchesTable,
  backtestPredictionsTable,
  evaluationPredictionsTable,
  parlayBuilderResearchV1RunsTable,
  parlayBuilderResearchV1ResultsTable,
} from "@workspace/db";
import { buildMatchHistoryIndex } from "../services/historicalData/matchRecordReconstruction.js";
import {
  computeResearchBuilderV1Score,
  RESEARCH_V1_ALGORITHM_CONFIG,
  RESEARCH_V1_CONFIG_FINGERPRINT,
  RESEARCH_BUILDER_V1_VERSION,
} from "../services/parlayBuilder/researchBuilderV1.js";

interface ParsedArgs {
  runId: string;
  start: string;
  end: string;
  cohortSource: string;
}

function parseArgs(argv: string[]): ParsedArgs {
  const read = (name: string): string | undefined => {
    const direct = argv.find((a) => a.startsWith(`${name}=`));
    return direct ? direct.slice(name.length + 1) : undefined;
  };
  const runId = read("--run-id");
  const start = read("--start");
  const end = read("--end");
  const cohortSource = read("--cohort-source") ?? "historical_matches";
  if (!runId || !start || !end) throw new Error("--run-id, --start, and --end are required");
  return { runId, start, end, cohortSource };
}

function sha256(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

/** Deterministic, key-order-independent fingerprint over a stable-sorted list of match ids. */
function fingerprintCohort(ids: number[]): string {
  const sorted = [...ids].sort((a, b) => a - b);
  return sha256(JSON.stringify(sorted));
}

/** Deterministic fingerprint over the full result set -- used for the deterministic-rerun check. */
function fingerprintResultSet(rows: Array<{ historicalMatchId: number; builderScore: number | null; builderDecision: string | null; pitStatus: string; eligibility: string }>): string {
  const sorted = [...rows].sort((a, b) => a.historicalMatchId - b.historicalMatchId);
  const tuples = sorted.map((r) => [r.historicalMatchId, r.builderScore, r.builderDecision, r.pitStatus, r.eligibility]);
  return sha256(JSON.stringify(tuples));
}

async function resolveCohort(args: ParsedArgs): Promise<{ matchIds: number[]; rows: (typeof historicalMatchesTable.$inferSelect)[] }> {
  const rangeStart = new Date(`${args.start}T00:00:00.000Z`);
  const rangeEnd = new Date(`${args.end}T23:59:59.999Z`);

  if (args.cohortSource.startsWith("backtest_run:")) {
    const backtestRunId = Number.parseInt(args.cohortSource.slice("backtest_run:".length), 10);
    const preds = await db
      .select({ historicalMatchId: backtestPredictionsTable.historicalMatchId })
      .from(backtestPredictionsTable)
      .where(eq(backtestPredictionsTable.backtestRunId, backtestRunId));
    const matchIds = preds
      .map((p) => (p.historicalMatchId != null ? Number.parseInt(p.historicalMatchId, 10) : null))
      .filter((id): id is number => id != null && Number.isFinite(id));
    const rows = matchIds.length > 0
      ? await db.select().from(historicalMatchesTable).where(inArray(historicalMatchesTable.id, matchIds)).orderBy(asc(historicalMatchesTable.scheduledStartAt), asc(historicalMatchesTable.id))
      : [];
    return { matchIds: rows.map((r) => r.id), rows };
  }

  const rows = await db
    .select()
    .from(historicalMatchesTable)
    .where(and(eq(historicalMatchesTable.cancelled, false), gte(historicalMatchesTable.scheduledStartAt, rangeStart), lte(historicalMatchesTable.scheduledStartAt, rangeEnd)))
    .orderBy(asc(historicalMatchesTable.scheduledStartAt), asc(historicalMatchesTable.id));
  return { matchIds: rows.map((r) => r.id), rows };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  console.log(`${RESEARCH_BUILDER_V1_VERSION} backtest — runId=${args.runId}, range=${args.start}..${args.end}, cohortSource=${args.cohortSource}`);

  const { matchIds, rows: cohortRows } = await resolveCohort(args);
  if (matchIds.length === 0) throw new Error("Resolved cohort is empty -- refusing to run.");

  const cohortFingerprint = fingerprintCohort(matchIds);
  console.log(`Cohort resolved: ${matchIds.length} matches, fingerprint=${cohortFingerprint}`);

  // Full corpus load for match-history reconstruction, matching the established pattern in
  // backtestFrozenVsDynamicWeights.ts / walkForward.ts -- every player's PRE-cohort history is
  // needed too, not just the cohort's own rows.
  console.log("Loading full historical_matches corpus for PIT-safe history reconstruction...");
  const allMatches = await db.select().from(historicalMatchesTable).orderBy(asc(historicalMatchesTable.scheduledStartAt), asc(historicalMatchesTable.id));
  const matchHistoryIndex = buildMatchHistoryIndex(allMatches);
  console.log(`Loaded ${allMatches.length} total historical_matches rows.`);

  // Prediction Engine output (read-only reference field) -- never used to derive the Research
  // Builder's own independent score, only reported alongside it for auditability.
  const predEngineRows = await db
    .select()
    .from(evaluationPredictionsTable)
    .where(inArray(evaluationPredictionsTable.historicalMatchId, matchIds));
  const predEngineByMatchId = new Map(predEngineRows.map((r) => [r.historicalMatchId, r]));

  const [runInsert] = await db
    .insert(parlayBuilderResearchV1RunsTable)
    .values({
      runId: args.runId,
      researchBuilderVersion: RESEARCH_BUILDER_V1_VERSION,
      configFingerprint: RESEARCH_V1_CONFIG_FINGERPRINT,
      algorithmConfig: RESEARCH_V1_ALGORITHM_CONFIG,
      cohortStart: new Date(`${args.start}T00:00:00.000Z`),
      cohortEnd: new Date(`${args.end}T23:59:59.999Z`),
      cohortFingerprint,
      cohortMatchCount: matchIds.length,
      status: "running",
      startedAt: new Date(),
    })
    .returning({ id: parlayBuilderResearchV1RunsTable.id });
  console.log(`Run row created (id=${runInsert.id}).`);

  const counts = { ELIGIBLE: 0, INELIGIBLE: 0 };
  const decisionCounts: Record<string, number> = { KEEP: 0, BORDERLINE: 0, REMOVE: 0 };
  const pitCounts = { VALID_PIT: 0, PIT_VIOLATION: 0 };
  const rejectionReasons: Record<string, number> = {};
  const resultRowsForFingerprint: Array<{ historicalMatchId: number; builderScore: number | null; builderDecision: string | null; pitStatus: string; eligibility: string }> = [];

  let processed = 0;
  for (const match of cohortRows) {
    const scored = computeResearchBuilderV1Score({
      player1Id: match.player1Id,
      player1Name: match.player1Name,
      player2Id: match.player2Id,
      player2Name: match.player2Name,
      surface: (match.surface as never) ?? null,
      cutoffAt: match.cutoffAt,
      matchHistoryIndex,
    });

    counts[scored.eligibility] += 1;
    pitCounts[scored.pitStatus] += 1;
    if (scored.builderDecision) decisionCounts[scored.builderDecision] = (decisionCounts[scored.builderDecision] ?? 0) + 1;
    if (scored.rejectionReason) rejectionReasons[scored.rejectionReason] = (rejectionReasons[scored.rejectionReason] ?? 0) + 1;

    const predEngine = predEngineByMatchId.get(match.id);

    await db.insert(parlayBuilderResearchV1ResultsTable).values({
      runId: args.runId,
      historicalMatchId: match.id,
      scheduledStartAt: match.scheduledStartAt,
      cutoffAt: match.cutoffAt,
      player1Id: match.player1Id,
      player1Name: match.player1Name,
      player2Id: match.player2Id,
      player2Name: match.player2Name,
      surface: match.surface,
      predictionEngineOutput: predEngine
        ? {
            source: "evaluation_predictions",
            sourceId: predEngine.id,
            rawProbability: predEngine.rawProbability,
            calibratedProbability: predEngine.calibratedProbability,
            predictedWinnerId: predEngine.predictedWinnerId,
            modelVersion: predEngine.modelVersion,
            runKind: predEngine.runKind,
          }
        : null,
      researchBuilderVersion: RESEARCH_BUILDER_V1_VERSION,
      configFingerprint: RESEARCH_V1_CONFIG_FINGERPRINT,
      calibrationSnapshotId: null,
      calibrationFittedAt: null,
      builderScore: scored.builderScore,
      builderPickedPlayerId: scored.builderPickedPlayerId,
      builderDecision: scored.builderDecision,
      eligibility: scored.eligibility,
      rejectionReason: scored.rejectionReason,
      pitStatus: scored.pitStatus,
      dataCoverage: scored.dataCoverage,
      factorScores: scored.factorScores as unknown as Record<string, unknown>,
      // outcome_* columns intentionally left NULL here -- attached only by the separate,
      // later attachParlayBuilderResearchV1Outcomes.ts pass, after decisionsFrozenAt below.
      provenance: {
        cohortSource: args.cohortSource,
        predictionEngineOutputFound: predEngine != null,
      },
    });

    processed += 1;
    resultRowsForFingerprint.push({
      historicalMatchId: match.id,
      builderScore: scored.builderScore,
      builderDecision: scored.builderDecision,
      pitStatus: scored.pitStatus,
      eligibility: scored.eligibility,
    });
    if (processed % 250 === 0) console.log(`  ${processed}/${cohortRows.length} scored...`);
  }

  const resultSetFingerprint = fingerprintResultSet(resultRowsForFingerprint);
  const summary = {
    totalMatches: matchIds.length,
    eligibility: counts,
    decisions: decisionCounts,
    pit: pitCounts,
    rejectionReasons,
  };

  await db
    .update(parlayBuilderResearchV1RunsTable)
    .set({
      status: "decisions_frozen",
      decisionsFrozenAt: new Date(),
      resultSetFingerprint,
      summary,
    })
    .where(eq(parlayBuilderResearchV1RunsTable.runId, args.runId));

  console.log(`Decisions frozen. resultSetFingerprint=${resultSetFingerprint}`);
  console.log(JSON.stringify(summary, null, 2));

  const outPath = `research-v1-decisions-${args.runId}.json`;
  writeFileSync(outPath, JSON.stringify({ runId: args.runId, cohortFingerprint, resultSetFingerprint, configFingerprint: RESEARCH_V1_CONFIG_FINGERPRINT, summary }, null, 2));
  console.log(`Summary written to ${outPath}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
