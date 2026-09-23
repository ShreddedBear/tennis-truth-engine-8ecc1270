/**
 * Phase 1+2 of the lifecycle: discover upcoming singles fixtures, then attempt to create/finalize
 * a paper trade for each one.
 *
 * Deliberately uses `getLiveTennisProvider()` (a fresh, uncached `LiveTennisHistoricalProvider`
 * instance) and its Builder-only `getUpcomingFixturesForBuilder` method -- NOT
 * `getTennisDataProvider()`'s shared singleton and NOT the `TennisDataProvider` interface's
 * `getUpcomingFixtures`. That singleton/interface pair is also used by the Prediction Engine's
 * live paper-trading discovery (`services/evaluation/paperTrading.ts`), which depends on
 * `getUpcomingFixtures`'s exact existing (nested-row-shape) behavior never changing. Builder gets
 * its own entry point specifically so a correctness fix here can never leak into that
 * production-critical path -- see `getUpcomingFixturesForBuilder`'s doc comment in
 * `liveTennisHistoricalProvider.ts` for the full reasoning.
 *
 * Deliberately two loosely-coupled steps inside one function, not two jobs: fetching the
 * fixture LIST is one provider call (or two, for today+tomorrow, mirroring
 * `services/evaluation/paperTrading.ts`'s own `todayPlus(0/1)` pattern) and either succeeds or
 * fails as a whole; each fixture's OWN processing (eligibility -> evidence -> both-sides ->
 * freeze) is wrapped in its own try/catch so one fixture's failure (a transient provider hiccup
 * resolving one player's history, say) never blocks any other fixture in the same cycle --
 * exactly the "one failed provider request must not interrupt the entire lifecycle" requirement.
 */
import { getLiveTennisProvider, ProviderUnavailableError, type Fixture } from "../tennisData/index.js";
import { discoverAndDecidePaperTrade, type PaperTradeOutcome } from "./persistPaperTrade.js";

function todayPlus(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export interface DiscoverAndDecideSummary {
  fixturesConsidered: number;
  frozen: number;
  ineligible: Record<string, number>;
  dataError: number;
  skippedNoSchedule: number;
  errors: string[];
}

export async function discoverAndDecideFixtures(sourceCommit: string): Promise<DiscoverAndDecideSummary> {
  const summary: DiscoverAndDecideSummary = {
    fixturesConsidered: 0, frozen: 0, ineligible: {}, dataError: 0, skippedNoSchedule: 0, errors: [],
  };

  const provider = getLiveTennisProvider();
  if (!provider) {
    summary.errors.push("Fixture discovery: provider unavailable -- Live Tennis API key not configured");
    return summary;
  }

  let fixtures: Fixture[];
  try {
    const [today, tomorrow] = await Promise.all([
      provider.getUpcomingFixturesForBuilder(todayPlus(0)),
      provider.getUpcomingFixturesForBuilder(todayPlus(1)),
    ]);
    fixtures = [...today, ...tomorrow];
  } catch (err) {
    if (err instanceof ProviderUnavailableError) {
      summary.errors.push(`Fixture discovery: provider unavailable -- ${err.message}`);
      return summary;
    }
    throw err;
  }

  // De-dupe by fixture id (today/tomorrow windows can overlap near midnight UTC) and guard
  // against a corrupt provider response listing the same id with conflicting players -- the
  // identical defensive pattern paperTrading.ts already uses for the Prediction Engine.
  const byId = new Map<string, Fixture>();
  for (const fixture of fixtures) {
    const prior = byId.get(fixture.id);
    if (prior && (prior.player1Id !== fixture.player1Id || prior.player2Id !== fixture.player2Id)) {
      summary.errors.push(`Fixture ${fixture.id}: duplicate id with conflicting players in provider response -- skipped`);
      continue;
    }
    byId.set(fixture.id, fixture);
  }

  for (const fixture of byId.values()) {
    summary.fixturesConsidered++;
    try {
      const outcome: PaperTradeOutcome = await discoverAndDecidePaperTrade({
        externalFixtureId: fixture.id,
        fixtureProvider: provider.name,
        player1Id: fixture.player1Id,
        player1Name: fixture.player1Name,
        player2Id: fixture.player2Id,
        player2Name: fixture.player2Name,
        // The provider's own fixture query is already scoped to draw=singles at the API level
        // (confirmed in liveTennisHistoricalProvider.ts) -- Fixture carries no drawType field
        // because non-singles are filtered out before we ever see them, not because we assume it.
        drawType: "singles",
        scheduledStart: fixture.scheduledStart ? new Date(fixture.scheduledStart) : null,
        timeConfirmed: fixture.timeConfirmed,
        tournamentName: fixture.tournamentName,
        tournamentLevel: fixture.tournamentLevel,
        round: fixture.round,
        surface: fixture.surface,
        matchFormat: fixture.matchFormat,
      }, sourceCommit);

      if (outcome.kind === "frozen") summary.frozen++;
      else if (outcome.kind === "data_error") summary.dataError++;
      else if (outcome.kind === "skipped_no_schedule") summary.skippedNoSchedule++;
      else summary.ineligible[outcome.reason] = (summary.ineligible[outcome.reason] ?? 0) + 1;
    } catch (err) {
      summary.errors.push(`Fixture ${fixture.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return summary;
}
