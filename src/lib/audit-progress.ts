// Shared pipeline-execution progress math, used by both the Upload page
// (while actively driving new runs) and the Active Slate page (while
// displaying/resuming existing runs). "Execution" here means how much of the
// 13-stage pipeline has run — distinct from "Evidence %", which measures how
// much of the evidence is usable (DIRECT/RECONSTRUCTED/PARTIAL).
export interface StageProgressRow { status: string; done_count: number | null; total_count: number | null; }

// Keep in sync with STAGES.length in audit-pipeline.ts (guarded by
// audit-progress.test.ts). Duplicated as a plain constant, rather than
// importing STAGES from audit-pipeline.ts, so this small client-bundled
// module doesn't pull in that file's much larger dependency graph.
const TOTAL_PIPELINE_STAGES = 13;

// Each of the 13 pipeline stages is worth an equal 1/13 share of "Execution",
// regardless of how many items that stage internally processes (2 identity
// checks vs. 80 metrics). A stage not yet reached (no row, or a row still at
// total_count=0 before its own item count is known -- e.g. "DEFINITION
// INSTANTIATION 0/0 RUNNING" right after it starts) contributes exactly 0,
// never a share it hasn't earned. Earlier code additionally excluded any row
// with total_count<=0 from BOTH the numerator and the denominator, which
// silently shrank the denominator to just the tiny handful of early stages
// that already had a known total -- inflating "Execution" to ~100% while
// most of the pipeline, including the very stage that had stalled, had not
// even started.
function stageFraction(row: StageProgressRow): number {
  if (row.status === "COMPLETE") return 1;
  const total = Number(row.total_count) || 0;
  if (row.status === "RUNNING" && total > 0) {
    return Math.min(Math.max((Number(row.done_count) || 0) / total, 0), 1);
  }
  return 0;
}

export function computeExecutionPercent(rows: StageProgressRow[], blockedStatus?: string): number {
  const sum = rows.reduce((acc, row) => acc + stageFraction(row), 0);
  const pct = Math.round((Math.min(sum, TOTAL_PIPELINE_STAGES) / TOTAL_PIPELINE_STAGES) * 100);
  return blockedStatus === "BLOCKED" ? Math.min(pct, 99) : pct;
}

// Aggregates execution percent across many runs at once (one number for the
// whole batch), used by Upload while several matches are being driven together.
export function computeBatchExecutionPercent(rowsByRunId: Map<string, StageProgressRow[]>): number {
  if (!rowsByRunId.size) return 0;
  let sum = 0;
  for (const rows of rowsByRunId.values()) for (const row of rows) sum += stageFraction(row);
  const totalStages = rowsByRunId.size * TOTAL_PIPELINE_STAGES;
  return Math.round((Math.min(sum, totalStages) / totalStages) * 100);
}
