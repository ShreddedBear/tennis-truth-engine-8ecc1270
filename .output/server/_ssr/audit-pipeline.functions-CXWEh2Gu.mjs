import { t as matchResultIsFinal } from "./match-result-resolution-BrkpAhxT.mjs";
import { i as createServerFn } from "./server-KPZuT5q2.mjs";
import { t as createServerRpc } from "./createServerRpc-BLr1vCfx.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/audit-pipeline.functions-CXWEh2Gu.js
var BROWSER_SAFE_BUDGET_MS = 2e4;
var BROWSER_BATCH_PIPELINE_BUDGET_MS = 7500;
var BROWSER_BATCH_RESPONSE_BUDGET_MS = 12e3;
var BROWSER_BATCH_CONCURRENCY = 2;
var runAuditPipeline_createServerFn_handler = createServerRpc({
	id: "4ac1941ab3557ba306ca902e2bfcfb57bd1f3047e44521e86af2d674e716cf45",
	name: "runAuditPipeline",
	filename: "src/lib/audit-pipeline.functions.ts"
}, (opts) => runAuditPipeline.__executeServer(opts));
var runAuditPipeline = createServerFn({ method: "POST" }).inputValidator((data) => {
	if (!data || typeof data.matchId !== "string" || data.matchId.length < 10) throw new Error("matchId is required");
	return {
		matchId: data.matchId,
		budgetMs: data.budgetMs
	};
}).handler(runAuditPipeline_createServerFn_handler, async ({ data }) => {
	const [{ makeDeps }, pipeline] = await Promise.all([import("./audit-repo.server-D3WminbK.mjs"), import("./audit-pipeline-DMtBExXh.mjs")]);
	const { runPipeline } = pipeline;
	const deps = await makeDeps();
	try {
		const result = await runPipeline(deps, data.matchId, { budgetMs: data.budgetMs ?? BROWSER_SAFE_BUDGET_MS });
		return {
			ok: true,
			runId: result.runId,
			complete: result.complete,
			nextStage: result.nextStage,
			stages: result.stages,
			failures: result.failures,
			leaseHeld: result.leaseHeld ?? false,
			color: result.report?.color ?? null,
			completionPercent: result.report?.completionPercent ?? null,
			auditComplete: result.report?.auditComplete ?? false
		};
	} catch (error) {
		return {
			ok: false,
			runId: null,
			complete: false,
			nextStage: null,
			stages: [],
			failures: [{
				stage: "PIPELINE",
				message: error instanceof Error ? error.message : String(error)
			}],
			color: null,
			completionPercent: null,
			auditComplete: false
		};
	}
});
function validateDriveAuditBatchInput(data) {
	const matchIds = Array.isArray(data?.matchIds) ? [...new Set(data.matchIds.filter((id) => typeof id === "string" && id.length >= 10))].slice(0, 100) : [];
	if (!matchIds.length) throw new Error("At least one matchId is required");
	const maxResponseWaitMs = Number.isFinite(data.maxResponseWaitMs) ? Math.min(6e4, Math.max(1e3, Math.floor(Number(data.maxResponseWaitMs)))) : void 0;
	return {
		matchIds,
		budgetMs: data.budgetMs,
		concurrency: Math.min(4, Math.max(1, Math.floor(data.concurrency ?? 3))),
		maxResponseWaitMs
	};
}
async function driveAuditBatch(rawData) {
	const data = validateDriveAuditBatchInput(rawData);
	const batchId = `batch-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
	const startedAt = Date.now();
	const [{ makeDeps }, pipeline, { mapBounded, waitForBoundedResult }] = await Promise.all([
		import("./audit-repo.server-D3WminbK.mjs"),
		import("./audit-pipeline-DMtBExXh.mjs"),
		import("./audit-batch-DrO2lEKU.mjs")
	]);
	const deps = await makeDeps();
	const applyMetaIfReady = async (matchId, runId) => {
		const stages = await deps.getStages(runId);
		if (stages.find((s) => s.stage === "P1 METRIC EXECUTION")?.status !== "COMPLETE" || stages.find((s) => s.stage === "P2 METRIC EXECUTION")?.status !== "COMPLETE") return false;
		const { applySafeMetaDerivedMetrics, applySafeStressDerivedMetrics } = await import("./meta-derived-evidence.server-COP3pmmu.mjs");
		const metricChanged = await applySafeMetaDerivedMetrics(deps, runId);
		let pathwayChanged = false, stressChanged = false, advancedChanged = false;
		if (stages.find((s) => s.stage === "DANGEROUS UNDERDOG AUDIT")?.status === "COMPLETE") {
			const match = await deps.getMatch(matchId);
			if (match) {
				const { applyOpponentWinPathwaysMetric } = await import("./opponent-win-pathways-meta.server-DhsbNQu1.mjs");
				pathwayChanged = await applyOpponentWinPathwaysMetric(deps, runId, match.player1_name, match.player2_name);
			}
		}
		if (stages.find((s) => s.stage === "STRESS / REMOVAL TESTS")?.status === "COMPLETE") {
			stressChanged = await applySafeStressDerivedMetrics(deps, runId);
			const { applyFinalAdvancedMetric } = await import("./final-advanced-meta.server-A1l_ORmL.mjs");
			advancedChanged = await applyFinalAdvancedMetric(deps, runId, matchId);
		}
		const changed = metricChanged || pathwayChanged || stressChanged || advancedChanged;
		const resultFacts = await deps.getMatch(matchId);
		const resultKnown = resultFacts ? matchResultIsFinal({
			result_status: resultFacts.result_status ?? null,
			actual_winner: resultFacts.actual_winner ?? null,
			player1_name: resultFacts.player1_name,
			player2_name: resultFacts.player2_name
		}) : false;
		if (changed && resultKnown) return false;
		const closingStages = [
			"COVERAGE PERSISTENCE / EVIDENCE VALIDATION",
			"FINAL DECISION",
			"FINAL COMBINATION GATE"
		];
		const anyClosingStageComplete = closingStages.some((stage) => stages.find((s) => s.stage === stage)?.status === "COMPLETE");
		if (changed && anyClosingStageComplete) {
			for (const stage of closingStages) if (stages.find((s) => s.stage === stage)) await deps.setStage(runId, matchId, stage, {
				status: "PENDING",
				done_count: 0,
				total_count: 1,
				error_code: null,
				error_message: null,
				finished_at: null
			});
			await deps.updateRun(runId, { status: "RUNNING" });
			return true;
		}
		return false;
	};
	const prepared = await mapBounded(data.matchIds, 4, async (matchId) => {
		try {
			return {
				matchId,
				run: await pipeline.preparePipelineRun(deps, matchId),
				error: null
			};
		} catch (error) {
			return {
				matchId,
				run: null,
				error: error instanceof Error ? error.message : String(error)
			};
		}
	});
	const scheduled = prepared.filter((item) => item.run && item.run.status !== "COMPLETE").sort((a, b) => (Date.parse(String(a.run?.heartbeat_at ?? "")) || 0) - (Date.parse(String(b.run?.heartbeat_at ?? "")) || 0)).slice(0, data.concurrency);
	const completedDriven = [];
	const drivenWork = mapBounded(scheduled, data.concurrency, async ({ matchId }) => {
		const itemStarted = Date.now();
		let completed;
		try {
			const result = await pipeline.runPipeline(deps, matchId, { budgetMs: data.budgetMs ?? BROWSER_SAFE_BUDGET_MS });
			let reopened = false;
			if (!result.leaseHeld && deps.acquireRunLease && deps.releaseRunLease) {
				const metaOwner = `audit-meta:${batchId}:${matchId}`;
				if (await deps.acquireRunLease(result.runId, metaOwner, 6e5)) try {
					reopened = await applyMetaIfReady(matchId, result.runId);
				} finally {
					await deps.releaseRunLease(result.runId, metaOwner);
				}
			}
			completed = {
				matchId,
				ok: true,
				runId: result.runId,
				complete: reopened ? false : result.complete,
				nextStage: reopened ? "COVERAGE PERSISTENCE / EVIDENCE VALIDATION" : result.nextStage,
				leaseHeld: result.leaseHeld ?? false,
				failures: result.failures,
				color: result.report?.color ?? null,
				completionPercent: result.report?.completionPercent ?? null,
				auditComplete: reopened ? false : result.report?.auditComplete ?? false,
				durationMs: Date.now() - itemStarted
			};
		} catch (error) {
			completed = {
				matchId,
				ok: false,
				runId: (await deps.getLatestRun(matchId).catch(() => null))?.id ?? null,
				complete: false,
				nextStage: null,
				leaseHeld: false,
				failures: [{
					stage: "PIPELINE",
					message: error instanceof Error ? error.message : String(error)
				}],
				color: null,
				completionPercent: null,
				auditComplete: false,
				durationMs: Date.now() - itemStarted
			};
		}
		completedDriven.push(completed);
		return completed;
	});
	const bounded = data.maxResponseWaitMs ? await waitForBoundedResult(drivenWork, data.maxResponseWaitMs) : {
		timedOut: false,
		value: await drivenWork
	};
	const driven = bounded.timedOut ? [...completedDriven] : bounded.value;
	const drivenByMatch = new Map(driven.map((item) => [item.matchId, item]));
	const results = prepared.map((item) => {
		const completed = drivenByMatch.get(item.matchId);
		if (completed) return completed;
		if (item.error || !item.run) return {
			matchId: item.matchId,
			ok: false,
			runId: null,
			complete: false,
			nextStage: null,
			leaseHeld: false,
			failures: [{
				stage: "PIPELINE",
				message: item.error ?? "Could not persist queued audit run"
			}],
			color: null,
			completionPercent: null,
			auditComplete: false,
			durationMs: 0
		};
		return {
			matchId: item.matchId,
			ok: true,
			runId: item.run.id,
			complete: item.run.status === "COMPLETE",
			nextStage: item.run.status === "COMPLETE" ? null : "MATCH INGESTION / PDF EXTRACTION",
			leaseHeld: false,
			failures: [],
			color: null,
			completionPercent: null,
			auditComplete: item.run.status === "COMPLETE",
			durationMs: 0
		};
	});
	const complete = results.filter((item) => item.complete).length, blocked = results.filter((item) => !item.ok || item.failures?.length).length, leased = results.filter((item) => item.leaseHeld).length;
	console.info("[audit-batch]", {
		batchId,
		total: data.matchIds.length,
		complete,
		blocked,
		leased,
		durationMs: Date.now() - startedAt
	});
	return {
		ok: blocked === 0,
		batchId,
		total: data.matchIds.length,
		complete,
		blocked,
		leased,
		active: data.matchIds.length - complete - blocked,
		results,
		durationMs: Date.now() - startedAt
	};
}
var runAuditBatch_createServerFn_handler = createServerRpc({
	id: "3d40c218fbacab19778ea8b58d7abfcdcb3d70e497136a0667d21247dbc1bbe1",
	name: "runAuditBatch",
	filename: "src/lib/audit-pipeline.functions.ts"
}, (opts) => runAuditBatch.__executeServer(opts));
var runAuditBatch = createServerFn({ method: "POST" }).inputValidator((data) => data).handler(runAuditBatch_createServerFn_handler, async ({ data }) => driveAuditBatch({
	...data,
	concurrency: Math.min(data.concurrency ?? BROWSER_BATCH_CONCURRENCY, BROWSER_BATCH_CONCURRENCY),
	budgetMs: Math.min(data.budgetMs ?? BROWSER_BATCH_PIPELINE_BUDGET_MS, BROWSER_BATCH_PIPELINE_BUDGET_MS),
	maxResponseWaitMs: BROWSER_BATCH_RESPONSE_BUDGET_MS
}));
//#endregion
export { runAuditBatch_createServerFn_handler, runAuditPipeline_createServerFn_handler };
