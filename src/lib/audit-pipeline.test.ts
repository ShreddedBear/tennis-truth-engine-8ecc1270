// End-to-end regression test for the Run Audit pipeline.
//
// It drives the real orchestrator with an in-memory data layer and a
// deterministic researcher, standing in for "PDF uploaded -> Run Audit ->
// Final Combination Gate". It FAILS if any audited section ends up 0/0,
// which is the exact defect this pipeline was written to fix.
import { describe, expect, it, vi } from "vitest";
import { metricPairPatch, metricRowsForSideExecution, preserveSettledOppositeSide, preserveUsableCurrentSide, runPipeline, preparePipelineRun, enforceStageDependencies, STAGES, type ChildTable, type PipelineDeps, type Researcher, type RunRow, type Stage } from "./audit-pipeline";
import { unmetDependencies, canonicalizeStageRows, resolveActiveRun, isActiveRunStatus, INVALIDATED_RUN_STATUS } from "./audit-stages";
import { dispatchAuditBatch } from "./audit-pipeline.functions";
import { computeExecutionPercent } from "./audit-progress";
import { STRESS_TESTS, UNDERDOG_PATHWAYS } from "./constants";

// Code 070 ("Support Team / Prep") is a genuine LEGITIMATE_PLAYER_METRIC in the real
// canonical registry (metric-classification.ts) -- distinct from and never overlapping
// any real PROTECTED_UNAVAILABLE code. To test the instantiation-time NO_SOURCE wiring
// itself, mock classifyMetric to treat code 070 as PROTECTED_UNAVAILABLE for this test
// file only.
vi.mock("./metric-classification", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./metric-classification")>();
  return {
    ...actual,
    classifyMetric: (code: string | null | undefined) => {
      const match = String(code ?? "").match(/(\d{1,3})$/);
      const normalized = match ? match[1].padStart(3, "0") : String(code ?? "").padStart(3, "0");
      if (normalized === "070") return "PROTECTED_UNAVAILABLE";
      return actual.classifyMetric(normalized);
    },
  };
});

const MATCH_ID = "11111111-1111-1111-1111-111111111111";
const P1 = "Carlos Alcaraz";
const P2 = "Jannik Sinner";

const DEF_COUNTS = { METRICS: 81, VERIFICATION: 60, DISAGREEMENT: 70 } as const;

function defsFor(kind: keyof typeof DEF_COUNTS) {
  const prefix = kind === "METRICS" ? "M" : kind === "VERIFICATION" ? "V" : "D";
  return Array.from({ length: DEF_COUNTS[kind] }, (_, i) => ({
    id: `${prefix}-${i}`,
    rule_code: `${prefix}${String(i + 1).padStart(2, "0")}`,
    rule_name: `${kind} definition ${i + 1}`,
    body: `body ${i + 1}`,
    severity: i % 7 === 0 ? "CRITICAL" : "STANDARD",
    blocking: i % 7 === 0,
  }));
}

const researcher: Researcher = {
  async identity({ p1, p2 }) {
    return {
      player1_canonical: p1,
      player2_canonical: p2,
      player1_status: "VERIFIED",
      player2_status: "VERIFIED",
      tournament: "Test Masters",
      event_level: "ATP 1000",
      round: "QF",
      scheduled_date: "2026-04-12",
      surface: "Hard",
      indoor: false,
      best_of: 3,
      surface_status: "VERIFIED",
      unresolved_reason: null,
      sources: [{ source_name: "atptour.com", url: "https://example.test/match", retrieved_at: null }],
      conflicts: [],
    };
  },
  async metrics({ metrics }) {
    return metrics.map((m, i) => ({
      metric_code: m.code,
      p1_value: `${50 + i}`,
      p2_value: `${48 + i}`,
      p1_treatment: "DIRECT" as const,
      p2_treatment: i % 9 === 0 ? ("RECONSTRUCTED" as const) : ("DIRECT" as const),
      differential: "+2",
      evidence_family: `FAM${i % 8}`,
      reliability: 0.85,
      sample: "last 12 matches",
      unavailable_reason: null,
      sources: [{ source_name: "tennisabstract.com", url: "https://example.test/stat", retrieved_at: null }],
    }));
  },
  async rules({ rules }) {
    return rules.map((r, i) => ({
      rule_code: r.code,
      p1_finding: "no issue found",
      p2_finding: "no issue found",
      outcome: i % 11 === 0 ? ("WARN" as const) : ("PASS" as const),
      severity: (r.severity === "CRITICAL" ? "CRITICAL" : "STANDARD") as "CRITICAL" | "STANDARD",
      decision_effect: "none",
      contradiction_severity: i % 11 === 0 ? ("MINOR" as const) : ("NONE" as const),
      supporting_evidence: "independent evidence",
      opposing_evidence: null,
      final_effect: "no change",
      sources: [{ source_name: "atptour.com", url: "https://example.test/rule", retrieved_at: null }],
    }));
  },
  async underdog({ pathways }) {
    return pathways.map((p, i) => ({
      pathway_code: p.code,
      player_side: P2,
      classification: i % 5 === 0 ? ("REALISTIC" as const) : ("WEAK" as const),
      evidence: "pre-match evidence",
      repeatable: i % 5 === 0,
      unavailable_reason: null,
    }));
  },
  async conclusion() {
    return { winner: P1, low: 58, high: 66, rationale: "independent evidence lean", insufficient_reason: null };
  },
  async stress({ tests }) {
    return tests.map((t) => ({
      test_code: t.code,
      winner_after: P1,
      range_after: "57-65",
      outcome: "STABLE" as const,
      note: "conclusion holds",
    }));
  },
};

function makeMemoryDeps(): { deps: PipelineDeps; tables: Record<string, Array<Record<string, unknown>>>; stages: Map<string, Record<string, unknown>> } {
  const tables: Record<string, Array<Record<string, unknown>>> = {
    metric_results: [],
    verification_results: [],
    disagreement_results: [],
    underdog_results: [],
    stress_results: [],
  };
  const stages = new Map<string, Record<string, unknown>>();
  let seq = 0;
  const match: Record<string, unknown> = {
    id: MATCH_ID,
    player1_name: P1,
    player2_name: P2,
    tournament_name: null,
    event_level: null,
    round: null,
    scheduled_date: null,
    surface: null,
    indoor: null,
    best_of: null,
    identity_status: "UNVERIFIED",
    surface_status: "UNVERIFIED",
    match_status: "PENDING",
  };
  let run: RunRow | null = null;
  let decisionId: string | null = null;
  const decisions: Array<Record<string, unknown>> = [];

  const deps: PipelineDeps = {
    now: () => new Date("2026-04-11T10:00:00Z"),
    research: researcher,
    async getMatch() {
      return match as never;
    },
    async updateMatch(_id, patch) {
      Object.assign(match, patch);
    },
    async getParsedFields() {
      return { matrix_predicted_winner: P1, matrix_wp: "62" };
    },
    async getActiveVersionId(docType) {
      return `v-${docType}`;
    },
    async getRules(versionId) {
      const kind = versionId.replace("v-", "") as keyof typeof DEF_COUNTS;
      return DEF_COUNTS[kind] ? (defsFor(kind) as never) : [];
    },
    async getLatestRun() {
      return run;
    },
    async createRun(row) {
      run = {
        id: "run-1",
        run_number: 1,
        status: "RUNNING",
        research_lock_at: null,
        independent_decision_committed_at: null,
        matrix_revealed_at: null,
        independent_winner: null,
        independent_low: null,
        independent_high: null,
        calibrated_low: null,
        calibrated_high: null,
        calibration_version_id: null,
        effective_evidence_count: 0,
        metrics_version_id: null,
        verification_version_id: null,
        disagreement_version_id: null,
        ...(row as object),
      } as RunRow;
      return run;
    },
    async updateRun(_id, patch) {
      if (run) run = { ...run, ...(patch as object) } as RunRow;
    },
    async list(table: ChildTable) {
      return tables[table]!.map((r) => ({ ...r }));
    },
    async insert(table: ChildTable, rows) {
      for (const r of rows) {
        seq += 1;
        tables[table]!.push({ id: `${table}-${seq}`, ...r });
      }
    },
    async update(table: ChildTable, id, patch) {
      const row = tables[table]!.find((r) => r["id"] === id);
      if (!row) throw new Error(`row ${id} missing in ${table}`);
      Object.assign(row, patch);
    },
    async getStages() {
      return Array.from(stages.values()) as never;
    },
    async setStage(_runId, _matchId, stage, patch) {
      stages.set(stage, {
        stage,
        status: "PENDING",
        attempts: 0,
        error_message: null,
        done_count: 0,
        total_count: 0,
        ...(stages.get(stage) ?? {}),
        ...patch,
      });
    },
    async saveIdentityRecords() {},
    async saveSnapshots() {},
    async saveConflicts() {},
    async getCalibration() {
      return {
        version: { id: "cal-1", label: "CAL v1", version_number: 1 },
        buckets: [
          { bucket_code: "50-59", wp_min: 50, wp_max: 59.99, wins: 20, graded: 34 },
          { bucket_code: "60-69", wp_min: 60, wp_max: 69.99, wins: 41, graded: 60 },
          { bucket_code: "70-79", wp_min: 70, wp_max: 79.99, wins: 33, graded: 42 },
        ],
      };
    },
    async getDecisionId() {
      return decisionId;
    },
    async saveDecision(_runId, existingId, payload) {
      if (existingId) {
        const row = decisions.find((d) => d["id"] === existingId);
        Object.assign(row!, payload);
      } else {
        decisionId = "decision-1";
        decisions.push({ id: decisionId, ...payload });
      }
    },
    async getConflicts() {
      return [];
    },
    async getReconstructions() {
      return tables["metric_results"]!.filter((m) => m["treatment"] === "RECONSTRUCTED").map(() => ({ status: "COMPLETE" }));
    },
    async saveCoverage() {},
    async saveCoverageRates() {},
    async log() {},
  };

  return { deps, tables, stages };
}

// makeMemoryDeps above is single-run only (createRun hardcodes id "run-1",
// list()/getStages() ignore the runId argument entirely) -- fine for every
// existing test, since none of them ever create a second run in the same
// deps instance, but it can't prove cross-run isolation because it has no
// notion of more than one run. makeMultiRunMemoryDeps is a separate,
// properly run-scoped mock -- every table row and stage record is keyed by
// the SAME audit_run_id the real Supabase-backed repo scopes by -- built
// specifically for the Clear Slate regression test below, without touching
// (or risking) the ~15 existing tests that rely on makeMemoryDeps's shape.
function makeMultiRunMemoryDeps(): {
  deps: PipelineDeps;
  runsById: Map<string, RunRow>;
  stagesByRun: Map<string, Map<string, Record<string, unknown>>>;
  tablesByRun: Map<string, Record<ChildTable, Array<Record<string, unknown>>>>;
} {
  const match: Record<string, unknown> = {
    id: MATCH_ID,
    player1_name: P1,
    player2_name: P2,
    tournament_name: null,
    event_level: null,
    round: null,
    scheduled_date: null,
    surface: null,
    indoor: null,
    best_of: null,
    identity_status: "UNVERIFIED",
    surface_status: "UNVERIFIED",
    match_status: "PENDING",
  };
  let runSeq = 0, rowSeq = 0;
  const runsById = new Map<string, RunRow>();
  const stagesByRun = new Map<string, Map<string, Record<string, unknown>>>();
  const tablesByRun = new Map<string, Record<ChildTable, Array<Record<string, unknown>>>>();
  const decisionsByRun = new Map<string, Record<string, unknown>>();

  const emptyTables = (): Record<ChildTable, Array<Record<string, unknown>>> => ({
    metric_results: [],
    reconstruction_results: [],
    verification_results: [],
    disagreement_results: [],
    underdog_results: [],
    stress_results: [],
  });
  const tablesFor = (runId: string) => {
    let t = tablesByRun.get(runId);
    if (!t) { t = emptyTables(); tablesByRun.set(runId, t); }
    return t;
  };
  const stagesFor = (runId: string) => {
    let m = stagesByRun.get(runId);
    if (!m) { m = new Map(); stagesByRun.set(runId, m); }
    return m;
  };

  const deps: PipelineDeps = {
    now: () => new Date("2026-04-11T10:00:00Z"),
    research: researcher,
    async getMatch() { return match as never; },
    async updateMatch(_id, patch) { Object.assign(match, patch); },
    async getParsedFields() { return { matrix_predicted_winner: P1, matrix_wp: "62" }; },
    async getActiveVersionId(docType) { return `v-${docType}`; },
    async getRules(versionId) {
      const kind = versionId.replace("v-", "") as keyof typeof DEF_COUNTS;
      return DEF_COUNTS[kind] ? (defsFor(kind) as never) : [];
    },
    async getLatestRun() {
      const all = [...runsById.values()];
      if (!all.length) return null;
      return all.reduce((a, b) => (a.run_number > b.run_number ? a : b));
    },
    async createRun(row) {
      runSeq += 1;
      const newRun: RunRow = {
        id: `run-${runSeq}`,
        run_number: 1,
        status: "RUNNING",
        research_lock_at: null,
        independent_decision_committed_at: null,
        matrix_revealed_at: null,
        independent_winner: null,
        independent_low: null,
        independent_high: null,
        calibrated_low: null,
        calibrated_high: null,
        calibration_version_id: null,
        effective_evidence_count: 0,
        metrics_version_id: null,
        verification_version_id: null,
        disagreement_version_id: null,
        ...(row as object),
      } as RunRow;
      runsById.set(newRun.id, newRun);
      return newRun;
    },
    async updateRun(id, patch) {
      const existing = runsById.get(id);
      if (existing) runsById.set(id, { ...existing, ...(patch as object) } as RunRow);
    },
    async list(table, runId) { return tablesFor(runId)[table].map((r) => ({ ...r })); },
    async insert(table, rows) {
      for (const r of rows) {
        rowSeq += 1;
        const runId = String(r["audit_run_id"]);
        tablesFor(runId)[table].push({ id: `${table}-${rowSeq}`, ...r });
      }
    },
    async update(table, id, patch) {
      for (const t of tablesByRun.values()) {
        const row = t[table].find((r) => r["id"] === id);
        if (row) { Object.assign(row, patch); return; }
      }
      throw new Error(`row ${id} missing in ${table}`);
    },
    async getStages(runId) { return Array.from(stagesFor(runId).values()) as never; },
    async setStage(runId, _matchId, stage, patch) {
      const m = stagesFor(runId);
      m.set(stage, {
        stage,
        status: "PENDING",
        attempts: 0,
        error_message: null,
        done_count: 0,
        total_count: 0,
        ...(m.get(stage) ?? {}),
        ...patch,
      });
    },
    async saveIdentityRecords() {},
    async saveSnapshots() {},
    async saveConflicts() {},
    async getCalibration() {
      return {
        version: { id: "cal-1", label: "CAL v1", version_number: 1 },
        buckets: [
          { bucket_code: "50-59", wp_min: 50, wp_max: 59.99, wins: 20, graded: 34 },
          { bucket_code: "60-69", wp_min: 60, wp_max: 69.99, wins: 41, graded: 60 },
          { bucket_code: "70-79", wp_min: 70, wp_max: 79.99, wins: 33, graded: 42 },
        ],
      };
    },
    async getDecisionId(runId) { return (decisionsByRun.get(runId)?.["id"] as string) ?? null; },
    async saveDecision(runId, existingId, payload) {
      if (existingId) {
        const row = decisionsByRun.get(runId);
        if (row) Object.assign(row, payload);
      } else {
        decisionsByRun.set(runId, { id: `decision-${runId}`, audit_run_id: runId, ...payload });
      }
    },
    async getConflicts() { return []; },
    async getReconstructions(runId) {
      return tablesFor(runId).metric_results.filter((m) => m["treatment"] === "RECONSTRUCTED").map(() => ({ status: "COMPLETE" }));
    },
    async saveCoverage() {},
    async saveCoverageRates() {},
    async log() {},
  };

  return { deps, runsById, stagesByRun, tablesByRun };
}

describe("Run Audit pipeline", () => {
  it("keeps mixed-availability diagnostics on the unavailable side only", () => {
    const patch = metricPairPatch({
      metric_code: "001", p1_value: "72", p2_value: null,
      p1_treatment: "DIRECT", p2_treatment: "UNAVAILABLE",
      differential: null, evidence_family: "RANKING", reliability: .9, sample: "current",
      unavailable_reason: null, p2_unavailable_reason: "Player 2 ranking was not found.",
      sources: [{ source_name: "official rankings" }],
    }, null, "2026-04-11T10:00:00Z");
    expect(patch.p1_unavailable_reason).toBeNull();
    expect(patch.p2_unavailable_reason).toBe("PLAYER_NOT_FOUND");
    expect(patch.unavailable_detail).toBe("P1: usable | P2: Player 2 ranking was not found.");
  });

  it("does not overwrite a settled opposite side when resuming a legacy one-sided run", () => {
    const patch = preserveSettledOppositeSide(metricPairPatch(undefined, "provider timeout", "2026-04-11T10:00:00Z"), {
      p1_status: "COMPLETE", p1_value: "72", p1_treatment: "DIRECT",
      p2_status: "NOT STARTED",
    }, "p2");
    expect(patch).not.toHaveProperty("p1_value");
    expect(patch).not.toHaveProperty("p1_treatment");
    expect(patch).not.toHaveProperty("p1_unavailable_reason");
    expect(patch.p2_status).toBe("UNAVAILABLE");
    expect(patch.status).toBe("COMPLETE");
  });

  it("persists both independently oriented metric sides from one paired research pass", async () => {
    const { deps, tables } = makeMemoryDeps();
    const metrics = vi.fn(researcher.metrics);
    deps.research = { ...researcher, metrics };

    const result = await runPipeline(deps, MATCH_ID, { budgetMs: 300_000 });

    expect(result.complete).toBe(true);
    const executed = tables.metric_results.filter(row => !["EXCLUDED", "NO_SOURCE"].includes(String(row["p1_status"]))).length;
    expect(metrics).toHaveBeenCalledTimes(Math.ceil(executed / 15) * 2);
    expect(metrics).toHaveBeenCalledWith(expect.objectContaining({ researchSide: "p1", researchPlayer: P1, researchOpponent: P2 }));
    expect(metrics).toHaveBeenCalledWith(expect.objectContaining({ researchSide: "p2", researchPlayer: P2, researchOpponent: P1 }));
    for (const row of tables.metric_results) {
      if (row["p1_status"] === "EXCLUDED" || row["p1_status"] === "NO_SOURCE") continue;
      expect(row["p1_value"]).not.toBeNull();
      expect(row["p2_value"]).not.toBeNull();
      expect(row["p1_status"]).toBe("COMPLETE");
      expect(row["p2_status"]).toBe("COMPLETE");
    }
  });

  it("still runs each player's reconstruction pass after paired research settles both statuses", async () => {
    const { deps } = makeMemoryDeps();
    const extractStats = vi.fn(async ({ player }: { player: string }) => [{
      key: "surface_strength", value: player === P1 ? 71 : 69, player,
      origin: "RECONSTRUCTED" as const, surface: null, window: null,
      sources: [{ source_name: "paired history" }],
    }]);
    deps.research = { ...researcher, extractStats };

    await runPipeline(deps, MATCH_ID, { budgetMs: 300_000 });

    expect(extractStats).toHaveBeenCalledWith(expect.objectContaining({ player: P1 }));
    expect(extractStats).toHaveBeenCalledWith(expect.objectContaining({ player: P2 }));
  });

  it("independently executes P2 source selection for metrics 002 and 003 after P1 settles P2", async () => {
    const { deps, tables } = makeMemoryDeps();
    const calls: Array<{ side: string | undefined; player: string | undefined; opponent: string | undefined; codes: string[] }> = [];
    deps.research = {
      ...researcher,
      async metrics(input) {
        calls.push({
          side: input.researchSide,
          player: input.researchPlayer,
          opponent: input.researchOpponent,
          codes: input.metrics.map(metric => metric.code),
        });
        return input.metrics.map(metric => {
          const targeted = ["M02", "M03"].includes(metric.code);
          if (input.researchSide === "p1") {
            return {
              metric_code: metric.code,
              p1_value: targeted ? `${metric.code}-p1` : null,
              p2_value: null,
              p1_treatment: targeted ? "DIRECT" as const : "UNAVAILABLE" as const,
              p2_treatment: "UNAVAILABLE" as const,
              differential: null,
              evidence_family: targeted ? "PBP_SCORE_STATE" : null,
              reliability: targeted ? .9 : null,
              sample: targeted ? "P1-oriented history" : null,
              unavailable_reason: "P2 not found by P1-oriented selection",
              sources: targeted ? [{ source_name: "p1-oriented-pbp" }] : [],
            };
          }
          return {
            metric_code: metric.code,
            p1_value: null,
            p2_value: targeted ? `${metric.code}-p2` : null,
            p1_treatment: "UNAVAILABLE" as const,
            p2_treatment: targeted ? "DIRECT" as const : "UNAVAILABLE" as const,
            differential: null,
            evidence_family: targeted ? "PBP_SCORE_STATE" : null,
            reliability: targeted ? .88 : null,
            sample: targeted ? "P2-oriented history" : null,
            unavailable_reason: targeted ? null : "No source found",
            sources: targeted ? [{ source_name: "p2-oriented-pbp" }] : [],
          };
        });
      },
    };

    await runPipeline(deps, MATCH_ID, { budgetMs: 300_000 });

    for (const code of ["M02", "M03"]) {
      expect(calls.some(call => call.side === "p1" && call.player === P1 && call.opponent === P2 && call.codes.includes(code))).toBe(true);
      expect(calls.some(call => call.side === "p2" && call.player === P2 && call.opponent === P1 && call.codes.includes(code))).toBe(true);
      const row = tables.metric_results.find(metric => metric.metric_code === code)!;
      expect(row.p1_value).toBe(`${code}-p1`);
      expect(row.p2_value).toBe(`${code}-p2`);
      expect(row.p1_treatment).toBe("DIRECT");
      expect(row.p2_treatment).toBe("DIRECT");
      expect(row.p1_unavailable_reason).toBeNull();
      expect(row.p2_unavailable_reason).toBeNull();
      expect(row.sources).toEqual(expect.arrayContaining([
        expect.objectContaining({ source_name: "p1-oriented-pbp" }),
        expect.objectContaining({ source_name: "p2-oriented-pbp" }),
      ]));
    }
  });

  it("resumes P2 orientation after already processed batches instead of restarting them", () => {
    const rows = Array.from({ length: 34 }, (_, index) => ({
      id: `row-${index}`,
      metric_code: `M${String(index).padStart(2, "0")}`,
      p2_status: index < 2 ? "EXCLUDED" : "COMPLETE",
    })).reverse();
    const resumed = metricRowsForSideExecution(rows, "p2", 17);
    expect(resumed.completedBefore).toBe(17);
    expect(resumed.pending.map(row => row.id)).toEqual(Array.from({ length: 17 }, (_, index) => `row-${index + 17}`));
  });

  it("keeps prior usable P2 evidence when its independent retry genuinely finds no source", () => {
    const row = { p2_value: "68%", p2_treatment: "DIRECT", p2_status: "COMPLETE" };
    const failed = metricPairPatch({
      metric_code: "M02",
      p1_value: null,
      p2_value: null,
      p1_treatment: "UNAVAILABLE",
      p2_treatment: "UNAVAILABLE",
      differential: null,
      evidence_family: null,
      reliability: null,
      sample: null,
      unavailable_reason: "No P2 source found",
      sources: [],
    }, null, "2026-08-30T00:00:00.000Z");
    const preserved = preserveUsableCurrentSide(failed, row, "p2");
    expect(preserved.p2_value).toBeUndefined();
    expect(preserved.p2_treatment).toBeUndefined();
    expect(preserved.p2_unavailable_reason).toBeUndefined();
    expect(preserved.status).toBe("COMPLETE");
  });

  it("leaves P2 unavailable when both independent orientations find no P2 evidence", async () => {
    const { deps, tables } = makeMemoryDeps();
    deps.research = {
      ...researcher,
      async metrics(input) {
        return input.metrics.map(metric => ({
          metric_code: metric.code,
          p1_value: input.researchSide === "p1" && metric.code === "M02" ? "74%" : null,
          p2_value: null,
          p1_treatment: input.researchSide === "p1" && metric.code === "M02" ? "DIRECT" as const : "UNAVAILABLE" as const,
          p2_treatment: "UNAVAILABLE" as const,
          differential: null,
          evidence_family: metric.code === "M02" ? "PBP_SCORE_STATE" : null,
          reliability: metric.code === "M02" ? .9 : null,
          sample: metric.code === "M02" ? "P1-only history" : null,
          unavailable_reason: "No P2 source found",
          sources: metric.code === "M02" ? [{ source_name: "p1-only-pbp" }] : [],
        }));
      },
    };
    await runPipeline(deps, MATCH_ID, { budgetMs: 300_000 });
    const row = tables.metric_results.find(metric => metric.metric_code === "M02")!;
    expect(row.p1_value).toBe("74%");
    expect(row.p1_treatment).toBe("DIRECT");
    expect(row.p2_value).toBeNull();
    expect(row.p2_treatment).toBe("UNAVAILABLE");
    expect(row.p2_unavailable_reason).toBe("NO_SOURCE_FOUND");
  });

  it("keeps every required denominator when all research providers fail", async () => {
    const { deps, tables, stages } = makeMemoryDeps();
    const failure = async () => {
      throw new Error("Research provider credits exhausted (402)");
    };
    deps.research = {
      ...researcher,
      identity: failure,
      metrics: failure,
      rules: failure,
      underdog: failure,
      conclusion: failure,
      stress: failure,
    };

    const result = await runPipeline(deps, MATCH_ID, { budgetMs: 120_000 });

    expect(result.complete).toBe(true);
    expect(result.report?.color).toBe("INSUFFICIENT EVIDENCE");
    expect(result.report?.counts.metrics.total).toBe(DEF_COUNTS.METRICS);
    expect(result.report?.counts.verification.total).toBe(DEF_COUNTS.VERIFICATION);
    expect(result.report?.counts.disagreement.total).toBe(DEF_COUNTS.DISAGREEMENT);
    expect(result.report?.counts.underdog.total).toBe(UNDERDOG_PATHWAYS.length * 2);
    expect(result.report?.counts.stress.total).toBe(STRESS_TESTS.length);
    expect(result.report?.counts.p1.total).toBe(DEF_COUNTS.METRICS);
    expect(result.report?.counts.p2.total).toBe(DEF_COUNTS.METRICS);
    expect(tables["metric_results"]!.every((row) => ["UNAVAILABLE", "EXCLUDED", "NO_SOURCE"].includes(String(row["p1_status"]))))
      .toBe(true);
    expect(tables["metric_results"]!.every((row) => ["UNAVAILABLE", "EXCLUDED", "NO_SOURCE"].includes(String(row["p2_status"]))))
      .toBe(true);
    expect(Array.from(stages.values()).every((row) => row["status"] === "COMPLETE")).toBe(true);
  }, 60_000);

  it("executes every stage and leaves no section at 0/0", async () => {
    const { deps, tables, stages } = makeMemoryDeps();

    const result = await runPipeline(deps, MATCH_ID, { budgetMs: 120_000 });

    // Every stage must have executed and recorded a per-stage diagnostic.
    for (const stage of STAGES) {
      const row = stages.get(stage);
      expect(row, `stage ${stage} never executed`).toBeTruthy();
      expect(row!["status"], `stage ${stage} did not complete: ${String(row!["error_message"])}`).toBe("COMPLETE");
    }

    // Real denominators, and no section may be 0/0.
    const sections: Array<[ChildTable, number]> = [
      ["metric_results", DEF_COUNTS.METRICS],
      ["verification_results", DEF_COUNTS.VERIFICATION],
      ["disagreement_results", DEF_COUNTS.DISAGREEMENT],
      ["underdog_results", UNDERDOG_PATHWAYS.length * 2],
      ["stress_results", STRESS_TESTS.length],
    ];
    for (const [table, expected] of sections) {
      expect(tables[table]!.length, `${table} instantiated 0 rows (0/0 defect)`).toBeGreaterThan(0);
      expect(tables[table]!.length, `${table} denominator wrong`).toBe(expected);
      const executed = tables[table]!.filter((r) => ["COMPLETE", "UNAVAILABLE", "EXCLUDED", "NO_SOURCE"].includes(String(r["status"])));
      expect(executed.length, `${table} has unexecuted rows`).toBe(expected);
    }

    // Matrix firewall: the independent conclusion precedes the reveal.
    const run = await deps.getLatestRun(MATCH_ID);
    expect(run?.independent_winner).toBe(P1);
    expect(run?.independent_decision_committed_at).toBeTruthy();
    expect(run?.matrix_revealed_at).toBeTruthy();
    expect(new Date(run!.independent_decision_committed_at!).getTime()).toBeLessThanOrEqual(
      new Date(run!.matrix_revealed_at!).getTime(),
    );

    // Calibration and the final gate ran.
    expect(run?.calibration_version_id).toBe("cal-1");
    expect(result.report).not.toBeNull();
    expect(result.report!.completionPercent).toBeGreaterThan(0);
    expect(result.complete).toBe(true);
  }, 60_000);

  // Regression: production's metric_results.p1_treatment/p2_treatment columns are
  // `not null` with a check constraint restricted to a fixed allow-list. instantiate()
  // once inserted `null` for any not-yet-researched row (the placeholder before
  // executeMetrics ever runs), which is legal against this in-memory fake but violates
  // the real not-null constraint and rejects the whole batch insert -- surfacing as
  // Definition Instantiation permanently stuck (see the DB error this test file's
  // sibling migration 20260829091200_allow_no_source_treatment.sql documents). Every
  // instantiated row must carry a real, allow-listed treatment value on both sides at
  // all times, before any research has run.
  it("never instantiates a metric row with a null or non-allow-listed treatment value", async () => {
    const ALLOWED = new Set(["DIRECT", "RECONSTRUCTED", "PARTIAL", "UNAVAILABLE", "EXCLUDED", "NO_SOURCE"]);
    const { deps, tables } = makeMemoryDeps();

    await runPipeline(deps, MATCH_ID, { budgetMs: 120_000 });

    for (const row of tables["metric_results"]!) {
      expect(row["p1_treatment"], `metric ${row["metric_code"]} p1_treatment must not be null`).not.toBeNull();
      expect(row["p2_treatment"], `metric ${row["metric_code"]} p2_treatment must not be null`).not.toBeNull();
      expect(ALLOWED.has(String(row["p1_treatment"])), `metric ${row["metric_code"]} p1_treatment "${row["p1_treatment"]}" not allow-listed`).toBe(true);
      expect(ALLOWED.has(String(row["p2_treatment"])), `metric ${row["metric_code"]} p2_treatment "${row["p2_treatment"]}" not allow-listed`).toBe(true);
    }
  }, 60_000);

  it("dispatches every prepared match when concurrency is 4", async () => {
    const matchIds = Array.from({ length: 12 }, (_, i) => `match-${i + 1}`);
    const seen: string[] = [];
    const running = new Set<string>();
    const maxRunning = { value: 0 };

    await dispatchAuditBatch({
      matches: matchIds.map((matchId) => ({ matchId })),
      concurrency: 4,
      budgetMs: 5_000,
    }, async (match) => {
      const matchId = match.matchId;
      running.add(matchId);
      maxRunning.value = Math.max(maxRunning.value, running.size);
      await new Promise((resolve) => setTimeout(resolve, 10));
      seen.push(matchId);
      running.delete(matchId);
      return { matchId };
    });

    expect(seen).toHaveLength(12);
    expect(seen).toEqual(matchIds);
    expect(maxRunning.value).toBeLessThanOrEqual(4);
  }, 30_000);

  it("reclaims an expired RUNNING audit by refreshing the lease before resuming", async () => {
    const staleLockBefore = new Date("2026-04-10T00:00:00Z");
    const now = new Date("2026-04-11T12:00:00Z");
    let currentRun: RunRow = {
      id: "run-expired",
      match_id: MATCH_ID,
      run_number: 9,
      status: "RUNNING",
      research_lock_at: staleLockBefore.toISOString(),
      independent_decision_committed_at: null,
      matrix_revealed_at: null,
      independent_winner: null,
      independent_low: null,
      independent_high: null,
      calibrated_low: null,
      calibrated_high: null,
      calibration_version_id: null,
      effective_evidence_count: 0,
      metrics_version_id: null,
      verification_version_id: null,
      disagreement_version_id: null,
    };

    const { deps } = makeMemoryDeps();
    deps.now = () => now;
    deps.getLatestRun = async () => currentRun;
    deps.updateRun = async (_id, patch) => {
      currentRun = { ...currentRun, ...(patch as object) } as RunRow;
    };

    const result = await runPipeline(deps, MATCH_ID, { budgetMs: 120_000 });

    expect(result.runId).toBe("run-expired");
    expect(currentRun.research_lock_at).toBe(now.toISOString());
    expect(["RUNNING", "COMPLETE"]).toContain(currentRun.status);
    expect(result.complete).toBe(true);
  }, 60_000);

  it("is idempotent: a second run adds no duplicate records", async () => {
    const { deps, tables } = makeMemoryDeps();
    await runPipeline(deps, MATCH_ID, { budgetMs: 120_000 });
    const before = Object.fromEntries(Object.entries(tables).map(([k, v]) => [k, v.length]));
    await runPipeline(deps, MATCH_ID, { budgetMs: 120_000 });
    const after = Object.fromEntries(Object.entries(tables).map(([k, v]) => [k, v.length]));
    expect(after).toEqual(before);
  }, 60_000);

  // Task 20/21 guardrail: META_OR_NON_PLAYER codes (metric-classification.ts) must
  // never silently re-enter the player-evidence denominator. They are instantiated
  // EXCLUDED (never sent to any research/reconstruction call) rather than scored as a
  // player metric, so a regression here would mean either a code was reclassified
  // without updating this test, or the exclusion wiring in instantiate() broke.
  //
  // Only "48","49","50","56","57","58","59" are META_OR_NON_PLAYER under the canonical
  // registry. "04"/"05"/"06" are real player metrics (Combined Efficiency/Recent Form/
  // Opponent Quality -- a document numbering defect that once shadowed them was fixed
  // separately; see metric-definition-drift.test.ts). "47" and "61" are
  // UNKNOWN_REQUIRES_REVIEW, not excluded: the burden of proof for exclusion is not met,
  // so they stay in the ordinary player-metric/research path like any other code.
  it("instantiates every META_OR_NON_PLAYER code as EXCLUDED and never asks research for it", async () => {
    const META_SUFFIXES = ["48", "49", "50", "56", "57", "58", "59"];
    const seenByResearch = new Set<string>();
    const { deps, tables } = makeMemoryDeps();
    deps.research = {
      ...researcher,
      async metrics({ metrics }) {
        for (const m of metrics) seenByResearch.add(m.code);
        return researcher.metrics({ metrics } as never);
      },
    };

    await runPipeline(deps, MATCH_ID, { budgetMs: 120_000 });

    const metricRows = tables["metric_results"]!;
    expect(metricRows).toHaveLength(DEF_COUNTS.METRICS);
    const metaCodes = META_SUFFIXES.map((suffix) => `M${suffix}`);
    expect(metaCodes).toHaveLength(7);

    for (const code of metaCodes) {
      const row = metricRows.find((r) => r["metric_code"] === code);
      expect(row, `metric ${code} was not instantiated`).toBeTruthy();
      expect(row!["status"], `metric ${code} status`).toBe("EXCLUDED");
      expect(row!["p1_status"], `metric ${code} p1_status`).toBe("EXCLUDED");
      expect(row!["p2_status"], `metric ${code} p2_status`).toBe("EXCLUDED");
      expect(seenByResearch.has(code), `metric ${code} was sent to the research provider`).toBe(false);
    }

    // Every other code (including "04"/"05"/"06"/"47"/"61") must still be a normal
    // player metric, sent to research as before -- except the 14 codes genuinely
    // classified PROTECTED_UNAVAILABLE in the real canonical registry (017, 054, 063,
    // 065, 066, 067, 069, 072, 073, 074, 076, 078, 079, 081), which this pipeline
    // correctly settles as NO_SOURCE before ever reaching research, same as
    // META_OR_NON_PLAYER. "M70" is excluded here too, on top of those 14: this test
    // file's module-level mock (see the top of this file) additionally treats real code
    // 070 as PROTECTED_UNAVAILABLE for the dedicated test below, and that mock is
    // file-scoped, so it also applies here.
    const realProtectedUnavailableCodes = ["017", "054", "063", "065", "066", "067", "069", "072", "073", "074", "076", "078", "079", "081"].map((suffix) => `M${suffix.replace(/^0/, "")}`);
    const noSourceCodes = new Set([...realProtectedUnavailableCodes, "M70"]);
    const playerCodes = metricRows.map((r) => String(r["metric_code"])).filter((c) => !metaCodes.includes(c) && !noSourceCodes.has(c));
    expect(playerCodes).toHaveLength(DEF_COUNTS.METRICS - 7 - noSourceCodes.size);
    for (const code of playerCodes) expect(seenByResearch.has(code), `player metric ${code} was never sent to research`).toBe(true);
  }, 60_000);

  // Denominator-eligibility audit, requested directly: a code with a documented
  // NO_SOURCE determination must instantiate exactly like META_OR_NON_PLAYER -- settled
  // immediately, never sent to research -- but as a distinct status, never "EXCLUDED".
  // classifyMetric is mocked above to treat "M70" (real code 070) as PROTECTED_UNAVAILABLE.
  // "M59" (real code 059, "Loss Path Probability") is used here as the real
  // META_OR_NON_PLAYER reference code -- it is genuinely excluded under the canonical
  // registry, unlike "M61" (061 is a resolved LEGITIMATE_PLAYER_METRIC -- see
  // docs/audit-task-047-061-classification-decisions.md -- not excluded).
  it("instantiates a NO_SOURCE code as NO_SOURCE (not EXCLUDED) and never asks research for it, while a real META_OR_NON_PLAYER code stays EXCLUDED", async () => {
    const seenByResearch = new Set<string>();
    const { deps, tables } = makeMemoryDeps();
    deps.research = {
      ...researcher,
      async metrics({ metrics }) {
        for (const m of metrics) seenByResearch.add(m.code);
        return researcher.metrics({ metrics } as never);
      },
    };

    await runPipeline(deps, MATCH_ID, { budgetMs: 120_000 });

    const metricRows = tables["metric_results"]!;
    const noSourceRow = metricRows.find((r) => r["metric_code"] === "M70");
    expect(noSourceRow, "metric M70 was not instantiated").toBeTruthy();
    expect(noSourceRow!["status"]).toBe("NO_SOURCE");
    expect(noSourceRow!["p1_status"]).toBe("NO_SOURCE");
    expect(noSourceRow!["p2_status"]).toBe("NO_SOURCE");
    // p1_treatment/p2_treatment intentionally stay "UNAVAILABLE" (a schema-safe,
    // allow-listed value) rather than "NO_SOURCE" -- see the comment above instantiate()
    // in audit-pipeline.ts. status/p1_status/p2_status above carry the real "NO_SOURCE"
    // signal, and audit-engine.ts's coverage math re-derives NO_SOURCE from the metric
    // code independently of the stored treatment (see audit-engine.test.ts).
    expect(noSourceRow!["p1_treatment"]).toBe("UNAVAILABLE");
    expect(noSourceRow!["p2_treatment"]).toBe("UNAVAILABLE");
    expect(noSourceRow!["unavailable_reason"]).toBe("NO_SOURCE_NO_LEGITIMATE_PATHWAY");
    expect(seenByResearch.has("M70"), "metric M70 was sent to the research provider").toBe(false);

    const metaRow = metricRows.find((r) => r["metric_code"] === "M59");
    expect(metaRow!["status"]).toBe("EXCLUDED");
    expect(metaRow!["unavailable_reason"]).toBe("PROCESS_META_NOT_PLAYER_EVIDENCE");
  }, 60_000);

  // Regression: a stage failure whose own FAILED-status DB write also throws (e.g. a
  // Supabase client that is misconfigured or transiently unreachable while the pipeline
  // is trying to record the error) must not escape runPipeline as an unhandled
  // rejection that loses the stage attribution. Previously this surfaced only as a
  // generic top-level "PIPELINE" failure with no indication of which stage or run was
  // affected, which is indistinguishable from the stage silently never getting marked
  // FAILED (the observed "stuck at RUNNING 0/0 forever" symptom) from the caller's
  // point of view. runPipeline must resolve normally and attribute the failure to the
  // actual stage, with nextStage pointing at it so a resumed run retries the right
  // stage instead of restarting blind.
  it("attributes a failure to the real stage when the error-path status write itself throws, instead of an unhandled rejection", async () => {
    const { deps } = makeMemoryDeps();
    deps.getRules = async () => {
      throw new Error("boom: rule_documents read failed");
    };
    const realSetStage = deps.setStage.bind(deps);
    deps.setStage = async (runId, matchId, stage, patch) => {
      if (stage === "DEFINITION INSTANTIATION" && patch["status"] === "FAILED") {
        throw new Error("boom: could not write FAILED status (client misconfigured)");
      }
      return realSetStage(runId, matchId, stage, patch);
    };

    const result = await runPipeline(deps, MATCH_ID, { budgetMs: 120_000 });

    expect(result.failures.length).toBeGreaterThan(0);
    expect(result.failures[0]!.stage).toBe("DEFINITION INSTANTIATION");
    expect(result.failures[0]!.message).toContain("could not persist FAILED status");
    expect(result.nextStage).toBe("DEFINITION INSTANTIATION");
  }, 60_000);

  it("does not execute provider work when another driver owns the persisted run lease", async()=>{
    const{deps,tables}=makeMemoryDeps();
    let providerCalls=0;
    deps.acquireRunLease=async()=>false;
    deps.research={...researcher,async metrics(input){providerCalls++;return researcher.metrics(input);}};

    const result=await runPipeline(deps,MATCH_ID,{budgetMs:120_000});

    expect(result.leaseHeld).toBe(true);
    expect(result.complete).toBe(false);
    expect(result.failures).toEqual([]);
    expect(providerCalls).toBe(0);
    expect(tables.metric_results).toHaveLength(0);
  });

  it("uses wide bounded metric batches instead of repeating five-metric provider calls", async()=>{
    const{deps}=makeMemoryDeps();
    const batchSizes:number[]=[];
    deps.research={...researcher,async metrics(input){batchSizes.push(input.metrics.length);return researcher.metrics(input);}};

    const result=await runPipeline(deps,MATCH_ID,{budgetMs:120_000});

    expect(result.complete).toBe(true);
    expect(Math.max(...batchSizes)).toBeLessThanOrEqual(15);
    expect(batchSizes.some(size=>size===15)).toBe(true);
    expect(batchSizes.length).toBeLessThanOrEqual(12);
  },60_000);

  it("renews and releases the run lease while persisting stage progress",async()=>{
    const{deps}=makeMemoryDeps();
    let renewals=0,releases=0;
    deps.acquireRunLease=async()=>true;
    deps.renewRunLease=async()=>{renewals++;return true;};
    deps.releaseRunLease=async()=>{releases++;};

    const result=await runPipeline(deps,MATCH_ID,{budgetMs:120_000});

    expect(result.complete).toBe(true);
    expect(renewals).toBeGreaterThan(0);
    expect(releases).toBe(1);
  },60_000);
});

// ----------------------------------------------------------------------------
// Regression suite for the dependency-ordered state machine: a downstream
// stage must not report COMPLETE merely because its own function ran -- it
// must prove every required upstream stage already persisted COMPLETE.
// enforceStageDependencies/unmetDependencies are pure functions, so these
// tests exercise the actual write-gating logic directly rather than trying
// to contrive a scenario through the full pipeline (which, by the loop's own
// strictly sequential design, can never itself reach an out-of-order state --
// these guards are what make that an enforced invariant rather than an
// incidental property of today's loop shape).
// ----------------------------------------------------------------------------
describe("Stage dependency gate: enforceStageDependencies / unmetDependencies", () => {
  const complete = (...names: Stage[]) => names.map((stage) => ({ stage, status: "COMPLETE" }));

  it("allows a stage to complete once every required upstream stage is COMPLETE", () => {
    const rows = complete("MATCH INGESTION / PDF EXTRACTION", "MATCH IDENTITY VERIFICATION", "MATCH CONTEXT RESOLUTION", "DEFINITION INSTANTIATION");
    const guard = enforceStageDependencies("P1 METRIC EXECUTION", { status: "COMPLETE" }, rows);
    expect(guard.blocked).toBe(false);
    expect(guard.patch["status"]).toBe("COMPLETE");
    expect(guard.missing).toEqual([]);
  });

  it("a fresh audit starts with Match Ingestion / PDF Extraction and cannot skip ahead", () => {
    const guard = enforceStageDependencies("MATCH IDENTITY VERIFICATION", { status: "COMPLETE" }, []);
    expect(guard.blocked).toBe(true);
    expect(guard.missing).toEqual(["MATCH INGESTION / PDF EXTRACTION"]);
  });

  it("Match Identity Verification cannot report COMPLETE before Match Ingestion / PDF Extraction", () => {
    const guard = enforceStageDependencies("MATCH IDENTITY VERIFICATION", { status: "COMPLETE" }, []);
    expect(guard.blocked).toBe(true);
    expect(guard.patch["status"]).toBe("BLOCKED");
    expect(guard.missing).toEqual(["MATCH INGESTION / PDF EXTRACTION"]);
  });

  it("Match Context Resolution cannot report COMPLETE before Match Identity Verification", () => {
    const rows = complete("MATCH INGESTION / PDF EXTRACTION");
    const guard = enforceStageDependencies("MATCH CONTEXT RESOLUTION", { status: "COMPLETE" }, rows);
    expect(guard.blocked).toBe(true);
    expect(guard.missing).toEqual(["MATCH IDENTITY VERIFICATION"]);
  });

  it("P1 cannot report COMPLETE before ingestion/identity/context/definition instantiation are COMPLETE", () => {
    const guard = enforceStageDependencies("P1 METRIC EXECUTION", { status: "COMPLETE" }, complete("MATCH INGESTION / PDF EXTRACTION", "MATCH IDENTITY VERIFICATION"));
    expect(guard.blocked).toBe(true);
    expect(guard.patch["status"]).toBe("BLOCKED");
    expect(guard.patch["error_code"]).toBe("UPSTREAM_DEPENDENCY_INCOMPLETE");
    expect(guard.missing).toEqual(["MATCH CONTEXT RESOLUTION", "DEFINITION INSTANTIATION"]);
  });

  it("P2 cannot report COMPLETE while P1 (or anything before it) is not COMPLETE", () => {
    const rows = complete("MATCH INGESTION / PDF EXTRACTION", "MATCH IDENTITY VERIFICATION", "MATCH CONTEXT RESOLUTION", "DEFINITION INSTANTIATION");
    const guard = enforceStageDependencies("P2 METRIC EXECUTION", { status: "COMPLETE" }, rows);
    expect(guard.blocked).toBe(true);
    expect(guard.missing).toEqual(["P1 METRIC EXECUTION"]);
  });

  it("Verification Audit cannot complete before P1/P2 metric execution", () => {
    const rows = complete("MATCH INGESTION / PDF EXTRACTION", "MATCH IDENTITY VERIFICATION", "MATCH CONTEXT RESOLUTION", "DEFINITION INSTANTIATION", "P1 METRIC EXECUTION");
    const guard = enforceStageDependencies("VERIFICATION AUDIT", { status: "COMPLETE" }, rows);
    expect(guard.blocked).toBe(true);
    expect(guard.missing).toEqual(["P2 METRIC EXECUTION"]);
  });

  it("Disagreement, Dangerous Underdog and Stress/Removal cannot complete before Verification Audit", () => {
    const rows = complete("MATCH INGESTION / PDF EXTRACTION", "MATCH IDENTITY VERIFICATION", "MATCH CONTEXT RESOLUTION", "DEFINITION INSTANTIATION", "P1 METRIC EXECUTION", "P2 METRIC EXECUTION");
    for (const stage of ["DISAGREEMENT / TRAP AUDIT", "DANGEROUS UNDERDOG AUDIT", "STRESS / REMOVAL TESTS"] as const) {
      const guard = enforceStageDependencies(stage, { status: "COMPLETE" }, rows);
      expect(guard.blocked, `${stage} must be blocked without VERIFICATION AUDIT`).toBe(true);
      expect(guard.missing).toContain("VERIFICATION AUDIT");
    }
  });

  it("Independent Conclusion cannot complete before verification, disagreement, underdog and stress are all COMPLETE", () => {
    const rows = complete("MATCH INGESTION / PDF EXTRACTION", "MATCH IDENTITY VERIFICATION", "MATCH CONTEXT RESOLUTION", "DEFINITION INSTANTIATION", "P1 METRIC EXECUTION", "P2 METRIC EXECUTION", "VERIFICATION AUDIT", "DISAGREEMENT / TRAP AUDIT", "DANGEROUS UNDERDOG AUDIT");
    const guard = enforceStageDependencies("INDEPENDENT CONCLUSION", { status: "COMPLETE" }, rows);
    expect(guard.blocked).toBe(true);
    expect(guard.missing).toEqual(["STRESS / REMOVAL TESTS"]);
  });

  it("Current Calibration cannot complete before the independent conclusion is committed and the matrix is revealed", () => {
    const rows = complete(...STAGES.slice(0, STAGES.indexOf("MATRIX REVEAL AND COMPARISON")));
    const guard = enforceStageDependencies("CURRENT CALIBRATION APPLICATION", { status: "COMPLETE" }, rows);
    expect(guard.blocked).toBe(true);
    expect(guard.missing).toEqual(["MATRIX REVEAL AND COMPARISON"]);
  });

  it("Coverage Persistence / Evidence Validation cannot complete before Current Calibration", () => {
    const rows = complete(...STAGES.slice(0, STAGES.indexOf("CURRENT CALIBRATION APPLICATION")));
    const guard = enforceStageDependencies("COVERAGE PERSISTENCE / EVIDENCE VALIDATION", { status: "COMPLETE" }, rows);
    expect(guard.blocked).toBe(true);
    expect(guard.missing).toEqual(["CURRENT CALIBRATION APPLICATION"]);
  });

  it("Final Decision cannot complete before Coverage Persistence / Evidence Validation", () => {
    const rows = complete(...STAGES.slice(0, STAGES.indexOf("COVERAGE PERSISTENCE / EVIDENCE VALIDATION")));
    const guard = enforceStageDependencies("FINAL DECISION", { status: "COMPLETE" }, rows);
    expect(guard.blocked).toBe(true);
    expect(guard.missing).toEqual(["COVERAGE PERSISTENCE / EVIDENCE VALIDATION"]);
  });

  it("Final Combination Gate cannot complete before Final Decision (its immediate prerequisite)", () => {
    const rows = complete(...STAGES.slice(0, STAGES.length - 2));
    const guard = enforceStageDependencies("FINAL COMBINATION GATE", { status: "COMPLETE" }, rows);
    expect(guard.blocked).toBe(true);
    expect(guard.missing).toEqual(["FINAL DECISION"]);
  });

  it("Final Combination Gate cannot complete while P1/P2/verification/disagreement/underdog/stress/conclusion/calibration/coverage/final-decision are missing, not just the immediate predecessor", () => {
    // Only the very first stage is done -- everything else, including P1/P2
    // required metrics, is missing.
    const guard = enforceStageDependencies("FINAL COMBINATION GATE", { status: "COMPLETE" }, complete("MATCH INGESTION / PDF EXTRACTION"));
    expect(guard.blocked).toBe(true);
    expect(guard.missing).toEqual(STAGES.slice(1, STAGES.length - 1));
    expect(guard.missing).toEqual(expect.arrayContaining(["P1 METRIC EXECUTION", "P2 METRIC EXECUTION", "VERIFICATION AUDIT", "DANGEROUS UNDERDOG AUDIT", "STRESS / REMOVAL TESTS", "INDEPENDENT CONCLUSION", "CURRENT CALIBRATION APPLICATION", "COVERAGE PERSISTENCE / EVIDENCE VALIDATION", "FINAL DECISION"]));
  });

  it("a FAILED or BLOCKED prerequisite blocks every stage that transitively depends on it, not just the immediate next one", () => {
    const rows = [...complete("MATCH INGESTION / PDF EXTRACTION", "MATCH IDENTITY VERIFICATION", "MATCH CONTEXT RESOLUTION", "DEFINITION INSTANTIATION"), { stage: "P1 METRIC EXECUTION", status: "FAILED" }];
    const dependents = STAGES.slice(STAGES.indexOf("P2 METRIC EXECUTION"));
    for (const stage of dependents) {
      const guard = enforceStageDependencies(stage, { status: "COMPLETE" }, rows);
      expect(guard.blocked, `${stage} must stay blocked while P1 METRIC EXECUTION is FAILED`).toBe(true);
      expect(guard.missing).toContain("P1 METRIC EXECUTION");
    }
  });

  it("never rewrites a non-COMPLETE status write (RUNNING/BLOCKED/FAILED pass through untouched, regardless of dependency state)", () => {
    const guard = enforceStageDependencies("FINAL COMBINATION GATE", { status: "RUNNING", done_count: 3 }, []);
    expect(guard.blocked).toBe(false);
    expect(guard.patch).toEqual({ status: "RUNNING", done_count: 3 });
  });

  it("re-running a stage that is already validly COMPLETE does not create a false duplicate completion record: repeated calls are idempotent", () => {
    const rows = complete(...STAGES);
    const first = enforceStageDependencies("FINAL COMBINATION GATE", { status: "COMPLETE" }, rows);
    const second = enforceStageDependencies("FINAL COMBINATION GATE", { status: "COMPLETE" }, rows);
    expect(first).toEqual(second);
    expect(first.blocked).toBe(false);
  });
});

describe("Stage dependency gate: enforced through the real pipeline (runPipeline)", () => {
  it("a failed/incomplete prerequisite (missing rule definitions at Definition Instantiation) blocks every dependent stage -- none of them are even attempted", async () => {
    const { deps, stages } = makeMemoryDeps();
    const realGetActiveVersionId = deps.getActiveVersionId.bind(deps);
    deps.getActiveVersionId = async (docType) => (docType === "METRICS" ? null : realGetActiveVersionId(docType));

    const result = await runPipeline(deps, MATCH_ID, { budgetMs: 120_000 });

    expect(result.complete).toBe(false);
    expect(stages.get("DEFINITION INSTANTIATION")?.["status"]).toBe("FAILED");
    // P1 through Final Combination Gate must never even be attempted -- no
    // audit_stage_runs row at all, not a row left dangling in some other status.
    for (const stage of STAGES.slice(STAGES.indexOf("P1 METRIC EXECUTION"))) {
      expect(stages.has(stage), `stage ${stage} should never have been touched`).toBe(false);
    }
  }, 60_000);

  it("a failed attempt does not create a second visible canonical diagnostic: a retry updates/reuses the same audit_run_id+stage record", async () => {
    const { deps, stages } = makeMemoryDeps();
    let calibrationCalls = 0;
    const realGetCalibration = deps.getCalibration.bind(deps);
    deps.getCalibration = async (versionId) => {
      calibrationCalls++;
      // First attempt: no active calibration version -> CURRENT CALIBRATION
      // APPLICATION returns FAILED. Every subsequent attempt (the retry):
      // the real, working calibration.
      if (calibrationCalls === 1) return { version: null, buckets: [] };
      return realGetCalibration(versionId);
    };

    const first = await runPipeline(deps, MATCH_ID, { budgetMs: 120_000 });
    expect(first.complete).toBe(false);
    expect(stages.get("CURRENT CALIBRATION APPLICATION")?.["status"]).toBe("FAILED");
    expect(stages.get("CURRENT CALIBRATION APPLICATION")?.["attempts"]).toBe(1);
    // Exactly one audit_stage_runs record exists per (audit_run_id, stage) --
    // this in-memory map is keyed by stage name, mirroring the real table's
    // UNIQUE (audit_run_id, stage) constraint -- so a second row for the
    // same stage is structurally impossible, not merely absent by luck. The
    // loop stopped at CURRENT CALIBRATION APPLICATION (the failure), so only
    // stages up to and including it have a record yet.
    const stageCountAfterFailure = stages.size;
    expect(stageCountAfterFailure).toBe(STAGES.indexOf("CURRENT CALIBRATION APPLICATION") + 1);

    const second = await runPipeline(deps, MATCH_ID, { budgetMs: 120_000 });

    expect(second.complete).toBe(true);
    // The calibration stage's SAME record was updated in place -- still one
    // entry for it, now COMPLETE, with attempts incremented, never a second
    // row -- while the run also legitimately reaches every remaining stage
    // for the first time, growing to the full canonical 16.
    expect(stages.size).toBe(STAGES.length);
    expect(stages.get("CURRENT CALIBRATION APPLICATION")?.["status"]).toBe("COMPLETE");
    expect(stages.get("CURRENT CALIBRATION APPLICATION")?.["attempts"]).toBe(2);
    expect(stages.get("CURRENT CALIBRATION APPLICATION")?.["error_message"]).toBeNull();

    // Rendering this run's canonical diagnostics still yields exactly one
    // entry per stage, all 16, none omitted, none duplicated -- the failed
    // attempt is invisible in the canonical view once the retry succeeds.
    const canonical = canonicalizeStageRows(Array.from(stages.values()).map((row) => ({ stage: String(row["stage"]), status: String(row["status"]) })));
    expect(canonical).toHaveLength(STAGES.length);
    expect(new Set(canonical.map((c) => c.stage)).size).toBe(STAGES.length);
    expect(canonical.every((c) => c.row?.status === "COMPLETE")).toBe(true);
  }, 60_000);

  it("on a fully successful run, every stage's persisted status satisfies the dependency graph end to end -- no downstream COMPLETE while an upstream required stage is not", async () => {
    const { deps, stages } = makeMemoryDeps();

    const result = await runPipeline(deps, MATCH_ID, { budgetMs: 120_000 });

    expect(result.complete).toBe(true);
    const rows = Array.from(stages.values()).map((row) => ({ stage: String(row["stage"]), status: String(row["status"]) }));
    for (const stage of STAGES) {
      const gaps = unmetDependencies(stage, rows);
      expect(gaps, `stage ${stage} has unmet upstream dependencies: ${gaps.join(", ")}`).toEqual([]);
    }
    // In particular, the Final Combination Gate specifically must not be
    // COMPLETE while any required upstream stage is not.
    expect(unmetDependencies("FINAL COMBINATION GATE", rows)).toEqual([]);
    expect(stages.get("FINAL COMBINATION GATE")?.["status"]).toBe("COMPLETE");
  }, 60_000);

  it("re-running a completed pipeline does not re-invoke the research provider or write duplicate stage rows (no false duplicate completion records)", async () => {
    const { deps, stages, tables } = makeMemoryDeps();
    let calls = 0;
    const countedResearcher: Researcher = {
      ...researcher,
      async identity(input) { calls++; return researcher.identity(input); },
      async metrics(input) { calls++; return researcher.metrics(input); },
      async rules(input) { calls++; return researcher.rules(input); },
      async underdog(input) { calls++; return researcher.underdog(input); },
      async conclusion(input) { calls++; return researcher.conclusion(input); },
      async stress(input) { calls++; return researcher.stress(input); },
    };
    deps.research = countedResearcher;

    await runPipeline(deps, MATCH_ID, { budgetMs: 120_000 });
    expect(calls).toBeGreaterThan(0);
    const afterFirstRun = calls;
    const stageRowCount = stages.size;
    const tableCounts = Object.fromEntries(Object.entries(tables).map(([k, v]) => [k, v.length]));

    const second = await runPipeline(deps, MATCH_ID, { budgetMs: 120_000 });

    expect(second.complete).toBe(true);
    expect(calls, "a fully complete run must not re-invoke the research provider").toBe(afterFirstRun);
    expect(stages.size, "no duplicate audit_stage_runs rows for any stage").toBe(stageRowCount);
    expect(stages.size).toBe(STAGES.length);
    for (const [table, count] of Object.entries(tableCounts)) {
      expect(tables[table]!.length, `${table} must not have grown on a no-op re-run`).toBe(count);
    }
  }, 60_000);

  it("obeys the dependency order independently for many matches, each producing exactly one canonical 16-stage diagnostic chain (stand-in for a fresh cleared-slate 50-match audit; the live end-to-end run is verified separately)", async () => {
    const MATCH_COUNT = 8;
    for (let i = 0; i < MATCH_COUNT; i++) {
      const { deps, stages } = makeMemoryDeps();
      const result = await runPipeline(deps, `match-${i}`, { budgetMs: 120_000 });
      expect(result.complete, `match ${i} did not complete`).toBe(true);
      const rows = Array.from(stages.values()).map((row) => ({ stage: String(row["stage"]), status: String(row["status"]) }));
      for (const stage of STAGES) {
        expect(unmetDependencies(stage, rows), `match ${i} stage ${stage} has unmet dependencies`).toEqual([]);
      }
      expect(stages.get("FINAL COMBINATION GATE")?.["status"]).toBe("COMPLETE");
      // Exactly one canonical diagnostic chain per match/run: 16 stages, no
      // duplicates, no gaps, every one persisted COMPLETE.
      expect(stages.size, `match ${i} has ${stages.size} stage records, expected exactly ${STAGES.length}`).toBe(STAGES.length);
      const canonical = canonicalizeStageRows(rows);
      expect(canonical, `match ${i} canonical diagnostics`).toHaveLength(STAGES.length);
      expect(canonical.every((c) => c.row?.status === "COMPLETE"), `match ${i} every canonical stage COMPLETE`).toBe(true);
    }
  }, 120_000);
});

// ----------------------------------------------------------------------------
// Clear Slate regression test: Audit -> Clear Slate -> verify old active
// state cannot be seen/used -> start new audit -> verify new audit_run_id ->
// verify exactly one canonical 16-stage diagnostic chain with no
// contamination from the previous run.
//
// clearOperationalSlate (reset-slate.functions.ts) only ever does one thing
// to audit_runs: set the latest run's status to INVALIDATED_RUN_STATUS and
// clear its lease. It never touches audit_stage_runs, metric_results, or any
// other child table -- those are deliberately preserved as history. This
// test reproduces exactly that write against a properly run-scoped mock (so
// it can actually prove isolation, unlike makeMemoryDeps) and drives a real
// second audit through resolveActiveRun/ensureRun/runPipeline -- the actual
// production code paths, not a simulation of them.
// ----------------------------------------------------------------------------
describe("Clear Slate: true clean slate for the next audit", () => {
  it("produces a brand-new audit_run_id with exactly one canonical 16-stage chain, with the previous run's active state unreachable and its history untouched", async () => {
    const { deps, runsById, stagesByRun, tablesByRun } = makeMultiRunMemoryDeps();

    // 1. Run a full audit to completion.
    const first = await runPipeline(deps, MATCH_ID, { budgetMs: 120_000 });
    expect(first.complete).toBe(true);
    const oldRunId = first.runId;
    const oldRun = runsById.get(oldRunId)!;
    expect(oldRun.run_number).toBe(1);
    expect(stagesByRun.get(oldRunId)!.size).toBe(STAGES.length);
    expect(tablesByRun.get(oldRunId)!.metric_results).toHaveLength(DEF_COUNTS.METRICS);

    // 2. Clear Slate: reproduce exactly what clearOperationalSlate does to
    // audit_runs for this match's latest run -- nothing else.
    await deps.updateRun(oldRunId, { status: INVALIDATED_RUN_STATUS, lease_owner: null, lease_expires_at: null });

    // 3. Verify old active state cannot be seen/used: the active-run
    // resolver (the same one match.$matchId.tsx and slate.tsx use) must
    // resolve straight through the invalidated run to null -- not fall back
    // to displaying its stale, fully-populated diagnostics.
    const latestAfterClear = await deps.getLatestRun(MATCH_ID);
    expect(latestAfterClear?.status).toBe(INVALIDATED_RUN_STATUS);
    expect(isActiveRunStatus(latestAfterClear?.status)).toBe(false);
    expect(resolveActiveRun(latestAfterClear ? [latestAfterClear] : [])).toBeNull();
    // Execution % for "the active slate" must read 0, not the old run's
    // last-known progress, once there is no active run to report on.
    expect(computeExecutionPercent([])).toBe(0);

    // History is preserved, not deleted: the old run and all of its
    // canonical diagnostics and evidence still exist, untouched.
    expect(stagesByRun.get(oldRunId)!.size).toBe(STAGES.length);
    expect(tablesByRun.get(oldRunId)!.metric_results).toHaveLength(DEF_COUNTS.METRICS);

    // 4. Start a new audit. preparePipelineRun/ensureRun must see the
    // invalidated run and create a genuinely new one rather than resuming
    // it -- and immediately after creation, before any stage has run,
    // execution must read exactly 0%, not carry over the old run's progress.
    const preparedRun = await preparePipelineRun(deps, MATCH_ID);
    expect(preparedRun.id).not.toBe(oldRunId);
    expect(preparedRun.run_number).toBe(2);
    expect(computeExecutionPercent(Array.from((stagesByRun.get(preparedRun.id) ?? new Map()).values()) as never)).toBe(0);

    const second = await runPipeline(deps, MATCH_ID, { budgetMs: 120_000 });
    expect(second.complete).toBe(true);
    const newRunId = second.runId;

    // 5. Verify a new audit_run_id.
    expect(newRunId).toBe(preparedRun.id);
    expect(newRunId).not.toBe(oldRunId);
    expect(runsById.get(newRunId)!.run_number).toBe(2);
    expect(runsById.get(newRunId)!.status).toBe("COMPLETE");
    // The old run's status is exactly as Clear Slate left it -- the new run
    // never touched it.
    expect(runsById.get(oldRunId)!.status).toBe(INVALIDATED_RUN_STATUS);

    // 6. Verify exactly one canonical 16-stage diagnostic chain for the new
    // run, in dependency order, with zero contamination from the previous
    // run's rows.
    const newStages = Array.from(stagesByRun.get(newRunId)!.values());
    expect(newStages).toHaveLength(STAGES.length);
    const canonical = canonicalizeStageRows(newStages.map((r) => ({ stage: String(r["stage"]), status: String(r["status"]) })));
    expect(canonical).toHaveLength(STAGES.length);
    expect(canonical.map((c) => c.stage)).toEqual(STAGES);
    expect(canonical.every((c) => c.row?.status === "COMPLETE")).toBe(true);
    for (const stage of STAGES) {
      expect(unmetDependencies(stage, newStages.map((r) => ({ stage: String(r["stage"]), status: String(r["status"]) })))).toEqual([]);
    }

    // No previous metric/evidence state leaked into the new run: same real
    // denominator, entirely disjoint row ids from the old run's rows.
    const newMetrics = tablesByRun.get(newRunId)!.metric_results;
    expect(newMetrics).toHaveLength(DEF_COUNTS.METRICS);
    const oldMetricIds = new Set(tablesByRun.get(oldRunId)!.metric_results.map((r) => r["id"]));
    const newMetricIds = new Set(newMetrics.map((r) => r["id"]));
    expect([...newMetricIds].some((id) => oldMetricIds.has(id))).toBe(false);

    // The old run's own diagnostic chain and evidence are still there,
    // completely isolated -- history preserved, not deleted, not merged.
    expect(stagesByRun.get(oldRunId)!.size).toBe(STAGES.length);
    expect(tablesByRun.get(oldRunId)!.metric_results).toHaveLength(DEF_COUNTS.METRICS);
    expect(stagesByRun.size).toBe(2);
    expect(tablesByRun.size).toBe(2);
  }, 60_000);
});
