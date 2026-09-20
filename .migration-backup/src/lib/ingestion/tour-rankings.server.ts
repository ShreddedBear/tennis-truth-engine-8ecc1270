import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { assertObservationFamily } from "../metric-source-family-policy";

const db = supabaseAdmin as any;
export type RankingSource = "atp_rankings" | "wta_rankings";
export type OfficialRankingSnapshot = { source:"atp_rankings"; url:string; html:string };

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
  wta_rankings:"https://www.wtatennis.com/rankings/singles",
};
const SOURCE_NAMES:Record<RankingSource,string> = { atp_rankings:"ATP Rankings Official", wta_rankings:"WTA Rankings Official" };
const WTA_RANKINGS_API = "https://api.wtatennis.com/tennis/players/ranked?type=rankSingles&metric=singles&page=0&pageSize=500";

function str(v:unknown){ return typeof v === "string" && v.trim() ? v.trim() : typeof v === "number" && Number.isFinite(v) ? String(v) : null; }
function first(o:Record<string,unknown>, keys:string[]){ for(const k of keys){ const v=str(o[k]); if(v) return v; } return null; }
function deepFirst(o:Record<string,unknown>,keys:string[],depth=0):string|null{const direct=first(o,keys);if(direct)return direct;if(depth>=4)return null;for(const v of Object.values(o)){if(v&&typeof v==="object"&&!Array.isArray(v)){const found=deepFirst(v as Record<string,unknown>,keys,depth+1);if(found)return found;}}return null;}
function num(v:unknown){ const s=str(v); if(!s) return null; const n=Number(s.replace(/,/g,"").replace(/[^0-9.-]/g,"")); return Number.isFinite(n)?n:null; }
function date(v:string|null){ if(!v) return null; const m=v.match(/(20\d{2})[-\/.](\d{1,2})[-\/.](\d{1,2})/); return m?`${m[1]}-${m[2].padStart(2,"0")}-${m[3].padStart(2,"0")}`:null; }
function collect(v:unknown,out:Record<string,unknown>[],d=0){ if(d>14||v==null)return; if(Array.isArray(v)){for(const x of v)collect(x,out,d+1);return;} if(typeof v!=="object")return; const o=v as Record<string,unknown>; out.push(o); for(const x of Object.values(o))collect(x,out,d+1); }
function embedded(html:string){ const out:unknown[]=[]; for(const m of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)){ const b=m[1]?.trim(); if(!b||(!b.startsWith("{")&&!b.startsWith("[")))continue; try{out.push(JSON.parse(b));}catch{} } return out; }
function unescapeHtml(s:string){ return s.replace(/&nbsp;/gi," ").replace(/&amp;/gi,"&").replace(/&#39;/g,"'").replace(/&quot;/gi,'"').replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim(); }

function normalize(source:RankingSource,url:string,target:Target,o:Record<string,unknown>,extraction?:string):Row|null{
  const player=deepFirst(o,["playerName","PlayerName","fullName","PlayerFullName","player","name","competitorName"]);
  const rank=num(o["rank"] ?? o["Rank"] ?? o["ranking"] ?? o["position"] ?? o["currentRank"] ?? o["Position"]);
  const points=num(o["points"] ?? o["Points"] ?? o["rankingPoints"] ?? o["rankPoints"] ?? o["RankPoints"]);
  if(!player || rank===null || rank<1 || rank>5000) return null;
  const d=date(deepFirst(o,["rankingDate","RankingDate","rankedAt","date","week","asOfDate","updatedAt"])) ?? target.pullback_end ?? new Date().toISOString().slice(0,10);
  const priorRank=num(o["previousRank"] ?? o["PreviousRank"] ?? o["prevRank"] ?? o["lastRank"] ?? o["movement"]);
  const country=deepFirst(o,["country","Country","countryCode","CountryCode","nation"]);
  const payload={ rank, points, prior_rank:priorRank, country };
  const row:Row={
    source_id:source, source_name:SOURCE_NAMES[source], source_url:url,
    source_record_key:`${target.target_key}:${d??"current"}:${player}:${rank}`,
    player_name:player, opponent_name:null, tournament:null, event_date:d, surface:null,
    observation_type:"RANKING", observation_key:"ranking_snapshot", text_value:JSON.stringify(payload), numeric_value:rank,
    unit:"rank", sample_label:points===null?null:`points=${points}`, window_start:target.pullback_start, window_end:target.pullback_end,
    raw_payload:o, provenance:{target_key:target.target_key,tour:source,extraction:extraction??(url.includes("api.wtatennis.com")?"official_wta_public_api":"official_page")},
  };
  assertObservationFamily(row,"RANKING");
  return row;
}

function normalizeWtaOfficialRanking(target:Target,url:string,value:unknown):Row|null {
  if(!value || typeof value!=="object" || Array.isArray(value)) return null;
  const o=value as Record<string,unknown>;
  const playerObj=o.player && typeof o.player==="object" && !Array.isArray(o.player) ? o.player as Record<string,unknown> : null;
  const player=playerObj ? first(playerObj,["fullName","playerName","name"]) : null;
  const rank=num(o.ranking ?? o.rank ?? o.position);
  const points=num(o.points);
  if(!player || rank===null || rank<1 || rank>5000) return null;
  const rankedAt=date(str(o.rankedAt ?? o.rankingDate)) ?? target.pullback_end ?? new Date().toISOString().slice(0,10);
  const movement=num(o.movement);
  const country=playerObj ? first(playerObj,["countryCode","country","nation"]) : null;
  const playerId=playerObj ? first(playerObj,["id","playerId"]) : null;
  const payload={rank,points,prior_rank:null,movement,country,player_id:playerId,tournaments_played:num(o.tournamentsPlayed)};
  const row:Row={
    source_id:"wta_rankings",source_name:SOURCE_NAMES.wta_rankings,source_url:url,
    source_record_key:`${target.target_key}:${rankedAt}:${playerId??player}:${rank}`,
    player_name:player,opponent_name:null,tournament:null,event_date:rankedAt,surface:null,
    observation_type:"RANKING",observation_key:"ranking_snapshot",text_value:JSON.stringify(payload),numeric_value:rank,
    unit:"rank",sample_label:points===null?null:`points=${points}`,window_start:target.pullback_start,window_end:target.pullback_end,
    raw_payload:o,provenance:{target_key:target.target_key,tour:"wta_rankings",extraction:"official_wta_public_api"},
  };
  assertObservationFamily(row,"RANKING");
  return row;
}

// Ranking points from a scraped table row, WITHOUT assuming a column index.
//
// The previous rule was positional -- `source==="atp_rankings" ? num(cells[2]) : num(last)`
// -- and cells[2] on the ATP table is the AGE column, not points. It silently wrote ages
// into every scraped ATP ranking row: Sinner rank 1 "points" 25, Zverev 2 -> 29, Alcaraz
// 3 -> 23, Djokovic 5 -> 39, all exactly their 2026 ages. Because a second ingestion path
// (the embedded-JSON one) writes the SAME players again with genuine points, metric 014's
// stored evidence ended up self-contradictory: rank 3 with 23 points next to rank 29 with
// 1652, depending on which duplicate the reader happened to sort first.
//
// Positional parsing is what broke, so the fix is not a better index: ranking points are
// identifiable by VALUE in a ranking row. Rank is <= ~2000, age is 15-45, tournaments
// played <= ~35, and week-on-week movement is small, while points for a ranked player run
// from the high hundreds to ~13000 (ATP #1 is 12800 here; no tour has ever exceeded 20000).
// So the largest cell in the row is the points column whenever it clears that band, and
// when nothing in the row does, this returns null -- unproven, never a guessed number.
// null is preserved end-to-end as "NA" rather than being coerced to 0.
const MIN_PLAUSIBLE_RANKING_POINTS = 100;
const MAX_PLAUSIBLE_RANKING_POINTS = 20_000;
export function rankingPointsFromCells(cells: string[]): number | null {
  let best: number | null = null;
  for (const cell of cells.slice(1)) {
    const value = num(cell);
    if (value === null || !Number.isFinite(value)) continue;
    if (value < MIN_PLAUSIBLE_RANKING_POINTS || value > MAX_PLAUSIBLE_RANKING_POINTS) continue;
    if (best === null || value > best) best = value;
  }
  return best;
}

function parseRankingTable(html:string,source:RankingSource,target:Target,url:string,extraction?:string):Row[]{
  const rows:Row[]=[]; const seen=new Set<string>(); const rankingDate=target.pullback_end ?? new Date().toISOString().slice(0,10);
  for(const tr of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)){
    const cells=[...tr[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(m=>unescapeHtml(m[1]));
    if(cells.length<2) continue;
    const rankMatch=cells[0].match(/\b(\d{1,4})\b/); if(!rankMatch) continue; const rank=Number(rankMatch[1]);
    const player=(cells[1]??"").replace(/\b[A-Z]{3}\b/g,"").replace(/^[-+\d\s]+/,"").trim(); if(!/[A-Za-zÀ-ž]/.test(player)) continue;
    const points=rankingPointsFromCells(cells); const key=`${rank}:${player}`; if(seen.has(key)) continue; seen.add(key);
    const row=normalize(source,url,target,{playerName:player,rank,points,rankingDate},extraction); if(row) rows.push(row);
  }
  return rows;
}

function rowsFromHtml(source:RankingSource,url:string,target:Target,html:string,extraction:string){
  const objects:Record<string,unknown>[]=[]; for(const p of embedded(html))collect(p,objects); const rows=new Map<string,Row>();
  for(const o of objects){const row=normalize(source,url,target,o,extraction);if(row)rows.set(row.source_record_key,row);} for(const row of parseRankingTable(html,source,target,url,extraction))rows.set(row.source_record_key,row);
  return {rows:[...rows.values()],objects_seen:objects.length};
}
function validateAtpRankingSnapshot(snapshot:OfficialRankingSnapshot){
  if(snapshot.source!=="atp_rankings") throw new Error("ATP ranking snapshot source mismatch"); const u=new URL(snapshot.url);
  if(u.protocol!=="https:"||u.hostname!=="www.atptour.com"||!u.pathname.endsWith("/rankings/singles")) throw new Error(`Invalid ATP Rankings Official snapshot URL: ${snapshot.url}`);
  if(snapshot.html.length<1000||/Just a moment|cf-chl|captcha|Attention Required/i.test(snapshot.html)) throw new Error("Invalid ATP Rankings Official browser snapshot");
}
async function request(url:string){ return fetch(url,{headers:{"user-agent":"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36",accept:"text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8","accept-language":"en-US,en;q=0.9"}}); }

async function fetchRows(source:RankingSource,url:string,target:Target,snapshots:OfficialRankingSnapshot[]){
  if(source==="atp_rankings"&&snapshots.length){
    const rows=new Map<string,Row>(); let objects_seen=0;
    for(const snapshot of snapshots){validateAtpRankingSnapshot(snapshot);const parsed=rowsFromHtml(source,snapshot.url,target,snapshot.html,"official_atp_rankings_browser_snapshot");objects_seen+=parsed.objects_seen;for(const row of parsed.rows)rows.set(row.source_record_key,row);}
    return {rows:[...rows.values()],objects_seen,pages:snapshots.length};
  }
  if(source==="wta_rankings") {
    const api=await request(WTA_RANKINGS_API); if(!api.ok) throw new Error(`${WTA_RANKINGS_API} returned ${api.status}`);
    const payload=await api.json() as unknown; const values=Array.isArray(payload)?payload:(payload&&typeof payload==="object"&&Array.isArray((payload as Record<string,unknown>).content)?(payload as Record<string,unknown>).content as unknown[]:[]);
    const rows=new Map<string,Row>(); for(const value of values){const row=normalizeWtaOfficialRanking(target,WTA_RANKINGS_API,value);if(row)rows.set(row.source_record_key,row);}
    return {rows:[...rows.values()],objects_seen:values.length,pages:1};
  }
  const r=await request(url); if(!r.ok) throw new Error(`${url} returned ${r.status}`); const effectiveUrl=r.url||url; const ct=r.headers.get("content-type")??"";
  if(ct.includes("application/json")) { const payload=await r.json(); const objects:Record<string,unknown>[]=[]; collect(payload,objects); const rows=new Map<string,Row>(); for(const o of objects){const row=normalize(source,effectiveUrl,target,o);if(row)rows.set(row.source_record_key,row);} return {rows:[...rows.values()],objects_seen:objects.length,pages:1}; }
  const html=await r.text(); const parsed=rowsFromHtml(source,effectiveUrl,target,html,"official_page"); return {rows:parsed.rows,objects_seen:parsed.objects_seen,pages:1};
}

async function persistRows(rows:Row[]) {
  let persisted=0;
  for(let i=0;i<rows.length;i+=500){
    const chunk=rows.slice(i,i+500); const {error}=await db.from("source_observations").upsert(chunk,{onConflict:"source_id,source_record_key",ignoreDuplicates:true}); if(error)throw error;
    const sourceId=chunk[0]?.source_id; const keys=chunk.map(r=>r.source_record_key); if(!sourceId||!keys.length)continue;
    const {data,error:confirmError}=await db.from("source_observations").select("source_record_key").eq("source_id",sourceId).in("source_record_key",keys); if(confirmError)throw confirmError;
    persisted += new Set((data??[]).map((r:any)=>r.source_record_key)).size;
  }
  return persisted;
}

export async function ingestTourRankings(source:RankingSource,snapshots:OfficialRankingSnapshot[]=[]){
  const {data:targets,error}=await db.from("ingestion_targets").select("id,source_id,target_key,pullback_start,pullback_end,config").eq("source_id",source).eq("enabled",true); if(error)throw error;
  let observations_written=0,pages_read=0,objects_seen=0;
  for(const target of (targets??[]) as Target[]){
    const cfg=target.config??{}; const url=typeof cfg.url==="string"&&cfg.url?cfg.url:DEFAULT_URLS[source]; const sourceSnapshots=snapshots.filter(s=>s.source===source); const fetched=await fetchRows(source,url,target,sourceSnapshots); pages_read+=fetched.pages; objects_seen+=fetched.objects_seen;
    observations_written+=await persistRows(fetched.rows); await db.from("ingestion_targets").update({last_ingested_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",target.id);
  }
  return {source,source_name:SOURCE_NAMES[source],targets:targets?.length??0,pages_read,objects_seen,observations_written};
}
