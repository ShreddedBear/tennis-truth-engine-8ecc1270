# Metric 010 — Straight-Set / 2–0 Metrics — Sequential Audit Record

Status: FIXED / PARTIAL / SOURCE REQUIRED

## 1. Exact master definition
Authoritative source: `public/seed/metrics.txt`, section 10.

Required submetrics:
- Straight-Set Win Rate
- Straight-Set Rate vs Comparable Opposition
- Monte Carlo Straight-Set Probability (Both Players)

## 2. Permitted raw inputs
Permitted inputs are pre-match match results with explicit set outcomes, opponent-strength data used only to identify genuinely comparable opposition, and a legitimate independent simulation model with documented inputs/formula for Monte Carlo straight-set probability. Matrix Monte Carlo, headline WP, generic straight-set control among wins, or unrelated model outputs may not substitute.

## 3. Sources inspected
- DataHub ATP ordered match scores: supports straight-set match wins and all-match denominator.
- PredixSport ATP match history: supports opponent pre-match Elo and set totals, allowing a transparent comparable-strength subset.
- Existing reconstruction catalog contained a historical straight-set rate divided by matches won; that is a control rate conditional on winning, not the master 010 straight-set match win rate.
- Repository search found no independent Monte Carlo straight-set simulator producing both-player probabilities for this audit family. Matrix/supplied Monte Carlo is intentionally excluded by the independent-evidence firewall.

## 4. P1/P2 orientation
DataHub score rows are reoriented to the requested player. Comparable-opponent filtering is computed from each player's own pre-match Elo and that match's opponent Elo, independently for each side.

## 5. Treatment classification
Historical straight-set match rates are RECONSTRUCTED atomic evidence. The broad family remains PARTIAL because the required independent Monte Carlo straight-set probabilities are not available. Monte Carlo remains SOURCE REQUIRED rather than inferred from historical rate.

## 6. Reconstruction/formula verification
Fixed a semantic denominator error:
- Exact Straight-Set Win Rate = straight-set match wins / ALL matches with a parseable score.
- Straight-Set Rate vs Comparable Opposition = straight-set match wins against comparable opponents / ALL comparable-opposition matches.

The previous implementations divided by wins/comparable wins, which measured straight-set control conditional on already winning and did not satisfy the master definition. Those conditional-control semantics remain usable only for other metric families where that definition is appropriate.

Comparable opposition currently means absolute pre-match Elo gap <= 100 because the source contains Elo rather than current official ranking bands. This is explicitly an Elo-comparable subset, not a ranking substitution.

## 7. Provenance/sample/persistence
Reconstructed outputs preserve player identity, source URL, retrieval timestamp, all-match denominator sample and RECONSTRUCTED origin. Metric 010 persists PARTIAL treatment plus the explicit Monte Carlo gap.

## 8. Cross-wiring audit
Metric 010 local wiring is restricted to:
- `straight_set_match_win_pct`
- `straight_set_match_win_pct_comparable`

Removed/forbidden for 010:
- conditional-on-win straight-set control rates
- raw straight-set win counts without the required denominator
- Matrix Monte Carlo
- generic match WP or unrelated simulation/model outputs

## 9. Legitimate unavailable-data recovery
Recovered/fixed:
- exact all-match Straight-Set Win Rate
- exact all-comparable-match denominator for comparable-opposition straight-set rate

Still SOURCE REQUIRED:
- independent Monte Carlo Straight-Set Probability for Player 1
- independent Monte Carlo Straight-Set Probability for Player 2

## 10. Regression protection
Added `src/lib/metric-010-straight-set.test.ts` proving:
- all matches are used as the master straight-set denominator
- conditional straight-set control remains distinct
- comparable-opposition denominator uses all comparable matches
- old conditional fields and Matrix/Monte-Carlo substitutes are not wired into 010

Certification: FIXED / PARTIAL / SOURCE REQUIRED. No evidence inflation.
