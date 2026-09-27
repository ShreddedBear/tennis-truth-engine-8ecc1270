import { db, evaluationPredictionsTable, liveCompletedResultsTable } from "@workspace/db";
import { and, eq, gte, lte, or, sql } from "drizzle-orm";
import { getTennisDataProvider, getLiveTennisProviderForPredictionEngine, ProviderUnavailableError, type Fixture, type TennisDataProvider } from "../tennisData";
import { LIVE_TENNIS_PROVIDER_NAME } from "../tennisData/liveTennisHistoricalProvider.js";
import { getPredictionSettings, settleEvaluationPrediction } from "./settle";
import { LIVE_MODEL_VERSION, type LiveFeatureSnapshot, type ResultType } from "./types";
import { computeVigAdjustedImpliedProbability } from "../oddsData/impliedProbability";
import { logger } from "../../lib/logger";
import { defaultPredictionMode, derivePredictionStrategyIdentity, getCurrentProductionStrategyIdentity } from "./strategyIdentity";
import { predictFromSnapshot } from "./predictionSnapshot";
import { extractFallbackInstrumentation } from "./fallbackInstrumentation";

/**
 * How long after a fixture's cutoff instant the cycle will still lock a fresh prediction for it.
 *
 * Two distinct latency sources must both fit inside this window:
 *  1. **Polling cadence gap** — the in-process timer fires every 15 minutes, but each cycle
 *     takes 22-26 minutes (ledger grading N pending user predictions). The effective inter-cycle
 *     gap is therefore 37-50 minutes. A fixture whose cutoff falls between two runs can sit
 *     uncaught for that entire gap.
 *  2. **Provider fixture-visibility latency** — confirmed live (Aug 2026): API-Tennis does not
 *     publish all upcoming fixtures 30+ minutes in advance. For some tournaments (e.g. National
 *     Bank Open) fixtures only appear in the `get_fixtures` feed 8-15 minutes before their
 *     scheduled start. With `paperTradeLeadMinutes=30`, the cutoff is 30 minutes before start and
 *     the lock deadline under the old 15-minute grace was 15 minutes before start — so any
 *     fixture that first became visible 16+ minutes after cutoff was immediately marked 'missed'.
 *
 * Setting this to 25 minutes makes the lock deadline 5 minutes before the scheduled start
 * (`paperTradeLeadMinutes=30 − LOCK_GRACE_MINUTES=25 = 5 min`). Combined with the hard guard
 * `now >= scheduledStartAt → missed`, the pipeline NEVER locks a prediction after the match has
 * already started. Predictions locked in this extended window are late relative to the intended
 * 30-minute pre-match cutoff, but they are still genuine pre-match predictions and far more
 * useful than no prediction at all for pipeline health monitoring.
 *
 * Recalibrate if `paperTradeLeadMinutes` changes — the invariant to preserve is:
 *   paperTradeLeadMinutes - LOCK_GRACE_MINUTES > 0  (lock deadline stays before match start)
 */
const LOCK_GRACE_MINUTES = 25;
const SHARED_LIVE_RESULT_WINDOW_MS = 6 * 60 * 60_000;

function todayPlus(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export interface PaperTradingCycleSummary {
  locked: number;
  missed: number;
  graded: number;
  errors: string[];
}

type PaperTradeInsert = typeof evaluationPredictionsTable.$inferInsert;

function parseDatabaseTimestamp(value: unknown): Date | null {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = new Date(value);
    if (Number.isFinite(parsed.getTime())) return parsed;
  }
  return null;
}

/**
 * Persist a missed row, or freeze the scored prediction, only after rechecking the
 * deadline at the persistence boundary. Scoring can take long enough for an
 * eligible fixture to start; the earlier discovery-time check is not sufficient.
 *
 * The database clock is consulted after scoring, inside the insert transaction.
 * `clock` is injectable solely for exercising the scoring-crosses-start boundary
 * in tests; production uses the process clock as an additional conservative guard.
 */
async function persistBeforeStartOrMiss(
  prediction: PaperTradeInsert,
  missed: PaperTradeInsert,
  scheduledStartAt: Date,
  lockDeadline: Date,
  clock: () => number,
  forceMissed = false,
): Promise<"locked" | "missed" | "duplicate"> {
  const matchStartDeadlineExceeded = new Error("PAPER_TRADE_MATCH_START_DURING_PERSIST");
  const insertMissed = async (tx: Parameters<Parameters<typeof db.transaction>[0]>[0], lockedAt: Date) => {
    const inserted = await tx
      .insert(evaluationPredictionsTable)
      .values({ ...missed, lockedAt, status: "missed" })
      .onConflictDoNothing({
        target: [
          evaluationPredictionsTable.runKind,
          evaluationPredictionsTable.provider,
          evaluationPredictionsTable.externalFixtureId,
        ],
      })
      .returning({ id: evaluationPredictionsTable.id });
    return inserted.length > 0;
  };

  try {
    return await db.transaction(async (tx) => {
      const clockResult = await tx.execute(sql`
        WITH wall_clock AS MATERIALIZED (SELECT clock_timestamp() AS now)
        SELECT now AS db_now,
               now < ${scheduledStartAt} AND now < ${lockDeadline} AS before_deadline
        FROM wall_clock
      `);
      const databaseNow = parseDatabaseTimestamp(clockResult.rows[0]?.db_now);
      const databaseBeforeDeadline = clockResult.rows[0]?.before_deadline;
      if (!databaseNow || typeof databaseBeforeDeadline !== "boolean") {
        throw new Error("Paper-trade boundary check did not return a valid database timestamp and deadline result");
      }
      const lockedAt = new Date(Math.max(clock(), databaseNow.getTime()));
      const missedDeadline =
        forceMissed ||
        !databaseBeforeDeadline ||
        lockedAt.getTime() >= scheduledStartAt.getTime() ||
        lockedAt.getTime() >= lockDeadline.getTime();
      if (missedDeadline) {
        const inserted = await insertMissed(tx, lockedAt);
        return inserted ? "missed" : "duplicate";
      }

      const inserted = await tx
        .insert(evaluationPredictionsTable)
        .values({ ...prediction, lockedAt, status: "pending" })
        .onConflictDoNothing({
          target: [
            evaluationPredictionsTable.runKind,
            evaluationPredictionsTable.provider,
            evaluationPredictionsTable.externalFixtureId,
          ],
        })
        .returning({ id: evaluationPredictionsTable.id });
      if (inserted.length === 0) return "duplicate";

      // Guard the write itself as well: if even the insert crosses match start,
      // roll it back completely and record only the honest missed state.
      const finalClockResult = await tx.execute(sql`
        WITH wall_clock AS MATERIALIZED (SELECT clock_timestamp() AS now)
        SELECT now AS db_now,
               now < ${scheduledStartAt} AND now < ${lockDeadline} AS before_deadline
        FROM wall_clock
      `);
      const finalDatabaseNow = parseDatabaseTimestamp(finalClockResult.rows[0]?.db_now);
      const finalDatabaseBeforeDeadline = finalClockResult.rows[0]?.before_deadline;
      if (
        !finalDatabaseNow ||
        typeof finalDatabaseBeforeDeadline !== "boolean" ||
        !finalDatabaseBeforeDeadline ||
        Math.max(clock(), finalDatabaseNow.getTime()) >= scheduledStartAt.getTime() ||
        Math.max(clock(), finalDatabaseNow.getTime()) >= lockDeadline.getTime()
      ) {
        throw matchStartDeadlineExceeded;
      }
      return "locked";
    });
  } catch (err) {
    if (err !== matchStartDeadlineExceeded) throw err;
    const clockResult = await db.execute(sql`
      WITH wall_clock AS MATERIALIZED (SELECT clock_timestamp() AS now)
      SELECT now AS db_now
      FROM wall_clock
    `);
    const databaseNow = parseDatabaseTimestamp(clockResult.rows[0]?.db_now);
    if (!databaseNow) throw new Error("Paper-trade missed-state write did not return a valid database timestamp");
    const lockedAt = new Date(Math.max(clock(), databaseNow.getTime()));
    return db.transaction(async (tx) => (await insertMissed(tx, lockedAt)) ? "missed" : "duplicate");
  }
}

function liveResultSourceForPredictionProvider(providerName: string | null): string | null {
  if (!providerName) return null;
  if (providerName === LIVE_TENNIS_PROVIDER_NAME) return LIVE_TENNIS_PROVIDER_NAME;

  // Live paper-trade rows store CompositeTennisProvider.name. Its first component
  // is the primary provider whose fixture/player IDs are frozen on the row.
  const [primaryProvider, fallbackProvider, ...unexpectedComponents] = providerName.split("+");
  if (
    primaryProvider === LIVE_TENNIS_PROVIDER_NAME
    && fallbackProvider
    && unexpectedComponents.length === 0
  ) {
    return primaryProvider;
  }
  return null;
}

function comparableMetadataMatches(left: string | null, right: string | null): boolean {
  if (!left?.trim() || !right?.trim()) return true;
  return left.trim().replace(/\s+/gu, " ").toLocaleLowerCase("en-US")
    === right.trim().replace(/\s+/gu, " ").toLocaleLowerCase("en-US");
}

async function findSharedLiveResult(
  providerName: string | null,
  player1Id: string,
  player2Id: string,
  scheduledStartAt: Date,
  tournamentName: string | null,
  surface: string | null,
  now: number,
): Promise<
  | { kind: "none" }
  | { kind: "ambiguous" }
  | { kind: "matched"; result: typeof liveCompletedResultsTable.$inferSelect }
> {
  const sourceProvider = liveResultSourceForPredictionProvider(providerName);
  if (!sourceProvider) return { kind: "none" };

  const lowerBound = new Date(scheduledStartAt.getTime() - SHARED_LIVE_RESULT_WINDOW_MS);
  const upperBound = new Date(scheduledStartAt.getTime() + SHARED_LIVE_RESULT_WINDOW_MS);
  const rows = await db
    .select()
    .from(liveCompletedResultsTable)
    .where(and(
      eq(liveCompletedResultsTable.provider, sourceProvider),
      or(
        and(
          eq(liveCompletedResultsTable.providerPlayer1Id, player1Id),
          eq(liveCompletedResultsTable.providerPlayer2Id, player2Id),
        ),
        and(
          eq(liveCompletedResultsTable.providerPlayer1Id, player2Id),
          eq(liveCompletedResultsTable.providerPlayer2Id, player1Id),
        ),
      ),
      gte(liveCompletedResultsTable.scheduledStartAt, lowerBound),
      lte(liveCompletedResultsTable.scheduledStartAt, upperBound),
      lte(liveCompletedResultsTable.scheduledStartAt, new Date(now)),
    ));

  const candidates = rows.filter((result) =>
    comparableMetadataMatches(tournamentName, result.tournamentName)
    && comparableMetadataMatches(surface, result.surface)
  );
  if (candidates.length === 0) return { kind: "none" };
  if (candidates.length > 1) return { kind: "ambiguous" };
  return { kind: "matched", result: candidates[0] };
}

function mapSharedResultWinnerToProviderId(
  result: typeof liveCompletedResultsTable.$inferSelect,
): string | null {
  if (result.canonicalWinnerId === result.canonicalPlayer1Id) return result.providerPlayer1Id;
  if (result.canonicalWinnerId === result.canonicalPlayer2Id) return result.providerPlayer2Id;
  return null;
}

function resultTypeFromSharedLiveRow(
  result: typeof liveCompletedResultsTable.$inferSelect,
): ResultType {
  if (result.terminalResultType === "finished") return "normal";
  if (result.terminalResultType === "retired") return "retired";
  return "walkover";
}

/**
 * The minimal capability paper-trading's fixture-discovery step needs. Deliberately NOT
 * `TennisDataProvider` (which includes the shared, byte-for-byte-preserved
 * getUpcomingFixtures/getUpcomingFixturesRange this file used to call, and which other consumers
 * -- e.g. routes/fixtures.ts -- still depend on unchanged) and deliberately NOT any Builder-typed
 * handle -- see getLiveTennisProviderForPredictionEngine's doc comment for the full boundary
 * reasoning. A test double only needs to implement this narrow shape.
 */
export interface PredictionEngineFixtureDiscoveryProvider {
  readonly name: string;
  getUpcomingFixturesForPredictionEngine(date: string): Promise<Fixture[]>;
}

/**
 * One paper-trading cycle: (1) lock predictions for real upcoming fixtures whose cutoff has just
 * arrived, (2) mark fixtures whose cutoff passed unlocked as 'missed' (never backfilled), (3)
 * grade any pending predictions whose real result is now available. Safe to call repeatedly
 * (e.g. on a timer) -- every step is idempotent via the unique (runKind, provider,
 * externalFixtureId) index and the pending-only settlement guard.
 *
 * `fixtureProviderOverride` is a second, independent override from `providerOverride`: the latter
 * still supplies everything else in this cycle (engine input, grading's match-history lookups,
 * the `provider` value stored on each row), while fixture discovery specifically always goes
 * through the Prediction-Engine-only adapter (real provider default:
 * getLiveTennisProviderForPredictionEngine(); tests inject their own fake here).
 */
export async function runPaperTradingCycle(
  providerOverride?: TennisDataProvider,
  fixtureProviderOverride?: PredictionEngineFixtureDiscoveryProvider,
  clock: () => number = Date.now,
): Promise<PaperTradingCycleSummary> {
  const summary: PaperTradingCycleSummary = { locked: 0, missed: 0, graded: 0, errors: [] };
  const settings = await getPredictionSettings();
  const provider = providerOverride ?? getTennisDataProvider();
  const fixtureProvider = fixtureProviderOverride ?? getLiveTennisProviderForPredictionEngine();
  const currentProductionIdentity = await getCurrentProductionStrategyIdentity();
  const fallbackProductionIdentity = derivePredictionStrategyIdentity({
    predictionMode: defaultPredictionMode("paper_trade"),
    modelVersion: LIVE_MODEL_VERSION,
    createdAt: new Date(),
  });
  const effectiveProductionIdentity = {
    strategyId: currentProductionIdentity.strategyId ?? fallbackProductionIdentity.strategyId,
    strategyVersion: currentProductionIdentity.strategyVersion ?? fallbackProductionIdentity.strategyVersion,
    strategyFingerprint: currentProductionIdentity.strategyFingerprint ?? LIVE_MODEL_VERSION,
  };

  if (!fixtureProvider) {
    summary.errors.push("Provider unavailable while fetching fixtures: Live Tennis API key not configured");
    return summary;
  }

  let fixtures;
  try {
    const [today, tomorrow] = await Promise.all([
      fixtureProvider.getUpcomingFixturesForPredictionEngine(todayPlus(0)),
      fixtureProvider.getUpcomingFixturesForPredictionEngine(todayPlus(1)),
    ]);
    fixtures = [...today, ...tomorrow];
  } catch (err) {
    if (err instanceof ProviderUnavailableError) {
      summary.errors.push(`Provider unavailable while fetching fixtures: ${err.message}`);
      return summary;
    }
    throw err;
  }

  const fixtureShapeById = new Map<string, { player1Id: string; player2Id: string }>();

  for (const fixture of fixtures) {
    const prior = fixtureShapeById.get(fixture.id);
    if (prior && (prior.player1Id !== fixture.player1Id || prior.player2Id !== fixture.player2Id)) {
      summary.errors.push(`Fixture ${fixture.id}: duplicate fixture id with conflicting players in provider response; skipped to prevent contamination`);
      continue;
    }
    if (!prior) fixtureShapeById.set(fixture.id, { player1Id: fixture.player1Id, player2Id: fixture.player2Id });

    // A cutoff can only be computed from a real, per-fixture provider time -- never from the
    // calendar date alone (that would give every match on a day the same, fabricated cutoff).
    // Fixtures the provider hasn't confirmed a time for yet are simply not processable this
    // cycle; they'll be picked up once the provider publishes a real time for them.
    if (!fixture.timeConfirmed || !fixture.scheduledStart) continue;
    const scheduledStartAt = new Date(fixture.scheduledStart);
    if (Number.isNaN(scheduledStartAt.getTime())) continue;

    const cutoffAt = new Date(scheduledStartAt.getTime() - settings.paperTradeLeadMinutes * 60_000);

    const now = clock();
    const [existing] = await db
      .select({ id: evaluationPredictionsTable.id })
      .from(evaluationPredictionsTable)
      .where(
        and(
          eq(evaluationPredictionsTable.runKind, "paper_trade"),
          eq(evaluationPredictionsTable.provider, provider.name),
          eq(evaluationPredictionsTable.externalFixtureId, fixture.id),
        ),
      );
    if (existing) continue;

    const lockDeadline = new Date(cutoffAt.getTime() + LOCK_GRACE_MINUTES * 60_000);

    const missedValues: PaperTradeInsert = {
      predictionMode: defaultPredictionMode("paper_trade"),
      strategyId: effectiveProductionIdentity.strategyId,
      strategyVersion: effectiveProductionIdentity.strategyVersion,
      strategyFingerprint: effectiveProductionIdentity.strategyFingerprint,
      optimizerRunId: null,
      calibrationVersion: null,
      competitiveBalanceVersion: null,
      evidenceReliabilityVersion: null,
      runKind: "paper_trade",
      segment: "live",
      dataSegment: "live",
      provider: provider.name,
      externalFixtureId: fixture.id,
      player1Id: fixture.player1Id,
      player1Name: fixture.player1Name,
      player2Id: fixture.player2Id,
      player2Name: fixture.player2Name,
      surface: fixture.surface,
      matchFormat: fixture.matchFormat,
      tournamentLevel: fixture.tournamentLevel,
      tournamentName: fixture.tournamentName,
      scheduledStartAt,
      cutoffAt,
      lockedAt: new Date(now),
      modelVersion: LIVE_MODEL_VERSION,
      featureSnapshot: null,
      rawProbability: null,
      calibratedProbability: null,
      usedFallback: null,
      fallbackSources: null,
      predictedWinnerId: null,
      predictedWinnerName: null,
      status: "missed",
    };

    if (now >= scheduledStartAt.getTime() || now >= lockDeadline.getTime()) {
      // Either the match has already started, or the lock grace window after cutoff has already
      // elapsed with nothing locked. Either way this is a miss -- we never generate a prediction
      // after the cutoff has meaningfully passed, and we never backfill.
      const outcome = await persistBeforeStartOrMiss(missedValues, missedValues, scheduledStartAt, lockDeadline, clock, true);
      if (outcome === "missed") summary.missed += 1;
      continue;
    }

    if (now < cutoffAt.getTime()) continue; // not yet time to lock this one

    try {
      if (!fixture.surface || !fixture.matchFormat) {
        summary.errors.push(`Fixture ${fixture.id}: missing player profile or surface/format, skipped this cycle`);
        continue;
      }
      const { player1, player2, output, activeCalibrationId, marketOdds: paperTradeOddsQuote } = await predictFromSnapshot({
        provider,
        player1Id: fixture.player1Id,
        player2Id: fixture.player2Id,
        surface: fixture.surface,
        matchFormat: fixture.matchFormat,
        tournamentName: fixture.tournamentName,
        tournamentLevel: fixture.tournamentLevel,
        scheduledStartAt,
        includeWeather: true,
      });

      // The engine already applies the active Phase-4 calibration internally when one exists (see
      // predictionEngine/index.ts), so its own `calibratedProbability` output IS the final,
      // validated probability here -- no separate post-hoc calibration step is needed anymore.
      const calibratedProbability = output.calibratedProbability;
      const rawProbability = output.rawEnsembleProbability; // pre-calibration, kept for transparency/future refitting

      const favorsPlayer1 = calibratedProbability >= 50;
      const fallback = extractFallbackInstrumentation({
        engine: output.engine,
        decisionTrace: output.decisionTrace,
      });
      const snapshot: LiveFeatureSnapshot = {
        modelVersion: LIVE_MODEL_VERSION,
        engine: output.engine,
        preCalibrationProbability: rawProbability,
        dataQuality: output.dataQuality,
        isEliteTier: output.engine.isEliteTier,
        // Per-module weight trace: written forward-only; absent on rows scored before this field.
        moduleWeights: output.decisionTrace.modules,
      };

      // Task 47 / Task #146: market odds were already fetched inside predictFromSnapshot
      // (shared with the engine's Market Consensus module) — reuse that result here for the
      // audit columns instead of making a second provider call for the same fixture.
      const oddsQuote = paperTradeOddsQuote;
      const impliedProbability = oddsQuote
        ? computeVigAdjustedImpliedProbability(oddsQuote.player1DecimalOdds, oddsQuote.player2DecimalOdds)
        : null;
      // Oriented to the model's own pick, not to player1 -- see schema comment on marketEdge.
      const impliedProbabilityForPick =
        impliedProbability === null ? null : favorsPlayer1 ? impliedProbability : 100 - impliedProbability;
      const marketEdge = impliedProbabilityForPick === null ? null : output.predictedWinnerProbability - impliedProbabilityForPick;

      const predictionValues: PaperTradeInsert = {
        predictionMode: defaultPredictionMode("paper_trade"),
        strategyId: effectiveProductionIdentity.strategyId,
        strategyVersion: effectiveProductionIdentity.strategyVersion,
        strategyFingerprint: effectiveProductionIdentity.strategyFingerprint,
        optimizerRunId: null,
        calibrationVersion: activeCalibrationId,
        competitiveBalanceVersion: null,
        evidenceReliabilityVersion: null,
        runKind: "paper_trade",
        segment: "live",
        dataSegment: "live",
        provider: provider.name,
        externalFixtureId: fixture.id,
        player1Id: player1.id,
        player1Name: player1.name,
        player2Id: player2.id,
        player2Name: player2.name,
        surface: fixture.surface,
        matchFormat: fixture.matchFormat,
        tournamentLevel: fixture.tournamentLevel,
        tournamentName: fixture.tournamentName,
        scheduledStartAt,
        cutoffAt,
        lockedAt: new Date(now),
        modelVersion: LIVE_MODEL_VERSION,
        featureSnapshot: snapshot,
        modelAgreement: output.engine.modelAgreement,
        upsetRiskTier: output.upsetRisk,
        usedFallback: fallback.usedFallback,
        fallbackSources: fallback.fallbackSources,
        rawProbability,
        calibratedProbability,
        predictedWinnerId: favorsPlayer1 ? player1.id : player2.id,
        predictedWinnerName: favorsPlayer1 ? player1.name : player2.name,
        status: "pending",
        oddsProvider: oddsQuote?.provider ?? null,
        oddsPlayer1Decimal: oddsQuote?.player1DecimalOdds ?? null,
        oddsPlayer2Decimal: oddsQuote?.player2DecimalOdds ?? null,
        oddsFetchedAt: oddsQuote ? new Date(oddsQuote.fetchedAt) : null,
        impliedProbability,
        marketEdge,
      };

      // Scoring and provider calls above can cross the fixture's start. Recheck
      // the deadline now and persist only a missed row if the point-in-time
      // boundary has passed; never store or grade a hindsight prediction.
      const outcome = await persistBeforeStartOrMiss(predictionValues, missedValues, scheduledStartAt, lockDeadline, clock);
      if (outcome === "locked") summary.locked += 1;
      if (outcome === "missed") summary.missed += 1;
    } catch (err) {
      if (err instanceof ProviderUnavailableError) {
        summary.errors.push(`Fixture ${fixture.id}: provider unavailable (${err.message})`);
        continue;
      }
      if (err instanceof Error && err.message.includes("could not be found by the data provider")) {
        summary.errors.push(`Fixture ${fixture.id}: ${err.message}`);
        continue;
      }
      throw err;
    }
  }

  summary.graded = await gradePendingPaperTrades(summary.errors, provider);
  return summary;
}

async function gradePendingPaperTrades(errors: string[], providerOverride?: TennisDataProvider): Promise<number> {
  const settings = await getPredictionSettings();
  const provider = providerOverride ?? getTennisDataProvider();
  const pending = await db
    .select()
    .from(evaluationPredictionsTable)
    .where(and(eq(evaluationPredictionsTable.runKind, "paper_trade"), eq(evaluationPredictionsTable.status, "pending")));

  let gradedCount = 0;
  for (const row of pending) {
    // A terminal provider record is not sufficient on its own: both the frozen
    // start and the result record's scheduled start must be in the past.
    const now = Date.now();
    if (now < row.scheduledStartAt.getTime()) continue;

    if (row.player1Id === row.player2Id) {
      errors.push(`Grading prediction ${row.id}: duplicate player IDs (${row.player1Id}) -- grading blocked`);
      continue;
    }

    let providerHistoryError: string | null = null;
    // Preserve the legacy direct history resolver and its one-hour settling
    // cushion. Some providers return 400 for this request; a failed or empty
    // direct lookup then falls through to the neutral result ledger, whose
    // source fixture IDs live in a separate namespace.
    if (now >= row.scheduledStartAt.getTime() + 60 * 60_000) {
      try {
        const matches = await provider.getPlayerMatches(row.player1Id);
        const candidates = matches.filter((match) => {
          if (!row.externalFixtureId || match.id !== row.externalFixtureId) return false;
          if (match.opponentId !== row.player2Id || (match.result !== "W" && match.result !== "L")) return false;
          const resultScheduledStart = new Date(match.date).getTime();
          if (
            !Number.isFinite(resultScheduledStart)
            || resultScheduledStart > Date.now()
            || Math.abs(resultScheduledStart - row.scheduledStartAt.getTime()) > SHARED_LIVE_RESULT_WINDOW_MS
          ) {
            return false;
          }
          return comparableMetadataMatches(row.tournamentName, match.tournamentName)
            && comparableMetadataMatches(row.surface, match.surface);
        });

        if (candidates.length > 1) {
          errors.push(
            row.externalFixtureId
              ? `Grading prediction ${row.id}: ambiguous matches for fixture ${row.externalFixtureId}; grading blocked`
              : `Grading prediction ${row.id}: ambiguous matches for player pair ${row.player1Id}/${row.player2Id}; grading blocked`,
          );
          continue;
        }

        const match = candidates[0];
        if (match) {
          const directWinnerId = match.result === "W" ? row.player1Id : row.player2Id;
          const directResultType = match.walkover ? "walkover" : match.retired ? "retired" : "normal";
          const neutralResolution = await findSharedLiveResult(
            row.provider,
            row.player1Id,
            row.player2Id,
            row.scheduledStartAt,
            row.tournamentName,
            row.surface,
            Date.now(),
          );
          if (neutralResolution.kind === "ambiguous") {
            errors.push(`Grading prediction ${row.id}: ambiguous shared live results contradicting/directly corroborating provider history; grading blocked`);
            continue;
          }
          if (neutralResolution.kind === "matched") {
            const neutralWinnerId = mapSharedResultWinnerToProviderId(neutralResolution.result);
            if (
              !neutralWinnerId
              || neutralWinnerId !== directWinnerId
              || resultTypeFromSharedLiveRow(neutralResolution.result) !== directResultType
            ) {
              errors.push(`Grading prediction ${row.id}: provider history winner conflicts with shared live result or cannot be mapped; grading blocked`);
              continue;
            }
          }

          const winnerName = directWinnerId === row.player1Id ? row.player1Name : row.player2Name;
          await settleEvaluationPrediction(row.id, { actualWinnerId: directWinnerId, actualWinnerName: winnerName, resultType: directResultType }, settings);
          gradedCount += 1;
          continue;
        }
      } catch (err) {
        if (err instanceof ProviderUnavailableError) {
          providerHistoryError = `provider unavailable (${err.message})`;
        } else {
          providerHistoryError = err instanceof Error ? err.message : String(err);
        }
      }
    }

    try {
      const resolution = await findSharedLiveResult(
        row.provider,
        row.player1Id,
        row.player2Id,
        row.scheduledStartAt,
        row.tournamentName,
        row.surface,
        Date.now(),
      );
      if (resolution.kind === "ambiguous") {
        errors.push(`Grading prediction ${row.id}: ambiguous shared live results for provider player pair ${row.player1Id}/${row.player2Id}; grading blocked`);
        if (providerHistoryError) errors.push(`Grading prediction ${row.id}: provider history unavailable (${providerHistoryError})`);
        continue;
      }
      if (resolution.kind === "none") {
        // No defensible result means pending. Time elapsed alone is not proof
        // of cancellation, and must never be converted into a fabricated void.
        if (providerHistoryError) errors.push(`Grading prediction ${row.id}: provider history unavailable (${providerHistoryError})`);
        continue;
      }

      const { result } = resolution;
      const winnerId = mapSharedResultWinnerToProviderId(result);
      if (winnerId !== row.player1Id && winnerId !== row.player2Id) {
        errors.push(`Grading prediction ${row.id}: shared live result winner could not be mapped to the frozen provider participants; grading blocked`);
        continue;
      }
      const winnerName = winnerId === row.player1Id ? row.player1Name : row.player2Name;
      const resultType = resultTypeFromSharedLiveRow(result);
      await settleEvaluationPrediction(row.id, { actualWinnerId: winnerId, actualWinnerName: winnerName, resultType }, settings);
      gradedCount += 1;
      if (providerHistoryError) {
        logger.warn(
          { predictionId: row.id, providerHistoryError },
          "Paper-trade prediction graded from shared live result after provider history lookup failed",
        );
      }
    } catch (err) {
      logger.error({ err, predictionId: row.id }, "Unexpected error grading paper-trade prediction from shared live results");
      errors.push(`Grading prediction ${row.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return gradedCount;
}
