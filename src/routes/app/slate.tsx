import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { runAuditPipeline } from "@/lib/audit-pipeline.functions";
import { normalizeName } from "@/lib/summary-parser";
import { Button } from "@/components/ui/button";
import { AuditColorBadge, StateText } from "@/components/StatusBadge";

export const Route = createFileRoute("/app/slate")({
  head: () => ({ meta: [{ title: "Active Slate — Tennis Matrix Audit System" }] }),
  component: Slate,
});

function playerTokens(v:string){return normalizeName(v).split(" ").filter(Boolean);}
function samePlayer(a:string,b:string){const x=playerTokens(a),y=playerTokens(b);if(!x.length||!y.length)return false;if(x.join(" ")===y.join(" "))return true;if(x[x.length-1]!==y[y.length-1])return false;const sx=new Set(x),sy=new Set(y),overlap=[...sx].filter(t=>sy.has(t)).length;return overlap===Math.min(sx.size,sy.size)||overlap>=Math.min(2,Math.min(sx.size,sy.size));}
function samePair(a:any,b:any){return(samePlayer(a.player1_name,b.player1_name)&&samePlayer(a.player2_name,b.player2_name))||(samePlayer(a.player1_name,b.player2_name)&&samePlayer(a.player2_name,b.player1_name));}
function clean(v:unknown){return String(v??"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();}
function compatible(a:unknown,b:unknown){const x=clean(a),y=clean(b);return !x||!y||x===y||x.includes(y)||y.includes(x);}
function samePhysicalMatch(a:any,b:any){if(!samePair(a,b))return false;return compatible(a.scheduled_date,b.scheduled_date)&&compatible(a.tournament_name,b.tournament_name)&&compatible(a.round,b.round);}
function contextScore(m:any){return [m.tournament_name,m.event_level,m.round,m.scheduled_date,m.surface,m.best_of,m.identity_status,m.surface_status].filter(Boolean).length;}

function Slate(){
  const qc=useQueryClient();
  const {data}=useQuery({queryKey:["slate"],queryFn:async()=>{
    const [{data:matches},{data:runs},{data:decisions},{data:stages},{data:metrics}]=await Promise.all([
      supabase.from("matches").select("*").order("created_at",{ascending:false}),
      supabase.from("audit_runs").select("id, match_id, status, run_number"),
      supabase.from("final_decisions").select("audit_run_id, final_audit_color, completion_percent"),
      supabase.from("audit_stage_runs").select("audit_run_id, status, done_count, total_count"),
      supabase.from("metric_results").select("audit_run_id, p1_treatment, p2_treatment")
    ]);
    const rawMatches=matches??[],runRows=runs??[],grouped:any[][]=[];
    for(const m of rawMatches){const i=grouped.findIndex(g=>samePhysicalMatch(g[0],m));if(i<0)grouped.push([m]);else grouped[i].push(m);}
    const consolidated=grouped.map(group=>{const ranked=[...group].sort((a,b)=>{const ar=runRows.filter(r=>r.match_id===a.id).sort((x,y)=>y.run_number-x.run_number)[0],br=runRows.filter(r=>r.match_id===b.id).sort((x,y)=>y.run_number-x.run_number)[0];return(br?1:0)-(ar?1:0)||contextScore(b)-contextScore(a)||String(b.created_at??"").localeCompare(String(a.created_at??""));});const keeper={...ranked[0]};for(const d of ranked.slice(1)){keeper.tournament_name ||= d.tournament_name;keeper.event_level ||= d.event_level;keeper.round ||= d.round;keeper.scheduled_date ||= d.scheduled_date;keeper.surface ||= d.surface;keeper.best_of ||= d.best_of;keeper.identity_status ||= d.identity_status;keeper.surface_status ||= d.surface_status;}return{...keeper,_all_ids:ranked.map(x=>x.id)};});
    return{matches:consolidated,runs:runRows,decisions:decisions??[],stages:stages??[],metrics:metrics??[]};
  }});

  const execute=useServerFn(runAuditPipeline);
  const start=useMutation({mutationFn:async(matchId:string)=>{for(let chunk=0;chunk<20;chunk++){const res=await execute({data:{matchId}});if(!res.ok)throw new Error(res.failures[0]?.message??"Pipeline failed");if(res.complete||!res.nextStage)return res;}throw new Error("Audit is still running. Resume it to continue.");},onSuccess:()=>{toast.success("Audit execution started");qc.invalidateQueries({queryKey:["slate"]});},onError:e=>toast.error((e as Error).message)});

  const runFor=(m:any)=>{const ids=m?._all_ids??[m.id];return data?.runs.filter((r:any)=>ids.includes(r.match_id)).sort((a:any,b:any)=>b.run_number-a.run_number)[0];};
  const executionFor=(runId?:string)=>{if(!runId)return 0;const rows=(data?.stages??[]).filter((s:any)=>s.audit_run_id===runId);if(!rows.length)return 0;let done=0,total=0;for(const s of rows){const t=Math.max(1,Number(s.total_count)||1);total+=t;done+=s.status==="COMPLETE"?t:Math.min(Number(s.done_count)||0,t);}return total?Math.round(done/total*100):0;};
  const evidenceFor=(runId?:string)=>{if(!runId)return 0;const rows=(data?.metrics??[]).filter((m:any)=>m.audit_run_id===runId);let usable=0,total=0;for(const m of rows){for(const t of [m.p1_treatment,m.p2_treatment]){if(!t)continue;total++;if(t==="DIRECT"||t==="RECONSTRUCTED"||t==="PARTIAL")usable++;}}return total?Math.round(usable/total*100):0;};

  return <div className="space-y-4">
    <div><h1 className="text-xl font-semibold">Active slate</h1><p className="text-sm text-muted-foreground">Execution shows how much of the audit ran. Evidence shows how much requested data is genuinely supported; unavailable data does not increase coverage.</p></div>
    <div className="panel overflow-x-auto"><table className="w-full text-sm">
      <thead className="bg-header text-header-foreground"><tr className="text-left">{["Match","Tournament","Round","Surface","Identity","Surface status","Audit run","Color","Execution","Evidence",""] .map(h=><th key={h} className="px-3 py-2 text-xs font-semibold uppercase tracking-wide">{h}</th>)}</tr></thead>
      <tbody>{data?.matches.map((m:any)=>{const run=runFor(m),decision=data.decisions.find((d:any)=>d.audit_run_id===run?.id);return <tr key={m.id} className="border-t border-border">
        <td className="px-3 py-2 font-medium">{m.player1_name} vs {m.player2_name}</td><td className="px-3 py-2">{m.tournament_name??"—"}</td><td className="px-3 py-2">{m.round??"—"}</td><td className="px-3 py-2">{m.surface??"—"}</td><td className="px-3 py-2"><StateText state={m.identity_status}/></td><td className="px-3 py-2"><StateText state={m.surface_status}/></td><td className="mono-num px-3 py-2 text-xs">{run?`RUN ${run.run_number} · ${run.status}`:"—"}</td><td className="px-3 py-2"><AuditColorBadge color={decision?.final_audit_color??"INCOMPLETE"}/></td><td className="mono-num px-3 py-2 text-xs">{executionFor(run?.id)}%</td><td className="mono-num px-3 py-2 text-xs">{evidenceFor(run?.id)}%</td><td className="px-3 py-2 text-right"><div className="flex justify-end gap-2">{run&&<Button asChild size="sm" variant="secondary"><Link to="/app/match/$matchId" params={{matchId:run.match_id}}>Open workspace</Link></Button>}{(!run||run.status!=="COMPLETE")&&<Button size="sm" onClick={()=>start.mutate(run?.match_id??m.id)} disabled={start.isPending}>{run?"Resume Audit":"Run Audit"}</Button>}</div></td>
      </tr>;})}{!data?.matches.length&&<tr><td colSpan={11} className="px-3 py-8 text-center text-sm text-muted-foreground">No matches ingested yet.</td></tr>}</tbody>
    </table></div>
  </div>;
}
