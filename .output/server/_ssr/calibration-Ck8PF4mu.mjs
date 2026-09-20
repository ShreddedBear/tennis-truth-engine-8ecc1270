import { o as __toESM } from "../_runtime.mjs";
import { l as winRate } from "./audit-engine-Cw9Ig-Oc.mjs";
import { o as require_jsx_runtime, s as require_react } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { g as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { i as createServerFn } from "./server-KPZuT5q2.mjs";
import { t as createSsrRpc } from "./createSsrRpc-DDIv2aCY.mjs";
import { r as fetchCalibrationScreen } from "./screen-queries.functions-DIVmn9AK.mjs";
import { n as BucketBadge } from "./StatusBadge-C2X-g8GE.mjs";
import { t as Button } from "./button-DRsC1qZi.mjs";
import { i as useQueryClient, n as useQuery, t as useMutation } from "../_libs/tanstack__react-query.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { t as Input } from "./input-DicJzR9-.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/calibration-Ck8PF4mu.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
/** WIN and LOSS count. Retirements count as real graded results. Walkovers and voids do not. */
var RESULT_TYPES$1 = [
	"WIN",
	"LOSS",
	"RETIREMENT WIN",
	"RETIREMENT LOSS",
	"WALKOVER",
	"VOID"
];
var gradeCalibrationResult = createServerFn({ method: "POST" }).inputValidator((data) => {
	const resultType = String(data?.resultType ?? "").trim();
	if (!RESULT_TYPES$1.includes(resultType)) throw new Error(`"${resultType}" is not a valid result type.`);
	const matchLabel = String(data?.matchLabel ?? "").trim();
	if (!matchLabel) throw new Error("A match label is required.");
	const matrixWp = data?.matrixWp;
	if (matrixWp !== null && matrixWp !== void 0 && !Number.isFinite(Number(matrixWp))) throw new Error("Matrix win probability must be a number or empty.");
	return {
		matchId: data.matchId ?? null,
		matchLabel,
		tournament: data.tournament ?? null,
		surface: data.surface ?? null,
		matchDate: data.matchDate ?? null,
		matrixPredictedWinner: data.matrixPredictedWinner ?? null,
		matrixWp: matrixWp === null || matrixWp === void 0 ? null : Number(matrixWp),
		actualWinner: data.actualWinner ?? null,
		resultType,
		note: data.note ?? void 0
	};
}).handler(createSsrRpc("86e416dde5063bd6e103bf277fd9ab34850d5b05bef3c229e2364a1c31c46e12"));
/** Prefills the grading form from a match's persisted Matrix summary. */
var loadMatrixAutofill = createServerFn({ method: "POST" }).inputValidator((data) => {
	const matchId = String(data?.matchId ?? "").trim();
	if (!matchId) throw new Error("A match id is required.");
	return { matchId };
}).handler(createSsrRpc("da00d342afa07c1e5f894de717574bc3d10cee81c3cc05d2eb787fd1a209bd09"));
var RESULT_TYPES = [
	"WIN",
	"LOSS",
	"RETIREMENT WIN",
	"RETIREMENT LOSS",
	"WALKOVER",
	"VOID"
];
function Calibration() {
	const qc = useQueryClient();
	const [form, setForm] = (0, import_react.useState)({
		matchLabel: "",
		tournament: "",
		surface: "",
		matrixPredictedWinner: "",
		matrixWp: "",
		actualWinner: "",
		resultType: "WIN",
		note: ""
	});
	const [matchId, setMatchId] = (0, import_react.useState)("");
	const [autofillBusy, setAutofillBusy] = (0, import_react.useState)(false);
	const autofillFromSummary = async () => {
		if (!matchId.trim()) return;
		setAutofillBusy(true);
		try {
			const result = await loadMatrixAutofill({ data: { matchId: matchId.trim() } });
			if (!result) {
				toast.error("No match found for that ID, or it has no parsed summary yet.");
				return;
			}
			setForm((f) => ({
				...f,
				matchLabel: result.matchLabel || f.matchLabel,
				tournament: result.tournament ?? f.tournament,
				surface: result.surface ?? f.surface,
				matrixPredictedWinner: result.matrixPredictedWinner ?? f.matrixPredictedWinner,
				matrixWp: result.matrixWp != null ? String(result.matrixWp) : f.matrixWp
			}));
			toast.success("Prediction fields filled from the uploaded summary — actual winner/result still need entering by hand.");
		} finally {
			setAutofillBusy(false);
		}
	};
	const { data } = useQuery({
		queryKey: ["calibration"],
		queryFn: async () => {
			return fetchCalibrationScreen();
		}
	});
	const grade = useMutation({
		mutationFn: () => gradeCalibrationResult({ data: {
			matchId: matchId.trim() || null,
			matchLabel: form.matchLabel,
			tournament: form.tournament || null,
			surface: form.surface || null,
			matchDate: null,
			matrixPredictedWinner: form.matrixPredictedWinner || null,
			matrixWp: form.matrixWp ? Number(form.matrixWp) : null,
			actualWinner: form.actualWinner || null,
			resultType: form.resultType,
			note: form.note
		} }),
		onSuccess: (v) => {
			toast.success(`Result graded — Calibration v${v.versionNumber} is now active`);
			setForm({
				...form,
				matchLabel: "",
				matrixWp: "",
				actualWinner: "",
				note: ""
			});
			qc.invalidateQueries();
		},
		onError: (e) => toast.error(e.message)
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center justify-between",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h1", {
					className: "text-xl font-semibold",
					children: ["Calibration — ", data?.version?.label ?? "not initialised"]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "mono-num text-xs text-muted-foreground",
					children: [
						"Master sequence ",
						data?.version?.master_sequence_count ?? 0,
						" · graded sample",
						" ",
						data?.version?.graded_sample_count ?? 0
					]
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					to: "/app/calibration-history",
					className: "text-sm text-primary underline-offset-4 hover:underline",
					children: "Version history"
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "grid gap-3 sm:grid-cols-2 lg:grid-cols-4",
				children: data?.buckets.map((b) => {
					const rate = winRate(b.wins, b.graded);
					return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "panel p-3",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center justify-between",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BucketBadge, { code: b.bucket_code }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "mono-num text-xs text-muted-foreground",
									children: [
										b.wp_min,
										"–",
										b.wp_max,
										"%"
									]
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "mono-num mt-2 text-2xl font-semibold",
								children: [rate ?? "—", "%"]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "mono-num text-xs text-muted-foreground",
								children: [
									b.wins,
									"/",
									b.graded,
									" graded ",
									b.small_sample ? "· SMALL SAMPLE" : ""
								]
							})
						]
					}, b.id);
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "panel p-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "font-semibold",
						children: "Grade a result"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs text-muted-foreground",
						children: "In-match retirements are graded as real results. Walkovers and voids are recorded but never counted in a bucket."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-3 flex flex-wrap items-center gap-2",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								placeholder: "Match ID (to autofill prediction fields)",
								value: matchId,
								onChange: (e) => setMatchId(e.target.value),
								className: "max-w-xs"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								type: "button",
								variant: "outline",
								size: "sm",
								onClick: autofillFromSummary,
								disabled: !matchId.trim() || autofillBusy,
								children: autofillBusy ? "Loading…" : "Autofill from summary"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-xs text-muted-foreground",
								children: "Fills prediction fields only — actual winner/result always need entering by hand."
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-3 grid gap-2 md:grid-cols-3 lg:grid-cols-4",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								placeholder: "Match label",
								value: form.matchLabel,
								onChange: (e) => setForm({
									...form,
									matchLabel: e.target.value
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								placeholder: "Tournament",
								value: form.tournament,
								onChange: (e) => setForm({
									...form,
									tournament: e.target.value
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								placeholder: "Surface",
								value: form.surface,
								onChange: (e) => setForm({
									...form,
									surface: e.target.value
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								placeholder: "Matrix predicted winner",
								value: form.matrixPredictedWinner,
								onChange: (e) => setForm({
									...form,
									matrixPredictedWinner: e.target.value
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								placeholder: "Matrix WP %",
								value: form.matrixWp,
								onChange: (e) => setForm({
									...form,
									matrixWp: e.target.value
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								placeholder: "Actual winner",
								value: form.actualWinner,
								onChange: (e) => setForm({
									...form,
									actualWinner: e.target.value
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
								className: "h-9 rounded-md border border-input bg-card px-2 text-sm",
								value: form.resultType,
								onChange: (e) => setForm({
									...form,
									resultType: e.target.value
								}),
								children: RESULT_TYPES.map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: r }, r))
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								placeholder: "Note",
								value: form.note,
								onChange: (e) => setForm({
									...form,
									note: e.target.value
								})
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						className: "mt-3",
						onClick: () => grade.mutate(),
						disabled: !form.matchLabel || grade.isPending,
						children: "Grade result & recalculate"
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "panel overflow-x-auto",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
					className: "w-full text-sm",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", {
						className: "bg-header text-header-foreground",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tr", {
							className: "text-left",
							children: [
								"Seq",
								"Match",
								"Tournament",
								"Surface",
								"Matrix pick",
								"WP",
								"Actual",
								"Result",
								"Grading",
								"Bucket",
								"Counted"
							].map((h) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "px-2 py-2 text-xs font-semibold uppercase",
								children: h
							}, h))
						})
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tbody", { children: [data?.ledger.map((l) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
						className: "border-t border-border",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "mono-num px-2 py-1",
								children: l.master_sequence
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "px-2 py-1",
								children: l.match_label
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "px-2 py-1",
								children: l.tournament ?? "—"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "px-2 py-1",
								children: l.surface ?? "—"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "px-2 py-1",
								children: l.matrix_predicted_winner ?? "—"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "mono-num px-2 py-1",
								children: l.matrix_wp ?? "—"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "px-2 py-1",
								children: l.actual_winner ?? "—"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "px-2 py-1",
								children: l.result_type
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "px-2 py-1",
								children: l.result_grading_status
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "px-2 py-1",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(BucketBadge, { code: l.bucket_code })
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "px-2 py-1",
								children: l.counted_in_bucket ? "YES" : "NO"
							})
						]
					}, l.id)), !data?.ledger.length && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tr", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
						colSpan: 11,
						className: "px-3 py-8 text-center text-sm text-muted-foreground",
						children: "Ledger empty — graded results will appear here."
					}) })] })]
				})
			})
		]
	});
}
//#endregion
export { Calibration as component };
