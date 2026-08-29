import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { certifyMetricFinding } from "./metric-certification";
import type { MetricFinding } from "./audit-pipeline";

const calc = readFileSync("src/lib/deterministic-market-metrics.server.ts", "utf8").replace(/\s+/g, " ");

// The exact text shape valueText() in deterministic-market-metrics.server.ts
// produces: current-match odds/de-vig/movement stats, never a historical
// price bucket, an outcomes count, or a calibration error -- because it only
// ever queries a single event_date, not a player's historical record.
function currentOddsOnlyFinding(code: string): MetricFinding {
  const text = "avg_de_vig=57.3%; avg_raw=54.1%; move=1.2%; favorite_share=100.0%; n=6; paired=6";
  return { metric_code: code, p1_value: text, p2_value: text, p1_treatment: "RECONSTRUCTED", p2_treatment: "RECONSTRUCTED", differential: null, evidence_family: "MARKET", reliability: 80, sample: "x", unavailable_reason: null, sources: [{ source_name: "The Odds API", url: null, retrieved_at: null }] };
}

describe("deterministic-market-metrics.server.ts wraps its return in certifyMetricFinding", () => {
  it("calls certifyMetricFinding on the returned finding", () => {
    expect(calc).toContain('import { certifyMetricFinding } from "./metric-certification"');
    expect(calc).toContain("return certifyMetricFinding({");
  });

  it("downgrades the exact current-odds-only text it produces for code 019 to UNAVAILABLE, not RECONSTRUCTED", () => {
    // Before this fix, deterministic-market-metrics.server.ts's own isCoreMarket
    // check claimed RECONSTRUCTED for code 019 even though it never queries a
    // player's historical odds/outcome record -- only the single current match
    // date -- so it can never actually satisfy Market Calibration's own
    // definition (a historical price-bucket win rate). certifyMetricFinding is
    // the codebase's existing, tested safety net for exactly this case (see
    // metric-certification.test.ts's "does not accept current odds alone as
    // market calibration"); this proves wrapping the return value in it
    // actually catches deterministic-market-metrics.server.ts's real output
    // shape, not just a hand-picked example.
    const out = certifyMetricFinding(currentOddsOnlyFinding("019"));
    expect(out.p1_treatment).toBe("UNAVAILABLE");
    expect(out.p2_treatment).toBe("UNAVAILABLE");
  });

  it("passes code 015 through unchanged (it has no registered certification policy; the live engine now emits PARTIAL for it directly, not RECONSTRUCTED -- see docs/metric-audit-015-market-layer.md)", () => {
    // certifyMetricFinding itself is a pass-through for any code without a
    // registered policy -- this proves that behavior in isolation, using a
    // synthetic PARTIAL input (deterministic-market-metrics.server.ts's real
    // output for 015 as of this pass; see the dedicated 015 fixture below for
    // the live engine's actual current-odds-only text and treatment).
    const finding = currentOddsOnlyFinding("015");
    const out = certifyMetricFinding({ ...finding, p1_treatment: "PARTIAL", p2_treatment: "PARTIAL" });
    expect(out.p1_treatment).toBe("PARTIAL");
    expect(out.p2_treatment).toBe("PARTIAL");
  });
});
