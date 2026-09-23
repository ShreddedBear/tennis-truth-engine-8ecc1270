/**
 * The write path: turns one upcoming fixture into a frozen, immutable, double-sided
 * paper-trade record (or an explicit INELIGIBLE/NO_DECISION/DATA_ERROR record — never a
 * silent skip for a fixture with a known scheduled start).
 *
 * The full chain this module proves, end to end:
 *   fixture -> eligibility -> ONE evidence acquisition -> immutable snapshot
 *     -> Player 1 scoring + Player 2 scoring -> cross-side agreement -> frozen prediction
 *
 * Match-start / outcome-settlement / grading are separate, later steps (see settlement.ts) --
 * this module only ever creates rows in DISCOVERED..FROZEN/INELIGIBLE/NO_DECISION/DATA_ERROR
 * states, never STARTED/COMPLETED/GRADED.
 *
 * A fixture with NO confirmed scheduled start is not persisted at all (mirrors the existing
 * Prediction Engine paper-trading cycle's identical guard, `paperTrading.ts`'s
 * `if (!fixture.timeConfirmed || !fixture.scheduledStart) continue`) -- it will naturally be
 * reconsidered next cycle once the provider publishes a real time.
 */
import { randomUUID } from "node:crypto";
import { createHash } from "node:crypto";
import { db, parlayPaperTradesTable, parlayPaperTradePairsTable, parlayPaperTradeFactorsTable, parlayPaperTradeSnapshotsTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { computeBuilderScoreBothSides, type BuilderResult, type BuilderEvidenceBundle } from "../parlayBuilder/builderScoringService.js";
import { checkPaperTradeEligibility, type EligibilityFixtureInput, type PaperTradeEligibilityReason } from "./eligibility.js";
import { resolveLiveBuilderLineage } from "./builderLineage.js";
import { deriveCrossSideAgreement } from "./crossSideAgreement.js";

export interface PaperTradeFixtureInput extends EligibilityFixtureInput {
  fixtureProvider: string;
  tournamentName: string | null;
  tournamentLevel: string | null;
  round: string | null;
  surface: string | null;
  matchFormat: string | null;
}

export type PaperTradeOutcome =
  | { kind: "skipped_no_schedule" }
  | { kind: "ineligible"; reason: PaperTradeEligibilityReason; pairId: string | null }
  | { kind: "data_error"; pairId: string; detail: string }
  | { kind: "frozen"; pairId: string; player1TradeId: string; player2TradeId: string };

function canonicalFingerprint(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

/**
 * Pure status derivation for a completed double-sided evaluation. Fails closed: a genuine
 * cross-side disagreement (or both sides independently reporting DATA_UNAVAILABLE) is never
 * resolved by picking one side -- both rows get the SAME terminal status, both raw evaluations
 * are preserved for audit either way (the caller always persists both), and neither counts as a
 * normal accuracy observation (status is never FROZEN in either failure case).
 */
export function deriveFinalStatus(
  resultPlayer1: Pick<BuilderResult, "decision">,
  resultPlayer2: Pick<BuilderResult, "decision">,
  crossSide: ReturnType<typeof deriveCrossSideAgreement>,
): { status: "FROZEN" | "DATA_ERROR" | "NO_DECISION"; noDecisionReason: string | null } {
  // EITHER side (not just both) being DATA_UNAVAILABLE means at least one evaluation never got
  // real evidence -- its builderPickedPlayerId is a hardcoded fallback (= its own
  // selectedPlayerId, validationScore/probability forced to 0), not a genuine computed pick. Any
  // "agreement" involving that side is coincidental, not a real confirmation, so this check
  // fires before crossSide is even consulted.
  const anyDataUnavailable = resultPlayer1.decision === "DATA_UNAVAILABLE" || resultPlayer2.decision === "DATA_UNAVAILABLE";
  if (anyDataUnavailable) return { status: "NO_DECISION", noDecisionReason: "BUILDER_DATA_UNAVAILABLE" };
  if (!crossSide.agreement) return { status: "DATA_ERROR", noDecisionReason: crossSide.reason };
  return { status: "FROZEN", noDecisionReason: null };
}

/**
 * Looks up whether a paper trade already exists for this fixture under the CURRENT Builder
 * lineage (a config or calibration change starts a new lineage, so a prior lineage's trade for
 * the same fixture never counts as a duplicate against a fresh one).
 */
async function duplicateExists(externalFixtureId: string, lineageKey: string): Promise<boolean> {
  const rows = await db
    .select({ id: parlayPaperTradesTable.id })
    .from(parlayPaperTradesTable)
    .where(and(
      eq(parlayPaperTradesTable.externalFixtureId, externalFixtureId),
      eq(parlayPaperTradesTable.lineageKey, lineageKey),
    ))
    .limit(1);
  return rows.length > 0;
}

export async function discoverAndDecidePaperTrade(
  fixture: PaperTradeFixtureInput,
  sourceCommit: string,
): Promise<PaperTradeOutcome> {
  if (!fixture.timeConfirmed || fixture.scheduledStart == null || Number.isNaN(fixture.scheduledStart.getTime())) {
    return { kind: "skipped_no_schedule" };
  }

  const lineage = await resolveLiveBuilderLineage();
  const isDuplicate = await duplicateExists(fixture.externalFixtureId, lineage.lineageKey);

  const eligibility = checkPaperTradeEligibility({
    fixture,
    now: new Date(),
    duplicateExists: isDuplicate,
    providerReachable: true,
  });

  const pairId = randomUUID();
  const commonFixtureColumns = {
    pairId,
    externalFixtureId: fixture.externalFixtureId,
    fixtureProvider: fixture.fixtureProvider,
    player1Id: fixture.player1Id ?? "unknown",
    player1Name: fixture.player1Name ?? "unknown",
    player2Id: fixture.player2Id ?? "unknown",
    player2Name: fixture.player2Name ?? "unknown",
    tournamentName: fixture.tournamentName,
    tournamentLevel: fixture.tournamentLevel,
    round: fixture.round,
    surface: fixture.surface,
    matchFormat: fixture.matchFormat,
    scheduledStartAt: fixture.scheduledStart,
    builderVersion: lineage.builderVersion,
    builderConfigFingerprint: lineage.builderConfigFingerprint,
    builderLineageStatus: lineage.builderLineageStatus,
    builderLineageReason: lineage.builderLineageReason,
    calibrationModelId: lineage.calibrationModelId,
    lineageKey: lineage.lineageKey,
    sourceCommit,
  };

  if (!eligibility.eligible) {
    if (eligibility.reason === "DUPLICATE_FIXTURE") {
      // A row (or pair of rows) already exists for this exact (external_fixture_id,
      // evaluated_side, lineage_key) -- that IS the duplicate-protection unique index.
      // Inserting anything else keyed the same way would collide with it directly (confirmed
      // by the acceptance test: attempting this threw a raw Postgres 23505 instead of failing
      // gracefully). Nothing new to record; the original row already carries the real outcome.
      return { kind: "ineligible", reason: "DUPLICATE_FIXTURE", pairId: null };
    }
    // Every other rejection reason is for a fixture that has never been written before, so it
    // gets two sibling rows (kept structurally identical to a real pair, so "always two rows
    // per pair" holds everywhere) -- both immediately frozen, since there is no decision in
    // progress to protect.
    const now = new Date();
    await db.transaction(async (tx) => {
      for (const side of ["PLAYER_1", "PLAYER_2"] as const) {
        await tx.insert(parlayPaperTradesTable).values({
          ...commonFixtureColumns,
          paperTradeId: randomUUID(),
          evaluatedSide: side,
          selectedPlayerId: side === "PLAYER_1" ? commonFixtureColumns.player1Id : commonFixtureColumns.player2Id,
          opposingPlayerId: side === "PLAYER_1" ? commonFixtureColumns.player2Id : commonFixtureColumns.player1Id,
          status: eligibility.reason === "MATCH_ALREADY_STARTED" ? "NO_DECISION" : "INELIGIBLE",
          noDecisionReason: eligibility.reason,
          decisionCutoffAt: new Date(fixture.scheduledStart!.getTime() - 1),
          frozenAt: now,
        });
      }
    });
    return { kind: "ineligible", reason: eligibility.reason, pairId };
  }

  const evaluation = await computeBuilderScoreBothSides({
    player1Id: commonFixtureColumns.player1Id,
    player1Name: commonFixtureColumns.player1Name,
    player2Id: commonFixtureColumns.player2Id,
    player2Name: commonFixtureColumns.player2Name,
    surface: fixture.surface,
    tournamentName: fixture.tournamentName,
    scheduledStart: fixture.scheduledStart,
    // asOfDate intentionally omitted -- live mode, exactly like /admin/parlay/validate.
  });

  const crossSide = deriveCrossSideAgreement(evaluation.resultPlayer1, evaluation.resultPlayer2);
  const { status: finalStatusFromResults, noDecisionReason: noDecisionReasonFromResults } = deriveFinalStatus(
    evaluation.resultPlayer1, evaluation.resultPlayer2, crossSide,
  );

  const snapshotFingerprint = canonicalFingerprint({
    effectiveCeiling: evaluation.evidence.effectiveCeiling.toISOString(),
    matches1: evaluation.evidence.matches1,
    matches2: evaluation.evidence.matches2,
    h2hMatches: evaluation.evidence.h2hMatches,
    player1MarketOdds: evaluation.evidence.player1MarketOdds,
    player2MarketOdds: evaluation.evidence.player2MarketOdds,
    webResearch1: evaluation.evidence.webResearch1,
    webResearch2: evaluation.evidence.webResearch2,
  });

  const now = new Date();
  const finalStatus = finalStatusFromResults;
  const noDecisionReason = noDecisionReasonFromResults;

  const player1TradeId = randomUUID();
  const player2TradeId = randomUUID();

  await db.transaction(async (tx) => {
    await tx.insert(parlayPaperTradeSnapshotsTable).values({
      pairId,
      effectiveCeiling: evaluation.evidence.effectiveCeiling,
      player1MatchRows: evaluation.evidence.matches1 as unknown as object,
      player2MatchRows: evaluation.evidence.matches2 as unknown as object,
      h2hRows: evaluation.evidence.h2hMatches as unknown as object,
      marketOddsRaw: { player1DecimalOdds: evaluation.evidence.player1MarketOdds, player2DecimalOdds: evaluation.evidence.player2MarketOdds },
      injuryResearchRaw: { player1: evaluation.evidence.webResearch1, player2: evaluation.evidence.webResearch2, confidence: evaluation.evidence.webResearchConfidence },
      matchstatRaw: { player1: evaluation.evidence.matchstat1, player2: evaluation.evidence.matchstat2 },
      fingerprint: snapshotFingerprint,
    });

    for (const [side, tradeId, result] of [
      ["PLAYER_1", player1TradeId, evaluation.resultPlayer1],
      ["PLAYER_2", player2TradeId, evaluation.resultPlayer2],
    ] as const) {
      await tx.insert(parlayPaperTradesTable).values({
        ...commonFixtureColumns,
        paperTradeId: tradeId,
        evaluatedSide: side,
        selectedPlayerId: side === "PLAYER_1" ? commonFixtureColumns.player1Id : commonFixtureColumns.player2Id,
        opposingPlayerId: side === "PLAYER_1" ? commonFixtureColumns.player2Id : commonFixtureColumns.player1Id,
        status: finalStatus,
        noDecisionReason,
        decisionCutoffAt: eligibility.decisionCutoffAt,
        decisionAt: now,
        frozenAt: now,
        decision: result.decision,
        selectedPlayerScore: result.validationScore,
        selectedPlayerRiskScore: result.riskScore,
        builderPickedPlayerId: result.builderPickedPlayerId,
        builderCalibratedProbability: result.builderCalibratedProbability,
        rawValidationScore: result.rawValidationScore,
        dataCoverage: result.dataCoverage,
        snapshotFingerprint,
      });

      for (const factor of result.factorScores) {
        await tx.insert(parlayPaperTradeFactorsTable).values({
          paperTradeId: tradeId,
          factorKey: factor.key,
          factorLabel: factor.label,
          score: factor.score,
          weight: factor.weight,
          status: factor.status,
          supportsSelected: factor.supportsSelected,
          detail: factor.detail,
        });
      }
    }

    await tx.insert(parlayPaperTradePairsTable).values({
      pairId,
      externalFixtureId: fixture.externalFixtureId,
      lineageKey: lineage.lineageKey,
      player1TradeId,
      player2TradeId,
      crossSideAgreement: crossSide.agreement,
      crossSideDisagreementReason: crossSide.agreement ? null : crossSide.detail,
      crossSideCheckedAt: now,
    });
  });

  if (finalStatus !== "FROZEN") {
    return { kind: "data_error", pairId, detail: noDecisionReason ?? "unknown" };
  }
  return { kind: "frozen", pairId, player1TradeId, player2TradeId };
}
