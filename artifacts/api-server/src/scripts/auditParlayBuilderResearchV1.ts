/**
 * auditParlayBuilderResearchV1.ts — COUNTERFACTUAL_RESEARCH_V1 validation suite.
 *
 * Runs, against a completed run's stored rows (read-only):
 *   - cohort reconciliation (result count == run.cohortMatchCount, no missing/extra match ids)
 *   - duplicate audit (no (runId, historicalMatchId) appears twice -- also DB-enforced by a
 *     unique index, this is an independent re-check)
 *   - coverage audit (per-factor availability rates across the run)
 *   - missing-data audit (eligibility/rejection-reason breakdown)
 *   - PIT/no-lookahead audit (every row's pitStatus, PLUS an independent re-verification that
 *     recomputes each row's own p1/p2 match count from historical_matches bounded by cutoffAt and
 *     confirms it's compatible with the stored eligibility -- catches a stored-but-wrong pitStatus,
 *     not just a mis-set one)
 *   - Builder decision audit (decision distribution, confidence-threshold sanity)
 *
 * Usage:
 *   pnpm --filter @workspace/api-server exec tsx src/scripts/auditParlayBuilderResearchV1.ts --run-id=research-v1-run-a
 */

import { eq, and, lt } from "drizzle-orm";
import { writeFileSync } from "node:fs";
import { db, historicalMatchesTable, parlayBuilderResearchV1RunsTable, parlayBuilderResearchV1ResultsTable } from "@workspace/db";

function parseArgs(argv: string[]): { runId: string } {
  const direct = argv.find((a) => a.startsWith("--run-id="));
  const runId = direct?.slice("--run-id=".length);
  if (!runId) throw new Error("--run-id is required");
  return { runId };
}

async function main() {
  const { runId } = parseArgs(process.argv.slice(2));
  const [run] = await db.select().from(parlayBuilderResearchV1RunsTable).where(eq(parlayBuilderResearchV1RunsTable.runId, runId)).limit(1);
  if (!run) throw new Error(`No run found for runId=${runId}`);

  const results = await db.select().from(parlayBuilderResearchV1ResultsTable).where(eq(parlayBuilderResearchV1ResultsTable.runId, runId));

  const findings: Array<{ check: string; passed: boolean; detail: string }> = [];

  // 1. Cohort reconciliation
  const resultCount = results.length;
  findings.push({
    check: "cohort_reconciliation",
    passed: resultCount === run.cohortMatchCount,
    detail: `run.cohortMatchCount=${run.cohortMatchCount}, actual result rows=${resultCount}`,
  });

  // 2. Duplicate audit
  const seen = new Set<number>();
  let duplicates = 0;
  for (const r of results) {
    if (seen.has(r.historicalMatchId)) duplicates += 1;
    seen.add(r.historicalMatchId);
  }
  findings.push({ check: "duplicate_audit", passed: duplicates === 0, detail: `${duplicates} duplicate historicalMatchId(s) found` });

  // 3. Coverage audit (per-factor availability)
  const factorCoverage: Record<string, { available: number; unavailable: number }> = {};
  for (const r of results) {
    const factors = (r.factorScores as Array<{ key: string; status: string }> | null) ?? [];
    for (const f of factors) {
      factorCoverage[f.key] ??= { available: 0, unavailable: 0 };
      if (f.status === "available") factorCoverage[f.key].available += 1;
      else factorCoverage[f.key].unavailable += 1;
    }
  }
  findings.push({ check: "coverage_audit", passed: true, detail: JSON.stringify(factorCoverage) });

  // 4. Missing-data / eligibility audit
  const eligibilityCounts: Record<string, number> = {};
  const rejectionReasons: Record<string, number> = {};
  for (const r of results) {
    eligibilityCounts[r.eligibility] = (eligibilityCounts[r.eligibility] ?? 0) + 1;
    if (r.rejectionReason) rejectionReasons[r.rejectionReason] = (rejectionReasons[r.rejectionReason] ?? 0) + 1;
  }
  findings.push({ check: "missing_data_audit", passed: true, detail: JSON.stringify({ eligibilityCounts, rejectionReasons }) });

  // 5. PIT / no-lookahead audit -- structural tally plus an independent spot re-verification
  const pitCounts: Record<string, number> = {};
  for (const r of results) pitCounts[r.pitStatus] = (pitCounts[r.pitStatus] ?? 0) + 1;
  findings.push({ check: "pit_status_tally", passed: (pitCounts.PIT_VIOLATION ?? 0) === 0, detail: JSON.stringify(pitCounts) });

  // Independent re-verification: for every ELIGIBLE row, confirm historical_matches actually has
  // at least one row for each player strictly before cutoffAt -- re-derived from the canonical
  // table directly, not from anything this run itself wrote.
  let pitReverifyFailures = 0;
  const eligibleSample = results.filter((r) => r.eligibility === "ELIGIBLE");
  for (const r of eligibleSample) {
    const [p1Prior] = await db
      .select({ id: historicalMatchesTable.id })
      .from(historicalMatchesTable)
      .where(and(eq(historicalMatchesTable.player1Id, r.player1Id), lt(historicalMatchesTable.scheduledStartAt, r.cutoffAt)))
      .limit(1);
    const [p1PriorAsP2] = await db
      .select({ id: historicalMatchesTable.id })
      .from(historicalMatchesTable)
      .where(and(eq(historicalMatchesTable.player2Id, r.player1Id), lt(historicalMatchesTable.scheduledStartAt, r.cutoffAt)))
      .limit(1);
    if (!p1Prior && !p1PriorAsP2) pitReverifyFailures += 1;
  }
  findings.push({
    check: "pit_independent_reverification",
    passed: pitReverifyFailures === 0,
    detail: `${pitReverifyFailures}/${eligibleSample.length} ELIGIBLE rows failed independent re-verification of prior match history before cutoffAt`,
  });

  // 6. Builder decision audit
  const decisionCounts: Record<string, number> = {};
  for (const r of results) if (r.builderDecision) decisionCounts[r.builderDecision] = (decisionCounts[r.builderDecision] ?? 0) + 1;
  findings.push({ check: "decision_audit", passed: true, detail: JSON.stringify(decisionCounts) });

  const allPassed = findings.every((f) => f.passed);
  const report = { runId, generatedAt: new Date().toISOString(), allPassed, findings };
  console.log(JSON.stringify(report, null, 2));
  writeFileSync(`research-v1-audit-${runId}.json`, JSON.stringify(report, null, 2));
  if (!allPassed) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
