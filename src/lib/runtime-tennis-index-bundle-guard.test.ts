import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Regression guard for a real production outage: this repo used to import the full
// generated tennis-runtime-index module (src/generated/tennis-runtime-index.ts, ~46MB
// of player history) directly into server code, which got compiled straight into the
// Cloudflare Worker bundle and caused an Internal Server Error in production (fixed by
// a Worker bundle-size guard + replacing the direct import with
// runtime-tennis-index-data.server.ts's lazy readFileSync-based loadRuntimeIndex()).
// That module no longer exists at all -- this test fails loudly if anything ever tries
// to import it again, by path or by the alias it used to be reachable through.
const FORBIDDEN_IMPORT_PATTERNS = [
  /from\s+["']@\/generated\/tennis-runtime-index["']/,
  /from\s+["'](?:\.\.\/)+generated\/tennis-runtime-index["']/,
  /from\s+["']\.\/generated\/tennis-runtime-index["']/,
];

function collectSourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      if (entry === "node_modules" || entry === ".git") continue;
      collectSourceFiles(full, out);
    } else if (/\.(ts|tsx)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

describe("46MB tennis-runtime-index Worker-bundling outage guard", () => {
  it("has no direct import of the deleted src/generated/tennis-runtime-index module anywhere in src/", () => {
    const files = collectSourceFiles(join(process.cwd(), "src"));
    const offenders: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      if (FORBIDDEN_IMPORT_PATTERNS.some((pattern) => pattern.test(text))) offenders.push(file);
    }
    expect(offenders, `direct import(s) of the deleted 46MB module found in: ${offenders.join(", ")}`).toEqual([]);
  });

  it("the only reader of the runtime tennis index data is the approved lazy loader", () => {
    const loader = readFileSync(join(process.cwd(), "src/lib/runtime-tennis-index-data.server.ts"), "utf8");
    expect(loader).toContain("readFileSync");
    expect(loader).toContain("data/generated/tennis-runtime-index.json");
    expect(loader).toContain("export function loadRuntimeIndex");
  });
});
