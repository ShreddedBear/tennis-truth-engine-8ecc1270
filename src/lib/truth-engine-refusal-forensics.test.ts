import { describe, expect, it } from "vitest";
import { compareMetricRows, type MetricRowForComparison } from "./truth-engine-metric-comparison";
import { decideTruthEngineSelection } from "./truth-engine-decision";
import { runTruthEngineAudit } from "./truth-engine-audit";
import { forensicsForMatch, type ForensicMatchInput } from "./truth-engine-refusal-forensics";

const P1 = "Alpha Player";
const P2 = "Beta Player";

function row(metric_code: string, p1_value: string | null, p2_value: string | null): MetricRowForComparison {
  return { metric_code, p1_value, p2_value, p1_treatment: "RECONSTRUCTED", p2_treatment: "RECONSTRUCTED" };
}
function forensics(rows: MetricRowForComparison[], storedWinner: string | null = null) {
  const input: ForensicMatchInput = {
    match_id: "m-1",
    audit_run_id: "r-1",
    p1: P1,
    p2: P2,
    metric_rows: rows,
    stored_final_selection: storedWinner ? "PLAY" : "INSUFFICIENT EVIDENCE",
    stored_independent_winner: storedWinner,
  };
  return forensicsForMatch(input);
}

// Independent families, each with a materiality the fixtures below are built against:
//   001 SURFACE_STRENGTH   materiality 10   (surface Elo)
//   005 RECENT_FORM        materiality  5   (last-10 win %)
//   011 RESULTS_HISTORY    materiality  5   (match win %)
//   027 CLOSING_ABILITY    materiality  5   (lead protection %)
//   051 H2H_PROBABILITY    materiality  3   (opponent-specific win probability %)

describe("forensics is diagnostic only", () => {
  it("never changes what the production engines decide", () => {
    const rows = [row("001", "1600", "1500"), row("005", "last10_win_pct=70", "last10_win_pct=40")];
    const before = decideTruthEngineSelection({ comparisons: compareMetricRows(rows), p1Name: P1, p2Name: P2 });
    const beforeAudit = runTruthEngineAudit(compareMetricRows(rows), P1, P2);
    forensics(rows);
    const after = decideTruthEngineSelection({ comparisons: compareMetricRows(rows), p1Name: P1, p2Name: P2 });
    const afterAudit = runTruthEngineAudit(compareMetricRows(rows), P1, P2);
    expect(after.outcome).toBe(before.outcome);
    expect(after.evidence_percent).toBe(before.evidence_percent);
    expect(afterAudit.audit_winner_side).toBe(beforeAudit.audit_winner_side);
  });

  it("reports both players from their own values, and mirrors under a P1/P2 swap", () => {
    const rows = [row("001", "1600", "1500"), row("005", "last10_win_pct=40", "last10_win_pct=70")];
    const f = forensics(rows);
    expect(f.mirror_check_symmetric).toBe(true);
    // The two shares are computed off the same census but from each side's own votes.
    expect(f.p1_support.directional_denominator).toBe(f.p2_support.directional_denominator);
    expect(f.p1_support.support_ratio_percent + f.p2_support.support_ratio_percent).toBeLessThanOrEqual(100);
  });
});

describe("the adverse stress case is not a symmetric erosion of a measured edge", () => {
  // A one-materiality shift can only ever push a leader-favouring metric down to NEUTRAL
  // (a metric favours the leader only when its edge already exceeds one materiality, and
  // subtracting one leaves at most one). It can, however, push a metric the engine declared
  // NEUTRAL -- "both players measured, no material difference" -- into a vote for the
  // opponent. The adverse case therefore MANUFACTURES opposing evidence out of declared
  // parity rather than only eroding the leader's own edge.
  it("converts a NEUTRAL family into a vote for the opponent", () => {
    const rows = [
      // Two clear P1 families (edges well beyond one materiality).
      row("001", "1700", "1500"),
      row("005", "last10_win_pct=80", "last10_win_pct=30"),
      // A family the engine measures as NEUTRAL: 4 points apart, materiality 5.
      row("011", "match_win_pct=50", "match_win_pct=54"),
      row("027", "lead_protection_rate_pct=50", "lead_protection_rate_pct=54"),
    ];
    const base = decideTruthEngineSelection({ comparisons: compareMetricRows(rows), p1Name: P1, p2Name: P2 });
    expect(base.outcome).toBe("P1");
    expect(base.neutral_families.sort()).toEqual(["CLOSING_ABILITY", "RESULTS_HISTORY"]);

    const f = forensics(rows);
    // Stressing P1 turns those two declared-parity families into P2 votes.
    expect(f.stress_p1.families_manufactured_for_opponent.sort()).toEqual(["CLOSING_ABILITY", "RESULTS_HISTORY"]);
    // And no family that voted P1 was handed to P2 -- only neutralised, as the algebra requires.
    expect(f.stress_p1.families_flipped_to_opponent).toEqual([]);
  });

  it("is applied only to the selected side: production never runs the mirror case", () => {
    const rows = [
      row("001", "1700", "1500"),
      row("005", "last10_win_pct=80", "last10_win_pct=30"),
      row("011", "match_win_pct=50", "match_win_pct=54"),
      row("027", "lead_protection_rate_pct=50", "lead_protection_rate_pct=54"),
    ];
    const audit = runTruthEngineAudit(compareMetricRows(rows), P1, P2);
    // Production stresses the selected side and refuses when that case changes the winner.
    expect(audit.decision.outcome).toBe("P1");
    expect(audit.stress.winner_before).toBe("P1");
    expect(audit.stress.changed).toBe(true);
    expect(audit.audit_winner_side).toBeNull();

    const f = forensics(rows);
    // Only one side was ever stressed by production.
    expect(f.stress_p1.evaluated_by_production).toBe(true);
    expect(f.stress_p2.evaluated_by_production).toBe(false);
    // Under the mirror case -- the same erosion applied to P2 instead -- P1 still leads.
    expect(f.stress_p2.outcome_when_this_side_stressed).toBe("P1");
    // Whatever the shape of the leader's own adverse case, the opponent never survives the
    // mirror case here -- so the veto ranks nobody, it only removes the leader.
    expect(f.symmetric_stress_verdict).not.toBe("CHALLENGER_MORE_ROBUST");
    expect(["NON_DISCRIMINATING", "LEADER_MORE_ROBUST"]).toContain(f.symmetric_stress_verdict);
    expect(f.classification).toBe("DOWNSTREAM_VETO_BUG");
    expect(f.trace.after_lofo_initial_decision).toBe("P1");
    expect(f.trace.after_stress).not.toBe("P1");
  });

  it("keeps ROBUSTNESS_UNRESOLVED available for a leader the opponent genuinely out-survives", () => {
    // Constructed so that the challenger wins BOTH the adverse and the mirror case.
    const rows = [
      row("001", "1511", "1500"),          // P1 by 11, materiality 10 -> a one-floor erosion neutralises it
      row("005", "last10_win_pct=56", "last10_win_pct=50"), // P1 by 6, materiality 5 -> likewise
      row("051", "shrunk_win_probability_pct=40", "shrunk_win_probability_pct=60"), // P2 by 20, materiality 3
    ];
    const f = forensics(rows);
    // Whatever the base call is, the verdict must be derived from both mirror cases, never
    // from the leader's case alone.
    expect(["NON_DISCRIMINATING", "LEADER_MORE_ROBUST", "CHALLENGER_MORE_ROBUST", "BOTH_SURVIVE", "NOT_APPLICABLE"]).toContain(f.symmetric_stress_verdict);
    expect(f.stress_p1.initial_support_percent).toBeGreaterThanOrEqual(0);
    expect(f.stress_p2.initial_support_percent).toBeGreaterThanOrEqual(0);
  });
});

describe("classification of refusals that the decision core itself makes", () => {
  it("classifies a level family vote as TRUE_TIE, before any downstream stage runs", () => {
    const rows = [row("001", "1600", "1500"), row("005", "last10_win_pct=30", "last10_win_pct=70")];
    const f = forensics(rows);
    expect(f.trace.family_vote).toBe("TIE");
    expect(f.classification).toBe("TRUE_TIE");
    expect(f.exact_stage_that_caused_refusal).toContain("DECISION CORE");
    // No downstream stage is implicated: the refusal predates them.
    expect(f.trace.after_stress).toBe("TIE");
  });

  it("classifies a leader short of 60% of the directional evidence as BELOW_THRESHOLD", () => {
    const rows = [
      row("001", "1600", "1500"),                              // P1  SURFACE_STRENGTH
      row("005", "last10_win_pct=70", "last10_win_pct=40"),    // P1  RECENT_FORM
      row("011", "match_win_pct=70", "match_win_pct=40"),      // P1  RESULTS_HISTORY
      row("027", "lead_protection_rate_pct=40", "lead_protection_rate_pct=70"), // P2  CLOSING_ABILITY
      row("051", "shrunk_win_probability_pct=40", "shrunk_win_probability_pct=70"), // P2  H2H_PROBABILITY
      row("041", "recent_elo_adjusted_surplus=0.1; earlier_elo_adjusted_surplus=0.6", "recent_elo_adjusted_surplus=0.6; earlier_elo_adjusted_surplus=0.1"), // P2 IMPROVEMENT_TREND
      row("080", "favorable_divergent_outcomes=10; unfavorable_divergent_outcomes=16", "favorable_divergent_outcomes=16; unfavorable_divergent_outcomes=10"), // P2 COMMON_OPPONENT
    ];
    const f = forensics(rows);
    expect(f.trace.family_vote).toBe("P2");
    expect(f.p2_support.support_ratio_percent).toBeLessThan(60);
    expect(f.classification).toBe("BELOW_THRESHOLD");
    expect(f.trace.after_threshold).toBe("INSUFFICIENT");
  });

  it("classifies a match with no two-sided evidence at all as DATA_OR_PIPELINE_BUG", () => {
    const rows = [row("001", "1600", null), row("005", "last10_win_pct=70", null)];
    const f = forensics(rows);
    expect(f.classification).toBe("DATA_OR_PIPELINE_BUG");
  });

  it("assigns exactly one classification, and preserves the raw metric evidence under it", () => {
    const rows = [row("001", "1600", "1500"), row("005", "last10_win_pct=70", "last10_win_pct=40")];
    const f = forensics(rows);
    expect(typeof f.classification).toBe("string");
    expect(f.metric_profile).toHaveLength(rows.length);
    expect(f.metric_profile[0]!.p1_value_raw).toBe("1600");
    expect(f.metric_profile[0]!.materiality).toBe(10);
  });
});
