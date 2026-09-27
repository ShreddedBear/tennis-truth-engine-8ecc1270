/**
 * Pure settlement/grading rules — DB-free by design, same reasoning as eligibility.ts.
 *
 * Void semantics (isVoidResult) match the ALREADY-established Research V1 convention exactly
 * (`attachParlayBuilderResearchV1Outcomes.ts`: `isVoid = cancelled || walkover`) -- retired
 * matches are fetched and reported but a retired-match win still counts toward accuracy. No new
 * vocabulary invented here; this is the same historical_matches.retired/walkover/cancelled
 * boolean triage the rest of the codebase already uses.
 *
 * THE central rule this file exists to enforce: grading compares
 *   actualWinnerId === builderPickedPlayerId
 * — never selectedPlayerId, never the KEEP/BORDERLINE/REMOVE decision. The old
 * "human selection was validated correctly" semantics from builder_decision_log/
 * parlay_leg_outcomes must never leak into this autonomous system's accuracy number.
 */

export type ResultType = "normal" | "walkover" | "retired" | "cancelled";

/** Conservative match-identity time window shared by live and confirmed historical settlement. */
export const SETTLEMENT_MATCH_TIME_WINDOW_MS = 6 * 60 * 60 * 1000;

export interface MatchOutcomeFlags {
  cancelled: boolean;
  walkover: boolean;
  retired: boolean;
}

export function deriveResultType(flags: MatchOutcomeFlags): ResultType {
  if (flags.cancelled) return "cancelled";
  if (flags.walkover) return "walkover";
  if (flags.retired) return "retired";
  return "normal";
}

/** cancelled | walkover void the result entirely (no winner can be trusted). Retired does NOT. */
export function isVoidResult(resultType: ResultType): boolean {
  return resultType === "cancelled" || resultType === "walkover";
}

export interface GradingInput {
  /** THE prospective prediction. Never selectedPlayerId, never `decision`. */
  builderPickedPlayerId: string;
  actualWinnerId: string | null;
  resultType: ResultType;
}

export interface GradingResult {
  includedInAccuracy: boolean;
  /** null when not gradeable yet (no winner) or void (excluded from accuracy, not "wrong"). */
  gradedCorrect: boolean | null;
}

export function gradePaperTrade(input: GradingInput): GradingResult {
  if (input.actualWinnerId == null) {
    return { includedInAccuracy: false, gradedCorrect: null };
  }
  if (isVoidResult(input.resultType)) {
    return { includedInAccuracy: false, gradedCorrect: null };
  }
  return {
    includedInAccuracy: true,
    gradedCorrect: input.actualWinnerId === input.builderPickedPlayerId,
  };
}

/** True once the fixture's scheduled start has passed — the hard PIT boundary past which no NEW decision may ever be created. */
export function hasMatchStarted(scheduledStartAt: Date, now: Date): boolean {
  return now.getTime() >= scheduledStartAt.getTime();
}

/** True only while the authoritative clock is strictly before the fixture start. */
export function isBeforeScheduledStart(scheduledStartAt: Date, databaseNow: Date): boolean {
  return databaseNow.getTime() < scheduledStartAt.getTime();
}

export interface SettlementCandidate {
  id?: number;
  provider: string;
  player1_id: string;
  player2_id: string;
  winner_id: string | null;
  scheduled_start_at: Date;
  retired: boolean | null;
  walkover: boolean | null;
  cancelled: boolean | null;
  tournament_name: string | null;
  surface: string | null;
}

export interface LiveSettlementCandidate {
  provider: string;
  externalId: string;
  providerPlayer1Id: string;
  providerPlayer2Id: string;
  canonicalPlayer1Id: string;
  canonicalPlayer2Id: string;
  canonicalWinnerId: string;
  terminalResultType: string;
  scheduledStartAt: Date;
  tournamentName: string | null;
  surface: string | null;
}

export type SettlementCandidateResolution =
  | { kind: "pending" }
  | { kind: "ambiguous"; candidateCount: number }
  | { kind: "settled"; match: SettlementCandidate };

export type LiveSettlementCandidateResolution =
  | { kind: "pending"; candidateCount: number }
  | { kind: "ambiguous"; candidateCount: number }
  | {
      kind: "settled";
      candidate: LiveSettlementCandidate;
      providerWinnerId: string;
      resultType: "normal" | "retired" | "walkover";
    };

export type HistoricalLiveResultAgreement = "consistent" | "conflict" | "ambiguous";

export function shouldUseHistoricalSettlementFallback(
  liveResolution: LiveSettlementCandidateResolution,
): boolean {
  return liveResolution.kind === "pending" && liveResolution.candidateCount === 0;
}

export function isSettlementTimeReady(
  frozenScheduledStartAt: Date,
  resultScheduledStartAt: Date,
  now: Date,
): boolean {
  return now.getTime() >= frozenScheduledStartAt.getTime()
    && now.getTime() >= resultScheduledStartAt.getTime();
}

export interface SettlementPairMember {
  pairId: string;
  externalFixtureId: string;
  fixtureProvider: string;
  player1Id: string;
  player2Id: string;
  scheduledStartAt: Date;
  tournamentName: string | null;
  surface: string | null;
  evaluatedSide: string;
  selectedPlayerId: string;
  opposingPlayerId: string;
  status: string;
  builderPickedPlayerId: string | null;
  actualWinnerId: string | null;
}

/** Require the two frozen rows to describe one coherent fixture before attaching shared outcome data. */
export function isValidSettlementPair(rows: readonly SettlementPairMember[]): boolean {
  if (rows.length !== 2) return false;
  const [first, second] = rows;
  if (
    first.pairId !== second.pairId
    || first.externalFixtureId !== second.externalFixtureId
    || first.fixtureProvider !== second.fixtureProvider
    || first.player1Id !== second.player1Id
    || first.player2Id !== second.player2Id
    || first.scheduledStartAt.getTime() !== second.scheduledStartAt.getTime()
    || first.tournamentName !== second.tournamentName
    || first.surface !== second.surface
    || first.status !== second.status
    || !["FROZEN", "STARTED"].includes(first.status)
    || first.actualWinnerId !== null
    || second.actualWinnerId !== null
    || first.builderPickedPlayerId == null
    || first.builderPickedPlayerId !== second.builderPickedPlayerId
    || (first.builderPickedPlayerId !== first.player1Id && first.builderPickedPlayerId !== first.player2Id)
  ) return false;

  const player1Side = rows.find((row) => row.evaluatedSide === "PLAYER_1");
  const player2Side = rows.find((row) => row.evaluatedSide === "PLAYER_2");
  return player1Side != null
    && player2Side != null
    && player1Side !== player2Side
    && player1Side.selectedPlayerId === player1Side.player1Id
    && player1Side.opposingPlayerId === player1Side.player2Id
    && player2Side.selectedPlayerId === player2Side.player2Id
    && player2Side.opposingPlayerId === player2Side.player1Id;
}

function normalizedComparable(value: string): string {
  return value.trim().toLocaleLowerCase("en-US").replace(/\s+/g, " ");
}

function matchesComparableFixture(
  candidate: { scheduledStartAt: Date; tournamentName: string | null; surface: string | null },
  fixture: { scheduledStartAt: Date; tournamentName: string | null; surface: string | null },
): boolean {
  const windowMs = SETTLEMENT_MATCH_TIME_WINDOW_MS;
  const inTimeWindow = Math.abs(candidate.scheduledStartAt.getTime() - fixture.scheduledStartAt.getTime()) <= windowMs;
  const tournamentConsistent = fixture.tournamentName == null || candidate.tournamentName == null
    || normalizedComparable(fixture.tournamentName) === normalizedComparable(candidate.tournamentName);
  const surfaceConsistent = fixture.surface == null || candidate.surface == null
    || normalizedComparable(fixture.surface) === normalizedComparable(candidate.surface);
  return inTimeWindow && tournamentConsistent && surfaceConsistent;
}

function hasSameUnorderedPair(
  candidatePlayer1Id: string,
  candidatePlayer2Id: string,
  player1Id: string,
  player2Id: string,
): boolean {
  return (candidatePlayer1Id === player1Id && candidatePlayer2Id === player2Id)
    || (candidatePlayer1Id === player2Id && candidatePlayer2Id === player1Id);
}

/**
 * Resolves the live result in the Builder's provider-ID namespace. The canonical winner is
 * translated through the corresponding verified provider-player slot; it is never returned as
 * the value compared with builder_picked_player_id.
 */
export function resolveLiveSettlementCandidate(input: {
  candidates: LiveSettlementCandidate[];
  provider: string;
  providerPlayer1Id: string;
  providerPlayer2Id: string;
  scheduledStartAt: Date;
  tournamentName: string | null;
  surface: string | null;
}): LiveSettlementCandidateResolution {
  const fixture = {
    scheduledStartAt: input.scheduledStartAt,
    tournamentName: input.tournamentName,
    surface: input.surface,
  };
  const providerMatches = input.candidates.filter((candidate) =>
    candidate.provider === input.provider
    && hasSameUnorderedPair(
      candidate.providerPlayer1Id,
      candidate.providerPlayer2Id,
      input.providerPlayer1Id,
      input.providerPlayer2Id,
    )
    && Math.abs(candidate.scheduledStartAt.getTime() - input.scheduledStartAt.getTime()) <= SETTLEMENT_MATCH_TIME_WINDOW_MS,
  );
  if (providerMatches.length === 0) return { kind: "pending", candidateCount: 0 };

  const plausible = providerMatches.filter((candidate) => matchesComparableFixture({
    scheduledStartAt: candidate.scheduledStartAt,
    tournamentName: candidate.tournamentName,
    surface: candidate.surface,
  }, fixture));
  if (plausible.length === 0) return { kind: "pending", candidateCount: providerMatches.length };
  if (plausible.length > 1) return { kind: "ambiguous", candidateCount: plausible.length };

  const [candidate] = plausible;
  const participantWinner = candidate.canonicalWinnerId === candidate.canonicalPlayer1Id
    ? candidate.providerPlayer1Id
    : candidate.canonicalWinnerId === candidate.canonicalPlayer2Id
      ? candidate.providerPlayer2Id
      : null;
  const winnerIsBuilderParticipant = participantWinner === input.providerPlayer1Id
    || participantWinner === input.providerPlayer2Id;
  if (!winnerIsBuilderParticipant) return { kind: "pending", candidateCount: 1 };

  const resultType = candidate.terminalResultType === "finished"
    ? "normal"
    : candidate.terminalResultType === "retired" || candidate.terminalResultType === "walkover"
      ? candidate.terminalResultType
      : null;
  if (resultType == null) return { kind: "pending", candidateCount: 1 };
  return { kind: "settled", candidate, providerWinnerId: participantWinner, resultType };
}

/**
 * If both source paths have a defensible result, require agreement in every ID namespace that
 * exactly matches the live row. Ambiguous historical evidence also blocks settlement.
 */
export function reconcileHistoricalWithLiveResult(input: {
  historicalCandidates: SettlementCandidate[];
  liveCandidate: LiveSettlementCandidate;
  providerWinnerId: string;
  scheduledStartAt: Date;
  tournamentName: string | null;
  surface: string | null;
}): HistoricalLiveResultAgreement {
  const identities = [
    {
      player1Id: input.liveCandidate.providerPlayer1Id,
      player2Id: input.liveCandidate.providerPlayer2Id,
      expectedWinnerId: input.providerWinnerId,
    },
    {
      player1Id: input.liveCandidate.canonicalPlayer1Id,
      player2Id: input.liveCandidate.canonicalPlayer2Id,
      expectedWinnerId: input.liveCandidate.canonicalWinnerId,
    },
  ];

  for (const identity of identities) {
    const resolution = resolveSettlementCandidate({
      candidates: input.historicalCandidates,
      provider: input.liveCandidate.provider,
      player1Id: identity.player1Id,
      player2Id: identity.player2Id,
      scheduledStartAt: input.scheduledStartAt,
      tournamentName: input.tournamentName,
      surface: input.surface,
    });
    if (resolution.kind === "ambiguous") return "ambiguous";
    if (resolution.kind === "settled") {
      const historyResultType = deriveResultType({
        cancelled: resolution.match.cancelled ?? false,
        walkover: resolution.match.walkover ?? false,
        retired: resolution.match.retired ?? false,
      });
      if (
        resolution.match.winner_id !== identity.expectedWinnerId
        || historyResultType !== input.liveCandidate.terminalResultType.replace("finished", "normal")
      ) return "conflict";
    }
  }
  return "consistent";
}

/**
 * Resolves only by exact canonical player ids and deterministic fixture metadata. Never selects
 * the first of multiple plausible historical rows or infers identity from player names.
 */
export function resolveSettlementCandidate(input: {
  candidates: SettlementCandidate[];
  provider: string;
  player1Id: string;
  player2Id: string;
  scheduledStartAt: Date;
  tournamentName: string | null;
  surface: string | null;
}): SettlementCandidateResolution {
  const windowMs = SETTLEMENT_MATCH_TIME_WINDOW_MS;
  const plausible = input.candidates.filter((candidate) => {
    return candidate.provider === input.provider
      && hasSameUnorderedPair(candidate.player1_id, candidate.player2_id, input.player1Id, input.player2Id)
      && Math.abs(candidate.scheduled_start_at.getTime() - input.scheduledStartAt.getTime()) <= windowMs
      && matchesComparableFixture({
        scheduledStartAt: candidate.scheduled_start_at,
        tournamentName: candidate.tournament_name,
        surface: candidate.surface,
      }, input);
  });

  if (plausible.length === 0) return { kind: "pending" };
  if (plausible.length > 1) return { kind: "ambiguous", candidateCount: plausible.length };

  const [match] = plausible;
  const winnerIsParticipant = match.winner_id === input.player1Id || match.winner_id === input.player2Id;
  if (!match.winner_id || !winnerIsParticipant || match.cancelled === true) return { kind: "pending" };
  return { kind: "settled", match };
}
