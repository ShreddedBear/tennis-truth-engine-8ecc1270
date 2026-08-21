// DETERMINISTIC COMPLETION ENGINE
// Application logic — never AI text — decides completion, gate outcome and color.

export const DONE_STATES = ["COMPLETE", "UNAVAILABLE", "EXCLUDED"];

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
  total: number;
  usablePercent: number;
  statuses: Array<"DIRECT" | "RECONSTRUCTED" | "PARTIAL" | "UNAVAILABLE" | "EXCLUDED">;
}

const pair = (rows: Countable[]): CountPair => ({
  done: rows.filter((r) => DONE_STATES.includes(r.status)).length,
  total: rows.length,
});

const full = (p: CountPair) => p.total > 0 && p.done === p.total;
const COVERAGE_THRESHOLD = 70;

function coverageFor(metrics: EngineInput["metrics"], side: "p1" | "p2"): CoverageReport {
  const statuses = metrics.map((metric) => {
    const value = side === "p1" ? (metric.p1_treatment ?? metric.p1_status) : (metric.p2_treatment ?? metric.p2_status);
    return ["DIRECT", "RECONSTRUCTED", "PARTIAL", "UNAVAILABLE", "EXCLUDED"].includes(value)
      ? (value as CoverageReport["statuses"][number])
      : "UNAVAILABLE";
  });
  const count = (status: CoverageReport["statuses"][number]) => statuses.filter((value) => value === status).length;
  const excluded = count("EXCLUDED");
  const denominator = metrics.length - excluded;
  const usable = count("DIRECT") + count("RECONSTRUCTED");
  return {
    direct: count("DIRECT"),
    reconstructed: count("RECONSTRUCTED"),
    partial: count("PARTIAL"),
    unavailable: count("UNAVAILABLE"),
    excluded,
    total: metrics.length,
    usablePercent: denominator > 0 ? Number(((usable / denominator) * 100).toFixed(1)) : 0,
    statuses,
  };
}

export function evaluate(input: EngineInput): GateReport {
  const { match, run } = input;

  const metrics = pair(input.metrics);
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

  // Effective independent evidence: collapse correlated families,
  // and never count Matrix-derived signals.
  const families = new Set<string>();
  input.metrics.forEach((m) => {
    if (m.matrix_derived) return;
    if (m.status !== "COMPLETE") return;
    if (m.evidence_family) families.add(m.evidence_family);
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
    { key: "identity", label: "Match identity verified", pass: match.identity_status === "VERIFIED", detail: match.identity_status },
    { key: "surface", label: "Surface verified", pass: match.surface_status === "VERIFIED", detail: match.surface_status },
    { key: "lock", label: "Pre-match research lock set", pass: !!run.research_lock_at, detail: run.research_lock_at ?? "not locked" },
    { key: "conflicts", label: "Critical source conflicts resolved", pass: criticalConflicts.done === criticalConflicts.total, detail: `${criticalConflicts.done}/${criticalConflicts.total}` },
    { key: "p1", label: "Player 1 metric sweep complete", pass: full(p1), detail: `${p1.done}/${p1.total}` },
    { key: "p2", label: "Player 2 metric sweep complete", pass: full(p2), detail: `${p2.done}/${p2.total}` },
    { key: "recon", label: "Reconstructions resolved", pass: reconstructions.total === 0 || full(reconstructions), detail: `${reconstructions.done}/${reconstructions.total}` },
    { key: "verification", label: "Verification Audit complete", pass: full(verification), detail: `${verification.done}/${verification.total}` },
    { key: "disagreement", label: "Disagreement / Trap Audit complete", pass: full(disagreement), detail: `${disagreement.done}/${disagreement.total}` },
    { key: "underdog", label: "Dangerous Underdog Audit complete", pass: full(underdog), detail: `${underdog.done}/${underdog.total}` },
    { key: "stress", label: "Stress / removal tests complete", pass: full(stress), detail: `${stress.done}/${stress.total}` },
    { key: "committed", label: "Independent conclusion committed", pass: !!run.independent_decision_committed_at && !!run.independent_winner, detail: run.independent_winner ?? "not committed" },
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
  } else if (lowCoverage) {
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
