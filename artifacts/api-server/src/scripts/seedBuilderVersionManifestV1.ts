/**
 * seedBuilderVersionManifestV1.ts — one-time seed of the FIRST (and, as of this writing, ONLY)
 * Parlay Builder version manifest into `parlay_builder_version_manifests`.
 *
 * This is not a reconstruction of unknown history. Every value below was read directly from
 * this exact repository's git history (never fabricated, never guessed) and is cited by commit
 * SHA and timestamp in `provenance`:
 *
 *   - DEFAULT_WEIGHTS / AGREEMENT_EDGE_WEIGHTS below are copied verbatim from
 *     builderScoringService.ts, confirmed identical at commit 82e372353c527f248fba95e11375bf1802262a7e
 *     ("Integrate the complete Truth Engine under the Stats Engine navigation",
 *     2026-09-14T12:16:31Z) -- the earliest commit where this exact configuration existed. That
 *     commit already included the getActiveCalibration()/applyCalibrationOriented() wiring too,
 *     so 2026-09-14T12:16:31Z is the genuine effectiveFrom for "the current algorithm, paired
 *     with calibration lookup, as a coherent whole" -- not an approximation.
 *   - No calibration_models row existed yet at that instant (the table's first two rows were
 *     both fitted 2026-09-16, per a live read-only query against heliumdb on 2026-09-21) --
 *     calibrationModelId is intentionally null here; PIT lookup already handles that
 *     two-day gap correctly via its own independent calibration-history search.
 *   - The comment block above DEFAULT_WEIGHTS in builderScoringService.ts attributes these exact
 *     values to a "Full-corpus ablation re-run 2026-08-11 on n=39,000 resolved legs" via
 *     auditParlayFactorWeights.ts. That script's own docstring says it derives weights from
 *     `parlay_leg_outcomes` backfill rows -- but a live read-only query against heliumdb on
 *     2026-09-21 found parlay_leg_outcomes has only 958 rows total, none older than
 *     2026-09-14T20:33:40Z. The cited 2026-08-11 / n=39,000 ablation run's source rows no longer
 *     exist in the live database, so this seed can NEITHER confirm NOR rule out that the ablation
 *     corpus overlapped the 2026-04-22–2026-06-02 backtest cohort. This is recorded verbatim as
 *     `provenance.conflictingEvidence` -- not silently dropped, not resolved by assumption -- and
 *     is why `confidence` is "high" for the algorithm config's IDENTITY (it is exactly what's in
 *     source control) but callers scoring the 2026-04-22–2026-06-02 cohort against this config
 *     must treat that specific use as carrying an unresolved leakage risk.
 *
 * Idempotent: does nothing if a version 1 row already exists.
 *
 * Run:
 *   pnpm --filter @workspace/api-server exec tsx src/scripts/seedBuilderVersionManifestV1.ts
 */

import { db, builderVersionManifestsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { insertBuilderVersionManifest, computeConfigFingerprint } from "../services/parlayBuilder/builderVersioning.js";

const SOURCE_COMMIT = "82e372353c527f248fba95e11375bf1802262a7e";
const EFFECTIVE_FROM = new Date("2026-09-14T12:16:31.000Z");

// Copied verbatim from builderScoringService.ts's DEFAULT_WEIGHTS (confirmed present at
// SOURCE_COMMIT via `git show <sha>:...builderScoringService.ts`).
const DEFAULT_WEIGHTS: Record<string, number> = {
  surfaceElo: 0.153,
  surfaceAdvantage: 0.119,
  surfaceRecord: 0.095,
  sourceAgreement: 0.072,
  serveAdvantage: 0.071,
  returnAdvantage: 0.071,
  recentForm: 0.08,
  overallAdvantage: 0.061,
  strengthOfSchedule: 0.06,
  currentRanking: 0.048,
  marketConsensus: 0.04,
  headToHead: 0.024,
  historicalConsistency: 0.024,
  travelFatigue: 0.023,
  injuryRisk: 0.023,
  tournamentExperience: 0.016,
  dataQuality: 0.016,
  historicalVolatility: 0.004,
};

// Copied verbatim from builderScoringService.ts's AGREEMENT_EDGE_WEIGHTS (same commit).
const AGREEMENT_EDGE_WEIGHTS: Record<string, number> = {
  serveAdvantage: 23.8,
  returnAdvantage: 23.8,
  currentRanking: 20.9,
  strengthOfSchedule: 19.3,
  overallAdvantage: 13.0,
  sourceAgreement: 10.3,
  surfaceElo: 9.9,
  recentForm: 8.5,
  headToHead: 8.5,
  surfaceRecord: 6.8,
  surfaceAdvantage: 6.7,
  historicalConsistency: 5.1,
  marketConsensus: 5.0,
  travelFatigue: 5.0,
  injuryRisk: 5.0,
  tournamentExperience: 0.0,
  historicalVolatility: 0.0,
};

const algorithmConfig = { defaultWeights: DEFAULT_WEIGHTS, agreementEdgeWeights: AGREEMENT_EDGE_WEIGHTS };

async function main() {
  const [existing] = await db
    .select({ id: builderVersionManifestsTable.id })
    .from(builderVersionManifestsTable)
    .where(eq(builderVersionManifestsTable.version, 1))
    .limit(1);

  if (existing != null) {
    console.log(`Version 1 manifest already exists (id=${existing.id}); nothing to do.`);
    return;
  }

  const id = await insertBuilderVersionManifest({
    version: 1,
    effectiveFrom: EFFECTIVE_FROM,
    algorithmConfig,
    calibrationModelId: null,
    optimizerRunId: null,
    sourceCommit: SOURCE_COMMIT,
    reconstructionMethod: "observed_from_source",
    confidence: "high",
    provenance: {
      sourceCommitDate: EFFECTIVE_FROM.toISOString(),
      note: "First commit where this exact DEFAULT_WEIGHTS/AGREEMENT_EDGE_WEIGHTS configuration, together with the getActiveCalibration()/applyCalibrationOriented() wiring, is present verbatim in builderScoringService.ts.",
      calibrationAtEffectiveFrom: "none -- first calibration_models row not fitted until 2026-09-16T03:02:57.668Z (confirmed via live read-only query 2026-09-21), two days after this version's effectiveFrom. PIT lookup handles this gap independently; do not infer a calibration pairing for 2026-09-14–2026-09-16.",
      weightsAblationScript: "artifacts/api-server/src/scripts/auditParlayFactorWeights.ts",
      weightsAblationCitedDate: "2026-08-11",
      weightsAblationCitedSampleSize: 39000,
      conflictingEvidence:
        "auditParlayFactorWeights.ts derives weights from parlay_leg_outcomes backfill rows, but a live read-only query against heliumdb on 2026-09-21 found parlay_leg_outcomes has only 958 rows total, none older than 2026-09-14T20:33:40.834Z -- i.e. AFTER the cited 2026-08-11 ablation date. The n=39,000-leg corpus that ablation was run against no longer exists in the live database and cannot be dated or inspected. This seed can neither confirm nor rule out that it overlapped the 2026-04-22T00:00:00Z–2026-06-02T23:59:59.999Z backtest cohort. Any retroactive scoring of that cohort against this algorithmConfig carries an UNRESOLVED leakage risk and must be reported as such, never presented as clean.",
      reconstructedBy: "Claude historical-builder-integration audit, 2026-09-21, per explicit user instruction to build future-proofing lineage infrastructure.",
    },
  });

  const fingerprint = computeConfigFingerprint(algorithmConfig);
  console.log(`Inserted Builder version manifest v1 (id=${id}), effectiveFrom=${EFFECTIVE_FROM.toISOString()}, fingerprint=${fingerprint}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
