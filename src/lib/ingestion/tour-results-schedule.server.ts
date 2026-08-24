import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { assertObservationFamily } from "../metric-source-family-policy";

const db = supabaseAdmin as any;

type TourSource = "atp" | "wta" | "atp_challenger";
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
const ATP_CALENDAR_FEED = "https://api.protennislive.com/feeds/api/Tournaments/calendar";
const SOURCE_NAMES:Record<TourSource,string> = { atp:"ATP Tour Official", wta:"WTA Official", atp_challenger:"ATP Challenger Tour Official" };

function asString(value:unknown):string|null{ if(typeof value==="string"&&value.trim())return value.trim(); if(typeof value==="number"&&Number.isFinite(value))return String(value); return null; }
function first(obj:Record<string,unknown>,keys:string[]){ for(const key of keys){const value=asString(obj[key]); if(value)return value;} return null; }
function isoDate(value:string|null){ if(!value)return null; const m=value.match(/(20\d{2})[-\/.](\d{1,2})[-\/.](\d{1,2})/); return m?`${m[1]}-${m[2].padStart(2,"0")}-${m[3].padStart(2,"0")}`:null; }
function collectObjects(value:unknown,out:Record<string,unknown>[],depth=0){ if(depth>12||value==null)return; if(Array.isArray(value)){for(const item of value)collectObjects(item,out,depth+1);return;} if(typeof value!=="object")return; const obj=value as Record<string,unknown>; out.push(obj); for(const child of Object.values(obj))collectObjects(child,out,depth+1); }
function embeddedJson(html:string):unknown[]{ const values:unknown[]=[]; for(const match of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)){const body=match[1]?.trim(); if(!body||(!body.startsWith("{")&&!body.startsWith("[")))continue; try{values.push(JSON.parse(body));}catch{}} return values; }

function levelText(obj:Record<string,unknown>){ return first(obj,["level","Level","eventLevel","EventLevel","category","Category","tournamentLevel","TournamentLevel","type","Type","TournamentClass","tournamentClass"]); }
function isChallengerLevel(level:string|null){ return !!level && (/challenger/i.test(level) || /\bch\b/i.test(level)); }
function sourceMatchesTour(source:TourSource,obj:Record<string,unknown>){
  if(source==="wta") return true;
  const level=levelText(obj);
  if(source==="atp_challenger") return isChallengerLevel(level);
  return !isChallengerLevel(level);
}

function normalizedFromObject(source:TourSource,url:string,target:Target,obj:Record<string,unknown>):Observation[]{
  if(!sourceMatchesTour(source,obj)) return [];
  const player1=first(obj,["player1","Player1","playerOne","homePlayer","competitor1","winnerName","playerA","participant1"]);
  const player2=first(obj,["player2","Player2","playerTwo","awayPlayer","competitor2","loserName","playerB","participant2"]);
  const tournament=first(obj,["tournament","Tournament","tournamentName","TournamentName","event","eventName","competitionName","name","Name","SponsorTitle","TournamentTitle"]);
  const dateRaw=first(obj,["date","Date","matchDate","startDate","StartDate","startTime","scheduledAt","eventDate","EventDate","FormattedDate"]);
  const endDateRaw=first(obj,["endDate","EndDate"]);
  const eventDate=isoDate(dateRaw);
  const surface=first(obj,["surface","Surface","courtSurface","CourtSurface"]);
  const round=first(obj,["round","Round","roundName","stage"]);
  const status=first(obj,["status","Status","matchStatus","state"]);
  const score=first(obj,["score","Score","scoreText","result"]);
  const winner=first(obj,["winner","Winner","winnerName"]);

  const looksLikeMatch = Boolean(player1 && player2);
  const looksLikeSchedule = Boolean(tournament && (eventDate || dateRaw));
  if (!looksLikeMatch && !looksLikeSchedule) return [];

  const identity=[target.target_key,tournament,eventDate??dateRaw,player1,player2,round].filter(Boolean).join(":");
  const common={source_id:source,source_name:SOURCE_NAMES[source],source_url:url,tournament,event_date:eventDate,surface,sample_label:round,window_start:target.pullback_start,window_end:target.pullback_end,raw_payload:obj,provenance:{target_key:target.target_key,tour:source,level:levelText(obj),extraction:url.includes("protennislive")?"official_atp_feed":"official_page_structured_json"}};
  const rows:Observation[]=[];
  if(looksLikeMatch) rows.push({...common,source_record_key:`${identity}:match_record:${player1}`,player_name:player1,opponent_name:player2,observation_type:"MATCH_RESULT_OR_SCHEDULE",observation_key: "match_record",text_value:JSON.stringify({player1,player2,round,status,score,winner}),numeric_value:null});
  if(looksLikeSchedule) rows.push({...common,source_record_key:`${identity}:event_schedule`,player_name:null,opponent_name:null,observation_type:"TOURNAMENT_SCHEDULE",observation_key: "event_schedule",text_value:JSON.stringify({tournament,date:eventDate??dateRaw,end_date:isoDate(endDateRaw)??endDateRaw,surface,round,status,level:levelText(obj)}),numeric_value:null});
  return rows;
}

async function request(url:string){ return fetch(url,{headers:{"user-agent":"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36",accept:"text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8","accept-language":"en-US,en;q=0.9","cache-control":"no-cache",pragma:"no-cache"}}); }
async function fetchStructured(source:TourSource,url:string){
  let res=await request(url);
  if((source==="atp"||source==="atp_challenger")&&!res.ok) res=await request(ATP_CALENDAR_FEED);
  if(!res.ok) throw new Error(`${res.url||url} returned ${res.status}`);
  const effectiveUrl=res.url||url;
  const contentType=res.headers.get("content-type")??"";
  if(contentType.includes("application/json")) return {payloads:[await res.json()],url:effectiveUrl};
  return {payloads:embeddedJson(await res.text()),url:effectiveUrl};
}

async function writeRows(rows:Observation[]){
  for (const row of rows) assertObservationFamily(row, "RESULTS_SCHEDULE");
  let written=0;
  for(let i=0;i<rows.length;i+=500){const chunk=rows.slice(i,i+500); const {error}=await db.from("source_observations").upsert(chunk,{onConflict:"source_id,source_record_key",ignoreDuplicates:true}); if(error)throw error; written+=chunk.length;}
  return written;
}

export async function ingestTourResultsAndSchedules(source:TourSource){
  const {data:targets,error}=await db.from("ingestion_targets").select("id,source_id,target_key,pullback_start,pullback_end,config").eq("source_id",source).eq("enabled",true); if(error)throw error;
  let observationsWritten=0,pagesRead=0,structuredObjectsSeen=0;
  for(const target of (targets??[]) as Target[]){
    const config=target.config??{}; const url=typeof config.url==="string"&&config.url?config.url:DEFAULT_URLS[source];
    const fetched=await fetchStructured(source,url); pagesRead++;
    const objects:Record<string,unknown>[]=[]; for(const payload of fetched.payloads)collectObjects(payload,objects); structuredObjectsSeen+=objects.length;
    const dedupe=new Map<string,Observation>(); for(const obj of objects){for(const row of normalizedFromObject(source,fetched.url,target,obj))dedupe.set(row.source_record_key,row);}
    observationsWritten+=await writeRows([...dedupe.values()]);
    await db.from("ingestion_targets").update({last_ingested_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",target.id);
  }
  return {source,targets:targets?.length??0,pages_read:pagesRead,structured_objects_seen:structuredObjectsSeen,observations_written:observationsWritten};
}

export type { TourSource };
