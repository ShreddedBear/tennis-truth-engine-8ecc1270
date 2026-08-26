import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { canonicalApprovedPbpIdentity, claimUniqueApprovedPbp, isApprovedWtaChallengerPbpRow } from "./pbp-evidence-firewall";
import { reconstructPbpScoreState } from "./pbp-score-state-recovery";

describe("Task 18B PBP evidence firewall", () => {
  it("uses canonical match identity independent of player order", () => {
    const a = canonicalApprovedPbpIdentity({ tour:"ATP_MAIN", player1:"Carlos Alcaraz", player2:"Jannik Sinner", tournament:"ATP 500 Test", date:"2026-08-01", eventLevel:"ATP 500" });
    const b = canonicalApprovedPbpIdentity({ tour:"ATP_MAIN", player1:"Jannik Sinner", player2:"Carlos Alcaraz", tournament:"Test", date:"2026-08-01", eventLevel:"500" });
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    expect(a?.playerPair).toBe(b?.playerPair);
    expect(a?.date).toBe(b?.date);
  });

  it("rejects cross-tour canonical contamination", () => {
    expect(canonicalApprovedPbpIdentity({ tour:"ATP_MAIN", player1:"A", player2:"B", tournament:"WTA 125 Example", date:"2026-08-01", eventLevel:"WTA 125" })).toBeNull();
    expect(canonicalApprovedPbpIdentity({ tour:"WTA_CHALLENGER", player1:"A", player2:"B", tournament:"ATP Challenger 75", date:"2026-08-01", eventLevel:"ATP Challenger" })).toBeNull();
  });

  it("rejects duplicate match IDs and duplicate canonical matches", () => {
    const identity = canonicalApprovedPbpIdentity({ tour:"ATP_CHALLENGER", player1:"A", player2:"B", tournament:"ATP Challenger Test", date:"2026-08-01", eventLevel:"ATP Challenger" });
    const seenIds = new Set<string>(), seenKeys = new Set<string>();
    expect(claimUniqueApprovedPbp({matchId:123,identity,seenMatchIds:seenIds,seenCanonicalKeys:seenKeys})).toBe(true);
    expect(claimUniqueApprovedPbp({matchId:123,identity,seenMatchIds:seenIds,seenCanonicalKeys:seenKeys})).toBe(false);
    expect(claimUniqueApprovedPbp({matchId:124,identity,seenMatchIds:seenIds,seenCanonicalKeys:seenKeys})).toBe(false);
  });

  it("enforces exact WTA Challenger approval status and excludes quarantine", async () => {
    expect(isApprovedWtaChallengerPbpRow({tour:"WTA_CHALLENGER",status:"APPROVED_WTA_CHALLENGER_PBP"})).toBe(true);
    expect(isApprovedWtaChallengerPbpRow({tour:"WTA_CHALLENGER",status:"QUARANTINED"})).toBe(false);
    expect(isApprovedWtaChallengerPbpRow({tour:"WTA_MAIN",status:"APPROVED_WTA_CHALLENGER_PBP"})).toBe(false);
    const raw = await readFile(join(process.cwd(),"data","metrics","pbp","wta_challenger","approved-index.jsonl"),"utf8");
    const rows = raw.split(/\r?\n/).filter(Boolean).map(line=>JSON.parse(line));
    expect(rows).toHaveLength(1645);
    expect(rows.every(isApprovedWtaChallengerPbpRow)).toBe(true);
  });

  it("never converts an undefined rate to zero", () => {
    const recovery = reconstructPbpScoreState({ sets:[{ games:[
      {server:"player1",points:[{winner:"player1"},{winner:"player1"},{winner:"player1"},{winner:"player1"}]},
      {server:"player2",points:[{winner:"player2"},{winner:"player2"},{winner:"player2"},{winner:"player2"}]},
    ]}]});
    expect(recovery.valid).toBe(true);
    expect(recovery.derived.player1["004"]?.value.conversion_pct).toBeNull();
    expect(recovery.derived.player1["036"]?.value.bp_saved_pct).toBeNull();
    expect(recovery.derived.player1["040"]?.value.deuce_point_win_pct).toBeNull();
  });

  it("fails closed on an ungraded tiebreak instead of guessing from the final point", () => {
    const recovery = reconstructPbpScoreState({ sets:[{ games:[{ server:"player1", tiebreak:true, points:[{winner:"player1"},{winner:"player2"},{winner:"player1"}] }] }] });
    expect(recovery.valid).toBe(false);
  });
});
