// STRESS-VETO FIX — the 24 regression tests required by the fix task.
//
// Forensic finding (docs/audit-32-insufficient-evidence.md): Stress used to evaluate only
// the pre-Stress leader and use that single-sided result as a global veto (Defect #2), and
// its adverse shift touched every comparison rather than only the ones favouring the side
// being stressed, which could manufacture opposing evidence out of declared NEUTRAL parity
// (Defect #1). Both are fixed in truth-engine-audit.ts: `shiftComparisons` now only ever
// touches comparisons that already favour the side being stressed, `evaluateSideStress`
// computes an identical profile for P1 and P2 with no leader-dependent branching, and
// `robustnessVerdict` is the one comparative reading (`CHALLENGER_MORE_ROBUST`) that can
// still withdraw a selection.
//
// Each test below is numbered to match the fix task's own TEST list.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { compareMetricRows, type MetricRowForComparison } from "./truth-engine-metric-comparison";
import { runTruthEngineAudit, runStressTest, evaluateSideStress, robustnessVerdict } from "./truth-engine-audit";
import { decideTruthEngineSelection } from "./truth-engine-decision";
import { evaluate, type EngineInput } from "./audit-engine";
import { STAGES } from "./audit-stages";

const P1 = "Alpha Player";
const P2 = "Beta Player";

function row(metric_code: string, p1_value: string | null, p2_value: string | null, treatments: [string, string] = ["RECONSTRUCTED", "RECONSTRUCTED"]): MetricRowForComparison {
  return { metric_code, p1_value, p2_value, p1_treatment: treatments[0], p2_treatment: treatments[1] };
}
function audit(rows: MetricRowForComparison[], p1 = P1, p2 = P2) {
  return runTruthEngineAudit(compareMetricRows(rows), p1, p2);
}

// Materiality reference (from truth-engine-metric-comparison.ts COMPARISON_SPECS):
//   001 SURFACE_STRENGTH   materiality 10  (surface Elo)
//   005 RECENT_FORM        materiality  5  (last-10 win %)
//   027 CLOSING_ABILITY    materiality  5  (lead protection %)
//   051 H2H_PROBABILITY    materiality  3  (opponent-specific win probability %)

const P1_OVERWHELMING = [
  row("001", "1900", "1500"), // +400 vs materiality 10 -> 40x, survives any one-floor erosion
  row("005", "last10_win_pct=80", "last10_win_pct=30"), // +50 vs materiality 5 -> 10x
];
const P2_OVERWHELMING = [
  row("001", "1500", "1900"),
  row("005", "last10_win_pct=30", "last10_win_pct=80"),
];

describe("TEST 1/2 — a leader whose own evidence survives its own erosion outright wins (BOTH_SURVIVE)", () => {
  it("TEST 1: P1's overwhelming lead is untouched by Stress", () => {
    const a = audit(P1_OVERWHELMING);
    expect(a.stress.comparative_robustness).toBe("BOTH_SURVIVE");
    expect(a.stress.p1.outcome_when_this_side_stressed).toBe("P1");
    expect(a.refused).toBe(false);
    expect(a.audit_winner_side).toBe("P1");
  });

  it("TEST 2: the mirror -- P2's overwhelming lead is untouched by Stress", () => {
    const a = audit(P2_OVERWHELMING);
    expect(a.stress.comparative_robustness).toBe("BOTH_SURVIVE");
    expect(a.stress.p2.outcome_when_this_side_stressed).toBe("P2");
    expect(a.refused).toBe(false);
    expect(a.audit_winner_side).toBe("P2");
  });
});

// A thin, UNCONTESTED lead: P1's own margin collapses under its own erosion, but P2 has no
// favouring evidence at all, so eroding P2's (nonexistent) own edges changes nothing.
const P1_THIN_UNCONTESTED = [
  row("001", "1514", "1500"), // +14 vs materiality 10 -> 1.4x, collapses to NEUTRAL under erosion
  row("005", "last10_win_pct=57", "last10_win_pct=50"), // +7 vs materiality 5 -> 1.4x
];
const P2_THIN_UNCONTESTED = [
  row("001", "1500", "1514"),
  row("005", "last10_win_pct=50", "last10_win_pct=57"),
];

describe("TEST 3/4 — a leader who loses margin under its own erosion, but whose challenger fares no better, still wins (LEADER_MORE_ROBUST)", () => {
  it("TEST 3: P1's thin, uncontested lead survives -- the old veto would have refused this", () => {
    const a = audit(P1_THIN_UNCONTESTED);
    expect(a.stress.p1.outcome_when_this_side_stressed).toBe("INSUFFICIENT_EVIDENCE"); // P1's own case collapses
    expect(a.stress.p2.outcome_when_this_side_stressed).toBe("P1"); // P2 has nothing of its own to erode
    expect(a.stress.comparative_robustness).toBe("LEADER_MORE_ROBUST");
    expect(a.refused).toBe(false);
    expect(a.audit_winner_side).toBe("P1");
  });

  it("TEST 4: the mirror -- P2's thin, uncontested lead survives", () => {
    const a = audit(P2_THIN_UNCONTESTED);
    expect(a.stress.p2.outcome_when_this_side_stressed).toBe("INSUFFICIENT_EVIDENCE");
    expect(a.stress.p1.outcome_when_this_side_stressed).toBe("P2");
    expect(a.stress.comparative_robustness).toBe("LEADER_MORE_ROBUST");
    expect(a.refused).toBe(false);
    expect(a.audit_winner_side).toBe("P2");
  });
});

// A leader supported by two thin (1.4x) families and opposed by one thin (1.4x) family:
// eroding the LEADER's own two families hands the match fully to the challenger (a real,
// non-manufactured flip -- the challenger's own family was always there), but eroding the
// CHALLENGER's one family leaves the leader still ahead. Neither erosion ranks the other
// player as genuinely more robust -- the shift is simply bigger than both separations.
const P1_NON_DISCRIMINATING = [
  row("001", "1514", "1500"), // P1 by 14 vs materiality 10 -> 1.4x
  row("005", "last10_win_pct=57", "last10_win_pct=50"), // P1 by 7 vs materiality 5 -> 1.4x
  row("051", "shrunk_win_probability_pct=46", "shrunk_win_probability_pct=50.2"), // P2 by 4.2 vs materiality 3 -> 1.4x
];
const P2_NON_DISCRIMINATING = [
  row("001", "1500", "1514"),
  row("005", "last10_win_pct=50", "last10_win_pct=57"),
  row("051", "shrunk_win_probability_pct=50.2", "shrunk_win_probability_pct=46"),
];

describe("TEST 5/6 — equally / non-discriminatorily robust does not erase an otherwise valid result (NON_DISCRIMINATING)", () => {
  it("TEST 5: P1 leads 2 families to 1; stressing either side flips to the other, but the original P1 selection stands", () => {
    const base = decideTruthEngineSelection({ comparisons: compareMetricRows(P1_NON_DISCRIMINATING), p1Name: P1, p2Name: P2 });
    expect(base.outcome).toBe("P1");
    const a = audit(P1_NON_DISCRIMINATING);
    expect(a.stress.p1.outcome_when_this_side_stressed).toBe("P2"); // eroding P1's own 2 thin families hands it to P2
    expect(a.stress.p2.outcome_when_this_side_stressed).toBe("P1"); // eroding P2's own thin family leaves P1 ahead
    expect(a.stress.comparative_robustness).toBe("NON_DISCRIMINATING");
    expect(a.refused).toBe(false);
    expect(a.audit_winner_side).toBe("P1"); // not arbitrarily erased
  });

  it("TEST 6: the mirror -- P2 leads 2 families to 1 and is not erased either", () => {
    const a = audit(P2_NON_DISCRIMINATING);
    expect(a.stress.comparative_robustness).toBe("NON_DISCRIMINATING");
    expect(a.refused).toBe(false);
    expect(a.audit_winner_side).toBe("P2");
  });
});

// A material P1 lead plus one family the engine measures as genuinely NEUTRAL (both players
// measured, sub-floor difference).
const WITH_NEUTRAL_FAMILY_P2_LEANING = [
  ...P1_OVERWHELMING,
  row("027", "lead_protection_rate_pct=50", "lead_protection_rate_pct=54"), // P2-leaning by 4 vs materiality 5 -> NEUTRAL
];
const WITH_NEUTRAL_FAMILY_P1_LEANING = [
  ...P1_OVERWHELMING,
  row("027", "lead_protection_rate_pct=54", "lead_protection_rate_pct=50"), // P1-leaning by 4 vs materiality 5 -> NEUTRAL
];

describe("TEST 7/8/13 — a NEUTRAL family stays NEUTRAL under either side's own erosion; it can never become support for anybody", () => {
  it("TEST 7: stressing P1 (the leader) never converts the NEUTRAL, P2-leaning family into P2 support", () => {
    const base = decideTruthEngineSelection({ comparisons: compareMetricRows(WITH_NEUTRAL_FAMILY_P2_LEANING), p1Name: P1, p2Name: P2 });
    expect(base.neutral_families).toEqual(["CLOSING_ABILITY"]);
    const p1Stress = evaluateSideStress(compareMetricRows(WITH_NEUTRAL_FAMILY_P2_LEANING), "P1", P1, P2);
    expect(p1Stress.families_manufactured_for_opponent).toEqual([]); // TEST 13: no manufactured challenger support
    expect(p1Stress.families_neutralised).toEqual([]); // P1's own huge edges never even reach the floor
  });

  it("TEST 8: the mirror -- stressing P2 never converts a NEUTRAL, P1-leaning family into P1 support", () => {
    const base = decideTruthEngineSelection({ comparisons: compareMetricRows(WITH_NEUTRAL_FAMILY_P1_LEANING), p1Name: P1, p2Name: P2 });
    expect(base.neutral_families).toEqual(["CLOSING_ABILITY"]);
    const p2Stress = evaluateSideStress(compareMetricRows(WITH_NEUTRAL_FAMILY_P1_LEANING), "P2", P1, P2);
    expect(p2Stress.families_manufactured_for_opponent).toEqual([]);
  });
});

describe("TEST 9/10 — edge erosion weakens a directional family to NEUTRAL; it never flips outright to the opponent", () => {
  it("TEST 9: P1's thin family is neutralised by P1's own stress, never flipped to P2", () => {
    const p1Stress = evaluateSideStress(compareMetricRows(P1_THIN_UNCONTESTED), "P1", P1, P2);
    expect(p1Stress.families_neutralised.sort()).toEqual(["RECENT_FORM", "SURFACE_STRENGTH"]);
    expect(p1Stress.families_flipped_to_opponent).toEqual([]);
  });

  it("TEST 10: the mirror -- P2's thin family is neutralised by P2's own stress, never flipped to P1", () => {
    const p2Stress = evaluateSideStress(compareMetricRows(P2_THIN_UNCONTESTED), "P2", P1, P2);
    expect(p2Stress.families_neutralised.sort()).toEqual(["RECENT_FORM", "SURFACE_STRENGTH"]);
    expect(p2Stress.families_flipped_to_opponent).toEqual([]);
  });
});

describe("TEST 11 — swapping P1 and P2 swaps every Stress output exactly", () => {
  it("comparative_robustness and both side profiles mirror under a full P1/P2 swap", () => {
    const forward = audit(P1_THIN_UNCONTESTED);
    const swapped = audit(P2_THIN_UNCONTESTED);
    expect(forward.stress.comparative_robustness).toBe(swapped.stress.comparative_robustness);
    expect(forward.stress.p1.outcome_when_this_side_stressed).toBe("INSUFFICIENT_EVIDENCE");
    expect(swapped.stress.p2.outcome_when_this_side_stressed).toBe("INSUFFICIENT_EVIDENCE");
    expect(forward.audit_winner_side).toBe("P1");
    expect(swapped.audit_winner_side).toBe("P2");
  });
});

describe("TEST 12 — leader-independence: P1 and P2 are always both evaluated, by the identical function, regardless of which one leads", () => {
  it("runStressTest always populates BOTH side profiles, whichever side the decision core selected", () => {
    const leaderIsP1 = runStressTest(compareMetricRows(P1_OVERWHELMING), P1, P2);
    const leaderIsP2 = runStressTest(compareMetricRows(P2_OVERWHELMING), P1, P2);
    expect(leaderIsP1.p1.side).toBe("P1");
    expect(leaderIsP1.p2.side).toBe("P2");
    expect(leaderIsP2.p1.side).toBe("P1");
    expect(leaderIsP2.p2.side).toBe("P2");
  });

  it("evaluateSideStress takes an explicit side and never infers it from who currently leads", () => {
    // Calling it for the NON-leading side is a completely ordinary call, not a special case.
    const nonLeaderStress = evaluateSideStress(compareMetricRows(P1_OVERWHELMING), "P2", P1, P2);
    expect(nonLeaderStress.side).toBe("P2");
    expect(nonLeaderStress.support_families_before).toBe(0);
  });
});

describe("TEST 14 — a narrowed margin alone never erases a valid comparative result", () => {
  it("stress.changed is true (the leader-only diagnostic narrowed) but the audit does not refuse", () => {
    const a = audit(P1_THIN_UNCONTESTED);
    expect(a.stress.changed).toBe(true); // the OLD veto's own trigger condition still fires...
    expect(a.stress.comparative_robustness).not.toBe("CHALLENGER_MORE_ROBUST"); // ...but it is no longer sufficient
    expect(a.refused).toBe(false);
  });
});

describe("TEST 15 — no unsupported challenger is ever selected merely because the leader was stressed", () => {
  it("a challenger trailing on independent support families cannot win its own stress test, however strong its one edge", () => {
    const a = audit([
      row("001", "1900", "1500"), // P1 by 400 vs materiality 10 -> huge
      row("005", "last10_win_pct=80", "last10_win_pct=30"), // P1 by 50 vs materiality 5 -> huge
      row("051", "shrunk_win_probability_pct=27", "shrunk_win_probability_pct=73"), // P2's single strongest possible edge, ~15x its own floor
    ]);
    expect(a.decision.outcome).toBe("P1");
    expect(a.stress.p2.outcome_when_this_side_stressed).not.toBe("P2");
    expect(a.stress.comparative_robustness).not.toBe("CHALLENGER_MORE_ROBUST");
    expect(a.audit_winner).toBe(P1);
  });
});

describe("TEST 16/17 — the corrected winner survives the FULL audit pipeline (verification, disagreement, underdog, stress, synthesis), for both sides", () => {
  it("TEST 16: P1's thin, uncontested lead is the audit_winner end to end, with a real evidence chain", () => {
    const a = audit(P1_THIN_UNCONTESTED);
    expect(a.audit_winner).toBe(P1);
    expect(a.audit_winner_side).toBe("P1");
    expect(a.refused).toBe(false);
    expect(a.evidence_chain.join("\n")).toMatch(/STRESS/);
    expect(a.evidence_chain.join("\n")).toContain("comparative_robustness=LEADER_MORE_ROBUST");
    expect(a.final_reason).toContain(P1);
    expect(a.final_reason).not.toMatch(/^Refused/);
  });

  it("TEST 17: the mirror -- P2's thin, uncontested lead survives end to end", () => {
    const a = audit(P2_THIN_UNCONTESTED);
    expect(a.audit_winner).toBe(P2);
    expect(a.audit_winner_side).toBe("P2");
    expect(a.refused).toBe(false);
    expect(a.final_reason).toContain(P2);
  });
});

describe("TEST 18 — a genuine TRUE_TIE is unaffected by the Stress fix (decided before Stress ever runs)", () => {
  it("a level family vote is refused at the decision core, never reaching Stress", () => {
    const a = audit([row("001", "1600", "1500"), row("005", "last10_win_pct=30", "last10_win_pct=70")]);
    expect(a.decision.outcome).toBe("INSUFFICIENT_EVIDENCE");
    expect(a.stress.comparative_robustness).toBe("NOT_APPLICABLE"); // Stress had nothing to evaluate
    expect(a.refused).toBe(true);
    expect(a.final_reason).toMatch(/^Refused/);
    expect(a.final_reason).not.toMatch(/CHALLENGER_MORE_ROBUST/);
  });
});

describe("TEST 19 — a genuine BELOW_THRESHOLD refusal is unaffected by the Stress fix", () => {
  it("a leader under 60% of the directional evidence is refused at the decision core, never reaching Stress", () => {
    const a = audit([
      row("001", "1600", "1500"), // P1  SURFACE_STRENGTH
      row("005", "last10_win_pct=70", "last10_win_pct=40"), // P1  RECENT_FORM
      row("011", "match_win_pct=70", "match_win_pct=40"), // P1  RESULTS_HISTORY
      row("027", "lead_protection_rate_pct=40", "lead_protection_rate_pct=70"), // P2  CLOSING_ABILITY
      row("051", "shrunk_win_probability_pct=40", "shrunk_win_probability_pct=70"), // P2  H2H_PROBABILITY
      row("041", "recent_elo_adjusted_surplus=0.1; earlier_elo_adjusted_surplus=0.6", "recent_elo_adjusted_surplus=0.6; earlier_elo_adjusted_surplus=0.1"), // P2 IMPROVEMENT_TREND
      row("080", "favorable_divergent_outcomes=10; unfavorable_divergent_outcomes=16", "favorable_divergent_outcomes=16; unfavorable_divergent_outcomes=10"), // P2 COMMON_OPPONENT
    ]);
    expect(a.decision.outcome).toBe("INSUFFICIENT_EVIDENCE");
    expect(a.decision.evidence_percent).toBeLessThan(60);
    expect(a.stress.comparative_robustness).toBe("NOT_APPLICABLE");
    expect(a.refused).toBe(true);
  });
});

describe("TEST 20 — a genuine DATA_OR_PIPELINE_BUG refusal (one side's evidence never arrived) is unaffected by the Stress fix", () => {
  it("no selection ever forms when one player has no usable evidence at all, so Stress has nothing to evaluate", () => {
    const a = audit([row("001", "1600", null), row("005", "last10_win_pct=70", null)]);
    expect(a.decision.outcome).toBe("INSUFFICIENT_EVIDENCE");
    expect(a.stress.comparative_robustness).toBe("NOT_APPLICABLE");
    expect(a.refused).toBe(true);
    expect(a.verification.unavailable_metrics.length).toBeGreaterThan(0);
  });
});

describe("TEST 21 — the Stress engine cannot be influenced by colour: it has no colour input at all", () => {
  it("runTruthEngineAudit / runStressTest / evaluateSideStress take only evidence and player names -- no colour parameter exists to read", () => {
    expect(runTruthEngineAudit.length).toBe(3); // (comparisons, p1Name, p2Name)
    expect(runStressTest.length).toBe(3);
    expect(evaluateSideStress.length).toBe(4); // (comparisons, side, p1Name, p2Name)
    expect(robustnessVerdict.length).toBe(3); // (leader, p1Stress, p2Stress)
    // Calling twice with identical evidence is byte-identical -- nothing external (like a
    // colour computed elsewhere) can leak into the result.
    const once = JSON.stringify(audit(P1_THIN_UNCONTESTED));
    const twice = JSON.stringify(audit(P1_THIN_UNCONTESTED));
    expect(once).toBe(twice);
  });
});

describe("TEST 22 — Stress's own outcome does not directly determine colour: colour is gated on run.independent_winner alone", () => {
  const baseMatch: EngineInput["match"] = { identity_status: "VERIFIED", surface_status: "VERIFIED", player1_name: P1, player2_name: P2 };
  const baseRun: EngineInput["run"] = {
    research_lock_at: "2026-09-05T05:00:00.000Z",
    independent_decision_committed_at: "2026-09-05T05:38:12.000Z",
    matrix_revealed_at: "2026-09-05T05:38:13.000Z",
    independent_winner: P1,
    independent_low: null,
    independent_high: null,
    calibration_version_id: "calib-1",
    effective_evidence_count: 5,
  };
  const ALL_STAGES_COMPLETE: EngineInput["stages"] = STAGES.map((stage) => ({ stage, status: "COMPLETE" }));
  const cleanMetrics: EngineInput["metrics"] = Array.from({ length: 25 }, (_, i) => ({
    status: "COMPLETE", p1_status: "COMPLETE", p2_status: "COMPLETE",
    p1_treatment: "DIRECT", p2_treatment: "DIRECT",
    matrix_derived: false, evidence_family: `FAMILY_${i}`, metric_name: `metric ${i}`, metric_code: String(300 + i),
    p1_value: "10", p2_value: "5", sources: [{ source_name: "Tour Stats" }],
  }));
  const cleanVerification: EngineInput["verification"] = [{ status: "COMPLETE", outcome: "PASS", severity: "STANDARD" }];
  const cleanDisagreement: EngineInput["disagreement"] = [{ status: "COMPLETE", contradiction_severity: "NONE" }];
  const cleanUnderdog: EngineInput["underdog"] = [
    { status: "COMPLETE", classification: "WEAK", player_side: P2 },
    { status: "COMPLETE", classification: "WEAK", player_side: P1 },
  ];

  function engineInput(adverseCaseOutcome: string, runOverrides: Partial<EngineInput["run"]> = {}): EngineInput {
    return {
      match: baseMatch,
      run: { ...baseRun, ...runOverrides },
      metrics: cleanMetrics,
      verification: cleanVerification,
      disagreement: cleanDisagreement,
      underdog: cleanUnderdog,
      // ST01-03 (matrix removal, family removal) are left fixed and STABLE -- those are a
      // separate, legitimate GREEN/DOUBLE-GREEN robustness signal, not the winner-veto
      // defect this fix addresses. Only ST05 (the adverse-case row, formerly the veto's own
      // trigger) varies here, to isolate exactly the claim under test.
      stress: [
        { status: "COMPLETE", test_code: "ST01", outcome: "STABLE" },
        { status: "COMPLETE", test_code: "ST02", outcome: "STABLE" },
        { status: "COMPLETE", test_code: "ST03", outcome: "STABLE" },
        { status: "COMPLETE", test_code: "ST05", outcome: adverseCaseOutcome },
      ],
      reconstructions: [],
      conflicts: [],
      matrixWp: null,
      stages: ALL_STAGES_COMPLETE,
    };
  }

  it("a Stress row's own content can only ever move GREEN<->DOUBLE GREEN (a separate, pre-existing tier), never invent or erase a winner", () => {
    // input.stress content legitimately feeds the GREEN/DOUBLE-GREEN tier distinction
    // (audit-engine.ts:379, pre-existing and unrelated to this fix) -- that is not the
    // defect this task addresses. What the fix guarantees is narrower and more important:
    // neither value ever moves the result into or out of "no winner" (INSUFFICIENT
    // EVIDENCE) or between two DIFFERENT winners -- only the run's own independent_winner
    // can do that (see the next test).
    const stable = evaluate(engineInput("STABLE"));
    const unstable = evaluate(engineInput("UNSTABLE"));
    expect(stable.auditComplete).toBe(true);
    expect(["GREEN", "DOUBLE GREEN"]).toContain(stable.color);
    expect(["GREEN", "DOUBLE GREEN"]).toContain(unstable.color);
    expect(stable.checks.find((c) => c.key === "committed")?.detail).toBe(P1);
    expect(unstable.checks.find((c) => c.key === "committed")?.detail).toBe(P1);
  });

  it("colour flips to INSUFFICIENT EVIDENCE purely from independent_winner being null, regardless of Stress content", () => {
    const withWinner = evaluate(engineInput("STABLE"));
    const noWinner = evaluate(engineInput("STABLE", { independent_winner: null }));
    expect(withWinner.color).not.toBe("INSUFFICIENT EVIDENCE");
    expect(noWinner.auditComplete).toBe(true);
    expect(noWinner.color).toBe("INSUFFICIENT EVIDENCE");
  });
});

describe("TEST 23 — final_selection is never parsed for player identity or winner determination", () => {
  it("the Stress/decision source files contain no reference to final_selection at all", () => {
    const files = ["src/lib/truth-engine-audit.ts", "src/lib/truth-engine-decision.ts", "src/lib/audit-engine.ts"];
    for (const file of files) {
      const source = readFileSync(new URL(`../../${file}`, import.meta.url), "utf8");
      expect(source, `${file} must never reference final_selection`).not.toContain("final_selection");
    }
  });
});

describe("TEST 24 — array ordering cannot invert P1/P2 Stress results", () => {
  it("shuffling the metric row order leaves the audit winner and comparative robustness unchanged", () => {
    const forward = audit(P1_NON_DISCRIMINATING);
    const reversed = audit([...P1_NON_DISCRIMINATING].reverse());
    const shuffled = audit([P1_NON_DISCRIMINATING[1]!, P1_NON_DISCRIMINATING[2]!, P1_NON_DISCRIMINATING[0]!]);
    expect(reversed.audit_winner_side).toBe(forward.audit_winner_side);
    expect(reversed.stress.comparative_robustness).toBe(forward.stress.comparative_robustness);
    expect(shuffled.audit_winner_side).toBe(forward.audit_winner_side);
    expect(shuffled.stress.comparative_robustness).toBe(forward.stress.comparative_robustness);
  });
});
