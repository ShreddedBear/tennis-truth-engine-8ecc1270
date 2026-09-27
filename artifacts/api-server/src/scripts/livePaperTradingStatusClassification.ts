export type PEFixture = {
  provider: string | null;
  externalFixtureId: string | null;
  runKind: string;
  dataSegment: string;
  status: string;
  lockedAt: Date;
  scheduledStartAt: Date;
  predictedWinnerId: string | null;
  gradedAt: Date | null;
  actualWinnerId: string | null;
};

export type BuilderTrade = {
  pairId: string;
  externalFixtureId: string;
  fixtureProvider: string;
  status: string;
  scheduledStartAt: Date;
  frozenAt: Date | null;
  matchStartedAt: Date | null;
  decisionAt: Date | null;
  gradedAt: Date | null;
  gradedCorrect: boolean | null;
  actualWinnerId: string | null;
  createdAt: Date;
};

export function isNumericFixtureId(id: string | null | undefined): id is string {
  return !!id && /^\d+$/u.test(id);
}

export function hasNonTestLikeSourceLabel(source: string | null | undefined): boolean {
  return !!source && !/(synthetic|test|manual|research|mock|fixture)/iu.test(source);
}

function isTodayUtc(value: Date, now: Date): boolean {
  const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const end = start + 24 * 60 * 60_000;
  return value.getTime() >= start && value.getTime() < end;
}

function peCounts(rows: PEFixture[], now: Date) {
  const counts: Record<string, number> = {
    missed: 0,
    pending: 0,
    started: 0,
    gradedCorrect: 0,
    gradedIncorrect: 0,
    gradedUnverifiable: 0,
    void: 0,
  };
  let prestartLocks = 0;
  for (const row of rows) {
    if (row.predictedWinnerId && row.lockedAt < row.scheduledStartAt) prestartLocks++;
    if (row.status === "missed") counts.missed++;
    else if (row.status === "void") counts.void++;
    else if (row.status === "graded") {
      if (!row.actualWinnerId || !row.predictedWinnerId) counts.gradedUnverifiable++;
      else if (row.actualWinnerId === row.predictedWinnerId) counts.gradedCorrect++;
      else counts.gradedIncorrect++;
    } else if (row.status === "pending" && row.scheduledStartAt <= now) counts.started++;
    else if (row.status === "pending") counts.pending++;
  }
  return { counts, prestartLocks };
}

/** Shape-filtered records and one latest row per provider/fixture-ID key; this does not certify provenance. */
export function classifyPredictionEngineFixtures(rows: PEFixture[], now: Date) {
  const fixtures = new Map<string, PEFixture>();
  for (const row of rows) {
    if (
      !["paper_trade", "live"].includes(row.runKind)
      || row.dataSegment !== "live"
      || !isNumericFixtureId(row.externalFixtureId)
      || !hasNonTestLikeSourceLabel(row.provider)
    ) continue;
    const key = `${row.provider}:${row.externalFixtureId}`;
    const previous = fixtures.get(key);
    if (!previous || row.lockedAt > previous.lockedAt) fixtures.set(key, row);
  }
  const selected = [...fixtures.values()];
  const all = peCounts(selected, now);
  const today = peCounts(selected.filter((row) => isTodayUtc(row.lockedAt, now)), now);
  return {
    fixtureCount: selected.length,
    todayFixtureCount: selected.filter((row) => isTodayUtc(row.lockedAt, now)).length,
    prestartLocks: all.prestartLocks,
    todayPrestartLocks: today.prestartLocks,
    counts: all.counts,
    todayCounts: today.counts,
  };
}

const BUILDER_STATES = [
  "frozenPrestart",
  "overdueFrozen",
  "pendingResult",
  "gradedCorrect",
  "gradedIncorrect",
  "noDecision",
  "dataError",
  "ineligible",
  "void",
  "other",
] as const;

type BuilderState = (typeof BUILDER_STATES)[number];

function classifyBuilderPair(pair: BuilderTrade[], now: Date): BuilderState {
  const states = pair.map((row) => row.status.toUpperCase());
  if (states.some((state) => state === "DATA_ERROR")) return "dataError";
  if (states.some((state) => state === "INELIGIBLE")) return "ineligible";
  if (states.some((state) => state === "NO_DECISION")) return "noDecision";
  if (states.some((state) => state === "VOID" || state === "CANCELLED")) return "void";
  if (states.every((state) => state === "GRADED")) {
    if (pair.some((row) => row.gradedCorrect === true)) return "gradedCorrect";
    if (pair.some((row) => row.gradedCorrect === false)) return "gradedIncorrect";
    return "other";
  }
  // STARTED and COMPLETED both have no grade yet: count once in the waiting-for-result /
  // settlement bucket, rather than also incrementing a second started bucket for the pair.
  if (states.some((state) => state === "STARTED" || state === "COMPLETED")) return "pendingResult";
  if (pair.some((row) => row.matchStartedAt)) return "pendingResult";
  const frozen = pair.find((row) => row.frozenAt || row.status.toUpperCase() === "FROZEN");
  if (frozen) {
    return frozen.scheduledStartAt > now ? "frozenPrestart" : "overdueFrozen";
  }
  return "other";
}

function newBuilderCounts(): Record<BuilderState, number> {
  return Object.fromEntries(BUILDER_STATES.map((state) => [state, 0])) as Record<BuilderState, number>;
}

/** Counts pairs once. UTC-today is the pair-creation cohort; all-time is its current lifecycle state. */
export function classifyBuilderPairs(rows: BuilderTrade[], now: Date) {
  const pairs = new Map<string, BuilderTrade[]>();
  for (const row of rows) {
    if (!isNumericFixtureId(row.externalFixtureId) || !hasNonTestLikeSourceLabel(row.fixtureProvider)) continue;
    const pairRows = pairs.get(row.pairId) ?? [];
    pairRows.push(row);
    pairs.set(row.pairId, pairRows);
  }

  const counts = newBuilderCounts();
  const todayCounts = newBuilderCounts();
  let lastPredictionAt: Date | null = null;
  let lastGradeAt: Date | null = null;
  let todayPairCount = 0;
  for (const pair of pairs.values()) {
    const state = classifyBuilderPair(pair, now);
    counts[state]++;
    // Use the earliest persisted pair timestamp to assign the pair to one UTC day cohort.
    const firstCreatedAt = pair.reduce((earliest, row) => row.createdAt < earliest ? row.createdAt : earliest, pair[0]!.createdAt);
    if (isTodayUtc(firstCreatedAt, now)) {
      todayPairCount++;
      todayCounts[state]++;
    }
    for (const row of pair) {
      if (row.decisionAt && (!lastPredictionAt || row.decisionAt > lastPredictionAt)) lastPredictionAt = row.decisionAt;
      if (row.gradedAt && (!lastGradeAt || row.gradedAt > lastGradeAt)) lastGradeAt = row.gradedAt;
    }
  }
  return { pairCount: pairs.size, todayPairCount, counts, todayCounts, lastPredictionAt, lastGradeAt };
}