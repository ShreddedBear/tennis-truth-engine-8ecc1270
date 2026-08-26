import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const diagnostic = readFileSync("src/lib/evidence-coverage-runtime-diagnostic.server.ts", "utf8");
const route = readFileSync("src/routes/api/evidence-coverage-diagnostic.ts", "utf8");
const ranking = readFileSync("src/lib/deterministic-ranking-metrics.server.ts", "utf8");
const schedule = readFileSync("src/lib/deterministic-results-schedule-metrics.server.ts", "utf8");
const market = readFileSync("src/lib/deterministic-market-metrics.server.ts", "utf8");
const pbp = readFileSync("src/lib/deterministic-pbp-metrics.server.ts", "utf8");
const bridge = readFileSync("src/lib/source-observation-metric-bridge.server.ts", "utf8");
const researcher = readFileSync("src/lib/warehouse-first-researcher.server.ts", "utf8");
const canonical = readFileSync("src/lib/evidence-canonical-identity.server.ts", "utf8");
const hotPathIndexes = readFileSync("supabase/migrations/20260825152500_evidence_lookup_hotpath_indexes.sql", "utf8");

describe("runtime evidence coverage diagnostic", () => {
  it("is read-only and provider-independent", () => {
    expect(diagnostic).not.toContain("finalMetricWiringResearcher");
    expect(diagnostic).not.toMatch(/\.(insert|update|delete|upsert)\(/);
    expect(diagnostic).toContain('from("metric_evidence_store")');
    expect(diagnostic).toContain("buildMetricObservationContext");
  });

  it("uses all nine required failure buckets in its contract", () => {
    for (const bucket of [
      "SOURCE_MISSING", "INGESTION_MISSING", "IDENTITY_MATCH_FAILURE", "EVIDENCE_QUERY_FAILURE",
      "NORMALIZATION_FAILURE", "EVIDENCE_WIRING_FAILURE", "RECONSTRUCTION_FAILURE",
      "COVERAGE_CREDIT_FAILURE", "GENUINELY_UNAVAILABLE",
    ]) expect(diagnostic).toContain(bucket);
  });

  it("does not let an empty app matches table misclassify all evidence as identity failure", () => {
    expect(diagnostic).toMatch(/blocks_evidence_classification\s*:\s*false/);
    expect(diagnostic).toMatch(/bucket\s*=\s*"INGESTION_MISSING"/);
  });

  it("fails closed on one-sided evidence instead of producing a false green", () => {
    expect(diagnostic).toMatch(/pairUsable\s*=\s*p1Usable\s*&&\s*p2Usable/);
    expect(diagnostic).toMatch(/oneSidedUsable\s*=\s*p1Usable\s*!==\s*p2Usable/);
    expect(diagnostic).toMatch(/bucket\s*=\s*"COVERAGE_CREDIT_FAILURE"/);
    expect(diagnostic).toMatch(/pair_credited\s*:\s*pairUsable/);
    expect(diagnostic).toContain("pair_percent");
    expect(diagnostic).toContain("false_green_guard");
    expect(diagnostic).toMatch(/falseGreens=details\.filter\(r=>r\.one_sided_usable&&r\.pair_credited\)\.length/);
    expect(diagnostic).toContain("passed:falseGreens===0");
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

  it("keeps runtime diagnosis aligned with deterministic PBP recovery", () => {
    expect(pbp).toContain("deterministicPbpMetric");
    expect(diagnostic).toContain('import { deterministicPbpMetric } from "./deterministic-pbp-metrics.server"');
    expect(diagnostic).toContain("deterministicPbpMetric({metricCode:metric.code,p1:match.p1,p2:match.p2,asOfDate:match.date})");
  });

  it("resolves surname-only identities from warehouse evidence only and propagates canonical names through every evidence lane", () => {
    expect(canonical).toContain("uniqueCanonicalWarehouseIdentity");
    expect(canonical).toContain('from("source_observations")');
    expect(canonical).toContain('from("metric_evidence_store")');
    expect(canonical).not.toContain('from("matches")');
    expect(canonical).toContain("MAX_PAGES_PER_LANE");
    expect(canonical).toContain('status: "QUERY_FAILED"');
    expect(canonical).toContain('status: candidates.length > 1 ? "AMBIGUOUS" : "UNRESOLVED"');
    expect(researcher).toContain("resolveCanonicalEvidencePair(input.p1,input.p2)");
    expect(researcher).toContain("lookup(codes,p1,p2,date)");
    expect(researcher).toContain("deterministicRankingMetric({metricCode:metric.code,p1,p2");
    expect(researcher).toContain("deterministicMarketMetric({metricCode:metric.code,p1,p2");
    expect(researcher).toContain("deterministicPbpMetric({metricCode:metric.code,p1,p2");
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
    expect(diagnostic).toMatch(/requested_classes\s*:\s*\["ATP_MAIN","WTA_MAIN","ATP_CHALLENGER","WTA_CHALLENGER"\]/);
  });

  it("uses exact canonical ranking evidence only as a conservative main-tour sampling fallback", () => {
    expect(diagnostic).toContain("classifyFromExactRankingEvidence");
    expect(diagnostic).toContain("classifyPairFromExactRankingEvidence");
    expect(diagnostic).toContain('eq("observation_type","RANKING")');
    expect(diagnostic).toContain('in("player_name",names)');
    expect(diagnostic).toContain('"matches_plus_rankings"');
    expect(diagnostic).toContain("status===\"AMBIGUOUS\"");
    expect(diagnostic).toContain("status===\"QUERY_FAILED\"");
    expect(diagnostic).toContain("status===\"UNRESOLVED\"");
    expect(diagnostic).toMatch(/challenger\|wta\\s\*125\|wta125\|125k/);
  });

  it("falls back to ranking-proven persisted metric-evidence pairs when match tables have no pairs", () => {
    expect(diagnostic).toContain('from("metric_evidence_store").select("player_name,opponent_name,as_of_date,metric_code,value_text,evidence_family")');
    expect(diagnostic).toContain("classifyPairFromExactRankingEvidence");
    expect(diagnostic).toContain('sampling_source:"metric_evidence_store"');
    expect(diagnostic).toContain('date_source:"persisted_as_of_date"');
    expect(diagnostic).toContain("grouped=new Map");
    expect(diagnostic).toContain("persistedSurface");
    expect(diagnostic).toContain('match.sampling_source==="matches"||match.sampling_source==="matches_plus_rankings"');
    expect(diagnostic).toContain("ranking-proven persisted evidence pairs");
  });

  it("separates current evidence coverage sampling from verified historical class proof", () => {
    expect(diagnostic).toContain("Current persisted evidence snapshots are the primary coverage sample for main tours.");
    expect(diagnostic).toContain('select("player_name,opponent_name,as_of_date,metric_code,value_text,evidence_family")');
    expect(diagnostic).toContain("persistedSurface(rows)");
    expect(diagnostic).toContain("class_proof");
    const persistedPriority = diagnostic.indexOf('const persisted=await db.from("metric_evidence_store")');
    const verifiedFallback = diagnostic.indexOf('const row=await sampleVerifiedEvidenceIndexMatch(id);', persistedPriority);
    expect(persistedPriority).toBeGreaterThan(-1);
    expect(verifiedFallback).toBeGreaterThan(persistedPriority);
  });

  it("documents representative classes that cannot be sampled from current persisted production data", () => {
    expect(diagnostic).toContain("missing_class_reasons");
    expect(diagnostic).toContain("No real persisted ${id} match, qualifying paired warehouse observation, ranking-proven current evidence snapshot, or validated repository representative");
  });

  it("classifies an absent provider-independent source path as SOURCE_MISSING", () => {
    expect(diagnostic).toContain('else{bucket="SOURCE_MISSING";reason="No provider-independent structured source-family path is registered for this metric.";}');
    expect(diagnostic).toContain('bucket="EVIDENCE_WIRING_FAILURE";reason="Sufficient admissible observations exist but did not become a usable deterministic/stored finding."');
  });

  it("classifies shared-only schedule context as ingestion missing rather than reconstruction failure", () => {
    expect(diagnostic).toContain('policy.allowed_families.includes("RESULTS_SCHEDULE")');
    expect(diagnostic).toContain('!(entry.observations??[]).some((o:any)=>Boolean(o?.player))');
    expect(diagnostic).toContain('Only shared tournament/schedule context is present; player-specific match evidence required by this metric has not been ingested.');
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

  it("surfaces persisted evidence provenance for coverage validation", () => {
    expect(diagnostic).toContain('value_text,evidence_family,sources,reliability,sample_label');
    expect(diagnostic).toContain('stored_p1_family:p1Stored?.evidence_family??null');
    expect(diagnostic).toContain('stored_p2_family:p2Stored?.evidence_family??null');
    expect(diagnostic).toContain('stored_p1_source_count:Array.isArray(p1Stored?.sources)?p1Stored.sources.length:0');
    expect(diagnostic).toContain('stored_p2_source_count:Array.isArray(p2Stored?.sources)?p2Stored.sources.length:0');
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
describe("verified PBP index sampling fallback", () => {
  it("uses strict verified index matches only after database sampling is exhausted", () => {
    expect(diagnostic).toContain('sampleVerifiedEvidenceIndexMatch(id)');
    expect(diagnostic).toContain('sampling_source:row.sampling_source');
    expect(diagnostic).toContain('date_source:"verified_index_date"');
    expect(diagnostic).toContain('match.sampling_source==="matches"||match.sampling_source==="matches_plus_rankings"');
  });
});


describe("certified provider-independent local evidence bridge", () => {
  it("runs local historical evidence through the existing exact-field and certification guards before coverage credit", () => {
    expect(diagnostic).toContain('localMetricRows(match.p1,match.p2,match.context,metrics)');
    expect(diagnostic).toContain('certifyMetricFinding(enforceFiveMetricWiring(metrics[index],row))');
    expect(diagnostic).toContain('internal=certifiedLocalByCode.get(code)??null');
    expect(diagnostic).toContain('local_internal_p1:Boolean(internal?.p1_value)');
    expect(diagnostic).toContain('schema_version:11');
  });
});


describe("coverage fallback precedence requires real side values", () => {
  it("does not let an unavailable deterministic row block certified local evidence", () => {
    expect(diagnostic).toContain('function chooseEvidenceSide(');
    expect(diagnostic).toContain('candidates.find(candidate=>usableEvidenceSide(candidate.treatment,candidate.value))');
    expect(diagnostic).toContain('select("metric_code,player_name,opponent_name,treatment,value_text,evidence_family,sources,reliability,sample_label")');
    expect(diagnostic).toContain('p1Usable=usableEvidenceSide(p1Treatment,p1Chosen.value)');
    expect(diagnostic).toContain('credited_source_p1:p1Usable?p1Chosen.source:null');
  });
});

describe("completion-sweep historical fallback bridge", () => {
  it("reuses only the provider-independent historical fallback in the runtime diagnostic", () => {
    expect(diagnostic).toContain("completionSweepHistoricalFinding");
    expect(diagnostic).toContain("historicalLocalByCode");
    expect(diagnostic).toContain("historical_local_p1");
    expect(diagnostic).toContain("schema_version:11");
  });
});
