// Production smoke test for the published Tennis Matrix workspace.
//
// Every recent outage built successfully and answered HTTP 200 while users saw a blank page
// or a dead API. This script therefore runs the *production* artifacts exactly the way
// .replit-artifact/artifact.toml runs them, puts them behind one origin with the same path
// routing as the published site (/api -> API server, /truth-engine -> Truth Engine Worker,
// everything else -> the Tennis Matrix AI static build with its SPA rewrite), and checks what a
// browser actually renders.
//
// Prerequisites: all three artifacts built (see .github/workflows/production-smoke.yml) and
// DATABASE_URL pointing at a database with the schema pushed. No other secrets are needed:
// the checks assert that each app stays up and renders without them.
//
// Usage: node scripts/production-smoke.mjs

import { spawn } from "node:child_process";
import { createReadStream, existsSync, statSync } from "node:fs";
import http from "node:http";
import { createRequire } from "node:module";
import { extname, join, normalize, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const GATEWAY_PORT = Number(process.env.SMOKE_PORT ?? 4173);
const API_PORT = 8080;
const TRUTH_ENGINE_PORT = 19024;
const predictorDir = join(root, "artifacts/tennis-predictor/dist/public");
const origin = `http://127.0.0.1:${GATEWAY_PORT}`;

const children = [];
const failures = [];
const warnings = [];

function start(name, command, args, env, cwd = root) {
  const child = spawn(command, args, {
    cwd,
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });
  let output = "";
  const keep = (chunk) => {
    output = (output + chunk).slice(-20_000);
  };
  child.stdout.on("data", keep);
  child.stderr.on("data", keep);
  children.push({ name, child, output: () => output });
  return child;
}

function stopAll() {
  for (const { child } of children) {
    try {
      process.kill(-child.pid, "SIGTERM");
    } catch {
      // already exited
    }
  }
}

async function waitFor(url, name, timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs;
  let last = "no response";
  while (Date.now() < deadline) {
    const exited = children.find((c) => c.name === name && c.child.exitCode !== null);
    if (exited) throw new Error(`${name} exited with code ${exited.child.exitCode} before becoming ready`);
    try {
      const res = await fetch(url);
      if (res.ok) return;
      last = `HTTP ${res.status}`;
    } catch (error) {
      last = error.cause?.code ?? error.message;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`${name} not ready at ${url} after ${timeoutMs / 1000}s (last: ${last})`);
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".json": "application/json",
  ".txt": "text/plain",
  ".woff2": "font/woff2",
  ".wasm": "application/wasm",
};

// Mirrors the published routing: path prefixes are forwarded unchanged to each service.
function gateway() {
  return http.createServer((req, res) => {
    const path = new URL(req.url, origin).pathname;
    const target =
      path === "/api" || path.startsWith("/api/")
        ? API_PORT
        : path === "/truth-engine" || path.startsWith("/truth-engine/")
          ? TRUTH_ENGINE_PORT
          : null;

    if (target) {
      const upstream = http.request(
        { host: "127.0.0.1", port: target, path: req.url, method: req.method, headers: req.headers },
        (up) => {
          res.writeHead(up.statusCode ?? 502, up.headers);
          up.pipe(res);
        },
      );
      upstream.on("error", () => {
        res.writeHead(502).end("upstream unavailable");
      });
      req.pipe(upstream);
      return;
    }

    // serve = "static" with the "/*" -> "/index.html" rewrite from artifact.toml.
    let file = normalize(join(predictorDir, decodeURIComponent(path)));
    if (!file.startsWith(predictorDir) || !existsSync(file) || statSync(file).isDirectory()) {
      file = join(predictorDir, "index.html");
    }
    res.writeHead(200, { "content-type": MIME[extname(file)] ?? "application/octet-stream" });
    createReadStream(file).pipe(res);
  });
}

async function checkPage(browser, path, { expectVisible, expectPath }) {
  const page = await browser.newPage();
  const problems = [];
  page.on("pageerror", (error) => problems.push(`uncaught: ${error.message}`));
  page.on("response", (response) => {
    if (!response.url().startsWith(origin) || response.status() < 400) return;
    const path = response.url().slice(origin.length);
    // The API answers 502/503 when a third-party data provider (live tennis data, odds) is
    // unreachable or its key is absent; the app deliberately never substitutes mock data.
    // That is not an outage of this workspace, so report it without failing.
    if (path.startsWith("/api/") && [502, 503].includes(response.status())) {
      warnings.push(`${response.status()} ${path} (external provider unavailable)`);
      return;
    }
    problems.push(`${response.status()} ${path}`);
  });
  page.on("requestfailed", (request) => {
    const error = request.failure()?.errorText ?? "failed";
    if (request.url().startsWith(origin) && error !== "net::ERR_ABORTED") {
      problems.push(`${error} ${request.url().slice(origin.length)}`);
    }
  });

  try {
    const response = await page.goto(origin + path, { waitUntil: "networkidle", timeout: 60_000 });
    if (!response?.ok()) problems.push(`document returned HTTP ${response?.status()}`);
    for (const text of expectVisible) {
      try {
        await page.getByText(text, { exact: false }).first().waitFor({ state: "visible", timeout: 15_000 });
      } catch {
        problems.push(`expected visible text not found: "${text}"`);
      }
    }
    if (expectPath && new URL(page.url()).pathname !== expectPath) {
      problems.push(`ended on ${new URL(page.url()).pathname}, expected ${expectPath}`);
    }
    const visibleChars = (await page.innerText("body").catch(() => "")).trim().length;
    if (visibleChars < 40) problems.push(`page is effectively blank (${visibleChars} visible characters)`);
  } catch (error) {
    problems.push(error.message.split("\n")[0]);
  } finally {
    await page.close();
  }

  if (problems.length) failures.push(`${path}\n      ${problems.join("\n      ")}`);
  console.log(`${problems.length ? "FAIL" : "ok  "} ${path}`);
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required (the API server refuses to start without it)");
  for (const [what, path] of [
    ["API server build", "artifacts/api-server/dist/index.mjs"],
    ["Truth Engine Worker build", "artifacts/tennis-truth-engine/.output/server/wrangler.json"],
    ["Tennis Matrix AI build", "artifacts/tennis-predictor/dist/public/index.html"],
  ]) {
    if (!existsSync(join(root, path))) throw new Error(`${what} missing (${path}); build it first`);
  }

  // Same commands and env as each artifact.toml [services.production.run].
  start("api-server", "node", ["--enable-source-maps", "artifacts/api-server/dist/index.mjs"], {
    PORT: String(API_PORT),
    NODE_ENV: "production",
  });
  start("truth-engine", "pnpm", ["--filter", "@workspace/tennis-truth-engine", "run", "preview"], {
    PORT: String(TRUTH_ENGINE_PORT),
    BASE_PATH: "/truth-engine",
  });
  const server = gateway();
  await new Promise((r) => server.listen(GATEWAY_PORT, "127.0.0.1", r));

  try {
    await waitFor(`http://127.0.0.1:${API_PORT}/api/healthz`, "api-server");
    await waitFor(`http://127.0.0.1:${TRUTH_ENGINE_PORT}/truth-engine/app/upload`, "truth-engine");

    const health = await fetch(`${origin}/api/healthz`);
    const healthBody = await health.text();
    if (health.status !== 200 || !healthBody.includes('"ok"')) {
      failures.push(`/api/healthz returned ${health.status}: ${healthBody.slice(0, 200)}`);
    }
    console.log(`${health.status === 200 ? "ok  " : "FAIL"} /api/healthz`);

    const require = createRequire(join(root, "artifacts/tennis-predictor/package.json"));
    const { chromium } = require("@playwright/test");
    const browser = await chromium.launch({
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
      args: ["--no-sandbox", "--disable-dev-shm-usage"],
    });
    try {
      await checkPage(browser, "/", { expectVisible: ["Tennis Matrix"] });
      for (const path of ["/truth-engine", "/truth-engine/", "/truth-engine/app/upload"]) {
        await checkPage(browser, path, {
          expectVisible: ["Upload summaries & parse review", "Start analysis"],
          expectPath: "/truth-engine/app/upload",
        });
      }
    } finally {
      await browser.close();
    }
  } finally {
    server.close();
    stopAll();
  }

  for (const warning of [...new Set(warnings)]) console.warn(`warn ${warning}`);
  if (failures.length) {
    console.error("\nProduction smoke test FAILED:");
    for (const failure of failures) console.error(`  - ${failure}`);
    for (const { name, output } of children) {
      console.error(`\n----- last output from ${name} -----\n${output().slice(-4000)}`);
    }
    process.exit(1);
  }
  console.log("\nProduction smoke test passed.");
}

main().catch((error) => {
  stopAll();
  console.error(`Production smoke test FAILED: ${error.message}`);
  for (const { name, output } of children) {
    console.error(`\n----- last output from ${name} -----\n${output().slice(-4000)}`);
  }
  process.exit(1);
});
