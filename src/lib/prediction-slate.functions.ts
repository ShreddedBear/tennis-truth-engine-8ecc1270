import { createServerFn } from "@tanstack/react-start";
import { activeSlate, type PredictionSlateRow } from "./prediction-slate";

/**
 * Read the current slate. Returns null when the slate has been cleared and nothing has been
 * uploaded since -- a real, displayable state ("Active Slate = 0"), not an error.
 */
export async function readActiveSlate(db: any): Promise<PredictionSlateRow | null> {
  const { data, error } = await db
    .from("prediction_slates")
    .select("*")
    .is("retired_at", null)
    .limit(1);
  if (error) throw new Error(`Could not read prediction_slates: ${error.message}`);
  return activeSlate((data ?? []) as PredictionSlateRow[]);
}

/**
 * The slate an upload should land in, opening one when the previous slate was retired.
 *
 * Creation goes through the database function so the "at most one active slate" invariant is
 * enforced where it can actually be enforced (a partial unique index), not by a
 * check-then-insert race in the client.
 */
export async function ensureActiveSlate(db: any): Promise<PredictionSlateRow> {
  const existing = await readActiveSlate(db);
  if (existing) return existing;
  const { data, error } = await db.rpc("ensure_active_prediction_slate");
  if (error) throw new Error(`Could not open a prediction slate: ${error.message}`);
  const row = (Array.isArray(data) ? data[0] : data) as PredictionSlateRow | null;
  if (row?.id) return row;
  const reread = await readActiveSlate(db);
  if (!reread) throw new Error("Could not open a prediction slate: none is active after ensure.");
  return reread;
}

/** Retire the current slate. Returns the retired slate's id, or null when none was active. */
export async function retireActiveSlate(db: any, reason = "CLEAR_SLATE"): Promise<string | null> {
  const { data, error } = await db.rpc("retire_active_prediction_slate", { reason });
  if (error) throw new Error(`Could not retire the active prediction slate: ${error.message}`);
  return (typeof data === "string" ? data : Array.isArray(data) ? data[0] : null) ?? null;
}

export const getActiveSlate = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return { slate: await readActiveSlate(supabaseAdmin) };
});

/** Called by the upload page before it writes anything, so Slate B exists before Slate B's first match. */
export const openActiveSlate = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return { slate: await ensureActiveSlate(supabaseAdmin) };
});
