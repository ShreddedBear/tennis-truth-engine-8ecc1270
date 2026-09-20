import assert from "node:assert/strict";
import test from "node:test";
import { buildAuditCreateRunPlan, buildDecisionUpsertPlan, buildResultRetryPlan, buildScopedReplacementPlan, disagreementSeed, mapCoverageRow, mapFinalDecisionFields, mapMetricCoverageRates, stressSeed, verificationSeed } from "./truthAuditOperations";

test("audit create request accepts row and preserves all seed arrays", () => {
  const plan = buildAuditCreateRunPlan({
    row: { match_id: "11111111-1111-1111-1111-111111111111", run_number: 3 },
    metricSeeds: [{ metric_code: "001" }],
    underdogPathways: [["A", "Path A"]],
    stressTests: [["S", "Stress"]],
  });
  assert.equal(plan.matchId, "11111111-1111-1111-1111-111111111111");
  assert.equal(plan.metricSeeds.length, 1);
  assert.equal(plan.underdogPathways.length, 1);
  assert.equal(plan.stressTests.length, 1);
});

test("audit create request rejects missing match identity without touching DB", () => {
  assert.throws(() => buildAuditCreateRunPlan({ metricSeeds: [] }), /requires matchId/);
});

test("coverage mappings use live column names and server ownership", () => {
  const coverage = mapCoverageRow({ player_side: "P1", direct: 2, reconstructed: 1, partial: 0, unavailable: 3, excluded: 1, total: 7, usablePercent: 42, executionPercent: 88, user_id: "attacker" }, "run", "owner");
  assert.deepEqual(coverage, { audit_run_id: "run", user_id: "owner", player_side: "P1", direct_count: 2, reconstructed_count: 1, partial_count: 0, unavailable_count: 3, excluded_count: 1, total_count: 7, usable_coverage_percent: 42, execution_completion_percent: 88 });
  const rates = mapMetricCoverageRates([], [{ metric_code: "M1", p1_treatment: "DIRECT", p2_treatment: "UNAVAILABLE" }], "run", "owner");
  assert.deepEqual(rates.map(({ metric_code, player_side, treatment, usable, user_id }) => ({ metric_code, player_side, treatment, usable, user_id })), [
    { metric_code: "M1", player_side: "P1", treatment: "DIRECT", usable: true, user_id: "owner" },
    { metric_code: "M1", player_side: "P2", treatment: "UNAVAILABLE", usable: false, user_id: "owner" },
  ]);
});

test("result retry plans use live per-table business keys", () => {
  const plan = buildResultRetryPlan("metric_results", [{ audit_run_id: "r", metric_code: "M", user_id: "attacker" }])[0]!;
  assert.deepEqual(plan.keys, ["audit_run_id", "metric_code"]);
  assert.deepEqual(plan.values, { audit_run_id: "r", metric_code: "M" });
  assert.deepEqual(buildResultRetryPlan("underdog_results", [{ audit_run_id: "r", pathway_code: "U", player_side: "P1" }])[0]!.keys, ["audit_run_id", "pathway_code", "player_side"]);
  assert.deepEqual(buildResultRetryPlan("verification_results", [{ audit_run_id: "r", rule_code: "V" }])[0]!.keys, ["audit_run_id", "rule_code"]);
  assert.deepEqual(buildResultRetryPlan("disagreement_results", [{ audit_run_id: "r", rule_code: "D" }])[0]!.keys, ["audit_run_id", "rule_code"]);
  assert.deepEqual(buildResultRetryPlan("stress_results", [{ audit_run_id: "r", test_code: "S" }])[0]!.keys, ["audit_run_id", "test_code"]);
  assert.deepEqual(buildResultRetryPlan("reconstruction_results", [{ audit_run_id: "r", metric_code: "M", player_side: "P1" }])[0]!.keys, ["audit_run_id", "metric_code", "player_side"]);
});

test("decision upsert plan keys by owner-scoped audit run and strips caller ownership", () => {
  const plan = buildDecisionUpsertPlan("run", "owner", { user_id: "attacker", audit_complete: true });
  assert.deepEqual(plan.deleteWhere, { user_id: "owner", audit_run_id: "run" });
  assert.equal(plan.insert.user_id, "owner");
});

test("create-run seed sanitizers strip full rule projections and generate server-owned defaults", () => {
  const verification = verificationSeed({ id: "attacker", rule_code: "V1", rule_name: "Verify", body: "sql", blocking: true, user_id: "attacker" }, "run");
  assert.deepEqual(verification, { audit_run_id: "run", rule_id: null, rule_code: "V1", rule_name: "Verify", severity: "STANDARD", status: "NOT STARTED", outcome: "NOT STARTED" });
  const disagreement = disagreementSeed({ id: "attacker", rule_code: "D1", rule_name: "Disagree", body: {}, severity: "HIGH" }, "run");
  assert.deepEqual(disagreement, { audit_run_id: "run", rule_code: "D1", rule_name: "Disagree", status: "NOT STARTED", rule_id: null });
  const stress = stressSeed({ test_code: "S1", test_name: "Stress", id: "attacker" }, "run");
  assert.deepEqual(stress, { audit_run_id: "run", test_code: "S1", test_name: "Stress", outcome: "NOT STARTED", status: "NOT STARTED" });
});

test("scoped replacement plans target only incoming identity/source keys", () => {
  assert.deepEqual(buildScopedReplacementPlan("identity", [{ field: "player_1" }]), [{ field: "player_1" }]);
  assert.deepEqual(buildScopedReplacementPlan("snapshots", [{ source_name: "ATP", data_key: "match_context", player_side: null }]), [{ source_name: "ATP", data_key: "match_context", player_side: null }]);
  assert.deepEqual(buildScopedReplacementPlan("conflicts", [{ data_key: "surface", resolution_status: "UNRESOLVED" }]), [{ data_key: "surface", resolution_status: "UNRESOLVED" }]);
});

test("conflict output uses only live columns and preserves context inside values", () => {
  const row = { data_key: "surface", resolution_status: null, source_id: "source", player_side: "P1", values: ["hard"] };
  const output = { audit_run_id: "run", data_key: row.data_key, critical: false, values: { value: row.values, source_id: row.source_id, player_side: row.player_side }, resolution_status: row.resolution_status, resolution_reason: null, selected_value: null };
  assert.deepEqual(Object.keys(output).sort(), ["audit_run_id", "critical", "data_key", "resolution_reason", "resolution_status", "selected_value", "values"]);
  assert.equal("source_id" in output, false);
  assert.equal("player_side" in output, false);
});

test("conflict replacement key includes null-safe resolution status", () => {
  assert.deepEqual(buildScopedReplacementPlan("conflicts", [{ data_key: "surface", resolution_status: null }]), [{ data_key: "surface", resolution_status: null }]);
});

test("final decision persistence maps modern and legacy action contracts", () => {
  const modern = mapFinalDecisionFields("run", "owner", {
    action: "BET_P1",
    final_recommendation: "legacy",
    final_selection: "Player One",
    selected_player_id: "player-1",
    user_id: "attacker",
  });
  assert.equal(modern.action, "BET_P1");
  assert.equal(modern.final_selection, "Player One");
  assert.equal(modern.selected_player_id, "player-1");
  assert.equal(modern.user_id, "owner");
  const legacy = mapFinalDecisionFields("run", "owner", {
    final_recommendation: "PASS",
    final_selection: "Player Two",
    selected_player_id: "player-2",
  });
  assert.equal(legacy.action, "PASS");
  assert.equal(legacy.final_selection, "Player Two");
  assert.equal(legacy.selected_player_id, "player-2");
  assert.equal(legacy.user_id, "owner");
});