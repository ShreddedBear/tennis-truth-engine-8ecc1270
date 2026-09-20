import { describe, expect, it } from "vitest";
import type { MetricFinding, Treatment } from "./audit-pipeline";
import { certifyMetricFinding } from "./metric-certification";

const source = [{ source_name: "Named public source", url: "https://example.test/source", retrieved_at: "2026-08-22T00:00:00Z" }];

function row(code: string, p1: string | null, p2: string | null, treatment: Treatment = "RECONSTRUCTED", withSource = true): MetricFinding {
  return {
    metric_code: code,
    p1_value: p1,
    p2_value: p2,
    p1_treatment: treatment,
    p2_treatment: treatment,
    differential: null,
    evidence_family: `TEST_${code}`,
    reliability: 80,
    sample: "10",
    unavailable_reason: null,
    sources: withSource ? source : [],
  };
}

describe("metric 012 Fatigue/Workload certification", () => {
  it("rejects a 28-day/date-only proxy as evidence for the exact family", () => {
    const out = certifyMetricFinding(row("012", "matches_last_28_days=5; days_since_last_match=2", "matches_last_28_days=3; days_since_last_match=1", "PARTIAL"));
    expect(out.p1_treatment).toBe("UNAVAILABLE");
    expect(out.p2_treatment).toBe("UNAVAILABLE");
    expect(out.p1_value).toBeNull();
  });

  it("preserves exact workload components but never upgrades them", () => {
    const out = certifyMetricFinding(row("012", "matches_last_7_days=3; qualifying_matches=2; travel_km=1400", "matches_last_7_days=1; rest_hours=43", "PARTIAL"));
    expect(out.p1_treatment).toBe("PARTIAL");
    expect(out.p2_treatment).toBe("PARTIAL");
  });

  it("requires persisted provenance", () => {
    const out = certifyMetricFinding(row("012", "matches_last_7_days=2", "matches_last_7_days=2", "DIRECT", false));
    expect(out.p1_treatment).toBe("UNAVAILABLE");
    expect(out.p2_treatment).toBe("UNAVAILABLE");
  });
});

describe("metric 019 Market Calibration certification", () => {
  it("does not accept current odds alone as market calibration", () => {
    const out = certifyMetricFinding(row("019", "current odds only: -150", "current odds only: +130", "PARTIAL"));
    expect(out.p1_treatment).toBe("UNAVAILABLE");
    expect(out.p2_treatment).toBe("UNAVAILABLE");
  });

  it("keeps a complete historical bucket reconstruction", () => {
    const text = "historical odds -> no-vig implied_probability; bucket=60-64%; outcomes=18 wins / 30 graded; calibration_error=-2.0pp";
    const out = certifyMetricFinding(row("019", text, text));
    expect(out.p1_treatment).toBe("RECONSTRUCTED");
    expect(out.p2_treatment).toBe("RECONSTRUCTED");
  });

  it("downgrades incomplete reconstruction to PARTIAL rather than RECONSTRUCTED", () => {
    const out = certifyMetricFinding(row("019", "historical odds; no-vig implied_probability; bucket=60-64%", "historical odds; no-vig implied_probability; bucket=60-64%"));
    expect(out.p1_treatment).toBe("PARTIAL");
    expect(out.p2_treatment).toBe("PARTIAL");
  });
});

describe("metric 022 Serve/Return Shot-Level Efficiency certification", () => {
  it("rejects hold/break aggregates as a substitute", () => {
    const out = certifyMetricFinding(row("022", "hold_pct=84; break_pct=22", "hold_pct=78; break_pct=27", "PARTIAL"));
    expect(out.p1_treatment).toBe("UNAVAILABLE");
    expect(out.p2_treatment).toBe("UNAVAILABLE");
  });

  it("downgrades incomplete shot-level reconstruction", () => {
    const out = certifyMetricFinding(row("022", "serve+1 charted shot outcomes=61%", "serve+1 charted shot outcomes=57%"));
    expect(out.p1_treatment).toBe("PARTIAL");
    expect(out.p2_treatment).toBe("PARTIAL");
  });

  it("allows reconstruction only when all exact shot-level components are explicit", () => {
    const text = "serve+1=61%; return+1=54%; rally_state=neutral/attack; charted shot_outcome sample=120";
    const out = certifyMetricFinding(row("022", text, text));
    expect(out.p1_treatment).toBe("RECONSTRUCTED");
  });
});

describe("metric 024 Hidden Performance Quality certification", () => {
  it("rejects ranking/Elo as hidden-quality evidence", () => {
    const out = certifyMetricFinding(row("024", "ranking=22; Elo=1880", "ranking=31; Elo=1810", "PARTIAL"));
    expect(out.p1_treatment).toBe("UNAVAILABLE");
    expect(out.p2_treatment).toBe("UNAVAILABLE");
  });

  it("downgrades when only some exact components are present", () => {
    const out = certifyMetricFinding(row("024", "point-level actual conversion=52%; expected=55%", "point-level actual conversion=49%; expected=51%"));
    expect(out.p1_treatment).toBe("PARTIAL");
    expect(out.p2_treatment).toBe("PARTIAL");
  });

  it("allows a full reconstruction only with point/game, expected-vs-actual, and shot-quality inputs", () => {
    const text = "point-level and game-level inputs; expected conversion=55%; actual conversion=52%; shot_quality from charted shots=0.63";
    const out = certifyMetricFinding(row("024", text, text));
    expect(out.p1_treatment).toBe("RECONSTRUCTED");
  });
});

describe("metric 025 Match Deterioration certification", () => {
  it("rejects season averages as a substitute for within-match trend", () => {
    const out = certifyMetricFinding(row("025", "season average only: serve=64%", "season average only: serve=61%", "PARTIAL"));
    expect(out.p1_treatment).toBe("UNAVAILABLE");
    expect(out.p2_treatment).toBe("UNAVAILABLE");
  });

  it("downgrades a partial set trend rather than calling it reconstructed", () => {
    const out = certifyMetricFinding(row("025", "set-by-set serve: set1=68%, set2=59%; points declined", "set-by-set serve: set1=65%, set2=62%; points declined"));
    expect(out.p1_treatment).toBe("PARTIAL");
    expect(out.p2_treatment).toBe("PARTIAL");
  });

  it("allows reconstruction only when chronological serve/return/point/physical trends are explicit", () => {
    const text = "set-by-set: set1/set2/set3 serve, return, points; physical movement trend documented; deterioration computed chronologically";
    const out = certifyMetricFinding(row("025", text, text));
    expect(out.p1_treatment).toBe("RECONSTRUCTED");
  });

  it("validates P1 and P2 independently so one good side cannot fill the other", () => {
    const good = "set-by-set: set1/set2/set3 serve, return, points; physical movement trend documented";
    const out = certifyMetricFinding(row("025", good, "ranking=50", "RECONSTRUCTED"));
    expect(out.p1_treatment).toBe("RECONSTRUCTED");
    expect(out.p2_treatment).toBe("UNAVAILABLE");
    expect(out.p2_value).toBeNull();
  });
});
