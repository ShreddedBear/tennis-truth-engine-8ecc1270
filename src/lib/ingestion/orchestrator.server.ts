import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { ingestOpenMeteoHistorical } from "./open-meteo.server";
import { ingestOddsHistorical } from "./odds-api.server";
import { ingestTourResultsAndSchedules, type TourSource, type OfficialTourSnapshot } from "./tour-results-schedule.server";
import { ingestTourRankings, type RankingSource, type OfficialRankingSnapshot } from "./tour-rankings.server";
import { ingestRulesContext, type RulesSource } from "./rules-context.server";

const db = supabaseAdmin as any;

type SourceId = "open_meteo" | "odds_api" | TourSource | RankingSource | RulesSource;
export type OfficialSnapshot = OfficialTourSnapshot | OfficialRankingSnapshot;
type IngestionOptions = { officialSnapshots?: OfficialSnapshot[] };

type IngestionResult = Record<string, unknown> & {
  targets?: number;
  observations_written?: number;
  requests?: number;
};

const TARGET_BACKED_SOURCES = new Set<SourceId>([
  "open_meteo",
  "atp", "wta", "atp_challenger",
  "atp_rankings", "wta_rankings",
  "itf_rules", "atp_rules", "wta_rules",
]);

export function assertMeaningfulIngestion(sourceId: SourceId, result: IngestionResult) {
  if (TARGET_BACKED_SOURCES.has(sourceId) && Number(result.targets ?? 0) <= 0) {
    throw new Error(`No enabled ingestion target configured for requested source: ${sourceId}`);
  }

  if (sourceId === "odds_api" && Number(result.requests ?? 0) <= 0) {
    throw new Error("The Odds API ingestion completed without making any historical API requests");
  }

  if (Number(result.observations_written ?? 0) <= 0) {
    throw new Error(`Ingestion source ${sourceId} completed without producing any source observations`);
  }
}

function ingestionErrorMessage(err: unknown) {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object") {
    const value = err as Record<string, unknown>;
    const fields = ["message", "code", "details", "hint"]
      .map((key) => [key, value[key]] as const)
      .filter(([, field]) => field !== undefined && field !== null && String(field).trim());
    if (fields.length) return fields.map(([key, field]) => `${key}=${String(field)}`).join(" | ");
    try { return JSON.stringify(value); } catch {}
  }
  return String(err);
}

async function runTracked<T extends IngestionResult>(sourceId: SourceId, jobType: string, fn: () => Promise<T>) {
  const { data: run, error } = await db.from("source_ingestion_runs").insert({ source_id: sourceId, job_type: jobType, status: "RUNNING", started_at: new Date().toISOString() }).select("id").single();
  if (error) throw error;
  try {
    const result = await fn();
    assertMeaningfulIngestion(sourceId, result);
    const written = Number(result.observations_written ?? 0);
    await db.from("source_ingestion_runs").update({ status: "COMPLETE", records_seen: written, records_inserted: written, metadata: result, completed_at: new Date().toISOString() }).eq("id", run.id);
    return result;
  } catch (err) {
    await db.from("source_ingestion_runs").update({ status: "FAILED", error_message: ingestionErrorMessage(err), completed_at: new Date().toISOString() }).eq("id", run.id);
    throw err;
  }
}

export async function runHistoricalHardPull(sources: SourceId[] = ["open_meteo", "odds_api"], options: IngestionOptions = {}) {
  const results: Record<string, unknown> = {};
  const snapshots = options.officialSnapshots ?? [];
  for (const source of sources) {
    if (source === "open_meteo") results[source] = await runTracked(source, "HISTORICAL_BACKFILL", () => ingestOpenMeteoHistorical());
    else if (source === "odds_api") results[source] = await runTracked(source, "HISTORICAL_BACKFILL", () => ingestOddsHistorical());
    else if (source === "atp" || source === "wta" || source === "atp_challenger") results[source] = await runTracked(source, "RESULTS_SCHEDULE_PULL", () => ingestTourResultsAndSchedules(source, snapshots.filter((s): s is OfficialTourSnapshot => s.source === "atp" || s.source === "atp_challenger")));
    else if (source === "atp_rankings" || source === "wta_rankings") results[source] = await runTracked(source, "RANKING_HISTORY_PULL", () => ingestTourRankings(source, snapshots.filter((s): s is OfficialRankingSnapshot => s.source === "atp_rankings")));
    else if (source === "itf_rules" || source === "atp_rules" || source === "wta_rules") results[source] = await runTracked(source, "RULES_CONTEXT_PULL", () => ingestRulesContext(source));
  }
  return results;
}

export type { SourceId };
