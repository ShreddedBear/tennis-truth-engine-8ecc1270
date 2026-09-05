// UPLOAD DEDUPE — "have I already ingested this fixture?", answered WITHIN one slate.
//
// Extracted from upload.tsx unchanged in its matching semantics, with exactly one behaviour
// added: the candidate universe is the ACTIVE SLATE, never the whole `matches` table.
//
// That single scope was the root cause of the reported integrity failure. Clear Slate
// retires a slate but deliberately keeps its rows (they stay auditable); the dedupe then
// found those retired rows by canonical_key and answered "already ingested", so a fresh
// upload of the same 50-match PDF reported "0 new matches, 50 existing matches reused" and
// silently re-attached the retired slate's audit runs, metric results, evidence and
// decisions to what the user was told was a new prediction slate.
//
// The rule this module encodes: the same two players in the same tournament is the SAME
// FIXTURE but a DIFFERENT PREDICTION INSTANCE once the slate has turned over. Player
// identity is global and survives; prediction evidence is per-slate and does not.

import { normalizeName } from "./summary-parser";
import { dedupeCandidates } from "./prediction-slate";

export interface DedupeMatchRow {
  id: string;
  slate_id?: string | null;
  canonical_key?: string | null;
  player1_name: string;
  player2_name: string;
  scheduled_date?: string | null;
  tournament_name?: string | null;
  round?: string | null;
  event_level?: string | null;
  surface?: string | null;
  best_of?: number | null;
  created_at?: string | null;
}

export interface DedupeTarget {
  canonical_key: string;
  player1_name: string;
  player2_name: string;
  scheduled_date?: string | null;
  tournament_name?: string | null;
  round?: string | null;
}

export const clean = (v: string | null | undefined) =>
  String(v ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
export const nameTokens = (v: string) => normalizeName(v).split(" ").filter(Boolean);

export function samePlayer(a: string, b: string) {
  const x = nameTokens(a),
    y = nameTokens(b);
  if (!x.length || !y.length) return false;
  if (x.join(" ") === y.join(" ")) return true;
  const xl = x[x.length - 1],
    yl = y[y.length - 1];
  if (xl !== yl) return false;
  const sx = new Set(x),
    sy = new Set(y);
  const overlap = [...sx].filter((t) => sy.has(t)).length;
  const shorter = Math.min(sx.size, sy.size);
  return overlap === shorter || overlap >= Math.min(2, shorter);
}

export function samePair(a1: string, a2: string, b1: string, b2: string) {
  return (samePlayer(a1, b1) && samePlayer(a2, b2)) || (samePlayer(a1, b2) && samePlayer(a2, b1));
}

export function compatible(a: string | null | undefined, b: string | null | undefined) {
  const x = clean(a),
    y = clean(b);
  return !x || !y || x === y || x.includes(y) || y.includes(x);
}

/**
 * The one reuse decision, over the active slate's rows only.
 *
 * Order is the pre-existing one: exact canonical key, then a context-compatible same-pair
 * row, then the single unambiguous same-pair row when neither side carries context. What is
 * new is the first line: candidates outside the active slate are not candidates at all, so
 * no branch below can ever return a retired slate's match.
 */
export function selectReusableMatch(
  allMatches: readonly DedupeMatchRow[],
  target: DedupeTarget,
  activeSlateId: string | null,
): DedupeMatchRow | null {
  const candidates = dedupeCandidates(allMatches, activeSlateId);
  if (!candidates.length) return null;

  const exact = candidates.find(
    (c) => String(c.canonical_key ?? "").trim() !== "" && c.canonical_key === target.canonical_key,
  );
  if (exact) return exact;

  const pairMatches = candidates.filter((c) =>
    samePair(c.player1_name, c.player2_name, target.player1_name, target.player2_name),
  );
  const contextual = pairMatches.find(
    (c) =>
      compatible(c.scheduled_date, target.scheduled_date) &&
      compatible(c.tournament_name, target.tournament_name) &&
      compatible(c.round, target.round),
  );
  if (contextual) return contextual;

  if (
    pairMatches.length === 1 &&
    (!target.scheduled_date || !pairMatches[0].scheduled_date) &&
    (!target.tournament_name || !pairMatches[0].tournament_name)
  ) {
    return pairMatches[0];
  }
  return null;
}
