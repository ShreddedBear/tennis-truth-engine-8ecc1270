import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const sourceHtml = new URL("index.html", root);
const workerConfig = new URL(".output/server/wrangler.json", root);
const oldRenderer = new URL(".output/server/_chunks/renderer-template.mjs", root);

if (existsSync(sourceHtml)) {
  throw new Error("Obsolete Vite index.html would replace the Truth Engine's server-rendered routes.");
}

const { compatibility_date: compatibilityDate } = JSON.parse(readFileSync(workerConfig, "utf8"));
if (compatibilityDate !== "2026-09-23") {
  throw new Error(`Unexpected Worker compatibility date ${compatibilityDate}; keep the build pinned to 2026-09-23.`);
}

if (existsSync(oldRenderer) && readFileSync(oldRenderer, "utf8").includes("/src/main.tsx")) {
  throw new Error("Production worker still includes a deleted Vite app entry.");
}

console.log(`Truth Engine production entry verified (${fileURLToPath(workerConfig)}).`);