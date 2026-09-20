import { describe, expect, it } from "vitest";
import { replayMatchStateElo, computeMatchStateElo, MATCH_STATE_ELO_ELIGIBLE_LANES } from "./audit-metric-046-match-state-elo";
import type { HistoryLane } from "./task18c-rank-form-workload";

// HistoryLane entries: [date, tournament, surface, opponent, won(0/1), round, source, detail]
function lane(entries: Record<string, unknown[][]>): HistoryLane {
  return entries as unknown as HistoryLane;
}

describe("metric #046 — Match-State Elo", () => {
  it("credits the set-1 winner's after-winning-set1 rating when they go on to win the match", () => {
    const l = lane({
      "player a": [["2024-01-01", "t", "hard", "Player B", 1, "", "src", { set_scores: [[6, 4], [6, 3]] }]],
      "player b": [["2024-01-01", "t", "hard", "Player A", 0, "", "src", { set_scores: [[4, 6], [3, 6]] }]],
    });
    const replay = replayMatchStateElo(l, "2024-06-01");
    expect(replay.matches_used).toBe(1);
    expect(replay.after_winning_set1.get("player a")).toBeGreaterThan(1500); // won set1 and the match
    expect(replay.after_losing_set1.get("player b")).toBeLessThan(1500); // lost set1 and the match
  });

  it("credits the set-1 loser's after-losing-set1 rating on a comeback win", () => {
    const l = lane({
      "player a": [["2024-01-01", "t", "hard", "Player B", 1, "", "src", { set_scores: [[3, 6], [6, 4], [6, 4]] }]],
      "player b": [["2024-01-01", "t", "hard", "Player A", 0, "", "src", { set_scores: [[6, 3], [4, 6], [4, 6]] }]],
    });
    const replay = replayMatchStateElo(l, "2024-06-01");
    expect(replay.after_losing_set1.get("player a")).toBeGreaterThan(1500); // lost set1 but won the match -- a good comeback outcome
    expect(replay.after_winning_set1.get("player b")).toBeLessThan(1500); // won set1 but lost the match -- a bad front-running outcome
  });

  it("skips a match with no usable set_scores rather than guessing set-1 outcome", () => {
    const l = lane({
      "player a": [["2024-01-01", "t", "hard", "Player B", 1, "", "src", { set_scores: [] }]],
      "player b": [["2024-01-01", "t", "hard", "Player A", 0, "", "src", { set_scores: [] }]],
    });
    const replay = replayMatchStateElo(l, "2024-06-01");
    expect(replay.matches_used).toBe(0);
  });

  it("does not replay matches on or after asOfDate (leakage safety, via laneMatchesBefore's own filtering)", () => {
    const l = lane({
      "player a": [["2024-06-01", "t", "hard", "Player B", 1, "", "src", { set_scores: [[6, 4], [6, 3]] }]],
      "player b": [["2024-06-01", "t", "hard", "Player A", 0, "", "src", { set_scores: [[4, 6], [3, 6]] }]],
    });
    const replay = replayMatchStateElo(l, "2024-06-01"); // strictBefore -- same-day match excluded
    expect(replay.matches_used).toBe(0);
  });

  it("only ATP_CHALLENGER and WTA_MAIN are eligible lanes", () => {
    expect(MATCH_STATE_ELO_ELIGIBLE_LANES.has("WTA_MAIN")).toBe(true);
    expect(MATCH_STATE_ELO_ELIGIBLE_LANES.has("ATP_CHALLENGER")).toBe(true);
    expect(MATCH_STATE_ELO_ELIGIBLE_LANES.has("ATP_MAIN")).toBe(false);
    expect(MATCH_STATE_ELO_ELIGIBLE_LANES.has("WTA_CHALLENGER")).toBe(false);
  });

  it("live wrapper rejects ATP_MAIN and WTA_CHALLENGER outright", () => {
    const atp = computeMatchStateElo({ player: "Anyone", lane: "ATP_MAIN", asOfDate: "2024-01-01" });
    expect(atp.status).toBe("NOT_ENOUGH_DATA");
    const wtaChallenger = computeMatchStateElo({ player: "Anyone", lane: "WTA_CHALLENGER", asOfDate: "2024-01-01" });
    expect(wtaChallenger.status).toBe("NOT_ENOUGH_DATA");
  });
});
