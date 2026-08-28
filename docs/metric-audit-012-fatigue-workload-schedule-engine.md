# Metric 012 (Fatigue/Workload) — Second Wiring Path — Sequential Audit Record

Status: FIXED

Supplements `docs/metric-audit-012-fatigue-workload.md`, which audited the *static-CSV* wiring path (`predixsport-recent.server.ts`, `wta-official-match-evidence.server.ts`, `travel-burden.server.ts`). This entry covers the second, live-DB-backed wiring path found while investigating the metric-019 fix (see `docs/metric-audit-019-market-calibration.md`) and applying the same pattern check across all `deterministic-*-metrics.server.ts` engines.

## Defect found and fixed

`deterministic-results-schedule-metrics.server.ts` also produces findings for code 012 (it's in `SCHEDULE_SUPPORTED`), and it is live-wired: it's called directly from `warehouse-first-researcher.server.ts`, the actual `research` implementation used in production (`audit-repo.server.ts`'s `makeDeps()`).

Its `valueFor(code)` output for 012 is `matches_14d=N; matches_30d=N; matches_52w=N; days_since_last_match=N` -- bare match counts and a last-match date. This is exactly the "28-day/date-only proxy" `metric-certification.ts`'s registered 012 policy already exists to reject (`metric-certification.test.ts`'s "rejects a 28-day/date-only proxy as evidence for the exact family" case uses near-identical text and expects UNAVAILABLE). None of the policy's required exact-component markers (matches-in-7-days, minutes, sets/games, three-setters, late finish, rest-hours, qualifying, travel/timezone) appear in this text. Despite that, the function returned `p1_treatment: "PARTIAL"` -- counted as usable evidence -- because, like the 019 bug, `certifyMetricFinding` was never called from this file.

**Fix:** wrapped the return value in `certifyMetricFinding(...)`, same pattern as the 019 fix. `isCoreMarket`-equivalent logic (the hardcoded `"PARTIAL"` literal) is untouched; the downstream certification call is what corrects the outcome.

## A related false lead, deliberately not fixed

While closing this gap, the same defensive wrap was also tried on both functions in `deterministic-pbp-metrics.server.ts` (codes 024/025 are also in `CERTIFIED_METRIC_POLICIES`, and that file is live-wired too). This was reverted after running the existing test suite: `deterministic-pbp-metrics.test.ts`'s "recovers only already tour-guarded BSD PBP packets as conservative partial evidence" test proves that aggregate-only BSD PBP data (real point/game totals from an already tour-guarded, certified BSD adapter, just missing per-metric field-level derivation) is *deliberately* meant to keep PARTIAL treatment even though its summary text ("point_rows=N; total_points_observed=N; total_games_observed=N; aggregate_only=true") doesn't happen to contain 024/025's exact-marker wording either.

That's a materially different situation from the 012/019 bugs: those used a fully generic, context-free proxy with no real per-metric specificity at all, while the PBP aggregate case has genuine metric-adjacent provenance (a certified BSD adapter, real point/game counts) that the codebase's own test suite already reviewed and approved as PARTIAL-worthy. `certifyMetricFinding`'s keyword-based `exactInputMarkers` matching is not sophisticated enough to distinguish "generic proxy with zero real specificity" from "genuine partial evidence that just doesn't use the expected wording" -- so it is not safe to apply blindly everywhere a certified code appears. Each application needs the same evidence-based check used for 012/019: does an existing, deliberately-authored test already establish the current behavior as correct? If yes, leave it; if the current behavior has no such test backing it (as 012/019 did not), the certification gap is real.

This distinction is logged in `docs/evidence-work-blockers.md` for future passes through the remaining certified codes (022, 072-076) to avoid repeating the same false-positive attempt.

## Regression protection

Added `src/lib/deterministic-results-schedule-metrics-certification.test.ts` proving:
- `deterministic-results-schedule-metrics.server.ts` calls `certifyMetricFinding` on its return value.
- The exact bare-match-count text it produces for code 012 is downgraded to UNAVAILABLE.
- Code 028 (Scheduling Context, no registered policy) is left unaffected, proving the fix doesn't over-correct.

Certification: FIXED. No evidence inflation.
