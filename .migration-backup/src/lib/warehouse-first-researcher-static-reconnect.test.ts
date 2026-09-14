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

// Live production finding: every real BSD/Bzzoiro PBP fetch for 002/003/009/018/032
// returned HTTP 402 (payment/credits required), but the packet-building layer only ever
// saw "no observations" -- fetchPbp() collapsed every failure into a bare null, so a real
// producer/billing failure was indistinguishable from "this match's PBP genuinely doesn't
// exist". This guards the fix: when the PBP packet recovery comes back null for a
// TASK18B-owned code, a real recorded fetch failure (never a mere absence of candidates)
// must still surface as an UNAVAILABLE finding carrying that reason.
describe("warehouse-first-researcher.server.ts surfaces a real BSD PBP fetch failure instead of silence", () => {
  it("imports TASK18B_METRIC_CODES and checks each lane's fetch_failures before staying silent", () => {
    expect(collapsed).toContain('import { TASK18B_METRIC_CODES } from "./pbp-score-state-recovery"');
    expect(collapsed).toContain("TASK18B_METRIC_CODES.has(code)");
    expect(collapsed).toContain("fetch_failures");
    expect(collapsed).toContain("fetch_failure_sample");
  });

  it("only fires the fetch-failure fallback when recovered is null (never overrides a real recovery)", () => {
    const idx = collapsed.indexOf("if (recovered) {");
    expect(idx).toBeGreaterThan(-1);
    const block = collapsed.slice(idx, idx + 400);
    expect(block).toContain("} else if (TASK18B_METRIC_CODES.has(code)) {");
  });

  it("checks the Live Tennis API lane's status for a real fetch failure before staying silent", () => {
    const idx = collapsed.indexOf("const lanes = [");
    expect(idx).toBeGreaterThan(-1);
    const block = collapsed.slice(idx, idx + 200);
    expect(block).toContain("liveTennisApiPbp.status");
  });
});

// Live production finding: livetennisapi.com became the primary point-by-point provider
// (Basic tier: point-by-point history, 60 req/min / 1,000 req/day), replacing the BSD/
// Bzzoiro lanes above, which never had usable credits. This guards the wiring: the
// researcher imports the single consolidated lane and merges its packet the same way the
// old four BSD lanes were merged, so nothing downstream (mergeMetricFindingSides,
// applyProviderFailurePrecedence) needed to change.
describe("warehouse-first-researcher.server.ts wires the Live Tennis API PBP lane", () => {
  it("imports buildLiveTennisApiPbpContext instead of the four BSD lane builders", () => {
    expect(collapsed).toContain('import { buildLiveTennisApiPbpContext } from "./live-tennis-api-pbp.server"');
    expect(collapsed).not.toContain("buildBsdAtpChallengerPbpContext");
    expect(collapsed).not.toContain("buildBsdAtpMainPbpContext");
    expect(collapsed).not.toContain("buildBsdWtaMainPbpContext");
    expect(collapsed).not.toContain("buildBsdWtaChallengerPbpContext");
  });

  it("merges the Live Tennis API packet into the observation packet alongside the warehouse packet", () => {
    expect(collapsed).toContain("mergeObservationPackets(warehousePacket, liveTennisApiPbp.packet)");
  });
});
