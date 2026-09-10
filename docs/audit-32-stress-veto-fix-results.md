# Stress-veto fix — before/after on the same 32-refusal snapshot

**Scope.** This fixes exactly the two defects the forensic audit
(`docs/audit-32-insufficient-evidence.md`, commit `e0cf53d`) identified in the STRESS stage:
(1) the adverse shift touched every comparison, not only the ones favouring the side being
stressed, which could convert a metric the engine measured as NEUTRAL into directional
evidence for the opponent; (2) Stress evaluated only the pre-Stress leader and used that
one-sided result as a global veto, never subjecting the opponent to the same scrutiny before
withdrawing a selection. Nothing else changed: the 25 active metrics, their definitions, the
dynamic eligibility denominator, evidence provenance, family consolidation, the 60% threshold,
and the decision core (`truth-engine-decision.ts`) are untouched.

**Method.** The same forensic harness (`scripts/audit-insufficient-evidence-refusals.ts`,
`src/lib/truth-engine-refusal-forensics.ts`) was re-run against a **freshly captured, read-only
snapshot of the same 32 refusals** (same `slate_number = 1`, same 32 `audit_run_id`s, same
persisted `metric_results` evidence — nothing in `metric_results` or `final_decisions` changed
between the two runs). The forensic layer itself was updated to call the fixed production
engines directly (`truth-engine-audit.ts`: `evaluateSideStress`, `robustnessVerdict`) instead of
its own separate mirror computation, so "before" and "after" differ only by the production fix.

Before: `docs/forensics/insufficient-evidence-refusals.{json,md}` (commit `e0cf53d`).
After: `docs/forensics/insufficient-evidence-refusals-after-fix.{json,md}` (this fix).

## Classification counts

| classification | before | after |
| --- | --- | --- |
| TRUE_TIE | 3 | 3 (identical 3 matches) |
| BELOW_THRESHOLD | 8 | 8 (identical 8 matches) |
| CONFLICTED_EVIDENCE | 0 | 0 |
| ROBUSTNESS_UNRESOLVED | 0 | 0 |
| DOWNSTREAM_VETO_BUG | 14 | **0** |
| FIXED_PENDING_REPROCESS *(new label, see below)* | — | **14** |
| DATA_OR_PIPELINE_BUG | 7 | 7 (identical 7 matches) |

**Do not read "0 DOWNSTREAM_VETO_BUG" as "the refusal count decreased."** It is a direct
per-case reclassification: the exact 14 matches previously classified `DOWNSTREAM_VETO_BUG`
are, in this snapshot, the exact 14 now classified `FIXED_PENDING_REPROCESS` — no match moved
in or out of any other bucket, and the TRUE_TIE/BELOW_THRESHOLD/DATA_OR_PIPELINE_BUG matches
are byte-identical to before (same names, same shares, same reasons).

`FIXED_PENDING_REPROCESS` is a genuinely new state, not a renamed old one: it means the
corrected reconstruction now finds a winner that clears the 60% threshold, survives
leave-one-family-out, **and** survives the corrected two-sided Stress evaluation
(`comparative_robustness` is never `CHALLENGER_MORE_ROBUST`) — but the *persisted*
`final_decisions` row still reads `INSUFFICIENT EVIDENCE`, because this reconstruction is
read-only per the task's production-safety constraints and never writes to production. The
real pipeline has not re-run these 32 already-`audit_complete` matches since the fix landed;
these 14 will resolve to their real winners automatically once the Truth Engine actually
re-audits a match under the fixed code (a code change alone does not retroactively rewrite a
terminal row, by design — see Production Safety below).

## The 14 formerly-vetoed matches — before / after

| match | old classification | leader | new comparative_robustness | new decision (reconstruction) | stress veto removed |
| --- | --- | --- | --- | --- | --- |
| Alexander Bublik vs Jeffrey John Wolf | DOWNSTREAM_VETO_BUG | P1 Bublik | BOTH_SURVIVE | **Bublik wins** | yes |
| Martin Landaluce vs Jacob Fearnley | DOWNSTREAM_VETO_BUG | P1 Landaluce | BOTH_SURVIVE | **Landaluce wins** | yes |
| Hugo Dellien vs Matej Dodig | DOWNSTREAM_VETO_BUG | P1 Dellien | BOTH_SURVIVE | **Dellien wins** | yes |
| Stefano Travaglia vs Enrico Dalla Valle | DOWNSTREAM_VETO_BUG | P2 Dalla Valle | BOTH_SURVIVE | **Dalla Valle wins** | yes |
| Giovanni Mpetshi Perricard vs Jurij Rodionov | DOWNSTREAM_VETO_BUG | P2 Rodionov | LEADER_MORE_ROBUST | **Rodionov wins** | yes |
| Benjamin Hassan vs Francesco Forti | DOWNSTREAM_VETO_BUG | P1 Hassan | BOTH_SURVIVE | **Hassan wins** | yes |
| Norbert Gombos vs Svyatoslav Gulin | DOWNSTREAM_VETO_BUG | P1 Gombos | BOTH_SURVIVE | **Gombos wins** | yes |
| Brandon Nakashima vs Sebastian Baez | DOWNSTREAM_VETO_BUG | P1 Nakashima | BOTH_SURVIVE | **Nakashima wins** | yes |
| Valentin Royer vs Dalibor Svrcina | DOWNSTREAM_VETO_BUG | P2 Svrcina | BOTH_SURVIVE | **Svrcina wins** | yes |
| Matteo Arnaldi vs James Duckworth | DOWNSTREAM_VETO_BUG | P2 Duckworth | LEADER_MORE_ROBUST | **Duckworth wins** | yes |
| Hubert Hurkacz vs Damir Dzumhur | DOWNSTREAM_VETO_BUG | P2 Dzumhur | BOTH_SURVIVE | **Dzumhur wins** | yes |
| Federico Bondioli vs Federico Arnaboldi | DOWNSTREAM_VETO_BUG | P2 Arnaboldi | NON_DISCRIMINATING | **Arnaboldi wins** | yes |
| Max Schoenhaus vs Alvaro Guillen Meza | DOWNSTREAM_VETO_BUG | P1 Schoenhaus | LEADER_MORE_ROBUST | **Schoenhaus wins** | yes |
| Valentin Vacherot vs Aleksandar Kovacevic | DOWNSTREAM_VETO_BUG | P1 Vacherot | BOTH_SURVIVE | **Vacherot wins** | yes |

Every one of the 14 resolves to the **same leader the decision core had already named** before
this fix — not a different, substituted, or hard-coded player. No case reverses to the
opponent (`comparative_robustness` is `CHALLENGER_MORE_ROBUST` in 0 of the 14, exactly as the
forensic report's own mirror analysis found under the pre-fix, still-buggy shift). The full
per-side stress profile for every one of these 14 (families neutralised, manufactured-for-
opponent [always empty, proving Defect #1 is fixed], flipped-to-opponent [always empty,
proving edge erosion never becomes reversal]) is in
`docs/forensics/insufficient-evidence-refusals-after-fix.md`.

## Required example — Martin Landaluce vs Jacob Fearnley

Reconstructed from the same persisted evidence: Landaluce holds **5 of 5 directional families
(100%)**, 0 contradicting, 0 conflicted (`IMPROVEMENT_TREND, LOSS_PROFILE, POINT_BY_POINT,
RECENT_FORM, SURFACE_STRENGTH`). Stressing Landaluce's own evidence (eroding only the
comparisons that favour him, by one noise floor each) leaves him still at 100% —
`comparative_robustness = BOTH_SURVIVE`. Stressing Fearnley's evidence changes nothing, because
Fearnley has no favouring family to erode (`P2 0.0% -> 0.0%`). None of Landaluce's real
directional edges were overturned; no NEUTRAL sub-floor row was converted into support for
Fearnley (`families_manufactured_for_opponent: []` on both sides); Fearnley's Stress profile was
evaluated by the identical rule, not skipped. Landaluce is not hard-coded anywhere — this
result falls directly out of `evaluateSideStress`/`robustnessVerdict`, which take no player
name as a privileged input; the 24-test regression suite (TEST 11) proves swapping P1/P2 swaps
every output.

## Required review — Bublik vs Wolf

Flagged in the forensic report as the closest-to-defensible of the 14: the selection rests on a
**single** family (`POINT_BY_POINT`, one comparable metric of 25 — dominance ratio at ~3.8x its
noise floor), uncorroborated (`MIN_INDEPENDENT_SUPPORT_FAMILIES` still reports
`corroborated: false`, unchanged — corroboration remains diagnostic, not a gate, exactly as
before this fix). The fix does **not** manufacture a second family or otherwise strengthen this
case: Bublik's one supporting metric survives its own one-noise-floor erosion outright
(3.8x > 1x), so it stays P1 after Stress the same way it was before Stress —
`comparative_robustness = BOTH_SURVIVE`. Wolf's profile was evaluated identically and has no
family of his own to erode. The existing, untouched 60% threshold and family-consolidation
rules are what select Bublik here, not any new robustness rule — the corrected Stress
evaluation simply stops incorrectly overriding that decision-core result. This is a real,
rule-driven outcome, not a forced one: had Bublik's single edge been thinner than its own noise
floor, or had Wolf held any competing family, the same code would have produced a different
`comparative_robustness` reading.

## The 3 TRUE_TIE and 8 BELOW_THRESHOLD refusals — untouched

Byte-identical to the forensic report, because these are decided at the decision core (family
vote / 60% threshold) before Stress ever runs — `comparative_robustness: NOT_APPLICABLE` in all
11. TRUE_TIE: Tomas Martin Etcheverry vs Vit Kopriva, Genaro Alberto Olivieri vs Tiago Pereira,
Juncheng Shang vs Marco Trungelliti. BELOW_THRESHOLD: Matej Dodig vs Mili Poljicak, Andrey
Chepelev vs Fausto Tabacco, Marek Gengel vs Alex Hernandez, Matteo Berrettini vs Stan Wawrinka,
Novak Djokovic vs Mariano Navone, Alejandro Tabilo vs Yannick Hanfmann, Carlos Alcaraz vs Roman
Safiullin, Andrey Rublev vs Otto Virtanen.

## The 7 DATA_OR_PIPELINE_BUG refusals — untouched, not in scope

Byte-identical to the forensic report: Francesca Jones vs Rositsa Dencheva, Sascha Gueymard
Wayenburg vs Izan Almazan, Alexander Blockx vs Marcelo Tomas Barrios, Qinwen Zheng vs Kristina
Liutova, Mark Lajal vs Motoharu Abe, Raphael Collignon vs Sebastian Gorzny, Mananchaya
Sawangkaew vs Panna Udvardy. Every one still has `comparative_robustness: NOT_APPLICABLE` (no
selection ever formed, so Stress never ran) and identical evidence-supply counts to before.
Deliberately not touched by this fix, per its explicit scope boundary — these are evidence-
supply failures reserved for a separate task.

## Production safety

Read-only throughout. `git diff --stat` for this fix touches only: `truth-engine-audit.ts`
(the fix itself), `truth-engine-stage-mapping.ts` and `audit-pipeline.ts` (persist the new
per-player columns going forward), `truth-engine-refusal-forensics.ts`/`.test.ts` and
`scripts/audit-insufficient-evidence-refusals.ts` (reuse the fixed engine instead of a
duplicate), one additive migration (`stress_results` gains 7 new nullable columns, comments
only — no existing column touched, no row rewritten), regenerated Supabase types, one new test
file, and this documentation. No `UPDATE`/`DELETE` was issued against `matches`, `audit_runs`,
`metric_results`, or `final_decisions` at any point. The 14 formerly-vetoed matches' persisted
`final_decisions.final_selection` remains `INSUFFICIENT EVIDENCE` until the real pipeline
re-audits them — this document does not assert otherwise anywhere.
