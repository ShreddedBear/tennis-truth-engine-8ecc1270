import { describe, expect, it } from "vitest";
import { computeFailureConditionCompatibility, computeFavoriteFailureMode, FAILURE_CONDITIONS } from "./audit-metric-043-favorite-failure-mode";
import type { LossAutopsyResult } from "./audit-metric-036-loss-autopsy";
import type { UnderdogWinProfileResult } from "./audit-metric-044-opponent-upset-compatibility";

function loss(over: Partial<LossAutopsyResult["losses"][number]>): LossAutopsyResult["losses"][number] {
  return { date: "2024-01-01", opponent: "x", favorite_status: "FAVORITE", elo_gap: 100, opponent_quality_elo: 1500, surface: "hard", lost_set_1: null, deciding_set: null, tiebreak_factor: null, blowout_loss: null, ...over };
}
function win(over: Partial<UnderdogWinProfileResult["underdog_wins"][number]>): UnderdogWinProfileResult["underdog_wins"][number] {
  return { date: "2024-01-01", opponent: "y", elo_gap: -100, opponent_quality_elo: 1500, surface: "hard", took_set_1: null, deciding_set: null, tiebreak_factor: null, blowout_win: null, ...over };
}

describe("metric #043 — Favorite Failure-Mode Score (pure core)", () => {
  it("reports per-condition player-loss-rate and opponent-reproduction-rate side by side", () => {
    const { conditions } = computeFailureConditionCompatibility(
      [loss({ lost_set_1: true, deciding_set: false, tiebreak_factor: false, blowout_loss: false })],
      [win({ took_set_1: true, deciding_set: false, tiebreak_factor: false, blowout_win: false })],
    );
    expect(conditions).toHaveLength(FAILURE_CONDITIONS.length);
    const lostSet1 = conditions.find(c => c.condition === "lost_set_1")!;
    expect(lostSet1.player_favorite_loss_rate_pct).toBe(100);
    expect(lostSet1.opponent_reproduction_rate_pct).toBe(100);
  });

  it("weights the composite score only by conditions the player actually fails on (never rewarding an opponent for reproducing a non-issue)", () => {
    // Player only ever loses via lost_set_1 (100%); never via deciding_set (0%).
    // Opponent reproduces lost_set_1 at 50% and deciding_set at 100% -- the
    // composite must reflect only the 50% (deciding_set contributes zero
    // weight since the player's own rate there is 0).
    const losses = [
      loss({ lost_set_1: true, deciding_set: false, tiebreak_factor: null, blowout_loss: null }),
      loss({ lost_set_1: true, deciding_set: false, tiebreak_factor: null, blowout_loss: null }),
    ];
    const wins = [
      win({ took_set_1: true, deciding_set: true, tiebreak_factor: null, blowout_win: null }),
      win({ took_set_1: false, deciding_set: true, tiebreak_factor: null, blowout_win: null }),
    ];
    const { reproduction_compatibility_score_pct } = computeFailureConditionCompatibility(losses, wins);
    expect(reproduction_compatibility_score_pct).toBe(50);
  });

  it("returns null composite (never fabricated) when no condition has both a nonzero player rate and a known opponent rate", () => {
    const { reproduction_compatibility_score_pct } = computeFailureConditionCompatibility(
      [loss({ lost_set_1: null, deciding_set: null, tiebreak_factor: null, blowout_loss: null })],
      [win({ took_set_1: null, deciding_set: null, tiebreak_factor: null, blowout_win: null })],
    );
    expect(reproduction_compatibility_score_pct).toBeNull();
  });
});

describe("metric #043 — live wrapper against the real generated index", () => {
  const PLAYER = "zdenek kolar"; // data-rich favorite-role loss history
  const OPPONENT = "andrea collarini"; // data-rich underdog-win history
  const LANE = "ATP_CHALLENGER" as const;
  const AS_OF = "2026-08-29";

  it("produces a real, non-fabricated GO result cross-referencing both players' real histories", () => {
    const result = computeFavoriteFailureMode({ player: PLAYER, opponent: OPPONENT, lane: LANE, asOfDate: AS_OF });
    expect(result.status).toBe("GO");
    if (result.status !== "GO") return;
    expect(result.value.trailing_favorite_losses_n).toBeGreaterThan(0);
    expect(result.value.opponent_underdog_wins_n).toBeGreaterThan(0);
    expect(result.value.failure_conditions).toHaveLength(FAILURE_CONDITIONS.length);
    expect(result.value.set_sequence_available).toBe(true);
  });

  it("rejects player === opponent rather than comparing a player against themselves", () => {
    const result = computeFavoriteFailureMode({ player: PLAYER, opponent: PLAYER, lane: LANE, asOfDate: AS_OF });
    expect(result.status).toBe("NOT_ENOUGH_DATA");
  });

  it("returns NOT_ENOUGH_DATA when the opponent has no verified underdog wins in this lane", () => {
    const result = computeFavoriteFailureMode({ player: PLAYER, opponent: "totally fictional opponent one", lane: LANE, asOfDate: AS_OF });
    expect(result.status).toBe("NOT_ENOUGH_DATA");
  });

  it("returns NOT_ENOUGH_DATA when the player has no favorite-role losses at all", () => {
    const result = computeFavoriteFailureMode({ player: "totally fictional player one", opponent: OPPONENT, lane: LANE, asOfDate: AS_OF });
    expect(result.status).toBe("NOT_ENOUGH_DATA");
  });
});
