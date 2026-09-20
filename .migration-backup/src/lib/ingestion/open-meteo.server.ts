import { supabaseAdmin } from "@/integrations/supabase/client.server";

const db = supabaseAdmin as any;
const HOURLY = [
  "temperature_2m",
  "relative_humidity_2m",
  "precipitation",
  "pressure_msl",
  "surface_pressure",
  "wind_speed_10m",
  "wind_direction_10m",
  "wind_gusts_10m",
].join(",");

type Target = {
  id: string;
  target_key: string;
  latitude: number;
  longitude: number;
  timezone: string | null;
  tournament: string | null;
  pullback_start: string | null;
  pullback_end: string | null;
};

function fiveYearsAgo() {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() - 5);
  return d.toISOString().slice(0, 10);
}

export async function ingestOpenMeteoHistorical() {
  const { data: targets, error } = await db
    .from("ingestion_targets")
    .select("id,target_key,latitude,longitude,timezone,tournament,pullback_start,pullback_end")
    .eq("source_id", "open_meteo")
    .eq("enabled", true)
    .not("latitude", "is", null)
    .not("longitude", "is", null);
  if (error) throw error;

  let written = 0;
  for (const target of (targets ?? []) as Target[]) {
    const start = target.pullback_start ?? fiveYearsAgo();
    const end = target.pullback_end ?? new Date().toISOString().slice(0, 10);
    const qs = new URLSearchParams({
      latitude: String(target.latitude),
      longitude: String(target.longitude),
      start_date: start,
      end_date: end,
      hourly: HOURLY,
      timezone: target.timezone ?? "auto",
    });
    const url = `https://archive-api.open-meteo.com/v1/archive?${qs}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Open-Meteo ${res.status}: ${await res.text()}`);
    const json = await res.json() as any;
    const times: string[] = json?.hourly?.time ?? [];
    const rows: any[] = [];
    for (let i = 0; i < times.length; i++) {
      for (const key of HOURLY.split(",")) {
        const value = json?.hourly?.[key]?.[i];
        if (value === null || value === undefined) continue;
        rows.push({
          source_id: "open_meteo",
          source_name: "Open-Meteo Historical Weather",
          source_url: url,
          source_record_key: `${target.target_key}:${times[i]}:${key}`,
          tournament: target.tournament,
          event_date: String(times[i]).slice(0, 10),
          observation_type: "ENVIRONMENT",
          observation_key: key,
          numeric_value: Number(value),
          unit: json?.hourly_units?.[key] ?? null,
          sample_label: "hourly",
          window_start: start,
          window_end: end,
          raw_payload: { time: times[i], value, unit: json?.hourly_units?.[key] ?? null },
          provenance: { target_key: target.target_key, latitude: target.latitude, longitude: target.longitude, timezone: json?.timezone ?? target.timezone },
        });
      }
    }
    for (let i = 0; i < rows.length; i += 1000) {
      const chunk = rows.slice(i, i + 1000);
      const { error: insertError } = await db.from("source_observations").upsert(chunk, { onConflict: "source_id,source_record_key" });
      if (insertError) throw insertError;
      written += chunk.length;
    }
    await db.from("ingestion_targets").update({ last_ingested_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", target.id);
  }
  return { targets: targets?.length ?? 0, observations_written: written };
}
