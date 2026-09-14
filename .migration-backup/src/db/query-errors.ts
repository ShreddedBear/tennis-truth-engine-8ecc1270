// Keeps the error wording the app already speaks.
//
// Every Supabase call site read `{ data, error }` and threw
// `Database <verb> failed (<table>): <message>`. Those strings surface in execution_logs,
// on the match page and in the batch driver's output, so the move to a driver that throws
// natively must not quietly reword them.
export type DbVerb = "read" | "insert" | "update" | "write" | "delete";

export function dbErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error ?? "unknown error");
}

/** Runs a query, restating any driver error in the app's existing wording. */
export async function dbCall<T>(verb: DbVerb, table: string, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    throw new Error(`Database ${verb} failed (${table}): ${dbErrorMessage(error)}`);
  }
}
