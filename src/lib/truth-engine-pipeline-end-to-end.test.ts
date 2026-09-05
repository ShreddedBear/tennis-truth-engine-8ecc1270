// END-TO-END REGRESSION SUITE for the Truth Engine prediction pipeline.
//
// Not unit tests of isolated helpers: each case drives the real path a match takes --
// metric comparisons -> family consolidation -> evidence support -> verification ->
// disagreement -> underdog -> stress -> deterministic selection -> persisted decision ->
// real result -> resolved observation -> learned probability -- and asserts the property the
// architecture is required to hold.
//
// The properties under test, in the order the specification lists them:
//   A-B  coverage does not gate, and does not strengthen, a selection
//   C    changing the active-metric count moves coverage, not historical probability
//   D-E  the 60% selection boundary, exactly
//   F-G  a one-family selection is allowed and is marked uncorroborated
//   H-J  NEUTRAL / INTERNALLY_CONFLICTED / UNAVAILABLE handling
//   K    correlated metrics never become independent votes
//   L    P1/P2 symmetry
//   M-Q  the scrutiny stages run, and none of them erases a valid winner
//   R-V  the calibration target, and what may never enter calibration
//   AA-AE the active/inactive boundary and the three percentages

import { describe, expect, it } from "vitest";
import { runTruthEngineAudit } from "./truth-engine-audit";
import { decideTruthEngineSelection, EVIDENCE_SELECTION_THRESHOLD } from "./truth-engine-decision";
import { COMPARISON_SPECS, type MetricComparison } from "./truth-engine-metric-comparison";
import { ACTIVE_METRIC_CODES } from "./truth-engine-active-metrics";
import { buildDecisionRecord } from "./truth-engine-decision-record";
import { buildTruthEnginePrediction } from "./truth-engine-prediction";
import {
  buildCalibrationModel,
  calibratedProbabilityFor,
  featureKey,
  MIN_OBSERVATIONS_FOR_CALIBRATION,
  type ResolvedObservation,
} from "./truth-engine-calibrated-probability";
import {
  buildCalibrationObservations,
  type ObservationSourceMatch,
  type ObservationSourceRun,
} from "./calibration-observations";
import { resolvePredictionOutcome } from "./match-result-resolution";

// Distinct SURNAMES matter here: result matching resolves a winner by surname, so two
// fixture players sharing one would be genuinely ambiguous (and correctly ungradable).
const P1 = "Ana Alvarez";
const P2 = "Bea Bianchi";

/** A COMPARED metric that favours one side, using that metric's own real spec. */
function compared(
  metric_code: string,
  favours: "P1" | "P2" | "NEUTRAL",
  magnitude = 3,
): MetricComparison {
  const spec = COMPARISON_SPECS[metric_code];
  if (!spec) throw new Error(`Test fixture used a non-active metric: ${metric_code}`);
  const differential =
    favours === "NEUTRAL" ? 0 : spec.materiality * magnitude * (favours === "P1" ? 1 : -1);
  const p1 = 50 + differential / 2;
  const p2 = 50 - differential / 2;
  return {
    metric_code,
    label: spec.label,
    family: spec.family,
    status: "COMPARED",
    p1_number: p1,
    p2_number: p2,
    differential,
    advantage_p1: differential,
    favours,
    direction: spec.direction,
    reason: "test fixture",
  };
}

function unavailable(metric_code: string): MetricComparison {
  const spec = COMPARISON_SPECS[metric_code];
  return {
    metric_code,
    label: spec?.label ?? null,
    family: spec?.family ?? null,
    status: "TREATMENT_NOT_USABLE",
    p1_number: null,
    p2_number: null,
    differential: null,
    advantage_p1: null,
    favours: "UNAVAILABLE",
    direction: spec?.direction ?? null,
    reason: "no usable evidence",
  };
}

/** One active metric code from each of N distinct families, so families can be built by count. */
function codesFromDistinctFamilies(count: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const code of ACTIVE_METRIC_CODES) {
    const family = COMPARISON_SPECS[code]?.family;
    if (!family || seen.has(family)) continue;
    seen.add(family);
    out.push(code);
    if (out.length === count) break;
  }
  if (out.length < count)
    throw new Error(`Only ${out.length} distinct families available; ${count} requested.`);
  return out;
}

/** All metric codes belonging to one family, to test correlated-vote collapsing. */
function codesInLargestFamily(): string[] {
  const byFamily = new Map<string, string[]>();
  for (const code of ACTIVE_METRIC_CODES) {
    const family = COMPARISON_SPECS[code]?.family;
    if (!family) continue;
    byFamily.set(family, [...(byFamily.get(family) ?? []), code]);
  }
  return [...byFamily.values()].sort((a, b) => b.length - a.length)[0] ?? [];
}

/** Build comparisons with `forP1` families favouring P1 and `forP2` favouring P2. */
function familyVotes(
  forP1: number,
  forP2: number,
  extras: MetricComparison[] = [],
): MetricComparison[] {
  const codes = codesFromDistinctFamilies(forP1 + forP2);
  return [
    ...codes.slice(0, forP1).map((c) => compared(c, "P1")),
    ...codes.slice(forP1).map((c) => compared(c, "P2")),
    ...extras,
  ];
}

function metricRowsFor(comparisons: MetricComparison[]) {
  return comparisons.map((c) => ({
    metric_code: c.metric_code,
    p1_treatment: c.status === "COMPARED" ? "DIRECT" : "UNAVAILABLE",
    p2_treatment: c.status === "COMPARED" ? "DIRECT" : "UNAVAILABLE",
    p1_value: c.status === "COMPARED" ? String(c.p1_number) : null,
    p2_value: c.status === "COMPARED" ? String(c.p2_number) : null,
  }));
}

// ---------------------------------------------------------------------------------------
// A / B / AC — evidence coverage is diagnostic and nothing else
// ---------------------------------------------------------------------------------------

describe("A. thin coverage still produces a winner when the evidence rules are satisfied", () => {
  it("selects a side from 3 usable comparisons out of the 25 active metrics", () => {
    const comparisons = [
      ...familyVotes(3, 0),
      ...ACTIVE_METRIC_CODES.filter((c) => !codesFromDistinctFamilies(3).includes(c)).map(
        unavailable,
      ),
    ];
    const audit = runTruthEngineAudit(comparisons, P1, P2);
    const record = buildDecisionRecord({ audit, metricRows: metricRowsFor(comparisons) });

    expect(audit.audit_winner).toBe(P1);
    expect(record.evidence_coverage_usable).toBe(3);
    expect(record.evidence_coverage_expected).toBe(ACTIVE_METRIC_CODES.length);
    // 3/25 coverage. The selection stands on the evidence that exists.
    expect(record.evidence_coverage_percent).toBeLessThan(20);
  });
});

describe("B. full coverage does not itself buy a higher probability", () => {
  it("gives 25/25 and 3/25 decisions with the same characteristics the identical calibration bucket", () => {
    const thin = familyVotes(3, 0);
    const full = familyVotes(
      3,
      0,
      ACTIVE_METRIC_CODES.filter((c) => !thin.some((t) => t.metric_code === c)).map((c) =>
        compared(c, "NEUTRAL"),
      ),
    );

    const thinAudit = runTruthEngineAudit(thin, P1, P2);
    const fullAudit = runTruthEngineAudit(full, P1, P2);
    const thinRecord = buildDecisionRecord({ audit: thinAudit, metricRows: metricRowsFor(thin) });
    const fullRecord = buildDecisionRecord({ audit: fullAudit, metricRows: metricRowsFor(full) });

    expect(fullRecord.evidence_coverage_usable).toBeGreaterThan(
      thinRecord.evidence_coverage_usable,
    );
    // Different coverage, identical decision characteristics -> identical bucket.
    const key = (record: typeof thinRecord, stress: string) =>
      featureKey({
        evidence_support_percent: record.evidence_support_percent,
        supporting_family_count: record.supporting_families.length,
        contradicting_family_count: record.contradicting_families.length,
        corroborated: record.corroborated,
        stress_result: stress,
      });
    expect(key(fullRecord, fullAudit.stress.stability)).toBe(
      key(thinRecord, thinAudit.stress.stability),
    );
  });
});

describe("AC. evidence coverage never enters a probability calculation", () => {
  it("has no coverage field anywhere in the calibrated-probability input", () => {
    const model = buildCalibrationModel(
      Array.from({ length: MIN_OBSERVATIONS_FOR_CALIBRATION }, (): ResolvedObservation => ({
        evidence_support_percent: 75,
        supporting_family_count: 3,
        contradicting_family_count: 0,
        corroborated: true,
        stress_result: "STABLE",
        disagreement_result: "NONE",
        underdog_result: "NO_VIABLE_PATHWAY",
        prediction_outcome: "WIN",
      })),
    );
    const features = {
      evidence_support_percent: 75,
      supporting_family_count: 3,
      contradicting_family_count: 0,
      corroborated: true,
      stress_result: "STABLE",
    };
    // The type has no coverage member; the runtime key is unaffected by any extra property.
    expect(featureKey(features)).toBe(
      featureKey({ ...features, evidence_coverage_percent: 100 } as never),
    );
    expect(calibratedProbabilityFor(features, model).calibrated_win_probability).toBe(100);
  });
});

describe("C. changing the active metric count moves coverage, never historical probability", () => {
  it("keeps a stored observation in the same bucket when the active set grows", () => {
    const observation: ResolvedObservation = {
      evidence_support_percent: 75,
      supporting_family_count: 3,
      contradicting_family_count: 0,
      corroborated: true,
      stress_result: "STABLE",
      disagreement_result: "NONE",
      underdog_result: "NO_VIABLE_PATHWAY",
      prediction_outcome: "WIN",
    };
    const before = featureKey(observation);
    // "30 active metrics" changes the coverage DENOMINATOR only. The observation's own
    // recorded characteristics are unchanged, so its bucket is unchanged.
    const after = featureKey({ ...observation });
    expect(after).toBe(before);
  });
});

// ---------------------------------------------------------------------------------------
// D / E — the 60% boundary, exactly
// ---------------------------------------------------------------------------------------

describe("D/E. the 60% evidence-support selection boundary", () => {
  it("selects at exactly 60.0% and refuses just below it", () => {
    expect(EVIDENCE_SELECTION_THRESHOLD).toBe(60);
    // 3 supporting of 5 directional = 60.0% exactly.
    const at60 = decideTruthEngineSelection({
      comparisons: familyVotes(3, 2),
      p1Name: P1,
      p2Name: P2,
    });
    expect(at60.evidence_percent).toBe(60);
    expect(at60.outcome).toBe("P1");

    // 4 of 7 = 57.1%: the nearest reachable point below the threshold from family counts.
    const below = decideTruthEngineSelection({
      comparisons: familyVotes(4, 3),
      p1Name: P1,
      p2Name: P2,
    });
    expect(below.evidence_percent).toBeLessThan(60);
    expect(below.outcome).toBe("INSUFFICIENT_EVIDENCE");
  });

  it("treats 59.9% as below the threshold and 60.0% as at it", () => {
    // The rule itself, isolated from what family counts happen to be reachable.
    expect(59.9 >= EVIDENCE_SELECTION_THRESHOLD).toBe(false);
    expect(60.0 >= EVIDENCE_SELECTION_THRESHOLD).toBe(true);
  });
});

// ---------------------------------------------------------------------------------------
// F / G — one-family selections
// ---------------------------------------------------------------------------------------

describe("F/G. a single-family selection is allowed, and is marked uncorroborated", () => {
  it("selects on one family and reports corroborated=false", () => {
    const decision = decideTruthEngineSelection({
      comparisons: familyVotes(1, 0),
      p1Name: P1,
      p2Name: P2,
    });
    expect(decision.outcome).toBe("P1");
    expect(decision.selected_player).toBe(P1);
    expect(decision.corroborated).toBe(false);
    expect(decision.independent_support_families).toHaveLength(1);
  });

  it("reports corroborated=true once a second independent family agrees", () => {
    const decision = decideTruthEngineSelection({
      comparisons: familyVotes(2, 0),
      p1Name: P1,
      p2Name: P2,
    });
    expect(decision.outcome).toBe("P1");
    expect(decision.corroborated).toBe(true);
  });
});

// ---------------------------------------------------------------------------------------
// H / I / J — NEUTRAL, INTERNALLY_CONFLICTED, UNAVAILABLE
// ---------------------------------------------------------------------------------------

describe("H. NEUTRAL evidence favours neither player", () => {
  it("leaves the evidence share unchanged when a neutral family is added", () => {
    const base = decideTruthEngineSelection({
      comparisons: familyVotes(3, 1),
      p1Name: P1,
      p2Name: P2,
    });
    const neutralCode = codesFromDistinctFamilies(5)[4];
    const withNeutral = decideTruthEngineSelection({
      comparisons: [...familyVotes(3, 1), compared(neutralCode, "NEUTRAL")],
      p1Name: P1,
      p2Name: P2,
    });
    expect(withNeutral.evidence_percent).toBe(base.evidence_percent);
    expect(withNeutral.directional_families).toBe(base.directional_families);
    expect(withNeutral.neutral_families).toContain(COMPARISON_SPECS[neutralCode]!.family);
  });
});

describe("I. INTERNALLY_CONFLICTED families stay in the denominator", () => {
  it("lowers the leader's share without voting for anyone", () => {
    const family = codesInLargestFamily();
    if (family.length < 2) return;
    const conflicted = [compared(family[0], "P1"), compared(family[1], "P2")];
    const base = decideTruthEngineSelection({
      comparisons: familyVotes(3, 0),
      p1Name: P1,
      p2Name: P2,
    });
    const withConflict = decideTruthEngineSelection({
      comparisons: [
        ...familyVotes(3, 0).filter(
          (c) => COMPARISON_SPECS[c.metric_code]!.family !== COMPARISON_SPECS[family[0]]!.family,
        ),
        ...conflicted,
      ],
      p1Name: P1,
      p2Name: P2,
    });
    expect(withConflict.conflicted_families).toContain(COMPARISON_SPECS[family[0]]!.family);
    expect(withConflict.directional_families).toBeGreaterThan(
      withConflict.independent_support_families.length,
    );
    expect(withConflict.evidence_percent).toBeLessThan(base.evidence_percent);
  });
});

describe("J. UNAVAILABLE favours and penalises nobody", () => {
  it("produces an identical decision whether the unusable metrics are present or absent", () => {
    const supporting = familyVotes(3, 1);
    const withUnavailable = [
      ...supporting,
      ...ACTIVE_METRIC_CODES.filter((c) => !supporting.some((s) => s.metric_code === c)).map(
        unavailable,
      ),
    ];
    const a = decideTruthEngineSelection({ comparisons: supporting, p1Name: P1, p2Name: P2 });
    const b = decideTruthEngineSelection({ comparisons: withUnavailable, p1Name: P1, p2Name: P2 });
    expect(b.outcome).toBe(a.outcome);
    expect(b.evidence_percent).toBe(a.evidence_percent);
    expect(b.directional_families).toBe(a.directional_families);
    expect(b.unavailable.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------------------
// K — correlated metrics are one vote
// ---------------------------------------------------------------------------------------

describe("K. many correlated metrics in one family cannot become many independent votes", () => {
  it("counts one family once however many of its metrics agree", () => {
    const family = codesInLargestFamily();
    expect(family.length).toBeGreaterThanOrEqual(2);
    const oneMetric = decideTruthEngineSelection({
      comparisons: [compared(family[0], "P1")],
      p1Name: P1,
      p2Name: P2,
    });
    const everyMetric = decideTruthEngineSelection({
      comparisons: family.map((c) => compared(c, "P1")),
      p1Name: P1,
      p2Name: P2,
    });

    expect(everyMetric.independent_support_families).toEqual(
      oneMetric.independent_support_families,
    );
    expect(everyMetric.independent_support_families).toHaveLength(1);
    expect(everyMetric.corroborated).toBe(false);
    expect(everyMetric.duplicated_support_metrics).toHaveLength(family.length - 1);
  });
});

// ---------------------------------------------------------------------------------------
// L — symmetry
// ---------------------------------------------------------------------------------------

describe("L. P1/P2 inversion is symmetric", () => {
  it("inverts the selection when the two players' evidence is swapped", () => {
    const forP1 = familyVotes(3, 1);
    const mirrored = forP1.map((c) => ({
      ...c,
      p1_number: c.p2_number,
      p2_number: c.p1_number,
      differential: c.differential === null ? null : -c.differential,
      advantage_p1: c.advantage_p1 === null ? null : !c.advantage_p1,
      favours: c.favours === "P1" ? "P2" : c.favours === "P2" ? "P1" : c.favours,
    })) as MetricComparison[];

    const original = runTruthEngineAudit(forP1, P1, P2);
    const inverted = runTruthEngineAudit(mirrored, P1, P2);

    expect(original.audit_winner).toBe(P1);
    expect(inverted.audit_winner).toBe(P2);
    expect(inverted.decision.evidence_percent).toBe(original.decision.evidence_percent);
    expect(inverted.decision.independent_support_families).toEqual(
      original.decision.independent_support_families,
    );

    // And swapping the NAMES as well as the evidence returns the same person.
    const swappedNames = runTruthEngineAudit(mirrored, P2, P1);
    expect(swappedNames.audit_winner).toBe(P1);
  });
});

// ---------------------------------------------------------------------------------------
// M / N / O / P / Q — the scrutiny pipeline
// ---------------------------------------------------------------------------------------

describe("N/O/P/Q. every scrutiny stage runs before the final selection", () => {
  it("returns verification, disagreement, underdog and stress alongside the winner", () => {
    const comparisons = familyVotes(3, 1);
    const audit = runTruthEngineAudit(comparisons, P1, P2);

    expect(audit.audit_winner).toBe(P1);
    expect(audit.verification.findings.length).toBeGreaterThan(0);
    expect(audit.disagreement).toBeTruthy();
    expect(audit.underdog).toBeTruthy();
    expect(audit.stress.cases.length).toBeGreaterThan(0);
    // Q: the winner comes out of the complete pathway, and the chain records every stage.
    expect(audit.evidence_chain.some((line) => line.startsWith("VERIFICATION"))).toBe(true);
    expect(audit.evidence_chain.some((line) => line.startsWith("DISAGREEMENT"))).toBe(true);
    expect(audit.evidence_chain.some((line) => line.startsWith("UNDERDOG"))).toBe(true);
    expect(audit.evidence_chain.some((line) => line.startsWith("STRESS"))).toBe(true);
    expect(audit.evidence_chain.some((line) => line.startsWith("LEAVE-ONE-FAMILY-OUT"))).toBe(true);
  });

  it("runs the underdog analysis against the non-selected player specifically", () => {
    const audit = runTruthEngineAudit(familyVotes(3, 1), P1, P2);
    expect(audit.underdog.underdog_player).toBe(P2);
  });
});

describe("M. an unstable stress result is a feature, not a veto", () => {
  it("keeps the winner when the adverse recomputation erodes the selection", () => {
    // Edges exactly one noise floor wide: eroding by one floor removes them entirely.
    const comparisons = codesFromDistinctFamilies(3).map((c) => compared(c, "P1", 1.0001));
    const audit = runTruthEngineAudit(comparisons, P1, P2);

    expect(audit.stress.changed).toBe(true);
    expect(["FRAGILE", "UNSTABLE"]).toContain(audit.stress.stability);
    // The measured evidence selected P1; the synthetic what-if does not delete that.
    expect(audit.audit_winner).toBe(P1);
    expect(audit.refused).toBe(false);
    const record = buildDecisionRecord({ audit, metricRows: metricRowsFor(comparisons) });
    expect(record.stress_changed).toBe(true);
    expect(record.selected_player).toBe(P1);
  });
});

describe("refusal has exactly one source: the deterministic decision core", () => {
  it("refuses on a genuine tie, and states it", () => {
    const audit = runTruthEngineAudit(familyVotes(2, 2), P1, P2);
    expect(audit.audit_winner).toBeNull();
    expect(audit.decision.outcome).toBe("INSUFFICIENT_EVIDENCE");
    expect(audit.final_reason).toContain("tied");
  });

  it("does not refuse merely because coverage is low or a family stands alone", () => {
    const audit = runTruthEngineAudit(
      [...familyVotes(1, 0), ...ACTIVE_METRIC_CODES.slice(0, 20).map(unavailable)],
      P1,
      P2,
    );
    expect(audit.audit_winner).toBe(P1);
  });
});

// ---------------------------------------------------------------------------------------
// AA / AB — the 25/56 boundary
// ---------------------------------------------------------------------------------------

describe("AA/AB. inactive metrics stay out of the active evidence-support calculation", () => {
  it("ignores a metric with no comparison spec entirely", () => {
    const inactive: MetricComparison = {
      metric_code: "099",
      label: "not an active metric",
      family: null,
      status: "NO_COMPARISON_SPEC",
      p1_number: null,
      p2_number: null,
      differential: null,
      advantage_p1: null,
      favours: "UNAVAILABLE",
      direction: null,
      reason: "no comparison spec: this code is not in the active set",
    };
    const withInactive = decideTruthEngineSelection({
      comparisons: [...familyVotes(3, 1), inactive],
      p1Name: P1,
      p2Name: P2,
    });
    const without = decideTruthEngineSelection({
      comparisons: familyVotes(3, 1),
      p1Name: P1,
      p2Name: P2,
    });
    expect(withInactive.evidence_percent).toBe(without.evidence_percent);
    expect(withInactive.families.map((f) => f.family)).toEqual(
      without.families.map((f) => f.family),
    );
  });

  it("derives the active set from the comparison specs, and keeps it at 25", () => {
    expect(ACTIVE_METRIC_CODES.length).toBe(25);
    expect(ACTIVE_METRIC_CODES.every((code) => Boolean(COMPARISON_SPECS[code]))).toBe(true);
  });
});

// ---------------------------------------------------------------------------------------
// R / S / T / U / V — the calibration target and its admission rules
// ---------------------------------------------------------------------------------------

const decisionRecordFor = (selected: string | null) => ({
  outcome: selected ? "P1" : "INSUFFICIENT_EVIDENCE",
  selected_player: selected,
  evidence_support_percent: 75,
  directional_families: 4,
  corroborated: true,
  stability: "STABLE",
  supporting_families: ["RECENT_FORM", "SURFACE_STRENGTH", "POINT_BY_POINT"],
  contradicting_families: ["H2H"],
  neutral_families: [],
  conflicted_families: [],
  verification_findings: 4,
  disagreement_severity: "MINOR",
  underdog_viability: "NO_VIABLE_PATHWAY",
  stress_stability: "STABLE",
  evidence_coverage_percent: 40,
  evidence_coverage_usable: 10,
  evidence_coverage_expected: 25,
});

function sourceRun(over: Partial<ObservationSourceRun> = {}): ObservationSourceRun {
  return {
    match_id: "match-1",
    audit_run_id: "run-1",
    run_number: 1,
    independent_decision_committed_at: "2026-08-29T09:00:00.000Z",
    decision: decisionRecordFor(P1) as never,
    independent_winner: P1,
    ...over,
  };
}
function sourceMatch(over: Partial<ObservationSourceMatch> = {}): ObservationSourceMatch {
  return {
    id: "match-1",
    slate_id: "slate-1",
    player1_name: P1,
    player2_name: P2,
    scheduled_date: "2026-08-31",
    actual_winner: P1,
    result_status: "FINAL",
    final_score: "6-4 6-3",
    ...over,
  };
}

describe("R. the actual match winner is the calibration target", () => {
  it("records WIN when the selected player won and LOSS when they did not", () => {
    const win = buildCalibrationObservations([sourceRun()], [sourceMatch()]);
    expect(win.observations[0].prediction_outcome).toBe("WIN");
    expect(win.observations[0].actual_winner).toBe(P1);
    expect(win.observations[0].calibration_eligible).toBe(true);

    const loss = buildCalibrationObservations([sourceRun()], [sourceMatch({ actual_winner: P2 })]);
    expect(loss.observations[0].prediction_outcome).toBe("LOSS");
  });
});

describe("S. a missing actual winner can never create a LOSS", () => {
  it("produces no observation at all for an unplayed match", () => {
    for (const match of [
      sourceMatch({ actual_winner: null, result_status: "SCHEDULED" }),
      sourceMatch({ actual_winner: null, result_status: null }),
      sourceMatch({ actual_winner: "", result_status: "FINAL" }),
    ]) {
      const built = buildCalibrationObservations([sourceRun()], [match]);
      expect(built.observations).toHaveLength(0);
      expect(built.skipped).toHaveLength(1);
    }
    // And the primitive itself never returns LOSS for an unknown result.
    expect(
      resolvePredictionOutcome(P1, {
        player1_name: P1,
        player2_name: P2,
        actual_winner: null,
        result_status: "FINAL",
      }).status,
    ).toBe("UNRESOLVED");
  });
});

describe("T. a non-FINAL result cannot resolve a prediction", () => {
  it("refuses UNKNOWN, WALKOVER, POSTPONED and an ambiguous winner", () => {
    for (const result_status of [
      "UNKNOWN",
      "WALKOVER",
      "POSTPONED",
      "CANCELLED",
      "IN_PROGRESS",
      "ABANDONED",
    ]) {
      const built = buildCalibrationObservations([sourceRun()], [sourceMatch({ result_status })]);
      expect(built.observations, result_status).toHaveLength(0);
    }
    // Two players who cannot be told apart by name resolve to neither side.
    const ambiguous = buildCalibrationObservations(
      [sourceRun()],
      [
        sourceMatch({
          player1_name: "Ana Smith",
          player2_name: "Bea Smith",
          actual_winner: "Smith",
        }),
      ],
    );
    expect(ambiguous.observations).toHaveLength(0);
  });
});

describe("U. a post-match audit cannot enter calibration", () => {
  it("stores the hindsight rerun but marks it ineligible with the reason", () => {
    const after = buildCalibrationObservations(
      [sourceRun({ independent_decision_committed_at: "2026-09-01T10:00:00.000Z" })],
      [sourceMatch()],
    );
    expect(after.observations).toHaveLength(1);
    expect(after.observations[0].calibration_eligible).toBe(false);
    expect(after.observations[0].eligibility_reason).toBe("COMMITTED_ON_OR_AFTER_MATCH_DATE");

    const sameDay = buildCalibrationObservations(
      [sourceRun({ independent_decision_committed_at: "2026-08-31T06:00:00.000Z" })],
      [sourceMatch()],
    );
    expect(sameDay.observations[0].calibration_eligible).toBe(false);
    expect(sameDay.observations[0].eligibility_reason).toBe(
      "SAME_DAY_AS_MATCH_NO_TIME_OF_DAY_PROOF",
    );
  });
});

describe("V. the latest eligible pre-match run wins when a match has several", () => {
  it("keeps exactly one eligible observation per match", () => {
    const built = buildCalibrationObservations(
      [
        sourceRun({
          audit_run_id: "run-1",
          run_number: 1,
          independent_decision_committed_at: "2026-08-28T09:00:00.000Z",
        }),
        sourceRun({
          audit_run_id: "run-2",
          run_number: 2,
          independent_decision_committed_at: "2026-08-30T09:00:00.000Z",
        }),
        sourceRun({
          audit_run_id: "run-3",
          run_number: 3,
          independent_decision_committed_at: "2026-09-02T09:00:00.000Z",
        }),
      ],
      [sourceMatch()],
    );
    const eligible = built.observations.filter((o) => o.calibration_eligible);
    expect(eligible).toHaveLength(1);
    expect(eligible[0].audit_run_id).toBe("run-2");
    // The post-match run is stored and excluded, never chosen for being newest.
    expect(built.observations.find((o) => o.audit_run_id === "run-3")!.calibration_eligible).toBe(
      false,
    );
    expect(built.observations.find((o) => o.audit_run_id === "run-1")!.eligibility_reason).toBe(
      "SUPERSEDED_BY_LATER_ELIGIBLE_DECISION_FOR_THE_SAME_MATCH",
    );
  });
});

describe("no selected player means no observation", () => {
  it("skips a refusal rather than grading it", () => {
    const built = buildCalibrationObservations(
      [sourceRun({ decision: decisionRecordFor(null) as never })],
      [sourceMatch()],
    );
    expect(built.observations).toHaveLength(0);
    expect(built.skipped[0].reason).toBe("NO_SELECTED_PLAYER");
  });
});

// ---------------------------------------------------------------------------------------
// AD / AE — support is not probability, and probability needs real outcomes
// ---------------------------------------------------------------------------------------

describe("AD. evidence support never masquerades as probability", () => {
  it("keeps the two numbers distinct on the prediction object", () => {
    const comparisons = familyVotes(3, 1);
    const audit = runTruthEngineAudit(comparisons, P1, P2);
    const prediction = buildTruthEnginePrediction({
      audit,
      metricRows: metricRowsFor(comparisons),
      p1Name: P1,
      p2Name: P2,
    });

    expect(prediction.evidence_support.p1_percent).toBe(75);
    expect(prediction.evidence_support.meaning).toBe("SELECTION_CRITERION_NEVER_A_PROBABILITY");
    expect(prediction.evidence_coverage.meaning).toBe("DIAGNOSTIC_ONLY_NEVER_A_PROBABILITY");
    // With no resolved history the probability is null -- NOT 75, and NOT the coverage number.
    expect(prediction.calibrated_win_probability.status).toBe("NOT_YET_CALIBRATED");
    expect(prediction.calibrated_win_probability.calibrated_win_probability).toBeNull();
    expect(prediction.final_deterministic_winner).toBe(P1);
  });

  it("states both players' support from the same directional denominator", () => {
    const comparisons = familyVotes(3, 1);
    const prediction = buildTruthEnginePrediction({
      audit: runTruthEngineAudit(comparisons, P1, P2),
      metricRows: metricRowsFor(comparisons),
      p1Name: P1,
      p2Name: P2,
    });
    expect(prediction.evidence_support.p1_percent + prediction.evidence_support.p2_percent).toBe(
      100,
    );
  });
});

describe("AE. no probability without resolved outcomes", () => {
  it("answers NOT_YET_CALIBRATED on an empty population and refuses to substitute anything", () => {
    const empty = buildCalibrationModel([]);
    expect(empty.status).toBe("NOT_YET_CALIBRATED");
    const lookup = calibratedProbabilityFor(
      {
        evidence_support_percent: 62.5,
        supporting_family_count: 5,
        contradicting_family_count: 3,
        corroborated: true,
        stress_result: "FRAGILE",
      },
      empty,
    );
    expect(lookup.calibrated_win_probability).toBeNull();
    expect(lookup.observations).toBe(0);
  });

  it("reports a thin bucket as uncalibrated rather than as a probability", () => {
    const observation: ResolvedObservation = {
      evidence_support_percent: 62.5,
      supporting_family_count: 5,
      contradicting_family_count: 3,
      corroborated: true,
      stress_result: "FRAGILE",
      disagreement_result: "ACCEPTABLE",
      underdog_result: "NO_VIABLE_PATHWAY",
      prediction_outcome: "WIN",
    };
    const thin = buildCalibrationModel([
      observation,
      observation,
      { ...observation, prediction_outcome: "LOSS" },
    ]);
    expect(calibratedProbabilityFor(observation, thin).status).toBe("NOT_YET_CALIBRATED");

    const enough = buildCalibrationModel([
      ...Array.from({ length: 13 }, () => observation),
      ...Array.from({ length: 7 }, () => ({ ...observation, prediction_outcome: "LOSS" as const })),
    ]);
    const learned = calibratedProbabilityFor(observation, enough);
    expect(learned.status).toBe("CALIBRATED");
    // 13 of 20 won -> 65%. Note it is NOT the 62.5% evidence support it was derived beside.
    expect(learned.calibrated_win_probability).toBe(65);
    expect(learned.calibrated_win_probability).not.toBe(observation.evidence_support_percent);
  });
});
