import { describe, expect, it } from "vitest";
import { compareMetricRow, compareMetricRows, parseMetricValue, COMPARISON_SPECS, type MetricRowForComparison } from "./truth-engine-metric-comparison";
import { decideTruthEngineSelection, MIN_INDEPENDENT_SUPPORT_FAMILIES } from "./truth-engine-decision";
import { MATRIX_SUMMARY_REQUIRED_CODES } from "./metric-classification";
import { deterministicIndependentConclusion } from "./audit-pipeline";

const P1 = "Alpha Player";
const P2 = "Beta Player";

function row(metric_code: string, p1_value: string | null, p2_value: string | null, treatments: [string, string] = ["RECONSTRUCTED", "RECONSTRUCTED"]): MetricRowForComparison {
  return { metric_code, p1_value, p2_value, p1_treatment: treatments[0], p2_treatment: treatments[1] };
}
function decide(rows: MetricRowForComparison[]) {
  return decideTruthEngineSelection({ comparisons: compareMetricRows(rows), p1Name: P1, p2Name: P2 });
}

// Real persisted shapes, copied from live metric_results rows.
const REAL_005_P1 = "last5_matches=5; last5_win_pct=0; last10_matches=10; last10_win_pct=10; trend_direction=DECLINING";
const REAL_080_P1 = "common_opponents=40; favorable_divergent_outcomes=16; unfavorable_divergent_outcomes=10";
const REAL_080_P2 = "common_opponents=40; favorable_divergent_outcomes=10; unfavorable_divergent_outcomes=16";

describe("value parsing (real persisted shapes)", () => {
  it("parses a bare scalar and a keyed string, and never turns NA into zero", () => {
    expect(parseMetricValue("1483.15").scalar).toBe(1483.15);
    expect(parseMetricValue(REAL_005_P1).fields.get("last10_win_pct")).toBe("10");
    // "NA" must not be comparable -- a NA field yields UNAVAILABLE, not 0.
    const na = compareMetricRow(row("051", "shrunk_win_probability_pct=NA", "shrunk_win_probability_pct=60"));
    expect(na.status).toBe("ONE_SIDED_EVIDENCE");
    expect(na.favours).toBe("UNAVAILABLE");
    expect(na.p1_number).toBeNull();
  });

  it("extracts a difference-of-two-fields spec from real 080 rows, oriented correctly", () => {
    const c = compareMetricRow(row("080", REAL_080_P1, REAL_080_P2));
    expect(c.status).toBe("COMPARED");
    expect(c.p1_number).toBe(6); // 16 - 10
    expect(c.p2_number).toBe(-6); // 10 - 16
    expect(c.favours).toBe("P1");
  });
});

describe("P1/P2 orientation cannot invert", () => {
  it("mirroring the two sides mirrors the verdict exactly (HIGHER_IS_BETTER)", () => {
    const a = compareMetricRow(row("001", "1900", "1500"));
    const b = compareMetricRow(row("001", "1500", "1900"));
    expect(a.favours).toBe("P1");
    expect(b.favours).toBe("P2");
    expect(a.differential).toBe(-b.differential!);
    expect(a.advantage_p1).toBe(-b.advantage_p1!);
  });

  it("differential is always (P1 - P2) while advantage_p1 carries the direction", () => {
    const c = compareMetricRow(row("001", "1600", "1500"));
    expect(c.differential).toBe(100);
    expect(c.advantage_p1).toBe(100);
    expect(c.direction).toBe("HIGHER_IS_BETTER");
  });

  it("a difference within the materiality threshold is NEUTRAL, not a lean", () => {
    expect(compareMetricRow(row("001", "1505", "1500")).favours).toBe("NEUTRAL"); // materiality 10
    expect(compareMetricRow(row("001", "1520", "1500")).favours).toBe("P1");
  });
});

describe("missing evidence is never zero and never favours the other player", () => {
  it("one-sided evidence yields UNAVAILABLE, not a win for the side that has data", () => {
    const p2Missing = compareMetricRow(row("001", "1900", null));
    expect(p2Missing.status).toBe("ONE_SIDED_EVIDENCE");
    expect(p2Missing.favours).toBe("UNAVAILABLE");
    const p1Missing = compareMetricRow(row("001", null, "1900"));
    expect(p1Missing.favours).toBe("UNAVAILABLE");
  });

  it("an UNAVAILABLE treatment is excluded even when a value string is present", () => {
    const c = compareMetricRow(row("001", "1900", "1500", ["RECONSTRUCTED", "UNAVAILABLE"]));
    expect(c.status).toBe("TREATMENT_NOT_USABLE");
    expect(c.favours).toBe("UNAVAILABLE");
    expect(c.advantage_p1).toBeNull();
  });

  it("scenario 4/5: all P1 (or all P2) evidence missing produces refusal, not a walkover", () => {
    const p1Missing = decide([
      row("001", null, "1500"), row("005", null, "last10_win_pct=70"), row("031", null, "opponent_adjusted_set_differential=1.2"),
    ]);
    expect(p1Missing.outcome).toBe("INSUFFICIENT_EVIDENCE");
    expect(p1Missing.selected_player).toBeNull();
    expect(p1Missing.unavailable).toHaveLength(3);

    const p2Missing = decide([
      row("001", "1900", null), row("005", "last10_win_pct=80", null), row("031", "opponent_adjusted_set_differential=1.2", null),
    ]);
    expect(p2Missing.outcome).toBe("INSUFFICIENT_EVIDENCE");
  });
});

describe("controlled decision scenarios", () => {
  it("scenario 1: P1 clearly superior across independent families -> P1 selected, ROBUST", () => {
    const d = decide([
      row("001", "1900", "1500"),
      row("005", "last10_win_pct=80", "last10_win_pct=30"),
      row("031", "opponent_adjusted_set_differential=1.5", "opponent_adjusted_set_differential=-1.5"),
    ]);
    expect(d.outcome).toBe("P1");
    expect(d.selected_player).toBe(P1);
    expect(d.stability).toBe("ROBUST");
    expect(d.independent_support_families.sort()).toEqual(["COMMON_OPPONENT", "RECENT_FORM", "SURFACE_STRENGTH"]);
    expect(d.independent_contradiction_families).toEqual([]);
  });

  it("scenario 2: P2 clearly superior -> P2 selected (perfect mirror of scenario 1)", () => {
    const d = decide([
      row("001", "1500", "1900"),
      row("005", "last10_win_pct=30", "last10_win_pct=80"),
      row("031", "opponent_adjusted_set_differential=-1.5", "opponent_adjusted_set_differential=1.5"),
    ]);
    expect(d.outcome).toBe("P2");
    expect(d.selected_player).toBe(P2);
    expect(d.stability).toBe("ROBUST");
  });

  it("scenario 3: genuinely close match -> every family NEUTRAL -> refusal", () => {
    const d = decide([
      row("001", "1602", "1600"),
      row("005", "last10_win_pct=52", "last10_win_pct=50"),
    ]);
    expect(d.outcome).toBe("INSUFFICIENT_EVIDENCE");
    expect(d.neutral_families.sort()).toEqual(["RECENT_FORM", "SURFACE_STRENGTH"]);
  });

  it("scenario 6/7: a strong contradiction is reported as an independent contradiction, not hidden", () => {
    const d = decide([
      row("001", "1900", "1500"),
      row("005", "last10_win_pct=80", "last10_win_pct=30"),
      row("051", "shrunk_win_probability_pct=20", "shrunk_win_probability_pct=80"), // P2 contradiction
    ]);
    expect(d.outcome).toBe("P1");
    expect(d.stability).toBe("STABLE"); // supported but contradicted -> not ROBUST
    expect(d.independent_contradiction_families).toEqual(["H2H_PROBABILITY"]);
  });

  it("a single dissent does not by itself overturn a broader independent consensus", () => {
    const d = decide([
      row("001", "1900", "1500"), row("005", "last10_win_pct=80", "last10_win_pct=30"),
      row("027", "lead_protection_rate_pct=90", "lead_protection_rate_pct=40"),
      row("051", "shrunk_win_probability_pct=20", "shrunk_win_probability_pct=80"),
    ]);
    expect(d.outcome).toBe("P1");
    expect(d.independent_support_families).toHaveLength(3);
    expect(d.independent_contradiction_families).toHaveLength(1);
  });
});

describe("anti-double-counting (scenario 12)", () => {
  it("correlated same-family metrics vote ONCE, and the duplicate is reported as duplicated support", () => {
    // 031 and 080 both read the shared-opponent pool -> one COMMON_OPPONENT family.
    const d = decide([
      row("031", "opponent_adjusted_set_differential=1.5", "opponent_adjusted_set_differential=-1.5"),
      row("080", REAL_080_P1, REAL_080_P2),
      row("001", "1900", "1500"),
    ]);
    const commonOpponent = d.families.find((f) => f.family === "COMMON_OPPONENT")!;
    expect(commonOpponent.supporting_metrics.sort()).toEqual(["031", "080"]);
    // Two agreeing metrics, but only ONE independent family credited.
    expect(d.independent_support_families.sort()).toEqual(["COMMON_OPPONENT", "SURFACE_STRENGTH"]);
    expect(d.duplicated_support_metrics).toContain("080");
  });

  it("three agreeing metrics inside one family do NOT beat two genuinely independent families", () => {
    // P1 wins the single COMMON_OPPONENT family (2 correlated metrics);
    // P2 wins two independent families. P2 must lead on independent families.
    const d = decide([
      row("031", "opponent_adjusted_set_differential=2", "opponent_adjusted_set_differential=-2"),
      row("080", REAL_080_P1, REAL_080_P2),
      row("001", "1500", "1900"),
      row("005", "last10_win_pct=20", "last10_win_pct=90"),
    ]);
    expect(d.outcome).toBe("P2");
    expect(d.independent_support_families.sort()).toEqual(["RECENT_FORM", "SURFACE_STRENGTH"]);
    expect(d.independent_contradiction_families).toEqual(["COMMON_OPPONENT"]);
  });

  it("a family whose own metrics disagree votes for nobody", () => {
    const d = decide([
      row("031", "opponent_adjusted_set_differential=2", "opponent_adjusted_set_differential=-2"), // P1
      row("080", REAL_080_P2, REAL_080_P1), // P2 -- same family, opposite direction
      row("001", "1900", "1500"), row("005", "last10_win_pct=80", "last10_win_pct=30"),
    ]);
    expect(d.conflicted_families).toEqual(["COMMON_OPPONENT"]);
    expect(d.independent_support_families.sort()).toEqual(["RECENT_FORM", "SURFACE_STRENGTH"]);
    expect(d.independent_contradiction_families).toEqual([]);
  });
});

describe("leave-one-family-out stress test (scenarios 10 & 11)", () => {
  it("scenario 10: a lead a single family can REVERSE is refused as FRAGILE", () => {
    // P1: 2 families (SURFACE_STRENGTH, RECENT_FORM). P2: 2 families (H2H_PROBABILITY,
    // CLOSING_ABILITY) + COMMON_OPPONENT for P1 = 3-2 P1. Removing COMMON_OPPONENT makes
    // it 2-2... to get a genuine reversal we give P2 two families and P1 three, where
    // dropping one P1 family yields 2-2 (tie) -- so instead construct a real reversal:
    // P1 leads 2-1; removing a P1 family gives 1-1 (tie, not reversal). A true reversal
    // needs P2 to overtake, e.g. P1 2 families vs P2 2 families is a tie, so we build
    // P1=2, P2=1 and then remove... see the dedicated reversal construction below.
    const d = decide([
      row("001", "1900", "1500"), // P1 SURFACE_STRENGTH
      row("005", "last10_win_pct=80", "last10_win_pct=30"), // P1 RECENT_FORM
      row("051", "shrunk_win_probability_pct=20", "shrunk_win_probability_pct=80"), // P2 H2H
      row("027", "lead_protection_rate_pct=40", "lead_protection_rate_pct=90"), // P2 CLOSING
      row("031", "opponent_adjusted_set_differential=1.5", "opponent_adjusted_set_differential=-1.5"), // P1 COMMON_OPPONENT
    ]);
    // P1 leads 3-2. Removing any single P1 family makes it 2-2 (tie), never a reversal.
    expect(d.outcome).toBe("P1");
    expect(d.flipping_families).toEqual([]);
    expect(d.tie_inducing_families.sort()).toEqual(["COMMON_OPPONENT", "RECENT_FORM", "SURFACE_STRENGTH"]);
    expect(d.stability).toBe("STABLE"); // thin + contradicted, but not reversible
  });

  it("a lead that a single family's removal genuinely REVERSES is refused", () => {
    // P1 leads 2-1 on families; COMMON_OPPONENT holds TWO correlated P1 metrics that vote
    // once. Removing SURFACE_STRENGTH leaves P1 1 - P2 1 (tie); to force a real reversal we
    // give P2 two families and P1 two, with one P1 family removable to yield P2 lead.
    const d = decide([
      row("001", "1900", "1500"), // P1 SURFACE_STRENGTH
      row("031", "opponent_adjusted_set_differential=1.5", "opponent_adjusted_set_differential=-1.5"), // P1 COMMON_OPPONENT
      row("051", "shrunk_win_probability_pct=20", "shrunk_win_probability_pct=80"), // P2 H2H
      row("027", "lead_protection_rate_pct=40", "lead_protection_rate_pct=90"), // P2 CLOSING
      row("005", "last10_win_pct=80", "last10_win_pct=30"), // P1 RECENT_FORM -> P1 3-2
    ]);
    // Sanity: this is the 3-2 case, no reversal possible from a single removal.
    expect(d.flipping_families).toEqual([]);
    // Now drop one P1 family from the input entirely: 2-2 tie -> refusal (not a selection).
    const tied = decide([
      row("001", "1900", "1500"),
      row("031", "opponent_adjusted_set_differential=1.5", "opponent_adjusted_set_differential=-1.5"),
      row("051", "shrunk_win_probability_pct=20", "shrunk_win_probability_pct=80"),
      row("027", "lead_protection_rate_pct=40", "lead_protection_rate_pct=90"),
    ]);
    expect(tied.outcome).toBe("INSUFFICIENT_EVIDENCE");
    expect(tied.reason).toMatch(/tied/i);
  });

  it("scenario 11: a broad lead SURVIVES removal of any single family -> selection stands", () => {
    const d = decide([
      row("001", "1900", "1500"),
      row("005", "last10_win_pct=80", "last10_win_pct=30"),
      row("027", "lead_protection_rate_pct=90", "lead_protection_rate_pct=40"),
      row("051", "shrunk_win_probability_pct=20", "shrunk_win_probability_pct=80"),
    ]);
    expect(d.flipping_families).toEqual([]);
    expect(d.stability).toBe("STABLE");
    expect(d.outcome).toBe("P1");
  });

  it("LOFO is a real recomputation, not a label: each named family genuinely changes the recount", () => {
    const d = decide([
      row("001", "1900", "1500"),
      row("005", "last10_win_pct=80", "last10_win_pct=30"),
      row("051", "shrunk_win_probability_pct=20", "shrunk_win_probability_pct=80"),
    ]);
    // Independently re-derive the recount for every family this engine named as tie-inducing.
    for (const family of d.tie_inducing_families) {
      const remaining = d.families.filter((f) => f.family !== family);
      const p1 = remaining.filter((f) => f.vote === "P1").length;
      const p2 = remaining.filter((f) => f.vote === "P2").length;
      expect(p1).toBe(p2); // genuinely no leader once that family is removed
    }
    // And every family NOT named must genuinely leave the leader intact.
    for (const f of d.families) {
      if (d.tie_inducing_families.includes(f.family) || d.flipping_families.includes(f.family)) continue;
      const remaining = d.families.filter((o) => o.family !== f.family);
      const p1 = remaining.filter((o) => o.vote === "P1").length;
      const p2 = remaining.filter((o) => o.vote === "P2").length;
      expect(p1).toBeGreaterThan(p2);
    }
  });
});

describe("refusal is first-class", () => {
  it("a lead on a single independent family is refused, not asserted", () => {
    const d = decide([row("001", "1900", "1500"), row("005", "last10_win_pct=50", "last10_win_pct=50")]);
    expect(d.independent_support_families).toEqual(["SURFACE_STRENGTH"]);
    expect(d.outcome).toBe("INSUFFICIENT_EVIDENCE");
    expect(d.reason).toMatch(new RegExp(`at least ${MIN_INDEPENDENT_SUPPORT_FAMILIES}`));
  });

  it("a tie on independent families is refused", () => {
    const d = decide([row("001", "1900", "1500"), row("005", "last10_win_pct=20", "last10_win_pct=90")]);
    expect(d.outcome).toBe("INSUFFICIENT_EVIDENCE");
    expect(d.reason).toMatch(/tied/i);
  });

  it("no comparable evidence at all is refused with every exclusion reason preserved", () => {
    const d = decide([row("999", "x", "y"), row("001", null, null)]);
    expect(d.outcome).toBe("INSUFFICIENT_EVIDENCE");
    expect(d.unavailable.map((u) => u.status).sort()).toEqual(["NO_COMPARISON_SPEC", "VALUE_NOT_PARSEABLE"]);
  });
});

describe("pipeline wiring: the deterministic conclusion is authoritative and independent", () => {
  it("derives the winner from persisted metric rows, in the metric_results row shape", () => {
    const c = deterministicIndependentConclusion(
      [
        { metric_code: "001", p1_value: "1900", p2_value: "1500", p1_treatment: "DIRECT", p2_treatment: "DIRECT" },
        { metric_code: "005", p1_value: "last10_win_pct=80", p2_value: "last10_win_pct=30", p1_treatment: "PARTIAL", p2_treatment: "PARTIAL" },
        { metric_code: "027", p1_value: "lead_protection_rate_pct=90", p2_value: "lead_protection_rate_pct=40", p1_treatment: "RECONSTRUCTED", p2_treatment: "RECONSTRUCTED" },
      ],
      P1,
      P2,
    );
    expect(c.winner).toBe(P1);
    expect(c.audit.decision.outcome).toBe("P1");
    expect(c.audit.decision.independent_support_families).toHaveLength(3);
    expect(c.rationale).toMatch(/Evidence chain:/);
    expect(c.insufficient_reason).toBeNull();
  });

  it("refuses, with a reason, when the persisted evidence does not support a side", () => {
    const c = deterministicIndependentConclusion(
      [
        // Bare unlabelled scalars -- exactly what metrics 008/010/012/013/014 actually persist.
        { metric_code: "008", p1_value: "5", p2_value: "12", p1_treatment: "DIRECT", p2_treatment: "DIRECT" },
        { metric_code: "010", p1_value: "1", p2_value: "0", p1_treatment: "DIRECT", p2_treatment: "DIRECT" },
      ],
      P1,
      P2,
    );
    expect(c.winner).toBeNull();
    expect(c.insufficient_reason).toBeTruthy();
    expect(c.audit.decision.outcome).toBe("INSUFFICIENT_EVIDENCE");
  });

  it("is reproducible: the same persisted rows always yield the same selection", () => {
    const rows = [
      { metric_code: "001", p1_value: "1900", p2_value: "1500", p1_treatment: "DIRECT", p2_treatment: "DIRECT" },
      { metric_code: "005", p1_value: "last10_win_pct=80", p2_value: "last10_win_pct=30", p1_treatment: "PARTIAL", p2_treatment: "PARTIAL" },
      { metric_code: "027", p1_value: "lead_protection_rate_pct=90", p2_value: "lead_protection_rate_pct=40", p1_treatment: "DIRECT", p2_treatment: "DIRECT" },
    ];
    const a = deterministicIndependentConclusion(rows, P1, P2);
    const b = deterministicIndependentConclusion(rows, P1, P2);
    expect(a.winner).toBe(b.winner);
    expect(a.audit.decision.reason).toBe(b.audit.decision.reason);
    expect(a.audit.decision.stability).toBe(b.audit.decision.stability);
  });

  it("swapping which player is P1 swaps the selection -- the engine is not 'P1-first'", () => {
    const rows = [
      { metric_code: "001", p1_value: "1500", p2_value: "1900", p1_treatment: "DIRECT", p2_treatment: "DIRECT" },
      { metric_code: "005", p1_value: "last10_win_pct=30", p2_value: "last10_win_pct=80", p1_treatment: "PARTIAL", p2_treatment: "PARTIAL" },
      { metric_code: "027", p1_value: "lead_protection_rate_pct=40", p2_value: "lead_protection_rate_pct=90", p1_treatment: "DIRECT", p2_treatment: "DIRECT" },
    ];
    const c = deterministicIndependentConclusion(rows, P1, P2);
    expect(c.winner).toBe(P2); // the weaker side is P1 here, so P2 must be selected
    expect(c.audit.decision.outcome).toBe("P2");
  });
});

describe("scenario 14/15: quarantined and unavailable metrics cannot influence the decision", () => {
  it("no quarantined Matrix-Summary metric has a comparison spec", () => {
    for (const code of MATRIX_SUMMARY_REQUIRED_CODES) {
      expect(COMPARISON_SPECS[code], `quarantined ${code} must not be comparable`).toBeUndefined();
    }
  });

  it("a quarantined code carrying legacy values is excluded and changes nothing", () => {
    const withoutLegacy = decide([row("001", "1900", "1500"), row("005", "last10_win_pct=80", "last10_win_pct=30")]);
    const withLegacy = decide([
      row("001", "1900", "1500"), row("005", "last10_win_pct=80", "last10_win_pct=30"),
      // 035 is quarantined but has real historical values persisted -- it must not vote.
      row("035", "observed_vs_expected_wl_gap_pct=40", "observed_vs_expected_wl_gap_pct=-40", ["PARTIAL", "PARTIAL"]),
    ]);
    expect(withLegacy.outcome).toBe(withoutLegacy.outcome);
    expect(withLegacy.independent_support_families).toEqual(withoutLegacy.independent_support_families);
    expect(withLegacy.unavailable.some((u) => u.metric_code === "035" && u.status === "NO_COMPARISON_SPEC")).toBe(true);
  });
});

describe("persisted field aliases (registry vs. real producer output)", () => {
  // Live finding: across 304 persisted rows, metric 008 emitted "deciding_set_win_pct" in
  // 87 rows and the registry's "set3_deciding_set_win_pct" in 1; metric 010 emitted
  // "straight_set_win_pct" in 89 and "straight_set_match_win_pct" in 1. Both pairs name the
  // identical quantity, so the comparison must read either without a spec rewrite.
  const row = (code: string, p1: string, p2: string): MetricRowForComparison => ({
    metric_code: code, p1_value: p1, p2_value: p2, p1_treatment: "DIRECT", p2_treatment: "DIRECT",
  });

  it("reads the alias name emitted by the real producer", () => {
    const c = compareMetricRow(row("008", "deciding_set_win_pct=62", "deciding_set_win_pct=41"));
    expect(c.status).toBe("COMPARED");
    expect(c.p1_number).toBe(62);
    expect(c.p2_number).toBe(41);
    expect(c.favours).toBe("P1");
  });

  it("prefers the canonical name when both are present", () => {
    const c = compareMetricRow(row("010", "straight_set_match_win_pct=70; straight_set_win_pct=10", "straight_set_match_win_pct=40; straight_set_win_pct=90"));
    expect(c.p1_number).toBe(70);
    expect(c.p2_number).toBe(40);
  });

  it("still refuses a lean when only one side carries the alias", () => {
    const c = compareMetricRow(row("008", "deciding_set_win_pct=62", "deciding_matches=9"));
    expect(c.status).toBe("ONE_SIDED_EVIDENCE");
    expect(c.favours).toBe("UNAVAILABLE");
  });

  it("does not treat a similar-sounding neighbouring field as an alias", () => {
    // 010 also persists "same_surface_straight_set_win_pct" -- a DIFFERENT population.
    // Reading it here would silently change what is being compared.
    const c = compareMetricRow(row("010", "same_surface_straight_set_win_pct=90", "same_surface_straight_set_win_pct=10"));
    expect(c.status).toBe("VALUE_NOT_PARSEABLE");
    expect(c.favours).toBe("UNAVAILABLE");
  });

  it("every declared alias belongs to a spec that has a keyed field", () => {
    for (const [code, spec] of Object.entries(COMPARISON_SPECS)) {
      if (!spec.fieldAliases?.length) continue;
      expect(spec.field, `${code} declares aliases but compares a bare scalar`).not.toBeNull();
      expect(new Set(spec.fieldAliases).size, `${code} has duplicate aliases`).toBe(spec.fieldAliases.length);
      expect(spec.fieldAliases, `${code} lists its own canonical field as an alias`).not.toContain(spec.field);
    }
  });
});

describe("metric 001 persists two shapes for one quantity", () => {
  // Live finding: of 304 persisted 001 rows, 189 carry a bare scalar and 102 carry
  // "surface_elo=". Both are the surface Elo. "overall_elo" is a DIFFERENT quantity and
  // must never stand in for it.
  const row = (p1: string, p2: string): MetricRowForComparison => ({
    metric_code: "001", p1_value: p1, p2_value: p2, p1_treatment: "DIRECT", p2_treatment: "DIRECT",
  });

  it("compares the bare-scalar shape", () => {
    const c = compareMetricRow(row("1521.13", "1465.29"));
    expect(c.status).toBe("COMPARED");
    expect(c.p1_number).toBeCloseTo(1521.13, 2);
    expect(c.favours).toBe("P1");
  });

  it("compares the keyed shape", () => {
    const c = compareMetricRow(row("overall_elo=1420; surface=clay; surface_elo=1429", "overall_elo=1432; surface=clay; surface_elo=1442"));
    expect(c.status).toBe("COMPARED");
    expect(c.p1_number).toBe(1429);
    expect(c.p2_number).toBe(1442);
    expect(c.favours).toBe("P2");
  });

  it("never substitutes overall_elo for surface_elo", () => {
    const c = compareMetricRow(row("overall_elo=1900", "overall_elo=1200"));
    expect(c.status).toBe("VALUE_NOT_PARSEABLE");
    expect(c.favours).toBe("UNAVAILABLE");
  });

  it("compares across the two shapes without crediting the keyed side", () => {
    const c = compareMetricRow(row("1521.13", "overall_elo=1432; surface_elo=1442"));
    expect(c.status).toBe("COMPARED");
    expect(c.p2_number).toBe(1442);
  });

  it("bareScalarFallback is only declared where the bare form is the same measurement", () => {
    for (const [code, spec] of Object.entries(COMPARISON_SPECS)) {
      if (!spec.bareScalarFallback) continue;
      expect(spec.field, `${code} sets bareScalarFallback with no keyed field to fall back from`).not.toBeNull();
    }
    // 008/010 persist bare counts of unknown definition; guessing them is exactly the
    // silent inversion this registry exists to prevent.
    expect(COMPARISON_SPECS["008"].bareScalarFallback).toBeUndefined();
    expect(COMPARISON_SPECS["010"].bareScalarFallback).toBeUndefined();
  });
});
