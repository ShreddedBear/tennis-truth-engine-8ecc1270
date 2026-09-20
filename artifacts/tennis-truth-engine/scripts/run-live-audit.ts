// Direct backend execution of the audit pipeline for a live match.
import { makeDeps } from "../src/lib/audit-repo.server";
import { runPipeline } from "../src/lib/audit-pipeline";

const matchId = process.argv[2] ?? "7624382d-65b3-48d9-87ff-359353ca6260";
const forceNewRun = process.argv.includes("--fresh");
const budgetArg = process.argv.find((arg) => arg.startsWith("--budget-ms="));
const budgetMs = budgetArg ? Number(budgetArg.split("=")[1]) : 300_000;

if (!Number.isFinite(budgetMs) || budgetMs <= 0) {
  throw new Error("--budget-ms must be a positive number");
}

async function main() {
  const deps = await makeDeps();
  const result = await runPipeline(deps, matchId, { budgetMs, forceNewRun });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
