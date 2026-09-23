/**
 * Live provider fetch for the Parlay Builder Validation Engine.
 *
 * When a player is absent from the local historical_matches cache after all
 * DB-layer resolution attempts, this module queries every configured external
 * tennis provider in the same order as the prediction engine, and returns
 * their match records for use as validation evidence.
 *
 * Provider chain (mirrors compositeProvider.ts but is intentionally independent):
 *   Tier 1: Live Tennis API        (Live_Tennis_Api) — player search + full match history
 *   Fallback: Sofascore             (no key required) — supplemental history for sparse players
 *
 * Each tier has its own error handling and diagnostics.  No tier shares circuit-breaker
 * state or provider instances with the prediction engine's compositeProvider.ts — the
 * separation is intentional so a quota exhaustion in one subsystem never silently degrades
 * the other.
 *
 * Required outcomes (per architecture spec):
 *
 *   CACHE_HIT         — found in local DB (caller sets this; not returned here)
 *   CACHE_MISS        — not in local DB; this module was invoked
 *   PLAYER_RESOLVED   — matched to a canonical provider identity
 *   DATA_FOUND        — match records retrieved from provider
 *   SOURCE_UNAVAILABLE — provider failed, timed out, or could not be queried
 *   PLAYER_NOT_FOUND  — provider responded successfully but found no matching player
 *   NO_MATCH_HISTORY  — player was identified; provider returned 0 completed matches
 *   DATA_UNAVAILABLE  — all configured providers are unreachable; scoring is impossible
 *
 * A successful fetch also writes records to historical_matches (non-blocking,
 * best-effort) so subsequent requests for the same player hit the DB cache.
 */

import { pool } from "@workspace/db";
import { LiveTennisHistoricalProvider } from "../tennisData/liveTennisHistoricalProvider.js";
import {
  ProviderUnavailableError,
  type TennisDataProvider,
  type MatchRecord,
  type PlayerSummary,
} from "../tennisData/index.js";
import { logger } from "../../lib/logger.js";
import { resolvePlayerProfileByName } from "../tennisData/playerIdentity.js";
import { fetchFromSofascore, isConfidentSofascoreMatch } from "./sofascoreProvider.js";
import { fetchMarketOdds } from "../oddsData/index.js";

// ─── Outcome & diagnostic types ──────────────────────────────────────────────

export type ResolutionOutcome =
  | "CACHE_HIT"
  | "CACHE_MISS"
  | "PLAYER_RESOLVED"
  | "DATA_FOUND"
  | "SOURCE_UNAVAILABLE"
  | "PLAYER_NOT_FOUND"
  | "NO_MATCH_HISTORY"
  | "DATA_UNAVAILABLE"
  /**
   * The player was found in the local DB cache but their records were stale
   * (most-recent match older than STALE_MAX_MATCH_AGE_DAYS days, or fewer than
   * STALE_MIN_MATCH_COUNT rows).  The live provider chain was invoked and returned
   * fresh records, which replaced the stale DB rows for this validation request.
   * The fresh records are also written back to the DB so the next request hits Layer 1.
   */
  | "CACHE_HIT_SUPPLEMENTED";

export interface ProviderSourceDiagnostic {
  source: string;
  attempted: boolean;
  succeeded: boolean;
  playerFound: boolean;
  recordsReturned: number;
  providerPlayerId?: string;
  failureReason?: string;
}

export interface LiveFetchDiagnostics {
  outcome: ResolutionOutcome;
  /** Every provider the app is configured to use. */
  sourcesConfigured: string[];
  /** Providers that were actually called this request. */
  sourcesAttempted: string[];
  /** Providers that returned a usable response. */
  sourcesSuccessful: string[];
  /** Providers that errored, timed out, or returned nothing. */
  sourcesFailed: string[];
  /** How the player identity was resolved (e.g. "full-name", "surname", "normalized"). */
  playerResolutionMethod: string;
  /** Provider name → provider-internal player ID found. */
  providerIdsFound: Record<string, string>;
  /** Provider name → number of match records returned. */
  recordsPerSource: Record<string, number>;
  /** Human-readable failure explanations. */
  failureReasons: string[];
  /** Per-provider detail — enough for an admin diagnostics panel. */
  sources: ProviderSourceDiagnostic[];
}

export interface LiveFetchResult {
  records: MatchRecord[];
  resolvedPlayerId: string | null;
  resolvedPlayerName: string | null;
  tour: string | null;
  diagnostics: LiveFetchDiagnostics;
}

// ─── Lazy provider singletons ─────────────────────────────────────────────────
//
// Each provider is constructed once per process and re-used across requests.
// They are kept separate from the prediction engine's getTennisDataProvider()
// instances so quota exhaustion / circuit state in one subsystem never bleeds
// into the other.  `undefined` = not yet initialised; `null` = key absent.

let _builderLiveProvider: LiveTennisHistoricalProvider | null | undefined;

function getBuilderLiveProvider(): LiveTennisHistoricalProvider | null {
  if (_builderLiveProvider !== undefined) return _builderLiveProvider;
  const key = process.env.Live_Tennis_Api ?? process.env.LIVE_TENNIS_API_KEY;
  _builderLiveProvider = key ? new LiveTennisHistoricalProvider({ apiKey: key }) : null;
  return _builderLiveProvider;
}

function describeProviderError(err: unknown): string {
  if (err instanceof ProviderUnavailableError) return err.message;
  if (err instanceof Error) {
    const maybeError = err as Error & {
      status?: number;
      statusCode?: number;
      response?: { status?: number };
    };
    const status = maybeError.status ?? maybeError.statusCode ?? maybeError.response?.status;
    const statusPrefix = typeof status === "number" ? `HTTP ${status}: ` : "";
    return `${statusPrefix}${err.message || err.name || "Unknown provider error"}`;
  }
  return String(err);
}

// ─── DB cache write (non-blocking best-effort) ───────────────────────────────

async function saveMatchesToDb(
  records: MatchRecord[],
  playerId: string,
  playerName: string,
  tour: string | null,
  providerLabel: string,
): Promise<void> {
  for (const rec of records) {
    const winnerId = rec.result === "W" ? playerId : rec.opponentId;
    try {
      await pool.query(
        `INSERT INTO historical_matches (
          external_id, provider, tour,
          tournament_name, tournament_level, surface, round, match_format,
          player1_id, player1_name, player2_id, player2_name, winner_id,
          score, retired, walkover, cancelled,
          player2_rank, scheduled_start_at, imported_at
        ) VALUES (
          $1, $2, $3,
          $4, $5, $6, $7, $8,
          $9, $10, $11, $12, $13,
          $14, $15, $16, false,
          $17, $18, NOW()
        )
        ON CONFLICT DO NOTHING`,
        [
          rec.id,
          providerLabel,
          tour,
          rec.tournamentName,
          rec.tournamentLevel,
          rec.surface,
          rec.round,
          rec.matchFormat,
          playerId,
          playerName,
          rec.opponentId,
          rec.opponentName,
          winnerId,
          rec.score,
          rec.retired,
          rec.walkover,
          rec.opponentRank,
          rec.date ? new Date(rec.date) : null,
        ]
      );
    } catch {
      // Silently swallow — cache write is best-effort, never blocks validation
    }
  }
}

const LIVE_TENNIS_SOURCE = "live-tennis-api";

// ─── Fallback identity source: RapidAPI / MatchStat ──────────────────────────

/**
 * Attempt to resolve a player's identity via the RapidAPI / MatchStat provider.
 *
 * MatchStat exposes player search through its rankings endpoints (ATP + WTA).
 * It does NOT have a per-player match history endpoint, so this function can
 * only confirm whether the player is found in current standings — it never
 * returns match records. When the player is found their MatchStat ID is recorded
 * in diagnostics for traceability. If MatchStat is unavailable or the player is
 * not found, returns null and the caller moves on to Tier 2.
 */
async function attemptRapidApi(
  playerName: string,
  diag: LiveFetchDiagnostics,
  providerOverride?: TennisDataProvider | null,
): Promise<PlayerSummary | null> {
  const provider = providerOverride !== undefined ? providerOverride : null;
  if (!provider) return null; // key not configured — skip silently

  const sourceDiag: ProviderSourceDiagnostic = {
    source: "rapidapi",
    attempted: true,
    succeeded: false,
    playerFound: false,
    recordsReturned: 0,
  };
  diag.sourcesAttempted.push("rapidapi");

  let foundPlayer: PlayerSummary | null = null;
  let searchErrorReason: string | null = null;
  try {
    const resolved = await resolvePlayerProfileByName(
      provider as TennisDataProvider,
      playerName,
      playerName,
      {
        onSearchError: (err, query) => {
          searchErrorReason = describeProviderError(err);
          logger.warn({ source: "rapidapi", query, err, reason: searchErrorReason }, "builderProviderFetch: rapidapi shared resolver search failed");
        },
      },
    );
    if (resolved) {
      foundPlayer = resolved;
    }
  } catch (err) {
    const reason = describeProviderError(err);
    logger.warn({ source: "rapidapi", err, reason }, "builderProviderFetch: rapidapi shared resolver failed");
    sourceDiag.failureReason = reason;
    diag.sourcesFailed.push("rapidapi");
    diag.failureReasons.push(`rapidapi resolve: ${reason}`);
    diag.outcome = "SOURCE_UNAVAILABLE";
    diag.sources.push(sourceDiag);
    return null;
  }

  if (searchErrorReason && !foundPlayer) {
    sourceDiag.failureReason = searchErrorReason;
    diag.sourcesFailed.push("rapidapi");
    diag.failureReasons.push(`rapidapi resolve: ${searchErrorReason}`);
    diag.outcome = "SOURCE_UNAVAILABLE";
    diag.sources.push(sourceDiag);
    return null;
  }

  if (foundPlayer) {
    sourceDiag.succeeded = true;
    sourceDiag.playerFound = true;
    sourceDiag.providerPlayerId = foundPlayer.id;
    // MatchStat has no match-history endpoint: record 0 records but mark player found
    sourceDiag.recordsReturned = 0;
    diag.sourcesSuccessful.push("rapidapi");
    diag.providerIdsFound["rapidapi"] = foundPlayer.id;
    diag.recordsPerSource["rapidapi"] = 0;
    if (diag.playerResolutionMethod === "none") {
      diag.playerResolutionMethod = "shared-player-identity";
    }
  } else {
    sourceDiag.failureReason = "Player not found in RapidAPI rankings";
    diag.sourcesFailed.push("rapidapi");
  }

  diag.sources.push(sourceDiag);
  return foundPlayer; // caller uses this as a hint (identity confirmed) even though no records
}

// ─── Primary full-history source: Live Tennis API ────────────────────────────

/**
 * Attempt to resolve a player and their match history via Live Tennis API.
 *
 * Live Tennis API supports both player search and full match-history retrieval, making
 * it the primary source of actual MatchRecord data in this chain. This is tried
 * before every fallback and returns a full LiveFetchResult when records are found.
 * Returns null when the player cannot be identified, when the provider is unavailable,
 * or when 0 completed matches are returned (fallback tiers are then tried by the caller).
 */
async function attemptLiveTennis(
  playerName: string,
  diag: LiveFetchDiagnostics,
  providerOverride?: TennisDataProvider | null,
  requestedPlayerId?: string | null,
): Promise<LiveFetchResult | null> {
  const provider = providerOverride !== undefined ? providerOverride : getBuilderLiveProvider();
  if (!provider) return null; // key not configured — skip silently

  const sourceDiag: ProviderSourceDiagnostic = {
    source: LIVE_TENNIS_SOURCE,
    attempted: true,
    succeeded: false,
    playerFound: false,
    recordsReturned: 0,
  };
  diag.sourcesAttempted.push(LIVE_TENNIS_SOURCE);

  // ── Step 1: Resolve the player through the shared identity service ──────
  let foundPlayer: PlayerSummary | null = null;
  let searchErrorReason: string | null = null;
  // Fixture IDs from Live Tennis API are authoritative when the player endpoint
  // confirms that the name still matches. A foreign/canonical ID returning 404 is
  // an identity miss, not a provider outage, so continue with name search.
  if (requestedPlayerId && provider.getPlayer) {
    try {
      const direct = await provider.getPlayer(requestedPlayerId);
      if (direct?.name && isConfidentSofascoreMatch(direct.name, playerName)) {
        foundPlayer = direct;
        diag.playerResolutionMethod = "provider-id";
      }
    } catch (err) {
      logger.debug(
        { source: LIVE_TENNIS_SOURCE, requestedPlayerId, err },
        "builderProviderFetch: Live Tennis direct ID lookup missed — continuing with name search",
      );
    }
  }

  try {
    if (!foundPlayer) {
      const candidates = await provider.searchPlayers(playerName);
      foundPlayer = candidates.find((candidate) =>
        candidate.name != null && isConfidentSofascoreMatch(candidate.name, playerName)
      ) ?? null;
      if (foundPlayer) diag.playerResolutionMethod = "provider-name";
    }
  } catch (err) {
    const reason = describeProviderError(err);
    logger.warn({ source: LIVE_TENNIS_SOURCE, err, reason }, "builderProviderFetch: Live Tennis API shared resolver failed");
    sourceDiag.failureReason = reason;
    diag.sourcesFailed.push(LIVE_TENNIS_SOURCE);
    diag.failureReasons.push(`Live Tennis API resolve: ${reason}`);
    diag.outcome = "SOURCE_UNAVAILABLE";
    diag.sources.push(sourceDiag);
    return null;
  }

  if (searchErrorReason && !foundPlayer) {
    sourceDiag.failureReason = searchErrorReason;
    diag.sourcesFailed.push(LIVE_TENNIS_SOURCE);
    diag.failureReasons.push(`Live Tennis API resolve: ${searchErrorReason}`);
    diag.outcome = "SOURCE_UNAVAILABLE";
    diag.sources.push(sourceDiag);
    return null;
  }

  if (!foundPlayer) {
    sourceDiag.failureReason = "Player not found in Live Tennis API";
    diag.sourcesFailed.push(LIVE_TENNIS_SOURCE);
    diag.sources.push(sourceDiag);
    return null;
  }

  sourceDiag.playerFound = true;
  sourceDiag.providerPlayerId = foundPlayer.id;
  diag.providerIdsFound[LIVE_TENNIS_SOURCE] = foundPlayer.id;
  if (diag.playerResolutionMethod === "none" || diag.playerResolutionMethod === "rapidapi-search") {
    diag.playerResolutionMethod = "provider-name";
  }

  // ── Step 2: Fetch match history ───────────────────────────────────────────
  let records: MatchRecord[] = [];
  try {
    records = await provider.getPlayerMatches(foundPlayer.id);
    sourceDiag.succeeded = true;
    sourceDiag.recordsReturned = records.length;
    diag.sourcesSuccessful.push(LIVE_TENNIS_SOURCE);
    diag.recordsPerSource[LIVE_TENNIS_SOURCE] = records.length;

    if (records.length > 0) {
      diag.outcome = "DATA_FOUND";

      // Non-blocking DB cache write
      saveMatchesToDb(
        records,
        foundPlayer.id,
        foundPlayer.name,
        foundPlayer.tour ?? null,
        "builder-live-fetch:live-tennis-api",
      ).catch(() => {});

      diag.sources.push(sourceDiag);
      return {
        records,
        resolvedPlayerId: foundPlayer.id,
        resolvedPlayerName: foundPlayer.name,
        tour: foundPlayer.tour ?? null,
        diagnostics: diag,
      };
    }

    // Player found but no completed match records
    diag.outcome = "NO_MATCH_HISTORY";
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    sourceDiag.failureReason = reason;
    diag.sourcesFailed.push(LIVE_TENNIS_SOURCE);
    diag.failureReasons.push(`Live Tennis API getPlayerMatches(${foundPlayer.id}): ${reason}`);
    diag.outcome = "SOURCE_UNAVAILABLE";
  }

  diag.sources.push(sourceDiag);
  return null;
}

// ─── Tier-3: Sofascore ────────────────────────────────────────────────────────

/**
 * Attempt to resolve a player and their match history via Sofascore.
 * Called after Live Tennis API and the fallback identity lookup fail to return records.
 * Updates `diag` in-place; returns a full LiveFetchResult on success, or null
 * when Sofascore also cannot provide data.
 */
async function attemptSofascore(
  playerName: string,
  diag: LiveFetchDiagnostics,
  sofascoreOverride?: typeof fetchFromSofascore,
): Promise<LiveFetchResult | null> {
  const sfFetch = sofascoreOverride ?? fetchFromSofascore;
  const sfDiag: ProviderSourceDiagnostic = {
    source: "sofascore",
    attempted: true,
    succeeded: false,
    playerFound: false,
    recordsReturned: 0,
  };
  diag.sourcesAttempted.push("sofascore");

  try {
    const sfResult = await sfFetch(playerName);

    if (sfResult.error) {
      sfDiag.failureReason = sfResult.error;
      diag.sourcesFailed.push("sofascore");
      diag.failureReasons.push(`sofascore: ${sfResult.error}`);
      diag.outcome = "SOURCE_UNAVAILABLE";
      diag.sources.push(sfDiag);
      return null;
    }

    if (sfResult.player && sfResult.records.length > 0) {
      sfDiag.succeeded = true;
      sfDiag.playerFound = true;
      sfDiag.providerPlayerId = sfResult.player.id;
      sfDiag.recordsReturned = sfResult.records.length;
      diag.sourcesSuccessful.push("sofascore");
      diag.providerIdsFound["sofascore"] = sfResult.player.id;
      diag.recordsPerSource["sofascore"] = sfResult.records.length;
      diag.outcome = "DATA_FOUND";
      if (diag.playerResolutionMethod === "none") {
        diag.playerResolutionMethod = "sofascore-search";
      }
      diag.sources.push(sfDiag);

      // Non-blocking DB cache write — next request for same player hits Layer 1
      saveMatchesToDb(
        sfResult.records,
        sfResult.player.id,
        sfResult.player.name,
        sfResult.player.tour ?? null,
        "builder-live-fetch:sofascore",
      ).catch(() => {});

      return {
        records: sfResult.records,
        resolvedPlayerId: sfResult.player.id,
        resolvedPlayerName: sfResult.player.name,
        tour: sfResult.player.tour ?? null,
        diagnostics: diag,
      };
    }

    if (sfResult.player) {
      // Player found but no completed match records on Sofascore either
      sfDiag.playerFound = true;
      sfDiag.providerPlayerId = sfResult.player.id;
      sfDiag.succeeded = true;
      sfDiag.recordsReturned = 0;
      diag.sourcesSuccessful.push("sofascore");
      diag.providerIdsFound["sofascore"] = sfResult.player.id;
      diag.outcome = "NO_MATCH_HISTORY";
    } else {
      sfDiag.failureReason = "Player not found in Sofascore";
      diag.sourcesFailed.push("sofascore");
      // PLAYER_NOT_FOUND outcome stays as-is when all providers say not found
    }
  } catch (err) {
    const reason = describeProviderError(err);
    logger.warn({ source: "sofascore", err, reason }, "builderProviderFetch: sofascore fetch failed");
    sfDiag.failureReason = reason;
    diag.sourcesFailed.push("sofascore");
    diag.failureReasons.push(`sofascore: ${reason}`);
    diag.outcome = "SOURCE_UNAVAILABLE";
  }

  diag.sources.push(sfDiag);
  return null;
}

// ─── Odds API (market consensus) ─────────────────────────────────────────────

/**
 * Attempt to fetch real pre-match head-to-head decimal odds for this matchup from the
 * configured odds providers (The Odds API primary → Odds-API.io fallback).
 *
 * Returns the decimal odds for the SELECTED player (the one passed as `selectedPlayerName`),
 * or null when:
 *   - neither odds key is configured
 *   - neither provider currently lists odds for this matchup
 *   - any transient provider error occurs (non-fatal: caller falls back to 50)
 *
 * `selectedPlayerName` is passed as "player1" to `fetchMarketOdds` so the caller can
 * use `quote.player1DecimalOdds` directly without additional name-mapping.
 *
 * Always skipped in backfill mode (asOfDate != null) — real-time API calls must never
 * fire when replaying historical matchups.
 */
export async function attemptOddsApi(
  selectedPlayerName: string,
  opponentName: string,
  scheduledStart: Date | null,
  asOfDate?: Date,
  /**
   * Optional fetch function override for unit tests. Production code always uses the real
   * `fetchMarketOdds` from the oddsData module; tests inject a stub to avoid network calls.
   */
  _fetchFn: typeof fetchMarketOdds = fetchMarketOdds,
): Promise<number | null> {
  if (asOfDate != null) return null; // never call live APIs in backfill mode
  try {
    const quote = await _fetchFn(selectedPlayerName, opponentName, scheduledStart);
    if (quote == null) return null;
    // selectedPlayerName was passed as "player1" → player1DecimalOdds is theirs
    const odds = quote.player1DecimalOdds;
    return odds > 1 ? odds : null;
  } catch {
    return null; // non-fatal — market odds are supplemental
  }
}

/**
 * Same provider chain and skip-logic as `attemptOddsApi`, but returns BOTH sides' decimal
 * odds from the SAME quote (a real market's player2 price is not simply the no-vig
 * reciprocal of player1's, so this does one shared fetch rather than deriving player2's
 * price from player1's). Used by double-sided evaluation (acquireBuilderEvidence) so both
 * directional scoring passes see the exact same odds instant instead of two live fetches.
 *
 * Always skipped in backfill mode (asOfDate != null), mirroring attemptOddsApi exactly.
 */
export async function attemptOddsApiBothSides(
  player1Name: string,
  player2Name: string,
  scheduledStart: Date | null,
  asOfDate?: Date,
  _fetchFn: typeof fetchMarketOdds = fetchMarketOdds,
): Promise<{ player1DecimalOdds: number; player2DecimalOdds: number } | null> {
  if (asOfDate != null) return null; // never call live APIs in backfill mode
  try {
    const quote = await _fetchFn(player1Name, player2Name, scheduledStart);
    if (quote == null) return null;
    if (!(quote.player1DecimalOdds > 1) || !(quote.player2DecimalOdds > 1)) return null;
    return { player1DecimalOdds: quote.player1DecimalOdds, player2DecimalOdds: quote.player2DecimalOdds };
  } catch {
    return null; // non-fatal — market odds are supplemental
  }
}

// ─── Provider injection interface (tests override; production uses env-key singletons) ──

export interface BuilderProviders {
  /** Live Tennis API adapter configured by Live_Tennis_Api. */
  rapidApi: TennisDataProvider | null;
  apiTennis: TennisDataProvider | null;
  sofascore: typeof fetchFromSofascore;
}

// ─── Main export ─────────────────────────────────────────────────────────────

/**
 * Fetch match records for a player from all configured external providers.
 *
 * Provider chain:
 *   1. Live Tennis API    — player search + full match history
 *   2. RapidAPI/MatchStat — fallback identity resolution only (no history endpoint)
 *   3. Sofascore          — fallback history for sparse/lower-tier players
 *
 * Each provider is attempted independently with its own error handling.  A
 * failure at any tier is recorded in diagnostics and the chain continues to the
 * next tier rather than surfacing a hard error to the caller.
 *
 * `_providers` is an optional injection point used exclusively by unit tests to
 * supply mock provider instances without needing module mocking.  Production
 * callers must never pass it.
 */
export async function fetchPlayerMatchesFromProviders(
  playerName: string,
  _context?: { playerId?: string; opponentName?: string; tournamentName?: string },
  _providers?: Partial<BuilderProviders>,
): Promise<LiveFetchResult> {
  // Resolve providers: injected overrides take precedence (tests use this);
  // production falls back to env-key singletons.
  // `undefined` in the injected map means "use env key"; `null` means "disabled".
  const injectedRapidApi = _providers && "rapidApi" in _providers ? _providers.rapidApi : undefined;
  const injectedApiTennis = _providers && "apiTennis" in _providers ? _providers.apiTennis : undefined;
  const injectedSofascore = _providers?.sofascore;

  const effectiveRapidApi = injectedRapidApi !== undefined ? injectedRapidApi : null;
  const effectiveApiTennis = injectedApiTennis !== undefined ? injectedApiTennis : getBuilderLiveProvider();

  const sourcesConfigured: string[] = [];
  if (effectiveApiTennis) sourcesConfigured.push(LIVE_TENNIS_SOURCE);
  if (effectiveRapidApi) sourcesConfigured.push("rapidapi");
  sourcesConfigured.push("sofascore");

  const diag: LiveFetchDiagnostics = {
    outcome: "CACHE_MISS",
    sourcesConfigured,
    sourcesAttempted: [],
    sourcesSuccessful: [],
    sourcesFailed: [],
    playerResolutionMethod: "none",
    providerIdsFound: {},
    recordsPerSource: {},
    failureReasons: [],
    sources: [],
  };

  // ── Tier 1: Live Tennis API — full search + match history ─────────────────
  if (effectiveApiTennis) {
    const liveTennisResult = await attemptLiveTennis(
      playerName,
      diag,
      effectiveApiTennis,
      _context?.playerId ?? null,
    );
    if (liveTennisResult) return liveTennisResult;
  }

  // ── Tier 2: RapidAPI / MatchStat — fallback identity diagnostics ─────────
  // This provider cannot return history and is never substituted for Live Tennis API.
  if (effectiveRapidApi) {
    await attemptRapidApi(playerName, diag, effectiveRapidApi);
  }

  // ── Tier 3: Sofascore — supplemental / fallback ───────────────────────────
  const sfResult = await attemptSofascore(playerName, diag, injectedSofascore);
  if (sfResult) return sfResult;

  // ── All providers exhausted ───────────────────────────────────────────────
  if (diag.outcome !== "NO_MATCH_HISTORY") {
    const anyAttempted = diag.sourcesAttempted.length > 0;
    if (!anyAttempted) {
      diag.outcome = "DATA_UNAVAILABLE";
    } else if (diag.failureReasons.length > 0) {
      diag.outcome = "SOURCE_UNAVAILABLE";
    } else {
      diag.outcome = "PLAYER_NOT_FOUND";
    }
  }

  return {
    records: [],
    resolvedPlayerId: null,
    resolvedPlayerName: null,
    tour: null,
    diagnostics: diag,
  };
}
