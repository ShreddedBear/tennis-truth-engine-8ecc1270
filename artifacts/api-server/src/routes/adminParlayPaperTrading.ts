/**
 * Admin-only, READ-ONLY: LIVE_PRODUCTION_PAPER_TRADING visibility layer.
 *
 * Pure observability over the tables `discoverAndDecidePaperTrade`/`settlement.ts` write --
 * this router never writes anything, and never calls a live provider (every response is built
 * entirely from parlay_paper_trades / parlay_paper_trade_pairs / parlay_paper_trade_factors /
 * parlay_paper_trade_snapshots). Filter/pagination parsing and response shaping are pure
 * functions from adminQueryParams.ts / adminShaping.ts -- this file is a thin DB-query layer
 * on top of them, matching adminParlayResearchV1.ts's own thin-router convention.
 *
 * Explicitly isolated from COUNTERFACTUAL_RESEARCH_V1 and the Prediction Engine: never reads
 * parlay_builder_research_v1_*, builder_decision_log, parlay_leg_outcomes, predictions, or
 * evaluation_predictions.
 */
import { Router, type IRouter } from "express";
import { and, eq, gte, lte, inArray, isNull, isNotNull, desc, sql } from "drizzle-orm";
import { requireAdmin } from "../lib/adminAuth";
import {
  db,
  parlayPaperTradesTable,
  parlayPaperTradePairsTable,
  parlayPaperTradeFactorsTable,
  parlayPaperTradeSnapshotsTable,
} from "@workspace/db";
import { parsePagination, parsePairListFilters, parseStatsFilters, isSyntheticTestFixture, type PairListFilters, type StatsFilters } from "../services/parlayPaperTrading/adminQueryParams.js";
import { shapePairSummary, shapePairDetail, withCrossSideIntegrity } from "../services/parlayPaperTrading/adminShaping.js";
import { computeParlayPaperTradingStatistics, type StatsTradeRow, type StatsPairRow } from "../services/parlayPaperTrading/statistics.js";

const router: IRouter = Router();
const LABEL = "LIVE_PRODUCTION_PAPER_TRADING" as const;

/** Shared WHERE conditions applicable to either sibling row (all filters except evaluatedSide/decision, which are genuinely per-side). */
function buildSharedConditions(filters: PairListFilters) {
  const conditions = [];
  if (filters.status) conditions.push(eq(parlayPaperTradesTable.status, filters.status));
  if (filters.dateFrom) conditions.push(gte(parlayPaperTradesTable.scheduledStartAt, filters.dateFrom));
  if (filters.dateTo) conditions.push(lte(parlayPaperTradesTable.scheduledStartAt, filters.dateTo));
  if (filters.tournamentName) conditions.push(eq(parlayPaperTradesTable.tournamentName, filters.tournamentName));
  if (filters.surface) conditions.push(eq(parlayPaperTradesTable.surface, filters.surface));
  if (filters.builderVersion) conditions.push(eq(parlayPaperTradesTable.builderVersion, filters.builderVersion));
  if (filters.builderConfigFingerprint) conditions.push(eq(parlayPaperTradesTable.builderConfigFingerprint, filters.builderConfigFingerprint));
  if (filters.calibrationModelId != null) conditions.push(eq(parlayPaperTradesTable.calibrationModelId, filters.calibrationModelId));
  if (filters.resultType) conditions.push(eq(parlayPaperTradesTable.resultType, filters.resultType));
  if (filters.gradingStatus === "graded") conditions.push(isNotNull(parlayPaperTradesTable.gradedAt));
  if (filters.gradingStatus === "ungraded") conditions.push(isNull(parlayPaperTradesTable.gradedAt));
  if (filters.evaluatedSide) conditions.push(eq(parlayPaperTradesTable.evaluatedSide, filters.evaluatedSide));
  if (filters.decision) conditions.push(eq(parlayPaperTradesTable.decision, filters.decision));
  return conditions;
}

// GET /admin/parlay-paper-trading/pairs — paginated, filtered list. Three bounded queries
// (pairId page -> both trade rows for that page -> pairs-table rows for that page), never N+1.
router.get("/admin/parlay-paper-trading/pairs", requireAdmin, async (req, res): Promise<void> => {
  try {
    const { limit, offset } = parsePagination(req.query as Record<string, unknown>);
    const filters = parsePairListFilters(req.query as Record<string, unknown>);
    const conditions = buildSharedConditions(filters);

    const pairIdRows = await db
      .selectDistinct({ pairId: parlayPaperTradesTable.pairId, scheduledStartAt: parlayPaperTradesTable.scheduledStartAt })
      .from(parlayPaperTradesTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(parlayPaperTradesTable.scheduledStartAt))
      .limit(limit)
      .offset(offset);

    const pairIds = pairIdRows.map((r) => r.pairId);
    if (pairIds.length === 0) {
      res.json({ label: LABEL, limit, offset, count: 0, pairs: [] });
      return;
    }

    const [trades, pairRows] = await Promise.all([
      db.select().from(parlayPaperTradesTable).where(inArray(parlayPaperTradesTable.pairId, pairIds)),
      db.select().from(parlayPaperTradePairsTable).where(inArray(parlayPaperTradePairsTable.pairId, pairIds)),
    ]);

    const tradesByPair = new Map<string, typeof trades>();
    for (const t of trades) {
      const list = tradesByPair.get(t.pairId) ?? [];
      list.push(t);
      tradesByPair.set(t.pairId, list);
    }
    const pairRowByPairId = new Map(pairRows.map((p) => [p.pairId, p]));

    const pairs = pairIds
      .map((pairId) => {
        const rows = tradesByPair.get(pairId);
        if (!rows || rows.length !== 2) return null;
        const summary = shapePairSummary(rows[0]!, rows[1]!);
        const pairRow = pairRowByPairId.get(pairId);
        return pairRow ? withCrossSideIntegrity(summary, pairRow) : summary;
      })
      .filter((p): p is NonNullable<typeof p> => p != null);

    res.json({ label: LABEL, limit, offset, count: pairs.length, pairs });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Failed to list paper trades" });
  }
});

// GET /admin/parlay-paper-trading/pairs/:pairId — full provenance detail.
router.get("/admin/parlay-paper-trading/pairs/:pairId", requireAdmin, async (req, res): Promise<void> => {
  try {
    const pairId = String(req.params.pairId);
    const [trades, [pairRow], [snapshotRow]] = await Promise.all([
      db.select().from(parlayPaperTradesTable).where(eq(parlayPaperTradesTable.pairId, pairId)),
      db.select().from(parlayPaperTradePairsTable).where(eq(parlayPaperTradePairsTable.pairId, pairId)).limit(1),
      db.select().from(parlayPaperTradeSnapshotsTable).where(eq(parlayPaperTradeSnapshotsTable.pairId, pairId)).limit(1),
    ]);

    if (trades.length !== 2) {
      res.status(404).json({ error: "Paper trade pair not found" });
      return;
    }

    const factorRows = await db
      .select()
      .from(parlayPaperTradeFactorsTable)
      .where(inArray(parlayPaperTradeFactorsTable.paperTradeId, trades.map((t) => t.paperTradeId)));
    const factorsByTradeId = new Map<string, typeof factorRows>();
    for (const f of factorRows) {
      const list = factorsByTradeId.get(f.paperTradeId) ?? [];
      list.push(f);
      factorsByTradeId.set(f.paperTradeId, list);
    }

    const p1 = trades.find((t) => t.evaluatedSide === "PLAYER_1");
    const p2 = trades.find((t) => t.evaluatedSide === "PLAYER_2");
    if (!p1 || !p2) {
      res.status(500).json({ error: "Paper trade pair is malformed (missing a side)" });
      return;
    }

    const detail = shapePairDetail(
      p1, p2, pairRow ?? null, snapshotRow ?? null,
      factorsByTradeId.get(p1.paperTradeId) ?? [], factorsByTradeId.get(p2.paperTradeId) ?? [],
    );
    res.json({ label: LABEL, detail });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Failed to fetch paper trade detail" });
  }
});

// GET /admin/parlay-paper-trading/summary — lightweight lifecycle counts for the dashboard's
// summary cards. Excludes synthetic acceptance/test fixtures (external_fixture_id LIKE 'TEST-%')
// -- see isSyntheticTestFixture's doc comment. Superseded/extended by a fuller accuracy-focused
// statistics endpoint in a later phase; this one only needs to answer "how many are in each
// lifecycle state," not compute accuracy.
router.get("/admin/parlay-paper-trading/summary", requireAdmin, async (_req, res): Promise<void> => {
  try {
    const rows = await db
      .select({
        status: parlayPaperTradesTable.status,
        count: sql<number>`count(distinct ${parlayPaperTradesTable.pairId})`,
      })
      .from(parlayPaperTradesTable)
      .where(sql`${parlayPaperTradesTable.externalFixtureId} NOT LIKE 'TEST-%'`)
      .groupBy(parlayPaperTradesTable.status);

    const byStatus: Record<string, number> = {};
    for (const row of rows) byStatus[row.status] = Number(row.count);

    const [{ count: crossSideDisagreements }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(parlayPaperTradePairsTable)
      .where(and(
        eq(parlayPaperTradePairsTable.crossSideAgreement, false),
        sql`${parlayPaperTradePairsTable.externalFixtureId} NOT LIKE 'TEST-%'`,
      ));

    res.json({
      label: LABEL,
      byStatus,
      crossSideDisagreements: Number(crossSideDisagreements ?? 0),
    });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Failed to compute paper-trading summary" });
  }
});

// A defensive cap, not an expected volume -- prospective paper trading produces at most a
// handful of pairs per day, so this is many multiples of any realistic history. Documented
// explicitly per the "no huge unbounded historical scans" requirement.
const STATS_ROW_CAP = 20_000;

function buildStatsConditions(filters: StatsFilters) {
  // Always excludes synthetic acceptance/test fixtures (see isSyntheticTestFixture's doc
  // comment) -- production prospective statistics must never include a TEST-* row.
  const conditions = [sql`${parlayPaperTradesTable.externalFixtureId} NOT LIKE 'TEST-%'`];
  if (filters.dateFrom) conditions.push(gte(parlayPaperTradesTable.scheduledStartAt, filters.dateFrom));
  if (filters.dateTo) conditions.push(lte(parlayPaperTradesTable.scheduledStartAt, filters.dateTo));
  if (filters.builderVersion) conditions.push(eq(parlayPaperTradesTable.builderVersion, filters.builderVersion));
  if (filters.builderConfigFingerprint) conditions.push(eq(parlayPaperTradesTable.builderConfigFingerprint, filters.builderConfigFingerprint));
  if (filters.calibrationModelId != null) conditions.push(eq(parlayPaperTradesTable.calibrationModelId, filters.calibrationModelId));
  return conditions;
}

// GET /admin/parlay-paper-trading/stats — PRODUCTION PROSPECTIVE PARLAY BUILDER PAPER TRADING
// statistics. The ONLY authoritative source is parlay_paper_trades / parlay_paper_trade_pairs
// (see statisticsBoundary.test.ts for the static proof this route never references Research V1,
// the Prediction Engine, or the legacy builder_decision_log/parlay_leg_outcomes tables). All
// actual aggregation happens in the pure, DB-free statistics.ts module -- this handler only
// fetches two narrow, filtered, indexed-column-bounded row sets and hands them off.
router.get("/admin/parlay-paper-trading/stats", requireAdmin, async (req, res): Promise<void> => {
  try {
    const filters = parseStatsFilters(req.query as Record<string, unknown>);
    const conditions = buildStatsConditions(filters);

    const tradeRows = await db
      .select({
        pairId: parlayPaperTradesTable.pairId,
        evaluatedSide: parlayPaperTradesTable.evaluatedSide,
        player1Id: parlayPaperTradesTable.player1Id,
        player1Name: parlayPaperTradesTable.player1Name,
        player2Id: parlayPaperTradesTable.player2Id,
        player2Name: parlayPaperTradesTable.player2Name,
        status: parlayPaperTradesTable.status,
        noDecisionReason: parlayPaperTradesTable.noDecisionReason,
        decision: parlayPaperTradesTable.decision,
        builderPickedPlayerId: parlayPaperTradesTable.builderPickedPlayerId,
        builderCalibratedProbability: parlayPaperTradesTable.builderCalibratedProbability,
        dataCoverage: parlayPaperTradesTable.dataCoverage,
        resultType: parlayPaperTradesTable.resultType,
        includedInAccuracy: parlayPaperTradesTable.includedInAccuracy,
        gradedCorrect: parlayPaperTradesTable.gradedCorrect,
        scheduledStartAt: parlayPaperTradesTable.scheduledStartAt,
        builderVersion: parlayPaperTradesTable.builderVersion,
        builderConfigFingerprint: parlayPaperTradesTable.builderConfigFingerprint,
        calibrationModelId: parlayPaperTradesTable.calibrationModelId,
      })
      .from(parlayPaperTradesTable)
      .where(and(...conditions))
      .limit(STATS_ROW_CAP);

    const pairIds = [...new Set(tradeRows.map((r) => r.pairId))];
    const pairRows = pairIds.length === 0 ? [] : await db
      .select({
        pairId: parlayPaperTradePairsTable.pairId,
        crossSideAgreement: parlayPaperTradePairsTable.crossSideAgreement,
        crossSideDisagreementReason: parlayPaperTradePairsTable.crossSideDisagreementReason,
      })
      .from(parlayPaperTradePairsTable)
      .where(and(inArray(parlayPaperTradePairsTable.pairId, pairIds), sql`${parlayPaperTradePairsTable.externalFixtureId} NOT LIKE 'TEST-%'`))
      .limit(STATS_ROW_CAP);

    const statistics = computeParlayPaperTradingStatistics(tradeRows as StatsTradeRow[], pairRows as StatsPairRow[]);

    res.json({
      label: LABEL,
      filters: {
        dateFrom: filters.dateFrom?.toISOString() ?? null,
        dateTo: filters.dateTo?.toISOString() ?? null,
        builderVersion: filters.builderVersion ?? null,
        builderConfigFingerprint: filters.builderConfigFingerprint ?? null,
        calibrationModelId: filters.calibrationModelId ?? null,
      },
      statistics,
    });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Failed to compute paper-trading statistics" });
  }
});

export default router;
