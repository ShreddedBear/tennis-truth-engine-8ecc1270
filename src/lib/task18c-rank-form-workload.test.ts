import { describe, expect, it } from "vitest";
import { computeHistoryMetric, laneMatchesBefore, type HistoryLane } from "./task18c-rank-form-workload";
import { metricAllowsObservation, policyForMetric } from "./metric-source-family-policy";

const row = (date:string,tournament:string,surface:string,opponent:string,won:0|1,round="R32",source="fixture") => [date,tournament,surface,opponent,won,round,source] as const;
function lane():HistoryLane{return{
  "alice alpha":[row("2026-08-20","A","Hard","Carol Gamma",1),row("2026-08-10","B","Clay","Dana Delta",0),row("2026-07-25","C","Hard","Eva Epsilon",1),row("2026-08-26","Current","Hard","Bob Beta",1),row("2026-08-27","Future","Hard","Future Player",1)],
  "carol gamma":[row("2026-08-20","A","Hard","Alice Alpha",0)],"dana delta":[row("2026-08-10","B","Clay","Alice Alpha",1)],"eva epsilon":[row("2026-07-25","C","Hard","Alice Alpha",0)],
  "bob beta":[row("2026-08-18","D","Hard","Gina Eta",1),row("2026-08-02","E","Hard","Hana Theta",0),row("2026-07-20","F","Clay","Iris Iota",1),row("2026-08-26","Current","Hard","Alice Alpha",0)],
  "gina eta":[row("2026-08-18","D","Hard","Bob Beta",0)],"hana theta":[row("2026-08-02","E","Hard","Bob Beta",1)],"iris iota":[row("2026-07-20","F","Clay","Bob Beta",0)]
};}
const base={p1:"Alice Alpha",p2:"Bob Beta",asOfDate:"2026-08-26",surface:"Hard"} as const;

describe("Task 18C rank/form/workload recovery",()=>{
  // Task 20 reconciliation: this file previously also targeted "005"/"007"/"021"/"061".
  // 005 ("Interpretation rules") and 061 ("Final Advanced Tests") are PROCESS_META; 007
  // ("Common-Opponent Network") had nothing to do with the workload content filed under
  // it (that content is an exact match for real 012 "Fatigue/Workload", already correctly
  // and completely served elsewhere); 021's Elo-differential content was folded into the
  // one code it actually matches, real 001 ("Surface Strength" -> "Elo Win Probability").
  // See the header comment on HistoryMetricCode in task18c-rank-form-workload.ts.
  it("blocks current and future match leakage",()=>{
    const matches=laneMatchesBefore(lane(),base.asOfDate);
    expect(matches.every(m=>m.date<base.asOfDate)).toBe(true);
    expect(matches.some(m=>m.tournament==="Current"||m.tournament==="Future")).toBe(false);
  });
  it("reconstructs surface strength plus overall Elo differential for real code 001, kept PARTIAL since only 2-3 of 8 named submetrics are covered (see docs/metric-audit-001-surface-strength.md §5)",()=>{
    const result=computeHistoryMetric({...base,code:"001",family:"ATP_MAIN",lane:lane()});
    expect(result?.treatment).toBe("PARTIAL");
    expect(result?.p1_value).toContain("overall_elo=");
    expect(result?.p1_value).toContain(`surface=${base.surface.toLowerCase()}`);
    expect(result?.differential).toContain("overall_elo_delta_p1_minus_p2=");
  });
  it("still reports the Elo differential when no surface is supplied, without a surface-record component",()=>{
    const { surface, ...rest } = base;
    const result=computeHistoryMetric({...rest,code:"001",family:"ATP_MAIN",lane:lane()});
    expect(result?.p1_value).toContain("overall_elo=");
    expect(result?.p1_value).not.toContain("matches_52w=");
    expect(result?.differential).toContain("overall_elo_delta_p1_minus_p2=");
  });
  it("does not synthesize missing history",()=>{
    const x=lane();delete x["bob beta"];delete x["gina eta"];delete x["hana theta"];delete x["iris iota"];
    expect(computeHistoryMetric({...base,code:"001",family:"ATP_MAIN",lane:x})).toBeNull();
  });
  it("supports reversed player orientation",()=>{
    const f=computeHistoryMetric({...base,code:"001",family:"ATP_MAIN",lane:lane()});
    const r=computeHistoryMetric({...base,p1:base.p2,p2:base.p1,code:"001",family:"ATP_MAIN",lane:lane()});
    expect(r?.p1_value).toBe(f?.p2_value);expect(r?.p2_value).toBe(f?.p1_value);
  });
  it("requires actual surface history for the surface-record component but still returns the Elo differential",()=>{
    const grass=computeHistoryMetric({...base,surface:"Grass",code:"001",family:"ATP_MAIN",lane:lane()});
    expect(grass?.p1_value).toContain("overall_elo=");
    expect(grass?.p1_value).not.toContain("matches_52w=");
    const hard=computeHistoryMetric({...base,code:"001",family:"ATP_MAIN",lane:lane()});
    expect(hard?.p1_value).toContain("matches_52w=");
  });
  it("uses results/schedule as the sole *sufficient* source for Elo",()=>{
    // Real code 001 ("Surface Strength") is a chronological-results Elo replay; it is not
    // in metric-source-family-policy.ts's PBP or MARKET lists and has no legitimate
    // non-RESULTS_SCHEDULE family.
    const schedule={source_id:"atp",observation_type:"MATCH_RESULT_OR_SCHEDULE",observation_key:"match_record"};
    expect(metricAllowsObservation("001",schedule)).toBe(true);
    expect(policyForMetric("001").allowed_families).toContain("RESULTS_SCHEDULE");
  });
});
