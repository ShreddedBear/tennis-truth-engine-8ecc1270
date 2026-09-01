// Thin server-function wrapper around the audit execution pipeline.
// Module scope must stay free of runtime helpers (server-fn splitting).
import { createServerFn } from "@tanstack/react-start";

const BROWSER_SAFE_BUDGET_MS = 20_000;

export interface PreparedAuditMatch { matchId: string; [key: string]: unknown; }
export interface AuditBatchInput { matches: PreparedAuditMatch[]; concurrency?: number; budgetMs?: number; }

export async function dispatchAuditBatch(
  data: AuditBatchInput,
  dispatch: (match: PreparedAuditMatch, matchIndex: number) => Promise<unknown> = async (match) => match,
): Promise<Array<{ matchId: string; result?: unknown; error?: unknown }>> {
  const prepared = Array.isArray(data?.matches) ? [...data.matches] : [];
  const concurrency = Math.max(1, Number.isFinite(data?.concurrency) ? Number(data.concurrency) : 1);
  const results: Array<{ matchId: string; result?: unknown; error?: unknown }> = [];
  const queue = prepared.slice();
  const active = new Set<Promise<void>>();
  let nextIndex = 0;

  const scheduleNext = () => {
    if (queue.length === 0 || active.size >= concurrency) return;

    const match = queue.shift()!;
    let task!: Promise<void>;
    task = Promise.resolve()
      .then(() => dispatch(match, nextIndex++))
      .then((result) => {
        results.push({ matchId: String(match.matchId), result });
      })
      .catch((error) => {
        results.push({ matchId: String(match.matchId), error });
      })
      .finally(() => {
        active.delete(task);
        scheduleNext();
      });

    active.add(task);
  };

  while (queue.length || active.size) {
    while (queue.length && active.size < concurrency) {
      scheduleNext();
    }
    if (active.size === 0) break;
    await Promise.race([...active]);
  }

  return results;
}

export const runAuditPipeline = createServerFn({ method: "POST" })
  .inputValidator((data: { matchId: string; budgetMs?: number }) => {
    if (!data || typeof data.matchId !== "string" || data.matchId.length < 10) throw new Error("matchId is required");
    return { matchId: data.matchId, budgetMs: data.budgetMs };
  })
  .handler(async ({ data }) => {
    const [{ makeDeps }, pipeline] = await Promise.all([import("./audit-repo.server"), import("./audit-pipeline")]);
    const { runPipeline } = pipeline; const deps = await makeDeps();
    try {
      // Keep each browser-triggered server invocation short enough to return
      // before Lovable/Safari drops the transport. runPipeline persists partial
      // stage progress, so the next invocation resumes the same run instead of
      // restarting or creating a duplicate run.
      const result=await runPipeline(deps,data.matchId,{budgetMs:data.budgetMs??BROWSER_SAFE_BUDGET_MS});
      return{ok:true as const,runId:result.runId,complete:result.complete,nextStage:result.nextStage,stages:result.stages,failures:result.failures,leaseHeld:result.leaseHeld??false,color:result.report?.color??null,completionPercent:result.report?.completionPercent??null,auditComplete:result.report?.auditComplete??false};
    } catch(error) {
      return{ok:false as const,runId:null,complete:false,nextStage:null,stages:[] as Array<{stage:string;status:string;detail:string}>,failures:[{stage:"PIPELINE",message:error instanceof Error?error.message:String(error)}],color:null,completionPercent:null,auditComplete:false};
    }
  });

export const runAuditBatch = createServerFn({ method: "POST" })
  .inputValidator((data: { matchIds: string[]; budgetMs?: number; concurrency?: number }) => {
    const matchIds=Array.isArray(data?.matchIds)?[...new Set(data.matchIds.filter(id=>typeof id==="string"&&id.length>=10))].slice(0,100):[];
    if(!matchIds.length)throw new Error("At least one matchId is required");
    return{matchIds,budgetMs:data.budgetMs,concurrency:Math.min(4,Math.max(1,Math.floor(data.concurrency??3)))};
  })
  .handler(async({data})=>{
    const batchId=`batch-${Date.now()}-${Math.random().toString(36).slice(2,10)}`;
    const startedAt=Date.now();
    const[{makeDeps},pipeline,{mapBounded}]=await Promise.all([import("./audit-repo.server"),import("./audit-pipeline"),import("./audit-batch")]);
    const deps=await makeDeps();
    const applyMetaIfReady=async(matchId:string,runId:string)=>{
      const stages=await deps.getStages(runId);
      if(stages.find(s=>s.stage==="P1 METRIC EXECUTION")?.status!=="COMPLETE"||stages.find(s=>s.stage==="P2 METRIC EXECUTION")?.status!=="COMPLETE")return false;
      const{applySafeMetaDerivedMetrics,applySafeStressDerivedMetrics}=await import("./meta-derived-evidence.server");
      const metricChanged=await applySafeMetaDerivedMetrics(deps,runId);
      let pathwayChanged=false,stressChanged=false,advancedChanged=false;
      if(stages.find(s=>s.stage==="DANGEROUS UNDERDOG AUDIT")?.status==="COMPLETE"){
        const match=await deps.getMatch(matchId);
        if(match){const{applyOpponentWinPathwaysMetric}=await import("./opponent-win-pathways-meta.server");pathwayChanged=await applyOpponentWinPathwaysMetric(deps,runId,match.player1_name,match.player2_name);}
      }
      if(stages.find(s=>s.stage==="STRESS / REMOVAL TESTS")?.status==="COMPLETE"){
        stressChanged=await applySafeStressDerivedMetrics(deps,runId);
        const{applyFinalAdvancedMetric}=await import("./final-advanced-meta.server");
        advancedChanged=await applyFinalAdvancedMetric(deps,runId,matchId);
      }
      const changed=metricChanged||pathwayChanged||stressChanged||advancedChanged;
      if(changed&&stages.find(s=>s.stage==="FINAL COMBINATION GATE")?.status==="COMPLETE"){
        await deps.setStage(runId,matchId,"FINAL COMBINATION GATE",{status:"PENDING",done_count:0,total_count:1,error_code:null,error_message:null,finished_at:null});
        await deps.updateRun(runId,{status:"RUNNING"});
        return true;
      }
      return false;
    };
    const prepared=await mapBounded(data.matchIds,4,async matchId=>{
      try{return{matchId,run:await pipeline.preparePipelineRun(deps,matchId),error:null as string|null};}
      catch(error){return{matchId,run:null,error:error instanceof Error?error.message:String(error)};}
    });
    const scheduled=prepared.filter(item=>item.run&&item.run.status!=="COMPLETE").slice(0,data.concurrency);
    const driven=await mapBounded(scheduled,data.concurrency,async({matchId})=>{
        const itemStarted=Date.now();
        try{
          const result=await pipeline.runPipeline(deps,matchId,{budgetMs:data.budgetMs??BROWSER_SAFE_BUDGET_MS});
          let reopened=false;
          if(!result.leaseHeld&&deps.acquireRunLease&&deps.releaseRunLease){
            const metaOwner=`audit-meta:${batchId}:${matchId}`;
            if(await deps.acquireRunLease(result.runId,metaOwner,600_000)){
              try{reopened=await applyMetaIfReady(matchId,result.runId);}
              finally{await deps.releaseRunLease(result.runId,metaOwner);}
            }
          }
          return{matchId,ok:true as const,runId:result.runId,complete:reopened?false:result.complete,nextStage:reopened?"FINAL COMBINATION GATE":result.nextStage,leaseHeld:result.leaseHeld??false,failures:result.failures,color:result.report?.color??null,completionPercent:result.report?.completionPercent??null,auditComplete:reopened?false:(result.report?.auditComplete??false),durationMs:Date.now()-itemStarted};
        }catch(error){
          const latest=await deps.getLatestRun(matchId).catch(()=>null);
          return{matchId,ok:false as const,runId:latest?.id??null,complete:false,nextStage:null,leaseHeld:false,failures:[{stage:"PIPELINE",message:error instanceof Error?error.message:String(error)}],color:null,completionPercent:null,auditComplete:false,durationMs:Date.now()-itemStarted};
        }
    });
    const drivenByMatch=new Map(driven.map(item=>[item.matchId,item]));
    const results=prepared.map(item=>{
      const completed=drivenByMatch.get(item.matchId);
      if(completed)return completed;
      if(item.error||!item.run)return{matchId:item.matchId,ok:false as const,runId:null,complete:false,nextStage:null,leaseHeld:false,failures:[{stage:"PIPELINE",message:item.error??"Could not persist queued audit run"}],color:null,completionPercent:null,auditComplete:false,durationMs:0};
      return{matchId:item.matchId,ok:true as const,runId:item.run.id,complete:item.run.status==="COMPLETE",nextStage:item.run.status==="COMPLETE"?null:"MATCH IDENTITY VERIFICATION",leaseHeld:false,failures:[],color:null,completionPercent:null,auditComplete:item.run.status==="COMPLETE",durationMs:0};
    });
    const complete=results.filter(item=>item.complete).length,blocked=results.filter(item=>!item.ok||item.failures?.length).length,leased=results.filter(item=>item.leaseHeld).length;
    console.info("[audit-batch]",{batchId,total:data.matchIds.length,complete,blocked,leased,durationMs:Date.now()-startedAt});
    return{ok:blocked===0,batchId,total:data.matchIds.length,complete,blocked,leased,active:data.matchIds.length-complete-blocked,results,durationMs:Date.now()-startedAt};
  });
