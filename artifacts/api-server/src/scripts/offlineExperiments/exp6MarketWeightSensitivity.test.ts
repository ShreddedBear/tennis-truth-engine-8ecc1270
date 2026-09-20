/**
 * Synthetic/test-only fixtures for exp6MarketWeightSensitivity.ts.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { loadAndValidate, runExperiment, CANDIDATE_WEIGHTS, type RawJoinedLegRow } from "./exp6MarketWeightSensitivity.js";
import type { FactorScore } from "./productionFormulaMirror.js";

function factor(key: string, score: number, weight: number, status: FactorScore["status"] = "available"): FactorScore {
  return { key, label: key, score, weight, status, supportsSelected: score > 52 ? true : score < 48 ? false : null, detail: "synthetic" };
}

function defaultFactors(): FactorScore[] {
  return [factor("marketConsensus", 80, 0.04), factor("surfaceElo", 60, 0.5), factor("other", 40, 0.46)];
}

function baseRow(overrides: Partial<RawJoinedLegRow> = {}): RawJoinedLegRow {
  return {
    id: 1,
    selected_player_id: "p1",
    actual_winner_id: "p1",
    resolved_at: "2026-01-02T00:00:00Z",
    source: "backfill",
    created_at: "2026-01-01T00:00:00Z",
    backfill_match_id: 999,
    factor_scores: defaultFactors(),
    joined_odds_fetched_at: "2026-01-01T00:00:00Z",
    joined_cutoff_at: "2026-01-01T06:00:00Z",
    joined_status: "graded",
    joined_included_in_accuracy: true,
    ...overrides,
  };
}

test("loadAndValidate: throws naming the exact missing structural field", () => {
  const row = baseRow({ factor_scores: null });
  assert.throws(() => loadAndValidate([row]), /missing required field\(s\) \[factor_scores\]/);
});

test("loadAndValidate: throws when factor_scores has no marketConsensus entry", () => {
  const row = baseRow({ factor_scores: [factor("surfaceElo", 60, 1.0)] });
  assert.throws(() => loadAndValidate([row]), /no entry with key "marketConsensus"/);
});

test("loadAndValidate: excludes a live-source row (no backfill_match_id join available)", () => {
  const row = baseRow({ source: "live", backfill_match_id: null });
  const { admissible, tracker } = loadAndValidate([row]);
  assert.equal(admissible.length, 0);
  assert.equal(
    tracker.toReasonsRecord()["not a backfill row with backfill_match_id — cannot verify temporal odds admissibility"],
    1,
  );
});

test("loadAndValidate: excludes when joined oddsFetchedAt is after joined cutoffAt", () => {
  const row = baseRow({ joined_odds_fetched_at: "2026-01-01T12:00:00Z", joined_cutoff_at: "2026-01-01T06:00:00Z" });
  const { admissible, tracker } = loadAndValidate([row]);
  assert.equal(admissible.length, 0);
  assert.equal(tracker.toReasonsRecord()["joined oddsFetchedAt > cutoffAt — temporal leakage"], 1);
});

test("loadAndValidate: admits a well-formed joined backfill row", () => {
  const { admissible, tracker } = loadAndValidate([baseRow()]);
  assert.equal(admissible.length, 1);
  assert.equal(tracker.nEligible, 1);
});

test("runExperiment: sweeps all candidate weights, chooses one on train only, and evaluates on a disjoint holdout", () => {
  const rows: RawJoinedLegRow[] = Array.from({ length: 20 }, (_, i) =>
    baseRow({
      id: i + 1,
      created_at: new Date(2026, 0, 1 + i).toISOString(),
      actual_winner_id: i % 2 === 0 ? "p1" : "p2",
      factor_scores: [factor("marketConsensus", i % 2 === 0 ? 80 : 20, 0.04), factor("surfaceElo", 60, 0.5), factor("other", 40, 0.46)],
    }),
  );
  const { trainSweep, holdout, provenance } = runExperiment(rows, "synthetic fixture (exp6.test.ts)");
  assert.equal(trainSweep.length, CANDIDATE_WEIGHTS.length);
  // With only 10 rows per half, well below the n>=50 sample floor, no weight should be chosen —
  // this proves the "never pick against too little data" gate rather than the chosen-weight value.
  assert.equal(holdout.chosenWeight, null);
  assert.equal(holdout.meaningfulness.isMeaningful, false);
  assert.equal(provenance.nTotal, 20);
  assert.equal(provenance.nEligible, 20);
});
