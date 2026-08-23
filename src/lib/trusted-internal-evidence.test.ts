import { describe, expect, it } from "vitest";
import { buildTrustedInternalFinding, clearPhantomEvidenceMetadata, normalizeTrustedSide } from "./trusted-internal-evidence";
import { validateProtectedMetricWiring } from "./protected-metric-wiring.server";
import { enforceMetricWiring072076 } from "./metric-wiring-072-076.server";

const P1 = "Arthur Fils";
const P2 = "Flavio Cobolli";
const datahub = { source_name: "DataHub ATP", url: "https://datahub.io/atp", retrieved_at: "2026-08-23T00:00:00Z" };
const predix = { source_name: "PredixSport", url: "https://predixsport.test", retrieved_at: "2026-08-23T00:00:00Z" };

describe("trusted internal evidence adapter", () => {
  it("lets a legitimate imported exact metric value survive with real side/source/sample", () => {
    const finding = buildTrustedInternalFinding({
      metric_code: "008",
      players: { p1: P1, p2: P2 },
      p1: { player: P1, value: "set1_win_pct=58.10; win_after_losing_set1_pct=31.00", treatment: "PARTIAL", sample: 37, sources: [datahub] },
      p2: { player: P2, value: "set1_win_pct=52.40; win_after_losing_set1_pct=27.00", treatment: "PARTIAL", sample: 41, sources: [datahub] },
      evidence_family: "HISTORICAL_DATAHUB_FAMILY_008",
      reliability: 70,
      unavailable_reason: null,
    });
    expect(finding.p1_value).toContain(`PLAYER=${P1}`);
    expect(finding.p1_value).toContain("SOURCE=DataHub ATP");
    expect(finding.p1_value).toContain("SAMPLE=37");
    expect(finding.p2_value).toContain("SAMPLE=41");
    expect(finding.p1_treatment).toBe("PARTIAL");
    expect(finding.sample).toBe("P1:37 | P2:41");
    expect(finding.sources.map((s) => s.source_name)).toEqual(["DataHub ATP"]);
  });

  it("rejects a side whose evidence was produced for the wrong player", () => {
    const side = normalizeTrustedSide("P2", P2, { player: P1, value: "set1_win_pct=58.10", treatment: "PARTIAL", sample: 37, sources: [datahub] });
    expect(side.value).toBeNull();
    expect(side.treatment).toBe("UNAVAILABLE");
    expect(side.missing).toEqual([`P2 exact PLAYER=${P2}`]);
  });

  it("rejects a source that is not in the persisted source list", () => {
    const side = normalizeTrustedSide("P1", P1, { player: P1, value: "set1_win_pct=58.10", treatment: "PARTIAL", sample: 37, sources: [{ source_name: "Invented Blog", url: null, retrieved_at: null }] }, [datahub]);
    expect(side.value).toBeNull();
    expect(side.missing).toEqual(["P1 SOURCE matching persisted provenance"]);
  });

  it("rejects a side without its own sample instead of reusing the other side's", () => {
    const finding = buildTrustedInternalFinding({
      metric_code: "008",
      players: { p1: P1, p2: P2 },
      p1: { player: P1, value: "set1_win_pct=58.10", treatment: "PARTIAL", sample: 37, sources: [datahub] },
      p2: { player: P2, value: "set1_win_pct=52.40", treatment: "PARTIAL", sample: null, sources: [datahub] },
      evidence_family: "HISTORICAL_DATAHUB_FAMILY_008",
      reliability: 70,
      unavailable_reason: null,
    });
    expect(finding.p2_value).toBeNull();
    expect(finding.p2_treatment).toBe("UNAVAILABLE");
    expect(finding.sample).toBe("P1:37 | P2:UNAVAILABLE");
    expect(finding.missing_inputs).toContain("P2 actual side-specific SAMPLE denominator");
  });

  it("preserves an exact fixed-window zero-event observation without inventing a denominator", () => {
    const side = normalizeTrustedSide("P1", P1, {
      player: P1,
      value: "matches_last_7_days=0.00; matches_last_14_days=0.00; rest_days=122.00",
      treatment: "PARTIAL",
      sample: 0,
      sources: [predix],
    });
    expect(side.treatment).toBe("PARTIAL");
    expect(side.value).toContain("SAMPLE=FIXED_WINDOW_ZERO_EVENT");
    expect(side.value).toContain("matches_last_7_days=0.00");
    expect(side.missing).toEqual([]);
  });

  it("still rejects generic sample zero when it is not a fixed-window zero-event observation", () => {
    const side = normalizeTrustedSide("P1", P1, {
      player: P1,
      value: "surface_elo=1900.00",
      treatment: "PARTIAL",
      sample: 0,
      sources: [predix],
    });
    expect(side.value).toBeNull();
    expect(side.treatment).toBe("UNAVAILABLE");
    expect(side.missing).toEqual(["P1 actual side-specific SAMPLE denominator"]);
  });

  it("downgrades a reconstructed value that has no approved formula provenance", () => {
    const without = normalizeTrustedSide("P1", P1, { player: P1, value: "dominance_ratio=1.21", treatment: "RECONSTRUCTED", sample: 40, sources: [datahub] });
    expect(without.treatment).toBe("PARTIAL");
    expect(without.value).not.toContain("FORMULA=");
    expect(without.missing).toContain("P1 approved deterministic reconstruction formula provenance");

    const fabricatedSpec = normalizeTrustedSide("P1", P1, {
      player: P1, value: "dominance_ratio=1.21", treatment: "RECONSTRUCTED", sample: 40, sources: [datahub],
      formula: { spec_id: "RS-NOT-APPROVED", formula: "a/b", inputs: ["a", "b"] },
    });
    expect(fabricatedSpec.treatment).toBe("PARTIAL");

    const approved = normalizeTrustedSide("P1", P1, {
      player: P1, value: "service_points_won_pct=66.00", treatment: "RECONSTRUCTED", sample: 40, sources: [datahub],
      formula: { spec_id: "RS-SRV-01", formula: "first_serve_in_pct*first_serve_points_won_pct + (1-first_serve_in_pct)*second_serve_points_won_pct", inputs: ["first_serve_in_pct", "first_serve_points_won_pct", "second_serve_points_won_pct"] },
    });
    expect(approved.treatment).toBe("RECONSTRUCTED");
    expect(approved.value).toContain("FORMULA=");
    expect(approved.value).toContain("INPUTS=first_serve_in_pct|");
  });

  it("still rejects neighboring/proxy fields even after normalization tags are added", () => {
    const finding = buildTrustedInternalFinding({
      metric_code: "045",
      players: { p1: P1, p2: P2 },
      p1: { player: P1, value: "tiebreak win pct=62; break points saved=70", treatment: "DIRECT", sample: 30, sources: [predix] },
      p2: { player: P2, value: "tiebreak win pct=58; break points saved=64", treatment: "DIRECT", sample: 30, sources: [predix] },
      evidence_family: "PUBLIC_HISTORICAL_DATA_FAMILY_045",
      reliability: 85,
      unavailable_reason: null,
    });
    const certified = validateProtectedMetricWiring(finding, { p1: P1, p2: P2 });
    expect(certified.p1_treatment).toBe("UNAVAILABLE");
    expect(certified.p1_value).toBeNull();
  });

  it("cannot let P1 evidence populate P2 through the strict guard", () => {
    const finding = buildTrustedInternalFinding({
      metric_code: "072",
      players: { p1: P1, p2: P2 },
      p1: { player: P1, value: "one-handed backhand type verified; reach differential recorded", treatment: "DIRECT", sample: 12, sources: [predix] },
      // Producer wrongly hands P1's evidence to the P2 slot.
      p2: { player: P1, value: "one-handed backhand type verified; reach differential recorded", treatment: "DIRECT", sample: 12, sources: [predix] },
      evidence_family: "EXACT_072",
      reliability: 85,
      unavailable_reason: null,
    });
    expect(finding.p2_value).toBeNull();
    const guarded = enforceMetricWiring072076(finding, { p1: P1, p2: P2 });
    expect(guarded.p2_treatment).toBe("UNAVAILABLE");
  });

  it("never upgrades an unavailable side and clears phantom sample/reliability", () => {
    const side = normalizeTrustedSide("P1", P1, { player: P1, value: "set1_win_pct=58.10", treatment: "UNAVAILABLE", sample: 37, sources: [datahub] });
    expect(side.treatment).toBe("UNAVAILABLE");
    const cleared = clearPhantomEvidenceMetadata({
      metric_code: "008", p1_value: null, p2_value: null, p1_treatment: "UNAVAILABLE", p2_treatment: "UNAVAILABLE",
      differential: null, evidence_family: null, reliability: 85, sample: "37", unavailable_reason: "NO_SOURCE_FOUND", sources: [datahub],
    });
    expect(cleared.sample).toBeNull();
    expect(cleared.reliability).toBeNull();
    expect(cleared.sources).toEqual([]);
  });
});
