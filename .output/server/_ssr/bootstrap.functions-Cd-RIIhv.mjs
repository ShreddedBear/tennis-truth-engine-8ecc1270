import { i as createServerFn } from "./server-KPZuT5q2.mjs";
import { t as createServerRpc } from "./createServerRpc-BLr1vCfx.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/bootstrap.functions-Cd-RIIhv.js
var ensureBootstrapped_createServerFn_handler = createServerRpc({
	id: "dec04ff8509ade9639271594d872ef0d8a91e1ba50c88ab25627721958d4e446",
	name: "ensureBootstrapped",
	filename: "src/lib/bootstrap.functions.ts"
}, (opts) => ensureBootstrapped.__executeServer(opts));
var ensureBootstrapped = createServerFn({ method: "POST" }).handler(ensureBootstrapped_createServerFn_handler, async () => {
	const { ensureBootstrapped: seed } = await import("./bootstrap.server-BTNrKSZ2.mjs");
	const { LOCAL_WORKSPACE_ID } = await import("./constants-DloZsw4H.mjs").then((n) => n.c).then((n) => n.c);
	await seed(LOCAL_WORKSPACE_ID);
	return { ok: true };
});
//#endregion
export { ensureBootstrapped_createServerFn_handler };
