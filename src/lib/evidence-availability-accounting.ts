import { policyForMetric, type ObservationFamily } from "./metric-source-family-policy";
import { classifyMetric, metricUniverseAccounting, playerEvidenceDenominatorCodes } from "./metric-classification";

export type EvidenceAvailabilityClass =
  | "EVIDENCE_RETRIEVES_CORRECTLY"
  | "REPOSITORY_EVIDENCE_NOT_EXPOSED"
  | "DB_EVIDENCE_LOOKUP_FAILURE"
  | "CANONICAL_IDENTITY_FAILURE"
  | "MATCH_JOIN_FAILURE"
  | "TOUR_CLASSIFICATION_FAILURE"
  | "PBP_EXISTS_NOT_WIRED"
  | "MARKET_EXISTS_NOT_WIRED"
  | "PARTIALLY_POPULATED"
  | "GENUINELY_UNAVAILABLE";

export type AvailabilitySignals = {
  pairCredited: boolean;
  p1Credited: boolean;
  p2Credited: boolean;
  p1Treatment?: string | null;
  p2Treatment?: string | null;
  observedFamilies?: Array<ObservationFamily | string>;
  storedCandidateCount?: number;
  identityBlocked?: boolean;
  identityQueryFailed?: boolean;
  canonicalMatchFound?: boolean;
  tourClassified?: boolean;
  repositoryEvidenceKnown?: boolean;
  repositoryEvidenceExposed?: boolean;
  dbLookupFailed?: boolean;
  genuineUnavailable?: boolean;
};

export type MetricFamilyAuditRow = {
  metric_code: string;
  allowed_families: ObservationFamily[];
  sufficient_families: ObservationFamily[];
  support_only_families: ObservationFamily[];
};

export function allMetricFamilyAudit(): MetricFamilyAuditRow[] {
  return Array.from({ length: 81 }, (_, index) => String(index + 1).padStart(3, "0")).map((metric_code) => {
    const policy = policyForMetric(metric_code);
    return {
      metric_code,
      allowed_families: policy.allowed_families,
      sufficient_families: policy.sufficient_families,
      support_only_families: policy.support_only_families ?? [],
    };
  });
}

export function classifyEvidenceAvailability(signals: AvailabilitySignals): EvidenceAvailabilityClass {
  if (signals.pairCredited) {
    if (signals.p1Treatment === "PARTIAL" || signals.p2Treatment === "PARTIAL") return "PARTIALLY_POPULATED";
    return "EVIDENCE_RETRIEVES_CORRECTLY";
  }
  if (signals.identityQueryFailed || signals.dbLookupFailed) return "DB_EVIDENCE_LOOKUP_FAILURE";
  if (signals.identityBlocked) return "CANONICAL_IDENTITY_FAILURE";
  if (signals.tourClassified === false) return "TOUR_CLASSIFICATION_FAILURE";
  if (signals.canonicalMatchFound === false) return "MATCH_JOIN_FAILURE";
  if (signals.p1Credited !== signals.p2Credited) return "PARTIALLY_POPULATED";

  const families = new Set(signals.observedFamilies ?? []);
  if (families.has("POINT_BY_POINT")) return "PBP_EXISTS_NOT_WIRED";
  if (families.has("MARKET")) return "MARKET_EXISTS_NOT_WIRED";
  if ((signals.repositoryEvidenceKnown ?? false) && !(signals.repositoryEvidenceExposed ?? false)) return "REPOSITORY_EVIDENCE_NOT_EXPOSED";
  if ((signals.storedCandidateCount ?? 0) > 0) return "DB_EVIDENCE_LOOKUP_FAILURE";
  return "GENUINELY_UNAVAILABLE";
}

const SOFTWARE_LOSS = new Set<EvidenceAvailabilityClass>([
  "REPOSITORY_EVIDENCE_NOT_EXPOSED",
  "DB_EVIDENCE_LOOKUP_FAILURE",
  "CANONICAL_IDENTITY_FAILURE",
  "MATCH_JOIN_FAILURE",
  "TOUR_CLASSIFICATION_FAILURE",
  "PBP_EXISTS_NOT_WIRED",
  "MARKET_EXISTS_NOT_WIRED",
]);

export function summarizeRecoverableCeiling(classes: EvidenceAvailabilityClass[]) {
  const total = classes.length;
  const retrieved = classes.filter((value) => value === "EVIDENCE_RETRIEVES_CORRECTLY" || value === "PARTIALLY_POPULATED").length;
  const softwareLoss = classes.filter((value) => SOFTWARE_LOSS.has(value)).length;
  const genuinelyUnavailable = classes.filter((value) => value === "GENUINELY_UNAVAILABLE").length;
  const pct = (value: number) => total ? Number((100 * value / total).toFixed(2)) : 0;
  return {
    total,
    retrieved,
    software_loss: softwareLoss,
    genuinely_unavailable: genuinelyUnavailable,
    retrieved_percent: pct(retrieved),
    software_loss_percent: pct(softwareLoss),
    genuine_source_unavailability_percent: pct(genuinelyUnavailable),
    maximum_recoverable_ceiling_percent: pct(total - genuinelyUnavailable),
  };
}

function classFromRuntimeMetric(match: any, metric: any): EvidenceAvailabilityClass {
  if (metric.pair_credited) {
    return classifyEvidenceAvailability({
      pairCredited: true,
      p1Credited: Boolean(metric.p1_credited),
      p2Credited: Boolean(metric.p2_credited),
      p1Treatment: metric.p1_treatment,
      p2Treatment: metric.p2_treatment,
    });
  }
  if (metric.failure_bucket === "IDENTITY_MATCH_FAILURE") return "CANONICAL_IDENTITY_FAILURE";
  if (metric.failure_bucket === "EVIDENCE_QUERY_FAILURE" || metric.failure_bucket === "NORMALIZATION_FAILURE") return "DB_EVIDENCE_LOOKUP_FAILURE";
  if (metric.failure_bucket === "COVERAGE_CREDIT_FAILURE") return "PARTIALLY_POPULATED";
  if (match?.sampling_source === "matches" && match?.identity?.exact_match_count !== 1) return "MATCH_JOIN_FAILURE";
  if (!match?.id) return "TOUR_CLASSIFICATION_FAILURE";

  // Software-loss labels must be proved by evidence actually observed for
  // this metric/matchup. An allowed/expected source family is only policy and
  // cannot establish that PBP, market, or repository evidence exists.
  const observedFamilies = Array.isArray(metric.observed_families) ? metric.observed_families : [];
  if (["EVIDENCE_WIRING_FAILURE", "RECONSTRUCTION_FAILURE"].includes(metric.failure_bucket)) {
    return classifyEvidenceAvailability({
      pairCredited: false,
      p1Credited: Boolean(metric.p1_credited),
      p2Credited: Boolean(metric.p2_credited),
      p1Treatment: metric.p1_treatment,
      p2Treatment: metric.p2_treatment,
      observedFamilies,
      repositoryEvidenceKnown: metric.repository_evidence_known === true,
      repositoryEvidenceExposed: metric.repository_evidence_exposed === true,
      storedCandidateCount: Number(metric.stored_candidate_count ?? 0),
    });
  }
  return "GENUINELY_UNAVAILABLE";
}

// Metrics classified META_OR_NON_PLAYER or PROTECTED_UNAVAILABLE never enter
// the legacy availability buckets above (they are not player evidence, so
// "genuinely unavailable"/"software loss" semantics don't apply to them) and
// never enter the PLAYER Evidence Coverage denominator. They stay explicitly
// visible in metric_universe_accounting on every report instead.
const PLAYER_DENOMINATOR_CODES = new Set(playerEvidenceDenominatorCodes());

export function enrichEvidenceCoverageAccounting<T extends Record<string, any>>(report: T) {
  const matches = (report.matches ?? []).map((match: any) => {
    const metrics = (match.metrics ?? []).map((metric: any) => {
      const metric_classification = classifyMetric(String(metric.metric_code));
      const availability_class =
        metric_classification === "META_OR_NON_PLAYER" || metric_classification === "PROTECTED_UNAVAILABLE"
          ? metric_classification
          : classFromRuntimeMetric(match, metric);
      return { ...metric, metric_classification, availability_class };
    });
    const classes = metrics.map((metric: any) => metric.availability_class as EvidenceAvailabilityClass);
    const byClass: Record<string, number> = {};
    for (const value of classes) byClass[value] = (byClass[value] ?? 0) + 1;

    const playerMetrics = metrics.filter((metric: any) => PLAYER_DENOMINATOR_CODES.has(String(metric.metric_code)));
    const playerCredited = playerMetrics.filter((metric: any) => metric.pair_credited).length;
    return {
      ...match,
      metrics,
      availability_accounting: {
        by_class: byClass,
        ...summarizeRecoverableCeiling(classes),
      },
      player_evidence_coverage: {
        legitimate_player_metrics: playerMetrics.length,
        usable_cells: playerCredited,
        percent: playerMetrics.length ? Number((100 * playerCredited / playerMetrics.length).toFixed(2)) : 0,
      },
    };
  });
  const allClasses = matches.flatMap((match: any) => match.metrics.map((metric: any) => metric.availability_class as EvidenceAvailabilityClass));

  const allPlayerMetrics = matches.flatMap((match: any) => match.metrics.filter((metric: any) => PLAYER_DENOMINATOR_CODES.has(String(metric.metric_code))));
  const totalPlayerCells = allPlayerMetrics.length;
  const usablePlayerCells = allPlayerMetrics.filter((metric: any) => metric.pair_credited).length;

  return {
    ...report,
    metric_family_audit: allMetricFamilyAudit(),
    metric_universe_accounting: metricUniverseAccounting(),
    availability_accounting: {
      scope: "FOUR_TOUR_REPRESENTATIVE_METRICS",
      ...summarizeRecoverableCeiling(allClasses),
    },
    player_evidence_coverage: {
      scope: "FOUR_TOUR_REPRESENTATIVE_METRICS_LEGITIMATE_PLAYER_METRICS_ONLY",
      total_player_metric_tour_cells: totalPlayerCells,
      usable_player_metric_tour_cells: usablePlayerCells,
      percent: totalPlayerCells ? Number((100 * usablePlayerCells / totalPlayerCells).toFixed(2)) : 0,
    },
    matches,
  };
}
