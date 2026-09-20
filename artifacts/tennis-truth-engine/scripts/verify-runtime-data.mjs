import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const requiredFiles = [
  "data/generated/tennis-runtime-index.json",
  "data/public/predixsport/atp/atp_elo_matches.csv",
  "data/public/predixsport/wta/wta_elo_ratings.csv",
  "public/generated/tennis-runtime-index.json.gz",
];

for (const relativePath of requiredFiles) {
  const absolutePath = join(process.cwd(), relativePath);
  const size = statSync(absolutePath).size;
  if (size === 0) {
    throw new Error(`Required runtime dataset is empty: ${relativePath}`);
  }
}

const runtimeIndex = JSON.parse(
  readFileSync(
    join(process.cwd(), "data/generated/tennis-runtime-index.json"),
    "utf8",
  ),
);

const atpPlayers = Object.keys(runtimeIndex.ATP ?? {}).length;
const wtaPlayers = Object.keys(runtimeIndex.WTA ?? {}).length;

if (atpPlayers === 0 || wtaPlayers === 0) {
  throw new Error(
    `Runtime tennis index is empty (ATP=${atpPlayers}, WTA=${wtaPlayers})`,
  );
}

console.info(
  `Runtime data verified (ATP=${atpPlayers}, WTA=${wtaPlayers})`,
);