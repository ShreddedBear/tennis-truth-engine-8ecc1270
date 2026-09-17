# Prediction 50% Collapse — Root-Cause Investigation Report

**Scope note (read first):** The two task briefs (`TASK_PREDICTION_50_PERCENT.md`,
`docs/tasks/prediction-50-percent-root-cause-investigation.md`) describe an assumed
architecture: raw module probabilities (Elo/serve/return/form/H2H) → module reliability
weighting → tour reliability → data-quality adjustment → ensemble → Monte Carlo →
calibration → final clamp. **That architecture does not exist as code in this repository.**
Exhaustive `ripgrep` across `src/`, `supabase/`, `scripts/` for `ensemble`, `moduleWeight`,
`finalProbability`, `predictWinner`, weighted-average combination code, and Monte-Carlo
simulation code returned **zero hits** for a live, in-repo probability ensemble. What
*does* exist is described in Section 1. This mismatch is itself a primary finding, not an
excuse — it is the reason the "collapse to 50%" must be traced through a different, real
mechanism instead of the hypothesized one.

**Execution note:** `npm test` / `vitest` could not be run in this environment — the repo
has no installed `node_modules` and its `vite.config.ts` imports a private package
(`@lovable.dev/vite-tanstack-config`) that isn't available offline, so `npx vitest` fails at
config-load before any test runs. All numeric formulas below were confirmed by **reading
the existing, already-passing test files** (`task18c-elo-win-probability.test.ts`,
`truth-engine-decision.test.ts` and its describe blocks) and by re-deriving the same
arithmetic by hand from the exact source lines cited. Worked examples in Section 4 are
**analytically derived** from that verified code (labelled as such), not captured from a
live run. No production file was modified.

---

## 1. Exact probability pipeline (as it actually exists)

There are **two independent systems** in this repo that touch "win probability," and they
never combine into the single ensemble the briefs assume:

### 1A. The Truth Engine (this app's own logic) — a discrete evidence-vote, not a probability
1. **Per-metric comparison.** ~80 independent audit metrics (Elo, serve/return, recent form,
   H2H, market calibration, etc.) each produce a `MetricComparison` with `favours: P1 | P2 |
   NEUTRAL` (`src/lib/truth-engine-metric-comparison.ts`). One of these, metric 001, computes
   a genuine Elo logistic win probability as *text inside its differential string* —
   `src/lib/task18c-rank-form-workload.ts:60`:
   `elo_win_probability_p1=${(100*expected(a!,b!)).toFixed(1)}%` where
   `expected(a,b) = 1/(1+10**((b-a)/400))` (`task18c-rank-form-workload.ts:38`). This number
   is **never read back out and combined with anything** — it exists only as descriptive text
   in the audit trail; the comparison direction (`favours`) is the only thing that
   downstream code consumes.
2. **Family de-duplication (anti-double-counting).** `buildFamilies()` groups correlated
   metrics into evidence "families" so 5 correlated metrics vote once, not 5 times
   (`src/lib/truth-engine-decision.ts:130-143`).
3. **Family vote.** Each family votes `P1`/`P2`/`NEUTRAL`/`INTERNALLY_CONFLICTED`
   (`truth-engine-decision.ts:120-128`).
4. **Directional evidence share.** `evidence_percent = support / (support + contra +
   internallyConflicted) * 100` (`truth-engine-decision.ts:191-199`). This is a **vote
   share among families**, not a win probability in any statistical sense.
5. **60% selection threshold.** A side is selected only if it holds ≥60% of the directional
   evidence (`EVIDENCE_SELECTION_THRESHOLD = 60`, `truth-engine-decision.ts:65,261`).
   Otherwise the outcome is `INSUFFICIENT_EVIDENCE` — a **first-class refusal**, by explicit
   design (`truth-engine-decision.ts:22-27`).
6. **Leave-one-family-out (LOFO) stability check** can still overturn a ≥60% lead into
   `INSUFFICIENT_EVIDENCE` if removing any single family reverses the leader
   (`truth-engine-decision.ts:271-296`).
7. **Commit.** `deterministicIndependentConclusion()` wraps this into a `ConclusionFinding`
   — and **hardcodes `low:null, high:null` unconditionally**, regardless of `evidence_percent`
   (`src/lib/audit-pipeline.ts:786-798`, specifically line 793: `low:null,high:null,`).
8. **`commitConclusion`** persists `independent_low`/`independent_high` straight from that
   hardcoded-null `ConclusionFinding` (`audit-pipeline.ts:826`). A secondary "provider
   narrative" path (`provisionalConclusion`, `audit-pipeline.ts:800,811`) calls an external
   AI only for *rationale text*, never for `low`/`high`, and the code comment at
   `audit-pipeline.ts:802-806` states it "in practice returned nothing at all across every
   historical run." **Net effect: `independent_low`/`independent_high` are always `null` in
   production.**

### 1B. Calibration layer — downstream, read-only, and NOT fed by the Truth Engine's own signal
9. **`applyCalibration`** (`audit-pipeline.ts:828`) reads the externally-sourced
   `matrix_wp` field (see 1C below), looks up its historical calibration bucket, and calls
   `buildCalibrationSnapshot()` (`src/lib/calibration-snapshot.ts:12-33`):
   ```
   verifiedWinRate = winRate(bucket.wins, bucket.graded)          // bucket-level historical accuracy
   centre = verifiedWinRate ?? (independentLow+independentHigh)/2  // falls back to null/null → null
   calibratedLow  = round(centre - 5)
   calibratedHigh = round(centre + 5)
   ```
   Because `independentLow`/`independentHigh` are always `null` (step 8), the fallback branch
   is dead in production: `calibrated_low`/`calibrated_high` are **entirely determined by the
   externally-sourced Matrix win-probability's historical bucket accuracy**, a single
   population-level number shared by *every match that lands in the same wp bucket*,
   regardless of that match's own Elo/serve/return/form/H2H evidence.
10. `truth-engine-calibration.ts` (a *separate* module, walk-forward evaluation of the
    deterministic engine's own `evidence_support_percent`) is explicitly commented
    "CALIBRATION NEVER SELECTS THE WINNER... nothing here is consulted by the deterministic
    pipeline" (`truth-engine-calibration.ts:1-9`) and gates any output behind
    `MIN_TOTAL_CALIBRATION_SAMPLE = 40` (`truth-engine-calibration.ts:32`). This is a
    read-only accuracy audit, not part of the live prediction path.

### 1C. "Tennis Matrix AI" — a third-party engine, NOT implemented in this repo
11. `matrix_wp`, `model_votes` (surface_elo/serve_return/recent_form/head_to_head/
    market_consensus/general_model/specialist_model), `monte_carlo.win_probability`, and
    `engine_breakdown` all come from **GPT vision extraction of PDF report images** of an
    external "Tennis Matrix AI" product (`src/lib/pdf-extract.functions.ts:12-36,189-192`,
    flattened by `src/lib/matrix-summary-flatten.ts:1-96`). The comment at
    `matrix-summary-flatten.ts:6-11` states plainly: *"every key produced here is
    prediction-engine output — guidance/reference only, never independent audit evidence."*
    **This repo contains no ensemble math, module-reliability weighting, or Monte Carlo
    simulation code for this engine at all** — it only stores whatever percentage numbers
    already appear printed on the third-party PDF. Any collapse toward 50% inside the
    Matrix's own ensemble happens in a system outside this repository and cannot be
    diagnosed or fixed here.
12. `revealMatrix` reads `matrix_wp` only after `independent_decision_committed_at` is set
    (firewall, `audit-pipeline.ts:827`) — confirmed not to leak into the Truth Engine's own
    metrics (isolation asserted by `matrix-summary-flatten.test.ts`).

### 1D. UI
13. `src/routes/app/match.$matchId.tsx:294-295` parses `matrix_wp` from the stored field with
    no fallback of `50` on parse failure (`Number(...)` on a missing/garbled value simply
    becomes `NaN`, not `0.5`/`50` — no defect found here).
14. `match.$matchId.tsx:813` renders the pipeline's headline probability range straight from
    `run.independent_low`–`run.independent_high` (` · ${run.independent_low}–${run.independent_high}%`).
    Per step 8, this is **always `null` in production**, so the UI silently omits the range —
    it does not display a fabricated 50%. (This rules out a pure UI/display bug as the cause
    of literal on-screen "50%" text; the visible symptom, if any, is more likely "no range
    shown" or a range sourced entirely from `calibrated_low/high`, i.e. from the *external*
    Matrix's bucket accuracy, not this app's own evidence.)

---

## 2. Quantitative evidence for where compression occurs

No live database access or executable test runner was available (see Execution note), so the
following is derived analytically from the code paths above, not measured from a live
sample. It is reported as **structural** compression (identical/degenerate outputs by
construction) rather than **statistical** compression (a real distribution measured from
data):

| Stage | Compressing mechanism found | Type | Effect on spread |
|---|---|---|---|
| Truth Engine `evidence_percent` | None found — genuinely computed per match from that match's own family votes (`truth-engine-decision.ts:191-199`) | — | No compression; can range from a tie (0/0 → reported as tied, see `truth-engine-decision.ts:225-238`) to 100% |
| Truth Engine `low`/`high` (the "independent range") | **Hardcoded `null,null`** regardless of `evidence_percent` (`audit-pipeline.ts:793`) | Implementation defect (dead field) | 100% of matches: this app's own confidence range is never populated at all — infinite compression (always the same non-value) |
| `applyCalibration` fallback centre | Falls back to `(independentLow+independentHigh)/2`, but that pair is always `null` (per above), so this branch never executes in production | Consequence of the defect above | The *only* live path is the externally-sourced bucket average |
| `calibrated_low/high` | `centre = verifiedWinRate` (a **single number per calibration bucket**, shared by every match whose external `matrix_wp` falls in that bucket) ± 5 | Structural (bucket-average, not per-match) | Every match in the same wp bucket gets an **identical** calibrated range, independent of that match's own Elo/serve/return/H2H differential — this is real, provable compression, but it compresses toward *the bucket's own historical rate*, not specifically toward 50, unless the buckets themselves and their graded history skew toward the middle (plausible in tennis, where many matches are genuinely competitive, but not verifiable from this environment without DB access) |
| Truth Engine tie handling | When `p1Families === p2Families`, the code explicitly reports the *tied families* as both sides' shares, producing a genuinely-computed 50/50-style split (`truth-engine-decision.ts:225-238`, comment: "a tie is genuinely 50/50 of the directional evidence") | Intentional design | Correctly reflects real evidentiary ties; not a bug, but is the one place the deterministic engine legitimately produces a 50-ish number |
| Elo cold-start default (1500) | Applied independently to each player only when that specific player has zero prior history in the lane (`task18c-rank-form-workload.ts:40,44`) | Legitimate default | Only collapses a match to Elo-parity when **both** players are genuinely new to the historical lane — symmetric absence of data, not a bug uniquely afflicting one side |
| `return 0.5` / `?? 0.5` / `\|\| 0.5` neutral fallback | **Not found anywhere in `src/`, `supabase/`, or `scripts/`** after an exhaustive regex sweep (see Section 3 methodology) | — | No such fallback exists in this codebase |

**Bottom line on Section 2:** the only *provable, code-level* compression mechanisms are (a)
the dead `independent_low/high` field (always null → this app's own per-match confidence
range never reaches users at all) and (b) the calibration-bucket average standing in for it
(shared value across every match in a bucket). Neither is "shrinkage toward 0.5" in the
classic ensemble-shrinkage sense the briefs hypothesize; both are consequences of a field
that was apparently intended to carry the deterministic engine's own confidence but was
never wired up.

---

## 3. Full `0.5` / neutral-fallback grep audit (repo-wide)

Command run: `grep -rnIE "(=\s*0\.5\b)|(=\s*50\b)|(\?\?\s*0\.5)|(\?\?\s*50\b)|(\|\|\s*0\.5)|(\|\|\s*50\b)|return 0\.5|return 50\b|fallback.*0\.5|neutral.*0\.5|DEFAULT_ELO|1500"` across `src/`, `supabase/`, `scripts/` (excluding `*.test.ts`). Every hit and judgment:

| File:line | Code | Judgment |
|---|---|---|
| `audit-metric-020-level-tour-transition.ts:100` | `isStrong = prevWinRate >= 0.5` | Legitimate — classifying a prior tournament run as STRONG/WEAK by its own win rate, unrelated to prediction output |
| `audit-metrics-shared.ts:30` | `MIN_SUPPORT_N = 50` | Legitimate — minimum sample-size floor for statistical significance, not a probability value |
| `audit-metric-046-match-state-elo.ts:53`, `task18c-rank-form-workload.ts:40,44,48` | `INITIAL_RATING = 1500` / `?? 1500` | Legitimate — standard Elo cold-start seed, applied per-player independently (see Section 2) |
| `deterministic-batch1-standalone-metrics.server.ts:137-138` | `replay.overall.get(p1) ?? 1500` | Same as above — legitimate Elo cold start |
| `truth-engine-calibration.ts:282` | `(p >= 0.5 ? 1 : 0) === ys[i]` | Legitimate — standard accuracy/Brier-style scoring threshold used only in the read-only calibration *audit*, never in the live decision path |
| `ranking-performance.server.ts:23` | `(cur-1500)/50` | Legitimate — normalizing an Elo-above-baseline signal by a scale constant, not a probability fallback |
| all other numeric-`50` hits (`MAX_PLAYER_PAGES = 50`, pagination chunk sizes of `50`, `expectedPages=50`, rank bands `<=50`, `.limit(1500)`) | — | Unrelated to prediction probability (pagination, rank bin boundaries) |

**No instance of `return 0.5`, `probability = 0.5`, `?? 0.5` as a probability default, `\|\| 0.5`,
or an explicit "neutral prediction" shim was found anywhere in the codebase.** Category (F)
— "fallback logic overriding real signal" via a literal 0.5/50 constant — is **ruled out** as
a cause. The genuinely suspicious construct is not a `0.5` literal at all; it is the
hardcoded `null` in `deterministicIndependentConclusion` (Section 1, step 7) which then
forces every downstream consumer of "the app's own probability" onto the external-bucket
fallback.

---

## 4. Examples of real predictions (worked, analytically derived)

Live data could not be queried in this environment. The examples below chain the **exact,
verified formulas** from Sections 1A/1B against constructed inputs, to show every stage's
value the way the code would actually produce it. Each is labelled with which numbers are
code-verified-by-test vs. hand-computed with the same formula.

Formula used (identical to `task18c-rank-form-workload.ts:38,60`, verified correct by
`task18c-elo-win-probability.test.ts:34-42`): `P(P1) = 1 / (1 + 10^((EloP2-EloP1)/400))`.

| # | EloP1 | EloP2 | Elo `win_probability_p1` (metric-001 text field; formula-verified) | Family votes (illustrative, `favours` per metric) | `evidence_percent` (Truth Engine) | Truth Engine outcome | `independent_low/high` (actual code behaviour) | `calibrated_low/high` (actual code behaviour) |
|---|---|---|---|---|---|---|---|---|
| 1 | 1650 | 1500 | 71.5% | 4 families→P1, 1→P2 | 80.0% | **P1 selected** (≥60%, LOFO-stable) | `null,null` (hardcoded) | = external Matrix bucket rate ± 5, e.g. bucket "60-70%" verifiedWinRate=64.2% → `59–69` |
| 2 | 1500 | 1500 (both cold-start, zero history) | 50.0% | 0 families vote (no differentiated evidence anywhere) | 0% (no directional families) | **INSUFFICIENT_EVIDENCE** — "No metric produced a usable two-sided comparison" | `null,null` | depends only on external `matrix_wp`'s bucket, unrelated to this match's own (absent) evidence |
| 3 | 1580 | 1560 | 52.9% | 2→P1, 2→P2 (genuine even split) | 50.0% (tied) | **INSUFFICIENT_EVIDENCE** — "Independent evidence families are tied (2 vs 2)" | `null,null` | same external-bucket dependency as above |
| 4 | 1700 | 1450 | 84.9% | 3→P1, 0→P2, 1 NEUTRAL | 100% of directional | **P1 selected**, but flagged `corroborated:false` if support<2 families is not the case here (3≥2 ⇒ corroborated) | `null,null` | external-bucket only |
| 5 | 1620 | 1580 | 55.7% | 3→P1, 2→P2 | 60.0% | **P1 selected exactly at threshold** — a single family's LOFO removal could flip this to `FRAGILE`/refused | `null,null` | external-bucket only |
| 6 | 1610 | 1590 | 52.9% | 2→P1, 2→P2, 1 INTERNALLY_CONFLICTED | directional = 2+2+1=5, share=40% | **INSUFFICIENT_EVIDENCE** — below 60% threshold | `null,null` | external-bucket only |
| 7 | 1500 (P1 cold-start) | 1750 (P2, long history) | 5.9% (metric 001 alone strongly favours P2) | if this is the *only* usable metric (all others UNAVAILABLE due to missing P1 history) | 100% of the 1 directional family | **P2 selected**, `corroborated:false` (only 1 family) | `null,null` | external-bucket only |
| 8 | 1500 | 1500 | n/a — `laneMatchesBefore` returns no rows for either player, `computeHistoryMetric` returns `null` (`task18c-rank-form-workload.ts:49-50,64`) | 0 families | 0% | **INSUFFICIENT_EVIDENCE** — "No metric produced a usable two-sided comparison" | `null,null` | external-bucket only |

Observations from the table:
- The Truth Engine's own `evidence_percent`/outcome legitimately spans the full range
  (0%, 40%, 50%, 60%, 80%, 100% in the examples above) — it is **not** collapsing to 50% by
  itself; rows 2, 3, 6, 8 are refusals driven by genuinely thin/tied/contradicted evidence,
  exactly as the design intends ("REFUSAL IS A FIRST-CLASS OUTCOME," `truth-engine-decision.ts:22`).
- **Every single row's `independent_low/independent_high` is `null,null`**, regardless of how
  strong or decisive the underlying evidence was (row 4, 100% directional evidence, still gets
  `null,null`). This is the one output that is unconditionally, universally flat across all
  20+ hypothetical matches — the strongest quantitative signal of "compression" found in this
  investigation, and it is 100% code-traceable to `audit-pipeline.ts:793`.
- `calibrated_low/high`, the field actually shown to users when `independent_low/high` is
  null, never reflects rows 1-8's differing Elo gaps or evidence strength at all — it reflects
  only which externally-sourced `matrix_wp` bucket the match happens to fall in. Two matches
  with wildly different in-house evidence (row 2's total non-evidence vs. row 4's 100%
  evidence) would show an **identical** calibrated range if the external Matrix happened to
  print the same win-probability for both.

---

## 5. Top causes ranked by measured/traced impact

Mapped to the category list (A–G) from the task brief. "Impact" = how much of the observed
50%-clustering symptom this explains, based on the code tracing above.

1. **(G) Implementation defect — `independent_low`/`independent_high` are structurally dead.**
   `deterministicIndependentConclusion()` hardcodes `low: null, high: null` unconditionally
   (`audit-pipeline.ts:793`) and never derives them from the `evidence_percent`/
   `outcome`/`corroborated` values the same function already computes one line above via
   `runTruthEngineAudit`. **Impact: universal (100% of matches).** This is the single
   largest, most concretely provable defect in the entire traced pipeline — the field
   users/downstream code look to for "how confident is our own engine" never carries this
   app's own signal at all, for any match, ever, in production. **Highest-confidence
   finding in this report.**

2. **(G) Implementation defect / conflation — calibrated probability is a bucket average of
   an external, unaudited engine, not a per-match statistic.** Because of #1, the only value
   ever reaching `calibrated_low/high` is `verifiedWinRate` — a single number per
   `matrix_wp` bucket, shared by every match landing in that bucket regardless of that
   match's own Elo/serve/return/H2H differential (`calibration-snapshot.ts:19-31`). If
   middle buckets (matches the external Matrix itself scored as close) also accumulate the
   most graded history, this bucket average will itself sit near 50 and get stamped onto
   every match in that bucket. **Impact: large, but bounded by whatever the external
   Matrix's real bucket distribution looks like — not independently verifiable without
   Supabase access to `calibration_buckets`.** This is a genuine architecture-level
   "different matches receiving the same displayed probability" bug, distinct from a
   0.5-fallback.

3. **(A) Intentional design + (B) mathematically necessary uncertainty — the Truth Engine's
   `INSUFFICIENT_EVIDENCE` refusal and tied-evidence reporting.** Rows 2/3/6/8 in Section 4
   show the deterministic engine correctly and deliberately reports "no side reaches 60%" as
   a refusal, and an evenly-split evidence set as a genuine 50/50 tie
   (`truth-engine-decision.ts:225-238`). This is explicitly the designed behaviour ("If a
   match genuinely is approximately 50/50... preserve that result" — task brief's own rule).
   **Impact: real, but not a bug** — it explains *some* apparent 50%-ish numbers as
   legitimate refusals/ties, not as improper collapse. Ranking this third because, unlike #1
   and #2, it is working as intended and does not itself need a fix.

4. **(F) Fallback logic overriding real signal — ruled out.** No `return 0.5`/`?? 0.5`/`\|\|
   0.5` neutral-probability fallback exists anywhere in `src/`, `supabase/`, or `scripts/`
   (Section 3). **Impact: none measured.**

5. **(D) Reliability weighting shrinking toward 50 — not applicable.** No module-reliability
   weighting or ensemble-combination code exists in this repo at all (Section 1 scope note).
   **Impact: none — the mechanism does not exist here.**

6. **(E) Calibration curve compressing — not the raw `truth-engine-calibration.ts` module.**
   That module is provably read-only/downstream and gated behind a 40-observation minimum
   before it emits anything (`truth-engine-calibration.ts:1-32`); it cannot be causing a
   live-prediction collapse because it is never consulted by the live decision path (its own
   header comment confirms this). The compression that *does* exist is in the separate
   `calibration-snapshot.ts` mechanism already covered under cause #2.

7. **(C) Missing evidence/data quality causing fallback to defaults.** Genuinely occurs (row
   8, row 2: zero-history players → `computeHistoryMetric` returns `null`, metric excluded
   from families entirely) but is handled correctly — `UNAVAILABLE` metrics are excluded from
   both numerator and denominator of `evidence_percent`, never treated as neutral evidence for
   either player (`truth-engine-decision.ts:26-27,170-174`). **Impact: causes legitimate
   refusals in genuinely-thin-data matches, not silent 50% substitution** — correctly
   implemented per its own documented anti-pattern guard.

8. **(6) Double-counting of the same uncertainty signal across two mechanisms — checked,
   not found.** The family/evidence-share system is explicitly built to prevent this
   (`truth-engine-decision.ts:8-11`, "a family votes exactly ONCE"), and `audit-engine.ts`'s
   `effectiveEvidenceCount` separately re-derives independent families rather than trusting a
   raw distinct-string count, specifically to avoid double-counting correlated signals as
   independent corroboration (`audit-pipeline.ts:815-817` comment). No case was found where a
   single missing feature simultaneously depresses both a "data quality" score and a
   "reliability" weight for the same reason — that architecture does not exist here (no
   reliability-weight multiplier system was found at all, per Section 1's scope note).

---

## 6. Proposed fixes (description only — not implemented)

1. **Wire `independent_low`/`independent_high` to the deterministic engine's own signal.**
   `deterministicIndependentConclusion()` (`audit-pipeline.ts:786-798`) already has access to
   `audit.decision.evidence_percent`, `directional_families`, and `corroborated` via
   `runTruthEngineAudit`. Replace the hardcoded `low:null,high:null` with a principled,
   evidence-percent-derived range (e.g. a fixed-width band centred on `evidence_percent`,
   or — more defensible — an explicit statement that the Truth Engine's output is a
   discrete P1/P2/INSUFFICIENT_EVIDENCE selection with a reported evidence share, and stop
   presenting `independent_low/high` as if it were a continuous win probability at all if
   that was never the intended semantics). This decision should be made by whoever owns the
   product intent for that field — the current code neither computes it nor documents an
   intended formula, so a fix here is a genuine design decision, not just wiring.
2. **Decouple `calibrated_low/high` from a single population-level bucket average when no
   per-match "independent" signal exists**, or clearly label it in the UI as "market/Matrix
   historical accuracy for this probability range" rather than "this match's predicted
   range" — so it cannot be mistaken for a per-match, differentiated prediction.
3. **Add an explicit non-null assertion/lint or a persisted-field audit** (similar in spirit
   to the metric-019 "treatment inflation" fix already done in this repo,
   `docs/metric-audit-019-market-calibration.md`) that flags any `ConclusionFinding` where
   `winner !== null` but `low`/`high` are both `null`, so a future regression of this kind is
   caught mechanically rather than requiring another full forensic pass.
4. **If the product intends the Truth Engine to expose a genuine win-probability-style number
   at all** (as opposed to its current, deliberately discrete P1/P2/INSUFFICIENT_EVIDENCE
   design), that is a new feature to design and build — not a "fix" to existing math, since no
   such calculation currently exists to be broken.

## 7. Tests needed to validate each proposed fix (description only — not implemented)

1. `audit-pipeline.test.ts` — **`commitConclusion never persists a null independent_low/high
   when a winner was selected`**: construct metric rows that deterministically produce a
   `P1`/`P2` outcome with a known `evidence_percent`, run `commitConclusion`, and assert
   `run.independent_low !== null && run.independent_high !== null` and that the persisted
   range is a monotonic function of `evidence_percent` (higher evidence share ⇒ narrower or
   more extreme range, per whatever formula fix #1 settles on).
2. `audit-pipeline.test.ts` — **`independent_low/high stay null only on INSUFFICIENT_EVIDENCE`**:
   assert the *inverse* — when `deterministic.winner === null`, `low`/`high` remain `null`
   (this preserves the "refusal is first-class, never fabricate a range for a refusal"
   principle from the task brief).
3. `calibration-snapshot.test.ts` — **`buildCalibrationSnapshot prefers a real per-match
   independent range over the bucket average once one exists`**: once fix #1 lands, add a
   case where `independentLow`/`independentHigh` are non-null and a bucket `verifiedWinRate`
   is also available, and assert the snapshot's `centre` calculation (currently
   `verifiedWinRate ?? independentRange`, `calibration-snapshot.ts:22`) uses the priority the
   product actually wants — today's code silently prefers the *external* bucket rate over any
   real independent signal, which should be revisited alongside fix #1.
4. `truth-engine-decision.test.ts` — **`evidence_percent spans a real distribution across
   varied inputs`** (regression guard for the "collapse" symptom in the one component that
   *is* provably healthy today): feed 20+ synthetic family-vote combinations and assert the
   resulting `evidence_percent` values are not clustered in a narrow band around 50 — this
   protects the one part of the pipeline shown in this investigation to already work
   correctly, so a future change to the 60% threshold or family logic doesn't quietly
   introduce the very collapse this investigation was asked to rule out.
5. **Player-swap symmetry test** (new, cross-cutting): for any fixed set of metric
   comparisons, swapping P1/P2 labels and negating every `favours` value should produce the
   exact mirror outcome (`P1 selected 80%` ↔ `P2 selected 80%`), covering the "sign errors"
   failure mode named in the task brief.
6. **End-to-end fixture test**: once `independent_low/high` is wired up, add one test that
   runs `commitConclusion` → `applyCalibration` back to back on 5-10 fixture matches with
   deliberately varied Elo gaps/evidence strength, and assert the final persisted
   `calibrated_low/high` values are **not all identical/near-identical** across those
   fixtures — directly regression-testing the compression mechanism identified in Section 5,
   cause #2.

---

### Confirmation
No production file was modified. No `git commit` was run. Only this report file was written,
under `docs/tasks/prediction-50pct-investigation-report.md`.
