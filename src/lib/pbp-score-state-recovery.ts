import { buildCanonicalEvidenceMatchIdentity, evidenceTourCompatible, type EvidenceTourFamily } from "./evidence-match-identity";

export type PbpSide = "player1" | "player2";
export type PbpTour = "ATP_MAIN" | "WTA_MAIN" | "ATP_CHALLENGER" | "WTA_CHALLENGER";
// "069" was previously included here to host a Dominance Ratio reconstruction, per the
// pre-Task-20 fictional catalog that assigned code 069 = "Dominance Ratio". The
// authoritative catalog (public/seed/metrics.txt, see authoritative-metric-catalog.ts)
// shows code 069 is actually "Stakes / Career Context" (retirement-tour/farewell-run
// effects, anti-doping testing disruption) -- point-by-point data cannot establish
// either. Removed per the Task 20 reconciliation; see pbp-score-state-recovery.test.ts.
// Code 069 is already correctly handled elsewhere: protected-metric-wiring.server.ts
// requires genuine public retirement/anti-doping reporting for it and forbids
// RECONSTRUCTED entirely (NON_RECONSTRUCTABLE_CONTEXT_CODES), consistent with this
// removal -- it was simply shadowed because this file's (wrong) finding was chosen first.
// "031", "032"(old), "033" were removed: their data (ace rate, double-fault rate, return
// points won %) is already carried inside "002" and "003"'s own value objects (see the
// comment above the removed add() calls in reconstructPbpScoreState). Crediting it again
// under those three codes double-counted the same evidence under mismatched real codes.
//
// Second reconciliation pass (retargeting the remaining mismatched codes):
// - "004" removed: its break-point-conversion data was an exact duplicate of "037"'s (both
//   computed break_chances/break_points_converted/conversion_pct from the same totals); 004
//   is also PROCESS_META (excluded from scoring, see authoritative-metric-catalog.ts), so
//   keeping only 037 loses nothing.
// - "037" retargeted to "032": real 037 is "Win Autopsy Metrics" (unrelated); real 032 is
//   "Point-to-Game Conversion Efficiency", whose own bullet "Break Opportunities Needed per
//   Successful Break" is exactly break-point conversion rate. 032 had no engine before.
// - "026" (hold %) and "027" (break %) removed: real 026 ("Early-Warning / Slow-Start
//   Metrics") and 027 ("Opponent Finishing Ability") both want something more specific
//   (first-service-game hold rate; finishing/closing performance) than a plain aggregate
//   hold/break percentage across the whole match -- crediting the aggregate stat under
//   either would itself be a mismatch, just a smaller one. No other real code's bullets
//   ask for a plain aggregate hold%/break% as such, so these are removed rather than moved.
// - "036" (BP saved %), "038" (BP faced/game), "039" (BP chances/game), "040" (deuce win %)
//   removed: no authoritative code's bullets ask for these exact raw rates either.
// - "070" (breakback rate) and "071"(old, closeout rate) merged into "018": real 018
//   ("Momentum & Closing Metrics") explicitly has both "Performance Following Momentum
//   Events: how a player performs immediately after breaking, being broken..." (breakback)
//   and "Closing Ability: the probability of winning from a one-break-up... or
//   serving-for-match position" (closeout) as its own bullets. 018 had no engine before.
// - "079" (pressure index) retargeted to "053": real 079 is "Additional Differentiating
//   Metrics" (an unrelated grab-bag); real 053 is "Pressure & Clean-Game Metrics", whose
//   entire heading is about exactly this. See historical-results-recovery.ts for the
//   matching removal of 053's old (duplicate, mismatched) content.
// "016" added (NO_SOURCE denominator-eligibility audit): real code 016 is "Point-by-Point &
// Score-State Metrics". Its first two bullets -- "Point-by-Point Sequencing" (pattern
// beyond aggregate totals) and "Score-State Performance" at 0-30/15-30/30-30/Deuce/
// Advantage/Break Point -- are directly derivable from the same chronological point
// sequence and intra-game score replay this file already builds for break-point/deuce
// detection (see the sp/rp score-state variables in the main point loop). The remaining
// bullets (Serve-Direction Patterns, Return Positioning/Depth, Rally-Length Performance,
// Winner/Unforced-Error Differential, Forced-Error Generation, Set-Point/Match-Point
// states) need shot-level data or set/match-level score tracking beyond what this file
// currently replays -- correctly left PARTIAL rather than fabricated or forced.
export const TASK18B_METRIC_CODES = new Set(["009","018","032","002","003","016"]);
export type RecoveredMetric={treatment:"RECONSTRUCTED"|"PARTIAL";value:Record<string,number|string|boolean|null>;raw_fields:string[];transformation:string};
export type PbpRecovery={valid:boolean;reason:string|null;game_count:number;point_count:number;derived:Record<PbpSide,Partial<Record<string,RecoveredMetric>>>;field_support:{server:boolean;point_winner:boolean;score_state:boolean;set_boundary:boolean;ace_indicator:boolean;double_fault_indicator:boolean;serve_number:false;rally_length:false;shot_type:false;shot_placement:false;handedness:false}};

type Point={winner:PbpSide;ace:boolean|null;doubleFault:boolean|null};
type Game={setNo:number|null;server:PbpSide;points:Point[];tiebreak:boolean;winner:PbpSide|null;complete:boolean;postGames:Record<PbpSide,number>|null};
type SideTotals={pointsWon:number;pointsLost:number;servicePoints:number;servicePointsWon:number;returnPoints:number;returnPointsWon:number;serviceGames:number;serviceGamesWon:number;returnGames:number;returnGamesWon:number;breakPointsFaced:number;breakPointsSaved:number;breakChances:number;breakPointsConverted:number;deucePoints:number;deucePointsWon:number;pressurePoints:number;pressurePointsWon:number;aces:number;aceKnownServicePoints:number;doubleFaults:number;doubleFaultKnownServicePoints:number;breakbackOpportunities:number;breakbacks:number;closeoutOpportunities:number;closeouts:number};
const SIDES:PbpSide[]=["player1","player2"];const other=(s:PbpSide):PbpSide=>s==="player1"?"player2":"player1";
const slot=(v:unknown):PbpSide|null=>{const s=String(v??"").trim().toLowerCase().replace(/[\s_-]+/g,"");return["player1","p1","1","home","first"].includes(s)?"player1":["player2","p2","2","away","second"].includes(s)?"player2":null};
const bool=(v:unknown):boolean|null=>typeof v==="boolean"?v:v===1||v==="1"||String(v??"").toLowerCase()==="true"?true:v===0||v==="0"||String(v??"").toLowerCase()==="false"?false:null;
function codedIndicator(p:any,kind:"ace"|"doubleFault"){const explicit=kind==="ace"?bool(p?.ace??p?.is_ace):bool(p?.double_fault??p?.doubleFault??p?.is_double_fault);if(explicit!==null)return explicit;const coded=[p?.code,p?.point_code,p?.pointCode,p?.label].filter(v=>v!==null&&v!==undefined&&String(v).trim()).join(" ").toLowerCase();if(!coded)return null;return kind==="ace"?/(^|\W)ace($|\W)/.test(coded):/double[ _-]?fault|(^|\W)df($|\W)/.test(coded)}
function explicitSetNo(v:any):number|null{for(const x of[v?.set_number,v?.setNumber,v?.set_no,v?.setNo,v?.set_index,v?.setIndex]){const n=Number(x);if(Number.isInteger(n)&&n>=0)return n===0?1:n}return null}
function postGames(v:any):Record<PbpSide,number>|null{const a=Number(v?.player1_games),b=Number(v?.player2_games);return Number.isInteger(a)&&a>=0&&Number.isInteger(b)&&b>=0?{player1:a,player2:b}:null}
function inferTiebreak(v:any,winner:PbpSide|null,post:Record<PbpSide,number>|null){if(bool(v?.tiebreak??v?.tie_break??v?.is_tiebreak??v?.isTieBreak)===true)return true;if(!winner||!post)return false;const pre={...post};pre[winner]-=1;return pre.player1===6&&pre.player2===6}
function collectGames(payload:any):Game[]{const out:Game[]=[];const seen=new Set<any>();const walk=(v:any,ctx:{setNo:number|null})=>{if(!v||typeof v!=="object"||seen.has(v))return;seen.add(v);if(Array.isArray(v)){for(const x of v)walk(x,ctx);return}if(Array.isArray(v.points)){const server=slot(v.server??v.server_slot??v.serving_player??v.servingPlayer);if(server){const points:Point[]=[];let complete=v.points.length>0;for(const p of v.points){if(!p||typeof p!=="object"){complete=false;continue}const winner=slot(p.winner??p.point_winner??p.pointWinner??p.winner_slot??p.won_by);if(!winner){complete=false;continue}points.push({winner,ace:codedIndicator(p,"ace"),doubleFault:codedIndicator(p,"doubleFault")})}const winner=slot(v.winner??v.game_winner??v.gameWinner??v.winner_slot),post=postGames(v);if(points.length)out.push({setNo:explicitSetNo(v)??ctx.setNo,server,points,tiebreak:inferTiebreak(v,winner,post),winner,complete:complete&&points.length===v.points.length,postGames:post})}}for(const[k,x]of Object.entries(v)){if(k==="points")continue;if(Array.isArray(x)&&/sets?/i.test(k)){x.forEach((item,i)=>walk(item,{setNo:i+1}));continue}walk(x,{setNo:explicitSetNo(v)??ctx.setNo})}};walk(payload,{setNo:null});return out}
function gameWinner(g:Game):PbpSide|null{if(!g.complete)return null;if(g.winner)return g.winner;if(g.tiebreak)return null;let a=0,b=0;for(const p of g.points){if(p.winner==="player1")a++;else b++;if((a>=4||b>=4)&&Math.abs(a-b)>=2)return a>b?"player1":"player2"}return null}
function wouldWinGame(s0:number,r0:number,w:"server"|"returner"){const s=s0+(w==="server"?1:0),r=r0+(w==="returner"?1:0);return(s>=4||r>=4)&&Math.abs(s-r)>=2}
function wouldWinSet(ownGames:number,oppGames:number){const own=ownGames+1;return(own>=6&&own-oppGames>=2)||own===7}
// Standard non-tiebreak intra-game score labels, oriented "my points-their points" (mine
// first). Deuce/Advantage only apply once both sides have reached at least 3 points;
// anything else pre-deuce maps cleanly onto 0/15/30/40.
function scoreLabel(n:number){return n===0?"0":n===1?"15":n===2?"30":"40"}
function stateLabelFor(mine:number,theirs:number):string|null{if(mine>=3&&theirs>=3){if(mine===theirs)return"Deuce";if(mine-theirs===1)return"Advantage";return null}if(mine>3||theirs>3)return null;return`${scoreLabel(mine)}-${scoreLabel(theirs)}`}
const pct=(n:number,d:number):number|null=>d>0?Number((100*n/d).toFixed(4)):null;const ratio=(n:number,d:number):number|null=>d>0?Number((n/d).toFixed(4)):null;
function emptyTotals():SideTotals{return{pointsWon:0,pointsLost:0,servicePoints:0,servicePointsWon:0,returnPoints:0,returnPointsWon:0,serviceGames:0,serviceGamesWon:0,returnGames:0,returnGamesWon:0,breakPointsFaced:0,breakPointsSaved:0,breakChances:0,breakPointsConverted:0,deucePoints:0,deucePointsWon:0,pressurePoints:0,pressurePointsWon:0,aces:0,aceKnownServicePoints:0,doubleFaults:0,doubleFaultKnownServicePoints:0,breakbackOpportunities:0,breakbacks:0,closeoutOpportunities:0,closeouts:0}}
export function canonicalPbpMatchIdentity(args:{tour:PbpTour;player1:string;player2:string;tournament?:string|null;date?:string|null;round?:string|null;eventLevel?:string|null}){const identity=buildCanonicalEvidenceMatchIdentity({player1Name:args.player1,player2Name:args.player2,tournament:args.tournament,date:args.date,round:args.round,tour:args.tour,eventLevel:args.eventLevel});return evidenceTourCompatible(args.tour as EvidenceTourFamily,identity.tourFamily)?identity:null}

export function reconstructPbpScoreState(payload:any):PbpRecovery{
 const games=collectGames(payload),pointCount=games.reduce((n,g)=>n+g.points.length,0),hasSetBoundaries=games.length>0&&games.every(g=>Number.isInteger(g.setNo)),winners=games.map(gameWinner),allGameWinners=games.length>0&&winners.every(Boolean),allPointsComplete=games.length>0&&games.every(g=>g.complete);
 const fieldSupport={server:games.length>0,point_winner:pointCount>0,score_state:allGameWinners&&allPointsComplete,set_boundary:hasSetBoundaries,ace_indicator:false,double_fault_indicator:false,serve_number:false as const,rally_length:false as const,shot_type:false as const,shot_placement:false as const,handedness:false as const};
 if(!games.length||!pointCount||!allGameWinners||!allPointsComplete)return{valid:false,reason:"PBP lacks a complete server/point-winner game structure; incomplete points or ambiguous game outcomes are not credited.",game_count:games.length,point_count:pointCount,derived:{player1:{},player2:{}},field_support:fieldSupport};
 const totals:Record<PbpSide,SideTotals>={player1:emptyTotals(),player2:emptyTotals()},setGames=new Map<number,Record<PbpSide,number>>();let previousGame:{setNo:number;brokenPlayer:PbpSide}|null=null;
 const stateTallies:Record<PbpSide,Record<string,{wins:number;total:number}>>={player1:{},player2:{}};
 const recordState=(side:PbpSide,label:string,won:boolean)=>{const bucket=stateTallies[side];bucket[label]??={wins:0,total:0};bucket[label].total++;if(won)bucket[label].wins++};
 const streak:Record<PbpSide,{cur:number;longest:number}>={player1:{cur:0,longest:0},player2:{cur:0,longest:0}};
 for(let gi=0;gi<games.length;gi++){const g=games[gi],server=g.server,returner=other(server),winner=winners[gi]!,st=totals[server],rt=totals[returner];st.serviceGames++;rt.returnGames++;if(winner===server)st.serviceGamesWon++;else rt.returnGamesWon++;let sp=0,rp=0;for(const p of g.points){totals[p.winner].pointsWon++;totals[other(p.winner)].pointsLost++;st.servicePoints++;rt.returnPoints++;if(p.winner===server)st.servicePointsWon++;else rt.returnPointsWon++;streak[p.winner].cur++;streak[p.winner].longest=Math.max(streak[p.winner].longest,streak[p.winner].cur);streak[other(p.winner)].cur=0;if(p.ace!==null){fieldSupport.ace_indicator=true;st.aceKnownServicePoints++;if(p.ace)st.aces++}if(p.doubleFault!==null){fieldSupport.double_fault_indicator=true;st.doubleFaultKnownServicePoints++;if(p.doubleFault)st.doubleFaults++}if(!g.tiebreak){const bp=wouldWinGame(sp,rp,"returner"),deuce=sp>=3&&rp>=3&&sp===rp;const serverLabel=stateLabelFor(sp,rp),returnerLabel=stateLabelFor(rp,sp);if(serverLabel)recordState(server,serverLabel,p.winner===server);if(returnerLabel)recordState(returner,returnerLabel,p.winner===returner);if(bp){recordState(server,"Break Point",p.winner===server);recordState(returner,"Break Point",p.winner===returner)}if(bp){st.breakPointsFaced++;rt.breakChances++;if(p.winner===server)st.breakPointsSaved++;else rt.breakPointsConverted++}if(deuce){st.deucePoints++;rt.deucePoints++;if(p.winner===server)st.deucePointsWon++;else rt.deucePointsWon++}if(bp||deuce){st.pressurePoints++;rt.pressurePoints++;if(p.winner===server)st.pressurePointsWon++;else rt.pressurePointsWon++}if(p.winner===server)sp++;else rp++}else{st.pressurePoints++;rt.pressurePoints++;if(p.winner===server)st.pressurePointsWon++;else rt.pressurePointsWon++}}
  if(hasSetBoundaries){const sn=g.setNo!,score=setGames.get(sn)??{player1:0,player2:0};if(previousGame&&previousGame.setNo===sn&&previousGame.brokenPlayer===returner){totals[returner].breakbackOpportunities++;if(winner===returner)totals[returner].breakbacks++}if(wouldWinSet(score[server],score[returner])){st.closeoutOpportunities++;if(winner===server)st.closeouts++}previousGame=winner===returner?{setNo:sn,brokenPlayer:server}:null;score[winner]++;if(g.postGames&&(score.player1!==g.postGames.player1||score.player2!==g.postGames.player2))return{valid:false,reason:"PBP game counters conflict with reconstructed chronological game state.",game_count:games.length,point_count:pointCount,derived:{player1:{},player2:{}},field_support:fieldSupport};setGames.set(sn,score)}}
 const derived:Record<PbpSide,Partial<Record<string,RecoveredMetric>>>={player1:{},player2:{}};
 for(const s of SIDES){const t=totals[s],add=(code:string,treatment:"RECONSTRUCTED"|"PARTIAL",value:RecoveredMetric["value"],raw:string[],transform:string)=>{derived[s][code]={treatment,value,raw_fields:raw,transformation:transform}};
  add("002","PARTIAL",{service_points:t.servicePoints,service_points_won:t.servicePointsWon,service_point_win_pct:pct(t.servicePointsWon,t.servicePoints),aces:fieldSupport.ace_indicator?t.aces:null,double_faults:fieldSupport.double_fault_indicator?t.doubleFaults:null,serve_number_available:false},["server","point_winner","ace/DF only when encoded"],"Aggregate objective service-point outcomes; serve-number dimensions remain unavailable.");
  add("003","PARTIAL",{return_points:t.returnPoints,return_points_won:t.returnPointsWon,return_point_win_pct:pct(t.returnPointsWon,t.returnPoints),serve_number_available:false},["server","point_winner"],"Orient each point to the non-server; serve-number splits are not inferred.");
  add("009","PARTIAL",{pressure_points:t.pressurePoints,pressure_points_won:t.pressurePointsWon,pressure_win_pct:pct(t.pressurePointsWon,t.pressurePoints),set_boundaries:hasSetBoundaries},["server","chronological point_winner","set boundary when encoded"],"Break-point/deuce/tiebreak pressure is deterministic; the full deciding/late-set contract is not broadened beyond encoded state.");
  add("032","PARTIAL",{break_chances:t.breakChances,break_points_converted:t.breakPointsConverted,bp_converted_pct:pct(t.breakPointsConverted,t.breakChances)},["server","chronological point_winner"],"Replay score and count return-side break chances converted -- only \"break opportunities per successful break\" of this composite metric's 10 named sub-components (see COMPOSITE_COMPONENTS[\"032\"] in validated-completion-research.server.ts) is covered by deterministic replay; points-to-games/sets expectation modeling, deuce-game win rate, and 0-30/15-30/30-0/40-15 game-state splits are not built here, so treatment is corrected to PARTIAL rather than the composite's full RECONSTRUCTED bar. Retargeted from the mismatched code 037/004 to real code 032 (\"Point-to-Game Conversion Efficiency\").");
  if(hasSetBoundaries){add("018","RECONSTRUCTED",{breakback_opportunities:t.breakbackOpportunities,breakbacks:t.breakbacks,breakback_rate_pct:pct(t.breakbacks,t.breakbackOpportunities),closeout_opportunities:t.closeoutOpportunities,closeouts:t.closeouts,closeout_rate_pct:pct(t.closeouts,t.closeoutOpportunities)},["server","game winner","set boundary","chronological game order"],"Grade the immediate return game after being broken (breakback) and serving-for-set closeouts within the same set. Retargeted from the mismatched codes 070/071 to real code 018 (\"Momentum & Closing Metrics\"), whose own bullets name both \"Performance Following Momentum Events\" (breaking/being broken) and \"Closing Ability\" (serving-for-match/set position).")}
  add("053","PARTIAL",{pressure_points:t.pressurePoints,pressure_points_won:t.pressurePointsWon,pressure_index_pct:pct(t.pressurePointsWon,t.pressurePoints),set_boundaries:hasSetBoundaries},["server","chronological point_winner","set boundary when encoded"],"Covers only \"pressure accumulation score\" of this composite metric's 6 named sub-components (see COMPOSITE_COMPONENTS[\"053\"] in validated-completion-research.server.ts); serve-escape dependency, clean-hold/clean-break rate, love/15 hold rate, and return-game abandonment rate are not computed here, so treatment stays PARTIAL. Retargeted from the mismatched code 079 to real code 053 (\"Pressure & Clean-Game Metrics\").");
  const states=stateTallies[s],stateEntries=Object.entries(states).filter(([,v])=>v.total>0).map(([label,v])=>[label,{n:v.total,win_pct:pct(v.wins,v.total)}]);
  add("016","PARTIAL",{longest_point_win_streak:streak[s].longest,score_state_performance_json:stateEntries.length?JSON.stringify(Object.fromEntries(stateEntries)):null},["server","chronological point_winner"],"Replay the intra-game score point-by-point to tag each point's pre-point state (0-30/15-30/30-30/Deuce/Advantage/Break Point) and the match-wide longest point-win streak; only states actually reached are reported, none are zero-filled. Serve-direction, return positioning/depth, rally-length, winner/unforced-error, and set-point/match-point bullets require shot-level or set/match-score tracking this file does not build, so treatment stays PARTIAL.");
 }
 return{valid:true,reason:null,game_count:games.length,point_count:pointCount,derived,field_support:fieldSupport};
}
export function metricHasRequiredPbpFields(recovery:PbpRecovery,code:string,side:PbpSide){return Boolean(recovery.valid&&recovery.derived[side][code])}
