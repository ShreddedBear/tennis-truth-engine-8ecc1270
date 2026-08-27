import { describe, expect, it } from "vitest";
import { canonicalKey, normalizeName, parseSummaryText } from "./summary-parser";

function fieldMap(fields: Array<{ field_key: string; normalized_value: string | null }>) {
  return Object.fromEntries(fields.map((f) => [f.field_key, f.normalized_value]));
}

describe("summary-parser", () => {
  it("extracts a matchup and its labelled fields from a plain-text page", () => {
    const page = [
      "Roman Andres Burruchaga vs Moise Kouame",
      "Tournament: US Open Qualifying",
      "Round: Q1",
      "Surface: Hard",
      "Predicted Winner: Roman Andres Burruchaga",
      "Win Probability: 56.7%",
    ].join("\n");
    const matchups = parseSummaryText([page]);
    expect(matchups).toHaveLength(1);
    expect(matchups[0].player1_name).toBe("Roman Andres Burruchaga");
    expect(matchups[0].player2_name).toBe("Moise Kouame");
    const flat = fieldMap(matchups[0].fields);
    expect(flat.matrix_predicted_winner).toBe("Roman Andres Burruchaga");
    expect(flat.matrix_wp).toBe("56.7");
    expect(flat.surface).toBe("Hard");
  });

  // Best-effort top-level scalar extraction for the OCR/text-layer path -- see the
  // header comment on FIELD_PATTERNS in summary-parser.ts. The dense per-module "Full
  // Engine Breakdown" content is vision-only and is not attempted here.
  it("best-effort extracts confidence/agreement labels and Monte Carlo scalars when printed as clean labelled text", () => {
    const page = [
      "Sebastian Baez vs Camilo Ugo Carabelli",
      "range 21-99",
      "HIGH CONFIDENCE",
      "STRONGLY AGREE",
      "Expected sets: 2.4",
      "Simulations: 10000",
    ].join("\n");
    const matchups = parseSummaryText([page]);
    const flat = fieldMap(matchups[0].fields);
    expect(flat.matrix_wp_range).toBe("21-99");
    expect(flat.matrix_confidence_label?.toLowerCase()).toBe("high confidence");
    expect(flat.matrix_agreement_label?.toLowerCase()).toBe("strongly agree");
    expect(flat.monte_carlo_expected_sets).toBe("2.4");
    expect(flat.monte_carlo_simulations).toBe("10000");
  });

  it("never fabricates a field that isn't present in the text", () => {
    const page = "Alice Alpha vs Bob Beta";
    const matchups = parseSummaryText([page]);
    const flat = fieldMap(matchups[0].fields);
    expect(flat.matrix_wp).toBeUndefined();
    expect(flat.matrix_confidence_label).toBeUndefined();
    expect(flat.monte_carlo_simulations).toBeUndefined();
  });

  it("does not synthesize a matchup from a page with no player-pair signal", () => {
    const page = "Tournament: US Open Qualifying\nSurface: Hard";
    expect(parseSummaryText([page])).toEqual([]);
  });

  it("canonicalKey ignores player order and is stable under accent/case differences", () => {
    const a = canonicalKey({ tournament: "US Open", round: "R32", date: "2026-08-27", p1: "Roman Andres Burruchaga", p2: "Moise Kouamé" });
    const b = canonicalKey({ tournament: "us open", round: "r32", date: "2026-08-27", p1: "moise kouame", p2: "Roman Andres Burruchaga" });
    expect(a).toBe(b);
  });

  it("normalizeName strips accents and punctuation", () => {
    expect(normalizeName("Moise Kouamé")).toBe("moise kouame");
  });
});
