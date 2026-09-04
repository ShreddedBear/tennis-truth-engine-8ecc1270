# Truth Engine Phase 12 — deterministic comparison coverage

Baseline: commit 9436e83, where `COMPARISON_SPECS` covered 9 of 81 metric codes. Every
other code reported `NO_COMPARISON_SPEC` and contributed nothing. The engine was correct
but narrow.

Registry after this phase: **22 of 81**. The target was never 81/81 — it was the largest
set of codes this system can legitimately understand from the evidence it actually holds.

## Classification of all 81 codes

| Category | Count | Codes |
|---|---|---|
| A. Deterministically comparable (registry) | 22 | 001 002 003 005 006 007 008 009 010 011 018 027 029 031 032 034 036 041 051 053 055 080 |
| B. Comparable after a producer fix | 3 | 013 014 030 |
| C. Insufficient evidence | 20 | 004 012 016 020 021 023 028 038 043 044 045 046 047 052 061 062 064 068 071 077 |
| D. Matrix-Summary-dependent (quarantined, untouched) | 15 | 015 019 022 024 025 026 033 035 037 039 040 042 060 070 075 |
| E. Ambiguous / protected / non-player | 21 | 017 048 049 050 054 056 057 058 059 063 065 066 067 069 072 073 074 076 078 079 081 |

## Newly activated (13)

Direction for every one is taken from the metric definition or the producer's own code,
never from the metric's name.

| Code | Field | Direction | Family | Floor | Proof of direction |
|---|---|---|---|---|---|
| 002 | `service_point_win_pct` | HIGHER | POINT_BY_POINT | 10 | Serve Profile; winning your service points is better |
| 003 | `return_point_win_pct` | HIGHER | POINT_BY_POINT | 10 | Return Profile |
| 006 | `bad_loss_rate_pct` | LOWER | LOSS_PROFILE | 25 | `predixsport-recent.server.ts`: share of losses to opponents ≥100 Elo below |
| 007 | `win_pct` | HIGHER | COMMON_OPPONENT | 20 | Common-Opponent Network: results against shared opponents |
| 009 | `pressure_win_pct` | HIGHER | POINT_BY_POINT | 18 | Comeback/Pressure Behavior |
| 018 | `breakback_rate_pct` | HIGHER | POINT_BY_POINT | 40 | Momentum & Closing Metrics |
| 029 | `after_close_set_loss_match_win_pct` − `baseline_match_win_rate_pct` | HIGHER | PSYCH_RESPONSE | 25 | Definition: "how a player performs in the set immediately following a narrowly lost set" |
| 032 | `bp_converted_pct` | HIGHER | POINT_BY_POINT | 40 | Point-to-Game Conversion Efficiency |
| 034 | `dominance_ratio` | HIGHER | POINT_BY_POINT | 0.15 | Definition names Dominance Ratio as a combined-efficiency measure |
| 036 | `favorite_losses_rate_pct` | LOWER | LOSS_PROFILE | 15 | `audit-metric-036`: `100 * favoriteLosses / losses` — losing when favoured is worse |
| 041 | `recent_elo_adjusted_surplus` − `earlier_elo_adjusted_surplus` | HIGHER | IMPROVEMENT_TREND | 0.10 | `audit-metric-041` line 76 defines improvement as exactly this comparison |
| 053 | `pressure_index_pct` | HIGHER | POINT_BY_POINT | 18 | Pressure & Clean-Game Metrics |
| 055 | `elo_change_last10` | HIGHER | RECENT_FORM | 20 | Trajectory: "the change in Elo rating over the most recent ten matches" |

Every noise floor is derived from the metric's **own median sample size in the live
database**, then ~1 standard error of the P1−P2 difference of a proportion — not from a
round number. Small-sample metrics carry deliberately large floors.

## Data-quality defects found and fixed

1. **Reconstructed metrics hid their numbers inside a JSON payload.** 002/003/009/018/
   032/034/053 persist `output={"service_point_win_pct":61.1,...}`. The `;`-splitting
   parser could not see inside, so seven codes carrying complete evidence were unreadable.
   `parseMetricValue` now merges the payload's **numeric leaves** into the same field map.
   Nulls, booleans and nested strings are skipped rather than coerced; a malformed payload
   is not evidence and is never guessed at; a top-level key always beats a payload key.

2. **A fixed noise floor cannot catch a thin denominator.** On run `ce9706af`, metric 018
   compared 0% against 100% breakbacks — a 100-point gap clearing any fixed floor — off
   **three and two attempts**. Specs now declare `sampleField` + `minSample`; below the
   threshold, *or when the denominator is not persisted at all*, the result is
   `INSUFFICIENT_SAMPLE`: never a lean, never zero. This caught 018 and 032 in both live
   runs and 007 in one (5 and 6 common-opponent matches).

## Codes needing a producer fix before they can be compared (B)

- **013 Availability** — `return_after_layoff_win_pct` exists in only 42 rows; the
  better-populated fields (`longest_observed_layoff_days`, layoff counts) have no
  defensible direction: a long layoff is not straightforwardly good or bad.
- **014 Ranking Context** — `rank`/`points` are directional, but 189/304 rows persist a
  bare unitless scalar and only 31 persist the keyed form. Needs the producer to emit the
  keyed shape consistently.
- **030 Tournament familiarity** — persists `same_tournament_wins_5y` and
  `same_tournament_matches_5y` but **no rate**. A raw win count is confounded by matches
  played. Needs a `same_tournament_win_pct`.

## Codes deliberately left unavailable (C), with the reason

- **008/010 bare scalars (189 rows each)**, **009 bare scalars**, **012 workload**,
  **028/064/071/077 schedule counts**, **068 streaks** — quantities with no documented
  unit or no defensible direction. "5", "12" and "1" are not interpreted.
- **020** — Elo-band win rates are directional only once you know today's favourite/
  underdog role, which the comparison layer does not model.
- **046 Match-State Elo** — directional, but it is another view of the same Elo ladder as
  001. Assigning it a separate family would manufacture false independent support;
  assigning it to SURFACE_STRENGTH risks a 60-row metric neutralising a 254-row one.
  Left out pending a decision on how to weight correlated Elo views.
- **045** — same reasoning against 008 (near-identical deciding-set population), on 51 rows.
- **052 entropy**, **043/044 upset-compatibility**, **047 dimensional z-tests**,
  **061 twin matches** (a match-level value identical on both sides, so not P1/P2
  symmetric) — no provable direction, or not a per-player quantity.
- **048/049/050/056/057/058/059** — classified META_OR_NON_PLAYER: they measure the audit
  itself, not the players, and must never vote on a winner.

## Evidence-family changes

New families: `POINT_BY_POINT`, `LOSS_PROFILE`, `PSYCH_RESPONSE`, `IMPROVEMENT_TREND`.

Correlated codes were deliberately merged so they vote **once**:

- 002/003/009/018/032/034/053 → one `POINT_BY_POINT` family. The database labels every one
  of them `evidence_family=POINT_BY_POINT`; they are all reconstructed from the same
  replay of the same handful of matches. Seven agreeing rows still cast a single vote,
  which a test pins.
- 007 joins 031/080 in `COMMON_OPPONENT` — one shared-opponent pool.
- 055 joins 005 in `RECENT_FORM` — the same ten-match window.
- 006 joins 036 in `LOSS_PROFILE` — the same recent-loss list.

29 is independent only because the player's own baseline is subtracted; without that it
would restate overall win rate and double-count RESULTS_HISTORY.

## Live database verification

Two real runs, full chain, before (9 specs) vs after (22 specs):

**Run `ce9706af` — Benjamin Hassan vs Francesco Forti.** Winner unchanged (P1, 5 supporting
families), but the expansion added a second contradiction family (LOSS_PROFILE: 55% vs 5%
losses-as-favourite), raised disagreement severity MAJOR → **CRITICAL**, took verification
findings 6 → 10, and — most importantly — flipped the stress test from STABLE to
**UNSTABLE**: under adverse recomputation the selection now moves P1 → P2. The engine was
previously reporting a fragile selection as stable.

**Run `bd5ff483` — Marek Gengel vs Alex Hernandez.** Before: `INSUFFICIENT_EVIDENCE`, no
winner at all. After: **P2, Alex Hernandez**, from 3 independent supporting families
(COMMON_OPPONENT, PSYCH_RESPONSE, SURFACE_STRENGTH) against 2 contradiction families.
`RECENT_FORM` is correctly **conflicted** — 005 favours P1 (70% vs 40% last-10) while 055
favours P2 (−14.4 vs +10.0 Elo change) — so the family votes for nobody, exactly as the
anti-double-counting design requires. Underdog went from no pathway to a STRONG
`RANKING_LAG` pathway at 6× the noise floor.

New evidence demonstrably reaches every layer: comparison → family → verification →
disagreement → underdog → stress → final winner.

## Validation

1036 tests across 135 files, clean `tsc --noEmit`, worker bundle 7.7MB/25MB. The suite
includes a P1/P2 swap test for **every** registered spec (the measured values follow the
player, the advantage is exactly negated, and one-sided evidence favours neither slot).

## Remaining limitations

- 22 of 81 codes is the honest ceiling on current evidence, not a finished job. The three
  B-category codes are the cheapest wins and need producer changes, not registry changes.
- Noise floors are per-metric constants calibrated on median sample size; the `minSample`
  guard covers the thin-denominator failure, but a spec still cannot widen its floor
  smoothly as n shrinks.
- The nine pre-Phase-12 specs were left without sample guards, because their denominators
  are not consistently persisted and changing them without proof was out of scope.
- Surface/context normalisation is still not modelled anywhere in the comparison layer.
