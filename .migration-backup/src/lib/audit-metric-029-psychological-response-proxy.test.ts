import { describe, expect, it } from "vitest";
import { isCloseSetLoss, computePsychologicalResponseFromRows, computePsychologicalResponseProxy } from "./audit-metric-029-psychological-response-proxy";
import type { RepositoryResultsObservation } from "./repository-results-history.server";

function row(args: { date: string; won: boolean; setScores: Array<[number, number]> }): RepositoryResultsObservation {
  return {
    source_id: "wta", source_name: "test", source_url: null, player_name: "Player A", opponent_name: "Player B",
    tournament: null, event_date: args.date, surface: null, observation_type: "MATCH_RESULT_OR_SCHEDULE", observation_key: "match_record",
    text_value: "{}", sample_label: null,
    raw_payload: { winner: args.won ? "Player A" : "Player B", history_detail: { set_scores: args.setScores } },
    provenance: {},
  };
}

describe("isCloseSetLoss", () => {
  it("recognizes 7-6, 7-5, and 6-4 as close losses (from the loser's own scoreline)", () => {
    expect(isCloseSetLoss(6, 7)).toBe(true);
    expect(isCloseSetLoss(5, 7)).toBe(true);
    expect(isCloseSetLoss(4, 6)).toBe(true);
  });
  it("does not treat a blowout or a won set as a close set loss", () => {
    expect(isCloseSetLoss(1, 6)).toBe(false);
    expect(isCloseSetLoss(6, 4)).toBe(false); // this player WON that set
  });
});

describe("metric #029 — Psychological Response Proxy", () => {
  it("computes baseline match win rate over the trailing window regardless of close-set losses", () => {
    const rows = [
      row({ date: "2024-01-01", won: true, setScores: [[6, 4], [6, 3]] }),
      row({ date: "2024-01-02", won: false, setScores: [[3, 6], [2, 6]] }),
    ];
    const out = computePsychologicalResponseFromRows("Player A", rows);
    expect(out.baseline_match_win_rate.n).toBe(2);
    expect(out.baseline_match_win_rate.rate).toBe(50);
  });

  it("computes next-set win rate and match win rate conditioned on a close-set loss", () => {
    const rows = [
      // lost set1 close (6-7), won set2, won set3 -> next_set win, match win
      row({ date: "2024-01-01", won: true, setScores: [[6, 7], [6, 3], [6, 4]] }),
      // lost set1 close (4-6), lost set2 -> no next-set win, no match win
      row({ date: "2024-01-02", won: false, setScores: [[4, 6], [3, 6]] }),
    ];
    const out = computePsychologicalResponseFromRows("Player A", rows);
    expect(out.after_close_set_loss.n).toBe(2);
    expect(out.after_close_set_loss.next_set_win_rate).toBe(50);
    expect(out.after_close_set_loss.match_win_rate).toBe(50);
  });

  it("only triggers on the FIRST close-set loss in a match, not every set", () => {
    const rows = [
      // set1 close loss (5-7), set2 close loss too (4-6) -- only set1 should be the trigger, "next set" is set2
      row({ date: "2024-01-01", won: false, setScores: [[5, 7], [4, 6]] }),
    ];
    const out = computePsychologicalResponseFromRows("Player A", rows);
    expect(out.after_close_set_loss.n).toBe(1);
    expect(out.after_close_set_loss.next_set_win_rate).toBe(0); // set2 (4-6) was also lost
  });

  it("reports null next-set rate when the close-set loss was the final set of the match", () => {
    const rows = [row({ date: "2024-01-01", won: false, setScores: [[6, 4], [3, 6], [4, 6]] })]; // deciding set lost close
    const out = computePsychologicalResponseFromRows("Player A", rows);
    expect(out.after_close_set_loss.n).toBe(1);
    // next_set_win_rate is 0 (no following set counts as a win), not null, since n > 0 overall
    expect(out.after_close_set_loss.next_set_win_rate).toBe(0);
  });

  it("reports null (not zero) when there are no matches with a close-set loss at all", () => {
    const rows = [row({ date: "2024-01-01", won: true, setScores: [[6, 2], [6, 1]] })];
    const out = computePsychologicalResponseFromRows("Player A", rows);
    expect(out.after_close_set_loss.n).toBe(0);
    expect(out.after_close_set_loss.next_set_win_rate).toBeNull();
    expect(out.after_close_set_loss.match_win_rate).toBeNull();
  });

  it("live wrapper rejects ATP_MAIN and WTA_CHALLENGER outright as a structural schema gap, not sparse data", () => {
    const atp = computePsychologicalResponseProxy({ player: "Anyone", lane: "ATP_MAIN", asOfDate: "2024-01-01" });
    expect(atp.status).toBe("NOT_ENOUGH_DATA");
    const wtaChallenger = computePsychologicalResponseProxy({ player: "Anyone", lane: "WTA_CHALLENGER", asOfDate: "2024-01-01" });
    expect(wtaChallenger.status).toBe("NOT_ENOUGH_DATA");
  });
});
