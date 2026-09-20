# Metrics #043 and #044 — the market-pricing-mismatch correction

Status: **DONE and wired live** — real per-player historical-pattern engines
built, tested (unit + leakage + live-pipeline integration), and wired ahead
of the existing market-pricing tier. Metric #029 also reconnected to the
live pipeline in the same pass (see the bottom of this doc).

## The prior claim, and why it was wrong

`src/lib/deterministic-market-metrics.server.ts` computed codes `"043"` and
`"044"` as de-vig market pricing / price-movement / favorite-share text from
The Odds API (`MARKET_CODES = new Set(["015", "019", "043", "044"])`). That
is real, correctly-sourced data — but it is not what either code's
`evidence-gap.ts` definition actually asks for:

- **043 — Favorite Failure-Mode Score**: "favorite-role historical losses
  with pre-match favorite designation, the exact failure conditions
  observed in those losses (including serve/return and set-state
  conditions), and today's opponent's sourced ability to reproduce those
  same conditions."
- **044 — Opponent Upset Compatibility**: "historical matches where the
  player was the underdog, verified upset outcomes, and similarity
  features for today's favorite across Elo, serve style, return quality,
  surface, ranking, handedness, rally style, price, and tournament level."

Both definitions are almost entirely about a player's own historical
win/loss *pattern*, cross-referenced against the specific opponent faced
today — market pricing is at most one supporting input (price for #044,
favorite designation for #043), never the whole metric. This is the same
kind of code-content mismatch this codebase has corrected before (metric
020 was retargeted earlier in this project).

## What was built

Two new modules, following the exact `LaneOutcome<T>` / per-tour-lane
GO/NOT_ENOUGH_DATA pattern already established by
`audit-metric-036-loss-autopsy.ts`, `audit-metric-046-match-state-elo.ts`,
and `audit-metric-051-opponent-specific-probability.ts`:

### `src/lib/audit-metric-044-opponent-upset-compatibility.ts`

Built first because #043 reuses its core. `computeUnderdogWinProfile`
replays a player's chronological match history (the same leakage-safe
`replayElo` K=32 pass `#020/#031/#036/#041/#045/#046` already use) and
extracts every WIN where the player's pre-match derived Elo was lower than
the opponent's — a verified upset outcome. For each such win, on the two
tour lanes where `set_scores` exists (`WTA_MAIN`/`ATP_CHALLENGER` — the same
structural gap `#036`/`#046` already document), it classifies the exact
same failure-mode conditions `#036` already classifies for losses, reused
directly rather than re-derived (`blowoutMargin`/`tiebreakSet`/
`buildSetScoreIndex` are now exported from `audit-metric-036-loss-autopsy.ts`
for this purpose): `took_set_1`, `deciding_set`, `tiebreak_factor`,
`blowout_win`.

`computeOpponentUpsetCompatibility` then compares today's favorite against
that upset history:

- **Elo**: today's favorite's derived Elo vs. the average Elo of favorites
  this player has upset before (`elo_gap_to_avg_upset_opponent`).
- **Surface**: what fraction of the player's past upset wins were on
  today's match surface (`surface_match_rate_pct`).
- **Price**: deliberately left to the market fallback tier rather than
  merged in — see "Wiring" below.

Explicitly excluded, not guessed (`OPPONENT_UPSET_COMPATIBILITY_EXCLUDED_DIMENSIONS`):

- **Ranking**: the static four-tour history index does not store a
  historical ranking snapshot per match row — only current/latest rankings
  exist, separately DB-sourced via `deterministic-ranking-metrics.server.ts`
  with no per-match history. Same substitution `#020`/`#031`/`#041` already
  make (derived Elo stands in for sparse/absent ranking).
- **Handedness**: `metric-recoverability-map.ts`'s own `"068"` row already
  states, verified and unchanged, "match results exist but handedness field
  is not confirmed in current evidence universe" (`TRULY_UNAVAILABLE`). No
  handedness field exists anywhere in this system, current or historical.
- **Serve style / return quality / rally style**: no serve/return/shot
  statistic exists anywhere in the static history index, and no approved
  BSD point-by-point source aggregates to a chronological per-player
  serve/return/rally-shape series — the same gap `#036`'s own header
  documents for its mirror-image Loss Serve/Return Deterioration bullets.
- **Tournament level**: the static index carries a tournament name and
  round, not a level/tier field, and this whole computation is already
  scoped to a single tour lane per call — so within one lane's replay, tour
  level is structurally constant across a player's various upset
  opponents, not a real differentiator. Cross-lane merging is the same
  materially larger plumbing task `#020`'s header already declines for its
  own "Tour-Level Transition Performance" bullet.

### `src/lib/audit-metric-043-favorite-failure-mode.ts`

Composes two already-real engines rather than re-deriving either:

1. `audit-metric-036-loss-autopsy.ts`'s `computeLossAutopsy` for the
   PLAYER — their own favorite-role losses, with pre-match Elo favorite
   designation and the exact set-state failure conditions observed.
2. `audit-metric-044`'s `computeUnderdogWinProfile` for the OPPONENT —
   their own verified underdog wins, classified by the same conditions. An
   opponent's rate of reproducing a given condition IN THEIR OWN underdog
   wins (e.g. taking set 1 off a stronger player, forcing a decider,
   winning tiebreaks) is a real, sourced measure of their ability to
   reproduce that same condition against today's favorite.

Per-condition rates are reported side by side
(`player_favorite_loss_rate_pct` vs. `opponent_reproduction_rate_pct` for
each of `lost_set_1`/`deciding_set`/`tiebreak_factor`/`blowout_loss`), plus
one explicit composite, `reproduction_compatibility_score_pct`: a
relevance-weighted average of the opponent's reproduction rate, weighted by
how often the player actually fails via that specific condition (a
condition the player never fails on contributes zero weight — an opponent
being great at forcing deciding sets is irrelevant if the player never
loses via a deciding set as the favorite). See
`computeFailureConditionCompatibility`'s own comment for the exact formula
and its unit tests for the weighting behavior.

## Wiring

`src/lib/deterministic-batch4-favorite-underdog-patterns.server.ts` adapts
both modules' `LaneOutcome<T>` into `MetricFinding`, following the exact
`deterministic-batch1`/`deterministic-batch2` reconnection pattern. Unlike
those two tiers (which require BOTH players GO on a symmetric metric),
043/044 are inherently directional/per-player, so this tier emits a real
finding when AT LEAST ONE side resolves — the other side reports its own
honest `NOT_ENOUGH_DATA` reason in its value text (and gets `UNAVAILABLE`
treatment on that side specifically) rather than being suppressed entirely.

Wired into `warehouse-first-researcher.server.ts`'s deterministic chain
**ahead of** `deterministicMarketMetric` — see that call site's comment.
`deterministic-market-metrics.server.ts`'s `MARKET_CODES` deliberately
still lists `"043"`/`"044"` unchanged: when the new tier returns null (no
qualifying favorite-role-loss or verified-underdog-win history in this
lane), the market tier remains a real, useful `PARTIAL` fallback — price
context and favorite designation are genuinely named inputs to these
metrics, just not the whole of either one. The two tiers were not merged:
`deterministicMarketMetric` is an async Supabase-backed call, while every
module in this batch (and `#036`/`#046`/`#051` before it) is a synchronous,
static-index-only replay — keeping them separate preserves that consistent,
already-tested contract.

`src/lib/metric-source-family-policy.ts`: `"043"`/`"044"` added to
`RESULTS_SCHEDULE_METRICS` (both engines are entirely static-index/results
data, the same family `#036`/`#046` already carry) — `MARKET_METRICS` and
`PBP_METRICS` membership for these two codes was left unchanged, since the
market fallback tier and the (currently unused for these codes) generic PBP
path remain legitimately applicable/inert respectively.

`src/lib/metric-classification.ts`: `"043"`/`"044"` were not present in any
excluded list before this task and still are not — both stay in the
60-metric player denominator, unchanged.

## Tests

- `audit-metric-043-favorite-failure-mode.test.ts` /
  `audit-metric-044-opponent-upset-compatibility.test.ts`: pure-core unit
  tests (condition weighting, null-safety, capping) plus live-wrapper tests
  against the real generated index.
- `audit-metric-043-favorite-failure-mode.leakage.test.ts` /
  `audit-metric-044-opponent-upset-compatibility.leakage.test.ts`: prove
  the chronological replay never surfaces a row dated on or after
  `asOfDate`, both via a synthetic fixture (mirroring `#036`'s own leakage
  test) and against the real index.
- `deterministic-batch4-favorite-underdog-patterns.test.ts`:
  integration-style test proving the live-wired tier produces a real,
  non-fabricated finding on the real generated index (fixture pair "zdenek
  kolar" / "andrea collarini" on `ATP_CHALLENGER`, the same data-rich pair
  `deterministic-batch1`/`deterministic-batch2`'s own tests already use),
  with clean `NOT_ENOUGH_DATA` fall-through for nonexistent players and
  ineligible lanes.

## Metric #029 — reconnected in the same pass

`src/lib/audit-metric-029-psychological-response-proxy.ts` was built,
tested in isolation, and documented against evidence-gap.ts's real #029
catalog entry, but (verified by grep — nothing outside its own `.test.ts`
imported it) was never called from `warehouse-first-researcher.server.ts`
or any live dispatch path — the exact same "built but orphaned" situation
`027`/`031`/`041`/`046`/`051` were in before
`docs/ARCHITECTURE-FINDING-disconnected-hybrid-researcher.md`'s earlier
reconnection pass. It is now the sixth code owned by
`deterministic-batch1-standalone-metrics.server.ts` (`OWNED` extended to
include `"029"`), following the identical pattern: its
`LaneOutcome<PsychologicalResponseResult>` is adapted into `MetricFinding`
with no change to its own math/logic. `metric-source-family-policy.ts`
previously had NO family membership at all registered for `"029"` (an
oversight, verified by grep before this task) — now added to
`RESULTS_SCHEDULE_METRICS`, the same family `#027` (its sibling, reading
the same `repository-results-history.server.ts` source) already carries.
`metric-classification.ts` was checked and already correctly has no
excluded-list entry for `"029"` — no change needed there.
`deterministic-batch1-standalone-metrics.test.ts` gained a live-pipeline
integration test proving a real finding is now produced.
