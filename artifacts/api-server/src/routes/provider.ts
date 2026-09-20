import { Router, type IRouter } from "express";
import { GetProviderStatusResponse } from "@workspace/api-zod";
import { getTennisDataProvider } from "../services/tennisData";
import { requireAdmin } from "../lib/adminAuth";
import { probeBsdPlayerSearch } from "../services/tennisData/bsdTennisProvider";

const router: IRouter = Router();

router.get("/provider/status", (_req, res): void => {
  const provider = getTennisDataProvider();
  const status = provider.getStatus();
  res.json(GetProviderStatusResponse.parse(status));
});

/**
 * Admin diagnostic: probes the BSD Tennis player-search endpoint for a given player name.
 * Confirms whether the /tennis/api/v2/players/?search= endpoint is reachable and whether
 * the search-fallback path resolves sub-500 players.
 *
 * GET /provider/bsd-probe?name=<player+name>
 * Returns BsdSearchProbeResult (see bsdTennisProvider.ts).
 */
router.get("/provider/bsd-probe", requireAdmin, async (req, res): Promise<void> => {
  const name = typeof req.query.name === "string" ? req.query.name.trim() : "";
  if (!name) {
    res.status(400).json({ error: "Missing required query parameter: name" });
    return;
  }
  try {
    const probe = await probeBsdPlayerSearch(name);
    res.json(probe);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

/**
 * Admin diagnostic: returns the most recent safe routing summary for one player.
 * The normal player-history request records this summary; this endpoint never
 * exposes upstream payloads, credentials, or match details.
 */
router.get("/provider/history-diagnostics/:playerId", requireAdmin, (req, res): void => {
  const provider = getTennisDataProvider();
  const diagnosticsProvider = provider as typeof provider & {
    getHistoryRoutingDiagnostics?: (playerId: string) => unknown;
  };
  const rawPlayerId = req.params.playerId;
  const playerId = Array.isArray(rawPlayerId) ? rawPlayerId[0] : rawPlayerId;
  const diagnostics = playerId
    ? diagnosticsProvider.getHistoryRoutingDiagnostics?.(playerId) ?? null
    : null;
  if (!diagnostics) {
    res.status(404).json({ error: "No history routing diagnostic is available for this player yet." });
    return;
  }
  res.json(diagnostics);
});

export default router;
