import { supabase } from "@/integrations/supabase/client";
import { CALIBRATION_BUCKETS, DEFAULT_SOURCES, MASTER_RECORD_START, SMALL_SAMPLE_THRESHOLD } from "./constants";
import { activationStatus, parseRuleDocument } from "./rule-parser";

const SEED_DOCS: Array<{ doc_type: string; title: string; file: string }> = [
  { doc_type: "VERIFICATION", title: "Tennis Matrix — Full Verification Audit", file: "/seed/verification.txt" },
  { doc_type: "DISAGREEMENT", title: "Tennis Matrix — Disagreement / Trap Audit", file: "/seed/disagreement.txt" },
  { doc_type: "METRICS", title: "Tennis Matrix — Verification Metrics", file: "/seed/metrics.txt" },
];

let bootstrapPromise: Promise<void> | null = null;

export async function ensureBootstrapped(userId: string) {
  if (!bootstrapPromise) {
    bootstrapPromise = (async () => {
      await ensureCalibration(userId);
      await ensureSources();
      await ensureDocuments();
    })();
  }
  return bootstrapPromise;
}

async function ensureCalibration(userId: string) {
  const { data: existing } = await supabase.from("calibration_versions").select("id").limit(1);
  if (existing && existing.length > 0) return;

  const graded = CALIBRATION_BUCKETS.reduce((a, b) => a + b.graded, 0);
  const { data: version, error } = await supabase
    .from("calibration_versions")
    .insert({
      user_id: userId,
      version_number: 1,
      label: "183 Final Record — baseline",
      master_sequence_count: MASTER_RECORD_START,
      graded_sample_count: graded,
      is_active: true,
    })
    .select()
    .single();
  if (error || !version) return;

  await supabase.from("calibration_buckets").insert(
    CALIBRATION_BUCKETS.map((b) => ({
      user_id: userId,
      calibration_version_id: version.id,
      bucket_code: b.code,
      bucket_label: b.label,
      wp_min: b.min,
      wp_max: b.max,
      wins: b.wins,
      graded: b.graded,
      small_sample: b.graded < SMALL_SAMPLE_THRESHOLD,
    })),
  );
}

async function ensureSources() {
  const { data } = await supabase.from("source_definitions").select("id").limit(1);
  if (data && data.length > 0) return;
  await supabase.from("source_definitions").insert(DEFAULT_SOURCES.map((s) => ({ ...s, supported_data: [] })));
}

async function ensureDocuments() {
  const { data } = await supabase.from("rule_documents").select("id").limit(1);
  if (data && data.length > 0) return;

  for (const seed of SEED_DOCS) {
    const res = await fetch(seed.file);
    if (!res.ok) continue;
    const text = await res.text();
    await createDocumentVersion({ doc_type: seed.doc_type, title: seed.title, filename: seed.file, text, autoActivate: true });
  }
}

export async function createDocumentVersion(opts: {
  doc_type: string;
  title: string;
  filename: string;
  text: string;
  autoActivate?: boolean;
  documentId?: string;
}) {
  const report = parseRuleDocument(opts.text);
  const status = activationStatus(report);

  let documentId = opts.documentId;
  if (!documentId) {
    const { data: doc } = await supabase
      .from("rule_documents")
      .insert({ doc_type: opts.doc_type, title: opts.title })
      .select()
      .single();
    if (!doc) return null;
    documentId = doc.id;
  }

  const { data: prior } = await supabase
    .from("rule_document_versions")
    .select("version_number")
    .eq("document_id", documentId)
    .order("version_number", { ascending: false })
    .limit(1);

  const nextNumber = (prior?.[0]?.version_number ?? 0) + 1;

  const { data: version } = await supabase
    .from("rule_document_versions")
    .insert({
      document_id: documentId,
      version_number: nextNumber,
      source_filename: opts.filename,
      raw_text: opts.text,
      pages_detected: report.pages_detected,
      headings_detected: report.headings_detected,
      expected_rules: report.expected_rules,
      parsed_rules: report.parsed_rules,
      unmapped_rules: report.unmapped_rules,
      parser_confidence: report.parser_confidence,
      activation_status: status,
      is_active: false,
    })
    .select()
    .single();
  if (!version) return null;

  const CHUNK = 200;
  for (let i = 0; i < report.rules.length; i += CHUNK) {
    await supabase.from("rules").insert(
      report.rules.slice(i, i + CHUNK).map((r) => ({
        version_id: version.id,
        rule_code: r.rule_code,
        rule_name: r.rule_name,
        body: r.body,
        severity: r.severity,
        blocking: r.blocking,
        mapping_status: r.mapping_status,
      })),
    );
  }

  if (opts.autoActivate && status === "READY") {
    await activateVersion(documentId, version.id);
  }
  return { documentId, versionId: version.id, report, status };
}

export async function activateVersion(documentId: string, versionId: string) {
  await supabase.from("rule_document_versions").update({ is_active: false }).eq("document_id", documentId);
  await supabase.from("rule_document_versions").update({ is_active: true }).eq("id", versionId);
  await supabase.from("rule_documents").update({ active_version_id: versionId }).eq("id", documentId);

  // Rule change invalidation: any run built on an older version is no longer current.
  const column =
    (await supabase.from("rule_documents").select("doc_type").eq("id", documentId).single()).data?.doc_type ?? "";
  const field =
    column === "VERIFICATION"
      ? "verification_version_id"
      : column === "DISAGREEMENT"
        ? "disagreement_version_id"
        : column === "METRICS"
          ? "metrics_version_id"
          : null;
  if (field) {
    await supabase
      .from("audit_runs")
      .update({ status: "INVALIDATED — RERUN REQUIRED", stale_reason: `${column} rule version changed` })
      .neq(field, versionId)
      .in("status", ["RUNNING", "COMPLETE"]);
  }
}
