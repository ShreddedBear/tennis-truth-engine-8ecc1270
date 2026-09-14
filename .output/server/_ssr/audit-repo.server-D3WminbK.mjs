import { r as STAGES } from "./audit-stages-Dphii188.mjs";
import { i as LOCAL_WORKSPACE_ID } from "./constants-DloZsw4H.mjs";
import { s as __exportAll } from "./server-KPZuT5q2.mjs";
import { t as loadRuntimeIndex } from "./ssr.mjs";
import { A as getTableName, M as pgEnum, P as is, _ as uuid, a as eq, c as inArray, f as lte, g as pgTable, h as PgTable, i as and, k as sql, l as isNotNull, n as asc, r as desc } from "../_libs/drizzle-orm.mjs";
import { t as db } from "./client.server-B14ewPcb.mjs";
import { n as isoTimestamp } from "./columns-DdiGZMmP.mjs";
import { t as createInsertSchema } from "../_libs/drizzle-zod+zod.mjs";
import { a as insertAutopsiesSchema, c as insertDisagreementResultsSchema, d as insertUnderdogResultsSchema, f as insertVerificationResultsSchema, g as verificationResultsTable, h as underdogResultsTable, i as disagreementResultsTable, l as insertReconstructionResultsSchema, m as stressResultsTable, n as autopsyFindingsTable, o as insertAutopsyFindingsSchema, p as reconstructionResultsTable, r as blockReasonsTable, s as insertBlockReasonsSchema, t as autopsiesTable, u as insertStressResultsSchema } from "./analysis-y60jAvTu.mjs";
import { a as batchIntegrityChecksTable, c as insertAuditCoverageSchema, d as insertBatchIntegrityChecksSchema, f as insertExecutionLogsSchema, i as auditStageRunsTable, l as insertAuditRunsSchema, n as auditCoverageTable, o as executionLogsTable, r as auditRunsTable, s as insertAuditColorLedgerSchema, t as auditColorLedgerTable, u as insertAuditStageRunsSchema } from "./audit-ChUwSBsg.mjs";
import { a as insertCalibrationLedgerSchema, c as truthEngineCalibrationObservationsTable, i as insertCalibrationBucketsSchema, n as calibrationLedgerTable, o as insertCalibrationVersionsSchema, r as calibrationVersionsTable, s as insertTruthEngineCalibrationObservationsSchema, t as calibrationBucketsTable } from "./calibration-BTgOpQAP.mjs";
import { a as insertFormulaVersionsSchema, c as insertProbabilityMethodsSchema, d as overrideRecordsTable, f as probabilityMethodsTable, i as insertFinalDecisionsSchema, l as insertProbabilityProvenanceSchema, m as resultGradesTable, n as formulaVersionsTable, o as insertGeneratedReportsSchema, p as probabilityProvenanceTable, r as generatedReportsTable, s as insertOverrideRecordsSchema, t as finalDecisionsTable, u as insertResultGradesSchema } from "./decisions-D8mHqU7D.mjs";
import { a as insertTournamentsSchema, c as playersTable, i as insertPredictionSlatesSchema, l as predictionSlatesTable, n as insertMatchesSchema, o as matchIdentityRecordsTable, r as insertPlayersSchema, s as matchesTable, t as insertMatchIdentityRecordsSchema, u as tournamentsTable } from "./matches-CtYuxOLN.mjs";
import { a as insertMetricRegistrySchema, c as metricEvidenceStoreTable, i as insertMetricEvidenceStoreSchema, l as metricRegistryTable, n as insertEvidenceFamilyCoverageSchema, o as insertMetricResultsSchema, r as insertMetricCoverageRatesSchema, s as metricCoverageRatesTable, t as evidenceFamilyCoverageTable, u as metricResultsTable } from "./metrics-2UTgcTdn.mjs";
import { a as ruleDocumentsTable, i as ruleDocumentVersionsTable, n as insertRuleDocumentsSchema, o as rulesTable, r as insertRulesSchema, t as insertRuleDocumentVersionsSchema } from "./rules-DxX2ibUx.mjs";
import { a as insertSourceHealthEventsSchema, c as insertSourceSnapshotsSchema, d as sourceHealthEventsTable, f as sourceIngestionRunsTable, i as insertSourceDefinitionsSchema, l as sourceConflictsTable, m as sourceSnapshotsTable, n as insertIngestionTargetsSchema, o as insertSourceIngestionRunsSchema, p as sourceObservationsTable, r as insertSourceConflictsSchema, s as insertSourceObservationsSchema, t as ingestionTargetsTable, u as sourceDefinitionsTable } from "./sources-B3f820Qo.mjs";
import { a as parsedSummaryFieldsTable, c as summaryVersionsTable, i as insertSummaryVersionsSchema, n as insertSummaryPagesSchema, o as summaryPagesTable, r as insertSummaryUploadsSchema, s as summaryUploadsTable, t as insertParsedSummaryFieldsSchema } from "./uploads-vW6NguTg.mjs";
import { A as replayElo, C as laneMatchesBefore, D as officialWtaMetricRows, E as normalizeEvidenceTournament, M as resolveCanonicalEvidencePair, P as tryQuery, S as excludedSet, T as normalizeEvidenceIdentity, _ as deterministicRankingMetric, a as buildLiveTennisApiPbpContext, c as classifyEvidenceTourFamily, d as completionSweepResearcher, f as deriveOpeningWindowProfile, g as deterministicPbpMetricFromPacket, i as auditCutoff, j as repositoryResultsRows, k as reconstructPbpScoreState, l as clearPhantomEvidenceMetadata, m as deterministicMarketMetric, n as appendMetricObservationContext, o as buildMetricObservationContext, p as deterministicEnvironmentMetric, s as certifyMetricFinding, t as TASK18B_METRIC_CODES, v as deterministicResultsScheduleMetric, w as localMetricRows, x as evidencePairMatches, y as deterministicRulesContextMetric } from "./source-observation-metric-bridge.server-CZQCC458.mjs";
import { join } from "node:path";
import { readFile } from "node:fs/promises";
//#region node_modules/.nitro/vite/services/ssr/assets/audit-repo.server-D3WminbK.js
function dbErrorMessage(error) {
	if (error instanceof Error) return error.message;
	return String(error ?? "unknown error");
}
/** Runs a query, restating any driver error in the app's existing wording. */
async function dbCall(verb, table, run) {
	try {
		return await run();
	} catch (error) {
		throw new Error(`Database ${verb} failed (${table}): ${dbErrorMessage(error)}`);
	}
}
var appRoleEnum = pgEnum("app_role", [
	"admin",
	"moderator",
	"user"
]);
var userRolesTable = pgTable("user_roles", {
	id: uuid("id").notNull().defaultRandom().primaryKey(),
	user_id: uuid("user_id").notNull(),
	role: appRoleEnum("role").notNull(),
	created_at: isoTimestamp("created_at").notNull().default(sql`now()`)
});
var insertUserRolesSchema = createInsertSchema(userRolesTable);
var registry = new Map(Object.values(/* @__PURE__ */ __exportAll({
	appRoleEnum: () => appRoleEnum,
	auditColorLedgerTable: () => auditColorLedgerTable,
	auditCoverageTable: () => auditCoverageTable,
	auditRunsTable: () => auditRunsTable,
	auditStageRunsTable: () => auditStageRunsTable,
	autopsiesTable: () => autopsiesTable,
	autopsyFindingsTable: () => autopsyFindingsTable,
	batchIntegrityChecksTable: () => batchIntegrityChecksTable,
	blockReasonsTable: () => blockReasonsTable,
	calibrationBucketsTable: () => calibrationBucketsTable,
	calibrationLedgerTable: () => calibrationLedgerTable,
	calibrationVersionsTable: () => calibrationVersionsTable,
	disagreementResultsTable: () => disagreementResultsTable,
	evidenceFamilyCoverageTable: () => evidenceFamilyCoverageTable,
	executionLogsTable: () => executionLogsTable,
	finalDecisionsTable: () => finalDecisionsTable,
	formulaVersionsTable: () => formulaVersionsTable,
	generatedReportsTable: () => generatedReportsTable,
	ingestionTargetsTable: () => ingestionTargetsTable,
	insertAuditColorLedgerSchema: () => insertAuditColorLedgerSchema,
	insertAuditCoverageSchema: () => insertAuditCoverageSchema,
	insertAuditRunsSchema: () => insertAuditRunsSchema,
	insertAuditStageRunsSchema: () => insertAuditStageRunsSchema,
	insertAutopsiesSchema: () => insertAutopsiesSchema,
	insertAutopsyFindingsSchema: () => insertAutopsyFindingsSchema,
	insertBatchIntegrityChecksSchema: () => insertBatchIntegrityChecksSchema,
	insertBlockReasonsSchema: () => insertBlockReasonsSchema,
	insertCalibrationBucketsSchema: () => insertCalibrationBucketsSchema,
	insertCalibrationLedgerSchema: () => insertCalibrationLedgerSchema,
	insertCalibrationVersionsSchema: () => insertCalibrationVersionsSchema,
	insertDisagreementResultsSchema: () => insertDisagreementResultsSchema,
	insertEvidenceFamilyCoverageSchema: () => insertEvidenceFamilyCoverageSchema,
	insertExecutionLogsSchema: () => insertExecutionLogsSchema,
	insertFinalDecisionsSchema: () => insertFinalDecisionsSchema,
	insertFormulaVersionsSchema: () => insertFormulaVersionsSchema,
	insertGeneratedReportsSchema: () => insertGeneratedReportsSchema,
	insertIngestionTargetsSchema: () => insertIngestionTargetsSchema,
	insertMatchIdentityRecordsSchema: () => insertMatchIdentityRecordsSchema,
	insertMatchesSchema: () => insertMatchesSchema,
	insertMetricCoverageRatesSchema: () => insertMetricCoverageRatesSchema,
	insertMetricEvidenceStoreSchema: () => insertMetricEvidenceStoreSchema,
	insertMetricRegistrySchema: () => insertMetricRegistrySchema,
	insertMetricResultsSchema: () => insertMetricResultsSchema,
	insertOverrideRecordsSchema: () => insertOverrideRecordsSchema,
	insertParsedSummaryFieldsSchema: () => insertParsedSummaryFieldsSchema,
	insertPlayersSchema: () => insertPlayersSchema,
	insertPredictionSlatesSchema: () => insertPredictionSlatesSchema,
	insertProbabilityMethodsSchema: () => insertProbabilityMethodsSchema,
	insertProbabilityProvenanceSchema: () => insertProbabilityProvenanceSchema,
	insertReconstructionResultsSchema: () => insertReconstructionResultsSchema,
	insertResultGradesSchema: () => insertResultGradesSchema,
	insertRuleDocumentVersionsSchema: () => insertRuleDocumentVersionsSchema,
	insertRuleDocumentsSchema: () => insertRuleDocumentsSchema,
	insertRulesSchema: () => insertRulesSchema,
	insertSourceConflictsSchema: () => insertSourceConflictsSchema,
	insertSourceDefinitionsSchema: () => insertSourceDefinitionsSchema,
	insertSourceHealthEventsSchema: () => insertSourceHealthEventsSchema,
	insertSourceIngestionRunsSchema: () => insertSourceIngestionRunsSchema,
	insertSourceObservationsSchema: () => insertSourceObservationsSchema,
	insertSourceSnapshotsSchema: () => insertSourceSnapshotsSchema,
	insertStressResultsSchema: () => insertStressResultsSchema,
	insertSummaryPagesSchema: () => insertSummaryPagesSchema,
	insertSummaryUploadsSchema: () => insertSummaryUploadsSchema,
	insertSummaryVersionsSchema: () => insertSummaryVersionsSchema,
	insertTournamentsSchema: () => insertTournamentsSchema,
	insertTruthEngineCalibrationObservationsSchema: () => insertTruthEngineCalibrationObservationsSchema,
	insertUnderdogResultsSchema: () => insertUnderdogResultsSchema,
	insertUserRolesSchema: () => insertUserRolesSchema,
	insertVerificationResultsSchema: () => insertVerificationResultsSchema,
	matchIdentityRecordsTable: () => matchIdentityRecordsTable,
	matchesTable: () => matchesTable,
	metricCoverageRatesTable: () => metricCoverageRatesTable,
	metricEvidenceStoreTable: () => metricEvidenceStoreTable,
	metricRegistryTable: () => metricRegistryTable,
	metricResultsTable: () => metricResultsTable,
	overrideRecordsTable: () => overrideRecordsTable,
	parsedSummaryFieldsTable: () => parsedSummaryFieldsTable,
	playersTable: () => playersTable,
	predictionSlatesTable: () => predictionSlatesTable,
	probabilityMethodsTable: () => probabilityMethodsTable,
	probabilityProvenanceTable: () => probabilityProvenanceTable,
	reconstructionResultsTable: () => reconstructionResultsTable,
	resultGradesTable: () => resultGradesTable,
	ruleDocumentVersionsTable: () => ruleDocumentVersionsTable,
	ruleDocumentsTable: () => ruleDocumentsTable,
	rulesTable: () => rulesTable,
	sourceConflictsTable: () => sourceConflictsTable,
	sourceDefinitionsTable: () => sourceDefinitionsTable,
	sourceHealthEventsTable: () => sourceHealthEventsTable,
	sourceIngestionRunsTable: () => sourceIngestionRunsTable,
	sourceObservationsTable: () => sourceObservationsTable,
	sourceSnapshotsTable: () => sourceSnapshotsTable,
	stressResultsTable: () => stressResultsTable,
	summaryPagesTable: () => summaryPagesTable,
	summaryUploadsTable: () => summaryUploadsTable,
	summaryVersionsTable: () => summaryVersionsTable,
	tournamentsTable: () => tournamentsTable,
	truthEngineCalibrationObservationsTable: () => truthEngineCalibrationObservationsTable,
	underdogResultsTable: () => underdogResultsTable,
	userRolesTable: () => userRolesTable,
	verificationResultsTable: () => verificationResultsTable
})).filter((value) => is(value, PgTable)).map((table) => [getTableName(table), table]));
/** Every table name the schema defines. */
var TABLE_NAMES = [...registry.keys()].sort();
/** Throws rather than returning undefined: an unknown table name is a bug, not a miss. */
function tableByName(name) {
	const table = registry.get(name);
	if (!table) throw new Error(`Unknown table "${name}". Known tables: ${TABLE_NAMES.join(", ")}`);
	return table;
}
function asTourFamily(lane) {
	return lane;
}
function round1(v) {
	return v === null || !Number.isFinite(v) ? null : Math.round(v * 10) / 10;
}
var FINISHING_ABILITY_ELIGIBLE_LANES = /* @__PURE__ */ new Set(["WTA_MAIN", "ATP_CHALLENGER"]);
function firstSetOutcome(row) {
	const firstSet = row.raw_payload.history_detail?.set_scores?.[0];
	if (!firstSet) return null;
	const [forGames, againstGames] = firstSet;
	if (!Number.isFinite(forGames) || !Number.isFinite(againstGames) || forGames === againstGames) return null;
	return forGames > againstGames ? "WON" : "LOST";
}
function matchWon$1(row, player) {
	return row.raw_payload.winner === player;
}
/**
* Pure core: given a player's already leakage-filtered prior-match rows
* (any order -- this function sorts by event_date itself, ascending, before
* taking the trailing window), compute both rates over the trailing N.
*/
function computeFinishingAbilityFromRows(player, rows, trailingN = 20) {
	const trailing = [...rows].sort((a, b) => (a.event_date ?? "").localeCompare(b.event_date ?? "")).slice(-trailingN);
	let leadN = 0, leadWins = 0, closeN = 0, closeWins = 0;
	for (const row of trailing) {
		const outcome = firstSetOutcome(row);
		if (outcome === null) continue;
		const won = matchWon$1(row, player);
		if (outcome === "WON") {
			leadN++;
			if (won) leadWins++;
		} else {
			closeN++;
			if (won) closeWins++;
		}
	}
	return {
		trailing_n_used: trailing.length,
		lead_protection: {
			n: leadN,
			rate: leadN > 0 ? round1(100 * leadWins / leadN) : null
		},
		closing_as_underdog: {
			n: closeN,
			rate: closeN > 0 ? round1(100 * closeWins / closeN) : null
		}
	};
}
/** Live wrapper: fetches leakage-safe prior-match rows for `player` in `lane`, gated by lane eligibility for set-sequence data. */
function computeOpponentFinishingAbility(args) {
	const { player, lane, asOfDate, trailingN = 20 } = args;
	if (!FINISHING_ABILITY_ELIGIBLE_LANES.has(lane)) return {
		lane,
		status: "NOT_ENOUGH_DATA",
		n: 0,
		reason: `${lane} has no set-sequence (set_scores) data in the static history index -- structural schema gap, not sparse data.`
	};
	const result = computeFinishingAbilityFromRows(player, repositoryResultsRows(player, asTourFamily(lane), asOfDate, { strictBefore: true }), trailingN);
	if (result.lead_protection.n === 0 && result.closing_as_underdog.n === 0) return {
		lane,
		status: "NOT_ENOUGH_DATA",
		n: 0,
		reason: "No prior matches with usable first-set-outcome data before asOfDate."
	};
	return {
		lane,
		status: "GO",
		n: result.trailing_n_used,
		value: result
	};
}
function setDifferentialsByOpponent(rows) {
	const byOpponent = /* @__PURE__ */ new Map();
	for (const row of rows) {
		const detail = row.raw_payload.history_detail;
		const sf = detail?.sets_for, sa = detail?.sets_against;
		if (!Number.isFinite(sf) || !Number.isFinite(sa)) continue;
		const key = normalizeEvidenceIdentity(row.opponent_name ?? "");
		if (!key) continue;
		const existing = byOpponent.get(key) ?? {
			diffSum: 0,
			matches: 0
		};
		existing.diffSum += sf - sa;
		existing.matches += 1;
		byOpponent.set(key, existing);
	}
	return byOpponent;
}
/**
* Pure core: given both players' already leakage-filtered prior-match rows
* and each common opponent's Elo rating (as of the same asOfDate, supplied
* by the caller from a single shared replayElo pass), compute the
* Elo-weighted average set differential each player has posted against
* their shared opponents, and the gap between the two.
*/
function computeCommonOpponentDifferentialFromRows(args) {
	const playerByOpp = setDifferentialsByOpponent(args.playerRows);
	const referenceByOpp = setDifferentialsByOpponent(args.referenceRows);
	const commonKeys = [...playerByOpp.keys()].filter((k) => referenceByOpp.has(k));
	if (!commonKeys.length) return null;
	let playerWeightedSum = 0, playerWeightTotal = 0, referenceWeightedSum = 0, referenceWeightTotal = 0, usedCommon = 0;
	for (const key of commonKeys) {
		const elo = args.opponentEloByKey.get(key);
		if (!Number.isFinite(elo)) continue;
		const weight = elo;
		const p = playerByOpp.get(key), r = referenceByOpp.get(key);
		playerWeightedSum += weight * (p.diffSum / p.matches);
		playerWeightTotal += weight;
		referenceWeightedSum += weight * (r.diffSum / r.matches);
		referenceWeightTotal += weight;
		usedCommon++;
	}
	if (usedCommon === 0) return null;
	const playerAdjusted = playerWeightedSum / playerWeightTotal;
	const referenceAdjusted = referenceWeightedSum / referenceWeightTotal;
	return {
		common_opponents_n: usedCommon,
		player_adjusted_set_differential: round1(playerAdjusted * 10) / 10,
		reference_adjusted_set_differential: round1(referenceAdjusted * 10) / 10,
		differential: round1((playerAdjusted - referenceAdjusted) * 10) / 10
	};
}
/** Live wrapper: replays Elo once for the lane, fetches leakage-safe rows for both players, then delegates to the pure core. */
function computeCommonOpponentPointDifferential(args) {
	const { player, reference, lane, asOfDate } = args;
	const family = asTourFamily(lane);
	const playerRows = repositoryResultsRows(player, family, asOfDate, { strictBefore: true });
	const referenceRows = repositoryResultsRows(reference, family, asOfDate, { strictBefore: true });
	if (!playerRows.length || !referenceRows.length) return {
		lane,
		status: "NOT_ENOUGH_DATA",
		n: 0,
		reason: "One or both players have no prior match rows before asOfDate in this lane."
	};
	const historyLane = loadRuntimeIndex().matchHistory[family];
	const result = computeCommonOpponentDifferentialFromRows({
		playerRows,
		referenceRows,
		opponentEloByKey: replayElo(historyLane, asOfDate).overall
	});
	if (!result) return {
		lane,
		status: "NOT_ENOUGH_DATA",
		n: 0,
		reason: "No common opponents (with a known Elo rating) found between the two players before asOfDate."
	};
	return {
		lane,
		status: "GO",
		n: result.common_opponents_n,
		value: result
	};
}
/** A single set score reads as "close" at 7-6, 7-5, or 6-4 -- the same narrow-margin-at-6+-games shape used elsewhere in this batch, applied per-set rather than per-match. */
function isCloseSetLoss(forGames, againstGames) {
	if (forGames >= againstGames) return false;
	if (forGames === 6 && againstGames === 7) return true;
	if (forGames === 5 && againstGames === 7) return true;
	if (forGames === 4 && againstGames === 6) return true;
	return false;
}
function matchWon(row, player) {
	return row.raw_payload.winner === player;
}
function setScoresOf(row) {
	const detail = row.raw_payload.history_detail;
	return Array.isArray(detail?.set_scores) && detail.set_scores.length > 0 ? detail.set_scores : null;
}
/**
* Pure core: given a player's already leakage-filtered prior-match rows
* (any order -- sorted here by event_date ascending before windowing),
* compute the baseline match win rate and the close-set-loss response.
* Only the FIRST close-set loss found in each match is used as the trigger
* (a match with two separate close-set losses only contributes one
* "after a close-set loss" observation per following set, not double-counted).
*/
function computePsychologicalResponseFromRows(player, rows, trailingN = 20) {
	const trailing = [...rows].sort((a, b) => (a.event_date ?? "").localeCompare(b.event_date ?? "")).slice(-trailingN);
	let baselineN = 0, baselineWins = 0;
	let closeLossN = 0, nextSetWinN = 0, closeLossMatchWinN = 0;
	for (const row of trailing) {
		const won = matchWon(row, player);
		baselineN++;
		if (won) baselineWins++;
		const sets = setScoresOf(row);
		if (!sets) continue;
		const closeLossSetIndex = sets.findIndex(([f, a]) => isCloseSetLoss(f, a));
		if (closeLossSetIndex === -1) continue;
		closeLossN++;
		if (won) closeLossMatchWinN++;
		const nextSet = sets[closeLossSetIndex + 1];
		if (nextSet) {
			const [nf, na] = nextSet;
			if (nf !== na && nf > na) nextSetWinN++;
		}
	}
	return {
		trailing_n_used: trailing.length,
		baseline_match_win_rate: {
			n: baselineN,
			rate: baselineN > 0 ? round1(100 * baselineWins / baselineN) : null
		},
		after_close_set_loss: {
			n: closeLossN,
			next_set_win_rate: closeLossN > 0 ? round1(100 * nextSetWinN / closeLossN) : null,
			match_win_rate: closeLossN > 0 ? round1(100 * closeLossMatchWinN / closeLossN) : null
		}
	};
}
/** Live wrapper: fetches leakage-safe prior-match rows for `player` in `lane`, gated by the same lane eligibility #027 uses for set-sequence data. */
function computePsychologicalResponseProxy(args) {
	const { player, lane, asOfDate, trailingN = 20 } = args;
	if (!FINISHING_ABILITY_ELIGIBLE_LANES.has(lane)) return {
		lane,
		status: "NOT_ENOUGH_DATA",
		n: 0,
		reason: `${lane} has no set-sequence (set_scores) data in the static history index -- structural schema gap, not sparse data.`
	};
	const result = computePsychologicalResponseFromRows(player, repositoryResultsRows(player, asTourFamily(lane), asOfDate, { strictBefore: true }), trailingN);
	if (result.after_close_set_loss.n === 0) return {
		lane,
		status: "NOT_ENOUGH_DATA",
		n: 0,
		reason: "No prior matches with a usable close-set loss before asOfDate."
	};
	return {
		lane,
		status: "GO",
		n: result.trailing_n_used,
		value: result
	};
}
function expectedWinProbability$1(a, b) {
	return 1 / (1 + 10 ** ((b - a) / 400));
}
function summarizeHalf(matches) {
	const n = matches.length;
	if (n === 0) return {
		n: 0,
		raw_win_rate: null,
		avg_opponent_elo: null,
		mean_elo_adjusted_surplus: null
	};
	const wins = matches.filter((m) => m.won).length;
	const avgOpponentElo = matches.reduce((sum, m) => sum + m.opponent_pre_elo, 0) / n;
	const meanSurplus = matches.reduce((sum, m) => sum + ((m.won ? 1 : 0) - expectedWinProbability$1(m.pre_elo, m.opponent_pre_elo)), 0) / n;
	return {
		n,
		raw_win_rate: round1(100 * wins / n),
		avg_opponent_elo: round1(avgOpponentElo),
		mean_elo_adjusted_surplus: round1(meanSurplus * 100) / 100
	};
}
/**
* Pure core: given a player's chronologically-ordered (oldest-first)
* trailing perspectives, splits them into an earlier and a recent half and
* flags "hidden improvement" when the raw win rate is flat or declining
* while the Elo-adjusted surplus (performance relative to what tougher
* opponents predict) is actually improving.
*/
function computeHiddenImprovementFromPerspectives(chronological, window = 20) {
	const trailing = chronological.slice(-window);
	const mid = Math.floor(trailing.length / 2);
	const earlier = summarizeHalf(trailing.slice(0, mid));
	const recent = summarizeHalf(trailing.slice(mid));
	const recordFlatOrDeclining = earlier.raw_win_rate !== null && recent.raw_win_rate !== null && recent.raw_win_rate <= earlier.raw_win_rate;
	const qualityAdjustedImproving = earlier.mean_elo_adjusted_surplus !== null && recent.mean_elo_adjusted_surplus !== null && recent.mean_elo_adjusted_surplus > earlier.mean_elo_adjusted_surplus;
	return {
		earlier_half: earlier,
		recent_half: recent,
		flag: recordFlatOrDeclining && qualityAdjustedImproving ? "IMPROVEMENT_HIDDEN_BY_RECORD" : "NO_HIDDEN_IMPROVEMENT_DETECTED"
	};
}
/** Live wrapper: replays Elo for the lane and extracts this player's chronological perspectives before delegating to the pure core. */
function computeHiddenImprovementDetector(args) {
	const { player, lane, asOfDate, window = 20 } = args;
	const family = asTourFamily(lane);
	const historyLane = loadRuntimeIndex().matchHistory[family];
	const replay = replayElo(historyLane, asOfDate);
	const key = normalizeEvidenceIdentity(player);
	const chronological = replay.perspectives.filter((p) => p.player === key).sort((a, b) => a.date.localeCompare(b.date)).map((p) => ({
		won: p.won,
		pre_elo: p.pre_elo,
		opponent_pre_elo: p.opponent_pre_elo
	}));
	if (chronological.length < 2) return {
		lane,
		status: "NOT_ENOUGH_DATA",
		n: chronological.length,
		reason: "Fewer than 2 prior matches before asOfDate -- cannot split into an earlier/recent half."
	};
	const result = computeHiddenImprovementFromPerspectives(chronological, window);
	return {
		lane,
		status: "GO",
		n: chronological.length,
		value: result
	};
}
var MATCH_STATE_ELO_ELIGIBLE_LANES = /* @__PURE__ */ new Set(["WTA_MAIN", "ATP_CHALLENGER"]);
var K = 32;
var INITIAL_RATING = 1500;
function expected(a, b) {
	return 1 / (1 + 10 ** ((b - a) / 400));
}
function firstSetWinner(setScores, p1, p2) {
	const firstSet = setScores?.[0];
	if (!firstSet) return null;
	const [a, b] = firstSet;
	if (!Number.isFinite(a) || !Number.isFinite(b) || a === b) return null;
	return a > b ? p1 : p2;
}
/**
* Builds a per-player {date|normalizedOpponent -> set_scores} index directly
* from the same raw `lane` object laneMatchesBefore itself reads, so this
* index is always drawn from exactly the same source as the deduped match
* list it enriches (not a separate global-index lookup that could silently
* diverge from it, and testable with a synthetic lane rather than requiring
* the real generated index to be loaded). Only used to attach set_scores
* detail to matches laneMatchesBefore has already leakage-filtered -- it
* never introduces a match that function didn't already approve.
*/
function buildSetScoreIndex$1(lane, players) {
	const index = /* @__PURE__ */ new Map();
	for (const player of players) {
		const key = normalizeEvidenceIdentity(player);
		const entries = lane[key];
		const byKey = /* @__PURE__ */ new Map();
		if (Array.isArray(entries)) for (const entry of entries) {
			const [dateRaw, , , opponentRaw, , , , detailRaw] = entry;
			const date = String(dateRaw ?? "").slice(0, 10);
			const opponent = normalizeEvidenceIdentity(String(opponentRaw ?? ""));
			const setScores = detailRaw?.set_scores;
			if (!date || !opponent || !Array.isArray(setScores) || !setScores.length) continue;
			const lookupKey = `${date}|${opponent}`;
			if (!byKey.has(lookupKey)) byKey.set(lookupKey, setScores);
		}
		index.set(key, byKey);
	}
	return index;
}
/**
* Replays the whole lane's match-state Elo as of `asOfDate`. Caller should
* replay once per (lane, asOfDate) and query both players from the
* returned ratings, not call this once per player (see module header's
* performance note).
*/
function replayMatchStateElo(lane, asOfDate) {
	const matches = laneMatchesBefore(lane, asOfDate);
	const players = /* @__PURE__ */ new Set();
	for (const m of matches) {
		players.add(m.p1);
		players.add(m.p2);
	}
	const setScoreIndex = buildSetScoreIndex$1(lane, players);
	const afterWinningSet1 = /* @__PURE__ */ new Map();
	const afterLosingSet1 = /* @__PURE__ */ new Map();
	let matchesUsed = 0;
	for (const match of matches) {
		const p1Key = normalizeEvidenceIdentity(match.p1), p2Key = normalizeEvidenceIdentity(match.p2);
		const set1Winner = firstSetWinner(setScoreIndex.get(p1Key)?.get(`${match.date}|${p2Key}`) ?? setScoreIndex.get(p2Key)?.get(`${match.date}|${p1Key}`), match.p1, match.p2);
		if (!set1Winner) continue;
		const set1Loser = set1Winner === match.p1 ? match.p2 : match.p1;
		const matchWonBySet1Winner = match.winner === set1Winner;
		const a = afterWinningSet1.get(set1Winner) ?? INITIAL_RATING;
		const b = afterLosingSet1.get(set1Loser) ?? INITIAL_RATING;
		const scoreA = matchWonBySet1Winner ? 1 : 0;
		afterWinningSet1.set(set1Winner, a + K * (scoreA - expected(a, b)));
		afterLosingSet1.set(set1Loser, b + K * (1 - scoreA - expected(b, a)));
		matchesUsed++;
	}
	return {
		after_winning_set1: afterWinningSet1,
		after_losing_set1: afterLosingSet1,
		matches_used: matchesUsed
	};
}
/** Live wrapper: replays the lane once and looks up both ratings for `player`, gated by lane eligibility for set-sequence data. */
function computeMatchStateElo(args) {
	const { player, lane, asOfDate } = args;
	if (!MATCH_STATE_ELO_ELIGIBLE_LANES.has(lane)) return {
		lane,
		status: "NOT_ENOUGH_DATA",
		n: 0,
		reason: `${lane} has no set-sequence (set_scores) data in the static history index -- cannot determine set-1 outcomes.`
	};
	const family = asTourFamily(lane);
	const historyLane = loadRuntimeIndex().matchHistory[family];
	const replay = replayMatchStateElo(historyLane, asOfDate);
	const key = normalizeEvidenceIdentity(player);
	const afterWinning = replay.after_winning_set1.get(key) ?? null;
	const afterLosing = replay.after_losing_set1.get(key) ?? null;
	if (afterWinning === null && afterLosing === null) return {
		lane,
		status: "NOT_ENOUGH_DATA",
		n: 0,
		reason: "Player has no matches with a usable set-1 outcome before asOfDate."
	};
	return {
		lane,
		status: "GO",
		n: replay.matches_used,
		value: {
			after_winning_set1: afterWinning === null ? null : round1(afterWinning),
			after_losing_set1: afterLosing === null ? null : round1(afterLosing)
		}
	};
}
/**
* Pure, directly-testable core: given the player's own prior-match rows
* (already leakage-filtered by the caller) and the opponent's name, compute
* the shrunk opponent-specific win probability.
*
* @param generalWinProbabilityPct The player's win probability against this
*   opponent from a general (non-opponent-specific) model -- e.g. an Elo
*   expected-score conversion, or TennisMatrixAi's own pre-match probability
*   when auditing a specific TennisMatrixAi prediction. This module does not
*   compute that number itself; it only shrinks it toward the H2H rate.
*/
function computeOpponentSpecificProbabilityFromRows(args) {
	const { player, opponent, generalWinProbabilityPct } = args;
	const k = args.shrinkageK ?? 8;
	if (!Number.isFinite(generalWinProbabilityPct) || generalWinProbabilityPct < 0 || generalWinProbabilityPct > 100) return null;
	if (normalizeEvidenceIdentity(player) === normalizeEvidenceIdentity(opponent)) return null;
	const meetings = args.rows.filter((row) => evidencePairMatches(row.player_name, row.opponent_name, player, opponent));
	const nH2h = meetings.length;
	const wins = meetings.filter((row) => row.raw_payload.winner === player).length;
	const rawH2hWinPct = nH2h > 0 ? round1(100 * wins / nH2h) : null;
	const shrinkageWeight = nH2h / (nH2h + k);
	const shrunkWinProbabilityPct = rawH2hWinPct === null ? generalWinProbabilityPct : shrinkageWeight * rawH2hWinPct + (1 - shrinkageWeight) * generalWinProbabilityPct;
	return {
		n_h2h: nH2h,
		raw_h2h_win_pct: rawH2hWinPct,
		shrinkage_weight: round1(shrinkageWeight * 100) / 100,
		shrinkage_k: k,
		shrunk_win_probability_pct: round1(shrunkWinProbabilityPct)
	};
}
/** Live wrapper: fetches leakage-safe prior-match rows for `player` in `lane` before pairing off against `opponent`. */
function computeOpponentSpecificProbability(args) {
	const { lane } = args;
	const rows = repositoryResultsRows(args.player, asTourFamily(lane), args.asOfDate, { strictBefore: true });
	const core = computeOpponentSpecificProbabilityFromRows({
		...args,
		rows
	});
	if (!core) return {
		lane,
		status: "NOT_ENOUGH_DATA",
		n: 0,
		reason: normalizeEvidenceIdentity(args.player) === normalizeEvidenceIdentity(args.opponent) ? "Player and opponent resolve to the same identity." : "No usable general (non-opponent-specific) win probability was supplied to shrink toward."
	};
	return {
		lane,
		status: "GO",
		n: core.n_h2h,
		value: {
			...core,
			general_win_probability_pct: args.generalWinProbabilityPct
		}
	};
}
var OWNED$4 = /* @__PURE__ */ new Set([
	"027",
	"029",
	"031",
	"041",
	"046",
	"051"
]);
function codeOf$8(value) {
	const m = String(value ?? "").match(/(\d{1,3})$/);
	return m ? m[1].padStart(3, "0") : String(value ?? "").padStart(3, "0");
}
function fmt$2(obj) {
	return Object.entries(obj).map(([k, v]) => `${k}=${v === null || v === void 0 ? "NA" : v}`).join("; ");
}
function expectedWinProbability(a, b) {
	return 100 / (1 + 10 ** ((b - a) / 400));
}
function notEnoughDataReason$1(outcome) {
	return outcome.status === "NOT_ENOUGH_DATA" ? outcome.reason : null;
}
function finishingAbility027(p1, p2, lane, asOfDate) {
	const a = computeOpponentFinishingAbility({
		player: p1,
		lane,
		asOfDate
	});
	const b = computeOpponentFinishingAbility({
		player: p2,
		lane,
		asOfDate
	});
	if (a.status !== "GO" || b.status !== "GO") return {
		ok: false,
		p1Reason: notEnoughDataReason$1(a),
		p2Reason: notEnoughDataReason$1(b)
	};
	return {
		ok: true,
		p1Value: fmt$2({
			lead_protection_n: a.value.lead_protection.n,
			lead_protection_rate_pct: a.value.lead_protection.rate,
			closing_as_underdog_n: a.value.closing_as_underdog.n,
			closing_as_underdog_rate_pct: a.value.closing_as_underdog.rate,
			trailing_n_used: a.value.trailing_n_used
		}),
		p2Value: fmt$2({
			lead_protection_n: b.value.lead_protection.n,
			lead_protection_rate_pct: b.value.lead_protection.rate,
			closing_as_underdog_n: b.value.closing_as_underdog.n,
			closing_as_underdog_rate_pct: b.value.closing_as_underdog.rate,
			trailing_n_used: b.value.trailing_n_used
		}),
		n: Math.min(a.n, b.n)
	};
}
function psychologicalResponseProxy029(p1, p2, lane, asOfDate) {
	const a = computePsychologicalResponseProxy({
		player: p1,
		lane,
		asOfDate
	});
	const b = computePsychologicalResponseProxy({
		player: p2,
		lane,
		asOfDate
	});
	if (a.status !== "GO" || b.status !== "GO") return {
		ok: false,
		p1Reason: notEnoughDataReason$1(a),
		p2Reason: notEnoughDataReason$1(b)
	};
	const fmtSide = (r) => fmt$2({
		trailing_n_used: r.trailing_n_used,
		baseline_match_win_rate_n: r.baseline_match_win_rate.n,
		baseline_match_win_rate_pct: r.baseline_match_win_rate.rate,
		after_close_set_loss_n: r.after_close_set_loss.n,
		after_close_set_loss_next_set_win_pct: r.after_close_set_loss.next_set_win_rate,
		after_close_set_loss_match_win_pct: r.after_close_set_loss.match_win_rate
	});
	return {
		ok: true,
		p1Value: fmtSide(a.value),
		p2Value: fmtSide(b.value),
		n: Math.min(a.n, b.n)
	};
}
function commonOpponentDifferential031(p1, p2, lane, asOfDate) {
	const result = computeCommonOpponentPointDifferential({
		player: p1,
		reference: p2,
		lane,
		asOfDate
	});
	if (result.status !== "GO") {
		const reason = notEnoughDataReason$1(result);
		return {
			ok: false,
			p1Reason: reason,
			p2Reason: reason
		};
	}
	const v = result.value;
	return {
		ok: true,
		p1Value: fmt$2({
			common_opponents_n: v.common_opponents_n,
			adjusted_set_differential: v.player_adjusted_set_differential,
			opponent_adjusted_set_differential: v.reference_adjusted_set_differential,
			differential_vs_opponent: v.differential
		}),
		p2Value: fmt$2({
			common_opponents_n: v.common_opponents_n,
			adjusted_set_differential: v.reference_adjusted_set_differential,
			opponent_adjusted_set_differential: v.player_adjusted_set_differential,
			differential_vs_opponent: -v.differential
		}),
		n: v.common_opponents_n
	};
}
function hiddenImprovement041(p1, p2, lane, asOfDate) {
	const a = computeHiddenImprovementDetector({
		player: p1,
		lane,
		asOfDate
	});
	const b = computeHiddenImprovementDetector({
		player: p2,
		lane,
		asOfDate
	});
	if (a.status !== "GO" || b.status !== "GO") return {
		ok: false,
		p1Reason: notEnoughDataReason$1(a),
		p2Reason: notEnoughDataReason$1(b)
	};
	const fmtSide = (r) => fmt$2({
		flag: r.flag,
		earlier_n: r.earlier_half.n,
		earlier_win_rate_pct: r.earlier_half.raw_win_rate,
		earlier_elo_adjusted_surplus: r.earlier_half.mean_elo_adjusted_surplus,
		recent_n: r.recent_half.n,
		recent_win_rate_pct: r.recent_half.raw_win_rate,
		recent_elo_adjusted_surplus: r.recent_half.mean_elo_adjusted_surplus
	});
	return {
		ok: true,
		p1Value: fmtSide(a.value),
		p2Value: fmtSide(b.value),
		n: Math.min(a.n, b.n)
	};
}
function matchStateElo046(p1, p2, lane, asOfDate) {
	const a = computeMatchStateElo({
		player: p1,
		lane,
		asOfDate
	});
	const b = computeMatchStateElo({
		player: p2,
		lane,
		asOfDate
	});
	if (a.status !== "GO" || b.status !== "GO") return {
		ok: false,
		p1Reason: notEnoughDataReason$1(a),
		p2Reason: notEnoughDataReason$1(b)
	};
	return {
		ok: true,
		p1Value: fmt$2({
			elo_after_winning_set1: a.value.after_winning_set1,
			elo_after_losing_set1: a.value.after_losing_set1
		}),
		p2Value: fmt$2({
			elo_after_winning_set1: b.value.after_winning_set1,
			elo_after_losing_set1: b.value.after_losing_set1
		}),
		n: Math.min(a.n, b.n)
	};
}
function opponentSpecificProbability051(p1, p2, lane, asOfDate) {
	const historyLane = loadRuntimeIndex().matchHistory[lane];
	const replay = replayElo(historyLane, asOfDate);
	const eloP1 = replay.overall.get(p1) ?? 1500;
	const eloP2 = replay.overall.get(p2) ?? 1500;
	const p1GeneralProb = expectedWinProbability(eloP1, eloP2);
	const p2GeneralProb = expectedWinProbability(eloP2, eloP1);
	const a = computeOpponentSpecificProbability({
		player: p1,
		opponent: p2,
		lane,
		asOfDate,
		generalWinProbabilityPct: p1GeneralProb
	});
	const b = computeOpponentSpecificProbability({
		player: p2,
		opponent: p1,
		lane,
		asOfDate,
		generalWinProbabilityPct: p2GeneralProb
	});
	if (a.status !== "GO" || b.status !== "GO") return {
		ok: false,
		p1Reason: notEnoughDataReason$1(a),
		p2Reason: notEnoughDataReason$1(b)
	};
	const fmtSide = (r) => fmt$2({
		n_h2h: r.n_h2h,
		raw_h2h_win_pct: r.raw_h2h_win_pct,
		general_win_probability_pct: r.general_win_probability_pct,
		shrinkage_weight: r.shrinkage_weight,
		shrunk_win_probability_pct: r.shrunk_win_probability_pct
	});
	return {
		ok: true,
		p1Value: fmtSide(a.value),
		p2Value: fmtSide(b.value),
		n: Math.min(a.n, b.n)
	};
}
/**
* Live wrapper for the deterministic-*-metrics.server.ts tier chain in
* warehouse-first-researcher.server.ts. Never emits a usable value unless BOTH
* players resolve to a GO lane outcome -- this tier never emits a partial/
* one-sided VALUE for these codes. When neither side is GO (or the underlying
* computation throws), it returns an UNAVAILABLE finding carrying the real,
* already-computed reason instead of bare `null`, so the reason is not lost --
* but this still does not stop the pipeline from trying later tiers: an
* UNAVAILABLE finding is not `fullyUsableFinding`, so warehouse-first-
* researcher.server.ts's `liveMissing` filter still includes this code and the
* live-AI tier still gets a chance to find real evidence. Only bare `null` (no
* evidence-based reason at all) is returned when there is truly nothing to
* report, letting the caller's `if (batch1) return batch1;` fall through as
* before.
*/
async function deterministicBatch1StandaloneMetric(args) {
	const code = codeOf$8(args.metricCode);
	if (!OWNED$4.has(code)) return null;
	const lane = args.tourFamily;
	if (!lane) return null;
	const { p1, p2, asOfDate } = args;
	const source = {
		source_name: "Four-tour static history index (data/generated/tennis-runtime-index.json)",
		url: null,
		retrieved_at: null
	};
	let found = null;
	let evidenceFamily = "";
	let caughtReason = null;
	try {
		if (code === "027") {
			found = finishingAbility027(p1, p2, lane, asOfDate);
			evidenceFamily = "STANDALONE_OPPONENT_FINISHING_ABILITY";
		} else if (code === "029") {
			found = psychologicalResponseProxy029(p1, p2, lane, asOfDate);
			evidenceFamily = "STANDALONE_PSYCHOLOGICAL_RESPONSE_PROXY";
		} else if (code === "031") {
			found = commonOpponentDifferential031(p1, p2, lane, asOfDate);
			evidenceFamily = "STANDALONE_COMMON_OPPONENT_DIFFERENTIAL";
		} else if (code === "041") {
			found = hiddenImprovement041(p1, p2, lane, asOfDate);
			evidenceFamily = "STANDALONE_HIDDEN_IMPROVEMENT";
		} else if (code === "046") {
			found = matchStateElo046(p1, p2, lane, asOfDate);
			evidenceFamily = "STANDALONE_MATCH_STATE_ELO";
		} else if (code === "051") {
			found = opponentSpecificProbability051(p1, p2, lane, asOfDate);
			evidenceFamily = "STANDALONE_OPPONENT_SPECIFIC_PROBABILITY";
		}
	} catch (error) {
		caughtReason = error instanceof Error ? error.message : String(error);
		found = null;
	}
	if (!found) {
		if (!caughtReason) return null;
		return certifyMetricFinding({
			metric_code: code,
			p1_value: null,
			p2_value: null,
			p1_treatment: "UNAVAILABLE",
			p2_treatment: "UNAVAILABLE",
			differential: null,
			evidence_family: evidenceFamily,
			reliability: null,
			sample: `standalone metric #${code} deterministic replay through ${asOfDate}; tour_lane=${lane}; computation error`,
			unavailable_reason: caughtReason,
			sources: []
		});
	}
	if (!found.ok) {
		if (!found.p1Reason && !found.p2Reason) return null;
		return certifyMetricFinding({
			metric_code: code,
			p1_value: null,
			p2_value: null,
			p1_treatment: "UNAVAILABLE",
			p2_treatment: "UNAVAILABLE",
			differential: null,
			evidence_family: evidenceFamily,
			reliability: null,
			sample: `standalone metric #${code} deterministic replay through ${asOfDate}; tour_lane=${lane}; insufficient data`,
			unavailable_reason: [found.p1Reason, found.p2Reason].filter(Boolean).join(" | ") || null,
			p1_unavailable_reason: found.p1Reason,
			p2_unavailable_reason: found.p2Reason,
			sources: [source]
		});
	}
	return certifyMetricFinding({
		metric_code: code,
		p1_value: found.p1Value,
		p2_value: found.p2Value,
		p1_treatment: "RECONSTRUCTED",
		p2_treatment: "RECONSTRUCTED",
		differential: null,
		evidence_family: evidenceFamily,
		reliability: 82,
		sample: `standalone metric #${code} deterministic replay through ${asOfDate}; tour_lane=${lane}; n=${found.n}`,
		unavailable_reason: null,
		sources: [source]
	});
}
var ELO_BANDS = [
	"FAVORITE_STRONG_100_PLUS",
	"FAVORITE_SLIGHT_0_100",
	"UNDERDOG_SLIGHT_0_100",
	"UNDERDOG_STRONG_100_PLUS"
];
function bandOf(gap) {
	if (gap >= 100) return "FAVORITE_STRONG_100_PLUS";
	if (gap >= 0) return "FAVORITE_SLIGHT_0_100";
	if (gap > -100) return "UNDERDOG_SLIGHT_0_100";
	return "UNDERDOG_STRONG_100_PLUS";
}
function computeEloBands(matches) {
	const buckets = /* @__PURE__ */ new Map();
	for (const band of ELO_BANDS) buckets.set(band, {
		n: 0,
		w: 0
	});
	for (const m of matches) {
		const band = bandOf(m.pre_elo - m.opponent_pre_elo);
		const b = buckets.get(band);
		b.n++;
		if (m.won) b.w++;
	}
	return ELO_BANDS.map((band) => {
		const b = buckets.get(band);
		return {
			band,
			n: b.n,
			win_rate: b.n > 0 ? round1(100 * b.w / b.n) : null
		};
	});
}
function normTournament(v) {
	return v.trim().toLowerCase();
}
/** Pure core: given a player's chronologically-ordered (oldest-first) matches, group into tournament runs and classify each run's outcomes by whether the immediately preceding (different) run was STRONG (>=50% win rate) or WEAK. */
function computePostTournamentBuckets(matchesAsc) {
	const runs = [];
	for (const m of matchesAsc) {
		const key = normTournament(m.tournament);
		const last = runs[runs.length - 1];
		if (last && last.tournament === key) last.matches.push(m);
		else runs.push({
			tournament: key,
			matches: [m]
		});
	}
	let strongN = 0, strongW = 0, weakN = 0, weakW = 0;
	for (let i = 1; i < runs.length; i++) {
		const prev = runs[i - 1], cur = runs[i];
		if (!prev.tournament) continue;
		const isStrong = prev.matches.filter((m) => m.won).length / prev.matches.length >= .5;
		for (const m of cur.matches) if (isStrong) {
			strongN++;
			if (m.won) strongW++;
		} else {
			weakN++;
			if (m.won) weakW++;
		}
	}
	return {
		following_strong_tournament: {
			n: strongN,
			win_rate: strongN > 0 ? round1(100 * strongW / strongN) : null
		},
		following_weak_tournament: {
			n: weakN,
			win_rate: weakN > 0 ? round1(100 * weakW / weakN) : null
		}
	};
}
function computeLevelTourTransitionFromMatches(matchesAsc) {
	const bands = computeEloBands(matchesAsc);
	const post = computePostTournamentBuckets(matchesAsc);
	return {
		matches_used: matchesAsc.length,
		elo_differential_bands: bands,
		...post
	};
}
/** Live wrapper: replays Elo for the lane and extracts this player's chronological perspectives (with tournament attached) before delegating to the pure core. */
function computeLevelTourTransition(args) {
	const { player, lane, asOfDate } = args;
	const family = asTourFamily(lane);
	const historyLane = loadRuntimeIndex().matchHistory[family];
	const replay = replayElo(historyLane, asOfDate);
	const key = normalizeEvidenceIdentity(player);
	const matchesAsc = replay.perspectives.filter((p) => p.player === key).sort((a, b) => a.date.localeCompare(b.date)).map((p) => ({
		date: p.date,
		tournament: p.tournament ?? "",
		won: p.won,
		pre_elo: p.pre_elo,
		opponent_pre_elo: p.opponent_pre_elo
	}));
	if (!matchesAsc.length) return {
		lane,
		status: "NOT_ENOUGH_DATA",
		n: 0,
		reason: "No prior matches before asOfDate in this lane."
	};
	const result = computeLevelTourTransitionFromMatches(matchesAsc);
	return {
		lane,
		status: "GO",
		n: result.matches_used,
		value: result
	};
}
var LOSS_AUTOPSY_SET_SEQUENCE_LANES = /* @__PURE__ */ new Set(["WTA_MAIN", "ATP_CHALLENGER"]);
function blowoutMargin([a, b]) {
	return Math.abs(a - b) >= 4;
}
function tiebreakSet$1([a, b]) {
	return a === 7 && b === 6 || a === 6 && b === 7;
}
/**
* Builds a per-player {date|normalizedOpponent -> set_scores} index directly
* from the raw lane object, mirroring audit-metric-046-match-state-elo.ts's
* buildSetScoreIndex so this stays drawn from exactly the same source
* laneMatchesBefore/replayElo already read (never a separately-diverging
* global lookup). Exported for the same reuse reason as blowoutMargin/
* tiebreakSet above.
*/
function buildSetScoreIndex(lane, players) {
	const index = /* @__PURE__ */ new Map();
	for (const player of players) {
		const key = normalizeEvidenceIdentity(player);
		const entries = lane[key];
		const byKey = /* @__PURE__ */ new Map();
		if (Array.isArray(entries)) for (const entry of entries) {
			const [dateRaw, , , opponentRaw, , , , detailRaw] = entry;
			const date = String(dateRaw ?? "").slice(0, 10);
			const opponent = normalizeEvidenceIdentity(String(opponentRaw ?? ""));
			const setScores = detailRaw?.set_scores;
			if (!date || !opponent || !Array.isArray(setScores) || !setScores.length) continue;
			const lookupKey = `${date}|${opponent}`;
			if (!byKey.has(lookupKey)) byKey.set(lookupKey, setScores);
		}
		index.set(key, byKey);
	}
	return index;
}
/**
* Pure core: given this player's chronologically-ordered (oldest-first)
* loss perspectives from a single replayElo pass, and an optional
* set-scores lookup (null when the lane structurally lacks set-sequence
* data), compute the trailing-N loss autopsy.
*/
function computeLossAutopsyFromPerspectives(chronologicalLosses, setScoresFor, trailingN = 20) {
	const losses = chronologicalLosses.slice(-trailingN).map((l) => {
		const gap = round1(l.pre_elo - l.opponent_pre_elo);
		const favoriteStatus = gap > 0 ? "FAVORITE" : gap < 0 ? "UNDERDOG" : "EVEN";
		const setScores = setScoresFor?.(l.date, normalizeEvidenceIdentity(l.opponent));
		const hasSets = Array.isArray(setScores) && setScores.length > 0;
		return {
			date: l.date,
			opponent: l.opponent,
			favorite_status: favoriteStatus,
			elo_gap: gap,
			opponent_quality_elo: round1(l.opponent_pre_elo),
			surface: null,
			lost_set_1: hasSets ? setScores[0][0] < setScores[0][1] : null,
			deciding_set: hasSets ? setScores.length >= 3 : null,
			tiebreak_factor: hasSets ? setScores.some(tiebreakSet$1) : null,
			blowout_loss: hasSets ? setScores.some(blowoutMargin) : null
		};
	}).reverse();
	const favoriteLosses = losses.filter((l) => l.favorite_status === "FAVORITE");
	const surfaceBreakdown = {};
	for (const l of losses) if (l.surface) surfaceBreakdown[l.surface] = (surfaceBreakdown[l.surface] ?? 0) + 1;
	return {
		trailing_losses_used: losses.length,
		set_sequence_available: setScoresFor !== null,
		losses,
		favorite_losses_n: favoriteLosses.length,
		favorite_losses_rate_pct: losses.length ? round1(100 * favoriteLosses.length / losses.length) : null,
		bad_loss_severity_index: favoriteLosses.length ? round1(favoriteLosses.reduce((s, l) => s + l.elo_gap, 0) / favoriteLosses.length) : 0,
		surface_breakdown: surfaceBreakdown
	};
}
/** Live wrapper: replays Elo for the lane, extracts this player's chronological loss perspectives (with surface attached from the raw lane rows) and set-sequence lookup where the lane supports it. */
function computeLossAutopsy(args) {
	const { player, lane, asOfDate, trailingN = 20 } = args;
	const family = asTourFamily(lane);
	const historyLane = loadRuntimeIndex().matchHistory[family];
	const replay = replayElo(historyLane, asOfDate);
	const key = normalizeEvidenceIdentity(player);
	const chronologicalLosses = replay.perspectives.filter((p) => p.player === key && !p.won).sort((a, b) => a.date.localeCompare(b.date)).map((p) => ({
		date: p.date,
		opponent: p.opponent,
		pre_elo: p.pre_elo,
		opponent_pre_elo: p.opponent_pre_elo,
		surface: p.surface
	}));
	if (!chronologicalLosses.length) return {
		lane,
		status: "NOT_ENOUGH_DATA",
		n: 0,
		reason: "No prior losses before asOfDate in this lane."
	};
	const setSequenceLane = LOSS_AUTOPSY_SET_SEQUENCE_LANES.has(lane);
	const players = new Set(chronologicalLosses.map((l) => l.opponent).concat(player));
	const setScoreIndex = setSequenceLane ? buildSetScoreIndex(historyLane, players) : null;
	const result = computeLossAutopsyFromPerspectives(chronologicalLosses, setSequenceLane ? (date, opponent) => setScoreIndex.get(key)?.get(`${date}|${opponent}`) : null, trailingN);
	const surfaceByKey = new Map(chronologicalLosses.map((l) => [`${l.date}|${normalizeEvidenceIdentity(l.opponent)}`, l.surface]));
	for (const l of result.losses) l.surface = surfaceByKey.get(`${l.date}|${normalizeEvidenceIdentity(l.opponent)}`) ?? null;
	const surfaceBreakdown = {};
	for (const l of result.losses) if (l.surface) surfaceBreakdown[l.surface] = (surfaceBreakdown[l.surface] ?? 0) + 1;
	result.surface_breakdown = surfaceBreakdown;
	return {
		lane,
		status: "GO",
		n: result.trailing_losses_used,
		value: result
	};
}
var FAVORITE_FRAGILITY_ELIGIBLE_LANES = /* @__PURE__ */ new Set(["WTA_MAIN", "ATP_CHALLENGER"]);
function tiebreakSet([a, b]) {
	return a === 7 && b === 6 || a === 6 && b === 7;
}
/** Pure core: given a player's already-favorite-filtered match perspectives (with set_scores attached), compute both fragility buckets. */
function computeFavoriteFragilityFromPerspectives(perspectives) {
	const usable = perspectives.filter((p) => Array.isArray(p.setScores) && p.setScores.length > 0);
	let tbN = 0, tbWins = 0, decidingN = 0, decidingWins = 0;
	for (const p of usable) {
		const sets = p.setScores;
		if (tiebreakSet(sets[0])) {
			tbN++;
			if (p.won) tbWins++;
		}
		if (sets.length >= 3) {
			decidingN++;
			if (p.won) decidingWins++;
		}
	}
	return {
		eligible_matches_n: usable.length,
		first_set_tiebreak: {
			n: tbN,
			win_rate: tbN > 0 ? round1(100 * tbWins / tbN) : null
		},
		forced_deciding_set: {
			n: decidingN,
			win_rate: decidingN > 0 ? round1(100 * decidingWins / decidingN) : null
		}
	};
}
/** Live wrapper: replays Elo + matches for the lane, restricts to matches where `player` was the pre-match Elo favorite, attaches set_scores, gated by lane eligibility. */
function computeFavoriteFragility(args) {
	const { player, lane, asOfDate } = args;
	if (!FAVORITE_FRAGILITY_ELIGIBLE_LANES.has(lane)) return {
		lane,
		status: "NOT_ENOUGH_DATA",
		n: 0,
		reason: `${lane} has no set-sequence (set_scores) data in the static history index -- structural schema gap, not sparse data.`
	};
	const family = asTourFamily(lane);
	const historyLane = loadRuntimeIndex().matchHistory[family];
	const replay = replayElo(historyLane, asOfDate);
	const key = normalizeEvidenceIdentity(player);
	const matches = laneMatchesBefore(historyLane, asOfDate).filter((m) => m.p1 === key || m.p2 === key);
	const setScoreIndex = /* @__PURE__ */ new Map();
	for (const p of /* @__PURE__ */ new Set([key, ...matches.map((m) => m.p1 === key ? m.p2 : m.p1)])) {
		const entries = historyLane[p];
		const byKey = /* @__PURE__ */ new Map();
		if (Array.isArray(entries)) for (const entry of entries) {
			const [dateRaw, , , opponentRaw, , , , detailRaw] = entry;
			const date = String(dateRaw ?? "").slice(0, 10);
			const opponent = normalizeEvidenceIdentity(String(opponentRaw ?? ""));
			const setScores = detailRaw?.set_scores;
			if (!date || !opponent || !Array.isArray(setScores) || !setScores.length) continue;
			const lookupKey = `${date}|${opponent}`;
			if (!byKey.has(lookupKey)) byKey.set(lookupKey, setScores);
		}
		setScoreIndex.set(p, byKey);
	}
	const favoritePerspectives = replay.perspectives.filter((p) => p.player === key && p.pre_elo > p.opponent_pre_elo).map((p) => ({
		won: p.won,
		setScores: setScoreIndex.get(key)?.get(`${p.date}|${normalizeEvidenceIdentity(p.opponent)}`)
	}));
	if (!favoritePerspectives.length) return {
		lane,
		status: "NOT_ENOUGH_DATA",
		n: 0,
		reason: "No prior matches before asOfDate where this player was the pre-match Elo favorite."
	};
	const result = computeFavoriteFragilityFromPerspectives(favoritePerspectives);
	if (result.eligible_matches_n === 0) return {
		lane,
		status: "NOT_ENOUGH_DATA",
		n: 0,
		reason: "No favorite-role matches with usable set_scores before asOfDate."
	};
	return {
		lane,
		status: "GO",
		n: result.eligible_matches_n,
		value: result
	};
}
var ENTROPY_ELIGIBLE_LANES = /* @__PURE__ */ new Set(["WTA_MAIN", "ATP_CHALLENGER"]);
/** Shannon entropy in bits over the frequency distribution of `labels`. */
function shannonEntropyBits(labels) {
	if (!labels.length) return 0;
	const counts = /* @__PURE__ */ new Map();
	for (const label of labels) counts.set(label, (counts.get(label) ?? 0) + 1);
	const n = labels.length;
	let h = 0;
	for (const count of counts.values()) {
		const p = count / n;
		h -= p * Math.log2(p);
	}
	return h;
}
/** Pure core: given a player's already leakage-filtered set-score sequences (each entry one historical match's set_scores, self-perspective), compute both entropy figures. */
function computeEntropyFromSetScores(matchSetScores) {
	const allSets = matchSetScores.filter((s) => Array.isArray(s) && s.length > 0).flat();
	const setScoreLabels = allSets.map(([a, b]) => `${a}-${b}`);
	const gameCountLabels = allSets.map(([a, b]) => String(a + b));
	return {
		sets_n: allSets.length,
		set_score_entropy_bits: round1(shannonEntropyBits(setScoreLabels)),
		game_score_entropy_bits: round1(shannonEntropyBits(gameCountLabels)),
		distinct_set_scores: new Set(setScoreLabels).size
	};
}
/** Live wrapper: reads `player`'s own set_scores history strictly before asOfDate from the static index, gated by lane eligibility. */
function computeEntropyLeadDurability(args) {
	const { player, lane, asOfDate } = args;
	if (!ENTROPY_ELIGIBLE_LANES.has(lane)) return {
		lane,
		status: "NOT_ENOUGH_DATA",
		n: 0,
		reason: `${lane} has no set-sequence (set_scores) data in the static history index -- structural schema gap, not sparse data.`
	};
	const family = asTourFamily(lane);
	const entries = loadRuntimeIndex().matchHistory[family][normalizeEvidenceIdentity(player)];
	if (!Array.isArray(entries) || !entries.length) return {
		lane,
		status: "NOT_ENOUGH_DATA",
		n: 0,
		reason: "No prior matches before asOfDate for this player in this lane."
	};
	const matchSetScores = [];
	for (const entry of entries) {
		const [dateRaw, , , , , , , detailRaw] = entry;
		const date = String(dateRaw ?? "").slice(0, 10);
		if (!date || date >= asOfDate) continue;
		const setScores = detailRaw?.set_scores;
		if (Array.isArray(setScores) && setScores.length) matchSetScores.push(setScores);
	}
	if (!matchSetScores.length) return {
		lane,
		status: "NOT_ENOUGH_DATA",
		n: 0,
		reason: "No prior matches with usable set_scores before asOfDate."
	};
	const result = computeEntropyFromSetScores(matchSetScores);
	return {
		lane,
		status: "GO",
		n: result.sets_n,
		value: result
	};
}
var OWNED$3 = /* @__PURE__ */ new Set([
	"020",
	"036",
	"045",
	"052"
]);
function codeOf$7(value) {
	const m = String(value ?? "").match(/(\d{1,3})$/);
	return m ? m[1].padStart(3, "0") : String(value ?? "").padStart(3, "0");
}
function fmt$1(obj) {
	return Object.entries(obj).map(([k, v]) => `${k}=${v === null || v === void 0 ? "NA" : v}`).join("; ");
}
function notEnoughDataReason(outcome) {
	return outcome.status === "NOT_ENOUGH_DATA" ? outcome.reason : null;
}
function levelTourTransition020(p1, p2, lane, asOfDate) {
	const a = computeLevelTourTransition({
		player: p1,
		lane,
		asOfDate
	});
	const b = computeLevelTourTransition({
		player: p2,
		lane,
		asOfDate
	});
	if (a.status !== "GO" || b.status !== "GO") return {
		ok: false,
		p1Reason: notEnoughDataReason(a),
		p2Reason: notEnoughDataReason(b)
	};
	const fmtSide = (r) => fmt$1({
		matches_used: r.matches_used,
		...Object.fromEntries(r.elo_differential_bands.map((band) => [`elo_band_${band.band.toLowerCase()}_win_pct`, band.win_rate])),
		following_strong_tournament_win_pct: r.following_strong_tournament.win_rate,
		following_weak_tournament_win_pct: r.following_weak_tournament.win_rate
	});
	return {
		ok: true,
		p1Value: fmtSide(a.value),
		p2Value: fmtSide(b.value),
		n: Math.min(a.n, b.n)
	};
}
function lossAutopsy036(p1, p2, lane, asOfDate) {
	const a = computeLossAutopsy({
		player: p1,
		lane,
		asOfDate
	});
	const b = computeLossAutopsy({
		player: p2,
		lane,
		asOfDate
	});
	if (a.status !== "GO" || b.status !== "GO") return {
		ok: false,
		p1Reason: notEnoughDataReason(a),
		p2Reason: notEnoughDataReason(b)
	};
	const fmtSide = (r) => fmt$1({
		trailing_losses_used: r.trailing_losses_used,
		favorite_losses_n: r.favorite_losses_n,
		favorite_losses_rate_pct: r.favorite_losses_rate_pct,
		bad_loss_severity_index: r.bad_loss_severity_index,
		set_sequence_available: r.set_sequence_available
	});
	return {
		ok: true,
		p1Value: fmtSide(a.value),
		p2Value: fmtSide(b.value),
		n: Math.min(a.n, b.n)
	};
}
function favoriteFragility045(p1, p2, lane, asOfDate) {
	const a = computeFavoriteFragility({
		player: p1,
		lane,
		asOfDate
	});
	const b = computeFavoriteFragility({
		player: p2,
		lane,
		asOfDate
	});
	if (a.status !== "GO" || b.status !== "GO") return {
		ok: false,
		p1Reason: notEnoughDataReason(a),
		p2Reason: notEnoughDataReason(b)
	};
	const fmtSide = (r) => fmt$1({
		eligible_matches_n: r.eligible_matches_n,
		first_set_tiebreak_n: r.first_set_tiebreak.n,
		first_set_tiebreak_win_pct: r.first_set_tiebreak.win_rate,
		forced_deciding_set_n: r.forced_deciding_set.n,
		forced_deciding_set_win_pct: r.forced_deciding_set.win_rate
	});
	return {
		ok: true,
		p1Value: fmtSide(a.value),
		p2Value: fmtSide(b.value),
		n: Math.min(a.n, b.n)
	};
}
function entropyLeadDurability052(p1, p2, lane, asOfDate) {
	const a = computeEntropyLeadDurability({
		player: p1,
		lane,
		asOfDate
	});
	const b = computeEntropyLeadDurability({
		player: p2,
		lane,
		asOfDate
	});
	if (a.status !== "GO" || b.status !== "GO") return {
		ok: false,
		p1Reason: notEnoughDataReason(a),
		p2Reason: notEnoughDataReason(b)
	};
	const fmtSide = (r) => fmt$1({
		sets_n: r.sets_n,
		set_score_entropy_bits: r.set_score_entropy_bits,
		game_score_entropy_bits: r.game_score_entropy_bits,
		distinct_set_scores: r.distinct_set_scores
	});
	return {
		ok: true,
		p1Value: fmtSide(a.value),
		p2Value: fmtSide(b.value),
		n: Math.min(a.n, b.n)
	};
}
/**
* Live wrapper for the deterministic-*-metrics.server.ts tier chain in
* warehouse-first-researcher.server.ts. Never emits a usable value unless BOTH
* players resolve to a GO lane outcome. When not GO (or the computation
* throws), returns an UNAVAILABLE finding carrying the real reason instead of
* bare `null` -- this does not block later tiers (an UNAVAILABLE finding is
* not `fullyUsableFinding`, so warehouse-first-researcher.server.ts's
* `liveMissing` filter still tries the live-AI tier for this code). Only bare
* `null` is returned when there is truly no evidence-based reason to report.
*/
async function deterministicBatch2NewMetric(args) {
	const code = codeOf$7(args.metricCode);
	if (!OWNED$3.has(code)) return null;
	const lane = args.tourFamily;
	if (!lane) return null;
	const { p1, p2, asOfDate } = args;
	let found = null;
	let evidenceFamily = "";
	let caughtReason = null;
	try {
		if (code === "020") {
			found = levelTourTransition020(p1, p2, lane, asOfDate);
			evidenceFamily = "STANDALONE_LEVEL_TOUR_TRANSITION";
		} else if (code === "036") {
			found = lossAutopsy036(p1, p2, lane, asOfDate);
			evidenceFamily = "STANDALONE_LOSS_AUTOPSY";
		} else if (code === "045") {
			found = favoriteFragility045(p1, p2, lane, asOfDate);
			evidenceFamily = "STANDALONE_FAVORITE_FRAGILITY";
		} else if (code === "052") {
			found = entropyLeadDurability052(p1, p2, lane, asOfDate);
			evidenceFamily = "STANDALONE_ENTROPY_LEAD_DURABILITY";
		}
	} catch (error) {
		caughtReason = error instanceof Error ? error.message : String(error);
		found = null;
	}
	if (!found) {
		if (!caughtReason) return null;
		return certifyMetricFinding({
			metric_code: code,
			p1_value: null,
			p2_value: null,
			p1_treatment: "UNAVAILABLE",
			p2_treatment: "UNAVAILABLE",
			differential: null,
			evidence_family: evidenceFamily,
			reliability: null,
			sample: `standalone metric #${code} deterministic replay through ${asOfDate}; tour_lane=${lane}; computation error`,
			unavailable_reason: caughtReason,
			sources: []
		});
	}
	if (!found.ok) {
		if (!found.p1Reason && !found.p2Reason) return null;
		return certifyMetricFinding({
			metric_code: code,
			p1_value: null,
			p2_value: null,
			p1_treatment: "UNAVAILABLE",
			p2_treatment: "UNAVAILABLE",
			differential: null,
			evidence_family: evidenceFamily,
			reliability: null,
			sample: `standalone metric #${code} deterministic replay through ${asOfDate}; tour_lane=${lane}; insufficient data`,
			unavailable_reason: [found.p1Reason, found.p2Reason].filter(Boolean).join(" | ") || null,
			p1_unavailable_reason: found.p1Reason,
			p2_unavailable_reason: found.p2Reason,
			sources: [{
				source_name: "Four-tour static history index (data/generated/tennis-runtime-index.json)",
				url: null,
				retrieved_at: null
			}]
		});
	}
	return certifyMetricFinding({
		metric_code: code,
		p1_value: found.p1Value,
		p2_value: found.p2Value,
		p1_treatment: "RECONSTRUCTED",
		p2_treatment: "RECONSTRUCTED",
		differential: null,
		evidence_family: evidenceFamily,
		reliability: 78,
		sample: `standalone metric #${code} deterministic replay through ${asOfDate}; tour_lane=${lane}; n=${found.n}`,
		unavailable_reason: null,
		sources: [{
			source_name: "Four-tour static history index (data/generated/tennis-runtime-index.json)",
			url: null,
			retrieved_at: null
		}]
	});
}
var norm$5 = (v) => String(v ?? "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
var PBP_LANES$1 = {
	ATP_MAIN: {
		historyDir: "bsd-atp-main-pbp-history",
		coverageStart: "2024-01-01",
		firstYear: 2024,
		circuit: "ATP",
		challenger: false,
		base: "https://sports.bzzoiro.com/tennis/api/v2"
	},
	ATP_CHALLENGER: {
		historyDir: "bsd-atp-challenger-pbp-history",
		coverageStart: "2025-01-01",
		firstYear: 2025,
		circuit: "ATP",
		challenger: true,
		base: "https://sports.bzzoiro.com/tennis/api/v2"
	},
	WTA_MAIN: {
		historyDir: "bsd-wta-main-pbp-history",
		coverageStart: "2024-12-02",
		firstYear: 2024,
		circuit: "WTA",
		challenger: false,
		base: "https://sports.bzzoiro.com/tennis/api/v2"
	}
};
function rowMatchesLane$1(cfg, r) {
	const blob = norm$5(`${r.category ?? ""} ${r.tournament ?? ""}`);
	if (String(r.circuit ?? "").toUpperCase() !== cfg.circuit) return false;
	if (r.structurally_present !== true) return false;
	if ([
		"itf",
		"futures",
		"utr",
		"satellite",
		"exhibition"
	].some((x) => blob.includes(x))) return false;
	const isChallengerRow = blob.includes("challenger") || blob.includes("wta 125") || blob.includes("wta125") || blob.includes("125k");
	return cfg.challenger ? isChallengerRow : !isChallengerRow;
}
async function loadIndexRows$1(cfg, throughDate) {
	const endYear = Math.min((/* @__PURE__ */ new Date()).getUTCFullYear(), Number(throughDate.slice(0, 4)) || (/* @__PURE__ */ new Date()).getUTCFullYear());
	const years = Array.from({ length: Math.max(0, endYear - cfg.firstYear + 1) }, (_, i) => cfg.firstYear + i);
	return (await Promise.all(years.map(async (year) => {
		try {
			const raw = JSON.parse(await readFile(join(process.cwd(), "data", "audit", cfg.historyDir, String(year), "results.json"), "utf8"));
			return Array.isArray(raw) ? raw : [];
		} catch {
			return [];
		}
	}))).flat();
}
async function defaultFetchPbp$1({ base, matchId }) {
	const token = process.env.BSD_TENNIS_API_KEY;
	if (!token) return null;
	try {
		const r = await fetch(`${base}/matches/${encodeURIComponent(String(matchId))}/point-by-point/`, {
			headers: {
				Authorization: `Token ${token}`,
				"User-Agent": "tennis-truth-engine-audit-metric-026/1.0"
			},
			signal: AbortSignal.timeout(12e3)
		});
		if (!r.ok) return null;
		const p = await r.json();
		return p && typeof p === "object" && p.available === true ? p : null;
	} catch {
		return null;
	}
}
/**
* Cross-match slow-start-recovery aggregation for `player` in `lane`, strictly using
* matches before `asOfDate` (both for the outcome ground truth via laneMatchesBefore, and
* for which PBP index rows are even considered -- see the date filter below). Returns
* null when the lane structurally has no per-game PBP chronology (WTA_CHALLENGER) or the
* date is outside that lane's confirmed coverage start.
*/
async function computeSlowStartRecovery(args) {
	const { player, lane, asOfDate } = args;
	const cfg = PBP_LANES$1[lane];
	if (!cfg) return {
		lane,
		status: "NOT_ENOUGH_DATA",
		n: 0,
		reason: "WTA Challenger's approved PBP index carries only aggregate set/point/game totals (task18b_raw_fields_available:false in bsd-wta-challenger-pbp.server.ts) -- no per-game server/point-winner chronology exists to detect a slow start from, verified against that file's own row shape."
	};
	if (asOfDate < cfg.coverageStart) return {
		lane,
		status: "NOT_ENOUGH_DATA",
		n: 0,
		reason: `Outside confirmed BSD ${lane} PBP coverage boundary (starts ${cfg.coverageStart}).`
	};
	const fetchPbp = args.fetchPbp ?? ((a) => defaultFetchPbp$1({
		base: cfg.base,
		matchId: a.matchId
	}));
	const family = asTourFamily(lane);
	const historyLane = args.historyLaneOverride ?? loadRuntimeIndex().matchHistory[family];
	const playerKey = normalizeEvidenceIdentity(player);
	const laneMatches = laneMatchesBefore(historyLane, asOfDate).filter((m) => m.p1 === playerKey || m.p2 === playerKey);
	const outcomeIndex = /* @__PURE__ */ new Map();
	for (const m of laneMatches) {
		const opponent = m.p1 === playerKey ? m.p2 : m.p1;
		outcomeIndex.set(`${m.date}|${opponent}`, m.winner);
	}
	if (!outcomeIndex.size) return {
		lane,
		status: "NOT_ENOUGH_DATA",
		n: 0,
		reason: "Player has no matches in the static history index before asOfDate to cross-reference match outcomes against."
	};
	const sorted = [...(args.indexRowsOverride ?? await loadIndexRows$1(cfg, asOfDate)).filter((r) => rowMatchesLane$1(cfg, r) && Boolean(r.date) && String(r.date).slice(0, 10) >= cfg.coverageStart && String(r.date).slice(0, 10) < asOfDate && (r.players ?? []).map(norm$5).includes(playerKey))].sort((a, b) => String(b.date ?? "").localeCompare(String(a.date ?? ""))).slice(0, 40);
	const matches = [];
	await Promise.all(sorted.map(async (row) => {
		if (!Array.isArray(row.players) || row.players.length !== 2 || !row.match_id) return;
		const names = row.players.map((v) => String(v ?? ""));
		const idx = names.findIndex((n) => norm$5(n) === playerKey);
		if (idx < 0) return;
		const opponentName = names[idx === 0 ? 1 : 0];
		const date = String(row.date).slice(0, 10);
		const winner = outcomeIndex.get(`${date}|${norm$5(opponentName)}`);
		if (!winner) return;
		const payload = await fetchPbp({ matchId: row.match_id });
		if (!payload) return;
		const recovery = deriveOpeningWindowProfile(payload);
		if (!recovery.valid) return;
		const side = idx === 0 ? "player1" : "player2";
		const profile = recovery.derived[side];
		if (!profile || profile.slow_start_flag === null) return;
		matches.push({
			date,
			opponent: opponentName,
			slow_start: profile.slow_start_flag,
			won_match: winner === playerKey
		});
	}));
	const examined = matches.length;
	const slowStartMatches = matches.filter((m) => m.slow_start);
	const slowStartWins = slowStartMatches.filter((m) => m.won_match).length;
	const nonSlowStartMatches = matches.filter((m) => !m.slow_start);
	const nonSlowStartWins = nonSlowStartMatches.filter((m) => m.won_match).length;
	if (examined < 6 || slowStartMatches.length < 5) return {
		lane,
		status: "NOT_ENOUGH_DATA",
		n: examined,
		reason: `Only ${examined} PBP-covered past ${lane} match(es) (needs >=6) with ${slowStartMatches.length} slow-start instance(s) (needs >=5) found for this player before asOfDate.`
	};
	return {
		lane,
		status: "GO",
		n: examined,
		value: {
			pbp_covered_matches_examined: examined,
			slow_start_matches: slowStartMatches.length,
			slow_start_matches_won: slowStartWins,
			slow_start_recovery_rate_pct: Number((100 * slowStartWins / slowStartMatches.length).toFixed(1)),
			non_slow_start_win_rate_pct: nonSlowStartMatches.length ? Number((100 * nonSlowStartWins / nonSlowStartMatches.length).toFixed(1)) : null,
			matches
		}
	};
}
var OWNED$2 = /* @__PURE__ */ new Set(["026"]);
function codeOf$6(value) {
	const m = String(value ?? "").match(/(\d{1,3})$/);
	return m ? m[1].padStart(3, "0") : String(value ?? "").padStart(3, "0");
}
function fmtSide(r) {
	return `pbp_covered_matches_examined=${r.pbp_covered_matches_examined}; slow_start_matches=${r.slow_start_matches}; slow_start_matches_won=${r.slow_start_matches_won}; slow_start_recovery_rate_pct=${r.slow_start_recovery_rate_pct ?? "NA"}; non_slow_start_win_rate_pct=${r.non_slow_start_win_rate_pct ?? "NA"}`;
}
/**
* Live wrapper for warehouse-first-researcher.server.ts's live-fetch tier. Returns null
* (fall through to the next tier) unless BOTH players resolve to a GO cross-match
* slow-start-recovery outcome for the resolved tour lane. Never fabricates: a lane this
* module structurally cannot support (WTA_CHALLENGER) or a player without enough
* PBP-covered slow-start instances always falls through here.
*/
async function deterministicBatch3EarlyWarningMetric(args) {
	const code = codeOf$6(args.metricCode);
	if (!OWNED$2.has(code)) return null;
	const lane = args.tourFamily;
	if (!lane) return null;
	const { p1, p2, asOfDate } = args;
	let a, b;
	try {
		[a, b] = await Promise.all([computeSlowStartRecovery({
			player: p1,
			lane,
			asOfDate
		}), computeSlowStartRecovery({
			player: p2,
			lane,
			asOfDate
		})]);
	} catch {
		return null;
	}
	if (a.status !== "GO" || b.status !== "GO") return null;
	return certifyMetricFinding({
		metric_code: code,
		p1_value: fmtSide(a.value),
		p2_value: fmtSide(b.value),
		p1_treatment: "RECONSTRUCTED",
		p2_treatment: "RECONSTRUCTED",
		differential: null,
		evidence_family: "STANDALONE_EARLY_WARNING_SLOW_START",
		reliability: 74,
		sample: `metric #026 cross-match slow-start-recovery through ${asOfDate}; tour_lane=${lane}; p1_n=${a.n}; p2_n=${b.n}`,
		unavailable_reason: null,
		sources: [{
			source_name: "Approved BSD four-tour point-by-point (within-match) + static history index (match outcome ground truth)",
			url: null,
			retrieved_at: null
		}]
	});
}
var UPSET_COMPATIBILITY_SET_SEQUENCE_LANES = LOSS_AUTOPSY_SET_SEQUENCE_LANES;
var DEFAULT_TRAILING_UPSET_WINS = 20;
/**
* Pure core: given this player's chronologically-ordered (oldest-first) WIN
* perspectives from a single replayElo pass, already filtered to the ones
* where the player was the underdog (a "verified upset outcome" -- the
* match result plus a lower pre-match Elo than the opponent, both drawn
* from the same leakage-safe replay every other module in this batch
* relies on), compute the trailing-N underdog win profile.
*/
function computeUnderdogWinProfileFromPerspectives(chronologicalUpsetWins, setScoresFor, trailingN = DEFAULT_TRAILING_UPSET_WINS) {
	const wins = chronologicalUpsetWins.slice(-trailingN).map((w) => {
		const gap = round1(w.pre_elo - w.opponent_pre_elo);
		const setScores = setScoresFor?.(w.date, normalizeEvidenceIdentity(w.opponent));
		const hasSets = Array.isArray(setScores) && setScores.length > 0;
		return {
			date: w.date,
			opponent: w.opponent,
			elo_gap: gap,
			opponent_quality_elo: round1(w.opponent_pre_elo),
			surface: null,
			took_set_1: hasSets ? setScores[0][0] > setScores[0][1] : null,
			deciding_set: hasSets ? setScores.length >= 3 : null,
			tiebreak_factor: hasSets ? setScores.some(tiebreakSet$1) : null,
			blowout_win: hasSets ? setScores.some(blowoutMargin) : null
		};
	}).reverse();
	const withSets = wins.filter((w) => w.took_set_1 !== null);
	const rate = (n, d) => d ? round1(100 * n / d) : null;
	const surfaceBreakdown = {};
	for (const w of wins) if (w.surface) surfaceBreakdown[w.surface] = (surfaceBreakdown[w.surface] ?? 0) + 1;
	return {
		trailing_underdog_wins_used: wins.length,
		set_sequence_available: setScoresFor !== null,
		underdog_wins: wins,
		avg_upset_opponent_quality_elo: wins.length ? round1(wins.reduce((s, w) => s + w.opponent_quality_elo, 0) / wins.length) : null,
		took_set_1_rate_pct: rate(withSets.filter((w) => w.took_set_1).length, withSets.length),
		deciding_set_rate_pct: rate(withSets.filter((w) => w.deciding_set).length, withSets.length),
		tiebreak_factor_rate_pct: rate(withSets.filter((w) => w.tiebreak_factor).length, withSets.length),
		blowout_win_rate_pct: rate(withSets.filter((w) => w.blowout_win).length, withSets.length),
		surface_breakdown: surfaceBreakdown
	};
}
/**
* Live wrapper: replays Elo for the lane, extracts this player's
* chronological UNDERDOG win perspectives (with surface attached from the
* raw lane rows) and set-sequence lookup where the lane supports it. Reused
* directly by audit-metric-043-favorite-failure-mode.ts to assess an
* opponent's own "sourced ability to reproduce" a favorite's failure
* conditions -- an opponent's underdog-win profile IS that ability, viewed
* from the other side of the same replay.
*/
function computeUnderdogWinProfile(args) {
	const { player, lane, asOfDate, trailingN = DEFAULT_TRAILING_UPSET_WINS } = args;
	const family = asTourFamily(lane);
	const historyLane = loadRuntimeIndex().matchHistory[family];
	const replay = replayElo(historyLane, asOfDate);
	const key = normalizeEvidenceIdentity(player);
	const chronologicalUpsetWins = replay.perspectives.filter((p) => p.player === key && p.won && p.pre_elo < p.opponent_pre_elo).sort((a, b) => a.date.localeCompare(b.date)).map((p) => ({
		date: p.date,
		opponent: p.opponent,
		pre_elo: p.pre_elo,
		opponent_pre_elo: p.opponent_pre_elo,
		surface: p.surface
	}));
	if (!chronologicalUpsetWins.length) return {
		lane,
		status: "NOT_ENOUGH_DATA",
		n: 0,
		reason: "No verified prior underdog wins before asOfDate in this lane."
	};
	const setSequenceLane = UPSET_COMPATIBILITY_SET_SEQUENCE_LANES.has(lane);
	const players = new Set(chronologicalUpsetWins.map((w) => w.opponent).concat(player));
	const setScoreIndex = setSequenceLane ? buildSetScoreIndex(historyLane, players) : null;
	const result = computeUnderdogWinProfileFromPerspectives(chronologicalUpsetWins, setSequenceLane ? (date, opponent) => setScoreIndex.get(key)?.get(`${date}|${opponent}`) : null, trailingN);
	const surfaceByKey = new Map(chronologicalUpsetWins.map((w) => [`${w.date}|${normalizeEvidenceIdentity(w.opponent)}`, w.surface]));
	for (const w of result.underdog_wins) w.surface = surfaceByKey.get(`${w.date}|${normalizeEvidenceIdentity(w.opponent)}`) ?? null;
	const surfaceBreakdown = {};
	for (const w of result.underdog_wins) if (w.surface) surfaceBreakdown[w.surface] = (surfaceBreakdown[w.surface] ?? 0) + 1;
	result.surface_breakdown = surfaceBreakdown;
	return {
		lane,
		status: "GO",
		n: result.trailing_underdog_wins_used,
		value: result
	};
}
var OPPONENT_UPSET_COMPATIBILITY_EXCLUDED_DIMENSIONS = [
	"ranking (no historical per-match ranking snapshot in the static index; derived Elo substitutes, same as #020/#031/#041)",
	"handedness (metric-recoverability-map.ts #068: TRULY_UNAVAILABLE, not confirmed anywhere in this system's evidence universe)",
	"serve style (no chronological per-player serve series anywhere in the static index or approved BSD PBP aggregation)",
	"return quality (same gap as serve style)",
	"rally style (no shot-level data anywhere in this system)",
	"tournament level (static index rows carry name/round, not a level field; this computation is already scoped to one tour lane, making level structurally constant within it)"
];
/**
* Live wrapper: builds this player's underdog-win profile, then compares
* today's favorite (by derived Elo) and today's match surface against it.
* "Price" is deliberately not computed here -- see the module header and
* the wiring layer for why that stays a separate, secondary tier rather
* than a merged input to this synchronous engine.
*/
function computeOpponentUpsetCompatibility(args) {
	const { player, todaysFavorite, lane, asOfDate, todaysMatchSurface = null, trailingN } = args;
	const profile = computeUnderdogWinProfile({
		player,
		lane,
		asOfDate,
		trailingN
	});
	if (profile.status !== "GO") return profile;
	const family = asTourFamily(lane);
	const historyLane = loadRuntimeIndex().matchHistory[family];
	const favoriteElo = replayElo(historyLane, asOfDate).overall.get(normalizeEvidenceIdentity(todaysFavorite)) ?? null;
	const avgUpsetOpponentElo = profile.value.avg_upset_opponent_quality_elo;
	const eloGap = favoriteElo !== null && avgUpsetOpponentElo !== null ? round1(favoriteElo - avgUpsetOpponentElo) : null;
	const surfaceKey = todaysMatchSurface ? String(todaysMatchSurface).trim().toLowerCase() : null;
	const winsWithSurface = profile.value.underdog_wins.filter((w) => w.surface);
	const surfaceMatchRate = surfaceKey && winsWithSurface.length ? round1(100 * winsWithSurface.filter((w) => w.surface === surfaceKey).length / winsWithSurface.length) : null;
	return {
		lane,
		status: "GO",
		n: profile.n,
		value: {
			underdog_win_profile: profile.value,
			todays_favorite_elo: favoriteElo !== null ? round1(favoriteElo) : null,
			elo_gap_to_avg_upset_opponent: eloGap,
			surface_match_rate_pct: surfaceMatchRate,
			todays_match_surface: surfaceKey,
			excluded_similarity_dimensions: OPPONENT_UPSET_COMPATIBILITY_EXCLUDED_DIMENSIONS
		}
	};
}
var FAILURE_CONDITIONS = [
	"lost_set_1",
	"deciding_set",
	"tiebreak_factor",
	"blowout_loss"
];
var CONDITION_TO_LOSS_FIELD = {
	lost_set_1: "lost_set_1",
	deciding_set: "deciding_set",
	tiebreak_factor: "tiebreak_factor",
	blowout_loss: "blowout_loss"
};
var CONDITION_TO_WIN_FIELD = {
	lost_set_1: "took_set_1",
	deciding_set: "deciding_set",
	tiebreak_factor: "tiebreak_factor",
	blowout_loss: "blowout_win"
};
function rateOf(bools) {
	const known = bools.filter((b) => b !== null);
	return known.length ? round1(100 * known.filter(Boolean).length / known.length) : null;
}
/**
* Pure core: given the player's favorite-role losses and the opponent's
* underdog-win profile (both already computed by their respective owning
* modules), compute the per-condition reproduction compatibility and the
* relevance-weighted composite score.
*
* Composite formula: reproduction_compatibility_score_pct = weighted
* average of opponent_reproduction_rate_i, weighted by
* player_favorite_loss_rate_i, over conditions where BOTH rates are known
* and the player's own rate is > 0 (a condition the player never fails on
* cannot be weighted into "how compatible is this opponent with MY
* failure modes" -- it isn't one of their failure modes). Null when no
* condition has both a known player rate > 0 and a known opponent rate
* (e.g. neither side has set-sequence data in this lane).
*/
function computeFailureConditionCompatibility(playerLosses, opponentUnderdogWins) {
	const conditions = FAILURE_CONDITIONS.map((condition) => {
		const lossField = CONDITION_TO_LOSS_FIELD[condition];
		const winField = CONDITION_TO_WIN_FIELD[condition];
		return {
			condition,
			player_favorite_loss_rate_pct: rateOf(playerLosses.map((l) => l[lossField])),
			opponent_reproduction_rate_pct: rateOf(opponentUnderdogWins.map((w) => w[winField]))
		};
	});
	let weightedSum = 0, weightTotal = 0;
	for (const c of conditions) {
		if (c.player_favorite_loss_rate_pct === null || c.opponent_reproduction_rate_pct === null) continue;
		if (c.player_favorite_loss_rate_pct <= 0) continue;
		weightedSum += c.player_favorite_loss_rate_pct * c.opponent_reproduction_rate_pct;
		weightTotal += c.player_favorite_loss_rate_pct;
	}
	return {
		conditions,
		reproduction_compatibility_score_pct: weightTotal > 0 ? round1(weightedSum / weightTotal) : null
	};
}
/**
* Live wrapper: computes the player's own loss autopsy (#036), keeps only
* the favorite-role losses, computes the opponent's underdog-win profile
* (#044's shared core), and cross-references failure conditions between
* them. GO requires the player to have at least one favorite-role loss AND
* the opponent to have at least one verified underdog win in this lane
* before asOfDate -- both leakage-safe via the replayElo pass each
* sub-engine already performs (see #036/#044's own leakage tests).
*/
function computeFavoriteFailureMode(args) {
	const { player, opponent, lane, asOfDate, trailingN = 20 } = args;
	if (normalizeEvidenceIdentity(player) === normalizeEvidenceIdentity(opponent)) return {
		lane,
		status: "NOT_ENOUGH_DATA",
		n: 0,
		reason: "Player and opponent resolve to the same identity."
	};
	const lossResult = computeLossAutopsy({
		player,
		lane,
		asOfDate,
		trailingN
	});
	if (lossResult.status !== "GO") return {
		lane,
		status: "NOT_ENOUGH_DATA",
		n: 0,
		reason: `Player: ${lossResult.reason}`
	};
	const favoriteLosses = lossResult.value.losses.filter((l) => l.favorite_status === "FAVORITE");
	if (!favoriteLosses.length) return {
		lane,
		status: "NOT_ENOUGH_DATA",
		n: 0,
		reason: "Player has prior losses before asOfDate, but none as the pre-match Elo favorite."
	};
	const opponentProfile = computeUnderdogWinProfile({
		player: opponent,
		lane,
		asOfDate,
		trailingN
	});
	if (opponentProfile.status !== "GO") return {
		lane,
		status: "NOT_ENOUGH_DATA",
		n: 0,
		reason: `Opponent: ${opponentProfile.reason}`
	};
	const { conditions, reproduction_compatibility_score_pct } = computeFailureConditionCompatibility(favoriteLosses, opponentProfile.value.underdog_wins);
	return {
		lane,
		status: "GO",
		n: Math.min(favoriteLosses.length, opponentProfile.n),
		value: {
			trailing_favorite_losses_n: favoriteLosses.length,
			favorite_losses_rate_pct: lossResult.value.favorite_losses_rate_pct,
			bad_loss_severity_index: lossResult.value.bad_loss_severity_index,
			set_sequence_available: lossResult.value.set_sequence_available && opponentProfile.value.set_sequence_available,
			failure_conditions: conditions,
			opponent_underdog_wins_n: opponentProfile.n,
			reproduction_compatibility_score_pct
		}
	};
}
var OWNED$1 = /* @__PURE__ */ new Set(["043", "044"]);
function codeOf$5(value) {
	const m = String(value ?? "").match(/(\d{1,3})$/);
	return m ? m[1].padStart(3, "0") : String(value ?? "").padStart(3, "0");
}
function fmt(obj) {
	return Object.entries(obj).map(([k, v]) => `${k}=${v === null || v === void 0 ? "NA" : v}`).join("; ");
}
/**
* 043 is inherently directional (favorite-role losses for one player,
* cross-referenced against the OTHER player's underdog-win reproduction
* ability) -- so both directions are computed: p1-as-favorite-failing vs
* p2-as-reproducer, and p2-as-favorite-failing vs p1-as-reproducer. Each
* side of the finding reports that player's OWN favorite-failure-mode
* profile against the actual opponent they face today, not a symmetric or
* averaged value.
*/
function favoriteFailureMode043(p1, p2, lane, asOfDate, surface) {
	const a = computeFavoriteFailureMode({
		player: p1,
		opponent: p2,
		lane,
		asOfDate
	});
	const b = computeFavoriteFailureMode({
		player: p2,
		opponent: p1,
		lane,
		asOfDate
	});
	if (a.status !== "GO" && b.status !== "GO") return null;
	const fmtSide = (r) => r.status !== "GO" ? `status=NOT_ENOUGH_DATA; reason=${r.reason}` : fmt({
		trailing_favorite_losses_n: r.value.trailing_favorite_losses_n,
		favorite_losses_rate_pct: r.value.favorite_losses_rate_pct,
		bad_loss_severity_index: r.value.bad_loss_severity_index,
		opponent_underdog_wins_n: r.value.opponent_underdog_wins_n,
		reproduction_compatibility_score_pct: r.value.reproduction_compatibility_score_pct,
		set_sequence_available: r.value.set_sequence_available,
		...Object.fromEntries(r.value.failure_conditions.map((c) => [`${c.condition}_player_rate_pct`, c.player_favorite_loss_rate_pct])),
		...Object.fromEntries(r.value.failure_conditions.map((c) => [`${c.condition}_opponent_reproduction_rate_pct`, c.opponent_reproduction_rate_pct]))
	});
	const n = (a.status === "GO" ? a.n : 0) + (b.status === "GO" ? b.n : 0);
	return {
		p1Value: fmtSide(a),
		p2Value: fmtSide(b),
		p1Treatment: a.status === "GO" ? "RECONSTRUCTED" : "UNAVAILABLE",
		p2Treatment: b.status === "GO" ? "RECONSTRUCTED" : "UNAVAILABLE",
		n
	};
}
/**
* 044, similarly directional: each player's own underdog-win history
* compared against the OTHER player (as today's favorite).
*/
function opponentUpsetCompatibility044(p1, p2, lane, asOfDate, surface) {
	const a = computeOpponentUpsetCompatibility({
		player: p1,
		todaysFavorite: p2,
		lane,
		asOfDate,
		todaysMatchSurface: surface
	});
	const b = computeOpponentUpsetCompatibility({
		player: p2,
		todaysFavorite: p1,
		lane,
		asOfDate,
		todaysMatchSurface: surface
	});
	if (a.status !== "GO" && b.status !== "GO") return null;
	const fmtSide = (r) => r.status !== "GO" ? `status=NOT_ENOUGH_DATA; reason=${r.reason}` : fmt({
		trailing_underdog_wins_n: r.value.underdog_win_profile.trailing_underdog_wins_used,
		avg_upset_opponent_quality_elo: r.value.underdog_win_profile.avg_upset_opponent_quality_elo,
		took_set_1_rate_pct: r.value.underdog_win_profile.took_set_1_rate_pct,
		deciding_set_rate_pct: r.value.underdog_win_profile.deciding_set_rate_pct,
		tiebreak_factor_rate_pct: r.value.underdog_win_profile.tiebreak_factor_rate_pct,
		todays_favorite_elo: r.value.todays_favorite_elo,
		elo_gap_to_avg_upset_opponent: r.value.elo_gap_to_avg_upset_opponent,
		surface_match_rate_pct: r.value.surface_match_rate_pct,
		excluded_similarity_dimensions_n: r.value.excluded_similarity_dimensions.length
	});
	const n = (a.status === "GO" ? a.n : 0) + (b.status === "GO" ? b.n : 0);
	return {
		p1Value: fmtSide(a),
		p2Value: fmtSide(b),
		p1Treatment: a.status === "GO" ? "RECONSTRUCTED" : "UNAVAILABLE",
		p2Treatment: b.status === "GO" ? "RECONSTRUCTED" : "UNAVAILABLE",
		n
	};
}
/**
* Live wrapper for the deterministic-*-metrics.server.ts tier chain in
* warehouse-first-researcher.server.ts. Returns null (fall through to the
* market tier, then the rest of the pipeline) unless AT LEAST ONE player
* resolves to a GO lane outcome -- unlike the batch1/batch2 tiers (which
* require both players GO on the same symmetric metric), 043/044 are
* inherently per-player/directional, so a one-sided real GO result is still
* a real, non-fabricated finding worth surfacing; the other side reports
* its own honest NOT_ENOUGH_DATA reason rather than being suppressed.
*/
async function deterministicBatch4FavoriteUnderdogPatterns(args) {
	const code = codeOf$5(args.metricCode);
	if (!OWNED$1.has(code)) return null;
	const lane = args.tourFamily;
	if (!lane) return null;
	const { p1, p2, asOfDate, surface = null } = args;
	let found = null;
	let evidenceFamily = "";
	try {
		if (code === "043") {
			found = favoriteFailureMode043(p1, p2, lane, asOfDate, surface);
			evidenceFamily = "STANDALONE_FAVORITE_FAILURE_MODE";
		} else if (code === "044") {
			found = opponentUpsetCompatibility044(p1, p2, lane, asOfDate, surface);
			evidenceFamily = "STANDALONE_OPPONENT_UPSET_COMPATIBILITY";
		}
	} catch {
		return null;
	}
	if (!found) return null;
	const oneSided = found.p1Treatment === "UNAVAILABLE" || found.p2Treatment === "UNAVAILABLE";
	return certifyMetricFinding({
		metric_code: code,
		p1_value: found.p1Value,
		p2_value: found.p2Value,
		p1_treatment: found.p1Treatment,
		p2_treatment: found.p2Treatment,
		differential: null,
		evidence_family: evidenceFamily,
		reliability: 78,
		sample: `standalone metric #${code} deterministic replay through ${asOfDate}; tour_lane=${lane}; n=${found.n}`,
		unavailable_reason: oneSided ? "One side has no qualifying favorite-role loss / verified underdog-win history in this lane before asOfDate -- see that side's own value text for the specific reason." : null,
		sources: [{
			source_name: "Four-tour static history index (data/generated/tennis-runtime-index.json)",
			url: null,
			retrieved_at: null
		}]
	});
}
var Z_95 = 1.96;
/**
* Pure core: two-sample Wald z-test for the difference between two independent binomial
* rates. Callers are responsible for the MIN_N_PER_SIDE gate (this function will still
* compute a mathematically valid result below that threshold -- it is not itself the
* honesty gate, see computeUncertaintyAdjustedAdvantage below for where that is enforced).
*/
function twoProportionZTest(p1RatePct, n1, p2RatePct, n2) {
	const p1 = p1RatePct / 100, p2 = p2RatePct / 100;
	const variance = p1 * (1 - p1) / n1 + p2 * (1 - p2) / n2;
	const se = Math.sqrt(Math.max(variance, 0));
	const diff = p1 - p2;
	const z = se > 0 ? diff / se : null;
	const marginPct = round1(Z_95 * se * 100);
	const diffPct = round1(diff * 100);
	const significant = z !== null ? Math.abs(z) >= Z_95 : diff !== 0;
	return {
		p1_rate_pct: p1RatePct,
		p1_n: n1,
		p2_rate_pct: p2RatePct,
		p2_n: n2,
		rate_differential_pct: diffPct,
		ci95_lower_pct: round1(diffPct - marginPct),
		ci95_upper_pct: round1(diffPct + marginPct),
		z_score: z === null ? null : round1(z),
		significant_at_95: significant,
		verdict: significant ? "WELL_SUPPORTED_EDGE" : "NOT_STATISTICALLY_DISTINGUISHABLE"
	};
}
var DIMENSIONS = ["lead_protection", "closing_as_underdog"];
function dimensionSide(result, dimension) {
	return dimension === "lead_protection" ? result.lead_protection : result.closing_as_underdog;
}
/**
* Live wrapper: runs #027's finishing-ability engine for BOTH players in the same lane, then
* applies the confidence-interval-adjusted two-proportion test to each of the two dimensions
* #027 exposes. GO requires at least one dimension to have MIN_N_PER_SIDE+ observations on
* BOTH sides; a dimension that doesn't qualify is reported with skipped_reason rather than
* silently dropped or computed anyway.
*/
function computeUncertaintyAdjustedAdvantage(args) {
	const { p1, p2, lane, asOfDate, trailingN } = args;
	const a = computeOpponentFinishingAbility({
		player: p1,
		lane,
		asOfDate,
		trailingN
	});
	const b = computeOpponentFinishingAbility({
		player: p2,
		lane,
		asOfDate,
		trailingN
	});
	if (a.status !== "GO" || b.status !== "GO") return {
		lane,
		status: "NOT_ENOUGH_DATA",
		n: 0,
		reason: `Base metric #027 (Opponent Finishing Ability) requires BOTH players to have a GO result for a two-sample comparison; ${a.status !== "GO" ? "P1" : "P2"}: ${a.status !== "GO" ? a.reason : b.reason}`
	};
	const dimensions = DIMENSIONS.map((dimension) => {
		const sideA = dimensionSide(a.value, dimension);
		const sideB = dimensionSide(b.value, dimension);
		if (sideA.rate === null || sideB.rate === null || sideA.n < 10 || sideB.n < 10) return {
			base_metric_code: "027",
			dimension,
			test: null,
			skipped_reason: `Insufficient sample for a reliable normal-approximation CI (need >= 10 observations per side; have P1 n=${sideA.n}, P2 n=${sideB.n}).`
		};
		return {
			base_metric_code: "027",
			dimension,
			test: twoProportionZTest(sideA.rate, sideA.n, sideB.rate, sideB.n),
			skipped_reason: null
		};
	});
	if (dimensions.every((d) => d.test === null)) return {
		lane,
		status: "NOT_ENOUGH_DATA",
		n: 0,
		reason: "Neither finishing-ability dimension has enough sample on both sides for a reliable CI-adjusted comparison (see per-dimension skipped_reason)."
	};
	return {
		lane,
		status: "GO",
		n: Math.min(a.n, b.n),
		value: { dimensions }
	};
}
var MIN_TWIN_MATCHES = 5;
var K_NEIGHBORS = 15;
var SURFACE_MISMATCH_PENALTY = 150;
function buildCandidates(lane, asOfDate) {
	const replay = replayElo(lane, asOfDate);
	const seen = /* @__PURE__ */ new Set();
	const candidates = [];
	for (const persp of replay.perspectives) {
		const forwardKey = `${persp.date}|${persp.player}|${persp.opponent}`;
		const mirrorKey = `${persp.date}|${persp.opponent}|${persp.player}`;
		if (seen.has(mirrorKey)) continue;
		seen.add(forwardKey);
		const eloGap = persp.pre_elo - persp.opponent_pre_elo;
		candidates.push({
			eloGap,
			surface: persp.surface,
			favoriteWon: eloGap >= 0 ? persp.won : !persp.won,
			date: persp.date
		});
	}
	return {
		replay,
		candidates
	};
}
function computeHistoricalTwinMatchSearch(args) {
	if (!laneMatchesBefore(args.lane, args.asOfDate).length) return null;
	const { replay, candidates } = buildCandidates(args.lane, args.asOfDate);
	const p1Key = normalizeEvidenceIdentity(args.p1);
	const p2Key = normalizeEvidenceIdentity(args.p2);
	const p1Elo = replay.overall.get(p1Key);
	const p2Elo = replay.overall.get(p2Key);
	if (!Number.isFinite(p1Elo) || !Number.isFinite(p2Elo)) return null;
	const targetGap = p1Elo - p2Elo;
	const surface = String(args.surface ?? "").trim().toLowerCase() || null;
	const ranked = candidates.map((c) => ({
		...c,
		distance: Math.abs(c.eloGap - targetGap) + (surface && c.surface !== surface ? SURFACE_MISMATCH_PENALTY : 0)
	})).sort((a, b) => a.distance - b.distance);
	const twins = ranked.slice(0, Math.min(K_NEIGHBORS, ranked.length));
	if (twins.length < MIN_TWIN_MATCHES) return null;
	const favoriteWins = twins.filter((t) => t.favoriteWon).length;
	const favoriteWinPct = Number((100 * favoriteWins / twins.length).toFixed(1));
	const avgTwinEloGap = Math.round(twins.reduce((sum, t) => sum + Math.abs(t.eloGap), 0) / twins.length);
	const surfaceMatchedTwins = surface ? twins.filter((t) => t.surface === surface).length : null;
	const currentFavorite = targetGap >= 0 ? "P1" : "P2";
	const value = [
		`twin_matches_found=${twins.length}`,
		`favorite_win_pct_in_twins=${favoriteWinPct}`,
		`avg_twin_elo_gap=${avgTwinEloGap}`,
		`current_elo_gap_p1_minus_p2=${Math.round(targetGap)}`,
		`current_analogous_favorite=${currentFavorite}`,
		surfaceMatchedTwins !== null ? `surface_matched_twins=${surfaceMatchedTwins}` : null,
		`candidate_pool=${candidates.length}`,
		"calculation=nearest-neighbor Elo-gap search over deterministic K=32 Elo replay, surface-mismatch penalized",
		"covers=elo_gap,court_speed only (hold/break gap, dominance ratio gap, form gap, market price, fatigue gap, age, ranking gap, model disagreement, Monte Carlo output, data quality not reconstructable from this lane)"
	].filter((x) => x !== null).join("; ");
	return {
		p1_value: value,
		p2_value: value,
		differential: `current_elo_gap_p1_minus_p2=${Math.round(targetGap)}`,
		sample: `twin_matches=${twins.length}; candidate_pool=${candidates.length}; date_window=strict pre-match chronology; future_leakage=blocked(date<match_date)`,
		reliability: 65,
		sources: replay.source_names.map((source_name) => ({
			source_name,
			url: null,
			retrieved_at: null
		}))
	};
}
/** Live wrapper: resolves the lane's static history data and delegates to the already-real, already-tested twin-match search engine. */
function computeHistoricalTwinMatchSearchForLane(args) {
	const { p1, p2, lane, asOfDate, surface = null } = args;
	const family = asTourFamily(lane);
	const historyLane = loadRuntimeIndex().matchHistory[family];
	if (!historyLane || typeof historyLane !== "object") return {
		lane,
		status: "NOT_ENOUGH_DATA",
		n: 0,
		reason: `No match-history lane data available for ${lane}.`
	};
	const result = computeHistoricalTwinMatchSearch({
		p1,
		p2,
		asOfDate,
		surface,
		lane: historyLane
	});
	if (!result) return {
		lane,
		status: "NOT_ENOUGH_DATA",
		n: 0,
		reason: "No usable Elo history for one or both players, or fewer than the minimum number of nearest-neighbor twin matches, before asOfDate in this lane."
	};
	return {
		lane,
		status: "GO",
		n: Number(String(result.sample).match(/twin_matches=(\d+)/)?.[1] ?? 0),
		value: result
	};
}
var OWNED = /* @__PURE__ */ new Set(["047", "061"]);
function codeOf$4(value) {
	const m = String(value ?? "").match(/(\d{1,3})$/);
	return m ? m[1].padStart(3, "0") : String(value ?? "").padStart(3, "0");
}
function fmtDimension(d) {
	if (!d.test) return `dimension=${d.dimension}: status=SKIPPED; reason=${d.skipped_reason}`;
	const t = d.test;
	return `dimension=${d.dimension}: p1_rate_pct=${t.p1_rate_pct} (n=${t.p1_n}); p2_rate_pct=${t.p2_rate_pct} (n=${t.p2_n}); rate_differential_pct=${t.rate_differential_pct}; ci95=[${t.ci95_lower_pct}, ${t.ci95_upper_pct}]; z_score=${t.z_score ?? "NA"}; verdict=${t.verdict}`;
}
/**
* 047 is inherently a joint P1-vs-P2 fact (a confidence-interval-adjusted comparison of the
* two players' own rates on the same underlying dimension) -- both sides report the exact
* same symmetric text, same convention as the Historical Twin Match Search result below and
* as evidence-gap.ts's own definition of the metric (a comparison, not a per-player value).
*/
async function uncertaintyAdjustedAdvantage047(p1, p2, lane, asOfDate) {
	const result = computeUncertaintyAdjustedAdvantage({
		p1,
		p2,
		lane,
		asOfDate
	});
	if (result.status !== "GO") return null;
	const value = result.value.dimensions.map(fmtDimension).join("; ");
	return certifyMetricFinding({
		metric_code: "047",
		p1_value: value,
		p2_value: value,
		p1_treatment: "RECONSTRUCTED",
		p2_treatment: "RECONSTRUCTED",
		differential: null,
		evidence_family: "STANDALONE_UNCERTAINTY_ADJUSTED_ADVANTAGE",
		reliability: 80,
		sample: `standalone metric #047 CI-adjusted comparison over metric #027 (Opponent Finishing Ability) dimensions; two-sample Wald z-test; tour_lane=${lane}; n=${result.n}`,
		unavailable_reason: null,
		sources: [{
			source_name: "Four-tour static history index (data/generated/tennis-runtime-index.json)",
			url: null,
			retrieved_at: null
		}]
	});
}
async function historicalTwinMatchSearch061(p1, p2, lane, asOfDate, surface) {
	const result = computeHistoricalTwinMatchSearchForLane({
		p1,
		p2,
		lane,
		asOfDate,
		surface
	});
	if (result.status !== "GO") return null;
	const { p1_value, p2_value, differential, sample, reliability, sources } = result.value;
	return certifyMetricFinding({
		metric_code: "061",
		p1_value,
		p2_value,
		p1_treatment: "RECONSTRUCTED",
		p2_treatment: "RECONSTRUCTED",
		differential,
		evidence_family: "STANDALONE_HISTORICAL_TWIN_MATCH_SEARCH",
		reliability,
		sample,
		unavailable_reason: null,
		sources
	});
}
async function deterministicBatch5NewMetrics(args) {
	const code = codeOf$4(args.metricCode);
	if (!OWNED.has(code)) return null;
	const lane = args.tourFamily;
	if (!lane) return null;
	const { p1, p2, asOfDate, surface = null } = args;
	try {
		if (code === "047") return await uncertaintyAdjustedAdvantage047(p1, p2, lane, asOfDate);
		if (code === "061") return await historicalTwinMatchSearch061(p1, p2, lane, asOfDate, surface);
	} catch {
		return null;
	}
	return null;
}
var RESIDUAL_PERFORMANCE_ELIGIBLE_LANES = /* @__PURE__ */ new Set(["WTA_MAIN", "ATP_CHALLENGER"]);
var ELO_BAND = 100;
var MIN_OWN_MATCHES = 20;
var MIN_COHORT_MATCHES = 100;
var MIN_COHORT_PLAYERS = 8;
function extractSetScores(entry) {
	return entry[7]?.set_scores;
}
function emptyRate() {
	return {
		games_won: 0,
		games_played: 0,
		sets_won: 0,
		sets_played: 0,
		matches: 0
	};
}
function addMatch(rate, setScores) {
	let counted = false;
	for (const [a, b] of setScores) {
		if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
		rate.games_won += a;
		rate.games_played += a + b;
		rate.sets_played += 1;
		if (a > b) rate.sets_won += 1;
		counted = true;
	}
	if (counted) rate.matches += 1;
}
/**
* Builds every player's pooled games/sets-won rate from their own matches strictly before
* asOfDate, in one pass over the lane -- reused both for the target player's own rate and
* for pooling the Elo-band cohort, rather than replaying the lane once per cohort member.
*/
function buildLaneRates(lane, asOfDate) {
	const out = /* @__PURE__ */ new Map();
	for (const [rawKey, rows] of Object.entries(lane ?? {})) {
		const player = normalizeEvidenceIdentity(rawKey);
		if (!player || !Array.isArray(rows)) continue;
		const rate = emptyRate();
		for (const entry of rows) {
			const [dateRaw] = entry;
			const date = String(dateRaw ?? "").slice(0, 10);
			if (!date || date >= asOfDate) continue;
			const setScores = extractSetScores(entry);
			if (!Array.isArray(setScores) || !setScores.length) continue;
			addMatch(rate, setScores);
		}
		if (rate.matches) out.set(player, rate);
	}
	return out;
}
function pct(n, d) {
	return d > 0 ? Number((100 * n / d).toFixed(4)) : null;
}
/**
* Replays the whole lane's Elo and game/set rates as of asOfDate. Caller should replay once
* per (lane, asOfDate) and query both players from the returned state, same performance
* contract as audit-metric-046-match-state-elo.ts's replayMatchStateElo.
*/
function replayResidualPerformance(lane, asOfDate) {
	return {
		elo: replayElo(lane, asOfDate),
		rates: buildLaneRates(lane, asOfDate)
	};
}
function computeResidualPerformanceFromReplay(player, replay) {
	const key = normalizeEvidenceIdentity(player);
	const ownElo = replay.elo.overall.get(key);
	const ownRate = replay.rates.get(key);
	if (ownElo === void 0 || !ownRate || ownRate.matches < MIN_OWN_MATCHES) return null;
	const cohort = emptyRate();
	let cohortPlayers = 0;
	for (const [otherKey, otherElo] of replay.elo.overall) {
		if (otherKey === key) continue;
		if (Math.abs(otherElo - ownElo) > ELO_BAND) continue;
		const otherRate = replay.rates.get(otherKey);
		if (!otherRate) continue;
		cohort.games_won += otherRate.games_won;
		cohort.games_played += otherRate.games_played;
		cohort.sets_won += otherRate.sets_won;
		cohort.sets_played += otherRate.sets_played;
		cohort.matches += otherRate.matches;
		cohortPlayers += 1;
	}
	if (cohort.matches < MIN_COHORT_MATCHES || cohortPlayers < MIN_COHORT_PLAYERS) return null;
	const ownGamesPct = pct(ownRate.games_won, ownRate.games_played);
	const ownSetsPct = pct(ownRate.sets_won, ownRate.sets_played);
	const cohortGamesPct = pct(cohort.games_won, cohort.games_played);
	const cohortSetsPct = pct(cohort.sets_won, cohort.sets_played);
	return {
		own_games_won_pct: ownGamesPct === null ? null : round1(ownGamesPct),
		own_sets_won_pct: ownSetsPct === null ? null : round1(ownSetsPct),
		cohort_games_won_pct: cohortGamesPct === null ? null : round1(cohortGamesPct),
		cohort_sets_won_pct: cohortSetsPct === null ? null : round1(cohortSetsPct),
		games_won_residual_pct: ownGamesPct === null || cohortGamesPct === null ? null : round1(ownGamesPct - cohortGamesPct),
		sets_won_residual_pct: ownSetsPct === null || cohortSetsPct === null ? null : round1(ownSetsPct - cohortSetsPct),
		own_matches: ownRate.matches,
		cohort_players: cohortPlayers,
		cohort_matches: cohort.matches,
		elo_band: ELO_BAND
	};
}
/** Live wrapper: replays the lane once and computes the residual for `player`, gated by lane eligibility. */
function computeOpponentAdjustedResidualPerformance(args) {
	const { player, lane, asOfDate } = args;
	if (!RESIDUAL_PERFORMANCE_ELIGIBLE_LANES.has(lane)) return {
		lane,
		status: "NOT_ENOUGH_DATA",
		n: 0,
		reason: `${lane} does not have broad enough set_scores coverage in the static history index to build a games/sets-won cohort norm.`
	};
	const family = asTourFamily(lane);
	const historyLane = loadRuntimeIndex().matchHistory[family];
	const replay = replayResidualPerformance(historyLane, asOfDate);
	const value = computeResidualPerformanceFromReplay(player, replay);
	if (!value) {
		const key = normalizeEvidenceIdentity(player);
		const ownMatches = replay.rates.get(key)?.matches ?? 0;
		return {
			lane,
			status: "NOT_ENOUGH_DATA",
			n: ownMatches,
			reason: `Player has ${ownMatches} own set_scores-bearing match(es) before asOfDate (needs >=${MIN_OWN_MATCHES}), or the Elo-band cohort was too small (needs >=${MIN_COHORT_PLAYERS} players / >=${MIN_COHORT_MATCHES} matches).`
		};
	}
	if (!laneMatchesBefore(historyLane, asOfDate).length) return {
		lane,
		status: "NOT_ENOUGH_DATA",
		n: 0,
		reason: "Lane has no leakage-safe matches before asOfDate."
	};
	return {
		lane,
		status: "GO",
		n: value.own_matches,
		value
	};
}
var norm$4 = (v) => String(v ?? "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
var PBP_LANES = {
	ATP_MAIN: {
		historyDir: "bsd-atp-main-pbp-history",
		coverageStart: "2024-01-01",
		firstYear: 2024,
		circuit: "ATP",
		challenger: false,
		base: "https://sports.bzzoiro.com/tennis/api/v2"
	},
	ATP_CHALLENGER: {
		historyDir: "bsd-atp-challenger-pbp-history",
		coverageStart: "2025-01-01",
		firstYear: 2025,
		circuit: "ATP",
		challenger: true,
		base: "https://sports.bzzoiro.com/tennis/api/v2"
	},
	WTA_MAIN: {
		historyDir: "bsd-wta-main-pbp-history",
		coverageStart: "2024-12-02",
		firstYear: 2024,
		circuit: "WTA",
		challenger: false,
		base: "https://sports.bzzoiro.com/tennis/api/v2"
	}
};
function rowMatchesLane(cfg, r) {
	const blob = norm$4(`${r.category ?? ""} ${r.tournament ?? ""}`);
	if (String(r.circuit ?? "").toUpperCase() !== cfg.circuit) return false;
	if (r.structurally_present !== true) return false;
	if ([
		"itf",
		"futures",
		"utr",
		"satellite",
		"exhibition"
	].some((x) => blob.includes(x))) return false;
	const isChallengerRow = blob.includes("challenger") || blob.includes("wta 125") || blob.includes("wta125") || blob.includes("125k");
	return cfg.challenger ? isChallengerRow : !isChallengerRow;
}
async function loadIndexRows(cfg, throughDate) {
	const endYear = Math.min((/* @__PURE__ */ new Date()).getUTCFullYear(), Number(throughDate.slice(0, 4)) || (/* @__PURE__ */ new Date()).getUTCFullYear());
	const years = Array.from({ length: Math.max(0, endYear - cfg.firstYear + 1) }, (_, i) => cfg.firstYear + i);
	return (await Promise.all(years.map(async (year) => {
		try {
			const raw = JSON.parse(await readFile(join(process.cwd(), "data", "audit", cfg.historyDir, String(year), "results.json"), "utf8"));
			return Array.isArray(raw) ? raw : [];
		} catch {
			return [];
		}
	}))).flat();
}
async function defaultFetchPbp({ base, matchId }) {
	const token = process.env.BSD_TENNIS_API_KEY;
	if (!token) return null;
	try {
		const r = await fetch(`${base}/matches/${encodeURIComponent(String(matchId))}/point-by-point/`, {
			headers: {
				Authorization: `Token ${token}`,
				"User-Agent": "tennis-truth-engine-audit-metric-040/1.0"
			},
			signal: AbortSignal.timeout(12e3)
		});
		if (!r.ok) return null;
		const p = await r.json();
		return p && typeof p === "object" && p.available === true ? p : null;
	} catch {
		return null;
	}
}
function toMatchStats(date, side, recovery) {
	if (!recovery.valid) return null;
	const s002 = recovery.derived[side]?.["002"]?.value;
	const s003 = recovery.derived[side]?.["003"]?.value;
	const s032 = recovery.derived[side]?.["032"]?.value;
	if (!s002 && !s003 && !s032) return null;
	const acePct = s002 && s002.aces !== null && typeof s002.service_points === "number" && s002.service_points > 0 ? 100 * Number(s002.aces) / s002.service_points : null;
	const dfPct = s002 && s002.double_faults !== null && typeof s002.service_points === "number" && s002.service_points > 0 ? 100 * Number(s002.double_faults) / s002.service_points : null;
	return {
		date,
		ace_pct: acePct,
		ace_n: typeof s002?.service_points === "number" ? s002.service_points : 0,
		df_pct: dfPct,
		df_n: typeof s002?.service_points === "number" ? s002.service_points : 0,
		service_points_won_pct: typeof s002?.service_point_win_pct === "number" ? s002.service_point_win_pct : null,
		service_points_n: typeof s002?.service_points === "number" ? s002.service_points : 0,
		return_points_won_pct: typeof s003?.return_point_win_pct === "number" ? s003.return_point_win_pct : null,
		return_points_n: typeof s003?.return_points === "number" ? s003.return_points : 0,
		hold_pct: typeof s002?.hold_pct === "number" ? s002.hold_pct : null,
		hold_n: typeof s002?.service_games === "number" ? s002.service_games : 0,
		break_converted_pct: typeof s032?.bp_converted_pct === "number" ? s032.bp_converted_pct : null,
		break_n: typeof s032?.break_chances === "number" ? s032.break_chances : 0
	};
}
var MIN_N_PER_HALF = 30;
function pooledRate(matches, rateKey, nKey) {
	let weighted = 0, n = 0;
	for (const m of matches) {
		const rate = m[rateKey];
		const weight = m[nKey];
		if (rate === null || !Number.isFinite(weight) || weight <= 0) continue;
		weighted += rate * weight;
		n += weight;
	}
	return {
		rate: n > 0 ? weighted / n : null,
		n
	};
}
function dimensionTrend(dimension, matches, rateKey, nKey) {
	const mid = Math.floor(matches.length / 2);
	const earlier = pooledRate(matches.slice(0, mid), rateKey, nKey);
	const recent = pooledRate(matches.slice(mid), rateKey, nKey);
	if (earlier.rate === null || recent.rate === null || earlier.n < MIN_N_PER_HALF || recent.n < MIN_N_PER_HALF) return {
		dimension,
		earlier_rate_pct: earlier.rate,
		earlier_n: earlier.n,
		recent_rate_pct: recent.rate,
		recent_n: recent.n,
		test: null,
		verdict: "INSUFFICIENT_SAMPLE"
	};
	const test = twoProportionZTest(earlier.rate, Math.round(earlier.n), recent.rate, Math.round(recent.n));
	const verdict = test.verdict === "NOT_STATISTICALLY_DISTINGUISHABLE" ? "NOT_STATISTICALLY_DISTINGUISHABLE" : recent.rate < earlier.rate ? "DECLINE" : "IMPROVEMENT";
	return {
		dimension,
		earlier_rate_pct: earlier.rate,
		earlier_n: Math.round(earlier.n),
		recent_rate_pct: recent.rate,
		recent_n: Math.round(recent.n),
		test,
		verdict
	};
}
/**
* Cross-match decline-trend aggregation for `player` in `lane`, strictly using matches
* before `asOfDate`. Mirrors audit-metric-026-early-warning-slow-start.ts's
* computeSlowStartRecovery cross-referencing technique (ground truth for which matches are
* this player's own comes from laneMatchesBefore, PBP payloads are only used for the
* per-match stat detail, not for identifying which matches happened).
*/
async function computeHiddenDecline(args) {
	const { player, lane, asOfDate } = args;
	const cfg = PBP_LANES[lane];
	if (!cfg) return {
		lane,
		status: "NOT_ENOUGH_DATA",
		n: 0,
		reason: "WTA Challenger's approved PBP index carries only aggregate totals -- no per-game chronology exists to compute ace/hold/break trends from, verified against bsd-wta-challenger-pbp.server.ts's own row shape."
	};
	if (asOfDate < cfg.coverageStart) return {
		lane,
		status: "NOT_ENOUGH_DATA",
		n: 0,
		reason: `Outside confirmed BSD ${lane} PBP coverage boundary (starts ${cfg.coverageStart}).`
	};
	const fetchPbp = args.fetchPbp ?? ((a) => defaultFetchPbp({
		base: cfg.base,
		matchId: a.matchId
	}));
	const family = asTourFamily(lane);
	const historyLane = args.historyLaneOverride ?? loadRuntimeIndex().matchHistory[family];
	const playerKey = normalizeEvidenceIdentity(player);
	const laneMatches = laneMatchesBefore(historyLane, asOfDate).filter((m) => m.p1 === playerKey || m.p2 === playerKey);
	const outcomeIndex = /* @__PURE__ */ new Set();
	for (const m of laneMatches) {
		const opponent = m.p1 === playerKey ? m.p2 : m.p1;
		outcomeIndex.add(`${m.date}|${opponent}`);
	}
	if (!outcomeIndex.size) return {
		lane,
		status: "NOT_ENOUGH_DATA",
		n: 0,
		reason: "Player has no matches in the static history index before asOfDate to cross-reference against."
	};
	const sorted = [...(args.indexRowsOverride ?? await loadIndexRows(cfg, asOfDate)).filter((r) => rowMatchesLane(cfg, r) && Boolean(r.date) && String(r.date).slice(0, 10) >= cfg.coverageStart && String(r.date).slice(0, 10) < asOfDate && (r.players ?? []).map(norm$4).includes(playerKey))].sort((a, b) => String(a.date ?? "").localeCompare(String(b.date ?? ""))).slice(-60);
	const collected = [];
	const results = await Promise.all(sorted.map(async (row) => {
		if (!Array.isArray(row.players) || row.players.length !== 2 || !row.match_id) return null;
		const names = row.players.map((v) => String(v ?? ""));
		const idx = names.findIndex((n) => norm$4(n) === playerKey);
		if (idx < 0) return null;
		const opponentName = names[idx === 0 ? 1 : 0];
		const date = String(row.date).slice(0, 10);
		if (!outcomeIndex.has(`${date}|${norm$4(opponentName)}`)) return null;
		const payload = await fetchPbp({ matchId: row.match_id });
		if (!payload) return null;
		const recovery = reconstructPbpScoreState(payload);
		return toMatchStats(date, idx === 0 ? "player1" : "player2", recovery);
	}));
	for (const r of results) if (r) collected.push(r);
	collected.sort((a, b) => a.date.localeCompare(b.date));
	if (collected.length < 12) return {
		lane,
		status: "NOT_ENOUGH_DATA",
		n: collected.length,
		reason: `Only ${collected.length} PBP-covered past ${lane} match(es) with usable per-game stats found before asOfDate (needs >=12).`
	};
	const dimensions = [
		dimensionTrend("ace_rate_pct", collected, "ace_pct", "ace_n"),
		dimensionTrend("double_fault_rate_pct", collected, "df_pct", "df_n"),
		dimensionTrend("service_points_won_pct", collected, "service_points_won_pct", "service_points_n"),
		dimensionTrend("return_points_won_pct", collected, "return_points_won_pct", "return_points_n"),
		dimensionTrend("hold_pct", collected, "hold_pct", "hold_n"),
		dimensionTrend("break_points_converted_pct", collected, "break_converted_pct", "break_n")
	];
	if (!dimensions.some((d) => d.verdict !== "INSUFFICIENT_SAMPLE")) return {
		lane,
		status: "NOT_ENOUGH_DATA",
		n: collected.length,
		reason: `${collected.length} PBP-covered matches found, but no dimension had enough pooled sample in both the earlier and recent half (needs >=${MIN_N_PER_HALF} per half per dimension).`
	};
	return {
		lane,
		status: "GO",
		n: collected.length,
		value: {
			matches_examined: collected.length,
			dimensions
		}
	};
}
var MOTIVATION_STAKES_ELIGIBLE_LANES = /* @__PURE__ */ new Set(["ATP_CHALLENGER"]);
var MIN_EVALUABLE_MATCHES = 15;
/**
* Replays a player's own past ATP_CHALLENGER matches (strictly before asOfDate) and
* aggregates their seeding/points-at-stake profile. `laneMatchesBefore` is used only to
* confirm the lane has real leakage-safe matches at all (same guard pattern as
* audit-metric-038); the seed/draw_size/rank_points detail itself is read directly from the
* lane's own raw entries (index 7), the same technique audit-metric-046's
* buildSetScoreIndex and audit-metric-038's buildLaneRates already use for other detail
* fields not exposed on the laneMatchesBefore Match type.
*/
function computeMotivationStakesProfile(player, lane, asOfDate) {
	const rows = lane[normalizeEvidenceIdentity(player)];
	if (!Array.isArray(rows)) return null;
	let evaluable = 0, seeded = 0, seedSum = 0, pointsSum = 0, pointsN = 0;
	for (const entry of rows) {
		const [dateRaw] = entry;
		const date = String(dateRaw ?? "").slice(0, 10);
		if (!date || date >= asOfDate) continue;
		const detail = entry[7];
		if (!detail || detail.draw_size === null || detail.draw_size === void 0) continue;
		evaluable++;
		if (typeof detail.self_seed === "number" && Number.isFinite(detail.self_seed)) {
			seeded++;
			seedSum += detail.self_seed;
		}
		if (typeof detail.self_rank_points === "number" && Number.isFinite(detail.self_rank_points)) {
			pointsSum += detail.self_rank_points;
			pointsN++;
		}
	}
	if (evaluable < MIN_EVALUABLE_MATCHES) return null;
	return {
		evaluable_matches: evaluable,
		seeded_matches: seeded,
		seeded_rate_pct: round1(100 * seeded / evaluable),
		avg_seed_when_seeded: seeded > 0 ? round1(seedSum / seeded) : null,
		avg_rank_points_at_stake: pointsN > 0 ? round1(pointsSum / pointsN) : null
	};
}
/** Live wrapper: gated to ATP_CHALLENGER (the only lane with real seed/draw_size/rank_points source data). */
function computeMotivationStakes(args) {
	const { player, lane, asOfDate } = args;
	if (!MOTIVATION_STAKES_ELIGIBLE_LANES.has(lane)) return {
		lane,
		status: "NOT_ENOUGH_DATA",
		n: 0,
		reason: `${lane}'s source data has no seed/draw_size/ranking-points columns -- verified directly against that lane's own source CSV header row. Only ATP_CHALLENGER (TennisMyLife normalized CSVs) carries this data.`
	};
	const family = asTourFamily(lane);
	const historyLane = loadRuntimeIndex().matchHistory[family];
	if (!laneMatchesBefore(historyLane, asOfDate).length) return {
		lane,
		status: "NOT_ENOUGH_DATA",
		n: 0,
		reason: "Lane has no leakage-safe matches before asOfDate."
	};
	const value = computeMotivationStakesProfile(player, historyLane, asOfDate);
	if (!value) return {
		lane,
		status: "NOT_ENOUGH_DATA",
		n: 0,
		reason: `Player has fewer than ${MIN_EVALUABLE_MATCHES} own ATP_CHALLENGER matches with known draw_size before asOfDate.`
	};
	return {
		lane,
		status: "GO",
		n: value.evaluable_matches,
		value
	};
}
var SYNCHRONOUS_OWNED = /* @__PURE__ */ new Set(["038", "062"]);
function codeOf$3(value) {
	const m = String(value ?? "").match(/(\d{1,3})$/);
	return m ? m[1].padStart(3, "0") : String(value ?? "").padStart(3, "0");
}
function residualFinding038(player, lane, asOfDate) {
	const result = computeOpponentAdjustedResidualPerformance({
		player,
		lane,
		asOfDate
	});
	if (result.status !== "GO") return null;
	const v = result.value;
	const value = `own_games_won_pct=${v.own_games_won_pct}; cohort_games_won_pct=${v.cohort_games_won_pct}; games_won_residual_pct=${v.games_won_residual_pct}; own_sets_won_pct=${v.own_sets_won_pct}; cohort_sets_won_pct=${v.cohort_sets_won_pct}; sets_won_residual_pct=${v.sets_won_residual_pct}; elo_band=+/-${v.elo_band}`;
	return certifyMetricFinding({
		metric_code: "038",
		p1_value: value,
		p2_value: null,
		p1_treatment: "PARTIAL",
		p2_treatment: "UNAVAILABLE",
		differential: null,
		evidence_family: "STANDALONE_OPPONENT_ADJUSTED_RESIDUAL_PERFORMANCE",
		reliability: 68,
		sample: `Elo-band cohort residual (games/sets-won% only -- hold%/break%/Dominance Ratio/serve-return-points excluded, see module header); own_matches=${v.own_matches}; cohort_players=${v.cohort_players}; cohort_matches=${v.cohort_matches}; tour_lane=${lane}`,
		unavailable_reason: null,
		sources: [{
			source_name: "Four-tour static history index (data/generated/tennis-runtime-index.json)",
			url: null,
			retrieved_at: null
		}]
	});
}
function stakesFinding062(player, lane, asOfDate) {
	const result = computeMotivationStakes({
		player,
		lane,
		asOfDate
	});
	if (result.status !== "GO") return null;
	const v = result.value;
	const value = `seeded_rate_pct=${v.seeded_rate_pct}; avg_seed_when_seeded=${v.avg_seed_when_seeded ?? "NA"}; avg_rank_points_at_stake=${v.avg_rank_points_at_stake ?? "NA"}`;
	return certifyMetricFinding({
		metric_code: "062",
		p1_value: value,
		p2_value: null,
		p1_treatment: "PARTIAL",
		p2_treatment: "UNAVAILABLE",
		differential: null,
		evidence_family: "STANDALONE_MOTIVATION_STAKES",
		reliability: 62,
		sample: `Seeding/points-at-stake profile from own ATP_CHALLENGER history (not year-over-year points-defended, not public milestone context -- see module header); evaluable_matches=${v.evaluable_matches}; seeded_matches=${v.seeded_matches}`,
		unavailable_reason: null,
		sources: [{
			source_name: "TennisMyLife ATP Challenger normalized history (data/public/tennismylife-challenger)",
			url: null,
			retrieved_at: null
		}]
	});
}
/** Synchronous tier for 038/062 -- called once per player side from the cheap deterministic chain. */
async function deterministicBatch6ResidualStakes(args) {
	const code = codeOf$3(args.metricCode);
	if (!SYNCHRONOUS_OWNED.has(code)) return null;
	const lane = args.tourFamily;
	if (!lane) return null;
	try {
		const p1Finding = code === "038" ? residualFinding038(args.p1, lane, args.asOfDate) : stakesFinding062(args.p1, lane, args.asOfDate);
		const p2Finding = code === "038" ? residualFinding038(args.p2, lane, args.asOfDate) : stakesFinding062(args.p2, lane, args.asOfDate);
		if (!p1Finding && !p2Finding) return null;
		const p1Value = p1Finding?.p1_value ?? null, p2Value = p2Finding?.p1_value ?? null;
		return {
			...p1Finding ?? p2Finding,
			p1_value: p1Value,
			p2_value: p2Value,
			p1_treatment: p1Value ? "PARTIAL" : "UNAVAILABLE",
			p2_treatment: p2Value ? "PARTIAL" : "UNAVAILABLE"
		};
	} catch {
		return null;
	}
}
/** Live-fetch tier for 040 -- same phase as metric 026's own live-fetch tier (needs a live BSD PBP call). */
async function deterministicBatch6HiddenDecline(args) {
	if (codeOf$3(args.metricCode) !== "040") return null;
	const lane = args.tourFamily;
	if (!lane) return null;
	try {
		const [p1Result, p2Result] = await Promise.all([computeHiddenDecline({
			player: args.p1,
			lane,
			asOfDate: args.asOfDate
		}), computeHiddenDecline({
			player: args.p2,
			lane,
			asOfDate: args.asOfDate
		})]);
		const fmt = (r) => r.status !== "GO" ? null : r.value.dimensions.map((d) => `${d.dimension}: verdict=${d.verdict}; earlier=${d.earlier_rate_pct ?? "NA"} (n=${d.earlier_n}); recent=${d.recent_rate_pct ?? "NA"} (n=${d.recent_n})`).join("; ");
		const p1Value = fmt(p1Result), p2Value = fmt(p2Result);
		if (!p1Value && !p2Value) return null;
		return certifyMetricFinding({
			metric_code: "040",
			p1_value: p1Value,
			p2_value: p2Value,
			p1_treatment: p1Value ? "PARTIAL" : "UNAVAILABLE",
			p2_treatment: p2Value ? "PARTIAL" : "UNAVAILABLE",
			differential: null,
			evidence_family: "STANDALONE_HIDDEN_DECLINE_DETECTOR",
			reliability: 65,
			sample: `Cross-match ace/DF/service/return/hold/break trend over BSD-approved PBP-covered matches, two-proportion CI test per dimension; serve velocity, first/second-serve split, match duration, and three-set dependency excluded (see module header); tour_lane=${lane}`,
			unavailable_reason: null,
			sources: [{
				source_name: "BSD/Bzzoiro approved point-by-point (per-lane historical index)",
				url: null,
				retrieved_at: null
			}]
		});
	} catch {
		return null;
	}
}
function norm$3(v) {
	return String(v ?? "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
function tokens(v) {
	return norm$3(v).split(" ").filter(Boolean);
}
function runtimePlayers() {
	const out = [];
	const runtimeIndex = loadRuntimeIndex();
	for (const tour of ["ATP", "WTA"]) {
		const rows = runtimeIndex?.[tour] ?? {};
		for (const value of Object.values(rows)) if (value?.name) out.push({
			name: String(value.name),
			tour
		});
	}
	return out;
}
function resolveRuntimePlayer(input) {
	const all = runtimePlayers(), needle = norm$3(input), exact = all.filter((x) => norm$3(x.name) === needle);
	if (exact.length === 1) return exact[0];
	const req = tokens(input), last = req.at(-1);
	if (!last) return null;
	const candidates = all.filter((x) => {
		const t = tokens(x.name);
		if (t.at(-1) !== last) return false;
		const set = new Set(t);
		return req.length === 1 || req.every((v) => set.has(v));
	});
	return candidates.length === 1 ? candidates[0] : null;
}
var groups = {
	serve: [
		"service_points_won",
		"first_serve",
		"second_serve",
		"ace_rate",
		"double_fault",
		"break_points_saved",
		"hold_pct",
		"service_games_held"
	],
	ret: [
		"return_points_won",
		"serve_return",
		"break_point_conversion",
		"break_pct",
		"return_games",
		"break_points_created"
	],
	market: [
		"market",
		"odds",
		"price",
		"implied",
		"devig",
		"de_vig",
		"vig",
		"favorite_probability",
		"underdog_probability"
	],
	availability: [
		"availability",
		"injury",
		"withdraw",
		"retire",
		"medical",
		"layoff",
		"days_since_last_match",
		"return_after_layoff"
	],
	point: [
		"point",
		"game",
		"break_state",
		"score_state",
		"first_break",
		"rebreak",
		"consolidation",
		"serve_out",
		"tiebreak"
	],
	rally: [
		"rally",
		"shot",
		"forehand",
		"backhand",
		"net",
		"drop_shot",
		"direction",
		"serve_plus_1",
		"return_neutralization"
	],
	level: [
		"same_level",
		"tour_level",
		"level_transition",
		"challenger",
		"itf",
		"atp",
		"wta"
	],
	environment: [
		"surface",
		"court_speed",
		"indoor",
		"outdoor",
		"temperature",
		"humidity",
		"wind",
		"altitude",
		"roof",
		"weather"
	],
	scheduling: [
		"days_since_last_match",
		"matches_last_14",
		"matches_last_28",
		"rest",
		"travel",
		"timezone",
		"same_round",
		"round",
		"qualifying",
		"recovery"
	],
	tournament: [
		"same_tournament",
		"tournament_specific",
		"court_speed",
		"venue",
		"environment"
	]
};
function containsAny$1(value, terms) {
	const v = norm$3(value ?? "");
	return terms.some((t) => v.includes(norm$3(t)));
}
function semanticRequirement(name, body) {
	const t = norm$3(`${name} ${body ?? ""}`);
	if (/market layer|market calibration|odds|implied probability|de vig|devig/.test(t)) return "market";
	if (/serve profile|serve efficiency|serve\/return shot level/.test(t)) return "serve";
	if (/return profile/.test(t)) return "ret";
	if (/availability|injury|withdrawal|fitness/.test(t)) return "availability";
	if (/point by point|score state|point to game/.test(t)) return "point";
	if (/shot|rally/.test(t)) return "rally";
	if (/level\/tour transition|tour-level transition|opponent elo differential/.test(t)) return "level";
	if (/surface & environmental context|surface-transition|altitude|court-speed|weather sensitivity|data-source agreement/.test(t)) return "environment";
	if (/scheduling\/context|days since last|travel-to-rest|recovery hours|schedule density|qualifier adaptation/.test(t)) return "scheduling";
	if (/tournament-specific strength|exact tournament|venue familiarity/.test(t)) return "tournament";
	return null;
}
function validSide(value, required) {
	if (!value) return false;
	if (!required) return true;
	return containsAny$1(value, groups[required]);
}
var PROTECTED_EXACT_METRICS = /* @__PURE__ */ new Set([
	"026",
	"029",
	"031",
	"032",
	"033",
	"051",
	"052",
	"053",
	"054",
	"059"
]);
var COMPOSITE_COMPONENTS = {
	"026": [
		{
			name: "opening service-game hold",
			terms: ["opening service game hold", "first service game hold"]
		},
		{
			name: "opening return-game break",
			terms: ["opening return game break", "first return game break"]
		},
		{
			name: "first four games win differential",
			terms: ["first four games win differential", "first 4 games win differential"]
		},
		{
			name: "first six games point differential",
			terms: ["first six games point differential", "first 6 games point differential"]
		},
		{
			name: "early break-conceded frequency",
			terms: [
				"early break conceded frequency",
				"broken within first",
				"early break conceded"
			]
		},
		{
			name: "time-to-first-break",
			terms: ["time to first break", "time-to-first-break"]
		},
		{
			name: "set-1 slow-start index",
			terms: [
				"set 1 slow start index",
				"set-1 slow-start index",
				"slow start index"
			]
		},
		{
			name: "first-set recovery after early break",
			terms: ["first set recovery after early break", "recovery after early break"]
		},
		{
			name: "early-error rate",
			terms: ["early error rate", "opening unforced error rate"]
		},
		{
			name: "early first-serve efficiency",
			terms: ["early first serve efficiency", "opening first serve efficiency"]
		},
		{
			name: "early return pressure",
			terms: ["early return pressure", "opening return pressure"]
		},
		{
			name: "warm-up dependency index",
			terms: ["warm up dependency index", "warm-up dependency index"]
		}
	],
	"029": [
		{
			name: "response after losing a close set",
			terms: ["response after losing a close set", "after losing a close set"]
		},
		{
			name: "response after blowing set points",
			terms: [
				"response after blowing set points",
				"after blowing set points",
				"failed set points"
			]
		},
		{
			name: "response after failing to serve out a set",
			terms: ["response after failing to serve out a set", "failed to serve out a set"]
		},
		{
			name: "response after losing a tiebreak",
			terms: ["response after losing a tiebreak", "after losing a tiebreak"]
		},
		{
			name: "performance after saving match points",
			terms: ["after saving match points", "performance immediately after saving match points"]
		},
		{
			name: "performance after wasting match points",
			terms: ["after wasting match points", "performance immediately after wasting match points"]
		},
		{
			name: "consecutive-error recovery",
			terms: ["consecutive error recovery", "consecutive-error recovery"]
		},
		{
			name: "break-point resilience after previous BP loss",
			terms: ["break point resilience after previous bp loss", "after previous break point loss"]
		},
		{
			name: "pressure error differential",
			terms: ["pressure error differential", "unforced error rate under pressure"]
		},
		{
			name: "front-runner vs comeback profile",
			terms: ["front runner vs comeback profile", "front-runner vs comeback profile"]
		},
		{
			name: "scoreboard-pressure sensitivity",
			terms: ["scoreboard pressure sensitivity", "scoreboard-pressure sensitivity"]
		}
	],
	"031": [
		{
			name: "common-opponent adjusted point differential",
			terms: ["common opponent adjusted point differential", "adjusted point differential against shared opponents"]
		},
		{
			name: "common-opponent hold differential",
			terms: ["common opponent hold differential", "hold differential against shared opponents"]
		},
		{
			name: "common-opponent break differential",
			terms: ["common opponent break differential", "break differential against shared opponents"]
		},
		{
			name: "common-opponent straight-set differential",
			terms: ["common opponent straight set differential", "straight set differential against shared opponents"]
		},
		{
			name: "common-opponent set-1 differential",
			terms: ["common opponent set 1 differential", "first set differential against shared opponents"]
		},
		{
			name: "common-opponent 30/60/90-day performance",
			terms: [
				"common opponent performance within last 30",
				"30 60 90",
				"30/60/90"
			]
		},
		{
			name: "second-degree opponent network",
			terms: ["second degree opponent network", "opponents of the players common opponents"]
		},
		{
			name: "network Elo strength",
			terms: ["network elo strength", "opponent network elo"]
		},
		{
			name: "transitive performance score",
			terms: ["transitive performance score"]
		},
		{
			name: "loss-quality score",
			terms: ["loss quality score", "loss-quality score"]
		},
		{
			name: "win-quality score",
			terms: ["win quality score", "win-quality score"]
		},
		{
			name: "upset-quality score",
			terms: ["upset quality score", "upset-quality score"]
		},
		{
			name: "bad-loss severity",
			terms: ["bad loss severity", "bad-loss severity"]
		},
		{
			name: "opponent-strength weighted game differential",
			terms: ["opponent strength weighted game differential", "weighted game differential"]
		}
	],
	"032": [
		{
			name: "points-won to games-won conversion",
			terms: [
				"points won to games won conversion",
				"points-won games-won conversion",
				"points won % games won %"
			]
		},
		{
			name: "return-points-won to break conversion efficiency",
			terms: ["return points won to break conversion efficiency", "return-points-won break conversion efficiency"]
		},
		{
			name: "service-points-won to hold conversion efficiency",
			terms: ["service points won to hold conversion efficiency", "service-points-won hold conversion efficiency"]
		},
		{
			name: "expected vs actual games won",
			terms: ["expected vs actual games won"]
		},
		{
			name: "expected vs actual sets won",
			terms: ["expected vs actual sets won"]
		},
		{
			name: "deuce-game win",
			terms: ["deuce game win", "deuce-game win"]
		},
		{
			name: "games won from 0-30/15-30",
			terms: [
				"games won from 0 30",
				"games won from 15 30",
				"0-30/15-30"
			]
		},
		{
			name: "games lost from 30-0/40-15",
			terms: [
				"games lost from 30 0",
				"games lost from 40 15",
				"30-0/40-15"
			]
		},
		{
			name: "break opportunities per successful break",
			terms: ["break opportunities needed per successful break", "break opportunities per successful break"]
		},
		{
			name: "hold efficiency relative to serve points",
			terms: ["hold efficiency relative to underlying serve points", "hold efficiency relative to serve points"]
		}
	],
	"033": [
		{
			name: "sustainable break score",
			terms: ["sustainable break score"]
		},
		{
			name: "sustained return pressure",
			terms: ["sustained return pressure", "return pressure"]
		},
		{
			name: "opponent donation detail",
			terms: [
				"opponent donations",
				"double faults",
				"unforced errors"
			]
		}
	],
	"034": [
		{
			name: "scoreline vs point dominance",
			terms: [
				"scoreline vs point dominance",
				"scoreline compared with point dominance",
				"scoreline compared to point dominance"
			]
		},
		{
			name: "scoreline vs expected games",
			terms: [
				"scoreline vs expected games",
				"scoreline compared with expected games",
				"scoreline compared to expected games"
			]
		},
		{
			name: "scoreline vs break opportunities",
			terms: [
				"scoreline vs break opportunities",
				"scoreline compared with break opportunities",
				"scoreline compared to break opportunities"
			]
		},
		{
			name: "scoreline vs dominance ratio",
			terms: [
				"scoreline vs dominance ratio",
				"scoreline compared with dominance ratio",
				"scoreline compared to dominance ratio"
			]
		},
		{
			name: "clutch-performance dependency",
			terms: [
				"clutch performance dependency",
				"clutch dependency",
				"key point dependency",
				"key points dependency"
			]
		}
	],
	"036": [
		{
			name: "loss favorite status",
			terms: [
				"loss favorite status",
				"favorite status",
				"pre match favorite",
				"pre match odds"
			]
		},
		{
			name: "loss opponent quality",
			terms: [
				"loss opponent quality",
				"opponent quality",
				"opponent elo",
				"opponent ranking"
			]
		},
		{
			name: "loss surface",
			terms: ["loss surface", "surface"]
		},
		{
			name: "loss point differential",
			terms: [
				"loss point differential",
				"point differential",
				"points won differential"
			]
		},
		{
			name: "loss break differential",
			terms: [
				"loss break differential",
				"break differential",
				"break point differential"
			]
		},
		{
			name: "loss serve deterioration",
			terms: [
				"loss serve deterioration",
				"serve deterioration",
				"serve decline"
			]
		},
		{
			name: "loss return deterioration",
			terms: [
				"loss return deterioration",
				"return deterioration",
				"return decline"
			]
		},
		{
			name: "lost after leading",
			terms: [
				"lost after leading",
				"lead state",
				"led then lost"
			]
		},
		{
			name: "lost set 1",
			terms: [
				"lost set 1",
				"lost first set",
				"set 1 loss"
			]
		},
		{
			name: "loss in deciding set",
			terms: [
				"loss in deciding set",
				"deciding set",
				"final set"
			]
		},
		{
			name: "loss in tiebreak",
			terms: ["loss in tiebreak", "tiebreak"]
		},
		{
			name: "loss physical problem",
			terms: [
				"loss physical problem",
				"physical problem",
				"injury",
				"medical timeout"
			]
		},
		{
			name: "loss match length",
			terms: [
				"loss match length",
				"match length",
				"duration"
			]
		},
		{
			name: "competitive vs blowout loss",
			terms: [
				"competitive vs blowout",
				"competitive loss",
				"blowout loss"
			]
		},
		{
			name: "bad-loss severity index",
			terms: ["bad loss severity index", "bad loss severity"]
		}
	],
	"037": [
		{
			name: "recent scored wins",
			terms: ["recent scored wins", "prior scored wins"]
		},
		{
			name: "pre-match win probability",
			terms: ["pre match win probability", "frozen pre match win probability"]
		},
		{
			name: "final score margin",
			terms: ["final score margin", "close wins"]
		},
		{
			name: "win autopsy category",
			terms: [
				"win autopsy category",
				"dominant",
				"routine",
				"escape",
				"upset win"
			]
		}
	],
	"038": [
		{
			name: "hold residual vs opponent norm",
			terms: [
				"hold residual vs opponent norm",
				"hold residual versus opponent norm",
				"hold compared to opponent norm"
			]
		},
		{
			name: "break residual vs opponent norm",
			terms: [
				"break residual vs opponent norm",
				"break residual versus opponent norm",
				"break compared to opponent norm"
			]
		},
		{
			name: "total-points residual vs opponent norm",
			terms: [
				"total points residual vs opponent norm",
				"total points residual versus opponent norm",
				"total points compared to opponent norm"
			]
		},
		{
			name: "games residual vs opponent norm",
			terms: [
				"games residual vs opponent norm",
				"games residual versus opponent norm",
				"games compared to opponent norm"
			]
		},
		{
			name: "sets residual vs opponent norm",
			terms: [
				"sets residual vs opponent norm",
				"sets residual versus opponent norm",
				"sets compared to opponent norm"
			]
		},
		{
			name: "dominance-ratio residual vs opponent norm",
			terms: [
				"dominance ratio residual vs opponent norm",
				"dominance ratio residual versus opponent norm",
				"dominance ratio compared to opponent norm"
			]
		},
		{
			name: "serve-points residual vs opponent norm",
			terms: [
				"serve points residual vs opponent norm",
				"service points residual vs opponent norm",
				"serve points compared to opponent norm"
			]
		},
		{
			name: "return-points residual vs opponent norm",
			terms: [
				"return points residual vs opponent norm",
				"return points residual versus opponent norm",
				"return points compared to opponent norm"
			]
		}
	],
	"039": [
		{
			name: "match-level actual performance",
			terms: ["actual performance", "match level performance"]
		},
		{
			name: "pre-match expected performance",
			terms: [
				"pre match expected performance",
				"frozen pre match expectation",
				"expectation frozen before match"
			]
		},
		{
			name: "match-level surprise residual",
			terms: [
				"performance surprise",
				"actual minus expected",
				"surprise residual"
			]
		},
		{
			name: "rolling last-10 surprise",
			terms: [
				"rolling performance surprise",
				"last 10 surprise",
				"last ten surprise"
			]
		}
	],
	"040": [
		{
			name: "serve velocity trend",
			terms: ["serve velocity trend", "serve speed trend"]
		},
		{
			name: "ace rate trend",
			terms: ["ace rate trend"]
		},
		{
			name: "first-serve points won trend",
			terms: ["first serve points won trend"]
		},
		{
			name: "second-serve points won trend",
			terms: ["second serve points won trend"]
		},
		{
			name: "return points won trend",
			terms: ["return points won trend"]
		},
		{
			name: "break opportunities trend",
			terms: ["break opportunities trend", "break points generated trend"]
		},
		{
			name: "hold vulnerability trend",
			terms: [
				"hold vulnerability trend",
				"danger score trend",
				"service game danger"
			]
		},
		{
			name: "double-fault trend",
			terms: ["double fault trend"]
		},
		{
			name: "match duration trend",
			terms: ["match duration trend"]
		},
		{
			name: "three-set dependency trend",
			terms: [
				"three set dependency trend",
				"three set trend",
				"go the distance"
			]
		}
	],
	"051": [
		{
			name: "opponent-specific break expectancy",
			terms: ["opponent specific break expectancy"]
		},
		{
			name: "opponent-specific hold expectancy",
			terms: ["opponent specific hold expectancy"]
		},
		{
			name: "set win expectancy",
			terms: ["set win expectancy"]
		},
		{
			name: "expected set-1 winner",
			terms: ["expected set 1 winner", "expected set-1 winner"]
		},
		{
			name: "expected deciding-set winner",
			terms: ["expected deciding set winner", "expected deciding-set winner"]
		},
		{
			name: "2-0 conditional probability",
			terms: ["2 0 conditional probability", "2-0 conditional probability"]
		},
		{
			name: "2-1 conditional probability",
			terms: ["2 1 conditional probability", "2-1 conditional probability"]
		},
		{
			name: "break-first to 2-0 conversion",
			terms: ["break first to 2 0 conversion", "break-first to 2-0 conversion"]
		},
		{
			name: "set-1 win to 2-0 conversion",
			terms: ["set 1 win to 2 0 conversion", "set-1 win to 2-0 conversion"]
		},
		{
			name: "set-1 loss to match-loss probability",
			terms: ["set 1 loss to match loss probability", "set-1 loss to match-loss probability"]
		}
	],
	"052": [
		{
			name: "set-score entropy",
			terms: ["set score entropy", "set-score entropy"]
		},
		{
			name: "game-score entropy",
			terms: ["game score entropy", "game-score entropy"]
		},
		{
			name: "lead durability index",
			terms: ["lead durability index"]
		},
		{
			name: "deficit survivability index",
			terms: ["deficit survivability index"]
		},
		{
			name: "double-break creation rate",
			terms: ["double break creation rate", "double-break creation rate"]
		},
		{
			name: "double-break surrender rate",
			terms: ["double break surrender rate", "double-break surrender rate"]
		},
		{
			name: "rebreak-window probability",
			terms: ["rebreak window probability", "rebreak-window probability"]
		},
		{
			name: "break clustering",
			terms: ["break clustering"]
		}
	],
	"053": [
		{
			name: "pressure accumulation score",
			terms: ["pressure accumulation score"]
		},
		{
			name: "serve escape dependency",
			terms: ["serve escape dependency"]
		},
		{
			name: "clean-hold rate",
			terms: ["clean hold rate", "clean-hold rate"]
		},
		{
			name: "clean-break rate",
			terms: ["clean break rate", "clean-break rate"]
		},
		{
			name: "love/15 hold rate",
			terms: ["love 15 hold rate", "love/15 hold rate"]
		},
		{
			name: "return-game abandonment rate",
			terms: ["return game abandonment rate", "return-game abandonment rate"]
		}
	],
	"054": [
		{
			name: "first-strike efficiency",
			terms: ["first strike efficiency", "first-strike efficiency"]
		},
		{
			name: "neutral-rally efficiency",
			terms: ["neutral rally efficiency", "neutral-rally efficiency"]
		},
		{
			name: "defense-to-offense conversion",
			terms: ["defense to offense conversion", "defense-to-offense conversion"]
		},
		{
			name: "attack conversion rate",
			terms: ["attack conversion rate"]
		},
		{
			name: "depth-pressure differential",
			terms: ["depth pressure differential", "depth-pressure differential"]
		},
		{
			name: "baseline territory differential",
			terms: ["baseline territory differential"]
		},
		{
			name: "directional vulnerability",
			terms: ["directional vulnerability"]
		},
		{
			name: "backhand-under-pressure performance",
			terms: ["backhand under pressure performance", "backhand-under-pressure performance"]
		},
		{
			name: "forehand-under-pressure performance",
			terms: ["forehand under pressure performance", "forehand-under-pressure performance"]
		},
		{
			name: "running-forehand effectiveness",
			terms: ["running forehand effectiveness", "running-forehand effectiveness"]
		},
		{
			name: "running-backhand effectiveness",
			terms: ["running backhand effectiveness", "running-backhand effectiveness"]
		},
		{
			name: "second-serve return aggression",
			terms: ["second serve return aggression", "second-serve return aggression"]
		},
		{
			name: "first-ball-after-return effectiveness",
			terms: ["first ball after return effectiveness", "first-ball-after-return effectiveness"]
		},
		{
			name: "net-approach deterrence",
			terms: ["net approach deterrence", "net-approach deterrence"]
		}
	],
	"059": [
		{
			name: "loss path opponent serves through",
			terms: ["loss path opponent serves through", "opponent serves through"]
		},
		{
			name: "loss path return exposed",
			terms: ["loss path return exposed", "return exposed"]
		},
		{
			name: "loss path slow start/set-1 loss",
			terms: [
				"loss path slow start set 1 loss",
				"slow start set 1 loss",
				"slow start/set-1 loss"
			]
		},
		{
			name: "loss path physical decline",
			terms: ["loss path physical decline", "physical decline"]
		},
		{
			name: "loss path tiebreak variance",
			terms: ["loss path tiebreak variance", "tiebreak variance"]
		},
		{
			name: "loss path three-set collapse",
			terms: [
				"loss path three set collapse",
				"three set collapse",
				"three-set collapse"
			]
		},
		{
			name: "loss path other",
			terms: ["loss path other"]
		}
	]
};
function familyCode$1(code) {
	const m = String(code).match(/(\d{1,3})$/);
	return m ? m[1].padStart(3, "0") : String(code).padStart(3, "0");
}
function componentHits(value, components) {
	return components.filter((c) => containsAny$1(value, c.terms));
}
function playerTagged(value, expected) {
	return Boolean(value) && norm$3(value).includes(norm$3(`PLAYER=${expected}`));
}
function sourceTagged(value, sources) {
	if (!value || !sources?.length) return false;
	const v = norm$3(value);
	return v.includes("source") && sources.some((s) => s.source_name?.trim() && v.includes(norm$3(s.source_name)));
}
function sampleTagged(value) {
	return Boolean(value) && norm$3(value).includes("sample");
}
function formulaTagged(value) {
	return Boolean(value) && norm$3(value).includes("formula");
}
function tagValue$1(value, key) {
	if (!value) return null;
	return value.match(new RegExp(`${key}\\s*=\\s*([^;]+)`, "i"))?.[1]?.trim() ?? null;
}
function validateCompositeSide(value, treatment, sources, components, expectedPlayer, strictProvenance = false) {
	if (treatment === "UNAVAILABLE" || treatment === "EXCLUDED" || !value) return {
		value,
		treatment,
		missing: []
	};
	const hits = componentHits(value, components), missing = components.filter((c) => !hits.includes(c)).map((c) => c.name), hasSource = Boolean(sources?.length);
	if (strictProvenance) {
		const metaMissing = [];
		if (!expectedPlayer || !playerTagged(value, expectedPlayer)) metaMissing.push(`PLAYER=${expectedPlayer ?? "expected player"}`);
		if (!sourceTagged(value, sources)) metaMissing.push("side-specific SOURCE matching persisted source list");
		if (!sampleTagged(value)) metaMissing.push("side-specific SAMPLE");
		if (treatment === "RECONSTRUCTED" && !formulaTagged(value)) metaMissing.push("FORMULA for reconstructed evidence");
		if (metaMissing.length) return {
			value: null,
			treatment: "UNAVAILABLE",
			missing: [...missing, ...metaMissing]
		};
	}
	if (treatment === "DIRECT") {
		if (!missing.length && hasSource) return {
			value,
			treatment,
			missing
		};
		if (hits.length && hasSource) return {
			value,
			treatment: "PARTIAL",
			missing
		};
		return {
			value: null,
			treatment: "UNAVAILABLE",
			missing: missing.length ? missing : components.map((c) => c.name)
		};
	}
	if (treatment === "RECONSTRUCTED") {
		if (!missing.length && hasSource) return {
			value,
			treatment,
			missing
		};
		if (hits.length && hasSource) return {
			value,
			treatment: "PARTIAL",
			missing
		};
		return {
			value: null,
			treatment: "UNAVAILABLE",
			missing: missing.length ? missing : components.map((c) => c.name)
		};
	}
	if (treatment === "PARTIAL") return hits.length && hasSource ? {
		value,
		treatment,
		missing
	} : {
		value: null,
		treatment: "UNAVAILABLE",
		missing: components.map((c) => c.name)
	};
	return {
		value: null,
		treatment: "UNAVAILABLE",
		missing: components.map((c) => c.name)
	};
}
function validateMetric(metric, finding, expected) {
	const code = familyCode$1(metric.code), composite = COMPOSITE_COMPONENTS[code], strict = PROTECTED_EXACT_METRICS.has(code) && Boolean(expected);
	if (composite) {
		const p1 = validateCompositeSide(finding.p1_value, finding.p1_treatment, finding.sources, composite, expected?.p1, strict), p2 = validateCompositeSide(finding.p2_value, finding.p2_treatment, finding.sources, composite, expected?.p2, strict);
		const missing = [.../* @__PURE__ */ new Set([...p1.missing ?? [], ...p2.missing ?? []])];
		const p1Sample = tagValue$1(p1.value, "SAMPLE"), p2Sample = tagValue$1(p2.value, "SAMPLE");
		return {
			...finding,
			p1_value: p1.value,
			p2_value: p2.value,
			p1_treatment: p1.treatment,
			p2_treatment: p2.treatment,
			evidence_family: strict ? `EXACT_${code}` : finding.evidence_family,
			sample: strict ? `P1:${p1Sample ?? "UNAVAILABLE"} | P2:${p2Sample ?? "UNAVAILABLE"}` : finding.sample,
			unavailable_reason: (p1.treatment === "UNAVAILABLE" || p2.treatment === "UNAVAILABLE" || p1.treatment === "PARTIAL" || p2.treatment === "PARTIAL") && missing.length ? `Exact-component guard: unsupported components remain missing (${missing.join(", ")}). No proxy substitution permitted. Side reversal or unverifiable provenance is also not permitted.` : finding.unavailable_reason,
			missing_inputs: missing.length ? [...finding.missing_inputs ?? [], ...missing] : finding.missing_inputs
		};
	}
	const req = semanticRequirement(metric.name, metric.body);
	if (!req) return finding;
	const p1ok = validSide(finding.p1_value, req), p2ok = validSide(finding.p2_value, req);
	if (p1ok && p2ok) return finding;
	return {
		...finding,
		p1_value: p1ok ? finding.p1_value : null,
		p2_value: p2ok ? finding.p2_value : null,
		p1_treatment: p1ok ? finding.p1_treatment : "UNAVAILABLE",
		p2_treatment: p2ok ? finding.p2_treatment : "UNAVAILABLE",
		unavailable_reason: `Semantic evidence guard rejected a reconstruction that did not contain ${req}-specific inputs required by the metric definition.`,
		missing_inputs: [...finding.missing_inputs ?? [], `${req}-specific sourced inputs`]
	};
}
function mergeRuntimeIdentity(base, p1, p2) {
	const a = resolveRuntimePlayer(p1), b = resolveRuntimePlayer(p2);
	return {
		...base,
		player1_canonical: base.player1_canonical ?? a?.name ?? null,
		player2_canonical: base.player2_canonical ?? b?.name ?? null,
		player1_status: base.player1_status === "VERIFIED" || a ? "VERIFIED" : base.player1_status,
		player2_status: base.player2_status === "VERIFIED" || b ? "VERIFIED" : base.player2_status,
		unresolved_reason: (base.player1_status === "VERIFIED" || a) && (base.player2_status === "VERIFIED" || b) ? null : base.unresolved_reason,
		sources: [...base.sources ?? [], ...a || b ? [{
			source_name: "Bundled historical player index",
			url: null,
			retrieved_at: (/* @__PURE__ */ new Date()).toISOString()
		}] : []]
	};
}
function protectedInstruction(code, p1, p2) {
	return PROTECTED_EXACT_METRICS.has(code) ? `\nSTRICT POST-FIX WIRING RULE: do not use a neighboring statistic or proxy. Every usable side value MUST be self-identifying and self-provenancing in this exact form: PLAYER=<exact player name>; SOURCE=<one actual source_name also present in sources>; SAMPLE=<actual denominator/window, or UNAVAILABLE when the source publishes no sample>; <exact supported metric components>. RECONSTRUCTED additionally requires FORMULA=<formula using only master-permitted inputs>. P1 must use PLAYER=${p1}; P2 must use PLAYER=${p2}. If the player/source/sample mapping cannot be proved, return UNAVAILABLE for that side.` : "";
}
var validatedCompletionResearcher = {
	...completionSweepResearcher,
	async identity(input) {
		return mergeRuntimeIdentity(await completionSweepResearcher.identity(input), input.p1, input.p2);
	},
	async metrics(input) {
		const guarded = {
			...input,
			metrics: input.metrics.map((m) => ({
				...m,
				body: `${m.body ?? ""}${protectedInstruction(familyCode$1(String(m.code)), input.p1, input.p2)}`
			}))
		};
		const rows = await completionSweepResearcher.metrics(guarded);
		const defs = new Map(input.metrics.map((m) => [String(m.code), m]));
		return rows.map((row) => {
			const def = defs.get(String(row.metric_code));
			return def ? validateMetric(def, row, {
				p1: input.p1,
				p2: input.p2
			}) : row;
		});
	}
};
var POST_FIX_CODES = /* @__PURE__ */ new Set([
	"060",
	"062",
	"063",
	"064",
	"065",
	"066",
	"067",
	"069",
	"070",
	"071"
]);
var PUBLIC_CONTEXT_CODES = /* @__PURE__ */ new Set([
	"062",
	"063",
	"064",
	"065",
	"066",
	"069",
	"070",
	"071"
]);
var NON_RECONSTRUCTABLE_CONTEXT_CODES = /* @__PURE__ */ new Set([
	"063",
	"065",
	"069",
	"070"
]);
var PROTECTED_COMPONENTS = {
	"041": [
		{
			name: "opponent-quality-adjusted record trend",
			terms: ["opponent quality adjusted record trend", "opponent-quality-adjusted record trend"]
		},
		{
			name: "hold-rate trend",
			terms: [
				"hold rate trend",
				"hold-rate trend",
				"hold rate improving",
				"hold improvement"
			]
		},
		{
			name: "return-points-won trend",
			terms: [
				"return points won trend",
				"return-points-won trend",
				"return points won improving",
				"return improvement"
			]
		},
		{
			name: "Dominance Ratio trend",
			terms: [
				"dominance ratio trend",
				"dominance ratio improving",
				"dominance ratio improvement"
			]
		},
		{
			name: "break-points-created trend",
			terms: [
				"break points created trend",
				"break-points-created trend",
				"break points created improving",
				"break point creation trend"
			]
		},
		{
			name: "loss-inclusive chronology",
			terms: [
				"including losses",
				"despite losses",
				"loss-inclusive",
				"losses included",
				"while the win loss record lags"
			]
		}
	],
	"043": [
		{
			name: "favorite-role designation",
			terms: [
				"current favorite",
				"pre match favorite",
				"pre-match favorite",
				"favorite role",
				"favored player"
			]
		},
		{
			name: "favorite-role historical losses",
			terms: [
				"historical losses",
				"favorite losses",
				"losses as favorite",
				"favorite-role historical losses"
			]
		},
		{
			name: "documented favorite failure-mode condition",
			terms: [
				"failure mode profile",
				"failure-mode profile",
				"failure condition",
				"low first serve",
				"first serve failure",
				"serve deterioration",
				"opponent return points won",
				"return pressure",
				"third set",
				"deciding set",
				"set state",
				"set-state"
			]
		},
		{
			name: "today's opponent compatibility",
			terms: [
				"today s opponent",
				"today's opponent",
				"opponent compatibility",
				"opponent can reproduce",
				"opponent can create"
			]
		}
	],
	"044": [
		{
			name: "underdog-role history",
			terms: [
				"current underdog",
				"underdog role",
				"as underdog",
				"historical underdog"
			]
		},
		{
			name: "verified upset outcomes",
			terms: [
				"upset wins",
				"upset outcomes",
				"verified upset",
				"favorites beaten"
			]
		},
		{
			name: "favorite Elo similarity",
			terms: ["elo"]
		},
		{
			name: "favorite serve-style similarity",
			terms: ["serve style", "serving style"]
		},
		{
			name: "favorite return-quality similarity",
			terms: ["return quality", "return strength"]
		},
		{
			name: "surface similarity",
			terms: ["surface", "court surface"]
		},
		{
			name: "ranking similarity",
			terms: ["ranking"]
		},
		{
			name: "handedness similarity",
			terms: [
				"handedness",
				"left handed",
				"right handed",
				"left-handed",
				"right-handed"
			]
		},
		{
			name: "rally-style similarity",
			terms: ["rally style", "rally profile"]
		},
		{
			name: "price similarity",
			terms: [
				"price",
				"odds",
				"implied probability"
			]
		},
		{
			name: "tournament-level similarity",
			terms: [
				"tournament level",
				"event level",
				"tour level"
			]
		},
		{
			name: "today's favorite orientation",
			terms: [
				"today s favorite",
				"today's favorite",
				"current favorite"
			]
		}
	],
	"045": [
		{
			name: "favorite-role designation",
			terms: [
				"current favorite",
				"pre match favorite",
				"pre-match favorite",
				"favorite role",
				"favored player"
			]
		},
		{
			name: "opponent holds first three service games",
			terms: [
				"opponent holds first 3 service games",
				"opponent holds first three service games",
				"first three service games"
			]
		},
		{
			name: "failed early break chances",
			terms: [
				"failing early break chances",
				"failed early break chances",
				"missed early break points",
				"missed early break chances"
			]
		},
		{
			name: "favorite broken first",
			terms: [
				"losing first break",
				"broken first",
				"favorite being broken first"
			]
		},
		{
			name: "first set reaches 4-4",
			terms: [
				"set reaches 4 4",
				"set reaches 4-4",
				"first set reaches 4 4",
				"first set reaches 4-4"
			]
		},
		{
			name: "first-set tiebreak",
			terms: [
				"set reaches a tiebreak",
				"first set tiebreak",
				"first-set tiebreak"
			]
		},
		{
			name: "opponent forces deciding set",
			terms: [
				"opponent forces set 3",
				"opponent forces a deciding set",
				"pushed to a deciding set",
				"forces deciding set"
			]
		}
	],
	"046": [
		{
			name: "Elo after winning set 1",
			terms: ["elo after winning set 1", "elo after winning the first set"]
		},
		{
			name: "Elo after losing set 1",
			terms: ["elo after losing set 1", "elo after losing the first set"]
		},
		{
			name: "Elo in deciding sets",
			terms: [
				"elo in deciding sets",
				"deciding set elo",
				"deciding-set elo"
			]
		},
		{
			name: "Elo in tiebreak-heavy matches",
			terms: [
				"elo in tiebreak heavy matches",
				"elo in tiebreak-heavy matches",
				"tiebreak heavy elo"
			]
		},
		{
			name: "Elo against big servers",
			terms: [
				"elo against big servers",
				"big server elo",
				"big-server elo"
			]
		},
		{
			name: "Elo against strong returners",
			terms: [
				"elo against strong returners",
				"strong returner elo",
				"strong-returner elo"
			]
		},
		{
			name: "big-server threshold",
			terms: [
				"big server threshold",
				"big-server threshold",
				"big server definition"
			],
			reconstructedOnly: true
		},
		{
			name: "strong-returner threshold",
			terms: [
				"strong returner threshold",
				"strong-returner threshold",
				"strong returner definition"
			],
			reconstructedOnly: true
		}
	],
	"060": [
		{
			name: "serve-return interaction residual",
			terms: ["serve return interaction residual", "serve–return interaction residual"]
		},
		{
			name: "opponent-adjusted shot tolerance",
			terms: ["opponent adjusted shot tolerance", "opponent-adjusted shot tolerance"]
		},
		{
			name: "neutral-point win rate",
			terms: ["neutral point win rate", "neutral-point win rate"]
		},
		{
			name: "first-strike dependency",
			terms: ["first strike dependency", "first-strike dependency"]
		},
		{
			name: "serve dependency index",
			terms: ["serve dependency index"]
		},
		{
			name: "return dependency index",
			terms: ["return dependency index"]
		},
		{
			name: "primary-weapon reliability",
			terms: ["primary weapon reliability", "primary-weapon reliability"]
		},
		{
			name: "plan-b effectiveness",
			terms: ["plan b effectiveness", "plan-b effectiveness"]
		},
		{
			name: "matchup adaptability",
			terms: ["matchup adaptability"]
		},
		{
			name: "in-match adjustment score",
			terms: ["in match adjustment score", "in-match adjustment score"]
		},
		{
			name: "opponent adjustment resistance",
			terms: ["opponent adjustment resistance"]
		},
		{
			name: "scouting exposure penalty",
			terms: ["scouting exposure penalty"]
		},
		{
			name: "rematch adjustment",
			terms: ["rematch adjustment"]
		},
		{
			name: "revenge/rematch tactical differential",
			terms: ["revenge rematch tactical differential", "revenge/rematch tactical differential"]
		},
		{
			name: "lefty-adjusted serve/return differential",
			terms: ["lefty adjusted serve return differential", "lefty-adjusted serve/return differential"]
		},
		{
			name: "handedness interaction by serve direction",
			terms: ["handedness interaction by serve direction"]
		},
		{
			name: "ad-court vs deuce-court effectiveness",
			terms: ["ad court vs deuce court effectiveness", "ad-court vs deuce-court effectiveness"]
		},
		{
			name: "break-point serve-location effectiveness",
			terms: ["break point serve location effectiveness", "break-point serve-location effectiveness"]
		},
		{
			name: "break-point return-position effectiveness",
			terms: ["break point return position effectiveness", "break-point return-position effectiveness"]
		},
		{
			name: "set-point performance differential",
			terms: ["set point performance differential", "set-point performance differential"]
		},
		{
			name: "match-point creation rate",
			terms: ["match point creation rate", "match-point creation rate"]
		},
		{
			name: "match-point exposure rate",
			terms: ["match point exposure rate", "match-point exposure rate"]
		},
		{
			name: "multiple-bp survival",
			terms: ["multiple bp survival", "multiple-bp survival"]
		},
		{
			name: "multiple-bp conversion",
			terms: ["multiple bp conversion", "multiple-bp conversion"]
		},
		{
			name: "extended-deuce endurance",
			terms: ["extended deuce endurance", "extended-deuce endurance"]
		},
		{
			name: "long-game aftermath",
			terms: ["long game aftermath", "long-game aftermath"]
		},
		{
			name: "break-before-changeover effect",
			terms: ["break before changeover effect", "break-before-changeover effect"]
		},
		{
			name: "end-of-set serve deterioration",
			terms: ["end of set serve deterioration", "end-of-set serve deterioration"]
		},
		{
			name: "end-of-set return elevation",
			terms: ["end of set return elevation", "end-of-set return elevation"]
		},
		{
			name: "tiebreak entry quality",
			terms: ["tiebreak entry quality"]
		},
		{
			name: "tiebreak serve-order adjustment",
			terms: ["tiebreak serve order adjustment", "tiebreak serve-order adjustment"]
		},
		{
			name: "mini-break recovery rate",
			terms: ["mini break recovery rate", "mini-break recovery rate"]
		},
		{
			name: "mini-break consolidation rate",
			terms: ["mini break consolidation rate", "mini-break consolidation rate"]
		},
		{
			name: "tiebreak point-differential quality",
			terms: ["tiebreak point differential quality", "tiebreak point-differential quality"]
		},
		{
			name: "third-set first-break importance",
			terms: ["third set first break importance", "third-set first-break importance"]
		},
		{
			name: "decider physical resilience",
			terms: ["decider physical resilience"]
		},
		{
			name: "long-match resilience",
			terms: ["long match resilience", "long-match resilience"]
		},
		{
			name: "physical cliff probability",
			terms: ["physical cliff probability"]
		},
		{
			name: "recovery efficiency",
			terms: ["recovery efficiency"]
		},
		{
			name: "accumulated workload debt",
			terms: ["accumulated workload debt"]
		},
		{
			name: "travel recovery efficiency",
			terms: ["travel recovery efficiency"]
		},
		{
			name: "circadian mismatch",
			terms: ["circadian mismatch"]
		},
		{
			name: "heat-duration interaction",
			terms: ["heat duration interaction", "heat-duration interaction"]
		},
		{
			name: "wind serve penalty",
			terms: ["wind serve penalty"]
		},
		{
			name: "humidity endurance penalty",
			terms: ["humidity endurance penalty"]
		},
		{
			name: "altitude serve amplification",
			terms: ["altitude serve amplification"]
		},
		{
			name: "court-speed elasticity",
			terms: ["court speed elasticity", "court-speed elasticity"]
		},
		{
			name: "surface-speed crossover",
			terms: ["surface speed crossover", "surface-speed crossover"]
		},
		{
			name: "ball degradation sensitivity",
			terms: ["ball degradation sensitivity"]
		},
		{
			name: "new-ball serve boost",
			terms: ["new ball serve boost", "new-ball serve boost"]
		},
		{
			name: "tournament adaptation slope",
			terms: ["tournament adaptation slope"]
		},
		{
			name: "venue familiarity value",
			terms: ["venue familiarity value"]
		},
		{
			name: "time-of-day split",
			terms: ["time of day split", "time-of-day split"]
		},
		{
			name: "round-adjusted pressure",
			terms: ["round adjusted pressure", "round-adjusted pressure"]
		},
		{
			name: "favorite-pressure elasticity",
			terms: ["favorite pressure elasticity", "favorite-pressure elasticity"]
		},
		{
			name: "underdog freedom effect",
			terms: ["underdog freedom effect"]
		},
		{
			name: "price-specific miscalibration",
			terms: ["price specific miscalibration", "price-specific miscalibration"]
		},
		{
			name: "closing-line value history",
			terms: ["closing line value history", "closing-line value history"]
		},
		{
			name: "market disagreement dispersion",
			terms: ["market disagreement dispersion"]
		},
		{
			name: "sharp-vs-recreational book divergence",
			terms: ["sharp vs recreational book divergence", "sharp-vs-recreational book divergence"]
		},
		{
			name: "late-line acceleration",
			terms: ["late line acceleration", "late-line acceleration"]
		}
	],
	"062": [
		{
			name: "points-defending pressure",
			terms: [
				"points defending pressure",
				"points-defending pressure",
				"ranking points defended",
				"ranking points protecting"
			]
		},
		{
			name: "seeding/bye implications",
			terms: [
				"seeding bye implications",
				"seeding/bye implications",
				"seeding implications",
				"bye implications"
			]
		},
		{
			name: "prize-money/status milestones",
			terms: [
				"prize money status milestones",
				"prize-money/status milestones",
				"career high ranking",
				"top 100 cutoff",
				"top 50 cutoff",
				"direct entry cutoff"
			]
		}
	],
	"063": [
		{
			name: "coaching changes",
			terms: [
				"coaching changes",
				"coach change",
				"new coach"
			]
		},
		{
			name: "coaching-box presence",
			terms: [
				"coaching box presence",
				"coaching-box presence",
				"coach present courtside",
				"coach courtside"
			]
		},
		{
			name: "equipment changes",
			terms: [
				"equipment changes",
				"recent racket change",
				"recent string setup change",
				"recent shoe sponsor change"
			]
		}
	],
	"064": [{
		name: "qualifying/lucky-loser fatigue",
		terms: [
			"qualifying lucky loser fatigue",
			"qualifying/lucky-loser fatigue",
			"lucky loser status",
			"qualifying status",
			"qualifying workload"
		]
	}, {
		name: "draw path difficulty beyond this match",
		terms: [
			"draw path difficulty beyond this match",
			"next round path",
			"potential later round opponent"
		]
	}],
	"065": [{
		name: "off-season/pre-season training reports",
		terms: [
			"off season training reports",
			"off-season training reports",
			"pre season training reports",
			"pre-season training reports",
			"fitness camp",
			"body composition"
		]
	}, {
		name: "illness reports",
		terms: [
			"illness reports",
			"documented illness",
			"flu",
			"stomach bug"
		]
	}],
	"066": [
		{
			name: "racket/string setup changes",
			terms: [
				"racket string setup changes",
				"racket/string setup changes",
				"string tension change",
				"racket model change",
				"grip size change"
			]
		},
		{
			name: "shoe/traction changes",
			terms: [
				"shoe traction changes",
				"shoe/traction changes",
				"new shoe sponsor",
				"new shoe model",
				"traction change"
			]
		},
		{
			name: "string-tension weather adjustment",
			terms: [
				"string tension weather adjustment",
				"string-tension weather adjustment",
				"adjusts string tension",
				"altitude string tension",
				"humidity string tension"
			]
		}
	],
	"067": [
		{
			name: "code-violation history",
			terms: [
				"code violation history",
				"code-violation history",
				"racket abuse",
				"verbal warning"
			]
		},
		{
			name: "challenge/Hawk-Eye success rate",
			terms: [
				"challenge hawk eye success rate",
				"challenge/hawk-eye success rate",
				"challenge success rate",
				"hawk eye success rate"
			]
		},
		{
			name: "bathroom/medical-break patterns",
			terms: [
				"bathroom medical break patterns",
				"bathroom/medical-break patterns",
				"bathroom break pattern",
				"medical break pattern"
			]
		},
		{
			name: "on-court time-violation rate",
			terms: [
				"on court time violation rate",
				"on-court time-violation rate",
				"time violation rate",
				"slow play warning"
			]
		}
	],
	"069": [{
		name: "retirement-tour/farewell-run effects",
		terms: [
			"retirement tour farewell run effects",
			"retirement-tour/farewell-run effects",
			"farewell run",
			"publicly nearing retirement"
		]
	}, {
		name: "anti-doping testing disruption",
		terms: [
			"anti doping testing disruption",
			"anti-doping testing disruption",
			"out of competition testing",
			"out-of-competition testing"
		]
	}],
	"070": [
		{
			name: "sports-psychologist presence",
			terms: [
				"sports psychologist presence",
				"sports-psychologist presence",
				"mental game coach",
				"mental-game coach"
			]
		},
		{
			name: "short-notice draw entry",
			terms: [
				"short notice draw entry",
				"short-notice draw entry",
				"lucky loser",
				"late alternate",
				"late-alternate"
			]
		},
		{
			name: "walkover-into-round effect",
			terms: [
				"walkover into round effect",
				"walkover-into-round effect",
				"previous round was a walkover",
				"previous-round walkover"
			]
		}
	],
	"071": [{
		name: "roof-open vs roof-closed split",
		terms: [
			"roof open vs roof closed split",
			"roof-open vs roof-closed split",
			"roof open",
			"roof closed"
		]
	}, {
		name: "fixed start-time vs not-before uncertainty",
		terms: [
			"fixed start time vs not before uncertainty",
			"fixed start-time vs not-before uncertainty",
			"not before",
			"not-before",
			"start time uncertainty"
		]
	}]
};
function familyCode(code) {
	const m = String(code).match(/(\d{1,3})$/);
	return m ? m[1].padStart(3, "0") : String(code).padStart(3, "0");
}
function norm$2(v) {
	return String(v ?? "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
function containsAny(value, terms) {
	const v = norm$2(value);
	return terms.some((term) => v.includes(norm$2(term)));
}
function tagValue(value, key) {
	if (!value) return null;
	return value.match(new RegExp(`${key}\\s*=\\s*([^;]+)`, "i"))?.[1]?.trim() ?? null;
}
function sourceForValue(value, sources, needsPublic) {
	const sourceTag = tagValue(value, "SOURCE");
	if (!sourceTag) return null;
	return (sources ?? []).find((source) => {
		if (norm$2(source.source_name ?? "") !== norm$2(sourceTag)) return false;
		if (!needsPublic) return Boolean(String(source.source_name ?? "").trim());
		const name = norm$2(source.source_name ?? "");
		const url = String(source.url ?? "");
		return /^https?:\/\//i.test(url) && Boolean(name) && !/(model|inference|ai generated|assistant|matrix summary|prediction)/.test(name);
	}) ?? null;
}
function hasUsableSource(sources) {
	return Boolean(sources?.some((s) => Boolean(String(s.source_name ?? "").trim())));
}
function hasSupportablePublicSource(sources) {
	return Boolean(sources?.some((s) => {
		const name = norm$2(s.source_name ?? "");
		const url = String(s.url ?? "");
		return /^https?:\/\//i.test(url) && Boolean(name) && !/(model|inference|ai generated|assistant|matrix summary|prediction)/.test(name);
	}));
}
function formulaUsesForbiddenInput(code, value) {
	if (!value) return false;
	const formula = tagValue(value, "FORMULA");
	if (!formula) return false;
	const t = norm$2(formula);
	return ({
		"060": [
			"sponsorship obligation",
			"media obligation",
			"code violation",
			"sports psychologist"
		],
		"062": [
			"serve",
			"return",
			"weather",
			"travel",
			"fatigue",
			"odds",
			"market",
			"elo",
			"recent form"
		],
		"064": [
			"serve",
			"return",
			"weather",
			"travel",
			"timezone",
			"odds",
			"market",
			"elo",
			"ranking"
		],
		"066": [
			"coach",
			"sponsorship obligation",
			"media obligation",
			"market",
			"odds",
			"elo",
			"code violation",
			"sports psychologist"
		],
		"067": [
			"elo",
			"ranking",
			"market",
			"odds",
			"weather",
			"surface elo",
			"hold pct",
			"break pct",
			"recent form"
		],
		"071": [
			"market",
			"odds",
			"elo",
			"ranking",
			"injury",
			"fatigue",
			"travel",
			"serve profile",
			"return profile"
		]
	}[code] ?? []).some((term) => t.includes(norm$2(term)));
}
function validateSide$2(code, value, treatment, sources, components, expectedPlayer) {
	const strict = POST_FIX_CODES.has(code) && Boolean(expectedPlayer);
	if (treatment === "UNAVAILABLE" || treatment === "EXCLUDED") return {
		value: strict ? null : value,
		treatment,
		missing: []
	};
	const needsPublic = PUBLIC_CONTEXT_CODES.has(code);
	const sourceOk = strict ? Boolean(sourceForValue(value, sources, needsPublic)) : needsPublic ? hasSupportablePublicSource(sources) : hasUsableSource(sources);
	const required = components.filter((c) => !c.reconstructedOnly || treatment === "RECONSTRUCTED");
	const metaMissing = [];
	if (strict) {
		if (!value || norm$2(tagValue(value, "PLAYER")) !== norm$2(expectedPlayer ?? "")) metaMissing.push(`PLAYER=${expectedPlayer ?? "expected player"}`);
		if (!tagValue(value, "SOURCE") || !sourceOk) metaMissing.push(needsPublic ? "side-specific SOURCE matching a supportable public URL" : "side-specific SOURCE matching persisted provenance");
		if (!tagValue(value, "SAMPLE")) metaMissing.push("side-specific SAMPLE");
		if (treatment === "RECONSTRUCTED" && !tagValue(value, "FORMULA")) metaMissing.push("FORMULA for reconstructed evidence");
		if (treatment === "RECONSTRUCTED" && NON_RECONSTRUCTABLE_CONTEXT_CODES.has(code)) metaMissing.push("DIRECT public reporting required; this metric is not reconstructable");
		if (treatment === "RECONSTRUCTED" && formulaUsesForbiddenInput(code, value)) metaMissing.push("FORMULA uses an input outside the authoritative metric definition");
	}
	if (!value || !sourceOk) return {
		value: null,
		treatment: "UNAVAILABLE",
		missing: [...required.map((c) => c.name), ...metaMissing]
	};
	const hits = required.filter((c) => containsAny(value, c.terms));
	const missing = [...required.filter((c) => !hits.includes(c)).map((c) => c.name), ...metaMissing];
	if (strict && metaMissing.length) return {
		value: null,
		treatment: "UNAVAILABLE",
		missing
	};
	if (!missing.length) return {
		value,
		treatment,
		missing
	};
	if (hits.length) return {
		value,
		treatment: "PARTIAL",
		missing
	};
	return {
		value: null,
		treatment: "UNAVAILABLE",
		missing
	};
}
function referencedSources$1(values, sources, needsPublic) {
	const wanted = new Set(values.map((value) => norm$2(tagValue(value, "SOURCE"))).filter(Boolean));
	return (sources ?? []).filter((source) => {
		if (!wanted.has(norm$2(source.source_name ?? ""))) return false;
		if (!needsPublic) return true;
		const name = norm$2(source.source_name ?? "");
		const url = String(source.url ?? "");
		return /^https?:\/\//i.test(url) && Boolean(name) && !/(model|inference|ai generated|assistant|matrix summary|prediction)/.test(name);
	});
}
function validateProtectedMetricWiring(finding, expected) {
	const code = familyCode(finding.metric_code);
	const components = PROTECTED_COMPONENTS[code];
	if (!components) return finding;
	const p1 = validateSide$2(code, finding.p1_value, finding.p1_treatment, finding.sources, components, expected?.p1);
	const p2 = validateSide$2(code, finding.p2_value, finding.p2_treatment, finding.sources, components, expected?.p2);
	const missing = [.../* @__PURE__ */ new Set([...p1.missing ?? [], ...p2.missing ?? []])];
	const strict = POST_FIX_CODES.has(code) && Boolean(expected);
	const sources = strict ? referencedSources$1([p1.value, p2.value], finding.sources, PUBLIC_CONTEXT_CODES.has(code)) : finding.sources;
	const p1Sample = strict ? tagValue(p1.value, "SAMPLE") : null;
	const p2Sample = strict ? tagValue(p2.value, "SAMPLE") : null;
	return {
		...finding,
		p1_value: p1.value,
		p2_value: p2.value,
		p1_treatment: p1.treatment,
		p2_treatment: p2.treatment,
		evidence_family: strict ? `EXACT_${code}` : finding.evidence_family,
		sample: strict ? `P1:${p1Sample ?? "UNAVAILABLE"} | P2:${p2Sample ?? "UNAVAILABLE"}` : finding.sample,
		sources,
		unavailable_reason: missing.length ? `Protected metric wiring guard: only exact master-definition components are admissible for ${code}; unsupported components remain missing (${missing.join(", ")}). No proxy substitution, side reversal, unrelated provenance, or out-of-definition formula input permitted.` : finding.unavailable_reason,
		missing_inputs: missing.length ? [.../* @__PURE__ */ new Set([...finding.missing_inputs ?? [], ...missing])] : finding.missing_inputs
	};
}
function postFixInstruction(code, p1, p2) {
	if (!POST_FIX_CODES.has(code)) return "";
	return `\nSTRICT FIVE-METRIC POST-FIX RULE: no neighboring statistic, generic proxy, row-order identity, or unrelated source may satisfy this metric. Every usable side value MUST use: PLAYER=<exact player name>; SOURCE=<one actual source_name also present in sources>; SAMPLE=<actual denominator/window, or UNAVAILABLE if the source publishes no denominator>; <exact supported master-definition component(s)>. P1 must use PLAYER=${p1}; P2 must use PLAYER=${p2}.${PUBLIC_CONTEXT_CODES.has(code) ? " SOURCE must be a real public HTTP(S) source that directly supports the tagged component." : " SOURCE must name the actual persisted source supporting the tagged component."}${NON_RECONSTRUCTABLE_CONTEXT_CODES.has(code) ? " This metric is factual public context and may not be labeled RECONSTRUCTED; use DIRECT/PARTIAL/UNAVAILABLE as appropriate." : " RECONSTRUCTED additionally requires FORMULA=<explicit calculation using only inputs permitted by the authoritative master definition>."} If any mapping cannot be proved, return PARTIAL only for exact supported components; otherwise return UNAVAILABLE.`;
}
var protectedMetricWiringResearcher = {
	...validatedCompletionResearcher,
	async metrics(input) {
		const target = input.metrics.filter((metric) => POST_FIX_CODES.has(familyCode(metric.code)));
		const other = input.metrics.filter((metric) => !POST_FIX_CODES.has(familyCode(metric.code)));
		const rows = [];
		if (other.length) rows.push(...await validatedCompletionResearcher.metrics({
			...input,
			metrics: other
		}));
		if (target.length) {
			const guardedTarget = target.map((metric) => ({
				...metric,
				body: `${metric.body ?? ""}${postFixInstruction(familyCode(metric.code), input.p1, input.p2)}`
			}));
			rows.push(...await completionSweepResearcher.metrics({
				...input,
				metrics: guardedTarget
			}));
		}
		const byCode = new Map(rows.map((row) => [String(row.metric_code), row]));
		return input.metrics.map((metric) => {
			const row = byCode.get(String(metric.code)) ?? {
				metric_code: metric.code,
				p1_value: null,
				p2_value: null,
				p1_treatment: "UNAVAILABLE",
				p2_treatment: "UNAVAILABLE",
				differential: null,
				evidence_family: null,
				reliability: null,
				sample: null,
				unavailable_reason: "No finding returned for requested metric.",
				sources: []
			};
			return POST_FIX_CODES.has(familyCode(metric.code)) ? validateProtectedMetricWiring(row, {
				p1: input.p1,
				p2: input.p2
			}) : validateProtectedMetricWiring(row);
		});
	}
};
var TARGET$1 = /* @__PURE__ */ new Set([
	"072",
	"073",
	"074",
	"075",
	"076"
]);
var PUBLIC_CONTEXT$1 = /* @__PURE__ */ new Set([
	"072",
	"073",
	"075",
	"076"
]);
function codeOf$2(value) {
	const m = String(value ?? "").match(/(\d{1,3})$/);
	return m ? m[1].padStart(3, "0") : String(value ?? "").padStart(3, "0");
}
function norm$1(value) {
	return String(value ?? "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
function tag$1(value, key) {
	if (!value) return null;
	return value.match(new RegExp(`${key}\\s*=\\s*([^;]+)`, "i"))?.[1]?.trim() ?? null;
}
function sourceMatches$1(value, sources, publicOnly) {
	const wanted = norm$1(tag$1(value, "SOURCE"));
	if (!wanted) return false;
	return Boolean((sources ?? []).some((source) => {
		if (norm$1(source.source_name) !== wanted) return false;
		if (!publicOnly) return Boolean(String(source.source_name ?? "").trim());
		return /^https?:\/\//i.test(String(source.url ?? "")) && !/(matrix summary|prediction|assistant|ai generated|model inference)/i.test(String(source.source_name ?? ""));
	}));
}
function validateSide$1(code, side, value, treatment, sources, expectedPlayer) {
	if (treatment === "EXCLUDED") return {
		value,
		treatment,
		missing: []
	};
	if (!value || treatment === "UNAVAILABLE") return {
		value: null,
		treatment: "UNAVAILABLE",
		missing: []
	};
	const missing = [];
	if (tag$1(value, "PLAYER") !== expectedPlayer) missing.push(`${side} exact PLAYER=${expectedPlayer}`);
	if (!sourceMatches$1(value, sources, PUBLIC_CONTEXT$1.has(code))) missing.push(`${side} SOURCE matching persisted provenance`);
	if (!tag$1(value, "SAMPLE")) missing.push(`${side} SAMPLE/window metadata`);
	if (missing.length) return {
		value: null,
		treatment: "UNAVAILABLE",
		missing
	};
	return {
		value,
		treatment,
		missing
	};
}
function referencedSources(values, sources) {
	const wanted = new Set(values.map((value) => norm$1(tag$1(value, "SOURCE"))).filter(Boolean));
	return (sources ?? []).filter((source) => wanted.has(norm$1(source.source_name)));
}
function enforceMetricWiring072076(finding, players) {
	const code = codeOf$2(finding.metric_code);
	if (!TARGET$1.has(code)) return finding;
	const p1 = validateSide$1(code, "P1", finding.p1_value, finding.p1_treatment, finding.sources, players.p1);
	const p2 = validateSide$1(code, "P2", finding.p2_value, finding.p2_treatment, finding.sources, players.p2);
	const missing = [.../* @__PURE__ */ new Set([
		...finding.missing_inputs ?? [],
		...p1.missing,
		...p2.missing
	])];
	const sources = referencedSources([p1.value, p2.value], finding.sources);
	return {
		...finding,
		p1_value: p1.value,
		p2_value: p2.value,
		p1_treatment: p1.treatment,
		p2_treatment: p2.treatment,
		evidence_family: `EXACT_${code}`,
		sample: `P1:${tag$1(p1.value, "SAMPLE") ?? "UNAVAILABLE"} | P2:${tag$1(p2.value, "SAMPLE") ?? "UNAVAILABLE"}`,
		sources,
		unavailable_reason: missing.length ? `Metric ${code} side/provenance guard rejected evidence whose player/source/sample lineage could not be proved. Missing/invalid: ${missing.join(", ")}.` : finding.unavailable_reason,
		missing_inputs: missing.length ? missing : finding.missing_inputs
	};
}
function instruction$1(code, p1, p2) {
	if (!TARGET$1.has(code)) return "";
	return `\nSTRICT SIDE/PROVENANCE RULE FOR ${code}: every usable side value MUST include PLAYER=<exact player>; SOURCE=<one actual source_name also present in sources>; SAMPLE=<actual denominator/window, or UNAVAILABLE if the source has no denominator>. P1 must use PLAYER=${p1}; P2 must use PLAYER=${p2}.${PUBLIC_CONTEXT$1.has(code) ? " SOURCE must be a real public HTTP(S) source directly supporting that side's exact component." : " SOURCE must name the actual imported/local/charted source supporting that side's exact component."} Never rely on row order or a source that belongs only to the opponent. Preserve DIRECT/PARTIAL/UNAVAILABLE/EXCLUDED conservatively; the existing exact-field firewall remains authoritative and may only downgrade evidence.`;
}
var metricWiring072076Researcher = {
	...protectedMetricWiringResearcher,
	async metrics(input) {
		const decorated = input.metrics.map((metric) => ({
			...metric,
			body: `${metric.body ?? ""}${instruction$1(codeOf$2(metric.code), input.p1, input.p2)}`
		}));
		const rows = await protectedMetricWiringResearcher.metrics({
			...input,
			metrics: decorated
		});
		const byCode = new Map(rows.map((row) => [String(row.metric_code), row]));
		return input.metrics.map((metric) => enforceMetricWiring072076(byCode.get(String(metric.code)) ?? {
			metric_code: metric.code,
			p1_value: null,
			p2_value: null,
			p1_treatment: "UNAVAILABLE",
			p2_treatment: "UNAVAILABLE",
			differential: null,
			evidence_family: null,
			reliability: null,
			sample: null,
			unavailable_reason: "No sourced result survived the 072-076 side/provenance guard.",
			missing_inputs: ["side-specific sourced metric evidence"],
			sources: []
		}, {
			p1: input.p1,
			p2: input.p2
		}));
	}
};
var TARGET = /* @__PURE__ */ new Set([
	"078",
	"079",
	"081"
]);
var PUBLIC_CONTEXT = /* @__PURE__ */ new Set(["078", "081"]);
var COMPONENTS = {
	"078": [{
		name: "home-market commercial appearances",
		terms: [
			"home market commercial appearances",
			"home-market commercial appearances",
			"commercial appearance"
		]
	}, {
		name: "sponsor/media obligation timing",
		terms: [
			"sponsor obligation",
			"media obligation",
			"tournament week",
			"recovery time",
			"preparation time"
		]
	}],
	"079": [
		{
			name: "chair-side coaching usage rate",
			terms: [
				"chair side coaching usage rate",
				"chair-side coaching usage rate",
				"coaching visit"
			]
		},
		{
			name: "post-coaching-visit performance",
			terms: [
				"post coaching visit performance",
				"post-coaching-visit performance",
				"next game after coaching"
			]
		},
		{
			name: "shot-clock violation rate by set",
			terms: ["shot clock violation rate by set", "shot-clock violation rate by set"]
		},
		{
			name: "racket-change-mid-match frequency",
			terms: ["racket change mid match frequency", "racket-change-mid-match frequency"]
		},
		{
			name: "sleep-schedule disruption",
			terms: [
				"sleep schedule disruption",
				"sleep-schedule disruption",
				"late night",
				"early next day"
			]
		},
		{
			name: "hydration-break utilization",
			terms: ["hydration break utilization", "hydration-break utilization"]
		},
		{
			name: "medical-timeout-to-win correlation",
			terms: ["medical timeout to win correlation", "medical-timeout-to-win correlation"]
		},
		{
			name: "first-point-of-match win rate",
			terms: ["first point of match win rate", "first-point-of-match win rate"]
		},
		{
			name: "first-game win rate",
			terms: ["first game win rate", "first-game win rate"]
		},
		{
			name: "changeover recovery rate",
			terms: ["changeover recovery rate"]
		},
		{
			name: "odd-game vs even-game serve performance",
			terms: ["odd game vs even game serve performance", "odd-game vs even-game serve performance"]
		},
		{
			name: "return-game win rate by return position",
			terms: ["return game win rate by return position", "return-game win rate by return position"]
		},
		{
			name: "serve-pattern predictability score",
			terms: ["serve pattern predictability score", "serve-pattern predictability score"]
		},
		{
			name: "opponent-scouting-report public availability",
			terms: ["opponent scouting report public availability", "opponent-scouting-report public availability"]
		},
		{
			name: "post-injury-timeout point-win rate",
			terms: ["post injury timeout point win rate", "post-injury-timeout point-win rate"]
		},
		{
			name: "match-count at current altitude this season",
			terms: ["match count at current altitude this season", "match-count at current altitude this season"]
		},
		{
			name: "consecutive-tournament surface-switching count",
			terms: ["consecutive tournament surface switching count", "consecutive-tournament surface-switching count"]
		},
		{
			name: "first-tournament-back-from-layoff performance",
			terms: ["first tournament back from layoff performance", "first-tournament-back-from-layoff performance"]
		},
		{
			name: "wildcard/entry-status effect",
			terms: [
				"wildcard entry status effect",
				"wildcard/entry-status effect",
				"entry status"
			]
		},
		{
			name: "draw-seed protection benefit",
			terms: ["draw seed protection benefit", "draw-seed protection benefit"]
		},
		{
			name: "post-walkover-round performance",
			terms: ["post walkover round performance", "post-walkover-round performance"]
		},
		{
			name: "local qualifying-event carryover",
			terms: ["local qualifying event carryover", "local qualifying-event carryover"]
		},
		{
			name: "fine/suspension history recency",
			terms: ["fine suspension history recency", "fine/suspension history recency"]
		},
		{
			name: "coach-opponent history",
			terms: ["coach opponent history", "coach-opponent history"]
		},
		{
			name: "shot-selection variance under lead vs deficit",
			terms: ["shot selection variance under lead vs deficit", "shot-selection variance under lead vs deficit"]
		}
	],
	"081": [
		{
			name: "locker-room/backstage conflict history",
			terms: [
				"locker room backstage conflict history",
				"locker-room/backstage conflict history",
				"backstage conflict"
			]
		},
		{
			name: "anthem/opening-ceremony delay effect",
			terms: [
				"anthem opening ceremony delay effect",
				"anthem/opening-ceremony delay effect",
				"ceremony delay"
			]
		},
		{
			name: "featured/center-court exposure rate",
			terms: [
				"featured center court exposure rate",
				"featured/center-court exposure rate",
				"center court exposure"
			]
		},
		{
			name: "rain-delay resumption performance",
			terms: ["rain delay resumption performance", "rain-delay resumption performance"]
		},
		{
			name: "overnight-suspension resumption performance",
			terms: ["overnight suspension resumption performance", "overnight-suspension resumption performance"]
		},
		{
			name: "late-opponent-substitution adjustment",
			terms: [
				"late opponent substitution adjustment",
				"late-opponent-substitution adjustment",
				"lucky loser replacement",
				"alternate replacement"
			]
		},
		{
			name: "weekday vs weekend performance split",
			terms: ["weekday vs weekend performance split"]
		},
		{
			name: "consecutive-day-play penalty",
			terms: ["consecutive day play penalty", "consecutive-day-play penalty"]
		},
		{
			name: "training-base relocation",
			terms: ["training base relocation", "training-base relocation"]
		},
		{
			name: "prior withdrawal pattern at this event",
			terms: ["prior withdrawal pattern at this event"]
		},
		{
			name: "electronic-line-calling adjustment lag",
			terms: ["electronic line calling adjustment lag", "electronic-line-calling adjustment lag"]
		},
		{
			name: "first-week vs second-week major split",
			terms: ["first week vs second week major split", "first-week vs second-week major split"]
		},
		{
			name: "prior-year round reached at this exact event",
			terms: ["prior year round reached at this exact event", "prior-year round reached at this exact event"]
		},
		{
			name: "support-staff turnover",
			terms: [
				"support staff turnover",
				"support-staff turnover",
				"stringer",
				"physio"
			]
		},
		{
			name: "travel-friction reports",
			terms: [
				"travel friction reports",
				"travel-friction reports",
				"visa issue",
				"missed connection",
				"long transit"
			]
		},
		{
			name: "home-climate differential",
			terms: ["home climate differential", "home-climate differential"]
		}
	]
};
var FORMULA_SUBJECT = {
	"079": /coaching|shot clock|violation|racket change|late night|early next day|hydration|medical timeout|first point|first game|opening game|changeover|odd game|even game|return position|serve placement|serve direction|serve pattern|scouting report|altitude|elevation|surface switch|layoff|absence|wildcard|protected ranking|qualifying|entry status|seed|draw|walkover|fine|suspension|coach opponent|coach history|lead|deficit|shot selection/i,
	"081": /ceremony|start delay|court assignment|center court|featured court|rain delay|resumption|overnight suspension|opponent substitution|lucky loser|alternate|weekday|weekend|consecutive day|training base|withdrawal|electronic line calling|major week|grand slam week|prior year round|stringer|physio|support staff|visa|transit|missed connection|travel friction|home climate|event climate|temperature|humidity|dryness/i
};
var FORMULA_DENOMINATOR = /matches?|games?|sets?|points?|events?|opportunities|days?|rounds?|exposures?|visits?|resumptions?|withdrawals?|appearances?|observations?/i;
function codeOf$1(value) {
	const m = String(value ?? "").match(/(\d{1,3})$/);
	return m ? m[1].padStart(3, "0") : String(value ?? "").padStart(3, "0");
}
function norm(value) {
	return String(value ?? "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
function tag(value, key) {
	if (!value) return null;
	return value.match(new RegExp(`${key}\\s*=\\s*([^;]+)`, "i"))?.[1]?.trim() ?? null;
}
function hasAny(value, terms) {
	const v = norm(value);
	return terms.some((term) => v.includes(norm(term)));
}
function sourceMatches(value, sources, publicOnly) {
	const wanted = norm(tag(value, "SOURCE"));
	if (!wanted) return false;
	return Boolean((sources ?? []).some((source) => {
		if (norm(source.source_name) !== wanted) return false;
		if (!publicOnly) return Boolean(String(source.source_name ?? "").trim());
		return /^https?:\/\//i.test(String(source.url ?? "")) && !/(matrix summary|prediction|assistant|ai generated|model inference)/i.test(String(source.source_name ?? ""));
	}));
}
function allowedFormula(code, value) {
	if (!value || code === "078") return false;
	const formula = tag(value, "FORMULA");
	const rawInputs = tag(value, "INPUTS");
	if (!formula || !rawInputs) return false;
	const inputs = rawInputs.split("|").map((x) => x.trim()).filter(Boolean);
	const subject = FORMULA_SUBJECT[code];
	if (!inputs.length || !subject) return false;
	if (!inputs.some((input) => subject.test(input))) return false;
	if (inputs.some((input) => !subject.test(input) && !FORMULA_DENOMINATOR.test(input))) return false;
	const normalizedFormula = norm(formula);
	if (inputs.some((input) => !normalizedFormula.includes(norm(input)))) return false;
	const forbidden = code === "079" ? /surface elo|market odds|sportsbook|sponsor pressure|ranking|age|height|handedness|hold pct|break pct/i : /surface elo|serve profile|return profile|market odds|sportsbook|sponsor pressure|ranking|age|height|handedness|ace rate|double fault|hold pct|break pct/i;
	return !forbidden.test(formula) && !forbidden.test(rawInputs);
}
function validateSide(code, value, treatment, sources, player) {
	if (!value || treatment === "UNAVAILABLE" || treatment === "EXCLUDED") return {
		value: null,
		treatment: treatment === "EXCLUDED" ? "EXCLUDED" : "UNAVAILABLE",
		missing: []
	};
	const missing = [];
	if (tag(value, "PLAYER") !== player) missing.push("exact PLAYER orientation");
	if (!sourceMatches(value, sources, PUBLIC_CONTEXT.has(code))) missing.push("matching admissible SOURCE provenance");
	if (!tag(value, "SAMPLE")) missing.push("SAMPLE/window metadata");
	const components = COMPONENTS[code] ?? [];
	const hits = components.filter((component) => hasAny(value, component.terms));
	if (!hits.length) missing.push("exact master-definition component");
	if (treatment === "RECONSTRUCTED" && !allowedFormula(code, value)) missing.push("explicit formula with enumerated exact permitted INPUTS");
	if (code === "078" && treatment === "RECONSTRUCTED") missing.push("078 factual context cannot be reconstructed from performance proxies");
	if (!hits.length || missing.some((x) => /PLAYER|SOURCE|SAMPLE|formula|cannot be reconstructed/.test(x))) return {
		value: null,
		treatment: "UNAVAILABLE",
		missing
	};
	if (hits.length < components.length && treatment === "DIRECT") return {
		value,
		treatment: "PARTIAL",
		missing: [...missing, ...components.filter((c) => !hits.includes(c)).map((c) => c.name)]
	};
	return {
		value,
		treatment,
		missing: [...missing, ...components.filter((c) => !hits.includes(c)).map((c) => c.name)]
	};
}
function enforceMetricWiring078081(finding, players) {
	const code = codeOf$1(finding.metric_code);
	if (!TARGET.has(code)) return finding;
	const p1 = validateSide(code, finding.p1_value, finding.p1_treatment, finding.sources, players.p1);
	const p2 = validateSide(code, finding.p2_value, finding.p2_treatment, finding.sources, players.p2);
	const missing = [.../* @__PURE__ */ new Set([
		...finding.missing_inputs ?? [],
		...p1.missing,
		...p2.missing
	])];
	const referenced = new Set([norm(tag(p1.value, "SOURCE")), norm(tag(p2.value, "SOURCE"))].filter(Boolean));
	return {
		...finding,
		p1_value: p1.value,
		p2_value: p2.value,
		p1_treatment: p1.treatment,
		p2_treatment: p2.treatment,
		evidence_family: `EXACT_${code}`,
		sample: `P1:${tag(p1.value, "SAMPLE") ?? "UNAVAILABLE"} | P2:${tag(p2.value, "SAMPLE") ?? "UNAVAILABLE"}`,
		sources: (finding.sources ?? []).filter((source) => referenced.has(norm(source.source_name))),
		unavailable_reason: missing.length ? `Metric ${code} exact-wiring guard retained only master-definition evidence. Missing/unsupported: ${missing.join(", ")}.` : finding.unavailable_reason,
		missing_inputs: missing.length ? missing : finding.missing_inputs
	};
}
function instruction(code, p1, p2) {
	if (!TARGET.has(code)) return "";
	return `\nSTRICT FINAL-METRIC WIRING RULE FOR ${code}: Only exact components in this metric's authoritative definition are admissible. No neighboring statistic, generic context, social chatter, row-order identity, or proxy may satisfy it. Every usable side value MUST include PLAYER=<exact player>; SOURCE=<actual source_name present in sources>; SAMPLE=<actual denominator/window, or UNAVAILABLE when the source has no denominator>. P1 must use PLAYER=${p1}; P2 must use PLAYER=${p2}. RECONSTRUCTED requires INPUTS=<exact raw input 1>|<exact raw input 2>; FORMULA=<explicit calculation using those exact INPUTS>. Every INPUTS item must be a raw field required by the named submetric and must appear in FORMULA; unrelated inputs invalidate reconstruction. Metric 078 is factual public context and must not be RECONSTRUCTED from performance data. PARTIAL is allowed only when one or more exact named subcomponents are sourced; otherwise UNAVAILABLE.`;
}
var finalMetricWiringResearcher = {
	...metricWiring072076Researcher,
	async metrics(input) {
		const decorated = input.metrics.map((metric) => ({
			...metric,
			body: `${metric.body ?? ""}${instruction(codeOf$1(metric.code), input.p1, input.p2)}`
		}));
		const rows = await metricWiring072076Researcher.metrics({
			...input,
			metrics: decorated
		});
		const byCode = new Map(rows.map((row) => [String(row.metric_code), row]));
		return input.metrics.map((metric) => clearPhantomEvidenceMetadata(enforceMetricWiring078081(byCode.get(String(metric.code)) ?? {
			metric_code: metric.code,
			p1_value: null,
			p2_value: null,
			p1_treatment: "UNAVAILABLE",
			p2_treatment: "UNAVAILABLE",
			differential: null,
			evidence_family: null,
			reliability: null,
			sample: null,
			unavailable_reason: "No sourced result survived the final metric wiring guard.",
			missing_inputs: ["exact sourced metric evidence"],
			sources: []
		}, {
			p1: input.p1,
			p2: input.p2
		})));
	}
};
var BoundedPromiseCache = class {
	maxEntries;
	ttlMs;
	now;
	entries = /* @__PURE__ */ new Map();
	constructor(maxEntries, ttlMs, now = Date.now) {
		this.maxEntries = maxEntries;
		this.ttlMs = ttlMs;
		this.now = now;
	}
	getOrCreate(key, factory) {
		const current = this.entries.get(key);
		if (current && current.expiresAt > this.now()) return current.promise;
		if (current) this.entries.delete(key);
		const promise = factory();
		this.entries.set(key, {
			expiresAt: this.now() + this.ttlMs,
			promise
		});
		while (this.entries.size > this.maxEntries) {
			const oldest = this.entries.keys().next().value;
			if (oldest === void 0) break;
			this.entries.delete(oldest);
		}
		promise.catch(() => {
			if (this.entries.get(key)?.promise === promise) this.entries.delete(key);
		});
		return promise;
	}
	clear() {
		this.entries.clear();
	}
	get size() {
		return this.entries.size;
	}
};
var BoundedOperationPool = class {
	limit;
	active = 0;
	waiting = [];
	constructor(limit) {
		this.limit = limit;
	}
	async acquire() {
		if (this.active < this.limit) {
			this.active++;
			return;
		}
		await new Promise((resolve) => this.waiting.push(resolve));
		this.active++;
	}
	release() {
		this.active--;
		this.waiting.shift()?.();
	}
	async runWithBudget(label, timeoutMs, work, fallback) {
		await this.acquire();
		let timer;
		let returned = false;
		const operation = Promise.resolve().then(work);
		operation.finally(() => this.release()).catch(() => void 0);
		try {
			return await Promise.race([operation, new Promise((resolve) => {
				timer = setTimeout(() => {
					returned = true;
					console.warn(`[research-timing] ${label} exceeded ${timeoutMs}ms; bounded fallback used`);
					resolve(fallback());
				}, timeoutMs);
			})]);
		} finally {
			if (timer && !returned) clearTimeout(timer);
		}
	}
	get activeCount() {
		return this.active;
	}
};
function classifyWinOutcome(o) {
	if (!o.playerWon) return null;
	const p = o.playerWinProbabilityPct;
	if (p > 70) return "DOMINANT";
	if (p >= 55) return "ROUTINE";
	if (p < 45) return o.wasClose ? "ESCAPE" : "UPSET_WIN";
	return null;
}
function classifyLossOutcome(o) {
	if (o.playerWon) return null;
	const p = o.playerWinProbabilityPct;
	if (p > 70) return "BAD_LOSS";
	if (p >= 55) return "CLOSE_LOSS";
	if (p < 45) return "EXPECTED_LOSS";
	return null;
}
function parseFinalScoreSets(finalScore) {
	if (!finalScore) return [];
	return finalScore.split(/\s+/).map((s) => s.trim()).filter(Boolean).map((s) => {
		const m = s.match(/^(\d+)-(\d+)/);
		if (!m) return null;
		const a = Number(m[1]), b = Number(m[2]);
		return Number.isFinite(a) && Number.isFinite(b) ? [a, b] : null;
	}).filter((x) => x !== null);
}
/** A match is "close" when it went to a deciding set, or any set was a tiebreak / decided by a two-game-or-fewer margin at 6+ games. */
function isCloseMatch(finalScore, bestOf) {
	const sets = parseFinalScoreSets(finalScore);
	if (!sets.length) return false;
	if (bestOf && sets.length >= bestOf) return true;
	return sets.some(([a, b]) => {
		if (a === 7 && b === 6) return true;
		if (a === 6 && b === 7) return true;
		return Math.max(a, b) >= 7 && Math.abs(a - b) <= 2;
	});
}
function computeLossWinAutopsy(o) {
	return {
		category: o.playerWon ? classifyWinOutcome(o) : classifyLossOutcome(o),
		player_win_probability_pct: round1(o.playerWinProbabilityPct),
		was_close: o.wasClose
	};
}
function isPredictionBeforeResult(predictionCreatedAt, resultRecordedAt) {
	if (!resultRecordedAt) return false;
	const predicted = Date.parse(predictionCreatedAt), recorded = Date.parse(resultRecordedAt);
	if (!Number.isFinite(predicted) || !Number.isFinite(recorded)) return false;
	return predicted < recorded;
}
/** Aggregates the audit DB's whole scored population into a category distribution, gated by MIN_SUPPORT_N. */
function summarizeAutopsyDistribution(outcomes) {
	const n = outcomes.length;
	if (n < 50) return {
		population: "AUDIT_DB",
		status: "NOT_ENOUGH_DATA",
		n,
		reason: `Only ${n} TennisMatrixAi-scored matches available; minimum support is 50.`
	};
	const counts = {};
	for (const o of outcomes) {
		const { category } = computeLossWinAutopsy(o);
		const key = category ?? "UNCLASSIFIED";
		counts[key] = (counts[key] ?? 0) + 1;
	}
	return {
		population: "AUDIT_DB",
		status: "GO",
		n,
		value: counts
	};
}
/** Signed surprise on a -1..+1 scale: +1 = won a match TennisMatrixAi gave 0% chance of, -1 = lost one it gave 100%. */
function computeSignedSurprise(input) {
	const predicted = input.playerWinProbabilityPct / 100;
	return (input.playerWon ? 1 : 0) - predicted;
}
/**
* Rolling average of |surprise| (and mean signed surprise) over a player's
* most recent `window` scored matches. `chronologicalInputs` must already be
* ordered oldest-to-newest by the caller (this function does not sort, so it
* cannot silently paper over a caller passing an unordered or leaking set --
* see the live wrapper for the leakage guard that decides what's eligible).
*/
function computeRollingSurprise(chronologicalInputs, window) {
	const trailing = chronologicalInputs.slice(-window);
	const n = trailing.length;
	if (n === 0) return {
		n: 0,
		mean_absolute_surprise: 0,
		mean_signed_surprise: 0
	};
	const surprises = trailing.map(computeSignedSurprise);
	const meanAbs = surprises.reduce((sum, s) => sum + Math.abs(s), 0) / n;
	const meanSigned = surprises.reduce((sum, s) => sum + s, 0) / n;
	return {
		n,
		mean_absolute_surprise: round1(meanAbs * 100) / 100,
		mean_signed_surprise: round1(meanSigned * 100) / 100
	};
}
var pageSlice = (from, to) => ({
	limit: to - from + 1,
	offset: from
});
var OWNER$1 = LOCAL_WORKSPACE_ID;
var AUDIT_DB_SOURCE = "Audit DB completed TennisMatrixAi-scored matches";
var ROLLING_SURPRISE_WINDOW = 10;
var AUDIT_DB_ID_BATCH_SIZE = 100;
var scoredMatchesCache = new BoundedPromiseCache(1, 3e5);
async function collectPaged(fetchPage, pageSize = 500) {
	const rows = [];
	for (let from = 0;; from += pageSize) {
		const page = await fetchPage(from, from + pageSize - 1);
		rows.push(...page);
		if (page.length < pageSize) return rows;
	}
}
function batches(rows, size = AUDIT_DB_ID_BATCH_SIZE) {
	const out = [];
	for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size));
	return out;
}
function strictNameMatches(candidateName, expectedName) {
	const candidate = normalizeEvidenceIdentity(candidateName);
	const expected = normalizeEvidenceIdentity(expectedName);
	if (!candidate || !expected) return false;
	if (candidate === expected) return true;
	const candidateParts = candidate.split(" ");
	const expectedParts = expected.split(" ");
	if (candidateParts.length > 1 && expectedParts.length > 1) return false;
	return candidateParts.at(-1) === expectedParts.at(-1);
}
/**
* Loads every completed, TennisMatrixAi-scored match in the audit DB --
* actual_winner populated AND a numeric matrix_wp/matrix_predicted_winner
* recorded against its active summary version -- with the leakage guard
* already applied (a matrix_wp field recorded on/after the match's own
* result_recorded_at is dropped, never trusted as a genuine pre-match call).
*/
async function loadAuditDbScoredMatches() {
	return scoredMatchesCache.getOrCreate("all", fetchAuditDbScoredMatches);
}
async function fetchAuditDbScoredMatches() {
	const matches = await collectPaged(async (from, to) => {
		const slice = pageSlice(from, to);
		try {
			return await db.select({
				id: matchesTable.id,
				final_score: matchesTable.final_score,
				best_of: matchesTable.best_of,
				actual_winner: matchesTable.actual_winner,
				player1_name: matchesTable.player1_name,
				player2_name: matchesTable.player2_name,
				result_recorded_at: matchesTable.result_recorded_at
			}).from(matchesTable).where(and(eq(matchesTable.user_id, OWNER$1), isNotNull(matchesTable.actual_winner))).orderBy(asc(matchesTable.id)).limit(slice.limit).offset(slice.offset);
		} catch (error) {
			throw new Error(`Audit DB scored-match query failed: ${error instanceof Error ? error.message : String(error)}`);
		}
	});
	if (!matches.length) return [];
	const versions = [];
	for (const matchBatch of batches(matches)) versions.push(...await collectPaged(async (from, to) => {
		const slice = pageSlice(from, to);
		try {
			return await db.select({
				id: summaryVersionsTable.id,
				match_id: summaryVersionsTable.match_id
			}).from(summaryVersionsTable).where(and(eq(summaryVersionsTable.user_id, OWNER$1), eq(summaryVersionsTable.is_active, true), inArray(summaryVersionsTable.match_id, matchBatch.map((match) => match.id)))).orderBy(asc(summaryVersionsTable.id)).limit(slice.limit).offset(slice.offset);
		} catch (error) {
			throw new Error(`Audit DB summary-version query failed: ${error instanceof Error ? error.message : String(error)}`);
		}
	}));
	if (!versions.length) return [];
	const versionIdToMatchId = new Map(versions.map((version) => [version.id, version.match_id]));
	const fields = [];
	for (const versionBatch of batches(versions)) fields.push(...await collectPaged(async (from, to) => {
		const slice = pageSlice(from, to);
		try {
			return await db.select({
				id: parsedSummaryFieldsTable.id,
				summary_version_id: parsedSummaryFieldsTable.summary_version_id,
				field_key: parsedSummaryFieldsTable.field_key,
				normalized_value: parsedSummaryFieldsTable.normalized_value,
				created_at: parsedSummaryFieldsTable.created_at
			}).from(parsedSummaryFieldsTable).where(and(inArray(parsedSummaryFieldsTable.summary_version_id, versionBatch.map((version) => version.id)), inArray(parsedSummaryFieldsTable.field_key, ["matrix_wp", "matrix_predicted_winner"]))).orderBy(asc(parsedSummaryFieldsTable.id)).limit(slice.limit).offset(slice.offset);
		} catch (error) {
			throw new Error(`Audit DB prediction-field query failed: ${error instanceof Error ? error.message : String(error)}`);
		}
	}));
	if (!fields.length) return [];
	const byMatch = /* @__PURE__ */ new Map();
	for (const f of [...fields].sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))) {
		const matchId = versionIdToMatchId.get(f.summary_version_id);
		if (!matchId) continue;
		const entry = byMatch.get(matchId) ?? {};
		if (f.field_key === "matrix_wp") {
			entry.wp = f.normalized_value ?? void 0;
			entry.wpCreatedAt = f.created_at;
		}
		if (f.field_key === "matrix_predicted_winner") {
			entry.predictedWinner = f.normalized_value ?? void 0;
			entry.predictedWinnerCreatedAt = f.created_at;
		}
		byMatch.set(matchId, entry);
	}
	const matchById = new Map(matches.map((m) => [m.id, m]));
	const out = [];
	for (const [matchId, entry] of byMatch) {
		const match = matchById.get(matchId);
		if (!match || !entry.wp || !entry.predictedWinner || !entry.wpCreatedAt || !entry.predictedWinnerCreatedAt) continue;
		const wp = Number(entry.wp);
		if (!Number.isFinite(wp) || wp < 0 || wp > 100) continue;
		if (!isPredictionBeforeResult(entry.wpCreatedAt, match.result_recorded_at)) continue;
		if (!isPredictionBeforeResult(entry.predictedWinnerCreatedAt, match.result_recorded_at)) continue;
		out.push({
			id: match.id,
			final_score: match.final_score,
			best_of: match.best_of,
			actual_winner: match.actual_winner,
			player1_name: match.player1_name,
			player2_name: match.player2_name,
			result_recorded_at: match.result_recorded_at,
			matrixWp: wp,
			matrixPredictedWinner: entry.predictedWinner,
			matrixWpCreatedAt: entry.wpCreatedAt,
			matrixPredictedWinnerCreatedAt: entry.predictedWinnerCreatedAt
		});
	}
	return out;
}
function uniqueParticipantSide(row, name) {
	const p1 = strictNameMatches(row.player1_name, name);
	return p1 === strictNameMatches(row.player2_name, name) ? null : p1 ? "P1" : "P2";
}
function validAsOfBoundary(asOfDate) {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(asOfDate)) return null;
	const parsed = Date.parse(`${asOfDate}T00:00:00.000Z`);
	return Number.isFinite(parsed) ? parsed : null;
}
/**
* Produces a player's independently oriented, chronological history.
* Probabilities are inverted only when the stored predicted winner resolves
* unambiguously to the opponent side. Every ambiguous row is dropped.
*/
function playerScoredHistory(rows, player, asOfDate) {
	const boundary = validAsOfBoundary(asOfDate);
	if (boundary === null) return [];
	const history = [];
	for (const row of rows) {
		const resultTime = Date.parse(row.result_recorded_at ?? "");
		if (!Number.isFinite(resultTime) || resultTime >= boundary) continue;
		if (!isPredictionBeforeResult(row.matrixWpCreatedAt, row.result_recorded_at)) continue;
		if (!isPredictionBeforeResult(row.matrixPredictedWinnerCreatedAt, row.result_recorded_at)) continue;
		if (!Number.isFinite(row.matrixWp) || row.matrixWp < 0 || row.matrixWp > 100) continue;
		const playerSide = uniqueParticipantSide(row, player);
		const predictedSide = uniqueParticipantSide(row, row.matrixPredictedWinner);
		const winnerSide = uniqueParticipantSide(row, row.actual_winner ?? "");
		if (!playerSide || !predictedSide || !winnerSide) continue;
		const probability = predictedSide === playerSide ? row.matrixWp : 100 - row.matrixWp;
		history.push({
			matchId: row.id,
			resultRecordedAt: row.result_recorded_at,
			finalScore: row.final_score,
			outcome: {
				playerWinProbabilityPct: probability,
				playerWon: winnerSide === playerSide,
				wasClose: isCloseMatch(row.final_score, row.best_of)
			}
		});
	}
	return history.sort((a, b) => a.resultRecordedAt.localeCompare(b.resultRecordedAt) || a.matchId.localeCompare(b.matchId));
}
function unavailableSide(reason) {
	return {
		value: null,
		treatment: "UNAVAILABLE",
		reason
	};
}
function winAutopsySide(player, history) {
	const wins = history.filter((item) => item.outcome.playerWon && parseFinalScoreSets(item.finalScore).length > 0);
	const summary = summarizeAutopsyDistribution(wins.map((item) => item.outcome));
	if (summary.status !== "GO") return unavailableSide(`Only ${summary.n} prior TennisMatrixAi-scored wins with a parseable final score were available for ${player}; minimum support is 50.`);
	const closeWins = wins.filter((item) => item.outcome.wasClose).length;
	const probabilities = wins.map((item) => item.outcome.playerWinProbabilityPct);
	const categories = [
		"DOMINANT",
		"ROUTINE",
		"ESCAPE",
		"UPSET_WIN",
		"UNCLASSIFIED"
	].map((category) => `${category}:${summary.value[category] ?? 0}`).join(",");
	return {
		value: [
			`PLAYER=${player}`,
			`SOURCE=${AUDIT_DB_SOURCE}`,
			`SAMPLE=prior scored wins n=${summary.n}`,
			"FORMULA=classify each completed win from the player's frozen pre-match win probability and final score margin",
			`recent scored wins=${summary.n}`,
			`pre match win probability range=${Math.min(...probabilities)}-${Math.max(...probabilities)} pct`,
			`final score margin close wins=${closeWins}/${summary.n}`,
			`win autopsy category distribution=${categories}`,
			"opponent collapse=UNAVAILABLE (no stored in-play probability series)"
		].join("; "),
		treatment: "RECONSTRUCTED",
		reason: null
	};
}
function signed(value) {
	return `${value >= 0 ? "+" : ""}${value}`;
}
function performanceSurpriseSide(player, history) {
	if (history.length < 50) return unavailableSide(`Only ${history.length} prior TennisMatrixAi-scored matches were available for ${player}; minimum support is 50.`);
	const latest = history.at(-1);
	const chronological = history.map((item) => ({
		playerWinProbabilityPct: item.outcome.playerWinProbabilityPct,
		playerWon: item.outcome.playerWon
	}));
	const rolling = computeRollingSurprise(chronological, ROLLING_SURPRISE_WINDOW);
	const actual = latest.outcome.playerWon ? 1 : 0;
	const expected = round1(latest.outcome.playerWinProbabilityPct) / 100;
	const surprise = round1(computeSignedSurprise(chronological.at(-1)) * 100) / 100;
	return {
		value: [
			`PLAYER=${player}`,
			`SOURCE=${AUDIT_DB_SOURCE}`,
			`SAMPLE=prior scored matches n=${history.length}; rolling n=${rolling.n}`,
			"FORMULA=actual performance (1 win, 0 loss) minus pre match expected performance frozen before result",
			`actual performance=${actual}`,
			`pre match expected performance=${expected}`,
			`performance surprise=${signed(surprise)}`,
			`rolling performance surprise last 10=${signed(rolling.mean_signed_surprise)}`,
			`rolling absolute surprise last 10=${rolling.mean_absolute_surprise}`,
			`latest eligible result recorded at=${latest.resultRecordedAt}`
		].join("; "),
		treatment: "RECONSTRUCTED",
		reason: null
	};
}
function isAuditDbCompositeMetric(metricCode) {
	const match = String(metricCode).match(/(\d{1,3})$/);
	const code = match ? match[1].padStart(3, "0") : String(metricCode).padStart(3, "0");
	return code === "037" || code === "039";
}
/** Pure adapter used by tests and by the live DB-loading wrapper below. */
function buildAuditDbCompositeMetricFinding(args) {
	const match = String(args.metricCode).match(/(\d{1,3})$/);
	const code = match ? match[1].padStart(3, "0") : String(args.metricCode).padStart(3, "0");
	if (!isAuditDbCompositeMetric(code)) return null;
	const p1History = playerScoredHistory(args.rows, args.p1, args.asOfDate);
	const p2History = playerScoredHistory(args.rows, args.p2, args.asOfDate);
	const p1 = code === "037" ? winAutopsySide(args.p1, p1History) : performanceSurpriseSide(args.p1, p1History);
	const p2 = code === "037" ? winAutopsySide(args.p2, p2History) : performanceSurpriseSide(args.p2, p2History);
	const reasons = [p1.reason, p2.reason].filter((reason) => Boolean(reason));
	return {
		metric_code: code,
		p1_value: p1.value,
		p2_value: p2.value,
		p1_treatment: p1.treatment,
		p2_treatment: p2.treatment,
		differential: null,
		evidence_family: code === "037" ? "AUDIT_DB_PLAYER_WIN_AUTOPSY" : "AUDIT_DB_PLAYER_PERFORMANCE_SURPRISE",
		reliability: 95,
		sample: `audit DB player history before ${args.asOfDate}; P1 n=${p1History.length}; P2 n=${p2History.length}`,
		unavailable_reason: reasons.length ? reasons.join(" | ") : null,
		missing_inputs: reasons.length ? ["minimum player-specific pre-result TennisMatrixAi-scored history"] : [],
		sources: [{
			source_name: AUDIT_DB_SOURCE,
			url: null,
			retrieved_at: null
		}]
	};
}
/** Loads the bounded audit-DB population and returns an owned 037/039 finding. */
async function auditDbCompositeMetric(args) {
	if (!isAuditDbCompositeMetric(args.metricCode)) return null;
	try {
		return buildAuditDbCompositeMetricFinding({
			...args,
			rows: await loadAuditDbScoredMatches()
		});
	} catch (error) {
		const match = String(args.metricCode).match(/(\d{1,3})$/);
		const code = match ? match[1].padStart(3, "0") : String(args.metricCode).padStart(3, "0");
		const message = error instanceof Error ? error.message : "Unknown audit DB retrieval failure.";
		return {
			metric_code: code,
			p1_value: null,
			p2_value: null,
			p1_treatment: "UNAVAILABLE",
			p2_treatment: "UNAVAILABLE",
			differential: null,
			evidence_family: code === "037" ? "AUDIT_DB_PLAYER_WIN_AUTOPSY" : "AUDIT_DB_PLAYER_PERFORMANCE_SURPRISE",
			reliability: null,
			sample: `audit DB player history before ${args.asOfDate}; retrieval incomplete`,
			unavailable_reason: message,
			provider_error: message,
			missing_inputs: ["complete paginated audit DB prediction history"],
			sources: [{
				source_name: AUDIT_DB_SOURCE,
				url: null,
				retrieved_at: null
			}]
		};
	}
}
var USABLE = /* @__PURE__ */ new Set([
	"DIRECT",
	"RECONSTRUCTED",
	"PARTIAL"
]);
var metricCallCache = new BoundedPromiseCache(256, 9e5);
var SOURCE_PACKET_BUDGET_MS = 7e3;
var LIVE_PROVIDER_BUDGET_MS = 12e3;
var researchWorkPool = new BoundedOperationPool(4);
function metricCallKey(input) {
	return JSON.stringify([
		input.p1,
		input.p2,
		input.context,
		input.dossier ?? "",
		input.researchSide ?? "",
		input.researchPlayer ?? "",
		input.researchOpponent ?? "",
		input.metrics.map((metric) => [
			metric.code,
			metric.name,
			metric.body
		])
	]);
}
function codeOf(value) {
	const m = String(value ?? "").match(/(\d{1,3})$/);
	return m ? m[1].padStart(3, "0") : String(value ?? "").padStart(3, "0");
}
/**
* The audited match's temporal boundary. Phase 14: prefer the TYPED `auditDate` the
* pipeline now passes (audit-pipeline.ts's executeMetrics, sourced directly from
* `matches.scheduled_date`) and fall back to parsing the rendered context only for callers
* that predate that field. A typed null and a parse miss are treated identically -- both
* mean "boundary not established", which returns "" and therefore admits nothing.
*/
function auditBoundary(input) {
	const typed = String(input.auditDate ?? "").trim();
	if (/^\d{4}-\d{2}-\d{2}$/.test(typed)) return typed;
	return asOfDate(input.context);
}
function asOfDate(context) {
	return auditCutoff(String(context ?? "")) ?? "";
}
function tournamentFromContext(context) {
	return String(context ?? "").match(/\btournament\s*:?[ ]*([^;·|\n]+)/i)?.[1]?.trim() || null;
}
function surfaceFromContext(context) {
	return String(context ?? "").match(/\bsurface\s*:?[ ]*([^;·|\n]+)/i)?.[1]?.trim() || null;
}
function ttlHours(code) {
	if ([
		"062",
		"064",
		"069",
		"071",
		"075",
		"076",
		"081"
	].includes(code)) return 12;
	if ([
		"012",
		"028",
		"077",
		"079"
	].includes(code)) return 24;
	if (["015", "019"].includes(code)) return 6;
	return 168;
}
function fullyUsableFinding(row) {
	return Boolean(row && USABLE.has(row.p1_treatment) && USABLE.has(row.p2_treatment) && row.p1_value && row.p2_value);
}
/**
* A concrete, upstream provider failure (a real HTTP status/error, e.g. "BSD/Bzzoiro API
* returned HTTP 402 ...") must survive to the persisted reason even though the live-AI
* tier's own guaranteed-non-null generic fallback text ("No sourced result survived the
* final metric wiring guard.") would otherwise always win mergeMetricFindingSides's
* `primary.unavailable_reason ?? fallback.unavailable_reason` precedence -- `live` is
* always `primary` there, and finalMetricWiringResearcher.metrics() never returns a row
* with a null reason, so a specific failure was always silently replaced by a vague one.
*
* Never applied when `chosen` already resolved to real, usable evidence on both sides --
* a genuine successful result is never relabeled as a failure.
*/
function applyProviderFailurePrecedence(chosen, providerFailureReason) {
	if (!providerFailureReason || fullyUsableFinding(chosen)) return chosen;
	return {
		...chosen,
		unavailable_reason: providerFailureReason
	};
}
function usableSide(row, side) {
	return Boolean(row && USABLE.has(row[`${side}_treatment`]) && row[`${side}_value`]);
}
function restoreRequestedOrientation(row, reversed) {
	if (!reversed) return row;
	const restored = { ...row };
	const original = row;
	for (const key of Object.keys(row)) {
		if (key.startsWith("p1_")) restored[key] = original[`p2_${key.slice(3)}`];
		if (key.startsWith("p2_")) restored[key] = original[`p1_${key.slice(3)}`];
	}
	return restored;
}
function mergeMetricFindingSides(primary, fallback) {
	if (!primary) return fallback;
	if (!fallback) return primary;
	const p1 = usableSide(primary, "p1") ? primary : fallback;
	const p2 = usableSide(primary, "p2") ? primary : fallback;
	const sources = [...primary.sources ?? [], ...fallback.sources ?? []].filter((source, index, rows) => rows.findIndex((other) => other.source_name === source.source_name && other.url === source.url) === index);
	const reliabilities = [primary.reliability, fallback.reliability].filter((value) => typeof value === "number");
	return {
		...fallback,
		...primary,
		p1_value: p1.p1_value,
		p1_treatment: p1.p1_treatment,
		p2_value: p2.p2_value,
		p2_treatment: p2.p2_treatment,
		evidence_family: p1.evidence_family ?? p2.evidence_family ?? primary.evidence_family ?? fallback.evidence_family,
		reliability: reliabilities.length ? Math.min(...reliabilities) : null,
		sources,
		unavailable_reason: primary.unavailable_reason ?? fallback.unavailable_reason ?? null,
		p1_unavailable_reason: primary.p1_unavailable_reason ?? fallback.p1_unavailable_reason ?? null,
		p2_unavailable_reason: primary.p2_unavailable_reason ?? fallback.p2_unavailable_reason ?? null,
		provider_error: primary.provider_error ?? fallback.provider_error ?? null
	};
}
function rowTime(row) {
	return Date.parse(row.updated_at ?? row.computed_at ?? `${row.as_of_date}T00:00:00Z`) || 0;
}
function sameCircuit(a, b) {
	return a.startsWith("ATP_") && b.startsWith("ATP_") || a.startsWith("WTA_") && b.startsWith("WTA_");
}
function storedFamily(row) {
	let sources = "";
	try {
		sources = JSON.stringify(row.sources ?? []);
	} catch {}
	return classifyEvidenceTourFamily(row.tournament, row.sample_label, row.evidence_family, sources);
}
function storedContextCompatible(row, args) {
	const expectedTournament = normalizeEvidenceTournament(args.tournament);
	const actualTournament = normalizeEvidenceTournament(row.tournament);
	if (expectedTournament && actualTournament && expectedTournament !== actualTournament) return false;
	if (args.surface && row.surface && args.surface.trim().toLowerCase() !== row.surface.trim().toLowerCase()) return false;
	if (!args.tourFamily) return true;
	const family = storedFamily(row);
	if (family) {
		if (row.evidence_family === "RANKING") return sameCircuit(args.tourFamily, family);
		return family === args.tourFamily;
	}
	return Boolean(expectedTournament && actualTournament && expectedTournament === actualTournament);
}
function unambiguousStoredRow(rows) {
	if (rows.length === 1) return rows[0];
	return new Set(rows.map((row) => JSON.stringify([
		row.treatment,
		row.value_text,
		row.evidence_family,
		row.unavailable_reason
	]))).size === 1 ? rows[0] : null;
}
async function lookup(metricCodes, player, opponent, date, context, tournament, surface) {
	if (!metricCodes.length) return /* @__PURE__ */ new Map();
	const tourFamily = classifyEvidenceTourFamily(context, tournament);
	const { data, error } = await tryQuery(() => db.select().from(metricEvidenceStoreTable).where(and(inArray(metricEvidenceStoreTable.metric_code, metricCodes), lte(metricEvidenceStoreTable.as_of_date, date))).orderBy(desc(metricEvidenceStoreTable.as_of_date)).limit(5e3));
	if (error) return /* @__PURE__ */ new Map();
	const byCode = /* @__PURE__ */ new Map();
	for (const row of data ?? []) {
		if (!evidencePairMatches(row.player_name, row.opponent_name, player, opponent)) continue;
		if (!storedContextCompatible(row, {
			tourFamily,
			tournament,
			surface
		})) continue;
		const code = codeOf(row.metric_code);
		byCode.set(code, [...byCode.get(code) ?? [], row]);
	}
	const out = /* @__PURE__ */ new Map();
	for (const [code, rows] of byCode) {
		const sorted = [...rows].sort((a, b) => b.as_of_date.localeCompare(a.as_of_date) || rowTime(b) - rowTime(a));
		if (!sorted.length) continue;
		const newestDate = sorted[0].as_of_date;
		const selected = unambiguousStoredRow(sorted.filter((row) => row.as_of_date === newestDate));
		if (selected) out.set(code, selected);
	}
	return out;
}
function sourcesOf(row) {
	return Array.isArray(row?.sources) ? row.sources : [];
}
async function saveSide(args) {
	const { code, name, player, opponent, date, treatment, value, reliability, sample, family, sources, unavailableReason, tournament, surface, tourFamily } = args;
	if (!USABLE.has(treatment) || !value) return;
	const validUntil = new Date(Date.now() + ttlHours(code) * 36e5).toISOString();
	const sourceIds = (sources ?? []).map((source) => source.source_name).filter(Boolean);
	const payload = {
		metric_code: code,
		metric_name: name,
		player_name: player,
		opponent_name: opponent,
		tournament,
		surface,
		as_of_date: date,
		treatment,
		value_text: value,
		reliability,
		sample_label: [sample, tourFamily ? `tour_family=${tourFamily}` : null].filter(Boolean).join(" | ") || null,
		evidence_family: family,
		source_ids: sourceIds,
		sources: sources ?? [],
		unavailable_reason: unavailableReason,
		valid_until: validUntil,
		updated_at: (/* @__PURE__ */ new Date()).toISOString()
	};
	const persisted = await tryQuery(() => db.execute(sql`select (public.upsert_metric_evidence_side(${JSON.stringify(payload)}::jsonb)).id as id`).then((result) => result.rows));
	const persistedId = persisted.data?.[0]?.id ?? null;
	if (persisted.error || !persistedId) throw new Error(`[metric_evidence_store] write failed for ${code} ${player} vs ${opponent} (${date}): ${persisted.error?.message ?? "persisted row was not returned"}`);
	const verification = await tryQuery(() => db.select({
		id: metricEvidenceStoreTable.id,
		treatment: metricEvidenceStoreTable.treatment,
		value_text: metricEvidenceStoreTable.value_text
	}).from(metricEvidenceStoreTable).where(eq(metricEvidenceStoreTable.id, persistedId)).limit(1));
	const verified = verification.data?.[0];
	if (verification.error || !verified || verified.treatment !== treatment || verified.value_text !== value) throw new Error(`[metric_evidence_store] verification failed for ${code} ${player} vs ${opponent} (${date}): ${verification.error?.message ?? "persisted row does not match the computed side"}`);
}
function observationIdentity(row) {
	const matchId = (row?.value ?? {})?.match_id ?? String(row?.url ?? "").match(/\/matches\/(\d+)\//)?.[1] ?? null;
	if (row?.family === "POINT_BY_POINT" && matchId) return `PBP|${row?.source ?? ""}|${matchId}`;
	return [
		row?.family,
		row?.source,
		row?.player,
		row?.opponent,
		row?.player1,
		row?.player2,
		row?.tournament,
		row?.event_date,
		row?.key
	].join("|");
}
function mergeObservationPackets(base, extra) {
	const merged = { ...base };
	for (const [code, value] of Object.entries(extra)) {
		const a = merged[code] ?? {};
		const b = value ?? {};
		const seen = /* @__PURE__ */ new Set();
		const observations = [...Array.isArray(a.observations) ? a.observations : [], ...Array.isArray(b.observations) ? b.observations : []].filter((row) => {
			const key = observationIdentity(row);
			if (seen.has(key)) return false;
			seen.add(key);
			return true;
		});
		const observedFamilies = [.../* @__PURE__ */ new Set([...Array.isArray(a.observed_families) ? a.observed_families : [], ...Array.isArray(b.observed_families) ? b.observed_families : []])];
		merged[code] = {
			...a,
			...b,
			observations,
			observed_families: observedFamilies,
			direct_satisfaction_allowed: Boolean(a.direct_satisfaction_allowed || b.direct_satisfaction_allowed)
		};
	}
	return merged;
}
var warehouseFirstResearcher = {
	...finalMetricWiringResearcher,
	async metrics(input) {
		return metricCallCache.getOrCreate(metricCallKey(input), async () => {
			const reversedOrientation = input.researchSide === "p2";
			const requestedP1 = reversedOrientation ? input.researchPlayer ?? input.p2 : input.p1;
			const requestedP2 = reversedOrientation ? input.researchOpponent ?? input.p1 : input.p2;
			const callStartedAt = Date.now();
			const identityFallback = (name) => ({
				input: name,
				canonical: name,
				status: "QUERY_FAILED",
				candidates: [],
				query_errors: ["Canonical identity lookup exceeded its time budget."]
			});
			const identities = await researchWorkPool.runWithBudget("canonical-identity", SOURCE_PACKET_BUDGET_MS, () => resolveCanonicalEvidencePair(requestedP1, requestedP2), () => ({
				p1: identityFallback(requestedP1),
				p2: identityFallback(requestedP2)
			}));
			console.log(`[research-timing] canonical identity ${Date.now() - callStartedAt}ms`);
			input = {
				...input,
				p1: identities.p1.canonical,
				p2: identities.p2.canonical
			};
			const { p1, p2, metrics } = input;
			const date = auditBoundary({
				auditDate: input.auditDate,
				context: input.context
			});
			const tournament = tournamentFromContext(input.context);
			const surface = surfaceFromContext(input.context);
			const tourFamily = classifyEvidenceTourFamily(input.context, tournament);
			const codes = metrics.map((metric) => codeOf(metric.code));
			const [p1Stored, p2Stored] = await researchWorkPool.runWithBudget("stored-evidence", SOURCE_PACKET_BUDGET_MS, () => Promise.all([lookup(codes, p1, p2, date, input.context, tournament, surface), lookup(codes, p2, p1, date, input.context, tournament, surface)]), () => [/* @__PURE__ */ new Map(), /* @__PURE__ */ new Map()]);
			console.log(`[research-timing] stored evidence ${Date.now() - callStartedAt}ms`);
			const missing = metrics.filter((metric) => {
				const code = codeOf(metric.code), a = p1Stored.get(code), b = p2Stored.get(code);
				if (isAuditDbCompositeMetric(code)) return true;
				return !a || !b || !USABLE.has(a.treatment) || !USABLE.has(b.treatment) || !a.value_text || !b.value_text;
			});
			const deterministicRows = (await researchWorkPool.runWithBudget("deterministic-metrics", SOURCE_PACKET_BUDGET_MS, () => Promise.all(missing.map(async (metric) => {
				const auditDb = await auditDbCompositeMetric({
					metricCode: metric.code,
					p1,
					p2,
					asOfDate: date
				});
				if (auditDb) return auditDb;
				const ranking = await deterministicRankingMetric({
					metricCode: metric.code,
					p1,
					p2,
					asOfDate: date,
					context: input.context
				});
				if (ranking) return ranking;
				const rules = await deterministicRulesContextMetric({
					metricCode: metric.code,
					p1,
					p2,
					asOfDate: date,
					context: input.context
				});
				if (rules) return rules;
				const environment = await deterministicEnvironmentMetric({
					metricCode: metric.code,
					p1,
					p2,
					asOfDate: date,
					tournament
				});
				if (environment) return environment;
				const batch4 = await deterministicBatch4FavoriteUnderdogPatterns({
					metricCode: metric.code,
					p1,
					p2,
					asOfDate: date,
					tourFamily,
					surface
				});
				if (batch4) return batch4;
				const batch5 = await deterministicBatch5NewMetrics({
					metricCode: metric.code,
					p1,
					p2,
					asOfDate: date,
					tourFamily,
					surface
				});
				if (batch5) return batch5;
				const market = await deterministicMarketMetric({
					metricCode: metric.code,
					p1,
					p2,
					asOfDate: date,
					tournament,
					context: input.context
				});
				if (market) return market;
				const resultsSchedule = await deterministicResultsScheduleMetric({
					metricCode: metric.code,
					p1,
					p2,
					asOfDate: date,
					tournament,
					eventLevel: null,
					tourFamily,
					context: input.context
				});
				if (resultsSchedule) return resultsSchedule;
				const batch1 = await deterministicBatch1StandaloneMetric({
					metricCode: metric.code,
					p1,
					p2,
					asOfDate: date,
					tourFamily
				});
				if (batch1) return batch1;
				const batch2 = await deterministicBatch2NewMetric({
					metricCode: metric.code,
					p1,
					p2,
					asOfDate: date,
					tourFamily
				});
				if (batch2) return batch2;
				return deterministicBatch6ResidualStakes({
					metricCode: metric.code,
					p1,
					p2,
					asOfDate: date,
					tourFamily
				});
			})), () => [])).filter((row) => Boolean(row));
			console.log(`[research-timing] deterministic tier ${Date.now() - callStartedAt}ms`);
			const deterministicByCode = new Map(deterministicRows.map((row) => [codeOf(row.metric_code), row]));
			const pbpProviderFailureByCode = /* @__PURE__ */ new Map();
			const liveMissing = missing.filter((metric) => {
				const code = codeOf(metric.code);
				return !isAuditDbCompositeMetric(code) && !fullyUsableFinding(deterministicByCode.get(code));
			});
			let liveRows = [];
			if (liveMissing.length) {
				const sourceFallback = {
					packet: {},
					status: { outcome: "SOURCE_TIMEOUT" }
				};
				const [warehouseResult, liveTennisApiResult] = await researchWorkPool.runWithBudget("source-packets", SOURCE_PACKET_BUDGET_MS, () => Promise.all([buildMetricObservationContext({
					metrics: liveMissing,
					p1,
					p2,
					asOfDate: date,
					context: input.context
				}), buildLiveTennisApiPbpContext({
					metrics: liveMissing,
					p1,
					p2,
					asOfDate: date,
					context: input.context
				})]), () => [{}, sourceFallback]);
				console.log(`[research-timing] source packets ${Date.now() - callStartedAt}ms`);
				const unavailablePbp = sourceFallback;
				const warehousePacket = warehouseResult ?? {};
				const liveTennisApiPbp = liveTennisApiResult ?? unavailablePbp;
				const observationPacket = mergeObservationPackets(warehousePacket, liveTennisApiPbp.packet);
				for (const metric of liveMissing) {
					const code = codeOf(metric.code);
					if (code === "026") {
						const earlyWarning = await deterministicBatch3EarlyWarningMetric({
							metricCode: code,
							p1,
							p2,
							asOfDate: date,
							tourFamily
						});
						if (fullyUsableFinding(earlyWarning ?? void 0)) deterministicByCode.set(code, earlyWarning);
						continue;
					}
					if (code === "040") {
						const hiddenDecline = await deterministicBatch6HiddenDecline({
							metricCode: code,
							p1,
							p2,
							asOfDate: date,
							tourFamily
						});
						if (fullyUsableFinding(hiddenDecline ?? void 0)) deterministicByCode.set(code, hiddenDecline);
						continue;
					}
					const recovered = deterministicPbpMetricFromPacket({
						metricCode: code,
						p1,
						p2,
						asOfDate: date,
						packet: observationPacket
					});
					if (recovered) deterministicByCode.set(code, recovered);
					else if (TASK18B_METRIC_CODES.has(code)) {
						const failedLane = [liveTennisApiPbp.status].filter((s) => Boolean(s) && typeof s.fetch_failures === "number").find((s) => s.fetch_failures > 0);
						if (failedLane) {
							const reason = `${failedLane.source}: ${failedLane.fetch_failure_sample} (${failedLane.fetch_failures} candidate match(es) affected).`;
							deterministicByCode.set(code, {
								metric_code: code,
								p1_value: null,
								p2_value: null,
								p1_treatment: "UNAVAILABLE",
								p2_treatment: "UNAVAILABLE",
								differential: null,
								evidence_family: "POINT_BY_POINT",
								reliability: null,
								sample: null,
								unavailable_reason: reason,
								sources: []
							});
							pbpProviderFailureByCode.set(code, reason);
						}
					}
				}
				for (const [code, row] of deterministicByCode) observationPacket[code] = {
					...observationPacket[code] ?? {},
					deterministic_components: {
						p1_value: row.p1_value,
						p2_value: row.p2_value,
						treatment: row.p1_treatment,
						evidence_family: row.evidence_family,
						sample: row.sample
					}
				};
				const beforeStaticWarehouse = liveMissing.filter((metric) => !fullyUsableFinding(deterministicByCode.get(codeOf(metric.code))));
				if (beforeStaticWarehouse.length) {
					const localRows = localMetricRows(p1, p2, input.context ?? "", beforeStaticWarehouse).map(certifyMetricFinding);
					const localByCode = new Map(localRows.map((row) => [codeOf(row.metric_code), row]));
					let wtaRows = [];
					try {
						wtaRows = await researchWorkPool.runWithBudget("official-wta", SOURCE_PACKET_BUDGET_MS, () => officialWtaMetricRows({
							p1,
							p2,
							context: input.context ?? "",
							metrics: beforeStaticWarehouse
						}), () => []) ?? [];
					} catch {}
					const wtaByCode = new Map(wtaRows.map((row) => [codeOf(row.metric_code), certifyMetricFinding(row)]));
					for (const metric of beforeStaticWarehouse) {
						const code = codeOf(metric.code);
						const wta = wtaByCode.get(code), local = localByCode.get(code);
						const chosen = fullyUsableFinding(wta) ? wta : fullyUsableFinding(local) ? local : null;
						if (chosen) deterministicByCode.set(code, chosen);
					}
					for (const [code, row] of deterministicByCode) observationPacket[code] = {
						...observationPacket[code] ?? {},
						deterministic_components: {
							p1_value: row.p1_value,
							p2_value: row.p2_value,
							treatment: row.p1_treatment,
							evidence_family: row.evidence_family,
							sample: row.sample
						}
					};
				}
				const remainingLiveMissing = liveMissing.filter((metric) => !fullyUsableFinding(deterministicByCode.get(codeOf(metric.code))));
				if (remainingLiveMissing.length) {
					const identityResolution = {
						p1: identities.p1,
						p2: identities.p2
					};
					const context = appendMetricObservationContext(input.context, {
						...observationPacket,
						_canonical_identity_resolution: identityResolution,
						_live_tennis_api_pbp_status: liveTennisApiPbp.status
					});
					liveRows = await researchWorkPool.runWithBudget("live-provider", LIVE_PROVIDER_BUDGET_MS, () => finalMetricWiringResearcher.metrics({
						...input,
						context,
						metrics: remainingLiveMissing
					}), () => []);
					console.log(`[research-timing] live provider ${Date.now() - callStartedAt}ms`);
				}
			}
			const liveByCode = new Map(liveRows.map((row) => [codeOf(row.metric_code), row]));
			const output = [];
			for (const metric of metrics) {
				const code = codeOf(metric.code), auditDbOwned = isAuditDbCompositeMetric(code);
				const a = auditDbOwned ? void 0 : p1Stored.get(code), b = auditDbOwned ? void 0 : p2Stored.get(code), live = liveByCode.get(code), deterministic = deterministicByCode.get(code);
				if (a && b && USABLE.has(a.treatment) && USABLE.has(b.treatment) && a.value_text && b.value_text) {
					const mergedSources = [...sourcesOf(a), ...sourcesOf(b)].filter((source, index, rows) => rows.findIndex((other) => other.source_name === source.source_name && other.url === source.url) === index);
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
						sources: mergedSources
					});
					continue;
				}
				const merged = mergeMetricFindingSides({
					metric_code: code,
					p1_value: a?.value_text ?? null,
					p2_value: b?.value_text ?? null,
					p1_treatment: a?.treatment ?? "UNAVAILABLE",
					p2_treatment: b?.treatment ?? "UNAVAILABLE",
					differential: null,
					evidence_family: a?.evidence_family ?? b?.evidence_family ?? null,
					reliability: Math.min(a?.reliability ?? 100, b?.reliability ?? 100),
					sample: [a?.sample_label, b?.sample_label].filter(Boolean).join(" | ") || null,
					unavailable_reason: null,
					sources: [...sourcesOf(a), ...sourcesOf(b)]
				}, mergeMetricFindingSides(live, deterministic));
				if (!merged) continue;
				const chosen = applyProviderFailurePrecedence(merged, pbpProviderFailureByCode.get(code));
				output.push(chosen);
				await Promise.all([saveSide({
					code,
					name: metric.name,
					player: p1,
					opponent: p2,
					date,
					treatment: chosen.p1_treatment,
					value: chosen.p1_value,
					reliability: chosen.reliability,
					sample: chosen.sample,
					family: chosen.evidence_family,
					sources: chosen.sources ?? [],
					unavailableReason: chosen.unavailable_reason,
					tournament,
					surface,
					tourFamily
				}), saveSide({
					code,
					name: metric.name,
					player: p2,
					opponent: p1,
					date,
					treatment: chosen.p2_treatment,
					value: chosen.p2_value,
					reliability: chosen.reliability,
					sample: chosen.sample,
					family: chosen.evidence_family,
					sources: chosen.sources ?? [],
					unavailableReason: chosen.unavailable_reason,
					tournament,
					surface,
					tourFamily
				})]);
			}
			return output.map((row) => restoreRequestedOrientation(row, reversedOrientation));
		});
	}
};
var OWNER = LOCAL_WORKSPACE_ID;
async function ownerId() {
	return OWNER;
}
var row = (value) => value;
var rows = (value) => value;
/**
* Calls one of the database's lease/slate functions and returns its single scalar result.
* These were PostgREST /rpc/ calls; over a direct connection they are ordinary SELECTs.
*/
async function callScalar(fn) {
	return (await db.execute(fn)).rows[0]?.["result"];
}
async function makeDeps() {
	const user_id = await ownerId();
	return {
		now: () => /* @__PURE__ */ new Date(),
		research: warehouseFirstResearcher,
		async getMatch(matchId) {
			const [match] = await db.select().from(matchesTable).where(eq(matchesTable.id, matchId)).limit(1);
			return match ?? null;
		},
		async updateMatch(matchId, patch) {
			await dbCall("update", "matches", () => db.update(matchesTable).set(row(patch)).where(eq(matchesTable.id, matchId)));
		},
		async getParsedFields(matchId) {
			const [version] = await db.select({ id: summaryVersionsTable.id }).from(summaryVersionsTable).where(and(eq(summaryVersionsTable.match_id, matchId), eq(summaryVersionsTable.is_active, true))).limit(1);
			if (!version) return {};
			const fields = await db.select({
				field_key: parsedSummaryFieldsTable.field_key,
				normalized_value: parsedSummaryFieldsTable.normalized_value,
				raw_value: parsedSummaryFieldsTable.raw_value
			}).from(parsedSummaryFieldsTable).where(eq(parsedSummaryFieldsTable.summary_version_id, version.id));
			const out = {};
			for (const field of fields) {
				const v = field.normalized_value ?? field.raw_value;
				if (v) out[field.field_key] = v;
			}
			return out;
		},
		async getActiveVersionId(docType) {
			const [document] = await db.select({ active_version_id: ruleDocumentsTable.active_version_id }).from(ruleDocumentsTable).where(eq(ruleDocumentsTable.doc_type, docType)).limit(1);
			return document?.active_version_id ?? null;
		},
		async getRules(versionId) {
			return await db.select({
				id: rulesTable.id,
				rule_code: rulesTable.rule_code,
				rule_name: rulesTable.rule_name,
				body: rulesTable.body,
				severity: rulesTable.severity,
				blocking: rulesTable.blocking
			}).from(rulesTable).where(eq(rulesTable.version_id, versionId)).orderBy(rulesTable.rule_code);
		},
		async getLatestRun(matchId) {
			const [run] = await db.select().from(auditRunsTable).where(eq(auditRunsTable.match_id, matchId)).orderBy(desc(auditRunsTable.run_number)).limit(1);
			return run ?? null;
		},
		async createRun(newRun) {
			const [created] = await dbCall("insert", "audit_runs", () => db.insert(auditRunsTable).values(row({
				...newRun,
				user_id
			})).returning());
			if (!created) throw new Error("Could not create audit run: the insert returned no row.");
			return created;
		},
		async updateRun(runId, patch) {
			await dbCall("update", "audit_runs", () => db.update(auditRunsTable).set(row(patch)).where(eq(auditRunsTable.id, runId)));
		},
		async acquireRunLease(runId, owner, leaseMs) {
			const seconds = Math.ceil(leaseMs / 1e3);
			return await dbCall("write", "audit_runs", () => callScalar(sql`select public.claim_audit_run(${runId}::uuid, ${owner}::text, ${seconds}::int) as result`)) === true;
		},
		async renewRunLease(runId, owner, leaseMs) {
			const seconds = Math.ceil(leaseMs / 1e3);
			return await dbCall("write", "audit_runs", () => callScalar(sql`select public.renew_audit_run_lease(${runId}::uuid, ${owner}::text, ${seconds}::int) as result`)) === true;
		},
		async releaseRunLease(runId, owner) {
			await dbCall("write", "audit_runs", () => callScalar(sql`select public.release_audit_run_lease(${runId}::uuid, ${owner}::text) as result`));
		},
		async list(table, runId) {
			const target = tableByName(table);
			return await dbCall("read", table, async () => await db.select().from(target).where(eq(target.audit_run_id, runId)));
		},
		async insert(table, newRows) {
			const target = tableByName(table);
			for (let i = 0; i < newRows.length; i += 200) {
				const batch = newRows.slice(i, i + 200).map((r) => ({
					...r,
					user_id
				}));
				await dbCall("insert", table, () => db.insert(target).values(rows(batch)));
			}
		},
		async update(table, id, patch) {
			const target = tableByName(table);
			await dbCall("update", table, () => db.update(target).set(row(patch)).where(eq(target.id, id)));
		},
		async getStages(runId) {
			return await dbCall("read", "audit_stage_runs", async () => await db.select({
				stage: auditStageRunsTable.stage,
				status: auditStageRunsTable.status,
				attempts: auditStageRunsTable.attempts,
				error_message: auditStageRunsTable.error_message,
				done_count: auditStageRunsTable.done_count,
				total_count: auditStageRunsTable.total_count,
				heartbeat_at: auditStageRunsTable.heartbeat_at,
				started_at: auditStageRunsTable.started_at,
				finished_at: auditStageRunsTable.finished_at
			}).from(auditStageRunsTable).where(eq(auditStageRunsTable.audit_run_id, runId)));
		},
		async setStage(runId, matchId, stage, patch) {
			const heartbeat_at = patch["heartbeat_at"] ?? (/* @__PURE__ */ new Date()).toISOString();
			const values = {
				audit_run_id: runId,
				match_id: matchId,
				stage,
				stage_order: STAGES.indexOf(stage),
				user_id,
				heartbeat_at,
				...patch
			};
			await dbCall("write", "audit_stage_runs", () => db.insert(auditStageRunsTable).values(row(values)).onConflictDoUpdate({
				target: [auditStageRunsTable.audit_run_id, auditStageRunsTable.stage],
				set: excludedSet(auditStageRunsTable, [values], ["audit_run_id", "stage"])
			}));
		},
		async saveIdentityRecords(matchId, newRows) {
			const fields = newRows.map((r) => String(r["field"]));
			if (fields.length) await db.delete(matchIdentityRecordsTable).where(and(eq(matchIdentityRecordsTable.match_id, matchId), inArray(matchIdentityRecordsTable.field, fields)));
			if (!newRows.length) return;
			await db.insert(matchIdentityRecordsTable).values(rows(newRows.map((r) => ({
				...r,
				match_id: matchId,
				user_id
			}))));
		},
		async saveSnapshots(runId, newRows) {
			if (!newRows.length) return;
			await db.insert(sourceSnapshotsTable).values(rows(newRows.map((r) => ({
				...r,
				audit_run_id: runId,
				user_id
			}))));
		},
		async saveConflicts(runId, newRows) {
			if (!newRows.length) return;
			await db.insert(sourceConflictsTable).values(rows(newRows.map((r) => ({
				...r,
				audit_run_id: runId,
				user_id
			}))));
		},
		async getCalibration(versionId) {
			const columns = {
				id: calibrationVersionsTable.id,
				label: calibrationVersionsTable.label,
				version_number: calibrationVersionsTable.version_number
			};
			const [version] = versionId ? await dbCall("read", "calibration_versions", () => db.select(columns).from(calibrationVersionsTable).where(eq(calibrationVersionsTable.id, versionId)).limit(1)) : await dbCall("read", "calibration_versions", () => db.select(columns).from(calibrationVersionsTable).where(eq(calibrationVersionsTable.is_active, true)).orderBy(desc(calibrationVersionsTable.version_number)).limit(1));
			if (!version) return {
				version: null,
				buckets: []
			};
			return {
				version,
				buckets: await dbCall("read", "calibration_buckets", () => db.select({
					bucket_code: calibrationBucketsTable.bucket_code,
					wp_min: calibrationBucketsTable.wp_min,
					wp_max: calibrationBucketsTable.wp_max,
					wins: calibrationBucketsTable.wins,
					graded: calibrationBucketsTable.graded
				}).from(calibrationBucketsTable).where(eq(calibrationBucketsTable.calibration_version_id, version.id)).orderBy(calibrationBucketsTable.wp_min))
			};
		},
		async getDecisionId(runId) {
			const [decision] = await db.select({ id: finalDecisionsTable.id }).from(finalDecisionsTable).where(eq(finalDecisionsTable.audit_run_id, runId)).limit(1);
			return decision?.id ?? null;
		},
		async saveDecision(runId, existingId, payload) {
			const extras = {
				final_recommendation: payload["final_recommendation"] ?? null,
				independent_winner: payload["independent_winner"] ?? null,
				independent_range: payload["independent_range"] ?? null,
				calibrated_range: payload["calibrated_range"] ?? null,
				calibration_version_id: payload["calibration_version_id"] ?? null,
				calibration_wins: payload["calibration_wins"] ?? null,
				calibration_graded: payload["calibration_graded"] ?? null,
				green_locked: payload["green_locked"] ?? null,
				green_lock_reasons: payload["green_lock_reasons"] ?? []
			};
			const persisted = {
				audit_run_id: runId,
				final_audit_color: payload["final_audit_color"] ?? null,
				final_selection: payload["final_selection"] ?? payload["final_recommendation"] ?? null,
				selected_player_id: payload["selected_player_id"] ?? null,
				action: payload["action"] ?? payload["final_recommendation"] ?? null,
				gate_report: {
					...extras,
					...payload["gate_report"] && typeof payload["gate_report"] === "object" ? payload["gate_report"] : {}
				},
				completion_percent: payload["completion_percent"] ?? 0,
				audit_complete: payload["audit_complete"] ?? true,
				matrix_firewall_valid: payload["matrix_firewall_valid"] ?? false,
				calibration_bucket: payload["calibration_bucket"] ?? null,
				verified_win_rate: payload["verified_win_rate"] ?? null
			};
			if (existingId) await dbCall("update", "final_decisions", () => db.update(finalDecisionsTable).set(row(persisted)).where(eq(finalDecisionsTable.id, existingId)));
			else await dbCall("insert", "final_decisions", () => db.insert(finalDecisionsTable).values(row({
				...persisted,
				user_id
			})));
		},
		async getConflicts(runId) {
			return await db.select({
				critical: sourceConflictsTable.critical,
				resolution_status: sourceConflictsTable.resolution_status
			}).from(sourceConflictsTable).where(eq(sourceConflictsTable.audit_run_id, runId));
		},
		async getReconstructions(runId) {
			return await db.select({ status: reconstructionResultsTable.status }).from(reconstructionResultsTable).where(eq(reconstructionResultsTable.audit_run_id, runId));
		},
		async saveCoverage(runId, newRows) {
			const mapped = newRows.map((r) => ({
				audit_run_id: r["audit_run_id"] ?? runId,
				player_side: r["player_side"],
				direct_count: r["direct_count"] ?? r["direct"] ?? 0,
				reconstructed_count: r["reconstructed_count"] ?? r["reconstructed"] ?? 0,
				partial_count: r["partial_count"] ?? r["partial"] ?? 0,
				unavailable_count: r["unavailable_count"] ?? r["unavailable"] ?? 0,
				excluded_count: r["excluded_count"] ?? r["excluded"] ?? 0,
				total_count: r["total_count"] ?? r["total"] ?? 0,
				usable_coverage_percent: r["usable_coverage_percent"] ?? r["usablePercent"] ?? 0,
				execution_completion_percent: r["execution_completion_percent"] ?? r["executionPercent"] ?? 0,
				recorded_at: r["recorded_at"] ?? (/* @__PURE__ */ new Date()).toISOString(),
				user_id
			}));
			if (!mapped.length) return;
			await dbCall("write", "audit_coverage", () => db.insert(auditCoverageTable).values(rows(mapped)).onConflictDoUpdate({
				target: [auditCoverageTable.audit_run_id, auditCoverageTable.player_side],
				set: excludedSet(auditCoverageTable, mapped, ["audit_run_id", "player_side"])
			}));
		},
		async saveCoverageRates(runId, newRows) {
			let sourceRows = newRows.filter((r) => typeof r["metric_code"] === "string" && String(r["metric_code"]).trim() !== "");
			if (!sourceRows.length) {
				const metrics = await dbCall("read", "metric_results coverage", () => db.select({
					metric_code: metricResultsTable.metric_code,
					metric_name: metricResultsTable.metric_name,
					p1_treatment: metricResultsTable.p1_treatment,
					p2_treatment: metricResultsTable.p2_treatment
				}).from(metricResultsTable).where(eq(metricResultsTable.audit_run_id, runId)));
				const usable = (t) => [
					"DIRECT",
					"RECONSTRUCTED",
					"PARTIAL"
				].includes(String(t ?? ""));
				sourceRows = metrics.flatMap((metric) => {
					const code = String(metric.metric_code ?? "").trim();
					if (!code) return [];
					return [{
						metric_code: code,
						metric_name: metric.metric_name ?? code,
						player_side: "P1",
						treatment: metric.p1_treatment ?? "UNAVAILABLE",
						usable: usable(metric.p1_treatment)
					}, {
						metric_code: code,
						metric_name: metric.metric_name ?? code,
						player_side: "P2",
						treatment: metric.p2_treatment ?? "UNAVAILABLE",
						usable: usable(metric.p2_treatment)
					}];
				});
			}
			if (!sourceRows.length) return;
			const registryRows = [...new Map(sourceRows.map((r) => [String(r["metric_code"]), {
				metric_code: String(r["metric_code"]),
				metric_name: String(r["metric_name"] ?? r["metric_code"]),
				lifecycle_status: "ACTIVE",
				tour_eligibility: []
			}])).values()];
			await dbCall("write", "metric_registry", () => db.insert(metricRegistryTable).values(rows(registryRows)).onConflictDoUpdate({
				target: [metricRegistryTable.metric_code],
				set: excludedSet(metricRegistryTable, registryRows, ["metric_code"])
			}));
			const now = (/* @__PURE__ */ new Date()).toISOString();
			const coverageRows = sourceRows.map((r) => ({
				metric_code: String(r["metric_code"]),
				player_side: r["player_side"],
				treatment: r["treatment"] ?? "UNAVAILABLE",
				usable: Boolean(r["usable"]),
				recorded_at: r["recorded_at"] ?? now,
				audit_run_id: runId,
				user_id
			}));
			await dbCall("write", "metric_coverage_rates", () => db.insert(metricCoverageRatesTable).values(rows(coverageRows)).onConflictDoUpdate({
				target: [
					metricCoverageRatesTable.metric_code,
					metricCoverageRatesTable.player_side,
					metricCoverageRatesTable.audit_run_id
				],
				set: excludedSet(metricCoverageRatesTable, coverageRows, [
					"metric_code",
					"player_side",
					"audit_run_id"
				])
			}));
		},
		async verifyFinalPersistence(runId, expectedMetricSides, expectedAuditComplete) {
			const [coverage, rates, decisions] = await Promise.all([
				dbCall("read", "audit_coverage", () => db.select({
					player_side: auditCoverageTable.player_side,
					total_count: auditCoverageTable.total_count,
					usable_coverage_percent: auditCoverageTable.usable_coverage_percent
				}).from(auditCoverageTable).where(eq(auditCoverageTable.audit_run_id, runId))).catch(failInvariant("audit_coverage")),
				dbCall("read", "metric_coverage_rates", () => db.select({
					metric_code: metricCoverageRatesTable.metric_code,
					player_side: metricCoverageRatesTable.player_side,
					treatment: metricCoverageRatesTable.treatment,
					usable: metricCoverageRatesTable.usable
				}).from(metricCoverageRatesTable).where(eq(metricCoverageRatesTable.audit_run_id, runId))).catch(failInvariant("metric_coverage_rates")),
				dbCall("read", "final_decisions", () => db.select({
					id: finalDecisionsTable.id,
					audit_complete: finalDecisionsTable.audit_complete,
					completion_percent: finalDecisionsTable.completion_percent
				}).from(finalDecisionsTable).where(eq(finalDecisionsTable.audit_run_id, runId)).limit(1)).catch(failInvariant("final_decisions"))
			]);
			const decision = decisions[0];
			if (!decision) throw new Error("Final persistence invariant failed (final_decisions): missing row");
			if (coverage.length !== 2) throw new Error(`Final persistence invariant failed: expected 2 audit coverage rows, found ${coverage.length}.`);
			if (rates.length !== expectedMetricSides) throw new Error(`Final persistence invariant failed: expected ${expectedMetricSides} metric coverage rows, found ${rates.length}.`);
			if (Boolean(decision.audit_complete) !== expectedAuditComplete) throw new Error("Final persistence invariant failed: decision completion flag does not match the deterministic gate.");
		},
		async log(entry) {
			await db.insert(executionLogsTable).values(row({
				user_id,
				audit_run_id: entry["audit_run_id"] ?? null,
				match_id: entry["match_id"] ?? null,
				stage: String(entry["stage"]),
				status: String(entry["status"]),
				output: entry["output"] ?? null,
				matrix_visible: Boolean(entry["matrix_visible"])
			}));
		}
	};
}
/** A read failure inside verifyFinalPersistence is an invariant failure, not a plain read error. */
function failInvariant(table) {
	return (error) => {
		const message = error instanceof Error ? error.message : String(error);
		throw new Error(`Final persistence invariant failed (${table}): ${message}`);
	};
}
//#endregion
export { makeDeps };
