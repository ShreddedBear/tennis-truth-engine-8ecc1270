// Thin server-function wrapper around the audit execution pipeline.
// Module scope must stay free of runtime helpers (server-fn splitting).
import { createServerFn } from "@tanstack/react-start";

export const runAuditPipeline = createServerFn({ method: "POST" })
  .inputValidator((data: { matchId: string; budgetMs?: number }) => {
    if (!data || typeof data.matchId !== "string" || data.matchId.length < 10) {
      throw new Error("matchId is required");
    }
    return { matchId: data.matchId, budgetMs: data.budgetMs };
  })
  .handler(async ({ data }) => {
    const [{ makeDeps }, { runPipeline }] = await Promise.all([
      import("./audit-repo.server"),
      import("./audit-pipeline"),
    ]);
    const deps = await makeDeps();
    try {
      // Repair legacy/poisoned runs that were previously allowed to reach COMPLETE
      // with 0 metric/rule definitions. Reusing those runs makes every later code
      // improvement invisible because completed stages are skipped forever.
      const latest = await deps.getLatestRun(data.matchId);
      if (latest) {
        const [metrics, verification, disagreement, stages] = await Promise.all([
          deps.list("metric_results", latest.id),
          deps.list("verification_results", latest.id),
          deps.list("disagreement_results", latest.id),
          deps.getStages(latest.id),
        ]);
        const structurallyEmpty = metrics.length === 0 || verification.length === 0 || disagreement.length === 0;
        const definitionStage = stages.find((s) => s.stage === "DEFINITION INSTANTIATION");
        const falselyTerminal = latest.status === "COMPLETE" || latest.status === "BLOCKED";
        const badDefinitionCompletion = definitionStage?.status === "COMPLETE" && (definitionStage.total_count ?? 0) === 0;
        if (falselyTerminal && (structurallyEmpty || badDefinitionCompletion)) {
          await deps.updateRun(latest.id, {
            status: "INVALIDATED — RERUN REQUIRED",
          });
          await deps.log({
            audit_run_id: latest.id,
            match_id: data.matchId,
            stage: "PRE-RUN STRUCTURAL VALIDATION",
            status: "INVALIDATED",
            output: {
              reason: "Prior terminal run had missing instantiated definitions",
              metric_rows: metrics.length,
              verification_rows: verification.length,
              disagreement_rows: disagreement.length,
              definition_stage_total: definitionStage?.total_count ?? null,
            },
            matrix_visible: false,
          });
        }
      }

      const result = await runPipeline(deps, data.matchId, { budgetMs: data.budgetMs ?? 45_000 });
      return {
        ok: true as const,
        runId: result.runId,
        complete: result.complete,
        nextStage: result.nextStage,
        stages: result.stages,
        failures: result.failures,
        color: result.report?.color ?? null,
        completionPercent: result.report?.completionPercent ?? null,
        auditComplete: result.report?.auditComplete ?? false,
      };
    } catch (error) {
      return {
        ok: false as const,
        runId: null,
        complete: false,
        nextStage: null,
        stages: [] as Array<{ stage: string; status: string; detail: string }>,
        failures: [{ stage: "PIPELINE", message: error instanceof Error ? error.message : String(error) }],
        color: null,
        completionPercent: null,
        auditComplete: false,
      };
    }
  });
