import { describe, expect, it } from "vitest";
import { matrixInputsFromParsedFields } from "./calibration-matrix-autofill";

const match = { player1_name: "Sebastian Baez", player2_name: "Camilo Ugo Carabelli", tournament_name: "Buenos Aires", surface: "Clay", scheduled_date: "2026-08-27" };

describe("calibration-matrix-autofill", () => {
  it("builds a match label and carries tournament/surface/date straight from the match row", () => {
    const result = matrixInputsFromParsedFields([], match);
    expect(result.matchLabel).toBe("Sebastian Baez vs Camilo Ugo Carabelli");
    expect(result.tournament).toBe("Buenos Aires");
    expect(result.surface).toBe("Clay");
    expect(result.matchDate).toBe("2026-08-27");
    expect(result.matrixPredictedWinner).toBeNull();
    expect(result.matrixWp).toBeNull();
  });

  it("pulls matrix_predicted_winner and matrix_wp from parsed fields, numeric-coerced", () => {
    const result = matrixInputsFromParsedFields(
      [
        { field_key: "matrix_predicted_winner", normalized_value: "Sebastian Baez" },
        { field_key: "matrix_wp", normalized_value: "63.9" },
        { field_key: "matrix_elo", normalized_value: "71/29" }, // unrelated prediction field, ignored here
      ],
      match,
    );
    expect(result.matrixPredictedWinner).toBe("Sebastian Baez");
    expect(result.matrixWp).toBe(63.9);
  });

  it("never fabricates a numeric matrix_wp from a missing or malformed value", () => {
    expect(matrixInputsFromParsedFields([{ field_key: "matrix_wp", normalized_value: null }], match).matrixWp).toBeNull();
    expect(matrixInputsFromParsedFields([{ field_key: "matrix_wp", normalized_value: "" }], match).matrixWp).toBeNull();
    expect(matrixInputsFromParsedFields([{ field_key: "matrix_wp", normalized_value: "not a number" }], match).matrixWp).toBeNull();
  });

  it("only ever supplies prediction-side fields -- never an actual-winner or result-type field, by construction", () => {
    const result = matrixInputsFromParsedFields([{ field_key: "matrix_predicted_winner", normalized_value: "Sebastian Baez" }], match);
    expect(Object.keys(result).sort()).toEqual(["matchDate", "matchLabel", "matrixPredictedWinner", "matrixWp", "surface", "tournament"].sort());
    expect(result).not.toHaveProperty("actualWinner");
    expect(result).not.toHaveProperty("resultType");
  });
});
