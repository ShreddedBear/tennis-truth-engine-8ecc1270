import { and, asc, eq, inArray, lt } from "drizzle-orm";
import { boolean, jsonb, pgTable, serial, text as pgText, timestamp } from "drizzle-orm/pg-core";

import { tryQuery } from "@/db/try-query";
import type { HistoryLane, HistoryEntry } from "./task18c-rank-form-workload";

// Read-only table descriptions kept local to this server-only adapter. The source of truth is
// lib/db/src/schema; repeating only the selected columns avoids adding a browser-reachable
// workspace dependency while preserving the shared warehouse table names and column types.
const historicalMatchesTable = pgTable("historical_matches", {
  id: serial("id"),
  externalId: pgText("external_id"),
  provider: pgText("provider"),
  tour: pgText("tour"),
  tournamentName: pgText("tournament_name"),
  tournamentLevel: pgText("tournament_level"),
  surface: pgText("surface"),
  round: pgText("round"),
  canonicalPlayer1Id: pgText("canonical_player1_id"),
  canonicalPlayer2Id: pgText("canonical_player2_id"),
  winnerId: pgText("winner_id"),
  scheduledStartAt: timestamp("scheduled_start_at", { withTimezone: true }),
  cancelled: boolean("cancelled"),
  sourceFile: pgText("source_file"),
  sourceUrl: pgText("source_url"),
  sourceLicense: pgText("source_license"),
  importProvenance: jsonb("import_provenance"),
});
const canonicalPlayersTable = pgTable("canonical_players", {
  id: pgText("id"),
  displayName: pgText("display_name"),
  reviewStatus: pgText("review_status"),
});
const playerAliasesTable = pgTable("player_aliases", {
  canonicalPlayerId: pgText("canonical_player_id"),
  externalPlayerName: pgText("external_player_name"),
  verificationStatus: pgText("verification_status"),
});

const PROVIDER = "sackmann";
const APPROVED_IMPORTER = "approved-aneeshers-sackmann";
const APPROVED_REPOSITORY = "Aneeshers/tennis-sackmann-archive";
const APPROVED_BRANCH = "main";
const APPROVED_LICENSE = "CC BY-NC-SA 4.0";

type AnyRow = Record<string, unknown>;

export type SackmannIdentityRow = {
  id: string;
  displayName: string;
  reviewStatus?: string | null;
};

export type SackmannAliasRow = {
  canonicalPlayerId: string;
  externalPlayerName: string;
  verificationStatus?: string | null;
};

/**
 * The small, explicit subset of historical_matches consumed by the HistoryLane boundary.
 * Keeping this structural makes the admission function easy to test without a database.
 */
export type SackmannMatchRow = {
  id?: number | string | null;
  externalId?: string | null;
  provider?: string | null;
  tour?: string | null;
  tournamentName?: string | null;
  tournamentLevel?: string | null;
  surface?: string | null;
  round?: string | null;
  canonicalPlayer1Id?: string | null;
  canonicalPlayer2Id?: string | null;
  winnerId?: string | null;
  scheduledStartAt?: Date | string | null;
  cancelled?: boolean | null;
  sourceFile?: string | null;
  sourceUrl?: string | null;
  sourceLicense?: string | null;
  importProvenance?: unknown;
};

type Provenance = {
  importer?: unknown;
  repository?: unknown;
  branch?: unknown;
  sourceFile?: unknown;
  sourceUrl?: unknown;
  sourceLicense?: unknown;
};

// A full approved archive read is intentionally bounded, but 250 ms was too short once the
// warehouse contained the complete 2012-current corpus and made valid evidence look unavailable.
const WAREHOUSE_READ_BUDGET_MS = 15_000;
const warehouseHistoryCache = new Map<string, Promise<ApprovedSackmannHistoryResult>>();

async function bounded<T>(promise: Promise<T>, budgetMs = WAREHOUSE_READ_BUDGET_MS): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<null>((resolve) => { timer = setTimeout(() => resolve(null), budgetMs); }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

type LaneDetail = {
  canonical_player_id: string;
  opponent_canonical_player_id: string;
  canonical_player_name: string;
  opponent_canonical_player_name: string;
  external_id: string;
  source_name: string;
  source_url: string | null;
  source_license: string | null;
  provenance: Record<string, unknown>;
};

export type ApprovedSackmannHistoryResult = {
  available: boolean;
  lanes: Record<string, HistoryLane>;
  accepted: number;
};

function value(row: AnyRow, camel: string, snake: string): unknown {
  return row[camel] ?? row[snake];
}

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function validDate(value: unknown): value is string {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value ?? ""));
}

function asOfCutoff(asOfDate: string): number | null {
  if (!validDate(asOfDate)) return null;
  const timestamp = Date.parse(`${asOfDate}T00:00:00.000Z`);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function rowStart(row: SackmannMatchRow): number | null {
  const timestamp = row.scheduledStartAt instanceof Date
    ? row.scheduledStartAt.getTime()
    : Date.parse(text(row.scheduledStartAt));
  return Number.isFinite(timestamp) ? timestamp : null;
}

function approvedProvenance(row: SackmannMatchRow): row is SackmannMatchRow & {
  importProvenance: Provenance;
} {
  const provenance = row.importProvenance;
  if (!provenance || typeof provenance !== "object" || Array.isArray(provenance)) return false;
  const p = provenance as Provenance;
  const sourceUrl = text(p.sourceUrl);
  const approvedUrl = new RegExp(`^https://raw\\.githubusercontent\\.com/${APPROVED_REPOSITORY}/${APPROVED_BRANCH}/.+\\.csv$`, "i");
  return p.importer === APPROVED_IMPORTER
    && p.repository === APPROVED_REPOSITORY
    && p.branch === APPROVED_BRANCH
    && p.sourceLicense === APPROVED_LICENSE
    && Boolean(text(p.sourceFile))
    && approvedUrl.test(sourceUrl)
    && text(row.sourceFile) === text(p.sourceFile)
    && text(row.sourceUrl) === sourceUrl
    && text(row.sourceLicense) === APPROVED_LICENSE;
}

function familyFor(row: SackmannMatchRow): "ATP_MAIN" | "WTA_MAIN" | "ATP_CHALLENGER" | "WTA_CHALLENGER" | null {
  const tour = text(row.tour).toUpperCase();
  if (tour !== "ATP" && tour !== "WTA") return null;
  const level = `${text(row.tournamentLevel)} ${text(row.tournamentName)}`.toLowerCase();
  // The existing HistoryLane has four families. ITF rows are deliberately not
  // relabeled as tour-level history; they remain unavailable rather than being
  // silently promoted into a different evidence family.
  if (/\bitf\b/.test(level)) return null;
  const challenger = /\bchallenger\b|\b125\b/.test(level);
  return `${tour}_${challenger ? "CHALLENGER" : "MAIN"}` as "ATP_MAIN" | "WTA_MAIN" | "ATP_CHALLENGER" | "WTA_CHALLENGER";
}

function usableNames(identity: SackmannIdentityRow | undefined, aliases: SackmannAliasRow[]) {
  if (!identity || text(identity.displayName) === "") return [];
  const names = new Set([text(identity.displayName)]);
  for (const alias of aliases) {
    if (alias.verificationStatus && alias.verificationStatus !== "verified") continue;
    const name = text(alias.externalPlayerName);
    if (name) names.add(name);
  }
  return [...names];
}

function normalizedRow(row: SackmannMatchRow): AnyRow {
  return row as unknown as AnyRow;
}

/**
 * Converts admitted warehouse rows into the same seven-field HistoryLane entries
 * consumed by the existing producers. Canonical names are used as the lane keys;
 * verified aliases are accepted as proof that the canonical IDs are usable, while
 * avoiding duplicate match observations for every provider spelling.
 */
export function buildApprovedSackmannHistoryLanes(
  rows: SackmannMatchRow[],
  identities: SackmannIdentityRow[],
  aliases: SackmannAliasRow[] = [],
  asOfDate: string,
): ApprovedSackmannHistoryResult {
  const cutoff = asOfCutoff(asOfDate);
  if (cutoff === null) return { available: true, lanes: {}, accepted: 0 };

  const byId = new Map(identities.map((identity) => [text(identity.id), identity]));
  const aliasesById = new Map<string, SackmannAliasRow[]>();
  for (const alias of aliases) {
    const id = text(alias.canonicalPlayerId);
    aliasesById.set(id, [...(aliasesById.get(id) ?? []), alias]);
  }

  const admitted = new Map<string, {
    row: SackmannMatchRow & { importProvenance: Provenance };
    family: "ATP_MAIN" | "WTA_MAIN" | "ATP_CHALLENGER" | "WTA_CHALLENGER";
    p1: SackmannIdentityRow;
    p2: SackmannIdentityRow;
  } | null>();

  for (const row of rows) {
    const r = normalizedRow(row);
    const provider = text(value(r, "provider", "provider"));
    const p1Id = text(value(r, "canonicalPlayer1Id", "canonical_player1_id"));
    const p2Id = text(value(r, "canonicalPlayer2Id", "canonical_player2_id"));
    const winnerId = text(value(r, "winnerId", "winner_id"));
    const start = rowStart(row);
    const p1 = byId.get(p1Id);
    const p2 = byId.get(p2Id);
    const family = familyFor(row);
    if (provider !== PROVIDER || !p1Id || !p2Id || p1Id === p2Id || !winnerId
      || (row.cancelled ?? false) || (winnerId !== p1Id && winnerId !== p2Id)
      || start === null || start >= cutoff || !family || !approvedProvenance(row)
      || !usableNames(p1, aliasesById.get(p1Id) ?? []).length
      || !usableNames(p2, aliasesById.get(p2Id) ?? []).length) continue;

    const externalId = text(row.externalId) || String(row.id ?? "");
    if (!externalId) continue;
    const tournament = text(row.tournamentName);
    const surface = text(row.surface);
    const round = text(row.round);
    const pair = [p1Id, p2Id].sort();
    // The provider external ID is the stable match identity. Keep the canonical
    // pair/context in the value (and in the emitted details) for auditability,
    // but never let a repeated import create two observations.
    const key = [family, externalId, ...pair, tournament.toLowerCase(), surface.toLowerCase(), round.toLowerCase()].join("|");
    const candidate = { row, family, p1: p1!, p2: p2! };
    const existing = admitted.get(key);
    if (existing === null) continue;
    if (existing && text(existing.row.winnerId) !== winnerId) {
      admitted.set(key, null);
    } else if (!existing || externalId.localeCompare(text(existing.row.externalId) || String(existing.row.id ?? "")) < 0) {
      admitted.set(key, candidate);
    }
  }

  const lanes: Record<string, HistoryLane> = {
    ATP_MAIN: {}, WTA_MAIN: {}, ATP_CHALLENGER: {}, WTA_CHALLENGER: {},
  };
  let accepted = 0;
  for (const candidate of admitted.values()) {
    if (!candidate) continue;
    const { row, family, p1, p2 } = candidate;
    const p1Name = text(p1.displayName);
    const p2Name = text(p2.displayName);
    const p1Won = text(row.winnerId) === text(row.canonicalPlayer1Id);
    const date = new Date(rowStart(row)!).toISOString().slice(0, 10);
    const sourceName = text(row.sourceFile) || text(row.sourceUrl) || APPROVED_REPOSITORY;
    const detail1: LaneDetail = {
      canonical_player_id: text(row.canonicalPlayer1Id),
      opponent_canonical_player_id: text(row.canonicalPlayer2Id),
      canonical_player_name: p1Name,
      opponent_canonical_player_name: p2Name,
      external_id: text(row.externalId) || String(row.id ?? ""),
      source_name: sourceName,
      source_url: text(row.sourceUrl) || null,
      source_license: text(row.sourceLicense) || null,
      provenance: row.importProvenance,
    };
    const detail2: LaneDetail = {
      ...detail1,
      canonical_player_id: text(row.canonicalPlayer2Id),
      opponent_canonical_player_id: text(row.canonicalPlayer1Id),
      canonical_player_name: p2Name,
      opponent_canonical_player_name: p1Name,
    };
    const entry = (player: string, opponent: string, won: number, detail: LaneDetail) =>
      [date, text(row.tournamentName), text(row.surface), opponent, won, text(row.round), sourceName, detail] as unknown as HistoryEntry;
    lanes[family][p1Name.toLowerCase()] = [...(lanes[family][p1Name.toLowerCase()] ?? []), entry(p1Name, p2Name, p1Won ? 1 : 0, detail1)];
    lanes[family][p2Name.toLowerCase()] = [...(lanes[family][p2Name.toLowerCase()] ?? []), entry(p2Name, p1Name, p1Won ? 0 : 1, detail2)];
    accepted++;
  }
  return { available: true, lanes, accepted };
}

/**
 * Reads only the shared warehouse tables needed by the adapter. Any query failure
 * is an unavailable warehouse, not permission to fabricate or widen static data.
 */
async function loadApprovedSackmannHistoryUncached(asOfDate: string): Promise<ApprovedSackmannHistoryResult> {
  const cutoff = asOfCutoff(asOfDate);
  if (cutoff === null) return { available: false, lanes: {}, accepted: 0 };
  // Keep the node-postgres client out of pure adapter/test imports. The database is
  // reached only by this explicit async boundary.
  const { db } = await import("@/db/client.server");
  const matches = await bounded(tryQuery(() => db.select({
    id: historicalMatchesTable.id,
    externalId: historicalMatchesTable.externalId,
    provider: historicalMatchesTable.provider,
    tour: historicalMatchesTable.tour,
    tournamentName: historicalMatchesTable.tournamentName,
    tournamentLevel: historicalMatchesTable.tournamentLevel,
    surface: historicalMatchesTable.surface,
    round: historicalMatchesTable.round,
    canonicalPlayer1Id: historicalMatchesTable.canonicalPlayer1Id,
    canonicalPlayer2Id: historicalMatchesTable.canonicalPlayer2Id,
    winnerId: historicalMatchesTable.winnerId,
    scheduledStartAt: historicalMatchesTable.scheduledStartAt,
    cancelled: historicalMatchesTable.cancelled,
    sourceFile: historicalMatchesTable.sourceFile,
    sourceUrl: historicalMatchesTable.sourceUrl,
    sourceLicense: historicalMatchesTable.sourceLicense,
    importProvenance: historicalMatchesTable.importProvenance,
  }).from(historicalMatchesTable).where(and(
    eq(historicalMatchesTable.provider, PROVIDER),
    lt(historicalMatchesTable.scheduledStartAt, new Date(cutoff)),
  )).orderBy(asc(historicalMatchesTable.scheduledStartAt), asc(historicalMatchesTable.id))));
  if (!matches || matches.error || !matches.data) return { available: false, lanes: {}, accepted: 0 };

  const ids = [
    ...new Set(
      matches.data.flatMap((row) =>
        [row.canonicalPlayer1Id, row.canonicalPlayer2Id].filter((id): id is string => Boolean(id)),
      ),
    ),
  ];
  if (!ids.length) return { available: true, lanes: { ATP_MAIN: {}, WTA_MAIN: {}, ATP_CHALLENGER: {}, WTA_CHALLENGER: {} }, accepted: 0 };
  const players = await bounded(
    tryQuery(() => db.select({
      id: canonicalPlayersTable.id,
      displayName: canonicalPlayersTable.displayName,
      reviewStatus: canonicalPlayersTable.reviewStatus,
    }).from(canonicalPlayersTable).where(and(
      inArray(canonicalPlayersTable.id, ids),
      eq(canonicalPlayersTable.reviewStatus, "approved"),
    ))),
  );
  if (!players || players.error || !players.data) return { available: false, lanes: {}, accepted: 0 };
  const aliases = await bounded(
    tryQuery(() => db.select({
      canonicalPlayerId: playerAliasesTable.canonicalPlayerId,
      externalPlayerName: playerAliasesTable.externalPlayerName,
      verificationStatus: playerAliasesTable.verificationStatus,
    }).from(playerAliasesTable).where(and(
      inArray(playerAliasesTable.canonicalPlayerId, ids),
      eq(playerAliasesTable.verificationStatus, "verified"),
    ))),
  );
  if (!aliases || aliases.error || !aliases.data) return { available: false, lanes: {}, accepted: 0 };
  return buildApprovedSackmannHistoryLanes(
    matches.data as SackmannMatchRow[],
    players.data as SackmannIdentityRow[],
    aliases.data as SackmannAliasRow[],
    asOfDate,
  );
}

export function loadApprovedSackmannHistory(asOfDate: string): Promise<ApprovedSackmannHistoryResult> {
  const cached = warehouseHistoryCache.get(asOfDate);
  if (cached) return cached;
  const pending = loadApprovedSackmannHistoryUncached(asOfDate);
  warehouseHistoryCache.set(asOfDate, pending);
  while (warehouseHistoryCache.size > 4) {
    const oldest = warehouseHistoryCache.keys().next().value;
    if (oldest !== undefined) warehouseHistoryCache.delete(oldest);
  }
  return pending;
}

export const _approvedSackmannHistory = {
  approvedProvenance,
  familyFor,
  asOfCutoff,
};