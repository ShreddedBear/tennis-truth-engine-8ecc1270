import {
  normalizePlayerName,
  resolvePlayerNameWithAmbiguity,
  type NameResolutionResult,
  type PlayerIdentityIndex,
} from "./playerIdentity.js";
import type { HistoricalFixture } from "./types.js";

export type LiveTennisIdentityResolutionMethod =
  | "existing-canonical-provider-mapping"
  | "exact-normalized-identity"
  | "metadata-disambiguation"
  | "unresolved";

export interface LiveTennisIdentityAuditEntry {
  providerPlayerId: string;
  providerPlayerName: string;
  canonicalPlayerId: string | null;
  resolutionStatus: "resolved" | "ambiguous" | "unresolved";
  method: LiveTennisIdentityResolutionMethod;
  candidates: string[];
  provenance: string;
}

export interface LiveTennisIdentityAudit {
  entries: LiveTennisIdentityAuditEntry[];
  counts: {
    resolved: number;
    ambiguous: number;
    unresolved: number;
    byMethod: Record<LiveTennisIdentityResolutionMethod, number>;
  };
}

export interface LiveTennisIdentityAuditOptions {
  /**
   * Optional deterministic metadata disambiguator. It must return exactly one canonical ID or
   * null; fuzzy matching and database writes are deliberately outside this pure audit function.
   */
  metadataResolver?: (player: { id: string; name: string; tour: string | null }, fixture: HistoricalFixture) => string | null;
}

function exactResolution(index: PlayerIdentityIndex, id: string, name: string): NameResolutionResult {
  const byProviderId = index.canonicalIdById.get(id);
  if (byProviderId) return { ambiguous: false, id: byProviderId, confidence: "exact" };
  return resolvePlayerNameWithAmbiguity(index, name);
}

export function auditLiveTennisIdentity(
  fixtures: HistoricalFixture[],
  index: PlayerIdentityIndex,
  options: LiveTennisIdentityAuditOptions = {},
): LiveTennisIdentityAudit {
  const entries = new Map<string, LiveTennisIdentityAuditEntry>();
  const add = (fixture: HistoricalFixture, id: string, name: string, tour: string | null) => {
    const key = `${id}\u0000${name}`;
    if (entries.has(key)) return;

    const direct = index.canonicalIdById.get(id);
    if (direct) {
      entries.set(key, {
        providerPlayerId: id,
        providerPlayerName: name,
        canonicalPlayerId: direct,
        resolutionStatus: "resolved",
        method: "existing-canonical-provider-mapping",
        candidates: [direct],
        provenance: "playerIdentityIndex.canonicalIdById",
      });
      return;
    }

    const exact = exactResolution(index, id, name);
    if (exact && exact.ambiguous === false) {
      entries.set(key, {
        providerPlayerId: id,
        providerPlayerName: name,
        canonicalPlayerId: exact.id,
        resolutionStatus: "resolved",
        method: "exact-normalized-identity",
        candidates: [exact.id],
        provenance: `playerIdentityIndex.canonicalIdByName:${normalizePlayerName(name)}`,
      });
      return;
    }

    if (exact?.ambiguous) {
      const metadataId = options.metadataResolver?.({ id, name, tour }, fixture) ?? null;
      if (metadataId) {
        entries.set(key, {
          providerPlayerId: id,
          providerPlayerName: name,
          canonicalPlayerId: metadataId,
          resolutionStatus: "resolved",
          method: "metadata-disambiguation",
          candidates: exact.candidates,
          provenance: "caller-supplied deterministic metadata resolver",
        });
        return;
      }
      entries.set(key, {
        providerPlayerId: id,
        providerPlayerName: name,
        canonicalPlayerId: null,
        resolutionStatus: "ambiguous",
        method: "unresolved",
        candidates: exact.candidates,
        provenance: `playerIdentityIndex.canonicalIdByName:${normalizePlayerName(name)}`,
      });
      return;
    }

    entries.set(key, {
      providerPlayerId: id,
      providerPlayerName: name,
      canonicalPlayerId: null,
      resolutionStatus: "unresolved",
      method: "unresolved",
      candidates: [],
      provenance: "no exact canonical provider or normalized identity match",
    });
  };

  for (const fixture of fixtures) {
    add(fixture, fixture.player1Id, fixture.player1Name, fixture.tour);
    add(fixture, fixture.player2Id, fixture.player2Name, fixture.tour);
  }

  const all = [...entries.values()].sort((a, b) =>
    a.providerPlayerId.localeCompare(b.providerPlayerId, undefined, { numeric: true }) ||
    a.providerPlayerName.localeCompare(b.providerPlayerName),
  );
  const byMethod: Record<LiveTennisIdentityResolutionMethod, number> = {
    "existing-canonical-provider-mapping": 0,
    "exact-normalized-identity": 0,
    "metadata-disambiguation": 0,
    unresolved: 0,
  };
  let resolved = 0;
  let ambiguous = 0;
  let unresolved = 0;
  for (const entry of all) {
    if (entry.resolutionStatus === "resolved") resolved++;
    else if (entry.resolutionStatus === "ambiguous") ambiguous++;
    else unresolved++;
    byMethod[entry.method]++;
  }
  return { entries: all, counts: { resolved, ambiguous, unresolved, byMethod } };
}
