import { CompositeTennisProvider } from "./compositeProvider";
import { LiveTennisHistoricalProvider } from "./liveTennisHistoricalProvider";
import { ProviderUnavailableError, type ProviderStatusInfo, type TennisDataProvider } from "./types";

export * from "./types";

const NOT_CONFIGURED_MESSAGE =
  "Live_Tennis_Api is not set yet. Add the Live Tennis API key -- this app never falls back to mock data.";

/** Used until a real API key is configured. Every data method reports a clean 502, never fake data. */
class NotConfiguredProvider implements TennisDataProvider {
  readonly name = "Live Tennis API";

  getStatus(): ProviderStatusInfo {
    return { provider: this.name, connected: false, lastSuccessfulCallAt: null, lastError: NOT_CONFIGURED_MESSAGE };
  }
  async searchPlayers(): Promise<never> {
    throw new ProviderUnavailableError(NOT_CONFIGURED_MESSAGE);
  }
  async getPlayer(): Promise<never> {
    throw new ProviderUnavailableError(NOT_CONFIGURED_MESSAGE);
  }
  async getPlayerMatches(): Promise<never> {
    throw new ProviderUnavailableError(NOT_CONFIGURED_MESSAGE);
  }
  async getUpcomingFixtures(): Promise<never> {
    throw new ProviderUnavailableError(NOT_CONFIGURED_MESSAGE);
  }
  async getUpcomingFixturesRange(): Promise<never> {
    throw new ProviderUnavailableError(NOT_CONFIGURED_MESSAGE);
  }
  async getHeadToHead(): Promise<never> {
    throw new ProviderUnavailableError(NOT_CONFIGURED_MESSAGE);
  }
  async getCompletedMatchesByDateRange(): Promise<never> {
    throw new ProviderUnavailableError(NOT_CONFIGURED_MESSAGE);
  }
  async getLiveScores(): Promise<never> {
    throw new ProviderUnavailableError(NOT_CONFIGURED_MESSAGE);
  }
}

const NO_SECONDARY_PROVIDER_MESSAGE =
  "No secondary tennis data provider is configured; Live Tennis API is the only configured source.";

/**
 * Live Tennis API has no second authenticated provider to fall back to (see getTennisDataProvider
 * below). CompositeTennisProvider still requires a fallback argument for its retry/status logic, so
 * this stub fills that role with a name and message distinct from NotConfiguredProvider -- reusing
 * NotConfiguredProvider here would misreport an actually-configured key as missing every time the
 * real provider merely rate-limits or errors (it would also share the primary's exact display name,
 * making "X unavailable -- falling back to X" log lines impossible to interpret).
 */
class NoSecondaryProvider implements TennisDataProvider {
  readonly name = "Live Tennis API (no secondary provider)";

  getStatus(): ProviderStatusInfo {
    return { provider: this.name, connected: false, lastSuccessfulCallAt: null, lastError: NO_SECONDARY_PROVIDER_MESSAGE };
  }
  async searchPlayers(): Promise<never> {
    throw new ProviderUnavailableError(NO_SECONDARY_PROVIDER_MESSAGE);
  }
  async getPlayer(): Promise<never> {
    throw new ProviderUnavailableError(NO_SECONDARY_PROVIDER_MESSAGE);
  }
  async getPlayerMatches(): Promise<never> {
    throw new ProviderUnavailableError(NO_SECONDARY_PROVIDER_MESSAGE);
  }
  async getUpcomingFixtures(): Promise<never> {
    throw new ProviderUnavailableError(NO_SECONDARY_PROVIDER_MESSAGE);
  }
  async getUpcomingFixturesRange(): Promise<never> {
    throw new ProviderUnavailableError(NO_SECONDARY_PROVIDER_MESSAGE);
  }
  async getHeadToHead(): Promise<never> {
    throw new ProviderUnavailableError(NO_SECONDARY_PROVIDER_MESSAGE);
  }
  async getCompletedMatchesByDateRange(): Promise<never> {
    throw new ProviderUnavailableError(NO_SECONDARY_PROVIDER_MESSAGE);
  }
  async getLiveScores(): Promise<never> {
    throw new ProviderUnavailableError(NO_SECONDARY_PROVIDER_MESSAGE);
  }
}

let cachedProvider: TennisDataProvider | null = null;

/**
 * Factory for the active tennis data provider.
 *
 * Live Tennis API is the only authenticated provider used by the application. ESPN, Sofascore,
 * and the local historical database remain public/local fallbacks in their respective layers.
 */
export function getTennisDataProvider(): TennisDataProvider {
  if (cachedProvider) return cachedProvider;

  const liveTennisKey = process.env.Live_Tennis_Api ?? process.env.LIVE_TENNIS_API_KEY;

  if (!liveTennisKey) {
    cachedProvider = new NotConfiguredProvider();
    return cachedProvider;
  }

  const liveTennisProvider = new LiveTennisHistoricalProvider({ apiKey: liveTennisKey });
  cachedProvider = new CompositeTennisProvider(liveTennisProvider, new NoSecondaryProvider());

  return cachedProvider;
}

/**
 * Returns the active Live Tennis API provider for historical jobs (also the Builder's own fixture
 * discovery entry point -- see getUpcomingFixturesForBuilder's doc comment).
 */
export function getLiveTennisProvider(): LiveTennisHistoricalProvider | null {
  const key = process.env.Live_Tennis_Api ?? process.env.LIVE_TENNIS_API_KEY;
  return key ? new LiveTennisHistoricalProvider({ apiKey: key }) : null;
}

/**
 * Returns a fresh, uncached Live Tennis API provider dedicated to the Prediction Engine's live
 * paper-trading fixture discovery (services/evaluation/paperTrading.ts) -- its own entry point,
 * structurally separate from both getTennisDataProvider()'s shared singleton (whose
 * getUpcomingFixtures/getUpcomingFixturesRange stay unchanged for every other consumer) and
 * Builder's own getLiveTennisProvider() above. Exposes only
 * getUpcomingFixturesForPredictionEngine/getUpcomingFixturesRangeForPredictionEngine -- never
 * Builder's *ForBuilder methods.
 */
export function getLiveTennisProviderForPredictionEngine(): LiveTennisHistoricalProvider | null {
  const key = process.env.Live_Tennis_Api ?? process.env.LIVE_TENNIS_API_KEY;
  return key ? new LiveTennisHistoricalProvider({ apiKey: key }) : null;
}
