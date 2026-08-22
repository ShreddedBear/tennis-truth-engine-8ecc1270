import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

function gitSha() {
  const envSha = process.env.GITHUB_SHA || process.env.CF_PAGES_COMMIT_SHA || process.env.VERCEL_GIT_COMMIT_SHA || process.env.SOURCE_VERSION || process.env.COMMIT_SHA;
  if (envSha) return String(envSha).slice(0, 12);
  try {
    return execSync("git rev-parse --short=12 HEAD", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "unknown";
  }
}

const info = {
  commit: gitSha(),
  builtAt: new Date().toISOString(),
};

const dir = join(process.cwd(), "src/generated");
mkdirSync(dir, { recursive: true });
writeFileSync(
  join(dir, "app-build-info.ts"),
  `// Generated at build time. Do not edit manually.\nexport const APP_BUILD_INFO = ${JSON.stringify(info, null, 2)} as const;\n`,
);
console.log(`App build info: ${info.commit} @ ${info.builtAt}`);
