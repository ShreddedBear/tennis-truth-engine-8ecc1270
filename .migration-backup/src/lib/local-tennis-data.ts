// Local/static evidence fallback for audit runs when the live research provider
// is unavailable. This module deliberately contains no invented tennis facts.
// Populate records from licensed/publicly-permitted datasets or user-supplied
// verified data. The audit may use only explicitly present fields.

export interface LocalPlayerEvidence {
  canonicalName: string;
  aliases?: string[];
  ranking?: number;
  age?: number;
  handedness?: string;
  surfaceRecords?: Record<string, { wins: number; losses: number }>;
  recentMatches?: Array<{
    date: string;
    opponent: string;
    surface?: string;
    won: boolean;
    score?: string;
  }>;
  serve?: {
    firstServePct?: number;
    firstServePointsWonPct?: number;
    secondServePointsWonPct?: number;
    aceRate?: number;
    doubleFaultRate?: number;
    holdPct?: number;
    breakPointsSavedPct?: number;
  };
  return?: {
    firstServeReturnPointsWonPct?: number;
    secondServeReturnPointsWonPct?: number;
    returnPointsWonPct?: number;
    breakPct?: number;
    breakPointsConvertedPct?: number;
  };
  decidingSet?: { wins: number; losses: number };
  tiebreak?: { wins: number; losses: number };
  source: string;
  sourceUrl?: string;
  retrievedAt?: string;
}

// Intentionally empty until verified/licensed data is imported. Never seed
// demo players or fabricated values into production audits.
export const LOCAL_PLAYER_EVIDENCE: LocalPlayerEvidence[] = [];

function norm(value: string): string {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function findLocalPlayerEvidence(name: string): LocalPlayerEvidence | null {
  const needle = norm(name);
  return LOCAL_PLAYER_EVIDENCE.find((row) =>
    [row.canonicalName, ...(row.aliases ?? [])].some((candidate) => norm(candidate) === needle),
  ) ?? null;
}

export function localEvidenceDossier(player: string): string | null {
  const row = findLocalPlayerEvidence(player);
  if (!row) return null;
  return JSON.stringify({
    player: row.canonicalName,
    ranking: row.ranking ?? null,
    age: row.age ?? null,
    handedness: row.handedness ?? null,
    surfaceRecords: row.surfaceRecords ?? null,
    recentMatches: row.recentMatches ?? null,
    serve: row.serve ?? null,
    return: row.return ?? null,
    decidingSet: row.decidingSet ?? null,
    tiebreak: row.tiebreak ?? null,
    source: row.source,
    sourceUrl: row.sourceUrl ?? null,
    retrievedAt: row.retrievedAt ?? null,
  });
}
