// ----------------------------------------------------------------------------
// SINGLE SOURCE OF TRUTH for the Run Audit pipeline's stage order and the
// dependency graph derived from it.
//
// Required order: extraction/identity -> context -> definition instantiation
// -> P1 metric execution -> P2 metric execution -> verification audit ->
// disagreement/trap audit -> dangerous underdog audit -> stress/removal
// tests -> independent conclusion -> matrix reveal/comparison -> current
// calibration -> final combination gate.
//
// This is a strictly linear pipeline: every stage depends on every stage
// before it in STAGES, not just its immediate predecessor. STAGE_DEPENDENCIES
// captures that full ordered prefix per stage so both the execution loop
// (audit-pipeline.ts) and the completion engine (audit-engine.ts) can prove
// "every required upstream dependency completed successfully" from the same
// definition -- neither can drift from the other about what "done" means for
// a given stage.
//
// Deliberately dependency-free (no imports) so both audit-pipeline.ts and
// audit-engine.ts can import it without creating a cycle between them.
// ----------------------------------------------------------------------------

export const STAGES = [
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
  "MATRIX REVEAL AND COMPARISON",
  "CURRENT CALIBRATION APPLICATION",
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
