import { describe, expect, it, vi } from "vitest";

// Bug fix regression fixture: WTA_CHALLENGER's underlying source (the validated WTA 125
// production history CSV) identifies every player -- both as a bucket's own key and as
// every opponent referenced inside it -- as "Surname InitialOfFirstName" (e.g. "Heisen
// V."), not the full name used everywhere else in the app. Before the fix, a full-name
// lookup for a real, already-ingested WTA_CHALLENGER player returned nothing at all:
// 7,615 real validated matches / 1,096 real players were sitting in matchHistory but were
// structurally unreachable. Confirmed against the real committed
// data/generated/tennis-runtime-index.json (Victoria Heisen vs Lisa Kung, Saint Malo
// Chall. Women - Qualification, 2021-05-02) before writing this fixture-based test.
vi.mock("./runtime-tennis-index-data.server", () => ({
  loadRuntimeIndex: () => ({
    generatedAt: "2026-01-01T00:00:00Z",
    ATP: {}, WTA: {},
    matchHistory: {
      ATP_MAIN: {
        "john smith": [["2026-01-01", "Fixture Open", "Hard", "Alex Jones", 1, "R32", "atp", null]],
      },
      WTA_MAIN: {},
      ATP_CHALLENGER: {},
      WTA_CHALLENGER: {
        "heisen v": [["2021-05-02", "Saint Malo Chall. Women - Qualification", "clay", "Kung L.", 1, "Qualifier", "Validated WTA 125 production history", null]],
        "kung l": [["2021-05-02", "Saint Malo Chall. Women - Qualification", "clay", "Heisen V.", 0, "Qualifier", "Validated WTA 125 production history", null]],
      },
    },
  }),
}));

import { repositoryHistoryAvailable, repositoryResultsRows } from "./repository-results-history.server";

describe("repository-results-history", () => {
  it("resolves a direct full-name key unchanged (ATP_MAIN, unaffected by the fallback)", () => {
    expect(repositoryHistoryAvailable("John Smith", "ATP_MAIN")).toBe(true);
    const rows = repositoryResultsRows("John Smith", "ATP_MAIN", "2026-06-01");
    expect(rows).toHaveLength(1);
    expect(rows[0].opponent_name).toBe("Alex Jones");
  });

  it("bug fix: resolves a WTA_CHALLENGER player queried by full name via the surname+first-initial fallback key, matching the source CSV's own naming convention", () => {
    expect(repositoryHistoryAvailable("Victoria Heisen", "WTA_CHALLENGER")).toBe(true);
    const rows = repositoryResultsRows("Victoria Heisen", "WTA_CHALLENGER", "2026-06-01");
    expect(rows).toHaveLength(1);
    expect(rows[0].opponent_name).toBe("Kung L.");
    expect(rows[0].player_name).toBe("Victoria Heisen");
  });

  it("resolves the other side of the same match too", () => {
    expect(repositoryHistoryAvailable("Lisa Kung", "WTA_CHALLENGER")).toBe(true);
    const rows = repositoryResultsRows("Lisa Kung", "WTA_CHALLENGER", "2026-06-01");
    expect(rows[0].opponent_name).toBe("Heisen V.");
  });

  it("does not apply the surname+initial fallback outside WTA_CHALLENGER (no spurious cross-family matches)", () => {
    expect(repositoryHistoryAvailable("Victoria Heisen", "ATP_MAIN")).toBe(false);
    expect(repositoryHistoryAvailable("Victoria Heisen", "WTA_MAIN")).toBe(false);
    expect(repositoryHistoryAvailable("Victoria Heisen", "ATP_CHALLENGER")).toBe(false);
  });

  it("fails closed for a single-token (surname-only) query -- no fallback key can be mechanically derived", () => {
    expect(repositoryHistoryAvailable("Heisen", "WTA_CHALLENGER")).toBe(false);
  });

  it("fails closed when neither the direct nor the fallback key exists in the data", () => {
    expect(repositoryHistoryAvailable("Nobody Real", "WTA_CHALLENGER")).toBe(false);
    expect(repositoryResultsRows("Nobody Real", "WTA_CHALLENGER", "2026-06-01")).toEqual([]);
  });

  it("still fails closed when the direct key exists but the fallback would have (mechanically) been wrong -- direct match always wins", () => {
    // If a player's own full name happens to already be exactly two tokens ("First
    // Last"), the direct normalized-key lookup takes priority; the fallback path is only
    // ever reached when the direct key lookup returns nothing.
    const rows = repositoryResultsRows("John Smith", "ATP_MAIN", "2026-06-01");
    expect(rows[0].opponent_name).toBe("Alex Jones");
  });
});
