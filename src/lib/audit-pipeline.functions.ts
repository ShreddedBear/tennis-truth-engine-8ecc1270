// Thin server-function wrapper around the audit execution pipeline.
// Module scope must stay free of runtime helpers (server-fn splitting).
import { createServerFn } from "@tanstack/react-start";

// Any run below full legitimate evidence coverage gets one repair pass per
// version. Existing usable sides are preserved; only unavailable/excluded
// metric sides are reopened. Bump this version whenever new evidence wiring is
// shipped so completed historical runs can benefit without deleting good data.
const EVIDENCE_COVERAGE_RECOVERY_VERSION = "2026-08-25-v4-sub100-uplift";
const BROWSER_SAFE_BUDGET_MS = 20_000;

export const runAuditPipeline = createServerFn({ method: "POST" })
  .inputValidator((data: { matchId: string; budgetMs?: number }) => {
    if (!data || typeof data.matchId !== "string" || data.matchId.length < 10) throw new Error("matchId is required");
    return { matchId: data.matchId, budgetMs: data.budgetMs };
  })
  .handler(async ({ data }) => {
    const [{ makeDeps }, pipeline] = await Promise.all([import("./audit-repo.server"), import("./audit-pipeline")]);
    const { runPipeline, STAGES } = pipeline; const deps = await makeDeps();
    const applyMetaIfReady = async (runId: string) => {
      const stages = await deps.getStages(runId);
      const p1Done = stages.find((s) => s.stage === "P1 METRIC EXECUTION")?.status === "COMPLETE";
      const p2Done = stages.find((s) => s.stage === "P2 METRIC EXECUTION")?.status === "COMPLETE";
      if (!p1Done || !p2Done) return { changed: false, reopenedGate: false };
      const { applySafeMetaDerivedMetrics, applySafeStressDerivedMetrics } = await import("./meta-derived-evidence.server");
      const metricMetaChanged = await applySafeMetaDerivedMetrics(deps, runId);
      const underdogDone = stages.find((s) => s.stage === "DANGEROUS UNDERDOG AUDIT")?.status === "COMPLETE";
      let pathwayMetaChanged = false;
      if (underdogDone) {
        const match = await deps.getMatch(data.matchId);
        if (match) {
          const { applyOpponentWinPathwaysMetric } = await import("./opponent-win-pathways-meta.server");
          pathwayMetaChanged = await applyOpponentWinPathwaysMetric(deps, runId, match.player1_name, match.player2_name);
        }
      }
      const stressDone = stages.find((s) => s.stage === "STRESS / REMOVAL TESTS")?.status === "COMPLETE";
      let stressMetaChanged = false;
      let finalAdvancedChanged = false;
      if (stressDone) {
        stressMetaChanged = await applySafeStressDerivedMetrics(deps, runId);
        const { applyFinalAdvancedMetric } = await import("./final-advanced-meta.server");
        finalAdvancedChanged = await applyFinalAdvancedMetric(deps, runId);
      }
      const changed = metricMetaChanged || pathwayMetaChanged || stressMetaChanged || finalAdvancedChanged;
      if (!changed) return { changed: false, reopenedGate: false };
      const finalGate = stages.find((s) => s.stage === "FINAL COMBINATION GATE");
      if (finalGate?.status === "COMPLETE") {
        await deps.setStage(runId, data.matchId, "FINAL COMBINATION GATE", { status: "PENDING", done_count: 0, total_count: 1, error_code: null, error_message: null, finished_at: null });
        await deps.updateRun(runId, { status: "RUNNING" });
        await deps.log({ audit_run_id: runId, match_id: data.matchId, stage: "META-DERIVED EVIDENCE REFRESH", status: "COMPLETE", output: { reason: "Safe meta-derived metric rows changed; Final Combination Gate reopened for coverage recalculation.", metric_meta_changed: metricMetaChanged, pathway_meta_changed: pathwayMetaChanged, stress_meta_changed: stressMetaChanged, final_advanced_changed: finalAdvancedChanged }, matrix_visible: false });
        return { changed: true, reopenedGate: true };
      }
      return { changed: true, reopenedGate: false };
    };
    try {
      const latest = await deps.getLatestRun(data.matchId);
      if (latest) {
        const [metrics, verification, disagreement, stages, match] = await Promise.all([deps.list("metric_results", latest.id),deps.list("verification_results", latest.id),deps.list("disagreement_results", latest.id),deps.getStages(latest.id),deps.getMatch(data.matchId)]);
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
          const alreadyRecovered=runMeta.independent_inputs?.["evidence_coverage_recovery_version"]===EVIDENCE_COVERAGE_RECOVERY_VERSION;
          if (usablePercent < 100 && !alreadyRecovered) {
            for (const row of metrics) {
              const p1Usable=usableTreatment(row["p1_treatment"]),p2Usable=usableTreatment(row["p2_treatment"]);
              if(p1Usable&&p2Usable)continue;
              const patch:Record<string,unknown>={status:"NOT STARTED",reconstruction_attempted:false};
              // Preserve every already-usable side. Only a side that is not
              // DIRECT/RECONSTRUCTED/PARTIAL is reopened for legitimate new
              // evidence. Treatment columns remain NOT NULL throughout.
              if(!p1Usable){patch["p1_status"]="NOT STARTED";patch["p1_treatment"]="UNAVAILABLE";patch["p1_unavailable_reason"]=null;patch["p1_provider_error"]=null;}
              if(!p2Usable){patch["p2_status"]="NOT STARTED";patch["p2_treatment"]="UNAVAILABLE";patch["p2_unavailable_reason"]=null;patch["p2_provider_error"]=null;}
              await deps.update("metric_results",String(row["id"]),patch);
            }
            // An UNVERIFIED identity can suppress otherwise legitimate player
            // evidence. Re-run identity/context in that narrow case; verified
            // matches restart directly at metric execution.
            const identityNeedsRepair=!!match && match.identity_status!=="VERIFIED";
            const restartStage=identityNeedsRepair?"MATCH IDENTITY VERIFICATION":"P1 METRIC EXECUTION";
            const restartFrom=STAGES.indexOf(restartStage);
            for(const stage of STAGES.slice(restartFrom))await deps.setStage(latest.id,data.matchId,stage,{status:"PENDING",done_count:0,total_count:stage==="P1 METRIC EXECUTION"||stage==="P2 METRIC EXECUTION"?metrics.length:0,error_code:null,error_message:null,finished_at:null});
            await deps.updateRun(latest.id,{status:"RUNNING",independent_decision_committed_at:null,matrix_revealed_at:null,independent_winner:null,independent_low:null,independent_high:null,effective_evidence_count:usableSides,independent_inputs:{...(runMeta.independent_inputs??{}),evidence_coverage_recovery_version:EVIDENCE_COVERAGE_RECOVERY_VERSION,prior_usable_evidence_percent:Number(usablePercent.toFixed(1))}});
            await deps.log({audit_run_id:latest.id,match_id:data.matchId,stage:"EVIDENCE COVERAGE RECOVERY",status:"RUNNING",output:{reason:"Reopened only unresolved metric sides so newly wired legitimate evidence can raise any sub-100% completed run without discarding prior usable evidence.",metric_rows:metrics.length,prior_usable_sides:usableSides,prior_usable_percent:Number(usablePercent.toFixed(1)),identity_repair:identityNeedsRepair,recovery_version:EVIDENCE_COVERAGE_RECOVERY_VERSION},matrix_visible:false});
          }
        }
        // Existing completed metric/underdog/stress sweeps can be upgraded without rerunning tennis research.
        await applyMetaIfReady(latest.id);
      }
      // Keep each browser-triggered server invocation short enough to return
      // before Lovable/Safari drops the transport. runPipeline persists partial
      // stage progress, so the next invocation resumes the same run instead of
      // restarting or creating a duplicate run.
      const result=await runPipeline(deps,data.matchId,{budgetMs:data.budgetMs??BROWSER_SAFE_BUDGET_MS});
      const meta = await applyMetaIfReady(result.runId);
      return{ok:true as const,runId:result.runId,complete:meta.reopenedGate?false:result.complete,nextStage:meta.reopenedGate?"FINAL COMBINATION GATE":result.nextStage,stages:result.stages,failures:result.failures,color:result.report?.color??null,completionPercent:result.report?.completionPercent??null,auditComplete:meta.reopenedGate?false:(result.report?.auditComplete??false)};
    } catch(error) {
      return{ok:false as const,runId:null,complete:false,nextStage:null,stages:[] as Array<{stage:string;status:string;detail:string}>,failures:[{stage:"PIPELINE",message:error instanceof Error?error.message:String(error)}],color:null,completionPercent:null,auditComplete:false};
    }
  });
