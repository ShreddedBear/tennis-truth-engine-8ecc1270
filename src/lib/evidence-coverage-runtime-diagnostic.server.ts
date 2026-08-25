import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { buildMetricObservationContext } from "./source-observation-metric-bridge.server";
import { evidencePairMatches, safeEvidenceAliases } from "./evidence-player-alias";
import { policyForMetric } from "./metric-source-family-policy";
import { deterministicEnvironmentMetric } from "./deterministic-environment-metrics.server";
import { deterministicMarketMetric } from "./deterministic-market-metrics.server";
import { deterministicRankingMetric } from "./deterministic-ranking-metrics.server";
import { deterministicResultsScheduleMetric } from "./deterministic-results-schedule-metrics.server";
import { deterministicRulesContextMetric } from "./deterministic-rules-context-metric.server";

const db = supabaseAdmin as any;
const USABLE = new Set(["DIRECT", "RECONSTRUCTED", "PARTIAL"]);
const DIAGNOSTIC_QUERY_CONCURRENCY = 6;

type FailureBucket =
  | "SOURCE_MISSING"
  | "INGESTION_MISSING"
  | "IDENTITY_MATCH_FAILURE"
  | "EVIDENCE_QUERY_FAILURE"
  | "NORMALIZATION_FAILURE"
  | "EVIDENCE_WIRING_FAILURE"
  | "RECONSTRUCTION_FAILURE"
  | "COVERAGE_CREDIT_FAILURE"
  | "GENUINELY_UNAVAILABLE";

type Metric = { code: string; name: string; body: string | null };
type LocalResult = Awaited<ReturnType<typeof deterministic>>;

const REPRESENTATIVE_MATCHES = [
  { id: "ATP_MAIN", p1: "Arthur Fils", p2: "Flavio Cobolli", date: "2026-08-22", tournament: "Cincinnati Open", context: "Tournament: Cincinnati Open | Level: ATP Masters 1000 | Tour: ATP Main | Surface: hard | Date: 2026-08-22" },
  { id: "WTA_MAIN", p1: "Iga Swiatek", p2: "Jessica Pegula", date: "2026-08-22", tournament: "Cincinnati Open", context: "Tournament: Cincinnati Open | Level: WTA 1000 | Tour: WTA Main | Surface: hard | Date: 2026-08-22" },
  { id: "ATP_CHALLENGER", p1: "Emilio Nava", p2: "Patrick Kypson", date: "2026-08-22", tournament: "ATP Challenger representative", context: "Tournament: ATP Challenger representative | Level: ATP Challenger | Tour: ATP Challenger | Surface: hard | Date: 2026-08-22" },
] as const;

function codeOf(value: unknown) {
  const match = String(value ?? "").match(/(\d{1,3})$/);
  return match ? match[1].padStart(3,"0") : String(value ?? "").padStart(3,"0");
}

async function activeMetrics(): Promise<Metric[]> {
  const { data: doc, error: docError } = await db.from("rule_documents").select("active_version_id").eq("doc_type", "METRICS").maybeSingle();
  if (docError) throw new Error(`metric document lookup: ${docError.message}`);
  if (!doc?.active_version_id) throw new Error("No active METRICS rule document version");
  const { data, error } = await db.from("rules").select("rule_code,rule_name,body").eq("version_id", doc.active_version_id).order("rule_code");
  if (error) throw new Error(`metric rules lookup: ${error.message}`);
  return (data ?? []).filter((row: any) => Number(row.rule_code) >= 1 && Number(row.rule_code) <= 81).map((row: any) => ({ code: String(row.rule_code), name: String(row.rule_name), body: row.body ?? null }));
}

async function deterministic(metric: Metric, match: typeof REPRESENTATIVE_MATCHES[number]) {
  const runners = [
    () => deterministicRankingMetric({ metricCode: metric.code, p1: match.p1, p2: match.p2, asOfDate: match.date }),
    () => deterministicRulesContextMetric({ metricCode: metric.code, p1: match.p1, p2: match.p2, asOfDate: match.date, context: match.context }),
    () => deterministicEnvironmentMetric({ metricCode: metric.code, p1: match.p1, p2: match.p2, asOfDate: match.date, tournament: match.tournament }),
    () => deterministicMarketMetric({ metricCode: metric.code, p1: match.p1, p2: match.p2, asOfDate: match.date }),
    () => deterministicResultsScheduleMetric({ metricCode: metric.code, p1: match.p1, p2: match.p2, asOfDate: match.date, tournament: match.tournament }),
  ];
  const errors: string[] = [];
  for (const runner of runners) {
    try { const row = await runner(); if (row) return { row, errors }; }
    catch (error) { errors.push(error instanceof Error ? error.message : String(error)); }
  }
  return { row: null, errors };
}

async function deterministicBatch(metrics: Metric[], match: typeof REPRESENTATIVE_MATCHES[number]) {
  const out = new Map<string, LocalResult>();
  for (let i = 0; i < metrics.length; i += DIAGNOSTIC_QUERY_CONCURRENCY) {
    const chunk = metrics.slice(i, i + DIAGNOSTIC_QUERY_CONCURRENCY);
    const rows = await Promise.all(chunk.map(async (metric) => [codeOf(metric.code), await deterministic(metric, match)] as const));
    for (const [code, result] of rows) out.set(code, result);
  }
  return out;
}

export async function runEvidenceCoverageRuntimeDiagnostic() {
  const metrics = await activeMetrics();
  if (metrics.length !== 81) throw new Error(`Expected 81 active metrics, found ${metrics.length}`);
  const matches: any[] = [];

  for (const match of REPRESENTATIVE_MATCHES) {
    const aliases = [...new Set([...safeEvidenceAliases(match.p1, match.p2), ...safeEvidenceAliases(match.p2, match.p1)])];
    const [identityResult, storedResult, packetResult] = await Promise.allSettled([
      db.from("matches").select("id,player1_name,player2_name,event_level,scheduled_date,surface").or(`and(player1_name.eq.${match.p1},player2_name.eq.${match.p2}),and(player1_name.eq.${match.p2},player2_name.eq.${match.p1})`).limit(5),
      db.from("metric_evidence_store").select("metric_code,player_name,opponent_name,treatment,evidence_family").eq("as_of_date", match.date).in("metric_code", metrics.map((m) => codeOf(m.code))).in("player_name", aliases).in("opponent_name", aliases),
      buildMetricObservationContext({ metrics, p1: match.p1, p2: match.p2, asOfDate: match.date }),
    ]);

    const identityError = identityResult.status === "rejected" ? String(identityResult.reason) : identityResult.value.error?.message ?? null;
    const identityRows = identityResult.status === "fulfilled" ? identityResult.value.data ?? [] : [];
    const storedError = storedResult.status === "rejected" ? String(storedResult.reason) : storedResult.value.error?.message ?? null;
    const storedRows = storedResult.status === "fulfilled" ? storedResult.value.data ?? [] : [];
    const packetError = packetResult.status === "rejected" ? String(packetResult.reason) : null;
    const packet = packetResult.status === "fulfilled" ? packetResult.value as Record<string, any> : {};
    const localByCode = await deterministicBatch(metrics, match);

    const details: any[] = [];
    for (const metric of metrics) {
      const code = codeOf(metric.code);
      const policy = policyForMetric(code);
      const entry = packet[code] ?? null;
      const p1Stored = storedRows.find((r: any) => codeOf(r.metric_code) === code && evidencePairMatches(r.player_name, r.opponent_name, match.p1, match.p2)) ?? null;
      const p2Stored = storedRows.find((r: any) => codeOf(r.metric_code) === code && evidencePairMatches(r.player_name, r.opponent_name, match.p2, match.p1)) ?? null;
      const local = localByCode.get(code) ?? { row: null, errors: [] };
      const p1Treatment = String(p1Stored?.treatment ?? local.row?.p1_treatment ?? "UNAVAILABLE");
      const p2Treatment = String(p2Stored?.treatment ?? local.row?.p2_treatment ?? "UNAVAILABLE");
      const p1Usable = USABLE.has(p1Treatment);
      const p2Usable = USABLE.has(p2Treatment);
      const pairUsable = p1Usable && p2Usable;
      const oneSidedUsable = p1Usable !== p2Usable;
      let bucket: FailureBucket | null = null;
      let reason: string | null = null;
      if (!pairUsable) {
        // The production `matches` table is not the evidence warehouse. An empty
        // exact-pair lookup is identity metadata only and must not overwrite the
        // real downstream failure bucket for all 81 metrics.
        const queryErrors = [storedError, packetError, ...local.errors].filter(Boolean) as string[];
        if (queryErrors.length) {
          bucket = "EVIDENCE_QUERY_FAILURE";
          reason = queryErrors.join(" | ");
        } else if (oneSidedUsable) {
          bucket = "COVERAGE_CREDIT_FAILURE";
          reason = `One-sided usable evidence cannot count as pair-complete coverage (P1=${p1Treatment}, P2=${p2Treatment}).`;
        } else if ((entry?.observations?.length ?? 0) > 0 && entry?.direct_satisfaction_allowed) {
          bucket = "EVIDENCE_WIRING_FAILURE";
          reason = "Sufficient admissible observations exist but did not become a usable deterministic/stored finding.";
        } else if ((entry?.observations?.length ?? 0) > 0) {
          bucket = "RECONSTRUCTION_FAILURE";
          reason = "Support-only admissible observations exist but no permitted deterministic reconstruction recovered the metric.";
        } else if (policy.allowed_families.length) {
          bucket = "INGESTION_MISSING";
          reason = `A structured path exists for ${policy.allowed_families.join(",")} but no admissible warehouse observation was ingested for this matchup/window.`;
        } else {
          bucket = "EVIDENCE_WIRING_FAILURE";
          reason = "No provider-independent structured source-family path is registered for this metric.";
        }
      }
      details.push({ metric_code: code, metric_name: metric.name, source_expected: policy.allowed_families, warehouse_observation_count: Number(entry?.observations?.length ?? 0), stored_p1: Boolean(p1Stored), stored_p2: Boolean(p2Stored), p1_treatment: p1Treatment, p2_treatment: p2Treatment, p1_credited: p1Usable, p2_credited: p2Usable, pair_credited: pairUsable, one_sided_usable: oneSidedUsable, deterministic_family: local.row?.evidence_family ?? null, failure_bucket: bucket, reason });
    }

    const buckets: Record<string, number> = {};
    for (const row of details) if (row.failure_bucket) buckets[row.failure_bucket] = (buckets[row.failure_bucket] ?? 0) + 1;
    const p1Credited = details.filter((row) => row.p1_credited).length;
    const p2Credited = details.filter((row) => row.p2_credited).length;
    const pairCredited = details.filter((row) => row.pair_credited).length;
    const oneSided = details.filter((row) => row.one_sided_usable).length;
    matches.push({
      id: match.id, pair: `${match.p1} vs ${match.p2}`,
      identity: { exact_match_count: identityRows.length, query_error: identityError, blocks_evidence_classification: false },
      query_errors: [storedError, packetError].filter(Boolean),
      coverage: { p1: p1Credited, p2: p2Credited, pair: pairCredited, one_sided: oneSided, p1_percent: Number((100 * p1Credited / 81).toFixed(2)), p2_percent: Number((100 * p2Credited / 81).toFixed(2)), pair_percent: Number((100 * pairCredited / 81).toFixed(2)) },
      false_green_guard: { passed: oneSided === 0, one_sided_metric_count: oneSided },
      failure_buckets: buckets, metrics: details,
    });
  }

  return { schema_version: 4, generated_at: new Date().toISOString(), metrics: metrics.length, matches };
}
