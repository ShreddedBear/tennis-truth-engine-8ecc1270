import { describe, expect, it } from "vitest";
import { replayElo, type HistoryLane } from "./task18c-rank-form-workload";
import { computeUnderdogWinProfileFromPerspectives, computeUnderdogWinProfile } from "./audit-metric-044-opponent-upset-compatibility";

// HistoryLane entries: [date, tournament, surface, opponent, won(0/1), round, source, detail]
function lane(entries: Record<string, unknown[][]>): HistoryLane {
  return entries as unknown as HistoryLane;
}

describe("metric #044 leakage safety (synthetic fixture)", () => {
  it("never includes an underdog win dated on or after asOfDate", () => {
    // "player a" starts weak and beats increasingly strong opponents --
    // each win against a higher pre-match Elo counts as an underdog win.
    const l = lane({
      "player a": [
        ["2024-01-01", "t1", "hard", "Player B", 1, "", "src"], // before cutoff -- must be included
        ["2024-06-01", "t2", "hard", "Player C", 1, "", "src"], // ON cutoff -- must be excluded
        ["2024-07-01", "t3", "hard", "Player D", 1, "", "src"], // after cutoff -- must be excluded
      ],
      // Give B/C/D a head start so "player a" (starting at 1500) is the
      // underdog in every meeting.
      "player b": [["2023-06-01", "seed", "hard", "seed opp", 1, "", "src"]],
      "player c": [["2023-06-01", "seed", "hard", "seed opp", 1, "", "src"]],
      "player d": [["2023-06-01", "seed", "hard", "seed opp", 1, "", "src"]],
      "seed opp": [["2023-06-01", "seed", "hard", "player b", 0, "", "src"], ["2023-06-01", "seed", "hard", "player c", 0, "", "src"], ["2023-06-01", "seed", "hard", "player d", 0, "", "src"]],
    });
    const replay = replayElo(l, "2024-06-01");
    const chronologicalUpsetWins = replay.perspectives
      .filter(p => p.player === "player a" && p.won && p.pre_elo < p.opponent_pre_elo)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(p => ({ date: p.date, opponent: p.opponent, pre_elo: p.pre_elo, opponent_pre_elo: p.opponent_pre_elo }));
    expect(chronologicalUpsetWins).toHaveLength(1);
    expect(chronologicalUpsetWins[0].date).toBe("2024-01-01");

    const result = computeUnderdogWinProfileFromPerspectives(chronologicalUpsetWins, null);
    expect(result.trailing_underdog_wins_used).toBe(1);
    expect(result.underdog_wins.map(w => w.date)).toEqual(["2024-01-01"]);
  });

  it("a later asOfDate never removes an underdog win visible at an earlier asOfDate -- monotonic history growth", () => {
    // Each of B/C/D is boosted well clear of any plausible post-win rating
    // for "player a" (many decisive wins over a fresh weak opponent each
    // time, so their own rating climbs past ~1900 while "player a" -- even
    // after upsetting one of them -- stays well under that), so "player a"
    // remains the underdog in every one of these meetings regardless of
    // where their own rating has climbed to from earlier wins in this same
    // fixture. This isolates the leakage property (does a later asOfDate
    // ever drop an already-visible win?) from the separate, expected
    // "trailing window can slide" windowing behavior covered by the real-
    // data test below.
    function boosted(name: string): unknown[][] {
      return Array.from({ length: 8 }, (_, i) => [`2022-01-${String(i + 1).padStart(2, "0")}`, "seed", "hard", `${name} fodder ${i}`, 1, "", "src"]);
    }
    const l = lane({
      "player a": [
        ["2024-01-01", "t1", "hard", "Player B", 1, "", "src"],
        ["2024-03-01", "t2", "hard", "Player C", 1, "", "src"],
        ["2024-05-01", "t3", "hard", "Player D", 1, "", "src"],
      ],
      "player b": boosted("b"),
      "player c": boosted("c"),
      "player d": boosted("d"),
    });
    const early = replayElo(l, "2024-02-01").perspectives.filter(p => p.player === "player a" && p.won && p.pre_elo < p.opponent_pre_elo);
    const late = replayElo(l, "2024-06-01").perspectives.filter(p => p.player === "player a" && p.won && p.pre_elo < p.opponent_pre_elo);
    expect(early).toHaveLength(1);
    expect(late).toHaveLength(3);
    expect(late.find(p => p.date === early[0].date)?.pre_elo).toBe(early[0].pre_elo);
  });
});

describe("metric #044 leakage safety (live wrapper against the real generated index)", () => {
  // "andrea collarini" has a real recorded underdog win over "juan pablo
  // varillas" in ATP_CHALLENGER on 2026-01-12 (found by inspecting the
  // real generated index's derived Elo replay directly -- see the pure-core
  // exploration this module's own test file documents).
  const PLAYER = "andrea collarini";
  const LANE = "ATP_CHALLENGER" as const;

  it("excludes an underdog win when asOfDate is strictly before its date", () => {
    const before = computeUnderdogWinProfile({ player: PLAYER, lane: LANE, asOfDate: "2026-01-11" });
    if (before.status === "GO") {
      expect(before.value.underdog_wins.some(w => w.date === "2026-01-12")).toBe(false);
    }
  });

  it("includes it once asOfDate moves strictly after its date", () => {
    const after = computeUnderdogWinProfile({ player: PLAYER, lane: LANE, asOfDate: "2026-01-13" });
    expect(after.status).toBe("GO");
    if (after.status !== "GO") return;
    expect(after.value.underdog_wins.some(w => w.date === "2026-01-12")).toBe(true);
  });

  it("excludes all history entirely when asOfDate is years before any recorded history", () => {
    const wayBefore = computeUnderdogWinProfile({ player: PLAYER, lane: LANE, asOfDate: "2000-01-01" });
    expect(wayBefore.status).toBe("NOT_ENOUGH_DATA");
  });
});
