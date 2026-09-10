// REGRESSION SUITE — the selected winner must survive as a canonical identity.
//
// THE LIVE DEFECT, from production (main @ 941cb4f, the commit the drive-audit workflow
// actually runs): 60 completed audits, 60 colours, 28 committed deterministic winners --
// and 0 of 60 rows carrying `final_decisions.selected_player_id` or a selected player in
// `gate_report`. The winner existed at audit_runs.independent_winner and nowhere else that
// an identity could be read from; the only other trace was the name spliced into the
// `final_selection` ACTION string ("PLAY — Alex Michelsen").
//
// Covers required cases A-M.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { evaluate, type EngineInput } from "./audit-engine";
import { STAGES } from "./audit-stages";
import {
  assertSelectedPlayerIdBelongsToMatch,
  NO_SELECTED_PLAYER,
  playerIdForSide,
  readPersistedSelectedPlayer,
  resolveSelectedPlayer,
  sideForPlayerName,
} from "./selected-player-identity";

const P1_NAME = "Alex Michelsen";
const P2_NAME = "Federico Cina";
const P1_ID = "11111111-1111-4111-8111-111111111111";
const P2_ID = "22222222-2222-4222-8222-222222222222";

const VERIFIED = { identity_status: "VERIFIED", surface_status: "VERIFIED" } as const;
const MATCH = { ...VERIFIED, player1_name: P1_NAME, player2_name: P2_NAME, player1_id: P1_ID, player2_id: P2_ID };
/** The same two people with their slots swapped -- the fixture that catches array-order bugs. */
const MIRRORED = { ...VERIFIED, player1_name: P2_NAME, player2_name: P1_NAME, player1_id: P2_ID, player2_id: P1_ID };
/** A legacy match, exactly as production is today: no canonical player ids anywhere. */
const LEGACY = { ...VERIFIED, player1_name: P1_NAME, player2_name: P2_NAME, player1_id: null, player2_id: null };

const ALL_STAGES_COMPLETE: EngineInput["stages"] = STAGES.map((stage) => ({ stage, status: "COMPLETE" }));

type Colour = GateReportColor;
type GateReportColor = ReturnType<typeof evaluate>["color"];

function engineInput(over: {
  match?: EngineInput["match"];
  side?: "P1" | "P2" | null;
  winner?: string | null;
  disagreement?: EngineInput["disagreement"];
  underdog?: EngineInput["underdog"];
  matrixWp?: number | null;
} = {}): EngineInput {
  const match = over.match ?? MATCH;
  const metrics = Array.from({ length: 25 }, (_, i) => ({
    status: "COMPLETE", p1_status: "COMPLETE", p2_status: "COMPLETE",
    p1_treatment: "DIRECT", p2_treatment: "DIRECT",
    matrix_derived: false, evidence_family: `FAMILY_${i}`,
    metric_name: `metric ${200 + i}`, metric_code: String(200 + i).padStart(3, "0"),
    p1_value: "10", p2_value: "5", sources: [{ source_name: "Tour Stats" }],
  })) as unknown as EngineInput["metrics"];

  return {
    match,
    run: {
      research_lock_at: "2026-09-09T05:00:00.000Z",
      independent_decision_committed_at: "2026-09-09T05:38:12.000Z",
      matrix_revealed_at: "2026-09-09T05:38:13.000Z",
      independent_winner: over.winner ?? null,
      independent_winner_side: over.side ?? null,
      independent_low: null,
      independent_high: null,
      calibration_version_id: "cal-1",
      effective_evidence_count: 5,
    },
    metrics,
    verification: [{ status: "COMPLETE", outcome: "PASS", severity: "STANDARD" }] as unknown as EngineInput["verification"],
    disagreement: over.disagreement ?? ([{ status: "COMPLETE", contradiction_severity: "NONE" }] as unknown as EngineInput["disagreement"]),
    underdog: over.underdog ?? ([
      { status: "COMPLETE", classification: "WEAK", player_side: match.player1_name },
      { status: "COMPLETE", classification: "WEAK", player_side: match.player2_name },
    ] as unknown as EngineInput["underdog"]),
    stress: [
      { status: "COMPLETE", test_code: "ST01", outcome: "STABLE" },
      { status: "COMPLETE", test_code: "ST02", outcome: "STABLE" },
      { status: "COMPLETE", test_code: "ST03", outcome: "STABLE" },
    ] as unknown as EngineInput["stress"],
    reconstructions: [],
    conflicts: [],
    matrixWp: over.matrixWp ?? null,
    stages: ALL_STAGES_COMPLETE,
  };
}

/** Nudges the existing colour rules onto each colour WITHOUT touching the winner. */
const COLOUR_CASES: Array<{ label: string; over: Partial<Parameters<typeof engineInput>[0]>; expect: Colour[] }> = [
  { label: "GREEN", over: {}, expect: ["DOUBLE GREEN", "GREEN"] },
  { label: "YELLOW", over: { matrixWp: 80 }, expect: ["YELLOW", "GREEN", "DOUBLE GREEN"] },
  {
    label: "RED / PASS",
    over: { disagreement: [{ status: "COMPLETE", contradiction_severity: "CRITICAL" }] as unknown as EngineInput["disagreement"] },
    expect: ["RED / PASS"],
  },
];

// ---------------------------------------------------------------------------------------
// A-F — every colour, both sides, correct identity
// ---------------------------------------------------------------------------------------

describe("A-F. a deterministic winner carries the right identity under every colour", () => {
  for (const { label, over, expect: allowed } of COLOUR_CASES) {
    it(`P1 winner -> selected_player_id = P1 id -> ${label} -> reports P1`, () => {
      const report = evaluate(engineInput({ side: "P1", winner: P1_NAME, ...over }));
      expect(allowed).toContain(report.color);
      expect(report.selectedPlayer.side).toBe("P1");
      expect(report.selectedPlayer.player_id).toBe(P1_ID);
      expect(report.selectedPlayer.player_name).toBe(P1_NAME);
      expect(report.selectedPlayer.source).toBe("COMMITTED_SIDE");
    });

    it(`P2 winner -> selected_player_id = P2 id -> ${label} -> reports P2`, () => {
      const report = evaluate(engineInput({ side: "P2", winner: P2_NAME, ...over }));
      expect(allowed).toContain(report.color);
      expect(report.selectedPlayer.side).toBe("P2");
      expect(report.selectedPlayer.player_id).toBe(P2_ID);
      expect(report.selectedPlayer.player_name).toBe(P2_NAME);
      // The P1 id must appear nowhere on a P2 decision.
      expect(report.selectedPlayer.player_id).not.toBe(P1_ID);
    });
  }

  it("maps the side to that side's id, never the other one", () => {
    expect(playerIdForSide("P1", MATCH)).toBe(P1_ID);
    expect(playerIdForSide("P2", MATCH)).toBe(P2_ID);
    expect(playerIdForSide("P1", MIRRORED)).toBe(P2_ID);
  });
});

// ---------------------------------------------------------------------------------------
// G / 13 / 14 — a refusal stays a refusal
// ---------------------------------------------------------------------------------------

describe("G. INSUFFICIENT_EVIDENCE keeps no selected winner", () => {
  it("reports no winner, no id and no side when nothing was committed", () => {
    const report = evaluate(engineInput({ side: null, winner: null }));
    expect(report.color).toBe("INSUFFICIENT EVIDENCE");
    expect(report.selectedPlayer).toEqual(NO_SELECTED_PLAYER);
    expect(report.selectedPlayer.player_id).toBeNull();
  });

  it("cannot manufacture a winner from a colour", () => {
    // Every colour a decision can carry, with nothing committed: still no winner.
    for (const { over } of COLOUR_CASES) {
      const report = evaluate(engineInput({ side: null, winner: null, ...over }));
      expect(report.selectedPlayer.player_name).toBeNull();
    }
    expect(resolveSelectedPlayer(MATCH, {})).toEqual(NO_SELECTED_PLAYER);
    expect(resolveSelectedPlayer(MATCH, { side: null, name: null })).toEqual(NO_SELECTED_PLAYER);
  });
});

// ---------------------------------------------------------------------------------------
// H — the five representations cannot disagree
// ---------------------------------------------------------------------------------------

describe("H. name, id, side, action and gate_report agree with each other", () => {
  for (const side of ["P1", "P2"] as const) {
    it(`is internally consistent for a ${side} winner`, () => {
      const name = side === "P1" ? P1_NAME : P2_NAME;
      const id = side === "P1" ? P1_ID : P2_ID;
      const report = evaluate(engineInput({ side, winner: name }));

      // What FINAL DECISION persists, exactly as audit-pipeline.ts assembles it.
      const persisted = { selected_player_id: report.selectedPlayer.player_id, gate_report: { selectedPlayer: report.selectedPlayer } };
      const readBack = readPersistedSelectedPlayer(persisted.gate_report, MATCH, { side, name });

      expect(report.selectedPlayer.side).toBe(side);
      expect(report.selectedPlayer.player_name).toBe(name);
      expect(persisted.selected_player_id).toBe(id);
      expect(readBack.side).toBe(side);
      expect(readBack.player_id).toBe(id);
      expect(readBack.player_name).toBe(name);
      // The action still names the winner for GREEN, and it is the SAME player -- but it is
      // never the source anything reads the identity from.
      if (report.action.startsWith("PLAY")) expect(report.action).toContain(name);
    });
  }
});

// ---------------------------------------------------------------------------------------
// I — array ordering must not swap the player
// ---------------------------------------------------------------------------------------

describe("I. a P2 winner never displays as P1 through ordering", () => {
  it("follows the side, and the side follows the match row", () => {
    const p2Wins = evaluate(engineInput({ match: MATCH, side: "P2", winner: P2_NAME }));
    expect(p2Wins.selectedPlayer.player_name).toBe(P2_NAME);
    expect(p2Wins.selectedPlayer.player_id).toBe(P2_ID);

    // The SAME human, now occupying slot 1 of a mirrored match row. Their side flips; who
    // they are does not.
    const sameHumanAsP1 = evaluate(engineInput({ match: MIRRORED, side: "P1", winner: P2_NAME }));
    expect(sameHumanAsP1.selectedPlayer.side).toBe("P1");
    expect(sameHumanAsP1.selectedPlayer.player_name).toBe(P2_NAME);
    expect(sameHumanAsP1.selectedPlayer.player_id).toBe(P2_ID);
  });

  it("takes the side from the committed conclusion, not from the name's position", () => {
    // A deliberately contradictory input: the committed SIDE is authoritative, and the name
    // is not consulted at all when a side exists.
    const identity = resolveSelectedPlayer(MATCH, { side: "P2", name: P1_NAME });
    expect(identity.side).toBe("P2");
    expect(identity.player_id).toBe(P2_ID);
    expect(identity.player_name).toBe(P2_NAME);
    expect(identity.source).toBe("COMMITTED_SIDE");
  });
});

// ---------------------------------------------------------------------------------------
// J — the winner survives the whole pipeline
// ---------------------------------------------------------------------------------------

describe("J. a winner survives conclusion -> commit -> final decision -> gate report -> UI", () => {
  it("carries the same identity at every hop", () => {
    // 1. The deterministic conclusion commits a side and a name (commitConclusion).
    const committed = { side: "P2" as const, name: P2_NAME };

    // 2. FINAL DECISION resolves the canonical identity from that commit.
    const identity = resolveSelectedPlayer(MATCH, committed);

    // 3. It is persisted onto the decision row.
    const row = { selected_player_id: identity.player_id, gate_report: { selectedPlayer: identity }, final_selection: "PASS" };

    // 4. The API/loader hands the row back; the UI reads it.
    const displayed = readPersistedSelectedPlayer(row.gate_report, MATCH, committed);

    expect(identity.side).toBe("P2");
    expect(row.selected_player_id).toBe(P2_ID);
    expect(displayed.player_name).toBe(P2_NAME);
    expect(displayed.player_id).toBe(P2_ID);
    expect(displayed.side).toBe("P2");
    // The action string on the same row says "PASS" and is ignored entirely.
    expect(displayed.player_name).not.toBe(row.final_selection);
  });

  it("re-resolves from the committed conclusion for rows written before gate_report carried it", () => {
    // The 60 live rows: no selectedPlayer in gate_report at all.
    const displayed = readPersistedSelectedPlayer({ deterministic_decision: {} }, MATCH, { name: P1_NAME });
    expect(displayed.player_name).toBe(P1_NAME);
    expect(displayed.side).toBe("P1");
    expect(displayed.player_id).toBe(P1_ID);
    expect(displayed.source).toBe("COMMITTED_NAME_LEGACY");
  });

  it("honours an explicitly stored empty selection instead of re-deriving one", () => {
    const displayed = readPersistedSelectedPlayer({ selectedPlayer: NO_SELECTED_PLAYER }, MATCH, { name: P1_NAME });
    expect(displayed.player_name).toBeNull();
  });
});

// ---------------------------------------------------------------------------------------
// K — the UI never derives the winner from the colour
// ---------------------------------------------------------------------------------------

describe("K. the winner is never derived from the colour", () => {
  it("names the same player across every colour the gate produces", () => {
    const reports = COLOUR_CASES.map(({ over }) => evaluate(engineInput({ side: "P1", winner: P1_NAME, ...over })));
    expect(new Set(reports.map((r) => r.color)).size).toBeGreaterThan(1);
    for (const report of reports) {
      expect(report.selectedPlayer.player_id).toBe(P1_ID);
      expect(report.selectedPlayer.player_name).toBe(P1_NAME);
    }
  });

  it("resolves an identity with no colour in scope at all", () => {
    // resolveSelectedPlayer takes a match and a committed conclusion. There is no parameter
    // through which a colour could reach it, and no call site passes one.
    expect(resolveSelectedPlayer(MATCH, { side: "P1", name: P1_NAME }).player_name).toBe(P1_NAME);
  });

  it("never reads the identity out of the final_selection action string", () => {
    // A row whose ONLY player trace is "PLAY — Alex Michelsen" yields no player: the resolver
    // is given the committed conclusion, and there is no parameter through which the action
    // string could reach it.
    const displayed = readPersistedSelectedPlayer({}, MATCH, { side: null, name: null });
    expect(displayed.player_name).toBeNull();

    // And it is enforced structurally, not by convention: neither the identity module nor the
    // surfaces that display a winner may mention final_selection outside a comment. (Note
    // WHY this matters: the lenient surname matcher would happily resolve the string
    // "PLAY — Alex Michelsen" to P1, so a future "just parse the action" shortcut would look
    // like it worked -- right up until an action with no name in it, or a surname collision.)
    const withoutComments = (path: string) =>
      readFileSync(path, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
    for (const path of [
      "src/lib/selected-player-identity.ts",
      "src/routes/app/board.tsx",
      "src/routes/app/slate.tsx",
      "src/routes/app/match.$matchId.tsx",
    ]) {
      expect(withoutComments(path), path).not.toContain("final_selection");
    }
  });
});

// ---------------------------------------------------------------------------------------
// L — a decision may never carry a foreign player id
// ---------------------------------------------------------------------------------------

describe("L. selected_player_id must belong to this match", () => {
  it("refuses an id that is neither player1_id nor player2_id", () => {
    expect(() => assertSelectedPlayerIdBelongsToMatch("33333333-3333-4333-8333-333333333333", MATCH))
      .toThrow(/neither this match's player1_id/);
  });

  it("accepts either of the match's own ids, and accepts no id at all", () => {
    expect(() => assertSelectedPlayerIdBelongsToMatch(P1_ID, MATCH)).not.toThrow();
    expect(() => assertSelectedPlayerIdBelongsToMatch(P2_ID, MATCH)).not.toThrow();
    expect(() => assertSelectedPlayerIdBelongsToMatch(null, MATCH)).not.toThrow();
    expect(() => assertSelectedPlayerIdBelongsToMatch(null, LEGACY)).not.toThrow();
  });

  it("can only ever produce one of this match's own two ids", () => {
    for (const side of ["P1", "P2"] as const) {
      const identity = resolveSelectedPlayer(MATCH, { side, name: side === "P1" ? P1_NAME : P2_NAME });
      expect([P1_ID, P2_ID]).toContain(identity.player_id);
      expect(() => assertSelectedPlayerIdBelongsToMatch(identity.player_id, MATCH)).not.toThrow();
    }
  });
});

// ---------------------------------------------------------------------------------------
// M — legacy matches with no canonical player ids
// ---------------------------------------------------------------------------------------

describe("M. a legacy match with no player ids keeps its winner", () => {
  it("preserves the name and the side, and does not fabricate an id", () => {
    // Production today: players is empty and matches.player1_id/player2_id are null for all 60.
    const identity = resolveSelectedPlayer(LEGACY, { side: "P2", name: P2_NAME });
    expect(identity.side).toBe("P2");
    expect(identity.player_name).toBe(P2_NAME);
    expect(identity.player_id).toBeNull();
    expect(identity.unattributed).toBe(false);
  });

  it("still shows the winner beside the colour when the id is null", () => {
    const report = evaluate(engineInput({ match: LEGACY, side: "P1", winner: P1_NAME }));
    expect(report.selectedPlayer.player_name).toBe(P1_NAME);
    expect(report.selectedPlayer.player_id).toBeNull();
    expect(report.color).not.toBe("INSUFFICIENT EVIDENCE");
  });

  it("recovers the side by name only when no side was committed", () => {
    const legacyRun = resolveSelectedPlayer(LEGACY, { name: P2_NAME });
    expect(legacyRun.side).toBe("P2");
    expect(legacyRun.source).toBe("COMMITTED_NAME_LEGACY");
  });

  it("keeps an unattributable winner rather than erasing it", () => {
    // A committed name matching neither player: the winner exists, the identity does not.
    const odd = resolveSelectedPlayer(MATCH, { name: "Someone Else" });
    expect(odd.player_name).toBe("Someone Else");
    expect(odd.side).toBeNull();
    expect(odd.player_id).toBeNull();
    expect(odd.unattributed).toBe(true);
  });

  it("refuses to guess between two players whose surnames collide", () => {
    expect(sideForPlayerName("Smith", { player1_name: "Ana Smith", player2_name: "Bea Smith" })).toBeNull();
  });
});
