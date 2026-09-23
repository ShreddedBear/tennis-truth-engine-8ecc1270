/**
 * Pure query-param parsing/clamping for the paper-trading admin API — DB-free, HTTP-free, so
 * the actual filter/pagination RULES are unit-testable without spinning up Express or a
 * database. Mirrors the existing adminParlayResearchV1.ts convention (manual parseInt/clamp,
 * no zod) for consistency with the sibling Parlay Builder admin routes.
 */

export const MAX_PAGE_SIZE = 200;
export const DEFAULT_PAGE_SIZE = 50;

export interface Pagination {
  limit: number;
  offset: number;
}

/** Bounded, deterministic: limit is always in [1, MAX_PAGE_SIZE], offset always >= 0. Never "unlimited rows". */
export function parsePagination(query: Record<string, unknown>): Pagination {
  const rawLimit = Number.parseInt(String(query.limit ?? DEFAULT_PAGE_SIZE), 10);
  const rawOffset = Number.parseInt(String(query.offset ?? 0), 10);
  const limit = Math.min(Math.max(Number.isFinite(rawLimit) ? rawLimit : DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);
  const offset = Math.max(Number.isFinite(rawOffset) ? rawOffset : 0, 0);
  return { limit, offset };
}

export interface PairListFilters {
  status?: string;
  dateFrom?: Date;
  dateTo?: Date;
  tournamentName?: string;
  surface?: string;
  evaluatedSide?: "PLAYER_1" | "PLAYER_2";
  builderVersion?: string;
  builderConfigFingerprint?: string;
  calibrationModelId?: number;
  crossSideAgreement?: boolean;
  gradingStatus?: "graded" | "ungraded";
  resultType?: string;
  /** KEEP | BORDERLINE | REMOVE | DATA_UNAVAILABLE -- a per-side validation decision filter, never the autonomous pick. */
  decision?: string;
}

function parseDate(value: unknown): Date | undefined {
  if (typeof value !== "string" || value.length === 0) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function parseBoolean(value: unknown): boolean | undefined {
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

/** Parses every documented list-endpoint filter from raw query params; anything absent/invalid is simply omitted (no filter applied), never throws. */
export function parsePairListFilters(query: Record<string, unknown>): PairListFilters {
  const filters: PairListFilters = {};
  if (typeof query.status === "string") filters.status = query.status;
  const dateFrom = parseDate(query.dateFrom);
  if (dateFrom) filters.dateFrom = dateFrom;
  const dateTo = parseDate(query.dateTo);
  if (dateTo) filters.dateTo = dateTo;
  if (typeof query.tournamentName === "string") filters.tournamentName = query.tournamentName;
  if (typeof query.surface === "string") filters.surface = query.surface;
  if (query.evaluatedSide === "PLAYER_1" || query.evaluatedSide === "PLAYER_2") filters.evaluatedSide = query.evaluatedSide;
  if (typeof query.builderVersion === "string") filters.builderVersion = query.builderVersion;
  if (typeof query.builderConfigFingerprint === "string") filters.builderConfigFingerprint = query.builderConfigFingerprint;
  const calibrationModelId = Number.parseInt(String(query.calibrationModelId ?? ""), 10);
  if (Number.isFinite(calibrationModelId)) filters.calibrationModelId = calibrationModelId;
  const crossSideAgreement = parseBoolean(query.crossSideAgreement);
  if (crossSideAgreement !== undefined) filters.crossSideAgreement = crossSideAgreement;
  if (query.gradingStatus === "graded" || query.gradingStatus === "ungraded") filters.gradingStatus = query.gradingStatus;
  if (typeof query.resultType === "string") filters.resultType = query.resultType;
  if (typeof query.decision === "string") filters.decision = query.decision;
  return filters;
}

/**
 * Synthetic test/acceptance fixtures are tagged by a well-established, non-overlapping naming
 * convention (external_fixture_id starting with "TEST-") established across every acceptance
 * test run against this system so far -- a real Live Tennis API fixture id is never shaped this
 * way. Used to exclude them from prospective statistics without needing a separate "is_test"
 * column that every write path would have to remember to set correctly.
 */
export function isSyntheticTestFixture(externalFixtureId: string): boolean {
  return externalFixtureId.startsWith("TEST-");
}
