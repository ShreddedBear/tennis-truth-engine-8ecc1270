import { C as customType } from "../_libs/drizzle-orm.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/columns-DdiGZMmP.js
/**
* Postgres' wire format is "2026-09-12 11:10:36.335765+00": a space separator and a
* two-digit offset, neither of which is valid ISO-8601 -- V8's Date parser rejects the bare
* "+00" outright. Both are normalised before parsing.
*/
function toIsoTimestamp(value) {
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
var isoTimestamp = customType({
	dataType() {
		return "timestamp with time zone";
	},
	fromDriver(value) {
		return toIsoTimestamp(value);
	},
	toDriver(value) {
		return value;
	}
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
var calendarDate = customType({
	dataType() {
		return "date";
	},
	fromDriver(value) {
		return value;
	},
	toDriver(value) {
		return value;
	}
});
//#endregion
export { isoTimestamp as n, calendarDate as t };
