import assert from "node:assert/strict";
import { test } from "node:test";
import { captureMarketSnapshot, isSnapshotEligible, type CaptureOutcome, type SnapshotParent } from "./captureMarketSnapshot";

const PREDICTION_PARENT: SnapshotParent = {
  kind: "prediction",
  predictionId: 42,
  predictionCutoffAt: new Date("2026-06-01T12:00:00Z"),
};

const LEG_PARENT: SnapshotParent = {
  kind: "leg",
  legId: 99,
  predictionCutoffAt: new Date("2026-06-01T12:00:00Z"),
};

const IDENTITY = {
  player1Id: "p1",
  player1Name: "Carlos Alcaraz",
  player2Id: "p2",
  player2Name: "Novak Djokovic",
};

// ── isSnapshotEligible: the eligibility boundary ──────────────────────────────────────────────

test("isSnapshotEligible is true strictly before the cutoff", () => {
  const cutoff = new Date("2026-06-01T12:00:00Z");
  assert.equal(isSnapshotEligible(new Date("2026-06-01T11:59:59Z"), cutoff), true);
});

test("isSnapshotEligible is true exactly at the cutoff (inclusive boundary)", () => {
  const cutoff = new Date("2026-06-01T12:00:00Z");
  assert.equal(isSnapshotEligible(new Date(cutoff), cutoff), true);
});

test("isSnapshotEligible is false strictly after the cutoff", () => {
  const cutoff = new Date("2026-06-01T12:00:00Z");
  assert.equal(isSnapshotEligible(new Date("2026-06-01T12:00:01Z"), cutoff), false);
});

// ── captureMarketSnapshot: "included" outcome ─────────────────────────────────────────────────

test("captureMarketSnapshot flags a late included observation as ineligible but still writes it", () => {
  const outcome: CaptureOutcome = {
    status: "included",
    ...IDENTITY,
    provider: "TheOddsAPI",
    oddsPlayer1Decimal: 1.8,
    oddsPlayer2Decimal: 2.1,
    capturedAt: new Date("2026-06-01T12:00:01Z"), // 1 second after cutoff
  };
  const row = captureMarketSnapshot({
    outcome,
    parent: PREDICTION_PARENT,
    captureRunId: "run-1",
    capturePipeline: "test",
  });
  assert.equal(row.isEligible, false);
  assert.equal(row.captureStatus, "included");
  // Late doesn't mean dropped -- the raw odds are still written.
  assert.equal(row.oddsPlayer1Decimal, 1.8);
  assert.equal(row.oddsPlayer2Decimal, 2.1);
});

test("captureMarketSnapshot flags an on-time included observation as eligible", () => {
  const outcome: CaptureOutcome = {
    status: "included",
    ...IDENTITY,
    provider: "TheOddsAPI",
    oddsPlayer1Decimal: 1.8,
    oddsPlayer2Decimal: 2.1,
    capturedAt: new Date("2026-06-01T11:00:00Z"),
  };
  const row = captureMarketSnapshot({
    outcome,
    parent: PREDICTION_PARENT,
    captureRunId: "run-1",
    capturePipeline: "test",
  });
  assert.equal(row.isEligible, true);
});

test("captureMarketSnapshot links to a prediction parent with legId null", () => {
  const outcome: CaptureOutcome = {
    status: "included",
    ...IDENTITY,
    provider: "TheOddsAPI",
    oddsPlayer1Decimal: 1.8,
    oddsPlayer2Decimal: 2.1,
    capturedAt: new Date("2026-06-01T11:00:00Z"),
  };
  const row = captureMarketSnapshot({ outcome, parent: PREDICTION_PARENT, captureRunId: "run-1", capturePipeline: "test" });
  assert.equal(row.predictionId, 42);
  assert.equal(row.legId, null);
});

test("captureMarketSnapshot links to a leg parent with predictionId null", () => {
  const outcome: CaptureOutcome = {
    status: "included",
    ...IDENTITY,
    provider: "TheOddsAPI",
    oddsPlayer1Decimal: 1.8,
    oddsPlayer2Decimal: 2.1,
    capturedAt: new Date("2026-06-01T11:00:00Z"),
  };
  const row = captureMarketSnapshot({ outcome, parent: LEG_PARENT, captureRunId: "run-1", capturePipeline: "test" });
  assert.equal(row.legId, 99);
  assert.equal(row.predictionId, null);
});

test("captureMarketSnapshot computes both derived probabilities from raw odds, on the 0-1 scale", () => {
  const outcome: CaptureOutcome = {
    status: "included",
    ...IDENTITY,
    provider: "TheOddsAPI",
    oddsPlayer1Decimal: 1.5,
    oddsPlayer2Decimal: 3.0,
    capturedAt: new Date("2026-06-01T11:00:00Z"),
  };
  const row = captureMarketSnapshot({ outcome, parent: PREDICTION_PARENT, captureRunId: "run-1", capturePipeline: "test" });
  // raw1 = 1/1.5 = 0.6667, raw2 = 1/3.0 = 0.3333, overround = 1.0, normalized1 = 0.6667
  assert.ok(row.normalizedProbabilityPlayer1 != null && Math.abs(row.normalizedProbabilityPlayer1 - 2 / 3) < 1e-6);
  assert.ok(row.devigProbabilityPlayer1 != null && row.devigProbabilityPlayer1 > 0 && row.devigProbabilityPlayer1 < 1);
});

test("captureMarketSnapshot preserves raw odds exactly as provided, never adjusted", () => {
  const outcome: CaptureOutcome = {
    status: "included",
    ...IDENTITY,
    provider: "OddsApiIo",
    oddsPlayer1Decimal: 1.91,
    oddsPlayer2Decimal: 1.95,
    capturedAt: new Date("2026-06-01T11:00:00Z"),
  };
  const row = captureMarketSnapshot({ outcome, parent: PREDICTION_PARENT, captureRunId: "run-1", capturePipeline: "test" });
  assert.equal(row.oddsPlayer1Decimal, 1.91);
  assert.equal(row.oddsPlayer2Decimal, 1.95);
});

test("captureMarketSnapshot throws (fail-loud) on non-decimal odds <= 1", () => {
  const outcome: CaptureOutcome = {
    status: "included",
    ...IDENTITY,
    provider: "TheOddsAPI",
    oddsPlayer1Decimal: 1,
    oddsPlayer2Decimal: 2.1,
    capturedAt: new Date("2026-06-01T11:00:00Z"),
  };
  assert.throws(() => captureMarketSnapshot({ outcome, parent: PREDICTION_PARENT, captureRunId: "run-1", capturePipeline: "test" }));
});

test("captureMarketSnapshot throws (fail-loud) on non-finite odds", () => {
  const outcome: CaptureOutcome = {
    status: "included",
    ...IDENTITY,
    provider: "TheOddsAPI",
    oddsPlayer1Decimal: Number.NaN,
    oddsPlayer2Decimal: 2.1,
    capturedAt: new Date("2026-06-01T11:00:00Z"),
  };
  assert.throws(() => captureMarketSnapshot({ outcome, parent: PREDICTION_PARENT, captureRunId: "run-1", capturePipeline: "test" }));
});

// ── captureMarketSnapshot: the three no-quote statuses ────────────────────────────────────────

for (const status of ["no_market_available", "provider_error"] as const) {
  test(`captureMarketSnapshot shapes a "${status}" row with isEligible null and no odds columns`, () => {
    const outcome: CaptureOutcome = {
      status,
      ...IDENTITY,
      provider: "TheOddsAPI",
      capturedAt: new Date("2026-06-01T11:00:00Z"),
    };
    const row = captureMarketSnapshot({ outcome, parent: PREDICTION_PARENT, captureRunId: "run-1", capturePipeline: "test" });
    assert.equal(row.captureStatus, status);
    assert.equal(row.provider, "TheOddsAPI");
    assert.equal(row.isEligible, null);
    assert.equal(row.oddsPlayer1Decimal, null);
    assert.equal(row.oddsPlayer2Decimal, null);
    assert.equal(row.normalizedProbabilityPlayer1, null);
    assert.equal(row.devigProbabilityPlayer1, null);
  });
}

test('captureMarketSnapshot shapes a "provider_not_configured" row with provider null', () => {
  const outcome: CaptureOutcome = {
    status: "provider_not_configured",
    ...IDENTITY,
    capturedAt: new Date("2026-06-01T11:00:00Z"),
  };
  const row = captureMarketSnapshot({ outcome, parent: PREDICTION_PARENT, captureRunId: "run-1", capturePipeline: "test" });
  assert.equal(row.captureStatus, "provider_not_configured");
  assert.equal(row.provider, null);
  assert.equal(row.isEligible, null);
});

test('captureMarketSnapshot throws when "provider_not_configured" incorrectly names a provider', () => {
  const outcome = {
    status: "provider_not_configured" as const,
    ...IDENTITY,
    provider: "TheOddsAPI",
    capturedAt: new Date("2026-06-01T11:00:00Z"),
  } as unknown as CaptureOutcome;
  assert.throws(() => captureMarketSnapshot({ outcome, parent: PREDICTION_PARENT, captureRunId: "run-1", capturePipeline: "test" }));
});

// ── Provenance stamping ────────────────────────────────────────────────────────────────────────

test("captureMarketSnapshot stamps capturedByCommit with a real 40-hex git SHA", () => {
  const outcome: CaptureOutcome = {
    status: "included",
    ...IDENTITY,
    provider: "TheOddsAPI",
    oddsPlayer1Decimal: 1.8,
    oddsPlayer2Decimal: 2.1,
    capturedAt: new Date("2026-06-01T11:00:00Z"),
  };
  const row = captureMarketSnapshot({ outcome, parent: PREDICTION_PARENT, captureRunId: "run-1", capturePipeline: "test" });
  assert.match(row.capturedByCommit, /^[0-9a-f]{40}$/);
});
