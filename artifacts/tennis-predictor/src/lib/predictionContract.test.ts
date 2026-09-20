/**
 * Regression coverage for the Parlay Builder -> Prediction Engine request
 * contract (a defect discovered during live verification of PR #87,
 * independent of that PR's own Switch Removes/Borderline fix).
 *
 * Root cause: AdminParlayBuilder.tsx built its own /api/predictions request
 * by hand — matchFormat: "best-of-3" (server only accepts "BestOf3"/"BestOf5")
 * and no x-prediction-request-id / x-prediction-match-id headers (both
 * required by artifacts/api-server/src/routes/predictionRequestIntegrity.ts).
 * Every real call therefore failed with HTTP 400, and the per-leg catch swallowed
 * the failure and left selectedSide at its default of "1" — silently treating
 * "the request failed" as "the Prediction Engine picked Player 1".
 *
 * The fix routes the Parlay Builder through createPredictionWithIntegrity, the
 * same canonical helper every other prediction call site in this app already
 * uses (BulkMatchupPredictor, PasteMatchupPredictor, FixturesList), and makes a
 * failed/unusable prediction resolve to `null` rather than "1".
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildPredictionCallArgs, buildValidateLegPayload, flipLegsByKey, resolvePredictedSideOrNull,
  type LegLike, type PredictionCallLeg,
} from "./parlaySwitch.ts";
import { createPredictionWithIntegrity } from "./predictionRequestIntegrity.ts";

const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function makeCallLeg(overrides: Partial<PredictionCallLeg> & { key: string }): PredictionCallLeg {
  return {
    player1Id: "p1", player2Id: "p2",
    player1Name: "Player One", player2Name: "Player Two",
    surface: "Hard", tournamentName: "Test Open",
    ...overrides,
  };
}

// ── Test 1 — correct request contract ───────────────────────────────────────
test("Test 1: buildPredictionCallArgs sends the canonical matchFormat, not the old invalid literal", () => {
  const { input } = buildPredictionCallArgs(makeCallLeg({ key: "leg-1" }));
  assert.equal(input.matchFormat, "BestOf3");
  assert.notEqual(input.matchFormat as string, "best-of-3");
});

test("Test 1: request body carries the leg's actual player IDs, surface and tournament", () => {
  const { input } = buildPredictionCallArgs(makeCallLeg({ key: "leg-1", player1Id: "pA", player2Id: "pB", surface: "Clay", tournamentName: "Roland Garros" }));
  assert.deepEqual(input, {
    player1Id: "pA", player2Id: "pB", surface: "Clay", matchFormat: "BestOf3", tournamentName: "Roland Garros",
  });
});

// ── Test 2 — required headers present and valid ─────────────────────────────
test("Test 2: the actual HTTP request sent by createPredictionWithIntegrity carries both required, valid integrity headers", async () => {
  const { input, context } = buildPredictionCallArgs(makeCallLeg({ key: "leg-42" }));

  let capturedHeaders: Record<string, string> | undefined;
  const originalFetch = globalThis.fetch;
  // @ts-expect-error -- test stub, minimal Response shape
  globalThis.fetch = async (_url: string, init: RequestInit) => {
    capturedHeaders = init.headers as Record<string, string>;
    return {
      ok: true,
      status: 201,
      headers: {
        get: (name: string) =>
          name === "x-prediction-request-id" ? capturedHeaders!["x-prediction-request-id"]
          : name === "x-prediction-match-id" ? capturedHeaders!["x-prediction-match-id"]
          : null,
      },
      json: async () => ({
        surface: input.surface, matchFormat: input.matchFormat, tournamentName: input.tournamentName,
        player1Name: "Player One", player2Name: "Player Two", calibratedProbability: 62,
      }),
    };
  };

  try {
    await createPredictionWithIntegrity(input, context);
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.ok(capturedHeaders, "fetch must have been called");
  assert.ok(UUID_V4_RE.test(capturedHeaders!["x-prediction-request-id"]), "x-prediction-request-id must be a valid UUID v4");
  assert.equal(capturedHeaders!["x-prediction-match-id"], "leg-42");
  assert.ok(capturedHeaders!["x-prediction-match-id"].length >= 6, "x-prediction-match-id must satisfy the server's >=6 char minimum");
});

// ── Test 3/4/5 — predicted winner derivation from calibrated probability ────
test("Test 3: a successful response with calibratedProbability >= 50 resolves to Player 1", () => {
  assert.equal(resolvePredictedSideOrNull(62), "1");
  assert.equal(resolvePredictedSideOrNull(50), "1");
});

test("Test 4: calibratedProbability < 50 resolves to Player 2", () => {
  assert.equal(resolvePredictedSideOrNull(38), "2");
  assert.equal(resolvePredictedSideOrNull(0.1), "2");
});

test("Test 5: calibratedProbability >= 50 resolves to Player 1 (boundary + high confidence)", () => {
  assert.equal(resolvePredictedSideOrNull(50.0), "1");
  assert.equal(resolvePredictedSideOrNull(99.9), "1");
});

// ── Test 6 — a failed/unusable prediction never resolves to Player 1 ───────
test("Test 6: a missing or NaN calibratedProbability resolves to null, never to '1'", () => {
  assert.equal(resolvePredictedSideOrNull(undefined), null);
  assert.equal(resolvePredictedSideOrNull(null), null);
  assert.equal(resolvePredictedSideOrNull(NaN), null);
});

test("Test 6: a 400 from /api/predictions propagates as a thrown error, not a fabricated prediction", async () => {
  const { input, context } = buildPredictionCallArgs(makeCallLeg({ key: "leg-bad" }));

  const originalFetch = globalThis.fetch;
  // @ts-expect-error -- test stub
  globalThis.fetch = async () => ({
    ok: false,
    status: 400,
    headers: { get: () => null },
    json: async () => ({ error: "Invalid enum value" }),
  });

  try {
    await assert.rejects(() => createPredictionWithIntegrity(input, context), /Invalid enum value/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// ── Test 7 — PR #87 regression: switching never depends on a fresh prediction ──
test("Test 7: a leg whose side came from the Prediction Engine can be switched and revalidated without any further prediction call", () => {
  // Simulates: initial analyze resolves Player 2 as the Prediction Engine's pick
  // (exactly Test 4's scenario) -> Switch Remove flips it -> the resulting validate
  // payload must back Player 1, using ONLY flip/merge helpers. No prediction
  // function (buildPredictionCallArgs / createPredictionWithIntegrity) is called
  // anywhere in this test body, proving the switch path is fully independent of it.
  const predictedSide = resolvePredictedSideOrNull(38); // Test 4's exact input
  assert.equal(predictedSide, "2");

  const leg: LegLike = {
    key: "leg-99", player1Id: "pX", player1Name: "Player X",
    player2Id: "pY", player2Name: "Player Y",
    surface: "Hard", tournamentName: "Test Open", marketOdds: "",
    selectedSide: predictedSide,
  };

  const initialPayload = buildValidateLegPayload(leg);
  assert.equal(initialPayload.selectedPlayerId, "pY", "must back the Prediction Engine's actual pick, Player 2");

  const flipped = flipLegsByKey([leg], new Set([leg.key]))[0];
  const switchedPayload = buildValidateLegPayload(flipped);
  assert.equal(switchedPayload.selectedPlayerId, "pX", "switch must revalidate the opposite player, Player 1");
  assert.equal(switchedPayload.opponentId, "pY");
});
