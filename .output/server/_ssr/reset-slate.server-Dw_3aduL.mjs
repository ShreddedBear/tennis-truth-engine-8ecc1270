import { k as sql } from "../_libs/drizzle-orm.mjs";
import { t as db } from "./client.server-B14ewPcb.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/reset-slate.server-Dw_3aduL.js
async function clearSlateViaDatabase(userId) {
	return (await db.execute(sql`select public.clear_operational_slate(${userId}::uuid) as result`)).rows[0]?.result ?? null;
}
//#endregion
export { clearSlateViaDatabase };
