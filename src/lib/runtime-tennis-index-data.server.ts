import { readFileSync } from "node:fs";
import { join } from "node:path";

type Bucket = { n: number; w: number; l: number; sets: number; setsWon: number; straightWins: number; deciding: number; decidingWins: number; elo: number | null; peak: number | null; lastDate: string | null; recent: Array<[string, number, string, number | null, string, string]> };
type Player = { name: string; overall: Bucket; surface: Record<string, Bucket> };
export type RuntimeTennisIndex = {
  generatedAt: string;
  ATP: Record<string, Player>;
  WTA: Record<string, Player>;
  matchHistory: {
    ATP_MAIN: Record<string, unknown[]>;
    WTA_MAIN: Record<string, unknown[]>;
    ATP_CHALLENGER: Record<string, unknown[]>;
    WTA_CHALLENGER: Record<string, unknown[]>;
  };
};

function empty(): RuntimeTennisIndex {
  return { generatedAt: "", ATP: {}, WTA: {}, matchHistory: { ATP_MAIN: {}, WTA_MAIN: {}, ATP_CHALLENGER: {}, WTA_CHALLENGER: {} } };
}

let cache: RuntimeTennisIndex | null = null;

// Loaded from disk (not bundled into the server JS) because the generated
// dataset is tens of MB — statically importing it inflated the deployed
// Worker bundle past Cloudflare's script size/startup limits.
export function loadRuntimeIndex(): RuntimeTennisIndex {
  if (cache) return cache;
  try {
    const text = readFileSync(join(process.cwd(), "data/generated/tennis-runtime-index.json"), "utf8");
    return (cache = JSON.parse(text) as RuntimeTennisIndex);
  } catch {
    // Do not memoize a failed read: a transient miss (cold start, deploy race)
    // must not permanently freeze this process's data to empty() forever.
    return empty();
  }
}
