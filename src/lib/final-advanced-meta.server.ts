import type { PipelineDeps, SourceRef } from "./audit-pipeline";

function codeOf(row: Record<string, unknown>) {
  const match = String(row["metric_code"] ?? "").match(/(\d{1,3})$/);
  return match ? match[1].padStart(3, "0") : String(row["metric_code"] ?? "").padStart(3, "0");
}

function sourcesOf(row: Record<string, unknown>): SourceRef[] {
  return Array.isArray(row["sources"]) ? (row["sources"] as SourceRef[]) : [];
}

function uniqueSources(rows: Array<Record<string, unknown>>) {
  const out: SourceRef[] = [];
  for (const row of rows) {
    for (const source of sourcesOf(row)) {
      if (!out.some((x) => x.source_name === source.source_name && x.url === source.url)) out.push(source);
    }
  }
  return out;
}

/**
 * Metric 061 contains two broad advanced tests:
 *  - counterfactual winner testing by removing each input one at a time;
 *  - realistic opponent-upgrade testing of key metrics.
 *
 * The persisted stress suite currently gives us only a real strongest-family
 * removal test (ST03) plus other scenario perturbations. That is useful but does
 * not satisfy the full definition, so this row is deliberately PARTIAL.
 */
export async function applyFinalAdvancedMetric(deps: PipelineDeps, runId: string) {
  const [metrics, stress] = await Promise.all([
    deps.list("metric_results", runId),
    deps.list("stress_results", runId),
  ]);
  const target = metrics.find((row) => codeOf(row) === "061");
  if (!target) return false;

  const completed = stress.filter((row) => String(row["status"] ?? "") === "COMPLETE");
  const strongestFamily = completed.find((row) => String(row["test_code"] ?? "") === "ST03");
  if (!strongestFamily) return false;

  const related = completed.filter((row) => ["ST03", "ST05", "ST06", "ST07", "ST08", "ST09", "ST10"].includes(String(row["test_code"] ?? "")));
  const detail = related
    .map((row) => `${String(row["test_code"] ?? "")}:${String(row["outcome"] ?? "")}`)
    .join("; ");
  const strongestOutcome = String(strongestFamily["outcome"] ?? "");
  const value = `strongest_family_removal=${strongestOutcome}; related_scenario_tests=${detail}`;
  const same =
    target["p1_value"] === value &&
    target["p2_value"] === value &&
    String(target["p1_treatment"] ?? "") === "PARTIAL" &&
    String(target["p2_treatment"] ?? "") === "PARTIAL" &&
    target["evidence_family"] === null;
  if (same) return false;

  const sources = uniqueSources(related);
  const now = deps.now().toISOString();
  const missing = [
    "leave-one-input-out winner rerun for every individual input metric",
    "realistic opponent-upgrade rerun for Elo, return, serve and recent-form inputs",
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
    reliability: 75,
    sample: String(related.length),
    sources,
    source_attempts: sources,
    reconstruction_attempted: true,
    reconstruction_reason:
      "Derived from the persisted strongest-independent-family removal result and related completed scenario tests. Full metric-061 counterfactual and opponent-upgrade suite is not yet implemented.",
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
