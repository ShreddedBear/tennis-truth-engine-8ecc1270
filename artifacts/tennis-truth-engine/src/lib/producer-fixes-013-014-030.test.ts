import { describe, expect, it } from "vitest";
import { rankingPointsFromCells } from "./ingestion/tour-rankings.server";
import { getAvailabilityHistoryStats } from "./availability-layoff.server";
import { sameTournamentHistory, tournamentKey } from "./tournament-history-reconstruction";

// PHASE 2 — producer/data-contract fixes for 013, 014 and 030, each diagnosed against the
// live database rather than from the code alone. These tests pin the specific defect found
// in each, using the real values that exposed it.

describe("014 — ranking ingestion read the AGE column as ranking points", () => {
  // The live store held self-contradictory 014 evidence: "rank=3; points=23" next to
  // "rank=29; points=1652". Cause: parseRankingTable took points from a fixed column index
  // (cells[2] for ATP), which is the Age column. Every scraped ATP row carried an age:
  // Sinner rank 1 -> 25, Zverev 2 -> 29, Alcaraz 3 -> 23, Djokovic 5 -> 39 -- their exact
  // 2026 ages. A second ingestion path wrote the same players again with real points, so
  // which number 014 reported depended on which duplicate sorted first.
  it("picks the points column, not the age column, from a real ATP row shape", () => {
    // [rank, player, age, points, movement] -- the shape that produced Sinner 25.
    expect(rankingPointsFromCells(["1", "Jannik Sinner", "25", "12800", "0"])).toBe(12800);
    expect(rankingPointsFromCells(["3", "Carlos Alcaraz", "23", "7160", "0"])).toBe(7160);
    expect(rankingPointsFromCells(["5", "Novak Djokovic", "39", "3770", "+1"])).toBe(3770);
  });

  it("works regardless of which column holds the points -- it is no longer positional", () => {
    expect(rankingPointsFromCells(["1", "A Player", "8575", "18"])).toBe(8575);
    expect(rankingPointsFromCells(["1", "A Player", "18", "8575"])).toBe(8575);
  });

  it("returns null rather than a guess when no cell is plausibly ranking points", () => {
    // Age/tournaments-played only. Emitting 25 here is exactly the original bug.
    expect(rankingPointsFromCells(["1", "Jannik Sinner", "25", "18"])).toBeNull();
    expect(rankingPointsFromCells(["7", "Someone"])).toBeNull();
  });

  it("never mistakes the rank itself for points", () => {
    // Rank is skipped structurally (cells[0]); a rank of 150 must not become 150 points.
    expect(rankingPointsFromCells(["150", "Someone", "22", "30"])).toBeNull();
  });

  it("rejects an implausibly large value rather than trusting it", () => {
    // A player id or similar leaking into a cell must not be read as points.
    expect(rankingPointsFromCells(["1", "Someone", "25", "320760"])).toBeNull();
  });
});

describe("013 — availability's directional field was impossible for every WTA player", () => {
  // ATP reads atp_elo_matches.csv, which has a `won` column. WTA reads wta_elo_ratings.csv,
  // a ratings timeline with no `won` and no opponent, and no WTA matches file exists. So
  // return_after_layoff_win_pct -- the only field that says whether a layoff actually cost
  // the player anything -- could never be produced for a WTA player. Live evidence showed
  // exactly that split: present for ATP players, absent for Pegula (sample 380), Bucsa
  // (224), Navarro (192) and Parks (179).
  const CONTEXT = "tournament x · date 2026-08-29 · surface hard";
  const directional = (player: string) =>
    getAvailabilityHistoryStats(player, CONTEXT).find((s) => s.key === "return_after_layoff_win_pct") ?? null;

  it("now produces the directional field for WTA players, reconstructed from the index", () => {
    for (const player of ["Jessica Pegula", "Emma Navarro", "Cristina Bucsa"]) {
      const stat = directional(player);
      expect(stat, `${player} should now have return_after_layoff_win_pct`).not.toBeNull();
      expect(stat!.value).toBeGreaterThanOrEqual(0);
      expect(stat!.value).toBeLessThanOrEqual(100);
      expect(stat!.sample, `${player} needs a real denominator`).toBeGreaterThan(0);
    }
  });

  it("leaves ATP untouched -- its CSV already carried win/loss", () => {
    // Measured before the change: Rublev 44.44 over 18, Alcaraz 66.67 over 3.
    const rublev = directional("Andrey Rublev");
    expect(rublev).not.toBeNull();
    expect(Number(rublev!.value.toFixed(2))).toBe(44.44);
    expect(rublev!.sample).toBe(18);
  });

  it("still refuses everything when the audited match has no date", () => {
    // An unestablished boundary admits no evidence -- it must not fall back to all history.
    expect(getAvailabilityHistoryStats("Jessica Pegula", "tournament x · surface hard")).toEqual([]);
  });

  it("reports nothing for a player who exists in no source, rather than zeros", () => {
    expect(getAvailabilityHistoryStats("totally fictional player one", CONTEXT)).toEqual([]);
  });
});

describe("030 — tournament-specific strength had no denominator and almost no data", () => {
  // 134 of 208 live rows read "same_tournament_matches_5y=0; same_tournament_wins_5y=0":
  // raw counts, no rate, and source_observations holds almost no historical per-tournament
  // results. The runtime index does, so the record is reconstructed from data already held.
  const AS_OF = "2026-08-31";

  it("reconstructs a real two-sided record where the warehouse had 0/0", () => {
    const rublev = sameTournamentHistory("Andrey Rublev", "US Open Men Singles", AS_OF);
    const virtanen = sameTournamentHistory("Otto Virtanen", "US Open Men Singles", AS_OF);
    expect(rublev.matches).toBeGreaterThan(0);
    expect(virtanen.matches).toBeGreaterThan(0);
    expect(rublev.win_pct).not.toBeNull();
    expect(rublev.wins).toBeLessThanOrEqual(rublev.matches);
  });

  it("an empty record is NA, never 0% -- no history is unknown, not bad", () => {
    const none = sameTournamentHistory("Jan Kumstat", "ATP Challenger Como", AS_OF);
    expect(none.matches).toBe(0);
    expect(none.win_pct).toBeNull();
  });

  it("matches the same event across differing source decorations", () => {
    expect(tournamentKey("US Open Men Singles")).toBe(tournamentKey("US Open"));
    expect(tournamentKey("ATP Challenger Como")).toBe(tournamentKey("Como"));
    expect(tournamentKey("US Open")).not.toBe(tournamentKey("Australian Open"));
  });

  it("excludes the audited day itself and everything after it", () => {
    const early = sameTournamentHistory("Andrey Rublev", "US Open Men Singles", "2020-01-01");
    const late = sameTournamentHistory("Andrey Rublev", "US Open Men Singles", AS_OF);
    expect(early.matches).toBeLessThanOrEqual(late.matches);
    expect(early.matches).not.toBe(late.matches);
  });

  it("is deterministic across repeated calls", () => {
    const a = sameTournamentHistory("Andrey Rublev", "US Open Men Singles", AS_OF);
    const b = sameTournamentHistory("Andrey Rublev", "US Open Men Singles", AS_OF);
    expect(a).toEqual(b);
  });

  it("refuses an unestablished boundary or an unnamed tournament", () => {
    expect(sameTournamentHistory("Andrey Rublev", "US Open Men Singles", "").matches).toBe(0);
    expect(sameTournamentHistory("Andrey Rublev", null, AS_OF).matches).toBe(0);
  });
});
