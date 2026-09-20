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

// Metric 042 has a specific pathway list. Dangerous Underdog contains extra
// audit-only pathways (market info, style mismatch, surface transition, etc.)
// that must NOT be imported into this metric.
const METRIC_042_CODES = new Set([
  "SERVE_THROUGH",
  "RETURN_PRESSURE",
  "TIEBREAK",
  "LONG_RALLY",
  "SHORT_RALLY",
  "FAV_COLLAPSE",
  "DECIDING_SET",
  "SECOND_SERVE",
  "MOVEMENT",
  "FATIGUE",
]);

function pathwayFamily(code: string) {
  if (code === "SERVE_THROUGH") return "SERVE_DOMINANCE";
  if (code === "RETURN_PRESSURE") return "RETURN_PRESSURE";
  if (code === "TIEBREAK") return "TIEBREAK";
  if (code === "LONG_RALLY") return "LONG_RALLY";
  if (code === "SHORT_RALLY") return "SHORT_RALLY";
  if (code === "FAV_COLLAPSE") return "FAVORITE_COLLAPSE";
  if (code === "DECIDING_SET") return "THREE_SET_BATTLE";
  if (code === "SECOND_SERVE") return "SECOND_SERVE_EXPLOITATION";
  if (code === "MOVEMENT" || code === "FATIGUE") return "PHYSICAL_ADVANTAGE";
  return null;
}

/**
 * Metric 042 asks for opponent win-pathway probabilities. The persisted
 * Dangerous Underdog audit currently stores pathway classifications
 * (WEAK/REALISTIC/STRONG), not calibrated probabilities. We therefore expose
 * only the pathway structure that belongs to metric 042 as PARTIAL and never
 * manufacture a probability.
 *
 * P1's cell describes P1's opponent (player2); P2's cell describes P2's
 * opponent (player1). This explicit naming avoids row-order/P1-P2 cross-wiring.
 */
export async function applyOpponentWinPathwaysMetric(
  deps: PipelineDeps,
  runId: string,
  player1: string,
  player2: string,
) {
  const [metrics, pathways] = await Promise.all([
    deps.list("metric_results", runId),
    deps.list("underdog_results", runId),
  ]);
  const target = metrics.find((row) => codeOf(row) === "042");
  if (!target) return false;

  const completed = pathways.filter((row) => {
    const code = String(row["pathway_code"] ?? "");
    return (
      String(row["status"] ?? "") === "COMPLETE" &&
      METRIC_042_CODES.has(code) &&
      ["WEAK", "REALISTIC", "STRONG"].includes(String(row["classification"] ?? ""))
    );
  });
  if (!completed.length) return false;

  const summarizeOpponent = (opponent: string) => {
    const rows = completed.filter((row) => String(row["player_side"] ?? "") === opponent);
    if (!rows.length) return null;

    const classifications = rows
      .map((row) => {
        const code = String(row["pathway_code"] ?? "");
        const family = pathwayFamily(code);
        return family ? `${family}:${String(row["classification"] ?? "")}` : null;
      })
      .filter((x) => !!x) as string[];

    const realisticFamilies = new Set(
      rows
        .filter((row) => ["REALISTIC", "STRONG"].includes(String(row["classification"] ?? "")))
        .map((row) => pathwayFamily(String(row["pathway_code"] ?? "")))
        .filter((x) => !!x) as string[],
    );

    return {
      text: classifications.join("; "),
      realisticCount: realisticFamilies.size,
    };
  };

  const p1Summary = summarizeOpponent(player2);
  const p2Summary = summarizeOpponent(player1);
  const p1Value = p1Summary
    ? `opponent=${player2}; pathway_classifications=${p1Summary.text}; realistic_pathways_count=${p1Summary.realisticCount}`
    : null;
  const p2Value = p2Summary
    ? `opponent=${player1}; pathway_classifications=${p2Summary.text}; realistic_pathways_count=${p2Summary.realisticCount}`
    : null;
  if (!p1Value && !p2Value) return false;

  const p1Treatment = p1Value ? "PARTIAL" : "UNAVAILABLE";
  const p2Treatment = p2Value ? "PARTIAL" : "UNAVAILABLE";
  const same =
    String(target["p1_treatment"] ?? "") === p1Treatment &&
    String(target["p2_treatment"] ?? "") === p2Treatment &&
    (target["p1_value"] ?? null) === p1Value &&
    (target["p2_value"] ?? null) === p2Value &&
    target["evidence_family"] === null;
  if (same) return false;

  const sourceRows = completed.filter(
    (row) => String(row["player_side"] ?? "") === player1 || String(row["player_side"] ?? "") === player2,
  );
  const sources = uniqueSources(sourceRows);
  const now = deps.now().toISOString();
  await deps.update("metric_results", String(target["id"]), {
    p1_value: p1Value,
    p2_value: p2Value,
    p1_treatment: p1Treatment,
    p2_treatment: p2Treatment,
    p1_status: p1Value ? "COMPLETE" : "UNAVAILABLE",
    p2_status: p2Value ? "COMPLETE" : "UNAVAILABLE",
    status: p1Value || p2Value ? "COMPLETE" : "UNAVAILABLE",
    evidence_family: null,
    reliability: 70,
    sample: String(completed.length),
    sources,
    source_attempts: sources,
    reconstruction_attempted: true,
    reconstruction_reason:
      "Derived only from completed Dangerous Underdog classifications that correspond to metric 042's defined pathways. Extra audit-only pathway categories are excluded; calibrated probabilities are not stored.",
    reconstruction_result: `P1: ${p1Value ?? "UNAVAILABLE"} | P2: ${p2Value ?? "UNAVAILABLE"}`,
    retrieved_at: now,
    p1_retrieved_at: now,
    p2_retrieved_at: now,
    p1_unavailable_reason: p1Value ? "MISSING_REQUIRED_INPUT" : "NO_SOURCE_FOUND",
    p2_unavailable_reason: p2Value ? "MISSING_REQUIRED_INPUT" : "NO_SOURCE_FOUND",
    unavailable_reason: "MISSING_REQUIRED_INPUT",
    unavailable_detail:
      "PARTIAL only: pathway classifications and realistic-pathway count are supported, but metric 042 calls for calibrated pathway probabilities; none are fabricated.",
    missing_inputs: ["calibrated probability for each metric-042 opponent win pathway"],
  });
  return true;
}
