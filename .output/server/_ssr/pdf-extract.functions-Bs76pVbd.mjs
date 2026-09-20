import { i as createServerFn } from "./server-KPZuT5q2.mjs";
import { t as createServerRpc } from "./createServerRpc-BLr1vCfx.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/pdf-extract.functions-Bs76pVbd.js
function ensureServerDomMatrix() {
	const g = globalThis;
	if (typeof g.DOMMatrix === "function") return;
	class ServerDOMMatrix {
		a = 1;
		b = 0;
		c = 0;
		d = 1;
		e = 0;
		f = 0;
		constructor(init) {
			if (Array.isArray(init) && init.length >= 6) [this.a, this.b, this.c, this.d, this.e, this.f] = init.slice(0, 6);
			else if (init && typeof init === "object" && !Array.isArray(init)) {
				this.a = init.a ?? 1;
				this.b = init.b ?? 0;
				this.c = init.c ?? 0;
				this.d = init.d ?? 1;
				this.e = init.e ?? 0;
				this.f = init.f ?? 0;
			}
		}
		get is2D() {
			return true;
		}
		get isIdentity() {
			return this.a === 1 && this.b === 0 && this.c === 0 && this.d === 1 && this.e === 0 && this.f === 0;
		}
		multiply(other) {
			return new ServerDOMMatrix([
				this.a,
				this.b,
				this.c,
				this.d,
				this.e,
				this.f
			]).multiplySelf(other);
		}
		multiplySelf(other) {
			const o = other ?? {};
			const oa = o.a ?? 1, ob = o.b ?? 0, oc = o.c ?? 0, od = o.d ?? 1, oe = o.e ?? 0, of = o.f ?? 0;
			const a = this.a * oa + this.c * ob;
			const b = this.b * oa + this.d * ob;
			const c = this.a * oc + this.c * od;
			const d = this.b * oc + this.d * od;
			const e = this.a * oe + this.c * of + this.e;
			const f = this.b * oe + this.d * of + this.f;
			this.a = a;
			this.b = b;
			this.c = c;
			this.d = d;
			this.e = e;
			this.f = f;
			return this;
		}
		preMultiplySelf(other) {
			const left = new ServerDOMMatrix(other).multiply(this);
			this.a = left.a;
			this.b = left.b;
			this.c = left.c;
			this.d = left.d;
			this.e = left.e;
			this.f = left.f;
			return this;
		}
		translate(tx = 0, ty = 0) {
			return this.multiply(new ServerDOMMatrix([
				1,
				0,
				0,
				1,
				tx,
				ty
			]));
		}
		translateSelf(tx = 0, ty = 0) {
			return this.multiplySelf(new ServerDOMMatrix([
				1,
				0,
				0,
				1,
				tx,
				ty
			]));
		}
		scale(scaleX = 1, scaleY = scaleX) {
			return this.multiply(new ServerDOMMatrix([
				scaleX,
				0,
				0,
				scaleY,
				0,
				0
			]));
		}
		scaleSelf(scaleX = 1, scaleY = scaleX) {
			return this.multiplySelf(new ServerDOMMatrix([
				scaleX,
				0,
				0,
				scaleY,
				0,
				0
			]));
		}
		rotate(angle = 0) {
			const r = angle * Math.PI / 180;
			const cos = Math.cos(r), sin = Math.sin(r);
			return this.multiply(new ServerDOMMatrix([
				cos,
				sin,
				-sin,
				cos,
				0,
				0
			]));
		}
		rotateSelf(angle = 0) {
			const next = this.rotate(angle);
			this.a = next.a;
			this.b = next.b;
			this.c = next.c;
			this.d = next.d;
			this.e = next.e;
			this.f = next.f;
			return this;
		}
		inverse() {
			return new ServerDOMMatrix([
				this.a,
				this.b,
				this.c,
				this.d,
				this.e,
				this.f
			]).invertSelf();
		}
		invertSelf() {
			const det = this.a * this.d - this.b * this.c;
			if (!det) {
				this.a = this.b = this.c = this.d = this.e = this.f = NaN;
				return this;
			}
			const a = this.d / det, b = -this.b / det, c = -this.c / det, d = this.a / det;
			const e = (this.c * this.f - this.d * this.e) / det;
			const f = (this.b * this.e - this.a * this.f) / det;
			this.a = a;
			this.b = b;
			this.c = c;
			this.d = d;
			this.e = e;
			this.f = f;
			return this;
		}
		transformPoint(point = {}) {
			const x = point.x ?? 0, y = point.y ?? 0;
			return {
				x: this.a * x + this.c * y + this.e,
				y: this.b * x + this.d * y + this.f,
				z: 0,
				w: 1
			};
		}
		toFloat32Array() {
			return new Float32Array([
				this.a,
				this.b,
				0,
				0,
				this.c,
				this.d,
				0,
				0,
				0,
				0,
				1,
				0,
				this.e,
				this.f,
				0,
				1
			]);
		}
		toFloat64Array() {
			return new Float64Array([
				this.a,
				this.b,
				0,
				0,
				this.c,
				this.d,
				0,
				0,
				0,
				0,
				1,
				0,
				this.e,
				this.f,
				0,
				1
			]);
		}
	}
	g.DOMMatrix = ServerDOMMatrix;
}
async function ensureServerPdfWorker() {
	const g = globalThis;
	if (g.pdfjsWorker?.WorkerMessageHandler) return;
	const workerModule = await import("../_libs/pdfjs-dist.mjs").then((n) => n.t);
	if (!workerModule.WorkerMessageHandler) throw new Error("PDF.js worker module loaded without WorkerMessageHandler");
	g.pdfjsWorker = workerModule;
}
var extractPdfTextServer_createServerFn_handler = createServerRpc({
	id: "0e78f44ee97c175bc2607982f9b2cb74789979c60847b7fe8cb6af88c3f51a44",
	name: "extractPdfTextServer",
	filename: "src/lib/pdf-extract.functions.ts"
}, (opts) => extractPdfTextServer.__executeServer(opts));
var extractPdfTextServer = createServerFn({ method: "POST" }).inputValidator((data) => {
	if (!data?.base64) throw new Error("No PDF data supplied");
	return data;
}).handler(extractPdfTextServer_createServerFn_handler, async ({ data }) => {
	try {
		ensureServerDomMatrix();
		await ensureServerPdfWorker();
		const pdfjs = await import("../_libs/pdfjs-dist.mjs").then((n) => n.n);
		const bytes = new Uint8Array(Buffer.from(data.base64, "base64"));
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
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		throw new Error(`Server PDF text extraction failed for ${data.filename || "uploaded PDF"}: ${message}`);
	}
});
var PROMPT = `This PDF contains tennis match summaries or screenshots (one or more matchups per page), possibly including "Tennis Matrix AI" prediction-engine reports with sections like Model Votes, Monte Carlo Simulation, Set Score Distribution, and a Full Engine Breakdown (Surface Elo, Serve & Return, Recent Form, Fatigue Index / Match Load Recovery, Rest/Travel/Injury, Head-to-Head, Style Matchup).
Read EVERY page, including pages that are only images/screenshots.
Return strict JSON: {"matchups":[{"page_number":1,"player1_name":"","player2_name":"","tournament":null,"event_level":null,"round":null,"scheduled_date":null,"surface":null,"best_of":null,"matrix_predicted_winner":null,"matrix_wp":null,"matrix_summary":null,"other_fields":{}}]}
Rules: never invent a value — use null when a field is not visible on the page, and never guess a number.
If this page shows a "Tennis Matrix AI"-style prediction-engine report, also populate matrix_summary with this shape (omit or null out whatever isn't shown):
{"confidence_label":"e.g. LOW CONFIDENCE / HIGH CONFIDENCE / EXTREME","win_probability_range":"e.g. 21-99","agreement_label":"e.g. STRONGLY AGREE / HIGH DISAGREEMENT / Close to a coin flip","model_votes":{"<model name as printed, lowercase with underscores, e.g. surface_elo, serve_return, recent_form, head_to_head, market_consensus, general_model, specialist_model>":"<the printed probability pair exactly as shown, e.g. 71/29>"},"monte_carlo":{"win_probability":"e.g. 63.9%","range":"e.g. 21-99","expected_sets":"e.g. 2.4","simulations":"e.g. 10000","set_score_distribution":{"<score, e.g. 6-4>":"<its printed percentage>"}},"engine_breakdown":{"<module name as printed, lowercase with underscores, e.g. surface_elo, serve_return, recent_form, fatigue_index, match_load_recovery, rest_travel_injury, head_to_head, style_matchup>":{"<every labelled stat printed inside that module's panel, key = its label lowercase with underscores, value = exactly as printed>":"..."}}}
Put any other readable labelled value that doesn't fit a named module in other_fields as a string. player1_name and player2_name must be full player names as printed. This data is prediction-engine output for reference only — extract it faithfully, do not compute or infer values it doesn't show.`;
var EXTRACTION_TIMEOUT_MS = 9e4;
var extractMatchupsFromPdf_createServerFn_handler = createServerRpc({
	id: "e097e9de89c83225675e02d77e592e01e116bdf340f69b9ac122fbe0f1e61a01",
	name: "extractMatchupsFromPdf",
	filename: "src/lib/pdf-extract.functions.ts"
}, (opts) => extractMatchupsFromPdf.__executeServer(opts));
var extractMatchupsFromPdf = createServerFn({ method: "POST" }).inputValidator((data) => {
	if (!data?.base64) throw new Error("No PDF data supplied");
	return data;
}).handler(extractMatchupsFromPdf_createServerFn_handler, async ({ data }) => {
	const apiKey = process.env["RESEARCH_VISION_API_KEY"] ?? process.env["RESEARCH_API_KEY"] ?? process.env["OPENAI_API_KEY"];
	const baseUrl = process.env["RESEARCH_VISION_URL"] ?? process.env["RESEARCH_URL"] ?? process.env["OPENAI_BASE_URL"] ?? (process.env["OPENAI_API_KEY"] ? "https://api.openai.com/v1" : void 0);
	if (!apiKey || !baseUrl) throw new Error("AI extraction is not configured (set RESEARCH_VISION_API_KEY and RESEARCH_VISION_URL, or OPENAI_API_KEY).");
	const model = process.env["RESEARCH_VISION_MODEL"] ?? process.env["OPENAI_MODEL"] ?? "gpt-4o-mini";
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), EXTRACTION_TIMEOUT_MS);
	let res;
	try {
		res = await fetch(`${baseUrl.replace(/\/$/u, "")}/chat/completions`, {
			method: "POST",
			headers: {
				"content-type": "application/json",
				Authorization: `Bearer ${apiKey}`
			},
			signal: controller.signal,
			body: JSON.stringify({
				model,
				messages: [{
					role: "user",
					content: [{
						type: "text",
						text: PROMPT
					}, {
						type: "file",
						file: {
							filename: data.filename || "summary.pdf",
							file_data: `data:application/pdf;base64,${data.base64}`
						}
					}]
				}],
				response_format: { type: "json_object" }
			})
		});
	} catch (error) {
		if (error instanceof Error && error.name === "AbortError") throw new Error("PDF extraction timed out after 90 seconds — try a smaller PDF or press Analyze again.");
		throw error;
	} finally {
		clearTimeout(timeout);
	}
	if (!res.ok) {
		const body = await res.text();
		if (res.status === 429) throw new Error("AI extraction is rate limited — wait a moment and press Analyze again.");
		if (res.status === 402) throw new Error("AI credits exhausted — top up credits to keep reading PDFs.");
		throw new Error(`PDF reading failed (${res.status}): ${body.slice(0, 300)}`);
	}
	const content = (await res.json()).choices?.[0]?.message?.content ?? "{}";
	if (!content.trim()) throw new Error("PDF reader returned an empty response — press Analyze again.");
	let parsed;
	try {
		parsed = JSON.parse(content);
	} catch {
		const m = content.match(/\{[\s\S]*\}/);
		if (!m) throw new Error("PDF reader returned an invalid result — press Analyze again.");
		parsed = JSON.parse(m[0]);
	}
	const matchups = (parsed.matchups ?? []).filter((m) => m.player1_name && m.player2_name);
	if (!matchups.length) throw new Error("PDF reader found no player matchup names. Try a clearer PDF or image.");
	return { matchups };
});
//#endregion
export { extractMatchupsFromPdf_createServerFn_handler, extractPdfTextServer_createServerFn_handler };
