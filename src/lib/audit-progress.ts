// Shared pipeline-execution progress math, used by both the Upload page
// (while actively driving new runs) and the Active Slate page (while
// displaying/resuming existing runs). "Execution" here means how much of the
// 13-stage pipeline has run — distinct from "Evidence %", which measures how
// much of the evidence is usable (DIRECT/RECONSTRUCTED/PARTIAL).
export interface StageProgressRow { status: string; done_count: number | null; total_count: number | null; }

export function computeExecutionPercent(rows: StageProgressRow[], blockedStatus?: string): number {
  if (!rows.length) return 0;
  let done = 0, total = 0;
  for (const s of rows) {
    const t = Number(s.total_count) || 0;
    if (t <= 0) continue;
    total += t;
    if (s.status === "COMPLETE") done += t;
    else if (s.status === "RUNNING") done += Math.min(Number(s.done_count) || 0, t);
  }
  const pct = total ? Math.round((done / total) * 100) : 0;
  return blockedStatus === "BLOCKED" ? Math.min(pct, 99) : pct;
}

// Aggregates execution percent across many runs at once (one number for the
// whole batch), used by Upload while several matches are being driven together.
export function computeBatchExecutionPercent(rowsByRunId: Map<string, StageProgressRow[]>): number {
  let done = 0, total = 0;
  for (const rows of rowsByRunId.values()) {
    for (const s of rows) {
      const t = Number(s.total_count) || 0;
      if (t <= 0) continue;
      total += t;
      if (s.status === "COMPLETE") done += t;
      else if (s.status === "RUNNING") done += Math.min(Number(s.done_count) || 0, t);
    }
  }
  return total ? Math.round((done / total) * 100) : 0;
}
