// METRIC COVERAGE REPORT — read-only diagnostic over the ACTIVE slate's real metric_results.
//
// Answers exactly what was asked: per active metric code, how many of the active slate's
// (match x side) opportunities landed in each activation status, and why. Reuses the
// production classifier verbatim (classifySideActivation / metric-activation-status.ts) and
// the production active-code list (ACTIVE_METRIC_CODES / truth-engine-active-metrics.ts) --
// no denominator, threshold, activation rule, or classification rule is redefined here.
//
// READ-ONLY. No writes, no db:cutover, no Supabase access, no secret values touched.
//
// Run with: npx tsx scripts/metric-coverage-report.ts
import { db, closePool } from "../src/db/client.server";
import { matchesTable, auditRunsTable, summaryVersionsTable, metricResultsTable } from "../src/db/schema";
import { inArray } from "drizzle-orm";
import { activeSlateMatchIds, activeRunIds } from "../src/lib/current-audit-state";
import { ACTIVE_METRIC_CODES, normalizeMetricCode } from "../src/lib/truth-engine-active-metrics";
import { classifySideActivation, type ActivationStatus } from "../src/lib/metric-activation-status";

// The four grouped failure categories the report was asked for. Each is a plain relabeling
// of ActivationStatus values already produced by the unmodified classifier -- nothing here
// changes which bucket any row lands in, only which of the requested labels that bucket is
// printed under.
function bucketFor(status: ActivationStatus): "transient" | "permanent_provider" | "identity_date_surface" | "parser_calculation" | null {
  switch (status) {
    case "RETRYING": return "transient";
    case "PRODUCER_FAILURE": return "permanent_provider";
    case "IDENTITY_MISMATCH":
    case "CONTEXT_MISMATCH": return "identity_date_surface";
    case "PARSE_FAILURE": return "parser_calculation";
    default: return null;
  }
}

interface CodeStats {
  code: string;
  opportunities: number;
  ACTIVATED: number;
  SOURCE_EMPTY: number;
  INSUFFICIENT_SAMPLE: number;
  GENUINELY_UNAVAILABLE: number;
  NOT_ATTEMPTED: number;
  transient: number;
  permanent_provider: number;
  identity_date_surface: number;
  parser_calculation: number;
  reasonCounts: Map<string, number>;
  providerCounts: Map<string, number>;
}

async function main() {
  const [matches, runs, versions] = await Promise.all([
    db.select({ id: matchesTable.id }).from(matchesTable),
    db.select({
      id: auditRunsTable.id, match_id: auditRunsTable.match_id,
      status: auditRunsTable.status, run_number: auditRunsTable.run_number,
    }).from(auditRunsTable),
    db.select({ match_id: summaryVersionsTable.match_id, is_active: summaryVersionsTable.is_active }).from(summaryVersionsTable),
  ]);

  const activeMatchIds = activeSlateMatchIds(versions);
  const runIds = [...activeRunIds(runs, activeMatchIds)];
  console.log(`Active slate: ${activeMatchIds.size} matches, ${runIds.length} active audit runs (matches on slate with no run at all are counted as NOT_ATTEMPTED across all 25 codes below).`);

  const metricRows = runIds.length
    ? await db.select().from(metricResultsTable).where(inArray(metricResultsTable.audit_run_id, runIds))
    : [];

  const byRunAndCode = new Map<string, typeof metricRows[number]>();
  for (const row of metricRows) {
    byRunAndCode.set(`${row.audit_run_id}::${normalizeMetricCode(row.metric_code)}`, row);
  }

  const stats: CodeStats[] = ACTIVE_METRIC_CODES.map((code) => ({
    code, opportunities: 0, ACTIVATED: 0, SOURCE_EMPTY: 0, INSUFFICIENT_SAMPLE: 0,
    GENUINELY_UNAVAILABLE: 0, NOT_ATTEMPTED: 0, transient: 0, permanent_provider: 0,
    identity_date_surface: 0, parser_calculation: 0, reasonCounts: new Map(), providerCounts: new Map(),
  }));
  const statsByCode = new Map(stats.map((s) => [s.code, s]));

  for (const runId of runIds) {
    for (const code of ACTIVE_METRIC_CODES) {
      const row = byRunAndCode.get(`${runId}::${code}`);
      const s = statsByCode.get(code)!;
      for (const side of ["p1", "p2"] as const) {
        s.opportunities++;
        const treatment = row ? (row[`${side}_treatment`] as string | null) : null;
        const value = row ? (row[`${side}_value`] as string | null) : null;
        const reason = row ? (row[`${side}_unavailable_reason`] as string | null) : null;
        const status = classifySideActivation({ executed: !!row, treatment, value, reason, retriesExhausted: true });
        if (status === "ACTIVATED" || status === "SOURCE_EMPTY" || status === "INSUFFICIENT_SAMPLE" || status === "GENUINELY_UNAVAILABLE" || status === "NOT_ATTEMPTED") {
          s[status]++;
        }
        const bucket = bucketFor(status);
        if (bucket) s[bucket]++;
        if (status !== "ACTIVATED" && status !== "NOT_ATTEMPTED") {
          const reasonKey = reason ?? "(no reason recorded)";
          s.reasonCounts.set(reasonKey, (s.reasonCounts.get(reasonKey) ?? 0) + 1);
        }
        if (row) {
          const providerErr = row[`${side}_provider_error`] as string | null;
          const sources = Array.isArray(row.sources) ? (row.sources as Array<{ source_name?: string }>) : [];
          const providerNames = sources.map((src) => src?.source_name).filter(Boolean) as string[];
          const label = providerErr ? `provider_error: ${providerErr}` : providerNames.length ? providerNames.join(", ") : null;
          if (label && status !== "ACTIVATED") s.providerCounts.set(label, (s.providerCounts.get(label) ?? 0) + 1);
        }
      }
    }
  }

  const ranked = [...stats].sort((a, b) => {
    const coverageA = a.opportunities > 0 ? a.ACTIVATED / a.opportunities : 0;
    const coverageB = b.opportunities > 0 ? b.ACTIVATED / b.opportunities : 0;
    if (coverageA !== coverageB) return coverageA - coverageB; // 1. lowest coverage first
    const lostA = a.opportunities - a.ACTIVATED, lostB = b.opportunities - b.ACTIVATED;
    return lostB - lostA; // 2. more matches lost first
  });

  console.log("\n=== PER-METRIC BREAKDOWN (ranked: lowest coverage first, then most opportunities lost) ===\n");
  for (const s of ranked) {
    const coveragePercent = s.opportunities > 0 ? ((s.ACTIVATED / s.opportunities) * 100).toFixed(1) : "0.0";
    const lost = s.opportunities - s.ACTIVATED;
    const topReason = [...s.reasonCounts.entries()].sort((a, b) => b[1] - a[1])[0];
    const topProvider = [...s.providerCounts.entries()].sort((a, b) => b[1] - a[1])[0];
    console.log(`--- ${s.code} --- coverage ${coveragePercent}% | opportunities lost: ${lost}/${s.opportunities}`);
    console.log(`  ACTIVE=${s.ACTIVATED} SOURCE_EMPTY=${s.SOURCE_EMPTY} INSUFFICIENT_SAMPLE=${s.INSUFFICIENT_SAMPLE} GENUINELY_UNAVAILABLE=${s.GENUINELY_UNAVAILABLE} NOT_APPLICABLE(NOT_ATTEMPTED)=${s.NOT_ATTEMPTED}`);
    console.log(`  transient=${s.transient} permanent/provider=${s.permanent_provider} identity/date/surface=${s.identity_date_surface} parser/calculation=${s.parser_calculation}`);
    console.log(`  top failure reason: ${topReason ? `${topReason[0]} (${topReason[1]})` : "none"}`);
    console.log(`  top source/provider responsible: ${topProvider ? `${topProvider[0]} (${topProvider[1]})` : "none recorded"}`);
  }

  await closePool();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
