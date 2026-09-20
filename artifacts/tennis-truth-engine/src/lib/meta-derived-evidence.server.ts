import type { PipelineDeps, SourceRef, Treatment } from "./audit-pipeline";

const META_CODES = ["048", "049", "056", "057"] as const;
const META_SET = new Set<string>(META_CODES);
const STRESS_META_CODES = ["050", "058"] as const;
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

function explicitFamily(row: Record<string, unknown>) {
  const family = String(row["evidence_family"] ?? "").trim();
  const defaultName = String(row["metric_name"] ?? "").trim();
  // Instantiation initially sets evidence_family = metric_name. That is a label,
  // not proof that the metric is independent. Only count a family after a
  // researcher/reconstructor has replaced the placeholder with explicit lineage.
  return family && family !== defaultName ? family : null;
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
  const families = usable.map(explicitFamily).filter((x): x is string => !!x);
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
    explicitFamilies: new Set(families),
    distinctFamilies: familyCounts.size,
    repeatedFamilyRows: Math.max(0, families.length - familyCounts.size),
    maxFamilyShare: families.length ? (100 * maxFamilyCount) / families.length : 0,
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
    "049": stats.distinctFamilies === 0
      ? { value: null, treatment: "UNAVAILABLE", reliability: null, missing: ["at least one explicitly assigned evidence family"] }
      : {
          value: `distinct_families=${stats.distinctFamilies}; max_family_share_pct=${stats.maxFamilyShare.toFixed(1)}; unique_source_refs=${stats.sources.length}; repeated_family_rows=${stats.repeatedFamilyRows}`,
          treatment: "PARTIAL",
          reliability: 75,
          missing: ["formal correlation/covariance map between evidence families"],
        },
    "056": {
      value: `usable=${stats.usable.length}/${total}; unavailable=${stats.unavailable}; source_confirmed=${stats.sourceConfirmed}; sample_reported=${stats.samplesReported}; explicit_families=${stats.distinctFamilies}; avg_reliability=${stats.avgReliability === null ? "NA" : stats.avgReliability.toFixed(1)}`,
      treatment: "PARTIAL",
      reliability: 80,
      missing: ["full source-specific quality audit for every submetric"],
    },
    "057": noUsable
      ? { value: null, treatment: "UNAVAILABLE", reliability: null, missing: ["at least one usable sourced metric"] }
      : {
          value: `source_confirmed=${stats.sourceConfirmed}/${stats.usable.length}; retrieved_timestamp_present=${stats.retrievedPresent}/${stats.usable.length}; explicit_evidence_families=${stats.distinctFamilies}; avg_reliability=${stats.avgReliability === null ? "NA" : stats.avgReliability.toFixed(1)}`,
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
  const base = rows.filter((row) => !META_SET.has(codeOf(row)) && !STRESS_META_CODES.includes(codeOf(row) as (typeof STRESS_META_CODES)[number]) && row["matrix_derived"] !== true);
  const targets = new Map(rows.map((row) => [codeOf(row), row]));
  const p1Stats = sideStats(base, "p1");
  const p2Stats = sideStats(base, "p2");
  const p1 = valuesFor(p1Stats, base.length);
  const p2 = valuesFor(p2Stats, base.length);
  const combinedSources = uniqueSources([...p1Stats.usable, ...p2Stats.usable]);
  const matchFamilies = new Set([...p1Stats.explicitFamilies, ...p2Stats.explicitFamilies]);
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
      reconstruction_reason: "Deterministically derived from persisted pre-Matrix metric treatments, explicit evidence lineage, sources, samples and reliability metadata.",
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

  // Correct the run-level independent evidence count using only explicit
  // non-placeholder evidence families. META_DERIVED rows never contribute.
  await deps.updateRun(runId, { effective_evidence_count: matchFamilies.size });
  return changed;
}

/**
 * 050 and 058 are match-level robustness/scenario families. They are populated
 * only from stress tests that actually completed. The same match-level summary
 * appears on both player sides, and remains PARTIAL because the stored test set
 * does not represent every possible perturbation in the broad master metrics.
 */
export async function applySafeStressDerivedMetrics(deps: PipelineDeps, runId: string) {
  const [metrics, stress] = await Promise.all([deps.list("metric_results", runId), deps.list("stress_results", runId)]);
  const completed = stress.filter((row) => String(row["status"]) === "COMPLETE");
  const targets = new Map(metrics.map((row) => [codeOf(row), row]));
  if (!completed.length) {
    let changed = false;
    for (const code of STRESS_META_CODES) {
      const row = targets.get(code); if (!row) continue;
      if (String(row["p1_treatment"] ?? "") === "UNAVAILABLE" && String(row["p2_treatment"] ?? "") === "UNAVAILABLE" && row["p1_value"] == null && row["p2_value"] == null && row["evidence_family"] === null) continue;
      await deps.update("metric_results", String(row["id"]), {
        p1_value: null, p2_value: null, p1_treatment: "UNAVAILABLE", p2_treatment: "UNAVAILABLE",
        p1_status: "UNAVAILABLE", p2_status: "UNAVAILABLE", status: "UNAVAILABLE", evidence_family: null,
        reliability: null, sample: "0", sources: [], source_attempts: [], reconstruction_attempted: true,
        reconstruction_reason: "No completed stress/removal result was available to support this meta-derived family.",
        reconstruction_result: null, unavailable_reason: "MISSING_REQUIRED_INPUT", p1_unavailable_reason: "MISSING_REQUIRED_INPUT",
        p2_unavailable_reason: "MISSING_REQUIRED_INPUT", unavailable_detail: "No completed stress/removal results.",
        missing_inputs: ["completed stress/removal tests"], retrieved_at: deps.now().toISOString(),
      });
      changed = true;
    }
    return changed;
  }

  const countOutcome = (name: string) => completed.filter((row) => String(row["outcome"] ?? "").toUpperCase() === name).length;
  const stable = countOutcome("STABLE"), mostly = countOutcome("MOSTLY STABLE"), unstable = countOutcome("UNSTABLE"), fails = countOutcome("FAILS");
  const matrixRemoval = completed.filter((row) => ["ST01", "ST02"].includes(String(row["test_code"])));
  const matrixRemovalSurvived = matrixRemoval.length === 2 && matrixRemoval.every((row) => ["STABLE", "MOSTLY STABLE"].includes(String(row["outcome"])));
  const familyRemoval = completed.find((row) => String(row["test_code"]) === "ST03");
  const familyRemovalSurvived = !!familyRemoval && String(familyRemoval["outcome"]) !== "FAILS";
  const stableRate = completed.length ? (100 * (stable + mostly)) / completed.length : 0;
  const sources = uniqueSources(completed);
  const summary050 = `completed_tests=${completed.length}/${stress.length}; stable=${stable}; mostly_stable=${mostly}; unstable=${unstable}; fails=${fails}; matrix_removal_survived=${matrixRemovalSurvived}; strongest_family_removal_survived=${familyRemovalSurvived}`;
  const summary058 = `scenario_tests_completed=${completed.length}/${stress.length}; stable_or_mostly_pct=${stableRate.toFixed(1)}; stable=${stable}; mostly_stable=${mostly}; unstable=${unstable}; fails=${fails}`;
  const summaries: Record<(typeof STRESS_META_CODES)[number], string> = { "050": summary050, "058": summary058 };
  let changed = false;

  for (const code of STRESS_META_CODES) {
    const row = targets.get(code); if (!row) continue;
    const value = summaries[code];
    const same = row["p1_value"] === value && row["p2_value"] === value && String(row["p1_treatment"]) === "PARTIAL" && String(row["p2_treatment"]) === "PARTIAL" && row["evidence_family"] === null;
    if (same) continue;
    const now = deps.now().toISOString();
    const missing = code === "050"
      ? ["full leave-one-input-out and parameter perturbation universe beyond the persisted stress suite"]
      : ["full probability-distribution sensitivity and every scenario defined by the broad metric family"];
    await deps.update("metric_results", String(row["id"]), {
      p1_value: value, p2_value: value, p1_treatment: "PARTIAL", p2_treatment: "PARTIAL",
      p1_status: "COMPLETE", p2_status: "COMPLETE", status: "COMPLETE", evidence_family: null,
      reliability: 80, sample: String(completed.length), sources, source_attempts: sources, reconstruction_attempted: true,
      reconstruction_reason: "Deterministically summarized from persisted completed Stress / Removal Test outcomes.",
      reconstruction_result: value, retrieved_at: now, p1_retrieved_at: now, p2_retrieved_at: now,
      unavailable_reason: "MISSING_REQUIRED_INPUT", p1_unavailable_reason: "MISSING_REQUIRED_INPUT", p2_unavailable_reason: "MISSING_REQUIRED_INPUT",
      unavailable_detail: `Partial robustness coverage; missing ${missing.join("; ")}.`, missing_inputs: missing,
    });
    changed = true;
  }
  return changed;
}
