import { readFileSync } from "node:fs";
import { join } from "node:path";

const SOURCE_URL = "https://www.kaggle.com/datasets/predixsport/sports-elo-ratings";
type CsvRow = Record<string, string>;
type Fields = Record<string, string | null>;
let atpCache: CsvRow[] | null = null;
let wtaCache: CsvRow[] | null = null;

function norm(v: string) { return v.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }
function usable(v:string|null|undefined){const s=String(v??"").trim();if(!s)return null;const n=norm(s);if(/^(unavailable|unknown|n a|na|null|none|-)$/.test(n))return null;return s;}
function nameTokens(v:string){return norm(v).split(" ").filter(Boolean);}
function samePlayerName(input:string,candidate:string){const a=nameTokens(input),b=nameTokens(candidate);if(!a.length||!b.length)return false;if(a.join(" ")===b.join(" "))return true;if(a[a.length-1]!==b[b.length-1])return false;if(a.length===1)return true;const bs=new Set(b);return a.every(t=>bs.has(t));}
function parseCsv(text: string): CsvRow[] {const rows:string[][]=[];let row:string[]=[],cell="",quoted=false;for(let i=0;i<text.length;i++){const ch=text[i];if(ch==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(ch===","&&!quoted){row.push(cell);cell="";}else if((ch==="\n"||ch==="\r")&&!quoted){if(ch==="\r"&&text[i+1]==="\n")i++;row.push(cell);cell="";if(row.some(Boolean))rows.push(row);row=[];}else cell+=ch;}if(cell.length||row.length){row.push(cell);rows.push(row);}if(!rows.length)return[];const headers=rows[0].map(h=>h.trim());return rows.slice(1).map(c=>Object.fromEntries(headers.map((h,i)=>[h,(c[i]??"").trim()])));}
function load(tour:"ATP"|"WTA"){if(tour==="ATP"&&atpCache)return atpCache;if(tour==="WTA"&&wtaCache)return wtaCache;const rel=tour==="ATP"?"data/public/predixsport/atp/atp_elo_matches.csv":"data/public/predixsport/wta/wta_elo_ratings.csv";try{const rows=parseCsv(readFileSync(join(process.cwd(),rel),"utf8"));if(tour==="ATP")atpCache=rows;else wtaCache=rows;return rows;}catch{return[];}}
function cleanTournament(v:string|null|undefined){const good=usable(v);if(!good)return null;const raw=good.replace(/^\$?[\d,]+\s*(?:vol(?:ume)?)?\s*/i,"").trim();const n=norm(raw);if(/cincinn/.test(n))return"Cincinnati Open";if(/montreal|canadian open|rogers cup/.test(n))return"Canadian Open";if(/us open/.test(n))return"US Open";return raw||null;}
function hintTournament(hints:Fields){return cleanTournament(hints.tournament??hints.event??null);}
function hintDate(hints:Fields){const v=usable(hints.scheduled_date??hints.date??null);if(!v)return null;const iso=v.match(/20\d{2}-\d{2}-\d{2}/)?.[0];if(iso)return iso;const today=new Date().toISOString().slice(0,10);if(/\btoday\b/i.test(v))return today;const tomorrow=new Date(Date.now()+86400000).toISOString().slice(0,10);if(/\btomorrow\b/i.test(v))return tomorrow;return null;}
function normalizeRound(v:string|null|undefined){const good=usable(v);if(!good)return null;const s=norm(good);if(/quarter/.test(s))return"Quarterfinals";if(/semi/.test(s))return"Semifinals";if(/^final/.test(s))return"Final";if(/round of 16|2nd round|second round/.test(s))return"Round of 16";if(/round of 32|1st round|first round/.test(s))return"Round of 32";if(/round of 64/.test(s))return"Round of 64";return good;}
function eventLevelFromRow(row:CsvRow):string|null{const raw=row.tournament_type||row.event_level||row.level||"";if(/challenger/i.test(raw)||/challenger/i.test(row.tournament||""))return"Challenger";if(/grand.?slam|slam/i.test(raw))return"Grand Slam";if(/masters.?1000|1000/i.test(raw))return"Masters 1000";if(/atp.?500|500/i.test(raw))return"ATP 500";if(/atp.?250|250/i.test(raw))return"ATP 250";if(/wta.?1000|1000/i.test(raw))return"WTA 1000";if(/wta.?500|500/i.test(raw))return"WTA 500";if(/wta.?250|250/i.test(raw))return"WTA 250";if(/itf/i.test(raw))return"ITF";return usable(raw);}
function bestOfFromContext(level:string|null,tournament:string|null,tour:"ATP"|"WTA"){if(tour==="WTA")return"3";if(/grand slam/i.test(level??"")||/wimbledon|roland garros|french open|us open|australian open/i.test(tournament??""))return"5";if(level||tournament)return"3";return null;}
function playerSeen(rows:CsvRow[],player:string){return rows.some(r=>samePlayerName(player,r.player||"")||samePlayerName(player,r.opponent||""));}
function inferTour(p1:string,p2:string):"ATP"|"WTA"|null{const a=load("ATP"),w=load("WTA");const as=playerSeen(a,p1)&&playerSeen(a,p2),ws=playerSeen(w,p1)&&playerSeen(w,p2);return as&&!ws?"ATP":ws&&!as?"WTA":null;}
function registryContext(tournament:string|null,tour:"ATP"|"WTA"|null):Fields{const n=norm(tournament??"");if(/cincinnati/.test(n)){return{tournament:"Cincinnati Open",event_level:tour==="WTA"?"WTA 1000":tour==="ATP"?"Masters 1000":null,round:null,scheduled_date:null,surface:"Hard",best_of:"3"};}return{tournament:null,event_level:null,round:null,scheduled_date:null,surface:null,best_of:null};}
function findPair(rows:CsvRow[],p1:string,p2:string,hints:Fields):CsvRow|null{const ht=norm(hintTournament(hints)??""),hd=hintDate(hints);const candidates=rows.filter(r=>{const rp=r.player||"",ro=r.opponent||"";return(samePlayerName(p1,rp)&&samePlayerName(p2,ro))||(samePlayerName(p1,ro)&&samePlayerName(p2,rp));});if(!candidates.length)return null;const scored=candidates.map(r=>{let score=0;if(hd&&r.date===hd)score+=100;const rt=norm(r.tournament||"");if(ht&&(rt===ht||rt.includes(ht)||ht.includes(rt)||(/cincinnati/.test(ht)&&/cincinnati/.test(rt))))score+=50;return{r,score};}).sort((a,b)=>b.score-a.score||(b.r.date||"").localeCompare(a.r.date||""));if(scored.length===1)return scored[0].r;if(scored[0].score>=50&&scored[0].score>scored[1].score)return scored[0].r;return null;}

export function resolveLocalMatchContext(p1:string,p2:string,hints:Fields){
  const inferredTour=inferTour(p1,p2);const atp=findPair(load("ATP"),p1,p2,hints);const wta=atp?null:findPair(load("WTA"),p1,p2,hints);const direct=atp??wta;const tour:"ATP"|"WTA"|null=atp?"ATP":wta?"WTA":inferredTour;
  const hintedTournament=hintTournament(hints);const tournament=cleanTournament(direct?.tournament)??hintedTournament;const registry=registryContext(tournament,tour);
  const hintedSurface=usable(hints.surface);const hintedLevel=usable(hints.event_level);const hintedBestOf=usable(hints.best_of);
  const surface=(usable(direct?.surface)||hintedSurface||registry.surface||null)?.trim()||null;
  const round=normalizeRound(usable(direct?.round)||usable(hints.round));
  const date=usable(direct?.date)||hintDate(hints)||null;
  const level=direct?eventLevelFromRow(direct):(hintedLevel??registry.event_level??null);
  const fields:Fields={tournament:registry.tournament??tournament,event_level:level,round,scheduled_date:date,surface,best_of:hintedBestOf??registry.best_of??bestOfFromContext(level,tournament,tour??"ATP")};
  const any=Object.values(fields).some(Boolean),matchSpecific=!!direct;
  const sources:string[]=[];if(matchSpecific)sources.push("PredixSport exact player-pair match record");if(registry.tournament)sources.push("Static tournament context registry");if(inferredTour)sources.push("Local player-tour identity history");
  return{ok:any,fields,sources,sourceUrl:matchSpecific?SOURCE_URL:null,unresolvedReason:matchSpecific?null:"No unique exact player-pair match record; only independently stable tournament context was filled"};
}
