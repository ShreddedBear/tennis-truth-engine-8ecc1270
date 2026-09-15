# Phase 0 Audit — Neutral / Abstention Vote Leakage

Scope: read-only. This is the audit item the task calls "the single most important thing to
find" — every path where a metric that cannot be computed still casts a vote, or is silently
treated as neutral/abstain without being recorded as such.

**Headline finding: the decision core itself (`truth-engine-decision.ts` +
`truth-engine-metric-comparison.ts`) does not have this defect.** It distinguishes three
genuinely different states and never confuses them. The real risks found are (a) one narrow,
already-identified, already-fixed-in-this-branch wiring bug in the *diagnostic denominator*
(never the winner), and (b) two structural gaps in the audit/diagnostic layers that are not
vote leakage but could be mistaken for it if not read carefully. Each is documented below with
its exact mechanism and its exact blast radius.

## 1. How the core keeps "no evidence" and "evidence found no difference" apart

Three states, kept structurally distinct end-to-end:

| State | Meaning | Where it's decided | Enters the vote? | Enters `evidence_percent`'s denominator? |
|---|---|---|---|---|
| `UNAVAILABLE` (comparison `status !== "COMPARED"`) | No usable, parseable, two-sided evidence at all (`TREATMENT_NOT_USABLE`, `ONE_SIDED_EVIDENCE`, `VALUE_NOT_PARSEABLE`, `INSUFFICIENT_SAMPLE`, `NO_COMPARISON_SPEC`) | `compareMetricRow()` | **No.** Filtered out before `buildFamilies()` even sees it (`c.status !== "COMPARED"` → skipped). | No — never reaches a family at all. |
| `NEUTRAL` (comparison `status === "COMPARED"`, `favours === "NEUTRAL"`) | Both sides genuinely measured; `|differential| ≤ materiality`, i.e. real evidence found no material difference | `compareMetricRow()` | Family-level: a family where *no* metric clears materiality votes `NEUTRAL`. | **No** — `evidenceShare()`'s denominator is `support + contra + conflicted`, explicitly excluding `NEUTRAL` families. Reported (`neutral_families`) but neither helps nor hurts either side. |
| `INTERNALLY_CONFLICTED` | Family's own members disagree (some metrics favour P1, some favour P2) | `voteFor()` | Votes for **nobody**, but *does* sit in the directional denominator (it's real opposing evidence, so it correctly drags down whichever side would otherwise lead). | **Yes**, deliberately — this is the one case where "abstain" is designed to count against a leader, and it's documented as intentional, not a bug. |

The critical design point, stated explicitly in the source comments and verified by reading
`compareMetricRow()`: **a missing value is never coerced to 0**, and **one-sided evidence is
never a lean for the side that happens to have it** — `ONE_SIDED_EVIDENCE` and
`VALUE_NOT_PARSEABLE` both return `favours: "UNAVAILABLE"`, not `NEUTRAL` and not a lean. This
is the exact failure mode the task's warning describes ("a family that votes 'neutral' because
its data is missing is manufacturing false agreement"), and it is structurally prevented:
`UNAVAILABLE` metrics never reach `buildFamilies()`, so a family with e.g. 3 of 8
point-by-point metrics unavailable and 5 measured is voted on the 5 real comparisons only —
never diluted toward NEUTRAL by the 3 that didn't arrive.

`decideTruthEngineSelection` re-filters `comparisons.filter(c => isActiveMetricCode(...))`
independently of `compareMetricRows`'s own filtering, so even a malformed input claiming
`status: "COMPARED"` for an inactive (no-spec) code cannot manufacture a vote — defense in
depth the code itself calls out as deliberate ("this second, independent filter... means that
guarantee doesn't rest on every future caller routing through `compareMetricRows` correctly").

## 2. The one real leakage path found — G3, diagnostic denominator only (already fixed on this branch)

`docs/truth-engine-production-readiness-gap-audit.md` (pre-existing forensic audit, dated
before this Phase 0 pass) documents a genuine defect: `commitFinalDecision` built
`metricRows` for the *decision record* without passing `p1_unavailable_reason` /
`p2_unavailable_reason` through. `metric-activation-status.ts`'s `classifySideActivation()`
depends on that reason to distinguish "we asked and genuinely found nothing" (`SOURCE_EMPTY`,
`INSUFFICIENT_SAMPLE`, `GENUINELY_UNAVAILABLE` — legitimately excused from the coverage
denominator) from "the pipeline broke" (`PRODUCER_FAILURE`, `PARSE_FAILURE`, etc. — a real miss
that should still count against coverage). With the reason columns dropped, every unusable
side fell through to the `default:` branch and was recorded as `PRODUCER_FAILURE` — never
`SOURCE_EMPTY`. Production confirmed this: 724 `ACTIVATED` / 776 `PRODUCER_FAILURE` / **0** of
every other status across 60 runs, and `evidence_coverage_eligible` equal to the fixed 25 in
60 of 60 runs — the dynamic per-match denominator was silently inert.

**Verified on this branch's current HEAD:** `audit-pipeline.ts` line 922 now passes
`p1_unavailable_reason`/`p2_unavailable_reason` through to `metricRows`. The fix is present in
the code this audit read. It is **not yet reflected in any production data** — production has
0 rows since the fix, per the gap audit's own snapshot (60 matches, 0 `result_grades`, 0
`calibration_ledger` rows) — so this cannot yet be verified against a live run, only against
the source.

**Scope of the bug, precisely:** this only ever affected `evidence_coverage_eligible` — a
*diagnostic/display* denominator used for the "X% of active metrics have usable evidence"
readout (`activeMetricReadiness()`). It never touched `decideTruthEngineSelection`'s own
family-vote logic, which reads `MetricComparison[]` directly from `compareMetricRow()` and was
never in this code path. **No historical winner was ever wrong because of G3** — this is a
coverage-display bug, not a vote-manufacturing bug — but it is exactly the shape of defect the
task's warning is about, one layer removed from the vote itself, and worth flagging precisely
because it shows the failure mode *can* occur in this codebase when a classifier's required
input is merely `optional` in its TypeScript type rather than required. See
`docs/truth-engine-production-readiness-gap-audit.md` §G3 and §G for the full mechanism and
the "architecture gaps that will cause future regressions" note about optional fields on
classifier inputs — that generalizable risk is still open.

## 3. Two audit-layer gaps that are not vote leakage but resemble it

These sit in `truth-engine-audit.ts`'s diagnostic layers (Verification, Underdog), which can
never change the winner but do feed the human-facing report. Neither manufactures a vote;
both under-report evidence for one side in a way worth flagging as a readability/completeness
gap, not a correctness one.

**3a. Underdog pathway census, historically one-sided.** `runUnderdogAnalysis()` in the
*current* code computes pathways for **both** players unconditionally (`sides: [...]`), a
fix already landed on this branch per its own comment: the previous version only analyzed the
non-selected side, and when the engine refused (no selection), it analyzed **neither** player
— confirmed in production: "18 of the 32 current refusals had neither player evaluated and 14
had exactly one." This is now fixed in code (both sides always computed from their own
values), but the gap audit's G13 still flags that per-match `audit_pipeline` *row
instantiation* creates rows for both sides regardless, so historical/production rows still
show "0 of N complete" for the side that was never actually asked to run — a reporting
clarity issue, not a vote leakage one (nothing here ever selected a winner).

**3b. `runVerificationAudit`'s own family outcome can diverge in wording from the decision
core's vote for a conflicted family.** Both use the same three-way split
(P1-only / P2-only / both-disagree), but Verification labels the disagreeing case
`INSUFFICIENT_EVIDENCE` while the decision core labels the identical case
`INTERNALLY_CONFLICTED`. Same underlying rows, same logic, different label. Not a leakage
path — the numbers are identical, `runTruthEngineAudit`'s own end-to-end trace cross-checks
`verification_agrees_with_decision_core` — but a report reader unfamiliar with both files could
misread a naming mismatch as two systems disagreeing about the same evidence. Cosmetic; noted
because the task specifically asks about false-agreement-looking artifacts.

## 4. Explicit non-findings (checked, clean)

- `parseMetricValue()` never defaults a missing numeric field to `0`; `numeric()` returns
  `null` for `""`, `"NA"`, `"NULL"`, or anything non-finite.
- No `?? 50`, `?? 0.5`, or similar "default to midpoint" pattern exists anywhere in `src/`
  (grepped for common neutral-default idioms; zero matches).
- `evidenceShare()`'s `directional > 0 ? ... : 0` returns `0` only for the *display* percent
  when there is no directional evidence at all — the decision itself in that case is
  `INSUFFICIENT_EVIDENCE` (`!families.length` branch), never a manufactured 0%-vs-100% lean.
- The stress-test erosion (`erodeEdgesOf`) is explicitly clamped so an eroded edge can fall to
  `NEUTRAL` but can never cross through zero into a vote for the opponent —
  `Math.max(0, Math.abs(advantage) - materiality)` — the exact manufactured-opposing-evidence
  failure mode is named and structurally prevented in the comments and the code.
- Calibration (`truth-engine-calibration.ts`) never feeds back into the decision; it is
  read-only, downstream, and grades an already-frozen `selected_player` — it cannot manufacture
  or launder a vote regardless of anything found here.

## 5. Conclusion for Phase 0

No neutral-vote manufacturing exists in the path that selects a winner. The one confirmed
defect (G3) was diagnostic-denominator-only, is already fixed in this branch's source, and its
generalizable risk (an optional field on a classifier's required input) remains open as an
architecture note, not a live leak. Two audit-layer completeness gaps are noted for
readability. Recommendation for Phase 1: add the regression test the gap audit itself already
names as missing — an end-to-end assertion that the pipeline actually *feeds*
`classifySideActivation()` its reason columns, not just that the classifier is correct in
isolation — so a repeat of G3's exact failure mode (correct classifier, silently starved
input) cannot recur unnoticed.
