import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { checkPaperTradeEligibility, PAPER_TRADE_DECISION_LEAD_MINUTES, type EligibilityFixtureInput } from "./eligibility.js";

const NOW = new Date("2026-09-23T12:00:00Z");

function baseFixture(overrides: Partial<EligibilityFixtureInput> = {}): EligibilityFixtureInput {
  return {
    externalFixtureId: "lta-12345",
    player1Id: "p1", player1Name: "Player One",
    player2Id: "p2", player2Name: "Player Two",
    drawType: "singles",
    scheduledStart: new Date(NOW.getTime() + 2 * 60 * 60_000), // 2h from now
    timeConfirmed: true,
    ...overrides,
  };
}

function check(fixture: EligibilityFixtureInput, overrides: Partial<Parameters<typeof checkPaperTradeEligibility>[0]> = {}) {
  return checkPaperTradeEligibility({
    fixture, now: NOW, duplicateExists: false, providerReachable: true, ...overrides,
  });
}

describe("checkPaperTradeEligibility", () => {
  it("eligible: well-formed singles fixture, 2h out, no duplicate, provider reachable", () => {
    const result = check(baseFixture());
    assert.strictEqual(result.eligible, true);
    if (result.eligible) {
      const expectedCutoff = new Date(baseFixture().scheduledStart!.getTime() - PAPER_TRADE_DECISION_LEAD_MINUTES * 60_000);
      assert.strictEqual(result.decisionCutoffAt.getTime(), expectedCutoff.getTime());
    }
  });

  it("PROVIDER_UNAVAILABLE takes priority even over an otherwise-perfect fixture", () => {
    const result = check(baseFixture(), { providerReachable: false });
    assert.deepStrictEqual(result, { eligible: false, reason: "PROVIDER_UNAVAILABLE", detail: result.eligible ? "" : result.detail });
    assert.strictEqual(result.eligible, false);
  });

  it("UNSUPPORTED_EVENT_TYPE for a doubles draw", () => {
    const result = check(baseFixture({ drawType: "doubles" }));
    assert.strictEqual(result.eligible, false);
    if (!result.eligible) assert.strictEqual(result.reason, "UNSUPPORTED_EVENT_TYPE");
  });

  it("SCHEDULED_TIME_MISSING when timeConfirmed is false", () => {
    const result = check(baseFixture({ timeConfirmed: false }));
    assert.strictEqual(result.eligible, false);
    if (!result.eligible) assert.strictEqual(result.reason, "SCHEDULED_TIME_MISSING");
  });

  it("SCHEDULED_TIME_MISSING when scheduledStart is null", () => {
    const result = check(baseFixture({ scheduledStart: null }));
    assert.strictEqual(result.eligible, false);
    if (!result.eligible) assert.strictEqual(result.reason, "SCHEDULED_TIME_MISSING");
  });

  it("MATCH_ALREADY_STARTED when scheduledStart is now or in the past", () => {
    const result = check(baseFixture({ scheduledStart: new Date(NOW.getTime() - 1) }));
    assert.strictEqual(result.eligible, false);
    if (!result.eligible) assert.strictEqual(result.reason, "MATCH_ALREADY_STARTED");
  });

  it("MATCH_ALREADY_STARTED exactly at the boundary (scheduledStart === now)", () => {
    const result = check(baseFixture({ scheduledStart: new Date(NOW.getTime()) }));
    assert.strictEqual(result.eligible, false);
    if (!result.eligible) assert.strictEqual(result.reason, "MATCH_ALREADY_STARTED");
  });

  it("PLAYER_IDENTITY_UNRESOLVED when a player id is null", () => {
    const result = check(baseFixture({ player2Id: null }));
    assert.strictEqual(result.eligible, false);
    if (!result.eligible) assert.strictEqual(result.reason, "PLAYER_IDENTITY_UNRESOLVED");
  });

  it("PLAYER_IDENTITY_UNRESOLVED when a player name is null", () => {
    const result = check(baseFixture({ player1Name: null }));
    assert.strictEqual(result.eligible, false);
    if (!result.eligible) assert.strictEqual(result.reason, "PLAYER_IDENTITY_UNRESOLVED");
  });

  it("PLAYER_IDENTITY_UNRESOLVED when both players share the same id (corrupt fixture)", () => {
    const result = check(baseFixture({ player2Id: "p1" }));
    assert.strictEqual(result.eligible, false);
    if (!result.eligible) assert.strictEqual(result.reason, "PLAYER_IDENTITY_UNRESOLVED");
  });

  it("1: DUPLICATE_FIXTURE when a trade already exists and the match has NOT started", () => {
    const result = check(baseFixture(), { duplicateExists: true });
    assert.strictEqual(result.eligible, false);
    if (!result.eligible) assert.strictEqual(result.reason, "DUPLICATE_FIXTURE");
  });

  // Regression test for a real recurring-production bug: a fixture already decided in an
  // earlier cycle, whose scheduled start has since passed, must NEVER be reclassified as a
  // new MATCH_ALREADY_STARTED fixture and sent back through persistence -- that previously
  // collided with parlay_paper_trades_fixture_side_lineage_idx (23505) on every subsequent
  // cycle, confirmed live for fixtures 35880/35816/36169/36206.
  it("2: DUPLICATE_FIXTURE takes priority over MATCH_ALREADY_STARTED -- an already-persisted fixture that has since started must never be reclassified as a new started fixture", () => {
    const result = check(baseFixture({ scheduledStart: new Date(NOW.getTime() - 1) }), { duplicateExists: true });
    assert.strictEqual(result.eligible, false);
    if (!result.eligible) assert.strictEqual(result.reason, "DUPLICATE_FIXTURE");
  });

  it("3: a genuinely NEW (never-before-seen) fixture that has already started is unaffected -- still MATCH_ALREADY_STARTED, not silently treated as a duplicate", () => {
    const result = check(baseFixture({ scheduledStart: new Date(NOW.getTime() - 1) }), { duplicateExists: false });
    assert.strictEqual(result.eligible, false);
    if (!result.eligible) assert.strictEqual(result.reason, "MATCH_ALREADY_STARTED");
  });

  it("4: normal eligibility for a genuinely new, valid upcoming fixture is unchanged", () => {
    const result = check(baseFixture(), { duplicateExists: false });
    assert.strictEqual(result.eligible, true);
  });

  it("INSUFFICIENT_PIT_EVIDENCE when the decision lead window has already elapsed", () => {
    // Fixture starts in 10 minutes but the decision window wants 30 minutes' lead.
    const result = check(baseFixture({ scheduledStart: new Date(NOW.getTime() + 10 * 60_000) }));
    assert.strictEqual(result.eligible, false);
    if (!result.eligible) assert.strictEqual(result.reason, "INSUFFICIENT_PIT_EVIDENCE");
  });

  it("eligible right at the edge of the lead window (just over 30 minutes out)", () => {
    const result = check(baseFixture({ scheduledStart: new Date(NOW.getTime() + 31 * 60_000) }));
    assert.strictEqual(result.eligible, true);
  });

  it("decisionCutoffAt is always strictly before scheduledStartAt (PIT invariant)", () => {
    const fixture = baseFixture();
    const result = check(fixture);
    assert.strictEqual(result.eligible, true);
    if (result.eligible) {
      assert.ok(result.decisionCutoffAt.getTime() < fixture.scheduledStart!.getTime());
    }
  });

  it("custom decisionLeadMinutes is honored", () => {
    const fixture = baseFixture({ scheduledStart: new Date(NOW.getTime() + 5 * 60_000) });
    const result = check(fixture, { decisionLeadMinutes: 2 });
    assert.strictEqual(result.eligible, true);
    if (result.eligible) {
      assert.strictEqual(result.decisionCutoffAt.getTime(), fixture.scheduledStart!.getTime() - 2 * 60_000);
    }
  });
});
