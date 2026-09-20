// Cross-provider historical-match canonicalization / collision-detection layer.
//
// Standalone module. NOT wired into scripts/build-runtime-tennis-index.mjs or any other
// ingestion path -- every lane in that script currently draws from exactly one match-level
// source, so there is nothing to deduplicate against yet (see the runtime-index audit). This
// module exists so that the day a second source is added to an already-populated lane (e.g.
// DataHub or Sackmann-local into ATP_MAIN), there is a tested collision-detection mechanism
// ready to sit in front of that write, instead of retrofitting dedup after a duplicate has
// already landed.
//
// Deliberately reuses the project's existing canonical-identity primitives
// (evidence-match-identity.ts, evidence-player-alias.ts) rather than re-implementing player/
// tournament/date normalization a second time with slightly different behavior. Those modules
// were built for matching an uploaded record against the metric-evidence store; this module
// adapts the same identity machinery to the different but structurally identical problem of
// merging several *source* CSVs into one canonical historical match, with a growable registry,
// corroboration tracking, and explicit winner-conflict detection.
//
// Never merges on a fuzzy/best-effort basis. Every candidate is classified as exactly one of:
//   NEW        -- no compatible match found; safe to insert as a new canonical match.
//   DUPLICATE  -- exactly one compatible existing match found, and the sources agree on the
//                 winner; the source is recorded as corroboration, no new canonical row.
//   CONFLICT   -- exactly one compatible existing match found, but the sources DISAGREE on the
//                 winner; neither value is overwritten, both are preserved for review.
//   AMBIGUOUS  -- required identity fields are missing, or more than one existing match is
//                 compatible, or the same players played on a compatible date but the
//                 tournament strings disagree after normalization (could be the same event
//                 under a different name, or could be a real coincidence -- never guessed).

import {
  buildCanonicalEvidenceMatchIdentity,
  evidenceDateCompatible,
  evidenceMatchIdentityCompatible,
  type CanonicalEvidenceMatchIdentity,
  type EvidenceMatchIdentityInput,
} from "./evidence-match-identity";
import { normalizeEvidenceIdentity, safeEvidenceAliases } from "./evidence-player-alias";

export type CandidateHistoricalMatch = EvidenceMatchIdentityInput & {
  /** Which source file/provider this row came from, e.g. "datahub-atp", "predixsport-atp". */
  sourceId: string;
  /** A row-level pointer back into the source (external id, line number, composite key). */
  sourceRef: string;
  /** The winner's display name, in whatever form the source provides it. */
  winnerName: string;
  score?: string | null;
};

export type AcceptedHistoricalMatch = {
  identity: CanonicalEvidenceMatchIdentity;
  winnerName: string;
  score: string | null;
  /** The source that first established this canonical match. */
  primarySource: { sourceId: string; sourceRef: string };
  /** Every additional source that corroborated the same real-world match. */
  corroboratingSources: Array<{ sourceId: string; sourceRef: string }>;
};

export type MatchResolution =
  | { status: "NEW"; identity: CanonicalEvidenceMatchIdentity }
  | { status: "DUPLICATE"; identity: CanonicalEvidenceMatchIdentity; canonical: AcceptedHistoricalMatch }
  | {
      status: "CONFLICT";
      identity: CanonicalEvidenceMatchIdentity;
      canonical: AcceptedHistoricalMatch;
      reason: string;
      incomingWinner: string;
      canonicalWinner: string;
    }
  | { status: "AMBIGUOUS"; reason: string; identity: CanonicalEvidenceMatchIdentity | null; detail?: unknown };

function winnersAgree(a: string, b: string, candidate: CandidateHistoricalMatch): boolean {
  // Reuse the project's strict (no fuzzy/edit-distance) alias resolution: a winner name is
  // considered the same player if it's the same normalized string, or a recognized
  // surname-only / initial-abbreviated alias of the other, given who the two players in the
  // match actually are (so "Nakashima" can only alias to the Nakashima playing this match, not
  // any Nakashima anywhere).
  const normA = normalizeEvidenceIdentity(a);
  const normB = normalizeEvidenceIdentity(b);
  if (normA === normB) return true;
  const aliasesOfA = new Set(safeEvidenceAliases(a, candidate.player2Name).map(normalizeEvidenceIdentity));
  const aliasesOfB = new Set(safeEvidenceAliases(b, candidate.player1Name).map(normalizeEvidenceIdentity));
  return aliasesOfA.has(normB) || aliasesOfB.has(normA);
}

function hasTwoDistinctPlayers(identity: CanonicalEvidenceMatchIdentity): boolean {
  const [a, b] = identity.playerPair.split("~");
  return Boolean(a) && Boolean(b) && a !== b && a !== "name:unknown" && b !== "name:unknown";
}

export class CanonicalMatchRegistry {
  private byKey = new Map<string, AcceptedHistoricalMatch>();
  private byPlayerPair = new Map<string, AcceptedHistoricalMatch[]>();

  /** Read-only snapshot count, for assertions/idempotency checks in tests and callers. */
  get size(): number {
    return this.byKey.size;
  }

  private candidatesForPair(playerPair: string): AcceptedHistoricalMatch[] {
    return this.byPlayerPair.get(playerPair) ?? [];
  }

  /**
   * Pure classification: does NOT mutate the registry. Safe to call repeatedly / speculatively.
   */
  resolve(candidate: CandidateHistoricalMatch): MatchResolution {
    const identity = buildCanonicalEvidenceMatchIdentity(candidate);

    if (!hasTwoDistinctPlayers(identity)) {
      return { status: "AMBIGUOUS", reason: "MISSING_OR_DUPLICATE_PLAYER_IDENTITY", identity: null };
    }
    if (!identity.date) {
      return { status: "AMBIGUOUS", reason: "MISSING_DATE", identity };
    }
    if (!identity.tourFamily) {
      return { status: "AMBIGUOUS", reason: "MISSING_TOUR_FAMILY", identity };
    }

    // Fast path: exact canonical key already registered.
    const exact = this.byKey.get(identity.key);
    if (exact) return this.classifyAgainstCanonical(identity, exact, candidate);

    // Slow path: same two players, date-compatible, but the strict key differs (e.g. a
    // tournament-name formatting difference, or a round-label difference between sources).
    const pairCandidates = this.candidatesForPair(identity.playerPair);
    const compatible = pairCandidates.filter((accepted) => evidenceMatchIdentityCompatible(identity, accepted.identity));
    if (compatible.length === 1) {
      return this.classifyAgainstCanonical(identity, compatible[0], candidate);
    }
    if (compatible.length > 1) {
      // Mirrors the project's existing fail-closed rule (uniqueEvidenceMatch): more than one
      // plausible match means we cannot safely pick one. Never guessed.
      return { status: "AMBIGUOUS", reason: "MULTIPLE_COMPATIBLE_CANONICAL_MATCHES", identity, detail: compatible.map((c) => c.identity.key) };
    }

    // Same two players on a compatible date, but the tournament strings disagree after
    // normalization (evidenceMatchIdentityCompatible already returned false for that reason
    // above). This is the one case this module treats specially, because it's the most likely
    // real collision across differently-formatted sources (e.g. a tour-slug tournament name vs.
    // a full descriptive name) -- and the most dangerous one to get wrong either way: silently
    // calling it NEW risks a duplicate canonical match; silently calling it a DUPLICATE risks
    // merging two genuinely different matches. So it is quarantined, not resolved automatically.
    const sameDateDifferentTournament = pairCandidates.filter(
      (accepted) =>
        evidenceDateCompatible(identity.date, accepted.identity.date) &&
        identity.tournament &&
        accepted.identity.tournament &&
        identity.tournament !== accepted.identity.tournament,
    );
    if (sameDateDifferentTournament.length > 0) {
      return {
        status: "AMBIGUOUS",
        reason: "SAME_PLAYERS_SAME_DATE_TOURNAMENT_MISMATCH",
        identity,
        detail: sameDateDifferentTournament.map((c) => ({ tournament: c.identity.tournament, source: c.primarySource })),
      };
    }

    return { status: "NEW", identity };
  }

  private classifyAgainstCanonical(
    identity: CanonicalEvidenceMatchIdentity,
    canonical: AcceptedHistoricalMatch,
    candidate: CandidateHistoricalMatch,
  ): MatchResolution {
    if (winnersAgree(canonical.winnerName, candidate.winnerName, candidate)) {
      return { status: "DUPLICATE", identity, canonical };
    }
    return {
      status: "CONFLICT",
      identity,
      canonical,
      reason: "WINNER_DISAGREEMENT",
      incomingWinner: candidate.winnerName,
      canonicalWinner: canonical.winnerName,
    };
  }

  /**
   * Resolve and, for NEW and DUPLICATE outcomes, commit the effect to the registry:
   *  - NEW inserts a new canonical match.
   *  - DUPLICATE adds the incoming source as corroboration of the existing canonical match; no
   *    new canonical row, no double credit.
   *  - CONFLICT and AMBIGUOUS never mutate the registry -- the caller is expected to route these
   *    to a review/quarantine mechanism and leave the source record unimported, per policy.
   * Idempotent: processing the exact same candidate (from the same or a different source) any
   * number of times after the first converges on DUPLICATE and never grows the registry further.
   */
  process(candidate: CandidateHistoricalMatch): MatchResolution {
    const resolution = this.resolve(candidate);
    if (resolution.status === "NEW") {
      const accepted: AcceptedHistoricalMatch = {
        identity: resolution.identity,
        winnerName: candidate.winnerName,
        score: candidate.score ?? null,
        primarySource: { sourceId: candidate.sourceId, sourceRef: candidate.sourceRef },
        corroboratingSources: [],
      };
      this.byKey.set(resolution.identity.key, accepted);
      const pairList = this.byPlayerPair.get(resolution.identity.playerPair) ?? [];
      pairList.push(accepted);
      this.byPlayerPair.set(resolution.identity.playerPair, pairList);
    } else if (resolution.status === "DUPLICATE") {
      const alreadyCorroborated = resolution.canonical.corroboratingSources.some(
        (s) => s.sourceId === candidate.sourceId && s.sourceRef === candidate.sourceRef,
      );
      const isPrimary =
        resolution.canonical.primarySource.sourceId === candidate.sourceId &&
        resolution.canonical.primarySource.sourceRef === candidate.sourceRef;
      if (!alreadyCorroborated && !isPrimary) {
        resolution.canonical.corroboratingSources.push({ sourceId: candidate.sourceId, sourceRef: candidate.sourceRef });
      }
    }
    return resolution;
  }

  /** All accepted canonical matches, for inspection/export. Does not include quarantined rows. */
  list(): AcceptedHistoricalMatch[] {
    return [...this.byKey.values()];
  }
}
