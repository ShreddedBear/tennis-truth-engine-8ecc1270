// First-run seeding: calibration baseline, source definitions, and the three rule
// documents. SERVER ONLY.
//
// This ran in the browser on every app load, with the publishable key, and could insert
// into calibration_versions, calibration_buckets, source_definitions, rule_documents,
// rule_document_versions and rules. It short-circuits once each table has a row -- and
// production has had those rows since long before this migration -- but it was a live
// write path all the same.
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { and, desc, eq, inArray, ne } from "drizzle-orm";

import { db } from "@/db/client.server";
import {
  auditRunsTable, calibrationBucketsTable, calibrationVersionsTable, ruleDocumentVersionsTable,
  ruleDocumentsTable, rulesTable, sourceDefinitionsTable,
} from "@/db/schema";
import { CALIBRATION_BUCKETS, DEFAULT_SOURCES, MASTER_RECORD_START, SMALL_SAMPLE_THRESHOLD } from "./constants";
import { activationStatus, parseRuleDocument } from "./rule-parser";
import { INVALIDATED_RUN_STATUS } from "./audit-stages";

const SEED_DOCS: Array<{ doc_type: string; title: string; file: string }> = [
  { doc_type: "VERIFICATION", title: "Tennis Matrix — Full Verification Audit", file: "verification.txt" },
  { doc_type: "DISAGREEMENT", title: "Tennis Matrix — Disagreement / Trap Audit", file: "disagreement.txt" },
  { doc_type: "METRICS", title: "Tennis Matrix — Verification Metrics", file: "metrics.txt" },
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
  const existing = await db.select({ id: calibrationVersionsTable.id }).from(calibrationVersionsTable).limit(1);
  if (existing.length > 0) return;

  const graded = CALIBRATION_BUCKETS.reduce((a, b) => a + b.graded, 0);
  const [version] = await db.insert(calibrationVersionsTable).values({
    user_id: userId,
    version_number: 1,
    label: "183 Final Record — baseline",
    master_sequence_count: MASTER_RECORD_START,
    graded_sample_count: graded,
    is_active: true,
  } as never).returning();
  if (!version) return;

  await db.insert(calibrationBucketsTable).values(
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
    })) as never,
  );
}

async function ensureSources() {
  const existing = await db.select({ id: sourceDefinitionsTable.id }).from(sourceDefinitionsTable).limit(1);
  if (existing.length > 0) return;
  await db.insert(sourceDefinitionsTable).values(DEFAULT_SOURCES.map((s) => ({ ...s, supported_data: [] })) as never);
}

async function ensureDocuments() {
  const existing = await db.select({ id: ruleDocumentsTable.id }).from(ruleDocumentsTable).limit(1);
  if (existing.length > 0) return;

  // Read from disk rather than fetched over HTTP. This ran in the browser, where
  // fetch("/seed/metrics.txt") resolved against the page origin; on the server there is no
  // page origin to resolve against, and the files are right there in public/seed.
  for (const seed of SEED_DOCS) {
    let text: string;
    try {
      text = await readFile(join(process.cwd(), "public", "seed", seed.file), "utf8");
    } catch {
      continue;
    }
    await createDocumentVersion({ doc_type: seed.doc_type, title: seed.title, filename: `/seed/${seed.file}`, text, autoActivate: true });
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
    const [doc] = await db.insert(ruleDocumentsTable)
      .values({ doc_type: opts.doc_type, title: opts.title } as never)
      .returning({ id: ruleDocumentsTable.id });
    if (!doc) return null;
    documentId = doc.id;
  }

  const prior = await db.select({ version_number: ruleDocumentVersionsTable.version_number })
    .from(ruleDocumentVersionsTable)
    .where(eq(ruleDocumentVersionsTable.document_id, documentId))
    .orderBy(desc(ruleDocumentVersionsTable.version_number))
    .limit(1);

  const nextNumber = (prior[0]?.version_number ?? 0) + 1;

  const [version] = await db.insert(ruleDocumentVersionsTable)
    .values({
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
    } as never)
    .returning({ id: ruleDocumentVersionsTable.id });
  if (!version) return null;

  const CHUNK = 200;
  for (let i = 0; i < report.rules.length; i += CHUNK) {
    await db.insert(rulesTable).values(
      report.rules.slice(i, i + CHUNK).map((r) => ({
        version_id: version.id,
        rule_code: r.rule_code,
        rule_name: r.rule_name,
        body: r.body,
        severity: r.severity,
        blocking: r.blocking,
        mapping_status: r.mapping_status,
      })) as never,
    );
  }

  if (opts.autoActivate && status === "READY") {
    await activateVersion(documentId, version.id);
  }
  return { documentId, versionId: version.id, report, status };
}

export async function activateVersion(documentId: string, versionId: string) {
  await db.update(ruleDocumentVersionsTable).set({ is_active: false }).where(eq(ruleDocumentVersionsTable.document_id, documentId));
  await db.update(ruleDocumentVersionsTable).set({ is_active: true }).where(eq(ruleDocumentVersionsTable.id, versionId));
  await db.update(ruleDocumentsTable).set({ active_version_id: versionId }).where(eq(ruleDocumentsTable.id, documentId));

  // Rule change invalidation: any run built on an older version is no longer current.
  const [documentRow] = await db.select({ doc_type: ruleDocumentsTable.doc_type })
    .from(ruleDocumentsTable).where(eq(ruleDocumentsTable.id, documentId)).limit(1);
  const column = documentRow?.doc_type ?? "";
  const field =
    column === "VERIFICATION"
      ? "verification_version_id"
      : column === "DISAGREEMENT"
        ? "disagreement_version_id"
        : column === "METRICS"
          ? "metrics_version_id"
          : null;
  if (field) {
    // .neq on a nullable column matched nothing for NULL rows under PostgREST, because
    // SQL's <> is NULL-valued there. ne() emits the same comparison, so a run with no
    // recorded version for this document type stays untouched exactly as before.
    const versionColumn = {
      verification_version_id: auditRunsTable.verification_version_id,
      disagreement_version_id: auditRunsTable.disagreement_version_id,
      metrics_version_id: auditRunsTable.metrics_version_id,
    }[field];
    await db.update(auditRunsTable)
      .set({ status: INVALIDATED_RUN_STATUS, stale_reason: `${column} rule version changed` })
      .where(and(
        ne(versionColumn, versionId),
        inArray(auditRunsTable.status, ["RUNNING", "COMPLETE"]),
      ));
  }
}
