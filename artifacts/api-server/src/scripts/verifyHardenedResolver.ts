import { LiveTennisHistoricalProvider, normalizePeLiveFixtureRow, classifySpecialEvent } from "../services/tennisData/liveTennisHistoricalProvider.js";

async function main() {
  const apiKey = process.env.Live_Tennis_Api ?? process.env.LIVE_TENNIS_API_KEY;
  if (!apiKey) { console.log("No API key"); process.exit(1); }
  const provider = new LiveTennisHistoricalProvider({ apiKey });
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const fixtures = await provider.getUpcomingFixturesRangeForPredictionEngine(today, tomorrow);
  console.log(`TOTAL_FIXTURES: ${fixtures.length}`);
  let bo3 = 0, bo5 = 0, nul = 0;
  const specialEvents = new Map<string, number>();
  for (const f of fixtures) {
    if (f.matchFormat === "BestOf3") bo3++;
    else if (f.matchFormat === "BestOf5") bo5++;
    else nul++;
  }
  console.log(`BestOf3: ${bo3}, BestOf5: ${bo5}, null: ${nul}`);
  // Re-derive tournament names distinctly to spot any special events currently live
  const byTournament = new Map<string, { count: number; format: string | null }>();
  for (const f of fixtures) {
    const key = f.tournamentName ?? "(none)";
    const existing = byTournament.get(key);
    if (existing) existing.count++;
    else byTournament.set(key, { count: 1, format: f.matchFormat });
  }
  const specialLooking = [...byTournament.entries()].filter(([name]) => /cup|olympic|laver|davis|united|billie|exhibition|team/i.test(name));
  console.log(`Special-looking tournament names currently live: ${specialLooking.length}`);
  for (const [name, info] of specialLooking) console.log(`  "${name}": count=${info.count} format=${info.format}`);
  console.log("SERVER_NOW:", new Date().toISOString());
  process.exit(0);
}
main().catch((e) => { console.error(String(e).slice(0, 800)); process.exit(1); });