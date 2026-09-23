/**
 * Pure response-shaping for the paper-trading admin API — DB-free by design (same reasoning as
 * eligibility.ts/settlementLogic.ts), so the SHAPE of what the dashboard sees, and specifically
 * the "autonomous Builder pick is a different thing from the validation decision" requirement,
 * is unit-testable directly on constructed fixtures rather than only provable by reading a real
 * HTTP response.
 *
 * Takes the already-fetched DB rows as plain arguments -- never queries anything itself.
 */
import type { ParlayPaperTradeRow, ParlayPaperTradePairRow, ParlayPaperTradeFactorRow, ParlayPaperTradeSnapshotRow } from "@workspace/db";

export interface SideSummary {
  evaluatedSide: "PLAYER_1" | "PLAYER_2";
  selectedPlayerId: string;
  selectedPlayerName: string;
  /** THE trust/validation label -- scoped to selectedPlayerId. NEVER the prospective prediction. */
  decision: string | null;
  selectedPlayerScore: number | null;
  selectedPlayerRiskScore: number | null;
}

export interface PairSummary {
  pairId: string;
  externalFixtureId: string;
  fixtureProvider: string;
  player1Id: string;
  player1Name: string;
  player2Id: string;
  player2Name: string;
  tournamentName: string | null;
  surface: string | null;
  scheduledStartAt: string;
  status: string;
  noDecisionReason: string | null;
  /**
   * THE autonomous prospective prediction -- the Builder's own independent pick, physically
   * agreed by both directional evaluations when the pair is FROZEN. This is what accuracy is
   * graded against; it is deliberately a top-level, differently-named field from either side's
   * `decision`, so a client can never mistake "the Builder validated player X's selection as
   * KEEP" for "the Builder predicts player X wins" -- they are different questions.
   */
  builderPickedPlayerId: string | null;
  builderPickedPlayerName: string | null;
  builderCalibratedProbability: number | null;
  crossSideAgreement: boolean | null;
  crossSideDisagreementReason: string | null;
  sides: { player1: SideSummary; player2: SideSummary };
  actualWinnerId: string | null;
  resultType: string | null;
  gradedCorrect: boolean | null;
}

function toSideSummary(trade: ParlayPaperTradeRow): SideSummary {
  const isPlayer1 = trade.evaluatedSide === "PLAYER_1";
  return {
    evaluatedSide: trade.evaluatedSide as "PLAYER_1" | "PLAYER_2",
    selectedPlayerId: trade.selectedPlayerId,
    selectedPlayerName: isPlayer1 ? trade.player1Name : trade.player2Name,
    decision: trade.decision,
    selectedPlayerScore: trade.selectedPlayerScore,
    selectedPlayerRiskScore: trade.selectedPlayerRiskScore,
  };
}

/**
 * Builds one list-view row from a pair's two sibling trade rows. Throws if the two rows don't
 * actually belong to the same pair or don't cover both sides -- a caller bug (wrong join), not a
 * data state this should ever silently paper over.
 */
export function shapePairSummary(trade1: ParlayPaperTradeRow, trade2: ParlayPaperTradeRow): PairSummary {
  if (trade1.pairId !== trade2.pairId) {
    throw new Error(`shapePairSummary: trade rows belong to different pairs (${trade1.pairId} vs ${trade2.pairId})`);
  }
  const p1 = trade1.evaluatedSide === "PLAYER_1" ? trade1 : trade2;
  const p2 = trade1.evaluatedSide === "PLAYER_2" ? trade1 : trade2;
  if (p1.evaluatedSide !== "PLAYER_1" || p2.evaluatedSide !== "PLAYER_2") {
    throw new Error(`shapePairSummary: pair ${trade1.pairId} does not have exactly one PLAYER_1 and one PLAYER_2 row`);
  }

  const builderPickedPlayerId = p1.builderPickedPlayerId; // agreed value; either side's copy is equally authoritative when FROZEN
  const builderPickedPlayerName =
    builderPickedPlayerId == null ? null
    : builderPickedPlayerId === p1.player1Id ? p1.player1Name
    : builderPickedPlayerId === p1.player2Id ? p1.player2Name
    : null;

  return {
    pairId: p1.pairId,
    externalFixtureId: p1.externalFixtureId,
    fixtureProvider: p1.fixtureProvider,
    player1Id: p1.player1Id,
    player1Name: p1.player1Name,
    player2Id: p1.player2Id,
    player2Name: p1.player2Name,
    tournamentName: p1.tournamentName,
    surface: p1.surface,
    scheduledStartAt: p1.scheduledStartAt.toISOString(),
    status: p1.status,
    noDecisionReason: p1.noDecisionReason,
    builderPickedPlayerId,
    builderPickedPlayerName,
    builderCalibratedProbability: p1.builderCalibratedProbability,
    crossSideAgreement: null, // populated from parlay_paper_trade_pairs by the route (pure function has no DB access)
    crossSideDisagreementReason: null,
    sides: { player1: toSideSummary(p1), player2: toSideSummary(p2) },
    actualWinnerId: p1.actualWinnerId,
    resultType: p1.resultType,
    gradedCorrect: p1.gradedCorrect,
  };
}

/** Attaches the pairs-table integrity fields a route fetches separately (kept out of shapePairSummary itself so that function stays a pure trade-row transform, testable without a pairs row at all). */
export function withCrossSideIntegrity(summary: PairSummary, pairRow: Pick<ParlayPaperTradePairRow, "crossSideAgreement" | "crossSideDisagreementReason">): PairSummary {
  return { ...summary, crossSideAgreement: pairRow.crossSideAgreement, crossSideDisagreementReason: pairRow.crossSideDisagreementReason };
}

export interface PairDetail {
  fixture: {
    externalFixtureId: string; provider: string;
    player1: { id: string; name: string }; player2: { id: string; name: string };
    tournamentName: string | null; tournamentLevel: string | null; round: string | null;
    surface: string | null; matchFormat: string | null; scheduledStartAt: string;
  };
  lifecycle: {
    status: string; discoveredAt: string; decisionCutoffAt: string;
    decisionAt: string | null; frozenAt: string | null; matchStartedAt: string | null;
    outcomeAttachedAt: string | null; gradedAt: string | null; noDecisionReason: string | null;
  };
  /** THE prospective prediction. See PairSummary's doc comment -- never conflate with either side's `decision`. */
  autonomousPrediction: {
    builderPickedPlayerId: string | null; builderPickedPlayerName: string | null;
    builderCalibratedProbability: number | null;
  };
  directionalEvaluations: {
    player1: SideSummary & { rawValidationScore: number | null; dataCoverage: number | null; factors: ParlayPaperTradeFactorRow[] };
    player2: SideSummary & { rawValidationScore: number | null; dataCoverage: number | null; factors: ParlayPaperTradeFactorRow[] };
  };
  integrity: {
    pairId: string; crossSideAgreement: boolean | null; crossSideDisagreementReason: string | null;
    crossSideCheckedAt: string | null; snapshotFingerprint: string | null;
    evidenceCutoff: string | null; evidenceTimestamps: { snapshotCreatedAt: string | null };
  };
  lineage: {
    builderVersion: string | null; builderConfigFingerprint: string | null;
    builderLineageStatus: string | null; builderLineageReason: string | null;
    calibrationModelId: number | null; lineageKey: string; sourceCommit: string;
  };
  outcome: {
    actualWinnerId: string | null; resultType: string | null;
    includedInAccuracy: boolean | null; gradedCorrect: boolean | null;
  };
}

export function shapePairDetail(
  trade1: ParlayPaperTradeRow, trade2: ParlayPaperTradeRow,
  pairRow: ParlayPaperTradePairRow | null,
  snapshotRow: ParlayPaperTradeSnapshotRow | null,
  factors1: ParlayPaperTradeFactorRow[], factors2: ParlayPaperTradeFactorRow[],
): PairDetail {
  const p1 = trade1.evaluatedSide === "PLAYER_1" ? trade1 : trade2;
  const p2 = trade1.evaluatedSide === "PLAYER_2" ? trade1 : trade2;
  if (p1.pairId !== p2.pairId || p1.evaluatedSide !== "PLAYER_1" || p2.evaluatedSide !== "PLAYER_2") {
    throw new Error(`shapePairDetail: rows do not form a valid pair (${trade1.pairId}/${trade1.evaluatedSide}, ${trade2.pairId}/${trade2.evaluatedSide})`);
  }

  const builderPickedPlayerId = p1.builderPickedPlayerId;
  const builderPickedPlayerName =
    builderPickedPlayerId == null ? null
    : builderPickedPlayerId === p1.player1Id ? p1.player1Name
    : builderPickedPlayerId === p1.player2Id ? p1.player2Name
    : null;

  return {
    fixture: {
      externalFixtureId: p1.externalFixtureId, provider: p1.fixtureProvider,
      player1: { id: p1.player1Id, name: p1.player1Name }, player2: { id: p1.player2Id, name: p1.player2Name },
      tournamentName: p1.tournamentName, tournamentLevel: p1.tournamentLevel, round: p1.round,
      surface: p1.surface, matchFormat: p1.matchFormat, scheduledStartAt: p1.scheduledStartAt.toISOString(),
    },
    lifecycle: {
      status: p1.status, discoveredAt: p1.discoveredAt.toISOString(), decisionCutoffAt: p1.decisionCutoffAt.toISOString(),
      decisionAt: p1.decisionAt?.toISOString() ?? null, frozenAt: p1.frozenAt?.toISOString() ?? null,
      matchStartedAt: p1.matchStartedAt?.toISOString() ?? null, outcomeAttachedAt: p1.outcomeAttachedAt?.toISOString() ?? null,
      gradedAt: p1.gradedAt?.toISOString() ?? null, noDecisionReason: p1.noDecisionReason,
    },
    autonomousPrediction: { builderPickedPlayerId, builderPickedPlayerName, builderCalibratedProbability: p1.builderCalibratedProbability },
    directionalEvaluations: {
      player1: { ...toSideSummary(p1), rawValidationScore: p1.rawValidationScore, dataCoverage: p1.dataCoverage, factors: factors1 },
      player2: { ...toSideSummary(p2), rawValidationScore: p2.rawValidationScore, dataCoverage: p2.dataCoverage, factors: factors2 },
    },
    integrity: {
      pairId: p1.pairId,
      crossSideAgreement: pairRow?.crossSideAgreement ?? null,
      crossSideDisagreementReason: pairRow?.crossSideDisagreementReason ?? null,
      crossSideCheckedAt: pairRow?.crossSideCheckedAt?.toISOString() ?? null,
      snapshotFingerprint: p1.snapshotFingerprint,
      evidenceCutoff: snapshotRow?.effectiveCeiling?.toISOString() ?? null,
      evidenceTimestamps: { snapshotCreatedAt: snapshotRow?.createdAt?.toISOString() ?? null },
    },
    lineage: {
      builderVersion: p1.builderVersion, builderConfigFingerprint: p1.builderConfigFingerprint,
      builderLineageStatus: p1.builderLineageStatus, builderLineageReason: p1.builderLineageReason,
      calibrationModelId: p1.calibrationModelId, lineageKey: p1.lineageKey, sourceCommit: p1.sourceCommit,
    },
    outcome: {
      actualWinnerId: p1.actualWinnerId, resultType: p1.resultType,
      includedInAccuracy: p1.includedInAccuracy, gradedCorrect: p1.gradedCorrect,
    },
  };
}
