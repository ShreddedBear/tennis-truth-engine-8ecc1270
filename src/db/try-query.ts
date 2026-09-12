// Query result as `{ data, error }`, the shape this codebase's control flow is written for.
//
// The Supabase client returned errors as values, and several producers depend on that
// precisely: they fan a query out across player aliases and bail to null if ANY of the
// parallel reads failed (`results.some(r => r.error)`), rather than letting one failure
// throw and lose the others. Drizzle throws instead.
//
// Rewriting that control flow into try/catch at each site would change when a producer
// returns null versus propagates -- a real semantic change in evidence availability, which
// is exactly what a database migration must not do. So the error is turned back into a
// value here and the producers keep the logic they were verified with.
//
// This is deliberately NOT a query builder. It wraps a promise; the query itself is
// ordinary Drizzle.
export interface QueryOutcome<T> {
  data: T[] | null;
  error: Error | null;
}

export async function tryQuery<T>(run: () => Promise<T[]>): Promise<QueryOutcome<T>> {
  try {
    return { data: await run(), error: null };
  } catch (error) {
    return { data: null, error: error instanceof Error ? error : new Error(String(error)) };
  }
}
