import { ingestionTargets, ingestionTouchTarget, ingestionUpsertObservations } from "../truth-server-api";

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
  timezone?: string | null;
  tournament?: string | null;
  pullback_start: string | null;
  pullback_end: string | null;
};

function fiveYearsAgo() {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() - 5);
  return d.toISOString().slice(0, 10);
}

export async function ingestOpenMeteoHistorical() {
  const { targets } = await ingestionTargets("open_meteo");

  let written = 0;
  for (const target of (targets ?? []) as Target[]) {
    const targetConfig = (target as Target & { config?: Record<string, unknown> }).config ?? {};
    const latitude = Number(targetConfig.latitude);
    const longitude = Number(targetConfig.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;
    const start = target.pullback_start ?? fiveYearsAgo();
    const end = target.pullback_end ?? new Date().toISOString().slice(0, 10);
    const qs = new URLSearchParams({
      latitude: String(latitude),
      longitude: String(longitude),
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
           provenance: { target_key: target.target_key, latitude, longitude, timezone: json?.timezone ?? target.timezone },
        });
      }
    }
    for (let i = 0; i < rows.length; i += 1000) {
      const chunk = rows.slice(i, i + 1000);
      await ingestionUpsertObservations(chunk);
      written += chunk.length;
    }
    await ingestionTouchTarget(target.id);
  }
  return { targets: targets?.length ?? 0, observations_written: written };
}
