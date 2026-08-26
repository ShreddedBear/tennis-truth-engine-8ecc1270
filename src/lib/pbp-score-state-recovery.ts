import { buildCanonicalEvidenceMatchIdentity, evidenceTourCompatible, type EvidenceTourFamily } from "./evidence-match-identity";

export type PbpSide = "player1" | "player2";
export type PbpTour = "ATP_MAIN" | "WTA_MAIN" | "ATP_CHALLENGER" | "WTA_CHALLENGER";

export const TASK18B_METRIC_CODES = new Set([
  "004","009","026","027","031","032","033","036","037","038","039","040","069","070","071","079","002","003",
]);

export type RecoveredMetric = {
  treatment: "RECONSTRUCTED" | "PARTIAL";
  value: Record<string, number | string | boolean | null>;
  raw_fields: string[];
  transformation: string;
};

export type PbpRecovery = {
  valid: boolean;
  reason: string | null;
  game_count: number;
  point_count: number;
  derived: Record<PbpSide, Partial<Record<string, RecoveredMetric>>>;
  field_support: {
    server: boolean;
    point_winner: boolean;
    score_state: boolean;
    set_boundary: boolean;
    ace_indicator: boolean;
    double_fault_indicator: boolean;
    serve_number: false;
    rally_length: false;
    shot_type: false;
    shot_placement: false;
    handedness: false;
  };
};

type Point = { winner: PbpSide; ace: boolean | null; doubleFault: boolean | null };
type Game = { setNo: number | null; server: PbpSide; points: Point[]; tiebreak: boolean; winner: PbpSide | null };
type SideTotals = {
  pointsWon:number; pointsLost:number; servicePoints:number; servicePointsWon:number; returnPoints:number; returnPointsWon:number;
  serviceGames:number; serviceGamesWon:number; returnGames:number; returnGamesWon:number;
  breakPointsFaced:number; breakPointsSaved:number; breakChances:number; breakPointsConverted:number;
  deucePoints:number; deucePointsWon:number; pressurePoints:number; pressurePointsWon:number;
  aces:number; aceKnownServicePoints:number; doubleFaults:number; doubleFaultKnownServicePoints:number;
  breakbackOpportunities:number; breakbacks:number; closeoutOpportunities:number; closeouts:number;
};

const SIDES: PbpSide[] = ["player1","player2"];
const other = (side:PbpSide):PbpSide => side === "player1" ? "player2" : "player1";
const slot = (value:unknown):PbpSide|null => {
  const s=String(value??"").trim().toLowerCase().replace(/[\s_-]+/g,"");
  if(["player1","p1","1","home","first"].includes(s))return"player1";
  if(["player2","p2","2","away","second"].includes(s))return"player2";
  return null;
};
const bool=(value:unknown):boolean|null=>typeof value==="boolean"?value:value===1||value==="1"||String(value??"").toLowerCase()==="true"?true:value===0||value==="0"||String(value??"").toLowerCase()==="false"?false:null;

function codedIndicator(point:any,kind:"ace"|"doubleFault"){
  const explicit=kind==="ace"?bool(point?.ace??point?.is_ace):bool(point?.double_fault??point?.doubleFault??point?.is_double_fault);
  if(explicit!==null)return explicit;
  const coded=[point?.code,point?.point_code,point?.pointCode,point?.label].filter(v=>v!==null&&v!==undefined&&String(v).trim()).join(" ").toLowerCase();
  if(!coded)return null;
  return kind==="ace"?/(^|\W)ace($|\W)/.test(coded):/double[ _-]?fault|(^|\W)df($|\W)/.test(coded);
}
function explicitSetNo(v:any):number|null{for(const x of[v?.set_number,v?.setNumber,v?.set_no,v?.setNo,v?.set_index,v?.setIndex]){const n=Number(x);if(Number.isInteger(n)&&n>=0)return n===0?1:n;}return null;}
function isTiebreak(v:any){return bool(v?.tiebreak??v?.tie_break??v?.is_tiebreak??v?.isTieBreak)===true;}

function collectGames(payload:any):Game[]{
  const out:Game[]=[];const seen=new Set<any>();
  const walk=(v:any,ctx:{setNo:number|null})=>{
    if(!v||typeof v!=="object"||seen.has(v))return;seen.add(v);
    if(Array.isArray(v)){for(const x of v)walk(x,ctx);return;}
    if(Array.isArray(v.points)){
      const server=slot(v.server??v.server_slot??v.serving_player??v.servingPlayer);
      if(server){
        const points:Point[]=[];
        for(const p of v.points){if(!p||typeof p!=="object")continue;const winner=slot(p.winner??p.point_winner??p.pointWinner??p.winner_slot??p.won_by);if(!winner)continue;points.push({winner,ace:codedIndicator(p,"ace"),doubleFault:codedIndicator(p,"doubleFault")});}
        if(points.length)out.push({setNo:explicitSetNo(v)??ctx.setNo,server,points,tiebreak:isTiebreak(v),winner:slot(v.winner??v.game_winner??v.gameWinner??v.winner_slot)});
      }
    }
    for(const[k,x]of Object.entries(v)){
      if(k==="points")continue;
      if(Array.isArray(x)&&/sets?/i.test(k)){x.forEach((item,i)=>walk(item,{setNo:i+1}));continue;}
      walk(x,{setNo:explicitSetNo(v)??ctx.setNo});
    }
  };
  walk(payload,{setNo:null});return out;
}

function gameWinner(game:Game):PbpSide|null{
  if(game.winner)return game.winner;
  if(game.tiebreak)return null;
  let a=0,b=0;
  for(const point of game.points){if(point.winner==="player1")a++;else b++;if((a>=4||b>=4)&&Math.abs(a-b)>=2)return a>b?"player1":"player2";}
  return null;
}
function wouldWinGame(serverPts:number,returnPts:number,winner:"server"|"returner"){
  const s=serverPts+(winner==="server"?1:0),r=returnPts+(winner==="returner"?1:0);return(s>=4||r>=4)&&Math.abs(s-r)>=2;
}
function wouldWinSet(ownGames:number,oppGames:number){const own=ownGames+1;return(own>=6&&own-oppGames>=2)||own===7;}
const pct=(n:number,d:number):number|null=>d>0?Number((100*n/d).toFixed(4)):null;
const ratio=(n:number,d:number):number|null=>d>0?Number((n/d).toFixed(4)):null;
function emptyTotals():SideTotals{return{pointsWon:0,pointsLost:0,servicePoints:0,servicePointsWon:0,returnPoints:0,returnPointsWon:0,serviceGames:0,serviceGamesWon:0,returnGames:0,returnGamesWon:0,breakPointsFaced:0,breakPointsSaved:0,breakChances:0,breakPointsConverted:0,deucePoints:0,deucePointsWon:0,pressurePoints:0,pressurePointsWon:0,aces:0,aceKnownServicePoints:0,doubleFaults:0,doubleFaultKnownServicePoints:0,breakbackOpportunities:0,breakbacks:0,closeoutOpportunities:0,closeouts:0};}

export function canonicalPbpMatchIdentity(args:{tour:PbpTour;player1:string;player2:string;tournament?:string|null;date?:string|null;round?:string|null;eventLevel?:string|null}){
  const identity=buildCanonicalEvidenceMatchIdentity({player1Name:args.player1,player2Name:args.player2,tournament:args.tournament,date:args.date,round:args.round,tour:args.tour,eventLevel:args.eventLevel});
  const expected=args.tour as EvidenceTourFamily;
  return evidenceTourCompatible(expected,identity.tourFamily)?identity:null;
}

export function reconstructPbpScoreState(payload:any):PbpRecovery{
  const games=collectGames(payload);const pointCount=games.reduce((n,g)=>n+g.points.length,0);const hasSetBoundaries=games.length>0&&games.every(g=>Number.isInteger(g.setNo));const winners=games.map(gameWinner);const allGameWinners=games.length>0&&winners.every(Boolean);
  const fieldSupport={server:games.length>0,point_winner:pointCount>0,score_state:allGameWinners,set_boundary:hasSetBoundaries,ace_indicator:false,double_fault_indicator:false,serve_number:false as const,rally_length:false as const,shot_type:false as const,shot_placement:false as const,handedness:false as const};
  if(!games.length||!pointCount||!allGameWinners)return{valid:false,reason:"PBP lacks a complete server/point-winner game structure; no score-state metrics are credited.",game_count:games.length,point_count:pointCount,derived:{player1:{},player2:{}},field_support:fieldSupport};

  const totals:Record<PbpSide,SideTotals>={player1:emptyTotals(),player2:emptyTotals()};
  const setGames=new Map<number,Record<PbpSide,number>>();
  let previousGame:{setNo:number;brokenPlayer:PbpSide}|null=null;

  for(let gi=0;gi<games.length;gi++){
    const game=games[gi],server=game.server,returner=other(server),winner=winners[gi]!;const st=totals[server],rt=totals[returner];
    st.serviceGames++;rt.returnGames++;if(winner===server)st.serviceGamesWon++;else rt.returnGamesWon++;
    let serverPts=0,returnPts=0;
    for(const point of game.points){
      totals[point.winner].pointsWon++;totals[other(point.winner)].pointsLost++;st.servicePoints++;rt.returnPoints++;if(point.winner===server)st.servicePointsWon++;else rt.returnPointsWon++;
      if(point.ace!==null){fieldSupport.ace_indicator=true;st.aceKnownServicePoints++;if(point.ace)st.aces++;}
      if(point.doubleFault!==null){fieldSupport.double_fault_indicator=true;st.doubleFaultKnownServicePoints++;if(point.doubleFault)st.doubleFaults++;}
      if(!game.tiebreak){
        const bp=wouldWinGame(serverPts,returnPts,"returner");const deuce=serverPts>=3&&returnPts>=3&&serverPts===returnPts;
        if(bp){st.breakPointsFaced++;rt.breakChances++;if(point.winner===server)st.breakPointsSaved++;else rt.breakPointsConverted++;}
        if(deuce){st.deucePoints++;rt.deucePoints++;if(point.winner===server)st.deucePointsWon++;else rt.deucePointsWon++;}
        if(bp||deuce){st.pressurePoints++;rt.pressurePoints++;if(point.winner===server)st.pressurePointsWon++;else rt.pressurePointsWon++;}
        if(point.winner===server)serverPts++;else returnPts++;
      }else{st.pressurePoints++;rt.pressurePoints++;if(point.winner===server)st.pressurePointsWon++;else rt.pressurePointsWon++;}
    }
    if(hasSetBoundaries){
      const sn=game.setNo!;const score=setGames.get(sn)??{player1:0,player2:0};
      if(previousGame&&previousGame.setNo===sn&&previousGame.brokenPlayer===returner){totals[returner].breakbackOpportunities++;if(winner===returner)totals[returner].breakbacks++;}
      if(wouldWinSet(score[server],score[returner])){st.closeoutOpportunities++;if(winner===server)st.closeouts++;}
      previousGame=winner===returner?{setNo:sn,brokenPlayer:server}:null;score[winner]++;setGames.set(sn,score);
    }
  }

  const derived:Record<PbpSide,Partial<Record<string,RecoveredMetric>>>={player1:{},player2:{}};
  for(const side of SIDES){
    const t=totals[side];const add=(code:string,treatment:"RECONSTRUCTED"|"PARTIAL",value:RecoveredMetric["value"],raw_fields:string[],transformation:string)=>{derived[side][code]={treatment,value,raw_fields,transformation};};
    add("002","PARTIAL",{service_points:t.servicePoints,service_points_won:t.servicePointsWon,service_point_win_pct:pct(t.servicePointsWon,t.servicePoints),aces:fieldSupport.ace_indicator?t.aces:null,double_faults:fieldSupport.double_fault_indicator?t.doubleFaults:null,serve_number_available:false},["server","point_winner","ace/DF when encoded"],"Aggregate objective service-point outcomes only; serve-number dimensions remain unavailable.");
    add("003","PARTIAL",{return_points:t.returnPoints,return_points_won:t.returnPointsWon,return_point_win_pct:pct(t.returnPointsWon,t.returnPoints),serve_number_available:false},["server","point_winner"],"Orient each point to the non-server and aggregate return outcomes; serve-number splits are not inferred.");
    add("004","RECONSTRUCTED",{break_points:t.breakChances,converted:t.breakPointsConverted,conversion_pct:pct(t.breakPointsConverted,t.breakChances)},["server","chronological point_winner"],"Replay game score before every point and identify returner game-point states.");
    add("009",hasSetBoundaries?"RECONSTRUCTED":"PARTIAL",{pressure_points:t.pressurePoints,pressure_points_won:t.pressurePointsWon,pressure_win_pct:pct(t.pressurePointsWon,t.pressurePoints),set_boundaries:hasSetBoundaries},["server","chronological point_winner","set boundary when encoded"],"Aggregate deterministically identified break-point/deuce/tiebreak pressure states without imputing missing states.");
    add("026","RECONSTRUCTED",{service_games:t.serviceGames,holds:t.serviceGamesWon,hold_pct:pct(t.serviceGamesWon,t.serviceGames)},["server","game winner"],"Count complete service games won by the server.");
    add("027","RECONSTRUCTED",{return_games:t.returnGames,breaks:t.returnGamesWon,break_pct:pct(t.returnGamesWon,t.returnGames)},["server","game winner"],"Count complete return games won by the returner.");
    if(fieldSupport.ace_indicator)add("031","RECONSTRUCTED",{aces:t.aces,known_service_points:t.aceKnownServicePoints,ace_rate_pct:pct(t.aces,t.aceKnownServicePoints)},["server","explicit/coded ace indicator"],"Count only service points whose structured PBP code explicitly supports ace status.");
    if(fieldSupport.double_fault_indicator)add("032","RECONSTRUCTED",{double_faults:t.doubleFaults,known_service_points:t.doubleFaultKnownServicePoints,double_fault_rate_pct:pct(t.doubleFaults,t.doubleFaultKnownServicePoints)},["server","explicit/coded double-fault indicator"],"Count only service points whose structured PBP code explicitly supports double-fault status.");
    add("033","RECONSTRUCTED",{return_points:t.returnPoints,return_points_won:t.returnPointsWon,return_points_won_pct:pct(t.returnPointsWon,t.returnPoints)},["server","point_winner"],"Orient each point to the non-server and aggregate return points won.");
    add("036","RECONSTRUCTED",{break_points_faced:t.breakPointsFaced,break_points_saved:t.breakPointsSaved,bp_saved_pct:pct(t.breakPointsSaved,t.breakPointsFaced)},["server","chronological point_winner"],"Replay score and count break points faced and won by server.");
    add("037","RECONSTRUCTED",{break_chances:t.breakChances,break_points_converted:t.breakPointsConverted,bp_converted_pct:pct(t.breakPointsConverted,t.breakChances)},["server","chronological point_winner"],"Replay score and count return-side break chances converted.");
    add("038","RECONSTRUCTED",{break_points_faced:t.breakPointsFaced,service_games:t.serviceGames,bp_faced_per_game:ratio(t.breakPointsFaced,t.serviceGames)},["server","chronological point_winner","game boundary"],"Divide reconstructed break points faced by complete service games.");
    add("039","RECONSTRUCTED",{break_chances:t.breakChances,return_games:t.returnGames,bp_chances_per_game:ratio(t.breakChances,t.returnGames)},["server","chronological point_winner","game boundary"],"Divide reconstructed break chances by complete return games.");
    add("040","RECONSTRUCTED",{deuce_points:t.deucePoints,deuce_points_won:t.deucePointsWon,deuce_point_win_pct:pct(t.deucePointsWon,t.deucePoints)},["server","chronological point_winner"],"Replay standard-game score and count points beginning from a deuce state.");
    add("069","RECONSTRUCTED",{points_won:t.pointsWon,points_lost:t.pointsLost,dominance_ratio:ratio(t.pointsWon,t.pointsLost)},["point_winner"],"Compute player point-winner total divided by opponent point-winner total.");
    if(hasSetBoundaries){
      add("070","RECONSTRUCTED",{breakback_opportunities:t.breakbackOpportunities,breakbacks:t.breakbacks,breakback_rate_pct:pct(t.breakbacks,t.breakbackOpportunities)},["server","game winner","set boundary","chronological game order"],"Within the same set, grade the immediate return game after the player is broken.");
      add("071","RECONSTRUCTED",{closeout_opportunities:t.closeoutOpportunities,closeouts:t.closeouts,closeout_rate_pct:pct(t.closeouts,t.closeoutOpportunities)},["server","game winner","set boundary","set game score"],"Before each service game, identify whether winning that game would win the set and grade the result.");
    }
    add("079",hasSetBoundaries?"RECONSTRUCTED":"PARTIAL",{pressure_points:t.pressurePoints,pressure_points_won:t.pressurePointsWon,pressure_index_pct:pct(t.pressurePointsWon,t.pressurePoints),set_boundaries:hasSetBoundaries},["server","chronological point_winner","set boundary when encoded"],"Deterministic pressure-state index over encoded break-point/deuce/tiebreak states; missing states are not imputed.");
  }
  return{valid:true,reason:null,game_count:games.length,point_count:pointCount,derived,field_support:fieldSupport};
}

export function metricHasRequiredPbpFields(recovery:PbpRecovery,code:string,side:PbpSide){return Boolean(recovery.valid&&recovery.derived[side][code]);}
