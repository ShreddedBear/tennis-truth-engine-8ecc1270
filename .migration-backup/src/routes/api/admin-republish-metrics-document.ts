import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { parseRuleDocument, activationStatus } from "@/lib/rule-parser";

// One-off admin endpoint to republish the canonical METRICS rule document
// after fixing the numbering collision in public/seed/metrics.txt (Task 19).
// src/lib/bootstrap.ts only ever seeds rule_documents once, when the table is
// empty — production's METRICS document already exists, so the corrected
// seed file alone never reaches it without an explicit new version + activation.
const ADMIN_KEY = "T19-REPUBLISH-9f2c7a1e";
const db = supabaseAdmin as any;

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
          const { data: doc, error: docError } = await db
            .from("rule_documents")
            .select("id, active_version_id")
            .eq("doc_type", "METRICS")
            .maybeSingle();
          if (docError) return json({ ok: false, error: `rule_documents lookup: ${docError.message}` }, 500);
          if (!doc) return json({ ok: false, error: "No METRICS rule_documents row found" }, 500);

          const { data: activeVersion, error: versionError } = await db
            .from("rule_document_versions")
            .select("id, version_number, user_id")
            .eq("id", doc.active_version_id)
            .maybeSingle();
          if (versionError) return json({ ok: false, error: `active version lookup: ${versionError.message}` }, 500);
          if (!activeVersion) return json({ ok: false, error: "No active METRICS version found" }, 500);

          const { data: currentRules, error: rulesError } = await db
            .from("rules")
            .select("rule_code, rule_name")
            .eq("version_id", activeVersion.id);
          if (rulesError) return json({ ok: false, error: `current rules lookup: ${rulesError.message}` }, 500);
          const currentByCode = new Map<string, string>((currentRules ?? []).map((r: any) => [r.rule_code, r.rule_name]));

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
          const { data: newVersion, error: insertVersionError } = await db
            .from("rule_document_versions")
            .insert({
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
            })
            .select()
            .single();
          if (insertVersionError || !newVersion) return json({ ok: false, error: `version insert failed: ${insertVersionError?.message}` }, 500);

          const CHUNK = 200;
          for (let i = 0; i < report.rules.length; i += CHUNK) {
            const { error: rulesInsertError } = await db.from("rules").insert(
              report.rules.slice(i, i + CHUNK).map((r) => ({
                version_id: newVersion.id,
                rule_code: r.rule_code,
                rule_name: r.rule_name,
                body: r.body,
                severity: r.severity,
                blocking: r.blocking,
                mapping_status: r.mapping_status,
                user_id: activeVersion.user_id,
              })),
            );
            if (rulesInsertError) return json({ ok: false, error: `rules insert failed: ${rulesInsertError.message}`, new_version_id: newVersion.id, activated: false }, 500);
          }

          await db.from("rule_document_versions").update({ is_active: false }).eq("document_id", doc.id);
          await db.from("rule_document_versions").update({ is_active: true }).eq("id", newVersion.id);
          await db.from("rule_documents").update({ active_version_id: newVersion.id }).eq("id", doc.id);
          const { error: invalidateError } = await db
            .from("audit_runs")
            .update({ status: "INVALIDATED — RERUN REQUIRED", stale_reason: "METRICS rule version changed" })
            .neq("metrics_version_id", newVersion.id)
            .in("status", ["RUNNING", "COMPLETE"]);

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
