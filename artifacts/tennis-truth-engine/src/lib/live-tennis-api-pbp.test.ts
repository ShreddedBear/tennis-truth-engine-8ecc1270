import { describe, expect, it } from "vitest";
import {
  classifyPbpFetchFailure,
  collectPaginatedHistory,
  exactPlayerIds,
  liveTennisApiConfig,
  liveTennisApiSourcePacketBudgetMs,
  tapeToGamesPayload,
  tapeToGamesPayloadWithDiagnostics,
} from "./live-tennis-api-pbp.server";
import { metricHasRequiredPbpFields, reconstructPbpScoreState, TASK18B_METRIC_CODES } from "./pbp-score-state-recovery";
import capturedMatch157791 from "./fixtures/live-tennis-157791-tape.json";

// Real tape rows captured live from https://api.livetennisapi.com against match 157791
// (GET /history/matches/157791?points=complete), verified point-by-point against the
// provider's own response rather than guessed from documentation. Row 0 is the pre-match
// baseline; each later row carries one real point. Game 1 (rows 1-5): p1 wins 4 points to
// p2's 1 (the boundary row's own point_winner is the game-deciding point). Game 2 (rows
// 6-11): p2 wins 4 points to p1's 2.
const row = (pw: 1 | 2 | null, srv: 1 | 2, games: [number[], number[]]) => ({ point_winner: pw, server: srv, games, is_tiebreak: false });
const REAL_TAPE_GAME_1_AND_2 = [
  row(null, 1, [[0], [0]]),
  row(1, 1, [[0], [0]]),
  row(2, 1, [[0], [0]]),
  row(1, 1, [[0], [0]]),
  row(1, 1, [[0], [0]]),
  row(1, 2, [[1], [0]]), // game 1 ends here: p1 wins it 4-1, server flips to p2 for game 2
  row(1, 2, [[1], [0]]),
  row(1, 2, [[1], [0]]),
  row(2, 2, [[1], [0]]),
  row(2, 2, [[1], [0]]),
  row(2, 2, [[1], [0]]),
  row(2, 1, [[1], [1]]), // game 2 ends here: p2 wins it 4-2, server flips to p1 for game 3
];

describe("tapeToGamesPayload (verified against a real captured match)", () => {
  it("splits the flat tape into two complete games with the right winner-implying point tallies", () => {
    const { games } = tapeToGamesPayload({ tape: REAL_TAPE_GAME_1_AND_2 });
    expect(games).toHaveLength(2);

    const [game1, game2] = games;
    expect(game1.server).toBe("player1");
    expect((game1.points as any[]).map((p) => p.winner)).toEqual(["player1", "player2", "player1", "player1", "player1"]);
    expect(game1.player1_games).toBe(1);
    expect(game1.player2_games).toBe(0);
    expect(game1.set_number).toBe(1);

    expect(game2.server).toBe("player2");
    expect((game2.points as any[]).map((p) => p.winner)).toEqual(["player1", "player1", "player2", "player2", "player2", "player2"]);
    expect(game2.player1_games).toBe(1);
    expect(game2.player2_games).toBe(1);
    expect(game2.set_number).toBe(1);
  });

  it("feeds cleanly into reconstructPbpScoreState (the existing, already-tested recovery logic) with no adapter-specific changes needed there", () => {
    const payload = tapeToGamesPayload({ tape: REAL_TAPE_GAME_1_AND_2 });
    const recovery = reconstructPbpScoreState(payload);
    expect(recovery.valid).toBe(true);
    expect(recovery.game_count).toBe(2);
    expect(recovery.point_count).toBe(11); // 5 points in game1 + 6 in game2, excluding the null-winner baseline row
  });

  it("keeps the boundary row on the active set before subsequent rows advance to the new set", () => {
    const priorSet1End = { point_winner: 1 as const, server: 1 as const, games: [[6], [3]] as [number[], number[]], is_tiebreak: false };
    const set2Start = { point_winner: 1 as const, server: 1 as const, games: [[6, 1], [3, 0]] as [number[], number[]], is_tiebreak: false };
    const { games } = tapeToGamesPayload({ tape: [row(null, 2, [[6], [3]]), priorSet1End, set2Start] });
    expect(games).toHaveLength(1);
    expect(games[0].set_number).toBe(1);
    expect(games[0].player1_games).toBe(6);
    expect(games[0].player2_games).toBe(3);
  });

  it("keeps a trailing incomplete game (retirement/walkover) rather than discarding or fabricating a winner for it", () => {
    const { games } = tapeToGamesPayload({ tape: [row(null, 1, [[0], [0]]), row(1, 1, [[0], [0]]), row(2, 1, [[0], [0]])] });
    expect(games).toHaveLength(1);
    expect((games[0].points as any[]).length).toBe(2);
  });

  it("returns no games for an empty or missing tape rather than throwing", () => {
    expect(tapeToGamesPayload({ tape: [] })).toEqual({ games: [] });
    expect(tapeToGamesPayload({})).toEqual({ games: [] });
    expect(tapeToGamesPayload(null)).toEqual({ games: [] });
  });
});

describe("LiveTennisAPI score-snapshot fallback (captured match 157791)", () => {
  const withoutPointWinners = {
    ...capturedMatch157791,
    tape: capturedMatch157791.tape.map(({ point_winner: _pointWinner, ...row }) => row),
  };

  it("matches the explicit-winner canonical recovery exactly", () => {
    const explicit = reconstructPbpScoreState(tapeToGamesPayload(capturedMatch157791));
    const scoreDerivedResult = tapeToGamesPayloadWithDiagnostics(withoutPointWinners);
    const scoreDerived = reconstructPbpScoreState(scoreDerivedResult.payload);

    expect(explicit.valid).toBe(true);
    expect(scoreDerived.valid).toBe(true);
    expect(explicit.point_count).toBe(99);
    expect(explicit.game_count).toBe(16);
    expect(scoreDerived.point_count).toBe(explicit.point_count);
    expect(scoreDerived.game_count).toBe(explicit.game_count);
    expect(scoreDerived.derived).toEqual(explicit.derived);
    expect(scoreDerivedResult.diagnostics).toEqual({
      used_score_derivation: true,
      rejected_or_ambiguous_games: 0,
    });
    for (const code of TASK18B_METRIC_CODES) {
      expect(metricHasRequiredPbpFields(scoreDerived, code, "player1"), `${code} player1`).toBe(true);
      expect(metricHasRequiredPbpFields(scoreDerived, code, "player2"), `${code} player2`).toBe(true);
    }
  });

  it("rejects a missing transition instead of skipping the unreadable point", () => {
    const tape = withoutPointWinners.tape.filter((_row, index) => index !== 2);
    const result = tapeToGamesPayloadWithDiagnostics({ tape });
    expect(reconstructPbpScoreState(result.payload).valid).toBe(false);
    expect(result.diagnostics.rejected_or_ambiguous_games).toBeGreaterThan(0);
  });

  it("rejects an ambiguous game-counter transition", () => {
    const tape = structuredClone(withoutPointWinners.tape.slice(0, 6));
    tape[5].games = [[1], [1]];
    const result = tapeToGamesPayloadWithDiagnostics({ tape });
    expect(reconstructPbpScoreState(result.payload).valid).toBe(false);
    expect(result.diagnostics.rejected_or_ambiguous_games).toBe(1);
  });

  it("rejects an unreadable score state without silently dropping its game", () => {
    const tape = structuredClone(withoutPointWinners.tape.slice(0, 6));
    tape[3].points = ["?", "15"];
    const result = tapeToGamesPayloadWithDiagnostics({ tape });
    expect(result.payload.games).toHaveLength(1);
    expect(reconstructPbpScoreState(result.payload).valid).toBe(false);
    expect(result.diagnostics.rejected_or_ambiguous_games).toBe(1);
  });

  it("rejects an incomplete terminal state without inventing the deciding point", () => {
    const tape = structuredClone(withoutPointWinners.tape.slice(0, 5));
    tape[4].points = ["40", "A"];
    const result = tapeToGamesPayloadWithDiagnostics({ tape });
    expect(result.payload.games).toHaveLength(1);
    expect(reconstructPbpScoreState(result.payload).valid).toBe(false);
    expect(result.diagnostics.rejected_or_ambiguous_games).toBe(1);
  });
});

describe("classifyPbpFetchFailure", () => {
  it("classifies HTTP 402 as a billing failure, explicitly not a data absence", () => {
    const reason = classifyPbpFetchFailure({ status: 402 });
    expect(reason).toContain("402");
    expect(reason.toLowerCase()).toContain("payment");
    expect(reason.toLowerCase()).not.toContain("no data");
  });

  it("classifies HTTP 401/403 as an auth failure", () => {
    expect(classifyPbpFetchFailure({ status: 401 })).toMatch(/401/);
    expect(classifyPbpFetchFailure({ status: 403 })).toMatch(/403/);
  });

  it("classifies HTTP 429 as rate limiting", () => {
    expect(classifyPbpFetchFailure({ status: 429 }).toLowerCase()).toContain("rate limit");
  });

  it("classifies HTTP 400 with the provider's own detail message (verified: this is the real shape returned for bad param combinations)", () => {
    const reason = classifyPbpFetchFailure({ status: 400, badRequest: "points=complete cannot combine with sequence=clean" });
    expect(reason).toContain("400");
    expect(reason).toContain("points=complete cannot combine with sequence=clean");
  });

  it("classifies the daily request budget being exhausted as its own distinct, non-absence reason", () => {
    const reason = classifyPbpFetchFailure({ dailyBudgetExhausted: true });
    expect(reason.toLowerCase()).toContain("budget");
    expect(reason.toLowerCase()).not.toContain("no data");
  });

  it("classifies a network/timeout error using its own message", () => {
    expect(classifyPbpFetchFailure({ networkError: "The operation was aborted due to timeout" })).toContain("The operation was aborted due to timeout");
  });

  it("classifies a JSON parse failure distinctly from a 402/network failure", () => {
    const reason = classifyPbpFetchFailure({ parseError: true });
    expect(reason.toLowerCase()).toContain("json");
    expect(reason).not.toContain("402");
  });
});

describe("Live Tennis API Pro configuration", () => {
  it("uses the subscribed Pro limits by default", () => {
    const config = liveTennisApiConfig({});
    expect(config.requestsPerMinute).toBe(300);
    expect(config.dailyBudget).toBe(10_000);
    expect(config.maxCandidatesPerPlayer).toBeGreaterThan(4);
    expect(config.maxHistoryRowsPerPlayer).toBeGreaterThan(25);
  });

  it("allows operators to lower limits but never configure above the subscribed plan", () => {
    expect(liveTennisApiConfig({
      LIVE_TENNIS_API_REQUESTS_PER_MINUTE: "120",
      LIVE_TENNIS_API_DAILY_BUDGET: "5000",
      LIVE_TENNIS_API_MAX_CANDIDATES_PER_PLAYER: "12",
      LIVE_TENNIS_API_MAX_HISTORY_ROWS_PER_PLAYER: "100",
    })).toMatchObject({
      requestsPerMinute: 120,
      dailyBudget: 5000,
      maxCandidatesPerPlayer: 12,
      maxHistoryRowsPerPlayer: 100,
    });
    expect(liveTennisApiConfig({
      LIVE_TENNIS_API_REQUESTS_PER_MINUTE: "999",
      LIVE_TENNIS_API_DAILY_BUDGET: "99999",
    })).toMatchObject({ requestsPerMinute: 300, dailyBudget: 10_000 });
  });

  it("uses a bounded source-packet budget longer than the obsolete seven-second cutoff", () => {
    expect(liveTennisApiSourcePacketBudgetMs({})).toBe(45_000);
    expect(liveTennisApiSourcePacketBudgetMs({ LIVE_TENNIS_API_SOURCE_PACKET_BUDGET_MS: "20000" })).toBe(20_000);
  });

  it("paginates beyond 25 rows and can retain more than four qualifying matches", async () => {
    const offsets: number[] = [];
    const page = (start: number, count: number, outcome = "completed") =>
      Array.from({ length: count }, (_, index) => ({
        id: start + index,
        outcome,
        scheduled_time: "2025-01-01T00:00:00Z",
      }));
    const rows = await collectPaginatedHistory(async (offset) => {
      offsets.push(offset);
      if (offset === 0) return page(0, 25, "scheduled");
      if (offset === 25) return page(25, 25);
      return page(50, 5);
    }, "2026-09-14", {
      historyPageSize: 25,
      maxHistoryRowsPerPlayer: 100,
      maxCandidatesPerPlayer: 20,
    });
    expect(offsets).toEqual([0, 25]);
    expect(rows).toHaveLength(20);
    expect(rows.every((row) => row.id >= 25)).toBe(true);
  });
});

describe("Live Tennis API player identity discovery", () => {
  it("keeps duplicate exact-name singles IDs for history discovery instead of rejecting the player", () => {
    expect(exactPlayerIds({ data: [
      { id: 280, name: "Caroline Dolehide", is_doubles_team: false },
      { id: 11011, name: "Caroline Dolehide", is_doubles_team: false },
      { id: 999, name: "Caroline Dolehide / Partner", is_doubles_team: true },
      { id: 123, name: "Someone Else", is_doubles_team: false },
    ] }, "Caroline Dolehide")).toEqual([280, 11011]);
  });
});
