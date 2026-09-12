import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { checkApiKey } from "./api-key-auth";

// CREDENTIALS MUST NOT LIVE IN THIS REPOSITORY.
//
// Two admin/diagnostic routes compared their query key against a string literal in source:
// "ECOV-20260825-b6f1" and "T19-REPUBLISH-9f2c7a1e". That was not a stale history artefact,
// it was live -- anyone who could read the repo could call them, and one republishes the
// METRICS rule document and invalidates audit runs. Both are in git history (14 and 5
// commits), which cannot be undone without rewriting every clone, so the only real fix is
// rotation plus this guard against it happening again.

const repoRoot = resolve(process.cwd());

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("shared-secret route auth", () => {
  it("fails closed when the secret is not configured", () => {
    vi.stubEnv("TEST_ROUTE_KEY", "");
    const result = checkApiKey("TEST_ROUTE_KEY", "anything");
    expect(result.ok).toBe(false);
    // 503, not 404: an unconfigured route is an operator problem worth seeing, and it
    // must never be an accidentally-open route.
    expect(result.ok === false && result.status).toBe(503);
  });

  it("rejects a wrong key as 404, leaking nothing about the route", () => {
    vi.stubEnv("TEST_ROUTE_KEY", "correct-value");
    const result = checkApiKey("TEST_ROUTE_KEY", "wrong-value");
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.status).toBe(404);
  });

  it("rejects a missing key", () => {
    vi.stubEnv("TEST_ROUTE_KEY", "correct-value");
    expect(checkApiKey("TEST_ROUTE_KEY", null).ok).toBe(false);
  });

  it("accepts the configured key", () => {
    vi.stubEnv("TEST_ROUTE_KEY", "correct-value");
    expect(checkApiKey("TEST_ROUTE_KEY", "correct-value").ok).toBe(true);
  });

  it("does not accept a prefix of the configured key", () => {
    vi.stubEnv("TEST_ROUTE_KEY", "correct-value");
    expect(checkApiKey("TEST_ROUTE_KEY", "correct").ok).toBe(false);
  });
});

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
    return /\.(ts|tsx|mjs|yml|yaml|toml)$/.test(entry) ? [join(dir, entry)] : [];
  });
}

describe("no credential is committed to this repository", () => {
  // This test file names the retired keys on purpose, so it is excluded from its own sweep.
  const files = ["src", "scripts", ".github"]
    .flatMap(sourceFilesUnder)
    .filter((f) => !f.endsWith("api-key-auth.test.ts"));

  it("finds files to check (guards against a vacuous sweep)", () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it("contains neither retired key", () => {
    for (const key of ["ECOV-20260825-b6f1", "T19-REPUBLISH-9f2c7a1e"]) {
      const offenders = files.filter((file) => readFileSync(resolve(repoRoot, file), "utf8").includes(key));
      expect(offenders, `${key} must not reappear in source`).toEqual([]);
    }
  });

  it("declares no route key as a source literal", () => {
    // The shape that caused this: `const SOMETHING_KEY = "a-literal-value"`.
    const pattern = /^\s*(?:const|let|var)\s+\w*(?:KEY|SECRET|TOKEN|PASSWORD)\w*\s*=\s*["'][^"']{6,}["']/mu;
    const offenders = files
      .filter((f) => /\.tsx?$/.test(f))
      .filter((file) => {
        const text = readFileSync(resolve(repoRoot, file), "utf8");
        const match = pattern.exec(text);
        // A browser storage key is not a credential; it is namespaced, not secret.
        return match !== null && !/localStorage|storage key|ERROR_KEY/iu.test(match[0]);
      });
    expect(offenders).toEqual([]);
  });

  it("puts no literal key into a workflow URL", () => {
    const workflows = files.filter((f) => f.startsWith(".github/"));
    const offenders = workflows.filter((file) => {
      const text = readFileSync(resolve(repoRoot, file), "utf8");
      return /key=(?!\$\{)[A-Za-z0-9_-]{6,}/u.test(text);
    });
    expect(offenders).toEqual([]);
  });

  it("ignores the database migration export", () => {
    // db:cutover writes a full dump of every application table into ./migration-export --
    // the entire production dataset. It was NOT ignored, and a run in the Replit workspace
    // duly committed all 50 tables into git. The export has to stay on disk until the new
    // database has been observed, so the fix is an ignore rule, not a delete.
    const ignore = readFileSync(resolve(repoRoot, ".gitignore"), "utf8");
    expect(ignore).toContain("migration-export/");
    // Scoped to that directory, NOT a blanket *.jsonl: data/audit/ and data/metrics/ hold
    // tracked .jsonl evidence artifacts that belong in the repository.
    expect(ignore).not.toMatch(/^\*\.jsonl$/mu);
  });

  it("tracks no exported production data", () => {
    const tracked = execFileSync("git", ["ls-files"], { cwd: repoRoot, encoding: "utf8" })
      .split("\n")
      .filter((f) => f.startsWith("migration-export"));
    expect(tracked, "the database export must never be committed").toEqual([]);
  });

  it("tracks no .env file carrying values", () => {
    // .env.example is tracked deliberately and must stay value-free.
    const example = readFileSync(resolve(repoRoot, ".env.example"), "utf8");
    const withValues = example
      .split("\n")
      .filter((line) => /^[A-Z_]+=.+/u.test(line))
      .filter((line) => !line.startsWith("DATABASE_URL=postgresql://user:password@host"));
    expect(withValues, ".env.example must show placeholders, never real values").toEqual([]);
  });
});
