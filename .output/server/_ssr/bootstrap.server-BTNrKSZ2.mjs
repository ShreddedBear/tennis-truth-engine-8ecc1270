import { n as INVALIDATED_RUN_STATUS } from "./audit-stages-Dphii188.mjs";
import { n as CALIBRATION_BUCKETS, r as DEFAULT_SOURCES } from "./constants-DloZsw4H.mjs";
import { a as eq, c as inArray, i as and, p as ne, r as desc } from "../_libs/drizzle-orm.mjs";
import { t as db } from "./client.server-B14ewPcb.mjs";
import { r as auditRunsTable } from "./audit-ChUwSBsg.mjs";
import { r as calibrationVersionsTable, t as calibrationBucketsTable } from "./calibration-BTgOpQAP.mjs";
import { a as ruleDocumentsTable, i as ruleDocumentVersionsTable, o as rulesTable } from "./rules-DxX2ibUx.mjs";
import { u as sourceDefinitionsTable } from "./sources-B3f820Qo.mjs";
import { n as parseRuleDocument, t as activationStatus } from "./rule-parser-C8eUSSnG.mjs";
import { join } from "node:path";
import { readFile } from "node:fs/promises";
//#region node_modules/.nitro/vite/services/ssr/assets/bootstrap.server-BTNrKSZ2.js
var SEED_DOCS = [
	{
		doc_type: "VERIFICATION",
		title: "Tennis Matrix — Full Verification Audit",
		file: "verification.txt"
	},
	{
		doc_type: "DISAGREEMENT",
		title: "Tennis Matrix — Disagreement / Trap Audit",
		file: "disagreement.txt"
	},
	{
		doc_type: "METRICS",
		title: "Tennis Matrix — Verification Metrics",
		file: "metrics.txt"
	}
];
var bootstrapPromise = null;
async function ensureBootstrapped(userId) {
	if (!bootstrapPromise) bootstrapPromise = (async () => {
		await ensureCalibration(userId);
		await ensureSources();
		await ensureDocuments();
	})();
	return bootstrapPromise;
}
async function ensureCalibration(userId) {
	if ((await db.select({ id: calibrationVersionsTable.id }).from(calibrationVersionsTable).limit(1)).length > 0) return;
	const graded = CALIBRATION_BUCKETS.reduce((a, b) => a + b.graded, 0);
	const [version] = await db.insert(calibrationVersionsTable).values({
		user_id: userId,
		version_number: 1,
		label: "183 Final Record — baseline",
		master_sequence_count: 183,
		graded_sample_count: graded,
		is_active: true
	}).returning();
	if (!version) return;
	await db.insert(calibrationBucketsTable).values(CALIBRATION_BUCKETS.map((b) => ({
		user_id: userId,
		calibration_version_id: version.id,
		bucket_code: b.code,
		bucket_label: b.label,
		wp_min: b.min,
		wp_max: b.max,
		wins: b.wins,
		graded: b.graded,
		small_sample: b.graded < 10
	})));
}
async function ensureSources() {
	if ((await db.select({ id: sourceDefinitionsTable.id }).from(sourceDefinitionsTable).limit(1)).length > 0) return;
	await db.insert(sourceDefinitionsTable).values(DEFAULT_SOURCES.map((s) => ({
		...s,
		supported_data: []
	})));
}
async function ensureDocuments() {
	if ((await db.select({ id: ruleDocumentsTable.id }).from(ruleDocumentsTable).limit(1)).length > 0) return;
	for (const seed of SEED_DOCS) {
		let text;
		try {
			text = await readFile(join(process.cwd(), "public", "seed", seed.file), "utf8");
		} catch {
			continue;
		}
		await createDocumentVersion({
			doc_type: seed.doc_type,
			title: seed.title,
			filename: `/seed/${seed.file}`,
			text,
			autoActivate: true
		});
	}
}
async function createDocumentVersion(opts) {
	const report = parseRuleDocument(opts.text);
	const status = activationStatus(report);
	let documentId = opts.documentId;
	if (!documentId) {
		const [doc] = await db.insert(ruleDocumentsTable).values({
			doc_type: opts.doc_type,
			title: opts.title
		}).returning({ id: ruleDocumentsTable.id });
		if (!doc) return null;
		documentId = doc.id;
	}
	const nextNumber = ((await db.select({ version_number: ruleDocumentVersionsTable.version_number }).from(ruleDocumentVersionsTable).where(eq(ruleDocumentVersionsTable.document_id, documentId)).orderBy(desc(ruleDocumentVersionsTable.version_number)).limit(1))[0]?.version_number ?? 0) + 1;
	const [version] = await db.insert(ruleDocumentVersionsTable).values({
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
		is_active: false
	}).returning({ id: ruleDocumentVersionsTable.id });
	if (!version) return null;
	const CHUNK = 200;
	for (let i = 0; i < report.rules.length; i += CHUNK) await db.insert(rulesTable).values(report.rules.slice(i, i + CHUNK).map((r) => ({
		version_id: version.id,
		rule_code: r.rule_code,
		rule_name: r.rule_name,
		body: r.body,
		severity: r.severity,
		blocking: r.blocking,
		mapping_status: r.mapping_status
	})));
	if (opts.autoActivate && status === "READY") await activateVersion(documentId, version.id);
	return {
		documentId,
		versionId: version.id,
		report,
		status
	};
}
async function activateVersion(documentId, versionId) {
	await db.update(ruleDocumentVersionsTable).set({ is_active: false }).where(eq(ruleDocumentVersionsTable.document_id, documentId));
	await db.update(ruleDocumentVersionsTable).set({ is_active: true }).where(eq(ruleDocumentVersionsTable.id, versionId));
	await db.update(ruleDocumentsTable).set({ active_version_id: versionId }).where(eq(ruleDocumentsTable.id, documentId));
	const [documentRow] = await db.select({ doc_type: ruleDocumentsTable.doc_type }).from(ruleDocumentsTable).where(eq(ruleDocumentsTable.id, documentId)).limit(1);
	const column = documentRow?.doc_type ?? "";
	const field = column === "VERIFICATION" ? "verification_version_id" : column === "DISAGREEMENT" ? "disagreement_version_id" : column === "METRICS" ? "metrics_version_id" : null;
	if (field) {
		const versionColumn = {
			verification_version_id: auditRunsTable.verification_version_id,
			disagreement_version_id: auditRunsTable.disagreement_version_id,
			metrics_version_id: auditRunsTable.metrics_version_id
		}[field];
		await db.update(auditRunsTable).set({
			status: INVALIDATED_RUN_STATUS,
			stale_reason: `${column} rule version changed`
		}).where(and(ne(versionColumn, versionId), inArray(auditRunsTable.status, ["RUNNING", "COMPLETE"])));
	}
}
//#endregion
export { ensureBootstrapped };
