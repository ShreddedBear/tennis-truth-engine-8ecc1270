// PREDICTION SLATE — the boundary between one prediction slate and the next.
//
// A slate is the unit Clear Slate operates on. Matches, and therefore every prediction
// record hanging off a match (audit_runs, metric_results, verification/disagreement/
// underdog/stress results, final_decisions, coverage), belong to exactly one slate.
// Retiring a slate does not delete any of it -- the history stays auditable -- it removes
// it from the CURRENT slate, permanently and for every reader.
//
// What is NOT slate-scoped, and must never be: players, tournaments, the metric registry,
// metric_evidence_store, source_observations, rules, the runtime tennis index, and the
// Matrix calibration versions/buckets. Those are global reference data. A player is the
// same player in Slate B as in Slate A; their Slate A PREDICTION EVIDENCE is not.
//
// Everything here is pure so the isolation rules can be tested without a database.

export interface PredictionSlateRow {
  id: string;
  slate_number?: number | null;
  label?: string | null;
  created_at?: string | null;
  retired_at?: string | null;
  retired_reason?: string | null;
}

export interface SlateScopedMatch {
  id: string;
  slate_id?: string | null;
}

/** The current slate: the single row that has not been retired. */
export function activeSlate(rows: readonly PredictionSlateRow[]): PredictionSlateRow | null {
  return rows.find((row) => !row.retired_at) ?? null;
}

export function isRetired(slate: PredictionSlateRow | null | undefined): boolean {
  return Boolean(slate?.retired_at);
}

/**
 * The current slate's matches, and only those.
 *
 * A match with no slate_id is NOT assumed to be current. Before the boundary migration every
 * match was backfilled onto the legacy slate, and the database trigger assigns one to every
 * later insert, so a null here means "unknown provenance" -- and an unknown-provenance
 * prediction record is exactly what must not leak into a new slate.
 */
export function matchesOnSlate<T extends SlateScopedMatch>(
  matches: readonly T[],
  slateId: string | null,
): T[] {
  if (!slateId) return [];
  return matches.filter((match) => match.slate_id === slateId);
}

export function isOnSlate(
  match: SlateScopedMatch | null | undefined,
  slateId: string | null,
): boolean {
  return Boolean(slateId) && match?.slate_id === slateId;
}

/**
 * The upload dedupe universe.
 *
 * THE ROOT CAUSE of "0 new matches, 50 existing matches reused" was that this set was every
 * row in `matches`. A retired slate's rows are candidates for nothing: the same fixture
 * uploaded into a new slate is a NEW prediction instance, because reusing the old match id
 * would silently re-attach the retired slate's audit runs, metric results and decisions to
 * the new prediction.
 */
export function dedupeCandidates<T extends SlateScopedMatch>(
  matches: readonly T[],
  activeSlateId: string | null,
): T[] {
  return matchesOnSlate(matches, activeSlateId);
}

export interface SlateIsolationReport {
  active_slate_id: string | null;
  current_slate_matches: number;
  retired_matches: number;
  unassigned_matches: number;
}

/** What an upload/UI layer needs to state honestly about what it is looking at. */
export function describeSlateIsolation(
  matches: readonly SlateScopedMatch[],
  activeSlateId: string | null,
): SlateIsolationReport {
  let current = 0,
    retired = 0,
    unassigned = 0;
  for (const match of matches) {
    if (!match.slate_id) unassigned += 1;
    else if (match.slate_id === activeSlateId) current += 1;
    else retired += 1;
  }
  return {
    active_slate_id: activeSlateId,
    current_slate_matches: current,
    retired_matches: retired,
    unassigned_matches: unassigned,
  };
}
