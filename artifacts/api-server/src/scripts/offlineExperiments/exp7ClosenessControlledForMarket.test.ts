/**
 * Synthetic/test-only fixtures for exp7ClosenessControlledForMarket.ts.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { loadAndValidate, runExperiment, type RawReconstructedLegRow } from "./exp7ClosenessControlledForMarket.js";

function baseRow(overrides: Partial<RawReconstructedLegRow> = {}): RawReconstructedLegRow {
  return {
    id: 1,
    selected_player_id: "p1",
    actual_winner_id: "p1",
    resolved_at: "2026-01-02T00:00:00Z",
    source: "backfill",
    created_at: "2026-01-01T00:00:00Z",
    backfill_match_id: 999,
    sel_win_rate: 0.6,
    opp_win_rate: 0.55,
    sel_win_rate_confidence: 1,
    opp_win_rate_confidence: 1,
    surface: "Hard",
    sel_surface_total: 10,
    opp_surface_total: 10,
    sel_surface_win_rate: 0.6,
    opp_surface_win_rate: 0.55,
    sel_rank: 10,
    opp_rank: 15,
    joined_odds_player1_decimal: 1.8,
    joined_odds_player2_decimal: 2.1,
    joined_odds_fetched_at: "2026-01-01T00:00:00Z",
    joined_cutoff_at: "2026-01-01T06:00:00Z",
    joined_status: "graded",
    joined_included_in_accuracy: true,
    selected_is_player1: true,
    ...overrides,
  };
}

test("loadAndValidate: throws naming the exact missing structural field", () => {
  const row = baseRow({ sel_win_rate: null });
  assert.throws(() => loadAndValidate([row]), /missing required field\(s\) \[sel_win_rate\]/);
});

test("loadAndValidate: throws naming missing joined fields separately from structural ones", () => {
  const row = baseRow({ joined_odds_player1_decimal: null });
  assert.throws(() => loadAndValidate([row]), /missing required field\(s\) \[joined_odds_player1_decimal\]/);
});

test("loadAndValidate: excludes non-backfill rows (cannot verify temporal odds admissibility)", () => {
  const row = baseRow({ source: "live", backfill_match_id: null });
  const { admissible, tracker } = loadAndValidate([row]);
  assert.equal(admissible.length, 0);
  assert.equal(
    tracker.toReasonsRecord()["not a backfill row with backfill_match_id — cannot verify temporal odds admissibility"],
    1,
  );
});

test("loadAndValidate: admits a well-formed row and computes both with/without-market closeness", () => {
  const { admissible, tracker } = loadAndValidate([baseRow()]);
  assert.equal(admissible.length, 1);
  assert.equal(tracker.nEligible, 1);
  // withMarket includes a marketGapSignal; withoutMarket does not.
  assert.notEqual(admissible[0].withMarket.marketGapSignal, null);
  assert.equal(admissible[0].withoutMarket.marketGapSignal, null);
});

test("runExperiment: produces both with/without-market band tables and reconciled provenance on synthetic data", () => {
  const rows: RawReconstructedLegRow[] = [
    baseRow({ id: 1, actual_winner_id: "p1" }),
    baseRow({ id: 2, actual_winner_id: "p2" }),
    baseRow({ id: 3, source: "live", backfill_match_id: null }), // excluded
  ];
  const { table, provenance } = runExperiment(rows, "synthetic fixture (exp7.test.ts)");
  assert.ok(table.some((t) => t.variant === "with_market_component"));
  assert.ok(table.some((t) => t.variant === "without_market_component"));
  assert.equal(table.length, 6); // 2 variants x 3 bands
  assert.equal(provenance.nTotal, 3);
  assert.equal(provenance.nEligible, 2);
  assert.equal(
    provenance.exclusionReasons["not a backfill row with backfill_match_id — cannot verify temporal odds admissibility"],
    1,
  );
});
