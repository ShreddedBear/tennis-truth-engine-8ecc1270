// Browser-callable entry points for audit-run logging.
//
// Module scope must stay free of server-only imports: this file ships to the client
// bundle, and only the .handler() body is stripped out of it. That is why the server
// module is reached with a dynamic import inside the handler, the same shape every other
// *.functions.ts in this codebase uses.
import { createServerFn } from "@tanstack/react-start";

export interface ExecutionLogInput {
  audit_run_id?: string | null;
  match_id?: string | null;
  stage: string;
  status: string;
  rule_code?: string | null;
  player_side?: string | null;
  output?: unknown;
  matrix_visible?: boolean;
}

/**
 * Writes one execution_logs row.
 *
 * The browser used to insert this itself with the anon key, which is exactly the door the
 * decision-table lockdown was trying to close: execution_logs is the audit trail, and a
 * client that can write it can forge one. Now the browser can only ask for a row with these
 * fields, and the server decides what is actually stored.
 */
export const logExecution = createServerFn({ method: "POST" })
  .inputValidator((data: ExecutionLogInput) => {
    const stage = String(data?.stage ?? "").trim();
    const status = String(data?.status ?? "").trim();
    if (!stage) throw new Error("An execution log entry needs a stage.");
    if (!status) throw new Error("An execution log entry needs a status.");
    return {
      audit_run_id: data.audit_run_id ?? null,
      match_id: data.match_id ?? null,
      stage,
      status,
      rule_code: data.rule_code ?? null,
      player_side: data.player_side ?? null,
      output: data.output ?? null,
      matrix_visible: Boolean(data.matrix_visible),
    };
  })
  .handler(async ({ data }) => {
    const { log } = await import("./audit-runs.server");
    await log(data);
    return { ok: true as const };
  });
