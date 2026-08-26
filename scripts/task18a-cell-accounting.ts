import runtimeIndex from "../src/generated/tennis-runtime-index";
import { deriveHistoricalResultMetric, TASK18A_HISTORICAL_RESULTS_CODES, type HistoricalResultRow } from "../src/lib/historical-results-recovery";
import { normalizeEvidenceIdentity } from "../src/lib/evidence-player-alias";

type Lane="ATP_MAIN"|"WTA_MAIN"|"ATP_CHALLENGER"|"WTA_CHALLENGER";
type Details={sets_for?:number|null;sets_against?:number|null;set_scores?:Array<[number,number]>;best_of?:number|null;opponent_rank?:number|null;opponent_elo?:number|null;status?:string|null};
type Entry=[string,string,string,string,0|1|null,string,string,Details?];
const lanes:Lane[]=["ATP_MAIN","WTA_MAIN","ATP_CHALLENGER","WTA_CHALLENGER"];
const norm=(v:unknown)=>normalizeEvidenceIdentity(String(v??""));
const history=(runtimeIndex as any).matchHistory as Record<Lane,Record<string,Entry[]>>;
function row(player:string,e:Entry):HistoricalResultRow{const d=e[7]??{};return{date:String(e[0]),player,opponent:norm(e[3]),won:e[4]===1?true:e[4]===0?false:null,surface:String(e[2]??"")||null,tournament:String(e[1]??"")||null,setsFor:Number.isFinite(Number(d.sets_for))&&d.sets_for!==null?Number(d.sets_for):null,setsAgainst:Number.isFinite(Number(d.sets_against))&&d.sets_against!==null?Number(d.sets_against):null,setScores:Array.isArray(d.set_scores)?d.set_scores:[],bestOf:Number.isFinite(Number(d.best_of))&&d.best_of!==null?Number(d.best_of):null,opponentRank:Number.isFinite(Number(d.opponent_rank))&&d.opponent_rank!==null?Number(d.opponent_rank):null,opponentElo:Number.isFinite(Number(d.opponent_elo))&&d.opponent_elo!==null?Number(d.opponent_elo):null,status:d.status==null?null:String(d.status)};}
function rowsBefore(lane:Lane,p1:string,p2:string,date:string){return[...(history[lane][p1]??[]).filter(e=>e[0]<date).map(e=>row(p1,e)),...(history[lane][p2]??[]).filter(e=>e[0]<date).map(e=>row(p2,e))];}
const result:Record<Lane,Record<string,{status:"USABLE"|"UNAVAILABLE";treatment:"RECONSTRUCTED"|"PARTIAL";witness?:Record<string,unknown>}>>=Object.fromEntries(lanes.map(l=>[l,{}])) as any;
for(const lane of lanes){
 for(const code of TASK18A_HISTORICAL_RESULTS_CODES)result[lane][code]={status:"UNAVAILABLE",treatment:code==="057"?"PARTIAL":"RECONSTRUCTED"};
 const playerKeys=Object.keys(history[lane]??{});let examined=0;
 outer: for(const p1 of playerKeys){
   for(const target of (history[lane][p1]??[])){
     if(examined++>120000)break outer;const p2=norm(target[3]);const date=String(target[0]??"");if(!p2||p1===p2||!history[lane][p2]?.length||!/^\d{4}-\d{2}-\d{2}$/.test(date))continue;
     const prior=rowsBefore(lane,p1,p2,date);if(!prior.length)continue;const surface=String(target[2]??"")||null;
     for(const code of TASK18A_HISTORICAL_RESULTS_CODES){if(result[lane][code].status==="USABLE")continue;const a=deriveHistoricalResultMetric({code,player:p1,opponent:p2,rows:prior,asOfDate:date,surface});const b=deriveHistoricalResultMetric({code,player:p2,opponent:p1,rows:prior,asOfDate:date,surface});if(!a||!b)continue;result[lane][code]={status:"USABLE",treatment:code==="057"?"PARTIAL":"RECONSTRUCTED",witness:{date,surface,player1:p1,player2:p2,p1_sample:a.sampleSize,p2_sample:b.sampleSize}};}
     if(Object.values(result[lane]).every(x=>x.status==="USABLE"))break outer;
   }
 }
}
const usable=lanes.flatMap(l=>TASK18A_HISTORICAL_RESULTS_CODES.map(code=>({lane:l,code,...result[l][code]}))).filter(x=>x.status==="USABLE");
const unavailable=lanes.flatMap(l=>TASK18A_HISTORICAL_RESULTS_CODES.map(code=>({lane:l,code,...result[l][code]}))).filter(x=>x.status==="UNAVAILABLE");
console.log("TASK18A_CELL_ACCOUNTING="+JSON.stringify({gross_usable_cells:usable.length,gross_unavailable_cells:unavailable.length,direct_cells:0,reconstructed_cells:usable.filter(x=>x.treatment==="RECONSTRUCTED").length,partial_cells:usable.filter(x=>x.treatment==="PARTIAL").length,matrix:result,unavailable:unavailable.map(x=>`${x.code}:${x.lane}`)},null,2));
