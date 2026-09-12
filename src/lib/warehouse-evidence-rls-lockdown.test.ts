import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

// P0 REGRESSION GUARD — public write access to the evidence warehouse.
//
// Production held RLS disabled and full SELECT/INSERT/UPDATE/DELETE/TRUNCATE for
// `anon` on the four backend-owned warehouse tables, 887 + 6,945 + 5 + 42 rows of
// evidence the deterministic metric producers read to build the values the Truth
// Engine grades on. The publishable key is in the browser bundle, so that was a
// live path to fabricating the evidence behind a winner.
//
// The migration is the fix; these tests guard the two ways it can silently
// regress in code review rather than in SQL:
//
//   1. The migration file stops carrying one of its four tables, its function
//      revoke, or quietly grows into the whole-schema repair it deliberately is
//      not (that one would take the browser UI offline -- see the file header).
//   2. Someone adds a browser-side query against one of these tables. Once the
//      lockdown is live such a query returns nothing rather than failing loudly,
//      so this is exactly the kind of break that ships unnoticed.

const repoRoot = resolve(process.cwd());
// Filename version is the PRODUCTION LEDGER version, so `supabase db push` recognises this
// migration as already applied instead of replaying it under a second version.
const migrationPath = resolve(repoRoot, "docs/legacy-supabase/migrations/20260910213746_warehouse_evidence_rls_lockdown.sql");
const sql = readFileSync(migrationPath, "utf8");
// The "stays minimal" assertions below are about what the migration EXECUTES, not what its
// header explains. That header deliberately quotes the whole-schema statements this file
// refuses to reproduce, so it must be stripped before asserting their absence.
const executableSql = sql
  .split("\n")
  .filter((line) => !line.trimStart().startsWith("--"))
  .join("\n");

/** The four backend-owned tables. Every reader/writer must be server-side. */
const WAREHOUSE_TABLES = [
  "ingestion_targets",
  "metric_evidence_store",
  "source_ingestion_runs",
  "source_observations",
] as const;

/** Directories that end up in the browser bundle. */
const BROWSER_DIRS = ["src/routes", "src/components", "src/hooks"];

function sourceFilesUnder(dir: string): string[] {
  const absolute = resolve(repoRoot, dir);
  let entries: string[];
  try {
    entries = readdirSync(absolute);
  } catch {
    return [];
  }
  return entries.flatMap((entry) => {
    const path = join(absolute, entry);
    if (statSync(path).isDirectory()) return sourceFilesUnder(join(dir, entry));
    return /\.(ts|tsx)$/.test(entry) && !/\.test\.tsx?$/.test(entry) ? [path] : [];
  });
}

describe("warehouse evidence RLS lockdown migration", () => {
  it.each(WAREHOUSE_TABLES)("locks down %s", (table) => {
    expect(sql).toContain(`'${table}'`);
  });

  it("enables RLS, removes browser-role privileges, and preserves service_role", () => {
    expect(sql).toContain("enable row level security");
    expect(sql).toContain("revoke all on table public.%I from anon, authenticated");
    expect(sql).toContain("grant all on table public.%I to service_role");
  });

  it("also closes the SECURITY DEFINER RPC, which table privileges alone cannot", () => {
    // upsert_metric_evidence_side is SECURITY DEFINER and owned by a BYPASSRLS role, so
    // an anon EXECUTE grant is a write door into metric_evidence_store that survives
    // every table-level revoke above.
    expect(sql).toContain("revoke all on function public.upsert_metric_evidence_side(jsonb) from public, anon, authenticated");
    expect(sql).toContain("grant execute on function public.upsert_metric_evidence_side(jsonb) to service_role");
  });

  it("stays minimal: never the whole-schema sweep that would revoke the browser UI's own reads", () => {
    // The app's browser client reads matches/audit_runs/audit_stage_runs/metric_results/
    // final_decisions with the publishable key. A schema-wide revoke here would black out
    // the UI, which is precisely why 20260826103000's section 2 is NOT reproduced.
    expect(executableSql).not.toContain("revoke all on all tables in schema public");
    expect(executableSql).not.toMatch(/where\s+n\.nspname\s*=\s*'public'\s+and\s+c\.relkind/iu);
    for (const table of ["matches", "audit_runs", "metric_results", "final_decisions", "audit_stage_runs"]) {
      expect(executableSql, `${table} must not be touched by this migration`).not.toContain(`'${table}'`);
    }
  });

  it("changes no row data", () => {
    expect(executableSql).not.toMatch(/\b(insert\s+into|update\s+public|delete\s+from|truncate\s+table)\b/iu);
  });
});

describe("no browser-bundled module may reach the evidence warehouse", () => {
  // This suite was written when the browser held a publishable key and the four warehouse
  // tables were one anon GRANT away from being writable from a page. It asserted (a) that
  // no browser file named one of those tables, and (b) that any module which did reach them
  // used the service-role client rather than the anon one.
  //
  // (b) no longer has a subject: there is no anon client and no service-role client. The
  // equivalent question now is whether any client-reachable module can reach the database
  // AT ALL, which src/db/server-only.test.ts answers against the import graph and
  // src/db/bundle-secrets.test.ts answers against the shipped bytes. What is kept here is
  // (a), in the form the tables are named today.
  const browserFiles = BROWSER_DIRS.flatMap(sourceFilesUnder)
    .filter((file) => !file.includes("/routes/api/"));

  it("finds browser source files to check (guards against a vacuous sweep)", () => {
    expect(browserFiles.length).toBeGreaterThan(10);
  });

  it.each(WAREHOUSE_TABLES)("no browser file names %s", (table) => {
    const camel = `${table.replace(/_(.)/gu, (_m, c: string) => c.toUpperCase())}Table`;
    const offenders = browserFiles.filter((file) => {
      const text = readFileSync(file, "utf8");
      return text.includes(`"${table}"`) || text.includes(camel);
    });
    expect(offenders.map((file) => file.replace(`${repoRoot}/`, ""))).toEqual([]);
  });

  it("every module that does reach the warehouse is server-only", () => {
    const libFiles = sourceFilesUnder("src/lib");
    const offenders = libFiles.filter((file) => {
      const text = readFileSync(file, "utf8");
      const reachesWarehouse = WAREHOUSE_TABLES.some((table) =>
        text.includes(`${table.replace(/_(.)/gu, (_m, c: string) => c.toUpperCase())}Table`));
      if (!reachesWarehouse) return false;
      // .server.ts by name, and it must reach the database through the server-only client.
      return !/\.server\.ts$/.test(file) || !text.includes("@/db/client.server");
    });
    expect(offenders.map((file) => file.replace(`${repoRoot}/`, ""))).toEqual([]);
  });
});
