//#region node_modules/.nitro/vite/services/ssr/assets/match-result-resolution-BrkpAhxT.js
/**
* Result statuses that establish a winner THROUGH PLAY, and therefore make a prediction
* gradable. RETIRED is included because the app's existing calibration semantics already
* count RETIREMENT WIN/RETIREMENT LOSS as real graded results (see gradeResult in
* calibration.ts); this stays consistent with that rather than inventing a second rule.
*/
var FINAL_RESULT_STATUSES = ["FINAL", "RETIRED"];
function normalizeName(value) {
	return value.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
/**
* Lenient enough for "Bueno" vs "Gonzalo Bueno", strict enough never to fuse two players:
* surnames must agree, so a shared given name alone matches nothing.
*/
function playerNamesMatch(a, b) {
	const [x, y] = [normalizeName(String(a ?? "")), normalizeName(String(b ?? ""))];
	if (!x || !y) return false;
	if (x === y) return true;
	const [xt, yt] = [x.split(" "), y.split(" ")];
	return xt[xt.length - 1] === yt[yt.length - 1];
}
/**
* Which side of THIS match a name refers to. Returns null when the name matches neither
* player or -- the case that matters -- both of them, because two players whose surnames
* collide cannot be told apart and guessing would silently invent a result.
*/
function matchSideForName(name, facts) {
	if (!String(name ?? "").trim()) return null;
	const p1 = playerNamesMatch(name, facts.player1_name);
	return p1 === playerNamesMatch(name, facts.player2_name) ? null : p1 ? "P1" : "P2";
}
/** Whether the match has a final, played result at all -- independent of any prediction. */
function matchResultIsFinal(facts) {
	const status = String(facts.result_status ?? "").trim().toUpperCase();
	if (!FINAL_RESULT_STATUSES.includes(status)) return false;
	return matchSideForName(facts.actual_winner, facts) !== null;
}
//#endregion
export { matchSideForName as n, playerNamesMatch as r, matchResultIsFinal as t };
