#!/usr/bin/env node
// APPLICATION CUTOVER VERIFICATION.
//
//   npm run verify:cutover
//
// Answers one question: is the RUNNING APPLICATION actually on the Replit PostgreSQL
// database, with its data intact and its moving parts working? A passing database checksum
// does not answer that -- it only says two databases hold the same bytes.
//
// Read-mostly. The single write is a lease claim/release round trip against one audit run,
// which is exactly what the worker does on every pass and which it undoes immediately.
//
// Prints NO secret. Where a secret matters, only its presence is reported.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";

interface Check { name: string; ok: boolean; detail: string }
const checks: Check[] = [];
const add = (name: string, ok: boolean, detail: string) => { checks.push({ name, ok, detail }); };

const repoRoot = resolve(process.cwd());

/** Host and database only -- never the credentials. */
function describe(url: string): { host: string; database: string } {
  const parsed = new URL(url);
  return { host: parsed.hostname, database: parsed.pathname.replace(/^\//u, "") };
}

async function main(): Promise<void> {
  console.log("APPLICATION CUTOVER VERIFICATION\n");

  // ---------------------------------------------------------------- 1. target
  const url = process.env["DATABASE_URL"];
  if (!url) {
    console.error("DATABASE_URL is not set. Run this inside the Replit app environment.");
    process.exit(1);
  }
  const { host, database } = describe(url);
  add("DATABASE_URL points somewhere", true, `${host}/${database}`);

  const looksSupabase = /supabase/iu.test(host);
  add("target is NOT Supabase", !looksSupabase, looksSupabase ? `host ${host} still looks like Supabase` : `host ${host}`);

  const pool = new pg.Pool({ connectionString: url, max: 4 });
  // Everything that needs the database is inside this try. A failure records a failed
  // check and falls through to the report rather than aborting: a verification tool that
  // dies silently is worse than one that says which checks it could not run.
  try {
    // ------------------------------------------------------------ 2. connection
    const { rows: v } = await pool.query<{ v: string }>("select version() as v");
    add("database reachable", true, v[0]!.v.split(",")[0]!);

    // ------------------------------------------------------------ 3. the data
    const counts: Record<string, number> = {};
    for (const table of [
      "matches", "audit_runs", "audit_stage_runs", "metric_results", "final_decisions",
      "metric_evidence_store", "source_observations", "calibration_versions",
      "calibration_buckets", "rules", "execution_logs",
    ]) {
      const { rows } = await pool.query<{ n: string }>(`select count(*)::text as n from public."${table}"`);
      counts[table] = Number(rows[0]!.n);
    }
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    add("migrated data present", total > 0, Object.entries(counts).map(([t, n]) => `${t}=${n}`).join(" "));

    // The legacy slate is historical evidence. It must be here, and it must be 60.
    add("legacy 60-match slate intact", counts["matches"] === 60, `matches=${counts["matches"]} (expected 60)`);

    // ------------------------------------------------------------ 4. structure
    const { rows: s } = await pool.query<{ c: string; i: string; f: string; t: string; a: string }>(`
      select
        (select count(*)::text from pg_constraint co join pg_class cl on cl.oid=co.conrelid
          join pg_namespace n on n.oid=cl.relnamespace where n.nspname='public' and co.contype in ('f','c','u','p')) as c,
        (select count(*)::text from pg_indexes where schemaname='public') as i,
        (select count(*)::text from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public') as f,
        (select count(*)::text from pg_trigger tg join pg_class cl on cl.oid=tg.tgrelid
          join pg_namespace n on n.oid=cl.relnamespace where n.nspname='public' and not tg.tgisinternal) as t,
        (select count(*)::text from information_schema.columns
          where table_schema='public' and column_default like '%auth.uid()%') as a
    `);
    const st = s[0]!;
    add("schema objects present", Number(st.f) >= 11 && Number(st.t) >= 7,
      `${st.c} constraints, ${st.i} indexes, ${st.f} functions, ${st.t} triggers`);
    add("no Supabase auth.uid() default", Number(st.a) === 0, `${st.a} column(s) depend on auth.uid()`);

    // ------------------------------------------------------- 5. lease functions
    //
    // The worker's concurrency safety rests entirely on these three. Verified by using
    // them, not by checking they exist: claim, prove a second owner is refused, renew,
    // release.
    //
    // Against a THROWAWAY row this script creates and deletes, not against any real
    // audit_runs row. Two real attempts against real rows both misfired for reasons that
    // had nothing to do with the lease functions: the newest row by created_at was once a
    // stray BLOCKED test artifact (unclaimable by claim_audit_run's own design), and once a
    // COMPLETE row (claimable, but renew_audit_run_lease's own WHERE clause requires
    // status = 'RUNNING' specifically -- narrower than claim's). Depending on production
    // happening to currently have a RUNNING row is exactly the kind of flakiness a
    // verification tool should not have, and touching a real row's lease columns at all
    // risks colliding with a genuinely active worker. A self-contained row sidesteps both.
    const owner = `verify-cutover:${Date.now()}`;
    const other = `verify-cutover-other:${Date.now()}`;
    let leaseTestMatchId: string | null = null;
    try {
      const { rows: matchRows } = await pool.query<{ id: string }>(
        `insert into public.matches (canonical_key, player1_name, player2_name) values ($1, 'Lease Self-Test P1', 'Lease Self-Test P2') returning id`,
        [`verify-cutover-lease-${Date.now()}`],
      );
      leaseTestMatchId = matchRows[0]!.id;
      const { rows: runRows } = await pool.query<{ id: string }>(
        `insert into public.audit_runs (match_id, run_number, status) values ($1, 1, 'RUNNING') returning id`,
        [leaseTestMatchId],
      );
      const runId = runRows[0]!.id;

      const claim = await pool.query<{ ok: boolean }>(`select public.claim_audit_run($1::uuid,$2::text,60) as ok`, [runId, owner]);
      const stolen = await pool.query<{ ok: boolean }>(`select public.claim_audit_run($1::uuid,$2::text,60) as ok`, [runId, other]);
      const renew = await pool.query<{ ok: boolean }>(`select public.renew_audit_run_lease($1::uuid,$2::text,60) as ok`, [runId, owner]);
      const release = await pool.query<{ ok: boolean }>(`select public.release_audit_run_lease($1::uuid,$2::text) as ok`, [runId, owner]);
      const claimed = claim.rows[0]!.ok === true;
      const refused = stolen.rows[0]!.ok === false;
      const renewed = renew.rows[0]!.ok === true;
      const released = release.rows[0]!.ok === true;
      add("lease functions work", claimed && refused && renewed && released,
        `claim=${claimed} second-owner-refused=${refused} renew=${renewed} release=${released}`);
    } finally {
      // Cascades to the audit_runs row (ON DELETE CASCADE). Best-effort and unconditional:
      // this must never leave a synthetic row behind, whatever happened above.
      if (leaseTestMatchId) {
        await pool.query(`delete from public.matches where id = $1`, [leaseTestMatchId]).catch(() => {});
      }
    }

    // ------------------------------------------------ 6. foreign key integrity
    const { rows: fks } = await pool.query<{ child: string; col: string; parent: string; pcol: string }>(`
      select cl.relname as child, ac.attname as col, p.relname as parent, ap.attname as pcol
        from pg_constraint co
        join pg_class cl on cl.oid=co.conrelid
        join pg_class p on p.oid=co.confrelid
        join pg_namespace n on n.oid=cl.relnamespace
        join unnest(co.conkey) with ordinality as ck(attnum, ord) on true
        join unnest(co.confkey) with ordinality as pk(attnum, ord) on pk.ord=ck.ord
        join pg_attribute ac on ac.attrelid=cl.oid and ac.attnum=ck.attnum
        join pg_attribute ap on ap.attrelid=p.oid and ap.attnum=pk.attnum
       where co.contype='f' and n.nspname='public'
    `);
    let orphans = 0;
    for (const fk of fks) {
      const { rows } = await pool.query<{ n: string }>(
        `select count(*)::text as n from public."${fk.child}" c
          where c."${fk.col}" is not null
            and not exists (select 1 from public."${fk.parent}" p where p."${fk.pcol}" = c."${fk.col}")`);
      orphans += Number(rows[0]!.n);
    }
    add("foreign key integrity", orphans === 0, `${fks.length} relationships checked, ${orphans} orphan(s)`);
  } catch (error) {
    add("database checks completed", false, error instanceof Error ? error.message : String(error));
  } finally {
    await pool.end().catch(() => {});
  }

  // ----------------------------------------------------------- 7. route secrets
  // The retired keys are identified by SHA-256, not by their literal text. Writing the
  // old values here to compare against would put the very strings this check exists to
  // retire back into the repository -- which is what api-key-auth.test.ts flagged when
  // they were.
  const RETIRED_KEY_HASHES: Record<string, string> = {
    EVIDENCE_COVERAGE_KEY: "c34f8c10268b6c965c794de276e33ee9d0cb41f0e4666f01b5535cfa0abf790f",
    REPUBLISH_KEY: "c30855418126d3c490ed4c8dc31b2f4bd64bdf7ce31c32ff1ba76d9fe919665c",
  };
  for (const [name, retiredHash] of Object.entries(RETIRED_KEY_HASHES)) {
    const value = process.env[name];
    if (!value) {
      add(`${name} configured`, false, "not set -- the route will return 503");
      continue;
    }
    const hash = createHash("sha256").update(value).digest("hex");
    if (hash === retiredHash) {
      add(`${name} configured`, false, "STILL THE LEAKED VALUE -- rotate it");
    } else {
      add(`${name} configured`, true, `set, and not the leaked value (length ${value.length})`);
    }
  }

  // ------------------------------------------------ 8. no Supabase/Lovable runtime
  const pkg = JSON.parse(readFileSync(resolve(repoRoot, "package.json"), "utf8")) as {
    dependencies?: Record<string, string>; devDependencies?: Record<string, string>;
  };
  const badDeps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies })
    .filter((d) => /supabase|lovable/iu.test(d));
  add("no Supabase/Lovable package", badDeps.length === 0, badDeps.length ? badDeps.join(", ") : "none");

  const supabaseClient = existsSync(resolve(repoRoot, "src/integrations/supabase"));
  add("Supabase client removed", !supabaseClient, supabaseClient ? "src/integrations/supabase still exists" : "src/integrations/supabase absent");

  // --------------------------------------------------- 9. the export is not committed
  const trackedExport = execFileSync("git", ["ls-files"], { cwd: repoRoot, encoding: "utf8" })
    .split("\n").filter((f) => f.startsWith("migration-export"));
  add("production export not committed", trackedExport.length === 0,
    trackedExport.length ? `${trackedExport.length} export file(s) tracked in git` : "none tracked");

  // ------------------------------------------------------------- 10. scheduler
  const driveWorkflow = resolve(repoRoot, ".github/workflows/drive-audit.yml");
  const cronDrivesAudits = existsSync(driveWorkflow) && /^\s*schedule:/mu.test(readFileSync(driveWorkflow, "utf8"));
  add("no GitHub Actions cron drives audits", !cronDrivesAudits,
    cronDrivesAudits ? "drive-audit.yml still has a schedule" : "drive-audit.yml is workflow_dispatch only");
  add("Replit worker entrypoint exists", existsSync(resolve(repoRoot, "scripts/drive-audit-worker.ts")),
    "scripts/drive-audit-worker.ts");

  // ------------------------------------------------------------------- report
  const width = Math.max(...checks.map((c) => c.name.length));
  for (const c of checks) console.log(`  ${c.ok ? "ok  " : "FAIL"} ${c.name.padEnd(width)}  ${c.detail}`);

  const failed = checks.filter((c) => !c.ok);
  console.log("");
  if (failed.length) {
    console.error(`VERIFICATION FAILED -- ${failed.length} of ${checks.length} checks did not pass.`);
    process.exit(1);
  }
  console.log(`ALL ${checks.length} CHECKS PASSED. The application is on ${host}/${database}.`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
