// Custom column types that keep row shapes identical to what PostgREST returned.
//
// WHY THIS EXISTS, AND WHY A DRIVER-LEVEL TYPE PARSER IS NOT ENOUGH.
//
// node-postgres lets you register global type parsers, and setting one for TIMESTAMPTZ
// looks like it solves this. It does not: drizzle-orm's node-postgres session overrides
// getTypeParser for TIMESTAMPTZ, TIMESTAMP, DATE, INTERVAL and their array forms to the
// identity function, on purpose, so that each column's own mapFromDriverValue decides the
// shape. A global parser therefore applies to a raw pool.query() and is bypassed by every
// query Drizzle issues -- which is to say, by all of them.
//
// That was worth discovering the hard way: a test asserting on pg.types.getTypeParser
// passes while the application still receives "2026-09-12 11:10:36.335765+00". The
// conversion has to happen in the column.
import { customType } from "drizzle-orm/pg-core";

/**
 * Postgres' wire format is "2026-09-12 11:10:36.335765+00": a space separator and a
 * two-digit offset, neither of which is valid ISO-8601 -- V8's Date parser rejects the bare
 * "+00" outright. Both are normalised before parsing.
 */
export function toIsoTimestamp(value: string): string {
  const isoish = value.replace(" ", "T").replace(/([+-]\d{2})$/u, "$1:00");
  const parsed = new Date(isoish);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
}

/**
 * `timestamptz` as an ISO-8601 UTC string, which is what PostgREST returned and what ~200
 * call sites in this application read, sort and render.
 *
 * Milliseconds, not microseconds: Postgres stores microsecond precision and toISOString()
 * truncates. Every value is both written and read through here, and the writers already
 * produce millisecond ISO strings via new Date().toISOString(), so it stays self-consistent.
 */
export const isoTimestamp = customType<{ data: string; driverData: string }>({
  dataType() {
    return "timestamp with time zone";
  },
  fromDriver(value: string): string {
    return toIsoTimestamp(value);
  },
  toDriver(value: string): string {
    return value;
  },
});

/**
 * `date` as a plain "YYYY-MM-DD" string.
 *
 * Drizzle's own date column in string mode already does this, so this exists for symmetry
 * and, more importantly, to pin the behaviour: scheduled_date and as_of_date decide what
 * counts as pre-match evidence, and a value that becomes a Date at local midnight is the
 * previous day for any reader west of UTC -- which would move evidence across the pre-match
 * boundary in the direction that admits post-match information.
 */
export const calendarDate = customType<{ data: string; driverData: string }>({
  dataType() {
    return "date";
  },
  fromDriver(value: string): string {
    return value;
  },
  toDriver(value: string): string {
    return value;
  },
});
