import { readFileSync } from "node:fs";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";

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

// The raw 61MB JSON is tracked by Git LFS (see .gitattributes). Any checkout WITHOUT
// git-lfs installed -- a fresh clone, a CI runner, this repo's own remote container --
// leaves a 133-byte pointer file at DISK_PATH instead of the index. JSON.parse then throws,
// loadRuntimeIndex() silently returns empty(), and every static-index metric engine
// truthfully reports "no data" for every player. That surfaced as 33 test failures which
// were repeatedly misdiagnosed (in two prior phase reports) as "pre-existing date-sensitive
// fixture failures". They were not date-sensitive: they were this file reading a pointer.
//
// The gzip copy under public/ is committed normally, NOT through LFS, and is byte-identical
// once decompressed (verified: 61,433,013 bytes, exactly the size the LFS pointer declares).
// It already has to exist for the Cloudflare Workers ASSETS path below, so falling back to
// it here costs nothing and makes a no-LFS checkout behave identically to a full one.
function looksLikeLfsPointer(text: string) {
  return text.startsWith("version https://git-lfs.github.com/spec/v1");
}

function loadFromDisk(): RuntimeTennisIndex | null {
  try {
    const text = readFileSync(DISK_PATH, "utf8");
    if (!looksLikeLfsPointer(text)) return JSON.parse(text) as RuntimeTennisIndex;
  } catch {
    // Fall through to the gzip copy: an unreadable/absent JSON is the same situation.
  }
  try {
    const gz = readFileSync(join(process.cwd(), "public", "generated", "tennis-runtime-index.json.gz"));
    return JSON.parse(gunzipSync(gz).toString("utf8")) as RuntimeTennisIndex;
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

function mergeHistoryEntries(base: unknown[], overlay: unknown[]): unknown[] {
  const byMatch = new Map<string, unknown[]>();
  const conflicts = new Set<string>();
  const add = (entry: unknown) => {
    if (!Array.isArray(entry)) return;
    const key = [entry[0], entry[1], entry[2], entry[3], entry[5]].map(value => String(value ?? "").trim().toLowerCase()).join("|");
    if (conflicts.has(key)) return;
    const existing = byMatch.get(key);
    if (existing && existing[4] !== entry[4]) {
      byMatch.delete(key);
      conflicts.add(key);
      return;
    }
    byMatch.set(key, entry);
  };
  for (const entry of base) add(entry);
  // The approved warehouse is the preferred source for an identical match. This
  // retains its source/provenance detail rather than silently discarding it in
  // favor of the generated static row.
  for (const entry of overlay) add(entry);
  return [...byMatch.values()].sort((a, b) => String(a[0] ?? "").localeCompare(String(b[0] ?? "")));
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

/**
 * Explicit date-aware boundary for async producers that can await their lane. A successful
 * warehouse read is overlaid even when it has zero admitted rows; the static lane is used only
 * when the warehouse itself is unavailable. Ordinary loadRuntimeIndex() remains static and
 * synchronous: no database query or global mutation occurs here.
 */
export async function loadRuntimeHistoryLane(
  family: keyof RuntimeTennisIndex["matchHistory"],
  asOfDate: string,
): Promise<Record<string, unknown[]>> {
  const staticLane = loadRuntimeIndex().matchHistory[family] ?? {};
  const staticBefore = filterHistoryBefore(staticLane, asOfDate);
  try {
    const { loadApprovedSackmannHistory } = await import("./approved-sackmann-history.server");
    const result = await loadApprovedSackmannHistory(asOfDate);
    if (!result.available) return staticBefore;
    const overlay = result.lanes[family] ?? {};
    const merged: Record<string, unknown[]> = {};
    for (const [player, rows] of Object.entries(staticBefore)) merged[player] = [...rows];
    for (const [player, rows] of Object.entries(overlay)) {
      merged[player] = mergeHistoryEntries(merged[player] ?? [], rows) as unknown[];
    }
    return filterHistoryBefore(merged, asOfDate);
  } catch {
    return staticBefore;
  }
}

function filterHistoryBefore(lane: Record<string, unknown[]>, asOfDate: string): Record<string, unknown[]> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(asOfDate)) return {};
  const filtered: Record<string, unknown[]> = {};
  for (const [player, rows] of Object.entries(lane)) {
    const eligible = rows.filter(entry => Array.isArray(entry) && /^\d{4}-\d{2}-\d{2}$/.test(String(entry[0] ?? "").slice(0, 10))
      && String(entry[0]).slice(0, 10) < asOfDate);
    if (eligible.length) filtered[player] = eligible;
  }
  return filtered;
}
