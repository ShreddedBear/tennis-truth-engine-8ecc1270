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
