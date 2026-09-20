import { describe, expect, it } from "vitest";
import { allMetricFamilyAudit, classifyEvidenceAvailability, enrichEvidenceCoverageAccounting, summarizeRecoverableCeiling } from "./evidence-availability-accounting";

function runtimeClass(metric: Record<string, unknown>) {
  const report = enrichEvidenceCoverageAccounting({
    matches: [{ id: "WTA_MAIN", sampling_source: "source_observations", metrics: [metric] }],
  });
  return {
    availabilityClass: report.matches[0].metrics[0].availability_class,
    accounting: report.availability_accounting,
  };
}

describe("evidence availability accounting", () => {
  it("audits every metric code 001 through 081 exactly once", () => {
    const rows = allMetricFamilyAudit();
    expect(rows).toHaveLength(81);
    expect(rows[0].metric_code).toBe("001");
    expect(rows[80].metric_code).toBe("081");
    expect(new Set(rows.map((row) => row.metric_code)).size).toBe(81);
  });

  it("distinguishes stranded evidence from genuine source absence", () => {
    expect(classifyEvidenceAvailability({pairCredited:false,p1Credited:false,p2Credited:false,observedFamilies:["POINT_BY_POINT"]})).toBe("PBP_EXISTS_NOT_WIRED");
    expect(classifyEvidenceAvailability({pairCredited:false,p1Credited:false,p2Credited:false,observedFamilies:["MARKET"]})).toBe("MARKET_EXISTS_NOT_WIRED");
    // Bug fix regression: any other admissible family actually observed (RESULTS_SCHEDULE
    // here) must also register as software loss, not fall through to genuine unavailability.
    expect(classifyEvidenceAvailability({pairCredited:false,p1Credited:false,p2Credited:false,observedFamilies:["RESULTS_SCHEDULE"]})).toBe("OBSERVED_EVIDENCE_NOT_RECONSTRUCTED");
    expect(classifyEvidenceAvailability({pairCredited:false,p1Credited:false,p2Credited:false,repositoryEvidenceKnown:true,repositoryEvidenceExposed:false})).toBe("REPOSITORY_EVIDENCE_NOT_EXPOSED");
    expect(classifyEvidenceAvailability({pairCredited:false,p1Credited:false,p2Credited:false,genuineUnavailable:true})).toBe("GENUINELY_UNAVAILABLE");
  });

  it("keeps identity, match join, tour classification and DB failures separate", () => {
    expect(classifyEvidenceAvailability({pairCredited:false,p1Credited:false,p2Credited:false,identityBlocked:true})).toBe("CANONICAL_IDENTITY_FAILURE");
    expect(classifyEvidenceAvailability({pairCredited:false,p1Credited:false,p2Credited:false,canonicalMatchFound:false})).toBe("MATCH_JOIN_FAILURE");
    expect(classifyEvidenceAvailability({pairCredited:false,p1Credited:false,p2Credited:false,tourClassified:false})).toBe("TOUR_CLASSIFICATION_FAILURE");
    expect(classifyEvidenceAvailability({pairCredited:false,p1Credited:false,p2Credited:false,dbLookupFailed:true})).toBe("DB_EVIDENCE_LOOKUP_FAILURE");
  });

  it("calculates the legitimate ceiling by excluding only genuine source absence", () => {
    const summary = summarizeRecoverableCeiling([
      "EVIDENCE_RETRIEVES_CORRECTLY",
      "PARTIALLY_POPULATED",
      "PBP_EXISTS_NOT_WIRED",
      "DB_EVIDENCE_LOOKUP_FAILURE",
      "GENUINELY_UNAVAILABLE",
    ]);
    expect(summary.retrieved_percent).toBe(40);
    expect(summary.software_loss_percent).toBe(40);
    expect(summary.genuine_source_unavailability_percent).toBe(20);
    expect(summary.maximum_recoverable_ceiling_percent).toBe(80);
  });

  it("enriches each representative independently and publishes the 81-code audit", () => {
    const enriched = enrichEvidenceCoverageAccounting({
      matches: [{
        id: "WTA_CHALLENGER",
        sampling_source: "source_observations",
        metrics: [
          // "032" (Point-to-Game Conversion Efficiency) is used as the PBP-expected sample
          // code. It was previously "024", which is now MATRIX_SUMMARY_REQUIRED and would
          // short-circuit to that classification instead of being scored through the
          // software-loss buckets -- see the dedicated quarantine assertion below.
          { metric_code:"032", pair_credited:false, p1_credited:false, p2_credited:false, source_expected:["POINT_BY_POINT"], observed_families:["POINT_BY_POINT"], failure_bucket:"RECONSTRUCTION_FAILURE" },
          { metric_code:"062", pair_credited:true, p1_credited:true, p2_credited:true, p1_treatment:"RECONSTRUCTED", p2_treatment:"RECONSTRUCTED", source_expected:["RANKING"], observed_families:["RANKING"], failure_bucket:null },
        ],
      }],
    });
    expect(enriched.metric_family_audit).toHaveLength(81);
    expect(enriched.matches[0].metrics[0].availability_class).toBe("PBP_EXISTS_NOT_WIRED");
    expect(enriched.matches[0].metrics[1].availability_class).toBe("EVIDENCE_RETRIEVES_CORRECTLY");
    expect(enriched.matches[0].availability_accounting.maximum_recoverable_ceiling_percent).toBe(100);
  });

  it("reports a Matrix-Summary-quarantined code as its own class, never as software loss or genuine unavailability", () => {
    // A quarantined code's evidence is absent because the Truth Engine does not hold the
    // Matrix Summary yet -- neither a wiring defect nor a permanent source gap. It must
    // report that reason rather than being recoded into either failure bucket.
    const enriched = enrichEvidenceCoverageAccounting({
      matches: [{
        id: "WTA_CHALLENGER",
        sampling_source: "source_observations",
        metrics: [
          { metric_code:"024", pair_credited:false, p1_credited:false, p2_credited:false, source_expected:["POINT_BY_POINT"], observed_families:["POINT_BY_POINT"], failure_bucket:"RECONSTRUCTION_FAILURE" },
        ],
      }],
    });
    expect(enriched.matches[0].metrics[0].metric_classification).toBe("MATRIX_SUMMARY_REQUIRED");
    expect(enriched.matches[0].metrics[0].availability_class).toBe("MATRIX_SUMMARY_REQUIRED");
  });

  it("does not infer PBP existence from source_expected alone, but still counts the actually-observed family as software loss", () => {
    // RESULTS_SCHEDULE was actually observed (real warehouse data), POINT_BY_POINT was
    // only ever policy-expected -- this must not become PBP_EXISTS_NOT_WIRED (that would
    // be inferring PBP from source_expected, which is not proof PBP evidence exists), but
    // it also must not collapse to GENUINELY_UNAVAILABLE: real observed evidence exists
    // and no permitted reconstruction recovered it, which is software loss.
    const result = runtimeClass({
      pair_credited:false,p1_credited:false,p2_credited:false,
      p1_treatment:"UNAVAILABLE",p2_treatment:"UNAVAILABLE",
      failure_bucket:"RECONSTRUCTION_FAILURE",
      source_expected:["RESULTS_SCHEDULE","POINT_BY_POINT"],
      observed_families:["RESULTS_SCHEDULE"],
    });
    expect(result.availabilityClass).toBe("OBSERVED_EVIDENCE_NOT_RECONSTRUCTED");
    expect(result.availabilityClass).not.toBe("PBP_EXISTS_NOT_WIRED");
    expect(result.accounting.software_loss).toBe(1);
  });

  it("does not infer market existence from source_expected alone, but still counts the actually-observed family as software loss", () => {
    const result = runtimeClass({
      pair_credited:false,p1_credited:false,p2_credited:false,
      failure_bucket:"RECONSTRUCTION_FAILURE",
      source_expected:["RANKING","MARKET"],
      observed_families:["RANKING"],
    });
    expect(result.availabilityClass).toBe("OBSERVED_EVIDENCE_NOT_RECONSTRUCTED");
    expect(result.availabilityClass).not.toBe("MARKET_EXISTS_NOT_WIRED");
    expect(result.accounting.software_loss).toBe(1);
  });

  it("still classifies genuinely unavailable when no admissible family was observed at all", () => {
    const result = runtimeClass({
      pair_credited:false,p1_credited:false,p2_credited:false,
      failure_bucket:"RECONSTRUCTION_FAILURE",
      source_expected:["RANKING","MARKET"],
      observed_families:[],
    });
    expect(result.availabilityClass).toBe("GENUINELY_UNAVAILABLE");
    expect(result.accounting.software_loss).toBe(0);
  });

  // Direct regression test for the reported contradiction: a RECONSTRUCTION_FAILURE metric
  // with real ingested warehouse data (observed_families containing RESULTS_SCHEDULE,
  // warehouse_observation_count > 0) must contribute to software_loss_percent, not silently
  // report as if the underlying fact were genuinely unavailable.
  it("counts a RECONSTRUCTION_FAILURE metric with real RESULTS_SCHEDULE observations as software loss, not genuine unavailability", () => {
    const result = runtimeClass({
      metric_code:"005",
      pair_credited:false,p1_credited:false,p2_credited:false,
      failure_bucket:"RECONSTRUCTION_FAILURE",
      source_expected:["RESULTS_SCHEDULE"],
      observed_families:["RESULTS_SCHEDULE"],
      warehouse_observation_count:80,
    });
    expect(result.availabilityClass).toBe("OBSERVED_EVIDENCE_NOT_RECONSTRUCTED");
    expect(result.accounting.genuinely_unavailable).toBe(0);
    expect(result.accounting.software_loss).toBe(1);
    expect(result.accounting.software_loss_percent).toBe(100);
  });

  it("classifies PBP software loss only when PBP was actually observed", () => {
    const result = runtimeClass({
      pair_credited:false,p1_credited:false,p2_credited:false,
      failure_bucket:"RECONSTRUCTION_FAILURE",
      source_expected:["RESULTS_SCHEDULE","POINT_BY_POINT"],
      observed_families:["RESULTS_SCHEDULE","POINT_BY_POINT"],
    });
    expect(result.availabilityClass).toBe("PBP_EXISTS_NOT_WIRED");
    expect(result.accounting.software_loss).toBe(1);
  });

  it("classifies market software loss only when market evidence was actually observed", () => {
    const result = runtimeClass({
      pair_credited:false,p1_credited:false,p2_credited:false,
      failure_bucket:"EVIDENCE_WIRING_FAILURE",
      source_expected:["MARKET"],
      observed_families:["MARKET"],
    });
    expect(result.availabilityClass).toBe("MARKET_EXISTS_NOT_WIRED");
    expect(result.accounting.software_loss).toBe(1);
  });

  it("excludes PROTECTED_UNAVAILABLE and META_OR_NON_PLAYER metrics from player evidence coverage, both denominator and numerator", () => {
    const enriched = enrichEvidenceCoverageAccounting({
      matches: [{
        id: "ATP_MAIN",
        sampling_source: "matches",
        metrics: [
          // Legitimate, credited: counts 1/1 toward player coverage.
          { metric_code:"014", pair_credited:true, p1_credited:true, p2_credited:true, p1_treatment:"DIRECT", p2_treatment:"DIRECT" },
          // Protected-unavailable: must be excluded from both numerator and denominator.
          { metric_code:"065", pair_credited:false, p1_credited:false, p2_credited:false, failure_bucket:"INGESTION_MISSING" },
          // Meta/non-player: must be excluded from both numerator and denominator.
          { metric_code:"048", pair_credited:false, p1_credited:false, p2_credited:false, failure_bucket:"SOURCE_MISSING" },
        ],
      }],
    });
    expect(enriched.matches[0].metrics[1].availability_class).toBe("PROTECTED_UNAVAILABLE");
    expect(enriched.matches[0].metrics[2].availability_class).toBe("META_OR_NON_PLAYER");
    // Denominator is 1 (only metric 014), not 3 — 065/048 never drag the score down.
    expect(enriched.matches[0].player_evidence_coverage).toEqual({ legitimate_player_metrics: 1, usable_cells: 1, percent: 100 });
    expect(enriched.player_evidence_coverage.total_player_metric_tour_cells).toBe(1);
    expect(enriched.player_evidence_coverage.usable_player_metric_tour_cells).toBe(1);
    expect(enriched.player_evidence_coverage.percent).toBe(100);
  });

  it("a protected metric cannot be silently promoted to a software-success/failure availability class", () => {
    const enriched = enrichEvidenceCoverageAccounting({
      matches: [{
        id: "WTA_MAIN",
        sampling_source: "matches",
        // Even if runtime signals look like a normal software wiring gap, the
        // static classification must win — 017 stays PROTECTED_UNAVAILABLE.
        metrics: [{ metric_code:"017", pair_credited:false, p1_credited:false, p2_credited:false, failure_bucket:"RECONSTRUCTION_FAILURE", observed_families:["POINT_BY_POINT"] }],
      }],
    });
    expect(enriched.matches[0].metrics[0].availability_class).toBe("PROTECTED_UNAVAILABLE");
    expect(enriched.matches[0].metrics[0].availability_class).not.toBe("PBP_EXISTS_NOT_WIRED");
  });

  it("publishes complete metric-universe accounting on every report (never hides a category)", () => {
    const enriched = enrichEvidenceCoverageAccounting({ matches: [] });
    expect(enriched.metric_universe_accounting.total_original_metric_universe).toBe(81);
    expect(enriched.metric_universe_accounting).toHaveProperty("meta_or_non_player_count");
    expect(enriched.metric_universe_accounting).toHaveProperty("protected_unavailable_count");
    expect(enriched.metric_universe_accounting).toHaveProperty("unknown_requires_review_count");
    expect(enriched.metric_universe_accounting).toHaveProperty("legitimate_player_metric_count");
  });
});
