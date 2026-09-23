/**
 * PRODUCTION PROSPECTIVE PARLAY BUILDER PAPER TRADING — isolated statistics.
 *
 * Pure, DB-free by design (same reasoning as eligibility.ts/settlementLogic.ts/adminShaping.ts):
 * every function here takes already-fetched rows from ONLY the four paper-trading tables
 * (parlay_paper_trades, parlay_paper_trade_pairs) as plain arguments and never queries anything
 * itself. This is not a convenience -- it is the actual isolation mechanism the caller (the admin
 * route) is architecturally bound to respect: because this module has no `db`/`pool` import and
 * no knowledge of any other table, it is IMPOSSIBLE for a row in
 * parlay_builder_research_v1_results, builder_decision_log, parlay_leg_outcomes, or
 * evaluation_predictions to influence anything computed here, no matter what the route does or
 * doesn't fetch. See statisticsBoundary.test.ts for the static proof that the route layer upholds
 * the same rule.
 *
 * Two input row shapes, matching how the four immutable/append-only tables actually attribute
 * data (see parlayPaperTrading.ts's schema comments):
 *   - StatsTradeRow: one row per (pair, evaluated_side) -- i.e. every parlay_paper_trades row.
 *     A pair always has exactly two sibling rows (PLAYER_1 / PLAYER_2). Fields that are
 *     genuinely PER-SIDE (decision, dataCoverage) are aggregated across ALL rows; fields that are
 *     physically shared/agreed across siblings once a pair reaches FROZEN (status,
 *     builderPickedPlayerId, builderCalibratedProbability, resultType, includedInAccuracy,
 *     gradedCorrect) are aggregated from exactly ONE canonical row per pair (PLAYER_1) so a pair
 *     is never double-counted.
 *   - StatsPairRow: one row per parlay_paper_trade_pairs row (only pairs that reached evidence
 *     acquisition have one -- see persistPaperTrade.ts's ineligible branch, which never inserts a
 *     pairs row).
 */

export type ParlayPaperTradeStatus =
  | "DISCOVERED" | "FROZEN" | "STARTED" | "COMPLETED" | "GRADED"
  | "NO_DECISION" | "INELIGIBLE" | "DATA_ERROR";

export type ParlayPaperTradeDecision = "KEEP" | "BORDERLINE" | "REMOVE" | "DATA_UNAVAILABLE";

export interface StatsTradeRow {
  pairId: string;
  evaluatedSide: "PLAYER_1" | "PLAYER_2";
  player1Id: string;
  player1Name: string;
  player2Id: string;
  player2Name: string;
  status: string;
  noDecisionReason: string | null;
  decision: string | null;
  builderPickedPlayerId: string | null;
  builderCalibratedProbability: number | null;
  dataCoverage: number | null;
  resultType: string | null;
  includedInAccuracy: boolean | null;
  gradedCorrect: boolean | null;
  scheduledStartAt: Date;
  builderVersion: string | null;
  builderConfigFingerprint: string | null;
  calibrationModelId: number | null;
}

export interface StatsPairRow {
  pairId: string;
  crossSideAgreement: boolean | null;
  crossSideDisagreementReason: string | null;
}

// ── Shared helpers ───────────────────────────────────────────────────────────

/** Same rounding convention as the Prediction Engine's own metrics.ts: percentage 0-100, 1 decimal, null when the denominator is zero -- never 0% standing in for "no observations." */
function ratio(numerator: number, denominator: number): number | null {
  return denominator > 0 ? Math.round((numerator / denominator) * 1000) / 10 : null;
}

/** Exactly one row per pair -- the PLAYER_1 sibling -- for every metric that is physically shared/agreed across both sides once a pair reaches FROZEN. Never use this for per-side fields (decision, dataCoverage). */
function canonicalRows(trades: StatsTradeRow[]): StatsTradeRow[] {
  return trades.filter((t) => t.evaluatedSide === "PLAYER_1");
}

// ── TOTALS ───────────────────────────────────────────────────────────────────

export interface TotalsBreakdown {
  discovered: number;
  eligible: number;
  snapshotted: number;
  frozen: number;
  started: number;
  completed: number;
  graded: number;
  /** FROZEN, STARTED, or COMPLETED -- decided and not yet a terminal accuracy observation (GRADED) or a non-decision/error state. */
  pending: number;
  no_decision: number;
  ineligible: number;
  data_error: number;
  cancelled: number;
  /** cancelled OR walkover -- the established void superset (settlementLogic.ts's isVoidResult). Includes `cancelled` above, not additional to it. */
  void: number;
}

/**
 * `pairs` (parlay_paper_trade_pairs rows) is the authoritative "eligible"/"snapshotted" count:
 * persistPaperTrade.ts only ever inserts a pairs+snapshot row together, and only on the eligible
 * path (see its `if (!eligibility.eligible)` branch, which writes trades rows only). The two
 * numbers are always equal by construction; both are reported because they answer conceptually
 * different questions ("did evidence acquisition run" vs "was a snapshot persisted") even though
 * today's write path makes them inseparable.
 */
export function computeTotals(trades: StatsTradeRow[], pairs: StatsPairRow[]): TotalsBreakdown {
  const canonical = canonicalRows(trades);
  const countStatus = (s: string) => canonical.filter((t) => t.status === s).length;
  const frozen = countStatus("FROZEN");
  const started = countStatus("STARTED");
  const completed = countStatus("COMPLETED");
  const graded = countStatus("GRADED");
  const cancelled = canonical.filter((t) => t.resultType === "cancelled").length;
  const voidCount = canonical.filter((t) => t.resultType === "cancelled" || t.resultType === "walkover").length;

  return {
    discovered: canonical.length,
    eligible: pairs.length,
    snapshotted: pairs.length,
    frozen,
    started,
    completed,
    graded,
    pending: frozen + started + completed,
    no_decision: countStatus("NO_DECISION"),
    ineligible: countStatus("INELIGIBLE"),
    data_error: countStatus("DATA_ERROR"),
    cancelled,
    void: voidCount,
  };
}

// ── PREDICTION PERFORMANCE (the autonomous builder_picked_player_id vs actual_winner_id) ───────

export interface PredictionPerformance {
  /** All pairs with status GRADED, void ones included -- the raw "graded" count, not the accuracy denominator. */
  gradedCount: number;
  correctCount: number;
  incorrectCount: number;
  /** GRADED pairs excluded from accuracy (includedInAccuracy === false: cancelled/walkover result, or no winner attached). Subset of gradedCount, not additional to it. */
  voidCount: number;
  /** correctCount / (correctCount + incorrectCount) == correctCount / eligible_graded_nonvoid_count -- deliberately NOT correctCount/gradedCount, so a void result can never look like a wrong prediction. Null when that denominator is 0 -- never 0%. */
  accuracy: number | null;
}

export function computePredictionPerformance(trades: StatsTradeRow[]): PredictionPerformance {
  const graded = canonicalRows(trades).filter((t) => t.status === "GRADED");
  const correct = graded.filter((t) => t.gradedCorrect === true).length;
  const incorrect = graded.filter((t) => t.gradedCorrect === false).length;
  const voidCount = graded.filter((t) => t.includedInAccuracy === false).length;

  return {
    gradedCount: graded.length,
    correctCount: correct,
    incorrectCount: incorrect,
    voidCount,
    accuracy: ratio(correct, correct + incorrect),
  };
}

// ── DIRECTIONAL VALIDATION DECISIONS (KEEP/BORDERLINE/REMOVE/DATA_UNAVAILABLE -- per side, never the prediction) ──

export interface DecisionCategoryStats {
  count: number;
  gradedCount: number;
  correctCount: number;
  accuracy: number | null;
}

export interface DirectionalValidationDecisions {
  label: "DIRECTIONAL_VALIDATION_DECISIONS_NOT_PREDICTIONS";
  counts: Record<ParlayPaperTradeDecision, number>;
  /** Accuracy of the pair's AUTONOMOUS prediction, segmented by what this SIDE's validation decision said -- not a ranking. */
  accuracyByDecision: Record<"KEEP" | "BORDERLINE" | "REMOVE", DecisionCategoryStats>;
}

const DECISIONS: ParlayPaperTradeDecision[] = ["KEEP", "BORDERLINE", "REMOVE", "DATA_UNAVAILABLE"];

export function computeDirectionalValidationDecisions(trades: StatsTradeRow[]): DirectionalValidationDecisions {
  const counts = {} as Record<ParlayPaperTradeDecision, number>;
  for (const d of DECISIONS) counts[d] = trades.filter((t) => t.decision === d).length;

  const accuracyByDecision = {} as Record<"KEEP" | "BORDERLINE" | "REMOVE", DecisionCategoryStats>;
  for (const d of ["KEEP", "BORDERLINE", "REMOVE"] as const) {
    const rows = trades.filter((t) => t.decision === d);
    const graded = rows.filter((t) => t.includedInAccuracy === true);
    const correct = graded.filter((t) => t.gradedCorrect === true).length;
    accuracyByDecision[d] = {
      count: rows.length,
      gradedCount: graded.length,
      correctCount: correct,
      accuracy: ratio(correct, graded.length),
    };
  }

  return { label: "DIRECTIONAL_VALIDATION_DECISIONS_NOT_PREDICTIONS", counts, accuracyByDecision };
}

// ── AUTONOMOUS PREDICTION METRICS ───────────────────────────────────────────

export interface PlayerPickCount {
  playerId: string;
  playerName: string;
  count: number;
}

export const PROBABILITY_BUCKET_LABELS = ["<50%", "50-54.9%", "55-59.9%", "60-64.9%", "65-69.9%", "70%+"] as const;
export type ProbabilityBucketLabel = (typeof PROBABILITY_BUCKET_LABELS)[number];

export interface ProbabilityBucketStats {
  bucket: ProbabilityBucketLabel;
  count: number;
  gradedCount: number;
  correctCount: number;
  incorrectCount: number;
  accuracy: number | null;
}

function bucketFor(probability: number): ProbabilityBucketLabel {
  if (probability < 50) return "<50%";
  if (probability < 55) return "50-54.9%";
  if (probability < 60) return "55-59.9%";
  if (probability < 65) return "60-64.9%";
  if (probability < 70) return "65-69.9%";
  return "70%+";
}

export interface AutonomousPredictionMetrics {
  label: "AUTONOMOUS_BUILDER_PREDICTION";
  pickCountByPlayer: PlayerPickCount[];
  probabilityBuckets: ProbabilityBucketStats[];
}

/** Only rows that ever reached a real frozen prediction (builderPickedPlayerId non-null) count -- a DATA_UNAVAILABLE side's forced-0 probability/fallback pick is never a genuine autonomous prediction (see deriveFinalStatus's comment in persistPaperTrade.ts). */
export function computeAutonomousPredictionMetrics(trades: StatsTradeRow[]): AutonomousPredictionMetrics {
  const canonical = canonicalRows(trades).filter((t) => t.builderPickedPlayerId != null);

  const pickCounts = new Map<string, PlayerPickCount>();
  for (const t of canonical) {
    const id = t.builderPickedPlayerId!;
    const name = id === t.player1Id ? t.player1Name : id === t.player2Id ? t.player2Name : id;
    const existing = pickCounts.get(id);
    if (existing) existing.count++;
    else pickCounts.set(id, { playerId: id, playerName: name, count: 1 });
  }

  const buckets: ProbabilityBucketStats[] = PROBABILITY_BUCKET_LABELS.map((bucket) => {
    const rows = canonical.filter((t) => t.builderCalibratedProbability != null && bucketFor(t.builderCalibratedProbability) === bucket);
    const graded = rows.filter((t) => t.includedInAccuracy === true);
    const correct = graded.filter((t) => t.gradedCorrect === true).length;
    const incorrect = graded.filter((t) => t.gradedCorrect === false).length;
    return { bucket, count: rows.length, gradedCount: graded.length, correctCount: correct, incorrectCount: incorrect, accuracy: ratio(correct, graded.length) };
  });

  return {
    label: "AUTONOMOUS_BUILDER_PREDICTION",
    pickCountByPlayer: [...pickCounts.values()].sort((a, b) => b.count - a.count),
    probabilityBuckets: buckets,
  };
}

// ── CROSS-SIDE INTEGRITY ─────────────────────────────────────────────────────

export interface CrossSideIntegrity {
  agreementCount: number;
  disagreementCount: number;
  /** agreementCount / (agreementCount + disagreementCount). Null when there are no checked pairs yet. */
  agreementRate: number | null;
  /** Always true: a disagreement is graded DATA_ERROR (see deriveFinalStatus), never a normal accuracy loss. Documented explicitly per the spec's integrity-vs-loss distinction. */
  disagreementsExcludedFromGrading: true;
}

export function computeCrossSideIntegrity(pairs: StatsPairRow[]): CrossSideIntegrity {
  const checked = pairs.filter((p) => p.crossSideAgreement != null);
  const agree = checked.filter((p) => p.crossSideAgreement === true).length;
  const disagree = checked.filter((p) => p.crossSideAgreement === false).length;
  return {
    agreementCount: agree,
    disagreementCount: disagree,
    agreementRate: ratio(agree, checked.length),
    disagreementsExcludedFromGrading: true,
  };
}

// ── DATA QUALITY ─────────────────────────────────────────────────────────────

export const DATA_COVERAGE_BUCKET_LABELS = ["0-24%", "25-49%", "50-74%", "75-99%", "100%"] as const;
export type DataCoverageBucketLabel = (typeof DATA_COVERAGE_BUCKET_LABELS)[number];

export interface DataQuality {
  dataCoverageBuckets: { bucket: DataCoverageBucketLabel; count: number }[];
  missingEvidenceCount: number;
  dataUnavailableCount: number;
  /** Pair-level: noDecisionReason === 'PROVIDER_UNAVAILABLE' (fixture/player-history discovery itself failed), never a per-side reason. */
  providerFailureCount: number;
}

function coverageBucketFor(coverage: number): DataCoverageBucketLabel {
  if (coverage < 25) return "0-24%";
  if (coverage < 50) return "25-49%";
  if (coverage < 75) return "50-74%";
  if (coverage < 100) return "75-99%";
  return "100%";
}

export function computeDataQuality(trades: StatsTradeRow[]): DataQuality {
  const withCoverage = trades.filter((t) => t.dataCoverage != null);
  const dataCoverageBuckets = DATA_COVERAGE_BUCKET_LABELS.map((bucket) => ({
    bucket,
    count: withCoverage.filter((t) => coverageBucketFor(t.dataCoverage!) === bucket).length,
  }));

  return {
    dataCoverageBuckets,
    missingEvidenceCount: trades.filter((t) => t.dataCoverage != null && t.dataCoverage < 100).length,
    dataUnavailableCount: trades.filter((t) => t.decision === "DATA_UNAVAILABLE").length,
    providerFailureCount: canonicalRows(trades).filter((t) => t.noDecisionReason === "PROVIDER_UNAVAILABLE").length,
  };
}

// ── LINEAGE ──────────────────────────────────────────────────────────────────

export interface LineageBreakdown {
  builderVersion: string | null;
  builderConfigFingerprint: string | null;
  calibrationModelId: number | null;
  pairCount: number;
}

/**
 * Every distinct (builderVersion, builderConfigFingerprint, calibrationModelId) combination
 * present in the result set, each with its own pair count -- so a caller can see at a glance
 * whether the current filtered view spans more than one Builder configuration, rather than
 * silently averaging across them. Never merged/collapsed into one row.
 */
export function computeLineageBreakdown(trades: StatsTradeRow[]): LineageBreakdown[] {
  const canonical = canonicalRows(trades);
  const byKey = new Map<string, LineageBreakdown>();
  for (const t of canonical) {
    const key = `${t.builderVersion ?? ""}\u0000${t.builderConfigFingerprint ?? ""}\u0000${t.calibrationModelId ?? ""}`;
    const existing = byKey.get(key);
    if (existing) existing.pairCount++;
    else byKey.set(key, { builderVersion: t.builderVersion, builderConfigFingerprint: t.builderConfigFingerprint, calibrationModelId: t.calibrationModelId, pairCount: 1 });
  }
  return [...byKey.values()].sort((a, b) => b.pairCount - a.pairCount);
}

// ── TIME WINDOW ──────────────────────────────────────────────────────────────

export interface ObservedTimeWindow {
  /** Min/max of the FROZEN fixture's own scheduledStartAt across the result set -- never settlement time, never a provider's later time-correction (frozen at decision time, immutable). Null when the result set is empty. */
  earliestScheduledStartAt: string | null;
  latestScheduledStartAt: string | null;
}

export function computeObservedTimeWindow(trades: StatsTradeRow[]): ObservedTimeWindow {
  const canonical = canonicalRows(trades);
  if (canonical.length === 0) return { earliestScheduledStartAt: null, latestScheduledStartAt: null };
  const times = canonical.map((t) => t.scheduledStartAt.getTime());
  return {
    earliestScheduledStartAt: new Date(Math.min(...times)).toISOString(),
    latestScheduledStartAt: new Date(Math.max(...times)).toISOString(),
  };
}

// ── Top-level aggregate ──────────────────────────────────────────────────────

export interface ParlayPaperTradingStatistics {
  totals: TotalsBreakdown;
  predictionPerformance: PredictionPerformance;
  directionalValidationDecisions: DirectionalValidationDecisions;
  autonomousPrediction: AutonomousPredictionMetrics;
  crossSideIntegrity: CrossSideIntegrity;
  dataQuality: DataQuality;
  lineage: LineageBreakdown[];
  timeWindow: ObservedTimeWindow;
}

export function computeParlayPaperTradingStatistics(trades: StatsTradeRow[], pairs: StatsPairRow[]): ParlayPaperTradingStatistics {
  return {
    totals: computeTotals(trades, pairs),
    predictionPerformance: computePredictionPerformance(trades),
    directionalValidationDecisions: computeDirectionalValidationDecisions(trades),
    autonomousPrediction: computeAutonomousPredictionMetrics(trades),
    crossSideIntegrity: computeCrossSideIntegrity(pairs),
    dataQuality: computeDataQuality(trades),
    lineage: computeLineageBreakdown(trades),
    timeWindow: computeObservedTimeWindow(trades),
  };
}
