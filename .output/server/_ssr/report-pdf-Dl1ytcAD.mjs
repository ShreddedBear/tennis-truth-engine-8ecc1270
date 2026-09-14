import { o as __toESM } from "../_runtime.mjs";
import { n as CALIBRATION_BUCKETS } from "./constants-DloZsw4H.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/report-pdf-Dl1ytcAD.js
var BUCKET_RGB = {
	ORANGE: [
		242,
		169,
		96
	],
	TAN: [
		206,
		179,
		134
	],
	PURPLE: [
		149,
		108,
		200
	],
	BLUE: [
		110,
		145,
		214
	],
	PINK: [
		232,
		160,
		188
	],
	BROWN: [
		140,
		98,
		62
	],
	INDIGO: [
		88,
		74,
		168
	],
	GOLD: [
		232,
		197,
		84
	]
};
async function buildBoardPdf(rows) {
	const { jsPDF } = await import("../_libs/jspdf.mjs").then((n) => /* @__PURE__ */ __toESM(n.t()));
	const autoTable = (await import("../_libs/jspdf-autotable.mjs").then((n) => n.t)).default;
	const doc = new jsPDF({
		orientation: "landscape",
		unit: "pt",
		format: "a4"
	});
	const now = /* @__PURE__ */ new Date();
	doc.setFillColor(31, 41, 71);
	doc.rect(0, 0, doc.internal.pageSize.getWidth(), 56, "F");
	doc.setTextColor(255, 255, 255);
	doc.setFontSize(15);
	doc.text("TENNIS MATRIX — MASTER AUDIT REPORT", 32, 26);
	doc.setFontSize(9);
	doc.text(`Report generated ${now.toLocaleString()}`, 32, 42);
	doc.setTextColor(40, 40, 40);
	doc.setFontSize(9);
	const counts = [
		"DOUBLE GREEN",
		"GREEN",
		"YELLOW",
		"RED / PASS",
		"INCOMPLETE"
	].map((c) => `${c}: ${rows.filter((r) => r.color === c).length}`).join("    ");
	doc.text(counts, 32, 76);
	doc.text(`Matches on report: ${rows.length}    Complete: ${rows.filter((r) => r.completion === 100).length}    Unresolved: ${rows.filter((r) => r.completion < 100).length}`, 32, 90);
	autoTable(doc, {
		startY: 104,
		head: [[
			"Bucket",
			"Range",
			"Baseline record"
		]],
		body: CALIBRATION_BUCKETS.map((b) => [
			b.code,
			`${b.min}–${b.max}%`,
			`${b.wins}/${b.graded}`
		]),
		styles: {
			fontSize: 7,
			cellPadding: 2
		},
		headStyles: { fillColor: [
			31,
			41,
			71
		] },
		tableWidth: 240
	});
	autoTable(doc, {
		startY: 104,
		margin: { left: 300 },
		head: [[
			"#",
			"Selection",
			"Match",
			"Tournament",
			"Surf",
			"Matrix",
			"WP",
			"Bucket",
			"VWR",
			"Ind.",
			"Ind. range",
			"Calib.",
			"Ev",
			"Color",
			"Action",
			"%"
		]],
		body: rows.map((r, i) => [
			i + 1,
			r.selection,
			r.matchLabel,
			r.tournament,
			r.surface,
			r.matrixPick,
			r.matrixWp,
			r.bucket ?? "—",
			r.verifiedWinRate != null ? `${r.verifiedWinRate}%` : "—",
			r.independentWinner,
			r.independentRange,
			r.calibratedRange,
			r.evidence,
			r.color,
			r.action,
			`${r.completion}%`
		]),
		styles: {
			fontSize: 6.5,
			cellPadding: 2
		},
		headStyles: { fillColor: [
			31,
			41,
			71
		] },
		didParseCell: (data) => {
			if (data.section !== "body") return;
			const row = rows[data.row.index];
			if (!row?.bucket) return;
			const rgb = BUCKET_RGB[row.bucket];
			if (rgb && data.column.index <= 12) data.cell.styles.fillColor = rgb;
		}
	});
	doc.save(`tennis-master-audit-${now.toISOString().slice(0, 10)}.pdf`);
}
//#endregion
export { buildBoardPdf as t };
