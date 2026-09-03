# Forensic audit: the Truth Engine decision process, and the deterministic decision core

## Headline finding

**Before this change, the Truth Engine had never produced a P1-vs-P2 selection.** Not once,
across 405 persisted audit runs. Metric execution worked; every decision stage downstream of
it produced nothing, while still reporting `COMPLETE`.

Live database evidence (queried, not inferred):

| table | rows | P1 populated | P2 populated |
|---|---:|---:|---:|
| `metric_results` | 24,624 | 7,713 | 7,342 |
| `verification_results` | 18,240 | **0** | **0** |
| `disagreement_results` | 21,280 | **0** | **0** |
| `underdog_results` | 9,120 | 4,890 evidence strings | **0 classified** (all `UNRESOLVED`) |
| `stress_results` | 3,040 | **0 `winner_after`** | 1,620 outcomes |
| `audit_runs` | 405 | **0 `independent_winner`** | — |

Meanwhile `audit_stage_runs` reported: Verification 168 COMPLETE, Disagreement 163 COMPLETE,
Dangerous Underdog 163 COMPLETE, Stress 162 COMPLETE, Independent Conclusion 162 COMPLETE,
Final Combination Gate 153 COMPLETE, Final Decision 50 COMPLETE.

## Root cause

Every decision stage delegated **entirely** to the LLM researcher, with no deterministic path:

```
hybrid-audit-research.server.ts
  rules:      i => aiResearcher.rules(i)        // verification + disagreement
  underdog:   i => aiResearcher.underdog(i)
  conclusion: i => aiResearcher.conclusion(i)
  stress:     i => aiResearcher.stress(i)
```

`aiResearcher` requires `LOVABLE_API_KEY` or a fallback provider; when it returns nothing,
each stage settles **every row** as `UNAVAILABLE`. A stage is judged complete when every row
is *settled* — so `done === total` and the stage writes `COMPLETE` having computed nothing.
`provisionalConclusion` then caught the failure and returned `{winner: null}`, which is why
`independent_winner` is null in all 405 runs.

This is precisely the "a stage works because the function exists" failure mode: the code
existed, executed, and reported success, while producing no evidence and no decision.

## What was already working

- **Metric execution.** Genuinely two-sided and correctly oriented. Verified on live rows:
  metric 080 persists P1 `favorable=25, unfavorable=23` and P2 `favorable=23, unfavorable=25`
  — a correct mirror, not a copy. Metric 031 likewise mirrors `opponent_adjusted_set_differential`.
- **The P1/P2 orientation machinery** (`restoreRequestedOrientation`, `mergeMetricFindingSides`).
- **Treatment discipline.** `UNAVAILABLE` is stored as a treatment string, never as 0.
- **The quarantine** (commit 3972423) — unchanged and re-verified here.

## What was NOT working

1. **Verification Audit** — never produced a single finding in 405 runs. Entirely LLM-dependent.
2. **Disagreement Audit** — never produced a single risk. Entirely LLM-dependent. Contradiction
   severity was whatever the model wrote, never derived from evidence.
3. **Underdog pathways** — 0 classified; the 4,890 non-null `evidence` values are the hardcoded
   fallback string `"Retrieval attempted; no admissible pre-match evidence located."`, not evidence.
4. **Stress tests** — asked the model "is this stable?" instead of recalculating a decision input.
   0 rows carry a `winner_after`, because the provisional winner it depends on was always null.
5. **Final selection** — never happened.
6. **Evidence-family counting** — `commitConclusion` counted `distinct evidence_family` strings.
   That double-counts correlated signals as independent corroboration, and the field is often a
   placeholder equal to the metric name.
7. **Unlabelled scalar evidence (data-quality defect, still open).** Metrics 008, 010, 012, 013,
   014, 021, 030 persist bare unitless scalars (`"5"`, `"12"`, `"1"`, `"0"`). A `5` with no unit
   cannot be audited or compared. The decision core refuses these as `VALUE_NOT_PARSEABLE`
   rather than guessing — see "Remaining limitations".

## What was built

Two pure modules (no DB, no network, no AI) plus wiring:

- **`truth-engine-metric-comparison.ts`** — parses both persisted value shapes (bare scalar and
  `key=value; key=value`, including provenance-prefixed strings) and compares P1 vs P2 per metric
  under an **explicit direction registry**. Three absolute rules:
  1. `UNAVAILABLE` is never 0.
  2. One-sided evidence never favours the side that has it.
  3. Direction is declared, never inferred — a metric with no spec is `NO_COMPARISON_SPEC` and
     excluded, because guessing a direction is exactly how a P1/P2 selection silently inverts.

- **`truth-engine-decision.ts`** — groups comparisons into **evidence families that vote once**
  (anti-double-counting), counts independent support and independent contradiction separately,
  runs **leave-one-family-out** as a genuine recomputation, and refuses when evidence is thin,
  tied, or reversible. Distinguishes a **reversal** (the other player leads once a family is
  removed → `FRAGILE` → refuse) from a **tie** (no leader → thin, reported, but not contradicted).

- **`audit-pipeline.ts`** — `deterministicIndependentConclusion()` is now **authoritative** for the
  winner. The provider is consulted only for supplementary rationale text and can never supply,
  override or overturn the selected side. `effective_evidence_count` now comes from the
  deduplicated family count instead of a raw distinct-string count.

## Proof it works — real data, real execution

Run `c40f4025-fe6e-46f1-97ad-099baf3def4e` (Gonzalo Bueno vs Joao Lucas Reis Da Silva), values
taken verbatim from `metric_results` and fed to the real functions:

```
001 COMPARED  favours=P1  p1=1521.13 p2=1465.29   SURFACE_STRENGTH
005 COMPARED  favours=P1  p1=50      p2=0         RECENT_FORM
027 COMPARED  favours=P1  p1=100     p2=81.8      CLOSING_ABILITY
031 COMPARED  favours=NEUTRAL p1=-0.17 p2=-0.10   COMMON_OPPONENT   (|0.07| <= 0.15 materiality)
051 COMPARED  favours=P2  p1=41.7    p2=58.3      H2H_PROBABILITY
080 COMPARED  favours=P1  p1=2       p2=-2        COMMON_OPPONENT
008/010/011   VALUE_NOT_PARSEABLE -> excluded, never zeroed

outcome: P1 (Gonzalo Bueno) | stability: STABLE
support: CLOSING_ABILITY, COMMON_OPPONENT, RECENT_FORM, SURFACE_STRENGTH
contradiction: H2H_PROBABILITY   (P2 leads that head-to-head 3-1 — surfaced, not buried)
reversal-inducing: none | tie-inducing: none
```

Every number is hand-checkable against the persisted rows. 031 and 080 correctly collapse into
**one** `COMMON_OPPONENT` family rather than counting twice.

## Tests executed

`936/936` passing, typecheck clean, production build + worker-bundle check green. The decision
core has 29 dedicated tests covering the required scenarios: P1 superior; P2 superior (exact
mirror); genuinely close; P1 evidence missing; P2 evidence missing; strong contradiction;
single dissent vs broad consensus; correlated metrics counted once; intra-family conflict votes
for nobody; LOFO reversal refused; LOFO survival selected; LOFO independently recomputed;
refusal on a single family; refusal on a tie; refusal with no comparable evidence; quarantined
codes have no spec; quarantined legacy values change nothing; reproducibility; and a
P1/P2-swap test proving the engine is not "P1-first".

The existing end-to-end pipeline test previously asserted a winner that the **mock researcher
echoed**. Its fixture emitted bare `"50"`/`"48"` scalars, which the decision core correctly
refuses. The fixture now supplies realistic comparable evidence, so that test proves a winner
genuinely *derived* from evidence.

## Remaining limitations (stated plainly)

1. **Verification, Disagreement and Underdog stages remain LLM-dependent and produce nothing
   without a configured provider.** This change makes the *selection* independent of them; it
   does not implement deterministic engines for those three stages. They are still, today, empty.
2. **The comparison registry covers 9 metrics** (001, 005, 008, 010, 011, 027, 031, 051, 080).
   Only metrics whose comparable field and direction are defensible were included; extending it
   is additive and low-risk, but each addition needs a justified direction.
3. **Unlabelled scalar evidence** (008/010/012/013/014/021/030) is excluded until those engines
   persist labelled values. This is an upstream data-quality fix, not a decision-core fix.
4. **Anti-leakage was not re-verified in this pass.** The existing per-metric `.leakage.test.ts`
   suites still pass, and the decision core adds no new historical lookups (it only reads values
   already persisted by leakage-tested engines), but a full Phase 8 sweep was not performed.
5. **Backfill.** Existing runs are untouched. The deterministic conclusion applies to runs
   executed from now on; historical rows are preserved exactly as required.
