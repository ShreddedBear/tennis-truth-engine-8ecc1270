import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  provenPreMatch, selectCalibrationPopulation, summarizeCalibrationPopulation,
  type CalibrationCandidate,
} from "./calibration-population";

// A match audited N times must contribute exactly ONE calibration observation, never N.
// These tests pin the selection rule, the anti-leakage date proof, and that neither
// evidence coverage nor the active-metric count can influence which run is chosen.

const M1 = "match-1", M2 = "match-2";

function candidate(overrides: Partial<CalibrationCandidate> = {}): CalibrationCandidate {
  return {
    match_id: M1, audit_run_id: "run-1", run_number: 1,
    independent_decision_committed_at: "2026-08-29T10:00:00Z", scheduled_date: "2026-08-31",
    resolution_status: "WIN", ...overrides,
  };
}

describe("A/B. one match, many runs -> exactly one calibration observation, the latest eligible", () => {
  it("seven resolved runs for one match produce seven historical records but one observation", () => {
    const candidates: CalibrationCandidate[] = [
      candidate({ audit_run_id: "r1", run_number: 1, independent_decision_committed_at: "2026-08-25T09:00:00Z", resolution_status: "WIN" }),
      candidate({ audit_run_id: "r2", run_number: 2, independent_decision_committed_at: "2026-08-26T09:00:00Z", resolution_status: "WIN" }),
      candidate({ audit_run_id: "r3", run_number: 3, independent_decision_committed_at: "2026-08-27T09:00:00Z", resolution_status: "LOSS" }),
      candidate({ audit_run_id: "r4", run_number: 4, independent_decision_committed_at: "2026-08-28T09:00:00Z", resolution_status: "WIN" }),
      candidate({ audit_run_id: "r5", run_number: 5, independent_decision_committed_at: "2026-08-29T09:00:00Z", resolution_status: "WIN" }),
      candidate({ audit_run_id: "r6", run_number: 6, independent_decision_committed_at: "2026-08-31T09:00:00Z", resolution_status: "WIN" }), // same-day as match
      candidate({ audit_run_id: "r7", run_number: 7, independent_decision_committed_at: "2026-09-01T09:00:00Z", resolution_status: "WIN" }), // post-match rerun
    ];
    const result = selectCalibrationPopulation(candidates);
    expect(candidates).toHaveLength(7); // the historical record count is untouched
    expect(result.population).toHaveLength(1);
    expect(result.population[0].audit_run_id).toBe("r5"); // latest ELIGIBLE (r6/r7 excluded by date)
    expect(result.excluded).toHaveLength(6);
    const summary = summarizeCalibrationPopulation(candidates, result);
    expect(summary.historical_prediction_records).toBe(7);
    expect(summary.unique_matches).toBe(1);
    expect(summary.eligible_for_calibration).toBe(1);
  });
});

describe("C. a post-match rerun can never replace the pre-match observation", () => {
  it("the newest run by run_number is excluded when it was committed after the match", () => {
    const candidates = [
      candidate({ audit_run_id: "pre", run_number: 1, independent_decision_committed_at: "2026-08-29T08:00:00Z", resolution_status: "LOSS" }),
      candidate({ audit_run_id: "post", run_number: 2, independent_decision_committed_at: "2026-09-02T08:00:00Z", resolution_status: "WIN" }),
    ];
    const result = selectCalibrationPopulation(candidates);
    expect(result.population.map((c) => c.audit_run_id)).toEqual(["pre"]);
    const post = result.excluded.find((e) => e.audit_run_id === "post")!;
    expect(post.reason).toBe("COMMITTED_ON_OR_AFTER_MATCH_DATE");
  });
});

describe("D. two different matches each contribute exactly one observation", () => {
  it("keeps matches independent", () => {
    const candidates = [
      candidate({ match_id: M1, audit_run_id: "a1", run_number: 1, independent_decision_committed_at: "2026-08-20T00:00:00Z", scheduled_date: "2026-08-25", resolution_status: "WIN" }),
      candidate({ match_id: M2, audit_run_id: "b1", run_number: 1, independent_decision_committed_at: "2026-08-21T00:00:00Z", scheduled_date: "2026-08-26", resolution_status: "LOSS" }),
    ];
    const result = selectCalibrationPopulation(candidates);
    expect(result.population).toHaveLength(2);
    expect(new Set(result.population.map((c) => c.match_id))).toEqual(new Set([M1, M2]));
  });
});

describe("E. NULL actual_winner contributes zero observations", () => {
  it("an unresolved candidate never enters the population, eligible dates or not", () => {
    const candidates = [candidate({ resolution_status: "UNRESOLVED", independent_decision_committed_at: "2026-08-01T00:00:00Z" })];
    const result = selectCalibrationPopulation(candidates);
    expect(result.population).toEqual([]);
    expect(result.excluded[0].reason).toBe("NOT_RESOLVED");
  });
});

describe("F. a prediction without a provable pre-match timestamp is never silently included", () => {
  it("a same-day commit is ineligible -- there is no time-of-day proof either way", () => {
    expect(provenPreMatch("2026-08-31T05:00:00Z", "2026-08-31")).toEqual({ eligible: false, reason: "SAME_DAY_AS_MATCH_NO_TIME_OF_DAY_PROOF" });
  });
  it("a missing committed timestamp is ineligible", () => {
    expect(provenPreMatch(null, "2026-08-31")).toEqual({ eligible: false, reason: "NO_COMMITTED_DECISION_TIMESTAMP" });
  });
  it("a missing scheduled date is ineligible", () => {
    expect(provenPreMatch("2026-08-01T00:00:00Z", null)).toEqual({ eligible: false, reason: "NO_MATCH_SCHEDULED_DATE" });
  });
  it("a genuinely earlier calendar date is eligible", () => {
    expect(provenPreMatch("2026-08-01T23:59:59Z", "2026-08-02")).toEqual({ eligible: true, reason: null });
  });
  it("a match where every run is same-day or later contributes zero observations, not a guess", () => {
    const candidates = [
      candidate({ audit_run_id: "same-day", independent_decision_committed_at: "2026-08-31T02:00:00Z", scheduled_date: "2026-08-31", resolution_status: "WIN" }),
    ];
    const result = selectCalibrationPopulation(candidates);
    expect(result.population).toEqual([]);
  });
});

describe("G. P1/P2 inversion is symmetric", () => {
  it("selection depends only on resolution_status and timestamps, never on which side won", () => {
    const forward = selectCalibrationPopulation([candidate({ resolution_status: "WIN" })]);
    const inverted = selectCalibrationPopulation([candidate({ resolution_status: "LOSS" })]);
    expect(forward.population).toHaveLength(1);
    expect(inverted.population).toHaveLength(1);
    expect(forward.population[0].run_number).toBe(inverted.population[0].run_number);
  });
});

describe("H/I. evidence coverage and the active-metric denominator play no role in selection", () => {
  it("the candidate type cannot even carry coverage or metric-count fields", () => {
    const source = readFileSync("src/lib/calibration-population.ts", "utf8");
    for (const forbidden of ["coverage", "ACTIVE_METRIC", "evidence_support", "evidence_percent", "probability"]) {
      expect(source, forbidden).not.toContain(forbidden);
    }
  });
  it("selection among runs for one match is driven only by committed_at/run_number, not by anything evidence-shaped", () => {
    // Same match, same eligibility window; only run_number/timestamp differ. The later one
    // wins regardless of which had a stronger decision -- there is no such field to check.
    const candidates = [
      candidate({ audit_run_id: "weaker-but-later", run_number: 2, independent_decision_committed_at: "2026-08-25T00:00:00Z" }),
      candidate({ audit_run_id: "earlier", run_number: 1, independent_decision_committed_at: "2026-08-20T00:00:00Z" }),
    ];
    const result = selectCalibrationPopulation(candidates);
    expect(result.population[0].audit_run_id).toBe("weaker-but-later");
  });
});

describe("J. the actual match result remains the calibration target", () => {
  it("the selected observation's resolution_status is exactly what was already graded, untouched", () => {
    const result = selectCalibrationPopulation([candidate({ resolution_status: "LOSS" })]);
    expect(result.population[0].resolution_status).toBe("LOSS");
  });
});

describe("tie-break and superseding bookkeeping", () => {
  it("identical committed_at ties break on the higher run_number", () => {
    const candidates = [
      candidate({ audit_run_id: "low", run_number: 1, independent_decision_committed_at: "2026-08-20T00:00:00Z" }),
      candidate({ audit_run_id: "high", run_number: 2, independent_decision_committed_at: "2026-08-20T00:00:00Z" }),
    ];
    const result = selectCalibrationPopulation(candidates);
    expect(result.population[0].audit_run_id).toBe("high");
  });

  it("every non-selected resolved-and-eligible run is recorded as superseded, not dropped silently", () => {
    const candidates = [
      candidate({ audit_run_id: "older", run_number: 1, independent_decision_committed_at: "2026-08-20T00:00:00Z" }),
      candidate({ audit_run_id: "newer", run_number: 2, independent_decision_committed_at: "2026-08-25T00:00:00Z" }),
    ];
    const result = selectCalibrationPopulation(candidates);
    expect(result.excluded).toHaveLength(1);
    expect(result.excluded[0]).toMatchObject({ audit_run_id: "older", reason: "SUPERSEDED_BY_LATER_ELIGIBLE_DECISION_FOR_THE_SAME_MATCH" });
  });
});
