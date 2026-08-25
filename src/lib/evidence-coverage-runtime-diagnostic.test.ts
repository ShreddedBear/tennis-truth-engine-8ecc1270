import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const diagnostic = readFileSync("src/lib/evidence-coverage-runtime-diagnostic.server.ts", "utf8");
const route = readFileSync("src/routes/api/evidence-coverage-diagnostic.ts", "utf8");
const ranking = readFileSync("src/lib/deterministic-ranking-metrics.server.ts", "utf8");
const schedule = readFileSync("src/lib/deterministic-results-schedule-metrics.server.ts", "utf8");
const market = readFileSync("src/lib/deterministic-market-metrics.server.ts", "utf8");
const bridge = readFileSync("src/lib/source-observation-metric-bridge.server.ts", "utf8");
const researcher = readFileSync("src/lib/warehouse-first-researcher.server.ts", "utf8");
const canonical = readFileSync("src/lib/evidence-canonical-identity.server.ts", "utf8");
const hotPathIndexes = readFileSync("supabase/migrations/20260825152500_evidence_lookup_hotpath_indexes.sql", "utf8");

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

  it("resolves surname-only identities fail closed and propagates canonical names through every evidence lane", () => {
    expect(canonical).toContain("uniqueCanonicalWarehouseIdentity");
    expect(canonical).toContain('from("source_observations")');
    expect(canonical).toContain('from("metric_evidence_store")');
    expect(canonical).toContain('from("matches")');
    expect(canonical).toContain('status: "QUERY_FAILED"');
    expect(canonical).toContain('status: candidates.length > 1 ? "AMBIGUOUS" : "UNRESOLVED"');
    expect(researcher).toContain("resolveCanonicalEvidencePair(input.p1,input.p2)");
    expect(researcher).toContain("lookup(codes,p1,p2,date)");
    expect(researcher).toContain("deterministicRankingMetric({metricCode:metric.code,p1,p2");
    expect(researcher).toContain("deterministicMarketMetric({metricCode:metric.code,p1,p2");
    expect(researcher).toContain("deterministicResultsScheduleMetric({metricCode:metric.code,p1,p2");
    expect(researcher).toContain("buildMetricObservationContext({metrics:liveMissing,p1,p2");
    expect(researcher).toContain("buildBsdAtpMainPbpContext({metrics:liveMissing,p1,p2");
    expect(researcher).toContain("buildBsdWtaMainPbpContext({metrics:liveMissing,p1,p2");
    expect(researcher).toContain("buildBsdAtpChallengerPbpContext({metrics:liveMissing,p1,p2");
  });

  it("samples real production matches even when event_level or scheduled_date is null", () => {
    expect(diagnostic).toContain("representativeMatches");
    expect(diagnostic).toContain("hydrateParsedHints");
    expect(diagnostic).toContain('order("created_at", { ascending: false })');
    expect(diagnostic).not.toContain('.not("scheduled_date", "is", null)');
    expect(diagnostic).toContain("row.scheduled_date ?? row.parsed_date ?? row.created_at.slice(0, 10)");
    expect(diagnostic).toContain("row.event_level ?? row.parsed_event_level");
    expect(diagnostic).toContain('requested_classes: ["ATP_MAIN","WTA_MAIN","ATP_CHALLENGER"]');
  });

  it("prevents dense market/PBP rows from crowding other evidence families", () => {
    expect(bridge).toContain('eq("observation_type", "MARKET")');
    expect(bridge).toContain('in("observation_type", ["POINT_BY_POINT", "PBP"])');
    expect(bridge).toContain('not("observation_type", "in", "(POINT_BY_POINT,PBP,MARKET)")');
  });

  it("indexes the exact predicates used by the evidence read path", () => {
    expect(hotPathIndexes).toContain("source_observations_player_date_exact_idx");
    expect(hotPathIndexes).toContain("source_observations_pair_date_exact_idx");
    expect(hotPathIndexes).toContain("source_observations_shared_date_idx");
    expect(hotPathIndexes).toContain("metric_evidence_pair_date_exact_idx");
  });

  it("bounds runtime diagnostic database concurrency", () => {
    expect(diagnostic).toContain("DIAGNOSTIC_QUERY_CONCURRENCY = 6");
    expect(diagnostic).toContain("deterministicBatch");
  });

  it("keeps the temporary endpoint obscure and no-store", () => {
    expect(route).toContain("DIAGNOSTIC_KEY");
    expect(route).toContain('cache-control\": \"no-store\"');
    expect(route).toContain("runEvidenceCoverageRuntimeDiagnostic");
  });
});
