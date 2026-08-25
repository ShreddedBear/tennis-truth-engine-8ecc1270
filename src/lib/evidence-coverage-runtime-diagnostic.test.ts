import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const diagnostic = readFileSync("src/lib/evidence-coverage-runtime-diagnostic.server.ts", "utf8");
const route = readFileSync("src/routes/api/evidence-coverage-diagnostic.ts", "utf8");

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

  it("keeps the temporary endpoint obscure and no-store", () => {
    expect(route).toContain("DIAGNOSTIC_KEY");
    expect(route).toContain('cache-control": "no-store"');
    expect(route).toContain("runEvidenceCoverageRuntimeDiagnostic");
  });
});
