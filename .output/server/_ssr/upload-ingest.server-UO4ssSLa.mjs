import { a as eq, c as inArray, r as desc } from "../_libs/drizzle-orm.mjs";
import { t as db } from "./client.server-B14ewPcb.mjs";
import { i as auditStageRunsTable } from "./audit-ChUwSBsg.mjs";
import { s as matchesTable } from "./matches-CtYuxOLN.mjs";
import { a as parsedSummaryFieldsTable, c as summaryVersionsTable, s as summaryUploadsTable } from "./uploads-vW6NguTg.mjs";
import { t as log } from "./audit-runs.server-BHLIQ7ng.mjs";
import { t as canonicalKey } from "./summary-parser-DFGrtQjO.mjs";
import { a as samePair, i as nameTokens, n as compatible, r as dedupeMatchups } from "./upload-matchup-DXRU6OrM.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/upload-ingest.server-UO4ssSLa.js
var message = (error) => error instanceof Error ? error.message : String(error);
var fieldValue = (m, key) => m.fields.find((f) => f.field_key === key)?.normalized_value ?? "";
/**
* Finds an existing match this parsed matchup should attach to, rather than creating a
* duplicate. Exact canonical_key first, then the same player pair with compatible context,
* then a lone pair match when neither side carries conflicting context.
*/
async function findReusable(m, key) {
	const [exact] = await db.select().from(matchesTable).where(eq(matchesTable.canonical_key, key)).limit(1);
	if (exact) return exact;
	const candidates = await db.select().from(matchesTable).orderBy(desc(matchesTable.created_at)).limit(500);
	const date = fieldValue(m, "scheduled_date");
	const tour = fieldValue(m, "tournament");
	const round = fieldValue(m, "round");
	const pairMatches = candidates.filter((c) => samePair(c.player1_name, c.player2_name, m.player1_name, m.player2_name));
	const contextual = pairMatches.find((c) => compatible(c.scheduled_date, date) && compatible(c.tournament_name, tour) && compatible(c.round, round));
	if (contextual) return contextual;
	if (pairMatches.length === 1 && (!date || !pairMatches[0].scheduled_date) && (!tour || !pairMatches[0].tournament_name)) return pairMatches[0];
	return null;
}
async function ingestStagedFiles(files) {
	let created = 0;
	let versions = 0;
	let reused = 0;
	const matchIds = /* @__PURE__ */ new Set();
	const failures = [];
	for (const file of files) {
		let upload;
		try {
			[upload] = await db.insert(summaryUploadsTable).values({
				filename: file.filename,
				page_count: file.pages.length,
				parse_status: "COMPLETE",
				raw_text: file.pages.join("\n\f\n")
			}).returning({ id: summaryUploadsTable.id });
		} catch (error) {
			failures.push({
				stage: "SUMMARY UPLOAD DATABASE WRITE",
				message: message(error),
				file: file.filename
			});
			continue;
		}
		if (!upload) continue;
		const uploadId = upload.id;
		for (const m of dedupeMatchups(file.matchups)) {
			const matchLabel = `${m.player1_name} vs ${m.player2_name}`;
			try {
				const key = canonicalKey({
					tournament: fieldValue(m, "tournament") || null,
					round: fieldValue(m, "round") || null,
					date: fieldValue(m, "scheduled_date") || null,
					p1: m.player1_name,
					p2: m.player2_name
				});
				const existing = await findReusable(m, key);
				let matchId = existing?.id;
				if (existing) {
					reused++;
					const patch = {};
					if (nameTokens(m.player1_name).length > nameTokens(existing.player1_name).length) patch.player1_name = m.player1_name;
					if (nameTokens(m.player2_name).length > nameTokens(existing.player2_name).length) patch.player2_name = m.player2_name;
					const tv = fieldValue(m, "tournament"), ev = fieldValue(m, "event_level"), rv = fieldValue(m, "round");
					const dv = fieldValue(m, "scheduled_date"), sv = fieldValue(m, "surface"), bv = Number(fieldValue(m, "best_of"));
					if (tv && tv !== existing.tournament_name) patch.tournament_name = tv;
					if (ev && ev !== existing.event_level) patch.event_level = ev;
					if (rv && rv !== existing.round) patch.round = rv;
					if (dv && dv !== existing.scheduled_date) patch.scheduled_date = dv;
					if (sv && sv !== existing.surface) patch.surface = sv;
					if (bv && bv !== existing.best_of) patch.best_of = bv;
					if (Object.keys(patch).length) await db.update(matchesTable).set(patch).where(eq(matchesTable.id, existing.id));
				}
				if (!matchId) {
					const [match] = await db.insert(matchesTable).values({
						canonical_key: key,
						player1_name: m.player1_name,
						player2_name: m.player2_name,
						tournament_name: fieldValue(m, "tournament") || null,
						event_level: fieldValue(m, "event_level") || null,
						round: fieldValue(m, "round") || null,
						scheduled_date: fieldValue(m, "scheduled_date") || null,
						surface: fieldValue(m, "surface") || null,
						best_of: Number(fieldValue(m, "best_of")) || null
					}).returning({ id: matchesTable.id });
					matchId = match?.id;
					if (matchId) created++;
				}
				if (!matchId) throw new Error("Match row was not created or reused");
				const priorVersions = await db.select({
					id: summaryVersionsTable.id,
					version_number: summaryVersionsTable.version_number
				}).from(summaryVersionsTable).where(eq(summaryVersionsTable.match_id, matchId)).orderBy(desc(summaryVersionsTable.version_number));
				if (priorVersions.length) await db.update(summaryVersionsTable).set({ is_active: false }).where(eq(summaryVersionsTable.match_id, matchId));
				const [version] = await db.insert(summaryVersionsTable).values({
					match_id: matchId,
					upload_id: uploadId,
					version_number: (priorVersions[0]?.version_number ?? 0) + 1,
					page_number: m.page_number,
					is_active: true
				}).returning({ id: summaryVersionsTable.id });
				if (!version) throw new Error("Summary version was not created");
				versions++;
				await db.update(matchesTable).set({
					active_summary_version_id: version.id,
					canonical_key: key
				}).where(eq(matchesTable.id, matchId));
				if (m.fields.length) await db.insert(parsedSummaryFieldsTable).values(m.fields.map((f) => ({
					summary_version_id: version.id,
					field_key: f.field_key,
					raw_value: f.raw_value,
					normalized_value: f.normalized_value,
					extraction_status: f.extraction_status,
					confidence: f.confidence,
					page_number: f.page_number
				})));
				await log({
					match_id: matchId,
					stage: "SUMMARY PDF INGESTION",
					status: "COMPLETE",
					output: {
						file: file.filename,
						page: m.page_number,
						source: file.source
					}
				});
				matchIds.add(matchId);
			} catch (error) {
				failures.push({
					stage: "MATCH INGESTION",
					message: message(error),
					file: file.filename,
					match: matchLabel
				});
			}
		}
	}
	return {
		created,
		reused,
		versions,
		matchIds: [...matchIds],
		failures
	};
}
/** Stage rows for a set of audit runs, for the upload screen's batch progress bar. */
async function loadStageProgress(runIds) {
	if (!runIds.length) return [];
	return db.select({
		audit_run_id: auditStageRunsTable.audit_run_id,
		stage: auditStageRunsTable.stage,
		status: auditStageRunsTable.status,
		done_count: auditStageRunsTable.done_count,
		total_count: auditStageRunsTable.total_count
	}).from(auditStageRunsTable).where(inArray(auditStageRunsTable.audit_run_id, runIds));
}
//#endregion
export { ingestStagedFiles, loadStageProgress };
