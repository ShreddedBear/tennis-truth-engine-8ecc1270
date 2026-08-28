# Metric 013 — Availability — Sequential Audit Record

Status: FIXED / PARTIAL / SOURCE REQUIRED

## 1. Exact master definition
Authoritative source: `public/seed/metrics.txt`, section 13.

Required submetrics:
- Injuries
- Recent Withdrawals
- Retirements
- Medical Timeouts
- Layoffs
- Return-From-Injury Form

## 2. Permitted raw inputs
Permitted inputs are actual, reported injury/withdrawal/retirement/medical-timeout events. A gap in a player's own indexed match history is, at most, weak circumstantial evidence of a layoff — and only when it cannot be explained by the routine, universal off-season break every tour player takes between seasons. It may never be presented as "Availability" evidence without excluding that routine break first.

## 3. Sources inspected
- `src/lib/availability-layoff.server.ts` (ATP + WTA fallback via PredixSport match rows) — the only source computing `longest_observed_layoff_days`, `observed_layoffs_30d_plus`/`60d_plus`/`90d_plus`, and `return_after_layoff_win_pct`.
- `src/lib/wta-official-match-evidence.server.ts` (WTA official live API, case `"013"`) — computes the identical stat family from WTA's own match rows.
- No structured injury/illness/medical-report, withdrawal-announcement, or retirement-reason dataset is ingested anywhere in the repository or production database. Every "013" stat is necessarily an inference from match-date gaps, never a direct report.

## 4. Defect found and fixed
Both sources computed every consecutive-match date gap in a player's history and counted any gap of 30/60/90+ days as an "observed layoff," with no exception for the calendar-year boundary. Since essentially every professional tennis player takes a multi-week-to-multi-month off-season break between seasons (the same routine gap already identified and excluded for metric 077's Off-Season Rest Length in `tennis-data-extended.server.ts`'s `computeOffseasonRestLengthDays`), this meant:
- `observed_layoffs_60d_plus` and `observed_layoffs_90d_plus` were >= 1 for nearly every active player, every season, regardless of whether they had ever actually been injured.
- `longest_observed_layoff_days` was almost always just "how long was this player's off-season," not evidence of any actual availability concern.
- `return_after_layoff_win_pct` mixed genuine mid-season-return matches with ordinary start-of-new-season matches, which have entirely different baseline form implications.

This directly misrepresented routine off-season rest as "Availability" (injury/withdrawal/retirement) evidence — the same class of conflation already fixed once for a different metric (077) and explicitly called out in that fix's commit message as a distinct concern from mid-season layoffs.

Fixed in both `availability-layoff.server.ts` and `wta-official-match-evidence.server.ts`: any consecutive-match gap whose earlier and later match dates fall in different calendar years is now excluded from the layoff/gap tallies (`crossesCalendarYearBoundary`). Only a gap that stays within a single calendar year — i.e. cannot be explained by the routine between-seasons break — is counted as an observed mid-season layoff.

This is the same heuristic style already used for metric 077 (a calendar-year-boundary test, not a fixed date range), kept consistent across the codebase. It is not a perfect oracle — a genuine injury that happens to straddle a Dec/Jan boundary would be under-counted — but it cannot be resolved without the injury-report data this project does not have, and under-counting a real layoff is a far smaller integrity risk than the previous behavior of flagging (via `whether_future_ingestion_could_change_status`-style honesty) nearly every player as having a "layoff" every year.

`recent_inter_match_gap_days` (family 012, Fatigue/Workload, not 013) is deliberately left unfiltered in both files: reporting the player's actual most recent inter-match gap — off-season or not — is honest recent-context information for that metric, not an Availability claim.

## 5. Treatment classification
The family remains PARTIAL. The corrected gap-based signal is a legitimate (if indirect) contribution to Layoffs and Return-From-Injury Form. Injuries, Recent Withdrawals, Retirements, and Medical Timeouts remain SOURCE REQUIRED — no ingested source reports any of these as actual events.

## 6. Reconstruction/formula verification
- `longest_observed_layoff_days` = the longest gap between two consecutive matches in the player's own indexed history that does not cross a calendar-year boundary.
- `observed_layoffs_30d_plus` / `60d_plus` / `90d_plus` = counts of such in-season-only gaps at or above the given threshold.
- `return_after_layoff_win_pct` = win rate over the up-to-3 matches immediately following an in-season gap of 45+ days.

## 7. Provenance/sample/persistence
Both sources already attached `source_name`/`url`/`retrieved_at` and a sample count; the fix changes the sample denominator for the corrected keys from "every gap" to "every in-season gap" so the reported sample size matches the population actually being measured.

## 8. Cross-wiring audit
Confirmed `SUMMARY_KEYS["013"]` in `hybrid-audit-research.server.ts` lists only `longest_observed_layoff_days`, `observed_layoffs_30d_plus`, `observed_layoffs_60d_plus`, `observed_layoffs_90d_plus`, `return_after_layoff_win_pct` — no key claims to be a direct injury/withdrawal/retirement/medical-timeout report.

## 9. Legitimate unavailable-data recovery
Recovered/fixed:
- Layoffs and Return-From-Injury Form no longer conflate routine off-season rest with an availability concern, on both ATP and WTA paths.

Still SOURCE REQUIRED:
- Injuries, Recent Withdrawals, Retirements, Medical Timeouts (no reported-event dataset exists in the approved evidence universe).

## 10. Regression protection
Added `src/lib/metric-013-availability.test.ts` proving, via the newly exported `computeAvailabilityStatsFromRows`:
- an off-season-only gap (crossing a calendar year) is excluded from `observed_layoffs_60d_plus`/`90d_plus` and from `longest_observed_layoff_days`.
- a genuine mid-season gap (same calendar year) is still counted, and `return_after_layoff_win_pct` is scoped to the matches right after it.
- a history containing only off-season gaps across multiple years produces zero observed layoffs at any threshold.

Certification: FIXED / PARTIAL / SOURCE REQUIRED. No evidence inflation.
