import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { runAuditBatch } from "@/lib/audit-pipeline.functions";
import { normalizeName } from "@/lib/summary-parser";
import { computeExecutionPercent } from "@/lib/audit-progress";
import { canonicalizeStageRows, resolveActiveRun } from "@/lib/audit-stages";
import { isRecoverablePipelineTransportError, safePipelineErrorMessage } from "@/lib/pipeline-client-error";
import { Button } from "@/components/ui/button";
import { AuditColorBadge, StateText } from "@/components/StatusBadge";
import { ProgressBar } from "@/components/ProgressBar";

const AUDIT_CONCURRENCY=4;

export const Route=createFileRoute("/app/slate")({
  head:()=>({meta:[{title:"Active Slate — Tennis Matrix Audit System"}]}),
  component:Slate,
});

function playerTokens(value:string){return normalizeName(value).split(" ").filter(Boolean);}
function samePlayer(a:string,b:string){const x=playerTokens(a),y=playerTokens(b);if(!x.length||!y.length)return false;if(x.join(" ")===y.join(" "))return true;if(x[x.length-1]!==y[y.length-1])return false;const sx=new Set(x),sy=new Set(y),overlap=[...sx].filter(token=>sy.has(token)).length;return overlap===Math.min(sx.size,sy.size)||overlap>=Math.min(2,Math.min(sx.size,sy.size));}
function samePair(a:any,b:any){return(samePlayer(a.player1_name,b.player1_name)&&samePlayer(a.player2_name,b.player2_name))||(samePlayer(a.player1_name,b.player2_name)&&samePlayer(a.player2_name,b.player1_name));}
function contextScore(match:any){return[match.tournament_name,match.event_level,match.round,match.scheduled_date,match.surface,match.best_of,match.identity_status==="VERIFIED",match.surface_status==="VERIFIED"].filter(Boolean).length;}
function mergeGroup(group:any[],runRows:any[]){const ranked=[...group].sort((a,b)=>{const ar=runRows.filter(run=>run.match_id===a.id).sort((x,y)=>y.run_number-x.run_number)[0],br=runRows.filter(run=>run.match_id===b.id).sort((x,y)=>y.run_number-x.run_number)[0];return(br?1:0)-(ar?1:0)||contextScore(b)-contextScore(a)||String(b.created_at??"").localeCompare(String(a.created_at??""));});const merged={...ranked[0]};const verified=ranked.filter(match=>match.identity_status==="VERIFIED"||match.surface_status==="VERIFIED"),source=verified.sort((a,b)=>contextScore(b)-contextScore(a))[0]??ranked[0];for(const row of ranked){merged.tournament_name ||=row.tournament_name;merged.event_level ||=row.event_level;merged.round ||=row.round;merged.scheduled_date ||=row.scheduled_date;merged.surface ||=row.surface;merged.best_of ||=row.best_of;}if(source.identity_status==="VERIFIED")merged.identity_status="VERIFIED";if(source.surface_status==="VERIFIED"){merged.surface_status="VERIFIED";if(source.surface)merged.surface=source.surface;}return{...merged,_all_ids:ranked.map(row=>row.id)};}

function Slate(){
  const qc=useQueryClient();
  const[scope,setScope]=useState<"latest"|"all">("latest");
  const executeBatch=useServerFn(runAuditBatch);
  const{data}=useQuery({
    queryKey:["slate"],
    refetchInterval:3000,
    queryFn:async()=>{
      const[{data:matches},{data:runs},{data:decisions},{data:stages},{data:coverage},{data:versions},{data:uploads}]=await Promise.all([
        supabase.from("matches").select("*").order("created_at",{ascending:false}),
        supabase.from("audit_runs").select("id, match_id, status, run_number, heartbeat_at, lease_expires_at"),
        supabase.from("final_decisions").select("audit_run_id, final_audit_color, completion_percent, audit_complete"),
        supabase.from("audit_stage_runs").select("audit_run_id, stage, stage_order, status, done_count, total_count, started_at, finished_at, heartbeat_at"),
        supabase.from("audit_coverage").select("audit_run_id, player_side, usable_coverage_percent, total_count"),
        supabase.from("summary_versions").select("match_id, upload_id, created_at"),
        supabase.from("summary_uploads").select("id, created_at").order("created_at",{ascending:false}),
      ]);
      const raw=matches??[],runRows=runs??[],groups:any[][]=[];
      for(const match of raw){const index=groups.findIndex(group=>samePair(group[0],match));if(index<0)groups.push([match]);else groups[index].push(match);}
      const newestUpload=(uploads??[])[0]?.id??null;
      const latestMatchIds=new Set((versions??[]).filter(version=>newestUpload&&version.upload_id===newestUpload).map(version=>version.match_id));
      return{matches:groups.map(group=>mergeGroup(group,runRows)),runs:runRows,decisions:decisions??[],stages:stages??[],coverage:coverage??[],latestMatchIds:[...latestMatchIds]};
    },
  });
  const drive=useMutation({
    mutationFn:async(matchIds:string[])=>executeBatch({data:{matchIds,concurrency:AUDIT_CONCURRENCY}}),
    onSuccess:result=>{
      if(result.blocked)toast.error(`${result.blocked} audit run${result.blocked===1?" is":"s are"} blocked. Open the workspace for the persisted stage error.`);
      qc.invalidateQueries({queryKey:["slate"]});
    },
    onError:error=>{
      if(!isRecoverablePipelineTransportError(error))toast.error(safePipelineErrorMessage(error));
      qc.invalidateQueries({queryKey:["slate"]});
    },
  });

  useEffect(()=>{
    if(!data||drive.isPending)return;
    const active=[...new Set(data.runs.filter(run=>run.status==="RUNNING").map(run=>run.match_id))];
    if(active.length)drive.mutate(active);
  },[data,drive.isPending]);

  // resolveActiveRun resolves straight through an INVALIDATED (Clear Slate,
  // or a rule-version change) run to null -- a match whose latest run was
  // just invalidated shows as "no active run" (Run Audit, 0%, no
  // diagnostics), never that dead run's last-known progress.
  const runFor=(match:any)=>{const ids=match?._all_ids??[match.id];return resolveActiveRun(data?.runs.filter((run:any)=>ids.includes(run.match_id))??[]);};
  // Every lookup below is scoped to this ONE run's rows first (audit_run_id
  // === run.id), then normalized through canonicalizeStageRows -- exactly
  // one entry per canonical stage, in fixed 1-16 order -- so neither a prior
  // run's rows nor a duplicate/retry record can ever be read as this run's
  // progress.
  const stagesFor=(run:any)=>run?.id?canonicalizeStageRows((data?.stages??[]).filter((stage:any)=>stage.audit_run_id===run.id)):[];
  const executionFor=(run:any)=>run?.id?computeExecutionPercent(stagesFor(run).map(({stage,row})=>({stage,status:row?.status??"PENDING",done_count:row?.done_count??0,total_count:row?.total_count??0})),run.status):0;
  const activeStageFor=(run:any)=>{const running=stagesFor(run).filter(({row})=>row?.status==="RUNNING");return running.length?running[running.length-1].row:null;};
  const evidenceFor=(runId?:string)=>{if(!runId)return null;const rows=(data?.coverage??[]).filter((row:any)=>row.audit_run_id===runId&&Number(row.total_count)>0);if(rows.length<2)return null;return Math.min(...rows.map((row:any)=>Number(row.usable_coverage_percent)||0));};
  const latest=new Set(data?.latestMatchIds??[]);
  const visible=(data?.matches??[]).filter((match:any)=>scope==="all"||(match._all_ids??[match.id]).some((id:string)=>latest.has(id)));

  return <div className="space-y-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold">Active slate</h1>
        <p className="text-sm text-muted-foreground">{scope==="latest"?"Showing only matches from the single most recent upload.":"Showing every match ever ingested."} Active runs are claimed in bounded batches and refreshed from persisted stages every few seconds. Evidence is shown only after canonical coverage rows are persisted.</p>
      </div>
      <Button size="sm" variant="secondary" onClick={()=>setScope(scope==="latest"?"all":"latest")}>{scope==="latest"?`Show all matches (${data?.matches?.length??0})`:"Show latest upload only"}</Button>
    </div>
    <div className="panel overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-header text-header-foreground"><tr className="text-left">{["Match","Tournament","Round","Surface","Identity","Surface status","Audit run","Color","Execution","Evidence",""].map(label=><th key={label} className="px-3 py-2 text-xs font-semibold uppercase tracking-wide">{label}</th>)}</tr></thead>
        <tbody>
          {visible.map((match:any)=>{
            const run=runFor(match),decision=data?.decisions?.find((row:any)=>row.audit_run_id===run?.id),evidence=evidenceFor(run?.id),activeStage=activeStageFor(run);
            return <tr key={match.id} className="border-t border-border">
              <td className="px-3 py-2 font-medium">{match.player1_name} vs {match.player2_name}</td>
              <td className="px-3 py-2">{match.tournament_name??"—"}</td>
              <td className="px-3 py-2">{match.round??"—"}</td>
              <td className="px-3 py-2">{match.surface??"—"}</td>
              <td className="px-3 py-2"><StateText state={match.identity_status}/></td>
              <td className="px-3 py-2"><StateText state={match.surface_status}/></td>
              <td className="mono-num px-3 py-2 text-xs">{run?<div>{`RUN ${run.run_number} · ${run.status}`}{activeStage&&<div className="mt-1 text-[10px] text-muted-foreground">{activeStage.stage} · {activeStage.done_count??0}/{activeStage.total_count??0}</div>}</div>:"—"}</td>
              <td className="px-3 py-2"><AuditColorBadge color={decision?.final_audit_color??"INCOMPLETE"}/></td>
              <td className="px-3 py-2"><ProgressBar percent={executionFor(run)}/></td>
              <td className="mono-num px-3 py-2 text-xs">{evidence===null?"—":`${evidence}%`}</td>
              <td className="px-3 py-2 text-right"><div className="flex justify-end gap-2">
                <Button asChild size="sm" variant="secondary"><Link to="/app/match/$matchId" params={{matchId:run?.match_id??match.id}}>Open workspace</Link></Button>
                {(!run||run.status!=="COMPLETE")&&<Button size="sm" onClick={()=>drive.mutate([run?.match_id??match.id])} disabled={drive.isPending}>{run?.status==="BLOCKED"?"Retry blocked stage":run?"Audit running":"Run Audit"}</Button>}
              </div></td>
            </tr>;
          })}
          {!visible.length&&<tr><td colSpan={11} className="px-3 py-8 text-center text-sm text-muted-foreground">{scope==="latest"?"No matches from your latest upload yet.":"No matches ingested yet."}</td></tr>}
        </tbody>
      </table>
    </div>
  </div>;
}