import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { ingestOpenMeteoHistorical } from "./open-meteo.server";
import { ingestOddsHistorical } from "./odds-api.server";

const db = supabaseAdmin as any;

type SourceId = "open_meteo" | "odds_api";

async function runTracked<T>(sourceId: SourceId, jobType: string, fn: () => Promise<T>) {
  const { data: run, error } = await db.from("source_ingestion_runs").insert({
    source_id: sourceId,
    job_type: jobType,
    status: "RUNNING",
    started_at: new Date().toISOString(),
  }).select("id").single();
  if (error) throw error;
  try {
    const result = await fn();
    const written = Number((result as any)?.observations_written ?? 0);
    await db.from("source_ingestion_runs").update({
      status: "COMPLETE",
      records_seen: written,
      records_inserted: written,
      metadata: result,
      completed_at: new Date().toISOString(),
    }).eq("id", run.id);
    return result;
  } catch (err) {
    await db.from("source_ingestion_runs").update({
      status: "FAILED",
      error_message: err instanceof Error ? err.message : String(err),
      completed_at: new Date().toISOString(),
    }).eq("id", run.id);
    throw err;
  }
}

export async function runHistoricalHardPull(sources: SourceId[] = ["open_meteo", "odds_api"]) {
  const results: Record<string, unknown> = {};
  for (const source of sources) {
    if (source === "open_meteo") {
      results[source] = await runTracked(source, "HISTORICAL_BACKFILL", () => ingestOpenMeteoHistorical());
    } else if (source === "odds_api") {
      results[source] = await runTracked(source, "HISTORICAL_BACKFILL", () => ingestOddsHistorical());
    }
  }
  return results;
}
