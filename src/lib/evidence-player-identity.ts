export function normalizeEvidencePlayerName(value: string | null | undefined) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function tokens(value: string | null | undefined) {
  return normalizeEvidencePlayerName(value).split(" ").filter(Boolean);
}

/**
 * Fail-closed evidence identity matcher.
 *
 * Exact normalized names always match. A one-token stored identity may match a
 * requested full name only when that token is a complete normalized name token
 * (normally the surname). Callers must still enforce uniqueness across the
 * candidate set before crediting evidence. No edit-distance/fuzzy guessing is
 * allowed here.
 */
export function evidenceNameCouldMatch(requested: string, stored: string | null | undefined) {
  const a = normalizeEvidencePlayerName(requested);
  const b = normalizeEvidencePlayerName(stored);
  if (!a || !b) return false;
  if (a === b) return true;
  const at = tokens(a);
  const bt = tokens(b);
  if (bt.length === 1 && at.includes(bt[0])) return true;
  if (at.length === 1 && bt.includes(at[0])) return true;
  return false;
}

export function uniqueEvidenceIdentity(requested: string, candidates: Array<string | null | undefined>) {
  const matches = [...new Set(candidates.filter((candidate): candidate is string => Boolean(candidate) && evidenceNameCouldMatch(requested, candidate)))];
  return matches.length === 1 ? matches[0] : null;
}
