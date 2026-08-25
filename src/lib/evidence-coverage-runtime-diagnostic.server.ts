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
type RepresentativeMatch = {
  id: "ATP_MAIN" | "WTA_MAIN" | "ATP_CHALLENGER";
  match_id: string;
  p1: string;
  p2: string;
  date: string;
  tournament: string;
  context: string;
  event_level: string | null;
  surface: string | null;
};

type MatchCandidate = {
  id: string;
  player1_name: string;
  player2_name: string;
  tournament_name: string | null;
  event_level: string | null;
  scheduled_date: string | null;
  surface: string | null;
  round: string | null;
};

function classifyTour(row: MatchCandidate): RepresentativeMatch["id"] | null {
  const level = String(row.event_level ?? "").toLowerCase();
  const tournament = String(row.tournament_name ?? "").toLowerCase();
  const combined = `${level} ${tournament}`;
  if (/challenger/.test(combined) && !/wta\s*125|125k/.test(combined)) return "ATP_CHALLENGER";
  if (/wta|women/.test(combined) && !/challenger/.test(combined)) return "WTA_MAIN";
  if (/atp|masters|grand slam|slam|250|500|1000/.test(combined) && !/challenger/.test(combined)) return "ATP_MAIN";
  return null;
}

function toRepresentative(id: RepresentativeMatch["id"], row: MatchCandidate): RepresentativeMatch {
  const tournament = row.tournament_name ?? `${id} production match`;
  const date = row.scheduled_date!;
  const surface = row.surface ?? null;
  const level = row.event_level ?? id.replaceAll("_", " ");
  const context = [
    `Tournament: ${tournament}`,
    `Level: ${level}`,
    `Tour: ${id.replaceAll("_", " ")}`,
    surface ? `Surface: ${surface}` : null,
    `Date: ${date}`,
    row.round ? `Round: ${row.round}` : null,
  ].filter(Boolean).join(" | ");
  return { id, match_id: row.id, p1: row.player1_name, p2: row.player2_name, date, tournament, context, event_level: row.event_level, surface };
}

async function representativeMatches(): Promise<{ matches: RepresentativeMatch[]; missing_classes: RepresentativeMatch["id"][] }> {
  const { data, error } = await db.from("matches")
    .select("id,player1_name,player2_name,tournament_name,event_level,scheduled_date,surface,round")
    .not("player1_name", "is", null)
    .not("player2_name", "is", null)
    .not("scheduled_date", "is", null)
    .order("scheduled_date", { ascending: false })
    .limit(1000);
  if (error) throw new Error(`production match sampling: ${error.message}`);

  const candidates = ((data ?? []) as MatchCandidate[]).filter((row) => row.player1_name && row.player2_name && row.scheduled_date);
  const wanted: RepresentativeMatch["id"][] = ["ATP_MAIN", "WTA_MAIN", "ATP_CHALLENGER"];
  const selected: RepresentativeMatch[] = [];
  for (const id of wanted) {
    const row = candidates.find((candidate) => classifyTour(candidate) === id);
    if (row) selected.push(toRepresentative(id, row));
  }
  return { matches: selected, missing_classes: wanted.filter((id) => !selected.some((match) => match.id === id)) };
}

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

async function deterministic(metric: Metric, match: RepresentativeMatch) {
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

export async function runEvidenceCoverageRuntimeDiagnostic() {
  const metrics = await activeMetrics();
  if (metrics.length !== 81) throw new Error(`Expected 81 active metrics, found ${metrics.length}`);
  const sample = await representativeMatches();
  if (!sample.matches.length) throw new Error("No real production matches were available for evidence coverage sampling");
  const matches: any[] = [];

  for (const match of sample.matches) {
    const aliases = [...new Set([...safeEvidenceAliases(match.p1, match.p2), ...safeEvidenceAliases(match.p2, match.p1)])];
    const [identityResult, storedResult, packetResult] = await Promise.allSettled([
      db.from("matches").select("id,player1_name,player2_name,event_level,scheduled_date,surface").eq("id", match.match_id).limit(1),
      db.from("metric_evidence_store").select("metric_code,player_name,opponent_name,treatment,evidence_family").eq("as_of_date", match.date).in("metric_code", metrics.map((m) => codeOf(m.code))).in("player_name", aliases).in("opponent_name", aliases),
      buildMetricObservationContext({ metrics, p1: match.p1, p2: match.p2, asOfDate: match.date }),
    ]);

    const identityError = identityResult.status === "rejected" ? String(identityResult.reason) : identityResult.value.error?.message ?? null;
    const identityRows = identityResult.status === "fulfilled" ? identityResult.value.data ?? [] : [];
    const storedError = storedResult.status === "rejected" ? String(storedResult.reason) : storedResult.value.error?.message ?? null;
    const storedRows = storedResult.status === "fulfilled" ? storedResult.value.data ?? [] : [];
    const packetError = packetResult.status === "rejected" ? String(packetResult.reason) : null;
    const packet = packetResult.status === "fulfilled" ? packetResult.value as Record<string, any> : {};

    const details: any[] = [];
    for (const metric of metrics) {
      const code = codeOf(metric.code);
      const policy = policyForMetric(code);
      const entry = packet[code] ?? null;
      const p1Stored = storedRows.find((r: any) => codeOf(r.metric_code) === code && evidencePairMatches(r.player_name, r.opponent_name, match.p1, match.p2)) ?? null;
      const p2Stored = storedRows.find((r: any) => codeOf(r.metric_code) === code && evidencePairMatches(r.player_name, r.opponent_name, match.p2, match.p1)) ?? null;
      const local = await deterministic(metric, match);
      const p1Treatment = String(p1Stored?.treatment ?? local.row?.p1_treatment ?? "UNAVAILABLE");
      const p2Treatment = String(p2Stored?.treatment ?? local.row?.p2_treatment ?? "UNAVAILABLE");
      const p1Usable = USABLE.has(p1Treatment);
      const p2Usable = USABLE.has(p2Treatment);
      const pairUsable = p1Usable && p2Usable;
      const oneSidedUsable = p1Usable !== p2Usable;
      let bucket: FailureBucket | null = null;
      let reason: string | null = null;
      if (!pairUsable) {
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
      id: match.id, match_id: match.match_id, pair: `${match.p1} vs ${match.p2}`, tournament: match.tournament, scheduled_date: match.date, event_level: match.event_level, surface: match.surface,
      identity: { exact_match_count: identityRows.length, query_error: identityError, blocks_evidence_classification: identityRows.length !== 1 },
      query_errors: [storedError, packetError].filter(Boolean),
      coverage: { p1: p1Credited, p2: p2Credited, pair: pairCredited, one_sided: oneSided, p1_percent: Number((100 * p1Credited / 81).toFixed(2)), p2_percent: Number((100 * p2Credited / 81).toFixed(2)), pair_percent: Number((100 * pairCredited / 81).toFixed(2)) },
      false_green_guard: { passed: oneSided === 0, one_sided_metric_count: oneSided },
      failure_buckets: buckets, metrics: details,
    });
  }

  return { schema_version: 4, generated_at: new Date().toISOString(), metrics: metrics.length, sampling: { source: "REAL_PRODUCTION_MATCHES", requested_classes: ["ATP_MAIN","WTA_MAIN","ATP_CHALLENGER"], sampled_classes: matches.map((m) => m.id), missing_classes: sample.missing_classes }, matches };
}
