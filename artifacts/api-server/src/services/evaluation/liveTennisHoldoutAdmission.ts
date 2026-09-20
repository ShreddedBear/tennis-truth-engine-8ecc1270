import { createHash } from "node:crypto";
import type {
  HistoricalFixture,
  TournamentLevel,
} from "../tennisData/types";

const LIVE_TENNIS_PROVIDER = "Live Tennis API";
const ALLOWED_IDENTITY_METHODS = new Set([
  "existing-provider-id-crosswalk",
  "provider-profile-exact-multifield",
  "manual-authoritative-review",
]);
const ALLOWED_TOURNAMENT_METHODS = new Set([
  "exact-player-pair-round-score-winner",
]);
const ALLOWED_TOURNAMENT_EVIDENCE_SOURCES = new Set([
  "Approved Sackmann Warehouse",
]);
const ALLOWED_COMPETITION_LEVELS = new Set<TournamentLevel>([
  "GrandSlam",
  "Masters1000",
  "ATP500",
  "ATP250",
  "WTA1000",
  "WTA500",
  "WTA250",
  "Challenger",
  "ITF",
  "Other",
]);
const ALLOWED_INDEPENDENT_SOURCES = new Set([
  "Approved Sackmann Warehouse",
  "BSD PBP",
  "TennisData.app WTA Challenger",
]);

export interface VerifiedPlayerAlias {
  provider: string;
  externalPlayerId: string;
  canonicalPlayerId: string;
  verificationStatus: string;
  resolutionMethod:
    | "existing-provider-id-crosswalk"
    | "provider-profile-exact-multifield"
    | "manual-authoritative-review";
  provenance: {
    authority: "reviewed-provider-crosswalk";
    evidenceId: string;
  };
}

export interface VerifiedTournamentMapping {
  provider: string;
  externalTournamentId: string;
  canonicalTournamentId: string;
  competitionLevel: TournamentLevel;
  verificationStatus: string;
  resolutionMethod: "exact-player-pair-round-score-winner";
  evidenceSource: "Approved Sackmann Warehouse";
  provenance: {
    authority: "reviewed-tournament-crosswalk";
    evidenceId: string;
  };
}

export interface IndependentOutcomeEvidence {
  source:
    | "Approved Sackmann Warehouse"
    | "BSD PBP"
    | "TennisData.app WTA Challenger";
  externalMatchId: string;
  player1CanonicalId: string;
  player2CanonicalId: string;
  canonicalTournamentId: string;
  date: string;
  round: string;
  score: string;
  winnerCanonicalId: string;
  completed: boolean;
  verificationStatus: string;
  linkageMethod?: "exact-signature-no-match-date" | "exact-match-date";
  dateSemantics?: "match-date" | "event-start-date-not-match-date";
  provenance: {
    authority: "independent-result-source";
    evidenceId: string;
  };
}

export type HoldoutExclusionReason =
  | "player1-identity-unresolved"
  | "player2-identity-unresolved"
  | "tournament-identity-unresolved"
  | "competition-level-unresolved"
  | "surface-unresolved"
  | "format-unresolved"
  | "round-unresolved"
  | "score-unresolved"
  | "termination-ungradeable"
  | "outcome-unresolved"
  | "outcome-ambiguous"
  | "outcome-conflict";

export interface HoldoutAdmission {
  fixtureId: string;
  eligible: boolean;
  exclusions: HoldoutExclusionReason[];
  canonicalPlayer1Id: string | null;
  canonicalPlayer2Id: string | null;
  canonicalTournamentId: string | null;
  competitionLevel: TournamentLevel | null;
  independentOutcome: IndependentOutcomeEvidence | null;
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, stableValue(child)]),
    );
  }
  return value;
}

export function stableSerialize(value: unknown): string {
  return JSON.stringify(stableValue(value));
}

export function fingerprintCandidatePopulation(fixtures: HistoricalFixture[]): string {
  const population = fixtures.map((fixture) => ({
    id: fixture.id,
    provider: fixture.provider,
    date: fixture.date,
    time: fixture.time,
    sourcePlayer1Id: fixture.sourcePlayer1Id ?? null,
    sourcePlayer2Id: fixture.sourcePlayer2Id ?? null,
    tournamentId: fixture.tournamentId ?? null,
    tour: fixture.tour,
    tournamentLevel: fixture.tournamentLevel,
    surface: fixture.surface,
    matchFormat: fixture.matchFormat,
    round: fixture.round,
    score: fixture.score,
    winnerId: fixture.winnerId,
    retired: fixture.retired,
    walkover: fixture.walkover,
    cancelled: fixture.cancelled,
    setGameMargins: fixture.setGameMargins,
    importProvenance: fixture.importProvenance ?? null,
  }));
  return createHash("sha256").update(stableSerialize(population)).digest("hex");
}

export function normalizeHoldoutRound(round: string): string {
  const normalized = round.trim().toLowerCase();
  if (normalized.includes("quarter-final") || normalized.includes("quarter final")) return "qf";
  if (normalized.includes("semi-final") || normalized.includes("semi final")) return "sf";
  if (normalized.includes("1/16-final") || normalized.includes("round of 32")) return "r32";
  if (normalized.includes("1/8-final") || normalized.includes("round of 16")) return "r16";
  if (normalized.includes("1/4-final") || normalized.includes("round of 8")) return "qf";
  if (
    normalized === "final" ||
    normalized.endsWith(" - final") ||
    normalized.endsWith(" final")
  ) return "f";
  return normalized.replaceAll(/[^a-z0-9]/g, "");
}

function scoreInCanonicalOrder(
  player1Id: string,
  player2Id: string,
  score: string,
): string | null {
  const sets = score.trim().split(/\s+/).map((set) => {
    const match = /^(\d+)-(\d+)$/.exec(set);
    return match ? [Number(match[1]), Number(match[2])] as const : null;
  });
  if (
    sets.length === 0 ||
    sets.some((set) => {
      if (set === null || set[0] === set[1]) return true;
      const winnerGames = Math.max(set[0], set[1]);
      const loserGames = Math.min(set[0], set[1]);
      if (winnerGames === 6) return winnerGames - loserGames < 2;
      if (winnerGames === 7) return loserGames !== 5 && loserGames !== 6;
      if (winnerGames >= 10) return winnerGames - loserGames < 2;
      return true;
    })
  ) return null;
  const ordered = player1Id.localeCompare(player2Id) <= 0
    ? sets
    : sets.map((set) => set === null ? null : [set[1], set[0]] as const);
  return ordered.map((set) => `${set![0]}-${set![1]}`).join(" ");
}

function isCompletedMatchScore(
  score: string,
  matchFormat: HistoricalFixture["matchFormat"],
  winnerIsPlayer1: boolean,
): boolean {
  if (!matchFormat) return false;
  const canonical = scoreInCanonicalOrder("a", "b", score);
  if (!canonical) return false;
  const sets = canonical.split(" ").map((set) => set.split("-").map(Number));
  const requiredWins = matchFormat === "BestOf5" ? 3 : 2;
  const maximumSets = matchFormat === "BestOf5" ? 5 : 3;
  if (sets.length < requiredWins || sets.length > maximumSets) return false;
  let player1Wins = 0;
  let player2Wins = 0;
  for (const [index, [first, second]] of sets.entries()) {
    if (first > second) player1Wins++;
    else player2Wins++;
    if (
      (player1Wins === requiredWins || player2Wins === requiredWins) &&
      index !== sets.length - 1
    ) {
      return false;
    }
  }
  if (Math.max(player1Wins, player2Wins) !== requiredWins) return false;
  if (Math.min(player1Wins, player2Wins) >= requiredWins) return false;
  return winnerIsPlayer1
    ? player1Wins === requiredWins
    : player2Wins === requiredWins;
}

function explicitTourLevel(tour: string | null): TournamentLevel | null {
  const normalized = tour?.trim().toLowerCase();
  if (normalized === "itf") return "ITF";
  if (normalized === "challenger") return "Challenger";
  return null;
}

export function auditHoldoutAdmission(
  fixtures: HistoricalFixture[],
  playerAliases: VerifiedPlayerAlias[],
  tournamentMappings: VerifiedTournamentMapping[],
  outcomes: IndependentOutcomeEvidence[],
): HoldoutAdmission[] {
  const aliasGroups = new Map<string, VerifiedPlayerAlias[]>();
  for (const alias of playerAliases) {
    if (
      alias.provider !== LIVE_TENNIS_PROVIDER ||
      alias.verificationStatus !== "verified" ||
      !ALLOWED_IDENTITY_METHODS.has(alias.resolutionMethod) ||
      alias.provenance.authority !== "reviewed-provider-crosswalk" ||
      alias.provenance.evidenceId.length === 0
    ) continue;
    const group = aliasGroups.get(alias.externalPlayerId) ?? [];
    group.push(alias);
    aliasGroups.set(alias.externalPlayerId, group);
  }
  const aliasByExternalId = new Map(
    [...aliasGroups].flatMap(([externalId, group]) =>
      group.length === 1 ? [[externalId, group[0]] as const] : []),
  );

  const tournamentGroups = new Map<string, VerifiedTournamentMapping[]>();
  for (const mapping of tournamentMappings) {
    if (
      mapping.provider !== LIVE_TENNIS_PROVIDER ||
      mapping.verificationStatus !== "verified" ||
      !ALLOWED_TOURNAMENT_METHODS.has(mapping.resolutionMethod) ||
      !ALLOWED_TOURNAMENT_EVIDENCE_SOURCES.has(mapping.evidenceSource) ||
      !ALLOWED_COMPETITION_LEVELS.has(mapping.competitionLevel) ||
      mapping.provenance.authority !== "reviewed-tournament-crosswalk" ||
      mapping.provenance.evidenceId.length === 0
    ) continue;
    const group = tournamentGroups.get(mapping.externalTournamentId) ?? [];
    group.push(mapping);
    tournamentGroups.set(mapping.externalTournamentId, group);
  }
  const tournamentByExternalId = new Map(
    [...tournamentGroups].flatMap(([externalId, group]) =>
      group.length === 1 ? [[externalId, group[0]] as const] : []),
  );
  const independentOutcomes = outcomes.filter((outcome) =>
    ALLOWED_INDEPENDENT_SOURCES.has(outcome.source) &&
    outcome.completed &&
    outcome.verificationStatus === "verified" &&
    outcome.provenance.authority === "independent-result-source" &&
    outcome.provenance.evidenceId.length > 0 &&
    ((outcome.linkageMethod === "exact-signature-no-match-date" &&
      outcome.dateSemantics === "event-start-date-not-match-date") ||
      (outcome.linkageMethod === "exact-match-date" &&
        outcome.dateSemantics === "match-date")));

  return fixtures.map((fixture) => {
    const exclusions: HoldoutExclusionReason[] = [];
    const player1 = fixture.sourcePlayer1Id
      ? aliasByExternalId.get(fixture.sourcePlayer1Id) ?? null
      : null;
    const player2 = fixture.sourcePlayer2Id
      ? aliasByExternalId.get(fixture.sourcePlayer2Id) ?? null
      : null;
    if (!player1) exclusions.push("player1-identity-unresolved");
    if (!player2) exclusions.push("player2-identity-unresolved");
    if (
      player1 &&
      player2 &&
      player1.canonicalPlayerId === player2.canonicalPlayerId
    ) {
      exclusions.push("player1-identity-unresolved", "player2-identity-unresolved");
    }

    const tournament = fixture.tournamentId
      ? tournamentByExternalId.get(fixture.tournamentId) ?? null
      : null;
    const competitionLevel = tournament?.competitionLevel ?? explicitTourLevel(fixture.tour);
    if (!tournament) exclusions.push("tournament-identity-unresolved");
    if (!competitionLevel) exclusions.push("competition-level-unresolved");
    if (!fixture.surface) exclusions.push("surface-unresolved");
    if (!fixture.matchFormat) exclusions.push("format-unresolved");
    if (!fixture.round) exclusions.push("round-unresolved");
    if (fixture.cancelled || fixture.retired || fixture.walkover) {
      exclusions.push("termination-ungradeable");
    }
    const winnerIsPlayer1 = fixture.winnerId === fixture.player1Id;
    const winnerIsPlayer2 = fixture.winnerId === fixture.player2Id;
    const rawScoreValid = fixture.score && (winnerIsPlayer1 || winnerIsPlayer2)
      ? isCompletedMatchScore(fixture.score, fixture.matchFormat, winnerIsPlayer1)
      : false;
    const candidateScore = player1 && player2 && fixture.score && rawScoreValid
      ? scoreInCanonicalOrder(
          player1.canonicalPlayerId,
          player2.canonicalPlayerId,
          fixture.score,
        )
      : null;
    if (!fixture.score || !rawScoreValid) exclusions.push("score-unresolved");

    let independentOutcome: IndependentOutcomeEvidence | null = null;
    if (
      player1 &&
      player2 &&
      player1.canonicalPlayerId !== player2.canonicalPlayerId &&
      tournament &&
      fixture.round &&
      candidateScore &&
      !fixture.cancelled &&
      !fixture.retired &&
      !fixture.walkover
    ) {
      const sameMatchEvidence = independentOutcomes.filter((outcome) =>
        (outcome.linkageMethod === "exact-signature-no-match-date" ||
          outcome.date === fixture.date) &&
        outcome.canonicalTournamentId === tournament.canonicalTournamentId &&
        normalizeHoldoutRound(outcome.round) === normalizeHoldoutRound(fixture.round!) &&
        new Set([outcome.player1CanonicalId, outcome.player2CanonicalId]).size === 2 &&
        outcome.player1CanonicalId !== outcome.player2CanonicalId &&
        [outcome.player1CanonicalId, outcome.player2CanonicalId].sort().join("|") ===
          [player1.canonicalPlayerId, player2.canonicalPlayerId].sort().join("|"));
      const evidenceSignatures = sameMatchEvidence.map((outcome) => {
        const evidenceWinnerIsPlayer1 =
          outcome.winnerCanonicalId === outcome.player1CanonicalId;
        const evidenceWinnerIsPlayer2 =
          outcome.winnerCanonicalId === outcome.player2CanonicalId;
        if (
          (!evidenceWinnerIsPlayer1 && !evidenceWinnerIsPlayer2) ||
          !isCompletedMatchScore(
            outcome.score,
            fixture.matchFormat,
            evidenceWinnerIsPlayer1,
          )
        ) return "INVALID";
        const normalizedScore = scoreInCanonicalOrder(
          outcome.player1CanonicalId,
          outcome.player2CanonicalId,
          outcome.score,
        );
        return normalizedScore
          ? `${normalizedScore}|${outcome.winnerCanonicalId}`
          : "INVALID";
      });
      const uniqueSignatures = new Set(evidenceSignatures);
      if (sameMatchEvidence.length === 1 && uniqueSignatures.size === 1) {
        independentOutcome = sameMatchEvidence[0];
        const expectedWinner = fixture.winnerId === fixture.player1Id
          ? player1.canonicalPlayerId
          : fixture.winnerId === fixture.player2Id
            ? player2.canonicalPlayerId
            : null;
        if (
          evidenceSignatures[0] === "INVALID" ||
          !evidenceSignatures[0].startsWith(`${candidateScore}|`) ||
          !expectedWinner ||
          independentOutcome.winnerCanonicalId !== expectedWinner
        ) {
          exclusions.push("outcome-conflict");
        }
      } else if (sameMatchEvidence.length > 1 && uniqueSignatures.size === 1) {
        exclusions.push("outcome-ambiguous");
      } else if (sameMatchEvidence.length > 0) {
        exclusions.push("outcome-conflict");
      } else {
        exclusions.push("outcome-unresolved");
      }
    } else {
      exclusions.push("outcome-unresolved");
    }

    return {
      fixtureId: fixture.id,
      eligible: exclusions.length === 0,
      exclusions: [...new Set(exclusions)],
      canonicalPlayer1Id: player1?.canonicalPlayerId ?? null,
      canonicalPlayer2Id: player2?.canonicalPlayerId ?? null,
      canonicalTournamentId: tournament?.canonicalTournamentId ?? null,
      competitionLevel,
      independentOutcome,
    };
  });
}
