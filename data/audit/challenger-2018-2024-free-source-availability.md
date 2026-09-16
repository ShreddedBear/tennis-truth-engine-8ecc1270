# ATP Challenger 2018–2024 free/already-available PBP source availability report

Research only. No implementation, no purchases, no integration. Produced after the BSD subscription was discontinued (see `data/audit/challenger-2018-2024-availability/summary.md` for the corrected 2018-2024 conclusion this report does not override).

## Sources already in this repository, re-checked for anything unused

| Source | Already used for | PBP for ATP Challenger 2018-2024? |
|---|---|---|
| `ppaulojr/tennis_pointbypoint` (GitHub) | ATP Challenger PBP, 2012-2015 (the 9,194 certified) | **No.** Fetched directly and counted row-by-row (see prior audit). Real coverage stops in 2015. |
| BSD/Bzzoiro API | ATP Challenger PBP, 2025-2026 (1,740 certified) | Unknown/unresolved -- subscription discontinued, will not be pursued further per your instruction. |
| TennisMyLife (`stats.tennismylife.org`) | ATP Challenger historical results/denominator, all years | **Could not check.** `stats.tennismylife.org` is blocked by this session's egress policy (403 from the proxy, org-level block) -- I could not query its file listing for anything beyond the results CSVs already cached locally in `data/public/tennismylife-challenger/raw/`. This is a genuine access limitation, not a confirmed absence -- flagging rather than guessing. |
| `datahub-atp` (serve-and-volley) | ATP Main historical results/stats, 1991-2017 | No PBP encoding at all (box-score stats only), and ATP Tour level only -- no Challenger data, no sibling Challenger repo exists at the same GitHub org (`serve-and-volley/atp-challenger-tour-tennis-data` returns 404). |
| PredixSport | ATP/WTA Main Elo ratings | No PBP, no Challenger-level data (`tournament_type` is limited to `atp_250/500/1000/grand_slam`). |

## New candidate found: The Match Charting Project (Jeff Sackmann / Tennis Abstract)

Free, public, reachable from this session (`raw.githubusercontent.com/JeffSackmann/tennis_MatchChartingProject`). Not referenced anywhere in this codebase before -- genuinely new to this repo's source inventory.

**What it is**: volunteer-charted shot-by-shot data -- richer than plain point-by-point (shot type, direction, depth, error type per shot), true chronological sequence. If usable, it would exceed the strict chronology bar already applied to the 9,194/1,740 certified records.

**Coverage found for ATP Challenger, 2018-2024**: I downloaded the project's full men's and women's match index (7,566 + 4,080 matches) and identified Challenger-level events by their tournament-name convention (`<City> CH`, e.g. "Sao Paulo CH", "Wuning CH"). Result:

| Year | Challenger matches charted |
|---:|---:|
| 2018 | 17 |
| 2019 | 85 |
| 2020 | 18 |
| 2021 | 29 |
| 2022 | 38 |
| 2023 | 8 |
| 2024 | 76 |
| **2018-2024 total** | **271** |

271 out of a ~31,603-match local denominator for this window -- **0.86% coverage**. All 271 are men's (0 women's Challenger matches charted in this project at all, any year). Real, but small.

**The blocker that matters more than the volume**: this dataset is licensed **CC BY-NC-SA 4.0 -- Non-Commercial, ShareAlike, attribution required**. The project maintainer's README is explicit and pointed about enforcement: *"I'm serious about the license, and I'm really disappointed with the handful of people who have chosen to violate it. If violations continue, I may stop updating the repo entirely."* If Tennis Matrix AI (Prediction Engine, Parlay Builder) is a commercial product, using this data as-is would violate the license -- this is a legal/business decision for you, not something I can route around or quietly ignore. I have not downloaded the actual point-level data files (only the match index, to establish coverage) and have not integrated anything.

## Other leads checked and ruled out

- `JeffSackmann/tennis_slam_pointbypoint` -- repository not found at either `master` or `main` (404 both). Would only cover the 4 Grand Slams anyway, irrelevant to Challenger.
- Scraping candidates (Flashscore, Sofascore, live ATP/WTA scoring widgets) -- deliberately not pursued. These aren't "already-configured" sources, bulk historical extraction isn't something their terms of service permit, and building new scraping infrastructure is a different (and riskier) category of work than what you asked me to survey here.

## Bottom line

**No free, already-available source closes the 2018-2024 ATP Challenger PBP gap at meaningful scale.** The one real candidate found (Match Charting Project) covers under 1% of the window's matches and carries a non-commercial license that needs your explicit decision before it could be used for anything connected to Tennis Matrix AI -- I'm surfacing it, not proposing to use it.

This doesn't change the corrected conclusion already on file: 2024 stays exhaustively confirmed empty, 2018-2023 stays UNRESOLVED (not "no PBP"), and the aggregate-stats tier (30,838 matches) stays explicitly not chronological PBP.
