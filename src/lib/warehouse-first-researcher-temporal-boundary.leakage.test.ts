import { describe, expect, it } from "vitest";
import { asOfDate } from "./warehouse-first-researcher.server";

// PHASE 13.5 — a second, independent instance of the Phase 13 leak class.
//
// Phase 13 (docs/audit-truth-engine-phase13-anti-leakage.md) found and fixed CSV producers
// that fell back to "no filter" when the audited match carried no date. This is a DIFFERENT
// code path (the async tier chain in warehouse-first-researcher.server.ts, which 045's new
// producer and others route through) with a DIFFERENT failure mode: it fell back to
// TODAY'S WALL-CLOCK DATE, silently treating the audit as happening "now" and admitting
// every record up to the moment the code runs -- reachable whenever match.scheduled_date is
// null (1 of 55 live matches at the time of this fix).

describe("asOfDate never falls back to today's wall-clock date", () => {
  it("extracts the real date when the context carries one", () => {
    expect(asOfDate("tournament x · date 2024-05-02 · surface clay")).toBe("2024-05-02");
  });

  it("returns an empty string -- not today -- when the context carries no date", () => {
    const result = asOfDate("tournament x · surface clay");
    expect(result).toBe("");
    expect(result).not.toBe(new Date().toISOString().slice(0, 10));
  });

  it("returns an empty string for null/undefined context, never a guessed date", () => {
    expect(asOfDate(null)).toBe("");
    expect(asOfDate(undefined)).toBe("");
    expect(asOfDate("")).toBe("");
  });

  it("an empty-string cutoff fails every strict date comparison a caller might use", () => {
    // Every consumer of this value filters with `row.date < asOfDate` or a Postgres
    // `.lte("as_of_date", asOfDate)`. An empty string must lose every such comparison
    // against a real "YYYY-MM-DD" row, so "no boundary" reads as "no evidence admitted".
    const cutoff = asOfDate("no date here");
    expect("2016-01-01" < cutoff).toBe(false);
    expect("2099-12-31" < cutoff).toBe(false);
  });
});
