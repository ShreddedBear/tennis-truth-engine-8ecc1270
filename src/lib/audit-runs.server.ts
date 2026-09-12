// Audit-run seeding and execution logging. SERVER ONLY.
//
// This was browser code: audit-runs.ts held a Supabase anon-key client and the UI wrote
// execution_logs directly from the match page. The browser has no database credential any
// more, so the reads and writes live here and are reached through audit-runs.functions.ts.
import { desc, eq } from "drizzle-orm";

import { db } from "@/db/client.server";
import {
  auditRunsTable, disagreementResultsTable, executionLogsTable, matchesTable,
  metricResultsTable, ruleDocumentsTable, rulesTable, stressResultsTable, underdogResultsTable,
  verificationResultsTable,
} from "@/db/schema";
import { metricResultSeedRows } from "./audit-runs";
import { STRESS_TESTS, UNDERDOG_PATHWAYS } from "./constants";

export interface ExecutionLogEntry {
  audit_run_id?: string | null;
  match_id?: string | null;
  stage: string;
  status: string;
  rule_code?: string | null;
  player_side?: string | null;
  output?: unknown;
  matrix_visible?: boolean;
}

export async function log(entry: ExecutionLogEntry): Promise<void> {
  try {
    await db.insert(executionLogsTable).values({
      audit_run_id: entry.audit_run_id ?? null,
      match_id: entry.match_id ?? null,
      stage: entry.stage,
      status: entry.status,
      rule_code: entry.rule_code ?? null,
      player_side: entry.player_side ?? null,
      output: (entry.output ?? null) as never,
      matrix_visible: entry.matrix_visible ?? false,
    } as never);
  } catch (error) {
    throw new Error(`Could not persist execution log: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function activeVersionId(docType: string): Promise<string | null> {
  try {
    const [document] = await db
      .select({ active_version_id: ruleDocumentsTable.active_version_id })
      .from(ruleDocumentsTable)
      .where(eq(ruleDocumentsTable.doc_type, docType))
      .limit(1);
    return document?.active_version_id ?? null;
  } catch (error) {
    throw new Error(`Could not load active ${docType} definitions: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function rulesFor(versionId: string | null) {
  if (!versionId) return [];
  try {
    return await db.select({
      id: rulesTable.id, rule_code: rulesTable.rule_code, rule_name: rulesTable.rule_name,
      severity: rulesTable.severity, blocking: rulesTable.blocking, mapping_status: rulesTable.mapping_status,
    }).from(rulesTable).where(eq(rulesTable.version_id, versionId)).orderBy(rulesTable.rule_code);
  } catch (error) {
    throw new Error(`Could not load rules for ${versionId}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Seeds a fresh audit run and every child row the 16 stages expect to find waiting.
 *
 * NOT CURRENTLY REACHED. The live creation path is audit-repo.server.ts's createRun, used
 * by the pipeline. This is carried through the migration unchanged in behaviour rather than
 * deleted, because removing production code is not the migration's job -- but it is a
 * second audit-run creation path, and if it is ever revived it has to stay in lockstep with
 * audit-pipeline.ts's instantiate(), exactly as metricResultSeedRows' own comment says.
 *
 * The inserts below are deliberately NOT wrapped in a transaction. They were not before,
 * and a failure part-way has always left a partially seeded RUNNING run. That is worth
 * fixing, but fixing it here would change failure behaviour under cover of a driver swap.
 */
export async function createAuditRun(matchId: string) {
  const [verId, disId, metId] = await Promise.all([
    activeVersionId("VERIFICATION"),
    activeVersionId("DISAGREEMENT"),
    activeVersionId("METRICS"),
  ]);

  let prior: Array<{ run_number: number }>;
  try {
    prior = await db.select({ run_number: auditRunsTable.run_number }).from(auditRunsTable)
      .where(eq(auditRunsTable.match_id, matchId))
      .orderBy(desc(auditRunsTable.run_number)).limit(1);
  } catch (error) {
    throw new Error(`Could not read prior audit runs: ${error instanceof Error ? error.message : String(error)}`);
  }

  const [run] = await db.insert(auditRunsTable).values({
    match_id: matchId,
    run_number: (prior[0]?.run_number ?? 0) + 1,
    research_lock_at: new Date().toISOString(),
    verification_version_id: verId,
    disagreement_version_id: disId,
    metrics_version_id: metId,
    status: "RUNNING",
  } as never).returning();
  if (!run) throw new Error("Could not create audit run");

  const [metricRules, verRules, disRules] = await Promise.all([rulesFor(metId), rulesFor(verId), rulesFor(disId)]);

  const chunked = async <T,>(label: string, rows: T[], insert: (batch: T[]) => Promise<unknown>) => {
    for (let i = 0; i < rows.length; i += 200) {
      try {
        await insert(rows.slice(i, i + 200));
      } catch (error) {
        throw new Error(`Could not seed ${label}: ${error instanceof Error ? error.message : "database insert failed"}`);
      }
    }
  };

  await chunked("metric results", metricResultSeedRows(run.id, metricRules),
    (batch) => db.insert(metricResultsTable).values(batch as never));

  await chunked("verification results", verRules.map((r) => ({
    audit_run_id: run.id, rule_id: r.id, rule_code: r.rule_code, rule_name: r.rule_name,
    severity: r.severity, status: "NOT STARTED", outcome: "NOT STARTED",
  })), (batch) => db.insert(verificationResultsTable).values(batch as never));

  await chunked("disagreement results", disRules.map((r) => ({
    audit_run_id: run.id, rule_id: r.id, rule_code: r.rule_code, rule_name: r.rule_name,
    status: "NOT STARTED",
  })), (batch) => db.insert(disagreementResultsTable).values(batch as never));

  let match: { player1_name: string; player2_name: string } | undefined;
  try {
    [match] = await db.select({ player1_name: matchesTable.player1_name, player2_name: matchesTable.player2_name })
      .from(matchesTable).where(eq(matchesTable.id, matchId)).limit(1);
  } catch (error) {
    throw new Error(`Could not load match identity: ${error instanceof Error ? error.message : String(error)}`);
  }

  const sides = [match?.player1_name ?? "Player 1", match?.player2_name ?? "Player 2"];
  try {
    await db.insert(underdogResultsTable).values(sides.flatMap((side) =>
      UNDERDOG_PATHWAYS.map(([code, name]) => ({
        audit_run_id: run.id, pathway_code: code, pathway_name: name, player_side: side,
        classification: "UNRESOLVED", status: "NOT STARTED",
      })),
    ) as never);
  } catch (error) {
    throw new Error(`Could not seed underdog results: ${error instanceof Error ? error.message : String(error)}`);
  }

  try {
    await db.insert(stressResultsTable).values(STRESS_TESTS.map(([code, name]) => ({
      audit_run_id: run.id, test_code: code, test_name: name,
      status: "NOT STARTED", outcome: "NOT STARTED",
    })) as never);
  } catch (error) {
    throw new Error(`Could not seed stress results: ${error instanceof Error ? error.message : String(error)}`);
  }

  await log({
    audit_run_id: run.id,
    match_id: matchId,
    stage: "PRE-MATCH RESEARCH LOCK",
    status: "COMPLETE",
    output: { metrics: metricRules.length, verification: verRules.length, disagreement: disRules.length },
  });

  return run;
}
