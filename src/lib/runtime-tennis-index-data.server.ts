import { readFileSync } from "node:fs";
import { join } from "node:path";

type Bucket = { n: number; w: number; l: number; sets: number; setsWon: number; straightWins: number; deciding: number; decidingWins: number; elo: number | null; peak: number | null; lastDate: string | null; recent: Array<[string, number, string, number | null, string, string]> };
type Player = { name: string; overall: Bucket; surface: Record<string, Bucket> };
export type RuntimeTennisIndex = {
  generatedAt: string;
  ATP: Record<string, Player>;
  WTA: Record<string, Player>;
  matchHistory: {
    ATP_MAIN: Record<string, unknown[]>;
    WTA_MAIN: Record<string, unknown[]>;
    ATP_CHALLENGER: Record<string, unknown[]>;
    WTA_CHALLENGER: Record<string, unknown[]>;
  };
};

function empty(): RuntimeTennisIndex {
  return { generatedAt: "", ATP: {}, WTA: {}, matchHistory: { ATP_MAIN: {}, WTA_MAIN: {}, ATP_CHALLENGER: {}, WTA_CHALLENGER: {} } };
}

// Raw JSON lives under data/generated/ for local/Node dev reads only. It is NOT under
// public/ -- at 61MB it is well over Cloudflare Workers' hard 25 MiB per-asset limit, so
// shipping it as a static asset fails deployment outright ("Asset too large"), which is
// exactly what silently broke every attempt to fix this via the ASSETS binding until this
// limit was found. The gzip-compressed copy Cloudflare actually serves (~5.2MB, well under
// the cap) lives under public/ instead -- see scripts/build-runtime-tennis-index.mjs, which
// writes both.
const DISK_PATH = join(process.cwd(), "data", "generated", "tennis-runtime-index.json");
const ASSET_PATH = "/generated/tennis-runtime-index.json.gz";

let cache: RuntimeTennisIndex | null = null;

function loadFromDisk(): RuntimeTennisIndex | null {
  try {
    const text = readFileSync(DISK_PATH, "utf8");
    return JSON.parse(text) as RuntimeTennisIndex;
  } catch {
    return null;
  }
}

// Minimal shape of the Cloudflare Workers Assets binding (env.ASSETS per wrangler.json):
// a Fetcher that resolves a Request's path against the deployed static assets.
export type WorkersAssetsBinding = { fetch(request: Request): Promise<Response> };

// Cloudflare Workers have no conventional filesystem at request time -- readFileSync
// only succeeds in local/Node dev (`npm run dev`) or a Node-based build step (this file's
// own DISK_PATH read is exactly that fallback). In production the generated index is a
// static asset that must be fetched over the ASSETS binding instead. This was the actual
// root cause of the live evidence-coverage diagnostic's runtime_index_status reporting
// loaded:false with every player count at 0, even for ATP data that long predates today's
// changes -- readFileSync was never going to succeed there regardless of what code shipped
// or how many times the app was republished (confirmed: PR #74's separate fix, which
// stopped permanently caching a failed read as empty(), did not change the outcome -- the
// read fails every time, not just transiently).
//
// A prior fix (PR #75) added exactly this ASSETS-binding fallback but pointed it at the
// raw, uncompressed 61MB JSON -- which never actually fixed production, because Cloudflare
// Workers rejects any individual static asset over 25 MiB at deploy time. The asset points
// at a gzip-compressed copy instead (see ASSET_PATH / scripts/build-runtime-tennis-index.mjs)
// and is decompressed here with the standard Web Streams DecompressionStream API, which
// Cloudflare Workers (and Node/Bun, for tests) implement natively -- no extra dependency.
//
// ensureRuntimeIndexLoaded() is called once, at the very top of the Worker's fetch() entry
// point (src/server.ts), before any request handler runs, so every synchronous
// loadRuntimeIndex() call throughout the app -- there are several call sites, all
// predating this fix, none of which need to change -- sees an already-populated cache
// without themselves becoming async.
export async function ensureRuntimeIndexLoaded(assets?: WorkersAssetsBinding): Promise<void> {
  if (cache) return;
  const fromDisk = loadFromDisk();
  if (fromDisk) {
    cache = fromDisk;
    return;
  }
  if (!assets) return;
  try {
    const response = await assets.fetch(new Request(`https://assets.internal${ASSET_PATH}`));
    if (!response.ok || !response.body) return;
    const decompressed = response.body.pipeThrough(new DecompressionStream("gzip"));
    const text = await new Response(decompressed).text();
    const parsed = JSON.parse(text) as RuntimeTennisIndex;
    cache = parsed;
  } catch {
    // Leave cache unset. loadRuntimeIndex() below returns empty() for this request, and
    // (per PR #74) the next request retries rather than being permanently poisoned.
  }
}

export function loadRuntimeIndex(): RuntimeTennisIndex {
  if (cache) return cache;
  const fromDisk = loadFromDisk();
  if (fromDisk) {
    cache = fromDisk;
    return cache;
  }
  return empty();
}
