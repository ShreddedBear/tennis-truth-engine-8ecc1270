import { describe, expect, it, vi } from "vitest";
import { resultStatusFromHistory, repositoryFinalResult } from "./match-result-capture.server";

describe("resultStatusFromHistory -- FINAL/RETIRED/WALKOVER policy", () => {
  it("no status and no unusual score text resolves FINAL (a recorded row means the match was played)", () => {
    expect(resultStatusFromHistory({ status: null, raw_score: "6-4 6-3" })).toBe("FINAL");
  });

  it("an explicit FINISHED/COMPLETE(D) status resolves FINAL", () => {
    expect(resultStatusFromHistory({ status: "FINISHED", raw_score: "6-4 6-3" })).toBe("FINAL");
    expect(resultStatusFromHistory({ status: "COMPLETED", raw_score: "6-4 6-3" })).toBe("FINAL");
  });

  it("'ret.'/'rtd'/'retire' in the raw score resolves RETIRED, per the existing calibration policy that counts retirements as real graded results", () => {
    expect(resultStatusFromHistory({ status: null, raw_score: "6-4 3-2 ret." })).toBe("RETIRED");
    expect(resultStatusFromHistory({ status: null, raw_score: "6-4 3-2 rtd" })).toBe("RETIRED");
  });

  it("'w/o', 'walkover', 'def.', or 'default' in the raw score resolves WALKOVER -- a winner is named but no match was played", () => {
    expect(resultStatusFromHistory({ status: null, raw_score: "w/o" })).toBe("WALKOVER");
    expect(resultStatusFromHistory({ status: null, raw_score: "walkover" })).toBe("WALKOVER");
    expect(resultStatusFromHistory({ status: null, raw_score: "def." })).toBe("WALKOVER");
  });

  it("CANCELLED/POSTPONED/ABANDONED status values pass through, with CANCELED normalized to CANCELLED", () => {
    expect(resultStatusFromHistory({ status: "POSTPONED", raw_score: null })).toBe("POSTPONED");
    expect(resultStatusFromHistory({ status: "ABANDONED", raw_score: null })).toBe("ABANDONED");
    expect(resultStatusFromHistory({ status: "CANCELED", raw_score: null })).toBe("CANCELLED");
  });

  it("an unrecognized status returns null rather than guessing", () => {
    expect(resultStatusFromHistory({ status: "SOMETHING_UNEXPECTED", raw_score: null })).toBeNull();
  });

  it("an undefined detail (no history row at all) returns FINAL, matching the same 'a row means it was played' reading", () => {
    expect(resultStatusFromHistory(undefined)).toBe("FINAL");
  });
});

describe("repositoryFinalResult -- reads the repository's own history, never fabricates", () => {
  const match = { player1_name: "Carlos Alcaraz", player2_name: "Jannik Sinner", scheduled_date: "2026-06-15" };

  it("returns null for a malformed/missing scheduled_date rather than searching with a bad key", () => {
    expect(repositoryFinalResult({ ...match, scheduled_date: null })).toBeNull();
    expect(repositoryFinalResult({ ...match, scheduled_date: "not-a-date" })).toBeNull();
  });

  it("returns null when the history store has no rows for this date at all", () => {
    vi.doMock("./repository-results-history.server", () => ({ repositoryResultsRows: () => [] }));
    vi.resetModules();
    return import("./match-result-capture.server").then(({ repositoryFinalResult: fresh }) => {
      expect(fresh(match)).toBeNull();
      vi.doUnmock("./repository-results-history.server");
    });
  });

  it("two independent rows agreeing on the winner and status resolve to a single FINAL result", () => {
    vi.doMock("./repository-results-history.server", () => ({
      repositoryResultsRows: (player: string) => [{
        event_date: "2026-06-15",
        opponent_name: player === "Carlos Alcaraz" ? "Jannik Sinner" : "Carlos Alcaraz",
        raw_payload: { winner: "Carlos Alcaraz", history_detail: { status: null, raw_score: "6-4 6-3" } },
      }],
    }));
    vi.resetModules();
    return import("./match-result-capture.server").then(({ repositoryFinalResult: fresh }) => {
      const result = fresh(match);
      expect(result?.actual_winner).toBe("Carlos Alcaraz");
      expect(result?.result_status).toBe("FINAL");
      expect(result?.final_score).toBe("6-4 6-3");
      vi.doUnmock("./repository-results-history.server");
    });
  });

  it("conflicting sources about who won leave the match open rather than picking one", () => {
    vi.doMock("./repository-results-history.server", () => ({
      repositoryResultsRows: (player: string) => [{
        event_date: "2026-06-15",
        opponent_name: player === "Carlos Alcaraz" ? "Jannik Sinner" : "Carlos Alcaraz",
        // Both searches report themselves as the winner -- an irreconcilable conflict.
        raw_payload: { winner: player, history_detail: { status: null, raw_score: "6-4 6-3" } },
      }],
    }));
    vi.resetModules();
    return import("./match-result-capture.server").then(({ repositoryFinalResult: fresh }) => {
      expect(fresh(match)).toBeNull();
      vi.doUnmock("./repository-results-history.server");
    });
  });
});
