import { describe, expect, it, vi } from "vitest";

// Bug fix regression fixture: both TennisData.app-sourced lanes (WTA_CHALLENGER's
// validated WTA 125 production history, and WTA_MAIN's WTA Tour production history)
// identify every player -- both a bucket's own key and every opponent referenced inside
// it -- as "Surname InitialOfFirstName" (e.g. "Heisen V.", "Haddad Maia B." for compound
// surnames), not the full name used everywhere else in the app. Before the fix, a
// full-name lookup for a real, already-ingested player in either lane returned nothing at
// all. Confirmed against the real committed data/generated/tennis-runtime-index.json
// (WTA_CHALLENGER: Victoria Heisen vs Lisa Kung, Saint Malo Chall. Women - Qualification,
// 2021-05-02; WTA_MAIN: Beatriz Haddad Maia, a real compound-surname player, resolves and
// produces real credited evidence across multiple Task 18A codes) before writing this
// fixture-based test.
vi.mock("./runtime-tennis-index-data.server", () => ({
  loadRuntimeIndex: () => ({
    generatedAt: "2026-01-01T00:00:00Z",
    ATP: {}, WTA: {},
    matchHistory: {
      ATP_MAIN: {
        "john smith": [["2026-01-01", "Fixture Open", "Hard", "Alex Jones", 1, "R32", "atp", null]],
      },
      WTA_MAIN: {
        "haddad maia b": [["2026-01-01", "Fixture Open", "Hard", "Kostyuk M.", 1, "R32", "TennisData.app WTA Tour production history", null]],
      },
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

  it("bug fix: resolves a WTA_MAIN player with a compound surname via the fallback (tries 'everything but the first token' before 'just the last token')", () => {
    expect(repositoryHistoryAvailable("Beatriz Haddad Maia", "WTA_MAIN")).toBe(true);
    const rows = repositoryResultsRows("Beatriz Haddad Maia", "WTA_MAIN", "2026-06-01");
    expect(rows).toHaveLength(1);
    expect(rows[0].opponent_name).toBe("Kostyuk M.");
    expect(rows[0].player_name).toBe("Beatriz Haddad Maia");
  });

  it("does not apply the surname+initial fallback outside the two TennisData.app lanes (no spurious cross-family matches)", () => {
    expect(repositoryHistoryAvailable("Victoria Heisen", "ATP_MAIN")).toBe(false);
    expect(repositoryHistoryAvailable("Victoria Heisen", "ATP_CHALLENGER")).toBe(false);
    expect(repositoryHistoryAvailable("Beatriz Haddad Maia", "ATP_MAIN")).toBe(false);
    expect(repositoryHistoryAvailable("Beatriz Haddad Maia", "ATP_CHALLENGER")).toBe(false);
  });

  it("fails closed for a single-token (surname-only) query -- no fallback key can be mechanically derived", () => {
    expect(repositoryHistoryAvailable("Heisen", "WTA_CHALLENGER")).toBe(false);
    expect(repositoryHistoryAvailable("Maia", "WTA_MAIN")).toBe(false);
  });

  it("fails closed when neither the direct nor any fallback key exists in the data", () => {
    expect(repositoryHistoryAvailable("Nobody Real", "WTA_CHALLENGER")).toBe(false);
    expect(repositoryResultsRows("Nobody Real", "WTA_CHALLENGER", "2026-06-01")).toEqual([]);
    expect(repositoryHistoryAvailable("Nobody Real Either", "WTA_MAIN")).toBe(false);
  });

  it("still fails closed when the direct key exists but the fallback would have (mechanically) been wrong -- direct match always wins", () => {
    // If a player's own full name happens to already be exactly two tokens ("First
    // Last"), the direct normalized-key lookup takes priority; the fallback path is only
    // ever reached when the direct key lookup returns nothing.
    const rows = repositoryResultsRows("John Smith", "ATP_MAIN", "2026-06-01");
    expect(rows[0].opponent_name).toBe("Alex Jones");
  });
});
