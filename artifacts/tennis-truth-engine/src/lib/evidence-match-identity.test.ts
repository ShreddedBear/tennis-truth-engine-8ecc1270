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

describe("four-tour canonical evidence match identity", () => {
  it("keeps WTA 125 in WTA Challenger and all four families isolated", () => {
    expect(classifyEvidenceTourFamily("ATP Main")).toBe("ATP_MAIN");
    expect(classifyEvidenceTourFamily("WTA Main")).toBe("WTA_MAIN");
    expect(classifyEvidenceTourFamily("ATP Challenger 75")).toBe("ATP_CHALLENGER");
    expect(classifyEvidenceTourFamily("WTA 125")).toBe("WTA_CHALLENGER");
    expect(classifyEvidenceTourFamily("WTA Challenger")).toBe("WTA_CHALLENGER");
    expect(evidenceTourCompatible("WTA_MAIN", "WTA_CHALLENGER")).toBe(false);
    expect(evidenceTourCompatible("ATP_MAIN", "ATP_CHALLENGER")).toBe(false);
    expect(evidenceTourCompatible(null, "WTA_MAIN")).toBe(false);
  });

  it("normalizes event decorations before cross-source matching", () => {
    expect(normalizeEvidenceTournament("WTA Tour — Miami Open")).toBe("miami open");
    expect(normalizeEvidenceTournament("Miami Open 2025")).toBe("miami open");
    expect(normalizeEvidenceTournament("2026 Miami Open presented by Itaú")).toBe("miami open");
    expect(normalizeEvidenceTournament("WTA 125 Austin")).toBe("austin");
    expect(normalizeEvidenceTournament("ATP Challenger 75 Cleveland")).toBe("cleveland");
    expect(normalizeEvidenceRound("QF")).toBe("quarterfinal");
    expect(evidenceDateCompatible("2026-08-25", "2026-08-26T00:30:00Z")).toBe(true);
  });

  it("supports reversed order while preferring stable player IDs", () => {
    const forward = buildCanonicalEvidenceMatchIdentity({ player1StableId:"P1", player2StableId:"P2", player1Name:"Alpha", player2Name:"Beta", tournament:"Miami Open 2025", date:"2026-03-20", round:"R32", tour:"WTA", eventLevel:"WTA 1000" });
    const reversed = buildCanonicalEvidenceMatchIdentity({ player1StableId:"P2", player2StableId:"P1", player1Name:"Beta Renamed", player2Name:"Alpha Renamed", tournament:"WTA Miami Open 2026", date:"2026-03-20", round:"Round of 32", tour:"WTA", eventLevel:"1000" });
    expect(forward.playerPair).toBe(reversed.playerPair);
    expect(evidenceMatchIdentityCompatible(forward, reversed)).toBe(true);
  });

  it("fails closed when more than one compatible match remains", () => {
    const expected = buildCanonicalEvidenceMatchIdentity({ player1Name:"A One", player2Name:"B Two", tournament:"WTA 125 Austin", date:"2026-08-25", round:"QF", tour:"WTA 125", eventLevel:"WTA 125" });
    const rows = [{ id:1, date:"2026-08-25" }, { id:2, date:"2026-08-25" }];
    const found = uniqueEvidenceMatch(rows, row => buildCanonicalEvidenceMatchIdentity({ player1Name:"B Two", player2Name:"A One", tournament:"Austin", date:row.date, round:"quarterfinal", tour:"WTA Challenger", eventLevel:"WTA 125" }), expected);
    expect(found).toBeNull();
  });
});
