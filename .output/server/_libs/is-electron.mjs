import { t as __commonJSMin } from "../_runtime.mjs";
//#region node_modules/is-electron/index.js
var require_is_electron = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	function isElectron() {
		if (typeof window !== "undefined" && typeof window.process === "object" && window.process.type === "renderer") return true;
		if (typeof process !== "undefined" && typeof process.versions === "object" && !!process.versions.electron) return true;
		if (typeof navigator === "object" && typeof navigator.userAgent === "string" && navigator.userAgent.indexOf("Electron") >= 0) return true;
		return false;
	}
	module.exports = isElectron;
}));
//#endregion
export { require_is_electron as t };
