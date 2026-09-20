import { o as __toESM } from "../_runtime.mjs";
import { o as require_jsx_runtime, s as require_react } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { _ as useNavigate } from "../_libs/@tanstack/react-router+[...].mjs";
import { i as createServerFn } from "./server-KPZuT5q2.mjs";
import { t as createSsrRpc } from "./createSsrRpc-DDIv2aCY.mjs";
import { runAuditBatch } from "./audit-pipeline.functions-Cf84gMgb.mjs";
import { t as Button } from "./button-DRsC1qZi.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { t as Input } from "./input-DicJzR9-.mjs";
import { t as useServerFn } from "./useServerFn-CrZF2pjq.mjs";
import { n as isRecoverablePipelineTransportError } from "./pipeline-client-error-F6VIyWJR.mjs";
import { r as parseSummaryText } from "./summary-parser-DFGrtQjO.mjs";
import { r as computeBatchExecutionPercent, t as ProgressBar } from "./ProgressBar-DxeGWXJM.mjs";
import { o as setResolvedField, r as dedupeMatchups, t as REVIEW_FIELDS } from "./upload-matchup-DXRU6OrM.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/upload-D25Xzgoy.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var extractPdfTextServer = createServerFn({ method: "POST" }).inputValidator((data) => {
	if (!data?.base64) throw new Error("No PDF data supplied");
	return data;
}).handler(createSsrRpc("0e78f44ee97c175bc2607982f9b2cb74789979c60847b7fe8cb6af88c3f51a44"));
var extractMatchupsFromPdf = createServerFn({ method: "POST" }).inputValidator((data) => {
	if (!data?.base64) throw new Error("No PDF data supplied");
	return data;
}).handler(createSsrRpc("e097e9de89c83225675e02d77e592e01e116bdf340f69b9ac122fbe0f1e61a01"));
/**
* Read an uploaded File without depending on File.arrayBuffer().
* Some iOS/WebKit upload objects expose File/Blob but do not implement
* arrayBuffer(). This is still used by the local OCR fallback.
*/
function readPdfFileBytes(file) {
	if (typeof file.arrayBuffer === "function") return file.arrayBuffer().then((buf) => new Uint8Array(buf));
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onerror = () => reject(reader.error ?? /* @__PURE__ */ new Error("Could not read uploaded PDF bytes"));
		reader.onload = () => {
			if (!(reader.result instanceof ArrayBuffer)) {
				reject(/* @__PURE__ */ new Error("Uploaded PDF did not produce binary data"));
				return;
			}
			resolve(new Uint8Array(reader.result));
		};
		reader.readAsArrayBuffer(file);
	});
}
/**
* Safari-safe Base64 conversion. Use FileReader's native Data URL path rather
* than rebuilding a binary string with String.fromCharCode(...)/btoa.
*/
function readPdfFileBase64(file) {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onerror = () => reject(reader.error ?? /* @__PURE__ */ new Error("Could not read uploaded PDF as Base64"));
		reader.onload = () => {
			const result = reader.result;
			if (typeof result !== "string") {
				reject(/* @__PURE__ */ new Error("Uploaded PDF did not produce a Data URL"));
				return;
			}
			const comma = result.indexOf(",");
			if (comma < 0 || comma === result.length - 1) {
				reject(/* @__PURE__ */ new Error("Uploaded PDF produced an invalid Data URL"));
				return;
			}
			resolve(result.slice(comma + 1));
		};
		reader.readAsDataURL(file);
	});
}
async function extractPdfTextLocally(file) {
	const pdfjs = await import("../_libs/pdfjs-dist.mjs").then((n) => n.n);
	const workerSrc = (await import("./pdf.worker.min-C1z__b6c.mjs")).default;
	if (workerSrc) pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
	const bytes = await readPdfFileBytes(file);
	const doc = await pdfjs.getDocument({ data: bytes }).promise;
	const pages = [];
	for (let i = 1; i <= doc.numPages; i++) {
		const items = (await (await doc.getPage(i)).getTextContent()).items;
		let lastY = null;
		let line = "";
		const lines = [];
		for (const item of items) {
			const y = item.transform?.[5] ?? null;
			if (lastY !== null && y !== null && Math.abs(y - lastY) > 2) {
				if (line.trim()) lines.push(line.trim());
				line = "";
			}
			line += `${item.str ?? ""} `;
			lastY = y;
		}
		if (line.trim()) lines.push(line.trim());
		pages.push(lines.join("\n"));
	}
	return {
		pages,
		text: pages.join("\n\f\n")
	};
}
/**
* Prefer the free browser-side PDF.js path. It uses the same legacy build and
* worker already proven by local OCR, so image-only PDFs can cleanly return
* empty text and fall through to OCR without an unnecessary server-function
* upload. The server path remains a compatibility fallback for browsers where
* local PDF.js cannot open the document.
*/
async function extractPdfText(file) {
	let localError = null;
	try {
		return await extractPdfTextLocally(file);
	} catch (error) {
		localError = error;
	}
	let base64;
	try {
		base64 = await readPdfFileBase64(file);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		const localMessage = localError instanceof Error ? localError.message : String(localError ?? "unknown local PDF error");
		throw new Error(`PDF browser read failed: ${message}; local text extraction also failed: ${localMessage}`);
	}
	try {
		return await extractPdfTextServer({ data: {
			filename: file.name || "uploaded.pdf",
			base64
		} });
	} catch (error) {
		const serverMessage = error instanceof Error ? error.message : String(error);
		const localMessage = localError instanceof Error ? localError.message : String(localError ?? "unknown local PDF error");
		throw new Error(`PDF text extraction failed locally (${localMessage}) and server fallback failed (${serverMessage})`);
	}
}
async function ocrPdfLocally(file, onProgress) {
	const pdfjs = await import("../_libs/pdfjs-dist.mjs").then((n) => n.n);
	const workerSrc = (await import("./pdf.worker.min-C1z__b6c.mjs")).default;
	if (workerSrc) pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
	const data = await readPdfFileBytes(file);
	const doc = await pdfjs.getDocument({ data }).promise;
	const { createWorker } = await import("../_libs/tesseract.js.mjs").then((n) => /* @__PURE__ */ __toESM(n.t()));
	async function detectDominantImageSize(page) {
		try {
			const opList = await page.getOperatorList();
			const pdfjsOps = pdfjs.OPS;
			let best = null;
			for (let i = 0; i < opList.fnArray.length; i++) {
				if (opList.fnArray[i] !== pdfjsOps.paintImageXObject && opList.fnArray[i] !== pdfjsOps.paintJpegXObject) continue;
				const name = opList.argsArray[i][0];
				const img = await new Promise((resolve) => {
					try {
						page.objs.get(name, resolve);
					} catch {
						resolve(null);
					}
				});
				if (!img?.width || !img?.height) continue;
				if (!best || img.width * img.height > best.width * best.height) best = {
					width: img.width,
					height: img.height
				};
			}
			return best;
		} catch {
			return null;
		}
	}
	const newWorker = () => createWorker("eng", 1, { logger: (m) => {
		if (!onProgress || !m.status) return;
		const pct = typeof m.progress === "number" ? ` ${Math.round(m.progress * 100)}%` : "";
		onProgress(`Local OCR: ${m.status}${pct}`);
	} });
	onProgress?.(`PDF opened: ${doc.numPages} page${doc.numPages === 1 ? "" : "s"}. Starting local OCR…`);
	let worker = await newWorker();
	const MAX_CANVAS_DIMENSION = 4e3;
	const WORKER_RESTART_EVERY_PAGES = 8;
	const pages = [];
	try {
		for (let i = 1; i <= doc.numPages; i++) {
			onProgress?.(`Reading image-only page ${i}/${doc.numPages} locally…`);
			try {
				const page = await doc.getPage(i);
				const vp1 = page.getViewport({ scale: 1 });
				const nativeImage = await detectDominantImageSize(page);
				const targetScale = nativeImage ? Math.max(2, nativeImage.width / vp1.width, nativeImage.height / vp1.height) : 2;
				const scale = Math.min(targetScale, MAX_CANVAS_DIMENSION / Math.max(vp1.width, vp1.height, 1));
				const viewport = page.getViewport({ scale });
				const canvas = document.createElement("canvas");
				canvas.width = Math.ceil(viewport.width);
				canvas.height = Math.ceil(viewport.height);
				const ctx = canvas.getContext("2d", { willReadFrequently: true });
				if (!ctx) throw new Error("Could not create OCR canvas");
				await page.render({
					canvas,
					canvasContext: ctx,
					viewport
				}).promise;
				const result = await worker.recognize(canvas);
				pages.push((result.data.text ?? "").replace(/\r/g, "").trim());
				canvas.width = 1;
				canvas.height = 1;
			} catch (error) {
				onProgress?.(`Page ${i}/${doc.numPages} failed locally (${error instanceof Error ? error.message : String(error)}) — skipping and continuing.`);
				pages.push("");
			}
			if (i < doc.numPages && i % WORKER_RESTART_EVERY_PAGES === 0) {
				onProgress?.(`Recycling OCR worker to free memory (${i}/${doc.numPages} pages done)…`);
				await worker.terminate();
				worker = await newWorker();
			}
			await new Promise((resolve) => setTimeout(resolve, 30));
		}
	} finally {
		await worker.terminate();
	}
	while (pages.length < doc.numPages) pages.push("");
	return {
		pages,
		pageCount: doc.numPages
	};
}
var MODEL_VOTE_KEY_MAP = {
	surface_elo: "matrix_elo",
	serve_return: "matrix_serve_return",
	recent_form: "matrix_recent_form",
	head_to_head: "matrix_head_to_head",
	market_consensus: "matrix_market",
	general_model: "general_model",
	specialist_model: "specialist_model"
};
var ENGINE_MODULE_KEY_MAP = {
	surface_elo: "matrix_elo_detail",
	serve_return: "matrix_serve_return_detail",
	recent_form: "matrix_recent_form_detail",
	head_to_head: "matrix_head_to_head_detail",
	fatigue_index: "matrix_fatigue_index_detail",
	match_load_recovery: "matrix_fatigue_index_detail",
	rest_travel_injury: "matrix_rest_travel_injury_detail",
	style_matchup: "matrix_style_matchup_detail"
};
function flattenMatrixSummary(summary) {
	if (!summary) return [];
	const out = [
		["matrix_confidence_label", summary.confidence_label],
		["matrix_wp_range", summary.win_probability_range],
		["matrix_agreement_label", summary.agreement_label]
	];
	for (const [key, value] of Object.entries(summary.model_votes ?? {})) out.push([MODEL_VOTE_KEY_MAP[key] ?? `matrix_model_vote_${key}`, value]);
	const mc = summary.monte_carlo;
	if (mc) {
		out.push(["monte_carlo_prob", mc.win_probability], ["monte_carlo_range", mc.range], ["monte_carlo_expected_sets", mc.expected_sets], ["monte_carlo_simulations", mc.simulations]);
		if (mc.set_score_distribution && Object.keys(mc.set_score_distribution).length) out.push(["monte_carlo_set_score_distribution", JSON.stringify(mc.set_score_distribution)]);
	}
	for (const [module, detail] of Object.entries(summary.engine_breakdown ?? {})) if (detail && Object.keys(detail).length) out.push([ENGINE_MODULE_KEY_MAP[module] ?? `matrix_engine_${module}_detail`, JSON.stringify(detail)]);
	return out;
}
function aiToParsed(m) {
	const page = m.page_number || 1;
	const fields = [
		["tournament", m.tournament],
		["event_level", m.event_level],
		["round", m.round],
		["scheduled_date", m.scheduled_date],
		["surface", m.surface],
		["best_of", m.best_of],
		["matrix_predicted_winner", m.matrix_predicted_winner],
		["matrix_wp", m.matrix_wp],
		...flattenMatrixSummary(m.matrix_summary),
		...Object.entries(m.other_fields ?? {})
	].filter(([, v]) => v !== null && v !== void 0 && String(v).trim() !== "").map(([key, v]) => ({
		field_key: key,
		raw_value: String(v),
		normalized_value: String(v),
		extraction_status: "DIRECT",
		confidence: .85,
		page_number: page
	}));
	return {
		player1_name: m.player1_name,
		player2_name: m.player2_name,
		page_number: page,
		confidence: .85,
		fields
	};
}
/**
* Ingests the reviewed matchups the upload screen is holding.
*
* The browser sends what the reviewer approved -- filenames, page text, parsed matchups --
* and the server decides what rows that becomes. It cannot name a table, a column or a row
* id, which is the whole point: this was previously a direct multi-table write from a page
* holding a publishable key.
*/
var ingestSummaries = createServerFn({ method: "POST" }).inputValidator((data) => {
	const files = Array.isArray(data?.files) ? data.files : [];
	if (!files.length) throw new Error("No files were supplied for ingestion.");
	for (const file of files) {
		if (!file || typeof file.filename !== "string" || !file.filename.trim()) throw new Error("Every staged file needs a filename.");
		if (!Array.isArray(file.pages) || !Array.isArray(file.matchups)) throw new Error(`Staged file "${file.filename}" is malformed.`);
		if (![
			"TEXT",
			"LOCAL_OCR",
			"VISION"
		].includes(file.source)) throw new Error(`Staged file "${file.filename}" has an unknown source "${file.source}".`);
	}
	return { files };
}).handler(createSsrRpc("7d9c988c7befd20d5b130693c2428cf88eb286fa2564f328ac26cc6a53ec747f"));
/** Stage rows for a set of runs, for the upload screen's batch progress bar. */
var fetchStageProgress = createServerFn({ method: "POST" }).inputValidator((data) => ({ runIds: Array.isArray(data?.runIds) ? data.runIds.map(String).filter(Boolean) : [] })).handler(createSsrRpc("4cf41fdc8d87d0015498d52d271f929291eb1ddf4db392226fd85d35ca08a238"));
var resolveMatchContext = createServerFn({ method: "POST" }).inputValidator((data) => {
	if (!data || !data.p1?.trim() || !data.p2?.trim()) throw new Error("Both player names are required");
	return {
		p1: data.p1.trim(),
		p2: data.p2.trim(),
		hints: data.hints ?? {}
	};
}).handler(createSsrRpc("47913d188f947f7b0458fd054a8852f3b57132ea03476fbfc9e2c0c9e7ce83f2"));
var AUDIT_CONCURRENCY = 4;
var LARGE_PDF_SKIP_TEXT_EXTRACTION_BYTES = 8388608;
var ERROR_KEY = "tennis-matrix-upload-errors-v1";
function loadErrors() {
	if (typeof window === "undefined") return [];
	try {
		return JSON.parse(window.localStorage.getItem(ERROR_KEY) ?? "[]").slice(0, 100);
	} catch {
		return [];
	}
}
function toBase64(file) {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onerror = () => reject(/* @__PURE__ */ new Error("Could not read the file"));
		reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
		reader.readAsDataURL(file);
	});
}
function UploadPage() {
	const navigate = useNavigate();
	const [files, setFiles] = (0, import_react.useState)([]);
	const [staged, setStaged] = (0, import_react.useState)([]);
	const [busy, setBusy] = (0, import_react.useState)(false);
	const [progress, setProgress] = (0, import_react.useState)(null);
	const [auditProgress, setAuditProgress] = (0, import_react.useState)(null);
	const [errors, setErrors] = (0, import_react.useState)(loadErrors);
	const visionExtract = useServerFn(extractMatchupsFromPdf);
	const resolveContext = useServerFn(resolveMatchContext);
	const executeBatch = useServerFn(runAuditBatch);
	const ingest = useServerFn(ingestSummaries);
	const stageProgress = useServerFn(fetchStageProgress);
	const recordError = (stage, error, meta = {}) => {
		const message = error instanceof Error ? error.message : String(error ?? "Unknown error"), entry = {
			id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
			at: (/* @__PURE__ */ new Date()).toISOString(),
			stage,
			file: meta.file,
			match: meta.match,
			message
		};
		setErrors((prev) => {
			const next = [entry, ...prev].slice(0, 100);
			try {
				window.localStorage.setItem(ERROR_KEY, JSON.stringify(next));
			} catch {}
			return next;
		});
		console.error(`[${stage}]`, meta, message);
		return message;
	};
	const clearErrors = () => {
		setErrors([]);
		try {
			window.localStorage.removeItem(ERROR_KEY);
		} catch {}
	};
	const enrich = async (list) => {
		const total = list.reduce((a, f) => a + f.matchups.length, 0);
		let done = 0;
		setProgress(`0 of ${total} completed`);
		for (const file of list) for (const m of file.matchups) {
			setProgress(`${done} of ${total} completed · Processing ${m.player1_name} vs ${m.player2_name}…`);
			const hints = {};
			for (const key of REVIEW_FIELDS) hints[key] = m.fields.find((f) => f.field_key === key)?.normalized_value ?? null;
			try {
				const res = await resolveContext({ data: {
					p1: m.player1_name,
					p2: m.player2_name,
					hints
				} });
				if (!res.ok) recordError("MATCH CONTEXT RESOLUTION", res.unresolvedReason ?? "Context resolver returned no usable result", {
					file: file.filename,
					match: `${m.player1_name} vs ${m.player2_name}`
				});
				else for (const key of REVIEW_FIELDS) {
					const value = res.fields[key];
					if (!value) continue;
					const old = hints[key];
					if (!old || String(old) !== String(value)) setResolvedField(m, key, String(value));
				}
			} catch (e) {
				recordError("MATCH CONTEXT RESOLUTION", e, {
					file: file.filename,
					match: `${m.player1_name} vs ${m.player2_name}`
				});
			} finally {
				done++;
				setProgress(`${done} of ${total} completed`);
			}
		}
	};
	const analyze = async () => {
		if (!files.length) return;
		setBusy(true);
		try {
			const next = [];
			for (const file of files) {
				setProgress(`Reading ${file.name}…`);
				let pages = [];
				let matchups = [];
				let source = "TEXT";
				const isLarge = file.size > LARGE_PDF_SKIP_TEXT_EXTRACTION_BYTES;
				if (isLarge) toast.info(`${file.name} is ${(file.size / 1024 / 1024).toFixed(1)}MB — likely a screenshot compilation, going straight to on-device OCR. Large batches (30+ matches) are more reliable split into a few smaller uploads.`);
				else try {
					pages = (await extractPdfText(file)).pages;
					matchups = parseSummaryText(pages);
				} catch (e) {
					pages = [];
					recordError("PDF TEXT EXTRACTION", e, { file: file.name });
				}
				if (matchups.length === 0) {
					setProgress(`${file.name}: running free local OCR…`);
					try {
						pages = (await ocrPdfLocally(file, (m) => setProgress(`${file.name}: ${m}`))).pages;
						matchups = parseSummaryText(pages);
						source = "LOCAL_OCR";
					} catch (e) {
						recordError("LOCAL OCR", e, { file: file.name });
					}
				}
				if (matchups.length === 0 && !isLarge) {
					setProgress(`${file.name}: local OCR found no matchup — trying vision extraction…`);
					try {
						const base64 = await toBase64(file);
						const { matchups: ai } = await visionExtract({ data: {
							filename: file.name,
							base64
						} });
						matchups = ai.map(aiToParsed);
						source = "VISION";
					} catch (e) {
						const message = recordError("VISION EXTRACTION", e, { file: file.name });
						if (/402|credit/i.test(message)) toast.error(`${file.name}: local OCR could not identify the matchup and AI credits are exhausted.`);
						else toast.error(`${file.name}: ${message}`);
					}
				}
				matchups = dedupeMatchups(matchups);
				if (!matchups.length) {
					recordError("MATCHUP DETECTION", "No matchups detected — review required", { file: file.name });
					toast.warning(`${file.name}: no matchups detected — review required`);
				}
				next.push({
					filename: file.name,
					pages,
					matchups,
					source
				});
			}
			await enrich(next);
			for (const f of next) f.matchups = dedupeMatchups(f.matchups);
			setStaged((s) => [...s, ...next]);
			setFiles([]);
		} catch (e) {
			const message = recordError("START ANALYSIS", e);
			toast.error(`Analysis failed: ${message}`);
		} finally {
			setProgress(null);
			setBusy(false);
		}
	};
	const editField = (fi, mi, key, value) => setStaged((s) => s.map((f, i) => i !== fi ? f : {
		...f,
		matchups: f.matchups.map((m, j) => {
			if (j !== mi) return m;
			const fields = m.fields.some((x) => x.field_key === key) ? m.fields.map((x) => x.field_key === key ? {
				...x,
				normalized_value: value,
				extraction_status: "DIRECT"
			} : x) : [...m.fields, {
				field_key: key,
				raw_value: null,
				normalized_value: value,
				extraction_status: "PARTIAL",
				confidence: 1,
				page_number: m.page_number
			}];
			return {
				...m,
				fields
			};
		})
	}));
	const editPlayerName = (fi, mi, side, value) => setStaged((s) => s.map((f, i) => i !== fi ? f : {
		...f,
		matchups: f.matchups.map((m, j) => j !== mi ? m : {
			...m,
			[side]: value
		})
	}));
	const fieldValue = (m, key) => m.fields.find((f) => f.field_key === key)?.normalized_value ?? "";
	const commit = async () => {
		setBusy(true);
		try {
			const { created, reused, versions, matchIds, failures } = await ingest({ data: { files: staged } });
			for (const failure of failures) recordError(failure.stage, failure.message, {
				file: failure.file,
				match: failure.match
			});
			setAuditProgress(0);
			if (!matchIds.length) throw new Error("No matches were ingested successfully, so no audit batch was started.");
			try {
				const batch = await executeBatch({ data: {
					matchIds,
					concurrency: AUDIT_CONCURRENCY
				} });
				const runIds = batch.results.map((result) => result.runId).filter((id) => Boolean(id));
				if (runIds.length) {
					const rows = await stageProgress({ data: { runIds } });
					const byRun = /* @__PURE__ */ new Map();
					for (const row of rows) {
						const list = byRun.get(row.audit_run_id) ?? [];
						list.push(row);
						byRun.set(row.audit_run_id, list);
					}
					setAuditProgress(computeBatchExecutionPercent(byRun));
				}
				for (const result of batch.results) if (!result.ok && result.failures?.[0]) recordError("AUDIT PIPELINE", result.failures[0].message, { match: result.matchId });
				toast.success(`${created} new matches, ${reused} existing matches reused, ${versions} summary versions, ${matchIds.length} audit runs queued`);
			} catch (error) {
				if (isRecoverablePipelineTransportError(error)) toast.info("The start response was interrupted, but ingested matches are persisted. Active Slate will claim and continue every unfinished audit automatically.");
				else recordError("AUDIT BATCH START", error);
			}
			navigate({ to: "/app/slate" });
		} catch (e) {
			const message = recordError("INGEST & RUN AUDITS", e);
			toast.error(`Ingestion failed: ${message}`);
		} finally {
			setBusy(false);
			setStaged([]);
			setAuditProgress(null);
		}
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "text-xl font-semibold",
				children: "Upload summaries & parse review"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm text-muted-foreground",
				children: "Every page of every PDF is read. Full-name and shortened-name variants of the same matchup are consolidated before ingestion."
			})] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "panel space-y-3 p-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						type: "file",
						accept: "application/pdf",
						multiple: true,
						disabled: busy,
						onChange: (e) => setFiles(Array.from(e.target.files ?? []))
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						className: "w-full sm:w-auto",
						onClick: analyze,
						disabled: busy || files.length === 0,
						children: busy ? "Analyzing…" : `Start analysis${files.length ? ` (${files.length} PDF${files.length > 1 ? "s" : ""})` : ""}`
					}),
					progress && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mono-num text-xs text-muted-foreground",
						children: progress
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs text-muted-foreground",
						children: "Image-only PDFs use free on-device OCR first. Missing or corrupted context is reconstructed from independent public/local data when possible; unreadable facts are not guessed."
					})
				]
			}),
			errors.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "panel border-destructive/40 p-4",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center justify-between gap-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "font-semibold",
						children: "Errors / run log"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs text-muted-foreground",
						children: "These errors are saved on this device and will not disappear with the toast."
					})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						type: "button",
						variant: "outline",
						size: "sm",
						onClick: clearErrors,
						children: "Clear"
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mt-3 max-h-80 space-y-2 overflow-auto",
					children: errors.map((e) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "rounded-md border border-destructive/30 p-3 text-xs",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-wrap gap-x-3 gap-y-1",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: e.stage }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "mono-num text-muted-foreground",
									children: new Date(e.at).toLocaleString()
								}),
								e.file && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["File: ", e.file] }),
								e.match && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["Match: ", e.match] })
							]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-1 break-words font-mono text-[11px]",
							children: e.message
						})]
					}, e.id))
				})]
			}),
			staged.map((file, fi) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "panel p-4",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h2", {
					className: "font-semibold",
					children: [
						file.filename,
						" ",
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "mono-num text-xs font-normal text-muted-foreground",
							children: [
								file.pages.length,
								" pages · ",
								file.matchups.length,
								" unique matchups · ",
								file.source
							]
						})
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mt-3 space-y-3",
					children: file.matchups.map((m, mi) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "rounded-md border border-border p-3",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex flex-wrap items-center gap-2",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
										className: "h-8 w-44 font-medium",
										value: m.player1_name,
										onChange: (e) => editPlayerName(fi, mi, "player1_name", e.target.value)
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-muted-foreground",
										children: "vs"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
										className: "h-8 w-44 font-medium",
										value: m.player2_name,
										onChange: (e) => editPlayerName(fi, mi, "player2_name", e.target.value)
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: "mono-num text-xs text-muted-foreground",
										children: [
											"page ",
											m.page_number,
											" · parser confidence ",
											(m.confidence * 100).toFixed(0),
											"%"
										]
									})
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-1 text-[11px] text-muted-foreground",
								children: "Names come straight from OCR — check them against the source PDF and correct here before ingesting; nothing downstream re-derives them."
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "mt-2 grid gap-2 md:grid-cols-3",
								children: REVIEW_FIELDS.map((key) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
									className: "text-xs",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-muted-foreground",
										children: key
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
										className: "mt-1 h-8",
										value: fieldValue(m, key),
										placeholder: "UNAVAILABLE",
										onChange: (e) => editField(fi, mi, key, e.target.value)
									})]
								}, key))
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "mono-num mt-2 text-[11px] text-muted-foreground",
								children: [m.fields.length, " fields extracted/reconstructed"]
							})
						]
					}, mi))
				})]
			}, file.filename + fi)),
			staged.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "space-y-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					onClick: commit,
					disabled: busy || staged.every((f) => f.matchups.length === 0),
					children: busy ? "Ingesting & running audits…" : "Ingest & run audits"
				}), auditProgress !== null && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ProgressBar, {
					percent: auditProgress,
					widthClassName: "w-40"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 text-xs text-muted-foreground",
					children: "Running audits — this bar tracks pipeline-stage progress across every uploaded match; it will keep moving even on a slow connection."
				})] })]
			})
		]
	});
}
//#endregion
export { UploadPage as component };
