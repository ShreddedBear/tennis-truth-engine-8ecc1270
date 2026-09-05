// THE SELECTED PLAYER — one reader, one field, and deliberately nothing else in this module.
//
// The engine's pick is persisted at final_decisions.gate_report.deterministic_decision
// .selected_player. Every place that displays, grades or calibrates the pick reads it through
// here, so no call site can drift onto a different column.
//
// WHAT IT IS NOT. final_decisions.final_selection holds an ACTION (the recommendation --
// "BET", "PASS", ...), not a player. Reading that column as the selected player would display
// and grade the wrong thing entirely, which is why the correct field has exactly one reader.
//
// This module is kept minimal ON PURPOSE: it is imported by the grading path, which must
// never be able to see evidence coverage, evidence support, the active-metric registry or any
// probability. Nothing of that kind may be added to this file (a test asserts it), so the
// grading path can read a decision's pick without gaining a route to the evidence behind it.

export interface SelectedPlayerRead {
  /** True when the run HAS a decision record. Distinguishes a refusal from a missing record. */
  present: boolean;
  /** The engine's pick, or null for a genuine refusal / no record. */
  selected_player: string | null;
}

export function readSelectedPlayerFromGateReport(gateReport: unknown): SelectedPlayerRead {
  if (gateReport && typeof gateReport === "object") {
    const record = (gateReport as Record<string, unknown>)["deterministic_decision"];
    if (
      record &&
      typeof record === "object" &&
      "selected_player" in (record as Record<string, unknown>)
    ) {
      const selected = (record as Record<string, unknown>)["selected_player"];
      if (typeof selected === "string" && selected.trim())
        return { present: true, selected_player: selected.trim() };
      // An explicit null inside a present record is a REAL refusal, not missing data. It must
      // not fall through to an older column and resurrect a pick the engine declined to make.
      return { present: true, selected_player: null };
    }
  }
  return { present: false, selected_player: null };
}
