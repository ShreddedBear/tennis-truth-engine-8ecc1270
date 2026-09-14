// READ-ONLY diagnostic: for the current active-slate matches, checks whether either
// player actually appears anywhere in the local BSD/Bzzoiro PBP history index files
// (data/audit/bsd-*-pbp-history/*/results.json) that bsd-atp-challenger-pbp.server.ts
// (and the other three lane builders) read as their CANDIDATE pool before ever making a
// live fetchPbp() HTTP call. If a player never appears in these files at all, no live
// call was ever going to happen for them regardless of API key status -- that is a real
// "the source's local index doesn't have this player" finding, not a producer bug.
//
// No writes anywhere. Only reads matches/summary_versions (to find the active slate) and
// the checked-in JSON index files.
import { db, closePool } from "../src/db/client.server";
import { matchesTable, summaryVersionsTable } from "../src/db/schema";
import { activeSlateMatchIds } from "../src/lib/current-audit-state";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const norm = (v: unknown) => String(v ?? "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

async function loadIndexDir(dir: string, years: number[]): Promise<any[]> {
  const all: any[] = [];
  for (const y of years) {
    try {
      const p = JSON.parse(await readFile(join(process.cwd(), dir, String(y), "results.json"), "utf8"));
      if (Array.isArray(p)) all.push(...p);
    } catch { /* year file missing/empty -- fine */ }
  }
  return all;
}

async function main() {
  const [matches, versions] = await Promise.all([
    db.select({ id: matchesTable.id, player1_name: matchesTable.player1_name, player2_name: matchesTable.player2_name }).from(matchesTable),
    db.select({ match_id: summaryVersionsTable.match_id, is_active: summaryVersionsTable.is_active }).from(summaryVersionsTable),
  ]);
  const activeIds = activeSlateMatchIds(versions);
  const activeMatches = matches.filter((m) => activeIds.has(m.id));
  console.log(`[diagnose-pbp] active slate: ${activeMatches.length} matches`);

  const years = [2024, 2025, 2026];
  const [atpChallenger, atpMain, wtaMain] = await Promise.all([
    loadIndexDir("data/audit/bsd-atp-challenger-pbp-history", years),
    loadIndexDir("data/audit/bsd-atp-main-pbp-history", years),
    loadIndexDir("data/audit/bsd-wta-main-pbp-history", years),
  ]);
  console.log(`[diagnose-pbp] local index sizes: atp_challenger=${atpChallenger.length} atp_main=${atpMain.length} wta_main=${wtaMain.length}`);

  const namesIn = (rows: any[]) => new Set(rows.flatMap((r) => (Array.isArray(r.players) ? r.players.map(norm) : [])));
  const challengerNames = namesIn(atpChallenger), mainNames = namesIn(atpMain), wtaNames = namesIn(wtaMain);
  const allIndexedNames = new Set([...challengerNames, ...mainNames, ...wtaNames]);

  let bothInIndex = 0, oneInIndex = 0, neitherInIndex = 0;
  const neitherSamples: string[] = [];
  for (const m of activeMatches) {
    const p1 = norm(m.player1_name), p2 = norm(m.player2_name);
    const p1In = allIndexedNames.has(p1), p2In = allIndexedNames.has(p2);
    if (p1In && p2In) bothInIndex++;
    else if (p1In || p2In) oneInIndex++;
    else { neitherInIndex++; if (neitherSamples.length < 10) neitherSamples.push(`${m.player1_name} vs ${m.player2_name}`); }
  }
  console.log(`[diagnose-pbp] of ${activeMatches.length} active matches: both players indexed=${bothInIndex} one player indexed=${oneInIndex} neither indexed=${neitherInIndex}`);
  if (neitherSamples.length) console.log(`[diagnose-pbp] sample matches with NEITHER player in any local PBP index:\n  ${neitherSamples.join("\n  ")}`);

  await closePool();
}

main().catch(async (error) => {
  console.error(error);
  await closePool().catch(() => {});
  process.exit(1);
});
