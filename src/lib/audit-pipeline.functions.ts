// Thin server-function wrapper around the audit execution pipeline.
// Module scope must stay free of runtime helpers (server-fn splitting).
import { createServerFn } from "@tanstack/react-start";

const ZERO_EVIDENCE_RECOVERY_VERSION = "2026-08-22-v2-runtime-index";

export const runAuditPipeline = createServerFn({ method: "POST" })
  .inputValidator((data: { matchId: string; budgetMs?: number }) => {
    if (!data || typeof data.matchId !== "string" || data.matchId.length < 10) throw new Error("matchId is required");
    return { matchId: data.matchId, budgetMs: data.budgetMs };
  })
  .handler(async ({ data }) => {
    const [{ makeDeps }, pipeline] = await Promise.all([import("./audit-repo.server"), import("./audit-pipeline")]);
    const { runPipeline, STAGES } = pipeline; const deps = await makeDeps();
    try {
      const latest = await deps.getLatestRun(data.matchId);
      if (latest) {
        const [metrics, verification, disagreement, stages] = await Promise.all([deps.list("metric_results", latest.id),deps.list("verification_results", latest.id),deps.list("disagreement_results", latest.id),deps.getStages(latest.id)]);
        const definitionStage = stages.find((s) => s.stage === "DEFINITION INSTANTIATION");
        const definitionsClaimed = definitionStage?.status === "COMPLETE";
        const structurallyEmpty = definitionsClaimed && (metrics.length === 0 || verification.length === 0 || disagreement.length === 0);
        const falselyTerminal = latest.status === "COMPLETE";
        const badDefinitionCompletion = definitionsClaimed && (definitionStage?.total_count ?? 0) === 0;
        if (falselyTerminal && (structurallyEmpty || badDefinitionCompletion)) {
          await deps.updateRun(latest.id, { status: "INVALIDATED — RERUN REQUIRED" });
          await deps.log({audit_run_id:latest.id,match_id:data.matchId,stage:"PRE-RUN STRUCTURAL VALIDATION",status:"INVALIDATED",output:{reason:"Prior terminal run had missing instantiated definitions",metric_rows:metrics.length,verification_rows:verification.length,disagreement_rows:disagreement.length,definition_stage_total:definitionStage?.total_count??null},matrix_visible:false});
        } else if (metrics.length) {
          const usableTreatment=(t:unknown)=>["DIRECT","RECONSTRUCTED","PARTIAL"].includes(String(t??""));
          const usableSides=metrics.reduce((n,m)=>n+(usableTreatment(m["p1_treatment"])?1:0)+(usableTreatment(m["p2_treatment"])?1:0),0);
          const totalSides=metrics.length*2, usablePercent=totalSides?100*usableSides/totalSides:0;
          const runMeta=latest as unknown as {independent_inputs?:Record<string,unknown>};
          const alreadyRecovered=runMeta.independent_inputs?.["zero_evidence_recovery_version"]===ZERO_EVIDENCE_RECOVERY_VERSION;
          // Re-open legacy low-coverage runs (<10%), including the 1.2% Cincinnati
          // runs, because they predate the Cloudflare-safe bundled evidence index.
          if (usablePercent < 10 && !alreadyRecovered) {
            for (const row of metrics) {
              const patch:Record<string,unknown>={status:"NOT STARTED",reconstruction_attempted:false};
              if(!usableTreatment(row["p1_treatment"])){patch["p1_status"]="NOT STARTED";patch["p1_treatment"]=null;patch["p1_unavailable_reason"]=null;patch["p1_provider_error"]=null;}
              if(!usableTreatment(row["p2_treatment"])){patch["p2_status"]="NOT STARTED";patch["p2_treatment"]=null;patch["p2_unavailable_reason"]=null;patch["p2_provider_error"]=null;}
              await deps.update("metric_results",String(row["id"]),patch);
            }
            const restartFrom=STAGES.indexOf("P1 METRIC EXECUTION");
            for(const stage of STAGES.slice(restartFrom))await deps.setStage(latest.id,data.matchId,stage,{status:"PENDING",done_count:0,total_count:stage==="P1 METRIC EXECUTION"||stage==="P2 METRIC EXECUTION"?metrics.length:0,error_code:null,error_message:null,finished_at:null});
            await deps.updateRun(latest.id,{status:"RUNNING",independent_decision_committed_at:null,matrix_revealed_at:null,independent_winner:null,independent_low:null,independent_high:null,effective_evidence_count:0,independent_inputs:{...(runMeta.independent_inputs??{}),zero_evidence_recovery_version:ZERO_EVIDENCE_RECOVERY_VERSION}});
            await deps.log({audit_run_id:latest.id,match_id:data.matchId,stage:"ZERO EVIDENCE RECOVERY",status:"RUNNING",output:{reason:"Reopened low-coverage metric treatments after Cloudflare-safe bundled historical evidence integration.",metric_rows:metrics.length,prior_usable_sides:usableSides,prior_usable_percent:Number(usablePercent.toFixed(1)),recovery_version:ZERO_EVIDENCE_RECOVERY_VERSION},matrix_visible:false});
          }
        }
      }
      const result=await runPipeline(deps,data.matchId,{budgetMs:data.budgetMs??45_000});
      return{ok:true as const,runId:result.runId,complete:result.complete,nextStage:result.nextStage,stages:result.stages,failures:result.failures,color:result.report?.color??null,completionPercent:result.report?.completionPercent??null,auditComplete:result.report?.auditComplete??false};
    } catch(error) {
      return{ok:false as const,runId:null,complete:false,nextStage:null,stages:[] as Array<{stage:string;status:string;detail:string}>,failures:[{stage:"PIPELINE",message:error instanceof Error?error.message:String(error)}],color:null,completionPercent:null,auditComplete:false};
    }
  });
