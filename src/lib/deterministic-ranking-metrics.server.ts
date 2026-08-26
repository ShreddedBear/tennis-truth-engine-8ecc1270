import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { MetricFinding, SourceRef } from "./audit-pipeline";
import { evidenceNameMatches, safeEvidenceAliases } from "./evidence-player-alias";
import { metricAllowsObservation } from "./metric-source-family-policy";

const db = supabaseAdmin as any;
const SUPPORTED = new Set(["062","069"]);

type Row={id?:string;source_id:string|null;source_name:string|null;source_url:string|null;player_name:string|null;event_date:string|null;observation_type:string|null;observation_key:string|null;text_value:string|null;numeric_value:number|null;sample_label:string|null};
function codeOf(v:unknown){const m=String(v??"").match(/(\d{1,3})$/);return m?m[1].padStart(3,"0"):String(v??"").padStart(3,"0");}
function days(a:string,b:string){return Math.floor((new Date(`${b}T00:00:00Z`).getTime()-new Date(`${a}T00:00:00Z`).getTime())/86400000);}
function payload(r:Row){try{return JSON.parse(r.text_value??"{}") as Record<string,unknown>;}catch{return {};}}
function rank(r:Row){const p=payload(r);const n=Number(p.rank??r.numeric_value);return Number.isFinite(n)?n:null;}
function points(r:Row){const p=payload(r);const n=Number(p.points);return Number.isFinite(n)?n:null;}
function sourceRefs(rows:Row[]):SourceRef[]{const out:SourceRef[]=[];const seen=new Set<string>();for(const r of rows){if(!r.source_name)continue;const k=`${r.source_name}|${r.source_url??""}`;if(seen.has(k))continue;seen.add(k);out.push({source_name:r.source_name,url:r.source_url,retrieved_at:null});}return out;}
function nearest(rows:Row[],asOf:string,targetDays:number){return rows.filter(r=>r.event_date&&days(r.event_date,asOf)>=targetDays).sort((a,b)=>Math.abs(days(a.event_date!,asOf)-targetDays)-Math.abs(days(b.event_date!,asOf)-targetDays))[0]??null;}
function summary(player:string,opponent:string,rows:Row[],asOf:string){
  const pRows=rows.filter(r=>evidenceNameMatches(r.player_name,player,opponent)&&r.event_date).sort((a,b)=>String(b.event_date).localeCompare(String(a.event_date)));
  const current=pRows[0]??null;if(!current)return null;const cur=rank(current);if(cur===null)return null;
  const r30=nearest(pRows,asOf,30),r90=nearest(pRows,asOf,90),r365=nearest(pRows,asOf,365);
  const best52=pRows.filter(r=>r.event_date&&days(r.event_date,asOf)<=365).map(rank).filter((x):x is number=>x!==null).reduce((a,b)=>Math.min(a,b),cur);
  const movement=(r:Row|null)=>{const v=r?rank(r):null;return v===null?null:v-cur;};
  return {rank:cur,points:points(current),rank_change_30d:movement(r30),rank_change_90d:movement(r90),rank_change_365d:movement(r365),best_rank_52w:best52,snapshots_52w:pRows.filter(r=>r.event_date&&days(r.event_date,asOf)<=365).length};
}
function value(code:string,s:ReturnType<typeof summary>){if(!s)return null;if(code==="062")return `rank=${s.rank}; points=${s.points??"NA"}; rank_change_30d=${s.rank_change_30d??"NA"}; rank_change_90d=${s.rank_change_90d??"NA"}`;return `rank=${s.rank}; points=${s.points??"NA"}; rank_change_365d=${s.rank_change_365d??"NA"}; best_rank_52w=${s.best_rank_52w}; snapshots_52w=${s.snapshots_52w}`;}

async function rankingRows(p1:string,p2:string,start:string,asOfDate:string){
  const aliases=[...new Set([...safeEvidenceAliases(p1,p2),...safeEvidenceAliases(p2,p1)])];
  const results=await Promise.all(aliases.map(alias=>db.from("source_observations")
    .select("id,source_id,source_name,source_url,player_name,event_date,observation_type,observation_key,text_value,numeric_value,sample_label")
    .gte("event_date",start).lte("event_date",asOfDate)
    .ilike("player_name",`%${alias}%`).order("event_date",{ascending:false}).limit(2000)));
  if(results.some(result=>result.error))return null;
  const dedup=new Map<string,Row>();
  for(const result of results)for(const row of (result.data??[]) as Row[]){
    const key=String(row.id??`${row.source_id}|${row.player_name}|${row.event_date}|${row.observation_key}|${row.numeric_value}|${row.text_value}`);
    dedup.set(key,row);
  }
  return [...dedup.values()];
}

export async function deterministicRankingMetric(args:{metricCode:string;p1:string;p2:string;asOfDate:string}):Promise<MetricFinding|null>{
  const code=codeOf(args.metricCode);if(!SUPPORTED.has(code))return null;const start=new Date(`${args.asOfDate}T00:00:00Z`);start.setUTCFullYear(start.getUTCFullYear()-2);
  // ATP Main and ATP Challenger share ATP ranking observations. WTA Main and
  // WTA Challenger/WTA 125 share WTA ranking observations; there is no invented
  // separate "WTA Challenger ranking" requirement. Canonical player identity
  // and exact post-query matching keep the tours from borrowing player records.
  const fetched=await rankingRows(args.p1,args.p2,start.toISOString().slice(0,10),args.asOfDate);if(!fetched)return null;
  const rows=fetched.filter(r=>metricAllowsObservation(code,r));if(!rows.length)return null;
  const s1=summary(args.p1,args.p2,rows,args.asOfDate),s2=summary(args.p2,args.p1,rows,args.asOfDate);const p1=value(code,s1),p2=value(code,s2);if(!p1||!p2)return null;
  return {metric_code:code,p1_value:p1,p2_value:p2,p1_treatment:"PARTIAL",p2_treatment:"PARTIAL",differential:null,evidence_family:"RANKING",reliability:90,sample:`objective ranking history through ${args.asOfDate}`,unavailable_reason:"Subjective motivation/private pressure components are not inferred from ranking data.",sources:sourceRefs(rows)};
}
