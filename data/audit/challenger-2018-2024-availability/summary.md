# ATP Challenger 2018-2024 PBP Availability Audit

Updated: 2026-09-16T13:55:17.104712+00:00 (original run) -- conclusion corrected per explicit instruction after the BSD subscription was discontinued.

## Final status per year (READ THIS COLUMN, NOT JUST THE COUNTS)

| Year | Historical Matches | Aggregate-only | Unresolved(no-agg) | Final status |
|---:|---:|---:|---:|---|
| 2018 | 4,684 | 4,641 | 43 | **UNRESOLVED** |
| 2019 | 3,244 | 3,190 | 54 | **UNRESOLVED** |
| 2020 | 2,184 | 2,162 | 22 | **UNRESOLVED** |
| 2021 | 4,344 | 4,108 | 236 | **UNRESOLVED** |
| 2022 | 5,391 | 5,285 | 106 | **UNRESOLVED** |
| 2023 | 5,693 | 5,591 | 102 | **UNRESOLVED** |
| 2024 | 6,063 | 5,861 | 202 | **CONFIRMED_NO_ADDITIONAL_PBP_CANDIDATES** |

## What each final status means

- **CONFIRMED_NO_ADDITIONAL_PBP_CANDIDATES** (2024 only): both known sources were exhaustively checked. Tested, not assumed.
- **UNRESOLVED** (2018-2023): never exhaustively checked against BSD. Spot-probe evidence only. Two exhaustive-scan attempts were blocked by a missing repository secret, and the BSD subscription is now discontinued by explicit decision, so this will not be resolved via BSD. This is NOT the same as confirmed absent and must never be reported as 'no PBP'.

## Headline conclusion (corrected)

**conclusion_2024**: EXHAUSTIVELY CHECKED, CONFIRMED NO ADDITIONAL PBP CANDIDATES. The BSD full-year scan for 2024 ran to completion and listed 0 ATP Challenger matches. This is a tested, confirmed result, not an assumption.

**conclusion_ppaulojr_source**: DOES NOT COVER THE 2018-2024 GAP. Fetched directly and counted row-by-row in this session; its real coverage is 2010-2015. It contributes 0 rows for any year 2018-2024, confirmed by reading the source, not by inference from the pipeline's routing cutoff.

**conclusion_2018_2023**: UNRESOLVED, NOT CONFIRMED ABSENT. Only ever spot-probed against BSD (3 sample matches per year, 0/3 listed every year) -- never exhaustively scanned. Two attempts to run the exhaustive BSD scan via GitHub Actions (workflow runs 35107736811 and 35107973000, both on 2026-09-16) both confirmed BSD_TENNIS_API_KEY is not configured on this repository, so the exhaustive check could not execute either time. As of this update, the BSD/Bzzoiro subscription is no longer being purchased (explicit decision), so this exhaustive check will not be attempted again. 2018-2023 stays classified UNRESOLVED indefinitely under the current sourcing plan -- it must never be read as, converted to, or reported as 'no PBP' or 'confirmed absent'.

**conclusion_aggregate_tier**: NOT CHRONOLOGICAL PBP. The 30,838-match aggregate-stats figure below (box-score-level: aces, double faults, serve/break points) must not be mislabeled as, blended into, or reported as chronological PBP coverage in any downstream summary. It is a separate, weaker evidence tier.

**conclusion_overall**: No additional true chronological ATP Challenger PBP has been recovered from currently available/free sources for 2018-2024. The certified population remains exactly what it was before this audit: 10,934 (9,194 from the 2012-2015 v3 re-audit + 1,740 from BSD 2025-2026). Closing the 2018-2023 UNRESOLVED gap requires either a BSD credential (not being pursued) or a different free/already-available source not yet identified.

**bsd_path_status**: STOPPED by explicit user decision (BSD subscription discontinued). The re-audit workflow (.github/workflows/bsd-atp-challenger-pbp-history-2018-2023-reaudit.yml) has been converted to an inert stopped stub on main (commit be4c249) and will not be re-triggered. No further BSD credential requests will be made.

**Aggregate-tier recoverable (NOT chronological PBP): 30,838 matches**

## GitHub Actions attempts (evidence)

- https://github.com/ShreddedBear/tennis-truth-engine-8ecc1270/actions/runs/35107736811: BSD_TENNIS_API_KEY secret is not configured on this repository. No query made.
- https://github.com/ShreddedBear/tennis-truth-engine-8ecc1270/actions/runs/35107973000: BSD_TENNIS_API_KEY secret is not configured on this repository. No query made. (repeat confirmation)
