import { readFileSync } from "node:fs";
import { join } from "node:path";

const SOURCE_URL = "https://www.kaggle.com/datasets/predixsport/sports-elo-ratings";
type CsvRow = Record<string, string>;
type Fields = Record<string, string | null>;
let atpCache: CsvRow[] | null = null;
let wtaCache: CsvRow[] | null = null;

function norm(v: string) { return v.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }
function nameTokens(v:string){return norm(v).split(" ").filter(Boolean);}
function samePlayerName(input:string,candidate:string){const a=nameTokens(input),b=nameTokens(candidate);if(!a.length||!b.length)return false;if(a.join(" ")===b.join(" "))return true;if(a[a.length-1]!==b[b.length-1])return false;if(a.length===1)return true;const bs=new Set(b);return a.every(t=>bs.has(t));}
function parseCsv(text: string): CsvRow[] {const rows:string[][]=[];let row:string[]=[],cell="",quoted=false;for(let i=0;i<text.length;i++){const ch=text[i];if(ch==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(ch===","&&!quoted){row.push(cell);cell="";}else if((ch==="\n"||ch==="\r")&&!quoted){if(ch==="\r"&&text[i+1]==="\n")i++;row.push(cell);cell="";if(row.some(Boolean))rows.push(row);row=[];}else cell+=ch;}if(cell.length||row.length){row.push(cell);rows.push(row);}if(!rows.length)return[];const headers=rows[0].map(h=>h.trim());return rows.slice(1).map(c=>Object.fromEntries(headers.map((h,i)=>[h,(c[i]??"").trim()])));}
function load(tour:"ATP"|"WTA"){if(tour==="ATP"&&atpCache)return atpCache;if(tour==="WTA"&&wtaCache)return wtaCache;const rel=tour==="ATP"?"data/public/predixsport/atp/atp_elo_matches.csv":"data/public/predixsport/wta/wta_elo_ratings.csv";try{const rows=parseCsv(readFileSync(join(process.cwd(),rel),"utf8"));if(tour==="ATP")atpCache=rows;else wtaCache=rows;return rows;}catch{return[];}}
function cleanTournament(v:string|null|undefined){if(!v)return null;return v.replace(/^\$?[\d,]+\s*(?:vol(?:ume)?)?\s*/i,"").trim()||null;}
function hintTournament(hints:Fields){return cleanTournament(hints.tournament??hints.event??null);}
function hintDate(hints:Fields){const v=hints.scheduled_date??hints.date??null;if(!v)return null;return String(v).match(/20\d{2}-\d{2}-\d{2}/)?.[0]??null;}
function normalizeRound(v:string|null|undefined){if(!v)return null;const s=norm(v);if(/quarter/.test(s))return"Quarterfinals";if(/semi/.test(s))return"Semifinals";if(/^final/.test(s))return"Final";if(/round of 16|2nd round|second round/.test(s))return"Round of 16";if(/round of 32|1st round|first round/.test(s))return"Round of 32";if(/round of 64/.test(s))return"Round of 64";return v.trim();}
function eventLevelFromRow(row:CsvRow):string|null{const raw=row.tournament_type||row.event_level||row.level||"";if(/challenger/i.test(raw)||/challenger/i.test(row.tournament||""))return"Challenger";if(/grand.?slam|slam/i.test(raw))return"Grand Slam";if(/masters.?1000|1000/i.test(raw))return"Masters 1000";if(/atp.?500|500/i.test(raw))return"ATP 500";if(/atp.?250|250/i.test(raw))return"ATP 250";if(/wta.?1000|1000/i.test(raw))return"WTA 1000";if(/wta.?500|500/i.test(raw))return"WTA 500";if(/wta.?250|250/i.test(raw))return"WTA 250";if(/itf/i.test(raw))return"ITF";return raw.trim()||null;}
function bestOfFromContext(level:string|null,tournament:string|null,tour:"ATP"|"WTA"):string|null{if(tour==="WTA")return"3";if(/grand slam/i.test(level??"")||/wimbledon|roland garros|french open|us open|australian open/i.test(tournament??""))return"5";if(level||tournament)return"3";return null;}

function findPair(rows:CsvRow[],p1:string,p2:string,hints:Fields):CsvRow|null{const ht=norm(hintTournament(hints)??""),hd=hintDate(hints);const candidates=rows.filter(r=>{const rp=r.player||"",ro=r.opponent||"";return(samePlayerName(p1,rp)&&samePlayerName(p2,ro))||(samePlayerName(p1,ro)&&samePlayerName(p2,rp));});if(!candidates.length)return null;const scored=candidates.map(r=>{let score=0;if(hd&&r.date===hd)score+=100;const rt=norm(r.tournament||"");if(ht&&(rt===ht||rt.includes(ht)||ht.includes(rt)))score+=50;return{r,score};}).sort((a,b)=>b.score-a.score||(b.r.date||"").localeCompare(a.r.date||""));if(scored.length===1)return scored[0].r;if(scored[0].score>=50&&scored[0].score>scored[1].score)return scored[0].r;return null;}

export function resolveLocalMatchContext(p1:string,p2:string,hints:Fields){
  const atp=findPair(load("ATP"),p1,p2,hints);const wta=atp?null:findPair(load("WTA"),p1,p2,hints);const direct=atp??wta;const tour:"ATP"|"WTA"|null=atp?"ATP":wta?"WTA":null;
  const hintedTournament=hintTournament(hints);const tournament=cleanTournament(direct?.tournament)??hintedTournament;
  // Critical rule: never infer surface/round/date from tournament-name history alone.
  // These fields must come from this exact resolved physical match or an explicit PDF hint.
  const surface=(direct?.surface||hints.surface||null)?.trim()||null;
  const round=normalizeRound(direct?.round||hints.round||null);
  const date=direct?.date||hintDate(hints)||null;
  const level=direct?eventLevelFromRow(direct):(hints.event_level??null);
  const fields:Fields={tournament,event_level:level,round,scheduled_date:date,surface,best_of:hints.best_of??bestOfFromContext(level,tournament,tour??"ATP")};
  const any=Object.values(fields).some(Boolean), matchSpecific=!!direct;
  return{ok:any,fields,sources:matchSpecific?["PredixSport exact player-pair match record"]:[],sourceUrl:matchSpecific?SOURCE_URL:null,unresolvedReason:matchSpecific?null:"No unique exact player-pair match record; ambiguous context left unresolved"};
}
