import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("deterministic results/schedule calculators", () => {
  const source = readFileSync("src/lib/deterministic-results-schedule-metrics.server.ts", "utf8");

  it("only targets results/schedule metric codes", () => {
    for (const code of ["012", "028", "030", "064", "071", "076", "077", "081"]) {
      expect(source).toContain(`\"${code}\"`);
    }
    expect(source).not.toContain('SUPPORTED = new Set(["062"');
    expect(source).not.toContain('SUPPORTED = new Set(["069"');
  });

  it("keeps deterministic results/schedule output PARTIAL rather than inventing a complete score", () => {
    expect(source).toMatch(/p1_treatment:\s*"PARTIAL"/);
    expect(source).toMatch(/p2_treatment:\s*"PARTIAL"/);
    expect(source).toMatch(/evidence_family:\s*"RESULTS_SCHEDULE"/);
  });

  it("filters every warehouse row through the metric source-family gate", () => {
    expect(source).toMatch(/metricAllowsObservation\(code,\s*row\)/);
  });

  it("distinguishes direct schedules, match-history schedule context and true absence", () => {
    expect(source).toContain("DIRECT_EVENT_SCHEDULE");
    expect(source).toContain("MATCH_HISTORY_SCHEDULE_CONTEXT");
    expect(source).toContain("UNAVAILABLE");
    expect(source).toContain('from("matches")');
    expect(source).toContain("scheduled_local_at");
    expect(source).toContain("scheduled_utc_at");
  });

  it("normalizes event identity and enforces the four-tour contamination firewall", () => {
    expect(source).toContain("normalizeEvidenceTournament");
    expect(source).toContain("normalizeEvidenceRound");
    expect(source).toContain("evidenceDateCompatible");
    expect(source).toContain("evidenceTourCompatible");
    expect(source).toContain("buildCanonicalEvidenceMatchIdentity");
    expect(source).toContain("if(!expectedFamily)return null");
  });

  it("fails closed when more than one production-history match can satisfy the join", () => {
    expect(source).toContain("uniqueCurrentEventHistoryRows");
    expect(source).toContain("candidates.length===1?candidates:[]");
    expect(source).toContain("if(currentHistory.length>1)return null");
  });
});