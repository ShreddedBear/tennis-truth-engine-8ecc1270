import { r as __exportAll } from "../_runtime.mjs";
import { n as STAT_CATALOG } from "./stat-catalog-qDs35q_a.mjs";
import { s as __exportAll$1 } from "./server-KPZuT5q2.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/audit-research.server-D8MhZa1Z.js
var audit_research_server_D8MhZa1Z_exports = /* @__PURE__ */ __exportAll({
	n: () => audit_research_server_exports,
	t: () => aiResearcher
});
var audit_research_server_exports = /* @__PURE__ */ __exportAll$1({
	aiResearcher: () => aiResearcher,
	resolveMatchIdentity: () => resolveMatchIdentity
});
var OPENAI_DEFAULT_BASE_URL = "https://api.openai.com/v1";
var PROVIDER_TIMEOUT_MS = 9e3;
var HOUSE_RULES = `You are the independent research branch of a tennis match audit.
HARD RULES:
- Never invent, estimate or "reasonably assume" a number, date or fact. If you cannot attribute a value to a real, named public tennis source, mark it UNAVAILABLE and say why.
- Only pre-match, publicly available information may be used.
- You are NEVER given, and must never guess, the proprietary "Matrix" model prediction. Reason only from the independent evidence supplied.
- Never substitute a proxy, correlated statistic, broader aggregate, or neighboring metric for the exact statistic named by a metric definition.
- PARTIAL means that some, but not all, of the exact definition's required inputs or observations are directly supported. A proxy alone is UNAVAILABLE for that metric, not PARTIAL.
- RECONSTRUCTED is allowed only when every required component of the exact formula/definition is sourced and the calculation is stated. If any required component is missing, use PARTIAL only when the supported components themselves are exact required inputs; otherwise use UNAVAILABLE.
- Always answer with strict JSON matching the requested shape. No prose outside the JSON.`;
function providers() {
	const configured = [];
	const primaryKey = process.env["RESEARCH_API_KEY"];
	const primaryUrl = process.env["RESEARCH_URL"];
	if (primaryKey && primaryUrl) configured.push({
		name: "Research provider",
		url: `${primaryUrl.replace(/\/$/u, "")}/chat/completions`,
		key: primaryKey,
		model: process.env["RESEARCH_MODEL"] ?? "gpt-4o-mini",
		supportsGoogleSearchTool: process.env["RESEARCH_GROUNDED_SEARCH"] === "true"
	});
	const fallbackKey = process.env["RESEARCH_FALLBACK_API_KEY"] ?? process.env["OPENAI_API_KEY"];
	const fallbackUrl = process.env["RESEARCH_FALLBACK_URL"] ?? process.env["OPENAI_BASE_URL"] ?? (process.env["OPENAI_API_KEY"] ? OPENAI_DEFAULT_BASE_URL : void 0);
	if (fallbackKey && fallbackUrl) configured.push({
		name: "Configured fallback provider",
		url: `${fallbackUrl.replace(/\/$/u, "")}/chat/completions`,
		key: fallbackKey,
		model: process.env["RESEARCH_FALLBACK_MODEL"] ?? process.env["OPENAI_MODEL"] ?? "gpt-4o-mini",
		supportsGoogleSearchTool: process.env["RESEARCH_FALLBACK_GROUNDED_SEARCH"] === "true"
	});
	return configured;
}
async function ask(prompt, shapeHint, grounded) {
	const attempts = providers();
	if (!attempts.length) throw new Error("Research providers are not configured: set RESEARCH_API_KEY and RESEARCH_URL, or OPENAI_API_KEY.");
	const errors = [];
	for (const provider of attempts) {
		const body = {
			model: provider.model,
			messages: [{
				role: "system",
				content: `${HOUSE_RULES}\nRespond as: ${shapeHint}`
			}, {
				role: "user",
				content: prompt
			}],
			response_format: { type: "json_object" }
		};
		const attemptGrounded = grounded && provider.supportsGoogleSearchTool;
		if (attemptGrounded) body["tools"] = [{ type: "google_search" }];
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);
		const attemptStartedAt = Date.now();
		try {
			let res = await fetch(provider.url, {
				method: "POST",
				headers: {
					"content-type": "application/json",
					Authorization: `Bearer ${provider.key}`
				},
				signal: controller.signal,
				body: JSON.stringify(body)
			});
			if (!res.ok && attemptGrounded && (res.status === 400 || res.status === 422)) {
				const retryBody = { ...body };
				delete retryBody["tools"];
				res = await fetch(provider.url, {
					method: "POST",
					headers: {
						"content-type": "application/json",
						Authorization: `Bearer ${provider.key}`
					},
					signal: controller.signal,
					body: JSON.stringify(retryBody)
				});
			}
			if (!res.ok) {
				const text = await res.text();
				errors.push(`${provider.name} ${res.status}: ${text.slice(0, 300)}`);
				console.log(`[research-timing] ${provider.name} FAIL(${res.status}) ${Date.now() - attemptStartedAt}ms`);
				continue;
			}
			const content = (await res.json()).choices?.[0]?.message?.content ?? "";
			const unwrap = (v) => Array.isArray(v) ? v[0] ?? {} : v;
			console.log(`[research-timing] ${provider.name} OK ${Date.now() - attemptStartedAt}ms`);
			try {
				return unwrap(JSON.parse(content));
			} catch {
				const m = content.match(/[[{][\s\S]*[\]}]/);
				if (!m) throw new Error("PARSING_FAILED: provider returned no JSON object.");
				return unwrap(JSON.parse(m[0]));
			}
		} catch (error) {
			errors.push(`${provider.name}: ${error instanceof Error ? error.message : String(error)}`);
			console.log(`[research-timing] ${provider.name} ERROR ${Date.now() - attemptStartedAt}ms: ${error instanceof Error ? error.message : String(error)}`);
		} finally {
			clearTimeout(timeout);
		}
	}
	throw new Error(`All research providers failed: ${errors.join(" | ")}`);
}
var IDENTITY_SHAPE = `{"player1_canonical":string|null,"player2_canonical":string|null,"player1_status":"VERIFIED"|"UNVERIFIED"|"CONFLICT","player2_status":"VERIFIED"|"UNVERIFIED"|"CONFLICT","tournament":string|null,"event_level":string|null,"round":string|null,"scheduled_date":string|null,"surface":string|null,"indoor":boolean|null,"best_of":number|null,"surface_status":"VERIFIED"|"UNVERIFIED"|"CONFLICT","unresolved_reason":string|null,"sources":[{"source_name":string,"url":string|null,"retrieved_at":string|null}],"conflicts":[{"field":string,"values":[string],"note":string|null}]}`;
var CONTEXT_KEYS = [
	"tournament",
	"event_level",
	"round",
	"scheduled_date",
	"surface",
	"indoor",
	"best_of"
];
function missingKeys(f) {
	return CONTEXT_KEYS.filter((k) => f[k] === null || f[k] === void 0).map(String);
}
async function resolveMatchIdentity(input) {
	const { p1, p2, hints } = input;
	const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
	const base = `Resolve this professional tennis matchup independently against public tennis sources (ATP/WTA/ITF official tour sites and draws, Tennis Abstract, Ultimate Tennis Statistics, Tennis Explorer, Flashscore, tournament sites).
Today's date is ${today}. Relative hints such as "Today", "Tonight" or a weekday refer to that date.
Players exactly as printed on the uploaded summary — do not substitute anyone else:
  Player 1: ${p1}
  Player 2: ${p2}
Context hints from the upload (may be incomplete or wrong): ${JSON.stringify(hints)}`;
	let out = await ask(`${base}
Tasks:
 1. Confirm each player exists as a real tour player and give the canonical full name. Any player with an ATP/WTA/ITF profile page is VERIFIED — set UNVERIFIED only if no such profile exists at all.
 2. Independently establish tournament, event_level, round, scheduled_date (YYYY-MM-DD), surface, indoor (true/false), best_of by locating the current or upcoming draw containing both players. Do NOT return null just because a hint was missing. Return null only after a genuine attempt with no source.
 3. List every source used with url and retrieval note; list conflicting values.`, IDENTITY_SHAPE, true);
	const gaps = missingKeys(out);
	if (gaps.length) try {
		const retry = await ask(`${base}
The first retrieval pass could not establish: ${gaps.join(", ")}.
Search again specifically for the tournament draw / order of play that contains BOTH players around ${hints["scheduled_date"] ?? today}.
Tournament surface, indoor/outdoor and best_of follow from the event itself (e.g. ATP/Challenger main draw = best of 3), so state them once the event is identified.
Return the full object; use null only for a field you genuinely cannot source.`, IDENTITY_SHAPE, true);
		const merged = { ...out };
		for (const k of CONTEXT_KEYS) if ((merged[k] === null || merged[k] === void 0) && retry[k] !== null && retry[k] !== void 0) merged[k] = retry[k];
		if (retry.sources?.length) merged["sources"] = [...out.sources ?? [], ...retry.sources];
		if (retry.surface_status && merged["surface"]) merged["surface_status"] = retry.surface_status;
		out = merged;
	} catch {}
	if (out.surface && out.surface_status !== "CONFLICT") out.surface_status = "VERIFIED";
	if (out.player1_canonical && out.player1_status !== "CONFLICT") out.player1_status = "VERIFIED";
	if (out.player2_canonical && out.player2_status !== "CONFLICT") out.player2_status = "VERIFIED";
	return {
		...out,
		sources: out.sources ?? [],
		conflicts: out.conflicts ?? []
	};
}
var aiResearcher = {
	async identity(input) {
		return resolveMatchIdentity(input);
	},
	async dossier({ player, opponent, context }) {
		return (await ask(`Retrieve a factual pre-match statistical dossier for the professional tennis player ${player} (upcoming opponent ${opponent}; ${context || "context not yet established"}).
Search public sources (ATP/WTA/ITF official, Tennis Abstract, Ultimate Tennis Statistics, Tennis Explorer, tournament sites).
Report, with the source named inline for each figure and only where a real source exists:
 - current ranking, ranking trend, age, handedness
 - season and 12-month win/loss, split by surface
 - serve metrics: 1st serve %, 1st/2nd serve points won, aces/DF per match, hold %
 - return metrics: return points won vs 1st/2nd serve, break points converted, break %
 - tie-break and deciding-set records, recent form (last 10 matches with opponents and scores)
 - head-to-head with ${opponent}, injury/withdrawal/fatigue news, travel and schedule load, altitude/conditions notes
Omit anything you cannot attribute. Do not estimate. Return it as one markdown dossier string.`, `{"dossier":string}`, true)).dossier ?? "";
	},
	async extractStats({ player, dossier, context }) {
		const catalog = STAT_CATALOG.map((stat) => `${stat.key} | ${stat.label} | ${stat.unit}`).join("\n");
		return ((await ask(`Normalize the dossier for ${player} in the context ${context || "not established"} into atomic statistics.
This is extraction only. Copy a number only when the dossier explicitly attributes it to a named source and the figure describes this player, surface and time window. Never calculate, infer, convert, average, substitute a proxy, or fill a missing value. Return no derived percentages or ratios.
Allowed catalog keys:
${catalog}
Dossier:
${dossier.slice(0, 16e3)}`, `{"stats":[{"key":string,"player":string,"value":number,"surface":string|null,"window":string|null,"tour_level":string|null,"sample":number|null,"origin":"DIRECT","sources":[{"source_name":string,"url":string|null,"retrieved_at":string|null}]}]}`, false)).stats ?? []).filter((stat) => stat.player === player && stat.origin === "DIRECT" && Number.isFinite(stat.value) && stat.sources?.length).map((stat) => ({
			...stat,
			origin: "DIRECT",
			sources: stat.sources ?? []
		}));
	},
	async metrics({ p1, p2, context, dossier, metrics }) {
		return ((await ask(`Match: ${p1} vs ${p2}. Context: ${context || "context not yet established"}.
${dossier ? `Retrieved public dossiers (use these figures directly; treat them as sourced evidence):\n${dossier.slice(0, 12e3)}\n` : ""}
For EVERY metric below, research both players symmetrically and return one row per metric_code.
Treatment per player: DIRECT (the exact metric itself is published at a named source), RECONSTRUCTED (the exact metric is computed from all required named-source components and the calculation/components are stated), PARTIAL (some but not all exact required inputs/observations are sourced; never use a proxy or merely correlated statistic), UNAVAILABLE (the exact metric cannot be satisfied from admissible sourced inputs, including cases where only a proxy exists), EXCLUDED (post-match or inadmissible).

SIDE-SPECIFIC EVIDENCE CONTRACT — REQUIRED FOR EVERY NON-UNAVAILABLE/NON-EXCLUDED SIDE:
- p1_value MUST begin exactly with PLAYER=${p1}; p2_value MUST begin exactly with PLAYER=${p2}. Never infer identity from row order.
- Immediately include SOURCE=<exact source_name> where that exact source_name also appears in this row's sources array and directly supports that player's surviving value. Do not use a source that only supports the opponent or another component.
- Immediately include SAMPLE=<actual side-specific denominator/window>. Do not copy the other player's sample and do not use a generic shared sample when the side-specific sample is unknown. If the source gives a time window but no numeric denominator, state that exact sourced window as SAMPLE. If neither a denominator nor a defensible source-defined window exists, that side is UNAVAILABLE.
- After PLAYER/SOURCE/SAMPLE, include only exact master-definition component names and their sourced values/observations. Neighboring/proxy fields remain inadmissible.
- For RECONSTRUCTED, also include INPUTS=<pipe-separated exact raw input names>; FORMULA=<explicit calculation>. Every listed input must be sourced, permitted by the metric definition, and actually referenced by the formula. If you cannot provide the complete exact inputs and formula, do not label the side RECONSTRUCTED.
- The row-level sources array MUST contain every source named by either side and must not contain invented sources.
- The row-level sample field is only a display summary; it never substitutes for the side-specific SAMPLE tag.

Example value format (illustrative structure only, never copy the numbers): PLAYER=Exact Player; SOURCE=Named Public Source; SAMPLE=last 20 matches; Exact Component=...
Example reconstructed format: PLAYER=Exact Player; SOURCE=Named Public Source; SAMPLE=30 matches; INPUTS=input_a|input_b; FORMULA=input_a-input_b; Exact Component=...

Do not substitute a convenient statistic for the statistic the definition actually requires. Hold %, break %, tiebreak %, generic first-set %, generic common-opponent win %, ranking, Elo, or another neighboring statistic may only be used when the metric definition explicitly requires that field as an input. A correlated statistic by itself does not make the metric PARTIAL or RECONSTRUCTED.
Metrics:
${metrics.map((m) => `- ${m.code} | ${m.name}${m.body ? ` | definition: ${m.body.slice(0, 400)}` : ""}`).join("\n")}`, `{"metrics":[{"metric_code":string,"p1_value":string|null,"p2_value":string|null,"p1_treatment":"DIRECT"|"RECONSTRUCTED"|"PARTIAL"|"UNAVAILABLE"|"EXCLUDED","p2_treatment":"DIRECT"|"RECONSTRUCTED"|"PARTIAL"|"UNAVAILABLE"|"EXCLUDED","differential":string|null,"evidence_family":string|null,"reliability":number|null,"sample":string|null,"unavailable_reason":string|null,"sources":[{"source_name":string,"url":string|null,"retrieved_at":string|null}]}]}`, true)).metrics ?? []).map((m) => ({
			...m,
			sources: m.sources ?? []
		}));
	},
	async rules({ kind, evidence, rules }) {
		const label = kind === "VERIFICATION" ? "verification audit rule" : "disagreement / trap audit rule";
		return ((await ask(`Independent evidence for ${evidence.p1} vs ${evidence.p2} (${evidence.context || "context unestablished"}):
${evidence.metrics.map((m) => `- ${m.code} ${m.name}: P1 ${m.p1 ?? "—"} | P2 ${m.p2 ?? "—"}`).join("\n") || "(no metric values retrieved)"}

Execute each ${label} against that evidence. One row per rule_code.
Rules:
${rules.map((r) => `- ${r.code} | ${r.name}${r.body ? ` | ${r.body.slice(0, 500)}` : ""} | severity ${r.severity}`).join("\n")}
Use outcome UNAVAILABLE only when the evidence needed to execute the rule is genuinely absent.`, `{"rules":[{"rule_code":string,"p1_finding":string|null,"p2_finding":string|null,"outcome":"PASS"|"WARN"|"FAIL"|"UNAVAILABLE","severity":"STANDARD"|"CRITICAL"|null,"decision_effect":string|null,"contradiction_severity":"NONE"|"MINOR"|"MATERIAL"|"CRITICAL"|null,"supporting_evidence":string|null,"opposing_evidence":string|null,"final_effect":string|null,"unavailable_reason":string|null,"missing_inputs":[string],"sources":[{"source_name":string,"url":string|null,"retrieved_at":string|null}]}]}`, false)).rules ?? []).map((r) => ({
			...r,
			sources: r.sources ?? []
		}));
	},
	async underdog({ evidence, pathways, player_side, opponent }) {
		return ((await ask(`Dangerous-underdog analysis for ${player_side} against ${opponent} (${evidence.context || "context unestablished"}).
Evidence:
${evidence.metrics.map((m) => `- ${m.name}: P1 ${m.p1 ?? "—"} | P2 ${m.p2 ?? "—"}`).join("\n") || "(no metric values retrieved)"}
Classify each pathway for ${player_side}: STRONG (live, evidenced route to the upset), REALISTIC, WEAK, or UNRESOLVED only if the evidence needed is absent (then give unavailable_reason).
Pathways:
${pathways.map((p) => `- ${p.code} | ${p.name}`).join("\n")}`, `{"pathways":[{"pathway_code":string,"player_side":string,"classification":"UNRESOLVED"|"WEAK"|"REALISTIC"|"STRONG","evidence":string|null,"repeatable":boolean,"unavailable_reason":string|null,"missing_inputs":[string],"sources":[{"source_name":string,"url":string|null,"retrieved_at":string|null}]}]}`, false)).pathways ?? []).map((p) => ({
			...p,
			player_side
		}));
	},
	async conclusion({ evidence, verificationSummary, disagreementSummary, underdogSummary }) {
		return ask(`Commit the INDEPENDENT conclusion for ${evidence.p1} vs ${evidence.p2} (${evidence.context || "context unestablished"}).
You have no access to any model/Matrix prediction and must not speculate about one.
Metric evidence:
${evidence.metrics.map((m) => `- ${m.name}: P1 ${m.p1 ?? "—"} | P2 ${m.p2 ?? "—"}`).join("\n") || "(no metric values retrieved)"}
Verification concerns:\n${verificationSummary || "(none flagged)"}
Trap / disagreement concerns:\n${disagreementSummary || "(none flagged)"}
Underdog pathways:\n${underdogSummary || "(none material)"}
Return the winner as the exact player name, plus an honest win-probability range (low/high, 0-100). If the independent evidence is too thin to name a winner, return winner null and insufficient_reason.`, `{"winner":string|null,"low":number|null,"high":number|null,"rationale":string|null,"insufficient_reason":string|null}`, false);
	},
	async stress({ evidence, conclusion, tests }) {
		return (await ask(`Independent conclusion under test: winner ${conclusion.winner ?? "none"} range ${conclusion.low ?? "?"}-${conclusion.high ?? "?"}.
Evidence:
${evidence.metrics.map((m) => `- ${m.name} (${m.family ?? "family unknown"}): P1 ${m.p1 ?? "—"} | P2 ${m.p2 ?? "—"}`).join("\n") || "(no metric values retrieved)"}
Re-derive the conclusion under each removal/re-weighting test and report whether it survives.
Tests:
${tests.map((t) => `- ${t.code} | ${t.name}`).join("\n")}`, `{"tests":[{"test_code":string,"winner_after":string|null,"range_after":string|null,"outcome":"STABLE"|"MOSTLY STABLE"|"UNSTABLE"|"FAILS","note":string|null,"unavailable_reason":string|null,"missing_inputs":[string],"sources":[{"source_name":string,"url":string|null,"retrieved_at":string|null}]}]}`, false)).tests ?? [];
	}
};
//#endregion
export { audit_research_server_D8MhZa1Z_exports as n, aiResearcher as t };
