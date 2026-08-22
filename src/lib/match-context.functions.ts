// Resolve matchup context for the upload review screen.
// Priority: bundled licensed/public tennis data first, online research second.
// This keeps empty fields fillable even when the external research provider is
// unavailable or out of credits, without silently guessing an exact match.
import { createServerFn } from "@tanstack/react-start";

const KEYS = ["tournament", "event_level", "round", "scheduled_date", "surface", "best_of"] as const;
type Fields = Record<string, string | null>;

function mergeMissing(base: Fields, extra: Fields): Fields {
  const out: Fields = { ...base };
  for (const key of KEYS) if (!out[key] && extra[key]) out[key] = extra[key];
  return out;
}

function missing(fields: Fields) {
  return KEYS.filter((key) => !fields[key]);
}

export const resolveMatchContext = createServerFn({ method: "POST" })
  .inputValidator((data: { p1: string; p2: string; hints?: Record<string, string | null> }) => {
    if (!data || !data.p1?.trim() || !data.p2?.trim()) throw new Error("Both player names are required");
    return { p1: data.p1.trim(), p2: data.p2.trim(), hints: data.hints ?? {} };
  })
  .handler(async ({ data }) => {
    const { resolveLocalMatchContext } = await import("./local-match-context.server");
    const local = resolveLocalMatchContext(data.p1, data.p2, data.hints);
    let fields: Fields = mergeMissing(data.hints, local.fields);
    const sources = [...local.sources];

    // Only spend/use online research for fields the local public dataset could
    // not confidently resolve. A provider failure no longer erases local data.
    if (missing(fields).length) {
      try {
        const { resolveMatchIdentity } = await import("./audit-research.server");
        const web = await resolveMatchIdentity({ p1: data.p1, p2: data.p2, hints: fields });
        fields = mergeMissing(fields, {
          tournament: web.tournament,
          event_level: web.event_level,
          round: web.round,
          scheduled_date: web.scheduled_date,
          surface: web.surface,
          best_of: web.best_of === null || web.best_of === undefined ? null : String(web.best_of),
        });
        sources.push(...web.sources.map((s) => s.source_name).filter(Boolean));
      } catch {
        // Expected when Lovable/research credits are unavailable. Keep all
        // confidently reconstructed local values and leave only true gaps blank.
      }
    }

    const unresolved = missing(fields);
    return {
      ok: Object.values(fields).some(Boolean),
      fields,
      sources: [...new Set(sources)],
      unresolvedReason: unresolved.length ? `Still unresolved: ${unresolved.join(", ")}` : null,
    };
  });