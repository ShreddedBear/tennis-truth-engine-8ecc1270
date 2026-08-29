# Metrics #036/#037/#039 — Loss/Win Autopsy + Performance Surprise Rating

Status: **DONE** (code, unit tests, leakage guard). Real audit-DB population
size (n) is pending GitHub issue #82's Copilot read-only query — see
"Sample size" below. `MIN_SUPPORT_N` (50) is enforced regardless of what
that n turns out to be; this module will honestly report `NOT_ENOUGH_DATA`
if it comes back under threshold.

Files: `src/lib/audit-metric-036-037-loss-win-autopsy.ts` (+ `.test.ts`),
`src/lib/audit-metric-039-performance-surprise.ts` (+ `.test.ts`),
`src/lib/audit-metric-036-037-039-live.server.ts` (live Supabase wrapper).

## Population

Bounded strictly to the **48-table audit DB**, not the four-tour historical
index (see `docs/audit-task-new-batch1-step0.md`). A match qualifies only
if `matches.actual_winner` is populated (real outcome known) AND its active
`summary_versions` row has both a `matrix_wp` and `matrix_predicted_winner`
in `parsed_summary_fields`. This is a single population report, not
per-tour-lane — the ticket's own build-order note calls this metric family
"no lane-scoping complexity beyond the audit-DB boundary."

## #036/#037 — Loss Autopsy / Win Autopsy

Classifies each qualifying match from the perspective of the player
TennisMatrixAi favored (`matrix_predicted_winner`), using its own pre-match
win probability (`matrix_wp`) and the final score margin.

**Win categories** (`classifyWinOutcome`):
- `DOMINANT` — won, pre-match probability > 70%
- `ROUTINE` — won, pre-match probability 55–70% (inclusive)
- `ESCAPE` — won as an underdog (< 45%) in a close match
- `UPSET_WIN` — won as an underdog (< 45%), not close

**Loss categories** (`classifyLossOutcome`):
- `BAD_LOSS` — lost, pre-match probability > 70%
- `CLOSE_LOSS` — lost, pre-match probability 55–70%
- `EXPECTED_LOSS` — lost as an underdog (< 45%)

The 45%–<55% coin-flip band is **deliberately left unclassified** (`null`)
rather than folded into a neighboring bucket — the ticket only defined
named bands with a gap between them, and inventing a rule to fill that gap
would be an unstated judgment call. Reported as `UNCLASSIFIED` in
distribution aggregates.

"Closeness" (`isCloseMatch`) is: the match went the full `best_of`
distance, or any set was a tiebreak (`7-6`/`6-7`) or decided by ≤2 games
at 7+ games (e.g. `7-5`). A plain `6-4` set is *not* treated as close — at
minimum-length games with a routine margin, it is the ordinary case, not a
narrow one.

**Known limitation — "Opponent Collapse" not implemented.** This is a
named Win Autopsy subtype describing an in-play win-probability collapse
by the opponent. It requires point-by-point/in-play win-probability
tracking over the course of a match; the audit DB stores only a single
pre-match probability. Skipped per the ticket's own allowance for
data-unavailable subtypes, rather than approximated from final-score shape
alone (which would not actually measure the thing this subtype names).

## #039 — Performance Surprise Rating

Per-match **signed surprise** = actual outcome (1 = won, 0 = lost) minus
TennisMatrixAi's pre-match win probability (0–1 scale), on a -1..+1 scale.
Positive = player outperformed the prediction; negative = underperformed.

A **rolling average of absolute surprise** over a player's trailing N
scored matches (`computeRollingSurprise`, caller-supplied window) is
reported as a volatility indicator: a high mean absolute surprise means
TennisMatrixAi's probability has recently been a poor fit to this player's
outcomes, independent of direction. The live wrapper does not sort or
dedupe input order — the caller must supply matches oldest-to-newest, which
the leakage guard below already establishes an eligibility ordering for.

Audit-DB-wide aggregate (`summarizeSurpriseDistribution`) reports mean
absolute and mean signed surprise across the whole qualifying population,
gated by `MIN_SUPPORT_N`.

## Leakage guard

Unlike the historical-index trailing-N metrics (which leak via a
match-date filter), this metric family's leak risk is different: a
`matrix_wp`/`matrix_predicted_winner` value **recorded on or after** the
match's own `result_recorded_at` would be a "prediction" made with
hindsight, not a genuine pre-match call. `isPredictionBeforeResult`
compares the `matrix_wp` field's own `created_at` against
`matches.result_recorded_at` and fails closed (excludes the match) on any
missing or unparseable timestamp — never assumes a match is safe to
include. The live wrapper (`audit-metric-036-037-039-live.server.ts`)
applies this guard before a match ever reaches the pure classification
functions.

## Live wrapper

`loadAuditDbScoredMatches()` follows the same `supabaseAdmin` /
`LOCAL_WORKSPACE_ID` / `summary_versions(match_id, is_active=true)` →
`parsed_summary_fields(summary_version_id)` join `audit-repo.server.ts`'s
`getParsedFields` already uses (not `matches.active_summary_version_id`,
which is a different, single-match UI-autofill path in
`calibration-matrix-autofill.ts`). It joins `matrix_wp` +
`matrix_predicted_winner`, coerces `matrix_wp` numerically (never
fabricates a probability from a malformed value — drops the match
instead), applies the leakage guard, and computes closeness from
`final_score`/`best_of`. `toScoredOutcome`/`toSurpriseInput` convert a
qualifying row into the two pure modules' input shapes, always from the
perspective of the player TennisMatrixAi favored (matched by last name
against `actual_winner`, the same fuzzy-match convention
`audit-pipeline.ts`'s `revealMatrix` already uses).

## Sample size

Real n for this population is pending GitHub issue #82 (Copilot read-only
query, action item 1: real n for `matrix_wp`/`matrix_predicted_winner` +
`actual_winner` join). Per the new standing routing rule, that PR's diff
and literal query output will be reviewed here before treating the real n
as settled.
