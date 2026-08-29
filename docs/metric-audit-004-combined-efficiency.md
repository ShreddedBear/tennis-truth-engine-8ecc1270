# Metric 004 — Combined Efficiency — Sequential Audit Record

Status: FIXED / PARTIAL / SOURCE REQUIRED

**First audit for this code.** `docs/evidence-coverage/81-metric-recoverability-audit.md`
previously labeled code 004 "Break-Point Performance" — that name does not
exist in `public/seed/metrics.txt`; real code 004 is "Combined Efficiency"
(see `docs/evidence-work-blockers.md` item 0 for the full catalog-mismatch
finding this pass uncovered). This is the first audit written against the
real definition.

## 1. Exact master definition
Authoritative source: `public/seed/metrics.txt`, section 4.

Required submetrics:
- Dominance Ratio
- Opponent-Adjusted Dominance Ratio
- Total Points Won %
- Matchup-Specific Expected Hold %
- Matchup-Specific Expected Break %
- Expected Hold/Break Differential

## 2. Permitted raw inputs
Each player's own pre-match historical service-points-won%, return-points-won%,
total-points-won%, hold%, and break% (DataHub ATP match stats, aggregated
per player with a strict future-leakage cutoff), combined pairwise into
matchup-specific interaction estimates. Elo/ranking-based opponent-strength
weighting across the player's full schedule (not just the one opponent) is
required for the "Opponent-Adjusted" submetric specifically — a single
opponent's rate is not itself an opponent-strength adjustment.

## 3. Sources inspected
- `src/lib/datahub-atp-serve-return.server.ts` (`getHistoricalServeReturnStats`) — DataHub ATP World Tour match-stats CSVs (CC BY 4.0), aggregated per player from 2005 onward with a `cutoffYear` future-leakage guard derived from match context.
- `src/lib/matchup-efficiency.server.ts` (`getMatchupEfficiencyStats`) — combines both players' independently-sourced serve/return rates into the matchup-specific values.
- `src/lib/hybrid-audit-research.server.ts` — `SUMMARY_KEYS["004"]` (the allow-list gating which stat keys code 004 may surface) and the live wiring in `localMetricRows`.
- Repository search found no opponent-strength-weighted (Elo/ranking-adjusted) recomputation of Dominance Ratio anywhere in the codebase.

## 4. P1/P2 orientation
`getMatchupEfficiencyStats(player, opponent, context)` computes `dominance_ratio = playerReturnPointsWon% / opponentReturnPointsWon%` and the expected-hold/break values from each side's own historical rates, oriented to the requested `player` argument. `localMetricRows` calls this once per side (`p1` as player vs `p2` as opponent, and the reverse), so both directions are independently, correctly oriented — not a mirrored/negated shortcut.

## 5. Treatment classification
PARTIAL. Five of six named submetrics have genuine, correctly-oriented evidence; Opponent-Adjusted Dominance Ratio has none. `localMetricRows` already hardcodes `treatment:"PARTIAL"` for every code on this local path (line 65 of `hybrid-audit-research.server.ts`), so no treatment-value change was needed — the actual defect fixed this pass was that code 004 had no `partialReason` explaining what is and isn't covered, unlike every one of its neighbors (007/008/009/010/011) which all document their gap explicitly. `unavailable_reason` for 004 was silently `null` whenever evidence existed, which is not itself evidence inflation (treatment already correctly said PARTIAL) but is a transparency gap this project's own established pattern doesn't allow elsewhere.

## 6. Reconstruction/formula verification
- `dominance_ratio = pRPW / oRPW` — matches the exact named definition ("the ratio of a player's return points won percentage to their opponent's return points won percentage") with no substitution.
- `matchup_expected_hold_pct = (playerHold% + (100 − opponentBreak%)) / 2` and `matchup_expected_break_pct = (playerBreak% + (100 − opponentHold%)) / 2` — a transparent, symmetric blend of each side's own rate and the other side's complementary rate; genuinely opponent-specific (both `computeHistoricalServeReturnStats` calls use the actual two players in the match, not a generic average).
- `expected_hold_break_differential = matchup_expected_hold_pct − matchup_expected_break_pct` — exact match to "the projected gap between expected hold rate and expected break rate for this matchup."
- `total_points_won_pct` — reported directly from `getHistoricalServeReturnStats`'s own `total_points_won_pct` (raw `total_points_won / total_points_total` from DataHub match stats), an exact match to "the overall percentage of all points won in the match, combining serve and return" applied to the player's historical body of matches (not a single match — reconstructed as an aggregate rate, consistent with how every other PARTIAL/RECONSTRUCTED metric in this series aggregates across the player's history).

## 7. Provenance/sample/persistence
Every value carries `source_name: "DataHub ATP World Tour tennis data (CC BY 4.0)"`, `url`, `retrieved_at` (ISO timestamp generated at read time), and `sample` (count of qualifying historical matches) via `stat()` in `datahub-atp-serve-return.server.ts`. `localMetricRows` preserves `sample`/`sources` through to the final `MetricFinding`.

## 8. Cross-wiring audit
`SUMMARY_KEYS["004"]` also includes `service_points_won_pct`, `return_points_won_pct`, `hold_pct`, `break_pct`, and `combined_point_efficiency` alongside the five named-submetric keys. These are real, correctly-sourced, non-fabricated per-player rates (the raw inputs the matchup-specific values are built from), not proxy substitutions for a different metric's named value — no cross-code mismatch bug of the 026/027 kind found. They are, however, broader context than the six exact named bullets. Left as-is this pass (they don't misrepresent anything and the project's own established pattern for other PARTIAL codes also reports adjacent supporting figures), but flagged here in case a future pass wants to narrow `SUMMARY_KEYS["004"]` to only the six named quantities for tighter code/definition alignment.

## 9. Legitimate unavailable-data recovery
Recovered/confirmed:
- Dominance Ratio, Total Points Won %, Matchup-Specific Expected Hold %, Matchup-Specific Expected Break %, Expected Hold/Break Differential all have genuine, correctly-oriented, provenance-carrying evidence.

Still SOURCE REQUIRED:
- Opponent-Adjusted Dominance Ratio — needs an opponent-strength weighting scheme (e.g. ranking- or Elo-adjusted) applied across the player's full schedule, not just this one matchup; no such scheme exists in this codebase yet.

## 10. Regression protection
Added `src/lib/metric-004-combined-efficiency-contract.test.ts` proving:
- `SUMMARY_KEYS["004"]` contains all five covered named-submetric keys and does not contain any key belonging to a different metric's exact named vocabulary (e.g. break-point/deuce/tiebreak keys reserved for code 009, aggregate serve-profile keys reserved for 002/003's own named bullets like `ace_rate_pct`/`first_serve_in_pct`).
- The live `partialReason` for family `"004"` explicitly names Opponent-Adjusted Dominance Ratio as the missing component (guards against the transparency gap found and fixed this pass regressing silently).
- `getMatchupEfficiencyStats`'s `dominance_ratio` is computed as player-return-pct ÷ opponent-return-pct from independently-supplied fixture data, oriented correctly to the requested player.

Certification: FIXED / PARTIAL / SOURCE REQUIRED. No evidence inflation; the fix this pass was additive (a missing transparency note), not a treatment change.
