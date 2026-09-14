import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

// THE SECURITY BOUNDARY.
//
// Under PostgREST, the boundary was inside the database: the browser held a publishable key
// and Row Level Security decided what it could reach. That is gone. A direct connection
// authenticates as the schema owner and RLS does not apply to it.
//
// What replaces it is this: the browser has NO database credential of any kind, and cannot
// reach the database except through a server function defined in this codebase. That is
// only true so long as nothing server-only is reachable from a module that ships to the
// client, so it is asserted here rather than assumed.

const repoRoot = resolve(process.cwd());

/**
 * Everything that ends up in the client bundle.
 *
 * src/routes/api is deliberately excluded: those are SERVER routes. They declare their
 * handlers inside a `server: { handlers: { ... } }` block, which the framework strips from
 * the client build, so they are allowed to import the database directly. That exclusion is
 * a claim about the bundler, not a convention -- bundle-secrets.test.ts checks the real
 * build output to make sure it is true.
 */
const BROWSER_DIRS = ["src/routes", "src/components", "src/hooks"];
const SERVER_ROUTE_PREFIX = "src/routes/api/";

/** Server-only modules, by the convention this codebase already used. */
const isServerOnly = (path: string) => /\.server\.tsx?$/.test(path);

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
    return /\.(ts|tsx)$/.test(entry) && !/\.test\.tsx?$/.test(entry) ? [join(dir, entry)] : [];
  });
}

const read = (relative: string) => readFileSync(resolve(repoRoot, relative), "utf8");

/**
 * Import statements only.
 *
 * A *.functions.ts module ships to the browser, but its .handler() body is stripped out, so
 * a dynamic `await import("./x.server")` inside a handler is correct and expected. What
 * must never appear is a MODULE-SCOPE import of a server-only module, because that is not
 * stripped.
 */
function moduleScopeImports(source: string): string {
  return source
    .split("\n")
    .filter((line) => /^\s*import\s/.test(line) || /^\s*export\s+\*\s+from/.test(line))
    .join("\n");
}

const browserFiles = BROWSER_DIRS.flatMap(sourceFilesUnder).filter((f) => !f.startsWith(SERVER_ROUTE_PREFIX));
const functionModules = sourceFilesUnder("src/lib").filter((f) => /\.functions\.tsx?$/.test(f));
const clientReachable = [...browserFiles, ...functionModules];

describe("the browser bundle has no database access", () => {
  it("finds the modules it is meant to check (guards against a vacuous sweep)", () => {
    expect(browserFiles.length).toBeGreaterThan(10);
    expect(functionModules.length).toBeGreaterThan(5);
  });

  it.each([
    ["the database client", "@/db/client.server"],
    ["the node-postgres driver", "\"pg\""],
    ["drizzle's node-postgres adapter", "drizzle-orm/node-postgres"],
  ])("no client-reachable module imports %s at module scope", (_label, specifier) => {
    const offenders = clientReachable.filter((file) => moduleScopeImports(read(file)).includes(specifier));
    expect(offenders).toEqual([]);
  });

  it("no client-reachable module imports any *.server module at module scope", () => {
    const offenders = clientReachable.filter((file) =>
      /^\s*import[^\n]*["'][^"']*\.server["']/mu.test(moduleScopeImports(read(file))));
    expect(offenders).toEqual([]);
  });

  it("no client-reachable module names DATABASE_URL or a connection string", () => {
    const offenders = clientReachable.filter((file) => {
      const text = read(file);
      return text.includes("DATABASE_URL") || /postgres(ql)?:\/\//u.test(text);
    });
    expect(offenders).toEqual([]);
  });

  it("no client-reachable module names a Supabase key or URL", () => {
    // Even as a leftover string: the publishable key is what made the old browser writes
    // possible, and anything still reading it is a path back to them.
    const forbidden = [
      "SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SERVICE_ROLE_KEY",
      "VITE_SUPABASE", "sb_publishable_", "sb_secret_", "@supabase/supabase-js",
    ];
    const offenders = clientReachable
      .map((file) => [file, forbidden.filter((token) => read(file).includes(token))] as const)
      .filter(([, hits]) => hits.length > 0)
      .map(([file, hits]) => `${file}: ${hits.join(", ")}`);
    expect(offenders).toEqual([]);
  });
});

describe("every module that reaches the database is server-only", () => {
  const libFiles = sourceFilesUnder("src/lib");
  const dbFiles = sourceFilesUnder("src/db");

  it("only *.server modules import the database client", () => {
    const offenders = [...libFiles, ...dbFiles]
      .filter((file) => !isServerOnly(file))
      .filter((file) => moduleScopeImports(read(file)).includes("@/db/client.server"))
      .filter((file) => file !== "src/db/client.server.ts");
    expect(offenders).toEqual([]);
  });

  it("the database client itself refuses to run without DATABASE_URL", () => {
    const client = read("src/db/client.server.ts");
    expect(client).toContain('process.env["DATABASE_URL"]');
    expect(client).toContain("throw new Error(message)");
    // Lazy: importing the module must not open a socket, which is what lets the parity
    // tests import it with no database configured.
    expect(client).toContain("if (!_pool) _pool = createPool()");
  });
});

describe("server functions are the only door", () => {
  it("every *.functions module reaches its server half through a dynamic import", () => {
    const offenders = functionModules.filter((file) => {
      const text = read(file);
      if (!/\.server["']/u.test(text)) return false;
      // Every reference to a .server module must be inside an await import(...).
      const references = [...text.matchAll(/["'][^"']*\.server["']/gu)];
      return references.some((match) => {
        const before = text.slice(Math.max(0, match.index - 40), match.index);
        return !before.includes("await import(") && !before.includes("import(");
      });
    });
    expect(offenders).toEqual([]);
  });

  it("every server function validates or takes no input", () => {
    // A handler that reads `data` without an inputValidator is taking the browser's word
    // for its arguments -- which, for a module whose whole job is to be the trusted side
    // of the boundary, is the failure mode worth pinning.
    const offenders: string[] = [];
    for (const file of functionModules) {
      const text = read(file);
      for (const block of text.split("createServerFn").slice(1)) {
        const handler = block.slice(0, block.indexOf("});") + 1);
        const usesData = /\.handler\(async \(\{\s*data\s*\}\)/u.test(handler);
        if (usesData && !handler.includes(".inputValidator(")) offenders.push(file);
      }
    }
    expect([...new Set(offenders)]).toEqual([]);
  });
});
