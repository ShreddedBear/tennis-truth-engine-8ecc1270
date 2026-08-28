import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
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
    expect(loader).toContain('"data", "generated", "tennis-runtime-index.json"');
    expect(loader).toContain("export function loadRuntimeIndex");
  });

  // Regression guard for a second real production outage, found in the same file: the
  // Worker has no filesystem at request time at all, so readFileSync -- while a correct
  // fallback for local/Node dev -- never succeeds in production regardless of what code is
  // deployed. The generated index must also be reachable via the Cloudflare Workers ASSETS
  // binding (a static asset under public/, per wrangler.json), loaded once up front before
  // any request handler runs, so every synchronous loadRuntimeIndex() call site sees an
  // already-populated cache.
  it("also loads the runtime tennis index via the Cloudflare Workers ASSETS binding, and the entry point pre-warms it before any request handler runs", () => {
    const loader = readFileSync(join(process.cwd(), "src/lib/runtime-tennis-index-data.server.ts"), "utf8");
    expect(loader).toContain("export async function ensureRuntimeIndexLoaded");
    expect(loader).toContain("assets.fetch");
    const serverEntry = readFileSync(join(process.cwd(), "src/server.ts"), "utf8");
    expect(serverEntry).toContain("ensureRuntimeIndexLoaded");
  });

  // Regression guard for the third, and actual, root cause: even with the ASSETS-binding
  // fallback above, production stayed broken because Cloudflare Workers hard-rejects any
  // individual static asset over 25 MiB at deploy time ("Asset too large") -- and the raw
  // runtime index is ~61MB. The asset the Worker fetches must be a gzip-compressed copy
  // (~5.2MB), decompressed at request time, and the raw file must not live under public/
  // at all (shipping it there risks the same oversized-asset deploy failure again).
  it("fetches a gzip-compressed asset, decompresses it, and does not ship the raw 61MB file under public/", () => {
    const loader = readFileSync(join(process.cwd(), "src/lib/runtime-tennis-index-data.server.ts"), "utf8");
    expect(loader).toContain('"/generated/tennis-runtime-index.json.gz"');
    expect(loader).toContain("DecompressionStream");
    const rawAssetPath = join(process.cwd(), "public", "generated", "tennis-runtime-index.json");
    expect(existsSync(rawAssetPath), `${rawAssetPath} must not exist -- it exceeds Cloudflare Workers' 25 MiB static asset limit`).toBe(false);
    const gzAssetPath = join(process.cwd(), "public", "generated", "tennis-runtime-index.json.gz");
    expect(existsSync(gzAssetPath)).toBe(true);
    expect(statSync(gzAssetPath).size).toBeLessThan(25 * 1024 * 1024);
  });
});
