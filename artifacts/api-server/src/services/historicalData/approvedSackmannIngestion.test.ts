import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  _approvedSackmannSourceUrl,
  _isApprovedSackmannSourceUrl,
  _rowToFixture,
  resolveApprovedSackmannFixtures,
  APPROVED_SACKMANN_LICENSE,
  approvedSackmannCanonicalId,
} from "./sackmannBackfill.js";

const row = (overrides: Record<string, string> = {}) => ({
  tourney_id: "2024-001",
  tourney_name: "Example Open",
  surface: "Hard",
  tourney_date: "20240115",
  tourney_level: "A",
  draw_size: "32",
  match_num: "1",
  winner_id: "w-1",
  winner_name: "Winner One",
  loser_id: "l-1",
  loser_name: "Loser Two",
  score: "6-4 6-3",
  round: "F",
  best_of: "3",
  ...overrides,
});

describe("approved Aneeshers Sackmann ingestion", () => {
  it("allows only the approved raw layout and rejects other providers/layouts", () => {
    const atp = _approvedSackmannSourceUrl("ATP", 2024);
    const wtaQual = _approvedSackmannSourceUrl("WTA", 2024, true);
    assert.equal(_isApprovedSackmannSourceUrl(atp), true);
    assert.equal(_isApprovedSackmannSourceUrl(wtaQual), true);
    assert.equal(_isApprovedSackmannSourceUrl("https://raw.githubusercontent.com/other/repo/main/atp/atp_matches_2024.csv"), false);
    assert.equal(_isApprovedSackmannSourceUrl("https://raw.githubusercontent.com/Aneeshers/tennis-sackmann-archive/main/atp_matches_2024.csv"), false);
    assert.equal(_isApprovedSackmannSourceUrl("https://www.kaggle.com/api/v1/datasets/x/y"), false);
  });

  it("keeps Sackmann winner orientation and raw source IDs/names", () => {
    const fixture = _rowToFixture(row(), "ATP");
    assert.ok(fixture);
    assert.equal(fixture.player1Id, "sackmann-w-1");
    assert.equal(fixture.player2Id, "sackmann-l-1");
    assert.equal(fixture.sourcePlayer1Id, "ATP:w-1");
    assert.equal(fixture.sourcePlayer2Id, "ATP:l-1");
    assert.match(fixture.id, /^atp-/);
    assert.equal(fixture.winnerId, fixture.player1Id);
    assert.equal((fixture.raw as Record<string, string>).winner_id, "w-1");
    assert.equal((fixture.raw as Record<string, string>).loser_name, "Loser Two");
  });

  it("keeps identical numeric ATP and WTA source IDs in separate canonical identities", () => {
    assert.notEqual(
      approvedSackmannCanonicalId("ATP:12345"),
      approvedSackmannCanonicalId("WTA:12345"),
    );
  });

  it("admits only matches with two canonical resolutions and quarantines the whole match otherwise", async () => {
    const fixture = _rowToFixture(row(), "ATP");
    assert.ok(fixture);
    const result = await resolveApprovedSackmannFixtures([fixture], {
      resolve: async ({ externalPlayerId }) => ({
        source: "approved-aneeshers-sackmann",
        canonicalPlayerId: externalPlayerId.endsWith("w-1") ? "canonical-winner" : null,
        resolutionMethod: externalPlayerId.endsWith("w-1") ? "provider-alias" : "unresolved",
        confidence: externalPlayerId.endsWith("w-1") ? 1 : 0,
        normalizedName: externalPlayerId,
        candidateCanonicalIds: [],
        manualReviewRequired: !externalPlayerId.endsWith("w-1"),
        supportingMetadata: {},
        reason: "test",
      }),
    });
    assert.equal(result.fixtures.length, 0);
    assert.equal(result.quarantined, 1);
    assert.equal(result.canonicalMatches, 0);
  });

  it("maps both canonical IDs while retaining explicit importer provenance", async () => {
    const fixture = _rowToFixture(row(), "ATP");
    assert.ok(fixture);
    fixture.sourceFile = "atp/atp_matches_2024.csv";
    fixture.sourceUrl = _approvedSackmannSourceUrl("ATP", 2024);
    fixture.sourceLicense = APPROVED_SACKMANN_LICENSE;
    fixture.importProvenance = { importer: "approved-aneeshers-sackmann" };
    const result = await resolveApprovedSackmannFixtures([fixture], {
      resolve: async ({ externalPlayerId }) => ({
        source: "approved-aneeshers-sackmann",
        canonicalPlayerId: externalPlayerId.endsWith("w-1") ? "canonical-winner" : "canonical-loser",
        resolutionMethod: "provider-alias",
        confidence: 1,
        normalizedName: externalPlayerId,
        candidateCanonicalIds: [],
        manualReviewRequired: false,
        supportingMetadata: {},
        reason: null,
      }),
    });
    assert.equal(result.fixtures[0]?.canonicalPlayer1Id, "canonical-winner");
    assert.equal(result.fixtures[0]?.canonicalPlayer2Id, "canonical-loser");
    assert.equal(result.fixtures[0]?.winnerId, "canonical-winner");
    assert.equal(result.fixtures[0]?.sourceFile, "atp/atp_matches_2024.csv");
    assert.equal(result.fixtures[0]?.sourceLicense, APPROVED_SACKMANN_LICENSE);
  });
});