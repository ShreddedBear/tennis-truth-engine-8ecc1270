import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { fetchEspnFixturesRange } from "./espnScoreboardProvider.js";

describe("ESPN tennis scoreboard fallback", () => {
  it("maps real singles competitions into provider-agnostic fixtures", async () => {
    const fixtures = await fetchEspnFixturesRange("2026-09-20", "2026-09-26");
    assert.ok(fixtures.length > 0);
    assert.ok(fixtures.every((fixture) => fixture.id.startsWith("espn-")));
    assert.ok(fixtures.every((fixture) => fixture.player1Name && fixture.player2Name));
    assert.ok(fixtures.every((fixture) => fixture.date >= "2026-09-20" && fixture.date <= "2026-09-26"));
  });
});