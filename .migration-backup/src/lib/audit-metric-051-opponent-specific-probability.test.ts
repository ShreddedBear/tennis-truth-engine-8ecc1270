import { describe, expect, it } from "vitest";
import { computeOpponentSpecificProbabilityFromRows, DEFAULT_SHRINKAGE_K } from "./audit-metric-051-opponent-specific-probability";
import type { RepositoryResultsObservation } from "./repository-results-history.server";

function row(player: string, opponent: string, winner: string | null, eventDate = "2025-01-01"): RepositoryResultsObservation {
  return {
    source_id: "atp", source_name: "test", source_url: null,
    player_name: player, opponent_name: opponent, tournament: "Test Open", event_date: eventDate, surface: "hard",
    observation_type: "MATCH_RESULT_OR_SCHEDULE", observation_key: "match_record", text_value: "",
    sample_label: null, raw_payload: { winner }, provenance: {},
  };
}

describe("metric #051 — Opponent-Specific Probability (shrinkage core)", () => {
  it("falls all the way back to the general probability at n_h2h=0", () => {
    const out = computeOpponentSpecificProbabilityFromRows({ player: "Alice Alpha", opponent: "Bob Beta", rows: [row("Alice Alpha", "Someone Else", "Alice Alpha")], generalWinProbabilityPct: 63.4 });
    expect(out?.n_h2h).toBe(0);
    expect(out?.raw_h2h_win_pct).toBeNull();
    expect(out?.shrunk_win_probability_pct).toBe(63.4);
  });

  it("weights H2H roughly 50/50 with the general model once n_h2h equals k", () => {
    const rows = Array.from({ length: DEFAULT_SHRINKAGE_K }, () => row("Alice Alpha", "Bob Beta", "Alice Alpha"));
    const out = computeOpponentSpecificProbabilityFromRows({ player: "Alice Alpha", opponent: "Bob Beta", rows, generalWinProbabilityPct: 40 });
    expect(out?.n_h2h).toBe(DEFAULT_SHRINKAGE_K);
    expect(out?.raw_h2h_win_pct).toBe(100);
    expect(out?.shrinkage_weight).toBeCloseTo(0.5, 2);
    // Halfway between 100 (perfect H2H record) and 40 (general model) = 70.
    expect(out?.shrunk_win_probability_pct).toBeCloseTo(70, 0);
  });

  it("always reports the real n_h2h alongside the shrunk number, never hides sample size", () => {
    const rows = [row("Alice Alpha", "Bob Beta", "Bob Beta"), row("Alice Alpha", "Bob Beta", "Bob Beta")];
    const out = computeOpponentSpecificProbabilityFromRows({ player: "Alice Alpha", opponent: "Bob Beta", rows, generalWinProbabilityPct: 55 });
    expect(out?.n_h2h).toBe(2);
    expect(out?.raw_h2h_win_pct).toBe(0);
    // With only 2 losses (a small sample), the shrunk number should move
    // toward 0 but not collapse all the way there -- it must stay well
    // above 0, proving the general model still has real weight.
    expect(out!.shrunk_win_probability_pct).toBeGreaterThan(30);
    expect(out!.shrunk_win_probability_pct).toBeLessThan(55);
  });

  it("ignores meetings against a different opponent (never conflates two different H2H records)", () => {
    const rows = [row("Alice Alpha", "Someone Else", "Alice Alpha"), row("Alice Alpha", "Someone Else", "Alice Alpha"), row("Alice Alpha", "Bob Beta", "Bob Beta")];
    const out = computeOpponentSpecificProbabilityFromRows({ player: "Alice Alpha", opponent: "Bob Beta", rows, generalWinProbabilityPct: 50 });
    expect(out?.n_h2h).toBe(1);
  });

  it("returns null (NOT_ENOUGH_DATA upstream) when no usable general probability is supplied", () => {
    expect(computeOpponentSpecificProbabilityFromRows({ player: "Alice Alpha", opponent: "Bob Beta", rows: [], generalWinProbabilityPct: Number.NaN })).toBeNull();
    expect(computeOpponentSpecificProbabilityFromRows({ player: "Alice Alpha", opponent: "Bob Beta", rows: [], generalWinProbabilityPct: 140 })).toBeNull();
  });

  it("returns null when player and opponent resolve to the same identity", () => {
    expect(computeOpponentSpecificProbabilityFromRows({ player: "Alice Alpha", opponent: "alice alpha", rows: [], generalWinProbabilityPct: 50 })).toBeNull();
  });

  // Leakage test: this module trusts the caller (computeOpponentSpecificProbability's
  // live wrapper) to have already leakage-filtered rows via
  // repositoryResultsRows(..., {strictBefore:true}). This proves the pure
  // core itself doesn't perform any additional date filtering that could
  // mask a leak, AND doesn't accidentally exclude legitimate same-day-boundary
  // rows -- it counts exactly the rows it's given, so a future-dated row that
  // slips through the caller's filter would still show up here, making any
  // leakage failure visible at this layer's own test rather than silently
  // absorbed.
  it("counts exactly the rows passed in — a future-dated row is not itself filtered here, so a caller leak would be visible, not silently absorbed", () => {
    const rows = [row("Alice Alpha", "Bob Beta", "Alice Alpha", "2030-01-01")];
    const out = computeOpponentSpecificProbabilityFromRows({ player: "Alice Alpha", opponent: "Bob Beta", rows, generalWinProbabilityPct: 50 });
    expect(out?.n_h2h).toBe(1);
  });
});
