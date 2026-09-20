import type { LiveTennisIdentityAudit } from "./liveTennisIdentityAudit.js";
import type { HistoricalFixture } from "./types.js";

export const MATCH_ELIGIBILITY_STATUSES = [
  "MATCH_ELIGIBLE_FOR_BACKTEST",
  "MATCH_INELIGIBLE_IDENTITY",
  "MATCH_INELIGIBLE_OUTCOME",
  "MATCH_INELIGIBLE_METADATA",
  "MATCH_INELIGIBLE_TEMPORAL_DATA",
  "MATCH_INELIGIBLE_FEATURE_SOURCE",
] as const;
export type MatchEligibilityStatus = (typeof MATCH_ELIGIBILITY_STATUSES)[number];

export type MatchEligibilityReason =
  | "identity_unresolved_or_ambiguous"
  | "identity_player_collision"
  | "missing_winner"
  | "cancelled_match"
  | "retired_match"
  | "walkover_match"
  | "missing_tournament_level"
  | "missing_surface"
  | "missing_round"
  | "missing_match_format"
  | "missing_final_set_games"
  | "invalid_match_start"
  | "missing_cutoff"
  | "cutoff_after_match_start"
  | "future_observations_present"
  | "feature_source_unproven"
  | "feature_source_unavailable"
  | "feature_source_not_point_in_time_safe";

export interface MatchEligibilityFeatureSource {
  name: string;
  pointInTimeSafe: boolean;
  available: boolean;
}

export interface MatchEligibilityGateOptions {
  /** The cutoff used to construct historical features. No cutoff means temporal evidence is absent. */
  cutoffAt?: Date | string | null;
  futureObservationCount?: number;
  requiredFeatureSources?: readonly MatchEligibilityFeatureSource[];
  /**
   * Retirements and walkovers are policy decisions, not implicit data repairs. The default
   * rejects both categories even when a winner exists; callers must explicitly accept them.
   */
  acceptRetired?: boolean;
  acceptWalkover?: boolean;
}

export interface MatchEligibilityReasonDetail {
  code: MatchEligibilityReason;
  message: string;
}

export interface MatchEligibilityGateResult {
  status: MatchEligibilityStatus;
  eligibleForPrediction: boolean;
  /** Deliberately independent from Truth Engine evidence completeness. */
  truthEngineEvidenceComplete: null;
  reasons: MatchEligibilityReasonDetail[];
  identity: {
    player1CanonicalId: string | null;
    player2CanonicalId: string | null;
    resolved: boolean;
  };
  temporal: {
    matchStartAt: string | null;
    cutoffAt: string | null;
    futureObservationCount: number;
    requiredFeatureSourcesPointInTimeSafe: boolean;
  };
}

export function evaluateMatchEligibility(
  fixture: HistoricalFixture,
  identityAudit: LiveTennisIdentityAudit,
  options: MatchEligibilityGateOptions = {},
): MatchEligibilityGateResult {
  const identityByPlayer = new Map(identityAudit.entries.map((entry) => [
    `${entry.providerPlayerId}\u0000${entry.providerPlayerName}`,
    entry,
  ]));
  const p1 = identityByPlayer.get(`${fixture.player1Id}\u0000${fixture.player1Name}`);
  const p2 = identityByPlayer.get(`${fixture.player2Id}\u0000${fixture.player2Name}`);
  const p1CanonicalId = p1?.resolutionStatus === "resolved" ? p1.canonicalPlayerId : null;
  const p2CanonicalId = p2?.resolutionStatus === "resolved" ? p2.canonicalPlayerId : null;
  const reasons: MatchEligibilityReasonDetail[] = [];
  if (!p1CanonicalId || !p2CanonicalId) {
    reasons.push({ code: "identity_unresolved_or_ambiguous", message: "Both players require exactly one resolved canonical identity." });
  } else if (p1CanonicalId === p2CanonicalId) {
    reasons.push({ code: "identity_player_collision", message: "Both provider players resolve to the same canonical player." });
  }

  if (fixture.winnerId == null) reasons.push({ code: "missing_winner", message: "A deterministic winner is required." });
  if (fixture.cancelled) reasons.push({ code: "cancelled_match", message: "Cancelled matches are not backtest outcomes." });
  if (fixture.retired && options.acceptRetired !== true) reasons.push({ code: "retired_match", message: "Retirements require explicit acceptance in the eligibility policy." });
  if (fixture.walkover && options.acceptWalkover !== true) reasons.push({ code: "walkover_match", message: "Walkovers require explicit acceptance in the eligibility policy." });

  if (fixture.tournamentLevel == null) reasons.push({ code: "missing_tournament_level", message: "Tournament level is unavailable." });
  if (fixture.surface == null) reasons.push({ code: "missing_surface", message: "Surface is unavailable." });
  if (fixture.round == null) reasons.push({ code: "missing_round", message: "Round is unavailable." });
  if (fixture.matchFormat == null) reasons.push({ code: "missing_match_format", message: "Match format is unavailable." });
  if (fixture.setGameMargins.length === 0) reasons.push({ code: "missing_final_set_games", message: "Final-set game evidence is unavailable." });

  const matchStart = fixture.date && fixture.time ? new Date(`${fixture.date}T${fixture.time}:00Z`) : null;
  const cutoff = options.cutoffAt == null ? null : new Date(options.cutoffAt);
  const futureObservationCount = options.futureObservationCount ?? 0;
  if (!matchStart || !Number.isFinite(matchStart.getTime())) reasons.push({ code: "invalid_match_start", message: "The match start timestamp is invalid." });
  if (!cutoff || !Number.isFinite(cutoff.getTime())) reasons.push({ code: "missing_cutoff", message: "A historical feature cutoff is required." });
  if (matchStart && cutoff && Number.isFinite(matchStart.getTime()) && Number.isFinite(cutoff.getTime()) && cutoff.getTime() > matchStart.getTime()) {
    reasons.push({ code: "cutoff_after_match_start", message: "The feature cutoff is after match start." });
  }
  if (futureObservationCount !== 0) reasons.push({ code: "future_observations_present", message: "Historical feature evidence contains future observations." });

  const sources = options.requiredFeatureSources ?? [];
  if (sources.length === 0) {
    reasons.push({ code: "feature_source_unproven", message: "No required point-in-time feature source evidence was supplied." });
  } else {
    for (const source of sources) {
      if (!source.available) reasons.push({ code: "feature_source_unavailable", message: `Feature source '${source.name}' is unavailable.` });
      else if (!source.pointInTimeSafe) reasons.push({ code: "feature_source_not_point_in_time_safe", message: `Feature source '${source.name}' is not proven point-in-time safe.` });
    }
  }

  const has = (code: MatchEligibilityReason) => reasons.some((reason) => reason.code === code);
  const status: MatchEligibilityStatus =
    has("identity_unresolved_or_ambiguous") || has("identity_player_collision") ? "MATCH_INELIGIBLE_IDENTITY" :
      has("missing_winner") || has("cancelled_match") || has("retired_match") || has("walkover_match") ? "MATCH_INELIGIBLE_OUTCOME" :
        ["missing_tournament_level", "missing_surface", "missing_round", "missing_match_format", "missing_final_set_games"].some(has) ? "MATCH_INELIGIBLE_METADATA" :
          ["invalid_match_start", "missing_cutoff", "cutoff_after_match_start", "future_observations_present"].some(has) ? "MATCH_INELIGIBLE_TEMPORAL_DATA" :
            ["feature_source_unproven", "feature_source_unavailable", "feature_source_not_point_in_time_safe"].some(has) ? "MATCH_INELIGIBLE_FEATURE_SOURCE" :
              "MATCH_ELIGIBLE_FOR_BACKTEST";
  return {
    status,
    eligibleForPrediction: status === "MATCH_ELIGIBLE_FOR_BACKTEST",
    truthEngineEvidenceComplete: null,
    reasons,
    identity: { player1CanonicalId: p1CanonicalId, player2CanonicalId: p2CanonicalId, resolved: Boolean(p1CanonicalId && p2CanonicalId && p1CanonicalId !== p2CanonicalId) },
    temporal: {
      matchStartAt: matchStart && Number.isFinite(matchStart.getTime()) ? matchStart.toISOString() : null,
      cutoffAt: cutoff && Number.isFinite(cutoff.getTime()) ? cutoff.toISOString() : null,
      futureObservationCount,
      requiredFeatureSourcesPointInTimeSafe: sources.length > 0 && sources.every((source) => source.available && source.pointInTimeSafe),
    },
  };
}

export function buildMatchEligibilityManifest(
  fixtures: HistoricalFixture[],
  identityAudit: LiveTennisIdentityAudit,
  options: MatchEligibilityGateOptions = {},
): Array<{ providerMatchId: string; gate: MatchEligibilityGateResult }> {
  return fixtures.map((fixture) => ({
    providerMatchId: fixture.id,
    gate: evaluateMatchEligibility(fixture, identityAudit, options),
  }));
}

export function matchEligibilityAudit(fixtures: HistoricalFixture[], identityAudit: LiveTennisIdentityAudit) {
  const identityByPlayer = new Map(identityAudit.entries.map((entry) => [`${entry.providerPlayerId}\u0000${entry.providerPlayerName}`, entry]));
  const counts = {
    totalMatches: fixtures.length,
    missingWinner: 0,
    unresolvedOrAmbiguousPlayerIdentity: 0,
    missingTournamentLevel: 0,
    missingSurface: 0,
    missingRound: 0,
    missingFormat: 0,
    missingFinalSetGames: 0,
    allRequiredFieldsPresent: 0,
  };
  const gateStatusCounts = Object.fromEntries(MATCH_ELIGIBILITY_STATUSES.map((status) => [status, 0])) as Record<MatchEligibilityStatus, number>;
  const gateReasonCounts: Partial<Record<MatchEligibilityReason, number>> = {};
  // The manifest is deliberately in-memory only. The aggregate return value contains no rows.
  const manifest = buildMatchEligibilityManifest(fixtures, identityAudit);
  for (const { gate } of manifest) {
    gateStatusCounts[gate.status]++;
    for (const reason of gate.reasons) gateReasonCounts[reason.code] = (gateReasonCounts[reason.code] ?? 0) + 1;
  }
  for (const fixture of fixtures) {
    const p1 = identityByPlayer.get(`${fixture.player1Id}\u0000${fixture.player1Name}`);
    const p2 = identityByPlayer.get(`${fixture.player2Id}\u0000${fixture.player2Name}`);
    const missingIdentity = p1?.resolutionStatus !== "resolved" || p2?.resolutionStatus !== "resolved";
    const missingWinner = fixture.winnerId == null;
    const missingTournamentLevel = fixture.tournamentLevel == null;
    const missingSurface = fixture.surface == null;
    const missingRound = fixture.round == null;
    const missingFormat = fixture.matchFormat == null;
    const missingFinalSetGames = fixture.setGameMargins.length === 0;
    if (missingWinner) counts.missingWinner++;
    if (missingIdentity) counts.unresolvedOrAmbiguousPlayerIdentity++;
    if (missingTournamentLevel) counts.missingTournamentLevel++;
    if (missingSurface) counts.missingSurface++;
    if (missingRound) counts.missingRound++;
    if (missingFormat) counts.missingFormat++;
    if (missingFinalSetGames) counts.missingFinalSetGames++;
    if (!(missingWinner || missingIdentity || missingTournamentLevel || missingSurface || missingRound || missingFormat || missingFinalSetGames)) {
      counts.allRequiredFieldsPresent++;
    }
  }
  return {
    ...counts,
    reasonCountsAreNonExclusive: true,
    gateStatusCounts,
    gateReasonCounts,
    gateEligibleForBacktest: gateStatusCounts.MATCH_ELIGIBLE_FOR_BACKTEST,
    truthEngineEvidenceIndependent: true,
  };
}
