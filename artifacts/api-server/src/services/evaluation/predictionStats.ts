/**
 * Provenance-aware stats for `evaluation_predictions`, backing GET /evaluation/predictions/stats.
 * Extracted out of the route handler (rather than left inline) so its SQL-aggregation and
 * population-scoping logic can be exercised directly against a real database in tests, the same
 * boundary every other evaluation service function in this directory already uses -- this
 * codebase never spins up Express routes in tests.
 */
import { eq, sql } from "drizzle-orm";
import { db, evaluationPredictionsTable } from "@workspace/db";
import { computeSegmentMetrics } from "./metrics";
import { computeRecommendation, type Recommendation } from "../predictionEngine/recommendation";

export type EvaluationPredictionStatsRunKind = "historical_test" | "paper_trade" | "live" | "paper_trade_shadow";
export type EvaluationPredictionStatsProvenance = EvaluationPredictionStatsRunKind | "mixed";

/**
 * runKind values small/bounded enough that a full-row fetch (needed to reuse
 * computeSegmentMetrics's logLoss/brier) is safe. `historical_test` (500k+ rows) and the
 * unscoped/"mixed" case are deliberately excluded -- both can span the entire table, and this
 * function must never do a full-row fetch across a population that size.
 */
const BOUNDED_RUN_KINDS = new Set<EvaluationPredictionStatsRunKind>(["paper_trade", "paper_trade_shadow", "live"]);

export interface EvaluationPredictionStatsResult {
  provenance: EvaluationPredictionStatsProvenance;
  totalPredictions: number;
  resolvedPredictions: number;
  correctPredictions: number;
  accuracy: number | null;
  pending: number;
  missed: number;
  graded: number;
  void: number;
  avgConfidence: number | null;
  logLoss: number | null | undefined;
  brier: number | null | undefined;
  byRecommendation: Array<{ recommendation: Recommendation; count: number }>;
}

export function deriveRecommendationFromEvaluationRow(row: {
  calibratedProbability: number | null;
  dataQuality: number | null;
  tieBreakerApplied: boolean | null;
  modelAgreement: string | null;
  upsetRiskTier: string | null;
}): Recommendation | null {
  if (typeof row.calibratedProbability !== "number" || !Number.isFinite(row.calibratedProbability)) return null;
  if (typeof row.modelAgreement !== "string" || typeof row.upsetRiskTier !== "string") return null;
  if (typeof row.dataQuality !== "number" || !Number.isFinite(row.dataQuality)) return null;

  const dataQuality = row.dataQuality;
  const dataQualityLabel =
    dataQuality >= 85 ? "Excellent" : dataQuality >= 65 ? "Strong" : dataQuality >= 45 ? "Acceptable" : dataQuality >= 25 ? "Limited" : "Poor";
  const tieBreakerApplied = row.tieBreakerApplied === true;
  return computeRecommendation(
    row.calibratedProbability,
    dataQuality,
    dataQualityLabel,
    row.modelAgreement as Parameters<typeof computeRecommendation>[3],
    tieBreakerApplied,
  );
}

/**
 * `runKind` omitted means "mixed": every population in evaluation_predictions (historical_test,
 * paper_trade, live, paper_trade_shadow) aggregated together. Callers that want genuine live
 * paper-trading performance MUST pass `runKind: "paper_trade"` explicitly -- this function never
 * assumes which population a caller wants.
 *
 * `resolvedPredictions`/`correctPredictions`/`accuracy` only ever count rows with a real
 * (non-null) actualWinnerId -- pending and missed rows always have actualWinnerId=null (a missed
 * cutoff never fabricates a prediction, and grading only sets it once a real result is known), so
 * neither is ever counted as a loss, and accuracy's denominator is always graded rows only.
 */
export async function getEvaluationPredictionStats(runKind?: EvaluationPredictionStatsRunKind): Promise<EvaluationPredictionStatsResult> {
  const whereClause = runKind ? eq(evaluationPredictionsTable.runKind, runKind) : undefined;

  const [totals] = await db
    .select({
      totalPredictions: sql<number>`count(*)`.mapWith(Number),
      resolvedPredictions: sql<number>`count(*) filter (where ${evaluationPredictionsTable.actualWinnerId} is not null)`.mapWith(Number),
      correctPredictions: sql<number>`count(*) filter (where ${evaluationPredictionsTable.actualWinnerId} = ${evaluationPredictionsTable.predictedWinnerId})`.mapWith(Number),
      pending: sql<number>`count(*) filter (where ${evaluationPredictionsTable.status} = 'pending')`.mapWith(Number),
      missed: sql<number>`count(*) filter (where ${evaluationPredictionsTable.status} = 'missed')`.mapWith(Number),
      graded: sql<number>`count(*) filter (where ${evaluationPredictionsTable.status} = 'graded')`.mapWith(Number),
      voidCount: sql<number>`count(*) filter (where ${evaluationPredictionsTable.status} = 'void')`.mapWith(Number),
      // Oriented to whichever side is favored (>=50), so a confident pick on either player always
      // reads as a large number -- matches how calibratedProbability is already displayed elsewhere.
      avgConfidence: sql<number | null>`avg(greatest(${evaluationPredictionsTable.calibratedProbability}, 100 - ${evaluationPredictionsTable.calibratedProbability})) filter (where ${evaluationPredictionsTable.calibratedProbability} is not null)`,
    })
    .from(evaluationPredictionsTable)
    .where(whereClause);

  // Phase 9 perf fix: extract only the two scalar fields we need from featureSnapshot via
  // PostgreSQL JSONB operators instead of loading the entire blob for all 40k+ rows into Node.
  // This avoids the previous O(n) full-table JSONB load that caused ~19s page load times.
  const recommendationInputs = await db
    .select({
      calibratedProbability: evaluationPredictionsTable.calibratedProbability,
      dataQuality: sql<number | null>`(${evaluationPredictionsTable.featureSnapshot}->>'dataQuality')::real`,
      tieBreakerApplied: sql<boolean | null>`((${evaluationPredictionsTable.featureSnapshot}->'engine'->>'tieBreakerApplied'))::boolean`,
      modelAgreement: evaluationPredictionsTable.modelAgreement,
      upsetRiskTier: evaluationPredictionsTable.upsetRiskTier,
    })
    .from(evaluationPredictionsTable)
    .where(whereClause);

  const byRecommendationCounts = new Map<Recommendation, number>();
  for (const row of recommendationInputs) {
    const recommendation = deriveRecommendationFromEvaluationRow(row);
    if (!recommendation) continue;
    byRecommendationCounts.set(recommendation, (byRecommendationCounts.get(recommendation) ?? 0) + 1);
  }
  const byRecommendation = Array.from(byRecommendationCounts.entries()).map(([recommendation, count]) => ({ recommendation, count }));

  const {
    totalPredictions, resolvedPredictions, correctPredictions, pending, missed, graded, voidCount, avgConfidence,
  } = totals ?? {
    totalPredictions: 0, resolvedPredictions: 0, correctPredictions: 0, pending: 0, missed: 0, graded: 0, voidCount: 0, avgConfidence: null,
  };
  const accuracy = resolvedPredictions > 0 ? Math.round((correctPredictions / resolvedPredictions) * 1000) / 10 : null;

  // logLoss/brier reuse the existing, already-tested computeSegmentMetrics (the same function
  // /evaluation/dashboard already relies on) -- never reimplemented here.
  let logLoss: number | null | undefined;
  let brier: number | null | undefined;
  if (runKind && BOUNDED_RUN_KINDS.has(runKind)) {
    const scopedRows = await db.select().from(evaluationPredictionsTable).where(whereClause);
    const segmentMetrics = computeSegmentMetrics(scopedRows);
    logLoss = segmentMetrics.logLoss;
    brier = segmentMetrics.brier;
  }

  return {
    provenance: runKind ?? "mixed",
    totalPredictions,
    resolvedPredictions,
    correctPredictions,
    accuracy,
    pending,
    missed,
    graded,
    void: voidCount,
    avgConfidence: avgConfidence != null ? Math.round(avgConfidence * 10) / 10 : null,
    logLoss,
    brier,
    byRecommendation,
  };
}
