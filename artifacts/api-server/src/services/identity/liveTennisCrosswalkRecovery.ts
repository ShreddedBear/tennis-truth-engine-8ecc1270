import { normalizeCanonicalPlayerName } from "./canonicalPlayerResolver";

export interface LiveTennisAuthoritativeProfile {
  id: string;
  name: string;
  birthday: string | null;
  country: string | null;
  hand?: string | null;
}

export interface SackmannIdentityObservation {
  tour: "ATP" | "WTA";
  playerId: string;
  playerName: string;
  country: string;
  age: number;
  tournamentDate: string;
  sourceFile: string;
  tournamentId: string;
}

export interface RecoveredLiveTennisAlias {
  externalPlayerId: string;
  externalPlayerName: string;
  canonicalPlayerId: string;
  sourcePlayerId: string;
  resolutionMethod: "provider-profile-exact-multifield";
  evidence: {
    liveProfile: {
      birthday: string;
      country: string;
      hand: string | null;
    };
    sackmann: {
      sourcePlayerId: string;
      observations: Array<{
        sourceFile: string;
        tournamentDate: string;
        country: string;
        age: number;
        tournamentId: string;
      }>;
    };
  };
}

export type ProfileRecoveryResult =
  | { status: "deterministic"; alias: RecoveredLiveTennisAlias }
  | { status: "ambiguous"; sourcePlayerIds: string[] }
  | { status: "unresolved"; reason: string };

function compactDate(value: string): string {
  return value.replaceAll(/[^0-9]/g, "").slice(0, 8);
}

function ageAtDate(birthday: string, tournamentDate: string): number | null {
  const birth = compactDate(birthday);
  const event = compactDate(tournamentDate);
  if (birth.length !== 8 || event.length !== 8) return null;
  const birthMs = Date.UTC(
    Number(birth.slice(0, 4)),
    Number(birth.slice(4, 6)) - 1,
    Number(birth.slice(6, 8)),
  );
  const eventMs = Date.UTC(
    Number(event.slice(0, 4)),
    Number(event.slice(4, 6)) - 1,
    Number(event.slice(6, 8)),
  );
  if (!Number.isFinite(birthMs) || !Number.isFinite(eventMs) || eventMs <= birthMs) return null;
  return (eventMs - birthMs) / 86_400_000 / 365.25;
}

export function recoverLiveTennisAlias(
  profile: LiveTennisAuthoritativeProfile,
  observations: SackmannIdentityObservation[],
  canonicalBySourcePlayerId: ReadonlyMap<string, string>,
): ProfileRecoveryResult {
  if (!profile.birthday || !profile.country) {
    return { status: "unresolved", reason: "authoritative profile lacks birthday or country" };
  }
  const normalizedName = normalizeCanonicalPlayerName(profile.name);
  const country = profile.country.toUpperCase();
  const matchedBySourceId = new Map<string, SackmannIdentityObservation[]>();
  for (const observation of observations) {
    if (normalizeCanonicalPlayerName(observation.playerName) !== normalizedName) continue;
    if (observation.country.toUpperCase() !== country) continue;
    const expectedAge = ageAtDate(profile.birthday, observation.tournamentDate);
    if (
      expectedAge === null ||
      !Number.isFinite(observation.age) ||
      Math.abs(expectedAge - observation.age) > 0.002
    ) continue;
    const sourcePlayerId = `${observation.tour}:${observation.playerId}`;
    const group = matchedBySourceId.get(sourcePlayerId) ?? [];
    group.push(observation);
    matchedBySourceId.set(sourcePlayerId, group);
  }

  const sourcePlayerIds = [...matchedBySourceId.keys()].sort();
  if (sourcePlayerIds.length === 0) {
    return { status: "unresolved", reason: "no exact Sackmann name, country, and birthday-derived age match" };
  }
  if (sourcePlayerIds.length > 1) {
    return { status: "ambiguous", sourcePlayerIds };
  }
  const sourcePlayerId = sourcePlayerIds[0];
  const canonicalPlayerId = canonicalBySourcePlayerId.get(sourcePlayerId);
  if (!canonicalPlayerId) {
    return { status: "unresolved", reason: "exact Sackmann identity has no canonical alias" };
  }
  return {
    status: "deterministic",
    alias: {
      externalPlayerId: profile.id,
      externalPlayerName: profile.name,
      canonicalPlayerId,
      sourcePlayerId,
      resolutionMethod: "provider-profile-exact-multifield",
      evidence: {
        liveProfile: {
          birthday: profile.birthday,
          country: profile.country,
          hand: profile.hand ?? null,
        },
        sackmann: {
          sourcePlayerId,
          observations: matchedBySourceId.get(sourcePlayerId)!.slice(0, 3).map((observation) => ({
            sourceFile: observation.sourceFile,
            tournamentDate: observation.tournamentDate,
            country: observation.country,
            age: observation.age,
            tournamentId: observation.tournamentId,
          })),
        },
      },
    },
  };
}

export function rejectCanonicalCollisions(
  aliases: RecoveredLiveTennisAlias[],
  persistedAliases: ReadonlyArray<{
    externalPlayerId: string;
    canonicalPlayerId: string;
  }> = [],
): { accepted: RecoveredLiveTennisAlias[]; rejected: RecoveredLiveTennisAlias[] } {
  const providerIdsByCanonical = new Map<string, Set<string>>();
  for (const alias of persistedAliases) {
    const ids = providerIdsByCanonical.get(alias.canonicalPlayerId) ?? new Set<string>();
    ids.add(alias.externalPlayerId);
    providerIdsByCanonical.set(alias.canonicalPlayerId, ids);
  }
  for (const alias of aliases) {
    const ids = providerIdsByCanonical.get(alias.canonicalPlayerId) ?? new Set<string>();
    ids.add(alias.externalPlayerId);
    providerIdsByCanonical.set(alias.canonicalPlayerId, ids);
  }
  return {
    accepted: aliases.filter((alias) =>
      providerIdsByCanonical.get(alias.canonicalPlayerId)!.size === 1),
    rejected: aliases.filter((alias) =>
      providerIdsByCanonical.get(alias.canonicalPlayerId)!.size > 1),
  };
}
