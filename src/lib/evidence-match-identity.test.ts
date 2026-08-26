import { describe, expect, it } from "vitest";
import {
  buildCanonicalEvidenceMatchIdentity,
  classifyEvidenceTourFamily,
  evidenceDateCompatible,
  evidenceMatchIdentityCompatible,
  evidenceTourCompatible,
  normalizeEvidenceRound,
  normalizeEvidenceTournament,
  uniqueEvidenceMatch,
} from "./evidence-match-identity";

describe("four-tour evidence identity", () => {
  it("classifies all four production families without promoting WTA 125 to WTA Main", () => {
    expect(classifyEvidenceTourFamily("ATP Main")).toBe("ATP_MAIN");
    expect(classifyEvidenceTourFamily("WTA Main")).toBe("WTA_MAIN");
    expect(classifyEvidenceTourFamily("ATP Challenger 75")).toBe("ATP_CHALLENGER");
    expect(classifyEvidenceTourFamily("WTA 125")).toBe("WTA_CHALLENGER");
    expect(classifyEvidenceTourFamily("WTA Challenger")).toBe("WTA_CHALLENGER");
    expect(classifyEvidenceTourFamily("women challenger 125k")).toBe("WTA_CHALLENGER");
    expect(classifyEvidenceTourFamily("unknown event")).toBeNull();
  });

  it("normalizes tournament, round and local/UTC-adjacent dates", () => {
    expect(normalizeEvidenceTournament("WTA Tour — Miami Open")).toBe("miami open");
    expect(normalizeEvidenceRound("QF")).toBe("quarterfinal");
    expect(evidenceDateCompatible("2026-08-25", "2026-08-26T00:30:00Z")).toBe(true);
    expect(evidenceDateCompatible("2026-08-23", "2026-08-26")).toBe(false);
  });

  it("makes player order symmetric and prefers stable IDs", () => {
    const forward = buildCanonicalEvidenceMatchIdentity({ player1StableId: "P1", player2StableId: "P2", player1Name: "Alpha", player2Name: "Beta", tournament: "Miami Open", date: "2026-03-20", round: "R32", tour: "WTA", eventLevel: "WTA 1000" });
    const reversed = buildCanonicalEvidenceMatchIdentity({ player1StableId: "P2", player2StableId: "P1", player1Name: "Beta Renamed", player2Name: "Alpha Renamed", tournament: "WTA Miami Open", date: "2026-03-20", round: "Round of 32", tour: "WTA", eventLevel: "1000" });
    expect(forward.playerPair).toBe(reversed.playerPair);
    expect(evidenceMatchIdentityCompatible(forward, reversed)).toBe(true);
  });

  it("hard-fails cross-tour joins, including WTA Main versus WTA 125", () => {
    expect(evidenceTourCompatible("WTA_MAIN", "WTA_CHALLENGER")).toBe(false);
    expect(evidenceTourCompatible("ATP_MAIN", "ATP_CHALLENGER")).toBe(false);
    expect(evidenceTourCompatible(null, "WTA_MAIN")).toBe(false);
  });

  it("fails closed when more than one compatible match remains", () => {
    const expected = buildCanonicalEvidenceMatchIdentity({ player1Name: "A One", player2Name: "B Two", tournament: "WTA 125 Austin", date: "2026-08-25", round: "QF", tour: "WTA 125", eventLevel: "WTA 125" });
    const rows = [
      { id: 1, date: "2026-08-25" },
      { id: 2, date: "2026-08-25" },
    ];
    expect(uniqueEvidenceMatch(rows, (row) => buildCanonicalEvidenceMatchIdentity({ player1Name: "B Two", player2Name: "A One", tournament: "Austin", date: row.date, round: "quarterfinal", tour: "WTA Challenger", eventLevel: "WTA 125" }), expected)).toBeNull();
  });
});
