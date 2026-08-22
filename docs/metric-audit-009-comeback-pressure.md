# Metric 009 — Comeback/Pressure Behavior — Sequential Audit Record

Status: FIXED / PARTIAL / SOURCE REQUIRED

## 1. Exact master definition
Authoritative source: `public/seed/metrics.txt`, section 9.

Required submetrics:
- Wins From Behind
- Break-Consolidation Rate
- Serving-for-Set Conversion
- Serving-for-Match Conversion
- Pressure-Point Performance
- Clutch Hold/Break Performance
- Tiebreak Record

## 2. Permitted raw inputs
Permitted inputs are pre-match historical score/state observations that directly identify trailing state, break chronology, serving-for-set/match opportunities, break/set/match points, high-leverage hold/break situations, and tiebreak outcomes. Generic match-level break-point %, close-match win %, deciding-set %, Elo, market data, Matrix outputs, or unrelated set-front-runner statistics are not valid substitutes.

## 3. Sources inspected
- DataHub ATP ordered set scores support the subset “won match after losing Set 1” and tiebreak wins/losses.
- DataHub ATP match stats contain aggregate break-point totals but no chronology identifying break consolidation, serving-for-set/match, set points, match points, or high-leverage game states.
- PredixSport ATP match history contains results/set totals but no point/game sequence for the missing pressure states.
- PredixSport WTA ratings do not provide the required event-state observations.
- Repository search found no imported chronological break/serve-out/point-state feed that can legitimately reconstruct the missing submetrics.

## 4. P1/P2 orientation
The DataHub score parser reverses winner-perspective set scores for a requested loser. Comeback and tiebreak calculations therefore remain player-oriented. Regression tests explicitly verify the requested player's comeback and tiebreak results.

## 5. Treatment classification
The broad family is PARTIAL when the supported set-behind/tiebreak subset exists. Atomic outputs are RECONSTRUCTED from explicit historical scores. Unsupported pressure-state components remain SOURCE REQUIRED.

## 6. Reconstruction/formula verification
- Set-1-behind comeback subset = match wins / matches where the player lost Set 1. This legitimately supports part of “Wins From Behind” but not every possible in-set/in-match trailing state, so the family remains PARTIAL.
- Tiebreak Record = tiebreak sets won / tiebreak sets played, based on explicit ordered set scores.
- No formula substitutes generic break-point conversion/saved rates for pressure-point performance.
- No deciding-set or generic close-match statistic is used as a proxy for clutch high-leverage hold/break performance.

## 7. Provenance/sample/persistence
Supported reconstructed values preserve player identity, DataHub source URL, retrieval timestamp, denominator sample and RECONSTRUCTED origin. The metric row preserves the PARTIAL treatment and explicit missing-state explanation rather than erasing it when a subset value exists.

## 8. Cross-wiring audit
Removed from metric 009 wiring because they do not satisfy the exact definition:
- `break_points_saved_pct`
- `break_point_conversion_pct`
- `close_match_win_pct`
- `historical_deciding_set_win_pct`
- `deciding_matches_played`
- `win_after_winning_set1_pct`

Allowed local keys are now limited to `win_after_losing_set1_pct`, `tiebreak_win_pct`, and `tiebreaks_played`.

## 9. Legitimate unavailable-data recovery
Recovered from existing score history:
- partial Wins From Behind evidence via Set-1-deficit comeback rate
- Tiebreak Record

Still SOURCE REQUIRED:
- Break-Consolidation Rate
- Serving-for-Set Conversion
- Serving-for-Match Conversion
- combined Break/Set/Match Pressure-Point Performance
- high-leverage Clutch Hold/Break Performance

## 10. Regression protection
Added `src/lib/metric-009-pressure-contract.test.ts` proving:
- prohibited generic BP/close-match/deciding-set/set-front-runner fields cannot be wired into 009
- comeback and tiebreak evidence stay oriented to the requested player

Certification: FIXED / PARTIAL / SOURCE REQUIRED. No evidence inflation.
