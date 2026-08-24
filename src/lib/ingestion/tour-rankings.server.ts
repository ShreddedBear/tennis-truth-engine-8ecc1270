import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { assertObservationFamily } from "../metric-source-family-policy";

const db = supabaseAdmin as any;
export type RankingSource = "atp_rankings" | "wta_rankings";

type Target = { id:string; source_id:RankingSource; target_key:string; pullback_start:string|null; pullback_end:string|null; config:Record<string,unknown>|null };
type Row = {
  source_id:string; source_name:string; source_url:string; source_record_key:string;
  player_name:string; opponent_name:null; tournament:null; event_date:string|null; surface:null;
  observation_type:"RANKING"; observation_key:"ranking_snapshot"; text_value:string; numeric_value:number|null;
  unit:string|null; sample_label:string|null; window_start:string|null; window_end:string|null;
  raw_payload:unknown; provenance:Record<string,unknown>;
};

const DEFAULT_URLS:Record<RankingSource,string> = {
  atp_rankings:"https://www.atptour.com/en/rankings/singles",
  wta_rankings:"https://www.wtatennis.com/rankings/singles/",
};
const ATP_FEED_URL = "https://api.protennislive.com/feeds/api/Ranks/sglroll/1/500";
const SOURCE_NAMES:Record<RankingSource,string> = { atp_rankings:"ATP Rankings Official", wta_rankings:"WTA Rankings Official" };

function str(v:unknown){ return typeof v === "string" && v.trim() ? v.trim() : typeof v === "number" && Number.isFinite(v) ? String(v) : null; }
function first(o:Record<string,unknown>, keys:string[]){ for(const k of keys){ const v=str(o[k]); if(v) return v; } return null; }
function num(v:unknown){ const s=str(v); if(!s) return null; const n=Number(s.replace(/,/g,"")); return Number.isFinite(n)?n:null; }
function date(v:string|null){ if(!v) return null; const m=v.match(/(20\d{2})[-\/.](\d{1,2})[-\/.](\d{1,2})/); return m?`${m[1]}-${m[2].padStart(2,"0")}-${m[3].padStart(2,"0")}`:null; }
function collect(v:unknown,out:Record<string,unknown>[],d=0){ if(d>12||v==null)return; if(Array.isArray(v)){for(const x of v)collect(x,out,d+1);return;} if(typeof v!=="object")return; const o=v as Record<string,unknown>; out.push(o); for(const x of Object.values(o))collect(x,out,d+1); }
function embedded(html:string){ const out:unknown[]=[]; for(const m of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)){ const b=m[1]?.trim(); if(!b||(!b.startsWith("{")&&!b.startsWith("[")))continue; try{out.push(JSON.parse(b));}catch{} } return out; }
function unescapeHtml(s:string){ return s.replace(/&nbsp;/gi," ").replace(/&amp;/gi,"&").replace(/&#39;/g,"'").replace(/&quot;/gi,'"').replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim(); }

function normalize(source:RankingSource,url:string,target:Target,o:Record<string,unknown>):Row|null{
  const player=first(o,["playerName","PlayerName","player","name","competitorName","fullName","PlayerFullName"]);
  const rank=num(o["rank"] ?? o["Rank"] ?? o["ranking"] ?? o["position"] ?? o["currentRank"] ?? o["Position"]);
  const points=num(o["points"] ?? o["Points"] ?? o["rankingPoints"] ?? o["rankPoints"] ?? o["RankPoints"]);
  if(!player || rank===null) return null;
  const d=date(first(o,["rankingDate","RankingDate","date","week","asOfDate","updatedAt"])) ?? target.pullback_end ?? new Date().toISOString().slice(0,10);
  const priorRank=num(o["previousRank"] ?? o["PreviousRank"] ?? o["prevRank"] ?? o["lastRank"]);
  const country=first(o,["country","Country","countryCode","CountryCode","nation"]);
  const payload={ rank, points, prior_rank:priorRank, country };
  const row:Row={
    source_id:source, source_name:SOURCE_NAMES[source], source_url:url,
    source_record_key:`${target.target_key}:${d??"current"}:${player}:${rank}`,
    player_name:player, opponent_name:null, tournament:null, event_date:d, surface:null,
    observation_type:"RANKING", observation_key:"ranking_snapshot", text_value:JSON.stringify(payload), numeric_value:rank,
    unit:"rank", sample_label:points===null?null:`points=${points}`, window_start:target.pullback_start, window_end:target.pullback_end,
    raw_payload:o, provenance:{target_key:target.target_key,tour:source,extraction:url.includes("protennislive")?"official_atp_feed":"official_page"},
  };
  assertObservationFamily(row,"RANKING");
  return row;
}

function parseWtaTable(html:string,target:Target,url:string):Row[]{
  const rows:Row[]=[];
  const rankingDate=target.pullback_end ?? new Date().toISOString().slice(0,10);
  const seen=new Set<string>();
  for(const tr of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)){
    const cells=[...tr[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(m=>unescapeHtml(m[1]));
    if(cells.length<3) continue;
    const rankMatch=cells[0].match(/^\s*(\d{1,4})\b/);
    if(!rankMatch) continue;
    const rank=Number(rankMatch[1]);
    let player:string|null=null;
    let points:number|null=null;
    for(const cell of cells.slice(1)){
      if(!player && /[A-Za-zÀ-ž]/.test(cell) && !/^\d+$/.test(cell)) player=cell.replace(/\b[A-Z]{3}\b/g,"").trim();
      const n=Number(cell.replace(/,/g,"").replace(/[^0-9]/g,""));
      if(Number.isFinite(n) && n>=0 && n!==rank) points=n;
    }
    if(!player || seen.has(`${rank}:${player}`)) continue;
    seen.add(`${rank}:${player}`);
    const o={playerName:player,rank,points,rankingDate};
    const row=normalize("wta_rankings",url,target,o);
    if(row) rows.push(row);
  }
  return rows;
}

async function request(url:string){
  return fetch(url,{headers:{
    "user-agent":"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36",
    accept:"text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
    "accept-language":"en-US,en;q=0.9",
  }});
}

async function fetchPayloads(source:RankingSource,url:string){
  let r=await request(url);
  if(source==="atp_rankings" && !r.ok) r=await request(ATP_FEED_URL);
  if(!r.ok) throw new Error(`${r.url || url} returned ${r.status}`);
  const ct=r.headers.get("content-type")??"";
  if(ct.includes("application/json")) return {payloads:[await r.json()],html:null,url:r.url || url};
  const html=await r.text();
  return {payloads:embedded(html),html,url:r.url || url};
}

export async function ingestTourRankings(source:RankingSource){
  const {data:targets,error}=await db.from("ingestion_targets").select("id,source_id,target_key,pullback_start,pullback_end,config").eq("source_id",source).eq("enabled",true); if(error)throw error;
  let observations_written=0,pages_read=0,objects_seen=0;
  for(const target of (targets??[]) as Target[]){
    const cfg=target.config??{};
    const url=typeof cfg.url==="string"&&cfg.url?cfg.url:DEFAULT_URLS[source];
    const fetched=await fetchPayloads(source,url); pages_read++;
    const objects:Record<string,unknown>[]=[]; for(const p of fetched.payloads)collect(p,objects); objects_seen+=objects.length;
    const rows=new Map<string,Row>();
    for(const o of objects){ const row=normalize(source,fetched.url,target,o); if(row)rows.set(row.source_record_key,row); }
    if(source==="wta_rankings" && fetched.html){ for(const row of parseWtaTable(fetched.html,target,fetched.url)) rows.set(row.source_record_key,row); }
    const all=[...rows.values()];
    for(let i=0;i<all.length;i+=500){ const chunk=all.slice(i,i+500); const {error:e}=await db.from("source_observations").upsert(chunk,{onConflict:"source_id,source_record_key",ignoreDuplicates:true}); if(e)throw e; observations_written+=chunk.length; }
    await db.from("ingestion_targets").update({last_ingested_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",target.id);
  }
  return {source,targets:targets?.length??0,pages_read,objects_seen,observations_written};
}
