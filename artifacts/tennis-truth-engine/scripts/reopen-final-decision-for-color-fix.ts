// One-off backfill for the audit-engine.ts color/action fix (evaluate() no longer gates
// color on stagesComplete). Any run that completed BEFORE that fix has its
// final_decisions.final_audit_color/action frozen at "INCOMPLETE"/"CONTINUE PROCESSING"
// even though the audit is genuinely done -- reopens FINAL DECISION and FINAL
// COMBINATION GATE (the only two stages whose output depends on the fix) and lets
// runPipeline re-execute them through the real, tested code path, exactly the same
// reopening idiom dispatchAuditBatch's applyMetaIfReady already uses elsewhere in this
// codebase. Every other stage, and the underlying metric evidence, is untouched.
//
//   npx tsx scripts/reopen-final-decision-for-color-fix.ts <matchId> [matchId...]
import { makeDeps } from "../src/lib/audit-repo.server";
import { runPipeline } from "../src/lib/audit-pipeline";

async function main() {
  const matchIds = process.argv.slice(2);
  if (!matchIds.length) throw new Error("Usage: reopen-final-decision-for-color-fix.ts <matchId> [matchId...]");
  const deps = await makeDeps();
  for (const matchId of matchIds) {
    const run = await deps.getLatestRun(matchId);
    if (!run) { console.log(matchId, "-> no run found, skipping"); continue; }
    for (const stage of ["FINAL DECISION", "FINAL COMBINATION GATE"] as const) {
      await deps.setStage(run.id, matchId, stage, { status: "PENDING", done_count: 0, total_count: 1, error_code: null, error_message: null, finished_at: null });
    }
    await deps.updateRun(run.id, { status: "RUNNING" });
    const result = await runPipeline(deps, matchId, { budgetMs: 60_000 });
    console.log(matchId, "->", { complete: result.complete, color: result.report?.color, action: result.report?.action, completionPercent: result.report?.completionPercent });
  }
}

main().catch((error) => { console.error(error); process.exit(1); });
