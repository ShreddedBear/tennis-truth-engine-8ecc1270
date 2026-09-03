// ----------------------------------------------------------------------------
// SINGLE SOURCE OF TRUTH for the Run Audit pipeline's stage order and the
// dependency graph derived from it. This is the CANONICAL 16-stage model:
// exactly one visible diagnostic entry per stage, per audit_run_id, always
// rendered in this fixed 1-16 order regardless of database row order,
// insertion time, or retry/attempt history.
//
// Required order: match ingestion/PDF extraction -> identity verification ->
// context verification -> definition instantiation -> P1 metric execution ->
// P2 metric execution -> verification audit -> disagreement/trap audit ->
// dangerous underdog audit -> stress/removal tests -> independent conclusion
// -> matrix reveal/combination -> current calibration -> coverage
// persistence/evidence validation -> final decision -> final combination
// gate.
//
// This is a strictly linear pipeline: every stage depends on every stage
// before it in STAGES, not just its immediate predecessor. STAGE_DEPENDENCIES
// captures that full ordered prefix per stage so both the execution loop
// (audit-pipeline.ts), the completion engine (audit-engine.ts), the
// persistence layer (audit-repo.server.ts) and the UI all prove "every
// required upstream dependency completed successfully" from the same
// definition -- none of them can drift from the others about what "done"
// means for a given stage, or about display order.
//
// Deliberately dependency-free (no imports) so audit-pipeline.ts,
// audit-engine.ts and UI route files can all import it without creating a
// cycle or pulling in server-only code.
// ----------------------------------------------------------------------------

export const STAGES = [
  "MATCH INGESTION / PDF EXTRACTION",
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
  // Kept as "...COMPARISON" (not "...COMBINATION") to match every existing
  // persisted audit_stage_runs row and in-flight run -- renaming this string
  // would silently orphan live data and any run already past this stage.
  "MATRIX REVEAL AND COMPARISON",
  "CURRENT CALIBRATION APPLICATION",
  "COVERAGE PERSISTENCE / EVIDENCE VALIDATION",
  "FINAL DECISION",
  "FINAL COMBINATION GATE",
] as const;

export type Stage = (typeof STAGES)[number];

export const FINAL_STAGE: Stage = STAGES[STAGES.length - 1];

// stage -> every stage that must already be COMPLETE before this stage may
// start or be persisted as COMPLETE. Computed once from STAGES' own order so
// there is exactly one place that encodes "what comes before what".
export const STAGE_DEPENDENCIES: Readonly<Record<Stage, readonly Stage[]>> = Object.freeze(
  Object.fromEntries(STAGES.map((stage, index) => [stage, Object.freeze(STAGES.slice(0, index))])) as Record<
    Stage,
    readonly Stage[]
  >,
);

// Structural, not the full StageRow -- both audit-pipeline.ts's StageRow and
// audit-repo.server.ts's raw Supabase rows already satisfy this shape.
export interface StageStatusRow {
  stage: string;
  status: string;
}

// Returns every upstream stage STAGE_DEPENDENCIES requires for `stage` that
// is not currently COMPLETE in `rows`. Empty result = every required
// upstream dependency has successfully completed.
export function unmetDependencies(stage: Stage, rows: readonly StageStatusRow[]): Stage[] {
  const byStage = new Map(rows.map((row) => [row.stage, row.status]));
  return STAGE_DEPENDENCIES[stage].filter((dep) => byStage.get(dep) !== "COMPLETE");
}

// Normalizes arbitrary audit_stage_runs-shaped rows into exactly one entry
// per canonical stage, in canonical 1-16 order -- never database insertion
// order, updated_at, attempt number, or whichever row happened to return
// first. Rows MUST already be scoped to a single audit_run_id by the caller;
// this function has no way to tell a stale prior run's row for a stage apart
// from the current run's, so it does not attempt cross-run scoping itself.
//
// If a stage name repeats in `rows` (defense in depth only -- the DB's
// (audit_run_id, stage) unique constraint should make this impossible for a
// properly-scoped query), the further-along row wins: COMPLETE beats
// RUNNING/PARTIAL beats BLOCKED/FAILED beats anything else/PENDING. A stage
// with no row at all yet renders as `row: null` (PENDING/not started) rather
// than being omitted, so the canonical list always has exactly 16 entries.
export function canonicalizeStageRows<T extends StageStatusRow>(rows: readonly T[]): Array<{ stage: Stage; row: T | null }> {
  const rank = (status: string) => (status === "COMPLETE" ? 3 : status === "RUNNING" || status === "PARTIAL" ? 2 : status === "BLOCKED" || status === "FAILED" ? 1 : 0);
  const byStage = new Map<string, T>();
  for (const row of rows) {
    const existing = byStage.get(row.stage);
    if (!existing || rank(row.status) > rank(existing.status)) byStage.set(row.stage, row);
  }
  return STAGES.map((stage) => ({ stage, row: byStage.get(stage) ?? null }));
}
