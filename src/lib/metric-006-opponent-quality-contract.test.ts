import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function hybridSource() {
  return readFileSync(join(process.cwd(), "src/lib/hybrid-audit-research.server.ts"), "utf8");
}

describe("metric 006 — Opponent Quality", () => {
  it("SUMMARY_KEYS[\"006\"] covers the four sourced named submetrics", () => {
    const source = hybridSource();
    const row = source.match(/"006":\s*\[([^\]]*)\]/)?.[1] ?? "";
    for (const covered of [
      "recent_opponent_avg_elo",
      "best_recent_win_opponent_elo",
      "bad_loss_rate_pct",
      "comparable_strength_win_pct",
      "performance_vs_comparable_strength_pct",
    ]) expect(row).toContain(covered);
  });

  it("documents the Performance Against Specific Archetypes gap in the live partialReason for family 006", () => {
    const source = hybridSource();
    expect(source).toMatch(/f==="006"&&\(xs\|\|ys\)\?"PARTIAL:[^"]*Performance Against Specific Archetypes/);
  });

  it("no longer cross-wires code 006's or code 007's keys into a SUMMARY_KEYS[\"080\"] entry (cross-wiring bug fixed this pass)", () => {
    const source = hybridSource();
    // The entire "080" SUMMARY_KEYS entry was removed -- assert it's gone, not just narrowed,
    // since nothing currently computes 080's own two named bullets (Common-Opponent Divergent
    // Outcome lives in a separate engine; Opponent-Caliber Performance Gap is SOURCE REQUIRED).
    expect(source).not.toMatch(/"080":\s*\[/);
    for (const forbidden of [
      "recent_opponent_avg_elo",
      "best_recent_win_opponent_elo",
      "bad_loss_rate_pct",
      "comparable_strength_win_pct",
      "performance_vs_comparable_strength_pct",
      "common_opponent_strength_weighted_win_pct",
      "common_opponent_recency_weighted_win_pct",
    ]) {
      const count = (source.match(new RegExp(`"${forbidden}"`, "g")) ?? []).length;
      // Each of these keys should appear in exactly one SUMMARY_KEYS row (006 or 007),
      // never a second time under a stray "080" entry.
      expect(count).toBeLessThanOrEqual(1);
    }
  });
});
