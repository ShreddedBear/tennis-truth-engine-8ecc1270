function normalize(value: string | null | undefined) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function surname(value: string) {
  const parts = normalize(value).split(" ").filter(Boolean);
  return parts.length >= 2 ? parts[parts.length - 1] : null;
}

/**
 * Evidence written by older completion sweeps sometimes used only a surname
 * (for example "Gauff") while the audit asks for the canonical display name
 * ("Coco Gauff").  Recover only the one safe legacy alias we can prove from
 * the requested matchup: an exact surname that is not shared by the opponent.
 * No fuzzy/edit-distance matching is permitted here.
 */
export function safeEvidenceAliases(player: string, opponent: string) {
  const aliases = new Set<string>([player]);
  const playerSurname = surname(player);
  const opponentSurname = surname(opponent);
  if (playerSurname && playerSurname !== opponentSurname) aliases.add(playerSurname);
  return [...aliases];
}

export function evidenceNameMatches(stored: string | null | undefined, requested: string, opponent: string) {
  const wanted = new Set(safeEvidenceAliases(requested, opponent).map(normalize));
  return wanted.has(normalize(stored));
}

export function evidencePairMatches(
  storedPlayer: string | null | undefined,
  storedOpponent: string | null | undefined,
  player: string,
  opponent: string,
) {
  return evidenceNameMatches(storedPlayer, player, opponent) && evidenceNameMatches(storedOpponent, opponent, player);
}
