// The browser's view of "which slate is current".
//
// Every operational page reads this before it reads matches, and includes the returned id in
// its react-query key. That second part matters as much as the first: without the slate id in
// the key, a cached page rendered against the retired slate would survive a Clear Slate and
// keep showing it until something else happened to invalidate the query -- the "refreshing
// resurrects the cleared slate" symptom. With the id in the key, a slate change is a
// different cache entry, so there is no stale entry left to resurrect.

import { supabase } from "@/integrations/supabase/client";
import { activeSlate, type PredictionSlateRow } from "./prediction-slate";

export async function fetchActiveSlate(): Promise<PredictionSlateRow | null> {
  const { data, error } = await supabase
    .from("prediction_slates")
    .select("*")
    .is("retired_at", null)
    .limit(1);
  if (error) throw new Error(`Could not read the current prediction slate: ${error.message}`);
  return activeSlate((data ?? []) as PredictionSlateRow[]);
}

export async function fetchActiveSlateId(): Promise<string | null> {
  return (await fetchActiveSlate())?.id ?? null;
}
