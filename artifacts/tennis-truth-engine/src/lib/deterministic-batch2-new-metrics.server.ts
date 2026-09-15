// Wires the four newly-built (this task) standalone audit-metric modules --
// 020 (Level/Tour Transition), 036 (Loss Autopsy Metrics), 045 (Favorite
// Fragility Under Resistance), and 052 (Entropy & Lead Durability) -- into
// the LIVE researcher pipeline. Same reconnection pattern as
// deterministic-batch1-standalone-metrics.server.ts (which wires the
// earlier 027/031/041/046/051 batch): adapts each module's LaneOutcome<T>
// into this app's MetricFinding shape, GO on both players -> a real
// certified finding, anything else -> null (fall through to the next
// tier). No fabrication: a lane a module structurally cannot support
// (missing set_scores, etc.) always falls through here, never gets a
// guessed value.
import type { EvidenceTourFamily } from "./evidence-match-identity";
import type { MetricFinding } from "./audit-pipeline";
import { certifyMetricFinding } from "./metric-certification";
import type { TourLane } from "./audit-metrics-shared";
import { computeLevelTourTransition } from "./audit-metric-020-level-tour-transition";
import { computeLossAutopsy } from "./audit-metric-036-loss-autopsy";
import { computeFavoriteFragility } from "./audit-metric-045-favorite-fragility";
import { computeEntropyLeadDurability } from "./audit-metric-052-entropy-lead-durability";
import { loadRuntimeHistoryLane } from "./runtime-tennis-index-data.server";

const OWNED = new Set(["020", "036", "045", "052"]);

function codeOf(value: unknown) {
  const m = String(value ?? "").match(/(\d{1,3})$/);
  return m ? m[1].padStart(3, "0") : String(value ?? "").padStart(3, "0");
}
function fmt(obj: Record<string, unknown>): string {
  return Object.entries(obj).map(([k, v]) => `${k}=${v === null || v === undefined ? "NA" : v}`).join("; ");
}

// A discriminated union rather than the old `T | null`: `null` carried zero information
// about WHY a side wasn't GO, discarding the real, evidence-based `reason` string each
// `LaneOutcome`'s NOT_ENOUGH_DATA case already computes (audit-metrics-shared.ts's
// `laneOutcome()`). This never changes WHICH matches get a usable value -- still strictly
// both-sides-GO, nothing partial or guessed -- it only keeps the real reason instead of
// discarding it.
type FoundValues =
  | { ok: true; p1Value: string; p2Value: string; n: number }
  | { ok: false; p1Reason: string | null; p2Reason: string | null };

function notEnoughDataReason<T extends { status: string }>(outcome: T): string | null {
  return outcome.status === "NOT_ENOUGH_DATA" ? (outcome as unknown as { reason: string }).reason : null;
}

function levelTourTransition020(p1: string, p2: string, lane: TourLane, asOfDate: string): FoundValues {
  const a = computeLevelTourTransition({ player: p1, lane, asOfDate });
  const b = computeLevelTourTransition({ player: p2, lane, asOfDate });
  if (a.status !== "GO" || b.status !== "GO") return { ok: false, p1Reason: notEnoughDataReason(a), p2Reason: notEnoughDataReason(b) };
  const fmtSide = (r: typeof a.value) => fmt({
    matches_used: r.matches_used,
    ...Object.fromEntries(r.elo_differential_bands.map(band => [`elo_band_${band.band.toLowerCase()}_win_pct`, band.win_rate])),
    following_strong_tournament_win_pct: r.following_strong_tournament.win_rate,
    following_weak_tournament_win_pct: r.following_weak_tournament.win_rate,
  });
  return { ok: true, p1Value: fmtSide(a.value), p2Value: fmtSide(b.value), n: Math.min(a.n, b.n) };
}

function lossAutopsy036(p1: string, p2: string, lane: TourLane, asOfDate: string): FoundValues {
  const a = computeLossAutopsy({ player: p1, lane, asOfDate });
  const b = computeLossAutopsy({ player: p2, lane, asOfDate });
  if (a.status !== "GO" || b.status !== "GO") return { ok: false, p1Reason: notEnoughDataReason(a), p2Reason: notEnoughDataReason(b) };
  const fmtSide = (r: typeof a.value) => fmt({
    trailing_losses_used: r.trailing_losses_used,
    favorite_losses_n: r.favorite_losses_n,
    favorite_losses_rate_pct: r.favorite_losses_rate_pct,
    bad_loss_severity_index: r.bad_loss_severity_index,
    set_sequence_available: r.set_sequence_available,
  });
  return { ok: true, p1Value: fmtSide(a.value), p2Value: fmtSide(b.value), n: Math.min(a.n, b.n) };
}

function favoriteFragility045(p1: string, p2: string, lane: TourLane, asOfDate: string): FoundValues {
  const a = computeFavoriteFragility({ player: p1, lane, asOfDate });
  const b = computeFavoriteFragility({ player: p2, lane, asOfDate });
  if (a.status !== "GO" || b.status !== "GO") return { ok: false, p1Reason: notEnoughDataReason(a), p2Reason: notEnoughDataReason(b) };
  const fmtSide = (r: typeof a.value) => fmt({
    eligible_matches_n: r.eligible_matches_n,
    first_set_tiebreak_n: r.first_set_tiebreak.n,
    first_set_tiebreak_win_pct: r.first_set_tiebreak.win_rate,
    forced_deciding_set_n: r.forced_deciding_set.n,
    forced_deciding_set_win_pct: r.forced_deciding_set.win_rate,
  });
  return { ok: true, p1Value: fmtSide(a.value), p2Value: fmtSide(b.value), n: Math.min(a.n, b.n) };
}

function entropyLeadDurability052(p1: string, p2: string, lane: TourLane, asOfDate: string, historyLane: Parameters<typeof computeEntropyLeadDurability>[0]["historyLane"]): FoundValues {
  const a = computeEntropyLeadDurability({ player: p1, lane, asOfDate, historyLane });
  const b = computeEntropyLeadDurability({ player: p2, lane, asOfDate, historyLane });
  if (a.status !== "GO" || b.status !== "GO") return { ok: false, p1Reason: notEnoughDataReason(a), p2Reason: notEnoughDataReason(b) };
  const fmtSide = (r: typeof a.value) => fmt({
    sets_n: r.sets_n,
    set_score_entropy_bits: r.set_score_entropy_bits,
    game_score_entropy_bits: r.game_score_entropy_bits,
    distinct_set_scores: r.distinct_set_scores,
  });
  return { ok: true, p1Value: fmtSide(a.value), p2Value: fmtSide(b.value), n: Math.min(a.n, b.n) };
}

/**
 * Live wrapper for the deterministic-*-metrics.server.ts tier chain in
 * warehouse-first-researcher.server.ts. Never emits a usable value unless BOTH
 * players resolve to a GO lane outcome. When not GO (or the computation
 * throws), returns an UNAVAILABLE finding carrying the real reason instead of
 * bare `null` -- this does not block later tiers (an UNAVAILABLE finding is
 * not `fullyUsableFinding`, so warehouse-first-researcher.server.ts's
 * `liveMissing` filter still tries the live-AI tier for this code). Only bare
 * `null` is returned when there is truly no evidence-based reason to report.
 */
export async function deterministicBatch2NewMetric(args: { metricCode: string; p1: string; p2: string; asOfDate: string; tourFamily?: EvidenceTourFamily | null }): Promise<MetricFinding | null> {
  const code = codeOf(args.metricCode);
  if (!OWNED.has(code)) return null;
  const lane = args.tourFamily as TourLane | null | undefined;
  if (!lane) return null;
  const { p1, p2, asOfDate } = args;
  let found: FoundValues | null = null;
  let evidenceFamily = "";
  let caughtReason: string | null = null;
  try {
    const historyLane = code === "052" ? await loadRuntimeHistoryLane(lane, asOfDate) : undefined;
    if (code === "020") { found = levelTourTransition020(p1, p2, lane, asOfDate); evidenceFamily = "STANDALONE_LEVEL_TOUR_TRANSITION"; }
    else if (code === "036") { found = lossAutopsy036(p1, p2, lane, asOfDate); evidenceFamily = "STANDALONE_LOSS_AUTOPSY"; }
    else if (code === "045") { found = favoriteFragility045(p1, p2, lane, asOfDate); evidenceFamily = "STANDALONE_FAVORITE_FRAGILITY"; }
    else if (code === "052") { found = entropyLeadDurability052(p1, p2, lane, asOfDate, historyLane as never); evidenceFamily = "STANDALONE_ENTROPY_LEAD_DURABILITY"; }
  } catch (error) {
    // malformed/unavailable static-index lane still falls through, never crashes or
    // fabricates a value -- but the real error is now recorded instead of discarded.
    caughtReason = error instanceof Error ? error.message : String(error);
    found = null;
  }
  if (!found) {
    if (!caughtReason) return null;
    return certifyMetricFinding({
      metric_code: code, p1_value: null, p2_value: null, p1_treatment: "UNAVAILABLE", p2_treatment: "UNAVAILABLE",
      differential: null, evidence_family: evidenceFamily, reliability: null,
      sample: `standalone metric #${code} deterministic replay through ${asOfDate}; tour_lane=${lane}; computation error`,
      unavailable_reason: caughtReason, sources: [],
    });
  }
  if (!found.ok) {
    if (!found.p1Reason && !found.p2Reason) return null;
    return certifyMetricFinding({
      metric_code: code, p1_value: null, p2_value: null, p1_treatment: "UNAVAILABLE", p2_treatment: "UNAVAILABLE",
      differential: null, evidence_family: evidenceFamily, reliability: null,
      sample: `standalone metric #${code} deterministic replay through ${asOfDate}; tour_lane=${lane}; insufficient data`,
      unavailable_reason: [found.p1Reason, found.p2Reason].filter(Boolean).join(" | ") || null,
      p1_unavailable_reason: found.p1Reason, p2_unavailable_reason: found.p2Reason,
      sources: [{ source_name: "Four-tour static history index (data/generated/tennis-runtime-index.json)", url: null, retrieved_at: null }],
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
    reliability: 78,
    sample: `standalone metric #${code} deterministic replay through ${asOfDate}; tour_lane=${lane}; n=${found.n}`,
    unavailable_reason: null,
    sources: [{ source_name: "Four-tour static history index (data/generated/tennis-runtime-index.json)", url: null, retrieved_at: null }],
  });
}
