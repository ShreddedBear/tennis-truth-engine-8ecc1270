# Metrics 047 and 061 — resolved classification decisions

Both codes previously sat in `metric-classification.ts`'s `UNKNOWN_REQUIRES_REVIEW`
holding pattern: kept inside the 60-metric player-evidence denominator (the registry's
own rule is "burden of proof for exclusion is not met"), but with no real engine built,
pending a human decision on what each code actually is. The project owner has now made
both decisions. This doc records them; `metric-classification.ts`'s inline comment at the
former `UNKNOWN` array is the load-bearing reference for future readers.

## 047 — Uncertainty-Adjusted Advantage: real metric, not meta

Definition: "Confidence-Interval-Adjusted Metric Comparison — comparing two players' own
statistics with confidence intervals applied, so a small uncertain edge isn't weighted the
same as a large well-supported one."

**Decision: this is a legitimate player-comparison fact, not a meta-method.** Applying
statistical rigor to a comparison of two players' own numbers is itself a fact about the
two players — how well-supported their apparent edge actually is — not a judgment about
this system's own prediction or evidence base. That's the distinguishing test already
applied to 048/049/050/056/057/058/059 (all genuinely about the model/prediction/evidence
process itself, and excluded); 047 doesn't meet that bar, so it stays in and gets built.

Implementation: `src/lib/audit-metric-047-uncertainty-adjusted-advantage.ts` — a two-sample
(two-proportion) Wald z-test on the rate difference between P1 and P2 for a given base
metric, using each side's real sample size. A difference is reported `WELL_SUPPORTED_EDGE`
only when the 95% CI on the difference excludes zero; below a minimum per-side sample it's
honestly `INSUFFICIENT_SAMPLE`, never a falsely precise number. First pass is deliberately
bounded to base metrics that already produce a clean `{rate_pct, n}` pair on both sides
(not run speculatively across all 60 codes) — see the module's own header for the exact
covered set and the statistical citation.

## 061 — Final Advanced Tests: split into a real piece and an excluded piece

Definition mixed three sub-items: (1) counterfactual leave-one-input-out reruns of the
model's own winner pick, (2) realistic opponent-upgrade reruns of key inputs, and (3) a
Historical Twin Match Search over prior matchups with a similar Elo/form/market gap.

**Decision: split, not keep-whole.**
- (1) and (2) are reruns of this system's own prediction under perturbed inputs — a
  property of the model/process, not a fact about either player, by the same test applied
  above. They are permanently excluded from player evidence. They are **not** given a new
  metric code of their own: they were never a distinct catalog entry, only a component of
  061's mixed original definition, and the "rerun the prediction under perturbations" idea
  is already covered by 050 ("Robustness Tests"), already `META_OR_NON_PLAYER`. If this
  content is ever persisted anywhere, it belongs alongside 050's stress-test machinery,
  never counted as 061 or as player evidence.
- (3) Historical Twin Match Search is real, reconstructable player/matchup evidence — a
  nearest-neighbor Elo-gap (and surface) search over the four-tour static history index,
  reporting how the analogous favorite actually fared. **061 now means only this.**

Implementation: `src/lib/audit-metric-061-historical-twin-match-search.ts`, reusing the
existing `historical-twin-match-search.server.ts` search rather than re-deriving it.
`src/lib/final-advanced-meta.server.ts` was simplified accordingly — the old file mixed
the (1)/(2)/(3) discussion in one place; that document-level ambiguity is now resolved by
this split, and its header comment records the before/after.

## Mechanics of the resolution

Both codes' records were removed from `metric-classification.ts`'s `UNKNOWN` array.
`classifyMetric`'s default (any code with no `META`/`PROTECTED`/`UNKNOWN` record classifies
as `LEGITIMATE_PLAYER_METRIC`) is sufficient — removing the record IS the resolution, not a
separate code path. Both new engines are wired into the live pipeline via
`src/lib/deterministic-batch5-new-metrics.server.ts`, following the same tier-insertion
pattern used for every prior batch (`deterministic-batch1-standalone-metrics.server.ts`
through `deterministic-batch4-favorite-underdog-patterns.server.ts`).

## Denominator effect

Both codes remain inside the 60-metric player-evidence denominator (`meta_or_non_player`
and `protected_unavailable` counts are unchanged — the excluded (1)/(2) component of 061
was never a separate code, so it doesn't add a new entry to `META_OR_NON_PLAYER_CODES`).
What changes is that 047 and 061 now have real, tested, live-wired engines instead of
sitting in an unresolved holding pattern with no engine at all.
