// Wires the "New Signal Batch 1" standalone audit-metric modules
// (027/029/031/041/046/051) into the LIVE researcher pipeline.
//
// Context: docs/ARCHITECTURE-FINDING-disconnected-hybrid-researcher.md
// documents (and fixed) an earlier disconnected-evidence-layer problem for a
// different subsystem (the PredixSport/DataHub CSV warehouse + live WTA
// API). This file follows the exact same remediation pattern for a second,
// unrelated disconnected layer: audit-metric-027-opponent-finishing-ability.ts,
// audit-metric-029-psychological-response-proxy.ts,
// audit-metric-031-common-opponent-point-differential.ts,
// audit-metric-041-hidden-improvement-detector.ts,
// audit-metric-046-match-state-elo.ts, and
// audit-metric-051-opponent-specific-probability.ts were built, tested, and
// documented against the real evidence-gap.ts catalog entries for their
// codes, but never called from warehouse-first-researcher.server.ts (or
// anywhere else in the live pipeline) -- only from their own unit tests.
// (029 was reconnected in a later pass than the other five -- same finding,
// same fix, applied to this file rather than a separate one since it is the
// exact same single-player LaneOutcome<T> reconnection pattern.)
//
// This module does not change any of those five modules' math or logic. It
// only adapts their `LaneOutcome<T>` return shape into this app's
// `MetricFinding` shape and inserts a new tier for these five codes,
// consistent with the "GO -> usable value / NOT_ENOUGH_DATA -> fall through
// to the next tier" contract every other tier in this pipeline already
// follows: a code that is not fully usable here (both players GO) returns
// null, letting warehouse-first-researcher.server.ts continue on to the
// PBP-packet / CSV-warehouse / live-AI-search tiers exactly as before this
// change existed.
import type { EvidenceTourFamily } from "./evidence-match-identity";
import type { MetricFinding } from "./audit-pipeline";
import { certifyMetricFinding } from "./metric-certification";
import type { TourLane } from "./audit-metrics-shared";
import { loadRuntimeIndex } from "./runtime-tennis-index-data.server";
import { replayElo } from "./task18c-rank-form-workload";
import { computeOpponentFinishingAbility } from "./audit-metric-027-opponent-finishing-ability";
import { computeCommonOpponentPointDifferential } from "./audit-metric-031-common-opponent-point-differential";
import { computePsychologicalResponseProxy } from "./audit-metric-029-psychological-response-proxy";
import { computeHiddenImprovementDetector } from "./audit-metric-041-hidden-improvement-detector";
import { computeMatchStateElo } from "./audit-metric-046-match-state-elo";
import { computeOpponentSpecificProbability } from "./audit-metric-051-opponent-specific-probability";

// "029" (Psychological Response Proxy) added to this same reconnection tier
// per the same finding this file's header already documents for
// 027/031/041/046/051: audit-metric-029-psychological-response-proxy.ts was
// built, tested in isolation, and documented against evidence-gap.ts's real
// #029 catalog entry, but (verified by grep -- nothing outside its own
// .test.ts imported it) was never called from warehouse-first-researcher.
// server.ts or any live dispatch path. This module does not change its
// math/logic -- only adapts its LaneOutcome<T> return into MetricFinding,
// exactly like the other five codes here.
const OWNED = new Set(["027", "029", "031", "041", "046", "051"]);

function codeOf(value: unknown) {
  const m = String(value ?? "").match(/(\d{1,3})$/);
  return m ? m[1].padStart(3, "0") : String(value ?? "").padStart(3, "0");
}

function fmt(obj: Record<string, unknown>): string {
  return Object.entries(obj).map(([k, v]) => `${k}=${v === null || v === undefined ? "NA" : v}`).join("; ");
}

function expectedWinProbability(a: number, b: number): number {
  return 100 / (1 + 10 ** ((b - a) / 400));
}

// A discriminated union rather than the old `T | null`: `null` carried zero information
// about WHY a side wasn't GO, which is exactly what turned every genuine
// `LaneOutcome`-stated NOT_ENOUGH_DATA `reason` (audit-metrics-shared.ts's `laneOutcome()`
// already computes one, evidence-based, per side) into an indistinguishable-from-nothing
// PRODUCER_FAILED_WITHOUT_REASON miss downstream. This never changes WHICH matches get a
// usable value -- still strictly both-sides-GO, nothing partial or guessed -- it only
// keeps the real reason instead of discarding it.
type FoundValues =
  | { ok: true; p1Value: string; p2Value: string; n: number }
  | { ok: false; p1Reason: string | null; p2Reason: string | null };

function notEnoughDataReason<T extends { status: string }>(outcome: T): string | null {
  return outcome.status === "NOT_ENOUGH_DATA" ? (outcome as unknown as { reason: string }).reason : null;
}

function finishingAbility027(p1: string, p2: string, lane: TourLane, asOfDate: string): FoundValues {
  const a = computeOpponentFinishingAbility({ player: p1, lane, asOfDate });
  const b = computeOpponentFinishingAbility({ player: p2, lane, asOfDate });
  if (a.status !== "GO" || b.status !== "GO") return { ok: false, p1Reason: notEnoughDataReason(a), p2Reason: notEnoughDataReason(b) };
  return {
    ok: true,
    p1Value: fmt({ lead_protection_n: a.value.lead_protection.n, lead_protection_rate_pct: a.value.lead_protection.rate, closing_as_underdog_n: a.value.closing_as_underdog.n, closing_as_underdog_rate_pct: a.value.closing_as_underdog.rate, trailing_n_used: a.value.trailing_n_used }),
    p2Value: fmt({ lead_protection_n: b.value.lead_protection.n, lead_protection_rate_pct: b.value.lead_protection.rate, closing_as_underdog_n: b.value.closing_as_underdog.n, closing_as_underdog_rate_pct: b.value.closing_as_underdog.rate, trailing_n_used: b.value.trailing_n_used }),
    n: Math.min(a.n, b.n),
  };
}

function psychologicalResponseProxy029(p1: string, p2: string, lane: TourLane, asOfDate: string): FoundValues {
  const a = computePsychologicalResponseProxy({ player: p1, lane, asOfDate });
  const b = computePsychologicalResponseProxy({ player: p2, lane, asOfDate });
  if (a.status !== "GO" || b.status !== "GO") return { ok: false, p1Reason: notEnoughDataReason(a), p2Reason: notEnoughDataReason(b) };
  const fmtSide = (r: typeof a.value) => fmt({
    trailing_n_used: r.trailing_n_used,
    baseline_match_win_rate_n: r.baseline_match_win_rate.n,
    baseline_match_win_rate_pct: r.baseline_match_win_rate.rate,
    after_close_set_loss_n: r.after_close_set_loss.n,
    after_close_set_loss_next_set_win_pct: r.after_close_set_loss.next_set_win_rate,
    after_close_set_loss_match_win_pct: r.after_close_set_loss.match_win_rate,
  });
  return { ok: true, p1Value: fmtSide(a.value), p2Value: fmtSide(b.value), n: Math.min(a.n, b.n) };
}

function commonOpponentDifferential031(p1: string, p2: string, lane: TourLane, asOfDate: string): FoundValues {
  const result = computeCommonOpponentPointDifferential({ player: p1, reference: p2, lane, asOfDate });
  if (result.status !== "GO") {
    const reason = notEnoughDataReason(result);
    return { ok: false, p1Reason: reason, p2Reason: reason };
  }
  const v = result.value;
  return {
    ok: true,
    p1Value: fmt({ common_opponents_n: v.common_opponents_n, adjusted_set_differential: v.player_adjusted_set_differential, opponent_adjusted_set_differential: v.reference_adjusted_set_differential, differential_vs_opponent: v.differential }),
    p2Value: fmt({ common_opponents_n: v.common_opponents_n, adjusted_set_differential: v.reference_adjusted_set_differential, opponent_adjusted_set_differential: v.player_adjusted_set_differential, differential_vs_opponent: -v.differential }),
    n: v.common_opponents_n,
  };
}

function hiddenImprovement041(p1: string, p2: string, lane: TourLane, asOfDate: string): FoundValues {
  const a = computeHiddenImprovementDetector({ player: p1, lane, asOfDate });
  const b = computeHiddenImprovementDetector({ player: p2, lane, asOfDate });
  if (a.status !== "GO" || b.status !== "GO") return { ok: false, p1Reason: notEnoughDataReason(a), p2Reason: notEnoughDataReason(b) };
  const fmtSide = (r: typeof a.value) => fmt({ flag: r.flag, earlier_n: r.earlier_half.n, earlier_win_rate_pct: r.earlier_half.raw_win_rate, earlier_elo_adjusted_surplus: r.earlier_half.mean_elo_adjusted_surplus, recent_n: r.recent_half.n, recent_win_rate_pct: r.recent_half.raw_win_rate, recent_elo_adjusted_surplus: r.recent_half.mean_elo_adjusted_surplus });
  return { ok: true, p1Value: fmtSide(a.value), p2Value: fmtSide(b.value), n: Math.min(a.n, b.n) };
}

function matchStateElo046(p1: string, p2: string, lane: TourLane, asOfDate: string): FoundValues {
  const a = computeMatchStateElo({ player: p1, lane, asOfDate });
  const b = computeMatchStateElo({ player: p2, lane, asOfDate });
  if (a.status !== "GO" || b.status !== "GO") return { ok: false, p1Reason: notEnoughDataReason(a), p2Reason: notEnoughDataReason(b) };
  return {
    ok: true,
    p1Value: fmt({ elo_after_winning_set1: a.value.after_winning_set1, elo_after_losing_set1: a.value.after_losing_set1 }),
    p2Value: fmt({ elo_after_winning_set1: b.value.after_winning_set1, elo_after_losing_set1: b.value.after_losing_set1 }),
    n: Math.min(a.n, b.n),
  };
}

// General (non-opponent-specific) win probability for the shrinkage core:
// derived from the same lane's overall derived-Elo replay
// (task18c-rank-form-workload.ts's replayElo) already relied on elsewhere in
// this pipeline (see #031/#041 above) as the strength model when rank data
// is sparse/absent. This is computed here, once per lane/asOfDate, rather
// than inside audit-metric-051-opponent-specific-probability.ts itself,
// because that module deliberately takes the general probability as a
// caller-supplied input (its own header: "This module does not compute that
// number itself; it only shrinks it toward the H2H rate").
function opponentSpecificProbability051(p1: string, p2: string, lane: TourLane, asOfDate: string): FoundValues {
  const historyLane = loadRuntimeIndex().matchHistory[lane as EvidenceTourFamily];
  const replay = replayElo(historyLane as never, asOfDate);
  const eloP1 = replay.overall.get(p1) ?? 1500;
  const eloP2 = replay.overall.get(p2) ?? 1500;
  const p1GeneralProb = expectedWinProbability(eloP1, eloP2);
  const p2GeneralProb = expectedWinProbability(eloP2, eloP1);
  const a = computeOpponentSpecificProbability({ player: p1, opponent: p2, lane, asOfDate, generalWinProbabilityPct: p1GeneralProb });
  const b = computeOpponentSpecificProbability({ player: p2, opponent: p1, lane, asOfDate, generalWinProbabilityPct: p2GeneralProb });
  if (a.status !== "GO" || b.status !== "GO") return { ok: false, p1Reason: notEnoughDataReason(a), p2Reason: notEnoughDataReason(b) };
  const fmtSide = (r: typeof a.value) => fmt({ n_h2h: r.n_h2h, raw_h2h_win_pct: r.raw_h2h_win_pct, general_win_probability_pct: r.general_win_probability_pct, shrinkage_weight: r.shrinkage_weight, shrunk_win_probability_pct: r.shrunk_win_probability_pct });
  return { ok: true, p1Value: fmtSide(a.value), p2Value: fmtSide(b.value), n: Math.min(a.n, b.n) };
}

/**
 * Live wrapper for the deterministic-*-metrics.server.ts tier chain in
 * warehouse-first-researcher.server.ts. Never emits a usable value unless BOTH
 * players resolve to a GO lane outcome -- this tier never emits a partial/
 * one-sided VALUE for these codes. When neither side is GO (or the underlying
 * computation throws), it returns an UNAVAILABLE finding carrying the real,
 * already-computed reason instead of bare `null`, so the reason is not lost --
 * but this still does not stop the pipeline from trying later tiers: an
 * UNAVAILABLE finding is not `fullyUsableFinding`, so warehouse-first-
 * researcher.server.ts's `liveMissing` filter still includes this code and the
 * live-AI tier still gets a chance to find real evidence. Only bare `null` (no
 * evidence-based reason at all) is returned when there is truly nothing to
 * report, letting the caller's `if (batch1) return batch1;` fall through as
 * before.
 */
export async function deterministicBatch1StandaloneMetric(args: { metricCode: string; p1: string; p2: string; asOfDate: string; tourFamily?: EvidenceTourFamily | null }): Promise<MetricFinding | null> {
  const code = codeOf(args.metricCode);
  if (!OWNED.has(code)) return null;
  const lane = args.tourFamily as TourLane | null | undefined;
  if (!lane) return null;
  const { p1, p2, asOfDate } = args;
  const source = { source_name: "Four-tour static history index (data/generated/tennis-runtime-index.json)", url: null, retrieved_at: null };
  let found: FoundValues | null = null;
  let evidenceFamily = "";
  let caughtReason: string | null = null;
  try {
    if (code === "027") { found = finishingAbility027(p1, p2, lane, asOfDate); evidenceFamily = "STANDALONE_OPPONENT_FINISHING_ABILITY"; }
    else if (code === "029") { found = psychologicalResponseProxy029(p1, p2, lane, asOfDate); evidenceFamily = "STANDALONE_PSYCHOLOGICAL_RESPONSE_PROXY"; }
    else if (code === "031") { found = commonOpponentDifferential031(p1, p2, lane, asOfDate); evidenceFamily = "STANDALONE_COMMON_OPPONENT_DIFFERENTIAL"; }
    else if (code === "041") { found = hiddenImprovement041(p1, p2, lane, asOfDate); evidenceFamily = "STANDALONE_HIDDEN_IMPROVEMENT"; }
    else if (code === "046") { found = matchStateElo046(p1, p2, lane, asOfDate); evidenceFamily = "STANDALONE_MATCH_STATE_ELO"; }
    else if (code === "051") { found = opponentSpecificProbability051(p1, p2, lane, asOfDate); evidenceFamily = "STANDALONE_OPPONENT_SPECIFIC_PROBABILITY"; }
  } catch (error) {
    // Previously a silent `return null` -- indistinguishable from "no data" downstream,
    // even though a thrown exception here means the static index/computation genuinely
    // broke. Falling through to the next tier is still correct (never fabricate a value
    // from a broken lane), but the real error is now carried along instead of discarded,
    // so it is classified as a producer failure rather than an unexplained one.
    caughtReason = error instanceof Error ? error.message : String(error);
    found = null;
  }
  if (!found) {
    if (!caughtReason) return null; // no lane at all for this code -- genuinely nothing to report, next tier decides
    return certifyMetricFinding({
      metric_code: code, p1_value: null, p2_value: null, p1_treatment: "UNAVAILABLE", p2_treatment: "UNAVAILABLE",
      differential: null, evidence_family: evidenceFamily, reliability: null,
      sample: `standalone metric #${code} deterministic replay through ${asOfDate}; tour_lane=${lane}; computation error`,
      unavailable_reason: caughtReason, sources: [],
    });
  }
  if (!found.ok) {
    if (!found.p1Reason && !found.p2Reason) return null; // GO/GO impossible here, but no evidence-based reason either -- let the next tier try
    return certifyMetricFinding({
      metric_code: code, p1_value: null, p2_value: null, p1_treatment: "UNAVAILABLE", p2_treatment: "UNAVAILABLE",
      differential: null, evidence_family: evidenceFamily, reliability: null,
      sample: `standalone metric #${code} deterministic replay through ${asOfDate}; tour_lane=${lane}; insufficient data`,
      unavailable_reason: [found.p1Reason, found.p2Reason].filter(Boolean).join(" | ") || null,
      p1_unavailable_reason: found.p1Reason, p2_unavailable_reason: found.p2Reason,
      sources: [source],
    });
  }
  return certifyMetricFinding({
    metric_code: code,
    p1_value: found.p1Value,
    p2_value: found.p2Value,
    p1_treatment: "RECONSTRUCTED",
    p2_treatment: "RECONSTRUCTED",
    differential: null,
    evidence_family: evidenceFamily,
    reliability: 82,
    sample: `standalone metric #${code} deterministic replay through ${asOfDate}; tour_lane=${lane}; n=${found.n}`,
    unavailable_reason: null,
    sources: [source],
  });
}
