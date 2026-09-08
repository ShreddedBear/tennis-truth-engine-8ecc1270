// CALIBRATION BACKFILL -- turns already-resolved audit runs into
// truth_engine_calibration_observations rows, idempotently.
//
// This NEVER selects, computes, or overrides a winner: it reads the already-committed
// deterministic decision (see truth-engine-calibration.ts's module comment on leakage) and
// simply records it alongside the now-known real result. Running this twice over the same
// data must produce the same observations, not double them -- see `run` below.
//
// ONE OBSERVATION PER MATCH (Part 9): among a match's runs, only the run this candidate
// list names as "latest eligible" is ever written -- callers are expected to pass exactly
// one CalibrationCandidate per match_id (the latest COMPLETE run for that match), matching
// the existing "latest run wins" policy audit-repo.server.ts/match-result-capture.ts
// already use elsewhere. This module does not itself pick among multiple runs for a match.

import { buildCalibrationObservation, calibrationEligibility, type BuiltCalibrationObservation, type CalibrationCandidateDecision, type CalibrationCandidateMatch, type CalibrationCandidateRun } from "./truth-engine-calibration";

export interface CalibrationCandidate {
  match: CalibrationCandidateMatch;
  run: CalibrationCandidateRun;
  decision: CalibrationCandidateDecision;
}

export interface CalibrationBackfillDeps {
  now(): Date;
  /** Every candidate (match, latest-COMPLETE-run, its decision) worth considering. Callers
   *  supply the eligibility-relevant population; this module decides eligible/ineligible. */
  listCandidates(): Promise<CalibrationCandidate[]>;
  /** Existing observations, keyed by match_id, so a repeat run can detect "already have
   *  this exact one" without re-deriving it. */
  listExistingObservations(): Promise<Array<{ match_id: string; audit_run_id: string }>>;
  /** Upserts one observation. Implementations key this on match_id (eligible rows) --
   *  the DB's own partial unique index enforces the invariant even if a caller's dedup logic
   *  has a bug. */
  saveObservation(observation: BuiltCalibrationObservation): Promise<void>;
  /** A non-eligible candidate is still worth recording as such, so the exclusion reason is
   *  visible (Part 20's reason counts) -- optional so tests that only care about eligible
   *  rows can omit it. */
  saveIneligible?(matchId: string, auditRunId: string, reason: string): Promise<void>;
}

export interface CalibrationBackfillSummary {
  candidates_inspected: number;
  eligible: number;
  ineligible: number;
  written: number;
  skipped_already_present: number;
  exclusion_reason_counts: Record<string, number>;
}

/**
 * Idempotent: a candidate whose (match_id, audit_run_id) pair already has an observation
 * is skipped without re-deriving or re-writing it -- running this job twice over an
 * unchanged candidate list produces the same observation count both times, never double
 * counted, and never overwrites an existing frozen row with a fresh recomputation.
 */
export async function runCalibrationBackfill(deps: CalibrationBackfillDeps): Promise<CalibrationBackfillSummary> {
  const candidates = await deps.listCandidates();
  const existing = new Set((await deps.listExistingObservations()).map((r) => `${r.match_id}|${r.audit_run_id}`));
  const now = deps.now();
  const summary: CalibrationBackfillSummary = {
    candidates_inspected: candidates.length, eligible: 0, ineligible: 0, written: 0,
    skipped_already_present: 0, exclusion_reason_counts: {},
  };

  for (const candidate of candidates) {
    const verdict = calibrationEligibility(candidate.match, candidate.decision);
    if (!verdict.eligible) {
      summary.ineligible += 1;
      summary.exclusion_reason_counts[verdict.reason] = (summary.exclusion_reason_counts[verdict.reason] ?? 0) + 1;
      await deps.saveIneligible?.(candidate.match.id, candidate.run.id, verdict.reason);
      continue;
    }
    summary.eligible += 1;
    const key = `${candidate.match.id}|${candidate.run.id}`;
    if (existing.has(key)) { summary.skipped_already_present += 1; continue; }
    const observation = buildCalibrationObservation(candidate.match, candidate.run, candidate.decision, now);
    await deps.saveObservation(observation);
    summary.written += 1;
  }
  return summary;
}
