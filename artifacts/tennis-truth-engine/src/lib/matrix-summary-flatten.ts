// Flattens the "Tennis Matrix AI" prediction-engine summary structure (Model Votes,
// Monte Carlo Simulation, Full Engine Breakdown) that pdf-extract.functions.ts's vision
// extraction returns into the same flat field_key/value shape every other parsed summary
// field uses (parsed_summary_fields).
//
// CRITICAL EVIDENCE FIREWALL: every key produced here is prediction-engine output --
// guidance/reference only, never independent audit evidence. It is read exclusively
// through the same firewalled path matrix_wp already uses (gated behind
// independent_decision_committed_at / matrix_revealed_at in match.$matchId.tsx). None of
// these keys are ever passed into the function that builds the 81-metric research call's
// input in audit-pipeline.ts -- see matrix-summary-flatten.test.ts's isolation guardrail.
import type { AiMatchup, AiMatrixSummary } from "./pdf-extract.functions";
import type { ParsedField, ParsedMatchup } from "./summary-parser";

// Canonical model-vote key mapping. The vision model is asked for these exact snake_case
// names (see the PROMPT in pdf-extract.functions.ts) but may vary; anything unmapped still
// gets captured under a matrix_model_vote_<key> fallback rather than silently dropped.
export const MODEL_VOTE_KEY_MAP: Record<string, string> = {
  surface_elo: "matrix_elo",
  serve_return: "matrix_serve_return",
  recent_form: "matrix_recent_form",
  head_to_head: "matrix_head_to_head",
  market_consensus: "matrix_market",
  general_model: "general_model",
  specialist_model: "specialist_model",
};

// Two labels ("Fatigue Index" and "Match Load Recovery") are used across different report
// variants for the same underlying module; both collapse to one canonical detail key.
export const ENGINE_MODULE_KEY_MAP: Record<string, string> = {
  surface_elo: "matrix_elo_detail",
  serve_return: "matrix_serve_return_detail",
  recent_form: "matrix_recent_form_detail",
  head_to_head: "matrix_head_to_head_detail",
  fatigue_index: "matrix_fatigue_index_detail",
  match_load_recovery: "matrix_fatigue_index_detail",
  rest_travel_injury: "matrix_rest_travel_injury_detail",
  style_matchup: "matrix_style_matchup_detail",
};

export function flattenMatrixSummary(summary: AiMatrixSummary | null | undefined): Array<[string, string | null]> {
  if (!summary) return [];
  const out: Array<[string, string | null]> = [
    ["matrix_confidence_label", summary.confidence_label],
    ["matrix_wp_range", summary.win_probability_range],
    ["matrix_agreement_label", summary.agreement_label],
  ];
  for (const [key, value] of Object.entries(summary.model_votes ?? {})) {
    out.push([MODEL_VOTE_KEY_MAP[key] ?? `matrix_model_vote_${key}`, value]);
  }
  const mc = summary.monte_carlo;
  if (mc) {
    out.push(
      ["monte_carlo_prob", mc.win_probability],
      ["monte_carlo_range", mc.range],
      ["monte_carlo_expected_sets", mc.expected_sets],
      ["monte_carlo_simulations", mc.simulations],
    );
    if (mc.set_score_distribution && Object.keys(mc.set_score_distribution).length) {
      out.push(["monte_carlo_set_score_distribution", JSON.stringify(mc.set_score_distribution)]);
    }
  }
  for (const [module, detail] of Object.entries(summary.engine_breakdown ?? {})) {
    if (detail && Object.keys(detail).length) {
      out.push([ENGINE_MODULE_KEY_MAP[module] ?? `matrix_engine_${module}_detail`, JSON.stringify(detail)]);
    }
  }
  return out;
}

export function aiToParsed(m: AiMatchup): ParsedMatchup {
  const page = m.page_number || 1;
  const entries: Array<[string, string | null]> = [
    ["tournament", m.tournament],
    ["event_level", m.event_level],
    ["round", m.round],
    ["scheduled_date", m.scheduled_date],
    ["surface", m.surface],
    ["best_of", m.best_of],
    ["matrix_predicted_winner", m.matrix_predicted_winner],
    ["matrix_wp", m.matrix_wp],
    ...flattenMatrixSummary(m.matrix_summary),
    ...Object.entries(m.other_fields ?? {}),
  ];
  const fields: ParsedField[] = entries
    .filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== "")
    .map(([key, v]) => ({
      field_key: key,
      raw_value: String(v),
      normalized_value: String(v),
      extraction_status: "DIRECT" as const,
      confidence: 0.85,
      page_number: page,
    }));
  return { player1_name: m.player1_name, player2_name: m.player2_name, page_number: page, confidence: 0.85, fields };
}
