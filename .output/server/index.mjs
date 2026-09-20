globalThis.__nitro_main__ = import.meta.url;
import { i as serve, r as NodeResponse } from "./_libs/h3-v2+rou3+srvx.mjs";
import { i as toEventHandler, n as defineHandler, o as HTTPError, r as defineLazyEventHandler, t as H3Core } from "./_libs/h3+rou3+srvx.mjs";
import { i as withoutTrailingSlash, n as joinURL, r as withLeadingSlash, t as decodePath } from "./_libs/ufo.mjs";
import { promises } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
//#region #nitro-vite-setup
function lazyService(loader) {
	let promise, mod;
	return { fetch(req) {
		if (mod) return mod.fetch(req);
		if (!promise) promise = loader().then((_mod) => mod = _mod.default || _mod);
		return promise.then((mod) => mod.fetch(req));
	} };
}
var services = { ["ssr"]: lazyService(() => import("./_ssr/ssr.mjs")) };
globalThis.__nitro_vite_envs__ = services;
//#endregion
//#region node_modules/nitro/dist/runtime/internal/route-rules.mjs
var headers = ((m) => function headersRouteRule(event) {
	for (const [key, value] of Object.entries(m.options || {})) event.res.headers.set(key, value);
});
//#endregion
//#region #nitro/virtual/public-assets-data
var public_assets_data_default = {
	"/robots.txt": {
		"type": "text/plain; charset=utf-8",
		"etag": "\"a0-CKGXSIe7TSsqDTmGm/nY1t/o5d0\"",
		"mtime": "2026-09-14T09:56:50.554Z",
		"size": 160,
		"path": "../public/robots.txt"
	},
	"/assets/StatusBadge-cj-pC7Gw.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"4ff-x43nEIRlLJoPoMpdY+46PffJIJ4\"",
		"mtime": "2026-09-14T09:56:49.541Z",
		"size": 1279,
		"path": "../public/assets/StatusBadge-cj-pC7Gw.js"
	},
	"/assets/ProgressBar-DXFR70ce.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"194e-yywXaroMHk7sF270ugfkuBBsVC8\"",
		"mtime": "2026-09-14T09:56:49.541Z",
		"size": 6478,
		"path": "../public/assets/ProgressBar-DXFR70ce.js"
	},
	"/assets/audit-engine-CKJjFHpV.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"94ae-FaRrR6io8+d0P4KkXso63nlx4Rc\"",
		"mtime": "2026-09-14T09:56:49.541Z",
		"size": 38062,
		"path": "../public/assets/audit-engine-CKJjFHpV.js"
	},
	"/assets/board-d4v2fgWm.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"10eb-DXEIVtG3jqd8Y4vXu4srwT+n27A\"",
		"mtime": "2026-09-14T09:56:49.541Z",
		"size": 4331,
		"path": "../public/assets/board-d4v2fgWm.js"
	},
	"/assets/button-BLMWG3XY.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"7d01-KhFi2zeAMpsMld255aHO5Vsi2q0\"",
		"mtime": "2026-09-14T09:56:49.541Z",
		"size": 32001,
		"path": "../public/assets/button-BLMWG3XY.js"
	},
	"/assets/audit-stages-D1aZphif.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"456-R2MJMsR6vRWEFTY5W3HRurQb1IQ\"",
		"mtime": "2026-09-14T09:56:49.541Z",
		"size": 1110,
		"path": "../public/assets/audit-stages-D1aZphif.js"
	},
	"/assets/constants-CGFi9drw.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"582-HpNRF4Cp7nlvyJl/Z2GuyL75n/0\"",
		"mtime": "2026-09-14T09:56:49.541Z",
		"size": 1410,
		"path": "../public/assets/constants-CGFi9drw.js"
	},
	"/assets/createServerFn-Dcyi90rU.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"9660-LnRg3zjrnqWfmtvTF9wlaLF3MqE\"",
		"mtime": "2026-09-14T09:56:49.541Z",
		"size": 38496,
		"path": "../public/assets/createServerFn-Dcyi90rU.js"
	},
	"/assets/calibration-history-CZnhfwEI.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"61f-yuwosw1+xllA5bthYB5tYIfOYZI\"",
		"mtime": "2026-09-14T09:56:49.541Z",
		"size": 1567,
		"path": "../public/assets/calibration-history-CZnhfwEI.js"
	},
	"/assets/html2canvas-CqRbOVeq.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"30b50-QEa674yfN0aLojv054Nml99/Nm8\"",
		"mtime": "2026-09-14T09:56:49.541Z",
		"size": 199504,
		"path": "../public/assets/html2canvas-CqRbOVeq.js"
	},
	"/assets/index-BoewZgMx.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"50d12-UzkUZd3OA68qkWaJfAmRZaGY8zM\"",
		"mtime": "2026-09-14T09:56:49.534Z",
		"size": 331026,
		"path": "../public/assets/index-BoewZgMx.js"
	},
	"/assets/index.es-Miah68e2.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"24f97-/ZvlqdvuojXh3fA27KJQ3JdZ5CY\"",
		"mtime": "2026-09-14T09:56:49.541Z",
		"size": 151447,
		"path": "../public/assets/index.es-Miah68e2.js"
	},
	"/assets/input-B4VWVLp8.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"298-rESvZzQyvsLc6iKHHPNYJD6Rui0\"",
		"mtime": "2026-09-14T09:56:49.541Z",
		"size": 664,
		"path": "../public/assets/input-B4VWVLp8.js"
	},
	"/assets/jspdf.es.min-Bi0wkmN4.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"6175a-0rRnc+LvQTSSPUZqqkG2Z7LuWnw\"",
		"mtime": "2026-09-14T09:56:49.541Z",
		"size": 399194,
		"path": "../public/assets/jspdf.es.min-Bi0wkmN4.js"
	},
	"/assets/jspdf.plugin.autotable-knrFLnck.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"741c-rx5AX1Lf1RWlDQywBPhO9rf/Vas\"",
		"mtime": "2026-09-14T09:56:49.542Z",
		"size": 29724,
		"path": "../public/assets/jspdf.plugin.autotable-knrFLnck.js"
	},
	"/assets/jsx-runtime-1bZotngY.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1f18-aK6f2Ugn+ma0PdyrKN+oIggqloY\"",
		"mtime": "2026-09-14T09:56:49.542Z",
		"size": 7960,
		"path": "../public/assets/jsx-runtime-1bZotngY.js"
	},
	"/assets/link-CMZrwHPQ.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"5b13-KAvCSA/E44LKA6LhiWxeWJ00fGU\"",
		"mtime": "2026-09-14T09:56:49.542Z",
		"size": 23315,
		"path": "../public/assets/link-CMZrwHPQ.js"
	},
	"/assets/list-checks-DJMZHHRy.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"62a-puZLX2O2TXDQhwbbrQviYliSu3Y\"",
		"mtime": "2026-09-14T09:56:49.542Z",
		"size": 1578,
		"path": "../public/assets/list-checks-DJMZHHRy.js"
	},
	"/assets/logs-DLf2Ip5p.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"a8a-DaLbT7HnxCQcIn4UkMzfG0UCLl0\"",
		"mtime": "2026-09-14T09:56:49.542Z",
		"size": 2698,
		"path": "../public/assets/logs-DLf2Ip5p.js"
	},
	"/assets/match._matchId-DukRa-ch.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"11540-JLe7SxJa6wj/sjSslgotoMItv/o\"",
		"mtime": "2026-09-14T09:56:49.542Z",
		"size": 70976,
		"path": "../public/assets/match._matchId-DukRa-ch.js"
	},
	"/assets/pdf-Di1oKo1-.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"75bf1-7MoaYNGMd3rSFvjkZoCMN5HQnL4\"",
		"mtime": "2026-09-14T09:56:49.542Z",
		"size": 482289,
		"path": "../public/assets/pdf-Di1oKo1-.js"
	},
	"/assets/dashboard-Bh87gWTP.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"14fe-Zj6BAs61hPDTFOZtEfsZe4nUR6Q\"",
		"mtime": "2026-09-14T09:56:49.541Z",
		"size": 5374,
		"path": "../public/assets/dashboard-Bh87gWTP.js"
	},
	"/assets/calibration-BLpfiBni.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1b3e-9wedGX1npOzc8daOjk+Ex4r7W4w\"",
		"mtime": "2026-09-14T09:56:49.541Z",
		"size": 6974,
		"path": "../public/assets/calibration-BLpfiBni.js"
	},
	"/assets/pdf.worker.min-B4zcPW5M.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"41-cbDCECNxKYfhI1l1bafH5qjpE1Q\"",
		"mtime": "2026-09-14T09:56:49.542Z",
		"size": 65,
		"path": "../public/assets/pdf.worker.min-B4zcPW5M.js"
	},
	"/assets/pipeline-client-error-BH0Etj55.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"4db-6uCu9HgXboqqY2awOYXGezJytU0\"",
		"mtime": "2026-09-14T09:56:49.542Z",
		"size": 1243,
		"path": "../public/assets/pipeline-client-error-BH0Etj55.js"
	},
	"/assets/purify.es-ChwZkWde.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"68bc-bPPRDEosU/Lqj+2Oyi1ue22LViM\"",
		"mtime": "2026-09-14T09:56:49.542Z",
		"size": 26812,
		"path": "../public/assets/purify.es-ChwZkWde.js"
	},
	"/assets/react-dom-BIg0EzVA.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"e0a-5WRenFTvvxLrNy/a/apaG7il+34\"",
		"mtime": "2026-09-14T09:56:49.542Z",
		"size": 3594,
		"path": "../public/assets/react-dom-BIg0EzVA.js"
	},
	"/assets/report-pdf-Vp5jJPZD.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"9fb-ykBR6uMsS9V4j4Uzh645409NUI4\"",
		"mtime": "2026-09-14T09:56:49.542Z",
		"size": 2555,
		"path": "../public/assets/report-pdf-Vp5jJPZD.js"
	},
	"/assets/reports-Lhybh7el.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"43c-Ad7UciLuagnIbxc+nj9OQsBIb6Y\"",
		"mtime": "2026-09-14T09:56:49.542Z",
		"size": 1084,
		"path": "../public/assets/reports-Lhybh7el.js"
	},
	"/assets/rolldown-runtime-C0FnF6B9.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"50b-+WBETyVi3nVwvAsJ9zqeHfutBiA\"",
		"mtime": "2026-09-14T09:56:49.542Z",
		"size": 1291,
		"path": "../public/assets/rolldown-runtime-C0FnF6B9.js"
	},
	"/assets/route-B0yEe7A5.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"133f-5+F3xVXOc5w/tM48z5CMbz8FLMw\"",
		"mtime": "2026-09-14T09:56:49.542Z",
		"size": 4927,
		"path": "../public/assets/route-B0yEe7A5.js"
	},
	"/assets/routes-DMxkEAbQ.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"b2e-I4koyOWTkwe48IJQgqf+JeicqI0\"",
		"mtime": "2026-09-14T09:56:49.542Z",
		"size": 2862,
		"path": "../public/assets/routes-DMxkEAbQ.js"
	},
	"/assets/rules-CuYoVwk5.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"c29-Ne9zTbCi3zXbUF4G+cwvoOvpg3Y\"",
		"mtime": "2026-09-14T09:56:49.542Z",
		"size": 3113,
		"path": "../public/assets/rules-CuYoVwk5.js"
	},
	"/assets/slate-B3l9SXOj.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1b5d-VYCckyWMh72bB9xfEq5YoE2afzw\"",
		"mtime": "2026-09-14T09:56:49.542Z",
		"size": 7005,
		"path": "../public/assets/slate-B3l9SXOj.js"
	},
	"/assets/sources-DIstZTAG.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"da9-YwU3BI4Nr+/ud/meUmgCNgRPT/8\"",
		"mtime": "2026-09-14T09:56:49.542Z",
		"size": 3497,
		"path": "../public/assets/sources-DIstZTAG.js"
	},
	"/assets/src-DmKmB1iY.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"4a22-hVsm8UrG2ZL5P1WOV2ACj5DFphc\"",
		"mtime": "2026-09-14T09:56:49.542Z",
		"size": 18978,
		"path": "../public/assets/src-DmKmB1iY.js"
	},
	"/assets/styles-9lG4UOaG.css": {
		"type": "text/css; charset=utf-8",
		"etag": "\"11f8e-I6TA3lKCvkKz+sNdLofxMuV1Ouk\"",
		"mtime": "2026-09-14T09:56:49.543Z",
		"size": 73614,
		"path": "../public/assets/styles-9lG4UOaG.css"
	},
	"/assets/upload-BVkf3BZF.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"46cb-Tnklio/ZMD/nbtKl2mfqETA3ehs\"",
		"mtime": "2026-09-14T09:56:49.542Z",
		"size": 18123,
		"path": "../public/assets/upload-BVkf3BZF.js"
	},
	"/assets/useMatch-DZc-f0ka.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2d3-6QMU/ljTQ0uvZx7wvbn4V8djzJo\"",
		"mtime": "2026-09-14T09:56:49.542Z",
		"size": 723,
		"path": "../public/assets/useMatch-DZc-f0ka.js"
	},
	"/assets/useMutation-CukR5TRo.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"8f6-EkiV72RBvtsc4PaYND1ha30WyLo\"",
		"mtime": "2026-09-14T09:56:49.542Z",
		"size": 2294,
		"path": "../public/assets/useMutation-CukR5TRo.js"
	},
	"/assets/useRouter-Z87ImlJn.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"c3-Eepzm0RWANvHaNdrse0jCGWEgDU\"",
		"mtime": "2026-09-14T09:56:49.542Z",
		"size": 195,
		"path": "../public/assets/useRouter-Z87ImlJn.js"
	},
	"/assets/useServerFn-B63ep7a_.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1ca-Z/3Irjef+HpryhjDkDaqKBDc8A4\"",
		"mtime": "2026-09-14T09:56:49.542Z",
		"size": 458,
		"path": "../public/assets/useServerFn-B63ep7a_.js"
	},
	"/favicon.ico": {
		"type": "image/vnd.microsoft.icon",
		"etag": "\"4f95-3RXc3p2mhEAs1WBwaIvE0Y0uu0Y\"",
		"mtime": "2026-09-14T09:56:50.552Z",
		"size": 20373,
		"path": "../public/favicon.ico"
	},
	"/seed/disagreement.txt": {
		"type": "text/plain; charset=utf-8",
		"etag": "\"195fb-Ei0SMXg7cUjcuCrM62pn/gX1zSY\"",
		"mtime": "2026-09-14T09:56:50.552Z",
		"size": 103931,
		"path": "../public/seed/disagreement.txt"
	},
	"/seed/metrics.txt": {
		"type": "text/plain; charset=utf-8",
		"etag": "\"13911-p1Y7UZfQBOyVSr9zN9aKhLz1SVc\"",
		"mtime": "2026-09-14T09:56:50.552Z",
		"size": 80145,
		"path": "../public/seed/metrics.txt"
	},
	"/seed/verification.txt": {
		"type": "text/plain; charset=utf-8",
		"etag": "\"13889-XzXgypaGdGhZdE1qwWZe7ySzHyc\"",
		"mtime": "2026-09-14T09:56:50.552Z",
		"size": 80009,
		"path": "../public/seed/verification.txt"
	},
	"/assets/pdf.worker.min-CLrFZWeq.mjs": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1406c4-2xh2v38BxDlLuSJucfvFXImtyCI\"",
		"mtime": "2026-09-14T09:56:49.542Z",
		"size": 1312452,
		"path": "../public/assets/pdf.worker.min-CLrFZWeq.mjs"
	},
	"/generated/tennis-runtime-index.json.gz": {
		"type": "application/json",
		"encoding": "gzip",
		"etag": "\"5da1b8-sQqa4qWPpBTCUEwo17YvZ6PTfRE\"",
		"mtime": "2026-09-14T09:56:50.552Z",
		"size": 6136248,
		"path": "../public/generated/tennis-runtime-index.json.gz"
	}
};
//#endregion
//#region #nitro/virtual/public-assets-node
function readAsset(id) {
	const serverDir = dirname(fileURLToPath(globalThis.__nitro_main__));
	return promises.readFile(resolve(serverDir, public_assets_data_default[id].path));
}
//#endregion
//#region #nitro/virtual/public-assets
var publicAssetBases = {};
function isPublicAssetURL(id = "") {
	if (public_assets_data_default[id]) return true;
	for (const base in publicAssetBases) if (id.startsWith(base)) return true;
	return false;
}
function getAsset(id) {
	return public_assets_data_default[id];
}
//#endregion
//#region node_modules/nitro/dist/runtime/internal/static.mjs
var METHODS = /* @__PURE__ */ new Set(["HEAD", "GET"]);
var EncodingMap = {
	gzip: ".gz",
	br: ".br",
	zstd: ".zst"
};
var static_default = defineHandler((event) => {
	if (event.req.method && !METHODS.has(event.req.method)) return;
	let id = decodePath(withLeadingSlash(withoutTrailingSlash(event.url.pathname)));
	let asset;
	const encodings = [...(event.req.headers.get("accept-encoding") || "").split(",").map((e) => EncodingMap[e.trim()]).filter(Boolean).sort(), ""];
	for (const encoding of encodings) for (const _id of [id + encoding, joinURL(id, "index.html" + encoding)]) {
		const _asset = getAsset(_id);
		if (_asset) {
			asset = _asset;
			id = _id;
			break;
		}
	}
	if (!asset) {
		if (isPublicAssetURL(id)) {
			event.res.headers.delete("Cache-Control");
			throw new HTTPError({ status: 404 });
		}
		return;
	}
	if (encodings.length > 1) event.res.headers.append("Vary", "Accept-Encoding");
	if (event.req.headers.get("if-none-match") === asset.etag) {
		event.res.status = 304;
		event.res.statusText = "Not Modified";
		return "";
	}
	const ifModifiedSinceH = event.req.headers.get("if-modified-since");
	const mtimeDate = new Date(asset.mtime);
	if (ifModifiedSinceH && asset.mtime && new Date(ifModifiedSinceH) >= mtimeDate) {
		event.res.status = 304;
		event.res.statusText = "Not Modified";
		return "";
	}
	if (asset.type) event.res.headers.set("Content-Type", asset.type);
	if (asset.etag && !event.res.headers.has("ETag")) event.res.headers.set("ETag", asset.etag);
	if (asset.mtime && !event.res.headers.has("Last-Modified")) event.res.headers.set("Last-Modified", mtimeDate.toUTCString());
	if (asset.encoding && !event.res.headers.has("Content-Encoding")) event.res.headers.set("Content-Encoding", asset.encoding);
	if (asset.size > 0 && !event.res.headers.has("Content-Length")) event.res.headers.set("Content-Length", asset.size.toString());
	return readAsset(id);
});
//#endregion
//#region #nitro/virtual/routing
var findRouteRules = /* @__PURE__ */ (() => {
	const $0 = [{
		name: "headers",
		route: "/assets/**",
		handler: headers,
		options: { "cache-control": "public, max-age=31536000, immutable" }
	}];
	return (m, p) => {
		let r = [];
		if (p.charCodeAt(p.length - 1) === 47) p = p.slice(0, -1) || "/";
		let s = p.split("/");
		if (s.length > 1) {
			if (s[1] === "assets") r.unshift({
				data: $0,
				params: { "_": s.slice(2).join("/") }
			});
		}
		return r;
	};
})();
var _lazy_JShPQo = defineLazyEventHandler(() => import("./_chunks/ssr-renderer.mjs"));
var findRoute = /* @__PURE__ */ (() => {
	const data = {
		route: "/**",
		handler: _lazy_JShPQo
	};
	return ((_m, p) => {
		return {
			data,
			params: { "_": p.slice(1) }
		};
	});
})();
var globalMiddleware = [toEventHandler(static_default)].filter(Boolean);
//#endregion
//#region node_modules/nitro/dist/runtime/internal/error/prod.mjs
var errorHandler = (error, event) => {
	const res = defaultHandler(error, event);
	return new NodeResponse(typeof res.body === "string" ? res.body : JSON.stringify(res.body, null, 2), res);
};
function defaultHandler(error, event) {
	const unhandled = error.unhandled ?? !HTTPError.isError(error);
	const { status = 500, statusText = "" } = unhandled ? {} : error;
	if (status === 404) {
		const url = event.url || new URL(event.req.url);
		const baseURL = "/";
		if (/^\/[^/]/.test(baseURL) && !url.pathname.startsWith(baseURL)) return {
			status: 302,
			headers: new Headers({ location: `${baseURL}${url.pathname.slice(1)}${url.search}` })
		};
	}
	const headers = new Headers(unhandled ? {} : error.headers);
	headers.set("content-type", "application/json; charset=utf-8");
	return {
		status,
		statusText,
		headers,
		body: {
			error: true,
			...unhandled ? {
				status,
				unhandled: true
			} : typeof error.toJSON === "function" ? error.toJSON() : {
				status,
				statusText,
				message: error.message
			}
		}
	};
}
//#endregion
//#region #nitro/virtual/error-handler
var errorHandlers = [errorHandler];
async function error_handler_default(error, event) {
	for (const handler of errorHandlers) try {
		const response = await handler(error, event, { defaultHandler });
		if (response) return response;
	} catch (error) {
		console.error(error);
	}
}
//#endregion
//#region #nitro/virtual/app
function createNitroApp() {
	const captureError = (error, errorCtx) => {
		if (errorCtx?.event) {
			const errors = errorCtx.event.req.context?.nitro?.errors;
			if (errors) errors.push({
				error,
				context: errorCtx
			});
		}
	};
	const h3App = createH3App({ onError(error, event) {
		return error_handler_default(error, event);
	} });
	let appHandler = (req) => {
		req.context ||= {};
		req.context.nitro = req.context.nitro || { errors: [] };
		return h3App.fetch(req);
	};
	return {
		fetch: appHandler,
		h3: h3App,
		hooks: void 0,
		captureError
	};
}
function createH3App(config) {
	const h3App = new H3Core(config);
	h3App["~findRoute"] = (event) => findRoute(event.req.method, event.url.pathname);
	h3App["~middleware"].push(...globalMiddleware);
	h3App["~getMiddleware"] = (event, route) => {
		const pathname = event.url.pathname;
		const method = event.req.method;
		const middleware = [];
		const routeRules = getRouteRules(method, pathname);
		event.context.routeRules = routeRules?.routeRules;
		if (routeRules?.routeRuleMiddleware.length) middleware.push(...routeRules.routeRuleMiddleware);
		middleware.push(...h3App["~middleware"]);
		if (route?.data?.middleware?.length) middleware.push(...route.data.middleware);
		return middleware;
	};
	return h3App;
}
//#endregion
//#region node_modules/nitro/dist/runtime/internal/app.mjs
var APP_ID = "default";
function useNitroApp() {
	let instance = useNitroApp._instance;
	if (instance) return instance;
	instance = useNitroApp._instance = createNitroApp();
	globalThis.__nitro__ = globalThis.__nitro__ || {};
	globalThis.__nitro__[APP_ID] = instance;
	return instance;
}
function getRouteRules(method, pathname) {
	const m = findRouteRules(method, pathname);
	if (!m?.length) return { routeRuleMiddleware: [] };
	const routeRules = {};
	for (const layer of m) for (const rule of layer.data) {
		const currentRule = routeRules[rule.name];
		if (currentRule) {
			if (rule.options === false) {
				delete routeRules[rule.name];
				continue;
			}
			if (typeof currentRule.options === "object" && typeof rule.options === "object") currentRule.options = {
				...currentRule.options,
				...rule.options
			};
			else currentRule.options = rule.options;
			currentRule.route = rule.route;
			currentRule.params = {
				...currentRule.params,
				...layer.params
			};
		} else if (rule.options !== false) routeRules[rule.name] = {
			...rule,
			params: layer.params
		};
	}
	const middleware = [];
	const orderedRules = Object.values(routeRules).sort((a, b) => (a.handler?.order || 0) - (b.handler?.order || 0));
	for (const rule of orderedRules) {
		if (rule.options === false || !rule.handler) continue;
		middleware.push(rule.handler(rule));
	}
	return {
		routeRules,
		routeRuleMiddleware: middleware
	};
}
//#endregion
//#region node_modules/nitro/dist/runtime/internal/error/hooks.mjs
function _captureError(error, type) {
	console.error(`[${type}]`, error);
	useNitroApp().captureError?.(error, { tags: [type] });
}
function trapUnhandledErrors() {
	process.on("unhandledRejection", (error) => _captureError(error, "unhandledRejection"));
	process.on("uncaughtException", (error) => _captureError(error, "uncaughtException"));
}
//#endregion
//#region #nitro/virtual/tracing
var tracingSrvxPlugins = [];
//#endregion
//#region node_modules/nitro/dist/presets/node/runtime/node-server.mjs
var _parsedPort = Number.parseInt(process.env.NITRO_PORT ?? process.env.PORT ?? "");
var port = Number.isNaN(_parsedPort) ? 3e3 : _parsedPort;
var host = process.env.NITRO_HOST || process.env.HOST;
var cert = process.env.NITRO_SSL_CERT;
var key = process.env.NITRO_SSL_KEY;
var nitroApp = useNitroApp();
serve({
	port,
	hostname: host,
	tls: cert && key ? {
		cert,
		key
	} : void 0,
	fetch: nitroApp.fetch,
	plugins: [...tracingSrvxPlugins]
});
trapUnhandledErrors();
var node_server_default = {};
//#endregion
export { node_server_default as default };
