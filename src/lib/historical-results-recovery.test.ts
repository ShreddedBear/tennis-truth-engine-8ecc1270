import { describe, expect, it } from "vitest";
import { deriveHistoricalResultMetric, TASK18A_HISTORICAL_RESULTS_CODES, type HistoricalResultRow } from "./historical-results-recovery";

const asOfDate="2026-08-26";
function r(player:string,opponent:string,date:string,won:boolean,surface:string,setsFor:number,setsAgainst:number,setScores:Array<[number,number]>,extra:Partial<HistoricalResultRow>={}):HistoricalResultRow{return{date,player,opponent,won,surface,tournament:"Fixture Open",setsFor,setsAgainst,setScores,bestOf:3,opponentRank:42,opponentElo:1900,status:"completed",...extra};}
const rows:HistoricalResultRow[]=[
 r("Alpha","Beta","2026-08-20",true,"Hard",2,1,[[6,4],[4,6],[7,6]]),r("Beta","Alpha","2026-08-20",false,"Hard",1,2,[[4,6],[6,4],[6,7]]),
 r("Alpha","Common","2026-08-12",true,"Hard",2,0,[[6,0],[6,2]],{opponentRank:25}),r("Beta","Common","2026-08-10",false,"Hard",1,2,[[6,7],[6,3],[3,6]],{opponentRank:25}),
 r("Alpha","ClayOpp","2026-07-20",false,"Clay",1,2,[[6,4],[2,6],[2,6]],{opponentRank:80}),r("Beta","ClayOpp","2026-07-18",true,"Clay",2,0,[[6,2],[6,3]],{opponentRank:80}),
 r("Alpha","GrassOpp","2026-06-20",true,"Grass",2,0,[[7,6],[6,4]],{opponentRank:55}),r("Beta","GrassOpp","2026-06-18",true,"Grass",2,1,[[6,4],[3,6],[6,2]],{opponentRank:55}),
 r("Alpha","OldOpp","2026-01-10",true,"Hard",2,0,[[6,3],[6,4]],{status:"retired"}),r("Beta","OldOpp","2026-01-08",false,"Hard",0,2,[[3,6],[4,6]],{status:"retired"}),
 // Future rows are deliberately present and must be excluded by the target-date cutoff.
 r("Alpha","Future","2026-09-01",true,"Hard",2,0,[[6,0],[6,0]],{opponentRank:1}),r("Beta","Future","2026-09-01",false,"Hard",0,2,[[0,6],[0,6]],{opponentRank:1}),
];

describe("Task 18A historical/results recovery",()=>{
 it("owns exactly the 23 Task 17 historical/results codes",()=>{expect(TASK18A_HISTORICAL_RESULTS_CODES).toEqual(["006","010","011","013","020","022","023","024","025","045","046","049","050","051","052","053","054","055","056","057","058","059","080"]);});
 it("reconstructs every full historical family from observed prior inputs",()=>{
   for(const code of TASK18A_HISTORICAL_RESULTS_CODES.filter(c=>c!=="057")){
     const value=deriveHistoricalResultMetric({code,player:"Alpha",opponent:"Beta",rows,asOfDate,surface:"Hard"});
     expect(value,code).not.toBeNull();expect(value?.treatment,code).toBe("RECONSTRUCTED");expect(value?.sampleSize,code).toBeGreaterThanOrEqual(0);
   }
 });
 it("keeps retirement/walkover evidence PARTIAL",()=>{const value=deriveHistoricalResultMetric({code:"057",player:"Alpha",opponent:"Beta",rows,asOfDate,surface:"Hard"});expect(value?.treatment).toBe("PARTIAL");expect(value?.value).toContain("status_observed_matches");});
 it("does not leak future rows",()=>{const value=deriveHistoricalResultMetric({code:"058",player:"Alpha",opponent:"Beta",rows,asOfDate,surface:"Hard"});expect(value?.sampleSize).toBe(5);expect(JSON.stringify(value?.rawInputs)).not.toContain("rank:1");});
 it("never zero-fills missing score evidence",()=>{const bare:HistoricalResultRow[]=[{date:"2026-08-01",player:"Alpha",opponent:"Beta",won:true,surface:"Hard",tournament:null,setsFor:null,setsAgainst:null,setScores:[],bestOf:null,opponentRank:null,opponentElo:null,status:null}];expect(deriveHistoricalResultMetric({code:"051",player:"Alpha",opponent:"Beta",rows:bare,asOfDate,surface:"Hard"})).toBeNull();expect(deriveHistoricalResultMetric({code:"057",player:"Alpha",opponent:"Beta",rows:bare,asOfDate,surface:"Hard"})).toBeNull();});
});
