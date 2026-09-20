//#region node_modules/.nitro/vite/services/ssr/assets/audit-batch-DrO2lEKU.js
function normalizeBatchMatchIds(matchIds, max = 100) {
	if (!Array.isArray(matchIds)) return [];
	return [...new Set(matchIds.filter((id) => typeof id === "string" && id.length >= 10))].slice(0, max);
}
async function mapBounded(items, concurrency, worker) {
	const results = new Array(items.length);
	let next = 0;
	const run = async () => {
		while (next < items.length) {
			const index = next++;
			results[index] = await worker(items[index], index);
		}
	};
	await Promise.all(Array.from({ length: Math.min(items.length, Math.max(1, Math.floor(concurrency))) }, run));
	return results;
}
async function waitForBoundedResult(work, maxWaitMs) {
	let timer;
	const timeout = new Promise((resolve) => {
		timer = setTimeout(() => resolve({ timedOut: true }), Math.max(1, Math.floor(maxWaitMs)));
	});
	const completed = work.then((value) => ({
		timedOut: false,
		value
	}));
	const result = await Promise.race([completed, timeout]);
	if (timer) clearTimeout(timer);
	return result;
}
//#endregion
export { mapBounded, normalizeBatchMatchIds, waitForBoundedResult };
