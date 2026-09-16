import { ApiTennisProvider } from "./apiTennisProvider";
import { CompositeTennisProvider } from "./compositeProvider";
import { MatchStatProvider } from "./matchStatProvider";
import { LiveTennisFixturesProvider } from "./liveTennisFixturesProvider";
import { ProviderUnavailableError, type ProviderStatusInfo, type TennisDataProvider } from "./types";

export * from "./types";

export const TENNIS_PROVIDER_CAPABILITIES = {
  "Live Tennis API": ["playerSearch", "scheduledMatches", "liveMatches", "historicalMatches"],
  "API-Tennis": ["playerSearch", "playerProfile", "rankings", "scheduledMatches", "matchResults", "historicalMatches", "headToHead", "liveScores", "tournamentMetadata"],
  "BSD Tennis": ["rankings", "historicalMatches"],
  "MatchStat/RapidAPI": ["playerSearch", "rankings", "scheduledMatches", "tournamentMetadata"],
  historical_matches: ["historicalMatches"],
} as const;

const NOT_CONFIGURED_MESSAGE =
  "No API key is configured for this tennis data provider. Add a real provider key -- this app never falls back to mock data.";

/** Used until a real API key is configured. Every data method reports a clean 502, never fake data. */
class NotConfiguredProvider implements TennisDataProvider {
  constructor(readonly name: string, private readonly message = NOT_CONFIGURED_MESSAGE) {}

  getStatus(): ProviderStatusInfo {
    return { provider: this.name, connected: false, lastSuccessfulCallAt: null, lastError: this.message };
  }
  async searchPlayers(): Promise<never> {
    throw new ProviderUnavailableError(`${this.name}: ${this.message}`);
  }
  async getPlayer(): Promise<never> {
    throw new ProviderUnavailableError(`${this.name}: ${this.message}`);
  }
  async getPlayerMatches(): Promise<never> {
    throw new ProviderUnavailableError(`${this.name}: ${this.message}`);
  }
  async getUpcomingFixtures(): Promise<never> {
    throw new ProviderUnavailableError(`${this.name}: ${this.message}`);
  }
  async getUpcomingFixturesRange(): Promise<never> {
    throw new ProviderUnavailableError(`${this.name}: ${this.message}`);
  }
  async getHeadToHead(): Promise<never> {
    throw new ProviderUnavailableError(`${this.name}: ${this.message}`);
  }
  async getCompletedMatchesByDateRange(): Promise<never> {
    throw new ProviderUnavailableError(`${this.name}: ${this.message}`);
  }
  async getLiveScores(): Promise<never> {
    throw new ProviderUnavailableError(`${this.name}: ${this.message}`);
  }
}

let cachedProvider: TennisDataProvider | null = null;

/**
 * Factory for the active tennis data provider.
 *
 * Always returns a composite so missing optional keys never make the DB history
 * fallback unreachable. Capability-unavailable providers fail explicitly and
 * are handled by the composite's routing chain.
 */
export function getTennisDataProvider(): TennisDataProvider {
  if (cachedProvider) return cachedProvider;

  const apiTennisKey = process.env.API_TENNIS_KEY;
  // Secret was renamed from X_RAPIDAPI_KEY → x_rapidapi_key; accept both for compatibility.
  const rapidApiKey = process.env.X_RAPIDAPI_KEY ?? process.env.x_rapidapi_key;
  const apiTennisProvider: TennisDataProvider = apiTennisKey
    ? new ApiTennisProvider(apiTennisKey)
    : new NotConfiguredProvider("API-Tennis");
  const matchStatProvider: TennisDataProvider = rapidApiKey
    ? new MatchStatProvider(rapidApiKey)
    : new NotConfiguredProvider("MatchStat/RapidAPI");
  const liveTennisApiKey = process.env.Live_Tennis_Api ?? process.env.LIVE_TENNIS_API;
  const liveTennisFixturesProvider = liveTennisApiKey
    ? new LiveTennisFixturesProvider(liveTennisApiKey)
    : undefined;

  cachedProvider = new CompositeTennisProvider(
    matchStatProvider,
    apiTennisProvider,
    liveTennisFixturesProvider,
  );

  return cachedProvider;
}

/**
 * Returns the raw API-Tennis provider regardless of composite configuration.
 * Used by the historical backfill pipeline, which requires API-Tennis's bulk
 * date-range endpoint that MatchStat does not provide.
 */
export function getApiTennisProvider(): ApiTennisProvider | null {
  const apiTennisKey = process.env.API_TENNIS_KEY;
  return apiTennisKey ? new ApiTennisProvider(apiTennisKey) : null;
}
