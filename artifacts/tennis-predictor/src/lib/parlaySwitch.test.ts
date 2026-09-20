import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildValidateLegPayload,
  chunk,
  computeSummary,
  fetchJsonWithRetry,
  flipLegsByKey,
  flipSide,
  mergeSwitchedResults,
  runWithConcurrency,
  selectKeysByDecision,
  type BuilderLegResultLike,
  type LegLike,
  type RetryableResponse,
} from "./parlaySwitch.ts";

function makeLeg(overrides: Partial<LegLike> & { key: string }): LegLike {
  return {
    player1Id: "p1", player1Name: "Player One",
    player2Id: "p2", player2Name: "Player Two",
    surface: "Hard", tournamentName: "Test Open",
    marketOdds: "", selectedSide: "1",
    ...overrides,
  };
}

function makeResult(overrides: Partial<BuilderLegResultLike> & Record<string, unknown> = {}): BuilderLegResultLike & Record<string, unknown> {
  return { decision: "KEEP", validationScore: 70, riskScore: 30, parlayGrade: "Solid", ...overrides };
}

// ── Test A — initial auto-selection ─────────────────────────────────────────
test("Test A: initial payload backs the Prediction Engine's selected winner (Player 2)", () => {
  const leg = makeLeg({ key: "m1", selectedSide: "2" });
  const payload = buildValidateLegPayload(leg);
  assert.equal(payload.selectedPlayerId, "p2");
  assert.equal(payload.selectedPlayerName, "Player Two");
  assert.equal(payload.opponentId, "p1");
  assert.equal(payload.opponentName, "Player One");
});

// ── Test B — Switch Remove evaluates the opposite player ───────────────────
test("Test B: switching a REMOVE leg (currently Player 2) revalidates Player 1, not just the label", () => {
  const resultLegs = [makeResult({ decision: "REMOVE" })];
  const resultLegKeys = ["m1"];
  const removeKeys = selectKeysByDecision(resultLegs, resultLegKeys, "REMOVE");
  assert.deepEqual([...removeKeys], ["m1"]);

  const legs = [makeLeg({ key: "m1", selectedSide: "2" })];
  const flipped = flipLegsByKey(legs, removeKeys);
  assert.equal(flipped[0].selectedSide, "1", "the switch must flip the selected side");

  const payload = buildValidateLegPayload(flipped[0]);
  assert.equal(payload.selectedPlayerId, "p1", "validation must run against the opposite player, Player 1");
  assert.equal(payload.opponentId, "p2");
});

// ── Test C — Switch Borderline evaluates the opposite player ───────────────
test("Test C: switching a BORDERLINE leg revalidates the opposite player", () => {
  const resultLegs = [makeResult({ decision: "BORDERLINE" })];
  const resultLegKeys = ["m1"];
  const borderlineKeys = selectKeysByDecision(resultLegs, resultLegKeys, "BORDERLINE");

  const legs = [makeLeg({ key: "m1", selectedSide: "1" })];
  const flipped = flipLegsByKey(legs, borderlineKeys);
  assert.equal(flipped[0].selectedSide, "2");

  const payload = buildValidateLegPayload(flipped[0]);
  assert.equal(payload.selectedPlayerId, "p2");
  assert.equal(payload.opponentId, "p1");
});

// ── Test D — unaffected results are unchanged ───────────────────────────────
test("Test D: non-switched results are returned unchanged (by reference) after a partial switch", () => {
  const untouched = makeResult({ decision: "KEEP", validationScore: 91 });
  const oldRemoved = makeResult({ decision: "REMOVE", validationScore: 20 });
  const newForSwitched = makeResult({ decision: "BORDERLINE", validationScore: 55 });

  const merged = mergeSwitchedResults({
    fullResults: [untouched, oldRemoved],
    resultLegKeys: ["keep-leg", "remove-leg"],
    updates: [{ key: "remove-leg", result: newForSwitched }],
  });

  assert.equal(merged[0], untouched, "the untouched leg must be the exact same object, not recomputed");
  assert.equal(merged[1], newForSwitched);
  assert.notEqual(merged[1], oldRemoved);
});

// ── Test E — result/key alignment under reordering ──────────────────────────
test("Test E: switched results merge back to the correct matchup even if the batch response is out of order", () => {
  const full = [makeResult({ decision: "REMOVE" }), makeResult({ decision: "REMOVE" }), makeResult({ decision: "KEEP" })];
  const resultLegKeys = ["legA", "legB", "legC"];

  // Batch response deliberately returned in reverse order of how it was sent.
  const updates = [
    { key: "legB", result: makeResult({ decision: "KEEP", validationScore: 81 }) },
    { key: "legA", result: makeResult({ decision: "BORDERLINE", validationScore: 60 }) },
  ];

  const merged = mergeSwitchedResults({ fullResults: full, resultLegKeys, updates });
  assert.equal(merged[0].decision, "BORDERLINE", "legA must get legA's update regardless of batch order");
  assert.equal(merged[1].decision, "KEEP", "legB must get legB's update regardless of batch order");
  assert.equal(merged[2], full[2], "legC was never switched and must be untouched");
});

// ── Test F — large slate uses bounded concurrency/batching ─────────────────
test("Test F: a 120-leg batch runs with bounded concurrency, never all-at-once", async () => {
  const items = Array.from({ length: 120 }, (_, i) => i);
  let inFlight = 0;
  let maxInFlight = 0;

  await runWithConcurrency(items, 8, async () => {
    inFlight++;
    maxInFlight = Math.max(maxInFlight, inFlight);
    await new Promise((r) => setTimeout(r, 1));
    inFlight--;
  });

  assert.ok(maxInFlight <= 8, `expected at most 8 concurrent, saw ${maxInFlight}`);
  assert.ok(maxInFlight > 1, "sanity: concurrency should still parallelize somewhat");
});

test("Test F (batching): chunk splits a 149-leg slate into small validation batches", () => {
  const legs = Array.from({ length: 149 }, (_, i) => i);
  const batches = chunk(legs, 40);
  assert.equal(batches.length, 4);
  for (const b of batches) assert.ok(b.length <= 40);
  assert.equal(batches.flat().length, 149);
});

// ── Test G — HTTP 429 retry/backoff ─────────────────────────────────────────
test("Test G: a temporary 429 is retried (honoring Retry-After) and eventually succeeds", async () => {
  let calls = 0;
  const sleeps: number[] = [];
  function response(status: number, retryAfter: string | null, body: unknown): RetryableResponse {
    return {
      ok: status >= 200 && status < 300,
      status,
      headers: { get: (name) => (name === "Retry-After" ? retryAfter : null) },
      json: async () => body,
    };
  }

  const doFetch = async (): Promise<RetryableResponse> => {
    calls++;
    if (calls === 1) return response(429, "1", { error: "Too many requests" });
    return response(200, null, { ok: true });
  };

  const result = await fetchJsonWithRetry(doFetch, {
    sleep: async (ms) => { sleeps.push(ms); },
  });

  assert.equal(calls, 2, "must retry exactly once after the single 429");
  assert.deepEqual(result, { ok: true });
  assert.deepEqual(sleeps, [1000], "must honor Retry-After: 1 (seconds) as a 1000ms sleep");
});

test("Test G (exhausted): repeated 429s exhaust retries and throw rather than hang or crash the app", async () => {
  const doFetch = async (): Promise<RetryableResponse> => ({
    ok: false, status: 429,
    headers: { get: () => null },
    json: async () => ({ error: "Too many requests" }),
  });

  await assert.rejects(
    () => fetchJsonWithRetry(doFetch, { retries: 2, baseDelayMs: 1, maxDelayMs: 2, sleep: async () => {} }),
    /Too many requests/,
  );
});

// ── Test H — no duplicate/lost legs ─────────────────────────────────────────
test("Test H: 149 uploaded legs produce exactly 149 final results after a partial switch", () => {
  const fullResults = Array.from({ length: 149 }, (_, i) => makeResult({ decision: i < 8 ? "REMOVE" : "BORDERLINE" }));
  const resultLegKeys = Array.from({ length: 149 }, (_, i) => `leg-${i}`);

  const removeKeys = selectKeysByDecision(fullResults, resultLegKeys, "REMOVE");
  assert.equal(removeKeys.size, 8);

  const updates = [...removeKeys].map((key) => ({ key, result: makeResult({ decision: "REMOVE" }) }));
  const merged = mergeSwitchedResults({ fullResults, resultLegKeys, updates });

  assert.equal(merged.length, 149, "must not gain or lose legs");
  const summary = computeSummary(merged);
  assert.equal(summary.removeCount + summary.borderlineCount + summary.keepCount, 149);
});

// ── flipSide sanity ──────────────────────────────────────────────────────────
test("flipSide reverses exactly between '1' and '2'", () => {
  assert.equal(flipSide("1"), "2");
  assert.equal(flipSide("2"), "1");
});
