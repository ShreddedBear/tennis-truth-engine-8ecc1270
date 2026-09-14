import { getTableColumns } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { auditCoverageTable, auditRunsTable, matchesTable } from "./schema";

// PARITY GUARD — row shapes must match what PostgREST returned.
//
// An earlier version of this file asserted on pg.types.getTypeParser, which looked right
// and proved nothing: drizzle-orm's node-postgres session overrides the driver's parsers
// for TIMESTAMPTZ, TIMESTAMP and DATE to the identity function, so a global parser is
// bypassed by every query Drizzle issues. The test passed while the application received
// "2026-09-12 11:10:36.335765+00".
//
// So these tests go through the COLUMN's own mapFromDriverValue -- the function that
// actually runs on every row Drizzle returns -- with the exact strings Postgres puts on
// the wire.

const mapOf = (column: unknown) => (value: string): string | number =>
  (column as { mapFromDriverValue(v: string): string | number }).mapFromDriverValue(value);

const createdAt = mapOf(getTableColumns(matchesTable).created_at);
const scheduledDate = mapOf(getTableColumns(matchesTable).scheduled_date);
const coveragePercent = mapOf(getTableColumns(auditCoverageTable).usable_coverage_percent);

describe("timestamps arrive as ISO strings, not Date objects or raw Postgres text", () => {
  it("normalises Postgres' wire format to ISO-8601 UTC", () => {
    // Space separator and a two-digit offset: neither is valid ISO-8601, and V8's Date
    // parser rejects the bare "+00" outright.
    expect(createdAt("2026-09-12 11:10:36.335765+00")).toBe("2026-09-12T11:10:36.335Z");
  });

  it("returns a string, never a Date", () => {
    const value = createdAt("2026-09-12 11:10:36.335765+00");
    expect(typeof value).toBe("string");
    expect(value).not.toBeInstanceOf(Date);
  });

  it("converts a non-UTC offset rather than keeping the local wall clock", () => {
    expect(createdAt("2026-09-12 13:10:36.335+02")).toBe("2026-09-12T11:10:36.335Z");
  });

  it("produces strings that sort chronologically", () => {
    // audit_runs, execution_logs and source_observations are all ordered by timestamp
    // columns; a format that sorts differently from its chronology reorders the UI.
    expect(createdAt("2026-09-12 09:00:00+00") < createdAt("2026-09-12 10:00:00+00")).toBe(true);
  });

  it("hands back anything unparseable untouched instead of Invalid Date", () => {
    expect(createdAt("not a timestamp")).toBe("not a timestamp");
  });

  it("applies to every timestamp column, not just the ones spot-checked here", () => {
    for (const column of Object.values(getTableColumns(auditRunsTable))) {
      if (column.getSQLType() !== "timestamp with time zone") continue;
      expect(mapOf(column)("2026-09-12 11:10:36.335765+00"), column.name).toBe("2026-09-12T11:10:36.335Z");
    }
  });
});

describe("dates stay calendar dates", () => {
  it("returns the literal YYYY-MM-DD, not a Date at midnight", () => {
    // Not cosmetic: scheduled_date and as_of_date decide what counts as pre-match evidence.
    // A Date built at local midnight is the previous day for any reader west of UTC, which
    // moves evidence across the pre-match boundary in the direction that admits post-match
    // information.
    const value = scheduledDate("2026-09-12");
    expect(value).toBe("2026-09-12");
    expect(value).not.toBeInstanceOf(Date);
  });
});

describe("numeric arrives as a number, as PostgREST delivered it", () => {
  it("maps the driver's string to a number", () => {
    expect(coveragePercent("59.9")).toBe(59.9);
  });

  it("keeps threshold comparisons arithmetic rather than string concatenation", () => {
    // The failure this guards: with a string, `value + 1` concatenates and .toFixed()
    // throws. Both appear on the coverage and completion surfaces, and several numeric
    // columns are compared straight against the Truth Engine's thresholds.
    const value = coveragePercent("60") as number;
    expect(value + 1).toBe(61);
    expect(value.toFixed(1)).toBe("60.0");
  });
});
