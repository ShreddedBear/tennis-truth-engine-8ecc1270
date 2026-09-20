//#region node_modules/.nitro/vite/services/ssr/assets/rule-parser-C8eUSSnG.js
var HEADING = /^\s*(\d{1,3})\.\s+(\S.*)$/;
var MAPPABLE = /(<=|>=|\d+\s*%|\bat least\b|\bnever\b|\bmust\b|\bautomatic\b|\bcannot\b)/i;
var BLOCKING = /(never green|automatic pass|red|veto|blocked|cannot be green|hard rule|no green)/i;
var CRITICAL = /(critical|hard rule|veto|automatic)/i;
function parseRuleDocument(text) {
	const pages = Math.max(1, (text.match(/\f/g) || []).length + 1);
	const lines = text.split(/\r?\n/);
	const headingIdx = [];
	let last = 0;
	lines.forEach((line, i) => {
		const m = line.match(HEADING);
		if (!m) return;
		const n = Number(m[1]);
		if (n === last + 1 || n === 1 && last === 0) {
			headingIdx.push(i);
			last = n;
		}
	});
	const rules = [];
	const ambiguous = [];
	let consumed = 0;
	headingIdx.forEach((start, k) => {
		const end = headingIdx[k + 1] ?? lines.length;
		const m = (lines[start] ?? "").match(HEADING);
		if (!m) return;
		const num = m[1] ?? "";
		const title = m[2] ?? "";
		const body = lines.slice(start + 1, end).join("\n").trim();
		consumed += lines.slice(start, end).join("\n").length;
		const name = title.replace(/\s+/g, " ").trim();
		if (!name) {
			ambiguous.push(`Section ${num} has no title`);
			return;
		}
		rules.push({
			rule_code: num.padStart(3, "0"),
			rule_name: name,
			category: null,
			body,
			severity: CRITICAL.test(name + body) ? "CRITICAL" : "STANDARD",
			blocking: BLOCKING.test(name + body),
			mapping_status: MAPPABLE.test(body) ? "MAPPED" : "REQUIRES HUMAN RULE MAPPING"
		});
	});
	const expected = headingIdx.length;
	const parsed = rules.length;
	return {
		pages_detected: pages,
		headings_detected: expected,
		expected_rules: expected,
		parsed_rules: parsed,
		unmapped_rules: rules.filter((r) => r.mapping_status !== "MAPPED").length,
		unparsed_text_chars: Math.max(0, text.length - consumed),
		parser_confidence: expected === 0 ? 0 : Number((parsed / expected).toFixed(4)),
		rules,
		ambiguous
	};
}
function activationStatus(r) {
	return r.expected_rules > 0 && r.parsed_rules === r.expected_rules ? "READY" : "BLOCKED";
}
//#endregion
export { parseRuleDocument as n, activationStatus as t };
