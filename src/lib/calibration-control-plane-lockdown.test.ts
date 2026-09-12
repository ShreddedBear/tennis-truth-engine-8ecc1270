import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

// REGRESSION GUARD — the calibration control plane must not be browser-writable.
//
// The decision-table lockdown deliberately kept anon INSERT/UPDATE on the three calibration
// tables because a live browser path wrote them. That left a second writable surface over
// the record the engine learns from: the ledger, the bucket win-rates, and the flag that
// decides which calibration version is active. This file guards the two ways the fix can
// silently regress in review rather than in SQL.

const repoRoot = resolve(process.cwd());
const CALIBRATION_TABLES = ["calibration_ledger", "calibration_versions", "calibration_buckets"] as const;

// Filename version is the PRODUCTION LEDGER version (see the reconciliation note in
// docs/), so `supabase db push` treats this migration as applied rather than replaying it.
const lockdownSql = readFileSync(resolve(repoRoot, "supabase/migrations/20260911104922_calibration_control_plane_lockdown.sql"), "utf8");
const executable = lockdownSql
  .split("\n")
  .filter((line) => !line.trimStart().startsWith("--"))
  .join("\n");

describe("calibration control-plane lockdown migration", () => {
  it.each(CALIBRATION_TABLES)("revokes browser writes on %s and keeps service_role", (table) => {
    expect(executable).toContain(table);
    expect(executable).toMatch(/revoke insert, update, delete, truncate, references, trigger on table[\s\S]*from anon, authenticated/);
    expect(executable).toMatch(/grant all on table[\s\S]*to service_role/);
  });

  it("keeps SELECT so the calibration pages still render", () => {
    // Production has zero auth.users, so the UI reads as anon. Revoking SELECT here would
    // blank the calibration screens rather than secure them.
    expect(executable).toMatch(/grant select on table[\s\S]*to anon, authenticated/);
  });

  it("does not grant DELETE to a browser role anywhere", () => {
    expect(executable).not.toMatch(/grant[^;]*delete[^;]*to (anon|authenticated)/i);
  });

  it("stays scoped to the calibration tables", () => {
    // A whole-schema repair here would take the app offline; that is a separate, explicit
    // decision (see the decision-table lockdown's header).
    expect(executable).not.toMatch(/revoke all on all tables in schema public/);
    expect(executable).not.toContain("metric_results");
    expect(executable).not.toContain("final_decisions");
  });
});

describe("no browser code writes the calibration control plane", () => {
  // This suite used to pin two KNOWN LEGACY WRITERS -- calibration.ts's manual grade button
  // and bootstrap.ts's first-run seeder -- which wrote the calibration control plane from
  // the browser with the publishable key. The database lockdown revoked their grants, so
  // they were non-functional, but the call sites were still there and were listed here
  // rather than deleted because removing them changed UI behaviour that could not be
  // verified at the time.
  //
  // Both are now gone for real: grading moved to calibration.server.ts behind
  // gradeCalibrationResult, and seeding to bootstrap.server.ts behind ensureBootstrapped.
  // The expected list is therefore EMPTY, and that is the assertion -- not a relaxation of
  // the old one, but the state the old one was waiting for.
  const clientWrites = execFileSync(
    "bash",
    ["-lc", `grep -rnoE '(from\\("(${CALIBRATION_TABLES.join("|")})"\\)|${CALIBRATION_TABLES.map((t) => `${t.replace(/_(.)/g, (_m, c) => c.toUpperCase())}Table`).join("|")})' --include=*.ts --include=*.tsx src | grep -v '\\.server\\.' | grep -v '\\.test\\.' | grep -v 'src/db/' || true`],
    { cwd: repoRoot, encoding: "utf8" },
  ).trim();

  it("has no client-reachable module naming a calibration table at all", () => {
    const found = (clientWrites ? clientWrites.split("\n") : []).map((line) => line.replace(/:(\d+):/, ":")).sort();
    expect(found).toEqual([]);
  });

  it("keeps the grading and seeding writers server-only", () => {
    for (const file of ["src/lib/calibration.server.ts", "src/lib/bootstrap.server.ts"]) {
      const text = readFileSync(resolve(repoRoot, file), "utf8");
      expect(text, `${file} must reach the database through the server-only client`).toContain('@/db/client.server');
    }
    // And the browser halves must not import them.
    for (const file of ["src/lib/calibration.ts", "src/lib/calibration.functions.ts", "src/lib/bootstrap.functions.ts"]) {
      const text = readFileSync(resolve(repoRoot, file), "utf8");
      expect(text.split("\n").filter((line) => line.startsWith("import")).join("\n"),
        `${file} must not import the database client at module scope`).not.toContain("@/db/client.server");
    }
  });
});

describe("supabase/config.toml points at the verified production project", () => {
  // The file named teblxzfqdqzwwooswncc while the live project -- the one every migration in
  // this branch was applied to and verified against -- is qyovnrkiknsiqjybxubf. A local
  // `supabase` CLI run would have targeted the wrong project entirely.
  const config = readFileSync(resolve(repoRoot, "supabase/config.toml"), "utf8");

  it("names the live project ref", () => {
    expect(config).toMatch(/^project_id\s*=\s*"qyovnrkiknsiqjybxubf"/m);
  });

  it("no longer names the stale ref", () => {
    expect(config).not.toContain("teblxzfqdqzwwooswncc");
  });
});
