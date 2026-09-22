/**
 * compareParlayBuilderResearchV1Runs.ts — deterministic second-run comparison.
 *
 * Compares two completed COUNTERFACTUAL_RESEARCH_V1 runs (intended: the same cohort + same
 * config, run twice independently) and reports whether they are byte-for-byte identical:
 * cohortFingerprint, configFingerprint, resultSetFingerprint, and a full per-match diff as a
 * fallback if the fingerprints ever disagree (so a mismatch is diagnosable, not just detected).
 * Updates both runs' deterministicComparisonRunId/deterministicMatch fields.
 *
 * Usage:
 *   pnpm --filter @workspace/api-server exec tsx src/scripts/compareParlayBuilderResearchV1Runs.ts \
 *     --run-a=research-v1-run-a --run-b=research-v1-run-b
 */

import { eq } from "drizzle-orm";
import { writeFileSync } from "node:fs";
import { db, parlayBuilderResearchV1RunsTable, parlayBuilderResearchV1ResultsTable } from "@workspace/db";

function parseArgs(argv: string[]): { runA: string; runB: string } {
  const read = (name: string) => argv.find((a) => a.startsWith(`${name}=`))?.slice(name.length + 1);
  const runA = read("--run-a");
  const runB = read("--run-b");
  if (!runA || !runB) throw new Error("--run-a and --run-b are required");
  return { runA, runB };
}

async function main() {
  const { runA, runB } = parseArgs(process.argv.slice(2));

  const [a] = await db.select().from(parlayBuilderResearchV1RunsTable).where(eq(parlayBuilderResearchV1RunsTable.runId, runA)).limit(1);
  const [b] = await db.select().from(parlayBuilderResearchV1RunsTable).where(eq(parlayBuilderResearchV1RunsTable.runId, runB)).limit(1);
  if (!a || !b) throw new Error(`Run(s) not found: ${!a ? runA : ""} ${!b ? runB : ""}`);

  const cohortFingerprintMatch = a.cohortFingerprint === b.cohortFingerprint;
  const configFingerprintMatch = a.configFingerprint === b.configFingerprint;
  const resultSetFingerprintMatch = a.resultSetFingerprint === b.resultSetFingerprint;
  const deterministicMatch = cohortFingerprintMatch && configFingerprintMatch && resultSetFingerprintMatch;

  let perMatchDiffs: Array<{ historicalMatchId: number; field: string; a: unknown; b: unknown }> = [];
  if (!deterministicMatch) {
    const resultsA = await db.select().from(parlayBuilderResearchV1ResultsTable).where(eq(parlayBuilderResearchV1ResultsTable.runId, runA));
    const resultsB = await db.select().from(parlayBuilderResearchV1ResultsTable).where(eq(parlayBuilderResearchV1ResultsTable.runId, runB));
    const byIdB = new Map(resultsB.map((r) => [r.historicalMatchId, r]));
    for (const ra of resultsA) {
      const rb = byIdB.get(ra.historicalMatchId);
      if (!rb) {
        perMatchDiffs.push({ historicalMatchId: ra.historicalMatchId, field: "presence", a: "present", b: "missing" });
        continue;
      }
      for (const field of ["builderScore", "builderDecision", "pitStatus", "eligibility", "builderPickedPlayerId"] as const) {
        if (ra[field] !== rb[field]) perMatchDiffs.push({ historicalMatchId: ra.historicalMatchId, field, a: ra[field], b: rb[field] });
      }
    }
  }

  await db
    .update(parlayBuilderResearchV1RunsTable)
    .set({ deterministicComparisonRunId: runB, deterministicMatch })
    .where(eq(parlayBuilderResearchV1RunsTable.runId, runA));
  await db
    .update(parlayBuilderResearchV1RunsTable)
    .set({ deterministicComparisonRunId: runA, deterministicMatch })
    .where(eq(parlayBuilderResearchV1RunsTable.runId, runB));

  const report = {
    runA,
    runB,
    cohortFingerprintMatch,
    configFingerprintMatch,
    resultSetFingerprintMatch,
    deterministicMatch,
    diffCount: perMatchDiffs.length,
    diffs: perMatchDiffs.slice(0, 50),
  };
  console.log(JSON.stringify(report, null, 2));
  writeFileSync(`research-v1-determinism-${runA}-vs-${runB}.json`, JSON.stringify(report, null, 2));
  if (!deterministicMatch) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
