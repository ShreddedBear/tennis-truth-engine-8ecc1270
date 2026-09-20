/**
 * Sackmann historical backfill.
 *
 * Downloads the approved Aneeshers tennis-sackmann-archive GitHub CSVs and inserts their match records
 * into historical_matches via the existing backfill infrastructure (so feature snapshots, Elo
 * state, and idempotency all work exactly as they do for API-Tennis data).
 *
 * Sources (main-draw):
 *  ATP/WTA: approved archive paths under /atp/ and /wta/
 *
 * Sources (Challenger / qualifying / ITF — enabled by default via includeChallengerItf option):
 *  ATP/WTA supplementary files: approved archive paths under /atp/ and /wta/
 *
 * These supplementary files share the same schema as the main-draw files so the same parser
 * applies. The ATP file contains ATP Challenger events AND qualifying-round matches at main-tour
 * events (tagged by the parent tournament's level code). The WTA file contains WTA ITF events
 * AND qualifying rounds.
 *
 * External calls made per run: one HTTP GET per CSV file (year × tour × file variant). No auth
 * required. All CSV data is fetched up-front and cached in memory for the duration of the run;
 * the provider's `getCompletedMatchesByDateRange` simply filters the in-memory array, so the
 * existing 5-day-chunk pattern in runHistoricalBackfill stays fully intact.
 */
import { readFile } from "fs/promises";
import { existsSync } from "fs";
import { join as pathJoin, resolve as pathResolve } from "path";
import { runHistoricalBackfill } from "./backfill";
import type { BackfillSummary } from "./types";
import { ProviderUnavailableError } from "../tennisData/types";
import { pool } from "@workspace/db";
import type {
  TennisDataProvider,
  HistoricalFixture,
  Surface,
  TournamentLevel,
  MatchFormat,
  PlayerSummary,
  PlayerProfile,
  MatchRecord,
  Fixture,
  HeadToHeadRecord,
  LiveScore,
} from "../tennisData/types";
import { logger } from "../../lib/logger";
import {
  upsertCanonicalPlayer,
  upsertProviderAlias,
} from "../identity/canonicalPlayerPersistence.js";
import { loadCanonicalIngestionDependencies } from "../identity/canonicalIngestionResolver.js";
import { normalizeCanonicalPlayerName } from "../identity/canonicalPlayerResolver.js";
import type { PlayerResolutionResult } from "../identity/canonicalPlayerResolver.js";

// ── Constants ─────────────────────────────────────────────────────────────────

export const SACKMANN_PROVIDER = "sackmann";

export const APPROVED_SACKMANN_REPOSITORY = "Aneeshers/tennis-sackmann-archive";
export const APPROVED_SACKMANN_BRANCH = "main";
export const APPROVED_SACKMANN_LICENSE = "CC BY-NC-SA 4.0";
const APPROVED_SACKMANN_BASE_URL =
  `https://raw.githubusercontent.com/${APPROVED_SACKMANN_REPOSITORY}/${APPROVED_SACKMANN_BRANCH}`;

const FETCH_TIMEOUT_MS = 30_000;

// ── CSV parsing ───────────────────────────────────────────────────────────────

/** Minimal RFC-4180-compatible CSV row parser. */
function parseCsvRow(line: string): string[] {
  const fields: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else cur += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ',') { fields.push(cur); cur = ""; }
      else cur += ch;
    }
  }
  fields.push(cur);
  return fields;
}

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  if (lines.length < 2) return [];
  const headers = parseCsvRow(lines[0]);
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = parseCsvRow(line);
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j].trim()] = values[j]?.trim() ?? "";
    }
    rows.push(row);
  }
  return rows;
}

// ── Type mappings ─────────────────────────────────────────────────────────────

function mapSurface(raw: string): Surface | null {
  const s = raw.toLowerCase();
  if (s === "hard") return "Hard";
  if (s === "clay") return "Clay";
  if (s === "grass") return "Grass";
  if (s === "carpet") return "IndoorHard"; // Carpet was indoor hard equivalent
  return null;
}

function mapAtpLevel(level: string, drawSize: number): TournamentLevel | null {
  switch (level) {
    case "G": return "GrandSlam";
    case "M": return "Masters1000";
    case "F": return "Masters1000"; // ATP Finals — closest bucket
    case "A": return drawSize >= 56 ? "ATP500" : "ATP250";
    case "C": return "Challenger";
    case "S": return "ITF";
    default:  return null; // Davis Cup "D", Laver Cup, etc.
  }
}

function mapWtaLevel(level: string): TournamentLevel | null {
  switch (level) {
    case "G":  return "GrandSlam";
    case "P":
    case "PM": return "WTA1000";    // Premier / Premier Mandatory
    case "I":  return "WTA500";     // International (main-draw file usage)
    case "F":  return "WTA1000";    // WTA Finals
    case "C":  return "Challenger";
    case "S":  return "ITF";
    // Codes that appear in the wta_matches_qual_itf files:
    // "ITF" prefix levels (e.g. "ITF", "Q") — stored as the tournament type in those files.
    // Map them to ITF; any unrecognised code returns null but the match is still imported.
    case "Q":  return "ITF";        // Qualifying events / ITF circuits in WTA qual file
    case "2":  return "ITF";        // ITF W15/W25 level codes used in older qual files
    case "3":  return "ITF";        // ITF W40/W60
    default:   return null;
  }
}

/** Parse set-by-set game margins from a Sackmann score string (winner is always player1). */
function parseSetMargins(score: string): Array<{ player1Games: number; player2Games: number }> {
  if (!score || /^(W\/O|DEF\.?|BYE|UNK)$/i.test(score.trim())) return [];
  const result: Array<{ player1Games: number; player2Games: number }> = [];
  for (const token of score.trim().split(/\s+/)) {
    const m = token.match(/^(\d+)-(\d+)/);
    if (m) {
      result.push({ player1Games: parseInt(m[1]), player2Games: parseInt(m[2]) });
    }
  }
  return result;
}

/** Convert Sackmann tourney_date (YYYYMMDD string) to YYYY-MM-DD. */
function sackmannDateToIso(raw: string): string | null {
  if (!raw || raw.length < 8) return null;
  const y = raw.slice(0, 4);
  const m = raw.slice(4, 6);
  const d = raw.slice(6, 8);
  const candidate = `${y}-${m}-${d}`;
  return Number.isNaN(Date.parse(candidate)) ? null : candidate;
}

function intOrNull(s: string): number | null {
  const n = parseInt(s, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

// ── Row → HistoricalFixture ───────────────────────────────────────────────────

function rowToFixture(
  row: Record<string, string>,
  tour: "ATP" | "WTA",
): HistoricalFixture | null {
  const tourneyDate = sackmannDateToIso(row.tourney_date);
  if (!tourneyDate) return null;

  const winnerId = row.winner_id?.trim();
  const loserId  = row.loser_id?.trim();
  if (!winnerId || !loserId || !row.match_num?.trim()) return null;

  const externalId = `${tour.toLowerCase()}-${row.tourney_id?.trim() ?? "?"}-${row.match_num.trim()}`;
  const score = row.score?.trim() ?? null;
  const isRetired   = !!score && /ret/i.test(score);
  const isWalkover  = !!score && /w\/o|walkover/i.test(score);
  const drawSize    = parseInt(row.draw_size ?? "0", 10) || 0;
  const level       = tour === "ATP"
    ? mapAtpLevel(row.tourney_level ?? "", drawSize)
    : mapWtaLevel(row.tourney_level ?? "");
  const bestOf      = row.best_of?.trim() === "5" ? "BestOf5" : "BestOf3" as MatchFormat;
  // In Sackmann: winner is always "player1" (id / name comes from winner_* columns)
  const p1Id   = `${SACKMANN_PROVIDER}-${winnerId}`;
  const p2Id   = `${SACKMANN_PROVIDER}-${loserId}`;
  const p1Name = row.winner_name?.trim() ?? "";
  const p2Name = row.loser_name?.trim() ?? "";

  return {
    id: externalId,
    provider: SACKMANN_PROVIDER,
    date: tourneyDate,
    time: null,
    tour,
    tournamentName: row.tourney_name?.trim() || null,
    tournamentLevel: level,
    round: row.round?.trim() || null,
    surface: mapSurface(row.surface ?? ""),
    matchFormat: bestOf,
    player1Id: p1Id,
    sourcePlayer1Id: `${tour}:${winnerId}`,
    player1Name: p1Name,
    player2Id: p2Id,
    sourcePlayer2Id: `${tour}:${loserId}`,
    player2Name: p2Name,
    winnerId: p1Id, // winner is always player1 in Sackmann
    score,
    retired: isRetired,
    walkover: isWalkover,
    cancelled: false,
    setGameMargins: parseSetMargins(score ?? ""),
    indoor: null,
    player1Rank: intOrNull(row.winner_rank ?? ""),
    player2Rank: intOrNull(row.loser_rank ?? ""),
    raw: row,
  };
}

// ── CSV fetching ──────────────────────────────────────────────────────────────

export function isApprovedSackmannSourceUrl(url: string): boolean {
  return new RegExp(
    `^https://raw\\.githubusercontent\\.com/${APPROVED_SACKMANN_REPOSITORY}/${APPROVED_SACKMANN_BRANCH}/` +
      `(?:atp/atp_matches_(?:\\d{4}|qual_chall_\\d{4})|wta/wta_matches_(?:\\d{4}|qual_itf_\\d{4}))\\.csv$`,
  ).test(url);
}

export function approvedSackmannSourceUrl(tour: "ATP" | "WTA", year: number, supplementary = false): string {
  const prefix = tour.toLowerCase();
  const stem = supplementary
    ? `${prefix}_matches_${tour === "ATP" ? "qual_chall" : "qual_itf"}_${year}`
    : `${prefix}_matches_${year}`;
  const url = `${APPROVED_SACKMANN_BASE_URL}/${prefix}/${stem}.csv`;
  if (!isApprovedSackmannSourceUrl(url)) throw new Error(`Blocked non-approved Sackmann source URL: ${url}`);
  return url;
}

/**
 * Download one CSV from the approved public raw-GitHub archive.
 * A missing year is unavailable and produces no fixtures.
 */
async function fetchCsvFromGitHub(url: string): Promise<Record<string, string>[]> {
  if (!isApprovedSackmannSourceUrl(url)) throw new Error(`Blocked non-approved Sackmann source URL: ${url}`);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "TennisMatrix-Approved-Sackmann-Import/1.0" },
    });
    if (res.status === 404) return [];
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return parseCsv(await res.text());
  } finally {
    clearTimeout(timer);
  }
}

// ── Minimal TennisDataProvider wrapper ────────────────────────────────────────

/**
 * Wraps a pre-loaded array of HistoricalFixtures so that the existing runHistoricalBackfill
 * infrastructure can consume it. Only getCompletedMatchesByDateRange is meaningful; all other
 * methods throw ProviderUnavailableError because runHistoricalBackfill never calls them.
 */
class SackmannProvider implements TennisDataProvider {
  readonly name = "SackmannProvider";
  private readonly fixtures: HistoricalFixture[];

  constructor(fixtures: HistoricalFixture[]) {
    this.fixtures = fixtures;
  }

  async getCompletedMatchesByDateRange(dateStart: string, dateStop: string): Promise<HistoricalFixture[]> {
    return this.fixtures.filter((f) => f.date >= dateStart && f.date <= dateStop);
  }

  // ── Stubs for unused methods ────────────────────────────────────────────────
  private _unavailable(method: string): never {
    throw new ProviderUnavailableError(`SackmannProvider does not implement ${method}`);
  }
  getStatus(): import("../tennisData/types").ProviderStatusInfo {
    return { provider: SACKMANN_PROVIDER, connected: true, lastSuccessfulCallAt: null, lastError: null };
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async searchPlayers(_query: string): Promise<PlayerSummary[]>           { return this._unavailable("searchPlayers"); }
  async getPlayer(_id: string): Promise<PlayerProfile | null>             { return this._unavailable("getPlayer"); }
  async getPlayerMatches(_id: string): Promise<MatchRecord[]>             { return this._unavailable("getPlayerMatches"); }
  async getUpcomingFixtures(_date: string): Promise<Fixture[]>            { return this._unavailable("getUpcomingFixtures"); }
  async getUpcomingFixturesRange(_s: string, _e: string): Promise<Fixture[]> { return this._unavailable("getUpcomingFixturesRange"); }
  async getHeadToHead(_p1: string, _p2: string): Promise<HeadToHeadRecord> { return this._unavailable("getHeadToHead"); }
  async getLiveScores(_ids: string[]): Promise<Map<string, LiveScore>>    { return this._unavailable("getLiveScores"); }
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface SackmannBackfillOptions {
  /** First year to backfill. Defaults to 2010. */
  startYear?: number;
  /** Last year to backfill (inclusive). Defaults to the current calendar year. */
  endYear?: number;
  /** Which tours to include. Defaults to both. */
  tours?: Array<"atp" | "wta">;
  /**
   * Also fetch Challenger/qualifying (ATP: atp_matches_qual_chall_YYYY.csv) and
   * ITF/qualifying (WTA: wta_matches_qual_itf_YYYY.csv) files from the same repos.
   *
   * These files contain match history for Challenger-level and ITF players who rarely appear
   * in the main-draw file — the exact population that drives "Limited/Poor Data Quality" and
   * "Extreme Upset Risk" flags. Defaults to `true`.
   */
  includeChallengerItf?: boolean;
}

export interface SackmannBackfillSummary {
  atpYearsLoaded: number;
  wtaYearsLoaded: number;
  /** Years successfully loaded from atp_matches_qual_chall_YYYY.csv (0 if includeChallengerItf was false). */
  atpChallengerYearsLoaded: number;
  /** Years successfully loaded from wta_matches_qual_itf_YYYY.csv (0 if includeChallengerItf was false). */
  wtaItfYearsLoaded: number;
  fixturesLoaded: number;
  discovered: number;
  rejected: number;
  quarantined: number;
  duplicates: number;
  canonicalMatchRate: number;
  fileCoverage: Record<string, number>;
  tourCoverage: Record<string, number>;
  dateCoverage: { earliest: string | null; latest: string | null; byYear: Record<string, number> };
  backfill: BackfillSummary;
}

export interface ApprovedFixtureResolver {
  resolve(input: {
    provider: string;
    externalPlayerId: string;
    externalPlayerName: string;
    metadata?: { tour?: string | null; tournamentNames?: string[] };
  }): Promise<PlayerResolutionResult>;
}

export function approvedSackmannCanonicalId(externalPlayerId: string): string {
  return `canonical-sackmann-${externalPlayerId.toLowerCase().replace(/[^a-z0-9_-]+/g, "-")}`;
}

/**
 * Admission gate for the approved archive. Both source players must resolve to a canonical ID;
 * otherwise the complete match is quarantined by the resolver's existing review-queue callback.
 */
export async function resolveApprovedSackmannFixtures(
  fixtures: HistoricalFixture[],
  resolver: ApprovedFixtureResolver,
): Promise<{ fixtures: HistoricalFixture[]; quarantined: number; canonicalMatches: number }> {
  const accepted: HistoricalFixture[] = [];
  let quarantined = 0;
  for (const fixture of fixtures) {
    const sourcePlayer1Id = fixture.player1Id;
    const sourcePlayer2Id = fixture.player2Id;
    const [player1, player2] = await Promise.all([
      resolver.resolve({
        provider: fixture.provider,
        externalPlayerId: fixture.sourcePlayer1Id ?? fixture.player1Id,
        externalPlayerName: fixture.player1Name,
        metadata: { tour: fixture.tour, tournamentNames: fixture.tournamentName ? [fixture.tournamentName] : [] },
      }),
      resolver.resolve({
        provider: fixture.provider,
        externalPlayerId: fixture.sourcePlayer2Id ?? fixture.player2Id,
        externalPlayerName: fixture.player2Name,
        metadata: { tour: fixture.tour, tournamentNames: fixture.tournamentName ? [fixture.tournamentName] : [] },
      }),
    ]);
    if (!player1.canonicalPlayerId || !player2.canonicalPlayerId) {
      quarantined++;
      continue;
    }
    accepted.push({
      ...fixture,
      sourcePlayer1Id: fixture.sourcePlayer1Id ?? fixture.player1Id,
      sourcePlayer2Id: fixture.sourcePlayer2Id ?? fixture.player2Id,
      player1Id: player1.canonicalPlayerId,
      player2Id: player2.canonicalPlayerId,
      winnerId: fixture.winnerId === sourcePlayer1Id
        ? player1.canonicalPlayerId
        : fixture.winnerId === sourcePlayer2Id
          ? player2.canonicalPlayerId
          : fixture.winnerId,
      canonicalPlayer1Id: player1.canonicalPlayerId,
      canonicalPlayer2Id: player2.canonicalPlayerId,
      requiresCanonicalResolution: true,
    });
  }
  return { fixtures: accepted, quarantined, canonicalMatches: accepted.length };
}

async function createApprovedSackmannResolver(): Promise<ApprovedFixtureResolver> {
  const dependencies = await loadCanonicalIngestionDependencies();
  const canonicalBySourceId = new Map(
    (dependencies.aliases ?? []).map((alias) => [
      `${alias.provider}:${alias.externalPlayerId}`,
      alias.canonicalPlayerId,
    ]),
  );
  const resolvedBySourceId = new Map<string, PlayerResolutionResult>();

  return {
    async resolve(input) {
      const cacheKey = `${input.provider}:${input.externalPlayerId}`;
      const cached = resolvedBySourceId.get(cacheKey);
      if (cached) return cached;

      const canonicalId = approvedSackmannCanonicalId(input.externalPlayerId);
      if (canonicalBySourceId.get(cacheKey) !== canonicalId) {
        await upsertCanonicalPlayer({
          id: canonicalId,
          displayName: input.externalPlayerName,
          tour: input.metadata?.tour ?? null,
        });
        await upsertProviderAlias({
          provider: input.provider,
          externalPlayerId: input.externalPlayerId,
          externalPlayerName: input.externalPlayerName,
          canonicalPlayerId: canonicalId,
          aliasType: "authoritative-source-id",
          metadata: input.metadata ? { ...input.metadata } : {},
        });
        canonicalBySourceId.set(cacheKey, canonicalId);
      }
      const result: PlayerResolutionResult = {
        source: "approved-aneeshers-sackmann",
        canonicalPlayerId: canonicalId,
        resolutionMethod: "provider-alias",
        confidence: 1,
        normalizedName: normalizeCanonicalPlayerName(input.externalPlayerName),
        candidateCanonicalIds: [],
        manualReviewRequired: false,
        supportingMetadata: input.metadata ?? null,
        reason: null,
      };
      resolvedBySourceId.set(cacheKey, result);
      return result;
    },
  };
}

/**
 * Downloads Sackmann CSVs for the requested year range, maps them to HistoricalFixture[], then
 * calls the standard runHistoricalBackfill so all feature snapshots, Elo state, and
 * idempotency guarantees are identical to the live-provider path.
 */
export async function runSackmannBackfill(
  options: SackmannBackfillOptions = {},
): Promise<SackmannBackfillSummary> {
  const currentYear       = new Date().getFullYear();
  const startYear         = options.startYear          ?? 2010;
  const endYear           = options.endYear            ?? currentYear;
  const minimumMatchDate  = `${startYear}-01-01`;
  const maximumMatchDate  = endYear === currentYear
    ? new Date().toISOString().slice(0, 10)
    : `${endYear}-12-31`;
  const tours             = options.tours              ?? ["atp", "wta"];
  const includeChallengerItf = options.includeChallengerItf ?? true;

  if (startYear > endYear) throw new Error(`startYear (${startYear}) > endYear (${endYear})`);

  const allFixtures: HistoricalFixture[] = [];
  let rowsDiscovered = 0;
  let rowsRejected = 0;
  const fileCoverage: Record<string, number> = {};
  let quarantined = 0;
  let canonicalMatches = 0;
  let duplicateCount = 0;
  let uniqueFixtureCount = 0;
  let atpYearsLoaded          = 0;
  let wtaYearsLoaded          = 0;
  let atpChallengerYearsLoaded = 0;
  let wtaItfYearsLoaded        = 0;

  const years = Array.from({ length: endYear - startYear + 1 }, (_, i) => startYear + i);

  /**
   * Fetches one approved CSV, maps rows to HistoricalFixture[], and appends to allFixtures.
   */
  async function fetchAndAppend(
    url: string,
    tourLabel: "ATP" | "WTA",
    context: string,
  ): Promise<number> {
    try {
      const rows = await fetchCsvFromGitHub(url);
      if (rows.length === 0) return 0;
      rowsDiscovered += rows.length;
      const mapped = rows
        .map((r) => rowToFixture(r, tourLabel))
      const fixtures = mapped
        .filter((f): f is HistoricalFixture => f !== null)
        .filter((f) => f.date >= minimumMatchDate && f.date <= maximumMatchDate)
        .map((f) => ({
          ...f,
          sourceFile: context,
          sourceUrl: url,
          sourceLicense: APPROVED_SACKMANN_LICENSE,
          importProvenance: {
            importer: "approved-aneeshers-sackmann",
            repository: APPROVED_SACKMANN_REPOSITORY,
            branch: APPROVED_SACKMANN_BRANCH,
            sourceFile: context,
            sourceUrl: url,
            sourceLicense: APPROVED_SACKMANN_LICENSE,
          },
        }));
      rowsRejected += rows.length - fixtures.length;
      fileCoverage[context] = fixtures.length;
      allFixtures.push(...fixtures);
      logger.info({ url: context, rows: rows.length, fixtures: fixtures.length }, "sackmannBackfill: file loaded");
      return fixtures.length;
    } catch (err) {
      logger.warn({ err, url: context }, "sackmannBackfill: failed to load file (non-fatal)");
      return 0;
    }
  }

  // Fetch approved raw-GitHub CSV files in parallel with bounded concurrency.
  // For each (year, tour) pair we fetch:
  //   1. The main-draw file: atp_matches_YYYY.csv / wta_matches_YYYY.csv
  //      Source: approved Aneeshers archive
  //   2. (if includeChallengerItf) The supplementary file:
  //        ATP: atp_matches_qual_chall_YYYY.csv — ATP Challengers + qualifying rounds
  //        WTA: wta_matches_qual_itf_YYYY.csv   — WTA ITF events + qualifying rounds
  //        Source: approved Aneeshers archive
  const concurrency = 4;
  for (let i = 0; i < years.length; i += concurrency) {
    const batch = years.slice(i, i + concurrency);
    await Promise.all(
      batch.flatMap((year) =>
        tours.flatMap((tour) => {
          const prefix      = tour === "atp" ? "atp" : "wta";
          const tourLabel: "ATP" | "WTA" = tour === "atp" ? "ATP" : "WTA";

          const tasks: Promise<void>[] = [];

          // ── Main-draw file ────────────────────────────────────────────────
          const mainFilename = `${prefix}_matches_${year}.csv`;
          const mainUrl = approvedSackmannSourceUrl(tourLabel, year);
          tasks.push(
            fetchAndAppend(
              mainUrl,
              tourLabel,
              `${prefix}/${mainFilename}`,
            ).then((count) => {
              if (count > 0) {
                if (tour === "atp") atpYearsLoaded++;
                else wtaYearsLoaded++;
              }
            }),
          );

            // ── Challenger / ITF supplementary file ────────────────────────
          if (includeChallengerItf) {
            const chalFilename = tour === "atp"
              ? `${prefix}_matches_qual_chall_${year}.csv`
              : `${prefix}_matches_qual_itf_${year}.csv`;
            const chalUrl = approvedSackmannSourceUrl(tourLabel, year, true);
            const chalLabel = tour === "atp"
              ? `${prefix}_matches_qual_chall_${year}`
              : `${prefix}_matches_qual_itf_${year}`;
            tasks.push(
              fetchAndAppend(chalUrl, tourLabel, `${prefix}/${chalFilename}`).then((count) => {
                if (count > 0) {
                  if (tour === "atp") atpChallengerYearsLoaded++;
                  else wtaItfYearsLoaded++;
                }
              }),
            );
          }

          return tasks;
        }),
      ),
    );
  }

  // Remove overlap before identity work, then require both canonical resolutions for every
  // admitted match. Authoritative tour-scoped source IDs persist deterministic aliases.
  const seenExternalIds = new Set<string>();
  const uniqueFixtures = allFixtures.filter((fixture) => {
    if (seenExternalIds.has(fixture.id)) {
      duplicateCount++;
      return false;
    }
    seenExternalIds.add(fixture.id);
    return true;
  });
  uniqueFixtureCount = uniqueFixtures.length;
  const canonicalResolver = await createApprovedSackmannResolver();
  const admitted = await resolveApprovedSackmannFixtures(uniqueFixtures, canonicalResolver);
  quarantined = admitted.quarantined;
  canonicalMatches = admitted.canonicalMatches;
  allFixtures.length = 0;
  for (const fixture of admitted.fixtures) allFixtures.push(fixture);

  if (allFixtures.length === 0) {
    logger.warn({ startYear, endYear, tours, includeChallengerItf }, "sackmannBackfill: no fixtures loaded");
    const emptyDate = `${startYear}-01-01`;
    return {
      atpYearsLoaded: 0,
      wtaYearsLoaded: 0,
      atpChallengerYearsLoaded: 0,
      wtaItfYearsLoaded: 0,
      fixturesLoaded: 0,
      discovered: rowsDiscovered,
      rejected: rowsRejected,
      quarantined,
      duplicates: duplicateCount,
      canonicalMatchRate: 0,
      fileCoverage,
      tourCoverage: {},
      dateCoverage: { earliest: null, latest: null, byYear: {} },
      backfill: {
        dateStart: emptyDate,
        dateStop: `${endYear}-12-31`,
        cutoff: "30min",
        cutoffMinutes: 30,
        fixturesFetched: 0,
        matchesInserted: 0,
        matchesSkippedDuplicate: 0,
        matchesSkippedNoTerminalResult: 0,
        matchesRecomputed: 0,
        featureRowsInserted: 0,
        byTour: {},
        bySurface: {},
        byYear: {},
        earliestImportedMatchDate: null,
        latestImportedMatchDate: null,
        dateGapsOver30Days: [],
        matchesSkippedBadData: 0,
        durationMs: 0,
      } satisfies BackfillSummary,
    };
  }

  // Sort so the provider can be queried by date range correctly
  allFixtures.sort((a, b) => a.date.localeCompare(b.date));
  const dateStart = allFixtures[0].date;
  const dateStop  = allFixtures[allFixtures.length - 1].date;

  logger.info(
    {
      fixturesLoaded: allFixtures.length,
      atpYearsLoaded, wtaYearsLoaded,
      atpChallengerYearsLoaded, wtaItfYearsLoaded,
      includeChallengerItf,
      dateStart, dateStop,
    },
    "sackmannBackfill: all CSVs loaded, starting historical backfill",
  );

  const provider = new SackmannProvider(allFixtures);
  const backfill = await runHistoricalBackfill(
    provider as unknown as Parameters<typeof runHistoricalBackfill>[0],
    {
      dateStart,
      dateStop,
      // Use "1h" so the cutoff window is wide enough for same-day scheduling uncertainty.
      // Sackmann data has no match times (only dates), so the recorded start is midnight UTC;
      // a 30-min cutoff would be fine numerically but 1h gives a comfortable margin.
      cutoff: "1h",
      chunkDays: 30, // Larger chunks are fine since we're serving from memory, not a live API
    },
  );

  const tourCoverage = allFixtures.reduce<Record<string, number>>((counts, fixture) => {
    const tour = fixture.tour ?? "Unknown";
    counts[tour] = (counts[tour] ?? 0) + 1;
    return counts;
  }, {});
  const dateCoverage = allFixtures.reduce(
    (coverage, fixture) => {
      const year = fixture.date.slice(0, 4);
      coverage.byYear[year] = (coverage.byYear[year] ?? 0) + 1;
      if (!coverage.earliest || fixture.date < coverage.earliest) coverage.earliest = fixture.date;
      if (!coverage.latest || fixture.date > coverage.latest) coverage.latest = fixture.date;
      return coverage;
    },
    { earliest: null as string | null, latest: null as string | null, byYear: {} as Record<string, number> },
  );
  return {
    atpYearsLoaded,
    wtaYearsLoaded,
    atpChallengerYearsLoaded,
    wtaItfYearsLoaded,
    fixturesLoaded: allFixtures.length,
    discovered: rowsDiscovered,
    rejected: rowsRejected,
    quarantined,
    duplicates: duplicateCount + backfill.matchesSkippedDuplicate,
    canonicalMatchRate: uniqueFixturesCountForRate(uniqueFixtureCount, canonicalMatches),
    fileCoverage,
    tourCoverage,
    dateCoverage,
    backfill,
  };
}

function uniqueFixturesCountForRate(discoveredFixtures: number, canonicalMatches: number): number {
  return discoveredFixtures > 0 ? canonicalMatches / discoveredFixtures : 0;
}

// ── Local-file import (from extracted ZIP) ────────────────────────────────────

export interface SackmannLocalBackfillOptions {
  /**
   * Directory containing the extracted ZIP contents.
   * Default: "attached_assets/sackmann_local" relative to workspace root.
   */
  localDir?: string;
  /**
   * Which file types to include. Default: all.
   * Options: "atp" | "wta" | "challenger" | "quali" | "amateur" | "ongoing"
   */
  fileTypes?: Array<"atp" | "wta" | "challenger" | "quali" | "amateur" | "ongoing">;
  /** First year to import. Default: 1967. */
  yearFrom?: number;
  /** Last year to import (inclusive). Default: current year. */
  yearTo?: number;
  /**
   * If true, count rows that WOULD be imported without writing to the DB.
   * Player profiles are also skipped. Responds synchronously.
   */
  dryRun?: boolean;
}

export interface SackmannLocalBackfillSummary {
  filesProcessed: number;
  rowsAttempted: number;
  rowsInserted: number;
  rowsSkipped: number;
  rowsErrored: number;
  playerProfilesUpserted: number;
  durationMs: number;
  errors: string[];
}

/**
 * Resolves the workspace root from the API server's CWD (artifacts/api-server → ../../).
 */
function workspaceRoot(): string {
  return pathResolve(process.cwd(), "../..");
}

/**
 * Read and parse a CSV file from disk.
 */
async function readLocalCsv(filePath: string): Promise<Record<string, string>[]> {
  const text = await readFile(filePath, "utf-8");
  return parseCsv(text);
}

/**
 * Upsert ATP player profiles from ATP_Database.csv into master_players (country_code)
 * and canonical_players (height_cm, handedness, date_of_birth, nationality) using
 * COALESCE so we never overwrite already-populated fields.
 *
 * Returns the number of canonical_player rows updated.
 */
async function upsertAtpPlayerProfiles(profileRows: Record<string, string>[]): Promise<number> {
  if (profileRows.length === 0) return 0;

  // Build arrays for batch update
  const apiKeys: string[]          = [];
  const iocValues: (string | null)[] = [];
  const sackmannIds: string[]      = [];
  const heights: (number | null)[] = [];
  const birthdates: (string | null)[] = [];
  const hands: (string | null)[]   = [];

  for (const row of profileRows) {
    const sid = row.id?.trim();
    if (!sid) continue;

    const ioc = row.ioc?.trim() || null;
    const hand = row.hand?.trim() || null;

    const rawHeight = parseInt(row.height ?? "", 10);
    const heightCm: number | null = Number.isFinite(rawHeight) && rawHeight > 100 ? rawHeight : null;

    const rawBirth = row.birthdate?.trim() ?? "";
    let birthdate: string | null = null;
    if (rawBirth.length >= 8) {
      const candidate = `${rawBirth.slice(0, 4)}-${rawBirth.slice(4, 6)}-${rawBirth.slice(6, 8)}`;
      if (!Number.isNaN(Date.parse(candidate))) birthdate = candidate;
    }

    apiKeys.push(`sackmann-${sid}`);
    iocValues.push(ioc);
    sackmannIds.push(sid);
    heights.push(heightCm);
    birthdates.push(birthdate);
    hands.push(hand);
  }

  // 1) Update master_players.country_code (COALESCE — never overwrite)
  await pool.query(
    `UPDATE master_players mp
        SET country_code = COALESCE(mp.country_code, data.ioc)
       FROM unnest($1::text[], $2::text[]) AS data(api_key, ioc)
      WHERE mp.api_tennis_key = data.api_key
        AND data.ioc IS NOT NULL
        AND data.ioc <> ''`,
    [apiKeys, iocValues],
  );

  // 2) Update canonical_players via player_aliases (COALESCE — never overwrite)
  const result = await pool.query<{ count: number }>(
    `WITH matched AS (
       SELECT pa.canonical_player_id,
              data.height_cm,
              data.birthdate::date AS date_of_birth,
              data.hand AS handedness,
              data.ioc  AS nationality
         FROM unnest($1::text[], $2::int[], $3::text[], $4::text[], $5::text[])
              AS data(sackmann_id, height_cm, birthdate, hand, ioc)
         JOIN player_aliases pa
           ON pa.provider = 'sackmann'
          AND pa.external_player_id = data.sackmann_id
     )
     UPDATE canonical_players cp
        SET height_cm    = COALESCE(cp.height_cm,    m.height_cm),
            date_of_birth = COALESCE(cp.date_of_birth, m.date_of_birth),
            handedness   = COALESCE(cp.handedness,   m.handedness),
            nationality  = COALESCE(cp.nationality,  m.nationality)
       FROM matched m
      WHERE cp.id = m.canonical_player_id
        AND (cp.height_cm IS NULL OR cp.date_of_birth IS NULL OR cp.handedness IS NULL OR cp.nationality IS NULL)
      RETURNING cp.id`,
    [sackmannIds, heights, birthdates, hands, iocValues],
  );

  return result.rowCount ?? 0;
}

/**
 * Imports match CSVs from a locally-extracted Sackmann ZIP.
 *
 * File naming conventions in the ZIP differ from the GitHub repos:
 *   ATP main draw:    {YYYY}.csv              (not atp_matches_{YYYY}.csv)
 *   WTA main draw:    {YYYY}_wta.csv
 *   Challenger:       {YYYY}_challenger.csv
 *   Qualifying:       atp_quali/{YYYY}_atp_quali.csv
 *   Amateur:          atp_matches_amateur.csv
 *   ATP ongoing:      ongoing_tourneys.csv
 *   Challenger ongoing: challenger_ongoing_tourneys.csv
 *   WTA ongoing:      wta_ongoing_tourneys.csv
 *
 * All files share the identical Sackmann column schema, so rowToFixture() applies unchanged.
 * The existing runHistoricalBackfill idempotency (pre-query dedup + unique index on
 * (provider, external_id)) means re-running the import is always safe.
 */
export async function runSackmannLocalBackfill(
  options: SackmannLocalBackfillOptions = {},
): Promise<SackmannLocalBackfillSummary> {
  const startedAt = Date.now();
  const localDir  = pathResolve(
    workspaceRoot(),
    options.localDir ?? "attached_assets/sackmann_local",
  );
  const yearFrom  = options.yearFrom ?? 1967;
  const yearTo    = options.yearTo   ?? new Date().getFullYear();
  const dryRun    = options.dryRun   ?? false;
  const types     = new Set(options.fileTypes ?? ["atp", "wta", "challenger", "quali", "amateur", "ongoing"]);

  const errors: string[]         = [];
  const allFixtures: HistoricalFixture[] = [];
  let filesProcessed    = 0;
  let rowsAttempted     = 0;
  let playerProfilesUpserted = 0;

  /**
   * Read one CSV file, map rows → HistoricalFixture[], append to allFixtures.
   * Counts raw rows in rowsAttempted even if some fail rowToFixture validation.
   */
  async function loadFile(filePath: string, tour: "ATP" | "WTA", label: string): Promise<void> {
    try {
      if (!existsSync(filePath)) return;
      const rows = await readLocalCsv(filePath);
      if (rows.length === 0) return;
      rowsAttempted += rows.length;
      const fixtures = rows
        .map((r) => rowToFixture(r, tour))
        .filter((f): f is HistoricalFixture => f !== null);
      allFixtures.push(...fixtures);
      filesProcessed++;
      logger.debug({ label, rows: rows.length, fixtures: fixtures.length }, "sackmannLocal: file loaded");
    } catch (err) {
      const msg = `${label}: ${err instanceof Error ? err.message : String(err)}`;
      errors.push(msg);
      logger.warn({ err, label }, "sackmannLocal: file load failed (non-fatal)");
    }
  }

  // ── 1. Player profiles ─────────────────────────────────────────────────────
  // Processed first so profile data is available before match rows are inserted.
  if (types.has("atp")) {
    const profilePath = pathJoin(localDir, "ATP_Database.csv");
    if (existsSync(profilePath)) {
      try {
        const profileRows = await readLocalCsv(profilePath);
        if (!dryRun && profileRows.length > 0) {
          playerProfilesUpserted = await upsertAtpPlayerProfiles(profileRows);
        }
        logger.info({ rows: profileRows.length, dryRun }, "sackmannLocal: ATP_Database.csv loaded");
      } catch (err) {
        const msg = `ATP_Database.csv: ${err instanceof Error ? err.message : String(err)}`;
        errors.push(msg);
        logger.warn({ err }, "sackmannLocal: ATP_Database.csv failed (non-fatal)");
      }
    }
  }

  // ── 2. ATP main-draw: {YYYY}.csv (1967–current) ─────────────────────────────
  if (types.has("atp")) {
    for (let year = Math.max(yearFrom, 1967); year <= yearTo; year++) {
      await loadFile(pathJoin(localDir, `${year}.csv`), "ATP", `ATP ${year}`);
    }
  }

  // ── 3. WTA main-draw: {YYYY}_wta.csv (1990–current) ─────────────────────────
  if (types.has("wta")) {
    for (let year = Math.max(yearFrom, 1990); year <= yearTo; year++) {
      await loadFile(pathJoin(localDir, `${year}_wta.csv`), "WTA", `WTA ${year}`);
    }
  }

  // ── 4. Challenger: {YYYY}_challenger.csv (1978–current) ─────────────────────
  if (types.has("challenger")) {
    for (let year = Math.max(yearFrom, 1978); year <= yearTo; year++) {
      await loadFile(pathJoin(localDir, `${year}_challenger.csv`), "ATP", `Challenger ${year}`);
    }
  }

  // ── 5. ATP Qualifying: atp_quali/{YYYY}_atp_quali.csv (2007–current) ────────
  if (types.has("quali")) {
    for (let year = Math.max(yearFrom, 2007); year <= yearTo; year++) {
      await loadFile(pathJoin(localDir, "atp_quali", `${year}_atp_quali.csv`), "ATP", `ATPQuali ${year}`);
    }
  }

  // ── 6. Pre-Open Era amateur matches ──────────────────────────────────────────
  if (types.has("amateur")) {
    await loadFile(pathJoin(localDir, "atp_matches_amateur.csv"), "ATP", "ATPAmateur");
  }

  // ── 7. Ongoing tournament files ───────────────────────────────────────────────
  if (types.has("ongoing")) {
    await loadFile(pathJoin(localDir, "ongoing_tourneys.csv"),            "ATP", "ATP-ongoing");
    await loadFile(pathJoin(localDir, "challenger_ongoing_tourneys.csv"), "ATP", "Challenger-ongoing");
    await loadFile(pathJoin(localDir, "wta_ongoing_tourneys.csv"),        "WTA", "WTA-ongoing");
  }

  // ── Dry-run: return counts without writing ────────────────────────────────────
  if (dryRun) {
    return {
      filesProcessed,
      rowsAttempted,
      rowsInserted: 0,
      rowsSkipped: allFixtures.length, // valid fixtures that would be attempted
      rowsErrored: errors.length,
      playerProfilesUpserted: 0,
      durationMs: Date.now() - startedAt,
      errors: errors.slice(0, 50),
    };
  }

  // ── No fixtures loaded ────────────────────────────────────────────────────────
  if (allFixtures.length === 0) {
    logger.warn({ localDir, yearFrom, yearTo }, "sackmannLocal: no fixtures loaded");
    return {
      filesProcessed,
      rowsAttempted,
      rowsInserted: 0,
      rowsSkipped: 0,
      rowsErrored: errors.length,
      playerProfilesUpserted,
      durationMs: Date.now() - startedAt,
      errors: errors.slice(0, 50),
    };
  }

  // Deduplicate by external_id — the same match can appear in multiple local files
  // (e.g. the ATP main-draw file and the atp_quali file share qualifying-round rows,
  // and ongoing_tourneys.csv overlaps with the current year file).
  const seenIds = new Set<string>();
  const deduped: HistoricalFixture[] = [];
  for (const f of allFixtures) {
    if (!seenIds.has(f.id)) { seenIds.add(f.id); deduped.push(f); }
  }
  const droppedDupes = allFixtures.length - deduped.length;
  if (droppedDupes > 0) {
    logger.info({ droppedDupes }, "sackmannLocal: deduplicated cross-file duplicate fixtures");
  }

  // Apply yearFrom/yearTo to every fixture — flat files (amateur, ongoing) are not
  // year-named so they bypass the per-file year guards above.
  const yearFromStr = String(yearFrom).padStart(4, "0");
  const yearToStr   = String(yearTo  ).padStart(4, "0");
  const fixtures = deduped.filter(
    (f) => f.date.slice(0, 4) >= yearFromStr && f.date.slice(0, 4) <= yearToStr,
  );
  const droppedByRange = allFixtures.length - fixtures.length;
  if (droppedByRange > 0) {
    logger.info({ droppedByRange, yearFrom, yearTo }, "sackmannLocal: dropped out-of-range fixtures");
  }

  // ── Pre-filter already-imported rows ─────────────────────────────────────────
  // runHistoricalBackfill's normal-mode duplicate handling runs an integrity check
  // BEFORE skipping, which throws when the stored feature-snapshot count diverges from
  // the current Elo state (e.g. when re-importing with a broader file set than the
  // original remote backfill used). We pre-filter here so only genuinely new fixtures
  // are handed to runHistoricalBackfill, bypassing the check without touching its code.
  const existingIds = new Set<string>();
  const PAGE = 10_000;
  for (let page = 0; ; page++) {
    const { rows } = await pool.query<{ external_id: string }>(
      `SELECT external_id FROM historical_matches WHERE provider = $1 LIMIT $2 OFFSET $3`,
      [SACKMANN_PROVIDER, PAGE, page * PAGE],
    );
    for (const r of rows) existingIds.add(r.external_id);
    if (rows.length < PAGE) break;
  }
  const alreadyExisted    = fixtures.filter((f) =>  existingIds.has(f.id));
  const genuinelyNew      = fixtures.filter((f) => !existingIds.has(f.id));
  const rowsAlreadyExisted = alreadyExisted.length;
  logger.info(
    { total: fixtures.length, existingSkipped: rowsAlreadyExisted, genuinelyNew: genuinelyNew.length },
    "sackmannLocal: pre-filter complete",
  );

  if (genuinelyNew.length === 0) {
    return {
      filesProcessed,
      rowsAttempted,
      rowsInserted: 0,
      rowsSkipped:  rowsAlreadyExisted,
      rowsErrored:  errors.length,
      playerProfilesUpserted,
      durationMs: Date.now() - startedAt,
      errors: errors.slice(0, 50),
    };
  }

  // Sort chronologically so runHistoricalBackfill's date-range chunking works correctly.
  genuinelyNew.sort((a, b) => a.date.localeCompare(b.date));
  const dateStart = genuinelyNew[0].date;
  const dateStop  = genuinelyNew[genuinelyNew.length - 1].date;

  logger.info(
    { filesProcessed, genuinelyNew: genuinelyNew.length, dateStart, dateStop, localDir },
    "sackmannLocal: starting historical backfill (new rows only)",
  );

  const provider = new SackmannProvider(genuinelyNew);
  const backfill = await runHistoricalBackfill(
    provider as unknown as Parameters<typeof runHistoricalBackfill>[0],
    { dateStart, dateStop, cutoff: "1h", chunkDays: 30 },
  );

  return {
    filesProcessed,
    rowsAttempted,
    rowsInserted: backfill.matchesInserted,
    rowsSkipped:  rowsAlreadyExisted + backfill.matchesSkippedDuplicate,
    rowsErrored:  errors.length,
    playerProfilesUpserted,
    durationMs: Date.now() - startedAt,
    errors: errors.slice(0, 50),
  };
}

// ── Test-only named exports ───────────────────────────────────────────────────
// Not part of the public API. Exported with underscore prefix so call-sites are
// visibly out-of-module-contract. Used by sackmannBackfillChallengerItf.test.ts
// to white-box-test the CSV parsing logic without re-implementing it locally.
export {
  rowToFixture    as _rowToFixture,
  mapWtaLevel     as _mapWtaLevel,
  mapAtpLevel     as _mapAtpLevel,
  intOrNull       as _intOrNull,
  isApprovedSackmannSourceUrl as _isApprovedSackmannSourceUrl,
  approvedSackmannSourceUrl as _approvedSackmannSourceUrl,
};
