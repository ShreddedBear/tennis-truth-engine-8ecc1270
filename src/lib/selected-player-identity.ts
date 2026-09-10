// THE SELECTED PLAYER, AS A CANONICAL IDENTITY.
//
// WHERE THE WINNER WAS BEING LOST. The deterministic conclusion produces a SIDE -- "P1" or
// "P2" -- and commitConclusion then wrote only `audit_runs.independent_winner`, a display
// NAME. The side was discarded at that line, and with it the only unambiguous link from the
// decision to a row on `matches`. FINAL DECISION never wrote a player identity at all:
// `final_decisions.selected_player_id` existed in the database with nothing writing it (0 of
// 60 live), and `gate_report` carried no selected player. What survived was the name inside
// `final_selection` ("PLAY — Alex Michelsen"), which is an ACTION string, not an identity.
//
// SO THE SIDE IS THE PRIMARY KEY OF THIS MODULE. It comes from the committed conclusion, and
// everything else is derived from it against THIS match's own row:
//
//     side "P1" -> matches.player1_id / matches.player1_name
//     side "P2" -> matches.player2_id / matches.player2_name
//
// Never by array position, never by sort order, never by parsing an action string, and never
// by name matching when the side is known. Name matching exists here for exactly one purpose:
// recovering the side of a LEGACY run committed before the side was persisted. That is the
// only path that reads a name, and it says so at the call site.
//
// WHAT THIS MODULE DOES NOT DO. It selects nobody. It applies no threshold, compares no
// evidence and reads no colour. The Truth Engine's committed deterministic conclusion is the
// sole source of who was selected; this turns that answer into an identity and refuses to
// invent one when the data cannot support it.
//
// LEGACY MATCHES WITH NO PLAYER IDS. Live today, `players` is empty and
// matches.player1_id/player2_id are null for all 60 matches. An id is therefore NOT
// fabricated: player_id stays null, while the side and the name -- both genuinely known --
// are preserved. A missing id must never erase a winner that exists.

import { playerNamesMatch } from "./match-result-resolution";

export type PlayerSide = "P1" | "P2";

export interface IdentityMatchRef {
  player1_name: string;
  player2_name: string;
  player1_id?: string | null;
  player2_id?: string | null;
}

export type SelectedPlayerSource =
  /** The side persisted by the committed deterministic conclusion. The intended path. */
  | "COMMITTED_SIDE"
  /** A legacy run: only the committed NAME exists, so the side was recovered from it. */
  | "COMMITTED_NAME_LEGACY"
  | "NONE";

export interface SelectedPlayerIdentity {
  side: PlayerSide | null;
  /** matches.player{1,2}_id for that side. Null when the match carries no canonical ids. */
  player_id: string | null;
  /** matches.player{1,2}_name for that side -- the match's own canonical spelling. */
  player_name: string | null;
  source: SelectedPlayerSource;
  /**
   * True when a winner was committed but could not be attributed to either side of this
   * match. The winner is still reported (never erased); it simply has no side or id.
   */
  unattributed: boolean;
}

export const NO_SELECTED_PLAYER: SelectedPlayerIdentity = {
  side: null,
  player_id: null,
  player_name: null,
  source: "NONE",
  unattributed: false,
};

export function hasSelectedPlayer(identity: SelectedPlayerIdentity | null | undefined): boolean {
  return Boolean(identity && identity.player_name);
}

/**
 * LEGACY ONLY. Recover the side of a run committed before the side was persisted, by matching
 * the committed name against this match's two names. Returns null when the name matches
 * neither or -- the case that matters -- both, because two players whose surnames collide
 * cannot be told apart and guessing would attach the decision to the wrong person.
 */
export function sideForPlayerName(name: string | null | undefined, match: IdentityMatchRef): PlayerSide | null {
  if (!String(name ?? "").trim()) return null;
  const isP1 = playerNamesMatch(name, match.player1_name);
  const isP2 = playerNamesMatch(name, match.player2_name);
  return isP1 === isP2 ? null : isP1 ? "P1" : "P2";
}

export function playerIdForSide(side: PlayerSide, match: IdentityMatchRef): string | null {
  const id = side === "P1" ? match.player1_id : match.player2_id;
  return String(id ?? "").trim() || null;
}

export function playerNameForSide(side: PlayerSide, match: IdentityMatchRef): string {
  return side === "P1" ? match.player1_name : match.player2_name;
}

export interface CommittedConclusion {
  /** audit_runs.independent_winner_side -- written by commitConclusion from the same decision. */
  side?: PlayerSide | string | null;
  /** audit_runs.independent_winner -- the committed winner's name. */
  name?: string | null;
}

function normalizeSide(value: PlayerSide | string | null | undefined): PlayerSide | null {
  const side = String(value ?? "").trim().toUpperCase();
  return side === "P1" || side === "P2" ? (side as PlayerSide) : null;
}

/**
 * THE ONE RESOLVER: committed conclusion in, canonical identity out.
 *
 * A run with no committed winner returns NO_SELECTED_PLAYER -- an INSUFFICIENT_EVIDENCE
 * decision keeps no selected player, and nothing here can manufacture one.
 */
export function resolveSelectedPlayer(match: IdentityMatchRef, committed: CommittedConclusion): SelectedPlayerIdentity {
  const committedName = String(committed.name ?? "").trim();
  const committedSide = normalizeSide(committed.side);

  // No winner was committed. This is the INSUFFICIENT_EVIDENCE case and it stays empty.
  if (!committedSide && !committedName) return NO_SELECTED_PLAYER;

  // THE INTENDED PATH: the side the deterministic conclusion itself produced.
  if (committedSide) {
    return {
      side: committedSide,
      player_id: playerIdForSide(committedSide, match),
      player_name: playerNameForSide(committedSide, match),
      source: "COMMITTED_SIDE",
      unattributed: false,
    };
  }

  // LEGACY PATH: a run committed before the side was persisted. Recover it from the name.
  const recovered = sideForPlayerName(committedName, match);
  if (recovered) {
    return {
      side: recovered,
      player_id: playerIdForSide(recovered, match),
      player_name: playerNameForSide(recovered, match),
      source: "COMMITTED_NAME_LEGACY",
      unattributed: false,
    };
  }

  // A committed winner that matches neither player. Keep it -- a winner that exists must not
  // be silently erased because its identity could not be tied to a side.
  return {
    side: null,
    player_id: null,
    player_name: committedName,
    source: "COMMITTED_NAME_LEGACY",
    unattributed: true,
  };
}

/**
 * The persistence guard for requirement L: a decision may only ever carry an id belonging to
 * one of its own two players. Throws rather than writing a foreign id, because a wrong
 * selected_player_id is worse than a missing one -- it names a real player who was not
 * selected.
 */
export function assertSelectedPlayerIdBelongsToMatch(
  selectedPlayerId: string | null | undefined,
  match: IdentityMatchRef,
): void {
  const id = String(selectedPlayerId ?? "").trim();
  if (!id) return;
  const p1 = String(match.player1_id ?? "").trim();
  const p2 = String(match.player2_id ?? "").trim();
  if (id !== p1 && id !== p2) {
    throw new Error(
      `Refusing to persist selected_player_id ${id}: it is neither this match's player1_id (${p1 || "null"}) nor player2_id (${p2 || "null"}).`,
    );
  }
}

/**
 * Read the canonical identity back off a persisted final_decisions row, for display.
 *
 * gate_report.selectedPlayer is written with the decision and is the authoritative shape.
 * The fallback re-resolves from the committed conclusion for rows written before it existed.
 * final_decisions.final_selection is NEVER consulted: it holds the recommended ACTION
 * ("PLAY — <name>", "MONITOR / REDUCE", "PASS"), and parsing a player out of it would make a
 * display string the source of truth for identity.
 */
export function readPersistedSelectedPlayer(
  gateReport: unknown,
  match: IdentityMatchRef,
  committed: CommittedConclusion = {},
): SelectedPlayerIdentity {
  const report = gateReport && typeof gateReport === "object" ? (gateReport as Record<string, unknown>) : null;
  const stored = report?.["selectedPlayer"];
  if (stored && typeof stored === "object") {
    const row = stored as Record<string, unknown>;
    const side = normalizeSide(row["side"] as string | null);
    const name = String(row["player_name"] ?? "").trim();
    if (side || name) {
      return {
        side,
        player_id: String(row["player_id"] ?? "").trim() || null,
        player_name: name || (side ? playerNameForSide(side, match) : null),
        source: (String(row["source"] ?? "") as SelectedPlayerSource) || "COMMITTED_SIDE",
        unattributed: Boolean(row["unattributed"]),
      };
    }
    // An explicitly stored empty selection is a real refusal, not missing data.
    return NO_SELECTED_PLAYER;
  }
  return resolveSelectedPlayer(match, committed);
}
