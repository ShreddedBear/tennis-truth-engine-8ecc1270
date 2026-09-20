import { logger } from "../../lib/logger";
import { OddsApiIoProvider } from "./oddsApiIoProvider";
import { TheOddsApiProvider } from "./theOddsApiProvider";
import { OddsProviderUnavailableError, type OddsProvider, type OddsProviderStatusInfo, type OddsQuote } from "./types";

export * from "./types";

/**
 * Task #146 (corrected): four-state odds outcome. The original three-state version collapsed two
 * genuinely different situations into "outside_window" — a provider that was queried and had no
 * odds for this matchup, and a provider that was never even configured (no API key set) so nothing
 * was queried at all. Both used to silently fall through to the same "outside_window" label,
 * which made "no market" and "no provider" indistinguishable downstream. Corrected here:
 * - "included"                — a real OddsQuote was returned.
 * - "no_market_available"     — at least one provider was configured and queried, and none had
 *                              odds for this matchup (expected when the match is >~31h out or not
 *                              covered by either provider's sport keys).
 * - "provider_not_configured" — no provider had an API key set at all; nothing was queried.
 * - "provider_error"          — at least one provider threw (quota exhausted, network, circuit
 *                              open).
 * Rows written before this correction may still hold the legacy string "outside_window" — readers
 * must treat that as "no_market_available OR provider_not_configured, ambiguous" rather than
 * assuming either.
 */
export type OddsStatus = "included" | "no_market_available" | "provider_not_configured" | "provider_error";

export interface MarketOddsResult {
  quote: OddsQuote | null;
  status: OddsStatus;
}

let primary: OddsProvider | null | undefined;
let fallback: OddsProvider | null | undefined;

function getPrimaryProvider(): OddsProvider | null {
  if (primary === undefined) {
    const apiKey = process.env.THE_ODDS_API_KEY;
    primary = apiKey ? new TheOddsApiProvider(apiKey) : null;
  }
  return primary;
}

function getFallbackProvider(): OddsProvider | null {
  if (fallback === undefined) {
    const apiKey = process.env.ODDS_API_IO_KEY;
    fallback = apiKey ? new OddsApiIoProvider(apiKey) : null;
  }
  return fallback;
}

export function getOddsProviderStatuses(): OddsProviderStatusInfo[] {
  const statuses: OddsProviderStatusInfo[] = [];
  const p = getPrimaryProvider();
  const f = getFallbackProvider();
  if (p) statuses.push(p.getStatus());
  if (f) statuses.push(f.getStatus());
  return statuses;
}

/**
 * Looks up real pre-match head-to-head odds for one matchup, trying The Odds API first and
 * automatically falling back to Odds-API.io when the primary is unavailable or has hit its
 * rate/usage limit. Returns null -- never fabricated -- when neither provider is configured, or
 * neither has real odds for this matchup. Callers must treat null as "no odds available for this
 * prediction", not as "assume 50/50" or any other synthesized value.
 */
export async function fetchMarketOdds(player1Name: string, player2Name: string, scheduledStart: Date | null): Promise<OddsQuote | null> {
  const primaryProvider = getPrimaryProvider();
  if (primaryProvider) {
    try {
      const quote = await primaryProvider.getMatchOdds(player1Name, player2Name, scheduledStart);
      if (quote) return quote;
      // Primary is up but genuinely has no odds for this matchup -- still worth checking the
      // fallback, since coverage differs by provider (different bookmaker panels/tournaments).
    } catch (err) {
      logger.warn({ err }, "The Odds API unavailable or rate-limited, falling back to Odds-API.io");
    }
  }

  const fallbackProvider = getFallbackProvider();
  if (fallbackProvider) {
    try {
      return await fallbackProvider.getMatchOdds(player1Name, player2Name, scheduledStart);
    } catch (err) {
      logger.warn({ err }, "Odds-API.io unavailable, no market odds for this matchup this cycle");
      return null;
    }
  }

  return null;
}

/**
 * Task #146 (corrected): same provider chain as fetchMarketOdds, but surfaces which of four
 * states occurred — see OddsStatus's own doc comment for the full vocabulary and the reason this
 * was widened from three states to four. Whether any provider was configured at all is computed
 * up front so the no-quote fallthrough can distinguish "queried, no odds" from "never queried".
 *
 * Never throws. Callers that only need the quote (not the status) can continue using fetchMarketOdds.
 */
export async function fetchMarketOddsWithStatus(
  player1Name: string,
  player2Name: string,
  scheduledStart: Date | null,
): Promise<MarketOddsResult> {
  let anyProviderError = false;

  const primaryProvider = getPrimaryProvider();
  const fallbackProvider = getFallbackProvider();
  const anyProviderConfigured = Boolean(primaryProvider) || Boolean(fallbackProvider);

  function noQuoteStatus(): OddsStatus {
    if (anyProviderError) return "provider_error";
    return anyProviderConfigured ? "no_market_available" : "provider_not_configured";
  }

  if (primaryProvider) {
    try {
      const quote = await primaryProvider.getMatchOdds(player1Name, player2Name, scheduledStart);
      if (quote) return { quote, status: "included" };
      // Primary is up but has no odds for this matchup — still try fallback (coverage differs).
    } catch (err) {
      anyProviderError = true;
      logger.warn({ err }, "The Odds API unavailable or rate-limited, falling back to Odds-API.io");
    }
  }

  if (fallbackProvider) {
    try {
      const quote = await fallbackProvider.getMatchOdds(player1Name, player2Name, scheduledStart);
      if (quote) return { quote, status: "included" };
      return { quote: null, status: noQuoteStatus() };
    } catch (err) {
      anyProviderError = true;
      logger.warn({ err }, "Odds-API.io unavailable, no market odds for this matchup this cycle");
    }
  }

  return { quote: null, status: noQuoteStatus() };
}

/** Exported for tests only -- resets the cached provider singletons between test cases. */
export function _resetOddsProvidersForTest(): void {
  primary = undefined;
  fallback = undefined;
}

export { OddsProviderUnavailableError };
