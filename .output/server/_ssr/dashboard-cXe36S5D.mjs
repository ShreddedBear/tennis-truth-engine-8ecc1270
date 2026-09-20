import { l as winRate } from "./audit-engine-Cw9Ig-Oc.mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { g as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { i as createServerFn } from "./server-KPZuT5q2.mjs";
import { t as createSsrRpc } from "./createSsrRpc-DDIv2aCY.mjs";
import { i as fetchDashboardScreen } from "./screen-queries.functions-DIVmn9AK.mjs";
import { n as BucketBadge } from "./StatusBadge-C2X-g8GE.mjs";
import { t as Button } from "./button-DRsC1qZi.mjs";
import { i as useQueryClient, n as useQuery, t as useMutation } from "../_libs/tanstack__react-query.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { t as useServerFn } from "./useServerFn-CrZF2pjq.mjs";
import { a as activeSlateMatchIds, o as currentAuditRows } from "./router-Dsf2sjop.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/dashboard-cXe36S5D.js
var import_jsx_runtime = require_jsx_runtime();
/**
* Clears the entire operational prediction slate: uploaded matches, every audit_runs row
* and everything computed from them (metrics, verification, disagreement, underdog,
* stress, final decisions, coverage, execution logs, result grades), match identity/
* dedup records, summary versions/uploads, and the prediction slate row itself.
*
* Nothing here is soft-deleted, retired, or archived. Global reference data --
* players, tournaments, the metric registry, rules, calibration configuration, source
* observations, the runtime tennis index -- is untouched: none of it is reachable from
* `matches` by any foreign key, and clear_operational_slate() never references it.
*/
var resetOperationalSlate = createServerFn({ method: "POST" }).inputValidator((data) => {
	if (data?.confirm !== "CLEAR SLATE") throw new Error("Clear slate confirmation is required");
	return data;
}).handler(createSsrRpc("1aa5fdb1585cfcb509dd0408ad640a15d199a963bf86a0b5f6f2b4bbe4a44412"));
var APP_BUILD_INFO = {
	"commit": "a85437d32d44",
	"builtAt": "2026-09-14T09:56:46.796Z"
};
function Dashboard() {
	const queryClient = useQueryClient();
	const resetSlate = useServerFn(resetOperationalSlate);
	const { data } = useQuery({
		queryKey: ["dashboard"],
		queryFn: async () => {
			const { matches, runs, decisions, version, uploads, slateVersions, buckets } = await fetchDashboardScreen();
			const slateMatchIds = activeSlateMatchIds(slateVersions);
			const slateUploadIds = new Set(slateVersions.filter((row) => row.is_active === true).map((row) => row.upload_id));
			const slateMatches = matches.filter((match) => slateMatchIds.has(match.id));
			return {
				matches: slateMatches,
				currentRows: currentAuditRows(slateMatches, runs, decisions),
				version,
				buckets,
				uploads: [...slateUploadIds].filter((id) => uploads.some((upload) => upload.id === id)).length
			};
		}
	});
	const clearMutation = useMutation({
		mutationFn: async () => {
			if (!window.confirm("Clear the operational slate to 0? This removes uploaded match/slate/audit run data but preserves calibration, rules, and historical evidence.")) throw new Error("CANCELLED");
			return resetSlate({ data: { confirm: "CLEAR SLATE" } });
		},
		onSuccess: async (result) => {
			await queryClient.invalidateQueries();
			toast.success(`Slate cleared: ${result.deleted.matches} matches and ${result.deleted.uploads} uploads removed.`);
		},
		onError: (error) => {
			if (error.message === "CANCELLED") return;
			toast.error(`Could not clear slate: ${error.message}`);
		}
	});
	const completed = data?.currentRows.filter((row) => row.decision?.audit_complete) ?? [];
	const colorCount = (c) => completed.filter((row) => row.decision?.final_audit_color === c).length;
	const builtAt = APP_BUILD_INFO.builtAt ? new Date(APP_BUILD_INFO.builtAt) : null;
	const buildLabel = builtAt && !Number.isNaN(builtAt.getTime()) ? builtAt.toLocaleString() : "development build";
	const tiles = [
		{
			label: "Matches on slate",
			value: data?.matches.length ?? 0
		},
		{
			label: "Summary PDFs ingested",
			value: data?.uploads ?? 0
		},
		{
			label: "Double Green",
			value: colorCount("DOUBLE GREEN")
		},
		{
			label: "Green",
			value: colorCount("GREEN")
		},
		{
			label: "Yellow",
			value: colorCount("YELLOW")
		},
		{
			label: "Red / Pass",
			value: colorCount("RED / PASS")
		},
		{
			label: "Insufficient evidence",
			value: colorCount("INSUFFICIENT EVIDENCE")
		},
		{
			label: "Incomplete",
			value: (data?.currentRows.length ?? 0) - completed.length
		}
	];
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap items-center gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "text-xl font-semibold",
					children: "Audit dashboard"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "rounded-md border border-border bg-muted px-2.5 py-1 text-[11px] text-muted-foreground",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "font-semibold text-foreground",
							children: "UPDATED"
						}),
						" ",
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "mono-num",
							children: buildLabel
						}),
						" · ",
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "mono-num",
							children: ["commit ", APP_BUILD_INFO.commit]
						})
					]
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm text-muted-foreground",
				children: "Batch status is independent of match status: one blocked match never stops the slate."
			})] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8",
				children: tiles.map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "panel p-4",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mono-num text-2xl font-semibold",
						children: t.value
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 text-xs text-muted-foreground",
						children: t.label
					})]
				}, t.label))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap items-center gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					variant: "outline",
					disabled: clearMutation.isPending,
					onClick: () => clearMutation.mutate(),
					children: clearMutation.isPending ? "Clearing slate…" : "Clear slate to 0"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-xs text-muted-foreground",
					children: "Preserves the 183 calibration record, audit definitions, and imported historical evidence."
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "panel p-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center justify-between",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h2", {
							className: "font-semibold",
							children: ["Active calibration — ", data?.version?.label ?? "not initialised"]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
							to: "/app/calibration",
							className: "text-sm text-primary underline-offset-4 hover:underline",
							children: "Open calibration"
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mono-num mt-1 text-xs text-muted-foreground",
						children: [
							"Master record sequence: ",
							data?.version?.master_sequence_count ?? 0,
							" · Graded calibration sample:",
							" ",
							data?.version?.graded_sample_count ?? 0
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4",
						children: data?.buckets.map((b) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "rounded-md border border-border p-3",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BucketBadge, {
									code: b.bucket_code,
									children: b.bucket_label
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "mono-num mt-2 text-sm",
									children: [
										b.wins,
										"/",
										b.graded,
										" · ",
										winRate(b.wins, b.graded) ?? "—",
										"%"
									]
								}),
								b.small_sample && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-[11px] font-medium text-warn",
									children: "SMALL SAMPLE"
								})
							]
						}, b.id))
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "panel p-4",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "font-semibold",
					children: "Pipeline"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ol", {
					className: "mono-num mt-2 grid gap-1 text-xs text-muted-foreground md:grid-cols-2",
					children: [
						"Summary PDF ingestion",
						"Match identity verification",
						"Pre-match research lock",
						"P1 vs P2 full metrics",
						"Reconstruction of permitted metrics",
						"Independent evidence conclusion",
						"Verification Audit",
						"Disagreement / Trap Audit",
						"Dangerous Underdog Audit",
						"Stress / component-removal tests",
						"Matrix reveal and comparison",
						"Calibration application",
						"Final Combination Gate",
						"Master ranked board + PDF report"
					].map((s, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [
						String(i + 1).padStart(2, "0"),
						" — ",
						s
					] }, s))
				})]
			})
		]
	});
}
//#endregion
export { Dashboard as component };
