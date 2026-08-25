import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { assertObservationFamily } from "../metric-source-family-policy";

const db = supabaseAdmin as any;

type TourSource = "atp" | "wta" | "atp_challenger";
export type OfficialTourSnapshot = { source: "atp" | "atp_challenger"; url: string; html: string };
type Target = { id:string; source_id:TourSource; target_key:string; pullback_start:string|null; pullback_end:string|null; config:Record<string,unknown>|null };
type Observation = {
  source_id:string; source_name:string; source_url:string; source_record_key:string;
  player_name:string|null; opponent_name:string|null; tournament:string|null; event_date:string|null; surface:string|null;
  observation_type:string; observation_key:string; text_value:string|null; numeric_value:number|null; sample_label:string|null;
  window_start:string|null; window_end:string|null; raw_payload:unknown; provenance:Record<string,unknown>;
};

const DEFAULT_URLS:Record<TourSource,string> = {
  atp:"https://www.atptour.com/en/scores/current",
  wta:"https://www.wtatennis.com/tournaments",
  atp_challenger:"https://www.atptour.com/en/scores/current",
};
const SOURCE_NAMES:Record<TourSource,string> = {
  atp:"ATP Tour Official",
  wta:"WTA Official",
  atp_challenger:"ATP Challenger Tour Official",
};
const WTA_TOURNAMENT_API = "https://api.wtatennis.com/tennis/tournaments";

function asString(value:unknown):string|null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}
function first(obj:Record<string,unknown>,keys:string[]) {
  for (const key of keys) { const value=asString(obj[key]); if (value) return value; }
  return null;
}
function deepFirst(obj:Record<string,unknown>,keys:string[],depth=0):string|null {
  const direct=first(obj,keys); if(direct) return direct;
  if(depth>=3) return null;
  for(const value of Object.values(obj)) {
    if(value && typeof value === "object" && !Array.isArray(value)) {
      const found=deepFirst(value as Record<string,unknown>,keys,depth+1); if(found) return found;
    }
  }
  return null;
}
function isoDate(value:string|null) {
  if (!value) return null;
  const m=value.match(/(20\d{2})[-\/.](\d{1,2})[-\/.](\d{1,2})/);
  return m ? `${m[1]}-${m[2].padStart(2,"0")}-${m[3].padStart(2,"0")}` : null;
}
function collectObjects(value:unknown,out:Record<string,unknown>[],depth=0) {
  if (depth>12 || value==null) return;
  if (Array.isArray(value)) { for (const item of value) collectObjects(item,out,depth+1); return; }
  if (typeof value !== "object") return;
  const obj=value as Record<string,unknown>;
  out.push(obj);
  for (const child of Object.values(obj)) collectObjects(child,out,depth+1);
}
function embeddedJson(html:string):unknown[] {
  const values:unknown[]=[];
  for (const match of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)) {
    const body=match[1]?.trim();
    if (!body || (!body.startsWith("{") && !body.startsWith("["))) continue;
    try { values.push(JSON.parse(body)); } catch {}
  }
  return values;
}
function decodeHtml(value:string) {
  return value.replace(/&amp;/gi,"&").replace(/&#39;/g,"'").replace(/&quot;/gi,'"').replace(/&nbsp;/gi," ");
}
function stripTags(value:string) { return decodeHtml(value.replace(/<[^>]+>/g," ")).replace(/\s+/g," ").trim(); }
function targetYears(target:Target) {
  const now=new Date().getUTCFullYear();
  const start=Number((target.pullback_start??`${now}-01-01`).slice(0,4));
  const end=Number((target.pullback_end??`${now}-12-31`).slice(0,4));
  const lo=Number.isFinite(start)?Math.min(start,end):now, hi=Number.isFinite(end)?Math.max(start,end):now;
  const years:number[]=[]; for(let year=lo;year<=hi;year++) years.push(year); return years;
}
function levelText(obj:Record<string,unknown>) {
  return deepFirst(obj,["level","Level","eventLevel","EventLevel","category","Category","tournamentLevel","TournamentLevel","type","Type","TournamentClass","tournamentClass","levelName","levelLabel"]);
}
function isChallengerLevel(level:string|null) { return !!level && (/challenger/i.test(level) || /\bch\b/i.test(level)); }
function isWtaMainLevel(level:string|null) {
  if(!level) return false;
  if(/\b125\b|wta\s*125|challenger|itf/i.test(level)) return false;
  return /grand\s*slam|finals|1000|500|250|premier|international|wta/i.test(level);
}
function sourceMatchesTour(source:TourSource,obj:Record<string,unknown>) {
  const level=levelText(obj);
  if (source === "wta") return isWtaMainLevel(level);
  if (source === "atp_challenger") return isChallengerLevel(level);
  return !isChallengerLevel(level);
}

function normalizedFromObject(source:TourSource,url:string,target:Target,obj:Record<string,unknown>):Observation[] {
  if (!sourceMatchesTour(source,obj)) return [];
  const player1=deepFirst(obj,["player1","Player1","playerOne","homePlayer","competitor1","winnerName","playerA","participant1"]);
  const player2=deepFirst(obj,["player2","Player2","playerTwo","awayPlayer","competitor2","loserName","playerB","participant2"]);
  const tournament=deepFirst(obj,["tournament","Tournament","tournamentName","TournamentName","event","eventName","competitionName","SponsorTitle","TournamentTitle","title","name","Name"]);
  const dateRaw=deepFirst(obj,["date","Date","matchDate","startDate","StartDate","startTime","scheduledAt","eventDate","EventDate","FormattedDate"]);
  const endDateRaw=deepFirst(obj,["endDate","EndDate"]);
  const eventDate=isoDate(dateRaw);
  const surface=deepFirst(obj,["surface","Surface","courtSurface","CourtSurface"]);
  const round=deepFirst(obj,["round","Round","roundName","stage"]);
  const status=deepFirst(obj,["status","Status","matchStatus","state"]);
  const score=deepFirst(obj,["score","Score","scoreText","result"]);
  const winner=deepFirst(obj,["winner","Winner","winnerName"]);

  const looksLikeMatch = Boolean(player1 && player2);
  const looksLikeSchedule = Boolean(tournament && (eventDate || dateRaw));
  if (!looksLikeMatch && !looksLikeSchedule) return [];

  const identity=[target.target_key,tournament,eventDate??dateRaw,player1,player2,round].filter(Boolean).join(":");
  const common={
    source_id:source, source_name:SOURCE_NAMES[source], source_url:url, tournament, event_date:eventDate, surface, sample_label:round,
    window_start:target.pullback_start, window_end:target.pullback_end, raw_payload:obj,
    provenance:{target_key:target.target_key,tour:source,level:levelText(obj),extraction:"official_page_structured_json"},
  };
  const rows:Observation[]=[];
  if (looksLikeMatch) rows.push({...common,source_record_key:`${identity}:match_record:${player1}`,player_name:player1,opponent_name:player2,observation_type:"MATCH_RESULT_OR_SCHEDULE",observation_key:"match_record",text_value:JSON.stringify({player1,player2,round,status,score,winner}),numeric_value:null});
  if (looksLikeSchedule) rows.push({...common,source_record_key:`${identity}:event_schedule`,player_name:null,opponent_name:null,observation_type:"TOURNAMENT_SCHEDULE",observation_key:"event_schedule",text_value:JSON.stringify({tournament,date:eventDate??dateRaw,end_date:isoDate(endDateRaw)??endDateRaw,surface,round,status,level:levelText(obj)}),numeric_value:null});
  return rows;
}

async function request(url:string) {
  return fetch(url,{headers:{
    "user-agent":"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36",
    accept:"text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
    "accept-language":"en-US,en;q=0.9", "cache-control":"no-cache", pragma:"no-cache",
  }});
}

function atpArchiveUrl(source:"atp"|"atp_challenger",year:number) {
  const base=`https://www.atptour.com/en/scores/results-archive?year=${year}`;
  return source === "atp_challenger" ? `${base}&tournamentType=ch` : `${base}&tournamentType=atp`;
}
function validateAtpSnapshot(source:"atp"|"atp_challenger",target:Target,snapshot:OfficialTourSnapshot) {
  if(snapshot.source!==source) throw new Error(`ATP Official snapshot source mismatch: expected ${source}, got ${snapshot.source}`);
  const parsed=new URL(snapshot.url);
  if(parsed.protocol!=="https:" || parsed.hostname!=="www.atptour.com" || !parsed.pathname.endsWith("/scores/results-archive")) throw new Error(`Invalid ATP Official snapshot URL: ${snapshot.url}`);
  const year=Number(parsed.searchParams.get("year"));
  if(!targetYears(target).includes(year)) throw new Error(`ATP Official snapshot year ${year} is outside target window`);
  const type=(parsed.searchParams.get("tournamentType")??"").toLowerCase();
  if(source==="atp_challenger" && type!=="ch") throw new Error("ATP Challenger snapshot must use tournamentType=ch");
  if(source==="atp" && type==="ch") throw new Error("ATP Main snapshot cannot use Challenger tournamentType=ch");
  if(!snapshot.html || snapshot.html.length<1000) throw new Error(`ATP Official snapshot was empty or implausibly small: ${snapshot.url}`);
  if(/Just a moment|cf-chl|captcha|Attention Required/i.test(snapshot.html)) throw new Error(`ATP Official snapshot contained a Cloudflare challenge: ${snapshot.url}`);
}
function humanizeSlug(slug:string) { return decodeURIComponent(slug).replace(/-/g," ").replace(/\b\w/g,(c)=>c.toUpperCase()); }
function parseAtpArchive(source:"atp"|"atp_challenger",target:Target,url:string,html:string):Observation[] {
  const rows:Observation[]=[]; const seen=new Set<string>();
  const re=/<a\b[^>]*href=["']([^"']*\/en\/scores\/archive\/([^\/"']+)\/([^\/"']+)\/(20\d{2})\/results[^"']*)["'][^>]*>[\s\S]*?<\/a>/gi;
  for(const match of html.matchAll(re)) {
    const href=match[1]; const slug=match[2]; const tournamentId=match[3]; const year=Number(match[4]);
    const absolute=href.startsWith("http")?href:`https://www.atptour.com${href.startsWith("/")?href:`/${href}`}`;
    const key=`${target.target_key}:${year}:${tournamentId}:event_schedule`; if(seen.has(key)) continue; seen.add(key);
    const context=stripTags(html.slice(Math.max(0,(match.index??0)-1200),match.index??0));
    const tournament=humanizeSlug(slug);
    const level=source === "atp_challenger" ? "ATP_CHALLENGER" : "ATP_MAIN";
    rows.push({
      source_id:source, source_name:SOURCE_NAMES[source], source_url:url, source_record_key:key,
      player_name:null, opponent_name:null, tournament, event_date:null, surface:null,
      observation_type:"TOURNAMENT_SCHEDULE", observation_key:"event_schedule",
      text_value:JSON.stringify({tournament,year,results_url:absolute,competition_level:level}), numeric_value:null, sample_label:level,
      window_start:target.pullback_start, window_end:target.pullback_end,
      raw_payload:{tournament_slug:slug,tournament_id:tournamentId,year,results_url:absolute,context},
      provenance:{target_key:target.target_key,tour:source,competition_level:level,extraction:"official_atp_results_archive_browser_snapshot"},
    });
  }
  return rows;
}

async function fetchAtpOfficial(source:"atp"|"atp_challenger",target:Target,snapshots:OfficialTourSnapshot[]) {
  if(snapshots.length) {
    const rows:Observation[]=[]; let seen=0;
    for(const snapshot of snapshots) {
      validateAtpSnapshot(source,target,snapshot);
      const parsed=parseAtpArchive(source,target,snapshot.url,snapshot.html); seen+=parsed.length; rows.push(...parsed);
    }
    return {rows,pages:snapshots.length,seen};
  }
  const rows:Observation[]=[]; let pages=0,seen=0;
  for(const year of targetYears(target)) {
    const url=atpArchiveUrl(source,year); const res=await request(url); if(!res.ok) throw new Error(`${url} returned ${res.status}`);
    const html=await res.text(); pages++; const parsed=parseAtpArchive(source,target,url,html); seen+=parsed.length; rows.push(...parsed);
  }
  return {rows,pages,seen};
}

function wtaApiRows(target:Target,url:string,payload:unknown):Observation[] {
  const roots:Array<Record<string,unknown>>=[];
  if(Array.isArray(payload)) roots.push(...payload.filter((v):v is Record<string,unknown>=>!!v&&typeof v==="object"&&!Array.isArray(v)));
  else if(payload && typeof payload === "object") {
    const root=payload as Record<string,unknown>; const content=root.content;
    if(Array.isArray(content)) roots.push(...content.filter((v):v is Record<string,unknown>=>!!v&&typeof v==="object"&&!Array.isArray(v)));
  }
  const allowedYears=new Set(targetYears(target)); const rows:Observation[]=[];
  for(const obj of roots) {
    const level=levelText(obj); if(!isWtaMainLevel(level)) continue;
    const year=Number(deepFirst(obj,["year","tournamentYear","seasonYear"])); if(!Number.isFinite(year)||!allowedYears.has(year)) continue;
    const group=(obj.tournamentGroup && typeof obj.tournamentGroup === "object" && !Array.isArray(obj.tournamentGroup)) ? obj.tournamentGroup as Record<string,unknown> : null;
    const groupId=(group?first(group,["id","groupId"]):null) ?? deepFirst(obj,["tournamentGroupId","groupId","id"]);
    const tournament=(group?first(group,["name","title"]):null) ?? deepFirst(obj,["tournamentName","name","title"]);
    if(!groupId || !tournament) continue;
    const start=isoDate(deepFirst(obj,["startDate","date","fromDate"])); const end=isoDate(deepFirst(obj,["endDate","toDate"]));
    const surface=deepFirst(obj,["surface","surfaceName"]); const key=`${target.target_key}:${year}:${groupId}:event_schedule`;
    rows.push({source_id:"wta",source_name:SOURCE_NAMES.wta,source_url:url,source_record_key:key,player_name:null,opponent_name:null,tournament,event_date:start,surface,
      observation_type:"TOURNAMENT_SCHEDULE",observation_key:"event_schedule",text_value:JSON.stringify({tournament,year,start_date:start,end_date:end,surface,level,group_id:groupId}),numeric_value:null,sample_label:level,
      window_start:target.pullback_start,window_end:target.pullback_end,raw_payload:obj,provenance:{target_key:target.target_key,tour:"wta",level,group_id:groupId,extraction:"official_wta_public_api"}});
  }
  return rows;
}

async function fetchWtaOfficial(target:Target,configuredUrl:string) {
  const pageRes=await request(configuredUrl); if(!pageRes.ok) throw new Error(`${configuredUrl} returned ${pageRes.status}`);
  const pageUrl=pageRes.url||configuredUrl; const pageHtml=await pageRes.text();
  const objects:Record<string,unknown>[]=[]; for(const payload of embeddedJson(pageHtml)) collectObjects(payload,objects);
  const pageRows=new Map<string,Observation>(); for(const obj of objects) for(const row of normalizedFromObject("wta",pageUrl,target,obj)) pageRows.set(row.source_record_key,row);
  if(pageRows.size) return {rows:[...pageRows.values()],pages:1,seen:objects.length};

  const rows=new Map<string,Observation>(); let pages=1,seen=objects.length;
  for(let page=0;page<10;page++) {
    const apiUrl=`${WTA_TOURNAMENT_API}?page=${page}&pageSize=500`; const res=await request(apiUrl); if(!res.ok) throw new Error(`${apiUrl} returned ${res.status}`);
    const payload=await res.json() as unknown; const parsed=wtaApiRows(target,apiUrl,payload); for(const row of parsed) rows.set(row.source_record_key,row); pages++; seen+=parsed.length;
    if(payload && typeof payload === "object" && !Array.isArray(payload)) {
      const root=payload as Record<string,unknown>; const info=root.pageInfo as Record<string,unknown>|undefined; const total=Number(info?.numPages);
      if(Number.isFinite(total) && page+1>=total) break;
      const content=root.content; if(Array.isArray(content) && content.length===0) break;
    } else break;
  }
  return {rows:[...rows.values()],pages,seen};
}

async function writeRows(rows:Observation[]) {
  for (const row of rows) assertObservationFamily(row,"RESULTS_SCHEDULE");
  let persisted=0;
  for (let i=0;i<rows.length;i+=500) {
    const chunk=rows.slice(i,i+500); const {error}=await db.from("source_observations").upsert(chunk,{onConflict:"source_id,source_record_key",ignoreDuplicates:true}); if(error) throw error;
    const keys=chunk.map((row)=>row.source_record_key); const sourceId=chunk[0]?.source_id; if(!sourceId||!keys.length) continue;
    const {data:confirmed,error:confirmError}=await db.from("source_observations").select("source_record_key").eq("source_id",sourceId).in("source_record_key",keys); if(confirmError) throw confirmError;
    persisted += new Set((confirmed??[]).map((row:any)=>row.source_record_key)).size;
  }
  return persisted;
}

export async function ingestTourResultsAndSchedules(source:TourSource,snapshots:OfficialTourSnapshot[] = []) {
  const {data:targets,error}=await db.from("ingestion_targets").select("id,source_id,target_key,pullback_start,pullback_end,config").eq("source_id",source).eq("enabled",true); if(error) throw error;
  let observationsWritten=0,pagesRead=0,structuredObjectsSeen=0;
  for (const target of (targets??[]) as Target[]) {
    const config=target.config??{}; const configuredUrl=typeof config.url === "string" && config.url ? config.url : DEFAULT_URLS[source];
    const sourceSnapshots=snapshots.filter(snapshot=>snapshot.source===source);
    const fetched=source === "wta" ? await fetchWtaOfficial(target,configuredUrl) : await fetchAtpOfficial(source,target,sourceSnapshots);
    pagesRead+=fetched.pages; structuredObjectsSeen+=fetched.seen; observationsWritten+=await writeRows(fetched.rows);
    await db.from("ingestion_targets").update({last_ingested_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",target.id);
  }
  return {source,source_name:SOURCE_NAMES[source],targets:targets?.length??0,pages_read:pagesRead,structured_objects_seen:structuredObjectsSeen,observations_written:observationsWritten};
}

export type { TourSource };
