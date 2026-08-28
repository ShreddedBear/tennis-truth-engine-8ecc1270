import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { SourcedStat } from "./reconstruction/engine";

const ROOT=join(process.cwd(),"data/public/tennis-data");
const SOURCE_NAME="Tennis-Data historical ATP/WTA results";
const SOURCE_URL="https://www.tennis-data.co.uk/alldata.php";
type Row=Record<string,string>;
type Match={date:string;surface:string;winner:string;loser:string;score:string;winnerRank:string;loserRank:string};
let cache:Match[]|null=null;
function norm(v:string|null|undefined){return(v??"").normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();}
function parseCsv(text:string):Row[]{const rows:string[][]=[];let r:string[]=[],c="",q=false;for(let i=0;i<text.length;i++){const x=text[i];if(x==='"'){if(q&&text[i+1]==='"'){c+='"';i++;}else q=!q;}else if(x===","&&!q){r.push(c);c="";}else if((x==='\n'||x==='\r')&&!q){if(x==='\r'&&text[i+1]==='\n')i++;r.push(c);c="";if(r.some(Boolean))rows.push(r);r=[];}else c+=x;}if(c||r.length){r.push(c);rows.push(r);}if(!rows.length)return[];const h=rows[0].map(x=>x.trim());return rows.slice(1).map(a=>Object.fromEntries(h.map((k,i)=>[k,(a[i]??"").trim()])));}
function load(){if(cache)return cache;const out:Match[]=[];try{for(const tour of ["atp","wta"]){const dir=join(ROOT,tour);if(!existsSync(dir))continue;for(const f of readdirSync(dir).filter(x=>/^20\d{2}\.csv$/.test(x))){for(const r of parseCsv(readFileSync(join(dir,f),"utf8"))){if(r.date&&r.winner&&r.loser)out.push({date:r.date,surface:r.surface??"",winner:r.winner,loser:r.loser,score:r.score??"",winnerRank:r.winner_rank??"",loserRank:r.loser_rank??""});}}}}catch{return [];}cache=out.sort((a,b)=>a.date.localeCompare(b.date));return cache;}
function cutoff(ctx:string){return ctx.match(/(?:date\s+)?(20\d{2}-\d{2}-\d{2})/i)?.[1]??null;}
function surface(ctx:string){return ctx.match(/surface\s+(hard|clay|grass|carpet)/i)?.[1]?.toLowerCase()??null;}
function scoreSets(score:string){return score.split(/\s+/).map(s=>s.match(/^(\d+)-(\d+)/)).filter((m):m is RegExpMatchArray=>!!m).map(m=>[Number(m[1]),Number(m[2])] as [number,number]);}
function stat(player:string,key:string,value:number,sample:number,s:string|null):SourcedStat{return{key,player,value,surface:s,window:"HISTORICAL_2005_PRE_MATCH",tour_level:null,sample,origin:"RECONSTRUCTED",sources:[{source_name:SOURCE_NAME,url:SOURCE_URL,retrieved_at:new Date().toISOString()}]};}
export function getExtendedTennisDataStats(player:string,context:string):SourcedStat[]{const pn=norm(player),cut=cutoff(context),surf=surface(context);let rows=load().filter(m=>(!cut||m.date<cut)&&(norm(m.winner)===pn||norm(m.loser)===pn));if(!rows.length)return[];const surfaceRows=surf?rows.filter(m=>norm(m.surface)===surf):[];const chosen=surfaceRows.length?surfaceRows:rows;const out:SourcedStat[]=[];const isWin=(m:Match)=>norm(m.winner)===pn;
 const seq=rows.map(isWin);if(seq.length){const last=seq[seq.length-1],sign=last?1:-1;let streak=0;for(let i=seq.length-1;i>=0&&seq[i]===last;i--)streak++;out.push(stat(player,"current_streak_signed",sign*streak,seq.length,surf));let best=0,run=0;for(const w of seq){if(w){run++;best=Math.max(best,run);}else run=0;}out.push(stat(player,"longest_win_streak_observed",best,seq.length,surf));}
 let firstSetWins=0,converted=0,deciding=0,decidingWins=0;for(const m of chosen){const ss=scoreSets(m.score);if(!ss.length)continue;const w=isWin(m);const [a,b]=ss[0];const playerWonFirst=w?a>b:a<b;if(playerWonFirst){firstSetWins++;if(w)converted++;}if(ss.length>=3){deciding++;if(w)decidingWins++;}}
 if(firstSetWins){out.push(stat(player,"first_set_win_to_match_conversion_pct",100*converted/firstSetWins,firstSetWins,surf));out.push(stat(player,"one_set_up_collapse_rate_pct",100*(firstSetWins-converted)/firstSetWins,firstSetWins,surf));}
 if(deciding)out.push(stat(player,"deciding_set_closing_pct",100*decidingWins/deciding,deciding,surf));
 if(cut){const year=cut.slice(0,4),season=rows.filter(m=>m.date.startsWith(year));out.push(stat(player,"season_matches_before_lock",season.length,season.length,surf));const dates=rows.map(m=>Date.parse(`${m.date}T00:00:00Z`)).filter(Number.isFinite).sort((a,b)=>a-b);let maxGap=0;for(let i=1;i<dates.length;i++)maxGap=Math.max(maxGap,(dates[i]-dates[i-1])/86400000);if(dates.length>1)out.push(stat(player,"longest_observed_rest_gap_days",maxGap,dates.length,surf));}
 const recentWins=rows.filter(isWin).slice(-10);const winRanks=recentWins.map(m=>Number(m.loserRank)).filter(Number.isFinite);if(winRanks.length)out.push(stat(player,"recent_win_opponent_rank_mean",winRanks.reduce((a,b)=>a+b,0)/winRanks.length,winRanks.length,surf));
 return out;}
