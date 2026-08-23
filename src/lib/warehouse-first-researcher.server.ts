import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { MetricFinding, Researcher } from "./audit-pipeline";
import { deterministicRankingMetric } from "./deterministic-ranking-metrics.server";
import { deterministicResultsScheduleMetric } from "./deterministic-results-schedule-metrics.server";
import { finalMetricWiringResearcher } from "./metric-wiring-078-081.server";
import { appendMetricObservationContext, buildMetricObservationContext } from "./source-observation-metric-bridge.server";

const db = supabaseAdmin as any;
const USABLE = new Set(["DIRECT", "RECONSTRUCTED", "PARTIAL"]);

type StoredEvidence = {
  metric_code: string;
  player_name: string;
  opponent_name: string | null;
  treatment: MetricFinding["p1_treatment"];
  value_text: string | null;
  reliability: number | null;
  sample_label: string | null;
  evidence_family: string | null;
  sources: MetricFinding["sources"] | null;
  unavailable_reason: string | null;
  valid_until: string | null;
};

function codeOf(value: unknown) {
  const m = String(value ?? "").match(/(\d{1,3})$/);
  return m ? m[1].padStart(3, "0") : String(value ?? "").padStart(3, "0");
}

function asOfDate(context: string | null | undefined) {
  const match = String(context ?? "").match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  return match?.[1] ?? new Date().toISOString().slice(0, 10);
}

function tournamentFromContext(context: string | null | undefined) {
  const text = String(context ?? "");
  const match = text.match(/(?:^|[·|\n])\s*tournament\s+([^·|\n]+)/i);
  return match?.[1]?.trim() || null;
}

function ttlHours(code: string) {
  if (["062", "064", "069", "071", "075", "076", "081"].includes(code)) return 12;
  if (["012", "028", "077", "079"].includes(code)) return 24;
  if (["015", "019"].includes(code)) return 6;
  return 168;
}

async function lookup(metricCodes: string[], player: string, opponent: string, date: string) {
  if (!metricCodes.length) return new Map<string, StoredEvidence>();
  const { data, error } = await db
    .from("metric_evidence_store")
    .select("metric_code,player_name,opponent_name,treatment,value_text,reliability,sample_label,evidence_family,sources,unavailable_reason,valid_until")
    .in("metric_code", metricCodes)
    .eq("player_name", player)
    .eq("opponent_name", opponent)
    .eq("as_of_date", date)
    .or(`valid_until.is.null,valid_until.gt.${new Date().toISOString()}`);
  if (error) return new Map<string, StoredEvidence>();
  return new Map((data ?? []).map((row: StoredEvidence) => [codeOf(row.metric_code), row]));
}

function sourcesOf(row: StoredEvidence | undefined): MetricFinding["sources"] {
  return Array.isArray(row?.sources) ? row!.sources! : [];
}

async function saveSide(args: {
  code: string;
  name: string;
  player: string;
  opponent: string;
  date: string;
  treatment: MetricFinding["p1_treatment"];
  value: string | null;
  reliability: number | null;
  sample: string | null;
  family: string | null;
  sources: MetricFinding["sources"];
  unavailableReason: string | null;
}) {
  const { code, name, player, opponent, date, treatment, value, reliability, sample, family, sources, unavailableReason } = args;
  if (!USABLE.has(treatment) || !value) return;
  const validUntil = new Date(Date.now() + ttlHours(code) * 3_600_000).toISOString();
  const sourceIds = (sources ?? []).map((source) => source.source_name).filter(Boolean);

  await db.from("metric_evidence_store")
    .delete()
    .eq("metric_code", code)
    .eq("player_name", player)
    .eq("opponent_name", opponent)
    .eq("as_of_date", date)
    .is("tournament", null)
    .is("surface", null);

  await db.from("metric_evidence_store").insert({
    metric_code: code,
    metric_name: name,
    player_name: player,
    opponent_name: opponent,
    as_of_date: date,
    treatment,
    value_text: value,
    reliability,
    sample_label: sample,
    evidence_family: family,
    source_ids: sourceIds,
    sources: sources ?? [],
    unavailable_reason: unavailableReason,
    valid_until: validUntil,
    updated_at: new Date().toISOString(),
  });
}

export const warehouseFirstResearcher: Researcher = {
  ...finalMetricWiringResearcher,

  async metrics(input) {
    const { p1, p2, metrics } = input;
    const date = asOfDate(input.context);
    const tournament = tournamentFromContext(input.context);
    const codes = metrics.map((metric) => codeOf(metric.code));

    const [p1Stored, p2Stored] = await Promise.all([
      lookup(codes, p1, p2, date),
      lookup(codes, p2, p1, date),
    ]);

    const missing = metrics.filter((metric) => {
      const code = codeOf(metric.code);
      const a = p1Stored.get(code);
      const b = p2Stored.get(code);
      return !a || !b || !USABLE.has(a.treatment) || !USABLE.has(b.treatment) || !a.value_text || !b.value_text;
    });

    const deterministicRows = (await Promise.all(missing.map(async (metric) => {
      const ranking = await deterministicRankingMetric({ metricCode: metric.code, p1, p2, asOfDate: date });
      if (ranking) return ranking;
      return deterministicResultsScheduleMetric({ metricCode: metric.code, p1, p2, asOfDate: date, tournament });
    }))).filter((row): row is MetricFinding => Boolean(row));
    const deterministicByCode = new Map(deterministicRows.map((row) => [codeOf(row.metric_code), row]));

    let liveRows: MetricFinding[] = [];
    if (missing.length) {
      const observationPacket = await buildMetricObservationContext({ metrics: missing, p1, p2, asOfDate: date });
      for (const [code, row] of deterministicByCode) {
        const existing = (observationPacket as Record<string, any>)[code] ?? {};
        (observationPacket as Record<string, any>)[code] = {
          ...existing,
          deterministic_components: {
            p1_value: row.p1_value,
            p2_value: row.p2_value,
            treatment: row.p1_treatment,
            evidence_family: row.evidence_family,
            sample: row.sample,
          },
        };
      }
      const context = appendMetricObservationContext(input.context, observationPacket);
      liveRows = await finalMetricWiringResearcher.metrics({ ...input, context, metrics: missing });
    }
    const liveByCode = new Map(liveRows.map((row) => [codeOf(row.metric_code), row]));

    const output: MetricFinding[] = [];
    for (const metric of metrics) {
      const code = codeOf(metric.code);
      const a = p1Stored.get(code);
      const b = p2Stored.get(code);
      const live = liveByCode.get(code);
      const deterministic = deterministicByCode.get(code);

      if (a && b && USABLE.has(a.treatment) && USABLE.has(b.treatment) && a.value_text && b.value_text) {
        const mergedSources = [...sourcesOf(a), ...sourcesOf(b)].filter((source, index, rows) =>
          rows.findIndex((other) => other.source_name === source.source_name && other.url === source.url) === index,
        );
        output.push({
          metric_code: code,
          p1_value: a.value_text,
          p2_value: b.value_text,
          p1_treatment: a.treatment,
          p2_treatment: b.treatment,
          differential: null,
          evidence_family: a.evidence_family ?? b.evidence_family,
          reliability: Math.min(a.reliability ?? 100, b.reliability ?? 100),
          sample: [a.sample_label, b.sample_label].filter(Boolean).join(" | ") || null,
          unavailable_reason: null,
          sources: mergedSources,
        });
        continue;
      }

      const chosen = live && (USABLE.has(live.p1_treatment) || USABLE.has(live.p2_treatment)) ? live : deterministic ?? live;
      if (!chosen) continue;
      output.push(chosen);

      await Promise.all([
        saveSide({ code, name: metric.name, player: p1, opponent: p2, date, treatment: chosen.p1_treatment, value: chosen.p1_value, reliability: chosen.reliability, sample: chosen.sample, family: chosen.evidence_family, sources: chosen.sources ?? [], unavailableReason: chosen.unavailable_reason }),
        saveSide({ code, name: metric.name, player: p2, opponent: p1, date, treatment: chosen.p2_treatment, value: chosen.p2_value, reliability: chosen.reliability, sample: chosen.sample, family: chosen.evidence_family, sources: chosen.sources ?? [], unavailableReason: chosen.unavailable_reason }),
      ]);
    }

    return output;
  },
};
