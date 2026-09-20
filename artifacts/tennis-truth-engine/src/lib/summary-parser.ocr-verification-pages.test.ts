import { describe, expect, it } from "vitest";
import { parseSummaryText } from "./summary-parser";

// Permanent regression fixture: the real 4-page "Truth Engine — OCR
// Verification" reference sheet the user uploaded (44 total matches across
// tournament tables — see attached_assets/Truth_Engine_OCR_Verification_Page_{1..4}_*.png,
// transcribed by directly reading the source images). Each page is a plain
// data table: "# | PLAYER 1 | PLAYER 2 | EVENT DATA" header, then one row
// per match with each player's name in its own cell and the surface/round/
// best-of stacked in a third cell — there is no "vs"/"v."/"versus" text
// anywhere on any of the four pages.
//
// Before the ingestion-pipeline fix, `parseSummaryText`'s no-"vs" fallback
// (`inferPairWithoutVs`) returned only the FIRST name pair found on an
// entire page and silently discarded every other row — on these table pages
// that meant at most 1 of 10-13 matches survived per page, with no error,
// warning, or trace of the other 9-12. This suite pins the real 44-match
// count end to end and is the fixture referenced by the ingestion audit.
function lines(...ls: string[]) {
  return ls.join("\n");
}

// Row-major OCR text: for each table row, the two name cells surface as two
// consecutive name-shaped lines (their shared row's "EVENT DATA" cell text --
// surface / round / best-of -- always carries a digit, e.g. "Round of 16",
// "Best of 3", "Round of 32", so it is excluded by the parser's own
// digit-rejection rule and intentionally left out of these fixtures, exactly
// as it would be for real OCR/vision output of this table).
function tableSection(header: string, subtitle: string, rows: Array<[string, string]>) {
  return [
    header,
    subtitle,
    "#",
    "PLAYER 1",
    "PLAYER 2",
    "EVENT DATA",
    ...rows.flatMap(([p1, p2]) => [p1, p2]),
  ];
}

const PAGE_1 = lines(
  "TRUTH ENGINE — OCR VERIFICATION",
  "Clean match-reference sheet • No model outputs • No market data",
  ...tableSection("WTA 125K Ljubljana", "Clay Round of 16 Best of 3", [
    ["Lucie Havlickova", "Ekaterine Gorgodze"],
    ["Francesca Jones", "Mona Barthel"],
    ["Laura Samson", "Weronika Falkowska"],
    ["Anastasiia Sobolieva", "Denisa Zoldakova"],
    ["Noemi Basiletti", "Julie Struplova"],
    ["Barbora Palicova", "Samira de Stefano"],
  ]),
  ...tableSection("ATP Challenger Rennes", "Indoor Hard Round 1 Best of 3", [
    ["Daniel Rincon", "Hamish Stewart"],
    ["Tristan Schoolkate", "Marek Gengel"],
    ["Max Schoenhaus", "Matteo Martineau"],
    ["Francesco Maestrelli", "Arthur Nagel"],
  ]),
  "Truth Engine OCR Verification — Page 1",
);

const PAGE_2 = lines(
  ...tableSection("ATP Challenger Biella", "Clay Round of 16 Best of 3", [
    ["Alejandro Moro Canas", "Pavel Lagutin"],
    ["Felix Gill", "Gerard Campana Lee"],
    ["Jay Clarke", "Petr Bruncik"],
  ]),
  ...tableSection("ATP Challenger Guangzhou", "Hard Round of 32 Best of 3", [
    ["Lloyd Harris", "Marat Sharipov"],
    ["Elias Ymer", "Luca Castelnuovo"],
    ["Rio Noguchi", "Colin Sinclair"],
    ["Pavel Kotov", "Akira Santillan"],
    ["Nikoloz Basilashvili", "Naoya Honda"],
    ["Sergey Fomin", "Mitsuki Wei Kang Leong"],
    ["Federico Cina", "James Kent Trotter"],
  ]),
  "Truth Engine OCR Verification — Page 2",
);

const PAGE_3 = lines(
  ...tableSection("WTA Guadalajara", "Hard Round of 16 Best of 3", [
    ["Marta Kostyuk", "Taylor Townsend"],
    ["Liudmila Samsonova", "Kayla Day"],
    ["Magdalena Frech", "Caroline Dolehide"],
    ["Iva Jovic", "Zeynep Sonmez"],
    ["Diane Parry", "Peyton Stearns"],
    ["Janice Tjen", "Sloane Stephens"],
  ]),
  ...tableSection("ATP Challenger Phan Thiet 4", "Hard Round of 32 Best of 3", [
    ["Matthew Dellavedova", "Enzo Aguiard"],
    ["Luka Pavlovic", "Hunter Heck"],
    ["Rodrigo Pacheco Mendez", "Arthur Weber"],
    ["Kenta Miyoshi", "Philip Sekulic"],
    ["Derepasko / Lomakin", "Matsuda / Sharma"],
  ]),
  "Truth Engine OCR Verification — Page 3",
);

const PAGE_4 = lines(
  ...tableSection("ATP Challenger Tiburon", "Hard Round of 32 Best of 3", [
    ["Darwin Blanch", "Stefan Kozlov"],
    ["Michael Zheng", "Evan Zhu"],
    ["Sebastian Gorzny", "Luca Staeheli"],
  ]),
  ...tableSection("WTA Sao Paulo", "Hard Round of 32 Best of 3", [
    ["Teodora Kostovic", "Darja Semenistaja"],
    ["Vendula Valdmannova", "Laura Pigossi"],
    ["Claire Liu", "Mary Stoiana"],
    ["Anna Blinkova", "Carol Young Suh Lee"],
    ["Astra Sharma", "Nauhany Vitoria Leme Da Silva"],
    ["Jessica Bouzas Maneiro", "Dominika Salkova"],
    ["Kaitlin Quevedo", "Whitney Osuigwe"],
    ["Suzan Lamens", "Carolina Alves"],
    ["Jazmin Ortenzi", "Chloe Paquet"],
    ["Paula Badosa", "Justina Mikulskyte"],
  ]),
  "Truth Engine OCR Verification — Page 4",
);

describe("summary-parser OCR verification page fixture (44-match regression)", () => {
  it("extracts all 10 matches from page 1 (WTA 125K Ljubljana + ATP Challenger Rennes)", () => {
    const matchups = parseSummaryText([PAGE_1]);
    expect(matchups).toHaveLength(10);
    expect(matchups.map((m) => `${m.player1_name} vs ${m.player2_name}`)).toContain(
      "Francesco Maestrelli vs Arthur Nagel",
    );
  });

  it("extracts all 10 matches from page 2 (ATP Challenger Biella + ATP Challenger Guangzhou) -- the page the previous parser lost worst", () => {
    const matchups = parseSummaryText([PAGE_2]);
    expect(matchups).toHaveLength(10);
    expect(matchups.map((m) => `${m.player1_name} vs ${m.player2_name}`)).toContain(
      "Federico Cina vs James Kent Trotter",
    );
  });

  it("extracts all 11 matches from page 3 (WTA Guadalajara + ATP Challenger Phan Thiet 4), including the doubles row with all 4 players preserved", () => {
    const matchups = parseSummaryText([PAGE_3]);
    expect(matchups).toHaveLength(11);
    const doubles = matchups.find((m) => m.player1_name.includes("/"));
    expect(doubles).toBeDefined();
    expect(doubles?.player1_name).toBe("Derepasko/Lomakin");
    expect(doubles?.player2_name).toBe("Matsuda/Sharma");
  });

  it("extracts all 13 matches from page 4 (ATP Challenger Tiburon + WTA Sao Paulo)", () => {
    const matchups = parseSummaryText([PAGE_4]);
    expect(matchups).toHaveLength(13);
    expect(matchups.map((m) => `${m.player1_name} vs ${m.player2_name}`)).toContain(
      "Paula Badosa vs Justina Mikulskyte",
    );
  });

  it("preserves every one of the 44 real source matches across all four pages with zero silent loss", () => {
    const matchups = parseSummaryText([PAGE_1, PAGE_2, PAGE_3, PAGE_4]);
    expect(matchups).toHaveLength(44);
    // Every matchup must carry a non-empty player1_name; player2_name may
    // legitimately be empty only for an explicitly-flagged PARTIAL/orphan
    // row (none expected in this clean fixture), never silently dropped.
    for (const m of matchups) {
      expect(m.player1_name.length).toBeGreaterThan(0);
      expect(m.player2_name.length).toBeGreaterThan(0);
    }
    // Tournament field correctly scoped per section even when two
    // tournaments share one page.
    const rennes = matchups.find((m) => m.player1_name === "Francesco Maestrelli");
    const tournament = rennes?.fields.find((f) => f.field_key === "tournament")?.normalized_value;
    expect(tournament).toBe("ATP Challenger Rennes");
    const ljubljana = matchups.find((m) => m.player1_name === "Lucie Havlickova");
    const ljubljanaTournament = ljubljana?.fields.find((f) => f.field_key === "tournament")?.normalized_value;
    expect(ljubljanaTournament).toBe("WTA 125K Ljubljana");
  });

  it("never silently drops a page's leftover unpaired name -- surfaces it as a PARTIAL matchup instead", () => {
    const page = lines(
      ...tableSection("ATP Challenger Roehampton", "Hard Round 1 Best of 3", [["Oliver Tarvet", "Emile Hudd"]]),
      "Stray Extra Name",
    );
    const matchups = parseSummaryText([page]);
    const orphan = matchups.find((m) => m.player1_name === "Stray Extra Name");
    expect(orphan).toBeDefined();
    expect(orphan?.player2_name).toBe("");
    expect(orphan?.fields.some((f) => f.field_key === "__unpaired_name_warning")).toBe(true);
  });
});
