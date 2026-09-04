// Phase 16 regression tests: three live, wired producers
// (common-opponent-enhanced.server.ts, tournament-context.server.ts,
// travel-burden.server.ts) contained the exact pre-Phase-13 fail-open temporal bug --
// `!cutoff || !row.date || row.date < cutoff` -- which admits every row (including rows
// dated AFTER the audited match) whenever the audited match's context carries no
// parseable date, or a row itself has no date. None of the three were covered by
// truth-engine-temporal-integrity.leakage.test.ts, so the bug shipped unnoticed
// alongside the Phase 13 fix elsewhere. These tests prove the fix directly against
// each producer's real logic (not a reimplementation of it).
import { describe, expect, it } from "vitest";
import { computeEnhancedCommonOpponentStatsFromRows } from "./common-opponent-enhanced.server";
import { computeTournamentContextStatsFromRows } from "./tournament-context.server";
import { computeTravelBurdenStatsFromRows } from "./travel-burden.server";

const WITH_CUTOFF = "event_level ATP 250 · date 2026-02-01 · surface Hard";
const NO_CUTOFF = "event_level ATP 250 · surface Hard"; // no parseable date token

function commonOpponentRows() {
  return [
    { player: "Player A", opponent: "Shared", date: "2026-01-10", surface: "Hard", won: "1", sets_for: "2", sets_against: "0" },
    { player: "Player B", opponent: "Shared", date: "2026-01-12", surface: "Hard", won: "0", sets_for: "0", sets_against: "2" },
    // Played AFTER the audited match -- must never be admitted regardless of cutoff state.
    { player: "Player A", opponent: "Future Shared", date: "2026-03-01", surface: "Hard", won: "1", sets_for: "2", sets_against: "0" },
    { player: "Player B", opponent: "Future Shared", date: "2026-03-01", surface: "Hard", won: "0", sets_for: "0", sets_against: "2" },
    // No date at all -- unprovable, must never be admitted.
    { player: "Player A", opponent: "Undated Shared", date: "", surface: "Hard", won: "1", sets_for: "2", sets_against: "0" },
    { player: "Player B", opponent: "Undated Shared", date: "", surface: "Hard", won: "0", sets_for: "0", sets_against: "2" },
  ];
}

describe("Phase 16: common-opponent-enhanced.server.ts fails closed", () => {
  it("1/2. missing cutoff produces no evidence at all (future rows cannot enter)", () => {
    const result = computeEnhancedCommonOpponentStatsFromRows(commonOpponentRows() as any, "Player A", "Player B", NO_CUTOFF);
    expect(result.stats).toEqual([]);
    expect(result.coverage.directCommonOpponents).toBe(false);
  });

  it("3. an undated evidence row cannot bypass the boundary even with a real cutoff", () => {
    const result = computeEnhancedCommonOpponentStatsFromRows(commonOpponentRows() as any, "Player A", "Player B", WITH_CUTOFF);
    // Only "Shared" (dated before cutoff) should count -- not "Future Shared" (after) or
    // "Undated Shared" (no date).
    expect(result.stats.find((s) => s.key === "direct_common_opponents")?.value).toBe(1);
  });

  it("4. dated historical evidence before the cutoff remains fully usable", () => {
    const result = computeEnhancedCommonOpponentStatsFromRows(commonOpponentRows() as any, "Player A", "Player B", WITH_CUTOFF);
    expect(result.stats.find((s) => s.key === "common_opponent_wins")?.value).toBe(1);
    expect(result.stats.find((s) => s.key === "common_opponent_win_pct")?.value).toBe(100);
  });

  it("5. P1/P2 swap does not alter temporal eligibility (same evidence, mirrored orientation)", () => {
    const forward = computeEnhancedCommonOpponentStatsFromRows(commonOpponentRows() as any, "Player A", "Player B", WITH_CUTOFF);
    const swapped = computeEnhancedCommonOpponentStatsFromRows(commonOpponentRows() as any, "Player B", "Player A", WITH_CUTOFF);
    expect(swapped.stats.find((s) => s.key === "direct_common_opponents")?.value).toBe(
      forward.stats.find((s) => s.key === "direct_common_opponents")?.value,
    );
    expect(swapped.stats.find((s) => s.key === "common_opponent_wins")?.value).toBe(0);
    expect(swapped.stats.find((s) => s.key === "common_opponent_losses")?.value).toBe(1);
  });

  it("6. execution order does not change the result (pure function of its inputs)", () => {
    const rows = commonOpponentRows();
    const a = computeEnhancedCommonOpponentStatsFromRows(rows as any, "Player A", "Player B", WITH_CUTOFF);
    const b = computeEnhancedCommonOpponentStatsFromRows([...rows].reverse() as any, "Player A", "Player B", WITH_CUTOFF);
    expect(b.stats.find((s) => s.key === "common_opponent_wins")?.value).toBe(a.stats.find((s) => s.key === "common_opponent_wins")?.value);
  });
});

function tournamentContextRows() {
  return [
    { player: "Player A", date: "2026-01-10", tournament: "Indian Wells", round: "R32", won: "1" },
    // Future row -- must never be admitted.
    { player: "Player A", date: "2026-03-01", tournament: "Indian Wells", round: "R32", won: "0" },
    // Undated row -- must never be admitted.
    { player: "Player A", date: "", tournament: "Indian Wells", round: "R32", won: "1" },
  ];
}

describe("Phase 16: tournament-context.server.ts fails closed", () => {
  it("1/2. missing cutoff produces no evidence at all", () => {
    expect(computeTournamentContextStatsFromRows(tournamentContextRows() as any, "Player A", NO_CUTOFF)).toEqual([]);
  });

  it("3/4. undated and future rows are excluded; dated historical evidence remains usable", () => {
    const stats = computeTournamentContextStatsFromRows(tournamentContextRows() as any, "Player A", `tournament Indian Wells · round R32 · date 2026-02-01`);
    const sameTournament = stats.find((s) => s.key === "same_tournament_matches");
    expect(sameTournament?.value).toBe(1); // only the 2026-01-10 row
  });

  it("6. execution order does not change the result", () => {
    const rows = tournamentContextRows();
    const context = `tournament Indian Wells · round R32 · date 2026-02-01`;
    const a = computeTournamentContextStatsFromRows(rows as any, "Player A", context);
    const b = computeTournamentContextStatsFromRows([...rows].reverse() as any, "Player A", context);
    expect(b.find((s) => s.key === "same_tournament_matches")?.value).toBe(a.find((s) => s.key === "same_tournament_matches")?.value);
  });
});

function travelBurdenRows() {
  return [
    { player: "Player A", date: "2026-01-05", lat: "34.0", lon: "-118.2" },
    { player: "Player A", date: "2026-01-15", lat: "40.7", lon: "-74.0" },
    // Future leg -- must never be admitted (would otherwise add a travel leg into the
    // audited match's "recent travel burden").
    { player: "Player A", date: "2026-03-01", lat: "51.5", lon: "-0.1" },
    // Undated leg -- must never be admitted.
    { player: "Player A", date: "", lat: "35.6", lon: "139.7" },
  ];
}

describe("Phase 16: travel-burden.server.ts fails closed", () => {
  it("1/2. missing cutoff produces no evidence at all", () => {
    expect(computeTravelBurdenStatsFromRows(travelBurdenRows() as any, "Player A", NO_CUTOFF)).toEqual([]);
  });

  it("3/4. undated and future legs are excluded; dated historical legs remain usable", () => {
    const stats = computeTravelBurdenStatsFromRows(travelBurdenRows() as any, "Player A", WITH_CUTOFF);
    // Only the LA -> NYC leg (both before cutoff) should be counted as one leg.
    expect(stats.find((s) => s.key === "observed_travel_km_last10")?.sample).toBe(1);
  });

  it("6. execution order does not change the result", () => {
    const rows = travelBurdenRows();
    const a = computeTravelBurdenStatsFromRows(rows as any, "Player A", WITH_CUTOFF);
    const b = computeTravelBurdenStatsFromRows([...rows].reverse() as any, "Player A", WITH_CUTOFF);
    expect(b.find((s) => s.key === "observed_travel_km_last10")?.value).toBe(a.find((s) => s.key === "observed_travel_km_last10")?.value);
  });
});
