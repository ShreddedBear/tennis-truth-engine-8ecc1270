// Resolve matchup context for the upload review screen.
// Priority: persisted match context + bundled local context first, optional online research second.
// Corrupted OCR is treated as a hint, not as authoritative context.
// IMPORTANT: upload review must stay responsive. Online enrichment is best-effort
// and may never hold the PDF review screen longer than a short fixed budget.
import { createServerFn } from "@tanstack/react-start";

const KEYS = ["tournament", "event_level", "round", "scheduled_date", "surface", "best_of"] as const;
const ONLINE_ENRICHMENT_BUDGET_MS = 2500;
type Fields = Record<string, string | null>;

function norm(v:string|null|undefined){return String(v??"").normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();}
function nameTokens(v:string){return norm(v).split(" ").filter(Boolean);}
function samePlayer(a:string,b:string){const x=nameTokens(a),y=nameTokens(b);if(!x.length||!y.length)return false;if(x.join(" ")===y.join(" "))return true;const xl=x[x.length-1],yl=y[y.length-1];if(xl!==yl)return false;const sx=new Set(x),sy=new Set(y);const overlap=[...sx].filter(t=>sy.has(t)).length;const shorter=Math.min(sx.size,sy.size);return overlap===shorter||overlap>=Math.min(2,shorter);}
function samePair(a1:string,a2:string,b1:string,b2:string){return(samePlayer(a1,b1)&&samePlayer(a2,b2))||(samePlayer(a1,b2)&&samePlayer(a2,b1));}
function compatible(a:string|null|undefined,b:string|null|undefined){const x=norm(a),y=norm(b);return !x||!y||x===y||x.includes(y)||y.includes(x);}
function suspicious(key:string,value:string|null|undefined){
  const v=String(value??"").trim(),n=norm(v);if(!v)return true;
  if(/^(unavailable|unknown|n a|na|null|none|-)$/.test(n))return true;
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

async function persistedContext(p1:string,p2:string,hints:Fields):Promise<{fields:Fields;sources:string[]}> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin.from("matches")
      .select("player1_name,player2_name,tournament_name,event_level,round,scheduled_date,surface,best_of,updated_at")
      .order("updated_at",{ascending:false})
      .limit(500);
    const pairRows=(data??[]).filter(r=>samePair(p1,p2,r.player1_name,r.player2_name));
    if(!pairRows.length)return{fields:{},sources:[]};
    const tournamentHint=hints.tournament;
    const contextual=pairRows.filter(r=>compatible(r.tournament_name,tournamentHint));
    const pool=contextual.length?contextual:pairRows;
    const best=pool[0];
    if(!best)return{fields:{},sources:[]};
    return {
      fields:{
        tournament:best.tournament_name??null,
        event_level:best.event_level??null,
        round:best.round??null,
        scheduled_date:best.scheduled_date??null,
        surface:best.surface??null,
        best_of:best.best_of===null||best.best_of===undefined?null:String(best.best_of),
      },
      sources:["Persisted exact player-pair match context"],
    };
  } catch {
    return{fields:{},sources:[]};
  }
}

export const resolveMatchContext = createServerFn({ method: "POST" })
  .inputValidator((data: { p1: string; p2: string; hints?: Record<string, string | null> }) => {
    if (!data || !data.p1?.trim() || !data.p2?.trim()) throw new Error("Both player names are required");
    return { p1: data.p1.trim(), p2: data.p2.trim(), hints: data.hints ?? {} };
  })
  .handler(async ({ data }) => {
    const persisted=await persistedContext(data.p1,data.p2,data.hints);
    const { resolveLocalMatchContext } = await import("./local-match-context.server");
    const local = resolveLocalMatchContext(data.p1, data.p2, mergePreferVerified(data.hints,persisted.fields));
    let fields: Fields = mergePreferVerified(data.hints, persisted.fields);
    fields = mergePreferVerified(fields, local.fields);
    const sources = [...persisted.sources,...local.sources];

    if (missing(fields).length) {
      try {
        const { resolveMatchIdentity } = await import("./audit-research.server");
        const webPromise = resolveMatchIdentity({ p1: data.p1, p2: data.p2, hints: fields }).catch(() => null);
        const web = await Promise.race([
          webPromise,
          new Promise<null>(resolve => setTimeout(() => resolve(null), ONLINE_ENRICHMENT_BUDGET_MS)),
        ]);
        if (web) {
          fields = mergePreferVerified(fields, {
            tournament: web.tournament,
            event_level: web.event_level,
            round: web.round,
            scheduled_date: web.scheduled_date,
            surface: web.surface,
            best_of: web.best_of === null || web.best_of === undefined ? null : String(web.best_of),
          });
          sources.push(...web.sources.map((s) => s.source_name).filter(Boolean));
        }
      } catch {
        // Keep persisted/local fields; only true gaps remain unresolved.
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
