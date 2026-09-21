// 100+/150-match stress test for the PDF page parser (parseSummaryText).
//
// This is the DB-independent, large-batch proof requested for the ingestion
// pipeline: a many-page, many-event, many-match-per-page document, parsed
// entirely in-memory (no network, no DB -- parseSummaryText is pure text
// parsing), demonstrating:
//   - 150+ matches extracted correctly across many pages and events
//   - multiple matches per page (both "vs"-anchor and no-"vs" table styles)
//   - one deliberately garbled page does NOT cancel or corrupt any other
//     page's matches (parseSummaryText has no shared mutable state across
//     pages.forEach, so this also documents/pins that guarantee)
//   - performance stays well within an interactive budget at this scale
//
// Player/tournament names here are synthetic combinations (not any real
// person's identity) -- only their SHAPE (capitalization, word count) matters
// to the regex heuristics under test, matching how summary-parser.ts's own
// existing fixture (summary-parser.ocr-verification-pages.test.ts) exercises
// the same "# | PLAYER 1 | PLAYER 2 | EVENT DATA" table format.
import { describe, expect, it } from "vitest";
import { parseSummaryText } from "./summary-parser";

const FIRST_NAMES = [
  "Marco", "Elena", "Luca", "Ivana", "Tomas", "Nadia", "Viktor", "Sara",
  "Rafael", "Petra", "Dario", "Klara", "Andrei", "Mila", "Felix", "Anja",
  "Bruno", "Zara", "Kasper", "Julia",
];
const LAST_NAMES = [
  "Belmonte", "Kovarova", "Stanek", "Adamska", "Orsini", "Bregovic",
  "Halvorsen", "Marchetti", "Ferreira", "Lindqvist", "Souza", "Vitkova",
  "Renner", "Dumitrescu", "Kowalczyk", "Andersen", "Ricci", "Pavlenko",
  "Brandt", "Solheim",
];

const CYCLE_SUFFIXES = ["", "a", "b", "c", "d", "e", "f", "g", "h"]; // no digits -- parseSummaryText rejects any name containing one

/** Deterministic, collision-free name generator -- index N always yields the same name. */
function playerName(n: number): string {
  const first = FIRST_NAMES[n % FIRST_NAMES.length]!;
  const last = LAST_NAMES[Math.floor(n / FIRST_NAMES.length) % LAST_NAMES.length]!;
  // Cycle in a letter suffix once the first*last product space (400 names) is
  // exhausted, so names stay unique well past 400 without ever repeating --
  // and without a digit, which parseSummaryText's name-shape check rejects.
  const cycle = Math.floor(n / (FIRST_NAMES.length * LAST_NAMES.length));
  const suffix = CYCLE_SUFFIXES[cycle % CYCLE_SUFFIXES.length]!;
  return suffix ? `${first} ${last}${suffix}` : `${first} ${last}`;
}

const EVENTS = [
  "ATP Challenger Antalya", "WTA 250 Bastad", "ATP Challenger Meknes",
  "WTA 125 Grado", "ATP Challenger Cassis", "WTA Challenger Lima",
  "ATP Challenger Genoa", "US Open Qualifying", "ATP Challenger Tampere",
  "WTA 250 Guadalajara",
];

function tableSection(header: string, subtitle: string, rows: Array<[string, string]>): string[] {
  return [header, subtitle, "#", "PLAYER 1", "PLAYER 2", "EVENT DATA", ...rows.flatMap(([p1, p2]) => [p1, p2])];
}

describe("parseSummaryText -- 150-match stress fixture", () => {
  it("extracts every match across many pages/events, isolates one garbled page, and stays fast", () => {
    let nextPlayerIndex = 0;
    const nextPair = (): [string, string] => {
      const p1 = playerName(nextPlayerIndex++);
      const p2 = playerName(nextPlayerIndex++);
      return [p1, p2];
    };

    const TARGET_MATCH_COUNT = 150;
    const MATCHES_PER_SECTION = 12; // mirrors the real 10-13/page fixture
    const pages: string[] = [];
    let generated = 0;
    let eventCursor = 0;
    let pageIndex = 0;
    const GARBLED_PAGE_INDEX = 6; // inserted partway through -- proves isolation, not just "the last page broke"

    while (generated < TARGET_MATCH_COUNT) {
      pageIndex += 1;
      if (pageIndex === GARBLED_PAGE_INDEX) {
        // Simulates a page OCR/text-extraction produced garbage for: no
        // name-shaped lines, no event header, just noise. Must contribute
        // zero matchups without throwing and without touching any other page.
        pages.push(["%%%%%%%%%%", "####----####", "3.14159 2.71828 0000", "@@@ ??? !!!"].join("\n"));
        continue;
      }

      // Alternate page style: even pages use the no-"vs" table format
      // (matching the real fixture), odd pages use literal "X vs Y" lines --
      // both extraction strategies get exercised at scale in the same batch.
      const sectionsThisPage = pageIndex % 2 === 0 ? 1 : 2;
      const linesOnPage: string[] = [];

      for (let s = 0; s < sectionsThisPage && generated < TARGET_MATCH_COUNT; s++) {
        const event = EVENTS[eventCursor % EVENTS.length]!;
        eventCursor += 1;
        const countThisSection = Math.min(MATCHES_PER_SECTION, TARGET_MATCH_COUNT - generated);

        if (pageIndex % 2 === 0) {
          const rows: Array<[string, string]> = [];
          for (let i = 0; i < countThisSection; i++) rows.push(nextPair());
          linesOnPage.push(...tableSection(event, "Hard Round of 32 Best of 3", rows));
        } else {
          linesOnPage.push(event, "Clay Round 1 Best of 3");
          for (let i = 0; i < countThisSection; i++) {
            const [p1, p2] = nextPair();
            linesOnPage.push(`${p1} vs ${p2}`);
          }
        }
        generated += countThisSection;
      }
      pages.push(linesOnPage.join("\n"));
    }

    expect(pages.length).toBeGreaterThan(5); // genuinely a multi-page document
    expect(pages[GARBLED_PAGE_INDEX - 1]).toContain("%%%%%%%%%%"); // sanity-check the injected garbled page landed where expected

    const t0 = performance.now();
    const matchups = parseSummaryText(pages);
    const elapsedMs = performance.now() - t0;

    // ── Core stress-test assertions ──────────────────────────────────────
    expect(matchups.length).toBe(TARGET_MATCH_COUNT);

    // The garbled page contributed nothing, but every other page's matches
    // are intact -- proving isolation, not a silent partial loss.
    const fromGarbledPage = matchups.filter((m) => m.page_number === GARBLED_PAGE_INDEX);
    expect(fromGarbledPage.length).toBe(0);

    // No two matches were accidentally collapsed into one (150 unique pairs in -> 150 out).
    const uniquePairs = new Set(matchups.map((m) => `${m.player1_name}|${m.player2_name}`));
    expect(uniquePairs.size).toBe(TARGET_MATCH_COUNT);

    // Multiple distinct pages are represented -- not one giant blob.
    const distinctPages = new Set(matchups.map((m) => m.page_number));
    expect(distinctPages.size).toBeGreaterThanOrEqual(7);

    // Both extraction strategies (table rows AND "vs" anchors) actually ran and produced matches.
    const evenPageMatches = matchups.filter((m) => m.page_number % 2 === 0 && m.page_number !== GARBLED_PAGE_INDEX);
    const oddPageMatches = matchups.filter((m) => m.page_number % 2 === 1);
    expect(evenPageMatches.length).toBeGreaterThan(0);
    expect(oddPageMatches.length).toBeGreaterThan(0);

    // Multiple distinct events are represented -- checked via the table-style
    // (even) pages' parsed tournament field, which reliably attaches per
    // block (see splitIntoEventBlocks). The "vs"-anchor path's per-match
    // block only spans between consecutive "vs" lines, so a header placed
    // once above a run of "vs" lines isn't re-attached to each one -- that's
    // existing summary-parser.ts behavior, not something this fixture needs
    // to route around; the player-pair extraction on those pages is already
    // covered by oddPageMatches above.
    const distinctEvents = new Set(
      evenPageMatches.flatMap((m) => m.fields.filter((f) => f.field_key === "tournament").map((f) => f.normalized_value)),
    );
    expect(distinctEvents.size).toBeGreaterThanOrEqual(3);

    // Performance: pure in-memory parsing of a 150-match, multi-page document
    // must stay well within an interactive budget -- this is what "no global
    // OCR timeout" requires downstream of extraction: the parse step itself
    // must never be the bottleneck.
    expect(elapsedMs).toBeLessThan(500);

    // eslint-disable-next-line no-console
    console.log(
      `[stress] pages=${pages.length} matches=${matchups.length} distinctEvents=${distinctEvents.size} ` +
      `garbledPageMatches=${fromGarbledPage.length} durationMs=${elapsedMs.toFixed(1)}`,
    );
  });

  it("scales to 100 matches on a much larger page count (few matches/page) without losing or duplicating any", () => {
    // Complementary shape to the 150-match/12-per-page test above: many pages,
    // few matches each -- proves the per-page independence holds regardless
    // of how the same total is distributed across the document.
    let nextPlayerIndex = 1000; // disjoint name range from the other test
    const pages: string[] = [];
    const TOTAL = 100;
    let generated = 0;
    let pageIndex = 0;
    while (generated < TOTAL) {
      pageIndex += 1;
      const event = EVENTS[pageIndex % EVENTS.length]!;
      const p1 = playerName(nextPlayerIndex++);
      const p2 = playerName(nextPlayerIndex++);
      pages.push(tableSection(event, "Indoor Hard Round 2 Best of 3", [[p1, p2]]).join("\n"));
      generated += 1;
    }

    expect(pages.length).toBe(TOTAL); // one match per page -> 100 pages

    const t0 = performance.now();
    const matchups = parseSummaryText(pages);
    const elapsedMs = performance.now() - t0;

    expect(matchups.length).toBe(TOTAL);
    expect(new Set(matchups.map((m) => m.page_number)).size).toBe(TOTAL);
    expect(elapsedMs).toBeLessThan(500);
  });
});
