import { createFileRoute } from "@tanstack/react-router";
import { and, eq, inArray, ne } from "drizzle-orm";

import { db } from "@/db/client.server";
import { auditRunsTable, ruleDocumentVersionsTable, ruleDocumentsTable, rulesTable } from "@/db/schema";
import { tryQuery } from "@/db/try-query";
import { parseRuleDocument, activationStatus } from "@/lib/rule-parser";

// One-off admin endpoint to republish the canonical METRICS rule document
// after fixing the numbering collision in public/seed/metrics.txt (Task 19).
// src/lib/bootstrap.ts only ever seeds rule_documents once, when the table is
// empty — production's METRICS document already exists, so the corrected
// seed file alone never reaches it without an explicit new version + activation.
const ADMIN_KEY = "T19-REPUBLISH-9f2c7a1e";

// Codes whose name is EXPECTED to change (the known parser-collision fix).
// Any other changed code trips the safety refusal unless force=true.
const EXPECTED_CHANGED_CODES = new Set(["004", "005", "006"]);

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

export const Route = createFileRoute("/api/admin-republish-metrics-document")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.get("key") !== ADMIN_KEY) return json({ ok: false }, 404);
        const commit = url.searchParams.get("commit") === "true";
        const force = url.searchParams.get("force") === "true";

        try {
          const docResult = await tryQuery(() => db
            .select({ id: ruleDocumentsTable.id, active_version_id: ruleDocumentsTable.active_version_id })
            .from(ruleDocumentsTable)
            .where(eq(ruleDocumentsTable.doc_type, "METRICS"))
            .limit(1));
          if (docResult.error) return json({ ok: false, error: `rule_documents lookup: ${docResult.error.message}` }, 500);
          const doc = docResult.data?.[0];
          if (!doc) return json({ ok: false, error: "No METRICS rule_documents row found" }, 500);

          // active_version_id is nullable, and a null one means "no active version" --
          // the same outcome the old .eq(id, null) produced (PostgREST matched nothing),
          // just reached without issuing a query.
          const activeVersionId = doc.active_version_id;
          const versionResult = activeVersionId
            ? await tryQuery(() => db
                .select({ id: ruleDocumentVersionsTable.id, version_number: ruleDocumentVersionsTable.version_number, user_id: ruleDocumentVersionsTable.user_id })
                .from(ruleDocumentVersionsTable)
                .where(eq(ruleDocumentVersionsTable.id, activeVersionId))
                .limit(1))
            : { data: [], error: null };
          if (versionResult.error) return json({ ok: false, error: `active version lookup: ${versionResult.error.message}` }, 500);
          const activeVersion = versionResult.data?.[0];
          if (!activeVersion) return json({ ok: false, error: "No active METRICS version found" }, 500);

          const { data: currentRules, error: rulesError } = await tryQuery(() => db
            .select({ rule_code: rulesTable.rule_code, rule_name: rulesTable.rule_name })
            .from(rulesTable)
            .where(eq(rulesTable.version_id, activeVersion.id)));
          if (rulesError) return json({ ok: false, error: `current rules lookup: ${rulesError.message}` }, 500);
          const currentByCode = new Map<string, string>((currentRules ?? []).map((r) => [r.rule_code, r.rule_name]));

          const seedUrl = new URL("/seed/metrics.txt", request.url);
          const seedRes = await fetch(seedUrl);
          if (!seedRes.ok) return json({ ok: false, error: `Could not fetch ${seedUrl}: HTTP ${seedRes.status}` }, 500);
          const text = await seedRes.text();

          const report = parseRuleDocument(text);
          const status = activationStatus(report);
          if (report.parsed_rules !== 81 || report.expected_rules !== 81 || status !== "READY") {
            return json({
              ok: false,
              error: "Corrected seed document did not parse to a clean 81-rule READY document; refusing to publish.",
              parsed_rules: report.parsed_rules,
              expected_rules: report.expected_rules,
              activation_status: status,
              ambiguous: report.ambiguous,
            }, 500);
          }

          const newByCode = new Map(report.rules.map((r) => [r.rule_code, r.rule_name]));
          const diff: Array<{ code: string; old_name: string | null; new_name: string }> = [];
          for (const [code, newName] of newByCode) {
            const oldName = currentByCode.get(code) ?? null;
            if (oldName !== newName) diff.push({ code, old_name: oldName, new_name: newName });
          }
          const unexpectedChanges = diff.filter((d) => !EXPECTED_CHANGED_CODES.has(d.code));

          if (!commit) {
            return json({
              ok: true,
              dry_run: true,
              current_document_id: doc.id,
              current_active_version_id: doc.active_version_id,
              parsed_rules: report.parsed_rules,
              activation_status: status,
              diff,
              unexpected_changes: unexpectedChanges,
              would_publish: unexpectedChanges.length === 0 || force,
              note: "Pass commit=true to publish. If unexpected_changes is non-empty, also pass force=true after reviewing them.",
            });
          }

          if (unexpectedChanges.length > 0 && !force) {
            return json({
              ok: false,
              error: "Refusing to commit: changes beyond the expected 004/005/006 fix were detected. Re-run with force=true only after reviewing unexpected_changes.",
              diff,
              unexpected_changes: unexpectedChanges,
            }, 409);
          }

          const nextNumber = (activeVersion.version_number ?? 0) + 1;
          const insertVersionResult = await tryQuery(() => db
            .insert(ruleDocumentVersionsTable)
            .values({
              document_id: doc.id,
              version_number: nextNumber,
              source_filename: "/seed/metrics.txt",
              raw_text: text,
              pages_detected: report.pages_detected,
              headings_detected: report.headings_detected,
              expected_rules: report.expected_rules,
              parsed_rules: report.parsed_rules,
              unmapped_rules: report.unmapped_rules,
              parser_confidence: report.parser_confidence,
              activation_status: status,
              is_active: false,
              user_id: activeVersion.user_id,
            } as never)
            .returning());
          const newVersion = insertVersionResult.data?.[0];
          if (insertVersionResult.error || !newVersion) return json({ ok: false, error: `version insert failed: ${insertVersionResult.error?.message}` }, 500);

          const CHUNK = 200;
          for (let i = 0; i < report.rules.length; i += CHUNK) {
            const { error: rulesInsertError } = await tryQuery(() => db.insert(rulesTable).values(
              report.rules.slice(i, i + CHUNK).map((r) => ({
                version_id: newVersion.id,
                rule_code: r.rule_code,
                rule_name: r.rule_name,
                body: r.body,
                severity: r.severity,
                blocking: r.blocking,
                mapping_status: r.mapping_status,
                user_id: activeVersion.user_id,
              })) as never,
            ).returning({ id: rulesTable.id }));
            if (rulesInsertError) return json({ ok: false, error: `rules insert failed: ${rulesInsertError.message}`, new_version_id: newVersion.id, activated: false }, 500);
          }

          await db.update(ruleDocumentVersionsTable).set({ is_active: false }).where(eq(ruleDocumentVersionsTable.document_id, doc.id));
          await db.update(ruleDocumentVersionsTable).set({ is_active: true }).where(eq(ruleDocumentVersionsTable.id, newVersion.id));
          await db.update(ruleDocumentsTable).set({ active_version_id: newVersion.id }).where(eq(ruleDocumentsTable.id, doc.id));
          // .neq() on a NULLABLE column: PostgREST emitted `metrics_version_id <> $1`,
          // which is NULL -- and therefore NOT matched -- for runs whose metrics_version_id
          // is null. ne() emits the same comparison, so runs with no recorded metrics
          // version stay untouched exactly as before.
          const { error: invalidateError } = await tryQuery(() => db
            .update(auditRunsTable)
            .set({ status: "INVALIDATED — RERUN REQUIRED", stale_reason: "METRICS rule version changed" })
            .where(and(
              ne(auditRunsTable.metrics_version_id, newVersion.id),
              inArray(auditRunsTable.status, ["RUNNING", "COMPLETE"]),
            ))
            .returning({ id: auditRunsTable.id }));

          return json({
            ok: true,
            dry_run: false,
            committed: true,
            old_version_id: doc.active_version_id,
            new_version_id: newVersion.id,
            new_version_number: newVersion.version_number,
            diff,
            unexpected_changes: unexpectedChanges,
            forced: force && unexpectedChanges.length > 0,
            audit_runs_invalidation_error: invalidateError?.message ?? null,
          });
        } catch (error) {
          return json({ ok: false, error: error instanceof Error ? error.message : String(error) }, 500);
        }
      },
    },
  },
});
