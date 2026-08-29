import { describe, expect, it } from "vitest";
import { computeLossAutopsyFromPerspectives, computeLossAutopsy, LOSS_AUTOPSY_SET_SEQUENCE_LANES } from "./audit-metric-036-loss-autopsy";

describe("metric #036 — Loss Autopsy Metrics (pure core)", () => {
  it("classifies a loss as FAVORITE when pre-match Elo favored the player, with a positive elo_gap", () => {
    const result = computeLossAutopsyFromPerspectives(
      [{ date: "2024-01-01", opponent: "Underdog Beater", pre_elo: 1700, opponent_pre_elo: 1500 }],
      null,
    );
    expect(result.losses).toHaveLength(1);
    expect(result.losses[0].favorite_status).toBe("FAVORITE");
    expect(result.losses[0].elo_gap).toBe(200);
    expect(result.favorite_losses_n).toBe(1);
    expect(result.favorite_losses_rate_pct).toBe(100);
    expect(result.bad_loss_severity_index).toBe(200);
  });

  it("classifies a loss as UNDERDOG with a negative elo_gap and does not count it toward the severity index", () => {
    const result = computeLossAutopsyFromPerspectives(
      [{ date: "2024-01-01", opponent: "Strong Opponent", pre_elo: 1400, opponent_pre_elo: 1700 }],
      null,
    );
    expect(result.losses[0].favorite_status).toBe("UNDERDOG");
    expect(result.losses[0].elo_gap).toBe(-300);
    expect(result.favorite_losses_n).toBe(0);
    expect(result.bad_loss_severity_index).toBe(0); // no favorite-role losses -- floor at 0, never negative/fabricated
  });

  it("mixes favorite and underdog losses correctly in the severity index (average of favorite-role losses only)", () => {
    const result = computeLossAutopsyFromPerspectives(
      [
        { date: "2024-01-01", opponent: "A", pre_elo: 1600, opponent_pre_elo: 1500 }, // FAVORITE, gap +100
        { date: "2024-02-01", opponent: "B", pre_elo: 1500, opponent_pre_elo: 1700 }, // UNDERDOG, gap -200
        { date: "2024-03-01", opponent: "C", pre_elo: 1650, opponent_pre_elo: 1500 }, // FAVORITE, gap +150
      ],
      null,
    );
    expect(result.favorite_losses_n).toBe(2);
    expect(result.favorite_losses_rate_pct).toBe(66.7);
    expect(result.bad_loss_severity_index).toBe(125); // (100+150)/2
  });

  it("reports null (never guessed) for set-sequence-derived fields when no set-scores lookup is supplied", () => {
    const result = computeLossAutopsyFromPerspectives(
      [{ date: "2024-01-01", opponent: "A", pre_elo: 1500, opponent_pre_elo: 1500 }],
      null,
    );
    expect(result.set_sequence_available).toBe(false);
    expect(result.losses[0].lost_set_1).toBeNull();
    expect(result.losses[0].deciding_set).toBeNull();
    expect(result.losses[0].tiebreak_factor).toBeNull();
    expect(result.losses[0].blowout_loss).toBeNull();
  });

  it("derives lost_set_1/deciding_set/tiebreak_factor/blowout_loss from a supplied set-scores lookup", () => {
    const setScoresFor = (date: string, opponent: string) => {
      if (date === "2024-01-01" && opponent === "a") return [[3, 6], [6, 7]] as Array<[number, number]>; // lost set 1, went to a TB set2, only 2 sets (not deciding-set-eligible per this test's def of >=3)
      return undefined;
    };
    const result = computeLossAutopsyFromPerspectives(
      [{ date: "2024-01-01", opponent: "A", pre_elo: 1500, opponent_pre_elo: 1500 }],
      setScoresFor,
    );
    expect(result.set_sequence_available).toBe(true);
    expect(result.losses[0].lost_set_1).toBe(true);
    expect(result.losses[0].tiebreak_factor).toBe(true);
    expect(result.losses[0].deciding_set).toBe(false);
    expect(result.losses[0].blowout_loss).toBe(false);
  });

  it("caps the output to the trailing N losses, most recent first", () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ date: `2024-01-${String(i + 1).padStart(2, "0")}`, opponent: `Opp${i}`, pre_elo: 1500, opponent_pre_elo: 1500 }));
    const result = computeLossAutopsyFromPerspectives(many, null, 20);
    expect(result.trailing_losses_used).toBe(20);
    expect(result.losses[0].date).toBe("2024-01-30");
    expect(result.losses[19].date).toBe("2024-01-11");
  });
});

describe("metric #036 — Loss Autopsy Metrics (live wrapper against the real generated index)", () => {
  // Same data-rich ATP_CHALLENGER player used in
  // deterministic-batch1-standalone-metrics.test.ts, chosen by inspecting
  // the generated index directly (266 matches, near-universal set_scores).
  const PLAYER = "zdenek kolar";
  const LANE = "ATP_CHALLENGER" as const;
  const AS_OF = "2026-08-29";

  it("produces a real, non-fabricated GO result for a data-rich player/lane", () => {
    const result = computeLossAutopsy({ player: PLAYER, lane: LANE, asOfDate: AS_OF });
    expect(result.status).toBe("GO");
    if (result.status !== "GO") return;
    expect(result.value.trailing_losses_used).toBeGreaterThan(0);
    expect(result.value.set_sequence_available).toBe(true);
    expect(result.value.losses[0].surface).not.toBeNull();
  });

  it("only WTA_MAIN and ATP_CHALLENGER get set-sequence-derived fields", () => {
    expect(LOSS_AUTOPSY_SET_SEQUENCE_LANES.has("WTA_MAIN")).toBe(true);
    expect(LOSS_AUTOPSY_SET_SEQUENCE_LANES.has("ATP_CHALLENGER")).toBe(true);
    expect(LOSS_AUTOPSY_SET_SEQUENCE_LANES.has("ATP_MAIN")).toBe(false);
    expect(LOSS_AUTOPSY_SET_SEQUENCE_LANES.has("WTA_CHALLENGER")).toBe(false);
  });

  it("returns NOT_ENOUGH_DATA (never fabricated) for a nonexistent player", () => {
    const result = computeLossAutopsy({ player: "totally fictional player one", lane: LANE, asOfDate: AS_OF });
    expect(result.status).toBe("NOT_ENOUGH_DATA");
  });
});
