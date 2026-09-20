import { supabaseAdmin } from "@/integrations/supabase/client.server";

const db = supabaseAdmin as any;
const HOST = "https://api.the-odds-api.com";
const EARLIEST = "2020-06-06T00:00:00Z";

type Sport = { key: string; title?: string };

type OddsSnapshot = {
  timestamp: string;
  previous_timestamp?: string | null;
  next_timestamp?: string | null;
  data?: Array<{
    id: string;
    sport_key: string;
    commence_time: string;
    home_team: string;
    away_team: string;
    bookmakers?: Array<{
      key: string;
      title: string;
      last_update?: string;
      markets?: Array<{
        key: string;
        last_update?: string;
        outcomes?: Array<{ name: string; price: number; point?: number }>;
      }>;
    }>;
  }>;
};

function apiKey() {
  const key = process.env.THE_ODDS_API_KEY ?? process.env.ODDS_API_KEY;
  if (!key) throw new Error("The Odds API historical ingestion requires THE_ODDS_API_KEY or ODDS_API_KEY.");
  return key;
}

async function getJson<T>(path: string, params: Record<string, string>) {
  const qs = new URLSearchParams({ apiKey: apiKey(), ...params });
  const res = await fetch(`${HOST}${path}?${qs}`);
  if (!res.ok) throw new Error(`The Odds API ${res.status}: ${await res.text()}`);
  return await res.json() as T;
}

export async function discoverTennisSports() {
  const sports = await getJson<Sport[]>("/v4/sports/", { all: "true" });
  return sports.filter((sport) => sport.key.startsWith("tennis_"));
}

function clampDate(value: string | undefined) {
  if (!value || new Date(value) < new Date(EARLIEST)) return EARLIEST;
  return new Date(value).toISOString();
}

export async function ingestOddsHistorical(options: {
  from?: string;
  to?: string;
  maxRequests?: number;
  regions?: string;
  markets?: string;
} = {}) {
  const from = clampDate(options.from ?? process.env.ODDS_BACKFILL_FROM);
  const to = new Date(options.to ?? process.env.ODDS_BACKFILL_TO ?? new Date().toISOString()).toISOString();
  const maxRequests = Math.max(1, Number(options.maxRequests ?? process.env.ODDS_MAX_REQUESTS ?? 25));
  const regions = options.regions ?? process.env.ODDS_REGIONS ?? "us";
  const markets = options.markets ?? process.env.ODDS_MARKETS ?? "h2h";
  const sports = await discoverTennisSports();

  let requests = 0;
  let observations = 0;
  for (const sport of sports) {
    if (requests >= maxRequests) break;
    let cursor = to;
    while (new Date(cursor) >= new Date(from) && requests < maxRequests) {
      const snap = await getJson<OddsSnapshot>(`/v4/historical/sports/${sport.key}/odds`, {
        regions,
        markets,
        oddsFormat: "decimal",
        date: cursor,
      });
      requests += 1;
      const rows: any[] = [];
      for (const event of snap.data ?? []) {
        for (const book of event.bookmakers ?? []) {
          for (const market of book.markets ?? []) {
            for (const outcome of market.outcomes ?? []) {
              rows.push({
                source_id: "odds_api",
                source_name: "The Odds API Historical Data",
                source_url: "https://the-odds-api.com/historical-odds-data/",
                source_record_key: `${snap.timestamp}:${event.id}:${book.key}:${market.key}:${outcome.name}`,
                player_name: outcome.name,
                opponent_name: outcome.name === event.home_team ? event.away_team : event.home_team,
                event_date: event.commence_time.slice(0, 10),
                observation_type: "MARKET",
                observation_key: `${market.key}_decimal_odds`,
                numeric_value: Number(outcome.price),
                unit: "decimal_odds",
                sample_label: `snapshot=${snap.timestamp};bookmaker=${book.title}`,
                window_start: from.slice(0, 10),
                window_end: to.slice(0, 10),
                source_published_at: market.last_update ?? book.last_update ?? snap.timestamp,
                raw_payload: { sport_key: event.sport_key, event_id: event.id, commence_time: event.commence_time, bookmaker: book, market: market.key, outcome },
                provenance: { snapshot_timestamp: snap.timestamp, sport_key: sport.key, bookmaker_key: book.key, market_key: market.key },
              });
            }
          }
        }
      }
      for (let i = 0; i < rows.length; i += 500) {
        const chunk = rows.slice(i, i + 500);
        const { error } = await db.from("source_observations").upsert(chunk, { onConflict: "source_id,source_record_key" });
        if (error) throw error;
        observations += chunk.length;
      }
      if (!snap.previous_timestamp) break;
      cursor = snap.previous_timestamp;
    }
  }
  return { sports: sports.map((s) => s.key), requests, observations_written: observations, from, to, max_requests: maxRequests };
}
