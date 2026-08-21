// Independent research provider for the audit pipeline.
// Talks to the Lovable AI Gateway with web-grounded search where the model
// supports it. Nothing here decides completion or colour — it only returns
// findings, and it is required to return UNAVAILABLE rather than invent data.

import type {
  ConclusionFinding,
  EvidenceDigest,
  IdentityFinding,
  MetricFinding,
  Researcher,
  RuleFinding,
  StressFinding,
  UnderdogFinding,
} from "./audit-pipeline";
import { STAT_CATALOG, type StatDef } from "./reconstruction/stat-catalog";
import type { SourcedStat } from "./reconstruction/engine";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3-flash-preview";

const HOUSE_RULES = `You are the independent research branch of a tennis match audit.
HARD RULES:
- Never invent, estimate or "reasonably assume" a number, date or fact. If you cannot attribute a value to a real, named public tennis source, mark it UNAVAILABLE and say why.
- Only pre-match, publicly available information may be used.
- You are NEVER given, and must never guess, the proprietary "Matrix" model prediction. Reason only from the independent evidence supplied.
- Always answer with strict JSON matching the requested shape. No prose outside the JSON.`;

async function ask<T>(prompt: string, shapeHint: string, grounded: boolean): Promise<T> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("Research provider is not configured: missing LOVABLE_API_KEY.");

  const body: Record<string, unknown> = {
    model: MODEL,
    messages: [
      { role: "system", content: `${HOUSE_RULES}\nRespond as: ${shapeHint}` },
      { role: "user", content: prompt },
    ],
    response_format: { type: "json_object" },
  };
  if (grounded) body["tools"] = [{ type: "google_search" }];

  let res = await fetch(GATEWAY, {
    method: "POST",
    headers: { "content-type": "application/json", "Lovable-API-Key": apiKey },
    body: JSON.stringify(body),
  });

  if (!res.ok && grounded && (res.status === 400 || res.status === 422)) {
    // Provider rejected the search tool — retry ungrounded rather than fail the stage.
    delete body["tools"];
    res = await fetch(GATEWAY, {
      method: "POST",
      headers: { "content-type": "application/json", "Lovable-API-Key": apiKey },
      body: JSON.stringify(body),
    });
  }

  if (!res.ok) {
    const text = await res.text();
    if (res.status === 429)
      throw new Error("Research provider rate limited (429) — retry Run Audit shortly.");
    if (res.status === 402) throw new Error("Research provider credits exhausted (402).");
    if (res.status === 401 || res.status === 403)
      throw new Error("Research provider rejected the API key (auth).");
    throw new Error(`Research provider failed (${res.status}): ${text.slice(0, 300)}`);
  }

  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = json.choices?.[0]?.message?.content ?? "";
  // Some grounded responses wrap the object in a single-element array.
  const unwrap = (v: unknown): T => (Array.isArray(v) ? ((v[0] ?? {}) as T) : (v as T));
  try {
    return unwrap(JSON.parse(content));
  } catch {
    const m = content.match(/[[{][\s\S]*[\]}]/);
    if (!m) throw new Error("Research provider returned an unparseable response (no JSON object).");
    return unwrap(JSON.parse(m[0]));
  }
}

const IDENTITY_SHAPE = `{"player1_canonical":string|null,"player2_canonical":string|null,"player1_status":"VERIFIED"|"UNVERIFIED"|"CONFLICT","player2_status":"VERIFIED"|"UNVERIFIED"|"CONFLICT","tournament":string|null,"event_level":string|null,"round":string|null,"scheduled_date":string|null,"surface":string|null,"indoor":boolean|null,"best_of":number|null,"surface_status":"VERIFIED"|"UNVERIFIED"|"CONFLICT","unresolved_reason":string|null,"sources":[{"source_name":string,"url":string|null,"retrieved_at":string|null}],"conflicts":[{"field":string,"values":[string],"note":string|null}]}`;

const CONTEXT_KEYS = [
  "tournament",
  "event_level",
  "round",
  "scheduled_date",
  "surface",
  "indoor",
  "best_of",
] as const;

function missingKeys(f: Partial<IdentityFinding>): string[] {
  return CONTEXT_KEYS.filter((k) => f[k] === null || f[k] === undefined).map(String);
}

// Resolve players + match context from the public web. Shared by the audit
// pipeline and by the upload review screen so both fill the same fields.
export async function resolveMatchIdentity(input: {
  p1: string;
  p2: string;
  hints: Record<string, string | null>;
}): Promise<IdentityFinding> {
  const { p1, p2, hints } = input;
  const today = new Date().toISOString().slice(0, 10);

  const base = `Resolve this professional tennis matchup independently against public tennis sources (ATP/WTA/ITF official tour sites and draws, Tennis Abstract, Ultimate Tennis Statistics, Tennis Explorer, Flashscore, tournament sites).
Today's date is ${today}. Relative hints such as "Today", "Tonight" or a weekday refer to that date.
Players exactly as printed on the uploaded summary — do not substitute anyone else:
  Player 1: ${p1}
  Player 2: ${p2}
Context hints from the upload (may be incomplete or wrong): ${JSON.stringify(hints)}`;

  let out = await ask<IdentityFinding>(
    `${base}
Tasks:
 1. Confirm each player exists as a real tour player and give the canonical full name. Any player with an ATP/WTA/ITF profile page is VERIFIED — set UNVERIFIED only if no such profile exists at all.
 2. Independently establish tournament, event_level, round, scheduled_date (YYYY-MM-DD), surface, indoor (true/false), best_of by locating the current or upcoming draw containing both players. Do NOT return null just because a hint was missing. Return null only after a genuine attempt with no source.
 3. List every source used with url and retrieval note; list conflicting values.`,
    IDENTITY_SHAPE,
    true,
  );

  // Second grounded pass targeted at whatever the first pass left blank —
  // these fields are publicly documented for every tour match, so one silent
  // null must not stall the audit.
  const gaps = missingKeys(out);
  if (gaps.length) {
    try {
      const retry = await ask<Partial<IdentityFinding>>(
        `${base}
The first retrieval pass could not establish: ${gaps.join(", ")}.
Search again specifically for the tournament draw / order of play that contains BOTH players around ${hints["scheduled_date"] ?? today}.
Tournament surface, indoor/outdoor and best_of follow from the event itself (e.g. ATP/Challenger main draw = best of 3), so state them once the event is identified.
Return the full object; use null only for a field you genuinely cannot source.`,
        IDENTITY_SHAPE,
        true,
      );
      const merged = { ...out } as Record<string, unknown>;
      for (const k of CONTEXT_KEYS) {
        if (
          (merged[k] === null || merged[k] === undefined) &&
          retry[k] !== null &&
          retry[k] !== undefined
        ) {
          merged[k] = retry[k];
        }
      }
      if (retry.sources?.length) merged["sources"] = [...(out.sources ?? []), ...retry.sources];
      if (retry.surface_status && merged["surface"])
        merged["surface_status"] = retry.surface_status;
      out = merged as unknown as IdentityFinding;
    } catch {
      // keep the first-pass result; the caller reports what is still missing
    }
  }

  if (out.surface && out.surface_status !== "CONFLICT") out.surface_status = "VERIFIED";
  if (out.player1_canonical && out.player1_status !== "CONFLICT") out.player1_status = "VERIFIED";
  if (out.player2_canonical && out.player2_status !== "CONFLICT") out.player2_status = "VERIFIED";

  return {
    ...out,
    sources: out.sources ?? [],
    conflicts: out.conflicts ?? [],
  };
}

export const aiResearcher: Researcher = {
  async identity(input) {
    return resolveMatchIdentity(input);
  },

  async dossier({ player, opponent, context }) {
    const out = await ask<{ dossier: string | null }>(
      `Retrieve a factual pre-match statistical dossier for the professional tennis player ${player} (upcoming opponent ${opponent}; ${context || "context not yet established"}).
Search public sources (ATP/WTA/ITF official, Tennis Abstract, Ultimate Tennis Statistics, Tennis Explorer, tournament sites).
Report, with the source named inline for each figure and only where a real source exists:
 - current ranking, ranking trend, age, handedness
 - season and 12-month win/loss, split by surface
 - serve metrics: 1st serve %, 1st/2nd serve points won, aces/DF per match, hold %
 - return metrics: return points won vs 1st/2nd serve, break points converted, break %
 - tie-break and deciding-set records, recent form (last 10 matches with opponents and scores)
 - head-to-head with ${opponent}, injury/withdrawal/fatigue news, travel and schedule load, altitude/conditions notes
Omit anything you cannot attribute. Do not estimate. Return it as one markdown dossier string.`,
      `{"dossier":string}`,
      true,
    );
    return out.dossier ?? "";
  },

  async extractStats({ player, dossier, context }) {
    const catalog = STAT_CATALOG.map((stat: StatDef) => `${stat.key} | ${stat.label} | ${stat.unit}`).join("\n");
    const out = await ask<{ stats: SourcedStat[] }>(
      `Normalize the dossier for ${player} in the context ${context || "not established"} into atomic statistics.
This is extraction only. Copy a number only when the dossier explicitly attributes it to a named source and the figure describes this player, surface and time window. Never calculate, infer, convert, average, substitute a proxy, or fill a missing value. Return no derived percentages or ratios.
Allowed catalog keys:
${catalog}
Dossier:
${dossier.slice(0, 16000)}`,
      `{"stats":[{"key":string,"player":string,"value":number,"surface":string|null,"window":string|null,"tour_level":string|null,"sample":number|null,"origin":"DIRECT","sources":[{"source_name":string,"url":string|null,"retrieved_at":string|null}]}]}`,
      false,
    );
    return (out.stats ?? [])
      .filter((stat) => stat.player === player && stat.origin === "DIRECT" && Number.isFinite(stat.value) && stat.sources?.length)
      .map((stat) => ({ ...stat, origin: "DIRECT" as const, sources: stat.sources ?? [] }));
  },

  async metrics({ p1, p2, context, dossier, metrics }) {
    const out = await ask<{ metrics: MetricFinding[] }>(
      `Match: ${p1} vs ${p2}. Context: ${context || "context not yet established"}.
${dossier ? `Retrieved public dossiers (use these figures directly; treat them as sourced evidence):\n${dossier.slice(0, 12000)}\n` : ""}
For EVERY metric below, research both players symmetrically and return one row per metric_code.
Treatment per player: DIRECT (found at a named source), RECONSTRUCTED (computed from named source components — state the components in the value), PARTIAL (only a proxy/partial figure), UNAVAILABLE (attempted, nothing admissible), EXCLUDED (post-match or inadmissible).
Metrics:
${metrics.map((m) => `- ${m.code} | ${m.name}${m.body ? ` | definition: ${m.body.slice(0, 400)}` : ""}`).join("\n")}`,
      `{"metrics":[{"metric_code":string,"p1_value":string|null,"p2_value":string|null,"p1_treatment":"DIRECT"|"RECONSTRUCTED"|"PARTIAL"|"UNAVAILABLE"|"EXCLUDED","p2_treatment":"DIRECT"|"RECONSTRUCTED"|"PARTIAL"|"UNAVAILABLE"|"EXCLUDED","differential":string|null,"evidence_family":string|null,"reliability":number|null,"sample":string|null,"unavailable_reason":string|null,"sources":[{"source_name":string,"url":string|null,"retrieved_at":string|null}]}]}`,
      true,
    );
    return (out.metrics ?? []).map((m) => ({ ...m, sources: m.sources ?? [] }));
  },

  async rules({ kind, evidence, rules }) {
    const label =
      kind === "VERIFICATION" ? "verification audit rule" : "disagreement / trap audit rule";
    const out = await ask<{ rules: RuleFinding[] }>(
      `Independent evidence for ${evidence.p1} vs ${evidence.p2} (${evidence.context || "context unestablished"}):
${evidence.metrics.map((m) => `- ${m.code} ${m.name}: P1 ${m.p1 ?? "—"} | P2 ${m.p2 ?? "—"}`).join("\n") || "(no metric values retrieved)"}

Execute each ${label} against that evidence. One row per rule_code.
Rules:
${rules.map((r) => `- ${r.code} | ${r.name}${r.body ? ` | ${r.body.slice(0, 500)}` : ""} | severity ${r.severity}`).join("\n")}
Use outcome UNAVAILABLE only when the evidence needed to execute the rule is genuinely absent.`,
      `{"rules":[{"rule_code":string,"p1_finding":string|null,"p2_finding":string|null,"outcome":"PASS"|"WARN"|"FAIL"|"UNAVAILABLE","severity":"STANDARD"|"CRITICAL"|null,"decision_effect":string|null,"contradiction_severity":"NONE"|"MINOR"|"MATERIAL"|"CRITICAL"|null,"supporting_evidence":string|null,"opposing_evidence":string|null,"final_effect":string|null,"sources":[{"source_name":string,"url":string|null,"retrieved_at":string|null}]}]}`,
      false,
    );
    return (out.rules ?? []).map((r) => ({ ...r, sources: r.sources ?? [] }));
  },

  async underdog({ evidence, pathways, player_side, opponent }) {
    const out = await ask<{ pathways: UnderdogFinding[] }>(
      `Dangerous-underdog analysis for ${player_side} against ${opponent} (${evidence.context || "context unestablished"}).
Evidence:
${evidence.metrics.map((m) => `- ${m.name}: P1 ${m.p1 ?? "—"} | P2 ${m.p2 ?? "—"}`).join("\n") || "(no metric values retrieved)"}
Classify each pathway for ${player_side}: STRONG (live, evidenced route to the upset), REALISTIC, WEAK, or UNRESOLVED only if the evidence needed is absent (then give unavailable_reason).
Pathways:
${pathways.map((p) => `- ${p.code} | ${p.name}`).join("\n")}`,
      `{"pathways":[{"pathway_code":string,"player_side":string,"classification":"UNRESOLVED"|"WEAK"|"REALISTIC"|"STRONG","evidence":string|null,"repeatable":boolean,"unavailable_reason":string|null}]}`,
      false,
    );
    return (out.pathways ?? []).map((p) => ({ ...p, player_side }));
  },

  async conclusion({ evidence, verificationSummary, disagreementSummary, underdogSummary }) {
    return ask<ConclusionFinding>(
      `Commit the INDEPENDENT conclusion for ${evidence.p1} vs ${evidence.p2} (${evidence.context || "context unestablished"}).
You have no access to any model/Matrix prediction and must not speculate about one.
Metric evidence:
${evidence.metrics.map((m) => `- ${m.name}: P1 ${m.p1 ?? "—"} | P2 ${m.p2 ?? "—"}`).join("\n") || "(no metric values retrieved)"}
Verification concerns:\n${verificationSummary || "(none flagged)"}
Trap / disagreement concerns:\n${disagreementSummary || "(none flagged)"}
Underdog pathways:\n${underdogSummary || "(none material)"}
Return the winner as the exact player name, plus an honest win-probability range (low/high, 0-100). If the independent evidence is too thin to name a winner, return winner null and insufficient_reason.`,
      `{"winner":string|null,"low":number|null,"high":number|null,"rationale":string|null,"insufficient_reason":string|null}`,
      false,
    );
  },

  async stress({ evidence, conclusion, tests }) {
    const out = await ask<{ tests: StressFinding[] }>(
      `Independent conclusion under test: winner ${conclusion.winner ?? "none"} range ${conclusion.low ?? "?"}-${conclusion.high ?? "?"}.
Evidence:
${evidence.metrics.map((m) => `- ${m.name} (${m.family ?? "family unknown"}): P1 ${m.p1 ?? "—"} | P2 ${m.p2 ?? "—"}`).join("\n") || "(no metric values retrieved)"}
Re-derive the conclusion under each removal/re-weighting test and report whether it survives.
Tests:
${tests.map((t) => `- ${t.code} | ${t.name}`).join("\n")}`,
      `{"tests":[{"test_code":string,"winner_after":string|null,"range_after":string|null,"outcome":"STABLE"|"MOSTLY STABLE"|"UNSTABLE"|"FAILS","note":string|null}]}`,
      false,
    );
    return out.tests ?? [];
  },
};

export type { EvidenceDigest, IdentityFinding, MetricFinding };
