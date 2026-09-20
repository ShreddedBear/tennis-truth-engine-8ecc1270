import { describe, expect, it } from "vitest";
import { computeCommonOpponentDifferentialFromRows } from "./audit-metric-031-common-opponent-point-differential";
import type { RepositoryResultsObservation } from "./repository-results-history.server";

function row(opponent: string, sets_for: number | null, sets_against: number | null): RepositoryResultsObservation {
  return {
    source_id: "atp", source_name: "test", source_url: null, player_name: "Player", opponent_name: opponent,
    tournament: null, event_date: "2024-01-01", surface: null, observation_type: "MATCH_RESULT_OR_SCHEDULE", observation_key: "match_record",
    text_value: "{}", sample_label: null,
    raw_payload: { history_detail: { sets_for, sets_against } },
    provenance: {},
  };
}

describe("metric #031 — Common-Opponent Adjusted Point Differential", () => {
  it("returns null with no common opponents at all", () => {
    const out = computeCommonOpponentDifferentialFromRows({
      playerRows: [row("Alice", 2, 0)],
      referenceRows: [row("Bob", 2, 1)],
      opponentEloByKey: new Map([["alice", 1500], ["bob", 1500]]),
    });
    expect(out).toBeNull();
  });

  it("computes a positive differential when the player has a better set differential against the shared opponent", () => {
    const out = computeCommonOpponentDifferentialFromRows({
      playerRows: [row("Common Opp", 2, 0)],   // +2
      referenceRows: [row("Common Opp", 0, 2)], // -2
      opponentEloByKey: new Map([["common opp", 1500]]),
    });
    expect(out).not.toBeNull();
    expect(out!.common_opponents_n).toBe(1);
    expect(out!.player_adjusted_set_differential).toBe(2);
    expect(out!.reference_adjusted_set_differential).toBe(-2);
    expect(out!.differential).toBe(4);
  });

  it("weights a stronger common opponent's result more heavily than a weaker one", () => {
    const out = computeCommonOpponentDifferentialFromRows({
      playerRows: [row("Strong Opp", 2, 0), row("Weak Opp", 0, 2)], // +2 vs the strong opponent, -2 vs the weak one
      referenceRows: [row("Strong Opp", 0, 0), row("Weak Opp", 0, 0)],
      opponentEloByKey: new Map([["strong opp", 1900], ["weak opp", 1100]]),
    });
    // a flat average of +2 and -2 would be 0 -- weighting the +2 result (against
    // the stronger, higher-Elo opponent) more heavily should push it positive
    expect(out!.player_adjusted_set_differential).toBeGreaterThan(0);
  });

  it("excludes a common opponent with no known Elo rating rather than defaulting to a guessed rating", () => {
    const out = computeCommonOpponentDifferentialFromRows({
      playerRows: [row("Common Opp", 2, 0), row("No Elo Opp", 1, 0)],
      referenceRows: [row("Common Opp", 0, 2), row("No Elo Opp", 0, 1)],
      opponentEloByKey: new Map([["common opp", 1500]]), // "No Elo Opp" deliberately omitted
    });
    expect(out!.common_opponents_n).toBe(1);
  });

  it("skips a row with missing sets_for/sets_against rather than fabricating a differential", () => {
    const out = computeCommonOpponentDifferentialFromRows({
      playerRows: [row("Common Opp", null, null)],
      referenceRows: [row("Common Opp", 0, 2)],
      opponentEloByKey: new Map([["common opp", 1500]]),
    });
    expect(out).toBeNull(); // player has no usable row against the common opponent at all
  });
});
