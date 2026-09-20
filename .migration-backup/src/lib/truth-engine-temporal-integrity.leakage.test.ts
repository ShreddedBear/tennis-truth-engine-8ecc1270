import { describe, expect, it } from "vitest";
import { auditCutoff, isBeforeCutoff, isAtOrBeforeCutoff } from "./temporal-boundary";
import { getStrengthTrajectoryStats } from "./predixsport-strength.server";
import { getRecentReconstruction } from "./predixsport-recent.server";
import { getCommonOpponentEvidence } from "./predixsport-common.server";
import { compareMetricRows, COMPARISON_SPECS } from "./truth-engine-metric-comparison";
import { runTruthEngineAudit } from "./truth-engine-audit";
import { MATRIX_SUMMARY_REQUIRED_CODES } from "./metric-classification";
import { deterministicPbpMetricFromPacket } from "./deterministic-pbp-metrics.server";

// PHASE 13 — forensic anti-leakage regression suite.
//
// The defect these tests exist to prevent: producers filtered source rows with
//     rows.filter(r => !cutoff || !r.date || r.date < cutoff)
// which fails open when the audited match has no date (1 of 55 live matches) and when a
// source row has no date. Proven live: with a date the producer returned nothing for a
// player with no prior matches; with the date removed it returned a current Elo of 1568.71.

const DATED = (d: string) => `tournament x · date ${d} · surface hard`;
const UNDATED = "tournament x · surface hard"; // what a null scheduled_date produces
const val = (rows: Array<{ key: string; value: number }>, k: string) => rows.find((r) => r.key === k)?.value ?? null;

describe("the temporal boundary itself", () => {
  it("parses the audited match date out of the pipeline context", () => {
    expect(auditCutoff(DATED("2024-05-02"))).toBe("2024-05-02");
  });

  it("reports an unestablished boundary rather than inventing one", () => {
    expect(auditCutoff(UNDATED)).toBeNull();
    expect(auditCutoff("")).toBeNull();
  });

  it("admits only rows provably before the boundary", () => {
    expect(isBeforeCutoff("2024-05-01", "2024-05-02")).toBe(true);
    expect(isBeforeCutoff("2024-05-03", "2024-05-02")).toBe(false);
  });

  it("excludes the audited day itself: same-day results are not prior information", () => {
    expect(isBeforeCutoff("2024-05-02", "2024-05-02")).toBe(false);
    expect(isAtOrBeforeCutoff("2024-05-02", "2024-05-02")).toBe(true);
  });

  it("refuses an undated row: unprovable is not admissible", () => {
    expect(isBeforeCutoff(null, "2024-05-02")).toBe(false);
    expect(isBeforeCutoff(undefined, "2024-05-02")).toBe(false);
    expect(isBeforeCutoff("", "2024-05-02")).toBe(false);
  });
});

describe("a match with no date yields no evidence, never all evidence", () => {
  // The exact live regression: these three producers feed active codes 001/005/055 and
  // 007/031/080. Before the fix the undated context returned the player's CURRENT state.
  it("Elo trajectory (001, 055) produces nothing without a boundary", () => {
    expect(getStrengthTrajectoryStats("Novak Djokovic", UNDATED)).toEqual([]);
  });

  it("recent form (005) produces nothing without a boundary", () => {
    expect(getRecentReconstruction("Novak Djokovic", UNDATED)).toEqual([]);
  });

  it("common opponents (007, 031, 080) produce nothing without a boundary", () => {
    expect(getCommonOpponentEvidence("Novak Djokovic", "Rafael Nadal", UNDATED)).toBeNull();
  });

  it("but a dated context still produces real evidence", () => {
    const stats = getStrengthTrajectoryStats("Novak Djokovic", DATED("2024-01-01"));
    expect(stats.length).toBeGreaterThan(0);
    expect(val(stats, "current_overall_elo")).toBeGreaterThan(0);
  });
});

describe("evidence is bounded by the cutoff, not by the file", () => {
  it("the common-opponent network can only grow as the boundary advances", () => {
    const counts = ["2016-01-01", "2018-01-01", "2020-01-01", "2022-01-01", "2024-01-01"].map(
      (d) => getCommonOpponentEvidence("Novak Djokovic", "Rafael Nadal", DATED(d))?.commonCount ?? 0,
    );
    // A shared opponent met before an early date is still shared later; one met later must
    // not appear earlier. Monotonic growth is the observable signature of that.
    for (let i = 1; i < counts.length; i++) expect(counts[i]).toBeGreaterThanOrEqual(counts[i - 1]);
    expect(counts[0]).toBeLessThan(counts[counts.length - 1]);
  });

  it("an earlier audit cannot see a later audit's evidence", () => {
    const early = getRecentReconstruction("Novak Djokovic", DATED("2016-01-01"));
    const late = getRecentReconstruction("Novak Djokovic", DATED("2024-01-01"));
    expect(early.length).toBeGreaterThan(0);
    expect(late.length).toBeGreaterThan(0);
    // Same player, same source; the only difference is the boundary, so the windows differ.
    expect(val(early, "last10_win_pct")).not.toBe(null);
    expect(JSON.stringify(early)).not.toBe(JSON.stringify(late));
  });
});

describe("a historical audit is reproducible and order-independent", () => {
  // Cross-run contamination: these producers hold a module-level cache of raw source rows.
  // A cache of SOURCE data is legitimate; a cache carrying one match's state into another
  // is not. Interleaving audits proves which kind this is.
  // `retrieved_at` is a wall-clock provenance stamp, not evidence; comparing it would only
  // prove that time passes. Everything that can affect a decision is compared.
  const stripStamps = (value: unknown): unknown =>
    JSON.parse(JSON.stringify(value), (key, v) => (key === "retrieved_at" ? undefined : v));

  const snapshot = (player: string, opponent: string, date: string) =>
    JSON.stringify(
      stripStamps({
        s: getStrengthTrajectoryStats(player, DATED(date)),
        r: getRecentReconstruction(player, DATED(date)),
        c: getCommonOpponentEvidence(player, opponent, DATED(date)),
      }),
    );

  it("A -> B -> C -> A reproduces A exactly", () => {
    const a1 = snapshot("Novak Djokovic", "Rafael Nadal", "2020-01-01");
    snapshot("Roger Federer", "Andy Murray", "2015-06-01");
    snapshot("Rafael Nadal", "Novak Djokovic", "2023-03-01");
    expect(snapshot("Novak Djokovic", "Rafael Nadal", "2020-01-01")).toBe(a1);
  });

  it("C -> A -> B -> A reproduces A exactly under a different order", () => {
    snapshot("Rafael Nadal", "Novak Djokovic", "2023-03-01");
    const a1 = snapshot("Novak Djokovic", "Rafael Nadal", "2020-01-01");
    snapshot("Roger Federer", "Andy Murray", "2015-06-01");
    expect(snapshot("Novak Djokovic", "Rafael Nadal", "2020-01-01")).toBe(a1);
  });

  it("the same audit run twice back to back is identical", () => {
    expect(snapshot("Roger Federer", "Andy Murray", "2015-06-01")).toBe(snapshot("Roger Federer", "Andy Murray", "2015-06-01"));
  });
});

describe("player identity, not the P1 slot, controls the evidence", () => {
  it("swapping the two players swaps their common-opponent records", () => {
    const forward = getCommonOpponentEvidence("Novak Djokovic", "Rafael Nadal", DATED("2020-01-01"))!;
    const swapped = getCommonOpponentEvidence("Rafael Nadal", "Novak Djokovic", DATED("2020-01-01"))!;
    expect(swapped.p1WinPct).toBe(forward.p2WinPct);
    expect(swapped.p2WinPct).toBe(forward.p1WinPct);
    expect(swapped.p1Wins).toBe(forward.p2Wins);
    expect(swapped.commonCount).toBe(forward.commonCount);
  });

  it("there is no hidden 'P1 is the favourite' assumption in the decision", () => {
    // Identical evidence, players exchanged: the winner must move slots, not stay in P1.
    const rows = (strongIsP1: boolean) => [
      { metric_code: "001", p1_value: strongIsP1 ? "surface_elo=1700" : "surface_elo=1400", p2_value: strongIsP1 ? "surface_elo=1400" : "surface_elo=1700", p1_treatment: "DIRECT", p2_treatment: "DIRECT" },
      { metric_code: "005", p1_value: strongIsP1 ? "last10_win_pct=80" : "last10_win_pct=20", p2_value: strongIsP1 ? "last10_win_pct=20" : "last10_win_pct=80", p1_treatment: "DIRECT", p2_treatment: "DIRECT" },
      { metric_code: "027", p1_value: strongIsP1 ? "lead_protection_rate_pct=95" : "lead_protection_rate_pct=40", p2_value: strongIsP1 ? "lead_protection_rate_pct=40" : "lead_protection_rate_pct=95", p1_treatment: "DIRECT", p2_treatment: "DIRECT" },
    ];
    const a = runTruthEngineAudit(compareMetricRows(rows(true)), "Ana", "Bo");
    const b = runTruthEngineAudit(compareMetricRows(rows(false)), "Ana", "Bo");
    expect(a.decision.outcome).toBe("P1");
    expect(a.decision.selected_player).toBe("Ana");
    expect(b.decision.outcome).toBe("P2");
    expect(b.decision.selected_player).toBe("Bo");
    // And the underdog is always the other player, never a fixed slot.
    expect(a.underdog.underdog_player).toBe("Bo");
    expect(b.underdog.underdog_player).toBe("Ana");
  });
});

describe("the quarantine and the registry stay separated", () => {
  it("no Matrix Summary code can enter the comparison registry", () => {
    for (const code of MATRIX_SUMMARY_REQUIRED_CODES) {
      expect(COMPARISON_SPECS[code], `${code} is quarantined`).toBeUndefined();
    }
  });
});

// PHASE 14 — the POINT_BY_POINT tier's same-day boundary.
//
// Phase 13.5 documented but did not fix this: every PBP source filter admitted rows dated
// ON the audited day (`<=` / `.lte()`), and the packet reader additionally admitted rows
// with NO date at all (`!r.event_date || ...`). Because the audited match is itself in the
// same BSD point-by-point index the producers read, a same-day row can be the audited
// match's OWN point record -- the engine reading the match it is predicting. This tier is
// shared by all eight active POINT_BY_POINT codes (002/003/009/016/018/032/034/053), so a
// leak here is a leak in all of them at once.
describe("Phase 14 — the audited match's own point-by-point record is inadmissible", () => {
  const AS_OF = "2026-03-10";
  const obs = (eventDate: string | null, player: string) => ({
    family: "POINT_BY_POINT",
    source: "BSD fixture",
    url: null,
    player,
    opponent: player === "Ana" ? "Bo" : "Ana",
    event_date: eventDate,
    key: "task18b_approved_pbp_score_state",
    // A minimally-shaped derived payload for 009, enough for metricText() to render.
    value: { derived: { "009": { treatment: "PARTIAL", value: { pressure_points: 20, pressure_points_won: 12, pressure_win_pct: 60 }, raw_fields: ["server"], transformation: "fixture" } } },
  });
  const packetOf = (rows: ReturnType<typeof obs>[]) => ({ "009": { observations: rows } });

  it("rejects a row dated the audited day itself -- that row can be the audited match", () => {
    const finding = deterministicPbpMetricFromPacket({
      metricCode: "009", p1: "Ana", p2: "Bo", asOfDate: AS_OF,
      packet: packetOf([obs(AS_OF, "Ana"), obs(AS_OF, "Bo")]),
    });
    expect(finding).toBeNull();
  });

  it("rejects a row dated after the audited day", () => {
    const finding = deterministicPbpMetricFromPacket({
      metricCode: "009", p1: "Ana", p2: "Bo", asOfDate: AS_OF,
      packet: packetOf([obs("2026-03-11", "Ana"), obs("2026-03-12", "Bo")]),
    });
    expect(finding).toBeNull();
  });

  it("rejects an undated row rather than assuming it is prior", () => {
    const finding = deterministicPbpMetricFromPacket({
      metricCode: "009", p1: "Ana", p2: "Bo", asOfDate: AS_OF,
      packet: packetOf([obs(null, "Ana"), obs(null, "Bo")]),
    });
    expect(finding).toBeNull();
  });

  it("still admits genuinely prior rows -- the fix excludes leakage, not evidence", () => {
    const finding = deterministicPbpMetricFromPacket({
      metricCode: "009", p1: "Ana", p2: "Bo", asOfDate: AS_OF,
      packet: packetOf([obs("2026-03-09", "Ana"), obs("2026-03-09", "Bo")]),
    });
    expect(finding).not.toBeNull();
    expect(finding!.p1_treatment).toBe("PARTIAL");
    expect(finding!.p2_treatment).toBe("PARTIAL");
    expect(finding!.evidence_family).toBe("POINT_BY_POINT");
  });

  it("drops only the same-day rows when prior and same-day rows are mixed together", () => {
    // The realistic production shape: a player's history plus the audited match itself.
    const finding = deterministicPbpMetricFromPacket({
      metricCode: "009", p1: "Ana", p2: "Bo", asOfDate: AS_OF,
      packet: packetOf([obs("2026-03-01", "Ana"), obs(AS_OF, "Ana"), obs("2026-03-01", "Bo"), obs(AS_OF, "Bo")]),
    });
    expect(finding).not.toBeNull();
    // 2 of the 4 observations survive -- one prior match per side, not two.
    expect(finding!.sample).toContain("p1_matches=1");
    expect(finding!.sample).toContain("p2_matches=1");
  });
});
