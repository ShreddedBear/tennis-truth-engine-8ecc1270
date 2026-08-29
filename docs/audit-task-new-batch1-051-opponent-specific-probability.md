# Metric #051 — Opponent-Specific Set/Match Probabilities

Status: **DONE**. Code + 10 unit/leakage tests, all passing.

Files: `src/lib/audit-metric-051-opponent-specific-probability.ts` (+
`.test.ts`, `.leakage.test.ts`).

## What this ships

The ticket's bullet is "Opponent-Specific Break Expectancy" (break-serve
probability against a specific opponent). This module ships the
structurally-buildable analogue with the data actually available: a
player's H2H win rate against one specific opponent, shrunk toward a
general (non-opponent-specific) win probability by Bayesian shrinkage
weighted on H2H sample size. Raw H2H alone is nearly always too small to
trust on its own — most historical pairs have 0–3 meetings.

`shrinkage_weight = n_h2h / (n_h2h + k)`, `k = 8` (`DEFAULT_SHRINKAGE_K`,
tunable, documented in-file): an opponent with 8 prior meetings gets equal
weight between raw H2H and the general model; 2 meetings ≈ 20% H2H weight;
20 meetings ≈ 71% H2H weight. Deliberately conservative until real
validation data justifies a different `k`.

This module does **not** compute the general win probability itself — the
caller supplies it (an Elo expected-score conversion, or TennisMatrixAi's
own pre-match probability when auditing a specific prediction). It only
shrinks that number toward the H2H rate. Informative even at `n_h2h = 0`:
shrinkage toward the general model is the intended behavior there, not a
fallback to suppress.

## Data source & leakage safety

Four-tour static history index (`data/generated/tennis-runtime-index.json`)
via `repository-results-history.server.ts`'s `repositoryResultsRows`.
Leakage safety is enforced by that function's own `strictBefore: true`
option (only rows with `event_date` strictly before `asOfDate`), not
reimplemented here — verified end-to-end in the leakage test against a
real recorded meeting (Jan Hernych vs Joao Souza, ATP_MAIN, 2018-02-05):
excluded when `asOfDate` equals the match date, included the day after,
excluded when `asOfDate` is years earlier.

## Reporting

Per-lane (`ATP_MAIN`/`WTA_MAIN`/`ATP_CHALLENGER`/`WTA_CHALLENGER`) via the
shared `LaneOutcome` type — `GO` with `n = n_h2h` and the shrunk
probability, or `NOT_ENOUGH_DATA` when no usable general probability was
supplied or player/opponent resolve to the same identity. Per
`docs/audit-task-new-batch1-step0.md`'s resolution, this metric needed no
special-casing: it only needs H2H match outcomes from the static index, no
rank/Elo dependency, so it is GO as found across all four lanes (subject to
each specific player pair actually having qualifying rows).
