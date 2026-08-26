import { policyForMetric, type ObservationFamily } from "./metric-source-family-policy";

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
