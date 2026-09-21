// Fixtures below are REAL Tesseract.js word bounding boxes, captured by
// running the actual OCR engine against the real "Truth Engine OCR
// Verification" reference PNGs (attached_assets/Truth_Engine_OCR_
// Verification_Page_1_1789878929364.png) -- not synthetic coordinates. They
// pin the exact real-world defect this module fixes: a real table row like
// "1 Lucie Havlickova Ekaterine Gorgodze Round of 16" comes back from
// Tesseract as ONE line (the OCR itself was accurate; only the physical
// line layout doesn't match what parseSummaryText expects), and this
// reconstruction is what turns it back into one cell per line before it
// reaches the parser.
import { describe, expect, it } from "vitest";
import { reconstructTableAwareText, type OcrLineBox } from "./ocr-table-reconstruction";

const REAL_TABLE_ROW: OcrLineBox = {
  text: "1 Lucie Havlickova Ekaterine Gorgodze Round of 16",
  words: [
    { text: "1", x0: 175, x1: 179 },
    { text: "Lucie", x0: 215, x1: 254 },
    { text: "Havlickova", x0: 260, x1: 341 },
    { text: "Ekaterine", x0: 539, x1: 609 },
    { text: "Gorgodze", x0: 615, x1: 688 },
    { text: "Round", x0: 863, x1: 911 },
    { text: "of", x0: 917, x1: 930 },
    { text: "16", x0: 937, x1: 954 },
  ],
};

const REAL_PROSE_HEADER: OcrLineBox = {
  text: "Clean match-reference sheet + No model outputs + No market data",
  words: [
    { text: "Clean", x0: 349, x1: 393 }, { text: "match-reference", x0: 401, x1: 530 },
    { text: "sheet", x0: 537, x1: 579 }, { text: "+", x0: 586, x1: 590 },
    { text: "No", x0: 598, x1: 618 }, { text: "model", x0: 625, x1: 672 },
    { text: "outputs", x0: 679, x1: 736 }, { text: "+", x0: 745, x1: 747 },
    { text: "No", x0: 755, x1: 775 }, { text: "market", x0: 783, x1: 836 },
    { text: "data", x0: 842, x1: 876 },
  ],
};

const REAL_PROSE_SUBTITLE: OcrLineBox = {
  text: "Clay + Round of 16 + Best of 3",
  words: [
    { text: "Clay", x0: 78, x1: 110 }, { text: "+", x0: 116, x1: 121 },
    { text: "Round", x0: 128, x1: 175 }, { text: "of", x0: 182, x1: 195 },
    { text: "16", x0: 202, x1: 218 }, { text: "+", x0: 224, x1: 229 },
    { text: "Best", x0: 236, x1: 268 }, { text: "of", x0: 274, x1: 300 },
    { text: "3", x0: 294, x1: 304 },
  ],
};

describe("reconstructTableAwareText", () => {
  it("splits a real packed table row into one cell per line (row#, player1, player2, round)", () => {
    const result = reconstructTableAwareText([REAL_PROSE_HEADER, REAL_PROSE_SUBTITLE, REAL_TABLE_ROW]);
    const lines = result.split("\n");
    expect(lines).toContain("1");
    expect(lines).toContain("Lucie Havlickova");
    expect(lines).toContain("Ekaterine Gorgodze");
    expect(lines).toContain("Round of 16");
    // The name cells must NOT still be glued to the row number or to each other.
    expect(lines).not.toContain("1 Lucie Havlickova Ekaterine Gorgodze Round of 16");
  });

  it("does NOT split ordinary prose lines that merely contain several normally-spaced words", () => {
    const result = reconstructTableAwareText([REAL_PROSE_HEADER, REAL_PROSE_SUBTITLE, REAL_TABLE_ROW]);
    const lines = result.split("\n");
    expect(lines).toContain("Clean match-reference sheet + No model outputs + No market data");
    expect(lines).toContain("Clay + Round of 16 + Best of 3");
  });

  it("passes real single-cell lines (a bare surface label) through unchanged", () => {
    const surfaceOnly: OcrLineBox = { text: "Clay", words: [{ text: "Clay", x0: 78, x1: 110 }] };
    const result = reconstructTableAwareText([REAL_PROSE_HEADER, surfaceOnly, REAL_TABLE_ROW]);
    expect(result.split("\n")).toContain("Clay");
  });

  it("falls back to a flat absolute threshold when a page has too few lines to establish its own gap baseline", () => {
    // Only ONE two-word line on the whole "page" -- not enough samples to compute a
    // reliable median, so the fixed fallback threshold applies. A normal single-space
    // gap (well under the fallback) must not be treated as a column break.
    const onlyLine: OcrLineBox = { text: "Rafael Nadal", words: [{ text: "Rafael", x0: 0, x1: 50 }, { text: "Nadal", x0: 58, x1: 100 }] };
    const result = reconstructTableAwareText([onlyLine]);
    expect(result).toBe("Rafael Nadal");
  });

  it("skips empty lines and lines with no words", () => {
    const empty: OcrLineBox = { text: "  ", words: [] };
    const result = reconstructTableAwareText([REAL_PROSE_HEADER, empty]);
    expect(result.split("\n")).toHaveLength(1);
  });
});
