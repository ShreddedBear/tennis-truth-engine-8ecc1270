// Thin server-function wrapper: resolve a matchup's context from the public web
// so the upload review screen is pre-filled instead of showing UNAVAILABLE.
import { createServerFn } from "@tanstack/react-start";

export const resolveMatchContext = createServerFn({ method: "POST" })
  .inputValidator((data: { p1: string; p2: string; hints?: Record<string, string | null> }) => {
    if (!data || !data.p1?.trim() || !data.p2?.trim()) throw new Error("Both player names are required");
    return { p1: data.p1.trim(), p2: data.p2.trim(), hints: data.hints ?? {} };
  })
  .handler(async ({ data }) => {
    const { resolveMatchIdentity } = await import("./audit-research.server");
    try {
      const f = await resolveMatchIdentity({ p1: data.p1, p2: data.p2, hints: data.hints });
      return {
        ok: true as const,
        fields: {
          tournament: f.tournament,
          event_level: f.event_level,
          round: f.round,
          scheduled_date: f.scheduled_date,
          surface: f.surface,
          best_of: f.best_of === null || f.best_of === undefined ? null : String(f.best_of),
        } as Record<string, string | null>,
        sources: f.sources.map((s) => s.source_name).filter(Boolean),
        unresolvedReason: f.unresolved_reason ?? null,
      };
    } catch (error) {
      return {
        ok: false as const,
        fields: {} as Record<string, string | null>,
        sources: [] as string[],
        unresolvedReason: error instanceof Error ? error.message : String(error),
      };
    }
  });
