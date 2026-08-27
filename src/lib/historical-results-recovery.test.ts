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
 // Task 20 reconciliation, second pass -- see the long comment on
 // TASK18A_HISTORICAL_RESULTS_CODES in historical-results-recovery.ts for the full
 // code-by-code rationale. Summary: "013" (old common-opponent content) -> real "007";
 // "057" (retirement/walkover rate) -> real "013" ("Availability"); "023"/"054"/"055"
 // (duplicate 6-0/blowout set-rate computations) merged -> real "017" ("Shot & Rally
 // Metrics", PARTIAL); "006"/"049"/"050"/"056"/"058"/"059" removed (PROCESS_META codes
 // that must never receive engine-written player evidence); "045"/"046"/"051"/"052"/old
 // "053"/"080" removed with no retarget (no clean real-code home). 21 -> 7 codes. "068"
 // (Streaks/Milestones) added by the NO_SOURCE denominator-eligibility audit: current
 // streak + longest-win-streak-this-season + tournament debut status are all recoverable
 // from data already here; protected-ranking status is not, so treatment stays PARTIAL.
 // "080" (Common-Opponent & Opponent-Caliber Metrics) re-added: its "Common-Opponent
 // Divergent Outcome" bullet reuses the exact same common-opponent intersection already
 // built for 007; "Opponent-Caliber Performance Gap" is not recoverable (needs each
 // player's own historical rank/Elo, which this row type does not carry), so PARTIAL.
 // "005" (Recent Form) added: task18c-rank-form-workload.ts's removal of "005" was based
 // on a stale catalog reading (it called real 005 PROCESS_META, which the phase9 metrics.txt
 // fix corrected -- real 005 is "Recent Form", an ordinary player metric). Last-5/last-10
 // win rate, trend direction, straight-set control rate and average sets conceded in recent
 // wins, and average recent opponent rank are all recoverable here; "Current Hard-Court
 // Swing" and "Recent-Performance Acceleration" are not, so treatment stays PARTIAL.
 it("owns exactly the 10 reconciled historical/results codes",()=>{expect([...TASK18A_HISTORICAL_RESULTS_CODES].sort()).toEqual(["005","007","008","010","011","013","017","020","068","080"].sort());});
 it("reconstructs every full historical family from observed prior inputs",()=>{
   for(const code of TASK18A_HISTORICAL_RESULTS_CODES.filter(c=>c!=="005"&&c!=="013"&&c!=="017"&&c!=="068"&&c!=="080")){
     const value=deriveHistoricalResultMetric({code,player:"Alpha",opponent:"Beta",rows,asOfDate,surface:"Hard"});
     expect(value,code).not.toBeNull();expect(value?.treatment,code).toBe("RECONSTRUCTED");expect(value?.sampleSize,code).toBeGreaterThan(0);
   }
 });
 it("keeps retirement/walkover evidence (retargeted from 057 to real code 013) PARTIAL",()=>{const value=deriveHistoricalResultMetric({code:"013",player:"Alpha",opponent:"Beta",rows,asOfDate,surface:"Hard"});expect(value?.treatment).toBe("PARTIAL");expect(value?.value).toContain("status_observed_matches");});
 it("keeps merged set-level-dominance evidence (retargeted from 023/054/055 to real code 017) PARTIAL",()=>{const value=deriveHistoricalResultMetric({code:"017",player:"Alpha",opponent:"Beta",rows,asOfDate,surface:"Hard"});expect(value?.treatment).toBe("PARTIAL");expect(value?.value).toContain("bagel_sets");expect(value?.value).toContain("blowout_sets");});
 it("does not leak future rows into the common-opponent network computation",()=>{const value=deriveHistoricalResultMetric({code:"007",player:"Alpha",opponent:"Beta",rows,asOfDate,surface:"Hard"});expect(value?.sampleSize).toBe(4);expect(JSON.stringify(value?.rawInputs)).not.toContain("rank:1");});
 it("never zero-fills missing score or status evidence",()=>{const bare:HistoricalResultRow[]=[{date:"2026-08-01",player:"Alpha",opponent:"Beta",won:true,surface:"Hard",tournament:null,setsFor:null,setsAgainst:null,setScores:[],bestOf:null,opponentRank:null,opponentElo:null,status:null}];expect(deriveHistoricalResultMetric({code:"017",player:"Alpha",opponent:"Beta",rows:bare,asOfDate,surface:"Hard"})).toBeNull();expect(deriveHistoricalResultMetric({code:"013",player:"Alpha",opponent:"Beta",rows:bare,asOfDate,surface:"Hard"})).toBeNull();});
 it("fails closed when no common-opponent network exists",()=>{expect(deriveHistoricalResultMetric({code:"007",player:"Alpha",opponent:"NeverPlayed",rows,asOfDate,surface:"Hard"})).toBeNull();});
 it("does not promote set-total-only history to game-score volatility evidence",()=>{const totalsOnly:HistoricalResultRow[]=[r("Alpha","X","2026-08-10",true,"Hard",2,0,[],{opponentRank:null,opponentElo:null}),r("Alpha","Y","2026-08-01",false,"Hard",1,2,[],{opponentRank:null,opponentElo:null})];expect(deriveHistoricalResultMetric({code:"011",player:"Alpha",opponent:"Beta",rows:totalsOnly,asOfDate,surface:"Hard"})).toBeNull();});
 it("never writes player evidence into PROCESS_META or removed mismatched codes (regression against silent re-entry)",()=>{
   for(const code of ["006","023","045","046","049","050","051","052","053","054","055","056","057","058","059"]){
     expect(deriveHistoricalResultMetric({code,player:"Alpha",opponent:"Beta",rows,asOfDate,surface:"Hard"}),code).toBeNull();
   }
 });
 describe("code 005 (Recent Form)",()=>{
   // Alpha's completed history before asOfDate, chronological descending (5 rows, so
   // last5 === last10 for this fixture): Beta(W,08-20,setsAgainst=1), Common(W,08-12,
   // opponentRank=25,setsAgainst=0), ClayOpp(L,07-20,opponentRank=80), GrassOpp(W,06-20,
   // opponentRank=55,setsAgainst=0), OldOpp(W,01-10,opponentRank=default 42,setsAgainst=0).
   // Beta's own opponentRank is never overridden in the fixture, so it carries the r()
   // helper's default of 42.
   //   last5_win_pct: 4 wins / 5 = 80.
   //   straight-set wins among the 4 wins (setsAgainst===0): Common, GrassOpp, OldOpp = 3
   //     of 4 scored wins -> straight_set_control_pct = 75.
   //   avg_sets_conceded_in_wins: (1+0+0+0)/4 = 0.25.
   //   avg_opponent_rank_last5: (42[Beta]+25[Common]+80[ClayOpp]+55[GrassOpp]+42[OldOpp])/5
   //     = 244/5 = 48.8.
   //   trend: half-window = min(5, floor(5/2)) = 2. Recent 2 (Beta W, Common W) = 100% win;
   //     prior 2 (ClayOpp L, GrassOpp W) = 50% win -> IMPROVING.
   it("computes last-5/last-10 form, trend direction, straight-set control and recent opponent quality, hand-traced against the fixture",()=>{
     const value=deriveHistoricalResultMetric({code:"005",player:"Alpha",opponent:"Beta",rows,asOfDate,surface:"Hard"});
     expect(value?.treatment).toBe("PARTIAL");
     expect(value?.value).toContain("last5_matches=5");
     expect(value?.value).toContain("last5_win_pct=80");
     expect(value?.value).toContain("last10_win_pct=80");
     expect(value?.value).toContain("trend_direction=IMPROVING");
     expect(value?.value).toContain("straight_set_control_pct=75");
     expect(value?.value).toContain("avg_sets_conceded_in_wins=0.25");
     expect(value?.value).toContain("avg_opponent_rank_last5=48.8");
   });
   it("never claims Current Hard-Court Swing or Recent-Performance Acceleration, which this row type cannot support",()=>{
     const value=deriveHistoricalResultMetric({code:"005",player:"Alpha",opponent:"Beta",rows,asOfDate,surface:"Hard"});
     expect(value?.value).not.toContain("swing");
     expect(value?.value).not.toContain("acceleration");
   });
   it("fails closed with no prior completed history instead of fabricating a form summary",()=>{
     expect(deriveHistoricalResultMetric({code:"005",player:"NeverPlayed",opponent:"Beta",rows,asOfDate,surface:"Hard"})).toBeNull();
   });
 });
 describe("code 068 (Streaks / Milestones)",()=>{
   // Alpha's completed history before asOfDate, chronological ascending: OldOpp(W,01-10),
   // GrassOpp(W,06-20), ClayOpp(L,07-20), Common(W,08-12), Beta(W,08-20) -- all within 2026.
   // Current streak (most recent first): Beta(W), Common(W), then ClayOpp(L) breaks it -> W2.
   // Longest win streak within the 2026 season: OldOpp+GrassOpp (2), then Common+Beta (2) -> 2.
   it("computes the current streak and the longest win streak within the target date's calendar year",()=>{
     const value=deriveHistoricalResultMetric({code:"068",player:"Alpha",opponent:"Beta",rows,asOfDate,surface:"Hard"});
     expect(value?.treatment).toBe("PARTIAL");
     expect(value?.value).toContain("current_streak=W2");
     expect(value?.value).toContain("longest_win_streak_2026=2");
   });
   it("reports tournament debut status only when a tournament name is supplied, and never fabricates it otherwise",()=>{
     const noTournament=deriveHistoricalResultMetric({code:"068",player:"Alpha",opponent:"Beta",rows,asOfDate,surface:"Hard"});
     expect(noTournament?.value).not.toContain("tournament_debut");
     const seenBefore=deriveHistoricalResultMetric({code:"068",player:"Alpha",opponent:"Beta",rows,asOfDate,surface:"Hard",tournament:"Fixture Open"});
     expect(seenBefore?.value).toContain("tournament_debut=false");
     const neverSeen=deriveHistoricalResultMetric({code:"068",player:"Alpha",opponent:"Beta",rows,asOfDate,surface:"Hard",tournament:"Brand New Event"});
     expect(neverSeen?.value).toContain("tournament_debut=true");
   });
   it("fails closed with no prior completed history instead of fabricating a streak",()=>{
     expect(deriveHistoricalResultMetric({code:"068",player:"NeverPlayed",opponent:"Beta",rows,asOfDate,surface:"Hard"})).toBeNull();
   });
 });
 describe("code 080 (Common-Opponent & Opponent-Caliber Metrics)",()=>{
   // Hand-traced against the shared fixture above, independent of the implementation.
   // Alpha vs Beta's shared opponents (both played, excluding their own H2H): Common,
   // ClayOpp, GrassOpp, OldOpp.
   //   Common:   Alpha beat Common (W); Beta lost to Common (L)   -> favorable for Alpha.
   //   ClayOpp:  Alpha lost to ClayOpp (L); Beta beat ClayOpp (W) -> unfavorable for Alpha.
   //   GrassOpp: Alpha beat GrassOpp (W); Beta beat GrassOpp (W)  -> not divergent.
   //   OldOpp:   Alpha beat OldOpp (W); Beta lost to OldOpp (L)   -> favorable for Alpha.
   // => common_opponents=4, favorable=2 (Common, OldOpp), unfavorable=1 (ClayOpp).
   it("computes common-opponent divergent outcomes correctly, hand-traced against the fixture",()=>{
     const value=deriveHistoricalResultMetric({code:"080",player:"Alpha",opponent:"Beta",rows,asOfDate,surface:"Hard"});
     expect(value?.treatment).toBe("PARTIAL");
     expect(value?.value).toContain("common_opponents=4");
     expect(value?.value).toContain("favorable_divergent_outcomes=2");
     expect(value?.value).toContain("unfavorable_divergent_outcomes=1");
   });
   it("is symmetric: from Beta's perspective the favorable/unfavorable counts invert",()=>{
     const value=deriveHistoricalResultMetric({code:"080",player:"Beta",opponent:"Alpha",rows,asOfDate,surface:"Hard"});
     expect(value?.value).toContain("common_opponents=4");
     expect(value?.value).toContain("favorable_divergent_outcomes=1");
     expect(value?.value).toContain("unfavorable_divergent_outcomes=2");
   });
   it("never claims the Opponent-Caliber Performance Gap bullet, which this row type cannot support",()=>{
     const value=deriveHistoricalResultMetric({code:"080",player:"Alpha",opponent:"Beta",rows,asOfDate,surface:"Hard"});
     expect(value?.value).not.toContain("caliber");
     expect(value?.value).not.toContain("gap");
   });
   it("fails closed when the two players share no common opponents",()=>{
     expect(deriveHistoricalResultMetric({code:"080",player:"Alpha",opponent:"NeverPlayed",rows,asOfDate,surface:"Hard"})).toBeNull();
   });
 });
});
