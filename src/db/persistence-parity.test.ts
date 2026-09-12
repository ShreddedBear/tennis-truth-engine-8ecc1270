import { readFileSync } from "node:fs";
import { and, asc, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { compareMetricRows, type MetricRowForComparison } from "../lib/truth-engine-metric-comparison";
import { runTruthEngineAudit } from "../lib/truth-engine-audit";

// PHASE 17 — DETERMINISTIC DECISION PARITY ACROSS PERSISTENCE LAYERS.
//
// The question this answers is the one the whole migration turns on: does the Truth Engine
// reach the SAME decision from the same evidence when that evidence has been through
// PostgreSQL + Drizzle instead of PostgREST?
//
// It is not a mock. The frozen fixture is real persisted metric_results evidence for the 32
// matches whose stored outcome was INSUFFICIENT_EVIDENCE, exported read-only from the
// Supabase-hosted production database. Each match's rows are WRITTEN to a real PostgreSQL
// through the new layer, READ BACK through it, and the engine is run on what comes back.
// The fingerprint must equal the one computed from the fixture in memory.
//
// That makes it a genuine round-trip test of the persistence change, and it is what would
// catch a type coercion the unit tests cannot see -- a treatment arriving as null, a value
// silently becoming a number, a row ordering that shifts family consolidation.
//
// REQUIRES A DATABASE. Set TEST_DATABASE_URL to a PostgreSQL the test may create and drop
// tables in, then:  TEST_DATABASE_URL=postgresql://... npx vitest run src/db/persistence-parity
const TEST_URL = process.env["TEST_DATABASE_URL"];

interface FrozenMatch {
  match_id: string;
  audit_run_id: string;
  p1: string;
  p2: string;
  stored_independent_winner: string | null;
  rows: MetricRowForComparison[];
}

const fixture = JSON.parse(
  readFileSync(new URL("../lib/__fixtures__/frozen-slate-evidence.json", import.meta.url), "utf8"),
) as { captured_at: string; slate: string; matches: FrozenMatch[] };

/** Everything a decision depends on, compared for exact equality. */
function fingerprint(match: FrozenMatch, rows: MetricRowForComparison[]): string {
  const audit = runTruthEngineAudit(compareMetricRows(rows), match.p1, match.p2);
  return JSON.stringify({
    outcome: audit.decision.outcome,
    winner: audit.audit_winner,
    winner_side: audit.audit_winner_side,
    evidence_percent: audit.decision.evidence_percent,
    directional_families: audit.decision.directional_families,
    support: audit.decision.independent_support_families,
    contra: audit.decision.independent_contradiction_families,
    neutral: audit.decision.neutral_families,
    conflicted: audit.decision.conflicted_families,
    flipping: audit.decision.flipping_families,
    stability: audit.decision.stability,
    stress: audit.stress.comparative_robustness,
    stress_sides: audit.stress.sides,
    underdog: audit.underdog.sides.map((s) => [s.side, s.overall_viability, s.pathways.length]),
    verification: [audit.verification.supports_p1_families, audit.verification.supports_p2_families],
    disagreement: audit.disagreement.overall_severity,
    reason: audit.final_reason,
  });
}

describe.skipIf(!TEST_URL)("the Truth Engine decides identically through PostgreSQL persistence", () => {
  let db: typeof import("./client.server")["db"];
  let closePool: typeof import("./client.server")["closePool"];
  let schema: typeof import("./schema");
  let runId: string;

  beforeAll(async () => {
    process.env["DATABASE_URL"] = TEST_URL;
    const client = await import("./client.server");
    db = client.db;
    closePool = client.closePool;
    schema = await import("./schema");

    // One throwaway match and run to hang the evidence off, so the real foreign keys and
    // CHECK constraints apply to every row written below. Evidence that cannot satisfy the
    // live schema is evidence the engine would never have seen.
    const [match] = await db.insert(schema.matchesTable).values({
      canonical_key: `parity-${Date.now()}`,
      player1_name: "Parity P1",
      player2_name: "Parity P2",
    } as never).returning({ id: schema.matchesTable.id });

    const [run] = await db.insert(schema.auditRunsTable).values({
      match_id: match!.id, run_number: 1, status: "RUNNING",
    } as never).returning({ id: schema.auditRunsTable.id });
    runId = run!.id;
  }, 120_000);

  afterAll(async () => {
    if (closePool) await closePool();
  });

  it("has real frozen evidence to test with", () => {
    expect(fixture.matches.length).toBeGreaterThan(0);
    expect(fixture.matches[0]!.rows.length).toBeGreaterThan(0);
  });

  it("round-trips every frozen match to the same decision", async () => {
    const mismatches: string[] = [];

    for (const match of fixture.matches) {
      await db.delete(schema.metricResultsTable).where(eq(schema.metricResultsTable.audit_run_id, runId));
      await db.insert(schema.metricResultsTable).values(match.rows.map((row) => ({
        audit_run_id: runId,
        metric_code: row.metric_code,
        metric_name: row.metric_code,
        status: "COMPLETE",
        p1_value: row.p1_value ?? null,
        p2_value: row.p2_value ?? null,
        p1_treatment: row.p1_treatment ?? "UNAVAILABLE",
        p2_treatment: row.p2_treatment ?? "UNAVAILABLE",
      })) as never);

      const persisted = await db.select({
        metric_code: schema.metricResultsTable.metric_code,
        p1_value: schema.metricResultsTable.p1_value,
        p2_value: schema.metricResultsTable.p2_value,
        p1_treatment: schema.metricResultsTable.p1_treatment,
        p2_treatment: schema.metricResultsTable.p2_treatment,
      }).from(schema.metricResultsTable)
        .where(eq(schema.metricResultsTable.audit_run_id, runId))
        .orderBy(asc(schema.metricResultsTable.metric_code));

      expect(persisted.length, `${match.match_id}: row count`).toBe(match.rows.length);

      const fromMemory = fingerprint(match, match.rows);
      const fromDatabase = fingerprint(match, persisted);
      if (fromMemory !== fromDatabase) {
        mismatches.push(`${match.match_id} (${match.p1} vs ${match.p2})`);
      }
    }

    expect(mismatches, "matches whose decision changed after a database round trip").toEqual([]);
  }, 600_000);

  it("preserves the exact strings evidence values are graded on", async () => {
    // The engine compares metric values as TEXT -- "1720.53", "62.4%", "3-1", "NA". A
    // driver that coerced any of these to a number would change comparisons without
    // changing any count, so the raw values are checked for identity, not just the verdict.
    const sample = fixture.matches[0]!;
    await db.delete(schema.metricResultsTable).where(eq(schema.metricResultsTable.audit_run_id, runId));
    await db.insert(schema.metricResultsTable).values(sample.rows.map((row) => ({
      audit_run_id: runId, metric_code: row.metric_code, metric_name: row.metric_code,
      status: "COMPLETE",
      p1_value: row.p1_value ?? null, p2_value: row.p2_value ?? null,
      p1_treatment: row.p1_treatment ?? "UNAVAILABLE", p2_treatment: row.p2_treatment ?? "UNAVAILABLE",
    })) as never);

    for (const row of sample.rows) {
      const [back] = await db.select({
        p1_value: schema.metricResultsTable.p1_value,
        p2_value: schema.metricResultsTable.p2_value,
      }).from(schema.metricResultsTable).where(and(
        eq(schema.metricResultsTable.audit_run_id, runId),
        eq(schema.metricResultsTable.metric_code, row.metric_code),
      )).limit(1);
      expect(typeof back!.p1_value, `${row.metric_code} p1 type`).toBe(row.p1_value == null ? "object" : "string");
      expect(back!.p1_value ?? null, `${row.metric_code} p1 value`).toBe(row.p1_value ?? null);
      expect(back!.p2_value ?? null, `${row.metric_code} p2 value`).toBe(row.p2_value ?? null);
    }
  }, 120_000);
});
