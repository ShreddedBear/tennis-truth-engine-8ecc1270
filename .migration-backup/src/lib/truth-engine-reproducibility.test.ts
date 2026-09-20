import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { compareMetricRows, type MetricRowForComparison } from "./truth-engine-metric-comparison";
import { runTruthEngineAudit } from "./truth-engine-audit";
import { decideTruthEngineSelection } from "./truth-engine-decision";
import { ACTIVE_METRIC_CODES } from "./truth-engine-active-metrics";

// PHASE 14 — REPRODUCIBILITY, against REAL frozen pre-match evidence.
//
// The fixture is the persisted metric_results evidence for the 32 matches whose stored
// outcome was INSUFFICIENT_EVIDENCE, exported read-only from production (project
// qyovnrkiknsiqjybxubf, slate 1) at the timestamp it records. Using real evidence rather
// than synthetic rows is the point: reproducibility has to hold on the shapes producers
// actually emit -- bare scalars, keyed strings, JSON payloads, NA values and absent sides.
interface FrozenMatch {
  match_id: string;
  audit_run_id: string;
  p1: string;
  p2: string;
  stored_independent_winner: string | null;
  rows: MetricRowForComparison[];
}
const fixture = JSON.parse(readFileSync(new URL("./__fixtures__/frozen-slate-evidence.json", import.meta.url), "utf8")) as {
  captured_at: string;
  slate: string;
  matches: FrozenMatch[];
};

/** Everything a decision depends on, in a form that can be compared for exact equality. */
function decisionFingerprint(m: FrozenMatch, rows: MetricRowForComparison[]) {
  const audit = runTruthEngineAudit(compareMetricRows(rows), m.p1, m.p2);
  return JSON.stringify({
    outcome: audit.decision.outcome,
    winner: audit.audit_winner,
    winner_side: audit.audit_winner_side,
    evidence_percent: audit.decision.evidence_percent,
    directional_families: audit.decision.directional_families,
    support: audit.decision.independent_support_families,
    contra: audit.decision.independent_contradiction_families,
    neutral: audit.decision.neutral_families,
    conflicted: audit.decision.conflicted_families,
    flipping: audit.decision.flipping_families,
    stability: audit.decision.stability,
    stress: audit.stress.comparative_robustness,
    stress_sides: audit.stress.sides,
    underdog: audit.underdog.sides.map((s) => [s.side, s.overall_viability, s.pathways.length]),
    verification: [audit.verification.supports_p1_families, audit.verification.supports_p2_families],
    disagreement: audit.disagreement.overall_severity,
    reason: audit.final_reason,
  });
}

/** Deterministic shuffle, so a failure is reproducible rather than a coin flip. */
function shuffle<T>(input: T[], seed: number): T[] {
  const out = [...input];
  let state = seed;
  for (let i = out.length - 1; i > 0; i--) {
    state = (state * 1664525 + 1013904223) % 4294967296;
    const j = state % (i + 1);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

describe(`reproducibility over ${fixture.matches.length} frozen production matches`, () => {
  it("the fixture is the real active-metric evidence, not a synthetic stand-in", () => {
    expect(fixture.matches).toHaveLength(32);
    for (const m of fixture.matches) {
      expect(m.rows).toHaveLength(ACTIVE_METRIC_CODES.length);
      expect(m.rows.map((r) => String(r.metric_code)).sort()).toEqual([...ACTIVE_METRIC_CODES].sort());
    }
  });

  it("running the deterministic pipeline twice on the same evidence gives the same result", () => {
    for (const m of fixture.matches) {
      expect(decisionFingerprint(m, m.rows)).toBe(decisionFingerprint(m, m.rows));
    }
  });

  it("the result does not depend on the order rows arrive in", () => {
    // Provider response order and database row order are both incidental. Three different
    // deterministic orderings must produce byte-identical decisions.
    for (const m of fixture.matches) {
      const canonical = decisionFingerprint(m, m.rows);
      expect(decisionFingerprint(m, shuffle(m.rows, 12345))).toBe(canonical);
      expect(decisionFingerprint(m, shuffle(m.rows, 98765))).toBe(canonical);
      expect(decisionFingerprint(m, [...m.rows].reverse())).toBe(canonical);
    }
  });

  it("the result does not depend on the current date", () => {
    const canonical = fixture.matches.map((m) => decisionFingerprint(m, m.rows));
    const realNow = Date.now;
    try {
      Date.now = () => new Date("2031-01-01T00:00:00.000Z").getTime();
      expect(fixture.matches.map((m) => decisionFingerprint(m, m.rows))).toEqual(canonical);
    } finally {
      Date.now = realNow;
    }
  });

  it("swapping P1 and P2 mirrors every decision exactly", () => {
    for (const m of fixture.matches) {
      const forward = decideTruthEngineSelection({ comparisons: compareMetricRows(m.rows), p1Name: m.p1, p2Name: m.p2 });
      const swappedRows = m.rows.map((r) => ({ metric_code: r.metric_code, p1_value: r.p2_value, p2_value: r.p1_value, p1_treatment: r.p2_treatment, p2_treatment: r.p1_treatment }));
      const swapped = decideTruthEngineSelection({ comparisons: compareMetricRows(swappedRows), p1Name: m.p2, p2Name: m.p1 });
      const mirrored = forward.outcome === "INSUFFICIENT_EVIDENCE" ? "INSUFFICIENT_EVIDENCE" : forward.outcome === "P1" ? "P2" : "P1";
      expect(swapped.outcome).toBe(mirrored);
      expect(swapped.evidence_percent).toBe(forward.evidence_percent);
      expect(swapped.directional_families).toBe(forward.directional_families);
    }
  });

  it("only the 25 active metrics can ever reach a family vote", () => {
    for (const m of fixture.matches) {
      const decision = decideTruthEngineSelection({ comparisons: compareMetricRows(m.rows), p1Name: m.p1, p2Name: m.p2 });
      for (const family of decision.families) {
        for (const code of [...family.supporting_metrics, ...family.opposing_metrics, ...family.neutral_metrics]) {
          expect(ACTIVE_METRIC_CODES).toContain(code);
        }
      }
    }
  });
});
