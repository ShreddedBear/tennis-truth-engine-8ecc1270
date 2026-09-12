import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

// THE PROOF, not the convention.
//
// server-only.test.ts reasons about imports. This one reads the bytes that are actually
// shipped to a browser. Every claim the migration makes about the client having no database
// credential is only worth what this file says.
//
// It builds if there is no build to read, so it can never quietly pass by being skipped.

const repoRoot = resolve(process.cwd());
const clientDir = resolve(repoRoot, ".output/public");

function filesUnder(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });
}

let clientFiles: string[] = [];

beforeAll(() => {
  if (!existsSync(clientDir)) {
    execFileSync("npm", ["run", "build"], { cwd: repoRoot, stdio: "ignore" });
  }
  clientFiles = filesUnder(clientDir).filter((f) => /\.(js|mjs|cjs|html|json|map)$/.test(f));
}, 600_000);

const scan = (token: string) =>
  clientFiles
    .filter((file) => readFileSync(file, "utf8").includes(token))
    .map((file) => file.replace(`${repoRoot}/`, ""));

describe("the shipped client bundle", () => {
  it("exists and is non-trivial (guards against a vacuous sweep)", () => {
    expect(clientFiles.length).toBeGreaterThan(5);
    const bytes = clientFiles.reduce((n, f) => n + statSync(f).size, 0);
    expect(bytes).toBeGreaterThan(100_000);
  });

  it.each([
    "DATABASE_URL",
    "postgresql://",
    "postgres://",
    "DATABASE_POOL_MAX",
  ])("contains no database credential: %s", (token) => {
    expect(scan(token)).toEqual([]);
  });

  it.each([
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_PUBLISHABLE_KEY",
    "VITE_SUPABASE_URL",
    "VITE_SUPABASE_PUBLISHABLE_KEY",
    "sb_publishable_",
    "sb_secret_",
    ".supabase.co",
  ])("contains no Supabase credential or endpoint: %s", (token) => {
    expect(scan(token)).toEqual([]);
  });

  it("contains no database driver", () => {
    // If the pg driver or Drizzle's node adapter were reachable from a browser module, the
    // bundler would have pulled them in here.
    for (const token of ["node-postgres", "pg-pool", "pg-protocol", "drizzle-orm/node-postgres"]) {
      expect(scan(token), `${token} must not reach the browser`).toEqual([]);
    }
  });

  it("contains no server-only module marker", () => {
    // client.server.ts's own error text. Its presence would mean a server-only module was
    // bundled for the browser whatever the import graph appears to say.
    expect(scan("DATABASE_URL is not set")).toEqual([]);
  });
});
