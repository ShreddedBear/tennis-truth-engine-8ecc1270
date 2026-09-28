import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Guards against the outage where the production bundle contained two copies of
// @tanstack/react-query (one peered against a different React version via
// @workspace/api-client-react). The app's QueryClientProvider and the generated API hooks
// then used different contexts, and every page crashed with "No QueryClient set" -- in the
// production build only; `vite dev` pre-bundles dependencies and hid it.
// Each marker below is a string that appears exactly once per bundled copy of a library that
// must be a singleton.
const SINGLETONS = [["@tanstack/react-query", "No QueryClient set"]];

const assetsDir = join(import.meta.dirname, "..", "dist", "public", "assets");
const bundles = readdirSync(assetsDir)
  .filter((name) => name.endsWith(".js"))
  .map((name) => readFileSync(join(assetsDir, name), "utf8"));

const failures = [];
for (const [pkg, marker] of SINGLETONS) {
  const copies = bundles.reduce((n, source) => n + source.split(marker).length - 1, 0);
  if (copies !== 1) {
    failures.push(
      `${pkg} is bundled ${copies} times (expected 1). Add it to resolve.dedupe in vite.config.ts.`,
    );
  }
}

if (failures.length) {
  console.error("Production bundle check FAILED:");
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log("Production bundle check passed: singleton libraries are bundled once.");
