import { eq } from "drizzle-orm";
import {
  canonicalPlayersTable,
  db,
  playerAliasesTable,
} from "@workspace/db";
import type { PlayerSummary } from "./types";
import { normalizePlayerName } from "./playerIdentity";

export interface CanonicalScreenshotPlayer {
  id: string;
  displayName: string;
  normalizedName: string;
  tour: string | null;
}

export interface CanonicalScreenshotIdentityIndex {
  players: CanonicalScreenshotPlayer[];
  names: Map<string, Set<string>>;
}

export type CanonicalScreenshotResolution =
  | { status: "resolved"; player: PlayerSummary }
  | { status: "ambiguous"; candidates: PlayerSummary[] }
  | { status: "not-found" };

function toSummary(player: CanonicalScreenshotPlayer): PlayerSummary {
  return {
    id: player.id,
    name: player.displayName,
    countryCode: null,
    currentRank: null,
    tour: player.tour,
    source: "historical-match",
  };
}

/**
 * Builds an exact-name index from the already-authoritative canonical identity
 * tables. Aliases are deliberately restricted to verified rows; OCR similarity
 * and fuzzy matching belong to the provider fallback, never this local tier.
 */
export function buildCanonicalScreenshotIdentityIndex(
  players: CanonicalScreenshotPlayer[],
  aliases: Array<{ normalizedName: string; canonicalPlayerId: string; verificationStatus?: string | null }>,
): CanonicalScreenshotIdentityIndex {
  const byId = new Map(players.map((player) => [player.id, player]));
  const names = new Map<string, Set<string>>();
  const add = (normalizedName: string, id: string) => {
    const normalized = normalizePlayerName(normalizedName);
    if (!normalized || !byId.has(id)) return;
    const ids = names.get(normalized) ?? new Set<string>();
    ids.add(id);
    names.set(normalized, ids);
  };

  for (const player of players) add(player.normalizedName || player.displayName, player.id);
  for (const alias of aliases) {
    if (alias.verificationStatus && alias.verificationStatus.toLowerCase() !== "verified") continue;
    add(alias.normalizedName, alias.canonicalPlayerId);
  }

  return { players, names };
}

export function resolveCanonicalScreenshotName(
  recognizedName: string,
  index: CanonicalScreenshotIdentityIndex,
): CanonicalScreenshotResolution {
  const normalized = normalizePlayerName(recognizedName);
  if (!normalized) return { status: "not-found" };
  let ids = [...(index.names.get(normalized) ?? [])].sort();
  // East Asian names are commonly emitted in opposite family/given-name order
  // across providers. Accept only an exact two-token reversal, and preserve
  // ambiguity if more than one canonical identity owns that reversed name.
  if (ids.length === 0) {
    const words = normalized.split(/\s+/).filter(Boolean);
    if (words.length === 2) {
      ids = [...(index.names.get(`${words[1]} ${words[0]}`) ?? [])].sort();
    }
  }
  const candidates = ids
    .map((id) => index.players.find((player) => player.id === id))
    .filter((player): player is CanonicalScreenshotPlayer => Boolean(player))
    .map(toSummary);
  if (candidates.length === 1) return { status: "resolved", player: candidates[0]! };
  if (candidates.length > 1) return { status: "ambiguous", candidates };
  return { status: "not-found" };
}

let cachedIndex: Promise<CanonicalScreenshotIdentityIndex> | null = null;

async function loadCanonicalScreenshotIdentityIndex(): Promise<CanonicalScreenshotIdentityIndex> {
  const [players, aliases] = await Promise.all([
    db
      .select({
        id: canonicalPlayersTable.id,
        displayName: canonicalPlayersTable.displayName,
        normalizedName: canonicalPlayersTable.normalizedName,
        tour: canonicalPlayersTable.tour,
      })
      .from(canonicalPlayersTable),
    db
      .select({
        normalizedName: playerAliasesTable.normalizedName,
        canonicalPlayerId: playerAliasesTable.canonicalPlayerId,
        verificationStatus: playerAliasesTable.verificationStatus,
      })
      .from(playerAliasesTable)
      .where(eq(playerAliasesTable.verificationStatus, "verified")),
  ]);
  return buildCanonicalScreenshotIdentityIndex(players, aliases);
}

export async function resolveCanonicalScreenshotPlayer(
  recognizedName: string,
): Promise<CanonicalScreenshotResolution> {
  try {
    cachedIndex ??= loadCanonicalScreenshotIdentityIndex();
    return resolveCanonicalScreenshotName(recognizedName, await cachedIndex);
  } catch {
    // A local database read failure must not turn into an invented identity.
    // The caller continues to the bounded external provider fallback.
    cachedIndex = null;
    return { status: "not-found" };
  }
}

export function clearCanonicalScreenshotIdentityCacheForTests(): void {
  cachedIndex = null;
}