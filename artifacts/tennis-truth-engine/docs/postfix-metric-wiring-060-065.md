# Post-Fix Metric Wiring Verification — 060, 062, 063, 064, 065

Authoritative source: `public/seed/metrics.txt`.

This verification is intentionally limited to five metrics. It does not assign generic available data to these metrics merely to raise evidence coverage.

## Shared production-path findings

- Primary metric findings for these five come from the grounded semantic research path. `SUMMARY_KEYS` and `HISTORICAL_KEYS` contain no mappings for 060/062/063/064/065, so generic local historical/stat summaries do not fill these metrics.
- The completion sweep may retry an unresolved target metric, but the same strict metric definition and five-metric instructions are applied to the retry.
- Every usable target-side value must self-identify `PLAYER`, `SOURCE`, and `SAMPLE`. `SOURCE` must resolve to persisted provenance. For 062–065 it must also be a supportable public HTTP(S) source.
- RECONSTRUCTED target evidence requires an explicit formula. 063 and 065 are factual reporting categories and are not accepted as reconstructed facts.
- Persisted target provenance is filtered to sources actually referenced by the surviving P1/P2 values. P1 and P2 samples persist separately.
- All non-target metrics continue through the previously certified `validatedCompletionResearcher` path; the five-metric fix does not globally weaken or remap other families.

## 060 — Interaction / Matchup Residuals

Allowed incoming evidence is restricted to the exact master components from Serve–Return Interaction Residual through Late-Line Acceleration. Underlying observations may include opponent-conditioned serve/return histories, charted shot/rally observations, score-state and pressure histories, handedness/serve-direction splits, rematch history, workload/rest/travel observations, environmental/venue observations, and market histories only when they are used to calculate the exact named 060 interaction/residual component.

Generic hold %, break %, Elo, surface, weather, travel, fatigue, style, or odds are not 060 values by themselves. A reconstruction must state the calculation and use only the exact component's permitted inputs. Because 060 is a broad family, a strict subset remains PARTIAL.

Remaining unsupported inputs depend on available public/charted data and commonly include detailed neutral-rally/shot tolerance observations, serve-direction/return-position splits, exact pressure/tiebreak sequences, ball-change effects, court-speed response history, environmental interaction histories, and book-level market histories.

## 062 — Motivation / Stakes

Allowed fields are Points-Defending Pressure, Seeding/Bye Implications, and Prize-Money/Status Milestones. Exact underlying reconstruction inputs may include the prior-year event result/points and applicable points schedule, official seeding/bye rules and cutoff timing, and sourced ranking/milestone thresholds.

Generic ranking, Elo, recent form, serve/return, fatigue, weather, travel, odds, or market data do not satisfy 062. Subjective motivation is not inferred. Any reconstructed calculation must be explicit and limited to factual stakes inputs.

Remaining unsupported inputs are any of the three exact components for which no sufficiently specific public source exists.

## 063 — Team / Support Context

Allowed fields are Coaching Changes, Coaching-Box Presence, and recent Equipment Changes. They require dated/sourceable public reporting. Static coach identity, generic racket specifications, ordinary string tension, shoe model, form swings, or sponsorship assumptions are not substitutes.

This metric is not reconstructed from results or correlations. Exact supported components may be PARTIAL; full DIRECT requires the full defined family to be supported.

Remaining unsupported inputs are any coaching-change, event-specific coaching-box, or recent equipment-change fact without direct public support.

## 064 — Draw Context

Allowed fields are Qualifying/Lucky-Loser Fatigue and Draw Path Difficulty Beyond This Match. Exact inputs may include official entry route, qualifying/lucky-loser status, extra qualifying matches, and official potential later-round opponents.

Generic workload, rest, travel, timezone, current round, ranking, Elo, odds, market, weather, serve, or return data do not satisfy 064. Reconstructed extra qualifying load must be based on the documented route/matches; draw path is an official structural fact, not a generic tournament-context proxy.

Remaining unsupported inputs are official entry/draw details that cannot be sourced and any speculative effort-allocation effect.

## 065 — Physical/Medical (Limited Availability)

Allowed fields are Off-Season/Pre-Season Training Reports and Illness Reports. They require credible public reporting. Generic injury history, withdrawal, retirement, medical timeout, layoff, or days-since-last-match belongs to other families and cannot satisfy 065.

This metric is not reconstructed from performance decline, absence, social activity, retirement, or injury history. Exact published components may be PARTIAL; unavailable reporting stays UNAVAILABLE.

Remaining unsupported inputs are unpublished/non-public training, body-composition, fitness-camp, or minor-illness information.

## Regression protection

The dedicated regression suite pins the master definitions; rejects representative cross-family proxies for all five; checks P1/P2 identity rather than row order; requires side-specific provenance/sample; filters unrelated persisted sources; enforces formula rules; prevents 063/065 reconstruction; verifies broad 060 subsets remain PARTIAL; verifies exact 065 illness reporting is not destroyed by a generic Availability guard; confirms no local historical/summary fallback map feeds these five; and confirms previously certified metric 041 retains its prior behavior.
