import {
  db,
  evaluationPredictionsTable,
  jobRunsTable,
  liveCompletedResultsTable,
  parlayPaperTradesTable,
  pool,
} from "@workspace/db";
import { desc, inArray } from "drizzle-orm";
import {
  classifyBuilderPairs,
  classifyPredictionEngineFixtures,
  isNumericFixtureId,
  hasNonTestLikeSourceLabel,
} from "./livePaperTradingStatusClassification.js";

const PE_JOB = "paper-trading-cycle";
const BUILDER_JOB = "parlay-paper-trading-cycle";
const RESULTS_JOB = "recent-completed-results-cycle";
const FIFTEEN_MINUTES = 15 * 60_000;
const FIVE_MINUTES = 5 * 60_000;
const RECENT_WINDOW = 24 * 60 * 60_000;

function time(value: Date | null | undefined): string {
  return value ? value.toISOString() : "unavailable";
}

type JobRunStatus = {
  jobName: string;
  startedAt: Date;
  finishedAt: Date | null;
  status: string;
  triggerType: string | null;
  summary: unknown;
  errorMessage: string | null;
};

function printJob(name: string, cadenceMs: number, runs: JobRunStatus[]): void {
  const latest = runs[0];
  const lastSuccess = runs.find((run) => run.status === "success");
  console.log(`  latest run: ${latest ? `${latest.status} at ${time(latest.startedAt)}` : "unavailable (no job_runs row)"}`);
  console.log(`  last SUCCESS run: ${lastSuccess ? time(lastSuccess.startedAt) : "unavailable (no successful job_runs row)"}`);
  console.log(`  finished: ${time(latest?.finishedAt)}; trigger: ${latest?.triggerType ?? "unavailable"}`);
  const nextExpected = latest ? new Date(latest.startedAt.getTime() + cadenceMs) : null;
  console.log(`  expected next cadence tick: ${time(nextExpected)}`);
  const overdueByMs = nextExpected && nextExpected < new Date() ? new Date().getTime() - nextExpected.getTime() : 0;
  console.log(`  scheduler health: unknown (no external heartbeat); ${overdueByMs ? `cadence overdue by ${Math.floor(overdueByMs / 60_000)} minutes` : "not yet overdue by latest-run cadence estimate"}`);
  const errors = runs.flatMap((run) => {
    const messages: string[] = [];
    if (run.errorMessage) messages.push(run.errorMessage);
    const summary = run.summary as Record<string, unknown> | null;
    if (Array.isArray(summary?.errors)) messages.push(...summary.errors.map(String));
    for (const phaseName of ["discovery", "markStarted", "settlement", "grading"]) {
      const phase = summary?.[phaseName] as { ok?: boolean; error?: string } | undefined;
      if (phase && phase.ok === false && phase.error) messages.push(`${phaseName}: ${phase.error}`);
    }
    return messages.map((message) => `${time(run.startedAt)} ${message}`);
  });
  console.log(`  recent errors: ${errors.length ? errors.slice(0, 5).join(" | ") : latest ? "none recorded in queried recent runs" : "unavailable (no recent job_runs)"}`);
  console.log(`  source: job_runs; cadence: ${cadenceMs / 60_000} minutes (${name})`);
}

const jobNames = [PE_JOB, BUILDER_JOB, RESULTS_JOB];
const recentJobRuns = db
  .select({
    jobName: jobRunsTable.jobName,
    startedAt: jobRunsTable.startedAt,
    finishedAt: jobRunsTable.finishedAt,
    status: jobRunsTable.status,
    triggerType: jobRunsTable.triggerType,
    summary: jobRunsTable.summary,
    errorMessage: jobRunsTable.errorMessage,
  })
  .from(jobRunsTable)
  .where(inArray(jobRunsTable.jobName, jobNames))
  .orderBy(desc(jobRunsTable.startedAt))
  .limit(60);

async function main(): Promise<void> {
  const now = new Date();
  const [peRows, builderRows, runRows, resultRows] = await Promise.all([
    db.select({
      provider: evaluationPredictionsTable.provider,
      externalFixtureId: evaluationPredictionsTable.externalFixtureId,
      runKind: evaluationPredictionsTable.runKind,
      dataSegment: evaluationPredictionsTable.dataSegment,
      status: evaluationPredictionsTable.status,
      lockedAt: evaluationPredictionsTable.lockedAt,
      scheduledStartAt: evaluationPredictionsTable.scheduledStartAt,
      predictedWinnerId: evaluationPredictionsTable.predictedWinnerId,
      gradedAt: evaluationPredictionsTable.gradedAt,
      actualWinnerId: evaluationPredictionsTable.actualWinnerId,
    }).from(evaluationPredictionsTable),
    db.select({
      pairId: parlayPaperTradesTable.pairId,
      externalFixtureId: parlayPaperTradesTable.externalFixtureId,
      fixtureProvider: parlayPaperTradesTable.fixtureProvider,
      status: parlayPaperTradesTable.status,
      scheduledStartAt: parlayPaperTradesTable.scheduledStartAt,
      frozenAt: parlayPaperTradesTable.frozenAt,
      matchStartedAt: parlayPaperTradesTable.matchStartedAt,
      decisionAt: parlayPaperTradesTable.decisionAt,
      gradedAt: parlayPaperTradesTable.gradedAt,
      gradedCorrect: parlayPaperTradesTable.gradedCorrect,
      actualWinnerId: parlayPaperTradesTable.actualWinnerId,
      createdAt: parlayPaperTradesTable.createdAt,
    }).from(parlayPaperTradesTable),
    recentJobRuns,
    db.select({
      provider: liveCompletedResultsTable.provider,
      externalId: liveCompletedResultsTable.externalId,
      ingestedAt: liveCompletedResultsTable.ingestedAt,
    }).from(liveCompletedResultsTable),
  ]);
  const pe = classifyPredictionEngineFixtures(peRows, now);
  const builder = classifyBuilderPairs(builderRows, now);
  const runsByName = (name: string) => runRows.filter((run) => run.jobName === name).slice(0, 20);
  const eligibleResults = resultRows.filter((row) =>
    isNumericFixtureId(row.externalId) && hasNonTestLikeSourceLabel(row.provider));
  const latestResult = eligibleResults.reduce<Date | null>((latest, row) =>
    !latest || row.ingestedAt > latest ? row.ingestedAt : latest, null);
  const recentResultCount = eligibleResults.filter((row) => row.ingestedAt.getTime() >= now.getTime() - RECENT_WINDOW).length;

  console.log("LIVE PAPER-TRADING STATUS (read-only; provenance unverified)");
  console.log(`As of: ${now.toISOString()}`);
  console.log("\nPrediction Engine — provider-shaped numeric-ID live rows (provenance unverified)");
  console.log(`  all-time qualifying fixtures: ${pe.fixtureCount}; prestart locks: ${pe.prestartLocks}`);
  console.log(`  missed: ${pe.counts.missed}; pending: ${pe.counts.pending}; started: ${pe.counts.started}`);
  console.log(`  graded correct: ${pe.counts.gradedCorrect}; graded incorrect: ${pe.counts.gradedIncorrect}; graded outcome unavailable: ${pe.counts.gradedUnverifiable}; void: ${pe.counts.void}`);
  console.log(`  today UTC locked cohort: ${pe.todayFixtureCount}; prestart locks: ${pe.todayPrestartLocks}`);
  console.log(`  today UTC missed: ${pe.todayCounts.missed}; pending: ${pe.todayCounts.pending}; started: ${pe.todayCounts.started}; graded correct: ${pe.todayCounts.gradedCorrect}; graded incorrect: ${pe.todayCounts.gradedIncorrect}; graded outcome unavailable: ${pe.todayCounts.gradedUnverifiable}; void: ${pe.todayCounts.void}`);
  const peEligible = peRows.filter((row) =>
    ["paper_trade", "live"].includes(row.runKind) && row.dataSegment === "live"
    && isNumericFixtureId(row.externalFixtureId) && hasNonTestLikeSourceLabel(row.provider));
  console.log(`  last successful prediction: ${time(peEligible.reduce<Date | null>((latest, row) => row.predictedWinnerId && (!latest || row.lockedAt > latest) ? row.lockedAt : latest, null))}`);
  console.log(`  last grade: ${time(peEligible.reduce<Date | null>((latest, row) => row.gradedAt && (!latest || row.gradedAt > latest) ? row.gradedAt : latest, null))}`);
  printJob(PE_JOB, FIFTEEN_MINUTES, runsByName(PE_JOB));

  console.log("\nParlay Builder — provider-shaped numeric-ID live rows (provenance unverified; one count per pair)");
  console.log(`  all-time qualifying pairs: ${builder.pairCount}`);
  console.log(`  frozen prestart: ${builder.counts.frozenPrestart}; overdue frozen: ${builder.counts.overdueFrozen}; pending result (includes STARTED without outcome, counted once): ${builder.counts.pendingResult}`);
  console.log(`  graded correct: ${builder.counts.gradedCorrect}; graded incorrect: ${builder.counts.gradedIncorrect}`);
  console.log(`  no decision: ${builder.counts.noDecision}; data error: ${builder.counts.dataError}; ineligible: ${builder.counts.ineligible}; void: ${builder.counts.void}; other/unclassified: ${builder.counts.other}`);
  console.log(`  today UTC created cohort: ${builder.todayPairCount}`);
  console.log(`  today UTC frozen prestart: ${builder.todayCounts.frozenPrestart}; overdue frozen: ${builder.todayCounts.overdueFrozen}; pending result (includes STARTED without outcome, counted once): ${builder.todayCounts.pendingResult}`);
  console.log(`  today UTC graded correct: ${builder.todayCounts.gradedCorrect}; graded incorrect: ${builder.todayCounts.gradedIncorrect}; no decision: ${builder.todayCounts.noDecision}; data error: ${builder.todayCounts.dataError}; ineligible: ${builder.todayCounts.ineligible}; void: ${builder.todayCounts.void}; other/unclassified: ${builder.todayCounts.other}`);
  console.log(`  last successful prediction: ${time(builder.lastPredictionAt)}; last grade: ${time(builder.lastGradeAt)}`);
  printJob(BUILDER_JOB, FIFTEEN_MINUTES, runsByName(BUILDER_JOB));

  console.log("\nRecent completed-results ingestion — provider-shaped numeric-ID rows (provenance unverified)");
  console.log(`  all-time provider-shaped result rows: ${eligibleResults.length}`);
  console.log(`  provider-shaped result rows ingested today UTC: ${eligibleResults.filter((row) => row.ingestedAt.toISOString().slice(0, 10) === now.toISOString().slice(0, 10)).length}`);
  console.log(`  provider-shaped result rows ingested in last 24h: ${recentResultCount}`);
  console.log(`  latest provider-shaped result ingestion: ${time(latestResult)}`);
  printJob(RESULTS_JOB, FIVE_MINUTES, runsByName(RESULTS_JOB));
  console.log("\nCaveat: provider/source labels and numeric IDs do not prove autonomous production provenance. These counts are NOT certified genuine production stats; manually-created or development fixtures may remain despite explicit test-like label filtering.");
  console.log("Unavailable means the relevant persisted evidence does not establish a value; no metrics are inferred.");
}

void main()
  .catch((error: unknown) => {
    console.error("Unable to produce live paper-trading status:", error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });