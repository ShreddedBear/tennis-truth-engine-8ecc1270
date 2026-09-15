/**
 * Bounded CLI for the approved Aneeshers tennis-sackmann-archive importer.
 *
 * Sample:
 *   pnpm --filter @workspace/api-server run import:approved-sackmann -- --start-year 2024 --end-year 2024 --tour atp
 *
 * Full ranges require an explicit --full acknowledgement. The default two-year bound is a
 * deliberate guard against accidentally launching a multi-decade import from a shell.
 */
import { pool } from "@workspace/db";
import { runSackmannBackfill } from "../services/historicalData/sackmannBackfill";

function value(argv: string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const startYear = Number(value(argv, "--start-year"));
  const endYear = Number(value(argv, "--end-year"));
  const tour = value(argv, "--tour");
  const includeChallengerItf = !argv.includes("--main-draw-only");

  if (!Number.isInteger(startYear) || !Number.isInteger(endYear)) {
    throw new Error("Usage: --start-year YYYY --end-year YYYY [--tour atp|wta] [--main-draw-only] [--full]");
  }
  if (startYear > endYear) throw new Error("--start-year must not exceed --end-year");
  if (!argv.includes("--full") && endYear - startYear + 1 > 2) {
    throw new Error("Import is bounded to two years by default; pass --full for an explicitly approved full range.");
  }
  if (tour !== undefined && tour !== "atp" && tour !== "wta") {
    throw new Error("--tour must be atp or wta");
  }

  const yearly = [];
  for (let year = startYear; year <= endYear; year++) {
    const summary = await runSackmannBackfill({
      startYear: year,
      endYear: year,
      tours: tour ? [tour] : ["atp", "wta"],
      includeChallengerItf,
    });
    yearly.push({ year, ...summary });
    console.log(JSON.stringify({ completedYear: year, summary }, null, 2));
  }

  const totals = yearly.reduce(
    (sum, year) => ({
      discovered: sum.discovered + year.discovered,
      fixturesLoaded: sum.fixturesLoaded + year.fixturesLoaded,
      imported: sum.imported + year.backfill.matchesInserted,
      rejected: sum.rejected + year.rejected,
      quarantined: sum.quarantined + year.quarantined,
      duplicates: sum.duplicates + year.duplicates + year.backfill.matchesSkippedDuplicate,
      featureRowsInserted: sum.featureRowsInserted + year.backfill.featureRowsInserted,
    }),
    { discovered: 0, fixturesLoaded: 0, imported: 0, rejected: 0, quarantined: 0, duplicates: 0, featureRowsInserted: 0 },
  );
  console.log(JSON.stringify({ range: { startYear, endYear }, totals, yearly }, null, 2));
  await pool.end();
}

main().catch(async (error) => {
  console.error(error);
  await pool.end();
  process.exitCode = 1;
});