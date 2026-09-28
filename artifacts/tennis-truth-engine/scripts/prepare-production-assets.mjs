import { cpSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const publicDir = join(root, ".output", "public");
const baseName = "truth-engine";
const prefixedDir = join(publicDir, baseName);

// Nitro emits assets at the public root, but Vite's /truth-engine/ base puts
// client asset URLs under /truth-engine/. Cloudflare's asset binding maps URLs
// directly to files; an HTML response alone cannot hydrate without this copy.
rmSync(prefixedDir, { recursive: true, force: true });
mkdirSync(prefixedDir, { recursive: true });
for (const entry of readdirSync(publicDir, { withFileTypes: true })) {
  if (entry.name === baseName) continue;
  cpSync(join(publicDir, entry.name), join(prefixedDir, entry.name), {
    recursive: entry.isDirectory(),
  });
}

console.log(`Truth Engine assets available under /${baseName}/.`);