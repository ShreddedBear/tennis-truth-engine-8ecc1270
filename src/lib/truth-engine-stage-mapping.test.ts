import { describe, expect, it } from "vitest";
import { compareMetricRows, type MetricRowForComparison } from "./truth-engine-metric-comparison";
import { runTruthEngineAudit } from "./truth-engine-audit";
import { underdogRowPatch, stressRowPatch, STRESS_NOT_RUN } from "./truth-engine-stage-mapping";

const P1 = "Alpha Player";
const P2 = "Beta Player";
const NOW = "2026-09-11T00:00:00.000Z";

function row(metric_code: string, p1_value: string | null, p2_value: string | null): MetricRowForComparison {
  return { metric_code, p1_value, p2_value, p1_treatment: "RECONSTRUCTED", p2_treatment: "RECONSTRUCTED" };
}
function auditOf(rows: MetricRowForComparison[]) {
  return runTruthEngineAudit(compareMetricRows(rows), P1, P2);
}

// P1 leads SURFACE_STRENGTH and RECENT_FORM; P2 leads H2H_PROBABILITY well beyond its floor.
const MIXED = [
  row("001", "1900", "1500"),
  row("005", "last10_win_pct=80", "last10_win_pct=30"),
  row("051", "shrunk_win_probability_pct=10", "shrunk_win_probability_pct=95"),
];

describe("underdogRowPatch — rows complete for BOTH players", () => {
  // Production stores underdog_results.player_side as a player NAME, and the previous
  // implementation compared that name against the designated underdog's name to decide
  // whether to evaluate the row at all. Every row belonging to the other side was parked
  // UNAVAILABLE/UNRESOLVED forever -- and when the engine refused, every row of both sides
  // was. Across the 32 current refusals that was 0 of 960 rows reaching COMPLETE.
  it("completes a mapped pathway row for the SELECTED side, not only the underdog", () => {
    const audit = auditOf(MIXED);
    expect(audit.audit_winner_side).toBe("P1");
    const patch = underdogRowPatch("SURFACE_TRANSITION", P1, audit, P1, P2, NOW);
    expect(patch.evaluated).toBe(true);
    expect(patch.patch["status"]).toBe("COMPLETE");
    expect(String(patch.patch["evidence"])).toContain("P1");
    expect(String(patch.patch["evidence"])).toContain("selected side");
  });

  it("completes a mapped pathway row for the designated underdog", () => {
    const audit = auditOf(MIXED);
    const patch = underdogRowPatch("STYLE_MISMATCH", P2, audit, P1, P2, NOW);
    expect(patch.evaluated).toBe(true);
    expect(patch.patch["status"]).toBe("COMPLETE");
    expect(patch.patch["classification"]).toBe("STRONG");
    expect(String(patch.patch["evidence"])).toContain("designated underdog");
  });

  it("completes rows for both players even when the engine refused and nobody is designated", () => {
    const audit = auditOf([row("001", "1900", "1500"), row("051", "shrunk_win_probability_pct=20", "shrunk_win_probability_pct=95")]);
    expect(audit.audit_winner_side).toBeNull();
    for (const [code, player] of [["SURFACE_TRANSITION", P1], ["STYLE_MISMATCH", P2]] as const) {
      const patch = underdogRowPatch(code, player, audit, P1, P2, NOW);
      expect(patch.evaluated).toBe(true);
      expect(patch.patch["status"]).toBe("COMPLETE");
    }
  });

  it("a mapped pathway with no qualifying edge is an evaluated WEAK result, not a gap", () => {
    const audit = auditOf(MIXED);
    // P2 holds no CLOSING_ABILITY edge; that is a real finding about P2, not missing data.
    const patch = underdogRowPatch("FAV_COLLAPSE", P2, audit, P1, P2, NOW);
    expect(patch.evaluated).toBe(true);
    expect(patch.patch["status"]).toBe("COMPLETE");
    expect(patch.patch["classification"]).toBe("WEAK");
  });

  it("resolves identity by canonical side, accepting 'P1'/'P2' as well as a name", () => {
    const audit = auditOf(MIXED);
    const byName = underdogRowPatch("SURFACE_TRANSITION", P1, audit, P1, P2, NOW);
    const bySide = underdogRowPatch("SURFACE_TRANSITION", "P1", audit, P1, P2, NOW);
    expect(bySide.patch["status"]).toBe(byName.patch["status"]);
    expect(bySide.patch["classification"]).toBe(byName.patch["classification"]);
  });

  it("reports an unbindable player as a real data problem rather than 'not the underdog'", () => {
    const audit = auditOf(MIXED);
    const patch = underdogRowPatch("SURFACE_TRANSITION", "Someone Else Entirely", audit, P1, P2, NOW);
    expect(patch.evaluated).toBe(false);
    expect(patch.patch["status"]).toBe("UNAVAILABLE");
    expect(String(patch.patch["evidence"])).toContain("does not resolve");
  });

  it("a pathway no active metric can establish stays honestly UNAVAILABLE", () => {
    const audit = auditOf(MIXED);
    const patch = underdogRowPatch("SECOND_SERVE", P2, audit, P1, P2, NOW);
    expect(patch.patch["status"]).toBe("UNAVAILABLE");
    expect(patch.patch["unavailable_reason"]).toBe("MISSING_REQUIRED_INPUT");
  });
});

describe("underdogRowPatch — side binding is unambiguous or it is refused", () => {
  const audit = auditOf(MIXED);

  it("binds each real name to its own side, and never to the other", () => {
    const p1Row = underdogRowPatch("SURFACE_TRANSITION", P1, audit, P1, P2, NOW);
    const p2Row = underdogRowPatch("STYLE_MISMATCH", P2, audit, P1, P2, NOW);
    expect(String(p1Row.patch["evidence"])).toContain(`P1 ${P1}`);
    expect(String(p2Row.patch["evidence"])).toContain(`P2 ${P2}`);
  });

  it("refuses to guess when a name binds to both sides", () => {
    // playerNamesMatch is lenient and matches on shared tokens, so a name that matches both
    // players must resolve to neither rather than to whichever side is tested first.
    const patch = underdogRowPatch("SURFACE_TRANSITION", "Player", audit, "Same Player", "Same Player", NOW);
    expect(patch.evaluated).toBe(false);
    expect(patch.patch["status"]).toBe("UNAVAILABLE");
  });
});

describe("stressRowPatch — a test that never ran is not a failed test", () => {
  const audit = auditOf(MIXED);

  it.each(["ST04", "ST08", "ST09", "ST10"])("%s persists NOT_RUN, never UNSTABLE", (code) => {
    const patch = stressRowPatch(code, audit, NOW);
    expect(patch.evaluated).toBe(false);
    expect(patch.patch["status"]).toBe("UNAVAILABLE");
    expect(patch.patch["outcome"]).toBe(STRESS_NOT_RUN);
    expect(patch.patch["outcome"]).not.toBe("UNSTABLE");
  });

  it("a test that did run still reports its real outcome", () => {
    const patch = stressRowPatch("ST05", audit, NOW);
    expect(patch.patch["status"]).toBe("COMPLETE");
    expect(["STABLE", "UNSTABLE"]).toContain(patch.patch["outcome"]);
  });
});
