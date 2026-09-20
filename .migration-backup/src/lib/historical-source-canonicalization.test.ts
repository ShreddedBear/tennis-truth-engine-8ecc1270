import { describe, expect, it } from "vitest";
import { CanonicalMatchRegistry, type CandidateHistoricalMatch } from "./historical-source-canonicalization";

function match(overrides: Partial<CandidateHistoricalMatch> = {}): CandidateHistoricalMatch {
  return {
    sourceId: "source-a",
    sourceRef: "ref-1",
    player1Name: "Alpha Player",
    player2Name: "Beta Player",
    winnerName: "Alpha Player",
    tournament: "Example Open",
    date: "2018-03-14",
    round: "QF",
    tour: "ATP",
    eventLevel: "ATP 250",
    score: "6-4 6-3",
    ...overrides,
  };
}

describe("CanonicalMatchRegistry", () => {
  it("accepts a brand-new match as NEW and lists it as canonical", () => {
    const registry = new CanonicalMatchRegistry();
    const resolution = registry.process(match());
    expect(resolution.status).toBe("NEW");
    expect(registry.size).toBe(1);
    expect(registry.list()[0].primarySource).toEqual({ sourceId: "source-a", sourceRef: "ref-1" });
  });

  it("detects an exact duplicate from a second provider and corroborates instead of duplicating", () => {
    const registry = new CanonicalMatchRegistry();
    registry.process(match({ sourceId: "provider-1", sourceRef: "p1-001" }));
    const resolution = registry.process(match({ sourceId: "provider-2", sourceRef: "p2-999" }));

    expect(resolution.status).toBe("DUPLICATE");
    expect(registry.size).toBe(1); // no second canonical row
    const canonical = registry.list()[0];
    expect(canonical.corroboratingSources).toEqual([{ sourceId: "provider-2", sourceRef: "p2-999" }]);
  });

  it("dedupes across player-order, diacritics, casing, and tournament/round formatting differences", () => {
    const registry = new CanonicalMatchRegistry();
    registry.process(
      match({
        sourceId: "predixsport",
        sourceRef: "px-1",
        player1Name: "alpha player",
        player2Name: "beta player",
        winnerName: "alpha player",
        tournament: "example open",
        round: "Quarterfinal",
      }),
    );
    const resolution = registry.process(
      match({
        sourceId: "datahub",
        sourceRef: "dh-1",
        player1Name: "Beta Player", // reversed order
        player2Name: "Álpha Pláyer", // diacritics
        winnerName: "Álpha Pláyer",
        tournament: "2018 Example Open presented by Sponsor",
        round: "QF",
      }),
    );
    expect(resolution.status).toBe("DUPLICATE");
    expect(registry.size).toBe(1);
  });

  it("is idempotent: processing the identical candidate repeatedly never grows the registry", () => {
    const registry = new CanonicalMatchRegistry();
    const candidate = match();
    registry.process(candidate);
    registry.process(candidate);
    const third = registry.process(candidate);
    expect(registry.size).toBe(1);
    expect(third.status).toBe("DUPLICATE");
    // Re-processing the exact same (sourceId, sourceRef) that established the match must not
    // add it to its own corroboration list.
    expect(registry.list()[0].corroboratingSources).toEqual([]);
  });

  it("treats a genuinely different match (different date) as NEW, not a duplicate", () => {
    const registry = new CanonicalMatchRegistry();
    registry.process(match({ date: "2018-03-14" }));
    const resolution = registry.process(match({ sourceId: "source-b", sourceRef: "ref-2", date: "2019-03-14" }));
    expect(resolution.status).toBe("NEW");
    expect(registry.size).toBe(2);
  });

  it("treats a genuinely different match (different opponent) as NEW", () => {
    const registry = new CanonicalMatchRegistry();
    registry.process(match());
    const resolution = registry.process(match({ sourceId: "source-b", sourceRef: "ref-2", player2Name: "Gamma Player", winnerName: "Alpha Player" }));
    expect(resolution.status).toBe("NEW");
    expect(registry.size).toBe(2);
  });

  it("accepts a same-day reporting-lag date (within 1-day tolerance) as the same match", () => {
    const registry = new CanonicalMatchRegistry();
    registry.process(match({ date: "2018-03-14" }));
    const resolution = registry.process(match({ sourceId: "source-b", sourceRef: "ref-2", date: "2018-03-15T00:20:00Z" }));
    expect(resolution.status).toBe("DUPLICATE");
    expect(registry.size).toBe(1);
  });

  it("flags a winner disagreement as CONFLICT and never overwrites the canonical value", () => {
    const registry = new CanonicalMatchRegistry();
    registry.process(match({ winnerName: "Alpha Player" }));
    const resolution = registry.process(match({ sourceId: "source-b", sourceRef: "ref-2", winnerName: "Beta Player" }));
    expect(resolution.status).toBe("CONFLICT");
    if (resolution.status === "CONFLICT") {
      expect(resolution.canonicalWinner).toBe("Alpha Player");
      expect(resolution.incomingWinner).toBe("Beta Player");
    }
    expect(registry.size).toBe(1);
    expect(registry.list()[0].winnerName).toBe("Alpha Player"); // untouched
  });

  it("quarantines instead of guessing when the date is missing", () => {
    const registry = new CanonicalMatchRegistry();
    const resolution = registry.process(match({ date: null as unknown as string }));
    expect(resolution.status).toBe("AMBIGUOUS");
    if (resolution.status === "AMBIGUOUS") expect(resolution.reason).toBe("MISSING_DATE");
    expect(registry.size).toBe(0);
  });

  it("quarantines instead of guessing when player identity is missing or degenerate", () => {
    const registry = new CanonicalMatchRegistry();
    const resolution = registry.process(match({ player1Name: "", player2Name: "" }));
    expect(resolution.status).toBe("AMBIGUOUS");
    if (resolution.status === "AMBIGUOUS") expect(resolution.reason).toBe("MISSING_OR_DUPLICATE_PLAYER_IDENTITY");
    expect(registry.size).toBe(0);
  });

  it("quarantines instead of guessing when the tour family cannot be classified", () => {
    const registry = new CanonicalMatchRegistry();
    const resolution = registry.process(match({ tour: "", eventLevel: "", tournament: "Example Open" }));
    expect(resolution.status).toBe("AMBIGUOUS");
    if (resolution.status === "AMBIGUOUS") expect(resolution.reason).toBe("MISSING_TOUR_FAMILY");
    expect(registry.size).toBe(0);
  });

  it("quarantines a same-players/same-date/different-tournament collision instead of guessing either way", () => {
    const registry = new CanonicalMatchRegistry();
    registry.process(match({ tournament: "brisbane", date: "2018-01-04" }));
    // Same two players, same day, but the tournament string is a completely different token
    // after normalization (a slug vs. a full descriptive name) -- must not be silently treated
    // as the same match (risk of wrongly corroborating two different matches) or silently
    // treated as a new match (risk of a real duplicate slipping through).
    const resolution = registry.process(
      match({ sourceId: "source-b", sourceRef: "ref-2", tournament: "Queens Club Championships", date: "2018-01-04" }),
    );
    expect(resolution.status).toBe("AMBIGUOUS");
    if (resolution.status === "AMBIGUOUS") expect(resolution.reason).toBe("SAME_PLAYERS_SAME_DATE_TOURNAMENT_MISMATCH");
    expect(registry.size).toBe(1); // the original match, unaffected
  });

  it("quarantines when more than one already-canonical match is compatible with the candidate", () => {
    const registry = new CanonicalMatchRegistry();
    // Two genuinely distinct matches between the same pair, no tournament recorded on either
    // side, two days apart -- far enough apart that they do NOT dedupe against each other (so
    // both become their own canonical match), but each individually within the 1-day tolerance
    // of a third, under-specified incoming record. That candidate is then compatible with both,
    // so neither can be safely chosen.
    registry.process(match({ sourceId: "s1", sourceRef: "r1", tournament: null, date: "2018-03-13" }));
    const second = registry.process(match({ sourceId: "s2", sourceRef: "r2", tournament: null, date: "2018-03-15" }));
    expect(second.status).toBe("NEW"); // confirms the two seed matches are genuinely distinct
    expect(registry.size).toBe(2);

    const resolution = registry.process(match({ sourceId: "s3", sourceRef: "r3", tournament: null, date: "2018-03-14" }));
    expect(resolution.status).toBe("AMBIGUOUS");
    if (resolution.status === "AMBIGUOUS") expect(resolution.reason).toBe("MULTIPLE_COMPATIBLE_CANONICAL_MATCHES");
    expect(registry.size).toBe(2); // unaffected -- nothing committed for an ambiguous candidate
  });

  it("realistic fixture: PredixSport-shaped and DataHub-shaped rows for the same 2016 ATP match corroborate as one canonical match", () => {
    const registry = new CanonicalMatchRegistry();

    // Shaped like a normalized PredixSport atp_elo_matches.csv row (slug tournament, lowercase
    // player names, no round field -- round omitted entirely, as the real source has none).
    const predixSportRow: CandidateHistoricalMatch = {
      sourceId: "predixsport-atp",
      sourceRef: "predixsport:2016-03-20:novato challenger:player one",
      player1Name: "player one",
      player2Name: "player two",
      winnerName: "player one",
      tournament: "novato challenger",
      date: "2016-03-20",
      round: null,
      tour: "ATP",
      eventLevel: "ATP 250",
    };

    // Shaped like a normalized DataHub match_scores row (full tournament name, round name
    // present, mixed-case display names).
    const dataHubRow: CandidateHistoricalMatch = {
      sourceId: "datahub-atp",
      sourceRef: "2016-9999-w111-l222",
      player1Name: "Player Two",
      player2Name: "Player One",
      winnerName: "Player One",
      tournament: "2016 Novato Challenger",
      date: "2016-03-20",
      round: "Quarterfinals",
      tour: "ATP",
      eventLevel: "ATP 250",
    };

    const first = registry.process(predixSportRow);
    const second = registry.process(dataHubRow);

    expect(first.status).toBe("NEW");
    expect(second.status).toBe("DUPLICATE");
    expect(registry.size).toBe(1);
    expect(registry.list()[0].corroboratingSources).toEqual([
      { sourceId: "datahub-atp", sourceRef: "2016-9999-w111-l222" },
    ]);
  });
});
