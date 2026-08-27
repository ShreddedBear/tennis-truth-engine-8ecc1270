import { describe, expect, it } from "vitest";
import { reconstructPbpScoreState, TASK18B_METRIC_CODES } from "./pbp-score-state-recovery";
import { deterministicPbpMetricFromPacket } from "./deterministic-pbp-metrics.server";

const completePayload={available:true,sets:[{games:[
 {server:"player1",points:[{winner:"player1",ace:true},{winner:"player2",double_fault:true},{winner:"player1"},{winner:"player2"},{winner:"player1"},{winner:"player2"},{winner:"player1"},{winner:"player1"}]},
 {server:"player2",points:[{winner:"player1"},{winner:"player1"},{winner:"player1"},{winner:"player1"}]},
 {server:"player1",points:[{winner:"player1"},{winner:"player1"},{winner:"player1"},{winner:"player1"}]},
 {server:"player2",points:[{winner:"player2"},{winner:"player2"},{winner:"player2"},{winner:"player2"}]},
 {server:"player1",points:[{winner:"player1"},{winner:"player1"},{winner:"player1"},{winner:"player1"}]},
 {server:"player2",points:[{winner:"player1"},{winner:"player1"},{winner:"player1"},{winner:"player1"}]},
 {server:"player1",points:[{winner:"player1"},{winner:"player1"},{winner:"player1"},{winner:"player1"}]},
 {server:"player2",points:[{winner:"player1"},{winner:"player1"},{winner:"player1"},{winner:"player1"}]},
 {server:"player1",points:[{winner:"player1"},{winner:"player1"},{winner:"player1"},{winner:"player1"}]},
]}]};

const bsdSchemaGame={game:1,server:"player1",winner:"player2",break:true,player1_games:0,player2_games:1,points:[
 {player1_score:"15",player2_score:"0",winner:"player1"},{player1_score:"30",player2_score:"0",winner:"player1"},{player1_score:"40",player2_score:"0",winner:"player1"},{player1_score:"40",player2_score:"15",winner:"player2"},{player1_score:"40",player2_score:"30",winner:"player2"},{player1_score:"40",player2_score:"40",winner:"player2"},{player1_score:"40",player2_score:"A",winner:"player2"}
]};

describe("Task 18B deterministic PBP recovery",()=>{
 // Task 20 reconciliation, second pass: retargeted/deduplicated down to the 5 codes whose
 // real definitions PBP data actually satisfies. See the long comment on
 // TASK18B_METRIC_CODES in pbp-score-state-recovery.ts for the code-by-code rationale
 // (002/003 kept as-is; 032 <- old 037/004 duplicate; 018 <- merged 070+071; 053 <- old 079;
 // 026/027/036/038/039/040 removed with no clean authoritative-catalog home).
 it("owns exactly the requested 5 metric codes",()=>expect([...TASK18B_METRIC_CODES].sort()).toEqual(["002","003","009","018","032"].sort()));
 it("no longer claims metrics 026/027/031/032(old)/033/036/038/039/040/069/070/071/079 (removed, deduplicated, or retargeted)",()=>{
   const r=reconstructPbpScoreState(completePayload);
   for(const code of ["026","027","031","033","036","038","039","040","069","070","071","079"]) expect(r.derived.player1[code],code).toBeUndefined();
 });
 it("reconstructs player-oriented service, return, break-point-conversion, momentum/closing and pressure metrics",()=>{
   const r=reconstructPbpScoreState(completePayload);
   expect(r.valid).toBe(true);expect(r.field_support.server).toBe(true);expect(r.field_support.point_winner).toBe(true);expect(r.field_support.set_boundary).toBe(true);
   expect(r.derived.player1["003"]?.value.return_points_won).toBeGreaterThan(0);
   expect(r.derived.player1["032"]?.value.break_points_converted).toBeGreaterThan(0);
   expect(r.derived.player1["018"]?.value.breakback_opportunities).toBeGreaterThanOrEqual(0);
   expect(r.derived.player1["018"]?.value.closeout_opportunities).toBeGreaterThanOrEqual(0);
   expect(r.derived.player1["053"]?.value.pressure_points).toBeGreaterThan(0);
 });
 it("keeps Serve Profile, Return Profile, Comeback/Pressure Behavior and Pressure & Clean-Game Metrics partial where their full raw-field contract is not proven",()=>{const r=reconstructPbpScoreState(completePayload);expect(r.derived.player1["002"]?.treatment).toBe("PARTIAL");expect(r.derived.player1["003"]?.treatment).toBe("PARTIAL");expect(r.derived.player1["009"]?.treatment).toBe("PARTIAL");expect(r.derived.player1["053"]?.treatment).toBe("PARTIAL");expect(r.derived.player1["018"]?.treatment).toBe("RECONSTRUCTED");expect(r.derived.player1["032"]?.treatment).toBe("RECONSTRUCTED");expect(r.field_support.serve_number).toBe(false)});
 it("only reports ace/DF fields within metric 002 when their indicators are actually encoded",()=>{const withIndicators=reconstructPbpScoreState(completePayload);expect(withIndicators.derived.player1["002"]?.value.aces).not.toBeNull();expect(withIndicators.derived.player1["002"]?.value.double_faults).not.toBeNull();const noIndicators=reconstructPbpScoreState({sets:[{games:[{server:"player1",points:[{winner:"player1"},{winner:"player1"},{winner:"player1"},{winner:"player1"}]}]}]});expect(noIndicators.derived.player1["002"]?.value.aces).toBeNull();expect(noIndicators.derived.player1["002"]?.value.double_faults).toBeNull()});
 it("matches the stored BSD schema without inventing ace or double-fault fields",()=>{const r=reconstructPbpScoreState({available:true,sets:[{set:1,games:[bsdSchemaGame]}]});expect(r.valid).toBe(true);expect(r.field_support.ace_indicator).toBe(false);expect(r.field_support.double_fault_indicator).toBe(false);expect(r.derived.player1["002"]?.value.aces).toBeNull();expect(r.derived.player1["002"]?.value.double_faults).toBeNull();expect(r.derived.player2["003"]).toBeDefined()});
 it("rejects incomplete PBP instead of manufacturing missing winners",()=>{const r=reconstructPbpScoreState({sets:[{games:[{server:"player1",points:[{score:"15-0"},{score:"30-0"}]}]}]});expect(r.valid).toBe(false);expect(Object.keys(r.derived.player1)).toHaveLength(0)});
 it("rejects an explicit game winner when any listed point winner is missing",()=>{const r=reconstructPbpScoreState({sets:[{games:[{server:"player1",winner:"player1",points:[{winner:"player1"},{winner:"player1"},{player1_score:"40",player2_score:"0"},{winner:"player1"}]}]}]});expect(r.valid).toBe(false)});
 it("rejects conflicting BSD game counters",()=>{const r=reconstructPbpScoreState({sets:[{set:1,games:[{...bsdSchemaGame,player1_games:1,player2_games:0}]}]});expect(r.valid).toBe(false)});
 it("does not infer shot-level fields from score-only PBP",()=>{const r=reconstructPbpScoreState(completePayload);expect(r.field_support.rally_length).toBe(false);expect(r.field_support.shot_type).toBe(false);expect(r.field_support.shot_placement).toBe(false);expect(r.field_support.handedness).toBe(false)});
 it("does not award set-sequence metrics when set boundaries are absent",()=>{const r=reconstructPbpScoreState({games:[{server:"player1",points:[{winner:"player1"},{winner:"player1"},{winner:"player1"},{winner:"player1"}]},{server:"player2",points:[{winner:"player1"},{winner:"player1"},{winner:"player1"},{winner:"player1"}]}]});expect(r.valid).toBe(true);expect(r.field_support.set_boundary).toBe(false);expect(r.derived.player1["018"]).toBeUndefined();expect(r.derived.player1["009"]?.treatment).toBe("PARTIAL");expect(r.derived.player1["053"]?.treatment).toBe("PARTIAL")});
 it("requires correct player orientation and pair-complete metric evidence",()=>{const r=reconstructPbpScoreState(completePayload);const obs=(player:string,side:"player1"|"player2")=>({family:"POINT_BY_POINT",source:"fixture",player,opponent:player==="Alpha"?"Beta":"Alpha",event_date:"2026-08-01",value:{derived:r.derived[side]}});const packet={"032":{observations:[obs("Alpha","player1"),obs("Beta","player2")]}};const finding=deterministicPbpMetricFromPacket({metricCode:"032",p1:"Alpha",p2:"Beta",asOfDate:"2026-08-02",packet});expect(finding?.p1_treatment).toBe("RECONSTRUCTED");expect(finding?.p2_treatment).toBe("RECONSTRUCTED");expect(finding?.sample).toContain("pair_complete=true")});
 it("keeps one-sided packet evidence unavailable on the missing side",()=>{const r=reconstructPbpScoreState(completePayload);const packet={"032":{observations:[{family:"POINT_BY_POINT",source:"fixture",player:"Alpha",opponent:"Beta",event_date:"2026-08-01",value:{derived:r.derived.player1}}]}};const finding=deterministicPbpMetricFromPacket({metricCode:"032",p1:"Alpha",p2:"Beta",asOfDate:"2026-08-02",packet});expect(finding?.p1_treatment).toBe("RECONSTRUCTED");expect(finding?.p2_treatment).toBe("UNAVAILABLE");expect(finding?.sample).toContain("pair_complete=false")});
});
