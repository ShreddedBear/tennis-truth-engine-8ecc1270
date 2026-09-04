// Run the real-result capture + resolution pass against the live database.
//   npx tsx scripts/capture-match-results.ts
import { runResultCapture } from "../src/lib/match-result-capture.server";

runResultCapture()
  .then((summary) => { console.log(JSON.stringify(summary, null, 2)); })
  .catch((error) => { console.error(error); process.exit(1); });
