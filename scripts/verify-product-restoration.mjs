import { access, readFile } from "node:fs/promises";
import process from "node:process";

const failures = [];

async function requireFile(path) {
  try {
    await access(path);
  } catch {
    failures.push(`Missing required restoration file: ${path}`);
  }
}

async function requireText(path, expectations) {
  let text;
  try {
    text = await readFile(path, "utf8");
  } catch {
    failures.push(`Could not read required restoration file: ${path}`);
    return;
  }

  for (const { description, pattern } of expectations) {
    if (!pattern.test(text)) {
      failures.push(`${path}: missing ${description}`);
    }
  }
}

await Promise.all([
  requireFile("artifacts/tennis-predictor/src/pages/AdminParlayBuilder.tsx"),
  requireFile("artifacts/tennis-truth-engine/src/routes/index.tsx"),
  requireFile("artifacts/prediction-worker/package.json"),
  requireText("artifacts/tennis-predictor/src/App.tsx", [
    { description: "Prediction Engine home route", pattern: /path="\/"\s+component=\{Home\}/ },
    { description: "Parlay Builder route", pattern: /path="\/admin\/parlay-builder"/ },
    { description: "Truth Engine route", pattern: /path="\/truth-engine"/ },
  ]),
  requireText("artifacts/tennis-predictor/src/components/Layout.tsx", [
    { description: "Prediction Engine navigation", pattern: /label:\s*"Prediction Engine"/ },
    { description: "Parlay Builder navigation", pattern: /label:\s*"Parlay Builder"/ },
    { description: "Truth Engine navigation", pattern: /label:\s*"Truth Engine"/ },
  ]),
  requireText("artifacts/tennis-predictor/.replit-artifact/artifact.toml", [
    { description: "root preview path", pattern: /previewPath\s*=\s*"\/"/ },
  ]),
  requireText("artifacts/tennis-truth-engine/.replit-artifact/artifact.toml", [
    { description: "separate Truth Engine preview path", pattern: /previewPath\s*=\s*"\/truth-engine"/ },
  ]),
  requireText("artifacts/tennis-truth-engine/vite.config.ts", [
    { description: "Vite base path from the artifact runtime", pattern: /base:\s*basePath/ },
  ]),
  requireText("artifacts/tennis-truth-engine/src/router.tsx", [
    { description: "TanStack Router base path from Vite", pattern: /basepath:\s*import\.meta\.env\.BASE_URL/ },
  ]),
  requireFile("artifacts/tennis-predictor/e2e/truth-engine-restoration.spec.ts"),
  requireText("artifacts/api-server/.replit-artifact/artifact.toml", [
    { description: "API health check", pattern: /path\s*=\s*"\/api\/healthz"/ },
  ]),
  requireText("artifacts/prediction-worker/package.json", [
    { description: "paper-trading worker command", pattern: /"paper-trading"/ },
    { description: "calibration-refit worker command", pattern: /"calibration-refit"/ },
    { description: "historical-backfill worker command", pattern: /"historical-backfill"/ },
  ]),
]);

const apiArtifact = await readFile(
  "artifacts/api-server/.replit-artifact/artifact.toml",
  "utf8",
).catch(() => "");

if (/STATS_DATABASE_NAME\s*=/.test(apiArtifact)) {
  failures.push(
    "API artifact must use the workspace DATABASE_URL database; a hard-coded STATS_DATABASE_NAME can take the restored app offline.",
  );
}

if (failures.length > 0) {
  console.error("Tennis Matrix restoration contract failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  "Restoration contract passed: Prediction Engine is primary; Parlay Builder, Truth Engine, API health, and worker artifacts are preserved.",
);