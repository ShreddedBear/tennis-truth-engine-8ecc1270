# Live Tennis API historical parity gate — 2026-09-20

## Decision

**BLOCKED_PENDING_BOTH**

Candidate D remains frozen. No Candidate B/D execution, tuning, calibration change, historical ingestion, database write, provider deletion, subscription change, push, merge, or deployment was performed.

The two blocking classes are:

1. **Technical parity:** Availability is not point-in-time safe, player identity is not deterministic for the candidate population, and ATP/WTA tournament-level mapping is incomplete.
2. **Licensing:** the terms do not clearly authorize the required persistent historical storage and evaluation workflow.

Serve/Return itself is no longer the blocker: the authoritative 1,644-row experiment used the score/game-margin proxy for every row.

## Authoritative 1,644-row Serve/Return regime

The protected population is the 1,644-row authoritative paired replay with 1,604 gradeable rows.

The executable replay reconstructs each player's strictly prior `MatchRecord[]` from `historical_matches`, then calls `computeServeReturnModule`. That module uses direct statistics only when both players have at least three prior matches containing both `servicePointsWonPct` and `returnPointsWon`. Otherwise both sides use `setGameMargins`.

Read-only measurement against the protected match IDs found:

| Regime | All rows | Percent | Gradeable rows | Gradeable percent |
|---|---:|---:|---:|---:|
| Direct match statistics | 0 | 0.00% | 0 | 0.00% |
| PBP-derived | 0 | 0.00% | 0 | 0.00% |
| Score/game-margin proxy | 1,644 | 100.00% | 1,604 | 100.00% |
| Default/no usable margin | 0 | 0.00% | 0 | 0.00% |

All protected targets are Sackmann rows. Their relevant pre-cutoff histories were also Sackmann rows; the replay mapper did not expose their raw Sackmann serve-stat columns as `MatchRecord.stats`. Of 232,603 relevant prior rows, zero had the API-Tennis `statistics` object consumed by the mapper and 231,343 had stored game margins.

Therefore, comparing a post-June population through the same score/game-margin path would preserve the original Serve/Return regime more closely than switching to direct or PBP-derived statistics.

## Live Tennis API Pro reconstruction

Live Tennis API Pro supplies final per-set `score.games` arrays. These map directly to the existing `setGameMargins` proxy input after orientation to the selected player. No PBP semantics need to be asserted equivalent to direct provider statistics.

The Pro match-statistics endpoint remains Ultra-gated, but that does not prevent reproduction of the authoritative replay's Serve/Return regime because that replay used zero direct-stat rows.

Required adapter rule:

- classify final per-set games as `SUPPORTED_BY_SCORE_PROXY`;
- preserve super-tiebreak semantics from the provider documentation;
- never label score-derived values as direct serve statistics;
- never mix direct statistics for one player with proxy values for the other.

## Post-June observational population

Read-only pagination covered `2026-06-03` through `2026-09-20` as observed at `2026-09-20T03:50:10Z`. The endpoint was still updating during the audit; counts are observational and are not a frozen holdout.

| Tour | Matches | Any observed/reconstructed tape | Point-complete | Final per-set score | Complete outcome | Surface | Player IDs | Tournament ID | Round | Scheduled time | Format |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| ATP | 1,905 | 1,817 | 701 | 1,810 | 1,773 | 1,713 | 1,905 | 1,808 | 1,721 | 1,905 | 1,905 |
| WTA | 1,894 | 1,811 | 775 | 1,800 | 1,767 | 1,817 | 1,894 | 1,800 | 1,834 | 1,894 | 1,894 |
| Challenger | 6,200 | 6,133 | 2,667 | 6,092 | 6,003 | 6,116 | 6,200 | 6,132 | 6,177 | 6,200 | 6,200 |
| ITF | 19,025 | 18,717 | 7,724 | 18,613 | 18,002 | 16,630 | 19,025 | 18,761 | 18,998 | 19,025 | 19,025 |
| Juniors | 615 | 592 | 226 | 590 | 592 | 615 | 615 | 613 | 614 | 615 | 615 |
| Unclassified tour | 3,718 | 3,263 | 21 | 3,251 | 2,740 | 782 | 3,718 | 58 | 1,015 | 3,718 | 3,718 |

Total observed rows: **33,357**.

This table includes non-singles rows. A holdout must filter on the provider's explicit draw/event-type field and must not infer singles from player names.

## Availability cutoff

Availability is not currently point-in-time safe.

`scoreHistoricalMatch` passes `match.cutoffAt` to the Prediction Engine, but the Availability invocation still passes `new Date()`. This makes rest-day and 21-day retirement/walkover calculations depend on replay execution time. Current web research is also unsuitable for historical replay unless it is suppressed or replaced by archived point-in-time evidence.

Required remediation before any holdout:

1. Thread the explicit prediction `asOfDate` into Availability.
2. Use `match.cutoffAt` for historical replay and wall-clock time only for live predictions.
3. Exclude current web research from replay.
4. Add invariance tests proving historical output does not change when the wall clock changes.
5. Keep histories strictly earlier than the exact match cutoff.

## Tournament-level normalization

The canonical taxonomy is:

`GrandSlam | Masters1000 | ATP500 | ATP250 | WTA1000 | WTA500 | WTA250 | Challenger | ITF | Other`.

Live Tennis API's tournament catalogue has an explicit nullable `category`, which maps deterministically when present. Category coverage in the observational population was:

- ATP: 1,379 / 1,905 (72.39%)
- WTA: 1,273 / 1,894 (67.21%)
- Challenger: 6,125 / 6,200 (98.79%)
- ITF: 18,760 / 19,025 (98.61%)

Mappings:

- `grand_slam` → `GrandSlam`
- `masters_1000` → `Masters1000`
- `atp_500` → `ATP500`
- `atp_250` → `ATP250`
- `wta_1000` → `WTA1000`
- `wta_500` → `WTA500`
- `wta_250` → `WTA250`
- `challenger` and `wta_125` → `Challenger`
- `itf` → `ITF`

`tour_finals`, `juniors`, team events, null category, null tour, and unmatched tournament IDs are ambiguous under the current taxonomy. They must remain null/excluded under a predeclared rule; name guessing is not acceptable.

## Player identity

Across the observational population there were 11,714 unique Live Tennis player IDs:

- exact ID-namespace matches: 0
- deterministic current-index name matches: 3,723 (31.78%)
- ambiguous name matches: 1 (0.01%)
- unmapped: 7,990 (68.21%)

Zero ID matches are expected because Live Tennis API uses a new provider namespace, but they prove that IDs cannot be passed directly into the existing historical identity system.

The current result is not deterministic enough for a holdout. Provider aliases must be constructed and audited read-only first. Doubles teams and non-singles rows must be excluded before the final identity denominator is frozen.

## Licensing questions requiring written confirmation

Written confirmation is required for:

1. persistent private storage of `/history/matches` responses and bulk packages;
2. PBP retention and retention after cancellation;
3. raw data in private database backups;
4. internal backtesting and temporal holdout construction;
5. point-in-time feature reconstruction and model validation;
6. indefinite retention of derived features and aggregate evaluation results;
7. commercial prediction use;
8. attribution requirements;
9. permitted raw-data display to end users;
10. deletion obligations after cancellation;
11. whether package downloads have different storage rights from REST responses;
12. long-term retention of provider match/player IDs as provenance keys.

Do not bulk-ingest until the provider answers in writing.

## Final gate

Serve/Return data-regime compatibility: **PASS**.

Availability point-in-time safety: **FAIL**.

Tournament-level determinism: **PARTIAL / FAIL FOR ATP-WTA RESIDUE**.

Player identity determinism: **FAIL**.

Post-June data existence and score-proxy availability: **PASS AS OBSERVATION, NOT YET A FROZEN HOLDOUT**.

Licensing: **UNCONFIRMED**.

Final result: **BLOCKED_PENDING_BOTH**.
