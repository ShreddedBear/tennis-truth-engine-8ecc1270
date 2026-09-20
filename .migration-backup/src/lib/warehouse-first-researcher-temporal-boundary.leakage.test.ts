import { describe, expect, it } from "vitest";
import { asOfDate, auditBoundary } from "./warehouse-first-researcher.server";

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

// PHASE 14 — the boundary is now passed as TYPED DATA, not recovered from prose.
//
// Both prior leaks (Phase 13's "no date means no filter", Phase 13.5's "no date means
// today") share one root cause: the audited match's date was re-derived downstream by
// regex-scanning a rendered context string, so a parse miss was indistinguishable from a
// genuinely absent date and each call site invented its own interpretation. The pipeline
// now passes `matches.scheduled_date` explicitly (audit-pipeline.ts's executeMetrics), and
// auditBoundary() prefers it. The regex remains only as a fallback for callers that predate
// the field -- it is no longer the production path's source of truth.
describe("Phase 14 — the typed audit date is authoritative", () => {
  it("uses the typed scheduled_date, not the context string", () => {
    expect(auditBoundary({ auditDate: "2024-05-02", context: "tournament x · surface clay" })).toBe("2024-05-02");
  });

  it("the typed date wins even when the context disagrees -- one source of truth", () => {
    // A context string can carry an unrelated date token (a tournament name containing a
    // year-like string, a round label). The match's own typed date is definitive.
    expect(auditBoundary({ auditDate: "2024-05-02", context: "tournament x · date 2099-12-31 · surface clay" })).toBe("2024-05-02");
  });

  it("falls back to the context only when no typed date was supplied", () => {
    expect(auditBoundary({ context: "tournament x · date 2024-05-02 · surface clay" })).toBe("2024-05-02");
    expect(auditBoundary({ auditDate: null, context: "tournament x · date 2024-05-02 · surface clay" })).toBe("2024-05-02");
  });

  it("a null scheduled_date with no context date admits nothing -- never today", () => {
    const result = auditBoundary({ auditDate: null, context: "tournament x · surface clay" });
    expect(result).toBe("");
    expect(result).not.toBe(new Date().toISOString().slice(0, 10));
  });

  it("rejects a malformed typed date rather than passing it through as a boundary", () => {
    // A non-ISO value must not become the cutoff string: it would compare unpredictably
    // against real "YYYY-MM-DD" rows. It falls through to the context, then to "".
    expect(auditBoundary({ auditDate: "not-a-date", context: "no date here" })).toBe("");
    expect(auditBoundary({ auditDate: "2024-5-2", context: "no date here" })).toBe("");
    expect(auditBoundary({ auditDate: "not-a-date", context: "date 2024-05-02" })).toBe("2024-05-02");
  });
});
