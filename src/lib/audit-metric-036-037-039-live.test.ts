import { describe, expect, it } from "vitest";
import {
  AUDIT_DB_PAGE_SIZE,
  buildAuditDbCompositeMetricFinding,
  collectPaged,
  playerScoredHistory,
  type ScoredMatchRow,
} from "./audit-metric-036-037-039-live.server";
import { computeLossWinAutopsy } from "./audit-metric-036-037-loss-win-autopsy";
import { MIN_SUPPORT_N } from "./audit-metrics-shared";

function row(overrides: Partial<ScoredMatchRow> & Pick<ScoredMatchRow, "id">): ScoredMatchRow {
  const { id, ...rest } = overrides;
  return {
    id,
    final_score: "6-4 6-3",
    best_of: 3,
    actual_winner: "Alpha Player",
    player1_name: "Alpha Player",
    player2_name: "Other Opponent",
    result_recorded_at: "2026-01-20T18:00:00.000Z",
    matrixWp: 80,
    matrixPredictedWinner: "Alpha Player",
    matrixWpCreatedAt: "2026-01-19T18:00:00.000Z",
    matrixPredictedWinnerCreatedAt: "2026-01-19T18:00:00.000Z",
    ...rest,
  };
}

function supportedRows(player: "Alpha Player" | "Beta Player", count = MIN_SUPPORT_N): ScoredMatchRow[] {
  return Array.from({ length: count }, (_, index) => {
    if (player === "Alpha Player") {
      return row({
        id: `alpha-${index}`,
        actual_winner: player,
        player1_name: player,
        player2_name: `Alpha Opponent ${index}`,
        matrixPredictedWinner: player,
        matrixWp: 80,
      });
    }
    return row({
      id: `beta-${index}`,
      actual_winner: player,
      player1_name: player,
      player2_name: `Beta Opponent ${index}`,
      matrixPredictedWinner: `Beta Opponent ${index}`,
      matrixWp: 70,
    });
  });
}

describe("live audit-DB metric 037/039 adapter", () => {
  it("orients the stored prediction to the requested player and inverts the opponent probability", () => {
    const history = playerScoredHistory([
      row({
        id: "beta-upset",
        player1_name: "Alpha Player",
        player2_name: "Beta Player",
        matrixPredictedWinner: "Alpha Player",
        matrixWp: 80,
        actual_winner: "Beta Player",
      }),
    ], "Beta Player", "2026-02-01");

    expect(history).toHaveLength(1);
    expect(history[0].outcome).toMatchObject({ playerWinProbabilityPct: 20, playerWon: true });
    expect(computeLossWinAutopsy(history[0].outcome).category).toBe("UPSET_WIN");
  });

  it("fails closed on same-day/future results, post-result predictions, and ambiguous winners", () => {
    const history = playerScoredHistory([
      row({ id: "same-day", result_recorded_at: "2026-02-01T01:00:00.000Z" }),
      row({
        id: "post-result-prediction",
        matrixWpCreatedAt: "2026-01-21T18:00:00.000Z",
      }),
      row({
        id: "ambiguous-winner",
        player1_name: "Serena Williams",
        player2_name: "Venus Williams",
        matrixPredictedWinner: "Serena Williams",
        actual_winner: "Williams",
      }),
    ], "Alpha Player", "2026-02-01");

    expect(history).toEqual([]);
  });

  it("builds independently oriented 037 findings from real supported win histories", () => {
    const finding = buildAuditDbCompositeMetricFinding({
      metricCode: "037",
      p1: "Alpha Player",
      p2: "Beta Player",
      asOfDate: "2026-02-01",
      rows: [...supportedRows("Alpha Player"), ...supportedRows("Beta Player")],
    });

    expect(finding).not.toBeNull();
    expect(finding?.p1_treatment).toBe("RECONSTRUCTED");
    expect(finding?.p2_treatment).toBe("RECONSTRUCTED");
    expect(finding?.p1_value).toContain("win autopsy category distribution=DOMINANT:50");
    expect(finding?.p2_value).toContain("win autopsy category distribution=DOMINANT:0,ROUTINE:0,ESCAPE:0,UPSET_WIN:50");
    expect(finding?.p1_value).toContain("final score margin close wins=0/50");
    expect(finding?.sources).toEqual([
      expect.objectContaining({ source_name: "Audit DB completed TennisMatrixAi-scored matches" }),
    ]);
  });

  it("keeps an unsupported player side unavailable instead of copying or fabricating history", () => {
    const finding = buildAuditDbCompositeMetricFinding({
      metricCode: "037",
      p1: "Alpha Player",
      p2: "Beta Player",
      asOfDate: "2026-02-01",
      rows: supportedRows("Alpha Player"),
    });

    expect(finding?.p1_treatment).toBe("RECONSTRUCTED");
    expect(finding?.p2_treatment).toBe("UNAVAILABLE");
    expect(finding?.p2_value).toBeNull();
    expect(finding?.unavailable_reason).toContain("Only 0 prior TennisMatrixAi-scored wins");
  });

  it("builds 039 from the latest actual result and the real rolling last-10 residuals", () => {
    const finding = buildAuditDbCompositeMetricFinding({
      metricCode: "039",
      p1: "Alpha Player",
      p2: "Beta Player",
      asOfDate: "2026-02-01",
      rows: [...supportedRows("Alpha Player"), ...supportedRows("Beta Player")],
    });

    expect(finding?.p1_value).toContain("actual performance=1");
    expect(finding?.p1_value).toContain("pre match expected performance=0.8");
    expect(finding?.p1_value).toContain("performance surprise=+0.2");
    expect(finding?.p1_value).toContain("rolling performance surprise last 10=+0.2");
    expect(finding?.p2_value).toContain("pre match expected performance=0.3");
    expect(finding?.p2_value).toContain("performance surprise=+0.7");
    expect(finding?.p2_value).toContain("rolling absolute surprise last 10=0.7");
  });

  it("collects every stable page before deriving samples beyond the API row cap", async () => {
    const noise = Array.from({ length: AUDIT_DB_PAGE_SIZE }, (_, index) => row({
      id: `noise-${index}`,
      player1_name: "Noise Player",
      player2_name: `Noise Opponent ${index}`,
      matrixPredictedWinner: "Noise Player",
      actual_winner: "Noise Player",
    }));
    const sourceRows = [...noise, ...supportedRows("Alpha Player"), ...supportedRows("Beta Player")];
    const fetched = await collectPaged(
      async (from, to) => sourceRows.slice(from, to + 1),
      AUDIT_DB_PAGE_SIZE,
    );
    const finding = buildAuditDbCompositeMetricFinding({
      metricCode: "039",
      p1: "Alpha Player",
      p2: "Beta Player",
      asOfDate: "2026-02-01",
      rows: fetched,
    });

    expect(fetched).toHaveLength(AUDIT_DB_PAGE_SIZE + MIN_SUPPORT_N * 2);
    expect(finding?.p1_treatment).toBe("RECONSTRUCTED");
    expect(finding?.p2_treatment).toBe("RECONSTRUCTED");
    expect(finding?.sample).toContain(`P1 n=${MIN_SUPPORT_N}; P2 n=${MIN_SUPPORT_N}`);
  });
});