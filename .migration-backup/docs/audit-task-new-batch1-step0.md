# New Signal Batch 1 — Step 0 Data Audit + Resolution

Status: Step 0 complete and resolved. **Phase 1 build complete**: #051, #036/#037/#039, #027/#029, #031/#041, #046 all DONE (code, tests, leakage guards, per-metric docs — see each metric's own doc file in this directory). #062 confirmed BLOCKED and skipped per the resolution below. Phase 2 not yet started. Real audit-DB population size for #036/#037/#039 remains pending GitHub issue #82's Copilot read-only query.

## The two data universes

1. **The 48-table Supabase audit DB** (`src/integrations/supabase/types.ts`, schema-confirmed) — records of matches submitted to Truth Engine for audit (via PDF upload), audit-run progress, and TennisMatrixAi's own predicted fields (`parsed_summary_fields`, keyed by `field_key`/`normalized_value` — not dedicated columns).
2. **A build-time-compiled static index** (`scripts/build-runtime-tennis-index.mjs` → `data/generated/tennis-runtime-index.json`, sourced from `data/public/*` CSVs) — the four-tour historical corpus (`ATP_MAIN`, `WTA_MAIN`, `ATP_CHALLENGER`, `WTA_CHALLENGER`) used to compute a player's own history. Phase 1's per-player trailing-N stats live here, not in Supabase.

No live Supabase connection is available from this sandbox (confirmed hard `403` policy denial). Everything below the fold that needed the static index was measured by actually running the build script — real counts, not estimates. Everything that needs the live 48-table DB is explicitly marked as pending the Copilot action items.

## Step 0 findings (measured, not assumed)

| Lane | Player-side rows | Set scores populated | self_rank populated | opponent_rank populated | self_elo populated | Date range |
|---|---:|---:|---:|---:|---:|---|
| ATP_MAIN | 79,002 | 0.0% | 0.0% | 0.0% | 100.0% | 2015-01-04 → 2026-05-06 |
| WTA_MAIN | 46,054 | 99.3% | 13.6% | 13.6% | 0.0% | 2021-01-05 → 2026-08-23 |
| ATP_CHALLENGER | 65,732 | 99.6% | 99.7% | 99.7% | 0.0% | 2007-12-31 → 2026-08-10 |
| WTA_CHALLENGER | 15,230 | 0.0% | 0.0% | 0.0% | 0.0% | 2021-05-02 → 2026-08-26 |

- **Set-sequence data**: exists, but only for WTA_MAIN and ATP_CHALLENGER. ATP_MAIN's source CSV only ever carries `sets_for`/`sets_against` totals; WTA_CHALLENGER's does too. Structural gap, not a sparse-data gap.
- **Ranking history**: no dedicated table anywhere (48-table schema has no `rankings`/`ranking_history` table; `players` has no ranking column). The static index embeds `self_rank`/`opponent_rank` per historical match row (a reconstructable trajectory, not a time-series table), populated only for WTA_MAIN (13.6%) and ATP_CHALLENGER (99.7%).
- **Draw/tournament metadata**: `tournaments` has only `name/surface/event_level/indoor/edition_year`; `matches` has `round` but no seed/bye/draw_size column anywhere in either data universe. Confirmed schema gap (see Copilot action item 3).
- **TennisMatrixAi's predicted winner/probability + actual result**: `matches.actual_winner`/`result_status` capture the real outcome directly. Predicted winner/probability live in `parsed_summary_fields` as `matrix_wp`/`matrix_predicted_winner` string fields — real n of matches with both populated is pending Copilot action item 1.
- **Elo**: no stored table; computed on demand by replaying the static index's ordered history strictly before the target date (`task18c-rank-form-workload.ts`'s `replayElo`) — already leakage-safe by construction.

## Resolution (decisions applied, not left open)

- **#027 Opponent Finishing Ability** — GO, tour-scoped. Real value for WTA_MAIN/ATP_CHALLENGER; explicit `NOT_ENOUGH_DATA` (never a null that reads as zero) for ATP_MAIN/WTA_CHALLENGER.
- **#029 Psychological Response Proxy** — same tour-scoping as #027. Break-advantage refinement dropped everywhere (no game/point-level data in this index for it); score-margin-only definition shipped, with the dropped refinement documented as "attempted, blocked, here's why" so it isn't re-attempted without new data.
- **#031 Opponent-Network Point Differential** / **#041 Hidden Improvement Detector** — strength adjustment uses **derived Elo (via `replayElo`), uniformly across all four lanes**, not rank. This turns both from a lane-inconsistent PARTIAL into a fully GO metric. Elo replay cost at volume is reported in each metric's doc entry as a performance note, not a data-availability blocker.
- **#036/#037/#039 (Loss/Win Autopsy, Performance Surprise)** — GO, strictly bounded to the audit DB's own `parsed_summary_fields`-scored matches (never extended to the 200k+ row historical index by inventing win probabilities TennisMatrixAi never actually produced). Real n pending Copilot action item 1; ships with the minimum-support threshold enforced honestly regardless of how small that n comes back.
- **#046 Match-State Elo** — GO, restricted to WTA_MAIN/ATP_CHALLENGER only, per minimum-support.
- **#051 Opponent-Specific Probabilities** — GO as found; only needs H2H match outcomes from the static index, no rank/Elo dependency.
- **#062 Motivation/Stakes** — fully BLOCKED, closed out of Batch 1 entirely. Confirmed schema gap on both ranking-points-defended and draw/seed/bye metadata (there is no seeding half to ship either). Logged as a separate future ticket requiring new ingestion.

## Standing pattern adopted

Every metric module in this batch (and future batches) reports its result **per tour lane** (`ATP_MAIN` / `WTA_MAIN` / `ATP_CHALLENGER` / `WTA_CHALLENGER`), each independently `GO` or `NOT_ENOUGH_DATA`, never a single verdict for the whole metric. This directly reflects the Step 0 finding that data availability is inconsistent by lane, not uniformly available or unavailable.

## Copilot action items (Supabase-dependent, routed per the new review-gate process)

Not run from this sandbox (no live DB access). Scoped as read-only queries only, no code change, so the PR is just the query + literal output:

1. Real row count: `matches` joined to `parsed_summary_fields` where `field_key` is `matrix_wp` or `matrix_predicted_winner` AND `actual_winner` is populated (the true n for #036/#037/#039).
2. Full-schema search (all 48 tables/columns) for anything resembling ranking points, computed points, or points-defended — confirm the #062 schema gap isn't a naming miss.
3. Full-schema search for seed/bye/draw_size across `tournaments` and `matches` — confirm that schema gap too.

Per the review gate: Claude reads the actual diff and the actual reported query output before treating any of these as settled, and flags immediately (not silently reworks) if the evidence doesn't support the claim.
