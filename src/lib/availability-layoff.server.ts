import { readFileSync } from "node:fs";
import { isBeforeCutoff } from "./temporal-boundary";

import { join } from "node:path";
import type { SourcedStat } from "./reconstruction/engine";

const SOURCE_URL="https://www.kaggle.com/datasets/predixsport/sports-elo-ratings";
const SOURCE_NAME="PredixSport public tennis ratings (CC BY 4.0)";
type Row=Record<string,string>;
let atpCache:Row[]|null=null,wtaCache:Row[]|null=null;
function norm(v:string){return v.normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();}
function parse(text:string){const rows:string[][]=[];let r:string[]=[],c="",q=false;for(let i=0;i<text.length;i++){const x=text[i];if(x==='"'){if(q&&text[i+1]==='"'){c+='"';i++;}else q=!q;}else if(x===","&&!q){r.push(c);c="";}else if((x==='\n'||x==='\r')&&!q){if(x==='\r'&&text[i+1]==='\n')i++;r.push(c);c="";if(r.some(Boolean))rows.push(r);r=[];}else c+=x;}if(c||r.length){r.push(c);rows.push(r);}if(!rows.length)return[];const h=rows[0].map(x=>x.trim());return rows.slice(1).map(a=>Object.fromEntries(h.map((k,i)=>[k,(a[i]??"").trim()])));}
function load(kind:"ATP"|"WTA"){try{if(kind==="ATP"){if(atpCache)return atpCache;return atpCache=parse(readFileSync(join(process.cwd(),"data/public/predixsport/atp/atp_elo_matches.csv"),"utf8"));}if(wtaCache)return wtaCache;return wtaCache=parse(readFileSync(join(process.cwd(),"data/public/predixsport/wta/wta_elo_ratings.csv"),"utf8"));}catch{return[];}}
function cutoff(ctx:string){return ctx.match(/(?:date\s+)?(20\d{2}-\d{2}-\d{2})/i)?.[1]??null;}
function stat(player:string,key:string,value:number,sample:number):SourcedStat{return{key,player,value,surface:null,window:"PRE_MATCH_HISTORY",tour_level:null,sample,origin:"RECONSTRUCTED",sources:[{source_name:SOURCE_NAME,url:SOURCE_URL,retrieved_at:new Date().toISOString()}]};}
function playerRows(player:string){const n=norm(player),atp=load("ATP").filter(r=>norm(r.player??"")===n);if(atp.length)return atp;return load("WTA").filter(r=>norm(r.player??"")===n);}
function dateMs(s:string){const t=Date.parse(`${s}T00:00:00Z`);return Number.isFinite(t)?t:null;}
// A gap between a player's last match of one calendar year and their first
// match of the next is the routine off-season break every tour player takes
// -- not an "Availability" signal (injury/withdrawal/retirement/medical
// timeout). Counting it as a "layoff" would flag essentially every player as
// having a 60-90+ day layoff every single season, which silently defeats the
// whole point of this metric (see docs/metric-audit-013-availability.md and
// the equivalent, already-fixed conflation for metric 077's off-season rest
// length in tennis-data-extended.server.ts). Only a gap that does NOT span a
// year boundary is counted here as an observed mid-season layoff.
function crossesCalendarYearBoundary(earlierDate:string,laterDate:string){return earlierDate.slice(0,4)!==laterDate.slice(0,4);}
export function computeAvailabilityStatsFromRows(rows:Row[],player:string,c:string|null):SourcedStat[]{if(!c)return[];/*Phase 13: unestablished boundary => no admissible evidence.*/rows=[...rows].filter(r=>isBeforeCutoff(r.date,c)).sort((a,b)=>(a.date||"").localeCompare(b.date||""));if(!rows.length||!c)return[];const out:SourcedStat[]=[],end=dateMs(c),last=rows[rows.length-1],lastMs=last?.date?dateMs(last.date):null;if(end!==null&&lastMs!==null)out.push(stat(player,"days_since_last_match",Math.max(0,(end-lastMs)/86400000),1));let longest=0,recentGap=0,gapsOver30=0,gapsOver60=0,gapsOver90=0,inSeasonGaps=0;for(let i=1;i<rows.length;i++){const a=dateMs(rows[i-1].date??""),b=dateMs(rows[i].date??"");if(a===null||b===null)continue;const d=(b-a)/86400000;recentGap=d;const offseason=crossesCalendarYearBoundary(rows[i-1].date??"",rows[i].date??"");if(offseason)continue;inSeasonGaps++;longest=Math.max(longest,d);if(d>=30)gapsOver30++;if(d>=60)gapsOver60++;if(d>=90)gapsOver90++;}out.push(stat(player,"longest_observed_layoff_days",longest,inSeasonGaps),stat(player,"recent_inter_match_gap_days",recentGap,Math.max(0,rows.length-1)),stat(player,"observed_layoffs_30d_plus",gapsOver30,inSeasonGaps),stat(player,"observed_layoffs_60d_plus",gapsOver60,inSeasonGaps),stat(player,"observed_layoffs_90d_plus",gapsOver90,inSeasonGaps));const returnMatches:Row[]=[];for(let i=1;i<rows.length;i++){const a=dateMs(rows[i-1].date??""),b=dateMs(rows[i].date??"");if(a===null||b===null)continue;if(crossesCalendarYearBoundary(rows[i-1].date??"",rows[i].date??""))continue;if((b-a)/86400000>=45)returnMatches.push(...rows.slice(i,Math.min(i+3,rows.length)));}const usable=returnMatches.filter(r=>r.won==="0"||r.won==="1");if(usable.length)out.push(stat(player,"return_after_layoff_win_pct",100*usable.filter(r=>r.won==="1").length/usable.length,usable.length));return out;}
export function getAvailabilityHistoryStats(player:string,context:string):SourcedStat[]{return computeAvailabilityStatsFromRows(playerRows(player),player,cutoff(context));}
