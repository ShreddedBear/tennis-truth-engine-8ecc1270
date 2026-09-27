import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  deriveResultType,
  isSettlementTimeReady,
  isValidSettlementPair,
  isVoidResult,
  gradePaperTrade,
  hasMatchStarted,
  isBeforeScheduledStart,
  reconcileHistoricalWithLiveResult,
  resolveLiveSettlementCandidate,
  resolveSettlementCandidate,
  shouldUseHistoricalSettlementFallback,
  SETTLEMENT_MATCH_TIME_WINDOW_MS,
  type LiveSettlementCandidate,
  type SettlementPairMember,
  type SettlementCandidate,
} from "./settlementLogic.js";

describe("deriveResultType", () => {
  it("normal when no flags set", () => {
    assert.strictEqual(deriveResultType({ cancelled: false, walkover: false, retired: false }), "normal");
  });
  it("cancelled takes priority over walkover and retired", () => {
    assert.strictEqual(deriveResultType({ cancelled: true, walkover: true, retired: true }), "cancelled");
  });
  it("walkover takes priority over retired", () => {
    assert.strictEqual(deriveResultType({ cancelled: false, walkover: true, retired: true }), "walkover");
  });
  it("retired when only retired is set", () => {
    assert.strictEqual(deriveResultType({ cancelled: false, walkover: false, retired: true }), "retired");
  });
});

describe("isVoidResult", () => {
  it("cancelled and walkover are void", () => {
    assert.strictEqual(isVoidResult("cancelled"), true);
    assert.strictEqual(isVoidResult("walkover"), true);
  });
  it("retired is NOT void — a retired-match win still counts (matches Research V1's established convention)", () => {
    assert.strictEqual(isVoidResult("retired"), false);
  });
  it("normal is not void", () => {
    assert.strictEqual(isVoidResult("normal"), false);
  });
});

describe("gradePaperTrade — THE central rule: grades builderPickedPlayerId, nothing else", () => {
  it("correct when actualWinnerId equals builderPickedPlayerId", () => {
    const result = gradePaperTrade({ builderPickedPlayerId: "p1", actualWinnerId: "p1", resultType: "normal" });
    assert.deepStrictEqual(result, { includedInAccuracy: true, gradedCorrect: true });
  });

  it("incorrect when actualWinnerId differs from builderPickedPlayerId", () => {
    const result = gradePaperTrade({ builderPickedPlayerId: "p1", actualWinnerId: "p2", resultType: "normal" });
    assert.deepStrictEqual(result, { includedInAccuracy: true, gradedCorrect: false });
  });

  // THE explicit wrong-side trap the user asked for: construct a synthetic scenario where
  // actual_winner_id equals the EVALUATED/SELECTED player but DIFFERS from
  // builder_picked_player_id, and confirm the trade grades INCORRECT. This proves the old
  // human-selection semantics (builder_decision_log/parlay_leg_outcomes' "did the caller's pick
  // win") cannot accidentally leak into this autonomous accuracy calculation, which must never
  // reference selectedPlayerId at all.
  it("WRONG-SIDE TRAP: actualWinnerId equals selectedPlayerId but differs from builderPickedPlayerId -> graded INCORRECT", () => {
    const selectedPlayerId = "playerA"; // the nominal "evaluated" player for this row/side
    const builderPickedPlayerId = "playerB"; // the Builder's own independent pick, THE prediction
    const actualWinnerId = "playerA"; // the match's real winner happens to equal selectedPlayerId

    // If grading ever accidentally compared against selectedPlayerId (the old validate-a-pick
    // semantics) instead of builderPickedPlayerId, this would incorrectly grade "correct" --
    // grading must not even receive selectedPlayerId as an input.
    const result = gradePaperTrade({ builderPickedPlayerId, actualWinnerId, resultType: "normal" });
    assert.strictEqual(result.gradedCorrect, false,
      "grading must compare against builderPickedPlayerId only -- actualWinnerId matching selectedPlayerId must NOT count as correct");
    assert.strictEqual(result.includedInAccuracy, true);
    // GradingInput's type has no selectedPlayerId field at all -- it is structurally impossible
    // to pass one in, which is the real, compile-time-enforced guarantee this test documents.
  });

  it("not yet gradeable: actualWinnerId is null (match not settled)", () => {
    const result = gradePaperTrade({ builderPickedPlayerId: "p1", actualWinnerId: null, resultType: "normal" });
    assert.deepStrictEqual(result, { includedInAccuracy: false, gradedCorrect: null });
  });

  it("cancelled match excluded from accuracy, not counted as wrong", () => {
    const result = gradePaperTrade({ builderPickedPlayerId: "p1", actualWinnerId: "p2", resultType: "cancelled" });
    assert.deepStrictEqual(result, { includedInAccuracy: false, gradedCorrect: null });
  });

  it("walkover excluded from accuracy, not counted as wrong", () => {
    const result = gradePaperTrade({ builderPickedPlayerId: "p1", actualWinnerId: "p2", resultType: "walkover" });
    assert.deepStrictEqual(result, { includedInAccuracy: false, gradedCorrect: null });
  });

  it("retired match IS graded (not void) — a retired-match win still counts", () => {
    const result = gradePaperTrade({ builderPickedPlayerId: "p1", actualWinnerId: "p1", resultType: "retired" });
    assert.deepStrictEqual(result, { includedInAccuracy: true, gradedCorrect: true });
  });
});

describe("hasMatchStarted", () => {
  const scheduled = new Date("2026-09-23T12:00:00Z");
  it("false before scheduled start", () => {
    assert.strictEqual(hasMatchStarted(scheduled, new Date(scheduled.getTime() - 1)), false);
  });
  it("true exactly at scheduled start", () => {
    assert.strictEqual(hasMatchStarted(scheduled, new Date(scheduled.getTime())), true);
  });
  it("true after scheduled start", () => {
    assert.strictEqual(hasMatchStarted(scheduled, new Date(scheduled.getTime() + 1)), true);
  });
});

describe("isBeforeScheduledStart", () => {
  const scheduled = new Date("2026-09-23T12:00:00Z");
  it("allows only a database timestamp strictly before start", () => {
    assert.equal(isBeforeScheduledStart(scheduled, new Date(scheduled.getTime() - 1)), true);
    assert.equal(isBeforeScheduledStart(scheduled, scheduled), false);
    assert.equal(isBeforeScheduledStart(scheduled, new Date(scheduled.getTime() + 1)), false);
  });
});

describe("isSettlementTimeReady", () => {
  const scheduled = new Date("2026-09-23T12:00:00Z");
  it("requires the frozen fixture and matched result scheduled times to have both arrived", () => {
    assert.equal(isSettlementTimeReady(scheduled, scheduled, scheduled), true);
    assert.equal(isSettlementTimeReady(scheduled, new Date(scheduled.getTime() + 1), scheduled), false);
    assert.equal(isSettlementTimeReady(new Date(scheduled.getTime() + 1), scheduled, scheduled), false);
    assert.equal(
      isSettlementTimeReady(scheduled, new Date(scheduled.getTime() + 1), new Date(scheduled.getTime() + 1)),
      true,
    );
  });
});

describe("isValidSettlementPair", () => {
  const scheduled = new Date("2026-09-23T12:00:00Z");
  const base: SettlementPairMember[] = [
    {
      pairId: "pair-1",
      externalFixtureId: "fixture-1",
      fixtureProvider: "Live Tennis API",
      player1Id: "provider-a",
      player2Id: "provider-b",
      scheduledStartAt: scheduled,
      tournamentName: "Example Open",
      surface: "Hard",
      evaluatedSide: "PLAYER_1",
      selectedPlayerId: "provider-a",
      opposingPlayerId: "provider-b",
      status: "FROZEN",
      builderPickedPlayerId: "provider-b",
      actualWinnerId: null,
    },
    {
      pairId: "pair-1",
      externalFixtureId: "fixture-1",
      fixtureProvider: "Live Tennis API",
      player1Id: "provider-a",
      player2Id: "provider-b",
      scheduledStartAt: scheduled,
      tournamentName: "Example Open",
      surface: "Hard",
      evaluatedSide: "PLAYER_2",
      selectedPlayerId: "provider-b",
      opposingPlayerId: "provider-a",
      status: "FROZEN",
      builderPickedPlayerId: "provider-b",
      actualWinnerId: null,
    },
  ];

  it("accepts exactly one coherent row for each side", () => {
    assert.equal(isValidSettlementPair(base), true);
  });

  it("rejects duplicate sides, fixture mismatches, asymmetric picks, or settled rows", () => {
    assert.equal(isValidSettlementPair([base[0], { ...base[1], evaluatedSide: "PLAYER_1" }]), false);
    assert.equal(isValidSettlementPair([base[0], { ...base[1], fixtureProvider: "API-Tennis" }]), false);
    assert.equal(isValidSettlementPair([base[0], { ...base[1], scheduledStartAt: new Date(scheduled.getTime() + 1) }]), false);
    assert.equal(isValidSettlementPair([base[0], { ...base[1], builderPickedPlayerId: "provider-a" }]), false);
    assert.equal(isValidSettlementPair([base[0], { ...base[1], actualWinnerId: "provider-b" }]), false);
  });
});

describe("resolveSettlementCandidate", () => {
  const scheduled = new Date("2026-09-23T12:00:00Z");
  const base: SettlementCandidate = {
    provider: "Live Tennis API",
    player1_id: "canonical-a",
    player2_id: "canonical-b",
    winner_id: "canonical-a",
    scheduled_start_at: scheduled,
    retired: false,
    walkover: false,
    cancelled: false,
    tournament_name: "Example Open",
    surface: "Hard",
  };
  const resolve = (candidates: SettlementCandidate[]) => resolveSettlementCandidate({
    candidates,
    provider: "Live Tennis API",
    player1Id: "canonical-a",
    player2Id: "canonical-b",
    scheduledStartAt: scheduled,
    tournamentName: "Example Open",
    surface: "Hard",
  });

  it("settles a unique result matched by exact canonical IDs and fixture metadata", () => {
    assert.deepEqual(resolve([base]), { kind: "settled", match: base });
  });

  it("holds when multiple plausible results exist instead of choosing the first", () => {
    assert.deepEqual(resolve([base, { ...base, scheduled_start_at: new Date(scheduled.getTime() + 60_000) }]), {
      kind: "ambiguous",
      candidateCount: 2,
    });
  });

  it("keeps missing, foreign, or cancelled winners pending", () => {
    assert.deepEqual(resolve([{ ...base, winner_id: null }]), { kind: "pending" });
    assert.deepEqual(resolve([{ ...base, winner_id: "someone-else" }]), { kind: "pending" });
    assert.deepEqual(resolve([{ ...base, cancelled: true }]), { kind: "pending" });
  });

  it("does not resolve mismatched players, time, tournament, or surface", () => {
    assert.deepEqual(resolve([{ ...base, player1_id: "name:Alex Player" }]), { kind: "pending" });
    assert.deepEqual(resolve([{ ...base, scheduled_start_at: new Date(scheduled.getTime() + 25 * 60 * 60 * 1000) }]), { kind: "pending" });
    assert.deepEqual(resolve([{ ...base, tournament_name: "Different Open" }]), { kind: "pending" });
    assert.deepEqual(resolve([{ ...base, surface: "Clay" }]), { kind: "pending" });
  });

  it("does not confuse a same-player rematch more than six hours later with this fixture", () => {
    const rematch = {
      ...base,
      id: 12,
      scheduled_start_at: new Date(scheduled.getTime() + SETTLEMENT_MATCH_TIME_WINDOW_MS + 60 * 60 * 1000),
    };
    assert.deepEqual(resolve([base, rematch]), { kind: "settled", match: base });
  });

  it("does not resolve a historical candidate from a different provider ID namespace", () => {
    assert.deepEqual(resolve([{ ...base, provider: "API-Tennis" }]), { kind: "pending" });
  });
});

describe("resolveLiveSettlementCandidate", () => {
  const scheduled = new Date("2026-09-23T12:00:00Z");
  const base: LiveSettlementCandidate = {
    provider: "Live Tennis API",
    externalId: "fixture-123",
    providerPlayer1Id: "provider-a",
    providerPlayer2Id: "provider-b",
    canonicalPlayer1Id: "canonical-a",
    canonicalPlayer2Id: "canonical-b",
    canonicalWinnerId: "canonical-b",
    terminalResultType: "finished",
    scheduledStartAt: scheduled,
    tournamentName: "Example Open",
    surface: "Hard",
  };
  const resolve = (candidates: LiveSettlementCandidate[]) => resolveLiveSettlementCandidate({
    candidates,
    provider: "Live Tennis API",
    // Deliberately reversed from the stored result row.
    providerPlayer1Id: "provider-b",
    providerPlayer2Id: "provider-a",
    scheduledStartAt: scheduled,
    tournamentName: "Example Open",
    surface: "Hard",
  });

  it("maps a canonical winner through the verified provider-player slot before Builder grading", () => {
    const result = resolve([base]);
    assert.deepEqual(result, {
      kind: "settled",
      candidate: base,
      providerWinnerId: "provider-b",
      resultType: "normal",
    });
    if (result.kind !== "settled") throw new Error("expected a uniquely resolved result");
    assert.equal(
      gradePaperTrade({
        builderPickedPlayerId: "provider-b",
        actualWinnerId: result.providerWinnerId,
        resultType: result.resultType,
      }).gradedCorrect,
      true,
    );
    assert.equal(
      gradePaperTrade({
        builderPickedPlayerId: "provider-b",
        actualWinnerId: result.candidate.canonicalWinnerId,
        resultType: result.resultType,
      }).gradedCorrect,
      false,
      "canonical IDs must never be compared directly with Builder provider IDs",
    );
  });

  it("fails closed on multiple plausible live results and provider namespace mismatches", () => {
    assert.deepEqual(resolve([base, { ...base, externalId: "fixture-456" }]), {
      kind: "ambiguous",
      candidateCount: 2,
    });
    const wrongProvider = resolveLiveSettlementCandidate({
      candidates: [base],
      provider: "Different Provider",
      providerPlayer1Id: "provider-b",
      providerPlayer2Id: "provider-a",
      scheduledStartAt: scheduled,
      tournamentName: "Example Open",
      surface: "Hard",
    });
    assert.deepEqual(wrongProvider, { kind: "pending", candidateCount: 0 });
  });

  it("holds a live candidate with mismatched comparable fixture metadata", () => {
    assert.deepEqual(resolve([{ ...base, surface: "Clay" }]), {
      kind: "pending",
      candidateCount: 1,
    });
  });

  it("does not treat a same-player rematch outside six hours as this live fixture", () => {
    const rematch = {
      ...base,
      externalId: "fixture-rematch",
      scheduledStartAt: new Date(scheduled.getTime() + SETTLEMENT_MATCH_TIME_WINDOW_MS + 60 * 60 * 1000),
    };
    assert.deepEqual(resolve([base, rematch]), {
      kind: "settled",
      candidate: base,
      providerWinnerId: "provider-b",
      resultType: "normal",
    });
  });

  it("uses historical fallback only when no live provider result exists", () => {
    assert.equal(shouldUseHistoricalSettlementFallback({ kind: "pending", candidateCount: 0 }), true);
    assert.equal(shouldUseHistoricalSettlementFallback({ kind: "pending", candidateCount: 1 }), false);
    assert.equal(shouldUseHistoricalSettlementFallback({ kind: "ambiguous", candidateCount: 2 }), false);
  });
});

describe("reconcileHistoricalWithLiveResult", () => {
  const scheduled = new Date("2026-09-23T12:00:00Z");
  const live: LiveSettlementCandidate = {
    provider: "Live Tennis API",
    externalId: "fixture-123",
    providerPlayer1Id: "provider-a",
    providerPlayer2Id: "provider-b",
    canonicalPlayer1Id: "canonical-a",
    canonicalPlayer2Id: "canonical-b",
    canonicalWinnerId: "canonical-b",
    terminalResultType: "finished",
    scheduledStartAt: scheduled,
    tournamentName: "Example Open",
    surface: "Hard",
  };
  const baseHistory: SettlementCandidate = {
    id: 11,
    provider: "Live Tennis API",
    player1_id: "canonical-a",
    player2_id: "canonical-b",
    winner_id: "canonical-b",
    scheduled_start_at: scheduled,
    retired: false,
    walkover: false,
    cancelled: false,
    tournament_name: "Example Open",
    surface: "Hard",
  };
  const reconcile = (historicalCandidates: SettlementCandidate[]) => reconcileHistoricalWithLiveResult({
    historicalCandidates,
    liveCandidate: live,
    providerWinnerId: "provider-b",
    scheduledStartAt: scheduled,
    tournamentName: "Example Open",
    surface: "Hard",
  });

  it("allows agreeing canonical historical evidence", () => {
    assert.equal(reconcile([baseHistory]), "consistent");
  });

  it("holds conflicting historical winner evidence rather than preferring live or history", () => {
    assert.equal(reconcile([{ ...baseHistory, winner_id: "canonical-a" }]), "conflict");
  });

  it("holds ambiguous historical evidence", () => {
    assert.equal(reconcile([
      baseHistory,
      { ...baseHistory, id: 12, scheduled_start_at: new Date(scheduled.getTime() + 60_000) },
    ]), "ambiguous");
  });
});
