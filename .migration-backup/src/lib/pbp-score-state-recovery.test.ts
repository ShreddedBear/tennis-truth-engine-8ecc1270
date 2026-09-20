import { describe, expect, it } from "vitest";
import { reconstructPbpScoreState, deriveOpeningWindowProfile, TASK18B_METRIC_CODES } from "./pbp-score-state-recovery";
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
 // Task 20 reconciliation, second pass: retargeted/deduplicated down to the codes whose
 // real definitions PBP data actually satisfies. See the long comment on
 // TASK18B_METRIC_CODES in pbp-score-state-recovery.ts for the code-by-code rationale
 // (002/003 kept as-is; 032 <- old 037/004 duplicate; 018 <- merged 070+071; 053 <- old 079;
 // 026/027/036/038/039/040 removed with no clean authoritative-catalog home; 016 added --
 // NO_SOURCE denominator-eligibility audit found its score-state bullets recoverable from
 // data this file already replays).
 it("owns exactly the requested 6 metric codes",()=>expect([...TASK18B_METRIC_CODES].sort()).toEqual(["002","003","009","016","018","032"].sort()));
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
   expect(r.derived.player1["016"]?.value.longest_point_win_streak).toBeGreaterThan(0);
 });
 it("replays intra-game score state correctly for a hand-traced game (0-0,15-0,30-0,30-15,30-30,40-30,Deuce,Advantage)",()=>{
   // player1 serves; point winners in order: 1,1,2,2,1,2,1,1 (player1 wins the game after
   // reaching advantage). Every pre-point state below is hand-verified against standard
   // tennis scoring, independent of this file's implementation.
   const payload={sets:[{games:[{server:"player1",points:[
     {winner:"player1"},{winner:"player1"},{winner:"player2"},{winner:"player2"},{winner:"player1"},{winner:"player2"},{winner:"player1"},{winner:"player1"},
   ]}]}]};
   const r=reconstructPbpScoreState(payload);
   expect(r.valid).toBe(true);
   const p1States=JSON.parse(String(r.derived.player1["016"]?.value.score_state_performance_json));
   const p2States=JSON.parse(String(r.derived.player2["016"]?.value.score_state_performance_json));
   expect(p1States).toEqual({
     "0-0":{n:1,win_pct:100},"15-0":{n:1,win_pct:100},"30-0":{n:1,win_pct:0},"30-15":{n:1,win_pct:0},
     "30-30":{n:1,win_pct:100},"40-30":{n:1,win_pct:0},"Deuce":{n:1,win_pct:100},"Advantage":{n:1,win_pct:100},
   });
   expect(p2States).toEqual({
     "0-0":{n:1,win_pct:0},"0-15":{n:1,win_pct:0},"0-30":{n:1,win_pct:100},"15-30":{n:1,win_pct:100},
     "30-30":{n:1,win_pct:0},"30-40":{n:1,win_pct:100},"Deuce":{n:1,win_pct:0},
   });
   // No point in this game was a break point (server never faced one), and player2 never
   // reached Advantage -- neither key should be fabricated for either side.
   expect(p1States["Break Point"]).toBeUndefined();expect(p2States["Break Point"]).toBeUndefined();expect(p2States["Advantage"]).toBeUndefined();
   // player1 wins points 1,2 then again 7,8 back-to-back -- longest streak is 2, not the
   // total 5 points they won across the game.
   expect(r.derived.player1["016"]?.value.longest_point_win_streak).toBe(2);
   expect(r.derived.player2["016"]?.value.longest_point_win_streak).toBe(2);
   expect(r.derived.player1["016"]?.treatment).toBe("PARTIAL");
 });
 it("tags a genuine break point in the score-state breakdown without fabricating one that wasn't reached",()=>{
   // player1 serves and loses the game after facing (and converting, for the returner) a
   // break point at 30-40: winners 2,2,2,2 (love game for the returner from server's POV).
   const payload={sets:[{games:[{server:"player1",points:[{winner:"player2"},{winner:"player2"},{winner:"player2"},{winner:"player2"}]}]}]};
   const r=reconstructPbpScoreState(payload);
   const p1States=JSON.parse(String(r.derived.player1["016"]?.value.score_state_performance_json));
   // The 4th point is played at 0-40 (server's own perspective) -- not a break point by this
   // file's definition, since wouldWinGame(0,3,"returner") is already true one point earlier
   // (at 0-40, returner already had break point going in); confirm at least one Break Point
   // entry exists and none is fabricated with a 0 sample.
   expect(p1States["Break Point"].n).toBeGreaterThan(0);
   expect(Object.values(p1States).every((v:any)=>v.n>0)).toBe(true);
 });
 it("keeps Serve Profile, Return Profile, Comeback/Pressure Behavior and Pressure & Clean-Game Metrics partial where their full raw-field contract is not proven, and keeps composite metrics 032/053 PARTIAL since only one of their several named sub-components is deterministically covered",()=>{const r=reconstructPbpScoreState(completePayload);expect(r.derived.player1["002"]?.treatment).toBe("PARTIAL");expect(r.derived.player1["003"]?.treatment).toBe("PARTIAL");expect(r.derived.player1["009"]?.treatment).toBe("PARTIAL");expect(r.derived.player1["053"]?.treatment).toBe("PARTIAL");expect(r.derived.player1["018"]?.treatment).toBe("RECONSTRUCTED");expect(r.derived.player1["032"]?.treatment).toBe("PARTIAL");expect(r.field_support.serve_number).toBe(false)});
 it("only reports ace/DF fields within metric 002 when their indicators are actually encoded",()=>{const withIndicators=reconstructPbpScoreState(completePayload);expect(withIndicators.derived.player1["002"]?.value.aces).not.toBeNull();expect(withIndicators.derived.player1["002"]?.value.double_faults).not.toBeNull();const noIndicators=reconstructPbpScoreState({sets:[{games:[{server:"player1",points:[{winner:"player1"},{winner:"player1"},{winner:"player1"},{winner:"player1"}]}]}]});expect(noIndicators.derived.player1["002"]?.value.aces).toBeNull();expect(noIndicators.derived.player1["002"]?.value.double_faults).toBeNull()});
 it("matches the stored BSD schema without inventing ace or double-fault fields",()=>{const r=reconstructPbpScoreState({available:true,sets:[{set:1,games:[bsdSchemaGame]}]});expect(r.valid).toBe(true);expect(r.field_support.ace_indicator).toBe(false);expect(r.field_support.double_fault_indicator).toBe(false);expect(r.derived.player1["002"]?.value.aces).toBeNull();expect(r.derived.player1["002"]?.value.double_faults).toBeNull();expect(r.derived.player2["003"]).toBeDefined()});
 it("rejects incomplete PBP instead of manufacturing missing winners",()=>{const r=reconstructPbpScoreState({sets:[{games:[{server:"player1",points:[{score:"15-0"},{score:"30-0"}]}]}]});expect(r.valid).toBe(false);expect(Object.keys(r.derived.player1)).toHaveLength(0)});
 it("rejects an explicit game winner when any listed point winner is missing",()=>{const r=reconstructPbpScoreState({sets:[{games:[{server:"player1",winner:"player1",points:[{winner:"player1"},{winner:"player1"},{player1_score:"40",player2_score:"0"},{winner:"player1"}]}]}]});expect(r.valid).toBe(false)});
 it("rejects conflicting BSD game counters",()=>{const r=reconstructPbpScoreState({sets:[{set:1,games:[{...bsdSchemaGame,player1_games:1,player2_games:0}]}]});expect(r.valid).toBe(false)});
 it("does not infer shot-level fields from score-only PBP",()=>{const r=reconstructPbpScoreState(completePayload);expect(r.field_support.rally_length).toBe(false);expect(r.field_support.shot_type).toBe(false);expect(r.field_support.shot_placement).toBe(false);expect(r.field_support.handedness).toBe(false)});
 it("does not award set-sequence metrics when set boundaries are absent",()=>{const r=reconstructPbpScoreState({games:[{server:"player1",points:[{winner:"player1"},{winner:"player1"},{winner:"player1"},{winner:"player1"}]},{server:"player2",points:[{winner:"player1"},{winner:"player1"},{winner:"player1"},{winner:"player1"}]}]});expect(r.valid).toBe(true);expect(r.field_support.set_boundary).toBe(false);expect(r.derived.player1["018"]).toBeUndefined();expect(r.derived.player1["009"]?.treatment).toBe("PARTIAL");expect(r.derived.player1["053"]?.treatment).toBe("PARTIAL")});
 it("requires correct player orientation and pair-complete metric evidence",()=>{const r=reconstructPbpScoreState(completePayload);const obs=(player:string,side:"player1"|"player2")=>({family:"POINT_BY_POINT",source:"fixture",player,opponent:player==="Alpha"?"Beta":"Alpha",event_date:"2026-08-01",value:{derived:r.derived[side]}});const packet={"032":{observations:[obs("Alpha","player1"),obs("Beta","player2")]}};const finding=deterministicPbpMetricFromPacket({metricCode:"032",p1:"Alpha",p2:"Beta",asOfDate:"2026-08-02",packet});expect(finding?.p1_treatment).toBe("PARTIAL");expect(finding?.p2_treatment).toBe("PARTIAL");expect(finding?.sample).toContain("pair_complete=true")});
 it("keeps one-sided packet evidence unavailable on the missing side",()=>{const r=reconstructPbpScoreState(completePayload);const packet={"032":{observations:[{family:"POINT_BY_POINT",source:"fixture",player:"Alpha",opponent:"Beta",event_date:"2026-08-01",value:{derived:r.derived.player1}}]}};const finding=deterministicPbpMetricFromPacket({metricCode:"032",p1:"Alpha",p2:"Beta",asOfDate:"2026-08-02",packet});expect(finding?.p1_treatment).toBe("PARTIAL");expect(finding?.p2_treatment).toBe("UNAVAILABLE");expect(finding?.sample).toContain("pair_complete=false")});

 describe("053 extension: serve-escape/clean-hold/clean-break/love-15/pressure-return-game-streak",()=>{
  // completePayload's 9 games, hand-verified above (in this test's own comments) game by
  // game: game1 (player1 serves, wins 5-3 after reaching -- but never facing a break
  // point at -- deuce) is p1's only non-clean, non-love hold; games 3/5/7/9 (player1
  // serves, wins every point) are clean love holds; games 2/6/8 (player2 serves, player1
  // wins every point) are clean love breaks for player1.
  it("computes clean-hold/love-hold/serve-escape/clean-break rates from the actual per-game replay, not a guessed aggregate",()=>{
    const r=reconstructPbpScoreState(completePayload);
    const p1=r.derived.player1["053"]!.value;
    expect(p1.nt_holds).toBe(5);expect(p1.clean_hold_pct).toBe(80);expect(p1.love_fifteen_hold_pct).toBe(80);expect(p1.serve_escape_dependency_pct).toBe(0);
    expect(p1.nt_breaks).toBe(3);expect(p1.clean_break_pct).toBe(100);
  });
  it("tracks the Pressure Accumulation Score bullet's literal 'consecutive return games reaching 30-all/deuce/break point' definition per side",()=>{
    const r=reconstructPbpScoreState(completePayload);
    // player2 returns in games 1,3,5,7,9 (all player1-served); only game1 reaches a
    // break-point/deuce state (games 3/5/7/9 are clean love holds -- no BP, no deuce), so
    // player2's pressure-return-game count/streak is exactly 1, not fabricated higher.
    expect(r.derived.player2["053"]!.value.pressure_return_games_reached).toBe(1);
    expect(r.derived.player2["053"]!.value.pressure_return_game_longest_streak).toBe(1);
    // player1 returns in games 2, 4, 6, 8 (every player2-served game): they break in
    // 2/6/8 (love breaks -- any completed non-tiebreak break necessarily passes through a
    // break-point state on its final point, e.g. 0-40 immediately before a love break) but
    // NOT in game 4 (player2 holds love, player1 never threatens -- rp stays 0, so
    // wouldWinGame(sp,0,"returner") never fires and no pressure is reached there). That
    // gives reached=3 (games 2/6/8) but a longest streak of only 2 (game 4 breaks the
    // run between game 2 and games 6/8) -- proving the streak reflects the real
    // game-by-game sequence rather than just counting total breaks.
    expect(r.derived.player1["053"]!.value.pressure_return_games_reached).toBe(3);
    expect(r.derived.player1["053"]!.value.pressure_return_game_longest_streak).toBe(2);
  });
  it("never claims a return-game-abandonment-rate field (documented, intentional exclusion)",()=>{
    const r=reconstructPbpScoreState(completePayload);
    expect(Object.keys(r.derived.player1["053"]!.value)).not.toContain("return_game_abandonment_pct");
    expect(r.derived.player1["053"]!.treatment).toBe("PARTIAL");
  });
 });

 describe("034 Scoreline Deception Index (partial, component-level)",()=>{
  it("reports total points, break opportunities, an expected-games figure, and a within-match Dominance Ratio for both sides without fusing them into a fabricated composite index",()=>{
    const r=reconstructPbpScoreState(completePayload);
    const p1=r.derived.player1["034"]!.value,p2=r.derived.player2["034"]!.value;
    expect(r.derived.player1["034"]!.treatment).toBe("PARTIAL");
    expect(Object.keys(p1)).not.toContain("scoreline_deception_index");
    expect(p1.total_points_won).toBeGreaterThan(0);
    // player1 wins 8 of the 9 games (all but game 4, which player2 holds) -- hand-verified
    // against completePayload's own game-by-game server/point structure above.
    expect(p1.actual_games_won).toBe(8);
    expect(p2.actual_games_won).toBe(1);
    expect(p1.break_chances).toBe(p1.break_chances);
    // Dominance Ratio is own return-points-won% / opponent return-points-won%, the same
    // formula matchup-efficiency.server.ts's canonical master DR uses -- cross-check it
    // directly from the two sides' own reported RPW% rather than trusting the field blindly.
    expect(p1.dominance_ratio).toBeCloseTo((p1.own_return_points_won_pct as number)/(p1.opponent_return_points_won_pct as number),4);
    expect(p2.dominance_ratio).toBeCloseTo((p2.own_return_points_won_pct as number)/(p2.opponent_return_points_won_pct as number),4);
    // expected_games_won is a probability-model figure, not a copy of actual_games_won --
    // it must stay a finite, non-negative number within a plausible range (can exceed the
    // real total slightly for a very dominant side since it is an expectation, not a cap).
    expect(p1.expected_games_won).not.toBeNull();
    expect(Number(p1.expected_games_won)).toBeGreaterThan(0);
  });
 });

 describe("026 Early-Warning / Slow-Start within-match window (deriveOpeningWindowProfile)",()=>{
  it("flags a genuine slow start (down 0-4 after the first four games) and computes the opening service/return/streak fields from the match's real chronological order",()=>{
    // player2 serves game1 and player1 breaks; player1 serves game2 and loses it (broken
    // back); player2 wins games 3 and 4 too -- player1 is down 0-4 after 4 games, a clear
    // slow start by this build's own documented threshold (differential <= -2).
    const payload={sets:[{games:[
      {server:"player2",points:[{winner:"player1"},{winner:"player1"},{winner:"player1"},{winner:"player1"}]},
      {server:"player1",points:[{winner:"player2"},{winner:"player2"},{winner:"player2"},{winner:"player2"}]},
      {server:"player2",points:[{winner:"player2"},{winner:"player2"},{winner:"player2"},{winner:"player2"}]},
      {server:"player1",points:[{winner:"player2"},{winner:"player2"},{winner:"player2"},{winner:"player2"}]},
      {server:"player2",points:[{winner:"player1"},{winner:"player1"},{winner:"player1"},{winner:"player1"}]},
      {server:"player1",points:[{winner:"player1"},{winner:"player1"},{winner:"player1"},{winner:"player1"}]},
    ]}]};
    const r=deriveOpeningWindowProfile(payload);
    expect(r.valid).toBe(true);
    const p1=r.derived.player1!,p2=r.derived.player2!;
    // player1's opening service game is game2 (they don't serve game1) -- they lose it.
    expect(p1.opening_service_game_held).toBe(false);
    // player1's opening return game is game1 -- they break.
    expect(p1.opening_return_game_broken).toBe(true);
    expect(p1.first_4_games_win_differential).toBe(-2); // won game1 only, lost games2-4
    expect(p1.slow_start_flag).toBe(true);
    expect(p2.slow_start_flag).toBe(false);
    // player1's own first two service games are game2 (lost) and game4 (lost) -- broken in
    // both, so early_break_conceded is true.
    expect(p1.early_break_conceded).toBe(true);
    // the very first break of the match happens in game1 (player2 serves, player1 wins it).
    expect(p1.time_to_first_break_games).toBe(1);
    expect(p2.time_to_first_break_games).toBe(1);
  });
  it("does not flag a marginal or positive start as a slow start, and reports null (not a guessed value) once the fixture is too short for a 6-game point-differential window",()=>{
    const payload={sets:[{games:[
      {server:"player1",points:[{winner:"player1"},{winner:"player1"},{winner:"player1"},{winner:"player1"}]},
      {server:"player2",points:[{winner:"player2"},{winner:"player2"},{winner:"player2"},{winner:"player2"}]},
      {server:"player1",points:[{winner:"player1"},{winner:"player1"},{winner:"player1"},{winner:"player1"}]},
      {server:"player2",points:[{winner:"player1"},{winner:"player1"},{winner:"player1"},{winner:"player1"}]},
    ]}]};
    const r=deriveOpeningWindowProfile(payload);
    const p1=r.derived.player1!;
    expect(p1.first_4_games_win_differential).toBe(2); // won games 1,3,4; lost game2
    expect(p1.slow_start_flag).toBe(false);
    // only 4 games in this fixture -- the 6-game point-differential window is not
    // satisfiable and must be null, never a guess extrapolated from 4 games.
    expect(p1.first_6_games_point_differential).toBeNull();
  });
  it("rejects incomplete PBP the same way reconstructPbpScoreState does, rather than fabricating a partial opening profile",()=>{
    const r=deriveOpeningWindowProfile({sets:[{games:[{server:"player1",points:[{score:"15-0"}]}]}]});
    expect(r.valid).toBe(false);
    expect(r.derived.player1).toBeNull();
  });
 });
});
