#!/usr/bin/env bun
// Unattended result-capture driver, run on a schedule from
// .github/workflows/capture-match-results.yml.
//
// ROOT-CAUSE FIX: captureAndResolveResults (match-result-capture.ts) and its live wiring
// (runResultCapture, match-result-capture.server.ts) were both correct and already tested,
// but nothing anywhere ever called them -- no cron, no route, no button. A completed match
// whose result later became available in the runtime tennis index (built from the committed
// CSV sources -- see repository-results-history.server.ts) would sit ungraded forever,
// which is why matches.actual_winner was unpopulated in production even for matches that
// had genuinely finished and whose result the repository's own history store later carried.
// This script closes exactly that gap, the same way drive-audit.yml closes the equivalent
// gap for audit driving: run the existing, already-correct capture pass on a schedule.
//
// Deliberately imports runResultCapture -- the exact capture/resolve logic already tested
// in match-result-capture.test.ts -- rather than reimplementing any of it here.
import { runResultCapture } from "../src/lib/match-result-capture.server";

async function main() {
  const startedAt = Date.now();
  const summary = await runResultCapture();
  console.log(JSON.stringify(summary, null, 2));
  const durationMs = Date.now() - startedAt;
  console.log(`::notice::Result capture: ${summary.results_captured} result(s) captured, ${summary.observations_resolved} observation(s) resolved (${summary.wins}W/${summary.losses}L), ${summary.matches_unresolved} match(es) still unresolved (durationMs=${durationMs})`);
}

main().catch((error) => {
  const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
  console.error(`::error::capture-match-results script crashed: ${message}`);
  process.exitCode = 1;
});
