# Metric 007 — Common-Opponent Network — Sequential Audit Record

Status: PENDING CI CERTIFICATION

## 1. Exact master definition
Authoritative source: `public/seed/metrics.txt`, section 7.

Required submetrics:
- Direct Common Opponents
- Who Beat/Lost to the Same Players
- Scoreline Comparison
- Recency Weighting
- Surface Matching
- Tournament-Level Matching
- Opponent-Strength Weighting
- Transitive Opponent Network Chains

## 2. Permitted raw inputs
Only pre-match public historical match rows may satisfy this family: player identity, opponent identity, result, match date, surface, set/game score where explicitly present, tournament level where explicitly present, and opponent pre-match rating/strength where explicitly present. Matrix values, model outputs, generic H2H, serve/return aggregates, market data, ranking proxies, or unrelated metric-family fields are prohibited substitutions.

## 3. Sources inspected
- PredixSport ATP Elo match history (`data/public/predixsport/atp/atp_elo_matches.csv`): player/opponent/date/surface/result/set totals/Elo fields are already consumed by the live reconstruction. This is the primary current source for 007.
- PredixSport WTA ratings file: the current repository exposes ratings but not a WTA match-history schema equivalent to the ATP opponent rows, so it cannot truthfully satisfy the common-opponent network family by itself.
- DataHub ATP match scores (`data/public/datahub-atp/match_scores_1991-2016.csv`, `match_scores_2017.csv`): supplies exact historical winner/loser and score data, but the imported score rows do not include surface or tournament-level fields. It is therefore not cross-wired into the same-surface 007 reconstruction; using its scoreline alone would weaken the master definition.
- Runtime/local/research adapters were inspected via the hybrid researcher wiring. No unrelated source is permitted to substitute for missing common-opponent fields.

## 4. P1/P2 orientation
`getEnhancedCommonOpponentStats(player, opponent, context)` is called independently for P1 vs P2 and P2 vs P1. The reconstruction now has synthetic regression coverage proving P1 wins/losses do not leak into P2 and vice versa.

## 5. Treatment classification
The broad family remains `PARTIAL` unless a future source directly covers every required submetric. Reconstructed percentages/counts are `RECONSTRUCTED` atomic stats inside the family. No partial subset is promoted to DIRECT or treated as the full metric family.

## 6. Reconstruction verification
- Recency: exponential weight `exp(-days/365)` using only pre-cutoff rows.
- Scoreline: currently set-margin only when `sets_for` and `sets_against` are explicit. This is explicitly classified as `SETS_ONLY`, not full scoreline satisfaction.
- Opponent strength: result is weighted by shared opponent's available pre-match Elo, with bounded scaling used only as a weighting factor.
- Transitive chain: second-degree strength is the shared opponent's own pre-cutoff, same-surface win rate against its opponents. It is separate from Elo weighting.
- Tournament level: filtering is applied only if both a requested context level and an explicit row-level field exist. Missing level is never treated as a match.

## 7. Provenance/sample/persistence
Every reconstructed atomic output carries PredixSport source URL, retrieval timestamp, sample size, player identity and `RECONSTRUCTED` origin. The metric row persists P1/P2 values, PARTIAL treatment, sample, evidence family and source references. The PARTIAL explanation is now preserved instead of being nulled merely because a subset value exists.

## 8. Cross-wiring audit
007 summary keys are restricted to direct common-opponent counts/records, recency weighting, same-surface count, optional level-matched count, set-margin comparison, opponent-strength weighting and second-degree strength. No H2H, serve/return, market, ranking, Matrix, or generic form field is admitted.

## 9. Legitimate unavailable-data recovery
Recovered: explicit direct common-opponent counts/wins/losses/win%, second-degree/transitive network strength, and optional tournament-level matched counts when the source really contains a level field.

Still source-dependent: exact game-by-game scoreline comparison for current same-surface rows when the primary match-history source lacks game scores, and tournament-level matching when rows lack an explicit level field. These remain PARTIAL/SOURCE REQUIRED rather than guessed.

## 10. Regression protection
Added `src/lib/common-opponent-enhanced.test.ts` covering:
- P1/P2 orientation
- same-surface filtering
- explicit tournament-level filtering
- no fake tournament-level match when level fields are absent
- set-only scoreline classification
- transitive network calculation
- source/sample/origin provenance

Certification is withheld until GitHub CI passes the regression suite and production build.
