# Metric 007 — Common-Opponent Network — Sequential Audit Record

Status: FIXED / PARTIAL / SOURCE REQUIRED

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
- PredixSport ATP Elo match history (`data/public/predixsport/atp/atp_elo_matches.csv`): player/opponent/date/surface/result/set totals/Elo fields are consumed by the live reconstruction.
- PredixSport WTA ratings: ratings alone do not provide a WTA common-opponent match-history network.
- DataHub ATP match scores: exact winner/loser and score data, but imported score rows lack surface/tournament-level fields, so they cannot be mixed into a same-surface/level network without weakening the definition.
- Runtime/local/research adapters: inspected for relevant common-opponent inputs; unrelated families are excluded.

## 4. P1/P2 orientation
`getEnhancedCommonOpponentStats(player, opponent, context)` executes independently for P1 vs P2 and P2 vs P1. Regression coverage checks wins/losses cannot leak between sides.

## 5. Treatment classification
The broad family remains `PARTIAL` unless every required submetric is supported. Atomic historical outputs are `RECONSTRUCTED`; no subset is promoted to DIRECT or treated as the full family.

## 6. Reconstruction verification
- Recency weighting: `exp(-days/365)` using pre-cutoff rows only.
- Scoreline: set-margin only when explicit `sets_for`/`sets_against` exist; classified as `SETS_ONLY`, not full scoreline satisfaction.
- Opponent-strength weighting: shared-opponent pre-match Elo used only as an explicit weighting factor.
- Transitive chain: shared opponent's own pre-cutoff same-surface record against its opponents; kept separate from Elo weighting.
- Tournament level: applied only when an explicit context level and explicit row-level field both exist. Unknown level is never treated as comparable.

## 7. Provenance/sample/persistence
Every reconstructed atomic output carries player identity, PredixSport source URL, retrieval timestamp, sample and `RECONSTRUCTED` origin. The broad metric row retains P1/P2 values, PARTIAL treatment, evidence family, sample, sources and the explanation of unsupported master submetrics.

## 8. Cross-wiring audit
007 keys are restricted to common-opponent counts/records, recency, same-surface filtering, optional explicit level matching, set-margin comparison, opponent-strength weighting and second-degree strength. H2H, serve/return, market, ranking, Matrix and generic form fields are excluded.

## 9. Legitimate unavailable-data recovery
Recovered:
- direct common-opponent count
- common-opponent wins/losses/win rate
- recency-weighted common-opponent rate
- same-surface common-opponent count
- opponent-strength weighting
- set-margin comparison where explicit set totals exist
- second-degree/transitive network strength
- tournament-level matching only where explicit level fields exist

Still SOURCE REQUIRED:
- exact game-by-game scoreline comparison for current same-surface rows when the primary source has only set totals
- tournament-level matching when source rows have no explicit tournament-level field

## 10. Regression protection
Added `src/lib/common-opponent-enhanced.test.ts` covering P1/P2 orientation, same-surface filtering, explicit tournament-level filtering, no fabricated level matching, set-only scoreline classification, transitive-chain calculation, and source/sample/origin provenance. The branch also includes a GitHub Actions workflow configured to run the full Vitest suite and production build; no CI success is asserted unless GitHub reports a run.

Certification: FIXED / PARTIAL / SOURCE REQUIRED. No evidence standard was weakened.
