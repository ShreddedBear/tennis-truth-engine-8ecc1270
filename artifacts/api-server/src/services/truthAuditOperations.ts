import { sql } from "drizzle-orm";
import { db } from "@workspace/db";

const CHILD_TABLES = new Set([
  "metric_results", "verification_results", "disagreement_results",
  "underdog_results", "stress_results", "reconstruction_results",
  "match_identity_records", "source_snapshots", "source_conflicts",
  "audit_coverage", "metric_coverage_rates",
]);
const RESULT_KEYS: Record<string, string[]> = {
  metric_results: ["audit_run_id", "metric_code"],
  verification_results: ["audit_run_id", "rule_code"],
  disagreement_results: ["audit_run_id", "rule_code"],
  underdog_results: ["audit_run_id", "pathway_code", "player_side"],
  stress_results: ["audit_run_id", "test_code"],
  reconstruction_results: ["audit_run_id", "metric_code", "player_side"],
};

export function buildResultRetryPlan(table: string, rows: Record<string, unknown>[]) {
  const keys = RESULT_KEYS[table];
  if (!keys) throw new Error(`No idempotency key for ${table}`);
  return rows.map((row) => ({ table, keys, values: Object.fromEntries(keys.map((key) => [key, row[key]])) }));
}

export function buildDecisionUpsertPlan(runId: string, ownerId: string, payload: Record<string, unknown>) {
  const { user_id: _ignoredUserId, ...safePayload } = payload;
  return {
    deleteWhere: { user_id: ownerId, audit_run_id: runId },
    insert: { user_id: ownerId, audit_run_id: runId, ...safePayload },
  };
}

export function mapFinalDecisionFields(runId: string, ownerId: string, payload: Record<string, unknown>) {
  return {
    user_id: ownerId,
    audit_run_id: runId,
    final_audit_color: payload.final_audit_color ?? null,
    final_selection: payload.final_selection ?? null,
    selected_player_id: payload.selected_player_id ?? null,
    action: payload.action ?? payload.final_recommendation ?? null,
    gate_report: payload.gate_report ?? {},
    completion_percent: payload.completion_percent ?? 0,
    audit_complete: payload.audit_complete ?? true,
    matrix_firewall_valid: payload.matrix_firewall_valid ?? false,
    calibration_bucket: payload.calibration_bucket ?? null,
    verified_win_rate: payload.verified_win_rate ?? null,
  };
}

export function buildScopedReplacementPlan(kind: "identity" | "snapshots" | "conflicts", rows: Record<string, unknown>[]) {
  return rows.map((row) => kind === "identity"
    ? { field: row.field }
    : kind === "snapshots"
      ? { source_name: row.source_name ?? null, data_key: row.data_key ?? null, player_side: row.player_side ?? null }
      : { data_key: row.data_key ?? row.field ?? null, resolution_status: row.resolution_status ?? null });
}

export function verificationSeed(seed: Record<string, unknown>, runId: string) {
  return {
    audit_run_id: runId, rule_id: null, rule_code: String(seed.rule_code ?? ""),
    rule_name: String(seed.rule_name ?? seed.rule_code ?? ""), severity: seed.severity ?? "STANDARD",
    status: seed.status ?? "NOT STARTED", outcome: seed.outcome ?? "NOT STARTED",
  };
}

export function disagreementSeed(seed: Record<string, unknown>, runId: string) {
  return {
    audit_run_id: runId, rule_code: String(seed.rule_code ?? seed.pathway_code ?? ""),
    rule_name: String(seed.rule_name ?? seed.rule_code ?? seed.pathway_code ?? ""),
    status: seed.status ?? "NOT STARTED", rule_id: null,
  };
}

export function stressSeed(seed: Record<string, unknown>, runId: string) {
  return {
    audit_run_id: runId, test_code: String(seed.test_code ?? seed.pathway_code ?? ""),
    test_name: String(seed.test_name ?? seed.test_code ?? seed.pathway_code ?? ""),
    outcome: seed.outcome ?? "NOT STARTED", status: seed.status ?? "NOT STARTED",
  };
}

export function buildAuditCreateRunPlan(input: Record<string, unknown>) {
  const row = input.row && typeof input.row === "object" ? input.row as Record<string, unknown> : {};
  const matchId = typeof input.matchId === "string" ? input.matchId : row.match_id;
  if (typeof matchId !== "string") throw new Error("audit-create-run requires matchId or row.match_id");
  return {
    matchId,
    row,
    metricSeeds: Array.isArray(input.metricSeeds) ? input.metricSeeds : [],
    verificationSeeds: Array.isArray(input.verificationSeeds) ? input.verificationSeeds : [],
    disagreementSeeds: Array.isArray(input.disagreementSeeds) ? input.disagreementSeeds : [],
    underdogPathways: Array.isArray(input.underdogPathways) ? input.underdogPathways : [],
    stressTests: Array.isArray(input.stressTests) ? input.stressTests : [],
  };
}

export function mapCoverageRow(row: Record<string, unknown>, runId: string, ownerId: string) {
  return {
    audit_run_id: runId, user_id: ownerId, player_side: row.player_side,
    direct_count: Number(row.direct_count ?? row.direct ?? 0),
    reconstructed_count: Number(row.reconstructed_count ?? row.reconstructed ?? 0),
    partial_count: Number(row.partial_count ?? row.partial ?? 0),
    unavailable_count: Number(row.unavailable_count ?? row.unavailable ?? 0),
    excluded_count: Number(row.excluded_count ?? row.excluded ?? 0),
    total_count: Number(row.total_count ?? row.total ?? 0),
    usable_coverage_percent: row.usable_coverage_percent ?? row.usablePercent ?? row.usable_percent ?? 0,
    execution_completion_percent: row.execution_completion_percent ?? row.executionPercent ?? row.execution_completion ?? 0,
  };
}

export function mapMetricCoverageRates(rows: Record<string, unknown>[], metricResults: Record<string, unknown>[], runId: string, ownerId: string) {
  const source: Record<string, unknown>[] = rows.some((row) => row.metric_code || row.metricCode) ? rows : metricResults.flatMap((metric) => ["P1", "P2"].map((side) => {
    const treatment = metric[side === "P1" ? "p1_treatment" : "p2_treatment"];
    return { metric_code: metric.metric_code, player_side: side, treatment: treatment ?? "UNAVAILABLE", usable: !["UNAVAILABLE", "EXCLUDED"].includes(String(treatment).toUpperCase()) };
  }));
  return source.map((row) => ({
    audit_run_id: runId, user_id: ownerId,
    metric_code: row.metric_code ?? row.metricCode,
    player_side: row.player_side ?? row.playerSide,
    treatment: row.treatment ?? "UNAVAILABLE",
    usable: row.usable === true || row.usable === 1 || String(row.usable).toLowerCase() === "true",
  }));
}

async function insertRows(tx: { execute: (query: ReturnType<typeof sql>) => Promise<{ rows: unknown[] }> }, table: string, rows: unknown[], ownerId: string) {
  if (!rows.length) return;
  if (!CHILD_TABLES.has(table)) throw new Error(`Unsupported audit child table: ${table}`);
  for (const value of rows) {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`Invalid ${table} seed row`);
    const row: Record<string, unknown> = { ...(value as Record<string, unknown>), user_id: ownerId };
    const names = Object.keys(row);
    if (!names.length) continue;
    const identifiers = names.map((name) => sql.raw(`"${name}"`));
    await tx.execute(sql`insert into ${sql.raw(`"${table}"`)} (${sql.join(identifiers, sql`, `)}) values (${sql.join(names.map((name) => sql`${row[name]}`), sql`, `)})`);
  }
}

export async function executeAuditCreateRun(input: Record<string, unknown>, ownerId: string) {
  const plan = buildAuditCreateRunPlan(input);
  return db.transaction(async (tx) => {
    const prior = await tx.execute(sql`select coalesce(max(run_number), 0)::int as run_number from audit_runs where user_id = ${ownerId}::uuid and match_id = ${plan.matchId}::uuid`);
    const next = typeof plan.row.run_number === "number"
      ? plan.row.run_number
      : Number((prior.rows[0] as { run_number?: number } | undefined)?.run_number ?? 0) + 1;
    const versions = await tx.execute(sql`select doc_type, active_version_id from rule_documents where user_id = ${ownerId}::uuid and doc_type in ('VERIFICATION','DISAGREEMENT','METRICS')`);
    const references = new Map(versions.rows.map((row) => [String((row as { doc_type: string }).doc_type), (row as { active_version_id: string | null }).active_version_id]));
    const row = plan.row;
    const inserted = await tx.execute(sql`insert into audit_runs (user_id, match_id, run_number, research_lock_at, verification_version_id, disagreement_version_id, metrics_version_id, status) values (${ownerId}::uuid, ${plan.matchId}::uuid, ${next}, ${row.research_lock_at ?? new Date()}, ${row.verification_version_id ?? references.get("VERIFICATION") ?? null}, ${row.disagreement_version_id ?? references.get("DISAGREEMENT") ?? null}, ${row.metrics_version_id ?? references.get("METRICS") ?? null}, ${row.status ?? "RUNNING"}) returning *`);
    const run = inserted.rows[0] as { id: string };
    const rules = await tx.execute(sql`select id, rule_code, rule_name, severity, version_id from rules where user_id = ${ownerId}::uuid and version_id in (${references.get("METRICS") ?? null}, ${references.get("VERIFICATION") ?? null}, ${references.get("DISAGREEMENT") ?? null}) order by rule_code`);
    const suppliedMetrics = plan.metricSeeds.map((seed) => ({ ...(seed as Record<string, unknown>), audit_run_id: run.id }));
    const metrics = suppliedMetrics.length ? suppliedMetrics : rules.rows
      .filter((rule) => String((rule as { version_id?: string }).version_id) === String(references.get("METRICS")))
      .map((rule) => ({ audit_run_id: run.id, metric_code: (rule as { rule_code: string }).rule_code, metric_name: (rule as { rule_name: string }).rule_name, status: "NOT STARTED", p1_status: "NOT STARTED", p2_status: "NOT STARTED", p1_treatment: "UNAVAILABLE", p2_treatment: "UNAVAILABLE" }));
    await insertRows(tx, "metric_results", metrics, ownerId);
    const verificationSeeds = plan.verificationSeeds.length ? plan.verificationSeeds : rules.rows.filter((rule) => String((rule as { version_id?: string }).version_id) === String(references.get("VERIFICATION")));
    const disagreementSeeds = plan.disagreementSeeds.length ? plan.disagreementSeeds : rules.rows.filter((rule) => String((rule as { version_id?: string }).version_id) === String(references.get("DISAGREEMENT")));
    await insertRows(tx, "verification_results", verificationSeeds.map((seed) => verificationSeed(seed as Record<string, unknown>, run.id)), ownerId);
    await insertRows(tx, "disagreement_results", disagreementSeeds.map((seed) => disagreementSeed(seed as Record<string, unknown>, run.id)), ownerId);
    const match = await tx.execute(sql`select player1_name, player2_name from matches where user_id = ${ownerId}::uuid and id = ${plan.matchId}::uuid limit 1`);
    const sides = [String((match.rows[0] as { player1_name?: string }).player1_name ?? "Player 1"), String((match.rows[0] as { player2_name?: string }).player2_name ?? "Player 2")];
    await insertRows(tx, "underdog_results", sides.flatMap((side) => plan.underdogPathways.map((pathway) => ({ audit_run_id: run.id, pathway_code: Array.isArray(pathway) ? pathway[0] : pathway, pathway_name: Array.isArray(pathway) ? pathway[1] : pathway, player_side: side, classification: "UNRESOLVED", status: "NOT STARTED" }))), ownerId);
    await insertRows(tx, "stress_results", plan.stressTests.map((test) => stressSeed({ test_code: Array.isArray(test) ? test[0] : test, test_name: Array.isArray(test) ? test[1] : test, status: "NOT STARTED" }, run.id)), ownerId);
    return { run };
  });
}

export async function executeAuditRepositoryOperation(operation: string, input: Record<string, unknown>, ownerId: string) {
  const uuid = (value: unknown) => typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value) ? value : null;
  const id = uuid(input.runId ?? input.matchId ?? input.id);
  if (operation === "audit-get-match") {
    const matchId = uuid(input.matchId); if (!matchId) throw new Error("Invalid matchId");
    const rows = await db.execute(sql`select * from matches where user_id = ${ownerId}::uuid and id = ${matchId}::uuid limit 1`);
    return { match: rows.rows[0] ?? null };
  }
  if (operation === "audit-update-match") {
    const matchId = uuid(input.matchId); const patch = input.patch as Record<string, unknown>;
    if (!matchId || !patch || typeof patch !== "object") throw new Error("Invalid match update");
    const names = Object.keys(patch); if (!names.length) return { ok: true };
    await db.execute(sql`update matches set ${sql.join(names.map((name) => sql`${sql.raw(`"${name}"`)} = ${patch[name]}`), sql`, `)} where user_id = ${ownerId}::uuid and id = ${matchId}::uuid`);
    return { ok: true };
  }
  if (operation === "audit-parsed-fields") {
    const matchId = uuid(input.matchId); if (!matchId) throw new Error("Invalid matchId");
    const rows = await db.execute(sql`select field_key, normalized_value, raw_value from parsed_summary_fields where user_id = ${ownerId}::uuid and summary_version_id in (select id from summary_versions where user_id = ${ownerId}::uuid and match_id = ${matchId}::uuid and is_active = true)`);
    return { fields: Object.fromEntries(rows.rows.map((row) => [String((row as { field_key: string }).field_key), String((row as { normalized_value?: string; raw_value?: string }).normalized_value ?? (row as { raw_value?: string }).raw_value ?? "")]).filter(([, value]) => value)) };
  }
  if (operation === "audit-update-run") {
    const runId = uuid(input.runId); const patch = input.patch as Record<string, unknown>;
    if (!runId || !patch || typeof patch !== "object") throw new Error("Invalid run update");
    const names = Object.keys(patch); await db.execute(sql`update audit_runs set ${sql.join(names.map((name) => sql`${sql.raw(`"${name}"`)} = ${patch[name]}`), sql`, `)} where user_id = ${ownerId}::uuid and id = ${runId}::uuid`);
    return { ok: true };
  }
  if (operation === "audit-list-results" || operation === "audit-stages" || operation === "audit-conflicts" || operation === "audit-reconstructions") {
    const runId = uuid(input.runId); if (!runId) throw new Error("Invalid runId");
    const table = operation === "audit-stages" ? "audit_stage_runs" : operation === "audit-conflicts" ? "source_conflicts" : operation === "audit-reconstructions" ? "reconstruction_results" : String(input.table);
    if (!["metric_results", "verification_results", "disagreement_results", "underdog_results", "stress_results", "reconstruction_results", "audit_stage_runs", "source_conflicts"].includes(table)) throw new Error("Unsupported audit result table");
    const rows = await db.execute(sql`select * from ${sql.raw(`"${table}"`)} where user_id = ${ownerId}::uuid and audit_run_id = ${runId}::uuid order by created_at asc`);
    return operation === "audit-stages" ? { stages: rows.rows } : { rows: rows.rows };
  }
  if (operation === "audit-insert-results" || operation === "audit-update-result") {
    const table = String(input.table); if (!CHILD_TABLES.has(table)) throw new Error("Unsupported audit child table");
    if (operation === "audit-update-result") {
      const resultId = uuid(input.id); const patch = input.patch as Record<string, unknown>; if (!resultId || !patch) throw new Error("Invalid result update");
      const names = Object.keys(patch); await db.execute(sql`update ${sql.raw(`"${table}"`)} set ${sql.join(names.map((name) => sql`${sql.raw(`"${name}"`)} = ${patch[name]}`), sql`, `)} where user_id = ${ownerId}::uuid and id = ${resultId}::uuid`);
    } else {
      const rows = Array.isArray(input.rows) ? input.rows as Record<string, unknown>[] : [];
      await db.transaction(async (tx) => {
        for (const row of rows) {
          const keys = RESULT_KEYS[table];
          if (!keys) throw new Error(`No idempotency key for ${table}`);
          const runId = uuid(row.audit_run_id ?? input.runId);
          if (!runId) throw new Error("Result row requires audit_run_id");
          const predicates = keys.map((key) => key === "audit_run_id"
            ? sql`audit_run_id = ${runId}::uuid`
            : sql`${sql.raw(`"${key}"`)} = ${row[key]}`);
          await tx.execute(sql`delete from ${sql.raw(`"${table}"`)} where user_id = ${ownerId}::uuid and ${sql.join(predicates, sql` and `)};`);
          await insertRows(tx, table, [{ ...row, audit_run_id: runId }], ownerId);
        }
      });
    }
    return { ok: true };
  }
  if (operation === "audit-set-stage") {
    const runId = uuid(input.runId); const matchId = uuid(input.matchId); const stage = String(input.stage);
    const patch = input.patch && typeof input.patch === "object" ? input.patch as Record<string, unknown> : {};
    if (!runId || !matchId || !stage) throw new Error("Invalid stage update");
    const values: Record<string, unknown> = { audit_run_id: runId, match_id: matchId, user_id: ownerId, stage, stage_order: Number(input.stageOrder ?? 0), ...patch };
    const names = Object.keys(values);
    await db.execute(sql`insert into audit_stage_runs (${sql.join(names.map((name) => sql.raw(`"${name}"`)), sql`, `)}) values (${sql.join(names.map((name) => sql`${values[name]}`), sql`, `)}) on conflict (audit_run_id, stage) do update set ${sql.join(names.filter((name) => !["audit_run_id", "stage"].includes(name)).map((name) => sql`${sql.raw(`"${name}"`)} = excluded.${sql.raw(`"${name}"`)}`), sql`, `)}`);
    return { ok: true };
  }
  if (operation === "audit-log") {
    const entry = (input.entry ?? input) as Record<string, unknown>;
    await db.execute(sql`insert into execution_logs (user_id, audit_run_id, match_id, stage, status, output, matrix_visible) values (${ownerId}::uuid, ${entry.audit_run_id ?? null}, ${entry.match_id ?? null}, ${entry.stage}, ${entry.status}, ${entry.output ?? null}, ${Boolean(entry.matrix_visible)})`);
    return { ok: true };
  }
  if (operation === "audit-save-identity" || operation === "audit-save-snapshots" || operation === "audit-save-conflicts") {
    const table = operation === "audit-save-identity" ? "match_identity_records" : operation === "audit-save-snapshots" ? "source_snapshots" : "source_conflicts";
    const foreignKey = operation === "audit-save-identity" ? "match_id" : "audit_run_id";
    const foreignId = operation === "audit-save-identity" ? uuid(input.matchId) : uuid(input.runId);
    if (!foreignId) throw new Error("Invalid persistence owner");
    const rows = Array.isArray(input.rows) ? input.rows as Record<string, unknown>[] : [];
    await db.transaction(async (tx) => {
      for (const row of rows) {
        const normalized = operation === "audit-save-identity"
          ? { match_id: foreignId, field: row.field, claimed_value: row.claimed_value ?? null, verified_value: row.verified_value ?? null, status: row.status ?? null, note: row.note ?? null }
          : operation === "audit-save-snapshots"
            ? { audit_run_id: foreignId, source_id: row.source_id ?? null, source_name: row.source_name ?? null, data_key: row.data_key ?? null, player_side: row.player_side ?? null, raw_value: row.raw_value ?? null, normalized_value: row.normalized_value ?? null, retrieved_at: row.retrieved_at ?? null, post_start: row.post_start ?? null, excluded: row.excluded ?? null, reliability: row.reliability ?? null }
            : { audit_run_id: foreignId, data_key: row.data_key ?? row.field ?? null, critical: row.critical ?? false, values: row.values ?? (row.source_id || row.player_side ? { value: row.values ?? null, source_id: row.source_id ?? null, player_side: row.player_side ?? null } : null), resolution_status: row.resolution_status ?? null, resolution_reason: row.resolution_reason ?? null, selected_value: row.selected_value ?? null };
        const key = operation === "audit-save-identity"
          ? sql`field = ${normalized.field}`
          : operation === "audit-save-snapshots"
            ? sql`source_name is not distinct from ${normalized.source_name} and data_key is not distinct from ${normalized.data_key} and player_side is not distinct from ${normalized.player_side}`
            : sql`data_key = ${normalized.data_key} and resolution_status is not distinct from ${normalized.resolution_status}`;
        await tx.execute(sql`delete from ${sql.raw(`"${table}"`)} where user_id = ${ownerId}::uuid and ${sql.raw(`"${foreignKey}"`)} = ${foreignId}::uuid and ${key}`);
        await insertRows(tx, table as string, [normalized], ownerId);
      }
    });
    return { ok: true };
  }
  if (operation === "audit-calibration") {
    const versionId = uuid(input.versionId);
    const versions = versionId ? await db.execute(sql`select id, label, version_number from calibration_versions where user_id = ${ownerId}::uuid and id = ${versionId}::uuid limit 1`) : await db.execute(sql`select id, label, version_number from calibration_versions where user_id = ${ownerId}::uuid and is_active = true order by version_number desc limit 1`);
    const version = versions.rows[0] as { id: string } | undefined;
    const buckets = version ? await db.execute(sql`select bucket_code, wp_min, wp_max, wins, graded from calibration_buckets where user_id = ${ownerId}::uuid and calibration_version_id = ${version.id}::uuid order by wp_min`) : { rows: [] };
    return { version: version ?? null, buckets: buckets.rows };
  }
  if (operation === "audit-decision-id") {
    const runId = uuid(input.runId); if (!runId) throw new Error("Invalid runId");
    const rows = await db.execute(sql`select id from final_decisions where user_id = ${ownerId}::uuid and audit_run_id = ${runId}::uuid limit 1`);
    return { id: (rows.rows[0] as { id?: string } | undefined)?.id ?? null };
  }
  if (operation === "audit-save-decision") {
    const runId = uuid(input.runId); const payload = input.payload && typeof input.payload === "object" ? input.payload as Record<string, unknown> : {};
    if (!runId) throw new Error("Invalid runId");
    const fields: Record<string, unknown> = mapFinalDecisionFields(runId, ownerId, payload);
    const names = Object.keys(fields);
    await db.transaction(async (tx) => {
      await tx.execute(sql`delete from final_decisions where user_id = ${ownerId}::uuid and audit_run_id = ${runId}::uuid`);
      await tx.execute(sql`insert into final_decisions (${sql.join(names.map((name) => sql.raw(`"${name}"`)), sql`, `)}) values (${sql.join(names.map((name) => sql`${fields[name]}`), sql`, `)})`);
    });
    return { ok: true };
  }
  if (operation === "audit-save-coverage" || operation === "audit-save-coverage-rates") {
    const rows = Array.isArray(input.rows) ? input.rows as Record<string, unknown>[] : [];
    const runId = uuid(input.runId); if (!runId) throw new Error("Invalid runId");
    if (operation === "audit-save-coverage") {
      const mapped = rows.map((row) => mapCoverageRow(row, runId, ownerId));
      await db.transaction(async (tx) => {
        await tx.execute(sql`delete from audit_coverage where user_id = ${ownerId}::uuid and audit_run_id = ${runId}::uuid`);
        await insertRows(tx, "audit_coverage", mapped, ownerId);
      });
    } else {
      const metricResults = await db.execute(sql`select metric_code, p1_treatment, p2_treatment from metric_results where user_id = ${ownerId}::uuid and audit_run_id = ${runId}::uuid`);
      const mapped = mapMetricCoverageRates(rows, metricResults.rows as Record<string, unknown>[], runId, ownerId);
      await db.transaction(async (tx) => {
        await tx.execute(sql`delete from metric_coverage_rates where user_id = ${ownerId}::uuid and audit_run_id = ${runId}::uuid`);
        await insertRows(tx, "metric_coverage_rates", mapped, ownerId);
      });
    }
    return { ok: true };
  }
  if (operation === "audit-verify-final-persistence") {
    const runId = uuid(input.runId); if (!runId) throw new Error("Invalid runId");
    const expectedMetricSides = Number(input.expectedMetricSides ?? 0);
    const expectedAuditComplete = Boolean(input.expectedAuditComplete);
    const coverage = await db.execute(sql`select player_side from audit_coverage where user_id = ${ownerId}::uuid and audit_run_id = ${runId}::uuid`);
    if (coverage.rows.length !== 2 || new Set(coverage.rows.map((row) => String((row as { player_side: string }).player_side))).size !== 2) throw new Error("Final persistence invariant failed: expected two coverage rows");
    const rates = await db.execute(sql`select player_side, count(*)::int as count, count(distinct metric_code)::int as metric_count from metric_coverage_rates where user_id = ${ownerId}::uuid and audit_run_id = ${runId}::uuid group by player_side`);
    const rateCount = rates.rows.reduce((sum, row) => sum + Number((row as { count?: number }).count ?? 0), 0);
    const uniqueRateCount = rates.rows.reduce((sum, row) => sum + Number((row as { metric_count?: number }).metric_count ?? 0), 0);
    if (rateCount !== expectedMetricSides || uniqueRateCount !== rateCount || rates.rows.length !== 2) throw new Error("Final persistence invariant failed: metric identity/player-side rate mismatch");
    const decision = await db.execute(sql`select audit_complete from final_decisions where user_id = ${ownerId}::uuid and audit_run_id = ${runId}::uuid limit 1`);
    if (!decision.rows.length || Boolean((decision.rows[0] as { audit_complete?: boolean }).audit_complete) !== expectedAuditComplete) throw new Error("Final persistence invariant failed: final decision completion mismatch");
    return { ok: true };
  }
  if (operation === "audit-conflicts") {
    const runId = uuid(input.runId); if (!runId) throw new Error("Invalid runId");
    const rows = await db.execute(sql`select critical, resolution_status from source_conflicts where user_id = ${ownerId}::uuid and audit_run_id = ${runId}::uuid`);
    return { rows: rows.rows };
  }
  throw new Error(`Unknown audit repository operation: ${operation}`);
}