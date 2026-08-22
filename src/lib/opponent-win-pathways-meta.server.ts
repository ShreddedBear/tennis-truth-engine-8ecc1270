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
 * Metric 042 asks for opponent win-pathway probabilities. The persisted
 * Dangerous Underdog audit currently stores pathway classifications
 * (WEAK/REALISTIC/STRONG), not calibrated probabilities. We therefore expose
 * the verified pathway structure as PARTIAL and never manufacture a probability.
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

  const completed = pathways.filter(
    (row) =>
      String(row["status"] ?? "") === "COMPLETE" &&
      ["WEAK", "REALISTIC", "STRONG"].includes(String(row["classification"] ?? "")),
  );
  if (!completed.length) return false;

  const summarizeOpponent = (opponent: string) => {
    const rows = completed.filter((row) => String(row["player_side"] ?? "") === opponent);
    if (!rows.length) return null;
    return rows
      .map((row) => `${String(row["pathway_code"] ?? "")}:${String(row["classification"] ?? "")}`)
      .join("; ");
  };

  const p1Summary = summarizeOpponent(player2);
  const p2Summary = summarizeOpponent(player1);
  const p1Value = p1Summary ? `opponent=${player2}; pathway_classifications=${p1Summary}` : null;
  const p2Value = p2Summary ? `opponent=${player1}; pathway_classifications=${p2Summary}` : null;
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
      "Derived from completed Dangerous Underdog pathway classifications for the opposing player; calibrated pathway probabilities are not stored.",
    reconstruction_result: `P1: ${p1Value ?? "UNAVAILABLE"} | P2: ${p2Value ?? "UNAVAILABLE"}`,
    retrieved_at: now,
    p1_retrieved_at: now,
    p2_retrieved_at: now,
    p1_unavailable_reason: p1Value ? "MISSING_REQUIRED_INPUT" : "NO_SOURCE_FOUND",
    p2_unavailable_reason: p2Value ? "MISSING_REQUIRED_INPUT" : "NO_SOURCE_FOUND",
    unavailable_reason: "MISSING_REQUIRED_INPUT",
    unavailable_detail:
      "PARTIAL only: pathway classifications are supported, but metric 042 calls for calibrated opponent-win-pathway probabilities; none are fabricated.",
    missing_inputs: ["calibrated probability for each opponent win pathway"],
  });
  return true;
}
