import { buildCanonicalEvidenceMatchIdentity, evidenceTourCompatible, type CanonicalEvidenceMatchIdentity, type EvidenceTourFamily } from "./evidence-match-identity";

export type ApprovedPbpTour = "ATP_MAIN" | "WTA_MAIN" | "ATP_CHALLENGER" | "WTA_CHALLENGER";

export function canonicalApprovedPbpIdentity(args: {
  tour: ApprovedPbpTour;
  player1: string;
  player2: string;
  tournament?: string | null;
  date?: string | null;
  round?: string | null;
  eventLevel?: string | null;
}) {
  const identity = buildCanonicalEvidenceMatchIdentity({
    player1Name: args.player1,
    player2Name: args.player2,
    tournament: args.tournament,
    date: args.date,
    round: args.round,
    tour: args.tour,
    eventLevel: args.eventLevel,
  });
  return evidenceTourCompatible(args.tour as EvidenceTourFamily, identity.tourFamily) ? identity : null;
}

export function claimUniqueApprovedPbp(args: {
  matchId: string | number | null | undefined;
  identity: CanonicalEvidenceMatchIdentity | null;
  seenMatchIds: Set<string>;
  seenCanonicalKeys: Set<string>;
}) {
  const matchId = String(args.matchId ?? "").trim();
  if (!matchId || !args.identity) return false;
  if (args.seenMatchIds.has(matchId) || args.seenCanonicalKeys.has(args.identity.key)) return false;
  args.seenMatchIds.add(matchId);
  args.seenCanonicalKeys.add(args.identity.key);
  return true;
}

export function isApprovedWtaChallengerPbpRow(row: { tour?: unknown; status?: unknown }) {
  return row.tour === "WTA_CHALLENGER" && row.status === "APPROVED_WTA_CHALLENGER_PBP";
}
