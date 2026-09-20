# 81-Metric Recoverability Audit

## Scope and accounting

This audit treats the repository and production database as one evidence universe. It does **not** equate `metric_evidence_store` with total evidence. The inventory includes the four-tour repository history, production ranking/schedule/result observations, approved BSD point-by-point assets, event/surface context, persisted evidence, and confirmed market persistence.

Four representative tours × 81 metrics = **324 metric-tour coverage cells**. The reported 12.04% baseline corresponds to **39 / 324 = 12.0370%**, rounded to 12.04%. A 70% threshold requires **227 usable cells** because 226 / 324 is only 69.7531%. Therefore the exact minimum increase is **188 additional pair-usable cells**. If a recovered metric becomes pair-usable on all four tours, that is 4 cells, so the theoretical minimum is **47 full four-tour metric equivalents**. 227 / 324 = **70.0617%**.

A metric is never credited merely because a source family exists. DIRECT, RECONSTRUCTED, or PARTIAL treatment still requires legitimate raw evidence for both player sides in the particular tour/match cell. One-sided evidence remains unavailable. The recovery queue must therefore fill **188 currently unavailable cells**, not simply rename 47 metrics green.

The production persistence tables do not currently retain the 324-cell per-metric diagnostic snapshot needed to assign the existing 39 cells to exact metric codes after the fact. The map below therefore records confirmed persisted evidence separately and gives each metric's **potential** four-tour contribution. The runtime recovery pass must subtract already-usable cells before selecting the final 188 cells. This avoids inventing a false exact per-code baseline allocation.

## Evidence inventory used

- ATP historical results: **79,002 rows** indexed.
- WTA historical results: **60,638 rows** indexed.
- ATP Challenger history: **32,866 matches** indexed.
- WTA Challenger/WTA 125 history: **7,615 validated matches** indexed.
- ATP rankings: production `ranking_atp` observations.
- WTA rankings: production `ranking_wta` observations; WTA 125 uses the WTA ranking circuit.
- ATP/WTA schedules and result observations in production.
- Approved BSD PBP adapters for ATP Main, WTA Main, ATP Challenger, and WTA Challenger/WTA 125.
- Persisted evidence confirmed for codes 001, 005, 007, 014, 020, 021, 043, 044, and 058 on the inspected persisted pair.
- No broad raw `odds_api` MARKET observation set was confirmed in the production inventory; market claims are therefore kept partial/unavailable rather than inferred.

## Classification totals

- **DIRECTLY AVAILABLE:** 1 metric
- **RECONSTRUCTABLE:** 41 metrics
- **PARTIAL:** 13 metrics
- **TRULY UNAVAILABLE:** 26 metrics
- **Potentially usable without weakening the firewall:** 55 / 81 metric families, subject to the raw evidence existing for the particular matchup/tour cell.

Each metric that is legitimately usable across all four tours can contribute at most **4 / 324 = 1.234568 percentage points**. One recovered tour cell contributes **1 / 324 = 0.308642 percentage points**.

## 81-row recovery map

| # | Metric | Classification | Raw evidence required / evidence basis | Potential four-tour contribution |
|---:|---|---|---|---:|
| 001 | Surface Strength | RECONSTRUCTABLE | Results + surface + rankings; rebuild overall/surface strength timeline | 1.234568 pp |
| 002 | Serve Profile | PARTIAL | Approved PBP gives server/point/ace-DF components; serve-number detail is incomplete | 1.234568 pp max |
| 003 | Return Profile | PARTIAL | Approved PBP gives return-point components; serve-number detail is incomplete | 1.234568 pp max |
| 004 | Break-Point Performance | RECONSTRUCTABLE | PBP score state + server/returner + point winner | 1.234568 pp |
| 005 | Recent Form | RECONSTRUCTABLE | Recent results + surface + opponent quality/rankings | 1.234568 pp |
| 006 | Head-to-Head | RECONSTRUCTABLE | Canonical pair history + date + surface/context | 1.234568 pp |
| 007 | Schedule / Load | PARTIAL | Dates/sets/games/rest exist; hours/travel/time-zone components are incomplete | 1.234568 pp max |
| 008 | Injury / Fitness | TRULY UNAVAILABLE | Needs structured injury/illness/medical severity evidence not present | 0 |
| 009 | Clutch / Pressure | RECONSTRUCTABLE | PBP deciding/tiebreak/late-set score states + winner | 1.234568 pp |
| 010 | Straight-Set Dominance | RECONSTRUCTABLE | Historical scorelines + surface | 1.234568 pp |
| 011 | Volatility / Floor | RECONSTRUCTABLE | Set/game score distributions + TB/lopsided frequencies | 1.234568 pp |
| 012 | Environment Fit | PARTIAL | Event/surface context exists; weather/altitude/roof/ball context incomplete | 1.234568 pp max |
| 013 | Common-Opponent Results | RECONSTRUCTABLE | Results + opponent identity + rankings/quality + surface | 1.234568 pp |
| 014 | Ranking & Rating | DIRECTLY AVAILABLE | Existing ATP/WTA official ranking observations | 1.234568 pp |
| 015 | Market View | TRULY UNAVAILABLE | Needs broad paired bookmaker odds/snapshots; raw MARKET rows not confirmed | 0 |
| 016 | Serve +1 Effectiveness | TRULY UNAVAILABLE | Needs serve shot and next-shot outcome/placement not exposed by approved PBP | 0 |
| 017 | Return +1 Effectiveness | TRULY UNAVAILABLE | Needs return shot and next-shot outcome not exposed by approved PBP | 0 |
| 018 | Rally-Length Profile | TRULY UNAVAILABLE | Needs rally shot count; raw PBP does not confirm this field | 0 |
| 019 | Scoreline Calibration | TRULY UNAVAILABLE | Needs historical prediction + market probability + realized result calibration data | 0 |
| 020 | Recent Quality | RECONSTRUCTABLE | Recent results + rankings/opponent quality + surface | 1.234568 pp |
| 021 | Elo Delta | RECONSTRUCTABLE | Chronological four-tour results + surface can rebuild Elo timelines | 1.234568 pp |
| 022 | H2H Similar-Conditions | RECONSTRUCTABLE | H2H results + surface/event context | 1.234568 pp |
| 023 | Bagel/Blowout Rate | RECONSTRUCTABLE | Set scores + surface | 1.234568 pp |
| 024 | Deciding-Set Win Rate | RECONSTRUCTABLE | Scorelines/deciding-set result; PBP where needed | 1.234568 pp |
| 025 | Tiebreak Performance | RECONSTRUCTABLE | Tiebreak set/point outcomes | 1.234568 pp |
| 026 | Hold% | RECONSTRUCTABLE | PBP server/game state + break outcomes | 1.234568 pp |
| 027 | Break% | RECONSTRUCTABLE | PBP return games + break outcomes | 1.234568 pp |
| 028 | First-Serve% | TRULY UNAVAILABLE | Needs first/second serve-attempt indicator not confirmed in raw PBP | 0 |
| 029 | 1st Serve Points Won% | TRULY UNAVAILABLE | Needs first-serve indicator + outcome | 0 |
| 030 | 2nd Serve Points Won% | TRULY UNAVAILABLE | Needs second-serve indicator + outcome | 0 |
| 031 | Ace Rate | RECONSTRUCTABLE | Approved PBP ace indicator + service points | 1.234568 pp |
| 032 | Double-Fault Rate | RECONSTRUCTABLE | Approved PBP DF indicator + service points | 1.234568 pp |
| 033 | Return Points Won% | RECONSTRUCTABLE | PBP server/returner identity + point winner | 1.234568 pp |
| 034 | 1st Return Points Won% | TRULY UNAVAILABLE | Needs first-serve indicator + return outcome | 0 |
| 035 | 2nd Return Points Won% | TRULY UNAVAILABLE | Needs second-serve indicator + return outcome | 0 |
| 036 | BP Saved% | RECONSTRUCTABLE | Break-point score state + service point winner | 1.234568 pp |
| 037 | BP Converted% | RECONSTRUCTABLE | Break-point score state + return point winner | 1.234568 pp |
| 038 | BP Faced/Game | RECONSTRUCTABLE | Break-point states + service-game count | 1.234568 pp |
| 039 | BP Chances/Game | RECONSTRUCTABLE | Break-point states + return-game count | 1.234568 pp |
| 040 | Deuce Outcomes | RECONSTRUCTABLE | Deuce score states + point winner/server | 1.234568 pp |
| 041 | First-Ball (<4 Shot) Win Rate | TRULY UNAVAILABLE | Needs rally shot count under four | 0 |
| 042 | Extended Rally (9+) Win Rate | TRULY UNAVAILABLE | Needs rally shot count nine-plus | 0 |
| 043 | Favorite Win% | PARTIAL | Limited persisted market evidence exists; broad raw closing-odds history absent | 1.234568 pp max |
| 044 | Underdog Win% | PARTIAL | Limited persisted market evidence exists; broad raw closing-odds history absent | 1.234568 pp max |
| 045 | Three-Set Frequency | RECONSTRUCTABLE | Match score + BO3 format | 1.234568 pp |
| 046 | Surface Match Win% | RECONSTRUCTABLE | Results + surface | 1.234568 pp |
| 047 | Indoor Win% | PARTIAL | Results exist; indoor flag only partially available | 1.234568 pp max |
| 048 | Outdoor Hard Win% | PARTIAL | Hard results exist; outdoor flag not uniform | 1.234568 pp max |
| 049 | Clay Win% | RECONSTRUCTABLE | Results + clay surface | 1.234568 pp |
| 050 | Grass Win% | RECONSTRUCTABLE | Results + grass surface | 1.234568 pp |
| 051 | Sets Lost per Match | RECONSTRUCTABLE | Scorelines + match counts | 1.234568 pp |
| 052 | Avg Games per Set | RECONSTRUCTABLE | Set scores + set counts | 1.234568 pp |
| 053 | Straight-Set Win% | RECONSTRUCTABLE | Straight-set scorelines + completed BO3 wins | 1.234568 pp |
| 054 | 6-0 Set Rate | RECONSTRUCTABLE | Set scorelines | 1.234568 pp |
| 055 | Blowout Set Rate | RECONSTRUCTABLE | Set score differentials | 1.234568 pp |
| 056 | Tiebreaks per Match | RECONSTRUCTABLE | Tiebreak sets + match count | 1.234568 pp |
| 057 | Retirements/Walkovers Rate | PARTIAL | Schedules/results exist; R/W/O status not uniformly preserved in runtime index | 1.234568 pp max |
| 058 | Opponent-Quality Win% | RECONSTRUCTABLE | Results + opponent ranking/Elo band | 1.234568 pp |
| 059 | Rest-Shortfall Rate | RECONSTRUCTABLE | Consecutive match dates + rest calculation | 1.234568 pp |
| 060 | Travel Load | PARTIAL | Tournament sequence/date exists; coordinates/time zones incomplete | 1.234568 pp max |
| 061 | Workload | PARTIAL | Matches/sets/games reconstructable; match duration incomplete | 1.234568 pp max |
| 062 | Altitude Win% | TRULY UNAVAILABLE | Needs event altitude field not confirmed in existing data | 0 |
| 063 | Heat Win% | TRULY UNAVAILABLE | Needs historical event temperature | 0 |
| 064 | Cold Win% | TRULY UNAVAILABLE | Needs historical event temperature | 0 |
| 065 | Wind Win% | TRULY UNAVAILABLE | Needs historical wind | 0 |
| 066 | Humidity Win% | TRULY UNAVAILABLE | Needs historical humidity | 0 |
| 067 | Roof/Indoor Transition | PARTIAL | Results/events exist; roof/indoor state is sparse | 1.234568 pp max |
| 068 | Left/Right-Handed Opponent Splits | TRULY UNAVAILABLE | Needs opponent handedness not confirmed in current evidence universe | 0 |
| 069 | Dominance Ratio | RECONSTRUCTABLE | PBP point-winner totals | 1.234568 pp |
| 070 | Breakback Rate | RECONSTRUCTABLE | PBP game break sequence + next return game | 1.234568 pp |
| 071 | Close-Out Rate | RECONSTRUCTABLE | Serving-for-set/match state + game outcome | 1.234568 pp |
| 072 | Return Depth / Placement | TRULY UNAVAILABLE | Needs return landing/depth coordinates | 0 |
| 073 | Serve Placement | TRULY UNAVAILABLE | Needs serve-placement coordinates | 0 |
| 074 | Rally Direction / Patterns | TRULY UNAVAILABLE | Needs shot direction/type sequence | 0 |
| 075 | Unforced Error Rate | TRULY UNAVAILABLE | Needs structured UE labels | 0 |
| 076 | Winner Rate | TRULY UNAVAILABLE | Needs structured shot-winner labels | 0 |
| 077 | Net Approach Success | TRULY UNAVAILABLE | Needs net-approach indicator/outcome | 0 |
| 078 | First-Strike Efficiency | TRULY UNAVAILABLE | Needs first-strike shot sequence | 0 |
| 079 | Pressure Index | RECONSTRUCTABLE | PBP score-state pressure points + outcome | 1.234568 pp |
| 080 | Stability / Variance | RECONSTRUCTABLE | Match/set/game score history | 1.234568 pp |
| 081 | Tournament Context | PARTIAL | Event level/round/surface exist; draw/indoor/altitude context incomplete | 1.234568 pp max |

## Recovery order

The committed `RECOVERY_PRIORITY_CODES` follows the requested order: historical-results-derived metrics first; then objective PBP/score-state metrics; rankings/form/workload/scheduling; surface/event/context; market-derived partials last. The queue contains all 55 legitimately recoverable metric families. Runtime execution must walk this queue and count only previously unavailable pair-complete tour cells until **188 new cells** have been recovered.

## False-green firewall

The 26 `TRULY_UNAVAILABLE` metrics remain unavailable unless a new raw dataset actually supplies the missing fields. A generic PBP row cannot satisfy shot placement, rally length, serve number, UE/winner, or net-approach metrics merely because it is point-by-point. Likewise, historical results cannot fabricate injury, weather, altitude, handedness, or market data. PARTIAL is allowed only when the available raw evidence genuinely addresses a defined component of the metric for both players.
