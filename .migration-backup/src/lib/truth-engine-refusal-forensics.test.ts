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

describe("the adverse stress case erodes only real edges, and judges both players", () => {
  // REGRESSION. The original adverse case shifted EVERY comparison by one materiality
  // toward the non-selected side. A comparison the engine had declared NEUTRAL -- "both
  // players measured, no material difference" -- has |advantage| <= materiality, so the
  // shift could push it past the floor into a vote for the opponent, manufacturing
  // directional evidence out of measured parity. Erosion is now clamped at zero, so a
  // comparison can never come to favour the player it did not already favour.
  it("never manufactures a vote out of a NEUTRAL family", () => {
    const rows = [
      // Two clear P1 families (edges well beyond one materiality).
      row("001", "1700", "1500"),
      row("005", "last10_win_pct=80", "last10_win_pct=30"),
      // Two families the engine measures as NEUTRAL: 4 points apart, materiality 5, both
      // leaning P2 below the floor. This is the exact shape the old shift converted.
      row("011", "match_win_pct=50", "match_win_pct=54"),
      row("027", "lead_protection_rate_pct=50", "lead_protection_rate_pct=54"),
    ];
    const base = decideTruthEngineSelection({ comparisons: compareMetricRows(rows), p1Name: P1, p2Name: P2 });
    expect(base.outcome).toBe("P1");
    expect(base.neutral_families.sort()).toEqual(["CLOSING_ABILITY", "RESULTS_HISTORY"]);

    const f = forensics(rows);
    expect(f.stress_p1.families_manufactured_for_opponent).toEqual([]);
    expect(f.stress_p2.families_manufactured_for_opponent).toEqual([]);
    expect(f.stress_p1.families_flipped_to_opponent).toEqual([]);
  });

  it("no longer withdraws a leader on a test the opponent was never made to take", () => {
    const rows = [
      row("001", "1700", "1500"),
      row("005", "last10_win_pct=80", "last10_win_pct=30"),
      row("011", "match_win_pct=50", "match_win_pct=54"),
      row("027", "lead_protection_rate_pct=50", "lead_protection_rate_pct=54"),
    ];
    const audit = runTruthEngineAudit(compareMetricRows(rows), P1, P2);
    expect(audit.decision.outcome).toBe("P1");
    // The leader's real edges survive their own erosion, so nothing is withdrawn.
    expect(audit.stress.comparative_robustness).toBe("LEADER_ROBUST");
    expect(audit.audit_winner_side).toBe("P1");

    const f = forensics(rows, P1);
    expect(f.classification).not.toBe("DOWNSTREAM_VETO_BUG");
  });

  it("profiles BOTH players, always, and never infers one from the other", () => {
    const rows = [row("001", "1700", "1500"), row("005", "last10_win_pct=80", "last10_win_pct=30")];
    const audit = runTruthEngineAudit(compareMetricRows(rows), P1, P2);
    expect(audit.stress.sides.map((s) => s.side)).toEqual(["P1", "P2"]);
    expect(audit.stress.sides.map((s) => s.player)).toEqual([P1, P2]);
    // Eroding a side can only ever weaken that side.
    for (const side of audit.stress.sides) {
      expect(side.support_percent_after).toBeLessThanOrEqual(side.support_percent_before);
    }
  });

  it("still withdraws a leader the other player genuinely out-survives", () => {
    const rows = [
      row("001", "1512", "1500"),
      row("005", "last10_win_pct=56", "last10_win_pct=50"),
      row("027", "lead_protection_rate_pct=56", "lead_protection_rate_pct=50"),
      row("051", "shrunk_win_probability_pct=20", "shrunk_win_probability_pct=95"),
    ];
    const audit = runTruthEngineAudit(compareMetricRows(rows), P1, P2);
    expect(audit.decision.outcome).toBe("P1");
    expect(audit.stress.comparative_robustness).toBe("CHALLENGER_MORE_ROBUST");
    expect(audit.audit_winner_side).toBeNull();
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
