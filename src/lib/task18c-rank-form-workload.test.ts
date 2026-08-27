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
  it.each(["ATP_MAIN","WTA_MAIN","ATP_CHALLENGER","WTA_CHALLENGER"] as const)("reconstructs form on isolated %s history",family=>{
    const result=computeHistoryMetric({...base,code:"005",family,lane:lane()});
    expect(result?.treatment).toBe("RECONSTRUCTED");
    expect(result?.sample).toContain(`tour=${family}`);
  });
  it("blocks current and future match leakage",()=>{
    const matches=laneMatchesBefore(lane(),base.asOfDate);
    expect(matches.every(m=>m.date<base.asOfDate)).toBe(true);
    expect(matches.some(m=>m.tournament==="Current"||m.tournament==="Future")).toBe(false);
  });
  it("does not synthesize missing history as zero",()=>{
    const x=lane();delete x["bob beta"];delete x["gina eta"];delete x["hana theta"];delete x["iris iota"];
    expect(computeHistoryMetric({...base,code:"061",family:"ATP_MAIN",lane:x})).toBeNull();
  });
  it("keeps schedule/load and workload partial",()=>{
    const a=computeHistoryMetric({...base,code:"007",family:"ATP_MAIN",lane:lane()});
    const b=computeHistoryMetric({...base,code:"061",family:"ATP_MAIN",lane:lane()});
    expect(a?.treatment).toBe("PARTIAL");expect(a?.unavailable_reason).toMatch(/travel distance.*time-zone/i);
    expect(b?.treatment).toBe("PARTIAL");expect(b?.unavailable_reason).toMatch(/sets\/games.*duration/i);
  });
  it("uses explicit workload windows and real rest",()=>{
    const result=computeHistoryMetric({...base,code:"061",family:"ATP_MAIN",lane:lane()});
    expect(result?.p1_value).toContain("matches_7d=1");expect(result?.p1_value).toContain("days_since_last_match=6");expect(result?.p2_value).toContain("days_since_last_match=8");
  });
  it("supports reversed player orientation",()=>{
    const f=computeHistoryMetric({...base,code:"021",family:"ATP_MAIN",lane:lane()});
    const r=computeHistoryMetric({...base,p1:base.p2,p2:base.p1,code:"021",family:"ATP_MAIN",lane:lane()});
    expect(r?.p1_value).toBe(f?.p2_value);expect(r?.p2_value).toBe(f?.p1_value);
  });
  it("requires actual surface history",()=>{
    expect(computeHistoryMetric({...base,surface:"Grass",code:"001",family:"ATP_MAIN",lane:lane()})).toBeNull();
    expect(computeHistoryMetric({...base,code:"001",family:"ATP_MAIN",lane:lane()})?.treatment).toBe("RECONSTRUCTED");
  });
  it("uses results/schedule as sufficient (environment as support-only) for Elo, and results/schedule for workload",()=>{
    const schedule={source_id:"atp",observation_type:"MATCH_RESULT_OR_SCHEDULE",observation_key:"match_record"};
    const weather={source_id:"open_meteo",observation_type:"ENVIRONMENT",observation_key:"weather"};
    expect(metricAllowsObservation("021",schedule)).toBe(true);expect(metricAllowsObservation("021",weather)).toBe(true);
    expect(policyForMetric("021").sufficient_families).toEqual(["RESULTS_SCHEDULE"]);
    expect(metricAllowsObservation("061",schedule)).toBe(true);expect(policyForMetric("061").support_only_families).toContain("RESULTS_SCHEDULE");
  });
});
