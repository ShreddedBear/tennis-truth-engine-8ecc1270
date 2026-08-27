// End-to-end regression test for the Run Audit pipeline.
//
// It drives the real orchestrator with an in-memory data layer and a
// deterministic researcher, standing in for "PDF uploaded -> Run Audit ->
// Final Combination Gate". It FAILS if any audited section ends up 0/0,
// which is the exact defect this pipeline was written to fix.
import { describe, expect, it, vi } from "vitest";
import { runPipeline, STAGES, type ChildTable, type PipelineDeps, type Researcher, type RunRow } from "./audit-pipeline";
import { STRESS_TESTS, UNDERDOG_PATHWAYS } from "./constants";

// The real NO_SOURCE_DETERMINATIONS registry is intentionally empty -- no code has
// actually cleared the documented-investigation bar yet (see authoritative-metric-catalog.ts).
// To test the instantiation-time NO_SOURCE wiring itself, mock isNoSourceCode to treat
// real code 070 ("Support Team / Prep", a genuine PLAYER_METRIC) as NO_SOURCE for this
// test file only -- distinct from and never overlapping any real PROCESS_META code.
vi.mock("./authoritative-metric-catalog", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./authoritative-metric-catalog")>();
  return {
    ...actual,
    isNoSourceCode: (code: string | null | undefined) => {
      const match = String(code ?? "").match(/(\d{1,3})$/);
      return (match ? match[1].padStart(3, "0") : null) === "070";
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

describe("Run Audit pipeline", () => {
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

  it("is idempotent: a second run adds no duplicate records", async () => {
    const { deps, tables } = makeMemoryDeps();
    await runPipeline(deps, MATCH_ID, { budgetMs: 120_000 });
    const before = Object.fromEntries(Object.entries(tables).map(([k, v]) => [k, v.length]));
    await runPipeline(deps, MATCH_ID, { budgetMs: 120_000 });
    const after = Object.fromEntries(Object.entries(tables).map(([k, v]) => [k, v.length]));
    expect(after).toEqual(before);
  }, 60_000);

  // Task 20 guardrail: PROCESS_META codes (authoritative-metric-catalog.ts) must never
  // silently re-enter the player-evidence denominator. They are instantiated EXCLUDED
  // (never sent to any research/reconstruction call) rather than scored as a player
  // metric, so a regression here would mean either a code was reclassified without
  // updating this test, or the exclusion wiring in instantiate() broke.
  it("instantiates every PROCESS_META code as EXCLUDED and never asks research for it", async () => {
    const PROCESS_META_SUFFIXES = ["04", "05", "06", "47", "48", "49", "50", "56", "57", "58", "59", "61"];
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
    const processMetaCodes = PROCESS_META_SUFFIXES.map((suffix) => `M${suffix}`);
    expect(processMetaCodes).toHaveLength(12);

    for (const code of processMetaCodes) {
      const row = metricRows.find((r) => r["metric_code"] === code);
      expect(row, `metric ${code} was not instantiated`).toBeTruthy();
      expect(row!["status"], `metric ${code} status`).toBe("EXCLUDED");
      expect(row!["p1_status"], `metric ${code} p1_status`).toBe("EXCLUDED");
      expect(row!["p2_status"], `metric ${code} p2_status`).toBe("EXCLUDED");
      expect(seenByResearch.has(code), `metric ${code} was sent to the research provider`).toBe(false);
    }

    // Every other code must still be a normal player metric, sent to research as before.
    // "M70" is excluded here too: this test file's module-level mock (see the top of this
    // file) treats real code 070 as NO_SOURCE for the dedicated test below, and that mock
    // is file-scoped, so it also applies here.
    const playerCodes = metricRows.map((r) => String(r["metric_code"])).filter((c) => !processMetaCodes.includes(c) && c !== "M70");
    expect(playerCodes).toHaveLength(DEF_COUNTS.METRICS - 12 - 1);
    for (const code of playerCodes) expect(seenByResearch.has(code), `player metric ${code} was never sent to research`).toBe(true);
  }, 60_000);

  // Denominator-eligibility audit, requested directly: a code with a documented
  // NO_SOURCE determination must instantiate exactly like PROCESS_META -- settled
  // immediately, never sent to research -- but as a distinct status, never "EXCLUDED".
  // isNoSourceCode is mocked above to treat "M70" (real code 070) as NO_SOURCE.
  it("instantiates a NO_SOURCE code as NO_SOURCE (not EXCLUDED) and never asks research for it, while a real PROCESS_META code stays EXCLUDED", async () => {
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
    expect(noSourceRow!["p1_treatment"]).toBe("NO_SOURCE");
    expect(noSourceRow!["unavailable_reason"]).toBe("NO_SOURCE_NO_LEGITIMATE_PATHWAY");
    expect(seenByResearch.has("M70"), "metric M70 was sent to the research provider").toBe(false);

    const processMetaRow = metricRows.find((r) => r["metric_code"] === "M61");
    expect(processMetaRow!["status"]).toBe("EXCLUDED");
    expect(processMetaRow!["unavailable_reason"]).toBe("PROCESS_META_NOT_PLAYER_EVIDENCE");
  }, 60_000);
});
