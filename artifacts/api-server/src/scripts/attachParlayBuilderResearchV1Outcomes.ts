/**
 * attachParlayBuilderResearchV1Outcomes.ts — COUNTERFACTUAL_RESEARCH_V1, phase 2.
 *
 * Reads historical_matches.winnerId (read-only) for the FIRST time in this run's lifecycle and
 * attaches it to each already-frozen decision row, via the one-time-permitted outcome UPDATE the
 * immutability trigger allows (see ensureEvaluationSchema.ts). Refuses to run against a run whose
 * decisions were not already frozen (decisionsFrozenAt IS NULL) -- outcomes must never be visible
 * to, or attachable before, the decision-computation pass.
 *
 * Usage:
 *   pnpm --filter @workspace/api-server exec tsx src/scripts/attachParlayBuilderResearchV1Outcomes.ts --run-id=research-v1-run-a
 */

import { eq, and, isNull } from "drizzle-orm";
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
  if (run.decisionsFrozenAt == null) {
    throw new Error(`Run ${runId} has not frozen its decisions yet (decisionsFrozenAt is null) -- refusing to attach outcomes before the full decision set is frozen.`);
  }
  if (run.outcomesAttachedAt != null) {
    console.log(`Run ${runId} already had outcomes attached at ${run.outcomesAttachedAt.toISOString()}; nothing to do.`);
    return;
  }

  const results = await db
    .select({
      id: parlayBuilderResearchV1ResultsTable.id,
      historicalMatchId: parlayBuilderResearchV1ResultsTable.historicalMatchId,
      builderPickedPlayerId: parlayBuilderResearchV1ResultsTable.builderPickedPlayerId,
      eligibility: parlayBuilderResearchV1ResultsTable.eligibility,
    })
    .from(parlayBuilderResearchV1ResultsTable)
    .where(and(eq(parlayBuilderResearchV1ResultsTable.runId, runId), isNull(parlayBuilderResearchV1ResultsTable.outcomeActualWinnerId)));

  console.log(`Attaching outcomes for ${results.length} decision rows in run ${runId}...`);

  let included = 0;
  let correct = 0;
  let attached = 0;
  for (const result of results) {
    const [match] = await db
      .select({ winnerId: historicalMatchesTable.winnerId, cancelled: historicalMatchesTable.cancelled, retired: historicalMatchesTable.retired, walkover: historicalMatchesTable.walkover })
      .from(historicalMatchesTable)
      .where(eq(historicalMatchesTable.id, result.historicalMatchId))
      .limit(1);
    if (!match) continue;

    const isVoid = match.cancelled || match.walkover;
    const includedInAccuracy = result.eligibility === "ELIGIBLE" && !isVoid && match.winnerId != null;
    const outcomeCorrect = includedInAccuracy ? result.builderPickedPlayerId === match.winnerId : null;

    await db
      .update(parlayBuilderResearchV1ResultsTable)
      .set({
        outcomeActualWinnerId: match.winnerId,
        outcomeIncludedInAccuracy: includedInAccuracy,
        outcomeCorrect,
      })
      .where(eq(parlayBuilderResearchV1ResultsTable.id, result.id));

    attached += 1;
    if (includedInAccuracy) {
      included += 1;
      if (outcomeCorrect) correct += 1;
    }
  }

  const accuracyPct = included > 0 ? Math.round((correct / included) * 1000) / 10 : null;
  await db
    .update(parlayBuilderResearchV1RunsTable)
    .set({
      status: "completed",
      outcomesAttachedAt: new Date(),
      completedAt: new Date(),
      summary: {
        ...(run.summary as Record<string, unknown>),
        outcomes: { attached, includedInAccuracy: included, correct, accuracyPct },
      },
    })
    .where(eq(parlayBuilderResearchV1RunsTable.runId, runId));

  console.log(`Attached ${attached} outcomes. Included in accuracy: ${included}. Correct: ${correct}. Accuracy: ${accuracyPct}%.`);
  writeFileSync(`research-v1-outcomes-${runId}.json`, JSON.stringify({ runId, attached, included, correct, accuracyPct }, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
