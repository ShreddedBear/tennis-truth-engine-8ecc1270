# Phase 0 Audit — Evidence Families, Metrics, Sources, Voting Rules, Thresholds

Scope: read-only. Every claim below is traced to `src/lib/truth-engine-metric-comparison.ts`
(the `COMPARISON_SPECS` registry — the single source of truth for what votes and how),
`src/lib/truth-engine-decision.ts` (family consolidation and the selection threshold),
`src/lib/metric-classification.ts` (why the other 56 of 81 catalog codes never reach a vote),
and `src/lib/truth-engine-calibration.ts` (the calibration-side thresholds). No code was
changed to produce this document.

Branch: `engine2/audit`. Independence rule already holds structurally here: nothing in this
file's source set (`truth-engine-metric-comparison.ts`, `truth-engine-decision.ts`) reads,
imports, or references a Prediction Engine field. See `docs/contracts/truth-engine-io.md` for
the verification of that claim.

## 0. The metric universe: 81 catalog codes → 25 active voters

`metric-classification.ts` accounts for every code 001–081:

| Bucket | Count | Codes | Why excluded from the vote |
|---|---:|---|---|
| `META_OR_NON_PLAYER` | 7 | 048,049,050,056,057,058,059 | Describe the *prediction/model's own* behavior (independent-evidence count, contamination score, robustness re-runs, stress scenarios, freshness weighting, loss-path probability) — not a fact about either player. Structurally can never be player evidence. |
| `PROTECTED_UNAVAILABLE` | 14 | 017,054,063,065,066,067,069,072,073,074,076,078,079,081 | Legitimate player-comparison metrics whose required raw fields (shot/rally tracking, biomechanics, coaching/equipment history, medical reports, betting-exchange volume, court-scheduling micro-context, etc.) exist nowhere in the approved evidence universe. Each carries a dated, sourced "no qualifying fields" record and is marked reversible if a matching dataset is ever ingested. |
| `MATRIX_SUMMARY_REQUIRED` | 15 | 015,019,022,024,025,026,033,035,037,039,040,042,060,070,075 | A **quarantine**, not a deletion: these require actual Tennis Matrix AI Summary evidence uploaded into the Truth Engine, which has not happened yet. Explicitly never reconstructed from substitute/estimated/inferred data. Reactivation requires a documented eligibility → testing → proven path, not merely a future upload existing. |
| `UNKNOWN_REQUIRES_REVIEW` | 0 (both prior entries resolved) | — | 061 was split (real component kept, meta component folded into 050); 047 was ruled a legitimate player metric. Empty today. |
| Remaining (`LEGITIMATE_PLAYER_METRIC`, no comparison spec yet) | 20 | e.g. 004,012,013,014,020,021,023,028,030,038,043,044,046,052,062,064,071,077,… | Legitimate, in the coverage denominator, **but excluded from `COMPARISON_SPECS`** — i.e. defined and evidenced, but no declared comparable field/direction exists yet. `NO_COMPARISON_SPEC`, never guessed at. |
| **`COMPARISON_SPECS` (the actual voters)** | **25** | listed in §1 | The only codes `isActiveMetricCode()` recognizes; the only codes that can ever reach `buildFamilies()`. |

`ACTIVE_METRIC_CODES` (`truth-engine-active-metrics.ts`) is *derived* from `Object.keys(COMPARISON_SPECS)`, not a hardcoded `25` — promoting a metric by adding its spec moves every denominator in the same commit. This is a real structural guarantee, not just a comment: `decideTruthEngineSelection` independently re-filters `comparisons.filter(c => isActiveMetricCode(c.metric_code))` before building families, so even a forged/malformed `MetricComparison` claiming `status: "COMPARED"` for an inactive code cannot enter a vote.

## 1. The 25 active metrics, grouped into 11 independent evidence families

Family membership is the anti-double-counting mechanism: metrics that read correlated
underlying data are grouped so the family casts **one vote**, not one vote per metric.

| Family | Metrics (code — label) | Direction | Materiality (noise floor) | Sample gate |
|---|---|---|---:|---|
| **SURFACE_STRENGTH** | 001 — Surface Elo | HIGHER | 10 | none |
| **RECENT_FORM** | 005 — Last-10 win %; 055 — Elo change over last 10; 068 — Current win/loss streak | HIGHER | 5 / 20 / 5 | 068: `season_matches ≥ 5` |
| **SET_PROFILE** | 008 — Deciding-set win %; 010 — Straight-set win %; 045 — Deciding-set win % as favourite | HIGHER | 5 / 5 / 25 | 045: `forced_deciding_set_n ≥ 8` |
| **RESULTS_HISTORY** | 011 — Match win % | HIGHER | 5 | none |
| **COMMON_OPPONENT** | 031 — Opponent-adjusted set differential; 007 — Common-opponent win %; 080 — Common-opponent net divergent outcomes | HIGHER | 0.15 / 20 / 1 | 007: `ranked_common_opponent_matches ≥ 10` |
| **CLOSING_ABILITY** | 027 — Lead protection % | HIGHER | 5 | none |
| **H2H_PROBABILITY** | 051 — Opponent-specific (H2H-shrunk) win probability % | HIGHER | 3 | none |
| **POINT_BY_POINT** | 002 — Service point win %; 003 — Return point win %; 009 — Pressure point win %; 018 — Breakback rate %; 032 — Break-point conversion %; 034 — Dominance ratio; 053 — Pressure index %; 016 — Break-point score-state win % | HIGHER (all) | 10/10/18/40/40/0.15/18/24 | `minSample` 30/30/15/10/10/60/15/8 respectively |
| **LOSS_PROFILE** | 036 — Losses as favourite %; 006 — Bad-loss rate % | LOWER (both) | 15 / 25 | `minSample` 10 / 5 |
| **PSYCH_RESPONSE** | 029 — Response after close-set loss, vs own baseline | HIGHER | 25 | `after_close_set_loss_n ≥ 8` |
| **IMPROVEMENT_TREND** | 041 — Elo-adjusted surplus, recent vs earlier | HIGHER | 0.1 | none |

Eight of the 25 (002,003,009,018,032,034,053,016) all replay the *same* point-by-point
sample for a given match, hence one family. 031/007/080 all read the *same* shared-opponent
pool, hence one family. 005/055/068 all read the same recent-results window. This is
documented explicitly in the registry's comments as a deliberate anti-double-counting design,
not an oversight — each grouping cites the shared underlying data (e.g. "the database labels
every one of them `evidence_family=POINT_BY_POINT`").

## 2. Voting rule

Per family (`voteFor()` in `truth-engine-decision.ts`):
- All comparable metrics in the family favour the same player → family votes that player.
- Metrics disagree (some favour P1, some P2) → `INTERNALLY_CONFLICTED`; votes for **nobody**,
  but sits in the directional denominator (counts against whichever side would otherwise lead).
- No metric in the family clears its own materiality floor → `NEUTRAL`; excluded from the
  directional denominator entirely (parity is reported, not counted as an "abstention" for or
  against anyone).
- Zero comparable metrics reached `COMPARED` status at all → the family never exists for this
  match; it doesn't appear as `NEUTRAL`, it simply isn't in `families[]`.

Leader = family with more P1 votes than P2 votes (`leaderOf()`), each family counted once
regardless of how many member metrics it holds.

**Selection threshold:** `EVIDENCE_SELECTION_THRESHOLD = 60`. The leader must hold ≥60% of
the *directional* evidence — `supporting + contradicting + internally-conflicted` families,
explicitly excluding `NEUTRAL` families from both numerator and denominator. Below 60%:
`INSUFFICIENT_EVIDENCE`. This replaced an older hard rule ("≥2 independent supporting families
required to select at all" — `MIN_INDEPENDENT_SUPPORT_FAMILIES = 2`); that rule is retained
only as a reported `corroborated` flag, no longer a gate.

**Leave-one-family-out (LOFO):** the selection is genuinely re-derived with each family
removed in turn (not relabelled). A removal that *reverses* the leader → `flipping_families`,
which always refuses the selection (`INSUFFICIENT_EVIDENCE`, reason states which family
reverses it). A removal that only *ties* it → `tie_inducing_families`, reported but does not
by itself refuse a selection that already cleared threshold and survived LOFO otherwise.

**Post-selection stress veto:** `runStressTest()` (in `truth-engine-audit.ts`) erodes every
directional edge favouring *both* players by one noise-floor each (`SYMMETRIC` case) and
recomputes the full selection. The initial selection is withdrawn only if this produces a
genuinely *comparative* finding — the challenger both (a) wins the leader's own adverse case
and (b) survives its own adverse case (`comparative_robustness === "CHALLENGER_MORE_ROBUST"`).
A leader that is merely thin (fails its own adverse case, but the challenger doesn't survive
its own either) is **not** refused — it is kept with `stability: "FRAGILE"`, which is the
audit trail for finding (b) in `docs/audit/can-it-say-no.md`.

## 3. Threshold provenance — measured vs. guessed vs. inherited

The registry itself divides cleanly into two eras, and says so in its own comments.

### 3a. Empirically measured (Phase 12 / 13 / 13.5 additions — 17 of 25 metrics)

Every materiality floor for 002,003,009,018,032,034,053,007,029,036,006,041,055,016,045,068
is derived, per the inline comments, from **that metric's own observed live sample** — median
n from the production database, then approximately one standard error of the P1–P2 difference
of a proportion (`SE(diff) ≈ √(2·p̂(1−p̂)/n)`), e.g.:

- 002 (service point win %): "n median 58 service points → SE ~6.6pp, difference ~9.3pp" → materiality 10.
- 018 (breakback rate %): "n median ~4 breakback opportunities → SE ~25pp" → materiality 40.
- 068 (streak): "Real P1-P2 differential stdev across 162 live paired rows: 4.51 matches" → materiality 5.

This is real measurement, not a round number that "felt right" — small-sample metrics
deliberately carry large floors, which the comments explicitly frame as "the honest outcome,
not a weakness." **This is the strongest calibration evidence in the whole codebase and it
predates any accuracy baseline** (see `baseline-gap.md`) — these floors were tuned to the
*sampling noise of the input metric*, never to the *win-rate accuracy of the resulting
selection*, which has never been measured (§4 below).

### 3b. No stated empirical basis — flagged (8 of 25 metrics)

001, 005, 008, 010, 011, 031, 027, 051 (the pre-Phase-12 registry) carry materiality values
(10, 5, 5, 5, 0.15, 5, 3) with **no derivation comment at all** — contrast the Phase-12+
entries, every one of which cites a sample size and an SE calculation. These eight are
plausible round numbers (5% is a natural "small edge" floor; Elo 10 points is a natural
Elo-noise floor) but nothing in the repository shows they were measured against either the
underlying metric's sampling variance or the engine's resulting win-rate. **Flagged: no
empirical basis on record for 001/005/008/010/011/031/027/051's materiality constants.**

### 3c. Policy constants, not measurements

| Constant | Value | File | Basis |
|---|---:|---|---|
| `EVIDENCE_SELECTION_THRESHOLD` | 60% | `truth-engine-decision.ts` | Comment calls it "the product's minimum selection threshold" — a stated product/business decision, not derived from historical accuracy data (none exists yet — §4). **Flagged: unvalidated against outcomes.** |
| `MIN_INDEPENDENT_SUPPORT_FAMILIES` | 2 | `truth-engine-decision.ts` | Was a hard gate, now advisory (`corroborated`). No stated derivation for "2" specifically vs. 1 or 3. **Flagged.** |
| `MIN_COMPARISONS_PER_FAMILY` | 1 | `truth-engine-decision.ts` | Trivial (a family needs ≥1 comparison to exist at all); not really a tunable threshold. |
| `MIN_TOTAL_CALIBRATION_SAMPLE` | 40 | `truth-engine-calibration.ts` | Round number; comment says "never fabricate confidence from a tiny sample" but doesn't derive why 40 specifically. **Flagged.** |
| `MIN_TRAIN_FOLD_SAMPLE` | 30 | `truth-engine-calibration.ts` | Round number, no derivation. **Flagged.** |
| `MIN_BUCKET_SAMPLE` | 10 | `truth-engine-calibration.ts` | Round number, no derivation. **Flagged.** |

### 3d. Summary table — every threshold with a basis note

| Threshold | Where | Basis |
|---|---|---|
| 25 metric materiality floors | `COMPARISON_SPECS` | 17 measured (SE-based, Phase 12+); **8 unlabelled/guessed** (001,005,008,010,011,031,027,051) |
| 8 `minSample` gates (002,003,009,018,032,034,053,007,006,029,045,068,016) | `COMPARISON_SPECS` | Set from each metric's own observed live n; documented as conservative by design |
| `EVIDENCE_SELECTION_THRESHOLD` (60%) | `truth-engine-decision.ts` | Stated product policy; **not validated against any accuracy measurement** |
| `MIN_INDEPENDENT_SUPPORT_FAMILIES` (2) | `truth-engine-decision.ts` | Product policy, advisory only; no stated derivation |
| Calibration sample minimums (40/30/10) | `truth-engine-calibration.ts` | Round-number engineering defaults; no stated derivation |
| Stress erosion = "one noise floor" | `truth-engine-audit.ts` (`erodeEdgesOf`) | Deliberately reuses each metric's own materiality (not a separately chosen constant) — internally consistent with §3a/3b, inherits the same measured/guessed split |

## 4. What this means for Phase 1

The 60% selection threshold and the 8 unlabelled materiality floors are the highest-priority
candidates for validation once the baseline harness (`baseline-gap.md`) exists — they are the
parameters most likely to be silently mis-set, and currently nothing in the codebase checks
them against actual win-rate outcomes. Per the working agreement's **NO TUNING BEFORE
MEASUREMENT** rule, none of this is changed here; this document only records what is measured,
what is guessed, and what is inherited, per the Phase 0 mandate.
