import { db, evaluationPredictionsTable, sql } from "@workspace/db";

const SPECIAL_PATTERNS = [
  "cup", "olympic", "laver", "hopman", "davis", "united", "billie jean king",
  "bjk", "exhibition", "team", "mixed", "world group", "junior",
];

async function main() {
  console.log("=== A: RAW LIVE /fixtures -- tournament names matching special-event patterns ===");
  const apiKey = process.env.Live_Tennis_Api ?? process.env.LIVE_TENNIS_API_KEY;
  if (!apiKey) {
    console.log("No API key found");
  } else {
    let offset = 0;
    const seen = new Map<string, { tour: string | null; gender: string | null; round: string | null; is_qualifying: boolean | null; count: number }>();
    for (let page = 0; page < 10; page++) {
      const url = `https://api.livetennisapi.com/api/public/v1/fixtures?draw=singles&limit=200&offset=${offset}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } });
      const body: any = await res.json();
      const rows = Array.isArray(body?.data) ? body.data : [];
      for (const row of rows) {
        const name = String(row.tournament ?? "").toLowerCase();
        if (SPECIAL_PATTERNS.some((p) => name.includes(p))) {
          const key = String(row.tournament);
          const existing = seen.get(key);
          if (existing) existing.count++;
          else seen.set(key, { tour: row.tour ?? null, gender: row.gender ?? null, round: row.round ?? null, is_qualifying: row.is_qualifying ?? null, count: 1 });
        }
      }
      if (!body?.meta?.has_more) break;
      offset += rows.length;
      if (rows.length === 0) break;
    }
    console.log(`Distinct special-pattern tournament names found: ${seen.size}`);
    for (const [name, info] of seen.entries()) console.log(`  "${name}" -> ${JSON.stringify(info)}`);
  }

  console.log("\n=== B: ALL distinct tour values currently in raw /fixtures (for completeness) ===");
  if (apiKey) {
    const url = `https://api.livetennisapi.com/api/public/v1/fixtures?draw=singles&limit=200&offset=0`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } });
    const body: any = await res.json();
    const rows = Array.isArray(body?.data) ? body.data : [];
    const tours = new Set(rows.map((r: any) => r.tour));
    console.log(`Distinct tour values (page 1 sample): ${JSON.stringify([...tours])}`);
  }

  console.log("\n=== C: evaluation_predictions -- any stored paper_trade/historical_test rows with special-event-looking tournament names ===");
  const stored = await db.execute(sql`
    SELECT DISTINCT tournament_name, run_kind, COUNT(*) as cnt
    FROM evaluation_predictions
    WHERE run_kind IN ('paper_trade', 'paper_trade_shadow')
      AND (
        lower(tournament_name) LIKE '%cup%' OR lower(tournament_name) LIKE '%olympic%' OR
        lower(tournament_name) LIKE '%laver%' OR lower(tournament_name) LIKE '%davis%' OR
        lower(tournament_name) LIKE '%united%' OR lower(tournament_name) LIKE '%billie%' OR
        lower(tournament_name) LIKE '%exhibition%' OR lower(tournament_name) LIKE '%team%'
      )
    GROUP BY tournament_name, run_kind
    ORDER BY cnt DESC
  `);
  console.log(`Stored rows matching special patterns: ${stored.rows.length}`);
  for (const r of stored.rows as any[]) console.log(`  ${JSON.stringify(r)}`);

  console.log("\nSERVER_NOW:", new Date().toISOString());
  process.exit(0);
}
main().catch((e) => { console.error(String(e).slice(0, 800)); process.exit(1); });