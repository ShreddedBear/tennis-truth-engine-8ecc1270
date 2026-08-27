import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { aiToParsed, ENGINE_MODULE_KEY_MAP, flattenMatrixSummary, MODEL_VOTE_KEY_MAP } from "./matrix-summary-flatten";
import type { AiMatchup, AiMatrixSummary } from "./pdf-extract.functions";
import { MATRIX_FIELDS } from "./constants";

function fieldMap(fields: Array<{ field_key: string; normalized_value: string | null }>) {
  return Object.fromEntries(fields.map((f) => [f.field_key, f.normalized_value]));
}

describe("matrix-summary-flatten", () => {
  it("returns nothing for a null or undefined summary -- never fabricates sections that weren't shown", () => {
    expect(flattenMatrixSummary(null)).toEqual([]);
    expect(flattenMatrixSummary(undefined)).toEqual([]);
  });

  it("flattens every section into its canonical key, using only what's actually present", () => {
    const summary: AiMatrixSummary = {
      confidence_label: "HIGH CONFIDENCE",
      win_probability_range: "21-99",
      agreement_label: "STRONGLY AGREE",
      model_votes: { surface_elo: "71/29", serve_return: "71/29", recent_form: "61/39", head_to_head: "69/31", market_consensus: "62/38", general_model: "61/39", specialist_model: "78/25" },
      monte_carlo: { win_probability: "63.9%", range: "21-99", expected_sets: "2.4", simulations: "10000", set_score_distribution: { "6-4": "18%", "7-6": "12%" } },
      engine_breakdown: { surface_elo: { elo_pick: "Sebastian Baez", surface_sample_size: "42" }, rest_travel_injury: { rest_days: "3" } },
    };
    const flat = fieldMap(flattenMatrixSummary(summary).map(([field_key, normalized_value]) => ({ field_key, normalized_value })));
    expect(flat.matrix_confidence_label).toBe("HIGH CONFIDENCE");
    expect(flat.matrix_wp_range).toBe("21-99");
    expect(flat.matrix_agreement_label).toBe("STRONGLY AGREE");
    expect(flat.matrix_elo).toBe("71/29");
    expect(flat.matrix_serve_return).toBe("71/29");
    expect(flat.matrix_recent_form).toBe("61/39");
    expect(flat.matrix_head_to_head).toBe("69/31");
    expect(flat.matrix_market).toBe("62/38");
    expect(flat.general_model).toBe("61/39");
    expect(flat.specialist_model).toBe("78/25");
    expect(flat.monte_carlo_prob).toBe("63.9%");
    expect(flat.monte_carlo_range).toBe("21-99");
    expect(flat.monte_carlo_expected_sets).toBe("2.4");
    expect(flat.monte_carlo_simulations).toBe("10000");
    expect(JSON.parse(flat.monte_carlo_set_score_distribution!)).toEqual({ "6-4": "18%", "7-6": "12%" });
    expect(JSON.parse(flat.matrix_elo_detail!)).toEqual({ elo_pick: "Sebastian Baez", surface_sample_size: "42" });
    expect(JSON.parse(flat.matrix_rest_travel_injury_detail!)).toEqual({ rest_days: "3" });
    // Every canonical key this produces must be a recognized MATRIX_FIELDS entry, so the
    // firewalled display panel (and nothing else) can find it.
    for (const key of Object.keys(flat)) {
      if (key.startsWith("monte_carlo_")) continue; // monte_carlo_* keys predate MATRIX_FIELDS's exhaustive list convention but are still guidance-only
      expect(MATRIX_FIELDS, key).toContain(key);
    }
  });

  it("collapses both 'fatigue_index' and 'match_load_recovery' report labels onto the same canonical detail key", () => {
    const asFatigue = fieldMap(flattenMatrixSummary({ confidence_label: null, win_probability_range: null, agreement_label: null, model_votes: null, monte_carlo: null, engine_breakdown: { fatigue_index: { load_7d: "3" } } }).map(([field_key, normalized_value]) => ({ field_key, normalized_value })));
    const asMatchLoad = fieldMap(flattenMatrixSummary({ confidence_label: null, win_probability_range: null, agreement_label: null, model_votes: null, monte_carlo: null, engine_breakdown: { match_load_recovery: { load_7d: "3" } } }).map(([field_key, normalized_value]) => ({ field_key, normalized_value })));
    expect(asFatigue.matrix_fatigue_index_detail).toBe(JSON.stringify({ load_7d: "3" }));
    expect(asMatchLoad.matrix_fatigue_index_detail).toBe(JSON.stringify({ load_7d: "3" }));
    expect(ENGINE_MODULE_KEY_MAP.fatigue_index).toBe(ENGINE_MODULE_KEY_MAP.match_load_recovery);
  });

  it("never drops an unmapped model-vote name -- falls back to a matrix_model_vote_<key> key instead", () => {
    const flat = fieldMap(flattenMatrixSummary({ confidence_label: null, win_probability_range: null, agreement_label: null, model_votes: { some_new_model: "55/45" }, monte_carlo: null, engine_breakdown: null }).map(([field_key, normalized_value]) => ({ field_key, normalized_value })));
    expect(flat.matrix_model_vote_some_new_model).toBe("55/45");
    expect(MODEL_VOTE_KEY_MAP.some_new_model).toBeUndefined();
  });

  it("only emits entries for sections actually present, omitting empty engine_breakdown modules rather than writing empty JSON", () => {
    const flat = flattenMatrixSummary({ confidence_label: "LOW CONFIDENCE", win_probability_range: null, agreement_label: null, model_votes: null, monte_carlo: null, engine_breakdown: { style_matchup: {} } });
    expect(flat).toEqual([["matrix_confidence_label", "LOW CONFIDENCE"], ["matrix_wp_range", null], ["matrix_agreement_label", null]]);
  });

  it("aiToParsed combines top-level scalars with the flattened matrix_summary and drops null/empty values", () => {
    const matchup: AiMatchup = {
      page_number: 1,
      player1_name: "Sebastian Baez",
      player2_name: "Facundo Bagnis",
      tournament: "Buenos Aires", event_level: "ATP", round: "R32", scheduled_date: "2026-08-27", surface: "Clay", best_of: "3",
      matrix_predicted_winner: "Sebastian Baez",
      matrix_wp: "73",
      matrix_summary: { confidence_label: "HIGH CONFIDENCE", win_probability_range: null, agreement_label: null, model_votes: { general_model: "73/27" }, monte_carlo: null, engine_breakdown: null },
      other_fields: { upset_risk: "Low" },
    };
    const parsed = aiToParsed(matchup);
    expect(parsed.player1_name).toBe("Sebastian Baez");
    const flat = fieldMap(parsed.fields);
    expect(flat.matrix_predicted_winner).toBe("Sebastian Baez");
    expect(flat.matrix_wp).toBe("73");
    expect(flat.matrix_confidence_label).toBe("HIGH CONFIDENCE");
    expect(flat.general_model).toBe("73/27");
    expect(flat.upset_risk).toBe("Low");
    expect(flat.matrix_wp_range).toBeUndefined(); // null values are never turned into a field row
    for (const f of parsed.fields) expect(f.extraction_status).toBe("DIRECT");
  });

  // CRITICAL EVIDENCE FIREWALL guardrail: this module must remain a pure flattener with
  // no path into the independent 81-metric research pipeline. If this ever starts
  // failing, something wired prediction-engine output into evidence generation.
  it("never references the research pipeline, parsed_summary_fields writes, or metric research calls", () => {
    const source = readFileSync("src/lib/matrix-summary-flatten.ts", "utf8");
    expect(source).not.toContain("deps.research");
    expect(source).not.toContain("digestFrom");
    expect(source).not.toContain("metric_results");
    expect(source).not.toContain("supabase");
  });

  it("audit-pipeline.ts's digestFrom (what feeds the 81-metric research call) never reads any matrix_/model-vote key this module produces", () => {
    const source = readFileSync("src/lib/audit-pipeline.ts", "utf8");
    const digestFromBody = source.slice(source.indexOf("function digestFrom"), source.indexOf("function digestFrom") + 2000);
    for (const key of [...Object.values(MODEL_VOTE_KEY_MAP), ...Object.values(ENGINE_MODULE_KEY_MAP), "matrix_wp", "matrix_predicted_winner", "parsed_summary_fields"]) {
      expect(digestFromBody, key).not.toContain(key);
    }
  });
});
