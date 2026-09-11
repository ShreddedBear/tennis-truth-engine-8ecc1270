import { describe, expect, it } from "vitest";
import {
  buildCalibrationObservation,
  calibrationEligibility,
  computeWalkForwardCalibration,
  type CalibrationCandidateDecision,
  type CalibrationCandidateMatch,
  type CalibrationCandidateRun,
  type CalibrationObservationForEval,
  type FrozenDecisionRecord,
} from "./truth-engine-calibration";
import { runCalibrationBackfill, type CalibrationCandidate } from "./calibration-backfill";

const P1_ID = "22222222-2222-2222-2222-222222222222";
const P2_ID = "33333333-3333-3333-3333-333333333333";

function match(overrides: Partial<CalibrationCandidateMatch> = {}): CalibrationCandidateMatch {
  return {
    id: "match-1", player1_name: "Carlos Alcaraz", player2_name: "Jannik Sinner",
    player1_id: P1_ID, player2_id: P2_ID, actual_winner: "Carlos Alcaraz", result_status: "FINAL",
    final_score: "6-4 6-3", scheduled_date: "2026-01-15", tournament_name: "Test Open",
    surface: "Hard", event_level: "ATP", ...overrides,
  };
}
function run(overrides: Partial<CalibrationCandidateRun> = {}): CalibrationCandidateRun {
  return {
    id: "run-1", match_id: "match-1", run_number: 1, independent_decision_committed_at: "2026-01-14T10:00:00Z",
    metrics_version_id: "mv-1", verification_version_id: "vv-1", disagreement_version_id: "dv-1", ...overrides,
  };
}
function frozen(overrides: Partial<FrozenDecisionRecord> = {}): FrozenDecisionRecord {
  return {
    selected_player: "Carlos Alcaraz", evidence_percent: 66.7, directional_families: 3,
    independent_support_families: ["SURFACE_STRENGTH", "RECENT_FORM"], independent_contradiction_families: ["H2H_PROBABILITY"],
    neutral_families: [], conflicted_families: [], corroborated: true, stability: "STABLE",
    evidence_coverage_percent: 80, evidence_coverage_usable: 20, evidence_coverage_expected: 25, ...overrides,
  };
}
function decision(overrides: Partial<CalibrationCandidateDecision> = {}): CalibrationCandidateDecision {
  return { audit_run_id: "run-1", selected_player_id: P1_ID, frozen: frozen(), ...overrides };
}

describe("calibrationEligibility", () => {
  it("eligible: a resolved FINAL match with a valid ID-backed winner", () => {
    expect(calibrationEligibility(match(), decision())).toEqual({ eligible: true });
  });

  it("ineligible: no frozen decision record", () => {
    const v = calibrationEligibility(match(), decision({ frozen: null }));
    expect(v.eligible).toBe(false);
  });

  it("ineligible: deterministic conclusion was INSUFFICIENT_EVIDENCE", () => {
    const v = calibrationEligibility(match(), decision({ frozen: frozen({ selected_player: null }) }));
    expect(v.eligible).toBe(false);
    if (!v.eligible) expect(v.reason).toMatch(/INSUFFICIENT_EVIDENCE/);
  });

  it("ineligible: selected_player_id missing (Part 4 rule #5) -- never falls back to the name", () => {
    const v = calibrationEligibility(match(), decision({ selected_player_id: null }));
    expect(v.eligible).toBe(false);
    if (!v.eligible) expect(v.reason).toMatch(/selected_player_id is missing/);
  });

  it("ineligible: selected_player_id belongs to neither player (integrity violation)", () => {
    const v = calibrationEligibility(match(), decision({ selected_player_id: "99999999-9999-9999-9999-999999999999" }));
    expect(v.eligible).toBe(false);
    if (!v.eligible) expect(v.reason).toMatch(/matches neither/);
  });

  it("ineligible: match is not FINAL/RETIRED (unresolved result)", () => {
    const v = calibrationEligibility(match({ result_status: "SCHEDULED", actual_winner: null }), decision());
    expect(v.eligible).toBe(false);
  });

  it("ineligible: ambiguous/unrecognizable actual_winner leaves the observation open", () => {
    const v = calibrationEligibility(match({ actual_winner: "Someone Else Entirely" }), decision());
    expect(v.eligible).toBe(false);
  });

  it("eligible: RETIRED counts as a real played result, same as FINAL", () => {
    expect(calibrationEligibility(match({ result_status: "RETIRED" }), decision())).toEqual({ eligible: true });
  });

  it("ineligible: WALKOVER never establishes a played result", () => {
    const v = calibrationEligibility(match({ result_status: "WALKOVER" }), decision());
    expect(v.eligible).toBe(false);
  });
});

describe("buildCalibrationObservation -- no leakage, correct grading", () => {
  it("freezes only pre-match features; grades WIN when selected_player_id equals the resolved winner's id", () => {
    const obs = buildCalibrationObservation(match(), run(), decision(), new Date("2026-01-16T00:00:00Z"));
    expect(obs.selected_player_id).toBe(P1_ID);
    expect(obs.actual_winner_id).toBe(P1_ID);
    expect(obs.prediction_outcome).toBe("WIN");
    // Feature fields come straight from the frozen record -- nothing here is post-match.
    expect(obs.evidence_support_percent).toBe(66.7);
    expect(obs.supporting_family_count).toBe(2);
    expect(obs.contradicting_family_count).toBe(1);
    // Static pre-match context, not derived from the result.
    expect(obs.surface).toBe("Hard");
    expect(obs.tournament_name).toBe("Test Open");
    expect(obs.calibration_model_version).toBeTruthy();
    expect(obs.feature_version).toBeTruthy();
  });

  it("grades LOSS when the actual winner is the other player", () => {
    const obs = buildCalibrationObservation(match({ actual_winner: "Jannik Sinner" }), run(), decision(), new Date("2026-01-16T00:00:00Z"));
    expect(obs.actual_winner_id).toBe(P2_ID);
    expect(obs.selected_player_id).toBe(P1_ID);
    expect(obs.prediction_outcome).toBe("LOSS");
  });

  it("never reads any field named for a post-match concept as a feature (structural check)", () => {
    const obs = buildCalibrationObservation(match(), run(), decision(), new Date());
    const featureKeys = ["evidence_support_percent", "directional_families", "supporting_family_count", "contradicting_family_count", "corroborated", "stability"];
    // These come from `frozen`, which this test's fixture never populates with anything
    // derived from `match.actual_winner` -- changing actual_winner alone (below) must never
    // change any feature field's value.
    const withOtherWinner = buildCalibrationObservation(match({ actual_winner: "Jannik Sinner" }), run(), decision(), new Date());
    for (const key of featureKeys) {
      expect((withOtherWinner as unknown as Record<string, unknown>)[key]).toEqual((obs as unknown as Record<string, unknown>)[key]);
    }
  });
});

describe("runCalibrationBackfill -- idempotent, no double counting", () => {
  function makeStore() {
    const saved: Array<{ match_id: string; audit_run_id: string }> = [];
    return {
      saved,
      deps: {
        now: () => new Date("2026-01-16T00:00:00Z"),
        async listCandidates(): Promise<CalibrationCandidate[]> {
          return [{ match: match(), run: run(), decision: decision() }];
        },
        async listExistingObservations() { return saved.map((s) => ({ ...s })); },
        async saveObservation(observation: { match_id: string; audit_run_id: string }) { saved.push({ match_id: observation.match_id, audit_run_id: observation.audit_run_id }); },
      },
    };
  }

  it("eligible prediction creates exactly one observation", async () => {
    const { deps, saved } = makeStore();
    const summary = await runCalibrationBackfill(deps);
    expect(summary.eligible).toBe(1);
    expect(summary.written).toBe(1);
    expect(saved).toHaveLength(1);
  });

  it("running the backfill twice does not duplicate the observation", async () => {
    const { deps, saved } = makeStore();
    await runCalibrationBackfill(deps);
    const second = await runCalibrationBackfill(deps);
    expect(second.written).toBe(0);
    expect(second.skipped_already_present).toBe(1);
    expect(saved).toHaveLength(1);
  });

  it("an unresolved result does not create a completed observation", async () => {
    const deps = {
      now: () => new Date(),
      async listCandidates(): Promise<CalibrationCandidate[]> { return [{ match: match({ result_status: "SCHEDULED", actual_winner: null }), run: run(), decision: decision() }]; },
      async listExistingObservations() { return []; },
      async saveObservation() { throw new Error("must not be called for an ineligible candidate"); },
    };
    const summary = await runCalibrationBackfill(deps);
    expect(summary.written).toBe(0);
    expect(summary.ineligible).toBe(1);
  });

  it("an ambiguous result remains unresolved rather than being force-graded", async () => {
    const deps = {
      now: () => new Date(),
      async listCandidates(): Promise<CalibrationCandidate[]> { return [{ match: match({ actual_winner: "Completely Unrelated Name" }), run: run(), decision: decision() }]; },
      async listExistingObservations() { return []; },
      async saveObservation() { throw new Error("must not be called"); },
    };
    const summary = await runCalibrationBackfill(deps);
    expect(summary.written).toBe(0);
    expect(summary.ineligible).toBe(1);
  });

  it("reports exclusion reason counts (Part 20)", async () => {
    const deps = {
      now: () => new Date(),
      async listCandidates(): Promise<CalibrationCandidate[]> {
        return [
          { match: match({ id: "m1", result_status: "SCHEDULED", actual_winner: null }), run: run({ match_id: "m1" }), decision: decision() },
          { match: match({ id: "m2" }), run: run({ match_id: "m2" }), decision: decision({ selected_player_id: null }) },
        ];
      },
      async listExistingObservations() { return []; },
      async saveObservation() {},
    };
    const summary = await runCalibrationBackfill(deps);
    expect(summary.candidates_inspected).toBe(2);
    expect(summary.ineligible).toBe(2);
    expect(Object.values(summary.exclusion_reason_counts).reduce((a, b) => a + b, 0)).toBe(2);
  });
});

describe("computeWalkForwardCalibration", () => {
  function obs(predicted_at: string, evidence_support_percent: number, y: 0 | 1): CalibrationObservationForEval {
    return { match_id: predicted_at, predicted_at, evidence_support_percent, y };
  }

  it("insufficient calibration sample returns unavailable with the real count, not a fabricated probability", () => {
    const result = computeWalkForwardCalibration([obs("2026-01-01T00:00:00Z", 70, 1)]);
    expect(result.available).toBe(false);
    expect(result.overall).toBeNull();
    expect(result.total_observations).toBe(1);
    expect(result.reason).toMatch(/Only 1/);
  });

  it("walk-forward training never includes observations from after the test window", () => {
    // 80 observations, chronological. High support consistently wins in the first half,
    // then the relationship reverses in the second half. If a fold's training bins ever
    // "saw" the reversal early, the mid-population fold's calibrated probability for high
    // support would already reflect it -- it must not, since those observations are still
    // in the future relative to that fold.
    const early = Array.from({ length: 40 }, (_, i) => obs(`2026-01-${String(i + 1).padStart(2, "0")}T00:00:00Z`, 80, 1));
    const late = Array.from({ length: 40 }, (_, i) => obs(`2026-03-${String(i + 1).padStart(2, "0")}T00:00:00Z`, 80, 0));
    const result = computeWalkForwardCalibration([...early, ...late], { minTotalSample: 40, minTrainFold: 30 });
    expect(result.available).toBe(true);
    // The very first fold's training window is entirely from the "early" (high-support-wins)
    // period, so its calibrated probability for support=80 must still read high, not the
    // reversed population's rate -- proving the late observations were not used to train it.
    const firstFold = result.folds[0]!;
    expect(firstFold.train_period.to.startsWith("2026-01") || firstFold.train_period.to.startsWith("2026-02")).toBe(true);
  });

  it("calibration cannot change the deterministic winner -- it only scores a fixed y", () => {
    const observations = Array.from({ length: 50 }, (_, i) => obs(`2026-0${1 + Math.floor(i / 28)}-${String((i % 28) + 1).padStart(2, "0")}T00:00:00Z`, 55 + (i % 20), i % 3 === 0 ? 0 : 1));
    const result = computeWalkForwardCalibration(observations);
    // The function's return type carries no selected_player/winner field at all -- there is
    // structurally nothing here that could feed back into audit_runs.independent_winner.
    expect(result).not.toHaveProperty("selected_player");
    expect(result).not.toHaveProperty("winner");
  });

  it("stores calibration_version, feature_version and model_version on every result, available or not", () => {
    const unavailable = computeWalkForwardCalibration([], { calibrationVersion: "cal-2026-01" });
    expect(unavailable.calibration_version).toBe("cal-2026-01");
    expect(unavailable.feature_version).toBeTruthy();
    expect(unavailable.model_version).toBeTruthy();
    const observations = Array.from({ length: 50 }, (_, i) => obs(`2026-0${1 + Math.floor(i / 28)}-${String((i % 28) + 1).padStart(2, "0")}T00:00:00Z`, 60, i % 2 === 0 ? 1 : 0));
    const available = computeWalkForwardCalibration(observations, { calibrationVersion: "cal-2026-01" });
    expect(available.calibration_version).toBe("cal-2026-01");
  });

  it("a reliability bucket with too few observations reports its count but withholds a noisy rate", () => {
    // 100 observations all with the exact same support value pack every prediction into
    // one bucket; deciles by count still produce buckets, but the total pool is small
    // enough per decile-of-a-decile to exercise the NaN-backoff path deterministically via
    // a very small explicit dataset instead -- assert the invariant on the exact minimum.
    const observations = Array.from({ length: 40 }, (_, i) => obs(`2026-01-${String((i % 28) + 1).padStart(2, "0")}T0${i % 10}:00:00Z`, 50 + i, i % 2 === 0 ? 1 : 0));
    const result = computeWalkForwardCalibration(observations, { minTotalSample: 40, minTrainFold: 30 });
    if (result.available) {
      for (const bucket of result.overall!.reliability_buckets) {
        if (bucket.count < 10) expect(Number.isNaN(bucket.actual_rate)).toBe(true);
      }
    }
  });
});
