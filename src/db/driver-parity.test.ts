import pg from "pg";
import { describe, expect, it } from "vitest";

// Importing the client installs the driver type parsers. It must not open a connection --
// the pool is lazy -- so this import is safe with no DATABASE_URL set, and that is itself
// worth asserting.
import "./client.server";

// PARITY GUARD -- node-postgres and PostgREST disagree about three column types, and each
// disagreement silently changes a row shape that ~200 call sites read as a string.
// client.server.ts overrides the parsers; these tests are what stop that being undone.

const TIMESTAMPTZ_OID = 1184;
const TIMESTAMP_OID = 1114;
const DATE_OID = 1082;

const parse = (oid: number, raw: string) => pg.types.getTypeParser(oid)(raw) as unknown;

describe("timestamp columns arrive as ISO strings, not Date objects", () => {
  it.each([TIMESTAMPTZ_OID, TIMESTAMP_OID])("oid %i returns a string", (oid) => {
    const value = parse(oid, "2026-09-11 10:49:22.123+00");
    expect(typeof value).toBe("string");
    expect(value).not.toBeInstanceOf(Date);
  });

  it("normalises Postgres' space-separated form to ISO-8601 UTC", () => {
    expect(parse(TIMESTAMPTZ_OID, "2026-09-11 10:49:22.123+00")).toBe("2026-09-11T10:49:22.123Z");
  });

  it("converts a non-UTC offset to UTC rather than keeping the local wall clock", () => {
    expect(parse(TIMESTAMPTZ_OID, "2026-09-11 12:49:22.123+02")).toBe("2026-09-11T10:49:22.123Z");
  });

  it("produces strings that sort chronologically", () => {
    // audit_runs, execution_logs and source_observations are all ordered by timestamp
    // columns. A format that sorts differently from its chronology would reorder the UI.
    const earlier = parse(TIMESTAMPTZ_OID, "2026-09-11 09:00:00+00") as string;
    const later = parse(TIMESTAMPTZ_OID, "2026-09-11 10:00:00+00") as string;
    expect(earlier < later).toBe(true);
  });

  it("hands back anything unparseable untouched instead of returning Invalid Date", () => {
    expect(parse(TIMESTAMPTZ_OID, "not a timestamp")).toBe("not a timestamp");
  });
});

describe("date columns stay calendar dates", () => {
  it("returns the literal YYYY-MM-DD, not a Date at UTC midnight", () => {
    // This one is not cosmetic. scheduled_date and as_of_date decide what counts as
    // pre-match evidence. node-postgres' default parser builds a Date at local midnight,
    // so any reader west of UTC would see the previous day and evidence would cross the
    // pre-match boundary.
    const value = parse(DATE_OID, "2026-09-11");
    expect(value).toBe("2026-09-11");
    expect(value).not.toBeInstanceOf(Date);
  });
});

describe("numeric and bigint keep their string form", () => {
  it("does not coerce numeric to a float", () => {
    // Left at the driver default deliberately: PostgREST also returned these as strings,
    // and coercing loses precision.
    expect(typeof parse(1700, "1234.5678")).toBe("string");
  });
});
