import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { computeHistoryMetric, laneMatchesBefore, type HistoryLane } from "./task18c-rank-form-workload";
import { metricAllowsObservation, policyForMetric } from "./metric-source-family-policy";

const row = (date: string, tournament: string, surface: string, opponent: string, won: 0 | 1, round = "R32", source = "fixture") =>
  [date, tournament, surface, opponent, won, round, source] as const;

function symmetricLane(): HistoryLane {
  return {
    "alice alpha": [
      row("2026-08-20", "Event A", "Hard", "Carol Gamma", 1),
      row("2026-08-10", "Event B", "Clay", "Dana Delta", 0),
      row("2026-07-25", "Event C", "Hard", "Eva Epsilon", 1),
      row("2026-08-26", "Current Event", "Hard", "Bob Beta", 1),
      row("2026-08-27", "Future Event", "Hard", "Future Player", 1),
    ],
    "carol gamma": [row("2026-08-20", "Event A", "Hard", "Alice Alpha", 0)],
    "dana delta": [row("2026-08-10", "Event B", "Clay", "Alice Alpha", 1)],
    "eva epsilon": [row("2026-07-25", "Event C", "Hard", "Alice Alpha", 0)],
    "bob beta": [
      row("2026-08-18", "Event D", "Hard", "Gina Eta", 1),
      row("2026-08-02", "Event E", "Hard", "Hana Theta", 0),
      row("2026-07-20", "Event F", "Clay", "Iris Iota", 1),
      row("2026-08-26", "Current Event", "Hard", "Alice Alpha", 0),
    ],
    "gina eta": [row("2026-08-18", "Event D", "Hard", "Bob Beta", 0)],
    "hana theta": [row("2026-08-02", "Event E", "Hard", "Bob Beta", 1)],
    "iris iota": [row("2026-07-20", "Event F", "Clay", "Bob Beta", 0)],
  };
}

const base = { p1: "Alice Alpha", p2: "Bob Beta", asOfDate: "2026-08-26", surface: "Hard" } as const;

describe("Task 18C deterministic rank/form/workload core", () => {
  it.each(["ATP_MAIN", "WTA_MAIN", "ATP_CHALLENGER", "WTA_CHALLENGER"] as const)("reconstructs tour-isolated form on %s", family => {
    const result = computeHistoryMetric({ ...base, code: "005", family, lane: symmetricLane() });
    expect(result?.treatment).toBe("RECONSTRUCTED");
    expect(result?.sample).toContain(`tour=${family}`);
    expect(result?.p1_value).toContain("avg_opponent_pre_elo=");
    expect(result?.p2_value).toContain("avg_opponent_pre_elo=");
  });

  it("blocks current-match and future leakage", () => {
    const matches = laneMatchesBefore(symmetricLane(), "2026-08-26");
    expect(matches.every(match => match.date < "2026-08-26")).toBe(true);
    expect(matches.some(match => match.tournament === "Current Event")).toBe(false);
    expect(matches.some(match => match.tournament === "Future Event")).toBe(false);
  });

  it("does not convert missing player history into zero activity", () => {
    const lane = symmetricLane();
    delete lane["bob beta"];
    delete lane["gina eta"];
    delete lane["hana theta"];
    delete lane["iris iota"];
    expect(computeHistoryMetric({ ...base, code: "061", family: "ATP_MAIN", lane })).toBeNull();
  });

  it("keeps schedule/load and workload PARTIAL with exact missing-component reasons", () => {
    const schedule = computeHistoryMetric({ ...base, code: "007", family: "ATP_MAIN", lane: symmetricLane() });
    const workload = computeHistoryMetric({ ...base, code: "061", family: "ATP_MAIN", lane: symmetricLane() });
    expect(schedule?.treatment).toBe("PARTIAL");
    expect(schedule?.unavailable_reason).toMatch(/travel distance.*time-zone/i);
    expect(schedule?.unavailable_reason).toMatch(/no injury|subjective fatigue/i);
    expect(workload?.treatment).toBe("PARTIAL");
    expect(workload?.unavailable_reason).toMatch(/sets\/games.*duration/i);
  });

  it("uses explicit workload windows and nonzero rest from real history", () => {
    const result = computeHistoryMetric({ ...base, code: "061", family: "ATP_MAIN", lane: symmetricLane() });
    expect(result?.p1_value).toContain("matches_7d=1");
    expect(result?.p1_value).toContain("matches_14d=1");
    expect(result?.p1_value).toContain("days_since_last_match=6");
    expect(result?.p2_value).toContain("days_since_last_match=8");
  });

  it("supports reversed player orientation without borrowing histories", () => {
    const forward = computeHistoryMetric({ ...base, code: "021", family: "ATP_MAIN", lane: symmetricLane() });
    const reversed = computeHistoryMetric({ ...base, p1: base.p2, p2: base.p1, code: "021", family: "ATP_MAIN", lane: symmetricLane() });
    expect(reversed?.p1_value).toBe(forward?.p2_value);
    expect(reversed?.p2_value).toBe(forward?.p1_value);
  });

  it("requires actual current-surface history for Surface Strength", () => {
    const noGrass = computeHistoryMetric({ ...base, surface: "Grass", code: "001", family: "ATP_MAIN", lane: symmetricLane() });
    expect(noGrass).toBeNull();
    const hard = computeHistoryMetric({ ...base, code: "001", family: "ATP_MAIN", lane: symmetricLane() });
    expect(hard?.treatment).toBe("RECONSTRUCTED");
    expect(hard?.p1_value).toContain("surface=hard");
  });

  it("keeps lane data physically isolated", () => {
    const atpLane = symmetricLane();
    const wta125Lane: HistoryLane = { "alice alpha": [row("2026-08-20", "WTA 125", "Hard", "Carol Gamma", 1)], "carol gamma": [row("2026-08-20", "WTA 125", "Hard", "Alice Alpha", 0)] };
    expect(computeHistoryMetric({ ...base, code: "005", family: "ATP_MAIN", lane: atpLane })).not.toBeNull();
    expect(computeHistoryMetric({ ...base, code: "005", family: "WTA_CHALLENGER", lane: wta125Lane })).toBeNull();
  });
});

describe("Task 18C source-family false-green firewall", () => {
  const schedule = { source_id: "atp", observation_type: "MATCH_RESULT_OR_SCHEDULE", observation_key: "match_record" };
  const environment = { source_id: "open_meteo", observation_type: "ENVIRONMENT", observation_key: "weather" };

  it("uses chronological results, not weather, as the sufficient Elo source family", () => {
    expect(metricAllowsObservation("021", schedule)).toBe(true);
    expect(metricAllowsObservation("021", environment)).toBe(false);
    expect(policyForMetric("021").sufficient_families).toEqual(["RESULTS_SCHEDULE"]);
  });

  it("allows result/schedule observations to support partial workload without treating them as complete", () => {
    expect(metricAllowsObservation("061", schedule)).toBe(true);
    expect(policyForMetric("061").sufficient_families).toEqual([]);
    expect(policyForMetric("061").support_only_families).toContain("RESULTS_SCHEDULE");
  });
});

describe("Task 18C production ranking firewall wiring", () => {
  const ranking = readFileSync("src/lib/deterministic-ranking-metrics.server.ts", "utf8");
  const warehouse = readFileSync("src/lib/warehouse-first-researcher.server.ts", "utf8");

  it("uses ATP rankings for ATP Main/Challenger and WTA rankings for WTA Main/WTA125 without a fake WTA Challenger circuit", () => {
    expect(ranking).toContain('family === "ATP_MAIN" || family === "ATP_CHALLENGER"');
    expect(ranking).toContain('family === "WTA_MAIN" || family === "WTA_CHALLENGER"');
    expect(ranking).toContain('return "ATP"');
    expect(ranking).toContain('return "WTA"');
    expect(ranking).toContain("There is deliberately no WTA-Challenger ranking namespace");
  });

  it("requires pair-complete ranking evidence and classifies metric 014 as DIRECT", () => {
    expect(ranking).toContain("if (!p1 || !p2) return null; // one-sided ranking evidence fails closed");
    expect(ranking).toContain('p1_treatment: "DIRECT"');
    expect(ranking).toContain('p2_treatment: "DIRECT"');
  });

  it("keeps ranking observations at or before the historical match date", () => {
    expect(ranking).toContain('.lte("event_date", asOfDate)');
    expect(ranking).toContain("row.event_date <= args.asOfDate");
  });

  it("canonicalizes both players before deterministic 18C dispatch", () => {
    const canonical = warehouse.indexOf("resolveCanonicalEvidencePair(input.p1, input.p2)");
    const deterministic = warehouse.indexOf("deterministicRankingMetric({");
    expect(canonical).toBeGreaterThan(-1);
    expect(deterministic).toBeGreaterThan(canonical);
  });

  it("does not false-green unrelated metric 062 or 069 through ranking data", () => {
    expect(ranking).not.toContain('"062"');
    expect(ranking).not.toContain('"069"');
  });
});
