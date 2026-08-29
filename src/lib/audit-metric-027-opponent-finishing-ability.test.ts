import { describe, expect, it } from "vitest";
import { computeFinishingAbilityFromRows, computeOpponentFinishingAbility, DEFAULT_TRAILING_N } from "./audit-metric-027-opponent-finishing-ability";
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

describe("metric #027 — Opponent Finishing Ability", () => {
  it("computes lead-protection rate: won set 1, then won the match", () => {
    const rows = [
      row({ date: "2024-01-01", won: true, setScores: [[6, 4], [6, 3]] }),   // won set1, won match
      row({ date: "2024-01-02", won: false, setScores: [[6, 3], [4, 6], [3, 6]] }), // won set1, lost match
    ];
    const out = computeFinishingAbilityFromRows("Player A", rows);
    expect(out.lead_protection.n).toBe(2);
    expect(out.lead_protection.rate).toBe(50);
  });

  it("computes closing-as-underdog rate: lost set 1, still won the match", () => {
    const rows = [
      row({ date: "2024-01-01", won: true, setScores: [[3, 6], [6, 4], [6, 4]] }), // lost set1, won match
      row({ date: "2024-01-02", won: false, setScores: [[2, 6], [4, 6]] }),        // lost set1, lost match
    ];
    const out = computeFinishingAbilityFromRows("Player A", rows);
    expect(out.closing_as_underdog.n).toBe(2);
    expect(out.closing_as_underdog.rate).toBe(50);
  });

  it("only uses the trailing N matches, most recent by event_date, regardless of input order", () => {
    const rows = [
      row({ date: "2024-03-01", won: true, setScores: [[6, 4], [6, 3]] }),
      row({ date: "2024-01-01", won: false, setScores: [[6, 3], [4, 6], [3, 6]] }), // outside trailing window of 1
      row({ date: "2024-02-01", won: false, setScores: [[6, 3], [4, 6], [3, 6]] }),
    ];
    const out = computeFinishingAbilityFromRows("Player A", rows, 1);
    expect(out.trailing_n_used).toBe(1);
    expect(out.lead_protection.n).toBe(1);
    expect(out.lead_protection.rate).toBe(100); // only the 2024-03-01 row counted
  });

  it("skips a row with no usable set_scores rather than guessing a first-set outcome", () => {
    const rows = [row({ date: "2024-01-01", won: true, setScores: [] })];
    const out = computeFinishingAbilityFromRows("Player A", rows);
    expect(out.lead_protection.n).toBe(0);
    expect(out.closing_as_underdog.n).toBe(0);
  });

  it("skips a tied first-set score rather than guessing who won it", () => {
    const rows = [row({ date: "2024-01-01", won: true, setScores: [[6, 6]] })];
    const out = computeFinishingAbilityFromRows("Player A", rows);
    expect(out.lead_protection.n).toBe(0);
    expect(out.closing_as_underdog.n).toBe(0);
  });

  it("reports null (not zero) for a rate with no qualifying matches in that bucket", () => {
    const rows = [row({ date: "2024-01-01", won: true, setScores: [[6, 4], [6, 3]] })];
    const out = computeFinishingAbilityFromRows("Player A", rows);
    expect(out.closing_as_underdog.n).toBe(0);
    expect(out.closing_as_underdog.rate).toBeNull();
  });

  it("defaults the trailing window to 20 matches", () => {
    expect(DEFAULT_TRAILING_N).toBe(20);
  });

  it("live wrapper rejects ATP_MAIN and WTA_CHALLENGER outright as a structural schema gap, not sparse data", () => {
    const atp = computeOpponentFinishingAbility({ player: "Anyone", lane: "ATP_MAIN", asOfDate: "2024-01-01" });
    expect(atp.status).toBe("NOT_ENOUGH_DATA");
    const wtaChallenger = computeOpponentFinishingAbility({ player: "Anyone", lane: "WTA_CHALLENGER", asOfDate: "2024-01-01" });
    expect(wtaChallenger.status).toBe("NOT_ENOUGH_DATA");
  });
});
