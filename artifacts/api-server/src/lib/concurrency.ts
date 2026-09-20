/**
 * Bounded-concurrency worker pool for fanning out a batch of async work
 * without running the whole batch at once.
 *
 * Used by POST /admin/parlay/validate: computeBuilderScore() calls out to
 * external providers per leg (SofaScore, MatchStat, web research, an odds
 * API), and a 100-150 leg upload previously ran all of them concurrently via
 * `Promise.all(legs.map(...))` — that unbounded fan-out is what exhausted
 * those providers' and the app's own rate limits and produced
 * "Too many requests" failures for large slates.
 */
export async function runWithConcurrency<T>(
  items: readonly T[],
  limit: number,
  worker: (item: T, index: number) => Promise<void>,
): Promise<void> {
  let next = 0;
  const run = async (): Promise<void> => {
    const i = next++;
    if (i >= items.length) return;
    await worker(items[i], i);
    await run();
  };
  await Promise.all(Array.from({ length: Math.min(Math.max(1, limit), items.length) }, run));
}
