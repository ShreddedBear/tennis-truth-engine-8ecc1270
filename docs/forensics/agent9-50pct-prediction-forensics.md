# Agent 9 — Forensic Investigation: "Excessive 50% Predictions"

**Scope: read-only.** No production code changed, no calibration refit, no DB writes, no
replay, no historical population regenerated. Everything below is either a direct code
citation (`file:line`) or a read-only SQL query against the live Supabase project
`tennis-matrix-audit` (`qyovnrkiknsiqjybxubf`), run on 2026-09-17. Facts and hypotheses
are labelled explicitly throughout.

## 0. The single most important finding: the assumed architecture does not exist here

The task brief assumes a classic weighted-ensemble prediction engine: per-module win
probabilities (Surface Elo, Serve/Return, Recent Form, H2H, Fatigue) combined by
reliability-weighted averaging, blended with a "Specialist" model and a Monte Carlo
simulator, then calibrated and clamped to a final probability.

**PROVEN FACT:** that pipeline is not implemented in this repository. It belongs to a
separate, external, third-party product called **Tennis Matrix AI** ("Matrix"). This
repo — the **Truth Engine** — does not produce Matrix's predictions; it independently
*audits* them from parsed PDF reports. Evidence:

- `src/lib/pdf-extract.functions.ts:10-23` — `AiMatrixSummary` is the schema this repo
  extracts from Matrix's PDF exports: `model_votes` (`surface_elo`, `serve_return`,
  `recent_form`, `head_to_head`, `market_consensus`, `general_model`,
  `specialist_model`), `monte_carlo.win_probability`, `engine_breakdown` — i.e. every
  module named in the task brief is a **label printed inside a third-party PDF**, not a
  computation this codebase performs. `src/lib/pdf-extract.functions.ts:192` is the
  literal LLM extraction prompt used to pull those fields out of PDF text.
- `src/lib/summary-parser.ts:32` lists the same phrases (`"monte carlo simulation"`,
  `"specialist model"`, `"surface elo"`, …) as `UI_CHROME_PHRASES` — decorative labels to
  strip out of extracted text, confirming they are Matrix's UI chrome, not this repo's
  logic.
- `docs/audit-task-matrix-summary-quarantine.md:10-11` (repo's own words): *"The Truth
  Engine independently audits Tennis Matrix AI's predictions. It is **not** Tennis
  Matrix AI, and it may only use evidence the Truth Engine itself actually possesses."*
- `src/lib/truth-engine-decision-record.ts:10-11`, `src/lib/audit-pipeline.ts:877-878`
  (repo's own words, verbatim, twice): *"assigns NO weights and computes NO probability
  … evidence_support_percent is never a win probability."*

**Consequence for this investigation:** the 15 numbered items in the task ("Surface Elo
probability", "Serve & Return probability", … "Monte Carlo/simulator blending") describe
Matrix's internals. Matrix's source code is not in this repository and cannot be
forensically examined here — no amount of code reading in this repo can prove or
disprove what Matrix does internally. Any claim about *why Matrix's own numbers cluster
near 50%* is **UNKNOWN / out of scope** unless it can be answered from data this repo
actually stores (Section 4 attempts exactly that, with real numbers).

What this repo *does* own, and what actually can be forensically root-caused, is:
1. The Truth Engine's own decision process (a discrete evidence-vote, not a probability).
2. The Truth Engine's own, separate, optional statistical calibration layer.
3. Two ledgers that grade Matrix's reported win probability against real outcomes.

Sections 1-3 cover those three. Section 4 is the real production-data finding, and it is
the most significant thing this investigation turned up.

## 1. The Truth Engine's decision core is NOT a probability model

**PROVEN FACT.** `src/lib/truth-engine-metric-comparison.ts` turns each of 25 "active"
metrics (`ACTIVE_METRIC_CODES`, `src/lib/truth-engine-active-metrics.ts:25`, derived from
`COMPARISON_SPECS`) into one of four **categorical** labels per metric:
`COMPARED` (`favours: P1 | P2 | NEUTRAL`), `NO_COMPARISON_SPEC`, `ONE_SIDED_EVIDENCE`,
`VALUE_NOT_PARSEABLE`, `INSUFFICIENT_SAMPLE`. There is no continuous probability at this
layer at all — `favours` is an enum, not a number.

`src/lib/truth-engine-decision.ts` (`decideTruthEngineSelection`, lines 159-311) groups
these into **evidence families** (anti-double-counting; correlated metrics vote once,
line 130-143), computes `evidence_percent` as `support.length / (support+contra+conflicted).length * 100`
(line 191-199), and returns **one of three discrete outcomes**: `"P1"`, `"P2"`, or
`"INSUFFICIENT_EVIDENCE"` — gated by:

- `EVIDENCE_SELECTION_THRESHOLD = 60` (line 65): a leader needs ≥60% of the *directional*
  family votes (line 261).
- Leave-one-family-out (LOFO) stability check (lines 271-296): if removing any single
  family reverses the leader, the result is refused as `FRAGILE`.
- A tie (equal P1/P2 family votes) is refused explicitly and reported as **50%** by
  construction (lines 225-238) — but this is a rare, discrete, honestly-labelled tie
  case, not a probability computation. It can only ever be exactly `50.0` when the
  supporting and contradicting family counts are literally equal (1-1, 2-2, 3-3, …); it
  is mathematically impossible for this function to emit values like 51%, 52%, 53%
  (there is no rounding/interpolation — `evidence_percent` is always
  `k / n * 100` for small integers `k, n`).

**Consequence:** because this engine outputs discrete P1/P2/refusal, not a continuous
probability, the specific complaint "excessive 50%/near-50% probabilities across many
matches" cannot literally apply to this layer's output in the way the task brief frames
it (there is no probability field being emitted here that could compress toward 0.5).
What *can* look, from the outside, indistinguishable from "the model can't decide" is the
refusal rate — see Section 4.

**Explicit repo-wide check for hidden `0.5` fallback logic (task requirement, item 3):**
grepped every `.ts` file in `src/` for `= 0.5`, `?? 0.5`, `: 0.5`, `0.5;`. Three hits,
none of which is a neutral-probability fallback:
- `src/lib/pbp-score-state-recovery.ts:98` — `p*p+q*q>0?(p*p)/(p*p+q*q):0.5` is the
  legitimate degenerate case of a point-by-point win-from-deuce Markov formula when both
  serve probabilities are exactly zero (an edge case with no real meaning either way,
  not a global fallback).
- `src/lib/audit-metric-020-level-tour-transition.ts:100` — `prevWinRate >= 0.5` is a
  threshold comparison on an already-computed win rate, not a fallback assignment.
- `src/lib/truth-engine-calibration.ts:282` — `p >= 0.5 ? 1 : 0` inside the `accuracy()`
  scoring helper (standard "which side does this probability favour" binarization for
  computing accuracy, not a fallback).

**PROVEN FACT: there is no `return 0.5` / `probability = 0.5` / global neutral-fallback
pattern anywhere in this repo's own prediction/decision code.** This specific,
frequently-suspected bug class (task section 7/13 of the brief) does not exist here.

## 2. The Truth Engine's own calibration layer has never produced a single probability in production

`src/lib/truth-engine-calibration.ts` is a genuinely separate, optional, downstream
statistical layer that converts the deterministic engine's own `evidence_support_percent`
(never a per-module probability) into an empirically-fitted probability via walk-forward
decile binning with Laplace(+1,+2) smoothing (`calibratedProbability`, lines 267-272):

```
return (bin.wins + 1) / (bin.n + 2);
```

This is a real, quantifiable, textbook shrinkage-to-0.5 mechanism: for a bin with `n`
observations and `k` wins, the output is confined to the coarse set `{(k+1)/(n+2) : k=0..n}`,
which is deliberately biased toward 0.5 for small `n` (that is the intended purpose of
Laplace smoothing — never let a thin bin fabricate a false 0%/100%). Example
quantification: `n=10, k=5 → 0.500` exactly; `n=10, k=6 → 0.583`; `n=30, k=15 → 0.500`.
Below `MIN_TOTAL_CALIBRATION_SAMPLE = 40` total eligible observations, or
`MIN_TRAIN_FOLD_SAMPLE = 30` per fold, the function refuses to calibrate at all
(`computeWalkForwardCalibration`, lines 341-343, 372) rather than fabricate a number.

**PROVEN FACT, from live production data:**

```sql
select count(*) from truth_engine_calibration_observations;  -- 0 rows
select count(*) from calibration_ledger;                     -- 0 rows
```

Both tables that would feed this calibration layer are **completely empty** in
production. This walk-forward calibration model has never run against real data and has
never emitted a single probability of any value — 50% or otherwise. **It is categorically
not the cause of any observed "excessive 50%" symptom today**, because it has produced
zero live outputs. (Also: only decisions with a committed winner ever become eligible
observations — `calibrationEligibility`, `truth-engine-calibration.ts:100-111` — so even
once populated, this layer's inputs would already be restricted to
`evidence_support_percent ∈ [60,100]`, the range of *selected* decisions; it cannot
compress an INSUFFICIENT_EVIDENCE refusal, because those never enter it.)

## 3. A separate, simpler calibration ledger grades Matrix's own win probability — also nearly empty

`src/lib/calibration.ts` (`gradeResult`) is a different, older mechanism: it buckets
**Matrix's own reported win probability** (`matrixWp`, an external number this repo only
observes) into fixed bands and tracks win-rate-per-band over time
(`calibration_buckets`). This is a scoreboard *of* Matrix, not a computation *by* this
repo.

**PROVEN FACT, from live production data** (active calibration version,
`calibration_buckets`):

| Band | Matrix's own reported WP | Graded n | Actual win % |
|---|---|---:|---:|
| ORANGE | ≤55% | 3 | 33.3% (small sample) |
| TAN | 56–64% | 23 | 56.5% |
| PURPLE | 65–69% | 19 | 78.9% |
| BLUE | 70–74% | 27 | 74.1% |
| PINK | 75–79% | 26 | 73.1% |
| BROWN | 80–84% | 12 | 75.0% |
| INDIGO | 85–89% | 8 | 75.0% (small sample) |
| GOLD | 90%+ | 2 | 100.0% (small sample) |

Two important facts, both provable, both bounded by what this repo can see:
- The `calibration_ledger` table that is supposed to back these bucket counts is
  **empty** (0 rows) — the 120 total graded observations behind this table were written
  by a backfill/seeding process (`calibration-backfill.ts` / `calibration-population*`),
  not by live `gradeResult()` calls going through the ledger. This is a genuine
  provenance gap: the numbers in `calibration_buckets` cannot currently be traced back to
  individual graded matches through `calibration_ledger`.
  **PROVEN (provenance gap); root cause of *why* backfill bypassed the ledger is
  UNCONFIRMED** — would need the backfill script's own history/logs, out of scope here.
- Only **3** graded observations exist below 56% at all. This dataset gives no support
  either way for "Matrix outputs excessive near-50% predictions" — the near-50% band is
  almost entirely un-graded, not proven-absent. **UNKNOWN**, not "expected behaviour": we
  cannot see Matrix's raw, ungraded prediction stream from inside this repo to check
  whether it spikes at 50% before grading; only 3 graded rows have ever landed in that
  band.

## 4. The real, quantified, production-confirmed defect: real winners silently reported as "no signal"

This is the one finding in this investigation that is a genuine, dated, git-correlated,
production-data-confirmed **bug** — and it produces exactly the practical symptom the
task describes (a large fraction of matches reported with no directional signal, which
any downstream consumer treats the same way it would treat a 50/50 call), even though the
mechanism is not a probability calculation.

### 4.1 The mechanism

The Truth Engine pipeline computes its winner **twice**, at two different pipeline
stages, from the same pure function (`deterministicIndependentConclusion`,
`src/lib/audit-pipeline.ts:786-798`) called on `metric_results` for the run:

1. **Independent Conclusion** (`commitConclusion`, `audit-pipeline.ts:801-826`) — runs
   once per run, the first time metric evidence is swept. If `deterministic.winner` is
   null at that moment, it locks `audit_runs.independent_winner = null` **permanently**
   for that run (line 818) and moves on.
2. **Final Decision** (`commitFinalDecision`, `audit-pipeline.ts:864-930`) — runs later,
   after Verification/Disagreement/Underdog/Stress stages, and **recomputes the same
   deterministic function fresh** against `metric_results` again (`freshDeterministic`,
   line 883) purely to build the diagnostic `gate_report.deterministic_decision` record
   (`buildDecisionRecord`, line 908).

If metric evidence changes between step 1 and step 2 — e.g. an asynchronous metric
producer resolves late, after the Independent Conclusion has already locked in — the two
calls to the *same pure function* on *different evidence snapshots* can legitimately
disagree. When that happens:
- The persisted, consumer-facing fields (`final_selection`, `final_audit_color`, `action`)
  are built from the **stale, already-locked** `run.independent_winner`
  (`audit-pipeline.ts:930`: `final_selection: run?.independent_winner??null`).
- The **correct, fresher** answer is captured only inside the diagnostic
  `gate_report.deterministic_decision` JSON blob — which is not what colour/action/
  `final_selection` are computed from.

**A fix for exactly this divergence exists in the current code**: the
`WINNER_INTEGRITY_MISMATCH` guard (`audit-pipeline.ts:896-897`) now blocks
`commitFinalDecision` from persisting anything at all when
`freshDeterministic.winner !== run.independent_winner`, per its own comment
(lines 884-895): *"A real production run proved that premise can break … nothing was
stopping that disagreement from being silently persisted into gate_report as if it were
audited, where downstream calibration/grading code (match-result-capture.ts) reads it as
authoritative."* This confirms the repo's own authors already found and diagnosed this
exact failure mode.

### 4.2 Quantified, live evidence that the historical data still carries the pre-fix defect

Git history:
```
f8063b9  2026-09-11 09:48:50 +0000  Phases 10+13: winner identity, final-decision integrity, calibration, result capture   <- adds the WINNER_INTEGRITY_MISMATCH guard
6a4bd14  2026-09-04 18:23:15 +0000  Final decision gate: select at >=60% of the directional evidence
8c69398  2026-09-03 23:01:05 +0000  Build the deterministic Truth Engine decision core
```

Live query against `final_decisions` (60 rows total, **all** from a single day,
2026-09-10 — one day *before* the integrity-guard commit landed on 2026-09-11):

```sql
select final_selection,
       gate_report->'deterministic_decision'->>'outcome' as det_outcome,
       gate_report->'deterministic_decision'->>'stability' as det_stability,
       (gate_report->'deterministic_decision'->>'evidence_support_percent')::numeric as pct,
       count(*)
from final_decisions
group by 1,2,3,4;
```

Result (full table in the query output above). Isolating the defect:

**14 of 60 rows (23.3%) have `final_selection = "INSUFFICIENT EVIDENCE"` (and
`final_audit_color = "INSUFFICIENT EVIDENCE"`, `independent_winner = null`) while their
own `gate_report.deterministic_decision` shows a real, STABLE-or-ROBUST winner at
60–100% directional evidence support:**

| det_outcome | det_stability | evidence_support_percent | count |
|---|---|---:|---:|
| P1 | ROBUST | 100 | 1 |
| P1 | STABLE | 60 | 2 |
| P1 | STABLE | 66.7 | 1 |
| P1 | STABLE | 71.4 | 2 |
| P1 | STABLE | 80 | 1 |
| P1 | STABLE | 100 | 1 |
| P2 | ROBUST | 66.7 | 3 |
| P2 | ROBUST | 75 | 1 |
| P2 | ROBUST | 80 | 1 |
| P2 | STABLE | 60 | 1 |

For every one of these 14 rows, `audit_runs.independent_decision_committed_at` is a real,
populated timestamp (the Independent Conclusion stage genuinely ran and genuinely
committed — it did not crash or skip), and `audit_runs.independent_winner` is `null` —
confirming the mechanism in 4.1 exactly: at commit time the evidence read as
insufficient; by Final Decision time (minutes later, same run) it read as a clear,
sometimes **ROBUST, 100%-support** winner, and only the diagnostic record kept the truth.

One inspected example in full (`final_decisions.id = cb3f7225-...`, match Norbert Gombos
vs Svyatoslav Gulin): `independent_winner: null`, `final_recommendation: "INSUFFICIENT
EVIDENCE"`, while `gate_report.deterministic_decision` shows `outcome: "P1"`,
`selected_player: "Norbert Gombos"`, `stability: "STABLE"`, `corroborated: true`,
`evidence_support_percent: 71.4`, five supporting families (`CLOSING_ABILITY`,
`IMPROVEMENT_TREND`, `RECENT_FORM`, `RESULTS_HISTORY`, `SURFACE_STRENGTH`) against one
contradicting family (`LOSS_PROFILE`), `green_lock_reasons: []` (nothing else was
blocking a real pick).

**PROVEN FACT.** This is not calibration, not Monte Carlo, not a weighting formula, and
not the deliberate tie-handling in Section 1 — it is a **stage-ordering / re-evaluation
consistency bug**: the same deterministic function computed twice in one pipeline run can
disagree, and the disagreement was (until 2026-09-11) silently swallowed into the
consumer-facing fields instead of being surfaced or reconciled.

### 4.3 What this means for "excessive 50%"

- This is the closest verified analogue in this codebase to the reported symptom: a
  quarter of the entire visible production dataset (14/60 = 23.3%) shows "no pick" /
  "INSUFFICIENT EVIDENCE" for matches the evidence engine itself judged STABLE-to-ROBUST
  winners on, including several at the **maximum possible confidence** (100% directional
  support, ROBUST stability — the strongest category this engine can produce). Any
  consumer treating "no pick" as equivalent to "toss-up"/50% would report exactly the
  "excessive 50%" pattern described in the task, on nearly a quarter of matches, for a
  reason that has nothing to do with weak evidence — the evidence was there and was
  strong; a bug discarded it downstream.
- The fix (`WINNER_INTEGRITY_MISMATCH`, `audit-pipeline.ts:896-897`) prevents *future*
  silent divergence by blocking the stage instead of persisting a wrong answer — but it
  does **not** reprocess or correct the 14 already-persisted rows, which still sit in
  `final_decisions` today reading "INSUFFICIENT EVIDENCE."
- **All 60 rows in the live `final_decisions` table predate the fix** (2026-09-10, fix
  landed 2026-09-11), so there is currently **no post-fix production data** to confirm
  the guard behaves as intended at runtime (it is code-verified — the logic reads
  correctly — but not yet runtime-verified against a fresh batch). **HYPOTHESIS, not yet
  observable:** once new runs execute past 2026-09-11, the guard should either (a)
  eliminate this specific divergence pattern from new `final_decisions` rows, or (b)
  surface it loudly as `WINNER_INTEGRITY_MISMATCH`/`BLOCKED` stage outcomes instead of a
  silent "INSUFFICIENT EVIDENCE." Confirming this requires fresh runtime data this
  investigation does not have access to generate (no replay permitted).

## 5. Duplicated/correlated evidence (task item E)

**PROVEN, by design, not a defect.** `truth-engine-decision.ts:130-143` groups metrics
into `family` before voting, and each family votes exactly once regardless of how many
metrics it contains (`leaderOf`, lines 145-151). `truth-engine-metric-comparison.ts:104-107`
documents a concrete case: metrics 031 and 080 both read the same shared-opponent pool
and are deliberately assigned the same `COMMON_OPPONENT` family so they cannot count
twice. `docs/audit-truth-engine-decision-core.md:64-66` documents the *prior*, now-fixed
version of this problem: before this family system existed, `commitConclusion` counted
raw distinct `evidence_family` strings, which double-counted correlated signals as
independent corroboration — described there as already fixed by the family-vote system
audited in Section 1.

## 6. Hard ceilings/floors created by the architecture (task item F)

- `evidence_percent` (Section 1) can only take values `k/n*100` for small integers,
  bounded below by `EVIDENCE_SELECTION_THRESHOLD = 60` for any *selected* winner — a
  winner is never reported with directional support under 60%, by construction.
- The Truth Engine's calibrated probability (Section 2), if it ever runs, is bounded by
  Laplace smoothing to `(0+1)/(n+2)` .. `(n+1)/(n+2)` — it can never report exactly 0% or
  100%, and is pulled toward 0.5 more strongly the smaller the bin.
- `MIN_TOTAL_CALIBRATION_SAMPLE = 40` is a hard floor below which no calibrated
  probability is emitted at all (`truth-engine-calibration.ts:32,341-343`).
- The `matrixWp <= 55` "no-edge floor" (`audit-engine.ts:376`) can force `RED / PASS` even
  when the Truth Engine's own evidence is otherwise GREEN-eligible — but this reads
  Matrix's externally-reported number, not anything this repo computes, and only affects
  colour/action, never `final_selection`/`independent_winner` (per the code's own
  documented invariant, `audit-engine.ts:395-412`).

## 7. Classification of each issue

| # | Issue | Classification |
|---|---|---|
| 1 | Task's assumed weighted-ensemble/Monte Carlo pipeline doesn't exist in this repo | **N/A — architecture mismatch.** That pipeline belongs to external Matrix; UNKNOWN whether/why it clusters at 50%, cannot be assessed from this codebase. |
| 2 | Truth Engine outputs discrete P1/P2/INSUFFICIENT_EVIDENCE, not a probability | **EXPECTED BEHAVIOUR** (documented, deliberate design) |
| 3 | Exact-50% only occurs on a genuine family-vote tie | **EXPECTED BEHAVIOUR** |
| 4 | No hidden `0.5` fallback found anywhere in decision code | **PROVEN ABSENT** (not a bug, because it doesn't exist) |
| 5 | Truth Engine's own walk-forward calibration (Laplace shrink to 0.5 for thin bins) | **ARCHITECTURAL, EXPECTED, but currently moot** — 0 live observations, has never executed |
| 6 | `calibration_ledger` empty while `calibration_buckets` has seeded data | **PROVENANCE GAP** — root cause of the seeding path UNCONFIRMED |
| 7 | Anti-double-counting family system | **EXPECTED BEHAVIOUR**, and itself the fix for a documented prior bug |
| 8 | **Independent Conclusion vs. Final Decision winner divergence, 14/60 (23.3%) of live rows persist "INSUFFICIENT EVIDENCE" despite a STABLE/ROBUST 60–100%-support winner in the same row's own diagnostic record** | **BUG — CONFIRMED, with a code fix already written (`WINNER_INTEGRITY_MISMATCH`, commit f8063b9) but an unremediated backlog of stale rows and no post-fix production data yet to confirm runtime behaviour.** |

## 8. Minimal proposed fixes (NOT implemented — reporting only, ranked by causal specificity)

1. **Backfill/reprocess the 14 stale rows** (Section 4.2): for any `final_decisions` row
   with `created_at` before the `WINNER_INTEGRITY_MISMATCH` guard's deploy where
   `gate_report.deterministic_decision.outcome` disagrees with `final_selection`,
   re-derive `final_selection`/`final_audit_color`/`action` from the fresher
   `gate_report.deterministic_decision`, or re-run the pipeline stage for that run so the
   guard's own logic decides the outcome consistently. This directly targets the proven,
   quantified defect and requires no methodology change — it's applying the fix's own
   already-approved logic retroactively.
2. **Add a persisted counter/alert on `WINNER_INTEGRITY_MISMATCH`** so that once new runs
   execute past the fix, it's directly observable (rather than inferred from git dates)
   whether the guard is firing, how often, and whether it's blocking the pipeline (which
   would itself need a remediation path — currently a mismatch just leaves the run stuck
   `BLOCKED` with no described recovery/re-run procedure in the code read here).
3. **Route `calibration-backfill`/`calibration-population*` writes through
   `calibration_ledger`** (Section 3) instead of writing `calibration_buckets` directly,
   so every number in the bucket scoreboard is traceable to an individual graded match —
   closes the provenance gap without touching the grading math itself.
4. Out of scope for this repo entirely: any investigation of why Matrix's own raw,
   un-graded win-probability stream might cluster near 50% is not answerable here — it
   would require access to Matrix's own system or a much larger sample of graded
   near-50% Matrix predictions than the 3 currently in `calibration_buckets`' ORANGE
   band.

## 9. Tests that should be added to prevent recurrence

- A regression test asserting that when `deterministicIndependentConclusion` is called
  twice on two different (but each internally valid) `metric_results` snapshots for the
  same run and the results differ, `commitFinalDecision` never persists a
  `final_decisions` row whose `final_selection`/`final_audit_color` contradicts its own
  `gate_report.deterministic_decision.outcome` — either it blocks (current intended
  behaviour) or it reconciles, but it must never diverge silently. (This is exactly the
  `WINNER_INTEGRITY_MISMATCH` guard's job; a test should pin its behaviour so it can't
  regress.)
  Note: `docs/audit-truth-engine-decision-core.md:118-120` says `936/936` tests were
  passing when the deterministic core was built, and this repo does have
  `truth-engine-calibration.test.ts`, `truth-engine-decision`-adjacent tests referenced
  elsewhere — but no test file was found in this pass that specifically fixtures the
  "evidence changes between Independent Conclusion and Final Decision" race described in
  `audit-pipeline.ts:884-895`. Confirming that gap conclusively would need an exhaustive
  read of every `*.test.ts` in `src/lib/`, which this pass did not fully complete —
  **flagged as UNCONFIRMED, worth a follow-up grep for `WINNER_INTEGRITY_MISMATCH` across
  `*.test.ts`.**
- A data-quality check/migration audit query (like the ones run live in Section 4.2)
  should be added as a recurring, read-only check against `final_decisions` /
  `audit_runs`, so any future recurrence of the same divergence pattern is caught by
  monitoring rather than rediscovered by manual forensic SQL.
- A test asserting `evidence_percent`/`calibratedProbability` are never read or displayed
  for `INSUFFICIENT_EVIDENCE` outcomes (guarding against a future UI/report change that
  might paper over a refusal with a fabricated "50%").

## 10. Facts vs. hypotheses — summary

**Proven (code citation and/or live query):**
- The task's assumed module-weighted-ensemble/Monte Carlo architecture is not implemented
  in this repo; it describes an external product ("Tennis Matrix AI") whose PDF output
  this repo parses for audit purposes only.
- The Truth Engine's own decision core emits discrete P1/P2/INSUFFICIENT_EVIDENCE, never
  a continuous probability, and cannot mathematically emit values like 51–59% by
  construction.
- No hidden `0.5`/50% neutral-fallback exists anywhere in this repo's prediction/decision
  code (three `0.5` hits total, all legitimate and unrelated to fallback logic).
- The Truth Engine's own walk-forward calibration layer has zero live observations and
  has never executed in production.
- `calibration_ledger` is empty while `calibration_buckets` holds seeded data with no
  traceable provenance through the ledger.
- 14 of 60 (23.3%) live `final_decisions` rows show `INSUFFICIENT EVIDENCE` while their
  own embedded diagnostic record shows a STABLE-or-ROBUST winner at 60–100% evidence
  support, all dated the day before a code fix (`WINNER_INTEGRITY_MISMATCH`,
  `audit-pipeline.ts:896-897`, commit f8063b9, 2026-09-11) that targets exactly this
  divergence.

**Hypothesis / unconfirmed:**
- Whether the `WINNER_INTEGRITY_MISMATCH` guard behaves correctly at runtime against
  fresh data (no post-fix production rows exist yet to check).
- Why `calibration-backfill`/population scripts wrote `calibration_buckets` without
  corresponding `calibration_ledger` rows.
- Whether Tennis Matrix AI's own raw prediction stream (outside this repo entirely)
  clusters near 50% — cannot be assessed from this codebase; only 3 graded historical
  observations exist below 56% WP.
- Whether every `*.test.ts` file in the repo already covers the Independent-Conclusion-
  vs-Final-Decision race (a targeted grep found none, but an exhaustive read of all test
  files was not completed in this pass).
