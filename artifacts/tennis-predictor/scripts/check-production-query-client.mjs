import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const assetsDir = fileURLToPath(new URL("../dist/public/assets/", import.meta.url));
const marker = "No QueryClient set, use QueryClientProvider to set one";
let contextImplementations = 0;

for (const name of readdirSync(assetsDir).filter((file) => file.endsWith(".js"))) {
  const bundle = readFileSync(join(assetsDir, name), "utf8");
  contextImplementations += bundle.split(marker).length - 1;
}

if (contextImplementations !== 1) {
  throw new Error(
    `Expected one React Query context in the production bundle; found ${contextImplementations}. ` +
      "Duplicate copies cause the Predictor to show an unexpected-error page.",
  );
}

console.log("Predictor production bundle contains one React Query context.");