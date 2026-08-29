import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { RAPID_RANK_MOVE_THRESHOLD, rapidStatus } from "./deterministic-ranking-metrics.server";

function calcSource() {
  return readFileSync(join(process.cwd(), "src/lib/deterministic-ranking-metrics.server.ts"), "utf8");
}

describe("metric 014 — Ranking Context", () => {
  it("classifies Rapid Riser/Faller Status at and around the documented threshold", () => {
    expect(rapidStatus(null)).toBeNull();
    expect(rapidStatus(0)).toBe("STABLE");
    expect(rapidStatus(RAPID_RANK_MOVE_THRESHOLD - 1)).toBe("STABLE");
    expect(rapidStatus(-(RAPID_RANK_MOVE_THRESHOLD - 1))).toBe("STABLE");
    // Negative rank_change_30d means the rank number dropped (improved) -- a riser.
    expect(rapidStatus(-RAPID_RANK_MOVE_THRESHOLD)).toBe("RAPID_RISER");
    expect(rapidStatus(-RAPID_RANK_MOVE_THRESHOLD - 50)).toBe("RAPID_RISER");
    // Positive rank_change_30d means the rank number rose (worse) -- a faller.
    expect(rapidStatus(RAPID_RANK_MOVE_THRESHOLD)).toBe("RAPID_FALLER");
    expect(rapidStatus(RAPID_RANK_MOVE_THRESHOLD + 50)).toBe("RAPID_FALLER");
  });

  it("reports PARTIAL treatment (not DIRECT) with the Ranking-Performance Disconnect gap named", () => {
    const source = calcSource();
    expect(source).toContain('p1_treatment: "PARTIAL"');
    expect(source).toContain('p2_treatment: "PARTIAL"');
    expect(source).toMatch(/unavailable_reason: "[^"]*Ranking-Performance Disconnect/);
  });

  it("still surfaces rank_change_30d/90d and rapid_status in the value text", () => {
    const source = calcSource();
    expect(source).toContain("rank_change_30d=${summary.rank_change_30d");
    expect(source).toContain("rank_change_90d=${summary.rank_change_90d");
    expect(source).toContain("rapid_status=${summary.rapid_status");
  });
});
