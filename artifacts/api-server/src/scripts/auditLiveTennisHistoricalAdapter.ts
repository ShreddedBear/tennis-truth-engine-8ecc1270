import fs from "node:fs/promises";
import { compareHistoricalFixtures, LiveTennisHistoricalProvider } from "../services/tennisData/liveTennisHistoricalProvider.js";
import { auditLiveTennisIdentity } from "../services/tennisData/liveTennisIdentityAudit.js";
import { matchEligibilityAudit } from "../services/tennisData/liveTennisEligibilityAudit.js";
import { buildPlayerIdentityIndex } from "../services/tennisData/playerIdentity.js";

interface Args {
  from: string;
  to: string;
  maxPages: number;
  output: string | null;
}

function parseArgs(argv: string[]): Args {
  const values = new Map<string, string>();
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const [key, inline] = arg.slice(2).split("=", 2);
    const value = inline ?? argv[++i];
    if (value == null) throw new Error(`Missing value for --${key}`);
    values.set(key, value);
  }
  const from = values.get("from");
  const to = values.get("to");
  if (!from || !to) throw new Error("Usage: tsx src/scripts/auditLiveTennisHistoricalAdapter.ts --from YYYY-MM-DD --to YYYY-MM-DD [--max-pages N] [--output path]");
  const maxPages = Number(values.get("max-pages") ?? "100");
  if (!Number.isInteger(maxPages) || maxPages < 1) throw new Error("--max-pages must be a positive integer");
  return { from, to, maxPages, output: values.get("output") ?? null };
}

function coverage(fixtures: Awaited<ReturnType<LiveTennisHistoricalProvider["getReadOnlyAudit"]>>["fixtures"]) {
  const total = fixtures.length;
  const count = (predicate: (fixture: (typeof fixtures)[number]) => boolean) => fixtures.filter(predicate).length;
    return {
    normalizedFixtures: total,
    providerMatchId: count((fixture) => Boolean(fixture.id)),
    scheduledDate: count((fixture) => Boolean(fixture.date)),
    scheduledTime: count((fixture) => Boolean(fixture.time)),
    playerIds: count((fixture) => Boolean(fixture.player1Id && fixture.player2Id)),
    playerNames: count((fixture) => Boolean(fixture.player1Name && fixture.player2Name)),
    winner: count((fixture) => Boolean(fixture.winnerId)),
    tournament: count((fixture) => Boolean(fixture.tournamentName)),
    tournamentId: count((fixture) => Boolean((fixture.raw as { payload?: { tournament_id?: unknown } }).payload?.tournament_id)),
    tournamentLevel: count((fixture) => fixture.tournamentLevel != null),
    tour: count((fixture) => fixture.tour != null),
    surface: count((fixture) => fixture.surface != null),
    round: count((fixture) => fixture.round != null),
    bestOf: count((fixture) => fixture.matchFormat != null),
    finalSetGames: count((fixture) => fixture.setGameMargins.length > 0),
    sourceProvenance: count((fixture) => fixture.raw != null),
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const apiKey = process.env.Live_Tennis_Api ?? process.env.LIVE_TENNIS_API_KEY;
  if (!apiKey) throw new Error("Live Tennis API key is missing; set Live_Tennis_Api or LIVE_TENNIS_API_KEY");
  const provider = new LiveTennisHistoricalProvider({ apiKey, maxPages: args.maxPages });
  const audit = await provider.getReadOnlyAudit(args.from, args.to);
  const identityIndex = await buildPlayerIdentityIndex();
  const identityAudit = auditLiveTennisIdentity(audit.fixtures, identityIndex);
  const output = {
    adapter: "LiveTennisHistoricalProvider",
    provider: "Live Tennis API",
    endpoint: "/history/matches",
    requestedRange: { from: args.from, to: args.to },
    catalogueRequests: audit.catalogueRequests,
    historyRequests: audit.historyRequests,
    totalRequests: audit.totalRequests,
    rawRowsReturned: audit.rawRows,
    normalizedCompletedSingles: audit.fixtures.length,
    exclusions: audit.exclusions,
    fieldCoverage: coverage(audit.fixtures),
    matchEligibility: matchEligibilityAudit(audit.fixtures, identityAudit),
    deterministicOrdering: audit.fixtures.every((fixture, index, rows) => index === 0 || compareHistoricalFixtures(rows[index - 1], fixture) <= 0),
    duplicateProviderIds: audit.fixtures.length - new Set(audit.fixtures.map((fixture) => fixture.id)).size,
    identity: {
      resolution: "pure audit against the existing PlayerIdentityIndex; no provider aliases or DB rows are written",
      uniqueProviderPlayerIds: new Set(audit.fixtures.flatMap((fixture) => [fixture.player1Id, fixture.player2Id])).size,
      resolved: identityAudit.counts.resolved,
      ambiguous: identityAudit.counts.ambiguous,
      unresolved: identityAudit.counts.unresolved,
      methods: identityAudit.counts.byMethod,
    },
    persistence: "none",
    holdoutFrozen: false,
    candidateScoringRun: false,
  };
  // Every object above is built in a fixed property order; avoid a JSON replacer array here,
  // because JSON.stringify's array replacer would silently omit nested audit fields.
  const stable = JSON.stringify(output, null, 2) + "\n";
  if (args.output) {
    await fs.writeFile(args.output, stable, "utf8");
  } else {
    process.stdout.write(stable);
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
