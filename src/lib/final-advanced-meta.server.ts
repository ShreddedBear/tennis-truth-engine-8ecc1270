import type { PipelineDeps, SourceRef } from "./audit-pipeline";
import { classifyEvidenceTourFamily } from "./evidence-match-identity";
import { computeHistoricalTwinMatchSearch } from "./historical-twin-match-search.server";
import { loadRuntimeIndex } from "./runtime-tennis-index-data.server";

function codeOf(row: Record<string, unknown>) {
  const match = String(row["metric_code"] ?? "").match(/(\d{1,3})$/);
  return match ? match[1].padStart(3, "0") : String(row["metric_code"] ?? "").padStart(3, "0");
}

function sourcesOf(row: Record<string, unknown>): SourceRef[] {
  return Array.isArray(row["sources"]) ? (row["sources"] as SourceRef[]) : [];
}

function uniqueSources(rows: Array<Record<string, unknown>>, extra: SourceRef[] = []) {
  const out: SourceRef[] = [];
  const add = (source: SourceRef) => {
    if (!out.some((x) => x.source_name === source.source_name && x.url === source.url)) out.push(source);
  };
  for (const row of rows) for (const source of sourcesOf(row)) add(source);
  for (const source of extra) add(source);
  return out;
}

async function historicalTwinMatchSearchFor(deps: PipelineDeps, matchId: string | undefined) {
  if (!matchId) return null;
  const match = await deps.getMatch(matchId);
  if (!match?.scheduled_date) return null;
  const family = classifyEvidenceTourFamily(match.event_level, match.tournament_name, match.round);
  if (!family) return null;
  const lane = loadRuntimeIndex().matchHistory[family];
  if (!lane || typeof lane !== "object") return null;
  return computeHistoricalTwinMatchSearch({
    p1: match.player1_name,
    p2: match.player2_name,
    asOfDate: match.scheduled_date,
    surface: match.surface,
    lane: lane as never,
  });
}

/**
 * Metric 061 contains three broad advanced tests:
 *  - counterfactual winner testing by removing each input one at a time (meta: tests the
 *    model's own pick, not a player fact -- not implemented here);
 *  - realistic opponent-upgrade testing of key metrics (meta, same reason -- not implemented);
 *  - historical twin-match search across the full defined similarity vector (legitimately
 *    player/matchup evidence -- see historical-twin-match-search.server.ts, which covers the
 *    Elo-gap and court-speed components of that vector from the deterministic four-tour
 *    results replay; the remaining components in the definition -- hold/break gap,
 *    Dominance Ratio gap, form gap, market price, fatigue gap, age, ranking gap, model
 *    disagreement, Monte Carlo output, data quality -- are not present in that replay and
 *    are not synthesized).
 *
 * The persisted stress suite gives us a real strongest-family removal test (ST03) plus
 * related scenario perturbations, and the historical twin-match search above supplies the
 * one reconstructable sub-item of the third bullet. That still supports only a subset of
 * the full definition, so this row is deliberately PARTIAL rather than COMPLETE.
 */
export async function applyFinalAdvancedMetric(deps: PipelineDeps, runId: string, matchId?: string) {
  const [metrics, stress] = await Promise.all([
    deps.list("metric_results", runId),
    deps.list("stress_results", runId),
  ]);
  const target = metrics.find((row) => codeOf(row) === "061");
  if (!target) return false;

  const completed = stress.filter((row) => String(row["status"] ?? "") === "COMPLETE");
  const strongestFamily = completed.find((row) => String(row["test_code"] ?? "") === "ST03");
  if (!strongestFamily) return false;

  const related = completed.filter((row) =>
    ["ST03", "ST05", "ST06", "ST07", "ST08", "ST09", "ST10"].includes(String(row["test_code"] ?? "")),
  );
  const detail = related
    .map((row) => `${String(row["test_code"] ?? "")}:${String(row["outcome"] ?? "")}`)
    .join("; ");
  const strongestOutcome = String(strongestFamily["outcome"] ?? "");
  const twinSearch = await historicalTwinMatchSearchFor(deps, matchId);
  const value = twinSearch
    ? `strongest_family_removal=${strongestOutcome}; related_scenario_tests=${detail}; historical_twin_match_search[${twinSearch.p1_value}]`
    : `strongest_family_removal=${strongestOutcome}; related_scenario_tests=${detail}`;
  const same =
    target["p1_value"] === value &&
    target["p2_value"] === value &&
    String(target["p1_treatment"] ?? "") === "PARTIAL" &&
    String(target["p2_treatment"] ?? "") === "PARTIAL" &&
    target["evidence_family"] === null;
  if (same) return false;

  const sources = uniqueSources(related, twinSearch?.sources ?? []);
  const now = deps.now().toISOString();
  const missing = [
    "leave-one-input-out winner rerun for every individual input metric",
    "realistic opponent-upgrade rerun for Elo, return, serve and recent-form inputs",
    ...(twinSearch
      ? []
      : ["historical twin-match search using the full metric-061 similarity vector"]),
  ];
  await deps.update("metric_results", String(target["id"]), {
    p1_value: value,
    p2_value: value,
    p1_treatment: "PARTIAL",
    p2_treatment: "PARTIAL",
    p1_status: "COMPLETE",
    p2_status: "COMPLETE",
    status: "COMPLETE",
    evidence_family: null,
    reliability: twinSearch ? 78 : 75,
    sample: String(related.length + (twinSearch ? 1 : 0)),
    sources,
    source_attempts: sources,
    reconstruction_attempted: true,
    reconstruction_reason: twinSearch
      ? "Derived from the persisted strongest-independent-family removal result, related completed scenario tests, and a real Historical Twin Match Search (Elo-gap nearest-neighbor lookup over the four-tour deterministic results replay, surface-mismatch penalized). Full metric-061 leave-one-input-out counterfactual and opponent-upgrade suites are meta re-runs of the model's own prediction and are deliberately not implemented as player evidence."
      : "Derived from the persisted strongest-independent-family removal result and related completed scenario tests. Full metric-061 counterfactual, opponent-upgrade, and historical-twin suite is not yet implemented.",
    reconstruction_result: value,
    retrieved_at: now,
    p1_retrieved_at: now,
    p2_retrieved_at: now,
    p1_unavailable_reason: "MISSING_REQUIRED_INPUT",
    p2_unavailable_reason: "MISSING_REQUIRED_INPUT",
    unavailable_reason: "MISSING_REQUIRED_INPUT",
    unavailable_detail: `PARTIAL only; missing ${missing.join("; ")}.`,
    missing_inputs: missing,
  });
  return true;
}
