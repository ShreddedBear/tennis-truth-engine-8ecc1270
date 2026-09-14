import { describe, expect, it } from "vitest";
import { classifyPbpFetchFailure, tapeToGamesPayload } from "./live-tennis-api-pbp.server";
import { reconstructPbpScoreState } from "./pbp-score-state-recovery";

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

  it("advances the set number once games[0] gains a new set-index entry (verified: real match's first Set-2 tape row)", () => {
    const priorSet1End = { point_winner: 1 as const, server: 1 as const, games: [[6], [3]] as [number[], number[]], is_tiebreak: false };
    const set2Start = { point_winner: 1 as const, server: 1 as const, games: [[6, 1], [3, 0]] as [number[], number[]], is_tiebreak: false };
    const { games } = tapeToGamesPayload({ tape: [row(null, 2, [[6], [3]]), priorSet1End, set2Start] });
    expect(games).toHaveLength(1);
    expect(games[0].set_number).toBe(1); // the completed game belonged to set 1, even though the boundary row already shows set 2's array
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
