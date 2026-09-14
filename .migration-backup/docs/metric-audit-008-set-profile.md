# Metric 008 — Set Profile — Sequential Audit Record

Status: FIXED / PARTIAL / SOURCE REQUIRED

## 1. Exact master definition
Authoritative source: `public/seed/metrics.txt`, section 8.

Required submetrics:
- Set-1 Win Rate
- Set-2 Win Rate
- Set-3/Deciding-Set Win Rate
- First-Break Frequency
- Record After Losing Set 1
- Record After Winning Set 1
- Second-Set Performance After Losing Set 1
- Deciding-Set Win Rate
- Break-Back Rate
- Hold/Return Improvement Set 1 → Sets 2/3

## 2. Permitted raw inputs
Only pre-match historical score/state evidence may satisfy this family: player identity, winner/loser identity, ordered set scores, explicit winner/loser set totals, game/break sequence when available, serve order/game state when available, and per-set hold/return statistics when available. Generic aggregate serve/return rates, Elo, market data, Matrix outputs, or unrelated form fields cannot substitute for missing score-state inputs.

## 3. Sources inspected
- DataHub ATP match-score files: explicit winner/loser identities, ordered compact set scores, winner/loser set totals and game totals. This legitimately supports set-order outcomes and deciding-set identification.
- DataHub ATP match-stat files: match-level aggregate serve/return and break-point fields only. They do not provide the chronological game/break sequence or per-set serve/return split required for first-break, immediate break-back, or Set 1 → Sets 2/3 hold/return improvement.
- PredixSport ATP match history: set totals and result context, useful as supporting history but not enough for chronological break-state metrics.
- PredixSport WTA ratings: no equivalent imported score-state history for this family.
- Repository search found no current first-break, break-back, serving-state, or per-set hold/return event stream capable of filling those missing submetrics.

## 4. P1/P2 orientation
DataHub rows are winner-oriented. The score-profile reconstruction explicitly reverses every ordered set score when the requested player is the loser, so values are always from the requested player's perspective. Regression coverage verifies this orientation.

## 5. Treatment classification
The broad 008 family remains PARTIAL whenever supported set-profile values exist. Its atomic outputs are RECONSTRUCTED from explicit historical scores. Missing first-break, break-back and per-set hold/return improvement remain source-required and are not filled with aggregate proxies.

## 6. Reconstruction/formula verification
- Set-1 Win Rate = first sets won / matches with a parsed first set.
- Set-2 Win Rate = second sets won / matches with a parsed second set.
- Record After Losing Set 1 = matches won / matches in which the player lost Set 1.
- Record After Winning Set 1 = matches won / matches in which the player won Set 1.
- Second-Set Performance After Losing Set 1 = second sets won / matches where Set 1 was lost and Set 2 is present.
- Deciding-set rate uses explicit match set totals: 2-1 in BO3 or 3-2 in BO5 only. A 3-0 or 3-1 match is not a deciding-set match.
- Compact DataHub score tokens such as `62`, `26`, `63`, and tiebreak notation such as `76(7)` are now parsed correctly. Previously the code expected a hyphen and could silently miss valid set evidence.

## 7. Provenance/sample/persistence
Each atomic output carries the requested player identity, DataHub source URL, retrieval timestamp, actual denominator sample and RECONSTRUCTED origin. The hybrid metric row persists values, sample, source references, PARTIAL treatment and the explicit explanation of unsupported submetrics.

## 8. Cross-wiring audit
No generic break-points-saved %, break-point-conversion %, aggregate hold %, aggregate return %, Elo, H2H, market or Matrix field is allowed to satisfy First-Break Frequency, Break-Back Rate or Hold/Return Improvement Set 1 → Sets 2/3.

## 9. Legitimate unavailable-data recovery
Recovered/fixed from existing imports:
- compact DataHub score parsing
- Set-1 Win Rate
- Set-2 Win Rate
- Set-3/Deciding-Set Win Rate
- Record After Losing Set 1
- Record After Winning Set 1
- Second-Set Performance After Losing Set 1
- correct BO3/BO5 deciding-match identification

Still SOURCE REQUIRED:
- First-Break Frequency
- Break-Back Rate
- Hold/Return Improvement Set 1 → Sets 2/3
These require chronological game/point or per-set serve/return data not present in the current imports.

## 10. Regression protection
Added `src/lib/datahub-atp-score-profile.test.ts` covering:
- the imported compact score notation
- P1/P2 winner/loser orientation
- second-set response after losing Set 1
- correct BO5 decider detection
- source/sample/origin provenance

Certification: FIXED / PARTIAL / SOURCE REQUIRED. No evidence standard was weakened.
