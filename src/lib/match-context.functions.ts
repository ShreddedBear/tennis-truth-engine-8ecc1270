// Resolve matchup context for the upload review screen.
// Priority: bundled licensed/public tennis data first, online research second.
// Corrupted OCR is treated as a hint, not as authoritative context.
import { createServerFn } from "@tanstack/react-start";

const KEYS = ["tournament", "event_level", "round", "scheduled_date", "surface", "best_of"] as const;
type Fields = Record<string, string | null>;

function norm(v:string|null|undefined){return String(v??"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();}
function suspicious(key:string,value:string|null|undefined){
  const v=String(value??"").trim(),n=norm(v);if(!v)return true;
  if(/^(unavailable|unknown|n\/a|na|null|none|-)$/.test(n))return true;
  if(key==="scheduled_date"&&!/^20\d{2}-\d{2}-\d{2}$/.test(v))return true;
  if(key==="surface"&&!/^(hard|clay|grass|carpet)$/i.test(v))return true;
  if(key==="best_of"&&!/^[35]$/.test(v))return true;
  if(key==="tournament"){
    if(/[\$%()[\]{}<>]/.test(v))return true;
    if(/\b(?:perf|pere|nta|vo n|volume|vol)\b/i.test(v))return true;
    if(/cincinn/i.test(v)){
      const canonical = /^(?:cincinnati open|atp cincinnati|wta cincinnati|cincinnati masters)$/i.test(v.trim());
      if(!canonical)return true;
    }
  }
  return false;
}
function mergePreferVerified(base:Fields,extra:Fields):Fields{
  const out:Fields={...base};
  for(const key of KEYS){const candidate=extra[key];if(!candidate)continue;if(!out[key]||suspicious(key,out[key]))out[key]=candidate;}
  return out;
}
function missing(fields:Fields){return KEYS.filter(key=>!fields[key]||suspicious(key,fields[key]));}

export const resolveMatchContext = createServerFn({ method: "POST" })
  .inputValidator((data: { p1: string; p2: string; hints?: Record<string, string | null> }) => {
    if (!data || !data.p1?.trim() || !data.p2?.trim()) throw new Error("Both player names are required");
    return { p1: data.p1.trim(), p2: data.p2.trim(), hints: data.hints ?? {} };
  })
  .handler(async ({ data }) => {
    const { resolveLocalMatchContext } = await import("./local-match-context.server");
    const local = resolveLocalMatchContext(data.p1, data.p2, data.hints);
    let fields: Fields = mergePreferVerified(data.hints, local.fields);
    const sources = [...local.sources];

    if (missing(fields).length) {
      try {
        const { resolveMatchIdentity } = await import("./audit-research.server");
        const web = await resolveMatchIdentity({ p1: data.p1, p2: data.p2, hints: fields });
        fields = mergePreferVerified(fields, {
          tournament: web.tournament,
          event_level: web.event_level,
          round: web.round,
          scheduled_date: web.scheduled_date,
          surface: web.surface,
          best_of: web.best_of === null || web.best_of === undefined ? null : String(web.best_of),
        });
        sources.push(...web.sources.map((s) => s.source_name).filter(Boolean));
      } catch {
        // Keep the independently reconstructed local fields; only true gaps remain unresolved.
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