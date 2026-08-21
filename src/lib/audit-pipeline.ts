// ============================================================================
// AUDIT EXECUTION PIPELINE (pure orchestration — dependency injected)
//
// This module owns the end-to-end Run Audit execution:
//   identity -> context -> definition instantiation -> P1/P2 metric execution
//   -> verification -> disagreement -> dangerous underdog -> stress/removal
//   -> independent conclusion -> matrix reveal/comparison -> calibration -> gate
//
// It never touches Supabase or the AI provider directly; both arrive through
// `PipelineDeps`, which is what makes the regression test possible.
//
// MATRIX FIREWALL: no stage before CONCLUSION receives Matrix fields. The
// researcher is only handed matrix data at the MATRIX_COMPARISON stage.
// ============================================================================

import { evaluate, bucketFor, winRate, type EngineInput, type GateReport } from "./audit-engine";
import { STRESS_TESTS, UNDERDOG_PATHWAYS } from "./constants";

export const STAGES = [
  "MATCH IDENTITY VERIFICATION",
  "MATCH CONTEXT RESOLUTION",
  "DEFINITION INSTANTIATION",
  "P1 METRIC EXECUTION",
  "P2 METRIC EXECUTION",
  "VERIFICATION AUDIT",
  "DISAGREEMENT / TRAP AUDIT",
  "DANGEROUS UNDERDOG AUDIT",
  "STRESS / REMOVAL TESTS",
  "INDEPENDENT CONCLUSION",
  "MATRIX REVEAL AND COMPARISON",
  "CURRENT CALIBRATION APPLICATION",
  "FINAL COMBINATION GATE",
] as const;

export type Stage = (typeof STAGES)[number];

export const TREATMENTS = ["DIRECT", "RECONSTRUCTED", "PARTIAL", "UNAVAILABLE", "EXCLUDED"] as const;
export type Treatment = (typeof TREATMENTS)[number];

// ----------------------------- research contract ---------------------------

export interface SourceRef {
  source_name: string;
  url: string | null;
  retrieved_at: string | null;
}

export interface IdentityFinding {
  player1_canonical: string | null;
  player2_canonical: string | null;
  player1_status: "VERIFIED" | "UNVERIFIED" | "CONFLICT";
  player2_status: "VERIFIED" | "UNVERIFIED" | "CONFLICT";
  tournament: string | null;
  event_level: string | null;
  round: string | null;
  scheduled_date: string | null;
  surface: string | null;
  indoor: boolean | null;
  best_of: number | null;
  surface_status: "VERIFIED" | "UNVERIFIED" | "CONFLICT";
  unresolved_reason: string | null;
  sources: SourceRef[];
  conflicts: Array<{ field: string; values: string[]; note: string | null }>;
}

export interface MetricFinding {
  metric_code: string;
  p1_value: string | null;
  p2_value: string | null;
  p1_treatment: Treatment;
  p2_treatment: Treatment;
  differential: string | null;
  evidence_family: string | null;
  reliability: number | null;
  sample: string | null;
  unavailable_reason: string | null;
  sources: SourceRef[];
}

export interface RuleFinding {
  rule_code: string;
  p1_finding: string | null;
  p2_finding: string | null;
  outcome: "PASS" | "WARN" | "FAIL" | "UNAVAILABLE";
  severity: "STANDARD" | "CRITICAL" | null;
  decision_effect: string | null;
  contradiction_severity: "NONE" | "MINOR" | "MATERIAL" | "CRITICAL" | null;
  supporting_evidence: string | null;
  opposing_evidence: string | null;
  final_effect: string | null;
  sources: SourceRef[];
}

export interface UnderdogFinding {
  pathway_code: string;
  player_side: string;
  classification: "UNRESOLVED" | "WEAK" | "REALISTIC" | "STRONG";
  evidence: string | null;
  repeatable: boolean;
  unavailable_reason: string | null;
}

export interface StressFinding {
  test_code: string;
  winner_after: string | null;
  range_after: string | null;
  outcome: "STABLE" | "MOSTLY STABLE" | "UNSTABLE" | "FAILS";
  note: string | null;
}

export interface ConclusionFinding {
  winner: string | null;
  low: number | null;
  high: number | null;
  rationale: string | null;
  insufficient_reason: string | null;
}

export interface EvidenceDigest {
  p1: string;
  p2: string;
  context: string;
  metrics: Array<{ code: string; name: string; p1: string | null; p2: string | null; family: string | null }>;
}

export interface Researcher {
  identity(input: { p1: string; p2: string; hints: Record<string, string | null> }): Promise<IdentityFinding>;
  /** Optional grounded pre-pass: a retrieved public statistical dossier for one player. */
  dossier?(input: { player: string; opponent: string; context: string }): Promise<string>;
  metrics(input: {
    p1: string;
    p2: string;
    context: string;
    dossier?: string;
    metrics: Array<{ code: string; name: string; body: string | null }>;
  }): Promise<MetricFinding[]>;
  rules(input: {
    kind: "VERIFICATION" | "DISAGREEMENT";
    evidence: EvidenceDigest;
    rules: Array<{ code: string; name: string; body: string | null; severity: string }>;
  }): Promise<RuleFinding[]>;
  underdog(input: {
    evidence: EvidenceDigest;
    pathways: Array<{ code: string; name: string }>;
    player_side: string;
    opponent: string;
  }): Promise<UnderdogFinding[]>;
  conclusion(input: { evidence: EvidenceDigest; verificationSummary: string; disagreementSummary: string; underdogSummary: string }): Promise<ConclusionFinding>;
  stress(input: {
    evidence: EvidenceDigest;
    conclusion: ConclusionFinding;
    tests: Array<{ code: string; name: string }>;
  }): Promise<StressFinding[]>;
}

// ------------------------------- data contract -----------------------------

export interface MatchRow {
  id: string;
  player1_name: string;
  player2_name: string;
  tournament_name: string | null;
  event_level: string | null;
  round: string | null;
  scheduled_date: string | null;
  surface: string | null;
  indoor: boolean | null;
  best_of: number | null;
  identity_status: string;
  surface_status: string;
}

export interface RunRow {
  id: string;
  match_id: string;
  run_number: number;
  status: string;
  research_lock_at: string | null;
  independent_decision_committed_at: string | null;
  matrix_revealed_at: string | null;
  independent_winner: string | null;
  independent_low: number | null;
  independent_high: number | null;
  calibrated_low: number | null;
  calibrated_high: number | null;
  calibration_version_id: string | null;
  effective_evidence_count: number;
  metrics_version_id: string | null;
  verification_version_id: string | null;
  disagreement_version_id: string | null;
}

export interface RuleDef {
  id: string;
  rule_code: string;
  rule_name: string;
  body: string | null;
  severity: string;
  blocking: boolean;
}

export interface StageRow {
  stage: string;
  status: string;
  attempts: number;
  error_message: string | null;
  done_count: number;
  total_count: number;
}

export type ChildTable =
  | "metric_results"
  | "verification_results"
  | "disagreement_results"
  | "underdog_results"
  | "stress_results";

export interface PipelineDeps {
  now(): Date;
  research: Researcher;
  getMatch(matchId: string): Promise<MatchRow | null>;
  updateMatch(matchId: string, patch: Record<string, unknown>): Promise<void>;
  getParsedFields(matchId: string): Promise<Record<string, string>>;
  getActiveVersionId(docType: string): Promise<string | null>;
  getRules(versionId: string): Promise<RuleDef[]>;
  getLatestRun(matchId: string): Promise<RunRow | null>;
  createRun(row: Partial<RunRow> & { match_id: string; run_number: number }): Promise<RunRow>;
  updateRun(runId: string, patch: Record<string, unknown>): Promise<void>;
  list(table: ChildTable, runId: string): Promise<Array<Record<string, unknown>>>;
  insert(table: ChildTable, rows: Array<Record<string, unknown>>): Promise<void>;
  update(table: ChildTable, id: string, patch: Record<string, unknown>): Promise<void>;
  getStages(runId: string): Promise<StageRow[]>;
  setStage(runId: string, matchId: string, stage: Stage, patch: Record<string, unknown>): Promise<void>;
  saveIdentityRecords(matchId: string, rows: Array<Record<string, unknown>>): Promise<void>;
  saveSnapshots(runId: string, rows: Array<Record<string, unknown>>): Promise<void>;
  saveConflicts(runId: string, rows: Array<Record<string, unknown>>): Promise<void>;
  getCalibration(): Promise<{
    version: { id: string; label: string; version_number: number } | null;
    buckets: Array<{ bucket_code: string; wp_min: number; wp_max: number; wins: number; graded: number }>;
  }>;
  getDecisionId(runId: string): Promise<string | null>;
  saveDecision(runId: string, existingId: string | null, payload: Record<string, unknown>): Promise<void>;
  getConflicts(runId: string): Promise<Array<{ critical: boolean; resolution_status: string }>>;
  getReconstructions(runId: string): Promise<Array<{ status: string }>>;
  log(entry: Record<string, unknown>): Promise<void>;
}

export interface PipelineResult {
  runId: string;
  complete: boolean;
  nextStage: Stage | null;
  stages: Array<{ stage: Stage; status: string; detail: string }>;
  report: GateReport | null;
  failures: Array<{ stage: Stage; message: string }>;
}

const METRIC_BATCH = 18;
const RULE_BATCH = 20;
const DEFAULT_BUDGET_MS = 45_000;

const s = (v: unknown) => (v === null || v === undefined ? null : String(v));

function digestFrom(match: MatchRow, metrics: Array<Record<string, unknown>>): EvidenceDigest {
  return {
    p1: match.player1_name,
    p2: match.player2_name,
    context: [
      match.tournament_name && `tournament ${match.tournament_name}`,
      match.event_level && `level ${match.event_level}`,
      match.round && `round ${match.round}`,
      match.scheduled_date && `date ${match.scheduled_date}`,
      match.surface && `surface ${match.surface}`,
      match.indoor === null || match.indoor === undefined ? null : match.indoor ? "indoor" : "outdoor",
      match.best_of && `best of ${match.best_of}`,
    ]
      .filter(Boolean)
      .join(" · "),
    metrics: metrics
      .filter((m) => m["p1_value"] || m["p2_value"])
      .map((m) => ({
        code: String(m["metric_code"]),
        name: String(m["metric_name"]),
        p1: s(m["p1_value"]),
        p2: s(m["p2_value"]),
        family: s(m["evidence_family"]),
      })),
  };
}

const treatmentToStatus = (t: Treatment) =>
  t === "UNAVAILABLE" ? "UNAVAILABLE" : t === "EXCLUDED" ? "EXCLUDED" : "COMPLETE";

/**
 * Executes the audit for one match. Idempotent and restartable: completed
 * stages are skipped, partially-executed stages resume on the pending rows
 * only, and nothing already COMPLETE is overwritten.
 */
export async function runPipeline(
  deps: PipelineDeps,
  matchId: string,
  opts: { budgetMs?: number } = {},
): Promise<PipelineResult> {
  const budget = opts.budgetMs ?? DEFAULT_BUDGET_MS;
  const startedAt = Date.now();
  const outOfTime = () => Date.now() - startedAt > budget;

  const match = await deps.getMatch(matchId);
  if (!match) throw new Error(`Match ${matchId} not found`);

  const run = await ensureRun(deps, match);
  const failures: PipelineResult["failures"] = [];
  let nextStage: Stage | null = null;

  const stageRows = await deps.getStages(run.id);
  const stageState = new Map(stageRows.map((r) => [r.stage, r]));

  for (const stage of STAGES) {
    if (stageState.get(stage)?.status === "COMPLETE") continue;
    if (outOfTime()) {
      nextStage = stage;
      break;
    }
    const attempts = (stageState.get(stage)?.attempts ?? 0) + 1;
    await deps.setStage(run.id, matchId, stage, {
      status: "RUNNING",
      attempts,
      started_at: deps.now().toISOString(),
      error_code: null,
      error_message: null,
    });
    try {
      const outcome = await executeStage(deps, stage, matchId, run.id);
      await deps.setStage(run.id, matchId, stage, {
        status: outcome.status,
        finished_at: deps.now().toISOString(),
        done_count: outcome.done,
        total_count: outcome.total,
        detail: outcome.detail ?? {},
        error_code: outcome.status === "COMPLETE" ? null : outcome.errorCode ?? null,
        error_message: outcome.status === "COMPLETE" ? null : outcome.message ?? null,
      });
      await deps.log({
        audit_run_id: run.id,
        match_id: matchId,
        stage,
        status: outcome.status,
        output: { done: outcome.done, total: outcome.total, ...(outcome.detail ?? {}) },
        matrix_visible: stage === "MATRIX REVEAL AND COMPARISON" || stage === "CURRENT CALIBRATION APPLICATION" || stage === "FINAL COMBINATION GATE",
      });
      if (outcome.status !== "COMPLETE") {
        failures.push({ stage, message: outcome.message ?? "stage did not complete" });
        nextStage = stage;
        break;
      }
    } catch (e) {
      const message = (e as Error).message || String(e);
      await deps.setStage(run.id, matchId, stage, {
        status: "FAILED",
        finished_at: deps.now().toISOString(),
        error_code: classify(message),
        error_message: message.slice(0, 800),
      });
      await deps.log({ audit_run_id: run.id, match_id: matchId, stage, status: "FAILED", output: { error: message.slice(0, 800) } });
      failures.push({ stage, message });
      nextStage = stage;
      break;
    }
  }

  const finalStages = await deps.getStages(run.id);
  const complete = STAGES.every((st) => finalStages.find((f) => f.stage === st)?.status === "COMPLETE");
  if (complete) await deps.updateRun(run.id, { status: "COMPLETE" });
  else if (failures.length) await deps.updateRun(run.id, { status: "BLOCKED" });

  const report = await buildReport(deps, matchId, run.id);

  return {
    runId: run.id,
    complete,
    nextStage: complete ? null : nextStage ?? STAGES.find((st) => finalStages.find((f) => f.stage === st)?.status !== "COMPLETE") ?? null,
    stages: STAGES.map((st) => {
      const row = finalStages.find((f) => f.stage === st);
      return {
        stage: st,
        status: row?.status ?? "PENDING",
        detail: row ? (row.error_message ? row.error_message : `${row.done_count}/${row.total_count}`) : "not started",
      };
    }),
    report,
    failures,
  };
}

function classify(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("rate limit") || m.includes("429")) return "PROVIDER_RATE_LIMIT";
  if (m.includes("credit") || m.includes("402")) return "PROVIDER_CREDITS";
  if (m.includes("api key") || m.includes("unauthorized") || m.includes("401")) return "AUTH_OR_CONFIG";
  if (m.includes("timeout") || m.includes("timed out")) return "TIMEOUT";
  if (m.includes("no active") || m.includes("definition")) return "MISSING_DEFINITIONS";
  if (m.includes("json") || m.includes("parse")) return "PROVIDER_RESPONSE_INVALID";
  return "ORCHESTRATION_EXCEPTION";
}

async function ensureRun(deps: PipelineDeps, match: MatchRow): Promise<RunRow> {
  const existing = await deps.getLatestRun(match.id);
  if (existing && existing.status !== "INVALIDATED — RERUN REQUIRED") {
    if (!existing.research_lock_at) await deps.updateRun(existing.id, { research_lock_at: deps.now().toISOString() });
    await deps.updateRun(existing.id, { status: "RUNNING" });
    return { ...existing, status: "RUNNING" };
  }
  const [metrics_version_id, verification_version_id, disagreement_version_id] = await Promise.all([
    deps.getActiveVersionId("METRICS"),
    deps.getActiveVersionId("VERIFICATION"),
    deps.getActiveVersionId("DISAGREEMENT"),
  ]);
  return deps.createRun({
    match_id: match.id,
    run_number: (existing?.run_number ?? 0) + 1,
    status: "RUNNING",
    research_lock_at: deps.now().toISOString(),
    metrics_version_id,
    verification_version_id,
    disagreement_version_id,
  });
}

interface StageOutcome {
  status: "COMPLETE" | "BLOCKED" | "FAILED";
  done: number;
  total: number;
  message?: string;
  errorCode?: string;
  detail?: Record<string, unknown>;
}

async function executeStage(deps: PipelineDeps, stage: Stage, matchId: string, runId: string): Promise<StageOutcome> {
  switch (stage) {
    case "MATCH IDENTITY VERIFICATION":
    case "MATCH CONTEXT RESOLUTION":
      return identityAndContext(deps, matchId, runId, stage);
    case "DEFINITION INSTANTIATION":
      return instantiate(deps, matchId, runId);
    case "P1 METRIC EXECUTION":
    case "P2 METRIC EXECUTION":
      return executeMetrics(deps, matchId, runId, stage === "P1 METRIC EXECUTION" ? "p1" : "p2");
    case "VERIFICATION AUDIT":
      return executeRules(deps, matchId, runId, "VERIFICATION");
    case "DISAGREEMENT / TRAP AUDIT":
      return executeRules(deps, matchId, runId, "DISAGREEMENT");
    case "DANGEROUS UNDERDOG AUDIT":
      return executeUnderdog(deps, matchId, runId);
    case "STRESS / REMOVAL TESTS":
      return executeStress(deps, matchId, runId);
    case "INDEPENDENT CONCLUSION":
      return commitConclusion(deps, matchId, runId);
    case "MATRIX REVEAL AND COMPARISON":
      return revealMatrix(deps, matchId, runId);
    case "CURRENT CALIBRATION APPLICATION":
      return applyCalibration(deps, matchId, runId);
    case "FINAL COMBINATION GATE":
      return finalGate(deps, matchId, runId);
  }
}

// --------------------------- 1 + 2 identity/context ------------------------

async function identityAndContext(deps: PipelineDeps, matchId: string, runId: string, stage: Stage): Promise<StageOutcome> {
  const match = await deps.getMatch(matchId);
  if (!match) throw new Error("match disappeared");

  const isIdentity = stage === "MATCH IDENTITY VERIFICATION";
  if (isIdentity && match.identity_status === "VERIFIED") return { status: "COMPLETE", done: 2, total: 2 };
  if (!isIdentity && match.surface_status === "VERIFIED" && match.scheduled_date && match.round) {
    return { status: "COMPLETE", done: 6, total: 6 };
  }

  const parsed = await deps.getParsedFields(matchId);
  // Names come only from the uploaded PDF — never substituted.
  const finding = await deps.research.identity({
    p1: match.player1_name,
    p2: match.player2_name,
    hints: {
      tournament: match.tournament_name ?? parsed["tournament"] ?? null,
      round: match.round ?? parsed["round"] ?? null,
      scheduled_date: match.scheduled_date ?? parsed["scheduled_date"] ?? null,
      surface: match.surface ?? parsed["surface"] ?? null,
      event_level: match.event_level ?? parsed["event_level"] ?? null,
    },
  });

  const retrieved = deps.now().toISOString();
  await deps.saveSnapshots(
    runId,
    finding.sources.map((src) => ({
      source_name: src.source_name,
      data_key: isIdentity ? "match_identity" : "match_context",
      raw_value: src.url,
      normalized_value: src.url,
      retrieved_at: src.retrieved_at ?? retrieved,
      reliability: 0.9,
    })),
  );

  if (finding.conflicts.length) {
    await deps.saveConflicts(
      runId,
      finding.conflicts.map((c) => ({
        data_key: c.field,
        critical: ["player_1", "player_2", "surface"].includes(c.field),
        values: c.values,
        resolution_status: "UNRESOLVED",
        resolution_reason: c.note,
      })),
    );
  }

  if (isIdentity) {
    const rows = [
      { field: "player_1", claimed_value: match.player1_name, verified_value: finding.player1_canonical, status: finding.player1_status, note: finding.unresolved_reason },
      { field: "player_2", claimed_value: match.player2_name, verified_value: finding.player2_canonical, status: finding.player2_status, note: finding.unresolved_reason },
    ];
    await deps.saveIdentityRecords(matchId, rows);
    const verified = finding.player1_status === "VERIFIED" && finding.player2_status === "VERIFIED";
    await deps.updateMatch(matchId, {
      identity_status: verified ? "VERIFIED" : finding.player1_status === "CONFLICT" || finding.player2_status === "CONFLICT" ? "CONFLICT" : "UNVERIFIED",
    });
    const done = [finding.player1_status, finding.player2_status].filter((x) => x === "VERIFIED").length;
    return verified
      ? { status: "COMPLETE", done, total: 2 }
      : {
          status: "BLOCKED",
          done,
          total: 2,
          errorCode: "IDENTITY_UNRESOLVED",
          message: finding.unresolved_reason ?? "Player identity could not be resolved against an external tennis source.",
        };
  }

  const patch: Record<string, unknown> = {};
  if (finding.tournament) patch["tournament_name"] = finding.tournament;
  if (finding.event_level) patch["event_level"] = finding.event_level;
  if (finding.round) patch["round"] = finding.round;
  if (finding.scheduled_date) patch["scheduled_date"] = finding.scheduled_date;
  if (finding.surface) patch["surface"] = finding.surface;
  if (finding.indoor !== null && finding.indoor !== undefined) patch["indoor"] = finding.indoor;
  if (finding.best_of) patch["best_of"] = finding.best_of;
  patch["surface_status"] = finding.surface ? finding.surface_status : "UNVERIFIED";
  await deps.updateMatch(matchId, patch);
  await deps.saveIdentityRecords(
    matchId,
    (["tournament", "event_level", "round", "scheduled_date", "surface", "best_of"] as const).map((field) => {
      const value = s(patch[field === "tournament" ? "tournament_name" : field]);
      return {
        field,
        claimed_value: parsed[field] ?? null,
        verified_value: value,
        status: value ? "VERIFIED" : "UNAVAILABLE",
        note: value ? null : finding.unresolved_reason ?? "Retrieval attempted; no authoritative source carried this field.",
      };
    }),
  );

  const fields = ["tournament_name", "event_level", "round", "scheduled_date", "surface", "best_of"];
  const done = fields.filter((f) => patch[f] !== undefined && patch[f] !== null).length;
  // Surface is the only context field that gates the audit.
  return finding.surface
    ? { status: "COMPLETE", done, total: fields.length, detail: { unresolved: fields.filter((f) => patch[f] === undefined) } }
    : {
        status: "BLOCKED",
        done,
        total: fields.length,
        errorCode: "SURFACE_UNRESOLVED",
        message: finding.unresolved_reason ?? "Surface could not be established from any approved source.",
      };
}

// ------------------------------ 3 instantiation ----------------------------

async function instantiate(deps: PipelineDeps, matchId: string, runId: string): Promise<StageOutcome> {
  const match = await deps.getMatch(matchId);
  if (!match) throw new Error("match disappeared");

  const missing: string[] = [];
  const versions: Record<string, string | null> = {
    METRICS: await deps.getActiveVersionId("METRICS"),
    VERIFICATION: await deps.getActiveVersionId("VERIFICATION"),
    DISAGREEMENT: await deps.getActiveVersionId("DISAGREEMENT"),
  };
  for (const [k, v] of Object.entries(versions)) if (!v) missing.push(k);
  if (missing.length) {
    return {
      status: "FAILED",
      done: 0,
      total: 3,
      errorCode: "MISSING_DEFINITIONS",
      message: `No active rule document version for: ${missing.join(", ")}. Upload/activate the definition documents in Rules before running the audit.`,
    };
  }
  await deps.updateRun(runId, {
    metrics_version_id: versions["METRICS"],
    verification_version_id: versions["VERIFICATION"],
    disagreement_version_id: versions["DISAGREEMENT"],
  });

  const [metricDefs, verDefs, disDefs] = await Promise.all([
    deps.getRules(versions["METRICS"]!),
    deps.getRules(versions["VERIFICATION"]!),
    deps.getRules(versions["DISAGREEMENT"]!),
  ]);
  if (!metricDefs.length || !verDefs.length || !disDefs.length) {
    return {
      status: "FAILED",
      done: 0,
      total: 3,
      errorCode: "MISSING_DEFINITIONS",
      message: `Active versions contain no parsed rules (metrics ${metricDefs.length}, verification ${verDefs.length}, disagreement ${disDefs.length}).`,
    };
  }

  const existingMetrics = await deps.list("metric_results", runId);
  const haveMetric = new Set(existingMetrics.map((r) => String(r["metric_code"])));
  const newMetrics = metricDefs
    .filter((d) => !haveMetric.has(d.rule_code))
    .map((d) => ({
      audit_run_id: runId,
      metric_code: d.rule_code,
      metric_name: d.rule_name,
      category: d.severity,
      evidence_family: d.rule_name,
      matrix_derived: false,
      status: "NOT STARTED",
      p1_status: "NOT STARTED",
      p2_status: "NOT STARTED",
    }));
  if (newMetrics.length) await deps.insert("metric_results", newMetrics);

  const existingVer = await deps.list("verification_results", runId);
  const haveVer = new Set(existingVer.map((r) => String(r["rule_code"])));
  const newVer = verDefs
    .filter((d) => !haveVer.has(d.rule_code))
    .map((d) => ({
      audit_run_id: runId,
      rule_id: d.id,
      rule_code: d.rule_code,
      rule_name: d.rule_name,
      severity: d.severity,
      status: "NOT STARTED",
      outcome: "NOT STARTED",
    }));
  if (newVer.length) await deps.insert("verification_results", newVer);

  const existingDis = await deps.list("disagreement_results", runId);
  const haveDis = new Set(existingDis.map((r) => String(r["rule_code"])));
  const newDis = disDefs
    .filter((d) => !haveDis.has(d.rule_code))
    .map((d) => ({
      audit_run_id: runId,
      rule_id: d.id,
      rule_code: d.rule_code,
      rule_name: d.rule_name,
      status: "NOT STARTED",
    }));
  if (newDis.length) await deps.insert("disagreement_results", newDis);

  const existingUnder = await deps.list("underdog_results", runId);
  const haveUnder = new Set(existingUnder.map((r) => `${r["player_side"]}|${r["pathway_code"]}`));
  const newUnder = [match.player1_name, match.player2_name].flatMap((side) =>
    UNDERDOG_PATHWAYS.filter(([code]) => !haveUnder.has(`${side}|${code}`)).map(([code, name]) => ({
      audit_run_id: runId,
      pathway_code: code,
      pathway_name: name,
      player_side: side,
      classification: "UNRESOLVED",
      status: "NOT STARTED",
    })),
  );
  if (newUnder.length) await deps.insert("underdog_results", newUnder);

  const existingStress = await deps.list("stress_results", runId);
  const haveStress = new Set(existingStress.map((r) => String(r["test_code"])));
  const newStress = STRESS_TESTS.filter(([code]) => !haveStress.has(code)).map(([code, name]) => ({
    audit_run_id: runId,
    test_code: code,
    test_name: name,
    status: "NOT STARTED",
    outcome: "NOT STARTED",
  }));
  if (newStress.length) await deps.insert("stress_results", newStress);

  const total = metricDefs.length + verDefs.length + disDefs.length + UNDERDOG_PATHWAYS.length * 2 + STRESS_TESTS.length;
  return {
    status: "COMPLETE",
    done: total,
    total,
    detail: {
      metrics: metricDefs.length,
      verification: verDefs.length,
      disagreement: disDefs.length,
      underdog: UNDERDOG_PATHWAYS.length * 2,
      stress: STRESS_TESTS.length,
    },
  };
}

// ------------------------------ 4 metric execution -------------------------

async function executeMetrics(deps: PipelineDeps, matchId: string, runId: string, side: "p1" | "p2"): Promise<StageOutcome> {
  const match = await deps.getMatch(matchId);
  if (!match) throw new Error("match disappeared");
  const rows = await deps.list("metric_results", runId);
  if (!rows.length) {
    return { status: "FAILED", done: 0, total: 0, errorCode: "MISSING_DEFINITIONS", message: "No metric rows instantiated." };
  }
  const statusKey = side === "p1" ? "p1_status" : "p2_status";
  const pending = rows.filter((r) => !["COMPLETE", "UNAVAILABLE", "EXCLUDED"].includes(String(r[statusKey])));

  const versions = await deps.getActiveVersionId("METRICS");
  const defs = versions ? await deps.getRules(versions) : [];
  const bodyByCode = new Map(defs.map((d) => [d.rule_code, d.body]));
  const digestContext = digestFrom(match, rows).context;

  for (let i = 0; i < pending.length; i += METRIC_BATCH) {
    const batch = pending.slice(i, i + METRIC_BATCH);
    const findings = await deps.research.metrics({
      p1: match.player1_name,
      p2: match.player2_name,
      context: digestContext,
      metrics: batch.map((r) => ({
        code: String(r["metric_code"]),
        name: String(r["metric_name"]),
        body: bodyByCode.get(String(r["metric_code"])) ?? null,
      })),
    });
    const byCode = new Map(findings.map((f) => [f.metric_code, f]));
    for (const row of batch) {
      const code = String(row["metric_code"]);
      const f = byCode.get(code);
      const treatment: Treatment = (side === "p1" ? f?.p1_treatment : f?.p2_treatment) ?? "UNAVAILABLE";
      const value = side === "p1" ? f?.p1_value ?? null : f?.p2_value ?? null;
      const patch: Record<string, unknown> = {
        [side === "p1" ? "p1_value" : "p2_value"]: value,
        [statusKey]: treatmentToStatus(treatment),
        treatment,
        sources: f?.sources ?? [],
        reliability: f?.reliability ?? null,
        sample: f?.sample ?? null,
      };
      if (f?.evidence_family) patch["evidence_family"] = f.evidence_family;
      if (f?.differential) patch["differential"] = f.differential;
      // Metric row status closes only when BOTH sides are treated.
      const otherStatus = String(side === "p1" ? row["p2_status"] : row["p1_status"]);
      const mineDone = ["COMPLETE", "UNAVAILABLE", "EXCLUDED"].includes(treatmentToStatus(treatment));
      const otherDone = ["COMPLETE", "UNAVAILABLE", "EXCLUDED"].includes(otherStatus);
      if (mineDone && otherDone) {
        patch["status"] =
          treatmentToStatus(treatment) === "COMPLETE" || otherStatus === "COMPLETE" ? "COMPLETE" : "UNAVAILABLE";
      }
      await deps.update("metric_results", String(row["id"]), patch);
    }
  }

  const after = await deps.list("metric_results", runId);
  const done = after.filter((r) => ["COMPLETE", "UNAVAILABLE", "EXCLUDED"].includes(String(r[statusKey]))).length;
  return done === after.length
    ? { status: "COMPLETE", done, total: after.length }
    : { status: "BLOCKED", done, total: after.length, errorCode: "METRIC_EXECUTION_INCOMPLETE", message: `${after.length - done} metrics still untreated for ${side.toUpperCase()}.` };
}

// -------------------------- 5 + 6 verification / trap ----------------------

async function executeRules(deps: PipelineDeps, matchId: string, runId: string, kind: "VERIFICATION" | "DISAGREEMENT"): Promise<StageOutcome> {
  const table: ChildTable = kind === "VERIFICATION" ? "verification_results" : "disagreement_results";
  const match = await deps.getMatch(matchId);
  if (!match) throw new Error("match disappeared");
  const rows = await deps.list(table, runId);
  if (!rows.length) {
    return { status: "FAILED", done: 0, total: 0, errorCode: "MISSING_DEFINITIONS", message: `No ${kind.toLowerCase()} rules instantiated.` };
  }
  const metrics = await deps.list("metric_results", runId);
  const evidence = digestFrom(match, metrics);
  const versionId = await deps.getActiveVersionId(kind);
  const defs = versionId ? await deps.getRules(versionId) : [];
  const defByCode = new Map(defs.map((d) => [d.rule_code, d]));

  const pending = rows.filter((r) => !["COMPLETE", "UNAVAILABLE", "EXCLUDED"].includes(String(r["status"])));
  for (let i = 0; i < pending.length; i += RULE_BATCH) {
    const batch = pending.slice(i, i + RULE_BATCH);
    const findings = await deps.research.rules({
      kind,
      evidence,
      rules: batch.map((r) => {
        const def = defByCode.get(String(r["rule_code"]));
        return { code: String(r["rule_code"]), name: String(r["rule_name"]), body: def?.body ?? null, severity: def?.severity ?? "STANDARD" };
      }),
    });
    const byCode = new Map(findings.map((f) => [f.rule_code, f]));
    for (const row of batch) {
      const f = byCode.get(String(row["rule_code"]));
      const patch: Record<string, unknown> =
        kind === "VERIFICATION"
          ? {
              p1_finding: f?.p1_finding ?? null,
              p2_finding: f?.p2_finding ?? null,
              outcome: f?.outcome ?? "UNAVAILABLE",
              severity: f?.severity ?? row["severity"] ?? "STANDARD",
              decision_effect: f?.decision_effect ?? null,
              sources: f?.sources ?? [],
              status: f && f.outcome !== "UNAVAILABLE" ? "COMPLETE" : "UNAVAILABLE",
            }
          : {
              p1_risk: f?.p1_finding ?? null,
              p2_risk: f?.p2_finding ?? null,
              supporting_evidence: f?.supporting_evidence ?? null,
              opposing_evidence: f?.opposing_evidence ?? null,
              contradiction_severity: f?.contradiction_severity ?? "NONE",
              final_effect: f?.final_effect ?? null,
              status: f ? "COMPLETE" : "UNAVAILABLE",
            };
      await deps.update(table, String(row["id"]), patch);
    }
  }

  const after = await deps.list(table, runId);
  const done = after.filter((r) => ["COMPLETE", "UNAVAILABLE", "EXCLUDED"].includes(String(r["status"]))).length;
  return done === after.length
    ? { status: "COMPLETE", done, total: after.length }
    : { status: "BLOCKED", done, total: after.length, errorCode: "RULE_EXECUTION_INCOMPLETE", message: `${after.length - done} ${kind.toLowerCase()} rules unexecuted.` };
}

// ------------------------------ 7 underdog ---------------------------------

async function executeUnderdog(deps: PipelineDeps, matchId: string, runId: string): Promise<StageOutcome> {
  const match = await deps.getMatch(matchId);
  if (!match) throw new Error("match disappeared");
  const rows = await deps.list("underdog_results", runId);
  if (!rows.length) return { status: "FAILED", done: 0, total: 0, errorCode: "MISSING_DEFINITIONS", message: "No underdog pathways instantiated." };
  const metrics = await deps.list("metric_results", runId);
  const evidence = digestFrom(match, metrics);

  for (const side of [match.player1_name, match.player2_name]) {
    const pending = rows.filter((r) => r["player_side"] === side && !["COMPLETE", "UNAVAILABLE", "EXCLUDED"].includes(String(r["status"])));
    if (!pending.length) continue;
    const findings = await deps.research.underdog({
      evidence,
      player_side: side,
      opponent: side === match.player1_name ? match.player2_name : match.player1_name,
      pathways: pending.map((r) => ({ code: String(r["pathway_code"]), name: String(r["pathway_name"]) })),
    });
    const byCode = new Map(findings.map((f) => [f.pathway_code, f]));
    for (const row of pending) {
      const f = byCode.get(String(row["pathway_code"]));
      await deps.update("underdog_results", String(row["id"]), {
        classification: f?.classification ?? "UNRESOLVED",
        evidence: f?.evidence ?? f?.unavailable_reason ?? "Retrieval attempted; no admissible pre-match evidence located.",
        repeatable: f?.repeatable ?? false,
        status: f && f.classification !== "UNRESOLVED" ? "COMPLETE" : "UNAVAILABLE",
      });
    }
  }

  const after = await deps.list("underdog_results", runId);
  const done = after.filter((r) => ["COMPLETE", "UNAVAILABLE", "EXCLUDED"].includes(String(r["status"]))).length;
  return done === after.length
    ? { status: "COMPLETE", done, total: after.length }
    : { status: "BLOCKED", done, total: after.length, errorCode: "UNDERDOG_INCOMPLETE", message: `${after.length - done} pathways unexecuted.` };
}

// ------------------------------ 8 stress tests -----------------------------

async function executeStress(deps: PipelineDeps, matchId: string, runId: string): Promise<StageOutcome> {
  const match = await deps.getMatch(matchId);
  if (!match) throw new Error("match disappeared");
  const rows = await deps.list("stress_results", runId);
  if (!rows.length) return { status: "FAILED", done: 0, total: 0, errorCode: "MISSING_DEFINITIONS", message: "No stress tests instantiated." };
  const metrics = await deps.list("metric_results", runId);
  const evidence = digestFrom(match, metrics);

  // Provisional independent lean, computed from independent evidence only.
  const lean = await provisionalConclusion(deps, matchId, runId, evidence);

  const pending = rows.filter((r) => !["COMPLETE", "UNAVAILABLE", "EXCLUDED"].includes(String(r["status"])));
  const matrixRemoval = pending.filter((r) => ["ST01", "ST02"].includes(String(r["test_code"])));
  const rest = pending.filter((r) => !["ST01", "ST02"].includes(String(r["test_code"])));

  // ST01/ST02 are deterministic: the independent branch consumed no
  // Matrix-derived metric, so removing Matrix cannot move the conclusion.
  const matrixDerivedUsed = metrics.filter((m) => m["matrix_derived"] === true && m["status"] === "COMPLETE").length;
  for (const row of matrixRemoval) {
    await deps.update("stress_results", String(row["id"]), {
      winner_before: lean.winner,
      winner_after: matrixDerivedUsed === 0 ? lean.winner : null,
      range_before: lean.low !== null && lean.high !== null ? `${lean.low}-${lean.high}` : null,
      range_after: lean.low !== null && lean.high !== null ? `${lean.low}-${lean.high}` : null,
      outcome: matrixDerivedUsed === 0 ? "STABLE" : "UNSTABLE",
      status: "COMPLETE",
    });
  }

  if (rest.length) {
    const findings = await deps.research.stress({
      evidence,
      conclusion: lean,
      tests: rest.map((r) => ({ code: String(r["test_code"]), name: String(r["test_name"]) })),
    });
    const byCode = new Map(findings.map((f) => [f.test_code, f]));
    for (const row of rest) {
      const f = byCode.get(String(row["test_code"]));
      await deps.update("stress_results", String(row["id"]), {
        winner_before: lean.winner,
        winner_after: f?.winner_after ?? null,
        range_before: lean.low !== null && lean.high !== null ? `${lean.low}-${lean.high}` : null,
        range_after: f?.range_after ?? null,
        outcome: f?.outcome ?? "UNSTABLE",
        status: f ? "COMPLETE" : "UNAVAILABLE",
      });
    }
  }

  const after = await deps.list("stress_results", runId);
  const done = after.filter((r) => ["COMPLETE", "UNAVAILABLE", "EXCLUDED"].includes(String(r["status"]))).length;
  return done === after.length
    ? { status: "COMPLETE", done, total: after.length }
    : { status: "BLOCKED", done, total: after.length, errorCode: "STRESS_INCOMPLETE", message: `${after.length - done} stress tests unexecuted.` };
}

// --------------------------- 9 independent conclusion ----------------------

async function provisionalConclusion(deps: PipelineDeps, matchId: string, runId: string, evidence: EvidenceDigest): Promise<ConclusionFinding> {
  const [ver, dis, und] = await Promise.all([
    deps.list("verification_results", runId),
    deps.list("disagreement_results", runId),
    deps.list("underdog_results", runId),
  ]);
  return deps.research.conclusion({
    evidence,
    verificationSummary: ver
      .filter((r) => r["outcome"] === "FAIL" || r["outcome"] === "WARN")
      .map((r) => `${r["rule_code"]} ${r["outcome"]}: ${r["p1_finding"] ?? ""} | ${r["p2_finding"] ?? ""}`)
      .join("\n")
      .slice(0, 6000),
    disagreementSummary: dis
      .filter((r) => r["contradiction_severity"] && r["contradiction_severity"] !== "NONE")
      .map((r) => `${r["rule_code"]} ${r["contradiction_severity"]}: ${r["final_effect"] ?? ""}`)
      .join("\n")
      .slice(0, 6000),
    underdogSummary: und
      .filter((r) => r["classification"] === "STRONG" || r["classification"] === "REALISTIC")
      .map((r) => `${r["player_side"]} ${r["pathway_name"]} ${r["classification"]}: ${r["evidence"] ?? ""}`)
      .join("\n")
      .slice(0, 6000),
  });
}

async function commitConclusion(deps: PipelineDeps, matchId: string, runId: string): Promise<StageOutcome> {
  const run = await deps.getLatestRun(matchId);
  if (run?.independent_decision_committed_at) return { status: "COMPLETE", done: 1, total: 1 };
  const match = await deps.getMatch(matchId);
  if (!match) throw new Error("match disappeared");
  const metrics = await deps.list("metric_results", runId);
  const evidence = digestFrom(match, metrics);
  const conclusion = await provisionalConclusion(deps, matchId, runId, evidence);

  const families = new Set(
    metrics
      .filter((m) => m["matrix_derived"] !== true && m["status"] === "COMPLETE" && m["evidence_family"])
      .map((m) => String(m["evidence_family"])),
  );

  if (!conclusion.winner) {
    await deps.updateRun(runId, { effective_evidence_count: families.size, raw_signal_count: metrics.filter((m) => m["status"] === "COMPLETE").length });
    return {
      status: "BLOCKED",
      done: 0,
      total: 1,
      errorCode: "INSUFFICIENT_INDEPENDENT_EVIDENCE",
      message: conclusion.insufficient_reason ?? "Independent evidence was insufficient to commit a conclusion.",
    };
  }

  await deps.updateRun(runId, {
    independent_winner: conclusion.winner,
    independent_low: conclusion.low,
    independent_high: conclusion.high,
    independent_decision_committed_at: deps.now().toISOString(),
    effective_evidence_count: families.size,
    raw_signal_count: metrics.filter((m) => m["status"] === "COMPLETE").length,
  });
  return { status: "COMPLETE", done: 1, total: 1, detail: { winner: conclusion.winner, families: families.size, rationale: conclusion.rationale?.slice(0, 500) ?? null } };
}

// ------------------------------ 10 matrix reveal ---------------------------

async function revealMatrix(deps: PipelineDeps, matchId: string, runId: string): Promise<StageOutcome> {
  const run = await deps.getLatestRun(matchId);
  if (!run?.independent_decision_committed_at) {
    return { status: "BLOCKED", done: 0, total: 1, errorCode: "FIREWALL", message: "Matrix stays sealed until the independent conclusion is committed." };
  }
  const fields = await deps.getParsedFields(matchId);
  const wpRaw = fields["matrix_wp"];
  const wp = wpRaw ? Number(String(wpRaw).replace(/[^\d.]/g, "")) : null;
  await deps.updateRun(runId, { matrix_revealed_at: deps.now().toISOString() });
  return {
    status: "COMPLETE",
    done: 1,
    total: 1,
    detail: {
      matrix_predicted_winner: fields["matrix_predicted_winner"] ?? null,
      matrix_wp: wp,
      agrees_with_independent:
        fields["matrix_predicted_winner"] && run.independent_winner
          ? fields["matrix_predicted_winner"].toLowerCase().includes(run.independent_winner.split(" ").slice(-1)[0]!.toLowerCase())
          : null,
    },
  };
}

// ------------------------------ 11 calibration -----------------------------

async function applyCalibration(deps: PipelineDeps, matchId: string, runId: string): Promise<StageOutcome> {
  const { version, buckets } = await deps.getCalibration();
  if (!version || !buckets.length) {
    return { status: "FAILED", done: 0, total: 1, errorCode: "NO_ACTIVE_CALIBRATION", message: "No active calibration version with buckets is stored." };
  }
  const run = await deps.getLatestRun(matchId);
  const fields = await deps.getParsedFields(matchId);
  const wpRaw = fields["matrix_wp"];
  const wp = wpRaw ? Number(String(wpRaw).replace(/[^\d.]/g, "")) : null;
  const bucket = bucketFor(wp, buckets);
  const rate = bucket ? winRate(bucket.wins, bucket.graded) : null;
  const centre = rate ?? (((run?.independent_low ?? 0) + (run?.independent_high ?? 0)) / 2 || null);
  await deps.updateRun(runId, {
    calibration_version_id: version.id,
    calibrated_low: centre === null ? null : Math.max(0, Math.round(centre - 5)),
    calibrated_high: centre === null ? null : Math.min(100, Math.round(centre + 5)),
  });
  return {
    status: "COMPLETE",
    done: 1,
    total: 1,
    detail: { calibration_version: version.label, version_number: version.version_number, bucket: bucket?.bucket_code ?? null, verified_win_rate: rate },
  };
}

// ------------------------------ 12 final gate ------------------------------

async function buildReport(deps: PipelineDeps, matchId: string, runId: string): Promise<GateReport | null> {
  const match = await deps.getMatch(matchId);
  const run = await deps.getLatestRun(matchId);
  if (!match || !run) return null;
  const [metrics, verification, disagreement, underdog, stress, conflicts, reconstructions, fields] = await Promise.all([
    deps.list("metric_results", runId),
    deps.list("verification_results", runId),
    deps.list("disagreement_results", runId),
    deps.list("underdog_results", runId),
    deps.list("stress_results", runId),
    deps.getConflicts(runId),
    deps.getReconstructions(runId),
    deps.getParsedFields(matchId),
  ]);
  const wpRaw = fields["matrix_wp"];
  const input: EngineInput = {
    match: {
      identity_status: match.identity_status,
      surface_status: match.surface_status,
      player1_name: match.player1_name,
      player2_name: match.player2_name,
    },
    run: {
      research_lock_at: run.research_lock_at,
      independent_decision_committed_at: run.independent_decision_committed_at,
      matrix_revealed_at: run.matrix_revealed_at,
      independent_winner: run.independent_winner,
      independent_low: run.independent_low,
      independent_high: run.independent_high,
      calibration_version_id: run.calibration_version_id,
      effective_evidence_count: run.effective_evidence_count,
    },
    metrics: metrics as never,
    verification: verification as never,
    disagreement: disagreement as never,
    underdog: underdog as never,
    stress: stress as never,
    reconstructions,
    conflicts,
    matrixWp: wpRaw ? Number(String(wpRaw).replace(/[^\d.]/g, "")) : null,
  };
  return evaluate(input);
}

async function finalGate(deps: PipelineDeps, matchId: string, runId: string): Promise<StageOutcome> {
  const report = await buildReport(deps, matchId, runId);
  if (!report) throw new Error("could not build gate report");
  const run = await deps.getLatestRun(matchId);
  const { version, buckets } = await deps.getCalibration();
  const fields = await deps.getParsedFields(matchId);
  const wpRaw = fields["matrix_wp"];
  const wp = wpRaw ? Number(String(wpRaw).replace(/[^\d.]/g, "")) : null;
  const bucket = version ? bucketFor(wp, buckets) : null;
  const rate = bucket ? winRate(bucket.wins, bucket.graded) : null;

  const existingId = await deps.getDecisionId(runId);
  await deps.saveDecision(runId, existingId, {
    audit_run_id: runId,
    final_audit_color: report.color,
    final_selection: report.color.includes("GREEN") ? run?.independent_winner ?? null : null,
    action: report.action,
    gate_report: report as unknown as Record<string, unknown>,
    completion_percent: report.completionPercent,
    audit_complete: report.auditComplete,
    matrix_firewall_valid: report.matrixFirewallValid,
    calibration_bucket: bucket?.bucket_code ?? null,
    verified_win_rate: rate,
  });
  await deps.updateMatch(matchId, { match_status: report.auditComplete ? "COMPLETE" : "PARTIALLY BLOCKED" });

  // The gate itself always executes; the classification may still be INCOMPLETE
  // when an upstream stage genuinely could not obtain evidence.
  return {
    status: "COMPLETE",
    done: Math.round(report.completionPercent),
    total: 100,
    detail: { color: report.color, action: report.action, calibration_version: version?.label ?? null },
  };
}
