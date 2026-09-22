/**
 * Admin-only, READ-ONLY: COUNTERFACTUAL_RESEARCH_V1 Parlay Builder research results.
 *
 * Every response is explicitly labeled `researchBuilderVersion: "COUNTERFACTUAL_RESEARCH_V1"` so
 * no client can mistake this for `PRODUCTION_BUILDER` output. This router never writes anything
 * -- runs are only ever produced by the backtest scripts (src/scripts/runParlayBuilderResearchV1
 * Backtest.ts and friends), run by an operator, never triggered from the API. It also never reads
 * from builder_decision_log or parlay_leg_outcomes (the production Builder's own tables) -- the
 * Prediction Engine/Parlay Builder boundary from Phase 0 applies here too.
 */
import { Router, type IRouter } from "express";
import { eq, desc, and } from "drizzle-orm";
import { requireAdmin } from "../lib/adminAuth";
import { db, parlayBuilderResearchV1RunsTable, parlayBuilderResearchV1ResultsTable } from "@workspace/db";

const router: IRouter = Router();
const LABEL = "COUNTERFACTUAL_RESEARCH_V1" as const;

// GET /admin/parlay/research-v1/runs — list all research runs
router.get("/admin/parlay/research-v1/runs", requireAdmin, async (_req, res): Promise<void> => {
  try {
    const runs = await db.select().from(parlayBuilderResearchV1RunsTable).orderBy(desc(parlayBuilderResearchV1RunsTable.createdAt));
    res.json({ label: LABEL, disclaimer: "Counterfactual research backtest. NOT a claim that the production Parlay Builder existed or produced these decisions historically.", runs });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Failed to list research runs" });
  }
});

// GET /admin/parlay/research-v1/runs/:runId — one run's metadata + summary
router.get("/admin/parlay/research-v1/runs/:runId", requireAdmin, async (req, res): Promise<void> => {
  try {
    const runId = String(req.params.runId);
    const [run] = await db.select().from(parlayBuilderResearchV1RunsTable).where(eq(parlayBuilderResearchV1RunsTable.runId, runId)).limit(1);
    if (!run) {
      res.status(404).json({ error: "Research run not found" });
      return;
    }
    res.json({ label: LABEL, disclaimer: "Counterfactual research backtest. NOT a claim that the production Parlay Builder existed or produced these decisions historically.", run });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Failed to fetch research run" });
  }
});

// GET /admin/parlay/research-v1/runs/:runId/results — paginated per-match results
router.get("/admin/parlay/research-v1/runs/:runId/results", requireAdmin, async (req, res): Promise<void> => {
  try {
    const limit = Math.min(Number.parseInt(String(req.query.limit ?? "100"), 10) || 100, 500);
    const offset = Math.max(Number.parseInt(String(req.query.offset ?? "0"), 10) || 0, 0);
    const decisionFilter = typeof req.query.decision === "string" ? req.query.decision : undefined;

    const runId = String(req.params.runId);
    const conditions = [eq(parlayBuilderResearchV1ResultsTable.runId, runId)];
    if (decisionFilter) conditions.push(eq(parlayBuilderResearchV1ResultsTable.builderDecision, decisionFilter));

    const results = await db
      .select()
      .from(parlayBuilderResearchV1ResultsTable)
      .where(and(...conditions))
      .orderBy(parlayBuilderResearchV1ResultsTable.scheduledStartAt)
      .limit(limit)
      .offset(offset);

    res.json({
      label: LABEL,
      disclaimer: "Counterfactual research backtest. NOT a claim that the production Parlay Builder existed or produced these decisions historically.",
      runId,
      limit,
      offset,
      count: results.length,
      results,
    });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Failed to fetch research results" });
  }
});

export default router;
