import { runHistoricalHardPull, type SourceId } from "../src/lib/ingestion/orchestrator.server";

const requested = (process.env.INGEST_SOURCES ?? "open_meteo,odds_api")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean) as SourceId[];

const allowed = new Set<SourceId>([
  "open_meteo",
  "odds_api",
  "atp",
  "wta",
  "atp_challenger",
  "atp_rankings",
  "wta_rankings",
  "itf_rules",
  "atp_rules",
  "wta_rules",
]);
for (const source of requested) {
  if (!allowed.has(source)) throw new Error(`Unsupported ingestion source: ${source}`);
}

const result = await runHistoricalHardPull(requested);
console.log(JSON.stringify(result, null, 2));
