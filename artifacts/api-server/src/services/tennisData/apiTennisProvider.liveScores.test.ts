import test from "node:test";
import assert from "node:assert/strict";
import { ApiTennisProvider, type RawMatch } from "./apiTennisProvider";
import type { LiveScoreIdentityRequest } from "./types";

function makeProvider(rows: RawMatch[], calls: Array<{ method: string; params: Record<string, string> }>): ApiTennisProvider {
  const provider = new ApiTennisProvider("test-key");
  // Keep this unit test entirely offline: replace the provider's private HTTP
  // boundary rather than mocking global fetch.
  (provider as any).call = async (method: string, _endpoint: string, params: Record<string, string>) => {
    calls.push({ method, params });
    return rows;
  };
  return provider;
}

function raw(overrides: Partial<RawMatch> = {}): RawMatch {
  return {
    event_key: "event-1",
    event_date: "2026-01-15",
    event_time: "12:00",
    event_first_player: "Alpha One",
    first_player_key: "p1",
    event_second_player: "Beta Two",
    second_player_key: "p2",
    event_final_result: "",
    event_winner: null,
    event_status: "In Play",
    tournament_name: "Test Open",
    scores: [
      { score_first: "6", score_second: "4", score_set: "1" },
      { score_first: "7.7", score_second: "6.5", score_set: "2" },
    ],
    ...overrides,
  };
}

test("getLiveScores: empty input returns empty and makes no provider call", async () => {
  const calls: Array<{ method: string; params: Record<string, string> }> = [];
  const provider = makeProvider([], calls);
  assert.deepEqual(await provider.getLiveScores([]), new Map());
  assert.equal(calls.length, 0);
});

test("getLiveScores: requests yesterday-to-tomorrow, filters exact event keys, and maps sets/status", async () => {
  const calls: Array<{ method: string; params: Record<string, string> }> = [];
  const provider = makeProvider(
    [
      raw({ event_key: "wanted" }),
      raw({ event_key: "not-requested", event_status: "Finished" }),
    ],
    calls,
  );
  const before = Date.now();
  const result = await provider.getLiveScores(["wanted"]);
  const after = Date.now();

  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, "live");
  const { date_start: start, date_stop: stop } = calls[0].params;
  assert.match(start, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(stop, /^\d{4}-\d{2}-\d{2}$/);
  const startMs = Date.parse(`${start}T00:00:00Z`);
  const stopMs = Date.parse(`${stop}T00:00:00Z`);
  const day = 24 * 60 * 60 * 1000;
  assert.ok(startMs <= before - day && startMs >= before - 2 * day);
  assert.ok(stopMs >= after + day - 2 * day && stopMs <= after + day);
  assert.deepEqual(result.get("wanted"), {
    sets: [{ player1Games: 6, player2Games: 4 }, { player1Games: 7, player2Games: 6 }],
    statusText: "In Play",
  });
  assert.equal(result.has("not-requested"), false);
});

test("getLiveScoresByIdentity: preserves requested IDs and requires exact player order", async () => {
  const calls: Array<{ method: string; params: Record<string, string> }> = [];
  const provider = makeProvider([raw({ event_key: "native" })], calls);
  const requests: LiveScoreIdentityRequest[] = [
    { requestedId: "caller-id", date: "2026-01-15", player1Name: "Alpha One", player2Name: "Beta Two" },
    { requestedId: "reversed", date: "2026-01-15", player1Name: "Beta Two", player2Name: "Alpha One" },
  ];
  const result = await provider.getLiveScoresByIdentity(requests);
  assert.equal(calls.length, 1);
  assert.deepEqual([...result.keys()], ["caller-id"]);
  assert.deepEqual(result.get("caller-id"), {
    sets: [{ player1Games: 6, player2Games: 4 }, { player1Games: 7, player2Games: 6 }],
    statusText: "In Play",
  });
  assert.equal(result.has("reversed"), false);
});

test("getLiveScoresByIdentity: duplicate identity is refused as ambiguous", async () => {
  const calls: Array<{ method: string; params: Record<string, string> }> = [];
  const provider = makeProvider(
    [raw(), raw({ event_key: "event-2", event_status: "Finished" })],
    calls,
  );
  const result = await provider.getLiveScoresByIdentity([
    { requestedId: "ambiguous", date: "2026-01-15", player1Name: "Alpha One", player2Name: "Beta Two" },
  ]);
  assert.equal(result.has("ambiguous"), false);
});