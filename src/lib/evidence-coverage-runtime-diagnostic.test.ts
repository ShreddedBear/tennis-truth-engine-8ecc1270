import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const diagnostic = readFileSync("src/lib/evidence-coverage-runtime-diagnostic.server.ts", "utf8");
const route = readFileSync("src/routes/api/evidence-coverage-diagnostic.ts", "utf8");
const ranking = readFileSync("src/lib/deterministic-ranking-metrics.server.ts", "utf8");
const schedule = readFileSync("src/lib/deterministic-results-schedule-metrics.server.ts", "utf8");
const market = readFileSync("src/lib/deterministic-market-metrics.server.ts", "utf8");

describe("runtime evidence coverage diagnostic", () => {
  it("is read-only and provider-independent", () => {
    expect(diagnostic).not.toContain("finalMetricWiringResearcher");
    expect(diagnostic).not.toMatch(/\.(insert|update|delete|upsert)\(/);
    expect(diagnostic).toContain('from("metric_evidence_store")');
    expect(diagnostic).toContain('buildMetricObservationContext');
  });

  it("uses all nine required failure buckets in its contract", () => {
    for (const bucket of [
      "SOURCE_MISSING", "INGESTION_MISSING", "IDENTITY_MATCH_FAILURE", "EVIDENCE_QUERY_FAILURE",
      "NORMALIZATION_FAILURE", "EVIDENCE_WIRING_FAILURE", "RECONSTRUCTION_FAILURE",
      "COVERAGE_CREDIT_FAILURE", "GENUINELY_UNAVAILABLE",
    ]) expect(diagnostic).toContain(bucket);
  });

  it("does not let an empty app matches table misclassify all evidence as identity failure", () => {
    expect(diagnostic).toContain("blocks_evidence_classification: false");
    expect(diagnostic).toContain('bucket = "INGESTION_MISSING"');
    expect(diagnostic).not.toContain('bucket = "IDENTITY_MATCH_FAILURE"');
  });

  it("fails closed on one-sided evidence instead of producing a false green", () => {
    expect(diagnostic).toContain("const pairUsable = p1Usable && p2Usable");
    expect(diagnostic).toContain("const oneSidedUsable = p1Usable !== p2Usable");
    expect(diagnostic).toContain('bucket = "COVERAGE_CREDIT_FAILURE"');
    expect(diagnostic).toContain("pair_credited: pairUsable");
    expect(diagnostic).toContain("pair_percent");
    expect(diagnostic).toContain("false_green_guard");
  });

  it("uses the same safe legacy-alias firewall in diagnostic and deterministic paths", () => {
    expect(diagnostic).toContain("safeEvidenceAliases");
    expect(diagnostic).toContain("evidencePairMatches");
    expect(ranking).toContain("safeEvidenceAliases");
    expect(ranking).toContain("evidenceNameMatches");
    expect(schedule).toContain("safeEvidenceAliases");
    expect(schedule).toContain("evidenceNameMatches");
    expect(market).toContain("safeEvidenceAliases");
    expect(market).toContain("evidencePairMatches");
  });

  it("keeps the temporary endpoint obscure and no-store", () => {
    expect(route).toContain("DIAGNOSTIC_KEY");
    expect(route).toContain('cache-control\": \"no-store\"');
    expect(route).toContain("runEvidenceCoverageRuntimeDiagnostic");
  });
});
