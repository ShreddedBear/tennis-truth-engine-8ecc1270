// CALIBRATION POPULATION GOVERNANCE -- selects at most ONE calibration observation per
// match out of potentially many resolved prediction records for that match.
//
// result_grades intentionally keeps one row per audit_run_id: every Truth Engine
// prediction stays historically auditable (see match-result-capture.ts). That is the
// PREDICTION HISTORY, and this module does not touch it or change how any individual run
// is graded WIN/LOSS/UNRESOLVED.
//
// What this module adds is the layer above it: a match audited seven times must count once
// in a calibration dataset, or the engine's seven opinions about one outcome would carry
// 7x the weight of a match it only ever looked at once. That distorts whatever a future
// calibration layer learns from the population.
//
// THE ANTI-LEAKAGE RULE. A rerun of a match after its result is already known is not a
// prediction -- it is hindsight, and must never become the calibration observation just
// because it is the newest run. The only proof available in this schema that a decision
// predates the match is a DATE-level comparison: matches.scheduled_date is a calendar date
// with no time-of-day (scheduled_utc_at / scheduled_local_at / actual_first_serve_at are
// unpopulated in production -- 0 of 55, confirmed live), and audit_runs
// .independent_decision_committed_at is a real timestamp. That pairing can prove "this
// decision was committed on an earlier calendar day than the match," and nothing finer.
// A same-day commit is NOT proof of precedence -- it could be hours before first serve or
// hours after the match ended -- so it is marked ineligible rather than guessed at.
//
// WHY independent_decision_committed_at AND NOT A final_decisions TIMESTAMP. The
// deterministic winner is fixed once, at INDEPENDENT CONCLUSION (commitConclusion in
// audit-pipeline.ts), from the same persisted metric_results FINAL DECISION later replays
// to build the decision record -- the two stages compute the identical deterministic
// result from evidence that cannot change in between. independent_decision_committed_at is
// the EARLIER of the two available timestamps, structurally provable to precede Matrix
// Reveal (the firewall stage requires it to be set first), which makes it the more
// conservative -- and therefore correct -- choice for an anti-leakage proof.

export interface CalibrationCandidate {
  match_id: string;
  audit_run_id: string;
  run_number: number;
  /** audit_runs.independent_decision_committed_at -- when the deterministic winner was fixed. */
  independent_decision_committed_at: string | null;
  /** matches.scheduled_date -- a calendar date only, never a time. */
  scheduled_date: string | null;
  /** Whatever match-result-capture already decided. This module never recomputes it. */
  resolution_status: "WIN" | "LOSS" | "UNRESOLVED";
}

export interface EligibilityResult {
  eligible: boolean;
  reason: string | null;
}

/**
 * Can this run's committed decision be PROVEN to predate the match, using only what the
 * schema actually carries? Yes only when both dates exist and the commit's calendar date
 * (UTC) is strictly earlier than the match's scheduled date. Anything else -- missing data,
 * a same-day commit, a commit dated on or after the match -- returns ineligible with the
 * reason, never a guess.
 */
export function provenPreMatch(committedAt: string | null, scheduledDate: string | null): EligibilityResult {
  if (!committedAt) return { eligible: false, reason: "NO_COMMITTED_DECISION_TIMESTAMP" };
  if (!scheduledDate) return { eligible: false, reason: "NO_MATCH_SCHEDULED_DATE" };
  const parsed = new Date(committedAt);
  if (Number.isNaN(parsed.getTime())) return { eligible: false, reason: "UNPARSEABLE_COMMITTED_TIMESTAMP" };
  const committedDate = parsed.toISOString().slice(0, 10);
  if (committedDate < scheduledDate) return { eligible: true, reason: null };
  if (committedDate === scheduledDate) {
    // No time-of-day is available on either side (see the module comment) -- a same-day
    // commit could be hours before first serve or hours after the match ended. Proving
    // neither, this is marked ineligible rather than assumed pre-match.
    return { eligible: false, reason: "SAME_DAY_AS_MATCH_NO_TIME_OF_DAY_PROOF" };
  }
  return { eligible: false, reason: "COMMITTED_ON_OR_AFTER_MATCH_DATE" };
}

export interface ExcludedCandidate extends CalibrationCandidate {
  reason: string;
}

export interface CalibrationPopulationResult {
  /** Exactly one entry per match: the latest eligible pre-match decision for that match. */
  population: CalibrationCandidate[];
  /** Every candidate that did NOT become the match's observation, with why. */
  excluded: ExcludedCandidate[];
}

const EXCLUDED_UNRESOLVED = "NOT_RESOLVED";
const EXCLUDED_SUPERSEDED = "SUPERSEDED_BY_LATER_ELIGIBLE_DECISION_FOR_THE_SAME_MATCH";

/**
 * Group candidates by match, and keep only the latest eligible, resolved decision per match.
 *
 * Selection order within a match: eligible (per provenPreMatch) AND resolved, then the
 * latest independent_decision_committed_at, then the highest run_number as a tiebreaker for
 * the pathological case of two runs committing in the same instant. A match with resolved
 * runs but none provably pre-match contributes ZERO observations -- it is excluded, not
 * silently defaulted to whichever run happens to exist.
 */
export function selectCalibrationPopulation(candidates: readonly CalibrationCandidate[]): CalibrationPopulationResult {
  const byMatch = new Map<string, CalibrationCandidate[]>();
  for (const c of candidates) {
    const list = byMatch.get(c.match_id) ?? [];
    list.push(c);
    byMatch.set(c.match_id, list);
  }

  const population: CalibrationCandidate[] = [];
  const excluded: ExcludedCandidate[] = [];

  for (const group of byMatch.values()) {
    const eligible: CalibrationCandidate[] = [];
    for (const c of group) {
      if (c.resolution_status === "UNRESOLVED") {
        excluded.push({ ...c, reason: EXCLUDED_UNRESOLVED });
        continue;
      }
      const { eligible: isEligible, reason } = provenPreMatch(c.independent_decision_committed_at, c.scheduled_date);
      if (!isEligible) {
        excluded.push({ ...c, reason: reason! });
        continue;
      }
      eligible.push(c);
    }
    if (!eligible.length) continue;

    eligible.sort((a, b) => {
      const byTime = String(b.independent_decision_committed_at).localeCompare(String(a.independent_decision_committed_at));
      return byTime !== 0 ? byTime : b.run_number - a.run_number;
    });
    const [selected, ...rest] = eligible;
    population.push(selected);
    for (const r of rest) excluded.push({ ...r, reason: EXCLUDED_SUPERSEDED });
  }

  return { population, excluded };
}

export interface CalibrationPopulationSummary {
  historical_prediction_records: number;
  unique_matches: number;
  eligible_for_calibration: number;
  excluded_total: number;
  excluded_by_reason: Record<string, number>;
}

export function summarizeCalibrationPopulation(candidates: readonly CalibrationCandidate[], result: CalibrationPopulationResult): CalibrationPopulationSummary {
  const excluded_by_reason: Record<string, number> = {};
  for (const e of result.excluded) excluded_by_reason[e.reason] = (excluded_by_reason[e.reason] ?? 0) + 1;
  return {
    historical_prediction_records: candidates.length,
    unique_matches: new Set(candidates.map((c) => c.match_id)).size,
    eligible_for_calibration: result.population.length,
    excluded_total: result.excluded.length,
    excluded_by_reason,
  };
}
