import { describe, expect, it } from "vitest";
import {
  buildApprovedSackmannHistoryLanes,
  loadApprovedSackmannHistory,
  type SackmannAliasRow,
  type SackmannIdentityRow,
  type SackmannMatchRow,
} from "./approved-sackmann-history.server";

const identities: SackmannIdentityRow[] = [
  { id: "p1", displayName: "Winner One", reviewStatus: "approved" },
  { id: "p2", displayName: "Loser Two", reviewStatus: "approved" },
];
const aliases: SackmannAliasRow[] = [
  { canonicalPlayerId: "p1", externalPlayerName: "W. One", verificationStatus: "verified" },
  { canonicalPlayerId: "p2", externalPlayerName: "L. Two", verificationStatus: "verified" },
];

function row(overrides: Partial<SackmannMatchRow> = {}): SackmannMatchRow {
  return {
    id: 1,
    externalId: "atp-event-1",
    provider: "sackmann",
    tour: "ATP",
    tournamentName: "Approved Open",
    tournamentLevel: "ATP250",
    surface: "Hard",
    round: "F",
    canonicalPlayer1Id: "p1",
    canonicalPlayer2Id: "p2",
    winnerId: "p1",
    scheduledStartAt: new Date("2024-01-10T12:00:00Z"),
    cancelled: false,
    sourceFile: "atp/atp_matches_2024.csv",
    sourceUrl: "https://raw.githubusercontent.com/Aneeshers/tennis-sackmann-archive/main/atp/atp_matches_2024.csv",
    sourceLicense: "CC BY-NC-SA 4.0",
    importProvenance: {
      importer: "approved-aneeshers-sackmann",
      repository: "Aneeshers/tennis-sackmann-archive",
      branch: "main",
      sourceFile: "atp/atp_matches_2024.csv",
      sourceUrl: "https://raw.githubusercontent.com/Aneeshers/tennis-sackmann-archive/main/atp/atp_matches_2024.csv",
      sourceLicense: "CC BY-NC-SA 4.0",
    },
    ...overrides,
  };
}

describe("approved Sackmann HistoryLane adapter", () => {
  it("enforces a strict scheduled-start cutoff", () => {
    const result = buildApprovedSackmannHistoryLanes([
      row({ id: 1, scheduledStartAt: new Date("2024-01-09T23:59:59Z") }),
      row({ id: 2, externalId: "atp-event-2", scheduledStartAt: new Date("2024-01-10T00:00:00Z") }),
      row({ id: 3, externalId: "atp-event-3", scheduledStartAt: new Date("2024-01-11T00:00:00Z") }),
    ], identities, aliases, "2024-01-10");

    expect(result.accepted).toBe(1);
    expect(result.lanes.ATP_MAIN["winner one"]).toHaveLength(1);
    expect(result.lanes.ATP_MAIN["winner one"][0]?.[0]).toBe("2024-01-09");
  });

  it("orients both lane rows from the canonical winner ID, not source column order", () => {
    const result = buildApprovedSackmannHistoryLanes([
      row({ canonicalPlayer1Id: "p1", canonicalPlayer2Id: "p2", winnerId: "p2" }),
    ], identities, aliases, "2024-01-11");

    expect(result.lanes.ATP_MAIN["winner one"][0]?.[4]).toBe(0);
    expect(result.lanes.ATP_MAIN["loser two"][0]?.[4]).toBe(1);
  });

  it("rejects wrong provider, incomplete identity, non-terminal result, and unapproved provenance", () => {
    const result = buildApprovedSackmannHistoryLanes([
      row({ provider: "API-Tennis", id: 1 }),
      row({ canonicalPlayer2Id: null, externalId: "missing-id", id: 2 }),
      row({ winnerId: null, externalId: "no-winner", id: 3 }),
      row({ importProvenance: { importer: "unapproved", repository: "Aneeshers/tennis-sackmann-archive", branch: "main" }, externalId: "bad-provenance", id: 4 }),
      row({ cancelled: true, externalId: "cancelled", id: 5 }),
    ], identities, aliases, "2024-01-11");

    expect(result.accepted).toBe(0);
    expect(result.lanes.ATP_MAIN).toEqual({});
  });

  it("does not relabel WTA ITF prize-money rows as tour-level history", () => {
    const sourceFile = "wta/wta_matches_qual_itf_2024.csv";
    const sourceUrl = `https://raw.githubusercontent.com/Aneeshers/tennis-sackmann-archive/main/${sourceFile}`;
    const result = buildApprovedSackmannHistoryLanes([
      row({
        tour: "WTA",
        sourceFile,
        sourceUrl,
        rawTournamentLevel: "25",
        importProvenance: {
          importer: "approved-aneeshers-sackmann",
          repository: "Aneeshers/tennis-sackmann-archive",
          branch: "main",
          sourceFile,
          sourceUrl,
          sourceLicense: "CC BY-NC-SA 4.0",
        },
      }),
    ], identities, aliases, "2024-01-11");

    expect(result.accepted).toBe(0);
    expect(result.lanes.WTA_MAIN).toEqual({});
  });

  it("fails closed before querying when the requested cutoff is invalid", async () => {
    const result = await loadApprovedSackmannHistory("not-a-date");
    expect(result.available).toBe(false);
    expect(result.accepted).toBe(0);
    expect(result.lanes).toEqual({});
  });
});