# Metric 011 — Volatility/Floor — Sequential Audit Record

Status: FIXED / PARTIAL / SOURCE REQUIRED

## 1. Exact master definition
Authoritative source: `public/seed/metrics.txt`, section 11.

Required submetrics:
- Performance Variance
- Floor vs Ceiling
- Close-Match Dependency
- Deciding-Set/Tiebreak Reliance
- Upset Resistance

## 2. Permitted raw inputs
Permitted inputs are pre-match match-by-match performance observations, ordered scorelines, win/loss outcomes, deciding-set/tiebreak indicators, and official opponent ranking evidence for Upset Resistance. Elo movement, generic close-match win percentage, and Elo-defined weaker opponents may not substitute for the exact master concepts.

## 3. Sources inspected
- PredixSport ATP match history: match-level result, set differential and Elo history. Set differential legitimately supports performance fluctuation; Elo delta is not used as the floor/ceiling definition.
- DataHub ATP ordered scores: supports identification of narrow-score wins, deciding-set wins and tiebreak-containing wins.
- Ranking-performance module explicitly states Elo is not ATP/WTA rank and official ranking remains unavailable without a ranking feed.
- No imported official ranking-at-match history was found that can truthfully identify every loss to a lower-ranked opponent for the master Upset Resistance definition.

## 4. P1/P2 orientation
All derived set-margin statistics come from player-oriented PredixSport rows. DataHub score rows are reversed when the requested player is the recorded loser. Close-win and deciding/tiebreak reliance therefore remain oriented to the requested player.

## 5. Treatment classification
The broad family remains PARTIAL when supported volatility/floor/reliance values exist. Atomic values are RECONSTRUCTED from explicit historical results. Upset Resistance remains SOURCE REQUIRED because the active imports do not provide the necessary official ranking-at-match evidence.

## 6. Reconstruction/formula verification
- Performance Variance = sample standard deviation of recent match set differential.
- Floor vs Ceiling = observed recent max set differential minus min set differential, using the same performance scale as variance. It is explicitly an observed recent range, not an Elo-change range.
- Close-Match Dependency = wins classified as deciding-set or containing a narrow 7-5/7-6-style set / all wins with parseable scores.
- Deciding-Set/Tiebreak Reliance = wins requiring a deciding set or containing at least one tiebreak / all wins with parseable scores.
- Upset Resistance is NOT calculated from an Elo threshold because the master definition specifically says lower-ranked opponents.

## 7. Provenance/sample/persistence
PredixSport/DataHub outputs preserve player identity, source URL, retrieval timestamp, denominator sample and RECONSTRUCTED origin. The metric row persists the PARTIAL treatment and the official-ranking source requirement.

## 8. Cross-wiring audit
Removed from metric 011 wiring:
- `floor_ceiling_elo_range`
- `recent_elo_delta_mean`
- `recent_elo_delta_variance`
- `recent_elo_best_delta`
- `recent_elo_worst_delta`
- `close_match_win_pct`
- `deciding_match_reliance_pct`
- Elo-derived `upset_resistance_pct`

Allowed 011 keys are restricted to:
- `performance_variance`
- `performance_floor_ceiling_set_margin_range`
- `close_match_dependency_pct`
- `deciding_tiebreak_win_reliance_pct`

## 9. Legitimate unavailable-data recovery
Recovered/fixed:
- performance variance on a consistent match-performance scale
- observed floor/ceiling range on that same scale
- close-match dependency denominator over wins
- deciding-set/tiebreak win reliance denominator over wins

Still SOURCE REQUIRED:
- Upset Resistance against officially lower-ranked opponents

## 10. Regression protection
Added `src/lib/metric-011-volatility-floor.test.ts` proving:
- close-match dependency and deciding/tiebreak reliance use wins as the denominator
- Elo-defined weaker opponents cannot satisfy the official-ranking Upset Resistance definition
- Elo change/floor fields and generic close-match win rates cannot cross-wire into 011
- variance and floor/ceiling use set-margin performance rather than rating movement

Certification: FIXED / PARTIAL / SOURCE REQUIRED. No evidence inflation.
