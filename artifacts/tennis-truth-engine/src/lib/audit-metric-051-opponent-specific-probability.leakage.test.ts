import { describe, expect, it } from "vitest";
import { computeOpponentSpecificProbability } from "./audit-metric-051-opponent-specific-probability";

// End-to-end leakage test against the real generated index (not a synthetic
// fixture) -- "Jan Hernych" vs "Joao Souza" met exactly once, on 2018-02-05,
// per data/generated/tennis-runtime-index.json's ATP_MAIN lane. This proves
// the live wrapper's strictBefore filtering (via repositoryResultsRows)
// actually excludes the target match itself when asOfDate equals its date,
// not just matches strictly after it.
describe("metric #051 — leakage test (real data, live wrapper)", () => {
  it("excludes the meeting itself when asOfDate equals its own date (strictBefore, not on-or-before)", () => {
    const onTheDay = computeOpponentSpecificProbability({ player: "Jan Hernych", opponent: "Joao Souza", lane: "ATP_MAIN", asOfDate: "2018-02-05", generalWinProbabilityPct: 50 });
    expect(onTheDay.n).toBe(0);
  });

  it("includes the meeting once asOfDate moves strictly after its date", () => {
    const afterward = computeOpponentSpecificProbability({ player: "Jan Hernych", opponent: "Joao Souza", lane: "ATP_MAIN", asOfDate: "2018-02-06", generalWinProbabilityPct: 50 });
    expect(afterward.n).toBe(1);
    if (afterward.status === "GO") expect(afterward.value.raw_h2h_win_pct).toBe(0); // Hernych lost that meeting (won=0)
  });

  it("excludes it entirely when asOfDate is years before any recorded history (no future/contemporary leakage at all)", () => {
    const wayBefore = computeOpponentSpecificProbability({ player: "Jan Hernych", opponent: "Joao Souza", lane: "ATP_MAIN", asOfDate: "2000-01-01", generalWinProbabilityPct: 50 });
    expect(wayBefore.n).toBe(0);
  });
});
