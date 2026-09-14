import { readFileSync } from "node:fs";
import { isBeforeCutoff } from "./temporal-boundary";

import { join } from "node:path";
import type { SourcedStat } from "./reconstruction/engine";
const SOURCE_URL="https://www.kaggle.com/datasets/predixsport/sports-elo-ratings",SOURCE_NAME="PredixSport public tennis ratings (CC BY 4.0)";
const WTA_SOURCE_NAME="PredixSport public tennis ratings (CC BY 4.0) -- WTA elo-only index";
type Row=Record<string,string>;let cache:Row[]|null=null;let wtaCache:Row[]|null=null;
function norm(v:string){return v.normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();}
function num(v:string|undefined){const n=Number(v);return Number.isFinite(n)?n:null;}
function parse(text:string){const rows:string[][]=[];let r:string[]=[],c="",q=false;for(let i=0;i<text.length;i++){const x=text[i];if(x==='"'){if(q&&text[i+1]==='"'){c+='"';i++;}else q=!q;}else if(x===","&&!q){r.push(c);c="";}else if((x==='\n'||x==='\r')&&!q){if(x==='\r'&&text[i+1]==='\n')i++;r.push(c);c="";if(r.some(Boolean))rows.push(r);r=[];}else c+=x;}if(c||r.length){r.push(c);rows.push(r);}if(!rows.length)return[];const h=rows[0].map(x=>x.trim());return rows.slice(1).map(a=>Object.fromEntries(h.map((k,i)=>[k,(a[i]??"").trim()])));}
function load(){if(cache)return cache;try{return cache=parse(readFileSync(join(process.cwd(),"data/public/predixsport/atp/atp_elo_matches.csv"),"utf8"));}catch{return [];}}
// The WTA file (data/public/predixsport/wta/wta_elo_ratings.csv) is a genuinely thinner
// schema than the ATP one -- season,date,player,tournament,surface,elo, with NO opponent,
// won, sets_for/sets_against, or elo_pre/elo_post split. Before this fix, this module only
// ever read the ATP file, so every WTA player got zero elo-trajectory stats here even
// though the WTA file already exists and already has everything an elo TREND needs (a
// dated elo value per tournament). It cannot support the ATP-only win/loss-derived stat
// (overall_recent20_win_pct needs `won`, which this file doesn't have) -- that one stays
// ATP-only, correctly, rather than fabricating a result rate from data that isn't there.
function loadWta(){if(wtaCache)return wtaCache;try{return wtaCache=parse(readFileSync(join(process.cwd(),"data/public/predixsport/wta/wta_elo_ratings.csv"),"utf8"));}catch{return [];}}
function cut(ctx:string){return ctx.match(/(?:date\s+)?(20\d{2}-\d{2}-\d{2})/i)?.[1]??null;}function surf(ctx:string){return ctx.match(/surface\s+(hard|clay|grass|carpet)/i)?.[1]?.toLowerCase()??null;}
function stat(p:string,k:string,v:number,n:number,s:string|null,sourceName:string=SOURCE_NAME):SourcedStat{return{key:k,player:p,value:v,surface:s,window:"PRE_MATCH_HISTORY",tour_level:null,sample:n,origin:"RECONSTRUCTED",sources:[{source_name:sourceName,url:SOURCE_URL,retrieved_at:new Date().toISOString()}]};}
export function getStrengthTrajectoryStats(player:string,context:string):SourcedStat[]{const all=load(),pn=norm(player),c=cut(context),s=surf(context);if(!c)return[];const rows=all.filter(r=>norm(r.player??"")===pn&&isBeforeCutoff(r.date,c)).sort((a,b)=>(a.date||"").localeCompare(b.date||""));
 if(rows.length)return atpStats(player,rows,s);
 const wtaRows=loadWta().filter(r=>norm(r.player??"")===pn&&isBeforeCutoff(r.date,c)).sort((a,b)=>(a.date||"").localeCompare(b.date||""));
 if(!wtaRows.length)return[];
 return wtaEloOnlyStats(player,wtaRows,s);
}
function atpStats(player:string,rows:Row[],s:string|null):SourcedStat[]{const eloRows=rows.filter(r=>num(r.elo_pre)!==null),out:SourcedStat[]=[];if(!eloRows.length)return out;const current=num(eloRows[eloRows.length-1].elo_pre)!;const vals=eloRows.map(r=>num(r.elo_pre)!).filter(Number.isFinite),peak=Math.max(...vals),low=Math.min(...vals);out.push(stat(player,"current_overall_elo",current,eloRows.length,s),stat(player,"career_observed_peak_elo",peak,eloRows.length,s),stat(player,"career_observed_low_elo",low,eloRows.length,s),stat(player,"elo_below_peak",peak-current,eloRows.length,s));const recent=eloRows.slice(-20),first=num(recent[0].elo_pre)!,last=num(recent[recent.length-1].elo_pre)!;out.push(stat(player,"elo_change_last20",last-first,recent.length,s));if(recent.length>1)out.push(stat(player,"elo_change_per_match_last20",(last-first)/(recent.length-1),recent.length,s));for(const size of [5,10]){const a=eloRows.slice(-size);if(a.length>=2){const x=num(a[0].elo_pre)!,y=num(a[a.length-1].elo_pre)!;out.push(stat(player,`elo_change_last${size}`,y-x,a.length,s));}}
 if(s){const sr=rows.filter(r=>(r.surface??"").toLowerCase()===s&&num(r.elo_pre)!==null);if(sr.length){const sv=sr.map(r=>num(r.elo_pre)!),cur=sv[sv.length-1],pk=Math.max(...sv);out.push(stat(player,"current_surface_elo",cur,sr.length,s),stat(player,"observed_peak_surface_elo",pk,sr.length,s),stat(player,"surface_elo_below_peak",pk-cur,sr.length,s));const r10=sr.slice(-10);if(r10.length>=2)out.push(stat(player,"surface_elo_change_last10",num(r10[r10.length-1].elo_pre)!-num(r10[0].elo_pre)!,r10.length,s));}}
 const recentMatches=rows.slice(-20),wins=recentMatches.filter(r=>r.won==="1").length;out.push(stat(player,"overall_recent20_win_pct",100*wins/recentMatches.length,recentMatches.length,s));return out;}
function wtaEloOnlyStats(player:string,rows:Row[],s:string|null):SourcedStat[]{const eloRows=rows.filter(r=>num(r.elo)!==null),out:SourcedStat[]=[];if(!eloRows.length)return out;const current=num(eloRows[eloRows.length-1].elo)!;const vals=eloRows.map(r=>num(r.elo)!).filter(Number.isFinite),peak=Math.max(...vals),low=Math.min(...vals);out.push(stat(player,"current_overall_elo",current,eloRows.length,s,WTA_SOURCE_NAME),stat(player,"career_observed_peak_elo",peak,eloRows.length,s,WTA_SOURCE_NAME),stat(player,"career_observed_low_elo",low,eloRows.length,s,WTA_SOURCE_NAME),stat(player,"elo_below_peak",peak-current,eloRows.length,s,WTA_SOURCE_NAME));const recent=eloRows.slice(-20),first=num(recent[0].elo)!,last=num(recent[recent.length-1].elo)!;out.push(stat(player,"elo_change_last20",last-first,recent.length,s,WTA_SOURCE_NAME));if(recent.length>1)out.push(stat(player,"elo_change_per_match_last20",(last-first)/(recent.length-1),recent.length,s,WTA_SOURCE_NAME));for(const size of [5,10]){const a=eloRows.slice(-size);if(a.length>=2){const x=num(a[0].elo)!,y=num(a[a.length-1].elo)!;out.push(stat(player,`elo_change_last${size}`,y-x,a.length,s,WTA_SOURCE_NAME));}}
 if(s){const sr=rows.filter(r=>(r.surface??"").toLowerCase()===s&&num(r.elo)!==null);if(sr.length){const sv=sr.map(r=>num(r.elo)!),cur=sv[sv.length-1],pk=Math.max(...sv);out.push(stat(player,"current_surface_elo",cur,sr.length,s,WTA_SOURCE_NAME),stat(player,"observed_peak_surface_elo",pk,sr.length,s,WTA_SOURCE_NAME),stat(player,"surface_elo_below_peak",pk-cur,sr.length,s,WTA_SOURCE_NAME));const r10=sr.slice(-10);if(r10.length>=2)out.push(stat(player,"surface_elo_change_last10",num(r10[r10.length-1].elo)!-num(r10[0].elo)!,r10.length,s,WTA_SOURCE_NAME));}}
 // No overall_recent20_win_pct here: the WTA file has no `won` column, so this stat is
 // correctly left absent rather than fabricated from data that doesn't exist.
 return out;}
