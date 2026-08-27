// DETERMINISTIC COMPLETION ENGINE
// Application logic — never AI text — decides completion, gate outcome and color.

import { authoritativeMetricRow, isNoSourceCode } from "./authoritative-metric-catalog";

export const DONE_STATES = ["COMPLETE", "UNAVAILABLE", "EXCLUDED", "NO_SOURCE"];

// Task 20 reconciliation: a PROCESS_META code's row is initially instantiated with
// treatment/status "EXCLUDED" (see audit-pipeline.ts's isProcessMetaRuleCode), but
// several legitimate downstream meta-analysis writers (meta-derived-evidence.server.ts,
// final-advanced-meta.server.ts) later overwrite that same row's p1_treatment/
// p2_treatment/status once other stages complete -- to PARTIAL/RECONSTRUCTED/COMPLETE,
// never back to EXCLUDED -- so a code could silently re-enter the coverage denominator
// after instantiation despite never carrying player evidence. Deriving exclusion from the
// metric's own code identity here, rather than trusting whatever treatment value a row
// happens to carry, closes that silent-re-entry path for good: no downstream writer can
// ever cause a PROCESS_META code to count toward coverage, regardless of what it sets.
function isProcessMetaCode(code: string | null | undefined): boolean {
  if (!code) return false;
  const match = String(code).match(/(\d{1,3})$/);
  const normalized = match ? match[1].padStart(3, "0") : String(code).padStart(3, "0");
  return authoritativeMetricRow(normalized)?.type === "PROCESS_META";
}

// Denominator-eligibility audit (requested directly): a code with a real, documented
// determination that no legitimate obtainable/reconstructable evidence pathway exists
// (see NO_SOURCE_DETERMINATIONS in authoritative-metric-catalog.ts -- currently empty,
// since no code has actually cleared that bar) is also excluded from the coverage
// denominator, the same way and for the same silent-re-entry-proof reason as
// PROCESS_META above -- but tracked as its own distinct bucket, never merged into
// "excluded", so the two remain separately auditable.
function isNoSourceMetricCode(code: string | null | undefined): boolean {
  return isNoSourceCode(code);
}

export interface Countable {
  status: string;
}

export interface EngineInput {
  match: {
    identity_status: string;
    surface_status: string;
    player1_name: string;
    player2_name: string;
  };
  run: {
    research_lock_at: string | null;
    independent_decision_committed_at: string | null;
    matrix_revealed_at: string | null;
    independent_winner: string | null;
    independent_low: number | null;
    independent_high: number | null;
    calibration_version_id: string | null;
    effective_evidence_count: number;
  };
  metrics: Array<{
    status: string;
    p1_status: string;
    p2_status: string;
    p1_treatment?: string | null;
    p2_treatment?: string | null;
    matrix_derived: boolean;
    evidence_family: string | null;
    metric_name?: string | null;
    metric_code?: string | null;
  }>;
  verification: Array<{ status: string; outcome: string; severity: string | null }>;
  disagreement: Array<{ status: string; contradiction_severity: string | null }>;
  underdog: Array<{ status: string; classification: string; player_side: string }>;
  stress: Array<{ status: string; test_code: string; outcome: string }>;
  reconstructions: Array<{ status: string }>;
  conflicts: Array<{ critical: boolean; resolution_status: string }>;
  matrixWp: number | null;
}

export interface CountPair {
  done: number;
  total: number;
}

export interface GateReport {
  counts: {
    metrics: CountPair;
    p1: CountPair;
    p2: CountPair;
    verification: CountPair;
    disagreement: CountPair;
    underdog: CountPair;
    stress: CountPair;
    reconstructions: CountPair;
    criticalConflicts: CountPair;
  };
  checks: Array<{ key: string; label: string; pass: boolean; detail: string }>;
  completionPercent: number;
  auditComplete: boolean;
  matrixFirewallValid: boolean;
  effectiveEvidenceCount: number;
  coverage: {
    p1: CoverageReport;
    p2: CoverageReport;
    usablePercent: number;
    thresholdPercent: number;
  };
  greenLocked: boolean;
  greenLockReasons: string[];
  color: "DOUBLE GREEN" | "GREEN" | "YELLOW" | "RED / PASS" | "INSUFFICIENT EVIDENCE" | "INCOMPLETE";
  action: string;
}

export interface CoverageReport {
  direct: number;
  reconstructed: number;
  partial: number;
  unavailable: number;
  excluded: number;
  noSource: number;
  total: number;
  usablePercent: number;
  statuses: Array<"DIRECT" | "RECONSTRUCTED" | "PARTIAL" | "UNAVAILABLE" | "EXCLUDED" | "NO_SOURCE">;
}

const pair = (rows: Countable[]): CountPair => ({
  done: rows.filter((r) => DONE_STATES.includes(r.status)).length,
  total: rows.length,
});

const full = (p: CountPair) => p.total > 0 && p.done === p.total;
const COVERAGE_THRESHOLD = 70;

function coverageFor(metrics: EngineInput["metrics"], side: "p1" | "p2"): CoverageReport {
  const statuses = metrics.map((metric) => {
    if (isProcessMetaCode(metric.metric_code)) return "EXCLUDED" as const;
    if (isNoSourceMetricCode(metric.metric_code)) return "NO_SOURCE" as const;
    const value = side === "p1" ? (metric.p1_treatment ?? metric.p1_status) : (metric.p2_treatment ?? metric.p2_status);
    return ["DIRECT", "RECONSTRUCTED", "PARTIAL", "UNAVAILABLE", "EXCLUDED", "NO_SOURCE"].includes(value)
      ? (value as CoverageReport["statuses"][number])
      : "UNAVAILABLE";
  });
  const count = (status: CoverageReport["statuses"][number]) => statuses.filter((value) => value === status).length;
  const excluded = count("EXCLUDED");
  const noSource = count("NO_SOURCE");
  const denominator = metrics.length - excluded - noSource;
  const usable = count("DIRECT") + count("RECONSTRUCTED") + count("PARTIAL");
  return {
    direct: count("DIRECT"),
    reconstructed: count("RECONSTRUCTED"),
    partial: count("PARTIAL"),
    unavailable: count("UNAVAILABLE"),
    excluded,
    noSource,
    total: metrics.length,
    usablePercent: denominator > 0 ? Number(((usable / denominator) * 100).toFixed(1)) : 0,
    statuses,
  };
}

function explicitEvidenceFamily(metric: EngineInput["metrics"][number]) {
  const family = String(metric.evidence_family ?? "").trim();
  const defaultName = String(metric.metric_name ?? "").trim();
  // Definition instantiation initially stores metric_name in evidence_family as
  // a placeholder. That does not prove independence. Only explicit lineage set
  // by a researcher/reconstructor may enter the independent-family count.
  return family && family !== defaultName ? family : null;
}

export function evaluate(input: EngineInput): GateReport {
  const { match, run } = input;

  const metrics: CountPair = {
    done: input.metrics.filter((m) => DONE_STATES.includes(m.p1_status) && DONE_STATES.includes(m.p2_status)).length,
    total: input.metrics.length,
  };
  const p1: CountPair = {
    done: input.metrics.filter((m) => DONE_STATES.includes(m.p1_status)).length,
    total: input.metrics.length,
  };
  const p2: CountPair = {
    done: input.metrics.filter((m) => DONE_STATES.includes(m.p2_status)).length,
    total: input.metrics.length,
  };
  const verification = pair(input.verification);
  const disagreement = pair(input.disagreement);
  const underdog = pair(input.underdog);
  const stress = pair(input.stress);
  const reconstructions = pair(input.reconstructions);
  const criticalConflicts: CountPair = {
    total: input.conflicts.filter((c) => c.critical).length,
    done: input.conflicts.filter((c) => c.critical && c.resolution_status.startsWith("RESOLVED")).length,
  };

  // Effective independent evidence: collapse correlated families, never count
  // Matrix-derived signals, and ignore placeholder metric-name families.
  const families = new Set<string>();
  input.metrics.forEach((m) => {
    if (m.matrix_derived) return;
    const processed = DONE_STATES.includes(m.p1_status) && DONE_STATES.includes(m.p2_status);
    if (!processed) return;
    const usableTreatment = (t: string | null | undefined) => ["DIRECT", "RECONSTRUCTED", "PARTIAL"].includes(String(t ?? ""));
    if (!usableTreatment(m.p1_treatment) && !usableTreatment(m.p2_treatment)) return;
    const family = explicitEvidenceFamily(m);
    if (family) families.add(family);
  });
  const effectiveEvidenceCount = families.size;
  const p1Coverage = coverageFor(input.metrics, "p1");
  const p2Coverage = coverageFor(input.metrics, "p2");
  const usableCoveragePercent = Number(Math.min(p1Coverage.usablePercent, p2Coverage.usablePercent).toFixed(1));
  const lowCoverage = usableCoveragePercent < COVERAGE_THRESHOLD;

  const firewallValid =
    !run.matrix_revealed_at ||
    (!!run.independent_decision_committed_at &&
      new Date(run.matrix_revealed_at).getTime() >= new Date(run.independent_decision_committed_at).getTime());

  const matrixRemoval = input.stress.filter((s) => s.test_code === "ST01" || s.test_code === "ST02");
  const matrixRemovalSurvived =
    matrixRemoval.length > 0 &&
    matrixRemoval.every((s) => s.status === "COMPLETE" && (s.outcome === "STABLE" || s.outcome === "MOSTLY STABLE"));
  const familyRemoval = input.stress.find((s) => s.test_code === "ST03");
  const familyRemovalSurvived =
    !!familyRemoval && familyRemoval.status === "COMPLETE" && familyRemoval.outcome !== "FAILS";

  const strongUnderdogPathways = input.underdog.filter(
    (u) => u.classification === "STRONG" && u.player_side !== (run.independent_winner ?? ""),
  ).length;
  const unresolvedCritical =
    input.verification.some((v) => v.outcome === "FAIL" && v.severity === "CRITICAL") ||
    input.disagreement.some((d) => d.contradiction_severity === "CRITICAL");

  const checks = [
    { key: "identity", label: "Match identity verified or unavailable", pass: ["VERIFIED", "UNAVAILABLE"].includes(match.identity_status), detail: match.identity_status },
    { key: "surface", label: "Surface verified or unavailable", pass: ["VERIFIED", "UNAVAILABLE"].includes(match.surface_status), detail: match.surface_status },
    { key: "lock", label: "Pre-match research lock set", pass: !!run.research_lock_at, detail: run.research_lock_at ?? "not locked" },
    { key: "conflicts", label: "Critical source conflicts resolved", pass: criticalConflicts.done === criticalConflicts.total, detail: `${criticalConflicts.done}/${criticalConflicts.total}` },
    { key: "p1", label: "Player 1 metric sweep complete", pass: full(p1), detail: `${p1.done}/${p1.total}` },
    { key: "p2", label: "Player 2 metric sweep complete", pass: full(p2), detail: `${p2.done}/${p2.total}` },
    { key: "recon", label: "Reconstructions resolved", pass: reconstructions.total === 0 || full(reconstructions), detail: `${reconstructions.done}/${reconstructions.total}` },
    { key: "verification", label: "Verification Audit complete", pass: full(verification), detail: `${verification.done}/${verification.total}` },
    { key: "disagreement", label: "Disagreement / Trap Audit complete", pass: full(disagreement), detail: `${disagreement.done}/${disagreement.total}` },
    { key: "underdog", label: "Dangerous Underdog Audit complete", pass: full(underdog), detail: `${underdog.done}/${underdog.total}` },
    { key: "stress", label: "Stress / removal tests complete", pass: full(stress), detail: `${stress.done}/${stress.total}` },
    { key: "committed", label: "Independent conclusion committed", pass: !!run.independent_decision_committed_at, detail: run.independent_winner ?? "INSUFFICIENT EVIDENCE" },
    { key: "firewall", label: "Matrix firewall respected", pass: firewallValid, detail: firewallValid ? "VALID" : "VIOLATED" },
    { key: "reveal", label: "Matrix comparison complete", pass: !!run.matrix_revealed_at, detail: run.matrix_revealed_at ?? "not revealed" },
    { key: "calibration", label: "Current calibration applied", pass: !!run.calibration_version_id, detail: run.calibration_version_id ? "COMPLETE" : "INCOMPLETE" },
  ];

  const auditComplete = checks.every((c) => c.pass);
  const completionPercent = Number(((checks.filter((c) => c.pass).length / checks.length) * 100).toFixed(1));

  const greenLockReasons: string[] = [];
  if (!auditComplete) greenLockReasons.push("Required stages incomplete");
  if (!firewallValid) greenLockReasons.push("Matrix firewall violated");
  if (!matrixRemovalSurvived) greenLockReasons.push("GREEN LOCKED — Matrix-removal test not survived");
  if (!familyRemovalSurvived) greenLockReasons.push("Strongest-family removal not survived");
  if (!full(underdog)) greenLockReasons.push("Dangerous Underdog audit incomplete");
  if (effectiveEvidenceCount < 3) greenLockReasons.push(`Effective independent evidence families = ${effectiveEvidenceCount} (min 3)`);
  if (lowCoverage) greenLockReasons.push(`Usable metric coverage = ${usableCoveragePercent}% (min ${COVERAGE_THRESHOLD}%)`);
  if (strongUnderdogPathways >= 2) greenLockReasons.push("Multiple STRONG opposing underdog pathways");
  if (unresolvedCritical) greenLockReasons.push("Unresolved CRITICAL contradiction");
  if (input.matrixWp !== null && input.matrixWp <= 55) greenLockReasons.push("No-edge floor: favorite probability ≤55%");

  let color: GateReport["color"] = "INCOMPLETE";
  if (!auditComplete) {
    color = "INCOMPLETE";
  } else if (lowCoverage || !run.independent_winner) {
    color = "INSUFFICIENT EVIDENCE";
  } else if (unresolvedCritical || strongUnderdogPathways >= 2 || !matrixRemovalSurvived || (input.matrixWp !== null && input.matrixWp <= 55)) {
    color = "RED / PASS";
  } else if (greenLockReasons.length > 0) {
    color = "YELLOW";
  } else if (
    effectiveEvidenceCount >= 5 &&
    input.stress.every((s) => s.outcome === "STABLE") &&
    strongUnderdogPathways === 0 &&
    !input.underdog.some((u) => u.classification === "UNRESOLVED")
  ) {
    color = "DOUBLE GREEN";
  } else {
    color = "GREEN";
  }

  const action =
    color === "DOUBLE GREEN" || color === "GREEN"
      ? `PLAY — ${run.independent_winner ?? ""}`
      : color === "YELLOW"
        ? "MONITOR / REDUCE"
        : color === "RED / PASS"
          ? "PASS"
          : color === "INSUFFICIENT EVIDENCE"
            ? "INSUFFICIENT EVIDENCE"
          : "CONTINUE PROCESSING";

  return {
    counts: { metrics, p1, p2, verification, disagreement, underdog, stress, reconstructions, criticalConflicts },
    checks,
    completionPercent,
    auditComplete,
    matrixFirewallValid: firewallValid,
    effectiveEvidenceCount,
    coverage: { p1: p1Coverage, p2: p2Coverage, usablePercent: usableCoveragePercent, thresholdPercent: COVERAGE_THRESHOLD },
    greenLocked: greenLockReasons.length > 0,
    greenLockReasons,
    color,
    action,
  };
}

export function bucketFor<T extends { wp_min: number; wp_max: number }>(wp: number | null | undefined, buckets: T[]): T | null {
  if (wp === null || wp === undefined) return null;
  return buckets.find((b) => wp >= b.wp_min && wp <= b.wp_max) ?? null;
}

export function winRate(wins: number, graded: number) {
  return graded === 0 ? null : Number(((wins / graded) * 100).toFixed(1));
}
