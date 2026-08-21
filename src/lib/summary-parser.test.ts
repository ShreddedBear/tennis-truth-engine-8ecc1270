import { describe, expect, it } from "vitest";
import { parseSummaryText } from "./summary-parser";

describe("summary PDF matchup parsing", () => {
  it("recovers a matchup split across positioned text boxes", () => {
    const [match] = parseSummaryText(["Arthur Fils\nvs\nThiago Tirante\nSurface: Clay"]);
    expect(match?.player1_name).toBe("Arthur Fils");
    expect(match?.player2_name).toBe("Thiago Tirante");
  });

  it("recovers labelled player fields", () => {
    const [match] = parseSummaryText(["Player 1: Arthur Fils\nPlayer 2: Thiago Tirante"]);
    expect(match?.player1_name).toBe("Arthur Fils");
    expect(match?.player2_name).toBe("Thiago Tirante");
  });
});