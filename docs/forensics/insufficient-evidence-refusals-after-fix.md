# Forensic audit — the 32 INSUFFICIENT_EVIDENCE decisions

Snapshot: **slate_number=1 (71df3836-bc2d-49dd-a0cf-4547c02e6779), 32 INSUFFICIENT_EVIDENCE refusals**, captured 2026-09-10T20:30:00Z (live Supabase, post-fix re-run). Read-only; no production data was modified.

Active metric set: 25 codes. Selection threshold: **60%** (unchanged by this audit).

Independent reconstruction agrees with the stored verdict in 18/32 cases; P1/P2 mirror-symmetry holds in 32/32.

## Classification summary

| classification | n |
| --- | --- |
| TRUE_TIE | 3 |
| BELOW_THRESHOLD | 8 |
| CONFLICTED_EVIDENCE | 0 |
| ROBUSTNESS_UNRESOLVED | 0 |
| DOWNSTREAM_VETO_BUG | 0 |
| FIXED_PENDING_REPROCESS | 14 |
| DATA_OR_PIPELINE_BUG | 7 |
| OTHER | 0 |

## TRUE_TIE (3)

### Tomas Martin Etcheverry vs Vit Kopriva

- match_id `a12f5a84-f362-48a7-b3c2-55ff81e7efc9` · audit_run_id `2e68fb1e-b023-4352-a7d1-724902ae615c` · US Open Round of 128 (Hard)
- stored: **INSUFFICIENT EVIDENCE** / colour INSUFFICIENT EVIDENCE / independent_winner null
- stage that caused the refusal: **DECISION CORE (family vote)**

| | P1 Tomas Martin Etcheverry | P2 Vit Kopriva |
| --- | --- | --- |
| supporting families | H2H_PROBABILITY, SURFACE_STRENGTH | IMPROVEMENT_TREND, POINT_BY_POINT |
| contradicting families | IMPROVEMENT_TREND, POINT_BY_POINT | H2H_PROBABILITY, SURFACE_STRENGTH |
| directional share (unrounded) | 40% | 40% |
| reaches 60% | no | no |
| verification: families supporting | H2H_PROBABILITY, SURFACE_STRENGTH | IMPROVEMENT_TREND, POINT_BY_POINT |
| verification: metrics not compared — own supply failure / refused on sample floor / supplied-but-unused | 4 / 4 / 3 | 4 / 4 / 3 |
| disagreement: families against this player | IMPROVEMENT_TREND(MODERATE), POINT_BY_POINT(MODERATE) | H2H_PROBABILITY(MODERATE), SURFACE_STRENGTH(CRITICAL) |
| disagreement: overall severity | MAJOR | CRITICAL |
| underdog: pathways | COMMON_OPPONENT_ADVANTAGE(STRONG_PATHWAY, 6x), MATCHUP_TACTICAL_ADVANTAGE(VIABLE_PATHWAY, 3.733x), SURFACE_ADVANTAGE(STRONG_PATHWAY, 11.974x) (STRONG_PATHWAY) | COMMON_OPPONENT_ADVANTAGE(VIABLE_PATHWAY, 2.4x), IMPROVEMENT_TREND_ADVANTAGE(VIABLE_PATHWAY, 2.3x), POINT_BY_POINT_ADVANTAGE(VIABLE_PATHWAY, 2.212x) (STRONG_PATHWAY) |
| underdog: evaluated by production | false | false |
| stress: support before → after | 40% → 40% | 40% → 40% |
| stress: status | REMOVED | REMOVED |
| stress: outcome when THIS side is stressed | INSUFFICIENT | INSUFFICIENT |
| stress: run by production | true | true |
| stress: families manufactured out of NEUTRAL | — | — |

Conflicted families: COMMON_OPPONENT · neutral: LOSS_PROFILE, RECENT_FORM · directional denominator: 5

**Stage trace** — family vote `TIE` → threshold `TIE` → leave-one-family-out `TIE` → verification `TIE` → disagreement `TIE` → underdog `TIE` → stress `TIE` → stored `INSUFFICIENT`. Symmetric stress verdict: `NOT_APPLICABLE`.

**Why:** Independent evidence families are level (2 for P1 vs 2 for P2, 1 internally conflicted). Neither player holds a directional advantage, so neither reaches 60%.

> Dangerous Underdog audit analysed NEITHER player: runUnderdogAnalysis only examines the non-selected side, so a match with no selection gets no underdog analysis for anyone.

> P1/P2 carry no canonical player_id on this match; side identity rests on name and column position alone.

<details><summary>Per-metric evidence (P1 vs P2)</summary>

| code | metric | P1 | P2 | diff | noise floor | ×floor | favours | status | family | P1 treatment | P2 treatment | source |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 001 | Surface Elo | 1745.2 | 1625.46 | 119.74 | 10 | 11.97 | P1 | COMPARED | SURFACE_STRENGTH | DIRECT | DIRECT | PredixSport public tennis ratings (CC BY 4.0) |
| 002 | Service point win % | 57.2816 | 61.7021 | -4.4205 | 10 | 0.44 | NEUTRAL | COMPARED | POINT_BY_POINT | PARTIAL | PARTIAL | BSD/Bzzoiro ATP Main PBP |
| 003 | Return point win % | 23.3333 | 45.4545 | -22.1212 | 10 | 2.21 | P2 | COMPARED | POINT_BY_POINT | PARTIAL | PARTIAL | BSD/Bzzoiro ATP Main PBP |
| 005 | Last-10 win % | 70 | 70 | 0 | 5 | 0.00 | NEUTRAL | COMPARED | RECENT_FORM | PARTIAL | PARTIAL | runtime:atp_main |
| 006 | Bad-loss rate % | 25 | 25 | — | 25 | — | UNAVAILABLE | INSUFFICIENT_SAMPLE | LOSS_PROFILE | PARTIAL | PARTIAL | PredixSport public tennis ratings (CC BY 4.0) |
| 007 | Common-opponent win % | 100 | 100 | 0 | 20 | 0.00 | NEUTRAL | COMPARED | COMMON_OPPONENT | RECONSTRUCTED | RECONSTRUCTED | runtime:atp_main |
| 008 | Deciding-set win % | — | — | — | 5 | — | UNAVAILABLE | VALUE_NOT_PARSEABLE | SET_PROFILE | DIRECT | DIRECT | PredixSport public tennis ratings (CC BY 4.0) |
| 009 | Pressure point win % | — | — | — | 18 | — | UNAVAILABLE | VALUE_NOT_PARSEABLE | POINT_BY_POINT | DIRECT | DIRECT | PredixSport public tennis ratings (CC BY 4.0) |
| 010 | Straight-set win % | — | — | — | 5 | — | UNAVAILABLE | VALUE_NOT_PARSEABLE | SET_PROFILE | DIRECT | DIRECT | PredixSport public tennis ratings (CC BY 4.0) |
| 011 | Match win % | — | — | — | 5 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | RESULTS_HISTORY | UNAVAILABLE | UNAVAILABLE | — |
| 016 | Break-point score-state win % | 50 | 22.2222 | — | 24 | — | UNAVAILABLE | INSUFFICIENT_SAMPLE | POINT_BY_POINT | PARTIAL | PARTIAL | BSD/Bzzoiro ATP Main PBP |
| 018 | Breakback rate % | 33.3333 | 40 | — | 40 | — | UNAVAILABLE | INSUFFICIENT_SAMPLE | POINT_BY_POINT | RECONSTRUCTED | RECONSTRUCTED | BSD/Bzzoiro ATP Main PBP |
| 027 | Lead protection % | — | — | — | 5 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | CLOSING_ABILITY | UNAVAILABLE | UNAVAILABLE | — |
| 029 | Response after a close set loss, vs own baseline | — | — | — | 25 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | PSYCH_RESPONSE | UNAVAILABLE | UNAVAILABLE | — |
| 031 | Opponent-adjusted set differential | -0.5 | -0.13999999999999999 | -0.36 | 0.15 | 2.40 | P2 | COMPARED | COMMON_OPPONENT | RECONSTRUCTED | RECONSTRUCTED | Four-tour static history index (data/generated/tennis-runtime-index.json) |
| 032 | Break-point conversion % | 0 | 0 | — | 40 | — | UNAVAILABLE | INSUFFICIENT_SAMPLE | POINT_BY_POINT | PARTIAL | PARTIAL | BSD/Bzzoiro ATP Main PBP |
| 034 | Dominance ratio | 0.8571 | 1.0111 | -0.154 | 0.15 | 1.03 | P2 | COMPARED | POINT_BY_POINT | PARTIAL | PARTIAL | BSD/Bzzoiro ATP Main PBP |
| 036 | Losses as favourite % | 30 | 40 | -10 | 15 | 0.67 | NEUTRAL | COMPARED | LOSS_PROFILE | RECONSTRUCTED | RECONSTRUCTED | Four-tour static history index (data/generated/tennis-runtime-index.json) |
| 041 | Elo-adjusted surplus, recent vs earlier | 0.052000000000000005 | 0.28200000000000003 | -0.23 | 0.1 | 2.30 | P2 | COMPARED | IMPROVEMENT_TREND | RECONSTRUCTED | RECONSTRUCTED | Four-tour static history index (data/generated/tennis-runtime-index.json) |
| 045 | Deciding-set win % as pre-match favourite | — | — | — | 25 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | SET_PROFILE | UNAVAILABLE | UNAVAILABLE | — |
| 051 | Opponent-specific win probability % | 55.6 | 44.4 | 11.2 | 3 | 3.73 | P1 | COMPARED | H2H_PROBABILITY | RECONSTRUCTED | RECONSTRUCTED | Four-tour static history index (data/generated/tennis-runtime-index.json) |
| 053 | Pressure index % | 37.3134 | 35.7143 | 1.5991 | 18 | 0.09 | NEUTRAL | COMPARED | POINT_BY_POINT | PARTIAL | PARTIAL | BSD/Bzzoiro ATP Main PBP |
| 055 | Elo change over last 10 | 33.51 | 31.65 | 1.86 | 20 | 0.09 | NEUTRAL | COMPARED | RECENT_FORM | PARTIAL | PARTIAL | PredixSport public tennis ratings (CC BY 4.0) |
| 068 | Current win/loss streak (signed match count) | 2 | 4 | -2 | 5 | 0.40 | NEUTRAL | COMPARED | RECENT_FORM | PARTIAL | PARTIAL | runtime:atp_main |
| 080 | Common-opponent net divergent outcomes | 3 | -3 | 6 | 1 | 6.00 | P1 | COMPARED | COMMON_OPPONENT | PARTIAL | PARTIAL | runtime:atp_main |

</details>

### Juncheng Shang vs Marco Trungelliti

- match_id `435d5f05-5277-4001-aa4f-9e6eee60f283` · audit_run_id `5bf66226-a71a-4af1-af27-a4b54a38c677` · US Open Round of 128 (Hard)
- stored: **INSUFFICIENT EVIDENCE** / colour INSUFFICIENT EVIDENCE / independent_winner null
- stage that caused the refusal: **DECISION CORE (family vote)**

| | P1 Juncheng Shang | P2 Marco Trungelliti |
| --- | --- | --- |
| supporting families | IMPROVEMENT_TREND | POINT_BY_POINT |
| contradicting families | POINT_BY_POINT | IMPROVEMENT_TREND |
| directional share (unrounded) | 25% | 25% |
| reaches 60% | no | no |
| verification: families supporting | IMPROVEMENT_TREND | POINT_BY_POINT |
| verification: metrics not compared — own supply failure / refused on sample floor / supplied-but-unused | 8 / 3 / 3 | 6 / 3 / 5 |
| disagreement: families against this player | POINT_BY_POINT(MODERATE) | IMPROVEMENT_TREND(MODERATE) |
| disagreement: overall severity | MODERATE | MODERATE |
| underdog: pathways | COMMON_OPPONENT_ADVANTAGE(STRONG_PATHWAY, 8x), IMPROVEMENT_TREND_ADVANTAGE(VIABLE_PATHWAY, 3.57x), RECENT_FORM_ADVANTAGE(POTENTIAL_PATHWAY, 1.852x) (STRONG_PATHWAY) | COMMON_OPPONENT_ADVANTAGE(VIABLE_PATHWAY, 3.333x), POINT_BY_POINT_ADVANTAGE(VIABLE_PATHWAY, 2.241x), RECENT_FORM_ADVANTAGE(VIABLE_PATHWAY, 2x) (STRONG_PATHWAY) |
| underdog: evaluated by production | false | false |
| stress: support before → after | 25% → 25% | 25% → 25% |
| stress: status | REMOVED | REMOVED |
| stress: outcome when THIS side is stressed | INSUFFICIENT | INSUFFICIENT |
| stress: run by production | true | true |
| stress: families manufactured out of NEUTRAL | — | — |

Conflicted families: COMMON_OPPONENT, RECENT_FORM · neutral: H2H_PROBABILITY, LOSS_PROFILE, SURFACE_STRENGTH · directional denominator: 4

**Stage trace** — family vote `TIE` → threshold `TIE` → leave-one-family-out `TIE` → verification `TIE` → disagreement `TIE` → underdog `TIE` → stress `TIE` → stored `INSUFFICIENT`. Symmetric stress verdict: `NOT_APPLICABLE`.

**Why:** Independent evidence families are level (1 for P1 vs 1 for P2, 2 internally conflicted). Neither player holds a directional advantage, so neither reaches 60%.

> Thin evidence supply: only 11 of 25 active metrics were comparable; 11 never yielded comparable evidence (TREATMENT_NOT_USABLE x8, VALUE_NOT_PARSEABLE x3).

> Dangerous Underdog audit analysed NEITHER player: runUnderdogAnalysis only examines the non-selected side, so a match with no selection gets no underdog analysis for anyone.

> P1/P2 carry no canonical player_id on this match; side identity rests on name and column position alone.

<details><summary>Per-metric evidence (P1 vs P2)</summary>

| code | metric | P1 | P2 | diff | noise floor | ×floor | favours | status | family | P1 treatment | P2 treatment | source |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 001 | Surface Elo | 1536.75 | 1536.84 | -0.09 | 10 | 0.01 | NEUTRAL | COMPARED | SURFACE_STRENGTH | DIRECT | DIRECT | PredixSport public tennis ratings (CC BY 4.0) |
| 002 | Service point win % | — | — | — | 10 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | DIRECT | DataHub ATP World Tour tennis data (CC BY 4.0) |
| 003 | Return point win % | — | — | — | 10 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | DIRECT | DataHub ATP World Tour tennis data (CC BY 4.0) |
| 005 | Last-10 win % | 50 | 60 | -10 | 5 | 2.00 | P2 | COMPARED | RECENT_FORM | PARTIAL | PARTIAL | runtime:atp_main |
| 006 | Bad-loss rate % | 0 | 0 | — | 25 | — | UNAVAILABLE | INSUFFICIENT_SAMPLE | LOSS_PROFILE | PARTIAL | PARTIAL | PredixSport public tennis ratings (CC BY 4.0) |
| 007 | Common-opponent win % | 100 | 100 | 0 | 20 | 0.00 | NEUTRAL | COMPARED | COMMON_OPPONENT | RECONSTRUCTED | RECONSTRUCTED | runtime:atp_main |
| 008 | Deciding-set win % | — | — | — | 5 | — | UNAVAILABLE | VALUE_NOT_PARSEABLE | SET_PROFILE | DIRECT | DIRECT | PredixSport public tennis ratings (CC BY 4.0) |
| 009 | Pressure point win % | — | — | — | 18 | — | UNAVAILABLE | VALUE_NOT_PARSEABLE | POINT_BY_POINT | DIRECT | DIRECT | PredixSport public tennis ratings (CC BY 4.0) |
| 010 | Straight-set win % | — | — | — | 5 | — | UNAVAILABLE | VALUE_NOT_PARSEABLE | SET_PROFILE | DIRECT | DIRECT | PredixSport public tennis ratings (CC BY 4.0) |
| 011 | Match win % | — | — | — | 5 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | RESULTS_HISTORY | UNAVAILABLE | UNAVAILABLE | DataHub ATP World Tour tennis data (CC BY 4.0) |
| 016 | Break-point score-state win % | — | — | — | 24 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | UNAVAILABLE | — |
| 018 | Breakback rate % | — | — | — | 40 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | UNAVAILABLE | — |
| 027 | Lead protection % | — | — | — | 5 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | CLOSING_ABILITY | UNAVAILABLE | UNAVAILABLE | — |
| 029 | Response after a close set loss, vs own baseline | — | — | — | 25 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | PSYCH_RESPONSE | UNAVAILABLE | UNAVAILABLE | — |
| 031 | Opponent-adjusted set differential | -0.09 | 0.41 | -0.5 | 0.15 | 3.33 | P2 | COMPARED | COMMON_OPPONENT | RECONSTRUCTED | RECONSTRUCTED | Four-tour static history index (data/generated/tennis-runtime-index.json) |
| 032 | Break-point conversion % | 0 | 0 | — | 40 | — | UNAVAILABLE | INSUFFICIENT_SAMPLE | POINT_BY_POINT | PARTIAL | PARTIAL | BSD/Bzzoiro ATP Main PBP |
| 034 | Dominance ratio | 0.6829 | 1.019 | -0.3361 | 0.15 | 2.24 | P2 | COMPARED | POINT_BY_POINT | PARTIAL | PARTIAL | BSD/Bzzoiro ATP Main PBP |
| 036 | Losses as favourite % | 55 | 50 | 5 | 15 | 0.33 | NEUTRAL | COMPARED | LOSS_PROFILE | RECONSTRUCTED | RECONSTRUCTED | Four-tour static history index (data/generated/tennis-runtime-index.json) |
| 041 | Elo-adjusted surplus, recent vs earlier | 0.374 | 0.017 | 0.357 | 0.1 | 3.57 | P1 | COMPARED | IMPROVEMENT_TREND | RECONSTRUCTED | RECONSTRUCTED | Four-tour static history index (data/generated/tennis-runtime-index.json) |
| 045 | Deciding-set win % as pre-match favourite | — | — | — | 25 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | SET_PROFILE | UNAVAILABLE | UNAVAILABLE | — |
| 051 | Opponent-specific win probability % | 50 | 50 | 0 | 3 | 0.00 | NEUTRAL | COMPARED | H2H_PROBABILITY | RECONSTRUCTED | RECONSTRUCTED | Four-tour static history index (data/generated/tennis-runtime-index.json) |
| 053 | Pressure index % | 22.2222 | 57.1429 | — | 18 | — | UNAVAILABLE | INSUFFICIENT_SAMPLE | POINT_BY_POINT | PARTIAL | PARTIAL | BSD/Bzzoiro ATP Main PBP |
| 055 | Elo change over last 10 | 54.96 | 17.93 | 37.03 | 20 | 1.85 | P1 | COMPARED | RECENT_FORM | PARTIAL | PARTIAL | PredixSport public tennis ratings (CC BY 4.0) |
| 068 | Current win/loss streak (signed match count) | -2 | -1 | -1 | 5 | 0.20 | NEUTRAL | COMPARED | RECENT_FORM | PARTIAL | PARTIAL | runtime:atp_main |
| 080 | Common-opponent net divergent outcomes | 4 | -4 | 8 | 1 | 8.00 | P1 | COMPARED | COMMON_OPPONENT | PARTIAL | PARTIAL | runtime:atp_main |

</details>

### Genaro Alberto Olivieri vs Tiago Pereira

- match_id `1921fc29-2d92-46bf-8044-d665d7357866` · audit_run_id `c2149e8c-9713-459b-a815-69fa868a78d1` · ATP Challenger Seville Round of 16 (Red clay)
- stored: **INSUFFICIENT EVIDENCE** / colour INSUFFICIENT EVIDENCE / independent_winner null
- stage that caused the refusal: **DECISION CORE (family vote)**

| | P1 Genaro Alberto Olivieri | P2 Tiago Pereira |
| --- | --- | --- |
| supporting families | CLOSING_ABILITY, RESULTS_HISTORY | IMPROVEMENT_TREND, LOSS_PROFILE |
| contradicting families | IMPROVEMENT_TREND, LOSS_PROFILE | CLOSING_ABILITY, RESULTS_HISTORY |
| directional share (unrounded) | 40% | 40% |
| reaches 60% | no | no |
| verification: families supporting | CLOSING_ABILITY, RESULTS_HISTORY | IMPROVEMENT_TREND, LOSS_PROFILE |
| verification: metrics not compared — own supply failure / refused on sample floor / supplied-but-unused | 7 / 1 / 7 | 12 / 1 / 2 |
| disagreement: families against this player | IMPROVEMENT_TREND(MAJOR), LOSS_PROFILE(MODERATE) | CLOSING_ABILITY(MAJOR), RESULTS_HISTORY(MAJOR) |
| disagreement: overall severity | CRITICAL | CRITICAL |
| underdog: pathways | FAVORITE_COLLAPSE(STRONG_PATHWAY, 5.5x), COMMON_OPPONENT_ADVANTAGE(STRONG_PATHWAY, 8x), RESULTS_HISTORY_ADVANTAGE(STRONG_PATHWAY, 4.412x) (STRONG_PATHWAY) | COMMON_OPPONENT_ADVANTAGE(STRONG_PATHWAY, 10.267x), IMPROVEMENT_TREND_ADVANTAGE(STRONG_PATHWAY, 7.39x), LOSS_PROFILE_ADVANTAGE(VIABLE_PATHWAY, 3x) (STRONG_PATHWAY) |
| underdog: evaluated by production | false | false |
| stress: support before → after | 40% → 40% | 40% → 40% |
| stress: status | REMOVED | REMOVED |
| stress: outcome when THIS side is stressed | INSUFFICIENT | INSUFFICIENT |
| stress: run by production | true | true |
| stress: families manufactured out of NEUTRAL | — | — |

Conflicted families: COMMON_OPPONENT · neutral: H2H_PROBABILITY, RECENT_FORM · directional denominator: 5

**Stage trace** — family vote `TIE` → threshold `TIE` → leave-one-family-out `TIE` → verification `TIE` → disagreement `TIE` → underdog `TIE` → stress `TIE` → stored `INSUFFICIENT`. Symmetric stress verdict: `NOT_APPLICABLE`.

**Why:** Independent evidence families are level (2 for P1 vs 2 for P2, 1 internally conflicted). Neither player holds a directional advantage, so neither reaches 60%.

> Thin evidence supply: only 10 of 25 active metrics were comparable; 14 never yielded comparable evidence (ONE_SIDED_EVIDENCE x2, TREATMENT_NOT_USABLE x12).

> Dangerous Underdog audit analysed NEITHER player: runUnderdogAnalysis only examines the non-selected side, so a match with no selection gets no underdog analysis for anyone.

> P1/P2 carry no canonical player_id on this match; side identity rests on name and column position alone.

<details><summary>Per-metric evidence (P1 vs P2)</summary>

| code | metric | P1 | P2 | diff | noise floor | ×floor | favours | status | family | P1 treatment | P2 treatment | source |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 001 | Surface Elo | — | — | — | 10 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | SURFACE_STRENGTH | DIRECT | UNAVAILABLE | PredixSport public tennis ratings (CC BY 4.0) |
| 002 | Service point win % | — | — | — | 10 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | UNAVAILABLE | — |
| 003 | Return point win % | — | — | — | 10 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | UNAVAILABLE | — |
| 005 | Last-10 win % | 50 | 50 | 0 | 5 | 0.00 | NEUTRAL | COMPARED | RECENT_FORM | PARTIAL | PARTIAL | TennisMyLife ATP Challenger |
| 006 | Bad-loss rate % | — | — | — | 25 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | LOSS_PROFILE | PARTIAL | UNAVAILABLE | PredixSport public tennis ratings (CC BY 4.0) |
| 007 | Common-opponent win % | 54.55 | 16.67 | 37.88 | 20 | 1.89 | P1 | COMPARED | COMMON_OPPONENT | RECONSTRUCTED | RECONSTRUCTED | TennisMyLife ATP Challenger |
| 008 | Deciding-set win % | — | 31.25 | — | 5 | — | UNAVAILABLE | ONE_SIDED_EVIDENCE | SET_PROFILE | DIRECT | RECONSTRUCTED | PredixSport public tennis ratings (CC BY 4.0) |
| 009 | Pressure point win % | — | — | — | 18 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | DIRECT | UNAVAILABLE | PredixSport public tennis ratings (CC BY 4.0) |
| 010 | Straight-set win % | — | 50 | — | 5 | — | UNAVAILABLE | ONE_SIDED_EVIDENCE | SET_PROFILE | DIRECT | RECONSTRUCTED | PredixSport public tennis ratings (CC BY 4.0) |
| 011 | Match win % | 48.73 | 26.67 | 22.06 | 5 | 4.41 | P1 | COMPARED | RESULTS_HISTORY | RECONSTRUCTED | RECONSTRUCTED | TennisMyLife ATP Challenger |
| 016 | Break-point score-state win % | — | — | — | 24 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | UNAVAILABLE | — |
| 018 | Breakback rate % | — | — | — | 40 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | UNAVAILABLE | — |
| 027 | Lead protection % | 87.5 | 60 | 27.5 | 5 | 5.50 | P1 | COMPARED | CLOSING_ABILITY | RECONSTRUCTED | RECONSTRUCTED | Four-tour static history index (data/generated/tennis-runtime-index.json) |
| 029 | Response after a close set loss, vs own baseline | -21.4 | -8.3 | — | 25 | — | UNAVAILABLE | INSUFFICIENT_SAMPLE | PSYCH_RESPONSE | RECONSTRUCTED | RECONSTRUCTED | Four-tour static history index (data/generated/tennis-runtime-index.json) |
| 031 | Opponent-adjusted set differential | -1.28 | 0.26 | -1.54 | 0.15 | 10.27 | P2 | COMPARED | COMMON_OPPONENT | RECONSTRUCTED | RECONSTRUCTED | Four-tour static history index (data/generated/tennis-runtime-index.json) |
| 032 | Break-point conversion % | — | — | — | 40 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | UNAVAILABLE | — |
| 034 | Dominance ratio | — | — | — | 0.15 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | UNAVAILABLE | — |
| 036 | Losses as favourite % | 45 | 0 | 45 | 15 | 3.00 | P2 | COMPARED | LOSS_PROFILE | RECONSTRUCTED | RECONSTRUCTED | Four-tour static history index (data/generated/tennis-runtime-index.json) |
| 041 | Elo-adjusted surplus, recent vs earlier | -0.239 | 0.5 | -0.739 | 0.1 | 7.39 | P2 | COMPARED | IMPROVEMENT_TREND | RECONSTRUCTED | RECONSTRUCTED | Four-tour static history index (data/generated/tennis-runtime-index.json) |
| 045 | Deciding-set win % as pre-match favourite | — | — | — | 25 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | SET_PROFILE | RECONSTRUCTED | UNAVAILABLE | Four-tour static history index (data/generated/tennis-runtime-index.json) |
| 051 | Opponent-specific win probability % | 50 | 50 | 0 | 3 | 0.00 | NEUTRAL | COMPARED | H2H_PROBABILITY | RECONSTRUCTED | RECONSTRUCTED | Four-tour static history index (data/generated/tennis-runtime-index.json) |
| 053 | Pressure index % | — | — | — | 18 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | UNAVAILABLE | — |
| 055 | Elo change over last 10 | — | — | — | 20 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | RECENT_FORM | PARTIAL | UNAVAILABLE | PredixSport public tennis ratings (CC BY 4.0) |
| 068 | Current win/loss streak (signed match count) | 1 | 1 | 0 | 5 | 0.00 | NEUTRAL | COMPARED | RECENT_FORM | PARTIAL | PARTIAL | TennisMyLife ATP Challenger |
| 080 | Common-opponent net divergent outcomes | 4 | -4 | 8 | 1 | 8.00 | P1 | COMPARED | COMMON_OPPONENT | PARTIAL | PARTIAL | TennisMyLife ATP Challenger |

</details>

## BELOW_THRESHOLD (8)

### Andrey Rublev vs Otto Virtanen

- match_id `89ea44b8-cd47-49ee-a536-aca00bdc8f85` · audit_run_id `03d84c47-c53a-4a81-94f6-0a00ef4d9932` · US Open Round of 128 (Hard)
- stored: **INSUFFICIENT EVIDENCE** / colour INSUFFICIENT EVIDENCE / independent_winner null
- stage that caused the refusal: **DECISION CORE (60% directional threshold)**

| | P1 Andrey Rublev | P2 Otto Virtanen |
| --- | --- | --- |
| supporting families | SURFACE_STRENGTH | IMPROVEMENT_TREND, LOSS_PROFILE |
| contradicting families | IMPROVEMENT_TREND, LOSS_PROFILE | SURFACE_STRENGTH |
| directional share (unrounded) | 20% | 40% |
| reaches 60% | no | no |
| verification: families supporting | SURFACE_STRENGTH | IMPROVEMENT_TREND, LOSS_PROFILE |
| verification: metrics not compared — own supply failure / refused on sample floor / supplied-but-unused | 6 / 1 / 6 | 8 / 1 / 4 |
| disagreement: families against this player | IMPROVEMENT_TREND(MODERATE), LOSS_PROFILE(MINOR) | SURFACE_STRENGTH(CRITICAL) |
| disagreement: overall severity | MAJOR | CRITICAL |
| underdog: pathways | COMMON_OPPONENT_ADVANTAGE(STRONG_PATHWAY, 20x), RECENT_FORM_ADVANTAGE(VIABLE_PATHWAY, 2x), SURFACE_ADVANTAGE(STRONG_PATHWAY, 18.626x) (STRONG_PATHWAY) | COMMON_OPPONENT_ADVANTAGE(STRONG_PATHWAY, 6.6x), IMPROVEMENT_TREND_ADVANTAGE(VIABLE_PATHWAY, 2.36x), LOSS_PROFILE_ADVANTAGE(POTENTIAL_PATHWAY, 1.667x), RECENT_FORM_ADVANTAGE(VIABLE_PATHWAY, 2.745x) (STRONG_PATHWAY) |
| underdog: evaluated by production | false | false |
| stress: support before → after | 20% → 20% | 40% → 25% |
| stress: status | REVERSED | FRAGILE |
| stress: outcome when THIS side is stressed | P2 | INSUFFICIENT |
| stress: run by production | true | true |
| stress: families manufactured out of NEUTRAL | — | — |

Conflicted families: COMMON_OPPONENT, RECENT_FORM · neutral: H2H_PROBABILITY, POINT_BY_POINT · directional denominator: 5

**Stage trace** — family vote `P2` → threshold `INSUFFICIENT` → leave-one-family-out `INSUFFICIENT` → verification `INSUFFICIENT` → disagreement `INSUFFICIENT` → underdog `INSUFFICIENT` → stress `INSUFFICIENT` → stored `INSUFFICIENT`. Symmetric stress verdict: `NOT_APPLICABLE`.

**Why:** P2 leads the family vote but holds only 40.000000% of the directional evidence (2 supporting of 5 directional families, including 2 internally conflicted family/families in the denominator), below the 60% threshold.

> Thin evidence supply: only 12 of 25 active metrics were comparable; 12 never yielded comparable evidence (ONE_SIDED_EVIDENCE x1, TREATMENT_NOT_USABLE x8, VALUE_NOT_PARSEABLE x3).

> Dangerous Underdog audit analysed NEITHER player: runUnderdogAnalysis only examines the non-selected side, so a match with no selection gets no underdog analysis for anyone.

> P1/P2 carry no canonical player_id on this match; side identity rests on name and column position alone.

<details><summary>Per-metric evidence (P1 vs P2)</summary>

| code | metric | P1 | P2 | diff | noise floor | ×floor | favours | status | family | P1 treatment | P2 treatment | source |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 001 | Surface Elo | 1720.53 | 1534.27 | 186.26 | 10 | 18.63 | P1 | COMPARED | SURFACE_STRENGTH | DIRECT | DIRECT | PredixSport public tennis ratings (CC BY 4.0) |
| 002 | Service point win % | — | 59.8291 | — | 10 | — | UNAVAILABLE | ONE_SIDED_EVIDENCE | POINT_BY_POINT | DIRECT | PARTIAL | DataHub ATP World Tour tennis data (CC BY 4.0) |
| 003 | Return point win % | — | — | — | 10 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | DIRECT | UNAVAILABLE | DataHub ATP World Tour tennis data (CC BY 4.0) |
| 005 | Last-10 win % | 50 | 40 | 10 | 5 | 2.00 | P1 | COMPARED | RECENT_FORM | PARTIAL | PARTIAL | runtime:atp_main |
| 006 | Bad-loss rate % | 20 | 0 | — | 25 | — | UNAVAILABLE | INSUFFICIENT_SAMPLE | LOSS_PROFILE | PARTIAL | PARTIAL | PredixSport public tennis ratings (CC BY 4.0) |
| 007 | Common-opponent win % | 100 | 92.31 | 7.69 | 20 | 0.38 | NEUTRAL | COMPARED | COMMON_OPPONENT | RECONSTRUCTED | RECONSTRUCTED | runtime:atp_main |
| 008 | Deciding-set win % | — | — | — | 5 | — | UNAVAILABLE | VALUE_NOT_PARSEABLE | SET_PROFILE | DIRECT | DIRECT | PredixSport public tennis ratings (CC BY 4.0) |
| 009 | Pressure point win % | — | — | — | 18 | — | UNAVAILABLE | VALUE_NOT_PARSEABLE | POINT_BY_POINT | DIRECT | DIRECT | PredixSport public tennis ratings (CC BY 4.0) |
| 010 | Straight-set win % | — | — | — | 5 | — | UNAVAILABLE | VALUE_NOT_PARSEABLE | SET_PROFILE | DIRECT | DIRECT | PredixSport public tennis ratings (CC BY 4.0) |
| 011 | Match win % | — | — | — | 5 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | RESULTS_HISTORY | UNAVAILABLE | UNAVAILABLE | DataHub ATP World Tour tennis data (CC BY 4.0) |
| 016 | Break-point score-state win % | — | — | — | 24 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | UNAVAILABLE | — |
| 018 | Breakback rate % | — | — | — | 40 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | UNAVAILABLE | — |
| 027 | Lead protection % | — | — | — | 5 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | CLOSING_ABILITY | UNAVAILABLE | UNAVAILABLE | — |
| 029 | Response after a close set loss, vs own baseline | — | — | — | 25 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | PSYCH_RESPONSE | UNAVAILABLE | UNAVAILABLE | — |
| 031 | Opponent-adjusted set differential | -0.32999999999999996 | 0.6599999999999999 | -0.99 | 0.15 | 6.60 | P2 | COMPARED | COMMON_OPPONENT | RECONSTRUCTED | RECONSTRUCTED | Four-tour static history index (data/generated/tennis-runtime-index.json) |
| 032 | Break-point conversion % | — | — | — | 40 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | PARTIAL | UNAVAILABLE | BSD/Bzzoiro ATP Main PBP |
| 034 | Dominance ratio | 0.8415 | 0.7956 | 0.0459 | 0.15 | 0.31 | NEUTRAL | COMPARED | POINT_BY_POINT | PARTIAL | PARTIAL | BSD/Bzzoiro ATP Main PBP |
| 036 | Losses as favourite % | 65 | 40 | 25 | 15 | 1.67 | P2 | COMPARED | LOSS_PROFILE | RECONSTRUCTED | RECONSTRUCTED | Four-tour static history index (data/generated/tennis-runtime-index.json) |
| 041 | Elo-adjusted surplus, recent vs earlier | -0.336 | -0.09999999999999999 | -0.236 | 0.1 | 2.36 | P2 | COMPARED | IMPROVEMENT_TREND | RECONSTRUCTED | RECONSTRUCTED | Four-tour static history index (data/generated/tennis-runtime-index.json) |
| 045 | Deciding-set win % as pre-match favourite | — | — | — | 25 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | SET_PROFILE | UNAVAILABLE | UNAVAILABLE | — |
| 051 | Opponent-specific win probability % | 50 | 50 | 0 | 3 | 0.00 | NEUTRAL | COMPARED | H2H_PROBABILITY | RECONSTRUCTED | RECONSTRUCTED | Four-tour static history index (data/generated/tennis-runtime-index.json) |
| 053 | Pressure index % | 57.971 | 56.6667 | 1.3043 | 18 | 0.07 | NEUTRAL | COMPARED | POINT_BY_POINT | PARTIAL | PARTIAL | BSD/Bzzoiro ATP Main PBP |
| 055 | Elo change over last 10 | -43.37 | 11.53 | -54.9 | 20 | 2.75 | P2 | COMPARED | RECENT_FORM | PARTIAL | PARTIAL | PredixSport public tennis ratings (CC BY 4.0) |
| 068 | Current win/loss streak (signed match count) | -1 | -2 | 1 | 5 | 0.20 | NEUTRAL | COMPARED | RECENT_FORM | PARTIAL | PARTIAL | runtime:atp_main |
| 080 | Common-opponent net divergent outcomes | 10 | -10 | 20 | 1 | 20.00 | P1 | COMPARED | COMMON_OPPONENT | PARTIAL | PARTIAL | runtime:atp_main |

</details>

### Matej Dodig vs Mili Poljicak

- match_id `8615d8c7-6d08-48dd-9f27-7f619233391c` · audit_run_id `13d92950-250d-4ff9-9895-af44ee501471` · ATP Challenger Como Round of 32 (Clay)
- stored: **INSUFFICIENT EVIDENCE** / colour INSUFFICIENT EVIDENCE / independent_winner null
- stage that caused the refusal: **DECISION CORE (60% directional threshold)**

| | P1 Matej Dodig | P2 Mili Poljicak |
| --- | --- | --- |
| supporting families | IMPROVEMENT_TREND, RECENT_FORM, RESULTS_HISTORY | CLOSING_ABILITY, H2H_PROBABILITY |
| contradicting families | CLOSING_ABILITY, H2H_PROBABILITY | IMPROVEMENT_TREND, RECENT_FORM, RESULTS_HISTORY |
| directional share (unrounded) | 50% | 33.3333% |
| reaches 60% | no | no |
| verification: families supporting | IMPROVEMENT_TREND, RECENT_FORM, RESULTS_HISTORY | CLOSING_ABILITY, H2H_PROBABILITY |
| verification: metrics not compared — own supply failure / refused on sample floor / supplied-but-unused | 3 / 3 / 3 | 2 / 3 / 4 |
| disagreement: families against this player | CLOSING_ABILITY(MODERATE), H2H_PROBABILITY(MODERATE) | IMPROVEMENT_TREND(MINOR), RECENT_FORM(MAJOR), RESULTS_HISTORY(MINOR) |
| disagreement: overall severity | MAJOR | CRITICAL |
| underdog: pathways | COMMON_OPPONENT_ADVANTAGE(STRONG_PATHWAY, 8x), IMPROVEMENT_TREND_ADVANTAGE(POTENTIAL_PATHWAY, 1.73x), RECENT_FORM_ADVANTAGE(STRONG_PATHWAY, 4x), RESULTS_HISTORY_ADVANTAGE(POTENTIAL_PATHWAY, 1.028x) (STRONG_PATHWAY) | FAVORITE_COLLAPSE(VIABLE_PATHWAY, 3.64x), COMMON_OPPONENT_ADVANTAGE(STRONG_PATHWAY, 6.2x), MATCHUP_TACTICAL_ADVANTAGE(VIABLE_PATHWAY, 3.733x) (STRONG_PATHWAY) |
| underdog: evaluated by production | false | false |
| stress: support before → after | 50% → 25% | 33.3% → 33.3% |
| stress: status | FRAGILE | REMOVED |
| stress: outcome when THIS side is stressed | INSUFFICIENT | INSUFFICIENT |
| stress: run by production | true | true |
| stress: families manufactured out of NEUTRAL | — | — |

Conflicted families: COMMON_OPPONENT · neutral: LOSS_PROFILE, POINT_BY_POINT, SET_PROFILE, SURFACE_STRENGTH · directional denominator: 6

**Stage trace** — family vote `P1` → threshold `INSUFFICIENT` → leave-one-family-out `INSUFFICIENT` → verification `INSUFFICIENT` → disagreement `INSUFFICIENT` → underdog `INSUFFICIENT` → stress `INSUFFICIENT` → stored `INSUFFICIENT`. Symmetric stress verdict: `NOT_APPLICABLE`.

**Why:** P1 leads the family vote but holds only 50.000000% of the directional evidence (3 supporting of 6 directional families, including 1 internally conflicted family/families in the denominator), below the 60% threshold.

> Dangerous Underdog audit analysed NEITHER player: runUnderdogAnalysis only examines the non-selected side, so a match with no selection gets no underdog analysis for anyone.

> P1/P2 carry no canonical player_id on this match; side identity rests on name and column position alone.

<details><summary>Per-metric evidence (P1 vs P2)</summary>

| code | metric | P1 | P2 | diff | noise floor | ×floor | favours | status | family | P1 treatment | P2 treatment | source |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 001 | Surface Elo | 1508.16 | 1508.16 | 0 | 10 | 0.00 | NEUTRAL | COMPARED | SURFACE_STRENGTH | DIRECT | DIRECT | PredixSport public tennis ratings (CC BY 4.0) |
| 002 | Service point win % | 60.7143 | 60.8247 | -0.1104 | 10 | 0.01 | NEUTRAL | COMPARED | POINT_BY_POINT | PARTIAL | PARTIAL | BSD/Bzzoiro ATP Challenger PBP |
| 003 | Return point win % | 34 | 42.7419 | -8.7419 | 10 | 0.87 | NEUTRAL | COMPARED | POINT_BY_POINT | PARTIAL | PARTIAL | BSD/Bzzoiro ATP Challenger PBP |
| 005 | Last-10 win % | 80 | 60 | 20 | 5 | 4.00 | P1 | COMPARED | RECENT_FORM | PARTIAL | PARTIAL | TennisMyLife ATP Challenger |
| 006 | Bad-loss rate % | — | — | — | 25 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | LOSS_PROFILE | UNAVAILABLE | UNAVAILABLE | TennisMyLife ATP Challenger |
| 007 | Common-opponent win % | 56 | 33.33 | 22.67 | 20 | 1.13 | P1 | COMPARED | COMMON_OPPONENT | RECONSTRUCTED | RECONSTRUCTED | TennisMyLife ATP Challenger |
| 008 | Deciding-set win % | — | — | — | 5 | — | UNAVAILABLE | VALUE_NOT_PARSEABLE | SET_PROFILE | DIRECT | DIRECT | PredixSport public tennis ratings (CC BY 4.0) |
| 009 | Pressure point win % | — | — | — | 18 | — | UNAVAILABLE | VALUE_NOT_PARSEABLE | POINT_BY_POINT | DIRECT | DIRECT | PredixSport public tennis ratings (CC BY 4.0) |
| 010 | Straight-set win % | — | — | — | 5 | — | UNAVAILABLE | VALUE_NOT_PARSEABLE | SET_PROFILE | DIRECT | DIRECT | PredixSport public tennis ratings (CC BY 4.0) |
| 011 | Match win % | 51.89 | 46.75 | 5.14 | 5 | 1.03 | P1 | COMPARED | RESULTS_HISTORY | RECONSTRUCTED | RECONSTRUCTED | TennisMyLife ATP Challenger |
| 016 | Break-point score-state win % | — | — | — | 24 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | PARTIAL | BSD/Bzzoiro ATP Challenger PBP |
| 018 | Breakback rate % | — | — | — | 40 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | UNAVAILABLE | BSD/Bzzoiro ATP Challenger PBP |
| 027 | Lead protection % | 81.8 | 100 | -18.2 | 5 | 3.64 | P2 | COMPARED | CLOSING_ABILITY | RECONSTRUCTED | RECONSTRUCTED | Four-tour static history index (data/generated/tennis-runtime-index.json) |
| 029 | Response after a close set loss, vs own baseline | -45.7 | -31.700000000000003 | — | 25 | — | UNAVAILABLE | INSUFFICIENT_SAMPLE | PSYCH_RESPONSE | RECONSTRUCTED | RECONSTRUCTED | Four-tour static history index (data/generated/tennis-runtime-index.json) |
| 031 | Opponent-adjusted set differential | -0.45999999999999996 | 0.47000000000000003 | -0.93 | 0.15 | 6.20 | P2 | COMPARED | COMMON_OPPONENT | RECONSTRUCTED | RECONSTRUCTED | Four-tour static history index (data/generated/tennis-runtime-index.json) |
| 032 | Break-point conversion % | 0 | 0 | — | 40 | — | UNAVAILABLE | INSUFFICIENT_SAMPLE | POINT_BY_POINT | PARTIAL | PARTIAL | BSD/Bzzoiro ATP Challenger PBP |
| 034 | Dominance ratio | 1.238 | 1.091 | 0.147 | 0.15 | 0.98 | NEUTRAL | COMPARED | POINT_BY_POINT | PARTIAL | PARTIAL | BSD/Bzzoiro ATP Challenger PBP |
| 036 | Losses as favourite % | 50 | 50 | 0 | 15 | 0.00 | NEUTRAL | COMPARED | LOSS_PROFILE | RECONSTRUCTED | RECONSTRUCTED | Four-tour static history index (data/generated/tennis-runtime-index.json) |
| 041 | Elo-adjusted surplus, recent vs earlier | 0.15699999999999997 | -0.016000000000000014 | 0.173 | 0.1 | 1.73 | P1 | COMPARED | IMPROVEMENT_TREND | RECONSTRUCTED | RECONSTRUCTED | Four-tour static history index (data/generated/tennis-runtime-index.json) |
| 045 | Deciding-set win % as pre-match favourite | 57.7 | 50 | 7.7 | 25 | 0.31 | NEUTRAL | COMPARED | SET_PROFILE | RECONSTRUCTED | RECONSTRUCTED | Four-tour static history index (data/generated/tennis-runtime-index.json) |
| 051 | Opponent-specific win probability % | 44.4 | 55.6 | -11.2 | 3 | 3.73 | P2 | COMPARED | H2H_PROBABILITY | RECONSTRUCTED | RECONSTRUCTED | Four-tour static history index (data/generated/tennis-runtime-index.json) |
| 053 | Pressure index % | 15.7895 | 38.4615 | — | 18 | — | UNAVAILABLE | INSUFFICIENT_SAMPLE | POINT_BY_POINT | PARTIAL | PARTIAL | BSD/Bzzoiro ATP Challenger PBP |
| 055 | Elo change over last 10 | 16.3 | 17.2 | -0.9 | 20 | 0.04 | NEUTRAL | COMPARED | RECENT_FORM | PARTIAL | PARTIAL | PredixSport public tennis ratings (CC BY 4.0) |
| 068 | Current win/loss streak (signed match count) | 3 | 4 | -1 | 5 | 0.20 | NEUTRAL | COMPARED | RECENT_FORM | PARTIAL | PARTIAL | TennisMyLife ATP Challenger |
| 080 | Common-opponent net divergent outcomes | 4 | -4 | 8 | 1 | 8.00 | P1 | COMPARED | COMMON_OPPONENT | PARTIAL | PARTIAL | TennisMyLife ATP Challenger |

</details>

### Andrey Chepelev vs Fausto Tabacco

- match_id `6172adaa-c428-4bf7-bb66-005b8c684dde` · audit_run_id `62cf6158-a25d-4a46-8ace-61a80a7e80c1` · ATP Challenger Como Round of 32 (Clay)
- stored: **INSUFFICIENT EVIDENCE** / colour INSUFFICIENT EVIDENCE / independent_winner null
- stage that caused the refusal: **DECISION CORE (60% directional threshold)**

| | P1 Andrey Chepelev | P2 Fausto Tabacco |
| --- | --- | --- |
| supporting families | CLOSING_ABILITY, RECENT_FORM, RESULTS_HISTORY | SURFACE_STRENGTH |
| contradicting families | SURFACE_STRENGTH | CLOSING_ABILITY, RECENT_FORM, RESULTS_HISTORY |
| directional share (unrounded) | 50% | 16.6667% |
| reaches 60% | no | no |
| verification: families supporting | CLOSING_ABILITY, RECENT_FORM, RESULTS_HISTORY | SURFACE_STRENGTH |
| verification: metrics not compared — own supply failure / refused on sample floor / supplied-but-unused | 10 / 5 / 0 | 10 / 5 / 0 |
| disagreement: families against this player | SURFACE_STRENGTH(MINOR) | CLOSING_ABILITY(MAJOR), RECENT_FORM(MINOR), RESULTS_HISTORY(MODERATE) |
| disagreement: overall severity | MINOR | CRITICAL |
| underdog: pathways | FAVORITE_COLLAPSE(STRONG_PATHWAY, 5x), COMMON_OPPONENT_ADVANTAGE(VIABLE_PATHWAY, 2x), RECENT_FORM_ADVANTAGE(POTENTIAL_PATHWAY, 1.142x), RESULTS_HISTORY_ADVANTAGE(VIABLE_PATHWAY, 2.856x), DECIDING_SET_PATHWAY(STRONG_PATHWAY, 10x) (STRONG_PATHWAY) | COMMON_OPPONENT_ADVANTAGE(STRONG_PATHWAY, 13.333x), DECIDING_SET_PATHWAY(STRONG_PATHWAY, 13.334x), SURFACE_ADVANTAGE(POTENTIAL_PATHWAY, 1.3x) (STRONG_PATHWAY) |
| underdog: evaluated by production | false | false |
| stress: support before → after | 50% → 40% | 16.7% → 0% |
| stress: status | FRAGILE | REVERSED |
| stress: outcome when THIS side is stressed | INSUFFICIENT | P1 |
| stress: run by production | true | true |
| stress: families manufactured out of NEUTRAL | — | — |

Conflicted families: COMMON_OPPONENT, SET_PROFILE · neutral: H2H_PROBABILITY, IMPROVEMENT_TREND · directional denominator: 6

**Stage trace** — family vote `P1` → threshold `INSUFFICIENT` → leave-one-family-out `INSUFFICIENT` → verification `INSUFFICIENT` → disagreement `INSUFFICIENT` → underdog `INSUFFICIENT` → stress `INSUFFICIENT` → stored `INSUFFICIENT`. Symmetric stress verdict: `NOT_APPLICABLE`.

**Why:** P1 leads the family vote but holds only 50.000000% of the directional evidence (3 supporting of 6 directional families, including 2 internally conflicted family/families in the denominator), below the 60% threshold.

> Thin evidence supply: only 10 of 25 active metrics were comparable; 10 never yielded comparable evidence (TREATMENT_NOT_USABLE x10).

> Dangerous Underdog audit analysed NEITHER player: runUnderdogAnalysis only examines the non-selected side, so a match with no selection gets no underdog analysis for anyone.

> P1/P2 carry no canonical player_id on this match; side identity rests on name and column position alone.

<details><summary>Per-metric evidence (P1 vs P2)</summary>

| code | metric | P1 | P2 | diff | noise floor | ×floor | favours | status | family | P1 treatment | P2 treatment | source |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 001 | Surface Elo | 1429 | 1442 | -13 | 10 | 1.30 | P2 | COMPARED | SURFACE_STRENGTH | RECONSTRUCTED | RECONSTRUCTED | TennisMyLife ATP Challenger |
| 002 | Service point win % | — | — | — | 10 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | UNAVAILABLE | — |
| 003 | Return point win % | — | — | — | 10 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | UNAVAILABLE | — |
| 005 | Last-10 win % | 20 | 14.29 | 5.71 | 5 | 1.14 | P1 | COMPARED | RECENT_FORM | PARTIAL | PARTIAL | TennisMyLife ATP Challenger |
| 006 | Bad-loss rate % | — | — | — | 25 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | LOSS_PROFILE | UNAVAILABLE | UNAVAILABLE | — |
| 007 | Common-opponent win % | 50 | 0 | — | 20 | — | UNAVAILABLE | INSUFFICIENT_SAMPLE | COMMON_OPPONENT | RECONSTRUCTED | RECONSTRUCTED | TennisMyLife ATP Challenger |
| 008 | Deciding-set win % | 50 | 0 | 50 | 5 | 10.00 | P1 | COMPARED | SET_PROFILE | RECONSTRUCTED | RECONSTRUCTED | TennisMyLife ATP Challenger |
| 009 | Pressure point win % | — | — | — | 18 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | UNAVAILABLE | — |
| 010 | Straight-set win % | 33.33 | 100 | -66.67 | 5 | 13.33 | P2 | COMPARED | SET_PROFILE | RECONSTRUCTED | RECONSTRUCTED | TennisMyLife ATP Challenger |
| 011 | Match win % | 28.57 | 14.29 | 14.28 | 5 | 2.86 | P1 | COMPARED | RESULTS_HISTORY | RECONSTRUCTED | RECONSTRUCTED | TennisMyLife ATP Challenger |
| 016 | Break-point score-state win % | — | — | — | 24 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | UNAVAILABLE | — |
| 018 | Breakback rate % | — | — | — | 40 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | UNAVAILABLE | — |
| 027 | Lead protection % | 75 | 50 | 25 | 5 | 5.00 | P1 | COMPARED | CLOSING_ABILITY | RECONSTRUCTED | RECONSTRUCTED | Four-tour static history index (data/generated/tennis-runtime-index.json) |
| 029 | Response after a close set loss, vs own baseline | -10.7 | -14.3 | — | 25 | — | UNAVAILABLE | INSUFFICIENT_SAMPLE | PSYCH_RESPONSE | RECONSTRUCTED | RECONSTRUCTED | Four-tour static history index (data/generated/tennis-runtime-index.json) |
| 031 | Opponent-adjusted set differential | -2 | 0 | -2 | 0.15 | 13.33 | P2 | COMPARED | COMMON_OPPONENT | RECONSTRUCTED | RECONSTRUCTED | Four-tour static history index (data/generated/tennis-runtime-index.json) |
| 032 | Break-point conversion % | — | — | — | 40 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | UNAVAILABLE | — |
| 034 | Dominance ratio | — | — | — | 0.15 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | UNAVAILABLE | — |
| 036 | Losses as favourite % | 13.3 | 16.7 | — | 15 | — | UNAVAILABLE | INSUFFICIENT_SAMPLE | LOSS_PROFILE | RECONSTRUCTED | RECONSTRUCTED | Four-tour static history index (data/generated/tennis-runtime-index.json) |
| 041 | Elo-adjusted surplus, recent vs earlier | -0.23699999999999996 | -0.335 | 0.098 | 0.1 | 0.98 | NEUTRAL | COMPARED | IMPROVEMENT_TREND | RECONSTRUCTED | RECONSTRUCTED | Four-tour static history index (data/generated/tennis-runtime-index.json) |
| 045 | Deciding-set win % as pre-match favourite | 100 | 0 | — | 25 | — | UNAVAILABLE | INSUFFICIENT_SAMPLE | SET_PROFILE | RECONSTRUCTED | RECONSTRUCTED | Four-tour static history index (data/generated/tennis-runtime-index.json) |
| 051 | Opponent-specific win probability % | 50 | 50 | 0 | 3 | 0.00 | NEUTRAL | COMPARED | H2H_PROBABILITY | RECONSTRUCTED | RECONSTRUCTED | Four-tour static history index (data/generated/tennis-runtime-index.json) |
| 053 | Pressure index % | — | — | — | 18 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | UNAVAILABLE | — |
| 055 | Elo change over last 10 | — | — | — | 20 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | RECENT_FORM | UNAVAILABLE | UNAVAILABLE | — |
| 068 | Current win/loss streak (signed match count) | -5 | -4 | — | 5 | — | UNAVAILABLE | INSUFFICIENT_SAMPLE | RECENT_FORM | PARTIAL | PARTIAL | TennisMyLife ATP Challenger |
| 080 | Common-opponent net divergent outcomes | 1 | -1 | 2 | 1 | 2.00 | P1 | COMPARED | COMMON_OPPONENT | PARTIAL | PARTIAL | TennisMyLife ATP Challenger |

</details>

### Marek Gengel vs Alex Hernandez

- match_id `99fe59a5-afe0-48d7-8a29-6b145d686c22` · audit_run_id `68dfb16b-7ee7-4798-a92d-6fab19f89098` · ATP Challenger Manacor Qualifying Round 1 (Hard)
- stored: **INSUFFICIENT EVIDENCE** / colour INSUFFICIENT EVIDENCE / independent_winner null
- stage that caused the refusal: **DECISION CORE (60% directional threshold)**

| | P1 Marek Gengel | P2 Alex Hernandez |
| --- | --- | --- |
| supporting families | IMPROVEMENT_TREND, RESULTS_HISTORY | COMMON_OPPONENT, PSYCH_RESPONSE, SURFACE_STRENGTH |
| contradicting families | COMMON_OPPONENT, PSYCH_RESPONSE, SURFACE_STRENGTH | IMPROVEMENT_TREND, RESULTS_HISTORY |
| directional share (unrounded) | 33.3333% | 50% |
| reaches 60% | no | no |
| verification: families supporting | IMPROVEMENT_TREND, RESULTS_HISTORY | COMMON_OPPONENT, PSYCH_RESPONSE, SURFACE_STRENGTH |
| verification: metrics not compared — own supply failure / refused on sample floor / supplied-but-unused | 4 / 4 / 3 | 3 / 4 / 4 |
| disagreement: families against this player | COMMON_OPPONENT(MODERATE), PSYCH_RESPONSE(MINOR), SURFACE_STRENGTH(MINOR) | IMPROVEMENT_TREND(MODERATE), RESULTS_HISTORY(MODERATE) |
| disagreement: overall severity | CRITICAL | MAJOR |
| underdog: pathways | IMPROVEMENT_TREND_ADVANTAGE(VIABLE_PATHWAY, 2.01x), RECENT_FORM_ADVANTAGE(STRONG_PATHWAY, 6x), RESULTS_HISTORY_ADVANTAGE(VIABLE_PATHWAY, 2.16x) (STRONG_PATHWAY) | COMMON_OPPONENT_ADVANTAGE(VIABLE_PATHWAY, 3.267x), PSYCH_RESPONSE_ADVANTAGE(POTENTIAL_PATHWAY, 1.132x), RECENT_FORM_ADVANTAGE(POTENTIAL_PATHWAY, 1.219x), SURFACE_ADVANTAGE(POTENTIAL_PATHWAY, 1.244x) (STRONG_PATHWAY) |
| underdog: evaluated by production | false | false |
| stress: support before → after | 33.3% → 33.3% | 50% → 25% |
| stress: status | REMOVED | REVERSED |
| stress: outcome when THIS side is stressed | INSUFFICIENT | P1 |
| stress: run by production | true | true |
| stress: families manufactured out of NEUTRAL | — | — |

Conflicted families: RECENT_FORM · neutral: CLOSING_ABILITY, H2H_PROBABILITY, LOSS_PROFILE, POINT_BY_POINT · directional denominator: 6

**Stage trace** — family vote `P2` → threshold `INSUFFICIENT` → leave-one-family-out `INSUFFICIENT` → verification `INSUFFICIENT` → disagreement `INSUFFICIENT` → underdog `INSUFFICIENT` → stress `INSUFFICIENT` → stored `INSUFFICIENT`. Symmetric stress verdict: `NOT_APPLICABLE`.

**Why:** P2 leads the family vote but holds only 50.000000% of the directional evidence (3 supporting of 6 directional families, including 1 internally conflicted family/families in the denominator), below the 60% threshold.

> Dangerous Underdog audit analysed NEITHER player: runUnderdogAnalysis only examines the non-selected side, so a match with no selection gets no underdog analysis for anyone.

> P1/P2 carry no canonical player_id on this match; side identity rests on name and column position alone.

<details><summary>Per-metric evidence (P1 vs P2)</summary>

| code | metric | P1 | P2 | diff | noise floor | ×floor | favours | status | family | P1 treatment | P2 treatment | source |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 001 | Surface Elo | 1486.47 | 1498.91 | -12.44 | 10 | 1.24 | P2 | COMPARED | SURFACE_STRENGTH | DIRECT | DIRECT | PredixSport public tennis ratings (CC BY 4.0) |
| 002 | Service point win % | — | — | — | 10 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | UNAVAILABLE | — |
| 003 | Return point win % | — | — | — | 10 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | UNAVAILABLE | — |
| 005 | Last-10 win % | 70 | 40 | 30 | 5 | 6.00 | P1 | COMPARED | RECENT_FORM | PARTIAL | PARTIAL | TennisMyLife ATP Challenger |
| 006 | Bad-loss rate % | 0 | 0 | — | 25 | — | UNAVAILABLE | INSUFFICIENT_SAMPLE | LOSS_PROFILE | PARTIAL | PARTIAL | PredixSport public tennis ratings (CC BY 4.0) |
| 007 | Common-opponent win % | 20 | 16.67 | — | 20 | — | UNAVAILABLE | INSUFFICIENT_SAMPLE | COMMON_OPPONENT | RECONSTRUCTED | RECONSTRUCTED | TennisMyLife ATP Challenger |
| 008 | Deciding-set win % | — | — | — | 5 | — | UNAVAILABLE | VALUE_NOT_PARSEABLE | SET_PROFILE | DIRECT | DIRECT | PredixSport public tennis ratings (CC BY 4.0) |
| 009 | Pressure point win % | — | — | — | 18 | — | UNAVAILABLE | VALUE_NOT_PARSEABLE | POINT_BY_POINT | DIRECT | DIRECT | PredixSport public tennis ratings (CC BY 4.0) |
| 010 | Straight-set win % | — | — | — | 5 | — | UNAVAILABLE | VALUE_NOT_PARSEABLE | SET_PROFILE | DIRECT | DIRECT | PredixSport public tennis ratings (CC BY 4.0) |
| 011 | Match win % | 42.17 | 31.37 | 10.8 | 5 | 2.16 | P1 | COMPARED | RESULTS_HISTORY | RECONSTRUCTED | RECONSTRUCTED | TennisMyLife ATP Challenger |
| 016 | Break-point score-state win % | — | — | — | 24 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | UNAVAILABLE | — |
| 018 | Breakback rate % | — | — | — | 40 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | RECONSTRUCTED | BSD/Bzzoiro ATP Challenger PBP |
| 027 | Lead protection % | 85.7 | 83.3 | 2.4 | 5 | 0.48 | NEUTRAL | COMPARED | CLOSING_ABILITY | RECONSTRUCTED | RECONSTRUCTED | Four-tour static history index (data/generated/tennis-runtime-index.json) |
| 029 | Response after a close set loss, vs own baseline | -30 | -1.7000000000000028 | -28.3 | 25 | 1.13 | P2 | COMPARED | PSYCH_RESPONSE | RECONSTRUCTED | RECONSTRUCTED | Four-tour static history index (data/generated/tennis-runtime-index.json) |
| 031 | Opponent-adjusted set differential | -1.44 | -0.95 | -0.49 | 0.15 | 3.27 | P2 | COMPARED | COMMON_OPPONENT | RECONSTRUCTED | RECONSTRUCTED | Four-tour static history index (data/generated/tennis-runtime-index.json) |
| 032 | Break-point conversion % | 0 | 0 | — | 40 | — | UNAVAILABLE | INSUFFICIENT_SAMPLE | POINT_BY_POINT | PARTIAL | PARTIAL | BSD/Bzzoiro ATP Challenger PBP |
| 034 | Dominance ratio | 0.9819 | 0.9382 | 0.0437 | 0.15 | 0.29 | NEUTRAL | COMPARED | POINT_BY_POINT | PARTIAL | PARTIAL | BSD/Bzzoiro ATP Challenger PBP |
| 036 | Losses as favourite % | 15 | 0 | 15 | 15 | 1.00 | NEUTRAL | COMPARED | LOSS_PROFILE | RECONSTRUCTED | RECONSTRUCTED | Four-tour static history index (data/generated/tennis-runtime-index.json) |
| 041 | Elo-adjusted surplus, recent vs earlier | 0.082 | -0.119 | 0.201 | 0.1 | 2.01 | P1 | COMPARED | IMPROVEMENT_TREND | RECONSTRUCTED | RECONSTRUCTED | Four-tour static history index (data/generated/tennis-runtime-index.json) |
| 045 | Deciding-set win % as pre-match favourite | 50 | 0 | — | 25 | — | UNAVAILABLE | INSUFFICIENT_SAMPLE | SET_PROFILE | RECONSTRUCTED | RECONSTRUCTED | Four-tour static history index (data/generated/tennis-runtime-index.json) |
| 051 | Opponent-specific win probability % | 50 | 50 | 0 | 3 | 0.00 | NEUTRAL | COMPARED | H2H_PROBABILITY | RECONSTRUCTED | RECONSTRUCTED | Four-tour static history index (data/generated/tennis-runtime-index.json) |
| 053 | Pressure index % | 42.8571 | 54.1667 | -11.3096 | 18 | 0.63 | NEUTRAL | COMPARED | POINT_BY_POINT | PARTIAL | PARTIAL | BSD/Bzzoiro ATP Challenger PBP |
| 055 | Elo change over last 10 | -14.37 | 10 | -24.37 | 20 | 1.22 | P2 | COMPARED | RECENT_FORM | PARTIAL | PARTIAL | PredixSport public tennis ratings (CC BY 4.0) |
| 068 | Current win/loss streak (signed match count) | 1 | -4 | 5 | 5 | 1.00 | NEUTRAL | COMPARED | RECENT_FORM | PARTIAL | PARTIAL | TennisMyLife ATP Challenger |
| 080 | Common-opponent net divergent outcomes | 0 | 0 | 0 | 1 | 0.00 | NEUTRAL | COMPARED | COMMON_OPPONENT | PARTIAL | PARTIAL | TennisMyLife ATP Challenger |

</details>

### Matteo Berrettini vs Stan Wawrinka

- match_id `5f463d9f-5236-4aef-9c48-3d40b11eb5ed` · audit_run_id `7cce4393-e7aa-4a9f-9030-137892be4684` · US Open Round of 128 (Hard)
- stored: **INSUFFICIENT EVIDENCE** / colour INSUFFICIENT EVIDENCE / independent_winner null
- stage that caused the refusal: **DECISION CORE (60% directional threshold)**

| | P1 Matteo Berrettini | P2 Stan Wawrinka |
| --- | --- | --- |
| supporting families | RECENT_FORM, SURFACE_STRENGTH | LOSS_PROFILE |
| contradicting families | LOSS_PROFILE | RECENT_FORM, SURFACE_STRENGTH |
| directional share (unrounded) | 50% | 25% |
| reaches 60% | no | no |
| verification: families supporting | RECENT_FORM, SURFACE_STRENGTH | LOSS_PROFILE |
| verification: metrics not compared — own supply failure / refused on sample floor / supplied-but-unused | 9 / 1 / 5 | 9 / 1 / 5 |
| disagreement: families against this player | LOSS_PROFILE(MODERATE) | RECENT_FORM(MODERATE), SURFACE_STRENGTH(MINOR) |
| disagreement: overall severity | MODERATE | MAJOR |
| underdog: pathways | COMMON_OPPONENT_ADVANTAGE(STRONG_PATHWAY, 34x), RECENT_FORM_ADVANTAGE(VIABLE_PATHWAY, 3.556x), SURFACE_ADVANTAGE(POTENTIAL_PATHWAY, 1.564x) (STRONG_PATHWAY) | COMMON_OPPONENT_ADVANTAGE(VIABLE_PATHWAY, 3.733x), LOSS_PROFILE_ADVANTAGE(VIABLE_PATHWAY, 3x) (STRONG_PATHWAY) |
| underdog: evaluated by production | false | false |
| stress: support before → after | 50% → 33.3% | 25% → 25% |
| stress: status | FRAGILE | REMOVED |
| stress: outcome when THIS side is stressed | INSUFFICIENT | INSUFFICIENT |
| stress: run by production | true | true |
| stress: families manufactured out of NEUTRAL | — | — |

Conflicted families: COMMON_OPPONENT · neutral: H2H_PROBABILITY, IMPROVEMENT_TREND · directional denominator: 4

**Stage trace** — family vote `P1` → threshold `INSUFFICIENT` → leave-one-family-out `INSUFFICIENT` → verification `INSUFFICIENT` → disagreement `INSUFFICIENT` → underdog `INSUFFICIENT` → stress `INSUFFICIENT` → stored `INSUFFICIENT`. Symmetric stress verdict: `NOT_APPLICABLE`.

**Why:** P1 leads the family vote but holds only 50.000000% of the directional evidence (2 supporting of 4 directional families, including 1 internally conflicted family/families in the denominator), below the 60% threshold.

> Thin evidence supply: only 10 of 25 active metrics were comparable; 14 never yielded comparable evidence (TREATMENT_NOT_USABLE x9, VALUE_NOT_PARSEABLE x5).

> Dangerous Underdog audit analysed NEITHER player: runUnderdogAnalysis only examines the non-selected side, so a match with no selection gets no underdog analysis for anyone.

> P1/P2 carry no canonical player_id on this match; side identity rests on name and column position alone.

<details><summary>Per-metric evidence (P1 vs P2)</summary>

| code | metric | P1 | P2 | diff | noise floor | ×floor | favours | status | family | P1 treatment | P2 treatment | source |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 001 | Surface Elo | 1650.84 | 1635.2 | 15.64 | 10 | 1.56 | P1 | COMPARED | SURFACE_STRENGTH | DIRECT | DIRECT | PredixSport public tennis ratings (CC BY 4.0) |
| 002 | Service point win % | — | — | — | 10 | — | UNAVAILABLE | VALUE_NOT_PARSEABLE | POINT_BY_POINT | DIRECT | DIRECT | DataHub ATP World Tour tennis data (CC BY 4.0) |
| 003 | Return point win % | — | — | — | 10 | — | UNAVAILABLE | VALUE_NOT_PARSEABLE | POINT_BY_POINT | DIRECT | DIRECT | DataHub ATP World Tour tennis data (CC BY 4.0) |
| 005 | Last-10 win % | 50 | 50 | 0 | 5 | 0.00 | NEUTRAL | COMPARED | RECENT_FORM | PARTIAL | PARTIAL | runtime:atp_main |
| 006 | Bad-loss rate % | 0 | 16.67 | — | 25 | — | UNAVAILABLE | INSUFFICIENT_SAMPLE | LOSS_PROFILE | PARTIAL | PARTIAL | PredixSport public tennis ratings (CC BY 4.0) |
| 007 | Common-opponent win % | 97.67 | 100 | -2.33 | 20 | 0.12 | NEUTRAL | COMPARED | COMMON_OPPONENT | RECONSTRUCTED | RECONSTRUCTED | runtime:atp_main |
| 008 | Deciding-set win % | — | — | — | 5 | — | UNAVAILABLE | VALUE_NOT_PARSEABLE | SET_PROFILE | DIRECT | DIRECT | PredixSport public tennis ratings (CC BY 4.0) |
| 009 | Pressure point win % | — | — | — | 18 | — | UNAVAILABLE | VALUE_NOT_PARSEABLE | POINT_BY_POINT | DIRECT | DIRECT | PredixSport public tennis ratings (CC BY 4.0) |
| 010 | Straight-set win % | — | — | — | 5 | — | UNAVAILABLE | VALUE_NOT_PARSEABLE | SET_PROFILE | DIRECT | DIRECT | PredixSport public tennis ratings (CC BY 4.0) |
| 011 | Match win % | — | — | — | 5 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | RESULTS_HISTORY | UNAVAILABLE | UNAVAILABLE | DataHub ATP World Tour tennis data (CC BY 4.0) |
| 016 | Break-point score-state win % | — | — | — | 24 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | UNAVAILABLE | — |
| 018 | Breakback rate % | — | — | — | 40 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | UNAVAILABLE | — |
| 027 | Lead protection % | — | — | — | 5 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | CLOSING_ABILITY | UNAVAILABLE | UNAVAILABLE | — |
| 029 | Response after a close set loss, vs own baseline | — | — | — | 25 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | PSYCH_RESPONSE | UNAVAILABLE | UNAVAILABLE | — |
| 031 | Opponent-adjusted set differential | 0.16 | 0.72 | -0.56 | 0.15 | 3.73 | P2 | COMPARED | COMMON_OPPONENT | RECONSTRUCTED | RECONSTRUCTED | Four-tour static history index (data/generated/tennis-runtime-index.json) |
| 032 | Break-point conversion % | — | — | — | 40 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | UNAVAILABLE | — |
| 034 | Dominance ratio | — | — | — | 0.15 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | UNAVAILABLE | — |
| 036 | Losses as favourite % | 65 | 20 | 45 | 15 | 3.00 | P2 | COMPARED | LOSS_PROFILE | RECONSTRUCTED | RECONSTRUCTED | Four-tour static history index (data/generated/tennis-runtime-index.json) |
| 041 | Elo-adjusted surplus, recent vs earlier | 0.012999999999999998 | 0.029 | -0.016 | 0.1 | 0.16 | NEUTRAL | COMPARED | IMPROVEMENT_TREND | RECONSTRUCTED | RECONSTRUCTED | Four-tour static history index (data/generated/tennis-runtime-index.json) |
| 045 | Deciding-set win % as pre-match favourite | — | — | — | 25 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | SET_PROFILE | UNAVAILABLE | UNAVAILABLE | — |
| 051 | Opponent-specific win probability % | 50 | 50 | 0 | 3 | 0.00 | NEUTRAL | COMPARED | H2H_PROBABILITY | RECONSTRUCTED | RECONSTRUCTED | Four-tour static history index (data/generated/tennis-runtime-index.json) |
| 053 | Pressure index % | — | — | — | 18 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | UNAVAILABLE | — |
| 055 | Elo change over last 10 | 32.71 | -38.41 | 71.12 | 20 | 3.56 | P1 | COMPARED | RECENT_FORM | PARTIAL | PARTIAL | PredixSport public tennis ratings (CC BY 4.0) |
| 068 | Current win/loss streak (signed match count) | -2 | 1 | -3 | 5 | 0.60 | NEUTRAL | COMPARED | RECENT_FORM | PARTIAL | PARTIAL | runtime:atp_main |
| 080 | Common-opponent net divergent outcomes | 17 | -17 | 34 | 1 | 34.00 | P1 | COMPARED | COMMON_OPPONENT | PARTIAL | PARTIAL | runtime:atp_main |

</details>

### Novak Djokovic vs Mariano Navone

- match_id `d127804d-156c-433a-b342-1d6c16c92d07` · audit_run_id `8c2baea7-49ea-4ce6-971e-484f678efb40` · US Open Round of 128 (Hard)
- stored: **INSUFFICIENT EVIDENCE** / colour INSUFFICIENT EVIDENCE / independent_winner null
- stage that caused the refusal: **DECISION CORE (60% directional threshold)**

| | P1 Novak Djokovic | P2 Mariano Navone |
| --- | --- | --- |
| supporting families | SURFACE_STRENGTH | IMPROVEMENT_TREND, LOSS_PROFILE, RECENT_FORM |
| contradicting families | IMPROVEMENT_TREND, LOSS_PROFILE, RECENT_FORM | SURFACE_STRENGTH |
| directional share (unrounded) | 16.6667% | 50% |
| reaches 60% | no | no |
| verification: families supporting | SURFACE_STRENGTH | IMPROVEMENT_TREND, LOSS_PROFILE, RECENT_FORM |
| verification: metrics not compared — own supply failure / refused on sample floor / supplied-but-unused | 5 / 3 / 5 | 4 / 3 / 6 |
| disagreement: families against this player | IMPROVEMENT_TREND(MODERATE), LOSS_PROFILE(MODERATE), RECENT_FORM(MAJOR) | SURFACE_STRENGTH(CRITICAL) |
| disagreement: overall severity | CRITICAL | CRITICAL |
| underdog: pathways | COMMON_OPPONENT_ADVANTAGE(STRONG_PATHWAY, 52x), POINT_BY_POINT_ADVANTAGE(VIABLE_PATHWAY, 2.163x), SURFACE_ADVANTAGE(STRONG_PATHWAY, 60.183x) (STRONG_PATHWAY) | COMMON_OPPONENT_ADVANTAGE(STRONG_PATHWAY, 13.733x), IMPROVEMENT_TREND_ADVANTAGE(VIABLE_PATHWAY, 3.06x), LOSS_PROFILE_ADVANTAGE(VIABLE_PATHWAY, 3x), POINT_BY_POINT_ADVANTAGE(POTENTIAL_PATHWAY, 1.073x), RECENT_FORM_ADVANTAGE(STRONG_PATHWAY, 4.002x) (STRONG_PATHWAY) |
| underdog: evaluated by production | false | false |
| stress: support before → after | 16.7% → 16.7% | 50% → 50% |
| stress: status | REMOVED | REMOVED |
| stress: outcome when THIS side is stressed | INSUFFICIENT | INSUFFICIENT |
| stress: run by production | true | true |
| stress: families manufactured out of NEUTRAL | — | — |

Conflicted families: COMMON_OPPONENT, POINT_BY_POINT · neutral: H2H_PROBABILITY · directional denominator: 6

**Stage trace** — family vote `P2` → threshold `INSUFFICIENT` → leave-one-family-out `INSUFFICIENT` → verification `INSUFFICIENT` → disagreement `INSUFFICIENT` → underdog `INSUFFICIENT` → stress `INSUFFICIENT` → stored `INSUFFICIENT`. Symmetric stress verdict: `NOT_APPLICABLE`.

**Why:** P2 leads the family vote but holds only 50.000000% of the directional evidence (3 supporting of 6 directional families, including 2 internally conflicted family/families in the denominator), below the 60% threshold.

> Dangerous Underdog audit analysed NEITHER player: runUnderdogAnalysis only examines the non-selected side, so a match with no selection gets no underdog analysis for anyone.

> P1/P2 carry no canonical player_id on this match; side identity rests on name and column position alone.

<details><summary>Per-metric evidence (P1 vs P2)</summary>

| code | metric | P1 | P2 | diff | noise floor | ×floor | favours | status | family | P1 treatment | P2 treatment | source |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 001 | Surface Elo | 2118.26 | 1516.43 | 601.83 | 10 | 60.18 | P1 | COMPARED | SURFACE_STRENGTH | DIRECT | DIRECT | PredixSport public tennis ratings (CC BY 4.0) |
| 002 | Service point win % | — | 61.3333 | — | 10 | — | UNAVAILABLE | ONE_SIDED_EVIDENCE | POINT_BY_POINT | DIRECT | PARTIAL | DataHub ATP World Tour tennis data (CC BY 4.0) |
| 003 | Return point win % | — | 47.5806 | — | 10 | — | UNAVAILABLE | ONE_SIDED_EVIDENCE | POINT_BY_POINT | DIRECT | PARTIAL | DataHub ATP World Tour tennis data (CC BY 4.0) |
| 005 | Last-10 win % | 80 | 80 | 0 | 5 | 0.00 | NEUTRAL | COMPARED | RECENT_FORM | PARTIAL | PARTIAL | runtime:atp_main |
| 006 | Bad-loss rate % | 66.67 | 0 | — | 25 | — | UNAVAILABLE | INSUFFICIENT_SAMPLE | LOSS_PROFILE | PARTIAL | PARTIAL | PredixSport public tennis ratings (CC BY 4.0) |
| 007 | Common-opponent win % | 100 | 100 | 0 | 20 | 0.00 | NEUTRAL | COMPARED | COMMON_OPPONENT | RECONSTRUCTED | RECONSTRUCTED | runtime:atp_main |
| 008 | Deciding-set win % | — | — | — | 5 | — | UNAVAILABLE | VALUE_NOT_PARSEABLE | SET_PROFILE | DIRECT | DIRECT | PredixSport public tennis ratings (CC BY 4.0) |
| 009 | Pressure point win % | — | — | — | 18 | — | UNAVAILABLE | VALUE_NOT_PARSEABLE | POINT_BY_POINT | DIRECT | DIRECT | PredixSport public tennis ratings (CC BY 4.0) |
| 010 | Straight-set win % | — | — | — | 5 | — | UNAVAILABLE | VALUE_NOT_PARSEABLE | SET_PROFILE | DIRECT | DIRECT | PredixSport public tennis ratings (CC BY 4.0) |
| 011 | Match win % | — | — | — | 5 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | RESULTS_HISTORY | UNAVAILABLE | UNAVAILABLE | DataHub ATP World Tour tennis data (CC BY 4.0) |
| 016 | Break-point score-state win % | 76.9231 | 25 | 51.9231 | 24 | 2.16 | P1 | COMPARED | POINT_BY_POINT | PARTIAL | PARTIAL | BSD/Bzzoiro ATP Main PBP |
| 018 | Breakback rate % | — | — | — | 40 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | RECONSTRUCTED | BSD/Bzzoiro ATP Main PBP |
| 027 | Lead protection % | — | — | — | 5 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | CLOSING_ABILITY | UNAVAILABLE | UNAVAILABLE | — |
| 029 | Response after a close set loss, vs own baseline | — | — | — | 25 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | PSYCH_RESPONSE | UNAVAILABLE | UNAVAILABLE | — |
| 031 | Opponent-adjusted set differential | -0.51 | 1.55 | -2.06 | 0.15 | 13.73 | P2 | COMPARED | COMMON_OPPONENT | RECONSTRUCTED | RECONSTRUCTED | Four-tour static history index (data/generated/tennis-runtime-index.json) |
| 032 | Break-point conversion % | 0 | 0 | — | 40 | — | UNAVAILABLE | INSUFFICIENT_SAMPLE | POINT_BY_POINT | PARTIAL | PARTIAL | BSD/Bzzoiro ATP Main PBP |
| 034 | Dominance ratio | 1.0696 | 1.2305 | -0.1609 | 0.15 | 1.07 | P2 | COMPARED | POINT_BY_POINT | PARTIAL | PARTIAL | BSD/Bzzoiro ATP Main PBP |
| 036 | Losses as favourite % | 80 | 35 | 45 | 15 | 3.00 | P2 | COMPARED | LOSS_PROFILE | RECONSTRUCTED | RECONSTRUCTED | Four-tour static history index (data/generated/tennis-runtime-index.json) |
| 041 | Elo-adjusted surplus, recent vs earlier | 0.07500000000000001 | 0.381 | -0.306 | 0.1 | 3.06 | P2 | COMPARED | IMPROVEMENT_TREND | RECONSTRUCTED | RECONSTRUCTED | Four-tour static history index (data/generated/tennis-runtime-index.json) |
| 045 | Deciding-set win % as pre-match favourite | — | — | — | 25 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | SET_PROFILE | UNAVAILABLE | UNAVAILABLE | — |
| 051 | Opponent-specific win probability % | 50 | 50 | 0 | 3 | 0.00 | NEUTRAL | COMPARED | H2H_PROBABILITY | RECONSTRUCTED | RECONSTRUCTED | Four-tour static history index (data/generated/tennis-runtime-index.json) |
| 053 | Pressure index % | 80 | 33.3333 | — | 18 | — | UNAVAILABLE | INSUFFICIENT_SAMPLE | POINT_BY_POINT | PARTIAL | PARTIAL | BSD/Bzzoiro ATP Main PBP |
| 055 | Elo change over last 10 | 23.8 | 103.85 | -80.05 | 20 | 4.00 | P2 | COMPARED | RECENT_FORM | PARTIAL | PARTIAL | PredixSport public tennis ratings (CC BY 4.0) |
| 068 | Current win/loss streak (signed match count) | 2 | 2 | 0 | 5 | 0.00 | NEUTRAL | COMPARED | RECENT_FORM | PARTIAL | PARTIAL | runtime:atp_main |
| 080 | Common-opponent net divergent outcomes | 26 | -26 | 52 | 1 | 52.00 | P1 | COMPARED | COMMON_OPPONENT | PARTIAL | PARTIAL | runtime:atp_main |

</details>

### Alejandro Tabilo vs Yannick Hanfmann

- match_id `b3d411f2-2ffc-43a9-b0e3-8658b664adbc` · audit_run_id `a609c2bd-4291-445d-ab98-3cfd6da14c1a` · US Open Round of 128 (Hard)
- stored: **INSUFFICIENT EVIDENCE** / colour INSUFFICIENT EVIDENCE / independent_winner null
- stage that caused the refusal: **DECISION CORE (60% directional threshold)**

| | P1 Alejandro Tabilo | P2 Yannick Hanfmann |
| --- | --- | --- |
| supporting families | H2H_PROBABILITY, SURFACE_STRENGTH | RECENT_FORM |
| contradicting families | RECENT_FORM | H2H_PROBABILITY, SURFACE_STRENGTH |
| directional share (unrounded) | 50% | 25% |
| reaches 60% | no | no |
| verification: families supporting | H2H_PROBABILITY, SURFACE_STRENGTH | RECENT_FORM |
| verification: metrics not compared — own supply failure / refused on sample floor / supplied-but-unused | 11 / 1 / 3 | 9 / 1 / 5 |
| disagreement: families against this player | RECENT_FORM(MODERATE) | H2H_PROBABILITY(MAJOR), SURFACE_STRENGTH(MODERATE) |
| disagreement: overall severity | MODERATE | CRITICAL |
| underdog: pathways | COMMON_OPPONENT_ADVANTAGE(STRONG_PATHWAY, 12x), MATCHUP_TACTICAL_ADVANTAGE(STRONG_PATHWAY, 6.667x), SURFACE_ADVANTAGE(VIABLE_PATHWAY, 3.047x) (STRONG_PATHWAY) | COMMON_OPPONENT_ADVANTAGE(VIABLE_PATHWAY, 2.8x), RECENT_FORM_ADVANTAGE(VIABLE_PATHWAY, 2x) (STRONG_PATHWAY) |
| underdog: evaluated by production | false | false |
| stress: support before → after | 50% → 50% | 25% → 0% |
| stress: status | REMOVED | REVERSED |
| stress: outcome when THIS side is stressed | INSUFFICIENT | P1 |
| stress: run by production | true | true |
| stress: families manufactured out of NEUTRAL | — | — |

Conflicted families: COMMON_OPPONENT · neutral: IMPROVEMENT_TREND, LOSS_PROFILE · directional denominator: 4

**Stage trace** — family vote `P1` → threshold `INSUFFICIENT` → leave-one-family-out `INSUFFICIENT` → verification `INSUFFICIENT` → disagreement `INSUFFICIENT` → underdog `INSUFFICIENT` → stress `INSUFFICIENT` → stored `INSUFFICIENT`. Symmetric stress verdict: `NOT_APPLICABLE`.

**Why:** P1 leads the family vote but holds only 50.000000% of the directional evidence (2 supporting of 4 directional families, including 1 internally conflicted family/families in the denominator), below the 60% threshold.

> Thin evidence supply: only 10 of 25 active metrics were comparable; 14 never yielded comparable evidence (TREATMENT_NOT_USABLE x11, VALUE_NOT_PARSEABLE x3).

> Dangerous Underdog audit analysed NEITHER player: runUnderdogAnalysis only examines the non-selected side, so a match with no selection gets no underdog analysis for anyone.

> P1/P2 carry no canonical player_id on this match; side identity rests on name and column position alone.

<details><summary>Per-metric evidence (P1 vs P2)</summary>

| code | metric | P1 | P2 | diff | noise floor | ×floor | favours | status | family | P1 treatment | P2 treatment | source |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 001 | Surface Elo | 1686.41 | 1655.94 | 30.47 | 10 | 3.05 | P1 | COMPARED | SURFACE_STRENGTH | DIRECT | DIRECT | PredixSport public tennis ratings (CC BY 4.0) |
| 002 | Service point win % | — | — | — | 10 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | DIRECT | DataHub ATP World Tour tennis data (CC BY 4.0) |
| 003 | Return point win % | — | — | — | 10 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | DIRECT | DataHub ATP World Tour tennis data (CC BY 4.0) |
| 005 | Last-10 win % | 60 | 70 | -10 | 5 | 2.00 | P2 | COMPARED | RECENT_FORM | PARTIAL | PARTIAL | runtime:atp_main |
| 006 | Bad-loss rate % | 0 | 25 | — | 25 | — | UNAVAILABLE | INSUFFICIENT_SAMPLE | LOSS_PROFILE | PARTIAL | PARTIAL | PredixSport public tennis ratings (CC BY 4.0) |
| 007 | Common-opponent win % | 100 | 100 | 0 | 20 | 0.00 | NEUTRAL | COMPARED | COMMON_OPPONENT | RECONSTRUCTED | RECONSTRUCTED | runtime:atp_main |
| 008 | Deciding-set win % | — | — | — | 5 | — | UNAVAILABLE | VALUE_NOT_PARSEABLE | SET_PROFILE | DIRECT | DIRECT | PredixSport public tennis ratings (CC BY 4.0) |
| 009 | Pressure point win % | — | — | — | 18 | — | UNAVAILABLE | VALUE_NOT_PARSEABLE | POINT_BY_POINT | DIRECT | DIRECT | PredixSport public tennis ratings (CC BY 4.0) |
| 010 | Straight-set win % | — | — | — | 5 | — | UNAVAILABLE | VALUE_NOT_PARSEABLE | SET_PROFILE | DIRECT | DIRECT | PredixSport public tennis ratings (CC BY 4.0) |
| 011 | Match win % | — | — | — | 5 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | RESULTS_HISTORY | UNAVAILABLE | UNAVAILABLE | DataHub ATP World Tour tennis data (CC BY 4.0) |
| 016 | Break-point score-state win % | — | — | — | 24 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | UNAVAILABLE | — |
| 018 | Breakback rate % | — | — | — | 40 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | UNAVAILABLE | — |
| 027 | Lead protection % | — | — | — | 5 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | CLOSING_ABILITY | UNAVAILABLE | UNAVAILABLE | — |
| 029 | Response after a close set loss, vs own baseline | — | — | — | 25 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | PSYCH_RESPONSE | UNAVAILABLE | UNAVAILABLE | — |
| 031 | Opponent-adjusted set differential | -0.35 | 0.06999999999999999 | -0.42 | 0.15 | 2.80 | P2 | COMPARED | COMMON_OPPONENT | RECONSTRUCTED | RECONSTRUCTED | Four-tour static history index (data/generated/tennis-runtime-index.json) |
| 032 | Break-point conversion % | — | — | — | 40 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | UNAVAILABLE | — |
| 034 | Dominance ratio | — | — | — | 0.15 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | UNAVAILABLE | — |
| 036 | Losses as favourite % | 45 | 35 | 10 | 15 | 0.67 | NEUTRAL | COMPARED | LOSS_PROFILE | RECONSTRUCTED | RECONSTRUCTED | Four-tour static history index (data/generated/tennis-runtime-index.json) |
| 041 | Elo-adjusted surplus, recent vs earlier | 0.09999999999999999 | 0.12300000000000001 | -0.023 | 0.1 | 0.23 | NEUTRAL | COMPARED | IMPROVEMENT_TREND | RECONSTRUCTED | RECONSTRUCTED | Four-tour static history index (data/generated/tennis-runtime-index.json) |
| 045 | Deciding-set win % as pre-match favourite | — | — | — | 25 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | SET_PROFILE | UNAVAILABLE | UNAVAILABLE | — |
| 051 | Opponent-specific win probability % | 60 | 40 | 20 | 3 | 6.67 | P1 | COMPARED | H2H_PROBABILITY | RECONSTRUCTED | RECONSTRUCTED | Four-tour static history index (data/generated/tennis-runtime-index.json) |
| 053 | Pressure index % | — | — | — | 18 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | UNAVAILABLE | — |
| 055 | Elo change over last 10 | 0.97 | -0.02 | 0.99 | 20 | 0.05 | NEUTRAL | COMPARED | RECENT_FORM | PARTIAL | PARTIAL | PredixSport public tennis ratings (CC BY 4.0) |
| 068 | Current win/loss streak (signed match count) | 2 | 2 | 0 | 5 | 0.00 | NEUTRAL | COMPARED | RECENT_FORM | PARTIAL | PARTIAL | runtime:atp_main |
| 080 | Common-opponent net divergent outcomes | 6 | -6 | 12 | 1 | 12.00 | P1 | COMPARED | COMMON_OPPONENT | PARTIAL | PARTIAL | runtime:atp_main |

</details>

### Carlos Alcaraz vs Roman Safiullin

- match_id `c85c3705-268b-418a-aba6-b23fd8e7a470` · audit_run_id `fb21b409-50ef-42f8-9ac8-46a44b61206a` · US Open Round of 128 (Hard)
- stored: **INSUFFICIENT EVIDENCE** / colour INSUFFICIENT EVIDENCE / independent_winner null
- stage that caused the refusal: **DECISION CORE (60% directional threshold)**

| | P1 Carlos Alcaraz | P2 Roman Safiullin |
| --- | --- | --- |
| supporting families | SURFACE_STRENGTH | H2H_PROBABILITY, IMPROVEMENT_TREND, LOSS_PROFILE |
| contradicting families | H2H_PROBABILITY, IMPROVEMENT_TREND, LOSS_PROFILE | SURFACE_STRENGTH |
| directional share (unrounded) | 16.6667% | 50% |
| reaches 60% | no | no |
| verification: families supporting | SURFACE_STRENGTH | H2H_PROBABILITY, IMPROVEMENT_TREND, LOSS_PROFILE |
| verification: metrics not compared — own supply failure / refused on sample floor / supplied-but-unused | 8 / 4 / 3 | 6 / 4 / 5 |
| disagreement: families against this player | H2H_PROBABILITY(MODERATE), IMPROVEMENT_TREND(MODERATE), LOSS_PROFILE(MODERATE) | SURFACE_STRENGTH(CRITICAL) |
| disagreement: overall severity | CRITICAL | CRITICAL |
| underdog: pathways | COMMON_OPPONENT_ADVANTAGE(STRONG_PATHWAY, 78x), RECENT_FORM_ADVANTAGE(STRONG_PATHWAY, 10x), SURFACE_ADVANTAGE(STRONG_PATHWAY, 97.015x) (STRONG_PATHWAY) | COMMON_OPPONENT_ADVANTAGE(STRONG_PATHWAY, 12.6x), MATCHUP_TACTICAL_ADVANTAGE(VIABLE_PATHWAY, 3.733x), IMPROVEMENT_TREND_ADVANTAGE(VIABLE_PATHWAY, 2.4x), LOSS_PROFILE_ADVANTAGE(VIABLE_PATHWAY, 3.333x), RECENT_FORM_ADVANTAGE(STRONG_PATHWAY, 14.857x) (STRONG_PATHWAY) |
| underdog: evaluated by production | false | false |
| stress: support before → after | 16.7% → 16.7% | 50% → 50% |
| stress: status | REMOVED | REMOVED |
| stress: outcome when THIS side is stressed | INSUFFICIENT | INSUFFICIENT |
| stress: run by production | true | true |
| stress: families manufactured out of NEUTRAL | — | — |

Conflicted families: COMMON_OPPONENT, RECENT_FORM · neutral: POINT_BY_POINT · directional denominator: 6

**Stage trace** — family vote `P2` → threshold `INSUFFICIENT` → leave-one-family-out `INSUFFICIENT` → verification `INSUFFICIENT` → disagreement `INSUFFICIENT` → underdog `INSUFFICIENT` → stress `INSUFFICIENT` → stored `INSUFFICIENT`. Symmetric stress verdict: `NOT_APPLICABLE`.

**Why:** P2 leads the family vote but holds only 50.000000% of the directional evidence (3 supporting of 6 directional families, including 2 internally conflicted family/families in the denominator), below the 60% threshold.

> Thin evidence supply: only 10 of 25 active metrics were comparable; 11 never yielded comparable evidence (TREATMENT_NOT_USABLE x8, VALUE_NOT_PARSEABLE x3).

> Dangerous Underdog audit analysed NEITHER player: runUnderdogAnalysis only examines the non-selected side, so a match with no selection gets no underdog analysis for anyone.

> P1/P2 carry no canonical player_id on this match; side identity rests on name and column position alone.

<details><summary>Per-metric evidence (P1 vs P2)</summary>

| code | metric | P1 | P2 | diff | noise floor | ×floor | favours | status | family | P1 treatment | P2 treatment | source |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 001 | Surface Elo | 2466.63 | 1496.48 | 970.15 | 10 | 97.02 | P1 | COMPARED | SURFACE_STRENGTH | DIRECT | DIRECT | PredixSport public tennis ratings (CC BY 4.0) |
| 002 | Service point win % | — | — | — | 10 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | DIRECT | DataHub ATP World Tour tennis data (CC BY 4.0) |
| 003 | Return point win % | — | — | — | 10 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | DIRECT | DataHub ATP World Tour tennis data (CC BY 4.0) |
| 005 | Last-10 win % | 80 | 30 | 50 | 5 | 10.00 | P1 | COMPARED | RECENT_FORM | PARTIAL | PARTIAL | runtime:atp_main |
| 006 | Bad-loss rate % | 66.67 | 0 | — | 25 | — | UNAVAILABLE | INSUFFICIENT_SAMPLE | LOSS_PROFILE | PARTIAL | PARTIAL | PredixSport public tennis ratings (CC BY 4.0) |
| 007 | Common-opponent win % | 100 | 96.43 | 3.57 | 20 | 0.18 | NEUTRAL | COMPARED | COMMON_OPPONENT | RECONSTRUCTED | RECONSTRUCTED | runtime:atp_main |
| 008 | Deciding-set win % | — | — | — | 5 | — | UNAVAILABLE | VALUE_NOT_PARSEABLE | SET_PROFILE | DIRECT | DIRECT | PredixSport public tennis ratings (CC BY 4.0) |
| 009 | Pressure point win % | — | — | — | 18 | — | UNAVAILABLE | VALUE_NOT_PARSEABLE | POINT_BY_POINT | DIRECT | DIRECT | PredixSport public tennis ratings (CC BY 4.0) |
| 010 | Straight-set win % | — | — | — | 5 | — | UNAVAILABLE | VALUE_NOT_PARSEABLE | SET_PROFILE | DIRECT | DIRECT | PredixSport public tennis ratings (CC BY 4.0) |
| 011 | Match win % | — | — | — | 5 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | RESULTS_HISTORY | UNAVAILABLE | UNAVAILABLE | — |
| 016 | Break-point score-state win % | — | — | — | 24 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | UNAVAILABLE | — |
| 018 | Breakback rate % | — | — | — | 40 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | UNAVAILABLE | — |
| 027 | Lead protection % | — | — | — | 5 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | CLOSING_ABILITY | UNAVAILABLE | UNAVAILABLE | — |
| 029 | Response after a close set loss, vs own baseline | — | — | — | 25 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | PSYCH_RESPONSE | UNAVAILABLE | UNAVAILABLE | — |
| 031 | Opponent-adjusted set differential | -0.27999999999999997 | 1.61 | -1.89 | 0.15 | 12.60 | P2 | COMPARED | COMMON_OPPONENT | RECONSTRUCTED | RECONSTRUCTED | Four-tour static history index (data/generated/tennis-runtime-index.json) |
| 032 | Break-point conversion % | 0 | 0 | — | 40 | — | UNAVAILABLE | INSUFFICIENT_SAMPLE | POINT_BY_POINT | PARTIAL | PARTIAL | BSD/Bzzoiro ATP Main PBP |
| 034 | Dominance ratio | 1.2229 | 1.1884 | 0.0345 | 0.15 | 0.23 | NEUTRAL | COMPARED | POINT_BY_POINT | PARTIAL | PARTIAL | BSD/Bzzoiro ATP Main PBP |
| 036 | Losses as favourite % | 90 | 40 | 50 | 15 | 3.33 | P2 | COMPARED | LOSS_PROFILE | RECONSTRUCTED | RECONSTRUCTED | Four-tour static history index (data/generated/tennis-runtime-index.json) |
| 041 | Elo-adjusted surplus, recent vs earlier | -0.237 | 0.002999999999999989 | -0.24 | 0.1 | 2.40 | P2 | COMPARED | IMPROVEMENT_TREND | RECONSTRUCTED | RECONSTRUCTED | Four-tour static history index (data/generated/tennis-runtime-index.json) |
| 045 | Deciding-set win % as pre-match favourite | — | — | — | 25 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | SET_PROFILE | UNAVAILABLE | UNAVAILABLE | — |
| 051 | Opponent-specific win probability % | 44.4 | 55.6 | -11.2 | 3 | 3.73 | P2 | COMPARED | H2H_PROBABILITY | RECONSTRUCTED | RECONSTRUCTED | Four-tour static history index (data/generated/tennis-runtime-index.json) |
| 053 | Pressure index % | 50 | 42.029 | — | 18 | — | UNAVAILABLE | INSUFFICIENT_SAMPLE | POINT_BY_POINT | PARTIAL | PARTIAL | BSD/Bzzoiro ATP Main PBP |
| 055 | Elo change over last 10 | -287.68 | 9.45 | -297.13 | 20 | 14.86 | P2 | COMPARED | RECENT_FORM | PARTIAL | PARTIAL | PredixSport public tennis ratings (CC BY 4.0) |
| 068 | Current win/loss streak (signed match count) | 5 | -2 | — | 5 | — | UNAVAILABLE | INSUFFICIENT_SAMPLE | RECENT_FORM | PARTIAL | PARTIAL | runtime:atp_main |
| 080 | Common-opponent net divergent outcomes | 39 | -39 | 78 | 1 | 78.00 | P1 | COMPARED | COMMON_OPPONENT | PARTIAL | PARTIAL | runtime:atp_main |

</details>

## FIXED_PENDING_REPROCESS (14)

### Valentin Royer vs Dalibor Svrcina

- match_id `757d2dad-d50e-48ad-92bd-14780b7d1790` · audit_run_id `08e534ac-09a5-45da-b9e7-7dbf997873fb` · US Open Round of 128 (Hard)
- stored: **INSUFFICIENT EVIDENCE** / colour INSUFFICIENT EVIDENCE / independent_winner null
- stage that caused the refusal: **PERSISTENCE (stored verdict predates the Stress fix; production has not re-run this match)**

| | P1 Valentin Royer | P2 Dalibor Svrcina |
| --- | --- | --- |
| supporting families | — | RECENT_FORM, SURFACE_STRENGTH |
| contradicting families | RECENT_FORM, SURFACE_STRENGTH | — |
| directional share (unrounded) | 0% | 66.6667% |
| reaches 60% | no | YES |
| verification: families supporting | — | RECENT_FORM, SURFACE_STRENGTH |
| verification: metrics not compared — own supply failure / refused on sample floor / supplied-but-unused | 7 / 4 / 3 | 7 / 4 / 3 |
| disagreement: families against this player | RECENT_FORM(CRITICAL), SURFACE_STRENGTH(CRITICAL) | — |
| disagreement: overall severity | CRITICAL | NONE |
| underdog: pathways | COMMON_OPPONENT_ADVANTAGE(POTENTIAL_PATHWAY, 1.667x) (POTENTIAL_PATHWAY) | COMMON_OPPONENT_ADVANTAGE(VIABLE_PATHWAY, 2x), RECENT_FORM_ADVANTAGE(STRONG_PATHWAY, 10.747x), SURFACE_ADVANTAGE(STRONG_PATHWAY, 10.025x) (STRONG_PATHWAY) |
| underdog: evaluated by production | true | false |
| stress: support before → after | 0% → 0% | 66.7% → 66.7% |
| stress: status | REVERSED | ROBUST |
| stress: outcome when THIS side is stressed | P2 | P2 |
| stress: run by production | true | true |
| stress: families manufactured out of NEUTRAL | — | — |

Conflicted families: COMMON_OPPONENT · neutral: H2H_PROBABILITY, IMPROVEMENT_TREND, LOSS_PROFILE, POINT_BY_POINT · directional denominator: 3

**Stage trace** — family vote `P2` → threshold `P2` → leave-one-family-out `P2` → verification `P2` → disagreement `P2` → underdog `P2` → stress `P2` → stored `INSUFFICIENT`. Symmetric stress verdict: `BOTH_SURVIVE`.

**Why:** The decision core selected P2 at 66.666667% of the directional evidence, cleared the 60% threshold, survived leave-one-family-out, and now survives the corrected two-sided Stress evaluation as well (comparative_robustness=BOTH_SURVIVE, never CHALLENGER_MORE_ROBUST). The persisted row still reads INSUFFICIENT EVIDENCE only because this read-only reconstruction, per its production-safety constraints, never writes to production -- the real pipeline has not re-run this match since the fix.

> P1/P2 carry no canonical player_id on this match; side identity rests on name and column position alone.

<details><summary>Per-metric evidence (P1 vs P2)</summary>

| code | metric | P1 | P2 | diff | noise floor | ×floor | favours | status | family | P1 treatment | P2 treatment | source |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 001 | Surface Elo | 1485.6 | 1585.85 | -100.25 | 10 | 10.03 | P2 | COMPARED | SURFACE_STRENGTH | DIRECT | DIRECT | PredixSport public tennis ratings (CC BY 4.0) |
| 002 | Service point win % | — | — | — | 10 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | UNAVAILABLE | — |
| 003 | Return point win % | — | — | — | 10 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | UNAVAILABLE | — |
| 005 | Last-10 win % | 10 | 60 | -50 | 5 | 10.00 | P2 | COMPARED | RECENT_FORM | PARTIAL | PARTIAL | runtime:atp_main |
| 006 | Bad-loss rate % | 0 | 0 | — | 25 | — | UNAVAILABLE | INSUFFICIENT_SAMPLE | LOSS_PROFILE | PARTIAL | PARTIAL | PredixSport public tennis ratings (CC BY 4.0) |
| 007 | Common-opponent win % | 50 | 100 | — | 20 | — | UNAVAILABLE | INSUFFICIENT_SAMPLE | COMMON_OPPONENT | RECONSTRUCTED | RECONSTRUCTED | runtime:atp_main |
| 008 | Deciding-set win % | — | — | — | 5 | — | UNAVAILABLE | VALUE_NOT_PARSEABLE | SET_PROFILE | DIRECT | DIRECT | PredixSport public tennis ratings (CC BY 4.0) |
| 009 | Pressure point win % | — | — | — | 18 | — | UNAVAILABLE | VALUE_NOT_PARSEABLE | POINT_BY_POINT | DIRECT | DIRECT | PredixSport public tennis ratings (CC BY 4.0) |
| 010 | Straight-set win % | — | — | — | 5 | — | UNAVAILABLE | VALUE_NOT_PARSEABLE | SET_PROFILE | DIRECT | DIRECT | PredixSport public tennis ratings (CC BY 4.0) |
| 011 | Match win % | — | — | — | 5 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | RESULTS_HISTORY | UNAVAILABLE | UNAVAILABLE | — |
| 016 | Break-point score-state win % | — | — | — | 24 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | UNAVAILABLE | — |
| 018 | Breakback rate % | 0 | 12.5 | — | 40 | — | UNAVAILABLE | INSUFFICIENT_SAMPLE | POINT_BY_POINT | RECONSTRUCTED | RECONSTRUCTED | BSD/Bzzoiro ATP Main PBP |
| 027 | Lead protection % | — | — | — | 5 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | CLOSING_ABILITY | UNAVAILABLE | UNAVAILABLE | — |
| 029 | Response after a close set loss, vs own baseline | — | — | — | 25 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | PSYCH_RESPONSE | UNAVAILABLE | UNAVAILABLE | — |
| 031 | Opponent-adjusted set differential | -0.96 | -1.21 | 0.25 | 0.15 | 1.67 | P1 | COMPARED | COMMON_OPPONENT | RECONSTRUCTED | RECONSTRUCTED | Four-tour static history index (data/generated/tennis-runtime-index.json) |
| 032 | Break-point conversion % | 0 | 0 | — | 40 | — | UNAVAILABLE | INSUFFICIENT_SAMPLE | POINT_BY_POINT | PARTIAL | PARTIAL | BSD/Bzzoiro ATP Main PBP |
| 034 | Dominance ratio | 0.8616 | 0.9431 | -0.0815 | 0.15 | 0.54 | NEUTRAL | COMPARED | POINT_BY_POINT | PARTIAL | PARTIAL | BSD/Bzzoiro ATP Main PBP |
| 036 | Losses as favourite % | 20 | 10 | 10 | 15 | 0.67 | NEUTRAL | COMPARED | LOSS_PROFILE | RECONSTRUCTED | RECONSTRUCTED | Four-tour static history index (data/generated/tennis-runtime-index.json) |
| 041 | Elo-adjusted surplus, recent vs earlier | -0.021999999999999992 | 0.032 | -0.054 | 0.1 | 0.54 | NEUTRAL | COMPARED | IMPROVEMENT_TREND | RECONSTRUCTED | RECONSTRUCTED | Four-tour static history index (data/generated/tennis-runtime-index.json) |
| 045 | Deciding-set win % as pre-match favourite | — | — | — | 25 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | SET_PROFILE | UNAVAILABLE | UNAVAILABLE | — |
| 051 | Opponent-specific win probability % | 50 | 50 | 0 | 3 | 0.00 | NEUTRAL | COMPARED | H2H_PROBABILITY | RECONSTRUCTED | RECONSTRUCTED | Four-tour static history index (data/generated/tennis-runtime-index.json) |
| 053 | Pressure index % | 58.4615 | 43.9394 | 14.5221 | 18 | 0.81 | NEUTRAL | COMPARED | POINT_BY_POINT | PARTIAL | PARTIAL | BSD/Bzzoiro ATP Main PBP |
| 055 | Elo change over last 10 | -88.38 | 126.55 | -214.93 | 20 | 10.75 | P2 | COMPARED | RECENT_FORM | PARTIAL | PARTIAL | PredixSport public tennis ratings (CC BY 4.0) |
| 068 | Current win/loss streak (signed match count) | -5 | 2 | -7 | 5 | 1.40 | P2 | COMPARED | RECENT_FORM | PARTIAL | PARTIAL | runtime:atp_main |
| 080 | Common-opponent net divergent outcomes | -1 | 1 | -2 | 1 | 2.00 | P2 | COMPARED | COMMON_OPPONENT | PARTIAL | PARTIAL | runtime:atp_main |

</details>

### Brandon Nakashima vs Sebastian Baez

- match_id `859bef9b-4891-4d96-be11-acf77baa7586` · audit_run_id `2f9152dc-4f0a-423b-ac60-f452bddce7b8` · US Open Round of 128 (Hard)
- stored: **INSUFFICIENT EVIDENCE** / colour INSUFFICIENT EVIDENCE / independent_winner null
- stage that caused the refusal: **PERSISTENCE (stored verdict predates the Stress fix; production has not re-run this match)**

| | P1 Brandon Nakashima | P2 Sebastian Baez |
| --- | --- | --- |
| supporting families | H2H_PROBABILITY, RECENT_FORM | LOSS_PROFILE |
| contradicting families | LOSS_PROFILE | H2H_PROBABILITY, RECENT_FORM |
| directional share (unrounded) | 66.6667% | 33.3333% |
| reaches 60% | YES | no |
| verification: families supporting | H2H_PROBABILITY, RECENT_FORM | LOSS_PROFILE |
| verification: metrics not compared — own supply failure / refused on sample floor / supplied-but-unused | 6 / 3 / 4 | 5 / 3 / 5 |
| disagreement: families against this player | LOSS_PROFILE(MODERATE) | H2H_PROBABILITY(MODERATE), RECENT_FORM(MODERATE) |
| disagreement: overall severity | MODERATE | MAJOR |
| underdog: pathways | MATCHUP_TACTICAL_ADVANTAGE(VIABLE_PATHWAY, 3.733x), RECENT_FORM_ADVANTAGE(VIABLE_PATHWAY, 3.488x) (STRONG_PATHWAY) | LOSS_PROFILE_ADVANTAGE(VIABLE_PATHWAY, 2.333x) (VIABLE_PATHWAY) |
| underdog: evaluated by production | false | true |
| stress: support before → after | 66.7% → 66.7% | 33.3% → 33.3% |
| stress: status | ROBUST | REVERSED |
| stress: outcome when THIS side is stressed | P1 | P1 |
| stress: run by production | true | true |
| stress: families manufactured out of NEUTRAL | — | — |

Conflicted families: — · neutral: COMMON_OPPONENT, IMPROVEMENT_TREND, POINT_BY_POINT, SURFACE_STRENGTH · directional denominator: 3

**Stage trace** — family vote `P1` → threshold `P1` → leave-one-family-out `P1` → verification `P1` → disagreement `P1` → underdog `P1` → stress `P1` → stored `INSUFFICIENT`. Symmetric stress verdict: `BOTH_SURVIVE`.

**Why:** The decision core selected P1 at 66.666667% of the directional evidence, cleared the 60% threshold, survived leave-one-family-out, and now survives the corrected two-sided Stress evaluation as well (comparative_robustness=BOTH_SURVIVE, never CHALLENGER_MORE_ROBUST). The persisted row still reads INSUFFICIENT EVIDENCE only because this read-only reconstruction, per its production-safety constraints, never writes to production -- the real pipeline has not re-run this match since the fix.

> P1/P2 carry no canonical player_id on this match; side identity rests on name and column position alone.

<details><summary>Per-metric evidence (P1 vs P2)</summary>

| code | metric | P1 | P2 | diff | noise floor | ×floor | favours | status | family | P1 treatment | P2 treatment | source |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 001 | Surface Elo | 1659.3 | 1665.15 | -5.85 | 10 | 0.58 | NEUTRAL | COMPARED | SURFACE_STRENGTH | DIRECT | DIRECT | PredixSport public tennis ratings (CC BY 4.0) |
| 002 | Service point win % | 60 | 52.381 | 7.619 | 10 | 0.76 | NEUTRAL | COMPARED | POINT_BY_POINT | PARTIAL | PARTIAL | BSD/Bzzoiro ATP Main PBP |
| 003 | Return point win % | — | — | — | 10 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | PARTIAL | BSD/Bzzoiro ATP Main PBP |
| 005 | Last-10 win % | 60 | 50 | 10 | 5 | 2.00 | P1 | COMPARED | RECENT_FORM | PARTIAL | PARTIAL | runtime:atp_main |
| 006 | Bad-loss rate % | 20 | 0 | — | 25 | — | UNAVAILABLE | INSUFFICIENT_SAMPLE | LOSS_PROFILE | PARTIAL | PARTIAL | PredixSport public tennis ratings (CC BY 4.0) |
| 007 | Common-opponent win % | 100 | 94.44 | 5.56 | 20 | 0.28 | NEUTRAL | COMPARED | COMMON_OPPONENT | RECONSTRUCTED | RECONSTRUCTED | runtime:atp_main |
| 008 | Deciding-set win % | — | — | — | 5 | — | UNAVAILABLE | VALUE_NOT_PARSEABLE | SET_PROFILE | DIRECT | DIRECT | PredixSport public tennis ratings (CC BY 4.0) |
| 009 | Pressure point win % | — | — | — | 18 | — | UNAVAILABLE | VALUE_NOT_PARSEABLE | POINT_BY_POINT | DIRECT | DIRECT | PredixSport public tennis ratings (CC BY 4.0) |
| 010 | Straight-set win % | — | — | — | 5 | — | UNAVAILABLE | VALUE_NOT_PARSEABLE | SET_PROFILE | DIRECT | DIRECT | PredixSport public tennis ratings (CC BY 4.0) |
| 011 | Match win % | — | — | — | 5 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | RESULTS_HISTORY | UNAVAILABLE | UNAVAILABLE | — |
| 016 | Break-point score-state win % | — | — | — | 24 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | PARTIAL | UNAVAILABLE | BSD/Bzzoiro ATP Main PBP |
| 018 | Breakback rate % | 0 | 0 | — | 40 | — | UNAVAILABLE | INSUFFICIENT_SAMPLE | POINT_BY_POINT | RECONSTRUCTED | RECONSTRUCTED | BSD/Bzzoiro ATP Main PBP |
| 027 | Lead protection % | — | — | — | 5 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | CLOSING_ABILITY | UNAVAILABLE | UNAVAILABLE | — |
| 029 | Response after a close set loss, vs own baseline | — | — | — | 25 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | PSYCH_RESPONSE | UNAVAILABLE | UNAVAILABLE | — |
| 031 | Opponent-adjusted set differential | -0.12 | -0.11000000000000001 | -0.01 | 0.15 | 0.07 | NEUTRAL | COMPARED | COMMON_OPPONENT | RECONSTRUCTED | RECONSTRUCTED | Four-tour static history index (data/generated/tennis-runtime-index.json) |
| 032 | Break-point conversion % | — | — | — | 40 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | PARTIAL | BSD/Bzzoiro ATP Main PBP |
| 034 | Dominance ratio | 0.7979 | 0.6811 | 0.1168 | 0.15 | 0.78 | NEUTRAL | COMPARED | POINT_BY_POINT | PARTIAL | PARTIAL | BSD/Bzzoiro ATP Main PBP |
| 036 | Losses as favourite % | 55 | 20 | 35 | 15 | 2.33 | P2 | COMPARED | LOSS_PROFILE | RECONSTRUCTED | RECONSTRUCTED | Four-tour static history index (data/generated/tennis-runtime-index.json) |
| 041 | Elo-adjusted surplus, recent vs earlier | -0.049999999999999996 | -0.08800000000000001 | 0.038 | 0.1 | 0.38 | NEUTRAL | COMPARED | IMPROVEMENT_TREND | RECONSTRUCTED | RECONSTRUCTED | Four-tour static history index (data/generated/tennis-runtime-index.json) |
| 045 | Deciding-set win % as pre-match favourite | — | — | — | 25 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | SET_PROFILE | UNAVAILABLE | UNAVAILABLE | — |
| 051 | Opponent-specific win probability % | 55.6 | 44.4 | 11.2 | 3 | 3.73 | P1 | COMPARED | H2H_PROBABILITY | RECONSTRUCTED | RECONSTRUCTED | Four-tour static history index (data/generated/tennis-runtime-index.json) |
| 053 | Pressure index % | 54.5455 | 46.1538 | — | 18 | — | UNAVAILABLE | INSUFFICIENT_SAMPLE | POINT_BY_POINT | PARTIAL | PARTIAL | BSD/Bzzoiro ATP Main PBP |
| 055 | Elo change over last 10 | 13.02 | -56.74 | 69.76 | 20 | 3.49 | P1 | COMPARED | RECENT_FORM | PARTIAL | PARTIAL | PredixSport public tennis ratings (CC BY 4.0) |
| 068 | Current win/loss streak (signed match count) | -1 | 1 | -2 | 5 | 0.40 | NEUTRAL | COMPARED | RECENT_FORM | PARTIAL | PARTIAL | runtime:atp_main |
| 080 | Common-opponent net divergent outcomes | 0 | 0 | 0 | 1 | 0.00 | NEUTRAL | COMPARED | COMMON_OPPONENT | PARTIAL | PARTIAL | runtime:atp_main |

</details>

### Matteo Arnaldi vs James Duckworth

- match_id `51863871-02fd-4694-a7c3-47eac8a38f0e` · audit_run_id `35659995-b063-4778-bbb8-5790804ebecb` · US Open Round of 128 (Hard)
- stored: **INSUFFICIENT EVIDENCE** / colour INSUFFICIENT EVIDENCE / independent_winner null
- stage that caused the refusal: **PERSISTENCE (stored verdict predates the Stress fix; production has not re-run this match)**

| | P1 Matteo Arnaldi | P2 James Duckworth |
| --- | --- | --- |
| supporting families | — | POINT_BY_POINT, RECENT_FORM |
| contradicting families | POINT_BY_POINT, RECENT_FORM | — |
| directional share (unrounded) | 0% | 66.6667% |
| reaches 60% | no | YES |
| verification: families supporting | — | POINT_BY_POINT, RECENT_FORM |
| verification: metrics not compared — own supply failure / refused on sample floor / supplied-but-unused | 6 / 2 / 6 | 7 / 2 / 5 |
| disagreement: families against this player | POINT_BY_POINT(MINOR), RECENT_FORM(MAJOR) | — |
| disagreement: overall severity | CRITICAL | NONE |
| underdog: pathways | COMMON_OPPONENT_ADVANTAGE(STRONG_PATHWAY, 22x) (STRONG_PATHWAY) | COMMON_OPPONENT_ADVANTAGE(STRONG_PATHWAY, 4.133x), POINT_BY_POINT_ADVANTAGE(POTENTIAL_PATHWAY, 1.299x), RECENT_FORM_ADVANTAGE(STRONG_PATHWAY, 5.736x) (STRONG_PATHWAY) |
| underdog: evaluated by production | true | false |
| stress: support before → after | 0% → 0% | 66.7% → 50% |
| stress: status | REVERSED | FRAGILE |
| stress: outcome when THIS side is stressed | P2 | INSUFFICIENT |
| stress: run by production | true | true |
| stress: families manufactured out of NEUTRAL | — | — |

Conflicted families: COMMON_OPPONENT · neutral: H2H_PROBABILITY, IMPROVEMENT_TREND, LOSS_PROFILE, SURFACE_STRENGTH · directional denominator: 3

**Stage trace** — family vote `P2` → threshold `P2` → leave-one-family-out `P2` → verification `P2` → disagreement `P2` → underdog `P2` → stress `P2` → stored `INSUFFICIENT`. Symmetric stress verdict: `LEADER_MORE_ROBUST`.

**Why:** The decision core selected P2 at 66.666667% of the directional evidence, cleared the 60% threshold, survived leave-one-family-out, and now survives the corrected two-sided Stress evaluation as well (comparative_robustness=LEADER_MORE_ROBUST, never CHALLENGER_MORE_ROBUST). The persisted row still reads INSUFFICIENT EVIDENCE only because this read-only reconstruction, per its production-safety constraints, never writes to production -- the real pipeline has not re-run this match since the fix.

> Thin evidence supply: only 11 of 25 active metrics were comparable; 12 never yielded comparable evidence (ONE_SIDED_EVIDENCE x2, TREATMENT_NOT_USABLE x7, VALUE_NOT_PARSEABLE x3).

> P1/P2 carry no canonical player_id on this match; side identity rests on name and column position alone.

<details><summary>Per-metric evidence (P1 vs P2)</summary>

| code | metric | P1 | P2 | diff | noise floor | ×floor | favours | status | family | P1 treatment | P2 treatment | source |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 001 | Surface Elo | 1525.3 | 1517.94 | 7.36 | 10 | 0.74 | NEUTRAL | COMPARED | SURFACE_STRENGTH | DIRECT | DIRECT | PredixSport public tennis ratings (CC BY 4.0) |
| 002 | Service point win % | 56.7308 | — | — | 10 | — | UNAVAILABLE | ONE_SIDED_EVIDENCE | POINT_BY_POINT | PARTIAL | DIRECT | DataHub ATP World Tour tennis data (CC BY 4.0) |
| 003 | Return point win % | 36.3636 | — | — | 10 | — | UNAVAILABLE | ONE_SIDED_EVIDENCE | POINT_BY_POINT | PARTIAL | DIRECT | DataHub ATP World Tour tennis data (CC BY 4.0) |
| 005 | Last-10 win % | 20 | 30 | -10 | 5 | 2.00 | P2 | COMPARED | RECENT_FORM | PARTIAL | PARTIAL | PredixSport public tennis ratings (CC BY 4.0) |
| 006 | Bad-loss rate % | 0 | 0 | — | 25 | — | UNAVAILABLE | INSUFFICIENT_SAMPLE | LOSS_PROFILE | PARTIAL | PARTIAL | PredixSport public tennis ratings (CC BY 4.0) |
| 007 | Common-opponent win % | — | — | — | 20 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | COMMON_OPPONENT | RECONSTRUCTED | UNAVAILABLE | PredixSport public tennis ratings (CC BY 4.0) |
| 008 | Deciding-set win % | — | — | — | 5 | — | UNAVAILABLE | VALUE_NOT_PARSEABLE | SET_PROFILE | DIRECT | DIRECT | PredixSport public tennis ratings (CC BY 4.0) |
| 009 | Pressure point win % | — | — | — | 18 | — | UNAVAILABLE | VALUE_NOT_PARSEABLE | POINT_BY_POINT | DIRECT | DIRECT | PredixSport public tennis ratings (CC BY 4.0) |
| 010 | Straight-set win % | — | — | — | 5 | — | UNAVAILABLE | VALUE_NOT_PARSEABLE | SET_PROFILE | DIRECT | DIRECT | PredixSport public tennis ratings (CC BY 4.0) |
| 011 | Match win % | — | — | — | 5 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | RESULTS_HISTORY | UNAVAILABLE | UNAVAILABLE | PredixSport public tennis ratings (CC BY 4.0) |
| 016 | Break-point score-state win % | — | — | — | 24 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | UNAVAILABLE | — |
| 018 | Breakback rate % | — | — | — | 40 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | UNAVAILABLE | — |
| 027 | Lead protection % | — | — | — | 5 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | CLOSING_ABILITY | UNAVAILABLE | UNAVAILABLE | — |
| 029 | Response after a close set loss, vs own baseline | — | — | — | 25 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | PSYCH_RESPONSE | UNAVAILABLE | UNAVAILABLE | — |
| 031 | Opponent-adjusted set differential | -0.74 | -0.12 | -0.62 | 0.15 | 4.13 | P2 | COMPARED | COMMON_OPPONENT | RECONSTRUCTED | RECONSTRUCTED | Four-tour static history index (data/generated/tennis-runtime-index.json) |
| 032 | Break-point conversion % | 0 | 0 | — | 40 | — | UNAVAILABLE | INSUFFICIENT_SAMPLE | POINT_BY_POINT | PARTIAL | PARTIAL | BSD/Bzzoiro ATP Main PBP |
| 034 | Dominance ratio | 0.8404 | 1.0353 | -0.1949 | 0.15 | 1.30 | P2 | COMPARED | POINT_BY_POINT | PARTIAL | PARTIAL | BSD/Bzzoiro ATP Main PBP |
| 036 | Losses as favourite % | 50 | 40 | 10 | 15 | 0.67 | NEUTRAL | COMPARED | LOSS_PROFILE | RECONSTRUCTED | RECONSTRUCTED | Four-tour static history index (data/generated/tennis-runtime-index.json) |
| 041 | Elo-adjusted surplus, recent vs earlier | -0.263 | -0.164 | -0.099 | 0.1 | 0.99 | NEUTRAL | COMPARED | IMPROVEMENT_TREND | RECONSTRUCTED | RECONSTRUCTED | Four-tour static history index (data/generated/tennis-runtime-index.json) |
| 045 | Deciding-set win % as pre-match favourite | — | — | — | 25 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | SET_PROFILE | UNAVAILABLE | UNAVAILABLE | — |
| 051 | Opponent-specific win probability % | 50 | 50 | 0 | 3 | 0.00 | NEUTRAL | COMPARED | H2H_PROBABILITY | RECONSTRUCTED | RECONSTRUCTED | Four-tour static history index (data/generated/tennis-runtime-index.json) |
| 053 | Pressure index % | 43.9024 | 34.0909 | 9.8115 | 18 | 0.55 | NEUTRAL | COMPARED | POINT_BY_POINT | PARTIAL | PARTIAL | BSD/Bzzoiro ATP Main PBP |
| 055 | Elo change over last 10 | -136.16 | -21.45 | -114.71 | 20 | 5.74 | P2 | COMPARED | RECENT_FORM | PARTIAL | PARTIAL | PredixSport public tennis ratings (CC BY 4.0) |
| 068 | Current win/loss streak (signed match count) | 1 | -4 | 5 | 5 | 1.00 | NEUTRAL | COMPARED | RECENT_FORM | PARTIAL | PARTIAL | runtime:atp_main |
| 080 | Common-opponent net divergent outcomes | 11 | -11 | 22 | 1 | 22.00 | P1 | COMPARED | COMMON_OPPONENT | PARTIAL | PARTIAL | runtime:atp_main |

</details>

### Max Schoenhaus vs Alvaro Guillen Meza

- match_id `d65600bc-5368-4f61-905c-2ea35eb55068` · audit_run_id `3dc12640-ceac-439e-b5fa-9e0de3d7b1ab` · ATP Challenger Como Round of 32 (Clay)
- stored: **INSUFFICIENT EVIDENCE** / colour INSUFFICIENT EVIDENCE / independent_winner null
- stage that caused the refusal: **PERSISTENCE (stored verdict predates the Stress fix; production has not re-run this match)**

| | P1 Max Schoenhaus | P2 Alvaro Guillen Meza |
| --- | --- | --- |
| supporting families | CLOSING_ABILITY, LOSS_PROFILE, RECENT_FORM | IMPROVEMENT_TREND, RESULTS_HISTORY |
| contradicting families | IMPROVEMENT_TREND, RESULTS_HISTORY | CLOSING_ABILITY, LOSS_PROFILE, RECENT_FORM |
| directional share (unrounded) | 60% | 40% |
| reaches 60% | YES | no |
| verification: families supporting | CLOSING_ABILITY, LOSS_PROFILE, RECENT_FORM | IMPROVEMENT_TREND, RESULTS_HISTORY |
| verification: metrics not compared — own supply failure / refused on sample floor / supplied-but-unused | 8 / 3 / 3 | 7 / 3 / 4 |
| disagreement: families against this player | IMPROVEMENT_TREND(MINOR), RESULTS_HISTORY(MINOR) | CLOSING_ABILITY(MAJOR), LOSS_PROFILE(MODERATE), RECENT_FORM(MODERATE) |
| disagreement: overall severity | MODERATE | CRITICAL |
| underdog: pathways | FAVORITE_COLLAPSE(STRONG_PATHWAY, 4x), LOSS_PROFILE_ADVANTAGE(VIABLE_PATHWAY, 2.613x), RECENT_FORM_ADVANTAGE(VIABLE_PATHWAY, 2x) (STRONG_PATHWAY) | IMPROVEMENT_TREND_ADVANTAGE(POTENTIAL_PATHWAY, 1.99x), RESULTS_HISTORY_ADVANTAGE(POTENTIAL_PATHWAY, 1.372x) (VIABLE_PATHWAY) |
| underdog: evaluated by production | false | true |
| stress: support before → after | 60% → 50% | 40% → 0% |
| stress: status | FRAGILE | REVERSED |
| stress: outcome when THIS side is stressed | INSUFFICIENT | P1 |
| stress: run by production | true | true |
| stress: families manufactured out of NEUTRAL | — | — |

Conflicted families: — · neutral: COMMON_OPPONENT, H2H_PROBABILITY, PSYCH_RESPONSE, SURFACE_STRENGTH · directional denominator: 5

**Stage trace** — family vote `P1` → threshold `P1` → leave-one-family-out `P1` → verification `P1` → disagreement `P1` → underdog `P1` → stress `P1` → stored `INSUFFICIENT`. Symmetric stress verdict: `LEADER_MORE_ROBUST`.

**Why:** The decision core selected P1 at 60.000000% of the directional evidence, cleared the 60% threshold, survived leave-one-family-out, and now survives the corrected two-sided Stress evaluation as well (comparative_robustness=LEADER_MORE_ROBUST, never CHALLENGER_MORE_ROBUST). The persisted row still reads INSUFFICIENT EVIDENCE only because this read-only reconstruction, per its production-safety constraints, never writes to production -- the real pipeline has not re-run this match since the fix.

> Thin evidence supply: only 11 of 25 active metrics were comparable; 11 never yielded comparable evidence (TREATMENT_NOT_USABLE x8, VALUE_NOT_PARSEABLE x3).

> P1/P2 carry no canonical player_id on this match; side identity rests on name and column position alone.

<details><summary>Per-metric evidence (P1 vs P2)</summary>

| code | metric | P1 | P2 | diff | noise floor | ×floor | favours | status | family | P1 treatment | P2 treatment | source |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 001 | Surface Elo | 1488.93 | 1488.52 | 0.41 | 10 | 0.04 | NEUTRAL | COMPARED | SURFACE_STRENGTH | DIRECT | DIRECT | PredixSport public tennis ratings (CC BY 4.0) |
| 002 | Service point win % | — | — | — | 10 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | UNAVAILABLE | — |
| 003 | Return point win % | — | — | — | 10 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | UNAVAILABLE | — |
| 005 | Last-10 win % | 40 | 30 | 10 | 5 | 2.00 | P1 | COMPARED | RECENT_FORM | PARTIAL | PARTIAL | TennisMyLife ATP Challenger |
| 006 | Bad-loss rate % | 0 | 0 | — | 25 | — | UNAVAILABLE | INSUFFICIENT_SAMPLE | LOSS_PROFILE | PARTIAL | PARTIAL | PredixSport public tennis ratings (CC BY 4.0) |
| 007 | Common-opponent win % | 60 | 54.55 | — | 20 | — | UNAVAILABLE | INSUFFICIENT_SAMPLE | COMMON_OPPONENT | RECONSTRUCTED | RECONSTRUCTED | TennisMyLife ATP Challenger |
| 008 | Deciding-set win % | — | — | — | 5 | — | UNAVAILABLE | VALUE_NOT_PARSEABLE | SET_PROFILE | DIRECT | DIRECT | PredixSport public tennis ratings (CC BY 4.0) |
| 009 | Pressure point win % | — | — | — | 18 | — | UNAVAILABLE | VALUE_NOT_PARSEABLE | POINT_BY_POINT | DIRECT | DIRECT | PredixSport public tennis ratings (CC BY 4.0) |
| 010 | Straight-set win % | — | — | — | 5 | — | UNAVAILABLE | VALUE_NOT_PARSEABLE | SET_PROFILE | DIRECT | DIRECT | PredixSport public tennis ratings (CC BY 4.0) |
| 011 | Match win % | 43.48 | 50.34 | -6.86 | 5 | 1.37 | P2 | COMPARED | RESULTS_HISTORY | RECONSTRUCTED | RECONSTRUCTED | TennisMyLife ATP Challenger |
| 016 | Break-point score-state win % | — | — | — | 24 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | UNAVAILABLE | — |
| 018 | Breakback rate % | — | — | — | 40 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | UNAVAILABLE | — |
| 027 | Lead protection % | 70 | 50 | 20 | 5 | 4.00 | P1 | COMPARED | CLOSING_ABILITY | RECONSTRUCTED | RECONSTRUCTED | Four-tour static history index (data/generated/tennis-runtime-index.json) |
| 029 | Response after a close set loss, vs own baseline | -31.8 | -25.9 | -5.9 | 25 | 0.24 | NEUTRAL | COMPARED | PSYCH_RESPONSE | RECONSTRUCTED | RECONSTRUCTED | Four-tour static history index (data/generated/tennis-runtime-index.json) |
| 031 | Opponent-adjusted set differential | 0.32999999999999996 | 0.45 | -0.12 | 0.15 | 0.80 | NEUTRAL | COMPARED | COMMON_OPPONENT | RECONSTRUCTED | RECONSTRUCTED | Four-tour static history index (data/generated/tennis-runtime-index.json) |
| 032 | Break-point conversion % | — | — | — | 40 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | UNAVAILABLE | — |
| 034 | Dominance ratio | — | — | — | 0.15 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | UNAVAILABLE | — |
| 036 | Losses as favourite % | 30.8 | 70 | -39.2 | 15 | 2.61 | P1 | COMPARED | LOSS_PROFILE | RECONSTRUCTED | RECONSTRUCTED | Four-tour static history index (data/generated/tennis-runtime-index.json) |
| 041 | Elo-adjusted surplus, recent vs earlier | -0.168 | 0.031000000000000028 | -0.199 | 0.1 | 1.99 | P2 | COMPARED | IMPROVEMENT_TREND | RECONSTRUCTED | RECONSTRUCTED | Four-tour static history index (data/generated/tennis-runtime-index.json) |
| 045 | Deciding-set win % as pre-match favourite | 25 | 42.4 | — | 25 | — | UNAVAILABLE | INSUFFICIENT_SAMPLE | SET_PROFILE | RECONSTRUCTED | RECONSTRUCTED | Four-tour static history index (data/generated/tennis-runtime-index.json) |
| 051 | Opponent-specific win probability % | 50 | 50 | 0 | 3 | 0.00 | NEUTRAL | COMPARED | H2H_PROBABILITY | RECONSTRUCTED | RECONSTRUCTED | Four-tour static history index (data/generated/tennis-runtime-index.json) |
| 053 | Pressure index % | — | — | — | 18 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | UNAVAILABLE | — |
| 055 | Elo change over last 10 | — | — | — | 20 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | RECENT_FORM | UNAVAILABLE | PARTIAL | PredixSport public tennis ratings (CC BY 4.0) |
| 068 | Current win/loss streak (signed match count) | 1 | 1 | 0 | 5 | 0.00 | NEUTRAL | COMPARED | RECENT_FORM | PARTIAL | PARTIAL | TennisMyLife ATP Challenger |
| 080 | Common-opponent net divergent outcomes | 0 | 0 | 0 | 1 | 0.00 | NEUTRAL | COMPARED | COMMON_OPPONENT | PARTIAL | PARTIAL | TennisMyLife ATP Challenger |

</details>

### Benjamin Hassan vs Francesco Forti

- match_id `375d016c-0758-4549-a38f-7b856d2f1083` · audit_run_id `44db0833-d3fb-4098-a816-90c682b5cbe7` · ATP Challenger Como Qualifying Round 2 (Clay)
- stored: **INSUFFICIENT EVIDENCE** / colour INSUFFICIENT EVIDENCE / independent_winner null
- stage that caused the refusal: **PERSISTENCE (stored verdict predates the Stress fix; production has not re-run this match)**

| | P1 Benjamin Hassan | P2 Francesco Forti |
| --- | --- | --- |
| supporting families | CLOSING_ABILITY, COMMON_OPPONENT, H2H_PROBABILITY, RESULTS_HISTORY, SURFACE_STRENGTH | LOSS_PROFILE, RECENT_FORM |
| contradicting families | LOSS_PROFILE, RECENT_FORM | CLOSING_ABILITY, COMMON_OPPONENT, H2H_PROBABILITY, RESULTS_HISTORY, SURFACE_STRENGTH |
| directional share (unrounded) | 71.4286% | 28.5714% |
| reaches 60% | YES | no |
| verification: families supporting | CLOSING_ABILITY, COMMON_OPPONENT, H2H_PROBABILITY, RESULTS_HISTORY, SURFACE_STRENGTH | LOSS_PROFILE, RECENT_FORM |
| verification: metrics not compared — own supply failure / refused on sample floor / supplied-but-unused | 0 / 4 / 3 | 0 / 4 / 3 |
| disagreement: families against this player | LOSS_PROFILE(MODERATE), RECENT_FORM(MAJOR) | CLOSING_ABILITY(MODERATE), COMMON_OPPONENT(MODERATE), H2H_PROBABILITY(MODERATE), RESULTS_HISTORY(MODERATE), SURFACE_STRENGTH(CRITICAL) |
| disagreement: overall severity | CRITICAL | CRITICAL |
| underdog: pathways | FAVORITE_COLLAPSE(VIABLE_PATHWAY, 3.5x), COMMON_OPPONENT_ADVANTAGE(VIABLE_PATHWAY, 2x), MATCHUP_TACTICAL_ADVANTAGE(VIABLE_PATHWAY, 3.733x), RESULTS_HISTORY_ADVANTAGE(VIABLE_PATHWAY, 2.784x), SURFACE_ADVANTAGE(STRONG_PATHWAY, 11.359x) (STRONG_PATHWAY) | LOSS_PROFILE_ADVANTAGE(VIABLE_PATHWAY, 3.333x), RECENT_FORM_ADVANTAGE(STRONG_PATHWAY, 4.568x) (STRONG_PATHWAY) |
| underdog: evaluated by production | false | true |
| stress: support before → after | 71.4% → 66.7% | 28.6% → 28.6% |
| stress: status | ROBUST | REVERSED |
| stress: outcome when THIS side is stressed | P1 | P1 |
| stress: run by production | true | true |
| stress: families manufactured out of NEUTRAL | — | — |

Conflicted families: — · neutral: IMPROVEMENT_TREND, POINT_BY_POINT, PSYCH_RESPONSE · directional denominator: 7

**Stage trace** — family vote `P1` → threshold `P1` → leave-one-family-out `P1` → verification `P1` → disagreement `P1` → underdog `P1` → stress `P1` → stored `INSUFFICIENT`. Symmetric stress verdict: `BOTH_SURVIVE`.

**Why:** The decision core selected P1 at 71.428571% of the directional evidence, cleared the 60% threshold, survived leave-one-family-out, and now survives the corrected two-sided Stress evaluation as well (comparative_robustness=BOTH_SURVIVE, never CHALLENGER_MORE_ROBUST). The persisted row still reads INSUFFICIENT EVIDENCE only because this read-only reconstruction, per its production-safety constraints, never writes to production -- the real pipeline has not re-run this match since the fix.

> P1/P2 carry no canonical player_id on this match; side identity rests on name and column position alone.

<details><summary>Per-metric evidence (P1 vs P2)</summary>

| code | metric | P1 | P2 | diff | noise floor | ×floor | favours | status | family | P1 treatment | P2 treatment | source |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 001 | Surface Elo | 1606.44 | 1492.85 | 113.59 | 10 | 11.36 | P1 | COMPARED | SURFACE_STRENGTH | DIRECT | DIRECT | PredixSport public tennis ratings (CC BY 4.0) |
| 002 | Service point win % | 58.6207 | 63.0631 | -4.4424 | 10 | 0.44 | NEUTRAL | COMPARED | POINT_BY_POINT | PARTIAL | PARTIAL | BSD/Bzzoiro ATP Challenger PBP |
| 003 | Return point win % | 35.1852 | 40.8 | -5.6148 | 10 | 0.56 | NEUTRAL | COMPARED | POINT_BY_POINT | PARTIAL | PARTIAL | BSD/Bzzoiro ATP Challenger PBP |
| 005 | Last-10 win % | 40 | 60 | -20 | 5 | 4.00 | P2 | COMPARED | RECENT_FORM | PARTIAL | PARTIAL | TennisMyLife ATP Challenger |
| 006 | Bad-loss rate % | 0 | 0 | — | 25 | — | UNAVAILABLE | INSUFFICIENT_SAMPLE | LOSS_PROFILE | PARTIAL | PARTIAL | PredixSport public tennis ratings (CC BY 4.0) |
| 007 | Common-opponent win % | 38.46 | 39.13 | -0.67 | 20 | 0.03 | NEUTRAL | COMPARED | COMMON_OPPONENT | RECONSTRUCTED | RECONSTRUCTED | TennisMyLife ATP Challenger |
| 008 | Deciding-set win % | — | — | — | 5 | — | UNAVAILABLE | VALUE_NOT_PARSEABLE | SET_PROFILE | DIRECT | DIRECT | PredixSport public tennis ratings (CC BY 4.0) |
| 009 | Pressure point win % | — | — | — | 18 | — | UNAVAILABLE | VALUE_NOT_PARSEABLE | POINT_BY_POINT | DIRECT | DIRECT | PredixSport public tennis ratings (CC BY 4.0) |
| 010 | Straight-set win % | — | — | — | 5 | — | UNAVAILABLE | VALUE_NOT_PARSEABLE | SET_PROFILE | DIRECT | DIRECT | PredixSport public tennis ratings (CC BY 4.0) |
| 011 | Match win % | 52.08 | 38.16 | 13.92 | 5 | 2.78 | P1 | COMPARED | RESULTS_HISTORY | RECONSTRUCTED | RECONSTRUCTED | TennisMyLife ATP Challenger |
| 016 | Break-point score-state win % | 62.5 | 54.5455 | 7.9545 | 24 | 0.33 | NEUTRAL | COMPARED | POINT_BY_POINT | PARTIAL | PARTIAL | BSD/Bzzoiro ATP Challenger PBP |
| 018 | Breakback rate % | 0 | 100 | — | 40 | — | UNAVAILABLE | INSUFFICIENT_SAMPLE | POINT_BY_POINT | RECONSTRUCTED | RECONSTRUCTED | BSD/Bzzoiro ATP Challenger PBP |
| 027 | Lead protection % | 87.5 | 70 | 17.5 | 5 | 3.50 | P1 | COMPARED | CLOSING_ABILITY | RECONSTRUCTED | RECONSTRUCTED | Four-tour static history index (data/generated/tennis-runtime-index.json) |
| 029 | Response after a close set loss, vs own baseline | -35 | -17.8 | -17.2 | 25 | 0.69 | NEUTRAL | COMPARED | PSYCH_RESPONSE | RECONSTRUCTED | RECONSTRUCTED | Four-tour static history index (data/generated/tennis-runtime-index.json) |
| 031 | Opponent-adjusted set differential | -0.49000000000000005 | -0.52 | 0.03 | 0.15 | 0.20 | NEUTRAL | COMPARED | COMMON_OPPONENT | RECONSTRUCTED | RECONSTRUCTED | Four-tour static history index (data/generated/tennis-runtime-index.json) |
| 032 | Break-point conversion % | 0 | 0 | — | 40 | — | UNAVAILABLE | INSUFFICIENT_SAMPLE | POINT_BY_POINT | PARTIAL | PARTIAL | BSD/Bzzoiro ATP Challenger PBP |
| 034 | Dominance ratio | 0.9199 | 0.8303 | 0.0896 | 0.15 | 0.60 | NEUTRAL | COMPARED | POINT_BY_POINT | PARTIAL | PARTIAL | BSD/Bzzoiro ATP Challenger PBP |
| 036 | Losses as favourite % | 55 | 5 | 50 | 15 | 3.33 | P2 | COMPARED | LOSS_PROFILE | RECONSTRUCTED | RECONSTRUCTED | Four-tour static history index (data/generated/tennis-runtime-index.json) |
| 041 | Elo-adjusted surplus, recent vs earlier | 0.194 | 0.215 | -0.021 | 0.1 | 0.21 | NEUTRAL | COMPARED | IMPROVEMENT_TREND | RECONSTRUCTED | RECONSTRUCTED | Four-tour static history index (data/generated/tennis-runtime-index.json) |
| 045 | Deciding-set win % as pre-match favourite | 63 | 50 | — | 25 | — | UNAVAILABLE | INSUFFICIENT_SAMPLE | SET_PROFILE | RECONSTRUCTED | RECONSTRUCTED | Four-tour static history index (data/generated/tennis-runtime-index.json) |
| 051 | Opponent-specific win probability % | 55.6 | 44.4 | 11.2 | 3 | 3.73 | P1 | COMPARED | H2H_PROBABILITY | RECONSTRUCTED | RECONSTRUCTED | Four-tour static history index (data/generated/tennis-runtime-index.json) |
| 053 | Pressure index % | 52.381 | 54.8387 | -2.4577 | 18 | 0.14 | NEUTRAL | COMPARED | POINT_BY_POINT | PARTIAL | PARTIAL | BSD/Bzzoiro ATP Challenger PBP |
| 055 | Elo change over last 10 | -83.06 | 8.3 | -91.36 | 20 | 4.57 | P2 | COMPARED | RECENT_FORM | PARTIAL | PARTIAL | PredixSport public tennis ratings (CC BY 4.0) |
| 068 | Current win/loss streak (signed match count) | -1 | 1 | -2 | 5 | 0.40 | NEUTRAL | COMPARED | RECENT_FORM | PARTIAL | PARTIAL | TennisMyLife ATP Challenger |
| 080 | Common-opponent net divergent outcomes | 1 | -1 | 2 | 1 | 2.00 | P1 | COMPARED | COMMON_OPPONENT | PARTIAL | PARTIAL | TennisMyLife ATP Challenger |

</details>

### Federico Bondioli vs Federico Arnaboldi

- match_id `7b46b1b4-44c8-4b9d-b378-78e440836a71` · audit_run_id `4881674b-ed2c-45c3-ad08-1f518c1aeb57` · ATP Challenger Como Round of 32 (Clay)
- stored: **INSUFFICIENT EVIDENCE** / colour INSUFFICIENT EVIDENCE / independent_winner null
- stage that caused the refusal: **PERSISTENCE (stored verdict predates the Stress fix; production has not re-run this match)**

| | P1 Federico Bondioli | P2 Federico Arnaboldi |
| --- | --- | --- |
| supporting families | CLOSING_ABILITY, RECENT_FORM | COMMON_OPPONENT, POINT_BY_POINT, SURFACE_STRENGTH |
| contradicting families | COMMON_OPPONENT, POINT_BY_POINT, SURFACE_STRENGTH | CLOSING_ABILITY, RECENT_FORM |
| directional share (unrounded) | 40% | 60% |
| reaches 60% | no | YES |
| verification: families supporting | CLOSING_ABILITY, RECENT_FORM | COMMON_OPPONENT, POINT_BY_POINT, SURFACE_STRENGTH |
| verification: metrics not compared — own supply failure / refused on sample floor / supplied-but-unused | 3 / 2 / 3 | 2 / 2 / 4 |
| disagreement: families against this player | COMMON_OPPONENT(MODERATE), POINT_BY_POINT(MINOR), SURFACE_STRENGTH(MODERATE) | CLOSING_ABILITY(MAJOR), RECENT_FORM(CRITICAL) |
| disagreement: overall severity | CRITICAL | CRITICAL |
| underdog: pathways | FAVORITE_COLLAPSE(STRONG_PATHWAY, 5x), RECENT_FORM_ADVANTAGE(STRONG_PATHWAY, 10x) (STRONG_PATHWAY) | COMMON_OPPONENT_ADVANTAGE(VIABLE_PATHWAY, 2x), POINT_BY_POINT_ADVANTAGE(POTENTIAL_PATHWAY, 1.933x), SURFACE_ADVANTAGE(VIABLE_PATHWAY, 2.416x) (STRONG_PATHWAY) |
| underdog: evaluated by production | true | false |
| stress: support before → after | 40% → 40% | 60% → 33.3% |
| stress: status | REVERSED | REVERSED |
| stress: outcome when THIS side is stressed | P2 | P1 |
| stress: run by production | true | true |
| stress: families manufactured out of NEUTRAL | — | — |

Conflicted families: — · neutral: H2H_PROBABILITY, IMPROVEMENT_TREND, LOSS_PROFILE, PSYCH_RESPONSE, RESULTS_HISTORY · directional denominator: 5

**Stage trace** — family vote `P2` → threshold `P2` → leave-one-family-out `P2` → verification `P2` → disagreement `P2` → underdog `P2` → stress `P2` → stored `INSUFFICIENT`. Symmetric stress verdict: `NON_DISCRIMINATING`.

**Why:** The decision core selected P2 at 60.000000% of the directional evidence, cleared the 60% threshold, survived leave-one-family-out, and now survives the corrected two-sided Stress evaluation as well (comparative_robustness=NON_DISCRIMINATING, never CHALLENGER_MORE_ROBUST). The persisted row still reads INSUFFICIENT EVIDENCE only because this read-only reconstruction, per its production-safety constraints, never writes to production -- the real pipeline has not re-run this match since the fix.

> P1/P2 carry no canonical player_id on this match; side identity rests on name and column position alone.

<details><summary>Per-metric evidence (P1 vs P2)</summary>

| code | metric | P1 | P2 | diff | noise floor | ×floor | favours | status | family | P1 treatment | P2 treatment | source |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 001 | Surface Elo | 1533.8 | 1557.96 | -24.16 | 10 | 2.42 | P2 | COMPARED | SURFACE_STRENGTH | DIRECT | DIRECT | PredixSport public tennis ratings (CC BY 4.0) |
| 002 | Service point win % | 52.459 | 51.2821 | 1.1769 | 10 | 0.12 | NEUTRAL | COMPARED | POINT_BY_POINT | PARTIAL | PARTIAL | BSD/Bzzoiro ATP Challenger PBP |
| 003 | Return point win % | 34.2105 | 42.4658 | -8.2553 | 10 | 0.83 | NEUTRAL | COMPARED | POINT_BY_POINT | PARTIAL | PARTIAL | BSD/Bzzoiro ATP Challenger PBP |
| 005 | Last-10 win % | 70 | 20 | 50 | 5 | 10.00 | P1 | COMPARED | RECENT_FORM | PARTIAL | PARTIAL | TennisMyLife ATP Challenger |
| 006 | Bad-loss rate % | 0 | 0 | — | 25 | — | UNAVAILABLE | INSUFFICIENT_SAMPLE | LOSS_PROFILE | PARTIAL | PARTIAL | PredixSport public tennis ratings (CC BY 4.0) |
| 007 | Common-opponent win % | 61.54 | 60 | 1.54 | 20 | 0.08 | NEUTRAL | COMPARED | COMMON_OPPONENT | RECONSTRUCTED | RECONSTRUCTED | TennisMyLife ATP Challenger |
| 008 | Deciding-set win % | — | — | — | 5 | — | UNAVAILABLE | VALUE_NOT_PARSEABLE | SET_PROFILE | DIRECT | DIRECT | PredixSport public tennis ratings (CC BY 4.0) |
| 009 | Pressure point win % | — | — | — | 18 | — | UNAVAILABLE | VALUE_NOT_PARSEABLE | POINT_BY_POINT | DIRECT | DIRECT | PredixSport public tennis ratings (CC BY 4.0) |
| 010 | Straight-set win % | — | — | — | 5 | — | UNAVAILABLE | VALUE_NOT_PARSEABLE | SET_PROFILE | DIRECT | DIRECT | PredixSport public tennis ratings (CC BY 4.0) |
| 011 | Match win % | 40.43 | 38.2 | 2.23 | 5 | 0.45 | NEUTRAL | COMPARED | RESULTS_HISTORY | RECONSTRUCTED | RECONSTRUCTED | TennisMyLife ATP Challenger |
| 016 | Break-point score-state win % | — | — | — | 24 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | UNAVAILABLE | — |
| 018 | Breakback rate % | — | — | — | 40 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | UNAVAILABLE | — |
| 027 | Lead protection % | 75 | 50 | 25 | 5 | 5.00 | P1 | COMPARED | CLOSING_ABILITY | RECONSTRUCTED | RECONSTRUCTED | Four-tour static history index (data/generated/tennis-runtime-index.json) |
| 029 | Response after a close set loss, vs own baseline | -12.5 | 0.40000000000000036 | -12.9 | 25 | 0.52 | NEUTRAL | COMPARED | PSYCH_RESPONSE | RECONSTRUCTED | RECONSTRUCTED | Four-tour static history index (data/generated/tennis-runtime-index.json) |
| 031 | Opponent-adjusted set differential | 0.09 | 0.03 | 0.06 | 0.15 | 0.40 | NEUTRAL | COMPARED | COMMON_OPPONENT | RECONSTRUCTED | RECONSTRUCTED | Four-tour static history index (data/generated/tennis-runtime-index.json) |
| 032 | Break-point conversion % | — | — | — | 40 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | PARTIAL | BSD/Bzzoiro ATP Challenger PBP |
| 034 | Dominance ratio | 0.5685 | 0.8584 | -0.2899 | 0.15 | 1.93 | P2 | COMPARED | POINT_BY_POINT | PARTIAL | PARTIAL | BSD/Bzzoiro ATP Challenger PBP |
| 036 | Losses as favourite % | 10 | 15 | -5 | 15 | 0.33 | NEUTRAL | COMPARED | LOSS_PROFILE | RECONSTRUCTED | RECONSTRUCTED | Four-tour static history index (data/generated/tennis-runtime-index.json) |
| 041 | Elo-adjusted surplus, recent vs earlier | 0.188 | 0.17000000000000004 | 0.018 | 0.1 | 0.18 | NEUTRAL | COMPARED | IMPROVEMENT_TREND | RECONSTRUCTED | RECONSTRUCTED | Four-tour static history index (data/generated/tennis-runtime-index.json) |
| 045 | Deciding-set win % as pre-match favourite | 20 | 100 | — | 25 | — | UNAVAILABLE | INSUFFICIENT_SAMPLE | SET_PROFILE | RECONSTRUCTED | RECONSTRUCTED | Four-tour static history index (data/generated/tennis-runtime-index.json) |
| 051 | Opponent-specific win probability % | 50 | 50 | 0 | 3 | 0.00 | NEUTRAL | COMPARED | H2H_PROBABILITY | RECONSTRUCTED | RECONSTRUCTED | Four-tour static history index (data/generated/tennis-runtime-index.json) |
| 053 | Pressure index % | 75 | 58.5366 | 16.4634 | 18 | 0.91 | NEUTRAL | COMPARED | POINT_BY_POINT | PARTIAL | PARTIAL | BSD/Bzzoiro ATP Challenger PBP |
| 055 | Elo change over last 10 | 39.07 | 47.35 | -8.28 | 20 | 0.41 | NEUTRAL | COMPARED | RECENT_FORM | PARTIAL | PARTIAL | PredixSport public tennis ratings (CC BY 4.0) |
| 068 | Current win/loss streak (signed match count) | 4 | -6 | 10 | 5 | 2.00 | P1 | COMPARED | RECENT_FORM | PARTIAL | PARTIAL | TennisMyLife ATP Challenger |
| 080 | Common-opponent net divergent outcomes | -1 | 1 | -2 | 1 | 2.00 | P2 | COMPARED | COMMON_OPPONENT | PARTIAL | PARTIAL | TennisMyLife ATP Challenger |

</details>

### Hugo Dellien vs Matej Dodig

- match_id `57489d33-9793-4829-91cc-4c45fd8d72db` · audit_run_id `65e3d63e-8474-40d5-94ab-92c1e52f0889` · ATP Challenger Genoa Round 2 (Clay)
- stored: **INSUFFICIENT EVIDENCE** / colour INSUFFICIENT EVIDENCE / independent_winner null
- stage that caused the refusal: **PERSISTENCE (stored verdict predates the Stress fix; production has not re-run this match)**

| | P1 Hugo Dellien | P2 Matej Dodig |
| --- | --- | --- |
| supporting families | COMMON_OPPONENT, H2H_PROBABILITY, RESULTS_HISTORY, SURFACE_STRENGTH | LOSS_PROFILE |
| contradicting families | LOSS_PROFILE | COMMON_OPPONENT, H2H_PROBABILITY, RESULTS_HISTORY, SURFACE_STRENGTH |
| directional share (unrounded) | 80% | 20% |
| reaches 60% | YES | no |
| verification: families supporting | COMMON_OPPONENT, H2H_PROBABILITY, RESULTS_HISTORY, SURFACE_STRENGTH | LOSS_PROFILE |
| verification: metrics not compared — own supply failure / refused on sample floor / supplied-but-unused | 5 / 2 / 5 | 7 / 2 / 3 |
| disagreement: families against this player | LOSS_PROFILE(MODERATE) | COMMON_OPPONENT(MODERATE), H2H_PROBABILITY(MODERATE), RESULTS_HISTORY(MODERATE), SURFACE_STRENGTH(MINOR) |
| disagreement: overall severity | MODERATE | CRITICAL |
| underdog: pathways | COMMON_OPPONENT_ADVANTAGE(VIABLE_PATHWAY, 2x), MATCHUP_TACTICAL_ADVANTAGE(VIABLE_PATHWAY, 3.733x), RESULTS_HISTORY_ADVANTAGE(VIABLE_PATHWAY, 3.346x), SURFACE_ADVANTAGE(POTENTIAL_PATHWAY, 1.541x) (STRONG_PATHWAY) | LOSS_PROFILE_ADVANTAGE(VIABLE_PATHWAY, 2.667x) (VIABLE_PATHWAY) |
| underdog: evaluated by production | false | true |
| stress: support before → after | 80% → 66.7% | 20% → 20% |
| stress: status | ROBUST | REVERSED |
| stress: outcome when THIS side is stressed | P1 | P1 |
| stress: run by production | true | true |
| stress: families manufactured out of NEUTRAL | — | — |

Conflicted families: — · neutral: CLOSING_ABILITY, IMPROVEMENT_TREND, RECENT_FORM, SET_PROFILE · directional denominator: 5

**Stage trace** — family vote `P1` → threshold `P1` → leave-one-family-out `P1` → verification `P1` → disagreement `P1` → underdog `P1` → stress `P1` → stored `INSUFFICIENT`. Symmetric stress verdict: `BOTH_SURVIVE`.

**Why:** The decision core selected P1 at 80.000000% of the directional evidence, cleared the 60% threshold, survived leave-one-family-out, and now survives the corrected two-sided Stress evaluation as well (comparative_robustness=BOTH_SURVIVE, never CHALLENGER_MORE_ROBUST). The persisted row still reads INSUFFICIENT EVIDENCE only because this read-only reconstruction, per its production-safety constraints, never writes to production -- the real pipeline has not re-run this match since the fix.

> P1/P2 carry no canonical player_id on this match; side identity rests on name and column position alone.

<details><summary>Per-metric evidence (P1 vs P2)</summary>

| code | metric | P1 | P2 | diff | noise floor | ×floor | favours | status | family | P1 treatment | P2 treatment | source |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 001 | Surface Elo | 1523.57 | 1508.16 | 15.41 | 10 | 1.54 | P1 | COMPARED | SURFACE_STRENGTH | DIRECT | DIRECT | PredixSport public tennis ratings (CC BY 4.0) |
| 002 | Service point win % | — | — | — | 10 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | DIRECT | UNAVAILABLE | DataHub ATP World Tour tennis data (CC BY 4.0) |
| 003 | Return point win % | — | — | — | 10 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | DIRECT | UNAVAILABLE | DataHub ATP World Tour tennis data (CC BY 4.0) |
| 005 | Last-10 win % | 80 | 80 | 0 | 5 | 0.00 | NEUTRAL | COMPARED | RECENT_FORM | PARTIAL | PARTIAL | TennisMyLife ATP Challenger |
| 006 | Bad-loss rate % | 0 | 0 | — | 25 | — | UNAVAILABLE | INSUFFICIENT_SAMPLE | LOSS_PROFILE | PARTIAL | PARTIAL | PredixSport public tennis ratings (CC BY 4.0) |
| 007 | Common-opponent win % | 48.15 | 50 | -1.85 | 20 | 0.09 | NEUTRAL | COMPARED | COMMON_OPPONENT | RECONSTRUCTED | RECONSTRUCTED | TennisMyLife ATP Challenger |
| 008 | Deciding-set win % | — | — | — | 5 | — | UNAVAILABLE | VALUE_NOT_PARSEABLE | SET_PROFILE | DIRECT | DIRECT | PredixSport public tennis ratings (CC BY 4.0) |
| 009 | Pressure point win % | — | — | — | 18 | — | UNAVAILABLE | VALUE_NOT_PARSEABLE | POINT_BY_POINT | DIRECT | DIRECT | PredixSport public tennis ratings (CC BY 4.0) |
| 010 | Straight-set win % | — | — | — | 5 | — | UNAVAILABLE | VALUE_NOT_PARSEABLE | SET_PROFILE | DIRECT | DIRECT | PredixSport public tennis ratings (CC BY 4.0) |
| 011 | Match win % | 68.62 | 51.89 | 16.73 | 5 | 3.35 | P1 | COMPARED | RESULTS_HISTORY | RECONSTRUCTED | RECONSTRUCTED | TennisMyLife ATP Challenger |
| 016 | Break-point score-state win % | — | — | — | 24 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | UNAVAILABLE | — |
| 018 | Breakback rate % | — | — | — | 40 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | UNAVAILABLE | — |
| 027 | Lead protection % | 83.3 | 81.8 | 1.5 | 5 | 0.30 | NEUTRAL | COMPARED | CLOSING_ABILITY | RECONSTRUCTED | RECONSTRUCTED | Four-tour static history index (data/generated/tennis-runtime-index.json) |
| 029 | Response after a close set loss, vs own baseline | -25 | -45.7 | — | 25 | — | UNAVAILABLE | INSUFFICIENT_SAMPLE | PSYCH_RESPONSE | RECONSTRUCTED | RECONSTRUCTED | Four-tour static history index (data/generated/tennis-runtime-index.json) |
| 031 | Opponent-adjusted set differential | -0.01 | -0.08 | 0.07 | 0.15 | 0.47 | NEUTRAL | COMPARED | COMMON_OPPONENT | RECONSTRUCTED | RECONSTRUCTED | Four-tour static history index (data/generated/tennis-runtime-index.json) |
| 032 | Break-point conversion % | — | — | — | 40 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | UNAVAILABLE | — |
| 034 | Dominance ratio | — | — | — | 0.15 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | UNAVAILABLE | — |
| 036 | Losses as favourite % | 90 | 50 | 40 | 15 | 2.67 | P2 | COMPARED | LOSS_PROFILE | RECONSTRUCTED | RECONSTRUCTED | Four-tour static history index (data/generated/tennis-runtime-index.json) |
| 041 | Elo-adjusted surplus, recent vs earlier | 0.10700000000000001 | 0.15699999999999997 | -0.05 | 0.1 | 0.50 | NEUTRAL | COMPARED | IMPROVEMENT_TREND | RECONSTRUCTED | RECONSTRUCTED | Four-tour static history index (data/generated/tennis-runtime-index.json) |
| 045 | Deciding-set win % as pre-match favourite | 70.7 | 57.7 | 13 | 25 | 0.52 | NEUTRAL | COMPARED | SET_PROFILE | RECONSTRUCTED | RECONSTRUCTED | Four-tour static history index (data/generated/tennis-runtime-index.json) |
| 051 | Opponent-specific win probability % | 55.6 | 44.4 | 11.2 | 3 | 3.73 | P1 | COMPARED | H2H_PROBABILITY | RECONSTRUCTED | RECONSTRUCTED | Four-tour static history index (data/generated/tennis-runtime-index.json) |
| 053 | Pressure index % | — | — | — | 18 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | UNAVAILABLE | — |
| 055 | Elo change over last 10 | 13.07 | 16.3 | -3.23 | 20 | 0.16 | NEUTRAL | COMPARED | RECENT_FORM | PARTIAL | PARTIAL | PredixSport public tennis ratings (CC BY 4.0) |
| 068 | Current win/loss streak (signed match count) | 1 | 3 | -2 | 5 | 0.40 | NEUTRAL | COMPARED | RECENT_FORM | PARTIAL | PARTIAL | TennisMyLife ATP Challenger |
| 080 | Common-opponent net divergent outcomes | 1 | -1 | 2 | 1 | 2.00 | P1 | COMPARED | COMMON_OPPONENT | PARTIAL | PARTIAL | TennisMyLife ATP Challenger |

</details>

### Giovanni Mpetshi Perricard vs Jurij Rodionov

- match_id `ec70cc14-bb7b-4508-9c8f-5359db8d1d37` · audit_run_id `73770f4e-149c-4ce8-ae11-dfe956544216` · US Open Round of 128 (Hard)
- stored: **INSUFFICIENT EVIDENCE** / colour INSUFFICIENT EVIDENCE / independent_winner null
- stage that caused the refusal: **PERSISTENCE (stored verdict predates the Stress fix; production has not re-run this match)**

| | P1 Giovanni Mpetshi Perricard | P2 Jurij Rodionov |
| --- | --- | --- |
| supporting families | — | IMPROVEMENT_TREND, RECENT_FORM, SURFACE_STRENGTH |
| contradicting families | IMPROVEMENT_TREND, RECENT_FORM, SURFACE_STRENGTH | — |
| directional share (unrounded) | 0% | 75% |
| reaches 60% | no | YES |
| verification: families supporting | — | IMPROVEMENT_TREND, RECENT_FORM, SURFACE_STRENGTH |
| verification: metrics not compared — own supply failure / refused on sample floor / supplied-but-unused | 10 / 3 / 4 | 9 / 3 / 5 |
| disagreement: families against this player | IMPROVEMENT_TREND(MAJOR), RECENT_FORM(MINOR), SURFACE_STRENGTH(MINOR) | — |
| disagreement: overall severity | CRITICAL | NONE |
| underdog: pathways | COMMON_OPPONENT_ADVANTAGE(STRONG_PATHWAY, 6x) (STRONG_PATHWAY) | COMMON_OPPONENT_ADVANTAGE(VIABLE_PATHWAY, 3.6x), IMPROVEMENT_TREND_ADVANTAGE(STRONG_PATHWAY, 4.15x), RECENT_FORM_ADVANTAGE(POTENTIAL_PATHWAY, 1.488x), SURFACE_ADVANTAGE(POTENTIAL_PATHWAY, 1.263x) (STRONG_PATHWAY) |
| underdog: evaluated by production | true | false |
| stress: support before → after | 0% → 0% | 75% → 50% |
| stress: status | REVERSED | FRAGILE |
| stress: outcome when THIS side is stressed | P2 | INSUFFICIENT |
| stress: run by production | true | true |
| stress: families manufactured out of NEUTRAL | — | — |

Conflicted families: COMMON_OPPONENT · neutral: H2H_PROBABILITY, LOSS_PROFILE · directional denominator: 4

**Stage trace** — family vote `P2` → threshold `P2` → leave-one-family-out `P2` → verification `P2` → disagreement `P2` → underdog `P2` → stress `P2` → stored `INSUFFICIENT`. Symmetric stress verdict: `LEADER_MORE_ROBUST`.

**Why:** The decision core selected P2 at 75.000000% of the directional evidence, cleared the 60% threshold, survived leave-one-family-out, and now survives the corrected two-sided Stress evaluation as well (comparative_robustness=LEADER_MORE_ROBUST, never CHALLENGER_MORE_ROBUST). The persisted row still reads INSUFFICIENT EVIDENCE only because this read-only reconstruction, per its production-safety constraints, never writes to production -- the real pipeline has not re-run this match since the fix.

> Thin evidence supply: only 8 of 25 active metrics were comparable; 14 never yielded comparable evidence (TREATMENT_NOT_USABLE x11, VALUE_NOT_PARSEABLE x3).

> P1/P2 carry no canonical player_id on this match; side identity rests on name and column position alone.

<details><summary>Per-metric evidence (P1 vs P2)</summary>

| code | metric | P1 | P2 | diff | noise floor | ×floor | favours | status | family | P1 treatment | P2 treatment | source |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 001 | Surface Elo | 1519.62 | 1532.25 | -12.63 | 10 | 1.26 | P2 | COMPARED | SURFACE_STRENGTH | DIRECT | DIRECT | PredixSport public tennis ratings (CC BY 4.0) |
| 002 | Service point win % | — | — | — | 10 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | DIRECT | DataHub ATP World Tour tennis data (CC BY 4.0) |
| 003 | Return point win % | — | — | — | 10 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | DIRECT | DataHub ATP World Tour tennis data (CC BY 4.0) |
| 005 | Last-10 win % | 40 | 40 | 0 | 5 | 0.00 | NEUTRAL | COMPARED | RECENT_FORM | PARTIAL | PARTIAL | runtime:atp_main |
| 006 | Bad-loss rate % | 0 | 0 | — | 25 | — | UNAVAILABLE | INSUFFICIENT_SAMPLE | LOSS_PROFILE | PARTIAL | PARTIAL | PredixSport public tennis ratings (CC BY 4.0) |
| 007 | Common-opponent win % | 100 | 100 | — | 20 | — | UNAVAILABLE | INSUFFICIENT_SAMPLE | COMMON_OPPONENT | RECONSTRUCTED | RECONSTRUCTED | runtime:atp_main |
| 008 | Deciding-set win % | — | — | — | 5 | — | UNAVAILABLE | VALUE_NOT_PARSEABLE | SET_PROFILE | DIRECT | DIRECT | PredixSport public tennis ratings (CC BY 4.0) |
| 009 | Pressure point win % | — | — | — | 18 | — | UNAVAILABLE | VALUE_NOT_PARSEABLE | POINT_BY_POINT | DIRECT | DIRECT | PredixSport public tennis ratings (CC BY 4.0) |
| 010 | Straight-set win % | — | — | — | 5 | — | UNAVAILABLE | VALUE_NOT_PARSEABLE | SET_PROFILE | DIRECT | DIRECT | PredixSport public tennis ratings (CC BY 4.0) |
| 011 | Match win % | — | — | — | 5 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | RESULTS_HISTORY | UNAVAILABLE | UNAVAILABLE | — |
| 016 | Break-point score-state win % | — | — | — | 24 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | UNAVAILABLE | — |
| 018 | Breakback rate % | — | — | — | 40 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | RECONSTRUCTED | UNAVAILABLE | BSD/Bzzoiro ATP Main PBP |
| 027 | Lead protection % | — | — | — | 5 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | CLOSING_ABILITY | UNAVAILABLE | UNAVAILABLE | — |
| 029 | Response after a close set loss, vs own baseline | — | — | — | 25 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | PSYCH_RESPONSE | UNAVAILABLE | UNAVAILABLE | — |
| 031 | Opponent-adjusted set differential | -0.27 | 0.27 | -0.54 | 0.15 | 3.60 | P2 | COMPARED | COMMON_OPPONENT | RECONSTRUCTED | RECONSTRUCTED | Four-tour static history index (data/generated/tennis-runtime-index.json) |
| 032 | Break-point conversion % | — | — | — | 40 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | UNAVAILABLE | — |
| 034 | Dominance ratio | — | — | — | 0.15 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | UNAVAILABLE | — |
| 036 | Losses as favourite % | 40 | 25 | 15 | 15 | 1.00 | NEUTRAL | COMPARED | LOSS_PROFILE | RECONSTRUCTED | RECONSTRUCTED | Four-tour static history index (data/generated/tennis-runtime-index.json) |
| 041 | Elo-adjusted surplus, recent vs earlier | -0.24 | 0.175 | -0.415 | 0.1 | 4.15 | P2 | COMPARED | IMPROVEMENT_TREND | RECONSTRUCTED | RECONSTRUCTED | Four-tour static history index (data/generated/tennis-runtime-index.json) |
| 045 | Deciding-set win % as pre-match favourite | — | — | — | 25 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | SET_PROFILE | UNAVAILABLE | UNAVAILABLE | — |
| 051 | Opponent-specific win probability % | 50 | 50 | 0 | 3 | 0.00 | NEUTRAL | COMPARED | H2H_PROBABILITY | RECONSTRUCTED | RECONSTRUCTED | Four-tour static history index (data/generated/tennis-runtime-index.json) |
| 053 | Pressure index % | — | — | — | 18 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | UNAVAILABLE | — |
| 055 | Elo change over last 10 | -68.28 | -38.51 | -29.77 | 20 | 1.49 | P2 | COMPARED | RECENT_FORM | PARTIAL | PARTIAL | PredixSport public tennis ratings (CC BY 4.0) |
| 068 | Current win/loss streak (signed match count) | 1 | 1 | — | 5 | — | UNAVAILABLE | INSUFFICIENT_SAMPLE | RECENT_FORM | PARTIAL | PARTIAL | runtime:atp_main |
| 080 | Common-opponent net divergent outcomes | 3 | -3 | 6 | 1 | 6.00 | P1 | COMPARED | COMMON_OPPONENT | PARTIAL | PARTIAL | runtime:atp_main |

</details>

### Hubert Hurkacz vs Damir Dzumhur

- match_id `49cdf56a-b194-474c-bf6c-6da53c3fd9d1` · audit_run_id `91b35a18-0049-4eb0-9ab2-83637564b26f` · US Open Round of 128 (Hard)
- stored: **INSUFFICIENT EVIDENCE** / colour INSUFFICIENT EVIDENCE / independent_winner null
- stage that caused the refusal: **PERSISTENCE (stored verdict predates the Stress fix; production has not re-run this match)**

| | P1 Hubert Hurkacz | P2 Damir Dzumhur |
| --- | --- | --- |
| supporting families | — | IMPROVEMENT_TREND, LOSS_PROFILE, POINT_BY_POINT, SURFACE_STRENGTH |
| contradicting families | IMPROVEMENT_TREND, LOSS_PROFILE, POINT_BY_POINT, SURFACE_STRENGTH | — |
| directional share (unrounded) | 0% | 66.6667% |
| reaches 60% | no | YES |
| verification: families supporting | — | IMPROVEMENT_TREND, LOSS_PROFILE, POINT_BY_POINT, SURFACE_STRENGTH |
| verification: metrics not compared — own supply failure / refused on sample floor / supplied-but-unused | 6 / 2 / 5 | 6 / 2 / 5 |
| disagreement: families against this player | IMPROVEMENT_TREND(MODERATE), LOSS_PROFILE(MODERATE), POINT_BY_POINT(MINOR), SURFACE_STRENGTH(MAJOR) | — |
| disagreement: overall severity | CRITICAL | NONE |
| underdog: pathways | COMMON_OPPONENT_ADVANTAGE(STRONG_PATHWAY, 82x), RECENT_FORM_ADVANTAGE(VIABLE_PATHWAY, 2.163x) (STRONG_PATHWAY) | COMMON_OPPONENT_ADVANTAGE(STRONG_PATHWAY, 8.533x), IMPROVEMENT_TREND_ADVANTAGE(VIABLE_PATHWAY, 3.26x), LOSS_PROFILE_ADVANTAGE(VIABLE_PATHWAY, 2.667x), POINT_BY_POINT_ADVANTAGE(POTENTIAL_PATHWAY, 1.416x), RECENT_FORM_ADVANTAGE(STRONG_PATHWAY, 4x), SURFACE_ADVANTAGE(STRONG_PATHWAY, 4.771x) (STRONG_PATHWAY) |
| underdog: evaluated by production | true | false |
| stress: support before → after | 0% → 0% | 66.7% → 60% |
| stress: status | REVERSED | ROBUST |
| stress: outcome when THIS side is stressed | P2 | P2 |
| stress: run by production | true | true |
| stress: families manufactured out of NEUTRAL | — | — |

Conflicted families: COMMON_OPPONENT, RECENT_FORM · neutral: H2H_PROBABILITY · directional denominator: 6

**Stage trace** — family vote `P2` → threshold `P2` → leave-one-family-out `P2` → verification `P2` → disagreement `P2` → underdog `P2` → stress `P2` → stored `INSUFFICIENT`. Symmetric stress verdict: `BOTH_SURVIVE`.

**Why:** The decision core selected P2 at 66.666667% of the directional evidence, cleared the 60% threshold, survived leave-one-family-out, and now survives the corrected two-sided Stress evaluation as well (comparative_robustness=BOTH_SURVIVE, never CHALLENGER_MORE_ROBUST). The persisted row still reads INSUFFICIENT EVIDENCE only because this read-only reconstruction, per its production-safety constraints, never writes to production -- the real pipeline has not re-run this match since the fix.

> P1/P2 carry no canonical player_id on this match; side identity rests on name and column position alone.

<details><summary>Per-metric evidence (P1 vs P2)</summary>

| code | metric | P1 | P2 | diff | noise floor | ×floor | favours | status | family | P1 treatment | P2 treatment | source |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 001 | Surface Elo | 1498.17 | 1545.88 | -47.71 | 10 | 4.77 | P2 | COMPARED | SURFACE_STRENGTH | DIRECT | DIRECT | PredixSport public tennis ratings (CC BY 4.0) |
| 002 | Service point win % | — | — | — | 10 | — | UNAVAILABLE | VALUE_NOT_PARSEABLE | POINT_BY_POINT | DIRECT | DIRECT | DataHub ATP World Tour tennis data (CC BY 4.0) |
| 003 | Return point win % | — | — | — | 10 | — | UNAVAILABLE | VALUE_NOT_PARSEABLE | POINT_BY_POINT | DIRECT | DIRECT | DataHub ATP World Tour tennis data (CC BY 4.0) |
| 005 | Last-10 win % | 30 | 50 | -20 | 5 | 4.00 | P2 | COMPARED | RECENT_FORM | PARTIAL | PARTIAL | runtime:atp_main |
| 006 | Bad-loss rate % | 0 | 0 | — | 25 | — | UNAVAILABLE | INSUFFICIENT_SAMPLE | LOSS_PROFILE | PARTIAL | PARTIAL | PredixSport public tennis ratings (CC BY 4.0) |
| 007 | Common-opponent win % | 97.14 | 100 | -2.86 | 20 | 0.14 | NEUTRAL | COMPARED | COMMON_OPPONENT | RECONSTRUCTED | RECONSTRUCTED | runtime:atp_main |
| 008 | Deciding-set win % | — | — | — | 5 | — | UNAVAILABLE | VALUE_NOT_PARSEABLE | SET_PROFILE | DIRECT | DIRECT | PredixSport public tennis ratings (CC BY 4.0) |
| 009 | Pressure point win % | — | — | — | 18 | — | UNAVAILABLE | VALUE_NOT_PARSEABLE | POINT_BY_POINT | DIRECT | DIRECT | PredixSport public tennis ratings (CC BY 4.0) |
| 010 | Straight-set win % | — | — | — | 5 | — | UNAVAILABLE | VALUE_NOT_PARSEABLE | SET_PROFILE | DIRECT | DIRECT | PredixSport public tennis ratings (CC BY 4.0) |
| 011 | Match win % | — | — | — | 5 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | RESULTS_HISTORY | UNAVAILABLE | UNAVAILABLE | DataHub ATP World Tour tennis data (CC BY 4.0) |
| 016 | Break-point score-state win % | — | — | — | 24 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | UNAVAILABLE | — |
| 018 | Breakback rate % | — | — | — | 40 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | UNAVAILABLE | — |
| 027 | Lead protection % | — | — | — | 5 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | CLOSING_ABILITY | UNAVAILABLE | UNAVAILABLE | — |
| 029 | Response after a close set loss, vs own baseline | — | — | — | 25 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | PSYCH_RESPONSE | UNAVAILABLE | UNAVAILABLE | — |
| 031 | Opponent-adjusted set differential | -0.6799999999999999 | 0.6 | -1.28 | 0.15 | 8.53 | P2 | COMPARED | COMMON_OPPONENT | RECONSTRUCTED | RECONSTRUCTED | Four-tour static history index (data/generated/tennis-runtime-index.json) |
| 032 | Break-point conversion % | 0 | 0 | — | 40 | — | UNAVAILABLE | INSUFFICIENT_SAMPLE | POINT_BY_POINT | PARTIAL | PARTIAL | BSD/Bzzoiro ATP Main PBP |
| 034 | Dominance ratio | 0.8704 | 1.0828 | -0.2124 | 0.15 | 1.42 | P2 | COMPARED | POINT_BY_POINT | PARTIAL | PARTIAL | BSD/Bzzoiro ATP Main PBP |
| 036 | Losses as favourite % | 60 | 20 | 40 | 15 | 2.67 | P2 | COMPARED | LOSS_PROFILE | RECONSTRUCTED | RECONSTRUCTED | Four-tour static history index (data/generated/tennis-runtime-index.json) |
| 041 | Elo-adjusted surplus, recent vs earlier | -0.15199999999999997 | 0.174 | -0.326 | 0.1 | 3.26 | P2 | COMPARED | IMPROVEMENT_TREND | RECONSTRUCTED | RECONSTRUCTED | Four-tour static history index (data/generated/tennis-runtime-index.json) |
| 045 | Deciding-set win % as pre-match favourite | — | — | — | 25 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | SET_PROFILE | UNAVAILABLE | UNAVAILABLE | — |
| 051 | Opponent-specific win probability % | 50 | 50 | 0 | 3 | 0.00 | NEUTRAL | COMPARED | H2H_PROBABILITY | RECONSTRUCTED | RECONSTRUCTED | Four-tour static history index (data/generated/tennis-runtime-index.json) |
| 053 | Pressure index % | 52.8302 | 50.7692 | 2.061 | 18 | 0.11 | NEUTRAL | COMPARED | POINT_BY_POINT | PARTIAL | PARTIAL | BSD/Bzzoiro ATP Main PBP |
| 055 | Elo change over last 10 | 30.04 | -13.23 | 43.27 | 20 | 2.16 | P1 | COMPARED | RECENT_FORM | PARTIAL | PARTIAL | PredixSport public tennis ratings (CC BY 4.0) |
| 068 | Current win/loss streak (signed match count) | -1 | 2 | -3 | 5 | 0.60 | NEUTRAL | COMPARED | RECENT_FORM | PARTIAL | PARTIAL | runtime:atp_main |
| 080 | Common-opponent net divergent outcomes | 41 | -41 | 82 | 1 | 82.00 | P1 | COMPARED | COMMON_OPPONENT | PARTIAL | PARTIAL | runtime:atp_main |

</details>

### Norbert Gombos vs Svyatoslav Gulin

- match_id `6eca2224-5c5b-4afb-8433-e7e011e72ceb` · audit_run_id `a7dbf0f2-5c48-4272-9678-8d5b48b5143d` · ATP Challenger Como Qualifying Round 2 (Clay)
- stored: **INSUFFICIENT EVIDENCE** / colour INSUFFICIENT EVIDENCE / independent_winner null
- stage that caused the refusal: **PERSISTENCE (stored verdict predates the Stress fix; production has not re-run this match)**

| | P1 Norbert Gombos | P2 Svyatoslav Gulin |
| --- | --- | --- |
| supporting families | CLOSING_ABILITY, IMPROVEMENT_TREND, RECENT_FORM, RESULTS_HISTORY, SURFACE_STRENGTH | LOSS_PROFILE |
| contradicting families | LOSS_PROFILE | CLOSING_ABILITY, IMPROVEMENT_TREND, RECENT_FORM, RESULTS_HISTORY, SURFACE_STRENGTH |
| directional share (unrounded) | 71.4286% | 14.2857% |
| reaches 60% | YES | no |
| verification: families supporting | CLOSING_ABILITY, IMPROVEMENT_TREND, RECENT_FORM, RESULTS_HISTORY, SURFACE_STRENGTH | LOSS_PROFILE |
| verification: metrics not compared — own supply failure / refused on sample floor / supplied-but-unused | 2 / 3 / 7 | 4 / 3 / 5 |
| disagreement: families against this player | LOSS_PROFILE(MINOR) | CLOSING_ABILITY(MINOR), IMPROVEMENT_TREND(MODERATE), RECENT_FORM(MAJOR), RESULTS_HISTORY(MAJOR), SURFACE_STRENGTH(CRITICAL) |
| disagreement: overall severity | MINOR | CRITICAL |
| underdog: pathways | FAVORITE_COLLAPSE(POTENTIAL_PATHWAY, 1.14x), COMMON_OPPONENT_ADVANTAGE(STRONG_PATHWAY, 6x), IMPROVEMENT_TREND_ADVANTAGE(VIABLE_PATHWAY, 2.8x), RECENT_FORM_ADVANTAGE(STRONG_PATHWAY, 4x), RESULTS_HISTORY_ADVANTAGE(STRONG_PATHWAY, 5.89x), SURFACE_ADVANTAGE(STRONG_PATHWAY, 10.97x) (STRONG_PATHWAY) | COMMON_OPPONENT_ADVANTAGE(STRONG_PATHWAY, 6.067x), LOSS_PROFILE_ADVANTAGE(POTENTIAL_PATHWAY, 1.487x) (STRONG_PATHWAY) |
| underdog: evaluated by production | false | true |
| stress: support before → after | 71.4% → 66.7% | 14.3% → 0% |
| stress: status | ROBUST | REVERSED |
| stress: outcome when THIS side is stressed | P1 | P1 |
| stress: run by production | true | true |
| stress: families manufactured out of NEUTRAL | — | — |

Conflicted families: COMMON_OPPONENT · neutral: H2H_PROBABILITY, POINT_BY_POINT, PSYCH_RESPONSE · directional denominator: 7

**Stage trace** — family vote `P1` → threshold `P1` → leave-one-family-out `P1` → verification `P1` → disagreement `P1` → underdog `P1` → stress `P1` → stored `INSUFFICIENT`. Symmetric stress verdict: `BOTH_SURVIVE`.

**Why:** The decision core selected P1 at 71.428571% of the directional evidence, cleared the 60% threshold, survived leave-one-family-out, and now survives the corrected two-sided Stress evaluation as well (comparative_robustness=BOTH_SURVIVE, never CHALLENGER_MORE_ROBUST). The persisted row still reads INSUFFICIENT EVIDENCE only because this read-only reconstruction, per its production-safety constraints, never writes to production -- the real pipeline has not re-run this match since the fix.

> P1/P2 carry no canonical player_id on this match; side identity rests on name and column position alone.

<details><summary>Per-metric evidence (P1 vs P2)</summary>

| code | metric | P1 | P2 | diff | noise floor | ×floor | favours | status | family | P1 treatment | P2 treatment | source |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 001 | Surface Elo | 1544.7 | 1435 | 109.7 | 10 | 10.97 | P1 | COMPARED | SURFACE_STRENGTH | DIRECT | RECONSTRUCTED | PredixSport public tennis ratings (CC BY 4.0) |
| 002 | Service point win % | — | 52.7273 | — | 10 | — | UNAVAILABLE | ONE_SIDED_EVIDENCE | POINT_BY_POINT | DIRECT | PARTIAL | DataHub ATP World Tour tennis data (CC BY 4.0) |
| 003 | Return point win % | — | 44.2105 | — | 10 | — | UNAVAILABLE | ONE_SIDED_EVIDENCE | POINT_BY_POINT | DIRECT | PARTIAL | DataHub ATP World Tour tennis data (CC BY 4.0) |
| 005 | Last-10 win % | 50 | 30 | 20 | 5 | 4.00 | P1 | COMPARED | RECENT_FORM | PARTIAL | PARTIAL | TennisMyLife ATP Challenger |
| 006 | Bad-loss rate % | — | — | — | 25 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | LOSS_PROFILE | PARTIAL | UNAVAILABLE | PredixSport public tennis ratings (CC BY 4.0) |
| 007 | Common-opponent win % | 63.64 | 25 | — | 20 | — | UNAVAILABLE | INSUFFICIENT_SAMPLE | COMMON_OPPONENT | RECONSTRUCTED | RECONSTRUCTED | TennisMyLife ATP Challenger |
| 008 | Deciding-set win % | — | 25 | — | 5 | — | UNAVAILABLE | ONE_SIDED_EVIDENCE | SET_PROFILE | DIRECT | RECONSTRUCTED | PredixSport public tennis ratings (CC BY 4.0) |
| 009 | Pressure point win % | — | 43.8596 | — | 18 | — | UNAVAILABLE | ONE_SIDED_EVIDENCE | POINT_BY_POINT | DIRECT | PARTIAL | PredixSport public tennis ratings (CC BY 4.0) |
| 010 | Straight-set win % | — | 50 | — | 5 | — | UNAVAILABLE | ONE_SIDED_EVIDENCE | SET_PROFILE | DIRECT | RECONSTRUCTED | PredixSport public tennis ratings (CC BY 4.0) |
| 011 | Match win % | 52.98 | 23.53 | 29.45 | 5 | 5.89 | P1 | COMPARED | RESULTS_HISTORY | RECONSTRUCTED | RECONSTRUCTED | TennisMyLife ATP Challenger |
| 016 | Break-point score-state win % | — | — | — | 24 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | UNAVAILABLE | — |
| 018 | Breakback rate % | — | — | — | 40 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | UNAVAILABLE | — |
| 027 | Lead protection % | 85.7 | 80 | 5.7 | 5 | 1.14 | P1 | COMPARED | CLOSING_ABILITY | RECONSTRUCTED | RECONSTRUCTED | Four-tour static history index (data/generated/tennis-runtime-index.json) |
| 029 | Response after a close set loss, vs own baseline | -10 | -14.4 | 4.4 | 25 | 0.18 | NEUTRAL | COMPARED | PSYCH_RESPONSE | RECONSTRUCTED | RECONSTRUCTED | Four-tour static history index (data/generated/tennis-runtime-index.json) |
| 031 | Opponent-adjusted set differential | -0.5599999999999999 | 0.35 | -0.91 | 0.15 | 6.07 | P2 | COMPARED | COMMON_OPPONENT | RECONSTRUCTED | RECONSTRUCTED | Four-tour static history index (data/generated/tennis-runtime-index.json) |
| 032 | Break-point conversion % | 0 | 0 | — | 40 | — | UNAVAILABLE | INSUFFICIENT_SAMPLE | POINT_BY_POINT | PARTIAL | PARTIAL | BSD/Bzzoiro ATP Challenger PBP |
| 034 | Dominance ratio | 0.9053 | 0.9352 | -0.0299 | 0.15 | 0.20 | NEUTRAL | COMPARED | POINT_BY_POINT | PARTIAL | PARTIAL | BSD/Bzzoiro ATP Challenger PBP |
| 036 | Losses as favourite % | 30 | 7.7 | 22.3 | 15 | 1.49 | P2 | COMPARED | LOSS_PROFILE | RECONSTRUCTED | RECONSTRUCTED | Four-tour static history index (data/generated/tennis-runtime-index.json) |
| 041 | Elo-adjusted surplus, recent vs earlier | 0.362 | 0.08200000000000002 | 0.28 | 0.1 | 2.80 | P1 | COMPARED | IMPROVEMENT_TREND | RECONSTRUCTED | RECONSTRUCTED | Four-tour static history index (data/generated/tennis-runtime-index.json) |
| 045 | Deciding-set win % as pre-match favourite | 57.1 | 0 | — | 25 | — | UNAVAILABLE | INSUFFICIENT_SAMPLE | SET_PROFILE | RECONSTRUCTED | RECONSTRUCTED | Four-tour static history index (data/generated/tennis-runtime-index.json) |
| 051 | Opponent-specific win probability % | 50 | 50 | 0 | 3 | 0.00 | NEUTRAL | COMPARED | H2H_PROBABILITY | RECONSTRUCTED | RECONSTRUCTED | Four-tour static history index (data/generated/tennis-runtime-index.json) |
| 053 | Pressure index % | 60.7143 | 43.8596 | 16.8547 | 18 | 0.94 | NEUTRAL | COMPARED | POINT_BY_POINT | PARTIAL | PARTIAL | BSD/Bzzoiro ATP Challenger PBP |
| 055 | Elo change over last 10 | — | — | — | 20 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | RECENT_FORM | PARTIAL | UNAVAILABLE | PredixSport public tennis ratings (CC BY 4.0) |
| 068 | Current win/loss streak (signed match count) | 3 | -1 | 4 | 5 | 0.80 | NEUTRAL | COMPARED | RECENT_FORM | PARTIAL | PARTIAL | TennisMyLife ATP Challenger |
| 080 | Common-opponent net divergent outcomes | 3 | -3 | 6 | 1 | 6.00 | P1 | COMPARED | COMMON_OPPONENT | PARTIAL | PARTIAL | TennisMyLife ATP Challenger |

</details>

### Alexander Bublik vs Jeffrey John Wolf

- match_id `0f22d260-a97b-44ef-8b06-d0a46a701ad2` · audit_run_id `be6cf6ea-e07b-48d2-8249-c5a0f480d4a5` · US Open Round of 128 (Hard)
- stored: **INSUFFICIENT EVIDENCE** / colour INSUFFICIENT EVIDENCE / independent_winner null
- stage that caused the refusal: **PERSISTENCE (stored verdict predates the Stress fix; production has not re-run this match)**

| | P1 Alexander Bublik | P2 Jeffrey John Wolf |
| --- | --- | --- |
| supporting families | POINT_BY_POINT | — |
| contradicting families | — | POINT_BY_POINT |
| directional share (unrounded) | 100% | 0% |
| reaches 60% | YES | no |
| verification: families supporting | POINT_BY_POINT | — |
| verification: metrics not compared — own supply failure / refused on sample floor / supplied-but-unused | 9 / 3 / 10 | 16 / 3 / 3 |
| disagreement: families against this player | — | POINT_BY_POINT(MODERATE) |
| disagreement: overall severity | NONE | MODERATE |
| underdog: pathways | POINT_BY_POINT_ADVANTAGE(VIABLE_PATHWAY, 3.797x) (VIABLE_PATHWAY) | — (NO_VIABLE_PATHWAY) |
| underdog: evaluated by production | false | true |
| stress: support before → after | 100% → 100% | 0% → 0% |
| stress: status | ROBUST | REVERSED |
| stress: outcome when THIS side is stressed | P1 | P1 |
| stress: run by production | true | true |
| stress: families manufactured out of NEUTRAL | — | — |

Conflicted families: — · neutral: H2H_PROBABILITY · directional denominator: 1

**Stage trace** — family vote `P1` → threshold `P1` → leave-one-family-out `P1` → verification `P1` → disagreement `P1` → underdog `P1` → stress `P1` → stored `INSUFFICIENT`. Symmetric stress verdict: `BOTH_SURVIVE`.

**Why:** The decision core selected P1 at 100.000000% of the directional evidence, cleared the 60% threshold, survived leave-one-family-out, and now survives the corrected two-sided Stress evaluation as well (comparative_robustness=BOTH_SURVIVE, never CHALLENGER_MORE_ROBUST). The persisted row still reads INSUFFICIENT EVIDENCE only because this read-only reconstruction, per its production-safety constraints, never writes to production -- the real pipeline has not re-run this match since the fix.

> Thin evidence supply: only 3 of 25 active metrics were comparable; 19 never yielded comparable evidence (ONE_SIDED_EVIDENCE x3, TREATMENT_NOT_USABLE x16).

> P1/P2 carry no canonical player_id on this match; side identity rests on name and column position alone.

<details><summary>Per-metric evidence (P1 vs P2)</summary>

| code | metric | P1 | P2 | diff | noise floor | ×floor | favours | status | family | P1 treatment | P2 treatment | source |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 001 | Surface Elo | — | — | — | 10 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | SURFACE_STRENGTH | DIRECT | UNAVAILABLE | PredixSport public tennis ratings (CC BY 4.0) |
| 002 | Service point win % | — | 57.8947 | — | 10 | — | UNAVAILABLE | ONE_SIDED_EVIDENCE | POINT_BY_POINT | DIRECT | PARTIAL | DataHub ATP World Tour tennis data (CC BY 4.0) |
| 003 | Return point win % | — | 40.7407 | — | 10 | — | UNAVAILABLE | ONE_SIDED_EVIDENCE | POINT_BY_POINT | DIRECT | PARTIAL | DataHub ATP World Tour tennis data (CC BY 4.0) |
| 005 | Last-10 win % | — | — | — | 5 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | RECENT_FORM | PARTIAL | UNAVAILABLE | PredixSport public tennis ratings (CC BY 4.0) |
| 006 | Bad-loss rate % | — | — | — | 25 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | LOSS_PROFILE | PARTIAL | UNAVAILABLE | PredixSport public tennis ratings (CC BY 4.0) |
| 007 | Common-opponent win % | — | — | — | 20 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | COMMON_OPPONENT | UNAVAILABLE | UNAVAILABLE | — |
| 008 | Deciding-set win % | — | — | — | 5 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | SET_PROFILE | DIRECT | UNAVAILABLE | PredixSport public tennis ratings (CC BY 4.0) |
| 009 | Pressure point win % | — | 56.25 | — | 18 | — | UNAVAILABLE | ONE_SIDED_EVIDENCE | POINT_BY_POINT | DIRECT | PARTIAL | PredixSport public tennis ratings (CC BY 4.0) |
| 010 | Straight-set win % | — | — | — | 5 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | SET_PROFILE | DIRECT | UNAVAILABLE | PredixSport public tennis ratings (CC BY 4.0) |
| 011 | Match win % | — | — | — | 5 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | RESULTS_HISTORY | UNAVAILABLE | UNAVAILABLE | PredixSport public tennis ratings (CC BY 4.0) |
| 016 | Break-point score-state win % | 28.5714 | 71.4286 | — | 24 | — | UNAVAILABLE | INSUFFICIENT_SAMPLE | POINT_BY_POINT | PARTIAL | PARTIAL | BSD/Bzzoiro ATP Main PBP |
| 018 | Breakback rate % | 0 | 0 | — | 40 | — | UNAVAILABLE | INSUFFICIENT_SAMPLE | POINT_BY_POINT | RECONSTRUCTED | RECONSTRUCTED | BSD/Bzzoiro ATP Main PBP |
| 027 | Lead protection % | — | — | — | 5 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | CLOSING_ABILITY | UNAVAILABLE | UNAVAILABLE | — |
| 029 | Response after a close set loss, vs own baseline | — | — | — | 25 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | PSYCH_RESPONSE | UNAVAILABLE | UNAVAILABLE | — |
| 031 | Opponent-adjusted set differential | — | — | — | 0.15 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | COMMON_OPPONENT | UNAVAILABLE | UNAVAILABLE | — |
| 032 | Break-point conversion % | 0 | 0 | — | 40 | — | UNAVAILABLE | INSUFFICIENT_SAMPLE | POINT_BY_POINT | PARTIAL | PARTIAL | BSD/Bzzoiro ATP Main PBP |
| 034 | Dominance ratio | 1.5371 | 0.9676 | 0.5695 | 0.15 | 3.80 | P1 | COMPARED | POINT_BY_POINT | PARTIAL | PARTIAL | BSD/Bzzoiro ATP Main PBP |
| 036 | Losses as favourite % | — | — | — | 15 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | LOSS_PROFILE | UNAVAILABLE | UNAVAILABLE | — |
| 041 | Elo-adjusted surplus, recent vs earlier | — | — | — | 0.1 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | IMPROVEMENT_TREND | UNAVAILABLE | UNAVAILABLE | — |
| 045 | Deciding-set win % as pre-match favourite | — | — | — | 25 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | SET_PROFILE | UNAVAILABLE | UNAVAILABLE | — |
| 051 | Opponent-specific win probability % | 50 | 50 | 0 | 3 | 0.00 | NEUTRAL | COMPARED | H2H_PROBABILITY | RECONSTRUCTED | RECONSTRUCTED | Four-tour static history index (data/generated/tennis-runtime-index.json) |
| 053 | Pressure index % | 52 | 56.25 | -4.25 | 18 | 0.24 | NEUTRAL | COMPARED | POINT_BY_POINT | PARTIAL | PARTIAL | BSD/Bzzoiro ATP Main PBP |
| 055 | Elo change over last 10 | — | — | — | 20 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | RECENT_FORM | PARTIAL | UNAVAILABLE | PredixSport public tennis ratings (CC BY 4.0) |
| 068 | Current win/loss streak (signed match count) | — | — | — | 5 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | RECENT_FORM | PARTIAL | UNAVAILABLE | runtime:atp_main |
| 080 | Common-opponent net divergent outcomes | — | — | — | 1 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | COMMON_OPPONENT | UNAVAILABLE | UNAVAILABLE | PredixSport public tennis ratings (CC BY 4.0) |

</details>

### Stefano Travaglia vs Enrico Dalla Valle

- match_id `1c654a85-b3fc-43d9-995c-b0f12893f459` · audit_run_id `f1de5415-278f-4c00-8179-b5d7774741b0` · ATP Challenger Genoa Round of 16 (Clay)
- stored: **INSUFFICIENT EVIDENCE** / colour INSUFFICIENT EVIDENCE / independent_winner null
- stage that caused the refusal: **PERSISTENCE (stored verdict predates the Stress fix; production has not re-run this match)**

| | P1 Stefano Travaglia | P2 Enrico Dalla Valle |
| --- | --- | --- |
| supporting families | — | H2H_PROBABILITY, IMPROVEMENT_TREND, LOSS_PROFILE, SURFACE_STRENGTH |
| contradicting families | H2H_PROBABILITY, IMPROVEMENT_TREND, LOSS_PROFILE, SURFACE_STRENGTH | — |
| directional share (unrounded) | 0% | 80% |
| reaches 60% | no | YES |
| verification: families supporting | — | H2H_PROBABILITY, IMPROVEMENT_TREND, LOSS_PROFILE, SURFACE_STRENGTH |
| verification: metrics not compared — own supply failure / refused on sample floor / supplied-but-unused | 5 / 2 / 5 | 7 / 2 / 3 |
| disagreement: families against this player | H2H_PROBABILITY(CRITICAL), IMPROVEMENT_TREND(MODERATE), LOSS_PROFILE(MODERATE), SURFACE_STRENGTH(MODERATE) | — |
| disagreement: overall severity | CRITICAL | NONE |
| underdog: pathways | COMMON_OPPONENT_ADVANTAGE(STRONG_PATHWAY, 12x) (STRONG_PATHWAY) | COMMON_OPPONENT_ADVANTAGE(VIABLE_PATHWAY, 3.067x), MATCHUP_TACTICAL_ADVANTAGE(STRONG_PATHWAY, 9.067x), IMPROVEMENT_TREND_ADVANTAGE(VIABLE_PATHWAY, 3.64x), LOSS_PROFILE_ADVANTAGE(VIABLE_PATHWAY, 3x), SURFACE_ADVANTAGE(VIABLE_PATHWAY, 3.931x) (STRONG_PATHWAY) |
| underdog: evaluated by production | true | false |
| stress: support before → after | 0% → 0% | 80% → 80% |
| stress: status | REVERSED | ROBUST |
| stress: outcome when THIS side is stressed | P2 | P2 |
| stress: run by production | true | true |
| stress: families manufactured out of NEUTRAL | — | — |

Conflicted families: COMMON_OPPONENT · neutral: CLOSING_ABILITY, RECENT_FORM, RESULTS_HISTORY, SET_PROFILE · directional denominator: 5

**Stage trace** — family vote `P2` → threshold `P2` → leave-one-family-out `P2` → verification `P2` → disagreement `P2` → underdog `P2` → stress `P2` → stored `INSUFFICIENT`. Symmetric stress verdict: `BOTH_SURVIVE`.

**Why:** The decision core selected P2 at 80.000000% of the directional evidence, cleared the 60% threshold, survived leave-one-family-out, and now survives the corrected two-sided Stress evaluation as well (comparative_robustness=BOTH_SURVIVE, never CHALLENGER_MORE_ROBUST). The persisted row still reads INSUFFICIENT EVIDENCE only because this read-only reconstruction, per its production-safety constraints, never writes to production -- the real pipeline has not re-run this match since the fix.

> P1/P2 carry no canonical player_id on this match; side identity rests on name and column position alone.

<details><summary>Per-metric evidence (P1 vs P2)</summary>

| code | metric | P1 | P2 | diff | noise floor | ×floor | favours | status | family | P1 treatment | P2 treatment | source |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 001 | Surface Elo | 1468.23 | 1507.54 | -39.31 | 10 | 3.93 | P2 | COMPARED | SURFACE_STRENGTH | DIRECT | DIRECT | PredixSport public tennis ratings (CC BY 4.0) |
| 002 | Service point win % | — | — | — | 10 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | DIRECT | UNAVAILABLE | DataHub ATP World Tour tennis data (CC BY 4.0) |
| 003 | Return point win % | — | — | — | 10 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | DIRECT | UNAVAILABLE | DataHub ATP World Tour tennis data (CC BY 4.0) |
| 005 | Last-10 win % | 40 | 40 | 0 | 5 | 0.00 | NEUTRAL | COMPARED | RECENT_FORM | PARTIAL | PARTIAL | TennisMyLife ATP Challenger |
| 006 | Bad-loss rate % | 0 | 0 | — | 25 | — | UNAVAILABLE | INSUFFICIENT_SAMPLE | LOSS_PROFILE | PARTIAL | PARTIAL | PredixSport public tennis ratings (CC BY 4.0) |
| 007 | Common-opponent win % | 47.06 | 40.74 | 6.32 | 20 | 0.32 | NEUTRAL | COMPARED | COMMON_OPPONENT | RECONSTRUCTED | RECONSTRUCTED | TennisMyLife ATP Challenger |
| 008 | Deciding-set win % | — | — | — | 5 | — | UNAVAILABLE | VALUE_NOT_PARSEABLE | SET_PROFILE | DIRECT | DIRECT | PredixSport public tennis ratings (CC BY 4.0) |
| 009 | Pressure point win % | — | — | — | 18 | — | UNAVAILABLE | VALUE_NOT_PARSEABLE | POINT_BY_POINT | DIRECT | DIRECT | PredixSport public tennis ratings (CC BY 4.0) |
| 010 | Straight-set win % | — | — | — | 5 | — | UNAVAILABLE | VALUE_NOT_PARSEABLE | SET_PROFILE | DIRECT | DIRECT | PredixSport public tennis ratings (CC BY 4.0) |
| 011 | Match win % | 53.07 | 48.44 | 4.63 | 5 | 0.93 | NEUTRAL | COMPARED | RESULTS_HISTORY | RECONSTRUCTED | RECONSTRUCTED | TennisMyLife ATP Challenger |
| 016 | Break-point score-state win % | — | — | — | 24 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | UNAVAILABLE | — |
| 018 | Breakback rate % | — | — | — | 40 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | UNAVAILABLE | — |
| 027 | Lead protection % | 83.3 | 81.8 | 1.5 | 5 | 0.30 | NEUTRAL | COMPARED | CLOSING_ABILITY | RECONSTRUCTED | RECONSTRUCTED | Four-tour static history index (data/generated/tennis-runtime-index.json) |
| 029 | Response after a close set loss, vs own baseline | -50 | -35 | — | 25 | — | UNAVAILABLE | INSUFFICIENT_SAMPLE | PSYCH_RESPONSE | RECONSTRUCTED | RECONSTRUCTED | Four-tour static history index (data/generated/tennis-runtime-index.json) |
| 031 | Opponent-adjusted set differential | -0.67 | -0.21000000000000002 | -0.46 | 0.15 | 3.07 | P2 | COMPARED | COMMON_OPPONENT | RECONSTRUCTED | RECONSTRUCTED | Four-tour static history index (data/generated/tennis-runtime-index.json) |
| 032 | Break-point conversion % | — | — | — | 40 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | UNAVAILABLE | — |
| 034 | Dominance ratio | — | — | — | 0.15 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | UNAVAILABLE | — |
| 036 | Losses as favourite % | 80 | 35 | 45 | 15 | 3.00 | P2 | COMPARED | LOSS_PROFILE | RECONSTRUCTED | RECONSTRUCTED | Four-tour static history index (data/generated/tennis-runtime-index.json) |
| 041 | Elo-adjusted surplus, recent vs earlier | -0.45299999999999996 | -0.08900000000000001 | -0.364 | 0.1 | 3.64 | P2 | COMPARED | IMPROVEMENT_TREND | RECONSTRUCTED | RECONSTRUCTED | Four-tour static history index (data/generated/tennis-runtime-index.json) |
| 045 | Deciding-set win % as pre-match favourite | 43.6 | 63.2 | -19.6 | 25 | 0.78 | NEUTRAL | COMPARED | SET_PROFILE | RECONSTRUCTED | RECONSTRUCTED | Four-tour static history index (data/generated/tennis-runtime-index.json) |
| 051 | Opponent-specific win probability % | 36.4 | 63.6 | -27.2 | 3 | 9.07 | P2 | COMPARED | H2H_PROBABILITY | RECONSTRUCTED | RECONSTRUCTED | Four-tour static history index (data/generated/tennis-runtime-index.json) |
| 053 | Pressure index % | — | — | — | 18 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | UNAVAILABLE | — |
| 055 | Elo change over last 10 | -6.22 | 10.8 | -17.02 | 20 | 0.85 | NEUTRAL | COMPARED | RECENT_FORM | PARTIAL | PARTIAL | PredixSport public tennis ratings (CC BY 4.0) |
| 068 | Current win/loss streak (signed match count) | -4 | -2 | -2 | 5 | 0.40 | NEUTRAL | COMPARED | RECENT_FORM | PARTIAL | PARTIAL | TennisMyLife ATP Challenger |
| 080 | Common-opponent net divergent outcomes | 6 | -6 | 12 | 1 | 12.00 | P1 | COMPARED | COMMON_OPPONENT | PARTIAL | PARTIAL | TennisMyLife ATP Challenger |

</details>

### Martin Landaluce vs Jacob Fearnley

- match_id `7864e7e8-3738-4078-a74e-507bd010f57d` · audit_run_id `f99ed243-4cfa-432a-a9b6-7bde8f9623a4` · US Open Round of 128 (Hard)
- stored: **INSUFFICIENT EVIDENCE** / colour INSUFFICIENT EVIDENCE / independent_winner null
- stage that caused the refusal: **PERSISTENCE (stored verdict predates the Stress fix; production has not re-run this match)**

| | P1 Martin Landaluce | P2 Jacob Fearnley |
| --- | --- | --- |
| supporting families | IMPROVEMENT_TREND, LOSS_PROFILE, POINT_BY_POINT, RECENT_FORM, SURFACE_STRENGTH | — |
| contradicting families | — | IMPROVEMENT_TREND, LOSS_PROFILE, POINT_BY_POINT, RECENT_FORM, SURFACE_STRENGTH |
| directional share (unrounded) | 100% | 0% |
| reaches 60% | YES | no |
| verification: families supporting | IMPROVEMENT_TREND, LOSS_PROFILE, POINT_BY_POINT, RECENT_FORM, SURFACE_STRENGTH | — |
| verification: metrics not compared — own supply failure / refused on sample floor / supplied-but-unused | 5 / 4 / 4 | 6 / 4 / 3 |
| disagreement: families against this player | — | IMPROVEMENT_TREND(MAJOR), LOSS_PROFILE(MINOR), POINT_BY_POINT(MINOR), RECENT_FORM(MAJOR), SURFACE_STRENGTH(CRITICAL) |
| disagreement: overall severity | NONE | CRITICAL |
| underdog: pathways | IMPROVEMENT_TREND_ADVANTAGE(STRONG_PATHWAY, 4.54x), LOSS_PROFILE_ADVANTAGE(POTENTIAL_PATHWAY, 1.333x), POINT_BY_POINT_ADVANTAGE(POTENTIAL_PATHWAY, 1.959x), RECENT_FORM_ADVANTAGE(STRONG_PATHWAY, 6x), SURFACE_ADVANTAGE(STRONG_PATHWAY, 22.9x) (STRONG_PATHWAY) | — (NO_VIABLE_PATHWAY) |
| underdog: evaluated by production | false | true |
| stress: support before → after | 100% → 100% | 0% → 0% |
| stress: status | ROBUST | REVERSED |
| stress: outcome when THIS side is stressed | P1 | P1 |
| stress: run by production | true | true |
| stress: families manufactured out of NEUTRAL | — | — |

Conflicted families: — · neutral: COMMON_OPPONENT, H2H_PROBABILITY · directional denominator: 5

**Stage trace** — family vote `P1` → threshold `P1` → leave-one-family-out `P1` → verification `P1` → disagreement `P1` → underdog `P1` → stress `P1` → stored `INSUFFICIENT`. Symmetric stress verdict: `BOTH_SURVIVE`.

**Why:** The decision core selected P1 at 100.000000% of the directional evidence, cleared the 60% threshold, survived leave-one-family-out, and now survives the corrected two-sided Stress evaluation as well (comparative_robustness=BOTH_SURVIVE, never CHALLENGER_MORE_ROBUST). The persisted row still reads INSUFFICIENT EVIDENCE only because this read-only reconstruction, per its production-safety constraints, never writes to production -- the real pipeline has not re-run this match since the fix.

> P1/P2 carry no canonical player_id on this match; side identity rests on name and column position alone.

<details><summary>Per-metric evidence (P1 vs P2)</summary>

| code | metric | P1 | P2 | diff | noise floor | ×floor | favours | status | family | P1 treatment | P2 treatment | source |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 001 | Surface Elo | 1739.52 | 1510.52 | 229 | 10 | 22.90 | P1 | COMPARED | SURFACE_STRENGTH | DIRECT | DIRECT | PredixSport public tennis ratings (CC BY 4.0) |
| 002 | Service point win % | 53.4884 | 57.0248 | -3.5364 | 10 | 0.35 | NEUTRAL | COMPARED | POINT_BY_POINT | PARTIAL | PARTIAL | BSD/Bzzoiro ATP Main PBP |
| 003 | Return point win % | 46 | 39.3939 | 6.6061 | 10 | 0.66 | NEUTRAL | COMPARED | POINT_BY_POINT | PARTIAL | PARTIAL | BSD/Bzzoiro ATP Main PBP |
| 005 | Last-10 win % | 70 | 40 | 30 | 5 | 6.00 | P1 | COMPARED | RECENT_FORM | PARTIAL | PARTIAL | runtime:atp_main |
| 006 | Bad-loss rate % | 0 | 0 | — | 25 | — | UNAVAILABLE | INSUFFICIENT_SAMPLE | LOSS_PROFILE | PARTIAL | PARTIAL | PredixSport public tennis ratings (CC BY 4.0) |
| 007 | Common-opponent win % | 100 | 100 | — | 20 | — | UNAVAILABLE | INSUFFICIENT_SAMPLE | COMMON_OPPONENT | RECONSTRUCTED | RECONSTRUCTED | runtime:atp_main |
| 008 | Deciding-set win % | — | — | — | 5 | — | UNAVAILABLE | VALUE_NOT_PARSEABLE | SET_PROFILE | DIRECT | DIRECT | PredixSport public tennis ratings (CC BY 4.0) |
| 009 | Pressure point win % | — | — | — | 18 | — | UNAVAILABLE | VALUE_NOT_PARSEABLE | POINT_BY_POINT | DIRECT | DIRECT | PredixSport public tennis ratings (CC BY 4.0) |
| 010 | Straight-set win % | — | — | — | 5 | — | UNAVAILABLE | VALUE_NOT_PARSEABLE | SET_PROFILE | DIRECT | DIRECT | PredixSport public tennis ratings (CC BY 4.0) |
| 011 | Match win % | — | — | — | 5 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | RESULTS_HISTORY | UNAVAILABLE | UNAVAILABLE | PredixSport public tennis ratings (CC BY 4.0) |
| 016 | Break-point score-state win % | 77.7778 | 30.7692 | 47.0086 | 24 | 1.96 | P1 | COMPARED | POINT_BY_POINT | PARTIAL | PARTIAL | BSD/Bzzoiro ATP Main PBP |
| 018 | Breakback rate % | 14.2857 | 66.6667 | — | 40 | — | UNAVAILABLE | INSUFFICIENT_SAMPLE | POINT_BY_POINT | RECONSTRUCTED | RECONSTRUCTED | BSD/Bzzoiro ATP Main PBP |
| 027 | Lead protection % | — | — | — | 5 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | CLOSING_ABILITY | UNAVAILABLE | UNAVAILABLE | — |
| 029 | Response after a close set loss, vs own baseline | — | — | — | 25 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | PSYCH_RESPONSE | UNAVAILABLE | UNAVAILABLE | — |
| 031 | Opponent-adjusted set differential | -0.4 | -0.31 | -0.09 | 0.15 | 0.60 | NEUTRAL | COMPARED | COMMON_OPPONENT | RECONSTRUCTED | RECONSTRUCTED | Four-tour static history index (data/generated/tennis-runtime-index.json) |
| 032 | Break-point conversion % | 0 | 0 | — | 40 | — | UNAVAILABLE | INSUFFICIENT_SAMPLE | POINT_BY_POINT | PARTIAL | PARTIAL | BSD/Bzzoiro ATP Main PBP |
| 034 | Dominance ratio | 0.989 | 0.9167 | 0.0723 | 0.15 | 0.48 | NEUTRAL | COMPARED | POINT_BY_POINT | PARTIAL | PARTIAL | BSD/Bzzoiro ATP Main PBP |
| 036 | Losses as favourite % | 20 | 40 | -20 | 15 | 1.33 | P1 | COMPARED | LOSS_PROFILE | RECONSTRUCTED | RECONSTRUCTED | Four-tour static history index (data/generated/tennis-runtime-index.json) |
| 041 | Elo-adjusted surplus, recent vs earlier | 0.274 | -0.18 | 0.454 | 0.1 | 4.54 | P1 | COMPARED | IMPROVEMENT_TREND | RECONSTRUCTED | RECONSTRUCTED | Four-tour static history index (data/generated/tennis-runtime-index.json) |
| 045 | Deciding-set win % as pre-match favourite | — | — | — | 25 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | SET_PROFILE | UNAVAILABLE | UNAVAILABLE | — |
| 051 | Opponent-specific win probability % | 50 | 50 | 0 | 3 | 0.00 | NEUTRAL | COMPARED | H2H_PROBABILITY | RECONSTRUCTED | RECONSTRUCTED | Four-tour static history index (data/generated/tennis-runtime-index.json) |
| 053 | Pressure index % | 64.2857 | 31.9149 | 32.3708 | 18 | 1.80 | P1 | COMPARED | POINT_BY_POINT | PARTIAL | PARTIAL | BSD/Bzzoiro ATP Main PBP |
| 055 | Elo change over last 10 | — | — | — | 20 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | RECENT_FORM | PARTIAL | UNAVAILABLE | PredixSport public tennis ratings (CC BY 4.0) |
| 068 | Current win/loss streak (signed match count) | 1 | 2 | -1 | 5 | 0.20 | NEUTRAL | COMPARED | RECENT_FORM | PARTIAL | PARTIAL | runtime:atp_main |
| 080 | Common-opponent net divergent outcomes | — | — | — | 1 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | COMMON_OPPONENT | UNAVAILABLE | UNAVAILABLE | PredixSport public tennis ratings (CC BY 4.0) |

</details>

### Valentin Vacherot vs Aleksandar Kovacevic

- match_id `5869d49f-fce3-4c78-a64d-d23c7bbb6974` · audit_run_id `fb3c319f-5f67-4928-bf11-3819d41b07dc` · US Open Round of 128 (Hard)
- stored: **INSUFFICIENT EVIDENCE** / colour INSUFFICIENT EVIDENCE / independent_winner null
- stage that caused the refusal: **PERSISTENCE (stored verdict predates the Stress fix; production has not re-run this match)**

| | P1 Valentin Vacherot | P2 Aleksandar Kovacevic |
| --- | --- | --- |
| supporting families | IMPROVEMENT_TREND, RECENT_FORM, SURFACE_STRENGTH | H2H_PROBABILITY |
| contradicting families | H2H_PROBABILITY | IMPROVEMENT_TREND, RECENT_FORM, SURFACE_STRENGTH |
| directional share (unrounded) | 60% | 20% |
| reaches 60% | YES | no |
| verification: families supporting | IMPROVEMENT_TREND, RECENT_FORM, SURFACE_STRENGTH | H2H_PROBABILITY |
| verification: metrics not compared — own supply failure / refused on sample floor / supplied-but-unused | 11 / 2 / 3 | 11 / 2 / 3 |
| disagreement: families against this player | H2H_PROBABILITY(MODERATE) | IMPROVEMENT_TREND(MODERATE), RECENT_FORM(MAJOR), SURFACE_STRENGTH(CRITICAL) |
| disagreement: overall severity | MODERATE | CRITICAL |
| underdog: pathways | COMMON_OPPONENT_ADVANTAGE(STRONG_PATHWAY, 18x), IMPROVEMENT_TREND_ADVANTAGE(VIABLE_PATHWAY, 3.97x), RECENT_FORM_ADVANTAGE(STRONG_PATHWAY, 6x), SURFACE_ADVANTAGE(STRONG_PATHWAY, 10.566x) (STRONG_PATHWAY) | COMMON_OPPONENT_ADVANTAGE(STRONG_PATHWAY, 6.067x), MATCHUP_TACTICAL_ADVANTAGE(VIABLE_PATHWAY, 3.733x) (STRONG_PATHWAY) |
| underdog: evaluated by production | false | true |
| stress: support before → after | 60% → 60% | 20% → 20% |
| stress: status | ROBUST | REVERSED |
| stress: outcome when THIS side is stressed | P1 | P1 |
| stress: run by production | true | true |
| stress: families manufactured out of NEUTRAL | — | — |

Conflicted families: COMMON_OPPONENT · neutral: LOSS_PROFILE · directional denominator: 5

**Stage trace** — family vote `P1` → threshold `P1` → leave-one-family-out `P1` → verification `P1` → disagreement `P1` → underdog `P1` → stress `P1` → stored `INSUFFICIENT`. Symmetric stress verdict: `BOTH_SURVIVE`.

**Why:** The decision core selected P1 at 60.000000% of the directional evidence, cleared the 60% threshold, survived leave-one-family-out, and now survives the corrected two-sided Stress evaluation as well (comparative_robustness=BOTH_SURVIVE, never CHALLENGER_MORE_ROBUST). The persisted row still reads INSUFFICIENT EVIDENCE only because this read-only reconstruction, per its production-safety constraints, never writes to production -- the real pipeline has not re-run this match since the fix.

> Thin evidence supply: only 9 of 25 active metrics were comparable; 14 never yielded comparable evidence (TREATMENT_NOT_USABLE x11, VALUE_NOT_PARSEABLE x3).

> P1/P2 carry no canonical player_id on this match; side identity rests on name and column position alone.

<details><summary>Per-metric evidence (P1 vs P2)</summary>

| code | metric | P1 | P2 | diff | noise floor | ×floor | favours | status | family | P1 treatment | P2 treatment | source |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 001 | Surface Elo | 1696.66 | 1591 | 105.66 | 10 | 10.57 | P1 | COMPARED | SURFACE_STRENGTH | DIRECT | DIRECT | PredixSport public tennis ratings (CC BY 4.0) |
| 002 | Service point win % | — | — | — | 10 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | UNAVAILABLE | — |
| 003 | Return point win % | — | — | — | 10 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | UNAVAILABLE | PredixSport public tennis ratings (CC BY 4.0) |
| 005 | Last-10 win % | 70 | 40 | 30 | 5 | 6.00 | P1 | COMPARED | RECENT_FORM | PARTIAL | PARTIAL | runtime:atp_main |
| 006 | Bad-loss rate % | 25 | 0 | — | 25 | — | UNAVAILABLE | INSUFFICIENT_SAMPLE | LOSS_PROFILE | PARTIAL | PARTIAL | PredixSport public tennis ratings (CC BY 4.0) |
| 007 | Common-opponent win % | 75 | 80 | — | 20 | — | UNAVAILABLE | INSUFFICIENT_SAMPLE | COMMON_OPPONENT | PARTIAL | RECONSTRUCTED | PredixSport public tennis ratings (CC BY 4.0) |
| 008 | Deciding-set win % | — | — | — | 5 | — | UNAVAILABLE | VALUE_NOT_PARSEABLE | SET_PROFILE | DIRECT | DIRECT | PredixSport public tennis ratings (CC BY 4.0) |
| 009 | Pressure point win % | — | — | — | 18 | — | UNAVAILABLE | VALUE_NOT_PARSEABLE | POINT_BY_POINT | DIRECT | DIRECT | PredixSport public tennis ratings (CC BY 4.0) |
| 010 | Straight-set win % | — | — | — | 5 | — | UNAVAILABLE | VALUE_NOT_PARSEABLE | SET_PROFILE | DIRECT | DIRECT | PredixSport public tennis ratings (CC BY 4.0) |
| 011 | Match win % | — | — | — | 5 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | RESULTS_HISTORY | UNAVAILABLE | UNAVAILABLE | PredixSport public tennis ratings (CC BY 4.0) |
| 016 | Break-point score-state win % | — | — | — | 24 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | UNAVAILABLE | — |
| 018 | Breakback rate % | — | — | — | 40 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | UNAVAILABLE | — |
| 027 | Lead protection % | — | — | — | 5 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | CLOSING_ABILITY | UNAVAILABLE | UNAVAILABLE | — |
| 029 | Response after a close set loss, vs own baseline | — | — | — | 25 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | PSYCH_RESPONSE | UNAVAILABLE | UNAVAILABLE | — |
| 031 | Opponent-adjusted set differential | -0.7 | 0.21000000000000002 | -0.91 | 0.15 | 6.07 | P2 | COMPARED | COMMON_OPPONENT | RECONSTRUCTED | RECONSTRUCTED | Four-tour static history index (data/generated/tennis-runtime-index.json) |
| 032 | Break-point conversion % | — | — | — | 40 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | UNAVAILABLE | — |
| 034 | Dominance ratio | — | — | — | 0.15 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | UNAVAILABLE | — |
| 036 | Losses as favourite % | 30 | 25 | 5 | 15 | 0.33 | NEUTRAL | COMPARED | LOSS_PROFILE | RECONSTRUCTED | RECONSTRUCTED | Four-tour static history index (data/generated/tennis-runtime-index.json) |
| 041 | Elo-adjusted surplus, recent vs earlier | 0.27299999999999996 | -0.124 | 0.397 | 0.1 | 3.97 | P1 | COMPARED | IMPROVEMENT_TREND | RECONSTRUCTED | RECONSTRUCTED | Four-tour static history index (data/generated/tennis-runtime-index.json) |
| 045 | Deciding-set win % as pre-match favourite | — | — | — | 25 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | SET_PROFILE | UNAVAILABLE | UNAVAILABLE | — |
| 051 | Opponent-specific win probability % | 44.4 | 55.6 | -11.2 | 3 | 3.73 | P2 | COMPARED | H2H_PROBABILITY | RECONSTRUCTED | RECONSTRUCTED | Four-tour static history index (data/generated/tennis-runtime-index.json) |
| 053 | Pressure index % | — | — | — | 18 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | UNAVAILABLE | — |
| 055 | Elo change over last 10 | 123.48 | 10.1 | 113.38 | 20 | 5.67 | P1 | COMPARED | RECENT_FORM | PARTIAL | PARTIAL | PredixSport public tennis ratings (CC BY 4.0) |
| 068 | Current win/loss streak (signed match count) | -1 | 1 | -2 | 5 | 0.40 | NEUTRAL | COMPARED | RECENT_FORM | PARTIAL | PARTIAL | runtime:atp_main |
| 080 | Common-opponent net divergent outcomes | 9 | -9 | 18 | 1 | 18.00 | P1 | COMPARED | COMMON_OPPONENT | PARTIAL | PARTIAL | runtime:atp_main |

</details>

## DATA_OR_PIPELINE_BUG (7)

### Francesca Jones vs Rositsa Dencheva

- match_id `9d381811-338c-4da1-b636-360504f54508` · audit_run_id `24affce4-6e5e-4749-887f-24a8376876e3` · WTA 125K Antalya Round of 16 (Red clay)
- stored: **INSUFFICIENT EVIDENCE** / colour INSUFFICIENT EVIDENCE / independent_winner null
- stage that caused the refusal: **P1/P2 METRIC EXECUTION**

| | P1 Francesca Jones | P2 Rositsa Dencheva |
| --- | --- | --- |
| supporting families | — | — |
| contradicting families | — | — |
| directional share (unrounded) | 0% | 0% |
| reaches 60% | no | no |
| verification: families supporting | — | — |
| verification: metrics not compared — own supply failure / refused on sample floor / supplied-but-unused | 19 / 0 / 5 | 24 / 0 / 0 |
| disagreement: families against this player | — | — |
| disagreement: overall severity | NONE | NONE |
| underdog: pathways | — (NO_VIABLE_PATHWAY) | — (NO_VIABLE_PATHWAY) |
| underdog: evaluated by production | false | false |
| stress: support before → after | 0% → 0% | 0% → 0% |
| stress: status | REMOVED | REMOVED |
| stress: outcome when THIS side is stressed | INSUFFICIENT | INSUFFICIENT |
| stress: run by production | true | true |
| stress: families manufactured out of NEUTRAL | — | — |

Conflicted families: — · neutral: H2H_PROBABILITY · directional denominator: 0

**Stage trace** — family vote `TIE` → threshold `TIE` → leave-one-family-out `TIE` → verification `TIE` → disagreement `TIE` → underdog `TIE` → stress `TIE` → stored `INSUFFICIENT`. Symmetric stress verdict: `NOT_APPLICABLE`.

**Why:** Only 1 of the 25 active metrics produced a two-sided comparison and no family expressed a direction, while 24 metric(s) never yielded comparable evidence at all (TREATMENT_NOT_USABLE x24). The refusal is an evidence-supply outcome, not a comparative finding: the engine had almost nothing to compare the two players on.

> Dangerous Underdog audit analysed NEITHER player: runUnderdogAnalysis only examines the non-selected side, so a match with no selection gets no underdog analysis for anyone.

> P1/P2 carry no canonical player_id on this match; side identity rests on name and column position alone.

<details><summary>Per-metric evidence (P1 vs P2)</summary>

| code | metric | P1 | P2 | diff | noise floor | ×floor | favours | status | family | P1 treatment | P2 treatment | source |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 001 | Surface Elo | — | — | — | 10 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | SURFACE_STRENGTH | DIRECT | UNAVAILABLE | PredixSport public tennis ratings (CC BY 4.0) |
| 002 | Service point win % | — | — | — | 10 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | UNAVAILABLE | — |
| 003 | Return point win % | — | — | — | 10 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | UNAVAILABLE | — |
| 005 | Last-10 win % | — | — | — | 5 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | RECENT_FORM | PARTIAL | UNAVAILABLE | PredixSport bundled public tennis history (CC BY 4.0) |
| 006 | Bad-loss rate % | — | — | — | 25 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | LOSS_PROFILE | UNAVAILABLE | UNAVAILABLE | — |
| 007 | Common-opponent win % | — | — | — | 20 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | COMMON_OPPONENT | UNAVAILABLE | UNAVAILABLE | — |
| 008 | Deciding-set win % | — | — | — | 5 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | SET_PROFILE | DIRECT | UNAVAILABLE | PredixSport bundled public tennis history (CC BY 4.0) |
| 009 | Pressure point win % | — | — | — | 18 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | UNAVAILABLE | — |
| 010 | Straight-set win % | — | — | — | 5 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | SET_PROFILE | DIRECT | UNAVAILABLE | PredixSport bundled public tennis history (CC BY 4.0) |
| 011 | Match win % | — | — | — | 5 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | RESULTS_HISTORY | UNAVAILABLE | UNAVAILABLE | — |
| 016 | Break-point score-state win % | — | — | — | 24 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | UNAVAILABLE | — |
| 018 | Breakback rate % | — | — | — | 40 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | UNAVAILABLE | — |
| 027 | Lead protection % | — | — | — | 5 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | CLOSING_ABILITY | UNAVAILABLE | UNAVAILABLE | — |
| 029 | Response after a close set loss, vs own baseline | — | — | — | 25 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | PSYCH_RESPONSE | UNAVAILABLE | UNAVAILABLE | — |
| 031 | Opponent-adjusted set differential | — | — | — | 0.15 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | COMMON_OPPONENT | UNAVAILABLE | UNAVAILABLE | — |
| 032 | Break-point conversion % | — | — | — | 40 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | UNAVAILABLE | — |
| 034 | Dominance ratio | — | — | — | 0.15 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | UNAVAILABLE | — |
| 036 | Losses as favourite % | — | — | — | 15 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | LOSS_PROFILE | UNAVAILABLE | UNAVAILABLE | — |
| 041 | Elo-adjusted surplus, recent vs earlier | — | — | — | 0.1 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | IMPROVEMENT_TREND | UNAVAILABLE | UNAVAILABLE | — |
| 045 | Deciding-set win % as pre-match favourite | — | — | — | 25 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | SET_PROFILE | UNAVAILABLE | UNAVAILABLE | — |
| 051 | Opponent-specific win probability % | 50 | 50 | 0 | 3 | 0.00 | NEUTRAL | COMPARED | H2H_PROBABILITY | RECONSTRUCTED | RECONSTRUCTED | Four-tour static history index (data/generated/tennis-runtime-index.json) |
| 053 | Pressure index % | — | — | — | 18 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | UNAVAILABLE | — |
| 055 | Elo change over last 10 | — | — | — | 20 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | RECENT_FORM | UNAVAILABLE | UNAVAILABLE | — |
| 068 | Current win/loss streak (signed match count) | — | — | — | 5 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | RECENT_FORM | PARTIAL | UNAVAILABLE | Validated WTA 125 production history |
| 080 | Common-opponent net divergent outcomes | — | — | — | 1 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | COMMON_OPPONENT | UNAVAILABLE | UNAVAILABLE | — |

</details>

### Sascha Gueymard Wayenburg vs Izan Almazan

- match_id `1078ff72-8a23-4f56-9835-c855fd8745d3` · audit_run_id `869e0f2e-c6a3-43cf-b2a8-00e3c87fbd4d` · ATP Challenger Manacor Qualifying Round 1 (Hard)
- stored: **INSUFFICIENT EVIDENCE** / colour INSUFFICIENT EVIDENCE / independent_winner null
- stage that caused the refusal: **P1/P2 METRIC EXECUTION**

| | P1 Sascha Gueymard Wayenburg | P2 Izan Almazan |
| --- | --- | --- |
| supporting families | — | — |
| contradicting families | — | — |
| directional share (unrounded) | 0% | 0% |
| reaches 60% | no | no |
| verification: families supporting | — | — |
| verification: metrics not compared — own supply failure / refused on sample floor / supplied-but-unused | 16 / 0 / 8 | 24 / 0 / 0 |
| disagreement: families against this player | — | — |
| disagreement: overall severity | NONE | NONE |
| underdog: pathways | — (NO_VIABLE_PATHWAY) | — (NO_VIABLE_PATHWAY) |
| underdog: evaluated by production | false | false |
| stress: support before → after | 0% → 0% | 0% → 0% |
| stress: status | REMOVED | REMOVED |
| stress: outcome when THIS side is stressed | INSUFFICIENT | INSUFFICIENT |
| stress: run by production | true | true |
| stress: families manufactured out of NEUTRAL | — | — |

Conflicted families: — · neutral: H2H_PROBABILITY · directional denominator: 0

**Stage trace** — family vote `TIE` → threshold `TIE` → leave-one-family-out `TIE` → verification `TIE` → disagreement `TIE` → underdog `TIE` → stress `TIE` → stored `INSUFFICIENT`. Symmetric stress verdict: `NOT_APPLICABLE`.

**Why:** Only 1 of the 25 active metrics produced a two-sided comparison and no family expressed a direction, while 24 metric(s) never yielded comparable evidence at all (TREATMENT_NOT_USABLE x24). The refusal is an evidence-supply outcome, not a comparative finding: the engine had almost nothing to compare the two players on.

> Dangerous Underdog audit analysed NEITHER player: runUnderdogAnalysis only examines the non-selected side, so a match with no selection gets no underdog analysis for anyone.

> P1/P2 carry no canonical player_id on this match; side identity rests on name and column position alone.

<details><summary>Per-metric evidence (P1 vs P2)</summary>

| code | metric | P1 | P2 | diff | noise floor | ×floor | favours | status | family | P1 treatment | P2 treatment | source |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 001 | Surface Elo | — | — | — | 10 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | SURFACE_STRENGTH | DIRECT | UNAVAILABLE | PredixSport public tennis ratings (CC BY 4.0) |
| 002 | Service point win % | — | — | — | 10 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | UNAVAILABLE | — |
| 003 | Return point win % | — | — | — | 10 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | UNAVAILABLE | — |
| 005 | Last-10 win % | — | — | — | 5 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | RECENT_FORM | PARTIAL | UNAVAILABLE | PredixSport public tennis ratings (CC BY 4.0) |
| 006 | Bad-loss rate % | — | — | — | 25 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | LOSS_PROFILE | PARTIAL | UNAVAILABLE | PredixSport public tennis ratings (CC BY 4.0) |
| 007 | Common-opponent win % | — | — | — | 20 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | COMMON_OPPONENT | UNAVAILABLE | UNAVAILABLE | — |
| 008 | Deciding-set win % | — | — | — | 5 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | SET_PROFILE | DIRECT | UNAVAILABLE | PredixSport public tennis ratings (CC BY 4.0) |
| 009 | Pressure point win % | — | — | — | 18 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | DIRECT | UNAVAILABLE | PredixSport public tennis ratings (CC BY 4.0) |
| 010 | Straight-set win % | — | — | — | 5 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | SET_PROFILE | DIRECT | UNAVAILABLE | PredixSport public tennis ratings (CC BY 4.0) |
| 011 | Match win % | — | — | — | 5 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | RESULTS_HISTORY | UNAVAILABLE | UNAVAILABLE | PredixSport public tennis ratings (CC BY 4.0) |
| 016 | Break-point score-state win % | — | — | — | 24 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | UNAVAILABLE | — |
| 018 | Breakback rate % | — | — | — | 40 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | UNAVAILABLE | — |
| 027 | Lead protection % | — | — | — | 5 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | CLOSING_ABILITY | UNAVAILABLE | UNAVAILABLE | — |
| 029 | Response after a close set loss, vs own baseline | — | — | — | 25 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | PSYCH_RESPONSE | UNAVAILABLE | UNAVAILABLE | — |
| 031 | Opponent-adjusted set differential | — | — | — | 0.15 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | COMMON_OPPONENT | UNAVAILABLE | UNAVAILABLE | — |
| 032 | Break-point conversion % | — | — | — | 40 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | UNAVAILABLE | — |
| 034 | Dominance ratio | — | — | — | 0.15 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | UNAVAILABLE | — |
| 036 | Losses as favourite % | — | — | — | 15 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | LOSS_PROFILE | UNAVAILABLE | UNAVAILABLE | — |
| 041 | Elo-adjusted surplus, recent vs earlier | — | — | — | 0.1 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | IMPROVEMENT_TREND | UNAVAILABLE | UNAVAILABLE | — |
| 045 | Deciding-set win % as pre-match favourite | — | — | — | 25 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | SET_PROFILE | UNAVAILABLE | UNAVAILABLE | — |
| 051 | Opponent-specific win probability % | 50 | 50 | 0 | 3 | 0.00 | NEUTRAL | COMPARED | H2H_PROBABILITY | RECONSTRUCTED | RECONSTRUCTED | Four-tour static history index (data/generated/tennis-runtime-index.json) |
| 053 | Pressure index % | — | — | — | 18 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | UNAVAILABLE | — |
| 055 | Elo change over last 10 | — | — | — | 20 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | RECENT_FORM | PARTIAL | UNAVAILABLE | PredixSport public tennis ratings (CC BY 4.0) |
| 068 | Current win/loss streak (signed match count) | — | — | — | 5 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | RECENT_FORM | PARTIAL | UNAVAILABLE | TennisMyLife ATP Challenger |
| 080 | Common-opponent net divergent outcomes | — | — | — | 1 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | COMMON_OPPONENT | UNAVAILABLE | UNAVAILABLE | PredixSport public tennis ratings (CC BY 4.0) |

</details>

### Alexander Blockx vs Marcelo Tomas Barrios

- match_id `daecaca2-b157-4f52-87d1-45ee6af47689` · audit_run_id `aede79e2-ad26-4166-9ea1-d88cfb743586` · US Open Round of 128 (Hard)
- stored: **INSUFFICIENT EVIDENCE** / colour INSUFFICIENT EVIDENCE / independent_winner null
- stage that caused the refusal: **P1/P2 METRIC EXECUTION**

| | P1 Alexander Blockx | P2 Marcelo Tomas Barrios |
| --- | --- | --- |
| supporting families | — | — |
| contradicting families | — | — |
| directional share (unrounded) | 0% | 0% |
| reaches 60% | no | no |
| verification: families supporting | — | — |
| verification: metrics not compared — own supply failure / refused on sample floor / supplied-but-unused | 16 / 0 / 8 | 24 / 0 / 0 |
| disagreement: families against this player | — | — |
| disagreement: overall severity | NONE | NONE |
| underdog: pathways | — (NO_VIABLE_PATHWAY) | — (NO_VIABLE_PATHWAY) |
| underdog: evaluated by production | false | false |
| stress: support before → after | 0% → 0% | 0% → 0% |
| stress: status | REMOVED | REMOVED |
| stress: outcome when THIS side is stressed | INSUFFICIENT | INSUFFICIENT |
| stress: run by production | true | true |
| stress: families manufactured out of NEUTRAL | — | — |

Conflicted families: — · neutral: H2H_PROBABILITY · directional denominator: 0

**Stage trace** — family vote `TIE` → threshold `TIE` → leave-one-family-out `TIE` → verification `TIE` → disagreement `TIE` → underdog `TIE` → stress `TIE` → stored `INSUFFICIENT`. Symmetric stress verdict: `NOT_APPLICABLE`.

**Why:** Only 1 of the 25 active metrics produced a two-sided comparison and no family expressed a direction, while 24 metric(s) never yielded comparable evidence at all (TREATMENT_NOT_USABLE x24). The refusal is an evidence-supply outcome, not a comparative finding: the engine had almost nothing to compare the two players on.

> Dangerous Underdog audit analysed NEITHER player: runUnderdogAnalysis only examines the non-selected side, so a match with no selection gets no underdog analysis for anyone.

> P1/P2 carry no canonical player_id on this match; side identity rests on name and column position alone.

<details><summary>Per-metric evidence (P1 vs P2)</summary>

| code | metric | P1 | P2 | diff | noise floor | ×floor | favours | status | family | P1 treatment | P2 treatment | source |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 001 | Surface Elo | — | — | — | 10 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | SURFACE_STRENGTH | DIRECT | UNAVAILABLE | PredixSport public tennis ratings (CC BY 4.0) |
| 002 | Service point win % | — | — | — | 10 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | UNAVAILABLE | — |
| 003 | Return point win % | — | — | — | 10 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | UNAVAILABLE | — |
| 005 | Last-10 win % | — | — | — | 5 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | RECENT_FORM | PARTIAL | UNAVAILABLE | PredixSport public tennis ratings (CC BY 4.0) |
| 006 | Bad-loss rate % | — | — | — | 25 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | LOSS_PROFILE | PARTIAL | UNAVAILABLE | PredixSport public tennis ratings (CC BY 4.0) |
| 007 | Common-opponent win % | — | — | — | 20 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | COMMON_OPPONENT | UNAVAILABLE | UNAVAILABLE | — |
| 008 | Deciding-set win % | — | — | — | 5 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | SET_PROFILE | DIRECT | UNAVAILABLE | PredixSport public tennis ratings (CC BY 4.0) |
| 009 | Pressure point win % | — | — | — | 18 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | DIRECT | UNAVAILABLE | PredixSport public tennis ratings (CC BY 4.0) |
| 010 | Straight-set win % | — | — | — | 5 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | SET_PROFILE | DIRECT | UNAVAILABLE | PredixSport public tennis ratings (CC BY 4.0) |
| 011 | Match win % | — | — | — | 5 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | RESULTS_HISTORY | UNAVAILABLE | UNAVAILABLE | PredixSport public tennis ratings (CC BY 4.0) |
| 016 | Break-point score-state win % | — | — | — | 24 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | UNAVAILABLE | — |
| 018 | Breakback rate % | — | — | — | 40 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | UNAVAILABLE | — |
| 027 | Lead protection % | — | — | — | 5 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | CLOSING_ABILITY | UNAVAILABLE | UNAVAILABLE | — |
| 029 | Response after a close set loss, vs own baseline | — | — | — | 25 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | PSYCH_RESPONSE | UNAVAILABLE | UNAVAILABLE | — |
| 031 | Opponent-adjusted set differential | — | — | — | 0.15 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | COMMON_OPPONENT | UNAVAILABLE | UNAVAILABLE | — |
| 032 | Break-point conversion % | — | — | — | 40 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | UNAVAILABLE | — |
| 034 | Dominance ratio | — | — | — | 0.15 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | UNAVAILABLE | — |
| 036 | Losses as favourite % | — | — | — | 15 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | LOSS_PROFILE | UNAVAILABLE | UNAVAILABLE | — |
| 041 | Elo-adjusted surplus, recent vs earlier | — | — | — | 0.1 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | IMPROVEMENT_TREND | UNAVAILABLE | UNAVAILABLE | — |
| 045 | Deciding-set win % as pre-match favourite | — | — | — | 25 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | SET_PROFILE | UNAVAILABLE | UNAVAILABLE | — |
| 051 | Opponent-specific win probability % | 50 | 50 | 0 | 3 | 0.00 | NEUTRAL | COMPARED | H2H_PROBABILITY | RECONSTRUCTED | RECONSTRUCTED | Four-tour static history index (data/generated/tennis-runtime-index.json) |
| 053 | Pressure index % | — | — | — | 18 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | UNAVAILABLE | — |
| 055 | Elo change over last 10 | — | — | — | 20 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | RECENT_FORM | PARTIAL | UNAVAILABLE | PredixSport public tennis ratings (CC BY 4.0) |
| 068 | Current win/loss streak (signed match count) | — | — | — | 5 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | RECENT_FORM | PARTIAL | UNAVAILABLE | runtime:atp_main |
| 080 | Common-opponent net divergent outcomes | — | — | — | 1 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | COMMON_OPPONENT | UNAVAILABLE | UNAVAILABLE | PredixSport public tennis ratings (CC BY 4.0) |

</details>

### Mananchaya Sawangkaew vs Panna Udvardy

- match_id `94a8003d-5bad-4008-82ac-4af126be0ac0` · audit_run_id `b2b3e6ba-777f-43d8-9ee3-415b93de454c` · US Open Round of 128 (Hard)
- stored: **INSUFFICIENT EVIDENCE** / colour INSUFFICIENT EVIDENCE / independent_winner null
- stage that caused the refusal: **P1/P2 METRIC EXECUTION**

| | P1 Mananchaya Sawangkaew | P2 Panna Udvardy |
| --- | --- | --- |
| supporting families | — | — |
| contradicting families | — | — |
| directional share (unrounded) | 0% | 0% |
| reaches 60% | no | no |
| verification: families supporting | — | — |
| verification: metrics not compared — own supply failure / refused on sample floor / supplied-but-unused | 20 / 0 / 2 | 20 / 0 / 2 |
| disagreement: families against this player | — | — |
| disagreement: overall severity | NONE | NONE |
| underdog: pathways | — (NO_VIABLE_PATHWAY) | — (NO_VIABLE_PATHWAY) |
| underdog: evaluated by production | false | false |
| stress: support before → after | 0% → 0% | 0% → 0% |
| stress: status | REMOVED | REMOVED |
| stress: outcome when THIS side is stressed | INSUFFICIENT | INSUFFICIENT |
| stress: run by production | true | true |
| stress: families manufactured out of NEUTRAL | — | — |

Conflicted families: — · neutral: H2H_PROBABILITY, RECENT_FORM, SURFACE_STRENGTH · directional denominator: 0

**Stage trace** — family vote `TIE` → threshold `TIE` → leave-one-family-out `TIE` → verification `TIE` → disagreement `TIE` → underdog `TIE` → stress `TIE` → stored `INSUFFICIENT`. Symmetric stress verdict: `NOT_APPLICABLE`.

**Why:** Only 3 of the 25 active metrics produced a two-sided comparison and no family expressed a direction, while 22 metric(s) never yielded comparable evidence at all (TREATMENT_NOT_USABLE x20, VALUE_NOT_PARSEABLE x2). The refusal is an evidence-supply outcome, not a comparative finding: the engine had almost nothing to compare the two players on.

> Dangerous Underdog audit analysed NEITHER player: runUnderdogAnalysis only examines the non-selected side, so a match with no selection gets no underdog analysis for anyone.

> P1/P2 carry no canonical player_id on this match; side identity rests on name and column position alone.

<details><summary>Per-metric evidence (P1 vs P2)</summary>

| code | metric | P1 | P2 | diff | noise floor | ×floor | favours | status | family | P1 treatment | P2 treatment | source |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 001 | Surface Elo | 1509.68 | 1518.91 | -9.23 | 10 | 0.92 | NEUTRAL | COMPARED | SURFACE_STRENGTH | DIRECT | DIRECT | PredixSport public tennis ratings (CC BY 4.0) |
| 002 | Service point win % | — | — | — | 10 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | UNAVAILABLE | — |
| 003 | Return point win % | — | — | — | 10 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | UNAVAILABLE | — |
| 005 | Last-10 win % | 0 | 0 | 0 | 5 | 0.00 | NEUTRAL | COMPARED | RECENT_FORM | PARTIAL | PARTIAL | PredixSport bundled public tennis history (CC BY 4.0) |
| 006 | Bad-loss rate % | — | — | — | 25 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | LOSS_PROFILE | UNAVAILABLE | UNAVAILABLE | — |
| 007 | Common-opponent win % | — | — | — | 20 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | COMMON_OPPONENT | UNAVAILABLE | UNAVAILABLE | — |
| 008 | Deciding-set win % | — | — | — | 5 | — | UNAVAILABLE | VALUE_NOT_PARSEABLE | SET_PROFILE | DIRECT | DIRECT | PredixSport bundled public tennis history (CC BY 4.0) |
| 009 | Pressure point win % | — | — | — | 18 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | UNAVAILABLE | — |
| 010 | Straight-set win % | — | — | — | 5 | — | UNAVAILABLE | VALUE_NOT_PARSEABLE | SET_PROFILE | DIRECT | DIRECT | PredixSport bundled public tennis history (CC BY 4.0) |
| 011 | Match win % | — | — | — | 5 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | RESULTS_HISTORY | UNAVAILABLE | UNAVAILABLE | — |
| 016 | Break-point score-state win % | — | — | — | 24 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | UNAVAILABLE | — |
| 018 | Breakback rate % | — | — | — | 40 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | UNAVAILABLE | — |
| 027 | Lead protection % | — | — | — | 5 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | CLOSING_ABILITY | UNAVAILABLE | UNAVAILABLE | — |
| 029 | Response after a close set loss, vs own baseline | — | — | — | 25 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | PSYCH_RESPONSE | UNAVAILABLE | UNAVAILABLE | — |
| 031 | Opponent-adjusted set differential | — | — | — | 0.15 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | COMMON_OPPONENT | UNAVAILABLE | UNAVAILABLE | — |
| 032 | Break-point conversion % | — | — | — | 40 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | UNAVAILABLE | — |
| 034 | Dominance ratio | — | — | — | 0.15 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | UNAVAILABLE | — |
| 036 | Losses as favourite % | — | — | — | 15 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | LOSS_PROFILE | UNAVAILABLE | UNAVAILABLE | — |
| 041 | Elo-adjusted surplus, recent vs earlier | — | — | — | 0.1 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | IMPROVEMENT_TREND | UNAVAILABLE | UNAVAILABLE | — |
| 045 | Deciding-set win % as pre-match favourite | — | — | — | 25 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | SET_PROFILE | UNAVAILABLE | UNAVAILABLE | — |
| 051 | Opponent-specific win probability % | 50 | 50 | 0 | 3 | 0.00 | NEUTRAL | COMPARED | H2H_PROBABILITY | RECONSTRUCTED | RECONSTRUCTED | Four-tour static history index (data/generated/tennis-runtime-index.json) |
| 053 | Pressure index % | — | — | — | 18 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | UNAVAILABLE | — |
| 055 | Elo change over last 10 | — | — | — | 20 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | RECENT_FORM | UNAVAILABLE | UNAVAILABLE | — |
| 068 | Current win/loss streak (signed match count) | — | — | — | 5 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | RECENT_FORM | UNAVAILABLE | UNAVAILABLE | — |
| 080 | Common-opponent net divergent outcomes | — | — | — | 1 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | COMMON_OPPONENT | UNAVAILABLE | UNAVAILABLE | — |

</details>

### Qinwen Zheng vs Kristina Liutova

- match_id `796da24e-b1f7-4c6c-b86c-06d4a20101c0` · audit_run_id `b6ae2c23-e970-48d9-b522-cd4bcea8dddd` · US Open Round of 128 (Hard)
- stored: **INSUFFICIENT EVIDENCE** / colour INSUFFICIENT EVIDENCE / independent_winner null
- stage that caused the refusal: **P1/P2 METRIC EXECUTION**

| | P1 Qinwen Zheng | P2 Kristina Liutova |
| --- | --- | --- |
| supporting families | — | — |
| contradicting families | — | — |
| directional share (unrounded) | 0% | 0% |
| reaches 60% | no | no |
| verification: families supporting | — | — |
| verification: metrics not compared — own supply failure / refused on sample floor / supplied-but-unused | 20 / 0 / 4 | 24 / 0 / 0 |
| disagreement: families against this player | — | — |
| disagreement: overall severity | NONE | NONE |
| underdog: pathways | — (NO_VIABLE_PATHWAY) | — (NO_VIABLE_PATHWAY) |
| underdog: evaluated by production | false | false |
| stress: support before → after | 0% → 0% | 0% → 0% |
| stress: status | REMOVED | REMOVED |
| stress: outcome when THIS side is stressed | INSUFFICIENT | INSUFFICIENT |
| stress: run by production | true | true |
| stress: families manufactured out of NEUTRAL | — | — |

Conflicted families: — · neutral: H2H_PROBABILITY · directional denominator: 0

**Stage trace** — family vote `TIE` → threshold `TIE` → leave-one-family-out `TIE` → verification `TIE` → disagreement `TIE` → underdog `TIE` → stress `TIE` → stored `INSUFFICIENT`. Symmetric stress verdict: `NOT_APPLICABLE`.

**Why:** Only 1 of the 25 active metrics produced a two-sided comparison and no family expressed a direction, while 24 metric(s) never yielded comparable evidence at all (TREATMENT_NOT_USABLE x24). The refusal is an evidence-supply outcome, not a comparative finding: the engine had almost nothing to compare the two players on.

> Dangerous Underdog audit analysed NEITHER player: runUnderdogAnalysis only examines the non-selected side, so a match with no selection gets no underdog analysis for anyone.

> P1/P2 carry no canonical player_id on this match; side identity rests on name and column position alone.

<details><summary>Per-metric evidence (P1 vs P2)</summary>

| code | metric | P1 | P2 | diff | noise floor | ×floor | favours | status | family | P1 treatment | P2 treatment | source |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 001 | Surface Elo | — | — | — | 10 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | SURFACE_STRENGTH | DIRECT | UNAVAILABLE | PredixSport public tennis ratings (CC BY 4.0) |
| 002 | Service point win % | — | — | — | 10 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | UNAVAILABLE | — |
| 003 | Return point win % | — | — | — | 10 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | UNAVAILABLE | — |
| 005 | Last-10 win % | — | — | — | 5 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | RECENT_FORM | PARTIAL | UNAVAILABLE | PredixSport bundled public tennis history (CC BY 4.0) |
| 006 | Bad-loss rate % | — | — | — | 25 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | LOSS_PROFILE | UNAVAILABLE | UNAVAILABLE | — |
| 007 | Common-opponent win % | — | — | — | 20 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | COMMON_OPPONENT | UNAVAILABLE | UNAVAILABLE | — |
| 008 | Deciding-set win % | — | — | — | 5 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | SET_PROFILE | DIRECT | UNAVAILABLE | PredixSport bundled public tennis history (CC BY 4.0) |
| 009 | Pressure point win % | — | — | — | 18 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | UNAVAILABLE | — |
| 010 | Straight-set win % | — | — | — | 5 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | SET_PROFILE | DIRECT | UNAVAILABLE | PredixSport bundled public tennis history (CC BY 4.0) |
| 011 | Match win % | — | — | — | 5 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | RESULTS_HISTORY | UNAVAILABLE | UNAVAILABLE | — |
| 016 | Break-point score-state win % | — | — | — | 24 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | UNAVAILABLE | — |
| 018 | Breakback rate % | — | — | — | 40 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | UNAVAILABLE | — |
| 027 | Lead protection % | — | — | — | 5 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | CLOSING_ABILITY | UNAVAILABLE | UNAVAILABLE | — |
| 029 | Response after a close set loss, vs own baseline | — | — | — | 25 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | PSYCH_RESPONSE | UNAVAILABLE | UNAVAILABLE | — |
| 031 | Opponent-adjusted set differential | — | — | — | 0.15 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | COMMON_OPPONENT | UNAVAILABLE | UNAVAILABLE | — |
| 032 | Break-point conversion % | — | — | — | 40 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | UNAVAILABLE | — |
| 034 | Dominance ratio | — | — | — | 0.15 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | UNAVAILABLE | — |
| 036 | Losses as favourite % | — | — | — | 15 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | LOSS_PROFILE | UNAVAILABLE | UNAVAILABLE | — |
| 041 | Elo-adjusted surplus, recent vs earlier | — | — | — | 0.1 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | IMPROVEMENT_TREND | UNAVAILABLE | UNAVAILABLE | — |
| 045 | Deciding-set win % as pre-match favourite | — | — | — | 25 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | SET_PROFILE | UNAVAILABLE | UNAVAILABLE | — |
| 051 | Opponent-specific win probability % | 50 | 50 | 0 | 3 | 0.00 | NEUTRAL | COMPARED | H2H_PROBABILITY | RECONSTRUCTED | RECONSTRUCTED | Four-tour static history index (data/generated/tennis-runtime-index.json) |
| 053 | Pressure index % | — | — | — | 18 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | UNAVAILABLE | — |
| 055 | Elo change over last 10 | — | — | — | 20 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | RECENT_FORM | UNAVAILABLE | UNAVAILABLE | — |
| 068 | Current win/loss streak (signed match count) | — | — | — | 5 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | RECENT_FORM | UNAVAILABLE | UNAVAILABLE | — |
| 080 | Common-opponent net divergent outcomes | — | — | — | 1 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | COMMON_OPPONENT | UNAVAILABLE | UNAVAILABLE | — |

</details>

### Mark Lajal vs Motoharu Abe

- match_id `7797e2e9-8f05-447d-a1f6-1a6cf25b93a4` · audit_run_id `cc10b524-ccf7-46a4-91e1-d6775b159663` · ATP Challenger Manacor Qualifying Round 1 (Hard)
- stored: **INSUFFICIENT EVIDENCE** / colour INSUFFICIENT EVIDENCE / independent_winner null
- stage that caused the refusal: **P1/P2 METRIC EXECUTION**

| | P1 Mark Lajal | P2 Motoharu Abe |
| --- | --- | --- |
| supporting families | — | — |
| contradicting families | — | — |
| directional share (unrounded) | 0% | 0% |
| reaches 60% | no | no |
| verification: families supporting | — | — |
| verification: metrics not compared — own supply failure / refused on sample floor / supplied-but-unused | 16 / 0 / 8 | 24 / 0 / 0 |
| disagreement: families against this player | — | — |
| disagreement: overall severity | NONE | NONE |
| underdog: pathways | — (NO_VIABLE_PATHWAY) | — (NO_VIABLE_PATHWAY) |
| underdog: evaluated by production | false | false |
| stress: support before → after | 0% → 0% | 0% → 0% |
| stress: status | REMOVED | REMOVED |
| stress: outcome when THIS side is stressed | INSUFFICIENT | INSUFFICIENT |
| stress: run by production | true | true |
| stress: families manufactured out of NEUTRAL | — | — |

Conflicted families: — · neutral: H2H_PROBABILITY · directional denominator: 0

**Stage trace** — family vote `TIE` → threshold `TIE` → leave-one-family-out `TIE` → verification `TIE` → disagreement `TIE` → underdog `TIE` → stress `TIE` → stored `INSUFFICIENT`. Symmetric stress verdict: `NOT_APPLICABLE`.

**Why:** Only 1 of the 25 active metrics produced a two-sided comparison and no family expressed a direction, while 24 metric(s) never yielded comparable evidence at all (TREATMENT_NOT_USABLE x24). The refusal is an evidence-supply outcome, not a comparative finding: the engine had almost nothing to compare the two players on.

> Dangerous Underdog audit analysed NEITHER player: runUnderdogAnalysis only examines the non-selected side, so a match with no selection gets no underdog analysis for anyone.

> P1/P2 carry no canonical player_id on this match; side identity rests on name and column position alone.

<details><summary>Per-metric evidence (P1 vs P2)</summary>

| code | metric | P1 | P2 | diff | noise floor | ×floor | favours | status | family | P1 treatment | P2 treatment | source |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 001 | Surface Elo | — | — | — | 10 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | SURFACE_STRENGTH | DIRECT | UNAVAILABLE | PredixSport public tennis ratings (CC BY 4.0) |
| 002 | Service point win % | — | — | — | 10 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | UNAVAILABLE | — |
| 003 | Return point win % | — | — | — | 10 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | UNAVAILABLE | — |
| 005 | Last-10 win % | — | — | — | 5 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | RECENT_FORM | PARTIAL | UNAVAILABLE | PredixSport public tennis ratings (CC BY 4.0) |
| 006 | Bad-loss rate % | — | — | — | 25 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | LOSS_PROFILE | PARTIAL | UNAVAILABLE | PredixSport public tennis ratings (CC BY 4.0) |
| 007 | Common-opponent win % | — | — | — | 20 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | COMMON_OPPONENT | UNAVAILABLE | UNAVAILABLE | — |
| 008 | Deciding-set win % | — | — | — | 5 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | SET_PROFILE | DIRECT | UNAVAILABLE | PredixSport public tennis ratings (CC BY 4.0) |
| 009 | Pressure point win % | — | — | — | 18 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | DIRECT | UNAVAILABLE | PredixSport public tennis ratings (CC BY 4.0) |
| 010 | Straight-set win % | — | — | — | 5 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | SET_PROFILE | DIRECT | UNAVAILABLE | PredixSport public tennis ratings (CC BY 4.0) |
| 011 | Match win % | — | — | — | 5 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | RESULTS_HISTORY | UNAVAILABLE | UNAVAILABLE | PredixSport public tennis ratings (CC BY 4.0) |
| 016 | Break-point score-state win % | — | — | — | 24 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | UNAVAILABLE | — |
| 018 | Breakback rate % | — | — | — | 40 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | UNAVAILABLE | — |
| 027 | Lead protection % | — | — | — | 5 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | CLOSING_ABILITY | UNAVAILABLE | UNAVAILABLE | — |
| 029 | Response after a close set loss, vs own baseline | — | — | — | 25 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | PSYCH_RESPONSE | UNAVAILABLE | UNAVAILABLE | — |
| 031 | Opponent-adjusted set differential | — | — | — | 0.15 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | COMMON_OPPONENT | UNAVAILABLE | UNAVAILABLE | — |
| 032 | Break-point conversion % | — | — | — | 40 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | UNAVAILABLE | — |
| 034 | Dominance ratio | — | — | — | 0.15 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | UNAVAILABLE | — |
| 036 | Losses as favourite % | — | — | — | 15 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | LOSS_PROFILE | UNAVAILABLE | UNAVAILABLE | — |
| 041 | Elo-adjusted surplus, recent vs earlier | — | — | — | 0.1 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | IMPROVEMENT_TREND | UNAVAILABLE | UNAVAILABLE | — |
| 045 | Deciding-set win % as pre-match favourite | — | — | — | 25 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | SET_PROFILE | UNAVAILABLE | UNAVAILABLE | — |
| 051 | Opponent-specific win probability % | 50 | 50 | 0 | 3 | 0.00 | NEUTRAL | COMPARED | H2H_PROBABILITY | RECONSTRUCTED | RECONSTRUCTED | Four-tour static history index (data/generated/tennis-runtime-index.json) |
| 053 | Pressure index % | — | — | — | 18 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | UNAVAILABLE | — |
| 055 | Elo change over last 10 | — | — | — | 20 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | RECENT_FORM | PARTIAL | UNAVAILABLE | PredixSport public tennis ratings (CC BY 4.0) |
| 068 | Current win/loss streak (signed match count) | — | — | — | 5 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | RECENT_FORM | PARTIAL | UNAVAILABLE | TennisMyLife ATP Challenger |
| 080 | Common-opponent net divergent outcomes | — | — | — | 1 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | COMMON_OPPONENT | UNAVAILABLE | UNAVAILABLE | PredixSport public tennis ratings (CC BY 4.0) |

</details>

### Raphael Collignon vs Sebastian Gorzny

- match_id `ec041fe3-5924-4443-beee-ea3b3a22770e` · audit_run_id `e2104ae8-4fae-4379-a27f-6bff98c09cba` · US Open Round of 128 (Hard)
- stored: **INSUFFICIENT EVIDENCE** / colour INSUFFICIENT EVIDENCE / independent_winner null
- stage that caused the refusal: **P1/P2 METRIC EXECUTION**

| | P1 Raphael Collignon | P2 Sebastian Gorzny |
| --- | --- | --- |
| supporting families | — | — |
| contradicting families | — | — |
| directional share (unrounded) | 0% | 0% |
| reaches 60% | no | no |
| verification: families supporting | — | — |
| verification: metrics not compared — own supply failure / refused on sample floor / supplied-but-unused | 16 / 0 / 8 | 24 / 0 / 0 |
| disagreement: families against this player | — | — |
| disagreement: overall severity | NONE | NONE |
| underdog: pathways | — (NO_VIABLE_PATHWAY) | — (NO_VIABLE_PATHWAY) |
| underdog: evaluated by production | false | false |
| stress: support before → after | 0% → 0% | 0% → 0% |
| stress: status | REMOVED | REMOVED |
| stress: outcome when THIS side is stressed | INSUFFICIENT | INSUFFICIENT |
| stress: run by production | true | true |
| stress: families manufactured out of NEUTRAL | — | — |

Conflicted families: — · neutral: H2H_PROBABILITY · directional denominator: 0

**Stage trace** — family vote `TIE` → threshold `TIE` → leave-one-family-out `TIE` → verification `TIE` → disagreement `TIE` → underdog `TIE` → stress `TIE` → stored `INSUFFICIENT`. Symmetric stress verdict: `NOT_APPLICABLE`.

**Why:** Only 1 of the 25 active metrics produced a two-sided comparison and no family expressed a direction, while 24 metric(s) never yielded comparable evidence at all (TREATMENT_NOT_USABLE x24). The refusal is an evidence-supply outcome, not a comparative finding: the engine had almost nothing to compare the two players on.

> Dangerous Underdog audit analysed NEITHER player: runUnderdogAnalysis only examines the non-selected side, so a match with no selection gets no underdog analysis for anyone.

> P1/P2 carry no canonical player_id on this match; side identity rests on name and column position alone.

<details><summary>Per-metric evidence (P1 vs P2)</summary>

| code | metric | P1 | P2 | diff | noise floor | ×floor | favours | status | family | P1 treatment | P2 treatment | source |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 001 | Surface Elo | — | — | — | 10 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | SURFACE_STRENGTH | DIRECT | UNAVAILABLE | PredixSport public tennis ratings (CC BY 4.0) |
| 002 | Service point win % | — | — | — | 10 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | UNAVAILABLE | — |
| 003 | Return point win % | — | — | — | 10 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | UNAVAILABLE | — |
| 005 | Last-10 win % | — | — | — | 5 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | RECENT_FORM | PARTIAL | UNAVAILABLE | PredixSport public tennis ratings (CC BY 4.0) |
| 006 | Bad-loss rate % | — | — | — | 25 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | LOSS_PROFILE | PARTIAL | UNAVAILABLE | PredixSport public tennis ratings (CC BY 4.0) |
| 007 | Common-opponent win % | — | — | — | 20 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | COMMON_OPPONENT | UNAVAILABLE | UNAVAILABLE | — |
| 008 | Deciding-set win % | — | — | — | 5 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | SET_PROFILE | DIRECT | UNAVAILABLE | PredixSport public tennis ratings (CC BY 4.0) |
| 009 | Pressure point win % | — | — | — | 18 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | DIRECT | UNAVAILABLE | PredixSport public tennis ratings (CC BY 4.0) |
| 010 | Straight-set win % | — | — | — | 5 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | SET_PROFILE | DIRECT | UNAVAILABLE | PredixSport public tennis ratings (CC BY 4.0) |
| 011 | Match win % | — | — | — | 5 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | RESULTS_HISTORY | UNAVAILABLE | UNAVAILABLE | PredixSport public tennis ratings (CC BY 4.0) |
| 016 | Break-point score-state win % | — | — | — | 24 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | UNAVAILABLE | — |
| 018 | Breakback rate % | — | — | — | 40 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | UNAVAILABLE | — |
| 027 | Lead protection % | — | — | — | 5 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | CLOSING_ABILITY | UNAVAILABLE | UNAVAILABLE | — |
| 029 | Response after a close set loss, vs own baseline | — | — | — | 25 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | PSYCH_RESPONSE | UNAVAILABLE | UNAVAILABLE | — |
| 031 | Opponent-adjusted set differential | — | — | — | 0.15 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | COMMON_OPPONENT | UNAVAILABLE | UNAVAILABLE | — |
| 032 | Break-point conversion % | — | — | — | 40 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | UNAVAILABLE | — |
| 034 | Dominance ratio | — | — | — | 0.15 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | UNAVAILABLE | — |
| 036 | Losses as favourite % | — | — | — | 15 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | LOSS_PROFILE | UNAVAILABLE | UNAVAILABLE | — |
| 041 | Elo-adjusted surplus, recent vs earlier | — | — | — | 0.1 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | IMPROVEMENT_TREND | UNAVAILABLE | UNAVAILABLE | — |
| 045 | Deciding-set win % as pre-match favourite | — | — | — | 25 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | SET_PROFILE | UNAVAILABLE | UNAVAILABLE | — |
| 051 | Opponent-specific win probability % | 50 | 50 | 0 | 3 | 0.00 | NEUTRAL | COMPARED | H2H_PROBABILITY | RECONSTRUCTED | RECONSTRUCTED | Four-tour static history index (data/generated/tennis-runtime-index.json) |
| 053 | Pressure index % | — | — | — | 18 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | POINT_BY_POINT | UNAVAILABLE | UNAVAILABLE | — |
| 055 | Elo change over last 10 | — | — | — | 20 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | RECENT_FORM | PARTIAL | UNAVAILABLE | PredixSport public tennis ratings (CC BY 4.0) |
| 068 | Current win/loss streak (signed match count) | — | — | — | 5 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | RECENT_FORM | PARTIAL | UNAVAILABLE | runtime:atp_main |
| 080 | Common-opponent net divergent outcomes | — | — | — | 1 | — | UNAVAILABLE | TREATMENT_NOT_USABLE | COMMON_OPPONENT | UNAVAILABLE | UNAVAILABLE | PredixSport public tennis ratings (CC BY 4.0) |

</details>
