import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync("src/lib/warehouse-first-researcher.server.ts", "utf8");
const collapsed = source.replace(/\s+/g, " ");

// See docs/ARCHITECTURE-FINDING-disconnected-hybrid-researcher.md: the
// PredixSport/DataHub CSV warehouse and the live WTA official API were built,
// tested, and certified (docs/metric-audit-011-volatility-floor.md,
// docs/metric-audit-012-fatigue-workload.md,
// docs/metric-audit-013-availability.md) but never actually reachable from a
// live audit run. This test guards the reconnection: it must sit strictly
// between the deterministic-PBP-packet recovery tier and the live AI search
// fallback, and every row it contributes must go through certifyMetricFinding
// before being trusted.
describe("warehouse-first-researcher.server.ts reconnects the static CSV/WTA-official layer", () => {
  it("imports the previously-disconnected local warehouse and WTA official sources", () => {
    expect(collapsed).toContain('import { localMetricRows } from "./hybrid-audit-research.server"');
    expect(collapsed).toContain('import { officialWtaMetricRows } from "./wta-official-match-evidence.server"');
    expect(collapsed).toContain('import { certifyMetricFinding } from "./metric-certification"');
  });

  it("certifies every row from both the local CSV warehouse and the live WTA official API", () => {
    expect(collapsed).toContain('localMetricRows(p1, p2, input.context ?? "", beforeStaticWarehouse).map(certifyMetricFinding)');
    expect(collapsed).toContain("wtaRows.map(row => [codeOf(row.metric_code), certifyMetricFinding(row)])");
  });

  it("never lets an officialWtaMetricRows outage (thrown error) abort the whole metrics() call", () => {
    const tryIndex = collapsed.indexOf('try { wtaRows = (await researchWorkPool.runWithBudget( "official-wta"');
    expect(tryIndex).toBeGreaterThan(-1);
    const guardedBlock = collapsed.slice(tryIndex, tryIndex + 700);
    expect(guardedBlock).toContain("officialWtaMetricRows(");
    expect(guardedBlock).toContain("catch {");
  });

  it("runs strictly after the deterministic-PBP-packet recovery tier and before the live AI search fallback", () => {
    const pbpPacketIndex = collapsed.indexOf("deterministicPbpMetricFromPacket({metricCode:code,p1,p2,asOfDate:date,packet:observationPacket})");
    const staticWarehouseIndex = collapsed.indexOf("beforeStaticWarehouse = liveMissing.filter");
    const remainingLiveMissingIndex = collapsed.indexOf("remainingLiveMissing=liveMissing.filter");
    const liveSearchIndex = collapsed.indexOf("finalMetricWiringResearcher.metrics({ ...input, context, metrics: remainingLiveMissing })");
    expect(pbpPacketIndex).toBeGreaterThan(-1);
    expect(staticWarehouseIndex).toBeGreaterThan(pbpPacketIndex);
    expect(remainingLiveMissingIndex).toBeGreaterThan(staticWarehouseIndex);
    expect(liveSearchIndex).toBeGreaterThan(remainingLiveMissingIndex);
  });

  it("only promotes a static-warehouse/WTA row when both sides are fully usable", () => {
    expect(collapsed).toContain("fullyUsableFinding(wta) ? wta : fullyUsableFinding(local) ? local : null");
  });
});
