import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { t as fetchBoardScreen } from "./screen-queries.functions-DIVmn9AK.mjs";
import { n as BucketBadge, t as AuditColorBadge } from "./StatusBadge-C2X-g8GE.mjs";
import { t as Button } from "./button-DRsC1qZi.mjs";
import { t as buildBoardPdf } from "./report-pdf-Dl1ytcAD.mjs";
import { n as useQuery } from "../_libs/tanstack__react-query.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { a as activeSlateMatchIds, o as currentAuditRows } from "./router-Dsf2sjop.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/board-BYVo2itj.js
var import_jsx_runtime = require_jsx_runtime();
var ORDER = [
	"DOUBLE GREEN",
	"GREEN",
	"YELLOW",
	"RED / PASS",
	"INCOMPLETE"
];
function useBoardRows() {
	return useQuery({
		queryKey: ["board"],
		queryFn: async () => {
			const { decisions, runs, matches, fields, versions } = await fetchBoardScreen();
			const matrixFor = (matchId, key) => {
				const sv = versions?.find((v) => v.match_id === matchId && v.is_active);
				if (!sv) return null;
				return fields?.find((f) => f.summary_version_id === sv.id && f.field_key === key)?.normalized_value ?? null;
			};
			const slateMatchIds = activeSlateMatchIds(versions);
			const activeMatches = matches.filter((match) => slateMatchIds.has(match.id));
			return currentAuditRows(activeMatches, runs, decisions).filter((row) => row.decision).map(({ match, run, decision: d }) => {
				const snapshot = d.gate_report?.calibration_snapshot;
				const frozenRange = snapshot?.calibratedLow != null && snapshot?.calibratedHigh != null ? `${snapshot.calibratedLow}–${snapshot.calibratedHigh}%` : null;
				return {
					matchLabel: `${match.player1_name} vs ${match.player2_name}`,
					selection: d.final_selection ?? run?.independent_winner ?? "—",
					tournament: match?.tournament_name ?? "—",
					surface: match?.surface ?? "—",
					matrixPick: matrixFor(match.id, "matrix_predicted_winner") ?? "—",
					matrixWp: matrixFor(match.id, "matrix_wp") ?? "—",
					bucket: d.calibration_bucket,
					verifiedWinRate: d.verified_win_rate,
					independentWinner: run?.independent_winner ?? "—",
					independentRange: run?.independent_low != null ? `${run.independent_low}–${run.independent_high}%` : "—",
					calibratedRange: frozenRange ?? (run?.calibrated_low != null ? `${run.calibrated_low}–${run.calibrated_high}%` : "—"),
					evidence: run?.effective_evidence_count ?? 0,
					color: d.audit_complete ? d.final_audit_color : "INCOMPLETE",
					action: d.action ?? "—",
					completion: Number(d.completion_percent)
				};
			});
		}
	});
}
function Board() {
	const { data } = useBoardRows();
	const rows = [...data ?? []].sort((a, b) => {
		const o = ORDER.indexOf(a.color) - ORDER.indexOf(b.color);
		if (o !== 0) return o;
		return (b.verifiedWinRate ?? -1) - (a.verifiedWinRate ?? -1);
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-4",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex items-center justify-between",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "text-xl font-semibold",
				children: "Master ranked board"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm text-muted-foreground",
				children: "Primary sort: final audit color. Secondary sort: current calibration verified win rate."
			})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
				onClick: async () => {
					await buildBoardPdf(rows);
					toast.success("Report generated");
				},
				disabled: rows.length === 0,
				children: "Generate PDF report"
			})]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "panel overflow-x-auto",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
				className: "w-full text-sm",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", {
					className: "bg-header text-header-foreground",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tr", {
						className: "text-left",
						children: [
							"#",
							"Final selection",
							"Match",
							"Tournament",
							"Surface",
							"Matrix pick",
							"Matrix WP",
							"Bucket",
							"Verified WR",
							"Independent",
							"Ind. range",
							"Calibrated",
							"Evidence",
							"Color",
							"Action",
							"Completion"
						].map((h) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
							className: "px-2 py-2 text-xs font-semibold uppercase tracking-wide whitespace-nowrap",
							children: h
						}, h))
					})
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tbody", { children: [rows.map((r, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
					className: "border-t border-border",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
							className: "mono-num px-2 py-2",
							children: i + 1
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
							className: "px-2 py-2 font-medium",
							children: r.selection
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
							className: "px-2 py-2",
							children: r.matchLabel
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
							className: "px-2 py-2",
							children: r.tournament
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
							className: "px-2 py-2",
							children: r.surface
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
							className: "px-2 py-2",
							children: r.matrixPick
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
							className: "mono-num px-2 py-2",
							children: r.matrixWp
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
							className: "px-2 py-2",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(BucketBadge, { code: r.bucket })
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
							className: "mono-num px-2 py-2",
							children: [r.verifiedWinRate ?? "—", "%"]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
							className: "px-2 py-2",
							children: r.independentWinner
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
							className: "mono-num px-2 py-2",
							children: r.independentRange
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
							className: "mono-num px-2 py-2",
							children: r.calibratedRange
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
							className: "mono-num px-2 py-2",
							children: r.evidence
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
							className: "px-2 py-2",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AuditColorBadge, { color: r.color })
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
							className: "px-2 py-2",
							children: r.action
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
							className: "mono-num px-2 py-2",
							children: [r.completion, "%"]
						})
					]
				}, i)), rows.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tr", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
					colSpan: 16,
					className: "px-3 py-8 text-center text-sm text-muted-foreground",
					children: "No final decisions yet. Run the Final Combination Gate on a match."
				}) })] })]
			})
		})]
	});
}
//#endregion
export { Board as component, useBoardRows };
