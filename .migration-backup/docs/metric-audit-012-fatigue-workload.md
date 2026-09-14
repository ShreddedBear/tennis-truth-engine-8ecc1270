# Metric 012 — Fatigue/Workload — Sequential Audit Record

Status: PARTIAL / SOURCE REQUIRED (no code changes required — wiring verified honest)

## 1. Exact master definition
Authoritative source: `public/seed/metrics.txt`, section 12.

Required submetrics:
- Matches in 7 Days
- Actual Minutes on Court
- Sets/Games Played (Recent)
- Three-Setters (Recent Count)
- Late Finishes
- Rest Hours
- Qualifying Workload
- Recent Travel Distance/Time Zones

## 2. Permitted raw inputs
Permitted inputs are pre-match recent-window match dates/results, set counts, round labels (to detect qualifying rounds), tournament sequence/location, and — where genuinely present — match clock time or duration. Historical (non-recent) match statistics may not stand in for a "recent window" requirement; a player's typical workload from 2005-2017 is not evidence of their workload in the days before the match actually being audited.

## 3. Sources inspected
- `src/lib/predixsport-recent.server.ts` (ATP, `data/public/predixsport/atp/atp_elo_matches.csv`) — recent-window match counts, set totals, three-setter counts, qualifying-round counts, and `rest_days` (day-granularity gap to the player's last indexed match).
- `src/lib/wta-official-match-evidence.server.ts` (WTA official live API) — the same recent-window family (`matches_last_7_days` / `matches_last_14_days` / `matches_last_28_days` / `sets_last_14_days` / `three_setters_last_14_days` / `qualifying_matches_last_14_days`), plus `days_since_last_match` as WTA's equivalent of ATP's `rest_days`.
- `src/lib/travel-burden.server.ts` — tour-aware (loads both the ATP and WTA PredixSport files) tournament-sequence/location deltas: `observed_travel_km_last10`, `avg_observed_travel_km_per_move`, `long_haul_moves_3000km_plus_last10`, `observed_timezone_shift_hours_last10`, `max_observed_timezone_shift_hours_last10`.
- `data/public/datahub-atp/match_stats_1991-2016.csv` + `match_stats_2017.csv` — **checked and rejected as a recency source.** These rows do carry a genuine `match_duration` (minutes) and `match_time` (HH:MM:SS, the same duration restated as a clock span, not a start/end time-of-day) column across ~95,700 ATP main-tour rows. Nothing in `src/lib` currently reads `match_duration` or `match_time` from this file. The dataset's own coverage window is fixed at 1991-2017 (`datahub-atp-score-profile.server.ts`'s `HISTORICAL_MIN_YEAR = 2005` filter, same file family), so it cannot answer "how many minutes has this player spent on court in the last 7/14/28 days" for a match being audited in the present. Wiring it into the recent-workload family would mean silently reporting a 2005-2017 average as if it were current form — the exact substitution this audit series exists to prevent.
- No source anywhere in the repository or `data/` records an actual match start/end clock time (as opposed to duration), so "Late Finishes" (matches that concluded unusually late at night) cannot be constructed from any ingested evidence.

## 4. P1/P2 orientation
Both the ATP (`predixsport-recent.server.ts`) and WTA (`wta-official-match-evidence.server.ts`) paths are queried once per requested player with that player's own name/id, so all recent-window counts, `rest_days`/`days_since_last_match`, and travel deltas are already player-oriented — no winner/loser reversal is needed for this family (unlike score-margin metrics such as 011, which do require it).

## 5. Treatment classification
The family remains PARTIAL. Five of eight defined sub-items have a genuine recent-window source on both tours (Matches in 7 Days, the sets-count component of Sets/Games Played, Three-Setters, Qualifying Workload, Recent Travel Distance/Time Zones) or a day-granularity proxy for Rest Hours (`rest_days` / `days_since_last_match` — day precision, not hour precision, and reported as such). Three sub-items remain SOURCE REQUIRED for the recent window specifically:
- **Actual Minutes on Court** — duration data exists but only through 2017; no current-season source is ingested.
- **the "Games" half of Sets/Games Played (Recent)** — per-set game scorelines exist only in the same pre-2018 DataHub file (`datahub-atp-score-profile.server.ts`); the recent-window sources (`predixsport-recent.server.ts`, `wta-official-match-evidence.server.ts`) only carry set counts (`sets_for`/`sets_against`), not game-by-game scores.
- **Late Finishes** — no match clock-time field is ingested by any source; `match_time` in the DataHub file is a duration restatement, not a start/end time.

## 6. Reconstruction/formula verification
- `matches_last_7_days` / `_14_days` / `_28_days` = count of a player's indexed matches with a date inside the corresponding trailing window before the audited match's date, both tours.
- `sets_last_14_days` = sum of `sets_for + sets_against` (ATP) over matches in the trailing-14-day window — a genuine set-count, not a game-count.
- `three_setters_last_14_days` = count of trailing-14-day matches where `sets_for + sets_against === 3`.
- `qualifying_matches_last_14_days` = trailing-14-day matches whose round label matches `/qual|q[1-3]?/i`.
- `rest_days` (ATP) = whole days between the audited match's date and the player's most recent indexed match date. `days_since_last_match` (WTA) is the same day-difference calculation over the WTA player's own match history.
- Travel deltas in `travel-burden.server.ts` are computed from consecutive tournament location/date pairs in the player's own indexed history on the matching tour file — not cross-tour.

## 7. Provenance/sample/persistence
All four contributing modules attach `source_name`/`url`/`retrieved_at` and a sample count (`n`) to every emitted stat, consistent with the rest of the warehouse. The travel and recent-window stats are marked `origin: "RECONSTRUCTED"`, never `DIRECT`, since they are derived from raw match rows rather than a single authoritative field.

## 8. Cross-wiring audit
Confirmed NOT wired into metric 012's recent-workload family (and must stay that way):
- `match_duration` / `match_time` from `data/public/datahub-atp/match_stats_*.csv` (pre-2018 only; would misrepresent "recent" workload).
- Any per-set game count as a substitute for "matches played," or vice versa — `sets_last_14_days` is a set count and must not be relabeled as a game count.
- `rest_days` must not be scaled by 24 (or otherwise reframed) to fabricate an `Rest Hours`-precision value; it is a day-granularity figure and both `hybrid-audit-research.server.ts` and `wta-official-match-evidence.server.ts` keep it named accordingly (`rest_days` / `days_since_last_match`, never `rest_hours`).

`SUMMARY_KEYS["012"]` in `hybrid-audit-research.server.ts` was checked line-by-line against the keys actually emitted by `predixsport-recent.server.ts`, `wta-official-match-evidence.server.ts`, and `travel-burden.server.ts`; every listed key has a real producer on at least one tour, and no listed key is satisfied only by the pre-2018 DataHub duration file.

## 9. Legitimate unavailable-data recovery
Recovered/fixed: none — this pass was a verification audit; no defect was found in the current wiring.

Still SOURCE REQUIRED:
- Actual Minutes on Court (recent window)
- the games-count half of Sets/Games Played (recent window)
- Late Finishes

## 10. Regression protection
Added `src/lib/metric-012-fatigue-workload.test.ts` proving:
- `predixsport-recent.server.ts` and `wta-official-match-evidence.server.ts` never emit a `rest_hours`/`match_duration`/`match_time`/`late_finish` key.
- Every key listed in `SUMMARY_KEYS["012"]` is a set-count/match-count/day-count/travel key, never a minutes-of-play or game-count key.
- `datahub-atp-score-profile.server.ts` (the only module that reads the pre-2018 `match_stats`/score files) is never imported by `predixsport-recent.server.ts`, `wta-official-match-evidence.server.ts`, or `travel-burden.server.ts`, so the stale duration/game-level source cannot reach the recent-workload family through a future refactor without the test failing first.

Certification: PARTIAL / SOURCE REQUIRED. No evidence inflation. No code changes required this pass.
