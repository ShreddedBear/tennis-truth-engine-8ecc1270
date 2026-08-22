import type { PipelineDeps, SourceRef, Treatment } from "./audit-pipeline";

const META_CODES = ["048", "049", "056", "057"] as const;
const META_SET = new Set<string>(META_CODES);
const USABLE = new Set<Treatment>(["DIRECT", "RECONSTRUCTED", "PARTIAL"]);

function codeOf(row: Record<string, unknown>) {
  const match = String(row["metric_code"] ?? "").match(/(\d{1,3})$/);
  return match ? match[1].padStart(3, "0") : String(row["metric_code"] ?? "").padStart(3, "0");
}

function sourceRefs(row: Record<string, unknown>): SourceRef[] {
  return Array.isArray(row["sources"]) ? (row["sources"] as SourceRef[]) : [];
}

function uniqueSources(rows: Array<Record<string, unknown>>) {
  const out: SourceRef[] = [];
  for (const row of rows) {
    for (const source of sourceRefs(row)) {
      if (!out.some((x) => x.source_name === source.source_name && x.url === source.url)) out.push(source);
    }
  }
  return out;
}

function sideStats(rows: Array<Record<string, unknown>>, side: "p1" | "p2") {
  const treatmentKey = side === "p1" ? "p1_treatment" : "p2_treatment";
  const valueKey = side === "p1" ? "p1_value" : "p2_value";
  const retrievedKey = side === "p1" ? "p1_retrieved_at" : "p2_retrieved_at";
  const usable = rows.filter((row) => {
    const treatment = String(row[treatmentKey] ?? "") as Treatment;
    return USABLE.has(treatment) && row[valueKey] !== null && row[valueKey] !== undefined && row[valueKey] !== "";
  });
  const unavailable = rows.filter((row) => String(row[treatmentKey] ?? "") === "UNAVAILABLE").length;
  const families = usable.map((row) => String(row["evidence_family"] ?? "")).filter(Boolean);
  const familyCounts = new Map<string, number>();
  for (const family of families) familyCounts.set(family, (familyCounts.get(family) ?? 0) + 1);
  const maxFamilyCount = Math.max(0, ...familyCounts.values());
  const reliabilities = usable.map((row) => Number(row["reliability"])).filter(Number.isFinite);
  const avgReliability = reliabilities.length ? reliabilities.reduce((a, b) => a + b, 0) / reliabilities.length : null;
  const samplesReported = usable.filter((row) => row["sample"] !== null && row["sample"] !== undefined && String(row["sample"]).trim() !== "").length;
  const sourceConfirmed = usable.filter((row) => sourceRefs(row).length > 0).length;
  const retrievedPresent = usable.filter((row) => row[retrievedKey] || row["retrieved_at"]).length;
  return {
    usable,
    unavailable,
    distinctFamilies: familyCounts.size,
    repeatedFamilyRows: Math.max(0, usable.length - familyCounts.size),
    maxFamilyShare: usable.length ? (100 * maxFamilyCount) / usable.length : 0,
    avgReliability,
    samplesReported,
    sourceConfirmed,
    retrievedPresent,
    sources: uniqueSources(usable),
  };
}

type MetaValue = {
  value: string | null;
  treatment: Treatment;
  reliability: number | null;
  missing: string[];
};

function valuesFor(stats: ReturnType<typeof sideStats>, total: number): Record<(typeof META_CODES)[number], MetaValue> {
  const noUsable = stats.usable.length === 0;
  return {
    "048": {
      value: `independent_evidence_families=${stats.distinctFamilies}; usable_metric_sides=${stats.usable.length}/${total}`,
      treatment: "RECONSTRUCTED",
      reliability: 95,
      missing: [],
    },
    "049": noUsable
      ? { value: null, treatment: "UNAVAILABLE", reliability: null, missing: ["at least one usable sourced evidence family"] }
      : {
          value: `distinct_families=${stats.distinctFamilies}; max_family_share_pct=${stats.maxFamilyShare.toFixed(1)}; unique_source_refs=${stats.sources.length}; repeated_family_rows=${stats.repeatedFamilyRows}`,
          treatment: "PARTIAL",
          reliability: 75,
          missing: ["formal correlation/covariance map between evidence families"],
        },
    "056": {
      value: `usable=${stats.usable.length}/${total}; unavailable=${stats.unavailable}; source_confirmed=${stats.sourceConfirmed}; sample_reported=${stats.samplesReported}; avg_reliability=${stats.avgReliability === null ? "NA" : stats.avgReliability.toFixed(1)}`,
      treatment: "PARTIAL",
      reliability: 80,
      missing: ["full source-specific quality audit for every submetric"],
    },
    "057": noUsable
      ? { value: null, treatment: "UNAVAILABLE", reliability: null, missing: ["at least one usable sourced metric"] }
      : {
          value: `source_confirmed=${stats.sourceConfirmed}/${stats.usable.length}; retrieved_timestamp_present=${stats.retrievedPresent}/${stats.usable.length}; evidence_families=${stats.distinctFamilies}; avg_reliability=${stats.avgReliability === null ? "NA" : stats.avgReliability.toFixed(1)}`,
          treatment: "PARTIAL",
          reliability: 75,
          missing: ["underlying source-event freshness where only retrieval time exists", "complete surface-relevance score for every evidence family"],
        },
  };
}

/**
 * Derive only metrics whose inputs are the persisted pre-Matrix evidence records themselves.
 * These rows deliberately carry evidence_family = null so they cannot increase the count of
 * independent tennis evidence families or bypass the Matrix firewall.
 */
export async function applySafeMetaDerivedMetrics(deps: PipelineDeps, runId: string) {
  const rows = await deps.list("metric_results", runId);
  const base = rows.filter((row) => !META_SET.has(codeOf(row)) && row["matrix_derived"] !== true);
  const targets = new Map(rows.map((row) => [codeOf(row), row]));
  const p1Stats = sideStats(base, "p1");
  const p2Stats = sideStats(base, "p2");
  const p1 = valuesFor(p1Stats, base.length);
  const p2 = valuesFor(p2Stats, base.length);
  const combinedSources = uniqueSources([...p1Stats.usable, ...p2Stats.usable]);
  let changed = false;

  for (const code of META_CODES) {
    const row = targets.get(code);
    if (!row) continue;
    const a = p1[code], b = p2[code];
    const same =
      String(row["p1_treatment"] ?? "") === a.treatment &&
      String(row["p2_treatment"] ?? "") === b.treatment &&
      (row["p1_value"] ?? null) === a.value &&
      (row["p2_value"] ?? null) === b.value &&
      row["evidence_family"] === null;
    if (same) continue;

    const now = deps.now().toISOString();
    const partial = a.treatment === "PARTIAL" || b.treatment === "PARTIAL";
    const missing = [...new Set([...a.missing, ...b.missing])];
    const reliabilityValues = [a.reliability, b.reliability].filter((x): x is number => x !== null);
    await deps.update("metric_results", String(row["id"]), {
      p1_value: a.value,
      p2_value: b.value,
      p1_treatment: a.treatment,
      p2_treatment: b.treatment,
      p1_status: a.treatment === "UNAVAILABLE" ? "UNAVAILABLE" : "COMPLETE",
      p2_status: b.treatment === "UNAVAILABLE" ? "UNAVAILABLE" : "COMPLETE",
      status: a.treatment === "UNAVAILABLE" && b.treatment === "UNAVAILABLE" ? "UNAVAILABLE" : "COMPLETE",
      evidence_family: null,
      reliability: reliabilityValues.length ? Math.min(...reliabilityValues) : null,
      sample: String(base.length),
      sources: combinedSources,
      source_attempts: combinedSources,
      reconstruction_attempted: true,
      reconstruction_reason: "Deterministically derived from persisted pre-Matrix metric treatments, sources, samples and reliability metadata.",
      reconstruction_result: `P1: ${a.value ?? "UNAVAILABLE"} | P2: ${b.value ?? "UNAVAILABLE"}`,
      retrieved_at: now,
      p1_retrieved_at: now,
      p2_retrieved_at: now,
      p1_unavailable_reason: a.treatment === "UNAVAILABLE" || a.treatment === "PARTIAL" ? "MISSING_REQUIRED_INPUT" : null,
      p2_unavailable_reason: b.treatment === "UNAVAILABLE" || b.treatment === "PARTIAL" ? "MISSING_REQUIRED_INPUT" : null,
      unavailable_reason: partial || a.treatment === "UNAVAILABLE" || b.treatment === "UNAVAILABLE" ? "MISSING_REQUIRED_INPUT" : null,
      unavailable_detail: missing.length ? `Meta-derived coverage is intentionally partial; missing ${missing.join("; ")}.` : null,
      missing_inputs: missing,
    });
    changed = true;
  }
  return changed;
}
