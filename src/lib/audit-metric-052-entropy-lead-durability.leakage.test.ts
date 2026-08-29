import { describe, expect, it } from "vitest";
import { computeEntropyLeadDurability } from "./audit-metric-052-entropy-lead-durability";

// zdenek kolar's most recent ATP_CHALLENGER match with usable set_scores in
// the real generated index is dated 2026-08-03 (confirmed by directly
// inspecting data/generated/tennis-runtime-index.json, not assumed).
describe("metric #052 leakage safety (real generated index date-boundary check)", () => {
  const PLAYER = "zdenek kolar";
  const LANE = "ATP_CHALLENGER" as const;
  const LAST_MATCH_DATE = "2026-08-03";

  it("excludes a match dated exactly on asOfDate (strictly-before semantics)", () => {
    const onDate = computeEntropyLeadDurability({ player: PLAYER, lane: LANE, asOfDate: LAST_MATCH_DATE });
    const dayAfter = computeEntropyLeadDurability({ player: PLAYER, lane: LANE, asOfDate: "2026-08-04" });
    expect(onDate.status).toBe("GO");
    expect(dayAfter.status).toBe("GO");
    if (onDate.status !== "GO" || dayAfter.status !== "GO") return;
    // The match on LAST_MATCH_DATE itself must not be counted when asOfDate
    // equals that same date -- it only appears once asOfDate moves past it.
    expect(dayAfter.n).toBeGreaterThan(onDate.n);
  });
});
