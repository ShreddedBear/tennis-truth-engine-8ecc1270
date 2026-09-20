/**
 * Parlay Builder — switch/revalidation helpers (pure, side-effect-free).
 *
 * Extracted so the Switch Removes / Switch Borderline workflow can be tested
 * without a browser or a live API: flipping a leg's selected side, building
 * the validate-request payload for that side, merging revalidated results
 * back into the full result set by key (never by array position), and
 * recomputing the summary from the merged set.
 *
 * Root cause this exists to fix: the previous implementation re-ran the
 * Prediction Engine for every leg on every switch and then let that fresh
 * (necessarily identical) prediction silently override the user's flip
 * whenever it succeeded — so a switch either did nothing or, when the
 * redundant Prediction Engine call happened to be rate-limited, worked by
 * accident. It also fanned out one Prediction Engine request per leg with
 * no concurrency cap, which is what exhausted the API's rate limit and
 * produced "Too many requests" on 100+ leg slates.
 */

export type Side = "1" | "2";

export interface LegLike {
  key: string;
  player1Id: string | null;
  player1Name: string;
  player2Id: string | null;
  player2Name: string;
  surface: string | null;
  tournamentName: string | null;
  marketOdds: string;
  selectedSide: Side | null;
}

export interface ValidateLegPayload {
  selectedPlayerId: string;
  selectedPlayerName: string;
  opponentId: string;
  opponentName: string;
  surface: string | null;
  tournamentName: string | null;
  marketOdds: number | null;
}

export function flipSide(side: Side): Side {
  return side === "1" ? "2" : "1";
}

/**
 * The single place that turns "which side is selected" into the payload the
 * Independent Validation Engine receives. Used for the initial analyze AND
 * every switch, so a flipped `selectedSide` always produces a payload for the
 * opposite player — there is no second code path that can re-derive the side
 * from a stale prediction and override it.
 *
 * Throws rather than defaulting to Player 1 when `selectedSide` is null: a
 * leg with no resolved side (e.g. its Prediction Engine call failed) must
 * never be silently scored as if Player 1 had been picked — callers are
 * required to filter such legs out before validation (see
 * `resolvePredictedSideOrNull` and its use in the initial analyze).
 */
export function buildValidateLegPayload(leg: LegLike): ValidateLegPayload {
  if (leg.selectedSide == null) {
    throw new Error(`buildValidateLegPayload: leg "${leg.key}" has no selected side — cannot validate an unresolved prediction`);
  }
  const side: Side = leg.selectedSide;
  const selectedIsP1 = side === "1";
  const player1Id = leg.player1Id ?? `unresolved-${leg.key}-p1`;
  const player2Id = leg.player2Id ?? `unresolved-${leg.key}-p2`;
  const player1Name = leg.player1Name || "Unknown";
  const player2Name = leg.player2Name || "Unknown";
  const odds = leg.marketOdds && !isNaN(parseFloat(leg.marketOdds)) ? parseFloat(leg.marketOdds) : null;

  return selectedIsP1
    ? {
        selectedPlayerId: player1Id, selectedPlayerName: player1Name,
        opponentId: player2Id, opponentName: player2Name,
        surface: leg.surface ?? null, tournamentName: leg.tournamentName ?? null,
        marketOdds: odds,
      }
    : {
        selectedPlayerId: player2Id, selectedPlayerName: player2Name,
        opponentId: player1Id, opponentName: player1Name,
        surface: leg.surface ?? null, tournamentName: leg.tournamentName ?? null,
        marketOdds: odds,
      };
}

/** Keys of every result whose decision matches, in result order (skips legs with no key mapping). */
export function selectKeysByDecision(
  resultLegs: ReadonlyArray<{ decision: string }>,
  resultLegKeys: ReadonlyArray<string>,
  decision: string,
): Set<string> {
  const keys = new Set<string>();
  resultLegs.forEach((leg, i) => {
    if (leg.decision === decision) {
      const key = resultLegKeys[i];
      if (key != null) keys.add(key);
    }
  });
  return keys;
}

/**
 * Flips `selectedSide` for exactly the legs whose key is in `keys`; all others are
 * returned unchanged. Throws rather than defaulting to Player 1 when a targeted leg
 * has no resolved side (`selectedSide === null`) — that state means no valid
 * prediction/player selection exists yet (e.g. the Prediction Engine call failed),
 * and switching such a leg would otherwise silently manufacture a Player 1 pick.
 */
export function flipLegsByKey<T extends { key: string; selectedSide: Side | null }>(
  legs: ReadonlyArray<T>,
  keys: ReadonlySet<string>,
): T[] {
  return legs.map((leg) => {
    if (!keys.has(leg.key)) return leg;
    if (leg.selectedSide == null) {
      throw new Error(`Cannot flip a leg without a selected side (leg "${leg.key}")`);
    }
    return { ...leg, selectedSide: flipSide(leg.selectedSide) };
  });
}

export interface BuilderLegResultLike {
  decision: "KEEP" | "BORDERLINE" | "REMOVE" | "DATA_UNAVAILABLE";
  validationScore: number;
  riskScore: number;
  parlayGrade: "Elite" | "Solid" | "Weak" | "Reject";
}

/**
 * Replace only the entries whose key was revalidated; every other entry is
 * returned by reference, untouched. Matching is by key (via `resultLegKeys`,
 * the same index->key mapping recorded at analyze time), never by the
 * position a batch happened to return results in — so an out-of-order or
 * chunked revalidation response can never get merged into the wrong leg.
 */
export function mergeSwitchedResults<T extends BuilderLegResultLike>(params: {
  fullResults: ReadonlyArray<T>;
  resultLegKeys: ReadonlyArray<string>;
  updates: ReadonlyArray<{ key: string; result: T }>;
}): T[] {
  const { fullResults, resultLegKeys, updates } = params;
  const updateByKey = new Map(updates.map((u) => [u.key, u.result]));
  return fullResults.map((result, i) => {
    const key = resultLegKeys[i];
    const update = key != null ? updateByKey.get(key) : undefined;
    return update ?? result;
  });
}

const GRADE_ORDER = ["Reject", "Weak", "Solid", "Elite"] as const;

/** Mirrors the server's summary computation in adminParlay.ts exactly, so a client-side
 *  partial-merge recompute matches what a full server re-validation would report. */
export function computeSummary(results: ReadonlyArray<BuilderLegResultLike>) {
  const keepCount = results.filter((r) => r.decision === "KEEP").length;
  const borderlineCount = results.filter((r) => r.decision === "BORDERLINE").length;
  const removeCount = results.filter((r) => r.decision === "REMOVE").length;
  if (results.length === 0) {
    return { keepCount, borderlineCount, removeCount, avgValidationScore: 0, avgRiskScore: 0, overallParlayGrade: GRADE_ORDER[0] as string };
  }
  const avgValidationScore = Math.round(results.reduce((s, r) => s + r.validationScore, 0) / results.length);
  const avgRiskScore = Math.round(results.reduce((s, r) => s + r.riskScore, 0) / results.length);
  const gradeIndices = results.map((r) => GRADE_ORDER.indexOf(r.parlayGrade));
  const worstIdx = Math.min(...gradeIndices);
  const avgIdx = Math.round(gradeIndices.reduce((s, v) => s + v, 0) / gradeIndices.length);
  const overallParlayGrade = GRADE_ORDER[Math.max(0, Math.min(3, Math.min(worstIdx + 1, avgIdx)))];
  return { keepCount, borderlineCount, removeCount, avgValidationScore, avgRiskScore, overallParlayGrade };
}

export function chunk<T>(items: ReadonlyArray<T>, size: number): T[][] {
  if (size <= 0) throw new Error("chunk size must be positive");
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Bounded-concurrency worker pool — at most `limit` workers in flight at once. */
export async function runWithConcurrency<T>(
  items: ReadonlyArray<T>,
  limit: number,
  worker: (item: T, index: number) => Promise<void>,
): Promise<void> {
  let next = 0;
  const run = async (): Promise<void> => {
    const i = next++;
    if (i >= items.length) return;
    await worker(items[i], i);
    await run();
  };
  await Promise.all(Array.from({ length: Math.min(Math.max(1, limit), items.length) }, run));
}

export interface RetryableResponse {
  ok: boolean;
  status: number;
  headers: { get(name: string): string | null };
  json: () => Promise<unknown>;
}

export interface RetryOptions {
  /** Max retry attempts after the first try (default 4). */
  retries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

function parseRetryAfterMs(value: string | null): number | null {
  if (!value) return null;
  const asSeconds = Number(value);
  if (!Number.isNaN(asSeconds)) return Math.max(0, asSeconds * 1000);
  const asDate = Date.parse(value);
  if (!Number.isNaN(asDate)) return Math.max(0, asDate - Date.now());
  return null;
}

/**
 * Calls `doFetch()` and, on HTTP 429, retries with the server's `Retry-After`
 * header when present, otherwise bounded exponential backoff — up to
 * `retries` times — before giving up. Any non-429 non-ok response throws
 * immediately (no retry). Never silently drops the request: it either
 * resolves with the parsed JSON body or throws.
 */
export async function fetchJsonWithRetry(
  doFetch: () => Promise<RetryableResponse>,
  opts: RetryOptions = {},
): Promise<unknown> {
  const retries = opts.retries ?? 4;
  const baseDelayMs = opts.baseDelayMs ?? 500;
  const maxDelayMs = opts.maxDelayMs ?? 8000;
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));

  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await doFetch();

    if (res.status !== 429) {
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      return res.json();
    }

    if (attempt === retries) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(body?.error ?? "Too many requests");
    }

    const retryAfterMs = parseRetryAfterMs(res.headers.get("Retry-After"));
    const backoffMs = Math.min(maxDelayMs, baseDelayMs * 2 ** attempt);
    await sleep(retryAfterMs ?? backoffMs);
  }

  // Unreachable — the loop above always returns or throws.
  throw new Error("Too many requests");
}

// ── Prediction Engine request contract ──────────────────────────────────────
//
// The initial analyze auto-selects the Prediction Engine's winner for each
// leg. Two rules matter here: the request must use the canonical contract
// /api/predictions actually expects (matchFormat "BestOf3"/"BestOf5" plus the
// x-prediction-request-id / x-prediction-match-id integrity headers — see
// artifacts/api-server/src/routes/predictionRequestIntegrity.ts), and a leg
// whose prediction could not be obtained must resolve to `null`, never to a
// silently-assumed Player 1.

export interface PredictionCallLeg {
  key: string;
  player1Id: string;
  player2Id: string;
  player1Name?: string;
  player2Name?: string;
  surface: string | null;
  tournamentName: string | null;
}

export interface PredictionRequestInput {
  player1Id: string;
  player2Id: string;
  surface: string;
  matchFormat: "BestOf3";
  tournamentName: string | null;
}

export interface PredictionRequestContext {
  requestMatchId: string;
  submittedPlayer1Name?: string;
  submittedPlayer2Name?: string;
}

/**
 * Builds the arguments for `createPredictionWithIntegrity` (the canonical
 * helper already used by every other prediction call site in this app —
 * BulkMatchupPredictor, PasteMatchupPredictor, FixturesList) from a Parlay
 * Builder leg. This is the single place that decides the request contract,
 * so the Parlay Builder can't drift from it again the way the previous
 * hand-rolled fetch (wrong matchFormat literal, no integrity headers) did.
 */
export function buildPredictionCallArgs(leg: PredictionCallLeg): {
  input: PredictionRequestInput;
  context: PredictionRequestContext;
} {
  return {
    input: {
      player1Id: leg.player1Id,
      player2Id: leg.player2Id,
      surface: leg.surface ?? "Hard",
      matchFormat: "BestOf3",
      tournamentName: leg.tournamentName ?? null,
    },
    context: {
      requestMatchId: leg.key,
      submittedPlayer1Name: leg.player1Name || undefined,
      submittedPlayer2Name: leg.player2Name || undefined,
    },
  };
}

/**
 * Turns a Prediction Engine response's calibrated probability into the side
 * to back — or `null` when no usable probability came back. Returning `null`
 * (rather than defaulting to "1") is what lets the caller keep the leg
 * genuinely unresolved instead of fabricating a Player-1 pick.
 */
export function resolvePredictedSideOrNull(calibratedProbabilityP1: number | null | undefined): Side | null {
  if (calibratedProbabilityP1 == null || Number.isNaN(calibratedProbabilityP1)) return null;
  return calibratedProbabilityP1 >= 50 ? "1" : "2";
}
