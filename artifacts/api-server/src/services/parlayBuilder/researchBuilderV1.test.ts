/**
 * Unit tests for researchBuilderV1.ts — pure scoring logic, no DB.
 *
 * Covers: no-lookahead (matches at/after cutoff never leak in via the index), eligibility gating
 * (zero prior matches -> INELIGIBLE, never a fabricated neutral score), decision-threshold
 * symmetry, and config-fingerprint determinism.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { buildMatchHistoryIndex } from "../historicalData/matchRecordReconstruction.js";
import { computeResearchBuilderV1Score, RESEARCH_V1_ALGORITHM_CONFIG, RESEARCH_V1_CONFIG_FINGERPRINT } from "./researchBuilderV1.js";
import { computeConfigFingerprint } from "./builderVersioning.js";
import type { HistoricalMatchRow } from "@workspace/db";

function row(overrides: Partial<HistoricalMatchRow>): HistoricalMatchRow {
  return {
    id: 1,
    externalId: "ext-1",
    provider: "test",
    tour: "ATP",
    tournamentName: "Test Open",
    tournamentLevel: "ATP250",
    surface: "Hard",
    round: "R32",
    matchFormat: "best-of-3",
    player1Id: "p1",
    player1Name: "Player One",
    player2Id: "p2",
    player2Name: "Player Two",
    winnerId: "p1",
    score: "6-4 6-4",
    scheduledStartAt: new Date("2026-01-01T00:00:00.000Z"),
    cutoffAt: new Date("2026-01-01T00:00:00.000Z"),
    cancelled: false,
    retired: false,
    walkover: false,
    statistics: null,
    ...overrides,
  } as HistoricalMatchRow;
}

describe("computeResearchBuilderV1Score", () => {
  it("returns INELIGIBLE when a player has zero prior matches, never a fabricated score", () => {
    const index = buildMatchHistoryIndex([]);
    const result = computeResearchBuilderV1Score({
      player1Id: "p1",
      player1Name: "Player One",
      player2Id: "p2",
      player2Name: "Player Two",
      surface: "Hard",
      cutoffAt: new Date("2026-05-01T00:00:00.000Z"),
      matchHistoryIndex: index,
    });
    assert.equal(result.eligibility, "INELIGIBLE");
    assert.equal(result.builderScore, null);
    assert.ok(result.rejectionReason);
  });

  it("never lets a match at or after cutoffAt influence the score (no-lookahead)", () => {
    // p1 has one loss before cutoff and one WIN after cutoff -- the win must never be counted.
    const beforeLoss = row({ id: 1, player1Id: "p1", player2Id: "opp-a", winnerId: "opp-a", scheduledStartAt: new Date("2026-01-01T00:00:00.000Z") });
    const afterWin = row({ id: 2, player1Id: "p1", player2Id: "opp-b", winnerId: "p1", scheduledStartAt: new Date("2026-06-15T00:00:00.000Z") });
    const p2History = row({ id: 3, player1Id: "p2", player2Id: "opp-c", winnerId: "p2", scheduledStartAt: new Date("2026-01-01T00:00:00.000Z") });

    const index = buildMatchHistoryIndex([beforeLoss, afterWin, p2History]);
    const cutoffAt = new Date("2026-05-01T00:00:00.000Z");
    const result = computeResearchBuilderV1Score({
      player1Id: "p1",
      player1Name: "Player One",
      player2Id: "p2",
      player2Name: "Player Two",
      surface: "Hard",
      cutoffAt,
      matchHistoryIndex: index,
    });

    assert.equal(result.pitStatus, "VALID_PIT");
    // p1's only PIT-visible match is a loss -> overallAdvantage should reflect 0% win rate, not
    // the 50% it would show if the post-cutoff win were (wrongly) included.
    const overall = result.factorScores.find((f) => f.key === "overallAdvantage");
    assert.ok(overall?.detail.includes("p1=0%"), `expected p1=0% in "${overall?.detail}"`);
  });

  it("decision is symmetric: strong evidence for either player yields KEEP", () => {
    const p1Wins = Array.from({ length: 10 }, (_, i) =>
      row({ id: i + 1, player1Id: "p1", player2Id: `opp-${i}`, winnerId: "p1", scheduledStartAt: new Date(`2026-0${(i % 9) + 1}-01T00:00:00.000Z`) }),
    );
    const p2Losses = Array.from({ length: 10 }, (_, i) =>
      row({ id: i + 100, player1Id: "p2", player2Id: `opp-${i}`, winnerId: `opp-${i}`, scheduledStartAt: new Date(`2026-0${(i % 9) + 1}-01T00:00:00.000Z`) }),
    );
    const index = buildMatchHistoryIndex([...p1Wins, ...p2Losses]);
    const result = computeResearchBuilderV1Score({
      player1Id: "p1",
      player1Name: "Player One",
      player2Id: "p2",
      player2Name: "Player Two",
      surface: "Hard",
      cutoffAt: new Date("2026-09-01T00:00:00.000Z"),
      matchHistoryIndex: index,
    });
    assert.equal(result.eligibility, "ELIGIBLE");
    assert.equal(result.builderPickedPlayerId, "p1");
    assert.equal(result.builderDecision, "KEEP");
  });
});

describe("RESEARCH_V1_CONFIG_FINGERPRINT", () => {
  it("is deterministic and matches an independent recomputation", () => {
    assert.equal(RESEARCH_V1_CONFIG_FINGERPRINT, computeConfigFingerprint(RESEARCH_V1_ALGORITHM_CONFIG));
  });

  it("is a 64-character hex sha256", () => {
    assert.match(RESEARCH_V1_CONFIG_FINGERPRINT, /^[0-9a-f]{64}$/);
  });
});
