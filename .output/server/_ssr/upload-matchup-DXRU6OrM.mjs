import { n as normalizeName } from "./summary-parser-DFGrtQjO.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/upload-matchup-DXRU6OrM.js
var REVIEW_FIELDS = [
	"tournament",
	"event_level",
	"round",
	"scheduled_date",
	"surface",
	"best_of"
];
var clean = (v) => String(v ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
var nameTokens = (v) => normalizeName(v).split(" ").filter(Boolean);
function samePlayer(a, b) {
	const x = nameTokens(a), y = nameTokens(b);
	if (!x.length || !y.length) return false;
	if (x.join(" ") === y.join(" ")) return true;
	if (x[x.length - 1] !== y[y.length - 1]) return false;
	const sx = new Set(x), sy = new Set(y);
	const overlap = [...sx].filter((t) => sy.has(t)).length;
	const shorter = Math.min(sx.size, sy.size);
	return overlap === shorter || overlap >= Math.min(2, shorter);
}
function samePair(a1, a2, b1, b2) {
	return samePlayer(a1, b1) && samePlayer(a2, b2) || samePlayer(a1, b2) && samePlayer(a2, b1);
}
function compatible(a, b) {
	const x = clean(a), y = clean(b);
	return !x || !y || x === y || x.includes(y) || y.includes(x);
}
function richness(m) {
	return REVIEW_FIELDS.filter((k) => m.fields.some((f) => f.field_key === k && f.normalized_value)).length + m.fields.length * .01 + m.player1_name.split(" ").length * .001 + m.player2_name.split(" ").length * .001;
}
function mergeParsed(a, b) {
	const primary = richness(b) > richness(a) ? b : a, secondary = primary === a ? b : a;
	const fields = [...primary.fields];
	for (const f of secondary.fields) if (!fields.some((x) => x.field_key === f.field_key && x.normalized_value)) fields.push(f);
	const longer = (x, y) => nameTokens(y).length > nameTokens(x).length ? y : x;
	return {
		...primary,
		player1_name: longer(primary.player1_name, secondary.player1_name),
		player2_name: longer(primary.player2_name, secondary.player2_name),
		fields
	};
}
function dedupeMatchups(matchups) {
	const out = [];
	for (const m of matchups) {
		const i = out.findIndex((x) => samePair(x.player1_name, x.player2_name, m.player1_name, m.player2_name));
		if (i < 0) out.push(m);
		else out[i] = mergeParsed(out[i], m);
	}
	return out;
}
function setResolvedField(m, key, value) {
	const i = m.fields.findIndex((f) => f.field_key === key);
	const next = {
		field_key: key,
		raw_value: i >= 0 ? m.fields[i].raw_value : null,
		normalized_value: value,
		extraction_status: "RECONSTRUCTED",
		confidence: .9,
		page_number: m.page_number
	};
	if (i >= 0) m.fields[i] = {
		...m.fields[i],
		...next
	};
	else m.fields.push(next);
}
//#endregion
export { samePair as a, nameTokens as i, compatible as n, setResolvedField as o, dedupeMatchups as r, REVIEW_FIELDS as t };
