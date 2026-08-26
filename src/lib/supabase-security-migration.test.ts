import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = resolve(process.cwd(), "supabase/migrations/20260826103000_supabase_security_rls_repair.sql");
const sql = readFileSync(migrationPath, "utf8");

const backendOnly = [
  "ingestion_targets",
  "metric_evidence_store",
  "source_ingestion_runs",
  "source_observations",
];

describe("Supabase security repair migration", () => {
  it("enables RLS for every public table through a catalog sweep", () => {
    expect(sql).toContain("alter table %s enable row level security");
    expect(sql).toContain("n.nspname = 'public'");
  });

  it.each(backendOnly)("keeps %s in the backend-only set", (table) => {
    expect(sql).toContain(`'${table}'`);
  });

  it("removes anonymous public-schema privileges", () => {
    expect(sql).toContain("revoke all on all tables in schema public from anon");
    expect(sql).toContain("revoke all on all sequences in schema public from anon");
  });

  it("removes dangerous open write policies instead of ignoring them", () => {
    expect(sql).toContain("single user open access");
    expect(sql).toContain("cmd in ('ALL','INSERT','UPDATE','DELETE')");
    expect(sql).not.toMatch(/create\s+policy\s+[^\n]+for\s+all\s+to\s+anon/iu);
  });

  it("enforces override requires_admin boundaries", () => {
    expect(sql).toContain('override_owner_or_admin_insert');
    expect(sql).toContain("requires_admin=false");
    expect(sql).toContain("public.has_role('admin'::public.app_role");
  });

  it("keeps the database export bucket private and admin-scoped", () => {
    expect(sql).toContain("where id = 'database_export_26_08_26'");
    expect(sql).toContain("set public = false");
    for (const op of ["select", "insert", "update", "delete"]) {
      expect(sql).toContain(`db_backup_admin_${op}`);
    }
  });

  it("converts has_role to security invoker and revokes public definer execution", () => {
    expect(sql).toContain("security invoker");
    expect(sql).toContain("revoke all on function public.has_role(public.app_role, uuid) from public, anon");
    expect(sql).toContain("where n.nspname='public'");
    expect(sql).toContain("and p.prosecdef");
    expect(sql).toContain("revoke all on function %s from public, anon, authenticated");
  });

  it("rejects authenticated anonymous identities in privileged policies", () => {
    expect(sql).toContain("is_anonymous");
  });

  it("does not contain Evidence Coverage scoring or evidence-rule rewrites", () => {
    expect(sql).not.toMatch(/usable_coverage_percent\s*=|reliability\s*=|treatment\s*=\s*'(DIRECT|PARTIAL|RECONSTRUCTED)'/u);
    expect(sql).not.toMatch(/update\s+public\.metric_evidence_store\s+set\s+(treatment|reliability|value_text)/iu);
  });
});
