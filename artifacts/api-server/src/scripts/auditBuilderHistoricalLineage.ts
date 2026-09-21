/**
 * auditBuilderHistoricalLineage.ts — staging-only lineage audit for the Parlay Builder over a
 * historical match cohort.
 *
 * This does NOT run computeBuilderScore or produce any Builder decision. It answers a strictly
 * narrower question per match: "does a genuine, non-fabricated Builder algorithm+calibration
 * pairing exist for this match's cutoffAt?" -- classified into exactly one of the six
 * BuilderLineageStatus values (see builderVersioning.ts), each with a human-readable reason.
 *
 * Writes ONLY to the new, dedicated `parlay_builder_lineage_audit` table (append-only, DB-level
 * immutable). It never reads or writes `predictions`, `evaluation_predictions`,
 * `parlay_leg_outcomes`, `builder_decision_log`, or `evaluation_holdout_populations` /
 * `evaluation_holdout_members` -- the canonical 2,575-match cohort, its Prediction Engine
 * output, and the frozen 9-match holdout are all read-only inputs (matches only) or untouched
 * entirely.
 *
 * Also writes a JSON summary file for human/report consumption.
 *
 * Usage:
 *   pnpm --filter @workspace/api-server exec tsx src/scripts/auditBuilderHistoricalLineage.ts \
 *     --start=2026-04-22 --end=2026-06-02 --run-id=cohort-2575-2026-09-21
 */

import { and, asc, eq, gte, lte } from "drizzle-orm";
import { db, historicalMatchesTable } from "@workspace/db";
import { writeFileSync } from "node:fs";
import {
  loadBuilderVersionHistory,
  loadCalibrationModelHistory,
  resolveBuilderLineage,
  recordBuilderLineageAudit,
  type BuilderLineageStatus,
} from "../services/parlayBuilder/builderVersioning.js";

interface ParsedArgs {
  start: string;
  end: string;
  runId: string;
}

function parseArgs(argv: string[]): ParsedArgs {
  const read = (name: string): string | undefined => {
    const direct = argv.find((arg) => arg.startsWith(`${name}=`));
    return direct ? direct.slice(name.length + 1) : undefined;
  };
  const start = read("--start");
  const end = read("--end");
  const runId = read("--run-id") ?? `audit-${new Date().toISOString()}`;
  if (!start || !end) throw new Error("--start and --end are required, e.g. --start=2026-04-22 --end=2026-06-02");
  return { start, end, runId };
}

async function main() {
  const { start, end, runId } = parseArgs(process.argv.slice(2));
  const rangeStart = new Date(`${start}T00:00:00.000Z`);
  const rangeEnd = new Date(`${end}T23:59:59.999Z`);

  console.log(`Builder historical lineage audit — runId=${runId}, range=${rangeStart.toISOString()}..${rangeEnd.toISOString()}`);

  const [versionHistory, calibrationHistory] = await Promise.all([loadBuilderVersionHistory(), loadCalibrationModelHistory()]);
  console.log(`Loaded ${versionHistory.length} Builder version manifest(s), ${calibrationHistory.length} calibration model row(s).`);

  const matches = await db
    .select({
      id: historicalMatchesTable.id,
      cutoffAt: historicalMatchesTable.cutoffAt,
      scheduledStartAt: historicalMatchesTable.scheduledStartAt,
      cancelled: historicalMatchesTable.cancelled,
    })
    .from(historicalMatchesTable)
    .where(
      and(
        eq(historicalMatchesTable.cancelled, false),
        gte(historicalMatchesTable.scheduledStartAt, rangeStart),
        lte(historicalMatchesTable.scheduledStartAt, rangeEnd),
      ),
    )
    .orderBy(asc(historicalMatchesTable.scheduledStartAt), asc(historicalMatchesTable.id));

  console.log(`Fetched ${matches.length} non-cancelled historical matches in range.`);
  console.log(
    "NOTE: this count is queried independently from historical_matches and has not been cross-checked in this session " +
      "against the Prediction Engine's own stored 2,575-match population (no live DB write credentials were available " +
      "in the session that wrote this script). Reconcile before treating this run's totals as the final cohort figure.",
  );

  const counts: Record<BuilderLineageStatus, number> = {
    VALID_HISTORICAL_LINEAGE: 0,
    NO_BUILDER_DECISION: 0,
    CALIBRATION_UNAVAILABLE: 0,
    ALGORITHM_VERSION_UNAVAILABLE: 0,
    CONFLICTING_LINEAGE: 0,
    PIT_VIOLATION: 0,
  };

  for (const match of matches) {
    if (match.cutoffAt == null) {
      counts.NO_BUILDER_DECISION += 1;
      await recordBuilderLineageAudit({
        auditRunId: runId,
        historicalMatchId: match.id,
        cutoffAt: match.scheduledStartAt,
        resolution: {
          status: "NO_BUILDER_DECISION",
          manifest: null,
          calibration: null,
          reason: "historical_matches row has no cutoffAt; no honest PIT boundary exists for this match.",
        },
      });
      continue;
    }

    const resolution = resolveBuilderLineage({ cutoffAt: match.cutoffAt, versionHistory, calibrationHistory });
    counts[resolution.status] += 1;
    await recordBuilderLineageAudit({
      auditRunId: runId,
      historicalMatchId: match.id,
      cutoffAt: match.cutoffAt,
      resolution,
    });
  }

  const summary = {
    runId,
    range: { start: rangeStart.toISOString(), end: rangeEnd.toISOString() },
    totalMatches: matches.length,
    counts,
    versionManifestCount: versionHistory.length,
    calibrationModelCount: calibrationHistory.length,
    generatedAt: new Date().toISOString(),
  };

  const outPath = `builder-lineage-audit-${runId}.json`;
  writeFileSync(outPath, JSON.stringify(summary, null, 2));
  console.log(`Summary written to ${outPath}:`);
  console.log(JSON.stringify(summary, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
