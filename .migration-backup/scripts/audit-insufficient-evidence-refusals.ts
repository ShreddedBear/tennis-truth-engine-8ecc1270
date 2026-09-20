// FORENSIC AUDIT RUNNER — the current slate's INSUFFICIENT_EVIDENCE decisions.
//
// READ-ONLY. This script never writes to the database. It takes a snapshot of the
// production evidence (metric_results + matches + final_decisions, exported to JSON) and
// re-derives, per match, both players' complete audit profiles and the exact stage at
// which a winner did or did not emerge.
//
//   bun run scripts/audit-insufficient-evidence-refusals.ts <snapshot.json> [outDir]
//
// The snapshot shape is documented in ForensicSnapshot below. Producing it requires only
// SELECTs -- no write of any kind:
//
//   -- matches[]
//   select ar.id audit_run_id, m.id match_id, m.player1_name p1, m.player2_name p2,
//          m.player1_id p1_id, m.player2_id p2_id, m.surface, m.tournament_name, m.round,
//          m.event_level, m.scheduled_date, m.slate_id,
//          ar.independent_winner, ar.independent_winner_side, ar.independent_winner_id,
//          ar.effective_evidence_count, ar.raw_signal_count, ar.status run_status,
//          fd.final_selection, fd.final_audit_color, fd.action, fd.completion_percent,
//          fd.audit_complete, fd.matrix_firewall_valid, fd.calibration_bucket
//     from final_decisions fd
//     join audit_runs ar on ar.id = fd.audit_run_id
//     join matches    m  on m.id  = ar.match_id
//    where fd.final_selection = 'INSUFFICIENT EVIDENCE'
//    order by ar.id;
//
//   -- metric_rows[] (the 25 ACTIVE_METRIC_CODES only; the other 56 carry no comparison spec)
//   select mr.audit_run_id a, mr.metric_code c, mr.evidence_family f,
//          mr.p1_value p1v, mr.p2_value p2v, mr.p1_treatment p1t, mr.p2_treatment p2t,
//          mr.p1_status p1s, mr.p2_status p2s,
//          mr.p1_unavailable_reason p1u, mr.p2_unavailable_reason p2u,
//          mr.reliability rel, mr.sample smp, mr.sources->0->>'source_name' src,
//          mr.matrix_derived md
//     from metric_results mr
//     join final_decisions fd on fd.audit_run_id = mr.audit_run_id
//    where fd.final_selection = 'INSUFFICIENT EVIDENCE'
//      and mr.metric_code in (<ACTIVE_METRIC_CODES>)
//    order by mr.audit_run_id, mr.metric_code;

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { forensicsForMatch, type ForensicMatchInput, type RefusalClassification } from "../src/lib/truth-engine-refusal-forensics";
import { ACTIVE_METRIC_CODES } from "../src/lib/truth-engine-active-metrics";
import { EVIDENCE_SELECTION_THRESHOLD } from "../src/lib/truth-engine-decision";

interface SnapshotMetricRow {
  a: string; c: string; f: string | null;
  p1v: string | null; p2v: string | null;
  p1t: string | null; p2t: string | null;
  p1s: string | null; p2s: string | null;
  p1u: string | null; p2u: string | null;
  rel: string | null; smp: string | null; src: string | null; md: boolean | null;
}
interface SnapshotMatch {
  audit_run_id: string; match_id: string; p1: string; p2: string;
  p1_id: string | null; p2_id: string | null;
  surface: string | null; tournament_name: string | null; round: string | null;
  independent_winner: string | null; independent_winner_side: string | null;
  effective_evidence_count: number | null; raw_signal_count: number | null;
  final_selection: string; final_audit_color: string; action: string;
  completion_percent: string | number | null; audit_complete: boolean | null;
}
interface ForensicSnapshot {
  captured_at: string;
  slate: string;
  matches: SnapshotMatch[];
  metric_rows: SnapshotMetricRow[];
}

const [, , snapshotPath, outDirArg] = process.argv;
if (!snapshotPath) {
  console.error("usage: bun run scripts/audit-insufficient-evidence-refusals.ts <snapshot.json> [outDir]");
  process.exit(2);
}
const outDir = outDirArg ?? "docs/forensics";
const snapshot = JSON.parse(readFileSync(snapshotPath, "utf8")) as ForensicSnapshot;

const rowsByRun = new Map<string, SnapshotMetricRow[]>();
for (const row of snapshot.metric_rows) rowsByRun.set(row.a, [...(rowsByRun.get(row.a) ?? []), row]);

const results = snapshot.matches.map((match) => {
  const rows = (rowsByRun.get(match.audit_run_id) ?? []).map((r) => ({
    metric_code: r.c,
    p1_value: r.p1v,
    p2_value: r.p2v,
    p1_treatment: r.p1t,
    p2_treatment: r.p2t,
    metric_name: null,
    evidence_family: r.f,
    p1_status: r.p1s,
    p2_status: r.p2s,
    p1_unavailable_reason: r.p1u,
    p2_unavailable_reason: r.p2u,
    reliability: r.rel,
    sample: r.smp,
    source: r.src,
    matrix_derived: r.md,
  }));
  const input: ForensicMatchInput = {
    match_id: match.match_id,
    audit_run_id: match.audit_run_id,
    p1: match.p1,
    p2: match.p2,
    p1_player_id: match.p1_id,
    p2_player_id: match.p2_id,
    metric_rows: rows,
    stored_final_selection: match.final_selection,
    stored_independent_winner: match.independent_winner,
  };
  return { match, forensics: forensicsForMatch(input) };
});

// ---------------------------------------------------------------------------
// STEP 8 — machine-readable diagnostic, one object per refusal, raw evidence preserved.
// ---------------------------------------------------------------------------
const diagnostic = results.map(({ match, forensics: f }) => ({
  match_id: f.match_id,
  audit_run_id: f.audit_run_id,
  p1: f.p1,
  p2: f.p2,
  p1_player_id: f.p1_player_id,
  p2_player_id: f.p2_player_id,
  tournament: match.tournament_name,
  round: match.round,
  surface: match.surface,

  p1_final_profile: {
    supporting_families: f.p1_support.supporting_families,
    contradicting_families: f.p1_support.contradicting_families,
    support_ratio_percent_unrounded: f.p1_support.support_ratio_percent,
    meets_threshold: f.p1_support.meets_threshold,
    verification: f.verification_p1,
    disagreement: f.disagreement_p1,
    underdog: f.underdog_p1,
    stress: f.stress_p1,
  },
  p2_final_profile: {
    supporting_families: f.p2_support.supporting_families,
    contradicting_families: f.p2_support.contradicting_families,
    support_ratio_percent_unrounded: f.p2_support.support_ratio_percent,
    meets_threshold: f.p2_support.meets_threshold,
    verification: f.verification_p2,
    disagreement: f.disagreement_p2,
    underdog: f.underdog_p2,
    stress: f.stress_p2,
  },

  p1_supporting_families: f.p1_support.supporting_families,
  p2_supporting_families: f.p2_support.supporting_families,
  conflicted_families: f.p1_support.conflicted_families,
  neutral_families: f.p1_support.neutral_families,
  unavailable_families: f.raw.decision.unavailable.map((u) => `${u.metric_code}:${u.status}`),
  directional_family_denominator: f.p1_support.directional_denominator,

  p1_threshold_result: `${f.p1_support.support_ratio_percent}% ${f.p1_support.meets_threshold ? ">=" : "<"} ${EVIDENCE_SELECTION_THRESHOLD}%`,
  p2_threshold_result: `${f.p2_support.support_ratio_percent}% ${f.p2_support.meets_threshold ? ">=" : "<"} ${EVIDENCE_SELECTION_THRESHOLD}%`,

  verification_p1: f.verification_p1,
  verification_p2: f.verification_p2,
  disagreement_p1: f.disagreement_p1,
  disagreement_p2: f.disagreement_p2,
  underdog_p1: f.underdog_p1,
  underdog_p2: f.underdog_p2,
  stress_p1: f.stress_p1,
  stress_p2: f.stress_p2,

  comparison_before_stress: f.comparison_before_stress,
  comparison_after_stress: f.comparison_after_stress,
  symmetric_stress_verdict: f.symmetric_stress_verdict,
  verification_agrees_with_decision_core: f.verification_agrees_with_decision_core,
  stage_trace: f.trace,

  final_deterministic_state: f.final_deterministic_state,
  stored_final_selection: match.final_selection,
  stored_final_color: match.final_audit_color,
  stored_independent_winner: match.independent_winner,
  stored_effective_evidence_count: match.effective_evidence_count,
  stored_raw_signal_count: match.raw_signal_count,
  reconstruction_matches_stored: (f.final_deterministic_state === "INSUFFICIENT_EVIDENCE") === (match.independent_winner === null),

  refusal_reason: f.refusal_reason,
  classification: f.classification,
  exact_stage_that_caused_refusal: f.exact_stage_that_caused_refusal,
  explanation: f.explanation,
  secondary_observations: f.secondary_observations,
  mirror_check_symmetric: f.mirror_check_symmetric,

  families: f.families,
  // RAW METRIC-LEVEL EVIDENCE, preserved under the summary so any line above can be
  // re-derived from the numbers the engine actually read.
  metric_evidence: f.metric_profile,
}));

mkdirSync(outDir, { recursive: true });
writeFileSync(`${outDir}/insufficient-evidence-refusals.json`, JSON.stringify({
  generated_from_snapshot: snapshot.captured_at,
  slate: snapshot.slate,
  active_metric_codes: ACTIVE_METRIC_CODES,
  evidence_selection_threshold_percent: EVIDENCE_SELECTION_THRESHOLD,
  refusals: diagnostic,
}, null, 2));

// ---------------------------------------------------------------------------
// HUMAN-READABLE REPORT — the same facts as the JSON, arranged for reading.
// ---------------------------------------------------------------------------
const ORDER_MD: RefusalClassification[] = ["TRUE_TIE", "BELOW_THRESHOLD", "CONFLICTED_EVIDENCE", "ROBUSTNESS_UNRESOLVED", "DOWNSTREAM_VETO_BUG", "DATA_OR_PIPELINE_BUG", "OTHER"];
const pct = (n: number) => `${n.toFixed(4).replace(/\.?0+$/, "")}%`;
const md: string[] = [];
md.push(`# Forensic audit — the ${diagnostic.length} INSUFFICIENT_EVIDENCE decisions`, "");
md.push(`Snapshot: **${snapshot.slate}**, captured ${snapshot.captured_at}. Read-only; no production data was modified.`, "");
md.push(`Active metric set: ${ACTIVE_METRIC_CODES.length} codes. Selection threshold: **${EVIDENCE_SELECTION_THRESHOLD}%** (unchanged by this audit).`, "");
md.push(`Independent reconstruction agrees with the stored verdict in ${diagnostic.filter((d) => d.reconstruction_matches_stored).length}/${diagnostic.length} cases; P1/P2 mirror-symmetry holds in ${diagnostic.filter((d) => d.mirror_check_symmetric).length}/${diagnostic.length}.`, "");
md.push("## Classification summary", "");
md.push("| classification | n |", "| --- | --- |");
for (const key of ORDER_MD) md.push(`| ${key} | ${diagnostic.filter((d) => d.classification === key).length} |`);
md.push("");
for (const key of ORDER_MD) {
  const bucket = diagnostic.filter((d) => d.classification === key);
  if (!bucket.length) continue;
  md.push(`## ${key} (${bucket.length})`, "");
  for (const d of bucket) {
    md.push(`### ${d.p1} vs ${d.p2}`, "");
    md.push(`- match_id \`${d.match_id}\` · audit_run_id \`${d.audit_run_id}\` · ${d.tournament ?? "?"} ${d.round ?? ""} (${d.surface ?? "?"})`);
    md.push(`- stored: **${d.stored_final_selection}** / colour ${d.stored_final_color} / independent_winner ${d.stored_independent_winner ?? "null"}`);
    md.push(`- stage that caused the refusal: **${d.exact_stage_that_caused_refusal}**`, "");
    md.push("| | P1 " + d.p1 + " | P2 " + d.p2 + " |", "| --- | --- | --- |");
    md.push(`| supporting families | ${d.p1_supporting_families.join(", ") || "—"} | ${d.p2_supporting_families.join(", ") || "—"} |`);
    md.push(`| contradicting families | ${d.p1_final_profile.contradicting_families.join(", ") || "—"} | ${d.p2_final_profile.contradicting_families.join(", ") || "—"} |`);
    md.push(`| directional share (unrounded) | ${pct(d.p1_final_profile.support_ratio_percent_unrounded)} | ${pct(d.p2_final_profile.support_ratio_percent_unrounded)} |`);
    md.push(`| reaches ${EVIDENCE_SELECTION_THRESHOLD}% | ${d.p1_final_profile.meets_threshold ? "YES" : "no"} | ${d.p2_final_profile.meets_threshold ? "YES" : "no"} |`);
    md.push(`| verification: families supporting | ${d.verification_p1.supports.join(", ") || "—"} | ${d.verification_p2.supports.join(", ") || "—"} |`);
    md.push(`| verification: metrics not compared — own supply failure / refused on sample floor / supplied-but-unused | ${d.verification_p1.own_supply_failure} / ${d.verification_p1.rejected_on_evidential_grounds} / ${d.verification_p1.supplied_but_unused} | ${d.verification_p2.own_supply_failure} / ${d.verification_p2.rejected_on_evidential_grounds} / ${d.verification_p2.supplied_but_unused} |`);
    md.push(`| disagreement: families against this player | ${d.disagreement_p1.contradiction_families.join(", ") || "—"} | ${d.disagreement_p2.contradiction_families.join(", ") || "—"} |`);
    md.push(`| disagreement: overall severity | ${d.disagreement_p1.severity} | ${d.disagreement_p2.severity} |`);
    md.push(`| underdog: pathways | ${d.underdog_p1.pathways.join(", ") || "—"} (${d.underdog_p1.viability}) | ${d.underdog_p2.pathways.join(", ") || "—"} (${d.underdog_p2.viability}) |`);
    md.push(`| underdog: evaluated by production | ${d.underdog_p1.evaluated} | ${d.underdog_p2.evaluated} |`);
    md.push(`| stress: support before → after | ${pct(d.stress_p1.initial_support_percent)} → ${pct(d.stress_p1.stress_adjusted_support_percent)} | ${pct(d.stress_p2.initial_support_percent)} → ${pct(d.stress_p2.stress_adjusted_support_percent)} |`);
    md.push(`| stress: status | ${d.stress_p1.status} | ${d.stress_p2.status} |`);
    md.push(`| stress: outcome when THIS side is stressed | ${d.stress_p1.outcome_when_this_side_stressed} | ${d.stress_p2.outcome_when_this_side_stressed} |`);
    md.push(`| stress: run by production | ${d.stress_p1.evaluated_by_production} | ${d.stress_p2.evaluated_by_production} |`);
    md.push(`| stress: families manufactured out of NEUTRAL | ${d.stress_p1.families_manufactured_for_opponent.join(", ") || "—"} | ${d.stress_p2.families_manufactured_for_opponent.join(", ") || "—"} |`);
    md.push("");
    md.push(`Conflicted families: ${d.conflicted_families.join(", ") || "—"} · neutral: ${d.neutral_families.join(", ") || "—"} · directional denominator: ${d.directional_family_denominator}`, "");
    const t = d.stage_trace;
    md.push(`**Stage trace** — family vote \`${t.family_vote}\` → threshold \`${t.after_threshold}\` → leave-one-family-out \`${t.after_lofo_initial_decision}\` → verification \`${t.after_verification}\` → disagreement \`${t.after_disagreement}\` → underdog \`${t.after_underdog}\` → stress \`${t.after_stress}\` → stored \`${t.final_stored}\`. Symmetric stress verdict: \`${d.symmetric_stress_verdict}\`.`, "");
    md.push(`**Why:** ${d.explanation}`, "");
    for (const note of d.secondary_observations) md.push(`> ${note}`, "");
    md.push("<details><summary>Per-metric evidence (P1 vs P2)</summary>", "");
    md.push("| code | metric | P1 | P2 | diff | noise floor | ×floor | favours | status | family | P1 treatment | P2 treatment | source |", "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |");
    for (const m of d.metric_evidence) {
      md.push(`| ${m.metric_code} | ${m.comparison_label ?? "—"} | ${m.p1_number ?? "—"} | ${m.p2_number ?? "—"} | ${m.differential ?? "—"} | ${m.materiality ?? "—"} | ${m.magnitude_ratio === null ? "—" : m.magnitude_ratio.toFixed(2)} | ${m.favours} | ${m.status} | ${m.evidence_family_spec ?? "—"} | ${m.p1_treatment ?? "—"} | ${m.p2_treatment ?? "—"} | ${m.source ?? "—"} |`);
    }
    md.push("", "</details>", "");
  }
}
writeFileSync(`${outDir}/insufficient-evidence-refusals.md`, md.join("\n"));

// ---------------------------------------------------------------------------
// STEP 9 — console summary.
// ---------------------------------------------------------------------------
const ORDER: RefusalClassification[] = ["TRUE_TIE", "BELOW_THRESHOLD", "CONFLICTED_EVIDENCE", "ROBUSTNESS_UNRESOLVED", "DOWNSTREAM_VETO_BUG", "DATA_OR_PIPELINE_BUG", "OTHER"];
const counts = new Map<RefusalClassification, typeof results>();
for (const r of results) counts.set(r.forensics.classification, [...(counts.get(r.forensics.classification) ?? []), r]);

console.log(`\nSNAPSHOT ${snapshot.slate} captured ${snapshot.captured_at}`);
console.log(`Refusals analysed: ${results.length}`);
console.log(`Active metric codes: ${ACTIVE_METRIC_CODES.length} (${ACTIVE_METRIC_CODES.join(", ")})`);
console.log(`Selection threshold: ${EVIDENCE_SELECTION_THRESHOLD}% (unchanged)\n`);

console.log("CLASSIFICATION SUMMARY");
for (const key of ORDER) console.log(`  ${key}: ${(counts.get(key) ?? []).length}`);

const mismatches = diagnostic.filter((d) => !d.reconstruction_matches_stored);
const asymmetric = diagnostic.filter((d) => !d.mirror_check_symmetric);
console.log(`\nIndependent reconstruction disagrees with stored verdict: ${mismatches.length}`);
console.log(`P1/P2 mirror-symmetry failures: ${asymmetric.length}`);
console.log(`Verification census disagrees with the decision core: ${diagnostic.filter((d) => !d.verification_agrees_with_decision_core).length}`);

for (const key of ORDER) {
  const bucket = counts.get(key) ?? [];
  if (!bucket.length) continue;
  console.log(`\n=== ${key} (${bucket.length}) ===`);
  for (const { match, forensics: f } of bucket) {
    console.log(
      `  ${f.p1} vs ${f.p2}  [${match.match_id.slice(0, 8)}]\n` +
      `    families: P1 ${f.p1_support.supporting_families.length} (${f.p1_support.supporting_families.join(",") || "-"}) | ` +
      `P2 ${f.p2_support.supporting_families.length} (${f.p2_support.supporting_families.join(",") || "-"}) | ` +
      `conflicted ${f.p1_support.conflicted_families.length} (${f.p1_support.conflicted_families.join(",") || "-"}) | ` +
      `neutral ${f.p1_support.neutral_families.length} | denom ${f.p1_support.directional_denominator}\n` +
      `    share:    P1 ${f.p1_support.support_ratio_percent}%  P2 ${f.p2_support.support_ratio_percent}%  (threshold ${EVIDENCE_SELECTION_THRESHOLD}%)\n` +
      `    trace:    vote=${f.trace.family_vote} -> threshold=${f.trace.after_threshold} -> lofo=${f.trace.after_lofo_initial_decision} -> verification=${f.trace.after_verification} -> disagreement=${f.trace.after_disagreement} -> underdog=${f.trace.after_underdog} -> stress=${f.trace.after_stress} -> stored=${f.trace.final_stored}\n` +
      `    stress:   P1 ${f.stress_p1.initial_support_percent.toFixed(1)}%->${f.stress_p1.stress_adjusted_support_percent.toFixed(1)}% ${f.stress_p1.status} (production evaluated: ${f.stress_p1.evaluated_by_production}) | ` +
      `P2 ${f.stress_p2.initial_support_percent.toFixed(1)}%->${f.stress_p2.stress_adjusted_support_percent.toFixed(1)}% ${f.stress_p2.status} (production evaluated: ${f.stress_p2.evaluated_by_production})\n` +
      `    symmetry: ${f.symmetric_stress_verdict}` +
      (f.stress_p1.families_manufactured_for_opponent.length || f.stress_p2.families_manufactured_for_opponent.length
        ? `  | families manufactured out of NEUTRAL: P1-stress ${f.stress_p1.families_manufactured_for_opponent.join(",") || "-"} / P2-stress ${f.stress_p2.families_manufactured_for_opponent.join(",") || "-"}`
        : "") + `\n` +
      `    stage:    ${f.exact_stage_that_caused_refusal}\n` +
      `    why:      ${f.explanation}` +
      (f.secondary_observations.length ? `\n    also:     ${f.secondary_observations.join("\n              ")}` : ""),
    );
  }
}

// Evidence-supply picture: how many of the 25 active codes were even comparable.
const supply = diagnostic.map((d) => {
  const compared = d.metric_evidence.filter((m) => m.status === "COMPARED").length;
  const oneSided = d.metric_evidence.filter((m) => m.status === "ONE_SIDED_EVIDENCE").length;
  const treatment = d.metric_evidence.filter((m) => m.status === "TREATMENT_NOT_USABLE").length;
  const sample = d.metric_evidence.filter((m) => m.status === "INSUFFICIENT_SAMPLE").length;
  const unparseable = d.metric_evidence.filter((m) => m.status === "VALUE_NOT_PARSEABLE").length;
  return { match: `${d.p1} vs ${d.p2}`, compared, oneSided, treatment, sample, unparseable, directional: d.metric_evidence.filter((m) => m.contributed_directional_evidence).length };
});
console.log("\n=== EVIDENCE SUPPLY (of 25 active codes) ===");
console.log("compared | one-sided | treatment-unusable | insufficient-sample | unparseable | directional metrics");
for (const s of supply) console.log(`  ${String(s.compared).padStart(2)} | ${String(s.oneSided).padStart(2)} | ${String(s.treatment).padStart(2)} | ${String(s.sample).padStart(2)} | ${String(s.unparseable).padStart(2)} | ${String(s.directional).padStart(2)}   ${s.match}`);
const avg = (pick: (s: typeof supply[number]) => number) => (supply.reduce((n, s) => n + pick(s), 0) / supply.length).toFixed(2);
console.log(`  MEAN: compared ${avg((s) => s.compared)}, one-sided ${avg((s) => s.oneSided)}, treatment-unusable ${avg((s) => s.treatment)}, insufficient-sample ${avg((s) => s.sample)}, unparseable ${avg((s) => s.unparseable)}, directional ${avg((s) => s.directional)}`);

console.log(`\nWrote ${outDir}/insufficient-evidence-refusals.json and ${outDir}/insufficient-evidence-refusals.md`);
