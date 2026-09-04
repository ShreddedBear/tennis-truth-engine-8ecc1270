// Report the calibration population governance numbers against the live database.
//   npx tsx scripts/report-calibration-population.ts
import { buildCalibrationPopulationReport } from "../src/lib/calibration-population.server";

buildCalibrationPopulationReport()
  .then((report) => { console.log(JSON.stringify(report, null, 2)); })
  .catch((error) => { console.error(error); process.exit(1); });
