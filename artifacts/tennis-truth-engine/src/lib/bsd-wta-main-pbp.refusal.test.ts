import { describe, expect, it } from "vitest";
import { buildBsdWtaMainPbpContext } from "./bsd-wta-main-pbp.server";

describe("WTA Main historical PBP admission", () => {
  it("refuses unavailable approved-index records instead of fabricating evidence", async () => {
    const result = await buildBsdWtaMainPbpContext({
      metrics: [{ code: "016", name: "first-serve points won" }],
      p1: "Player One",
      p2: "Player Two",
      asOfDate: "2025-01-02",
      context: "Tournament: Example | Level: WTA MAIN | Tour: WTA MAIN | Date: 2025-01-02",
    });

    expect(result.packet).toEqual({});
    expect(result.status.eligible).toBe(true);
    expect(result.status.matches_used).toBe(0);
    expect(result.status.reason).toMatch(/No matching approved WTA Main PBP/);
  });
});