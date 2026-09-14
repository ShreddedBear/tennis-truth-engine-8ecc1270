// READ-ONLY diagnostic: attempts a handful of REAL live fetchPbp()-equivalent HTTP calls
// against the BSD/Bzzoiro point-by-point API, using real match_ids drawn from the local
// history index, to determine whether the live endpoint itself is actually returning usable
// data today. No writes anywhere, no secret values printed (only whether the key is present,
// HTTP status codes, and response shape booleans).
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const BASE = "https://sports.bzzoiro.com/tennis/api/v2";

async function loadSample(dir: string, year: number, count: number): Promise<any[]> {
  try {
    const rows = JSON.parse(await readFile(join(process.cwd(), dir, String(year), "results.json"), "utf8"));
    return Array.isArray(rows) ? rows.filter((r) => r.structurally_present === true).slice(0, count) : [];
  } catch {
    return [];
  }
}

async function testFetch(matchId: string | number, token: string) {
  const url = `${BASE}/matches/${encodeURIComponent(String(matchId))}/point-by-point/`;
  try {
    const started = Date.now();
    const r = await fetch(url, {
      headers: { Authorization: `Token ${token}`, "User-Agent": "tennis-truth-engine-diagnostic/1.0" },
      signal: AbortSignal.timeout(15000),
    });
    const durationMs = Date.now() - started;
    if (!r.ok) return { matchId, ok: false, httpStatus: r.status, durationMs, note: "non-2xx response" };
    let body: any;
    try { body = await r.json(); } catch { return { matchId, ok: false, httpStatus: r.status, durationMs, note: "response was not valid JSON" }; }
    const available = body && typeof body === "object" && body.available === true;
    return {
      matchId, ok: true, httpStatus: r.status, durationMs,
      availableFlagTrue: available,
      hasGamesArray: Array.isArray(body?.games ?? body?.sets ?? body?.points),
      topLevelKeys: body && typeof body === "object" ? Object.keys(body).slice(0, 15) : [],
    };
  } catch (error) {
    return { matchId, ok: false, httpStatus: null, durationMs: null, note: error instanceof Error ? error.message : String(error) };
  }
}

async function main() {
  const token = process.env["BSD_TENNIS_API_KEY"];
  console.log(`[diagnose-pbp-live] BSD_TENNIS_API_KEY present: ${Boolean(token)}`);
  if (!token) { console.log("[diagnose-pbp-live] cannot test live fetch without the key."); return; }

  const samples = [
    ...(await loadSample("data/audit/bsd-atp-challenger-pbp-history", 2026, 3)),
    ...(await loadSample("data/audit/bsd-atp-challenger-pbp-history", 2025, 3)),
  ];
  console.log(`[diagnose-pbp-live] testing ${samples.length} real match_ids from the local index...`);

  for (const row of samples) {
    const result = await testFetch(row.match_id, token);
    console.log(`[diagnose-pbp-live] match_id=${row.match_id} year=${row.year} date=${row.date} indexed_as_structurally_present=${row.structurally_present} indexed_available_flag=${row.available_flag} indexed_pbp_http=${row.pbp_http} =>`, JSON.stringify(result));
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
