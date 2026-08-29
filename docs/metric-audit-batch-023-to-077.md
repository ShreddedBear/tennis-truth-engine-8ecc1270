# Metrics 023–077 (batch) — Sequential Audit Record

Status: mixed — see per-code table. One real cross-wiring bug found and
fixed (043/044). No Supabase access was required for any of this pass
(all findings are from static code/schema reading); live row counts for
any of these codes still require the standing Supabase-verification
workflow in `docs/evidence-work-blockers.md` item 1.

This batch covers the remaining 25 codes from the "genuinely missing"
list after the earlier individually-audited codes (001–022, 027–051 case
by case) and the reconciliation audit. Given the volume, codes sharing
one mechanism are grouped rather than each getting a full 10-section
writeup — the mechanism itself is documented once, per-code specifics
follow in the table.

## Mechanism A — `deterministic-results-schedule-metrics.server.ts` (`SCHEDULE_SUPPORTED`)

Live, production, per-request engine. Queries `source_observations` +
`matches` for real match-count/date/tournament data with a 5-year window
and future-leakage guard, wrapped in `certifyMetricFinding`. Genuinely
computes real figures, but only a narrow slice of each code's full named
definition — the rest of each code's bullets need data this engine
doesn't carry (travel time, court/session context, draw structure, etc.).

## Mechanism B — Generic PBP warehouse fallback (`deterministic-pbp-metrics.server.ts`'s `LEGACY_SUPPORTED`)

A deliberately loose, already-tested design (see
`docs/evidence-work-blockers.md` item 2): if *any* persisted `POINT_BY_POINT`
observation exists for the pair, it's reported as PARTIAL with the
caveat `"metric-specific raw-field provenance not guaranteed"` — real
data, but not proven to satisfy the code's exact named formula. Two
existing tests deliberately keep this behavior; not re-litigated here.

## Mechanism C — Live AI web-search research, gated by an exact-component firewall

`validated-completion-research.server.ts` (`COMPOSITE_COMPONENTS`) and
`protected-metric-wiring.server.ts` (`PROTECTED_COMPONENTS`) both wrap the
live LLM web-search researcher (not a deterministic repository-data
engine) and force any claimed finding down to PARTIAL/UNAVAILABLE unless
the returned text literally names each required sub-component — a real,
already-built, well-targeted firewall against generic-proxy substitution.
**What this audit can and cannot verify:** the firewall's own component
lists were checked against the real `public/seed/metrics.txt` bullets for
every code below and are accurately targeted. What cannot be verified
from this sandbox is what the live LLM actually returns at request time —
that's inherently non-deterministic and requires a live call, not a
static read. These codes are recorded as "AI-dependent, no deterministic
engine" rather than given a confident PARTIAL/UNAVAILABLE call.

## Real bug found and fixed this pass: codes 043/044 were cross-wired to the wrong evidence family

`deterministic-market-metrics.server.ts`'s `MARKET_CODES` included `"043"`
and `"044"`, computing raw current-match odds/de-vig aggregates for them.
Real 043 is "Favorite Failure-Mode Score" (historical failure conditions
for the favorite; opponent's compatibility with creating them) and real
044 is "Opponent Upset Compatibility" (Elo/style/surface/ranking/
handedness/rally-style/price/tournament-level similarity to today's
favorite among past upsetters) — neither is "today's betting odds." This
was built against an old, wrong catalog reading (the same fictional
catalog already found and corrected elsewhere in this series). Worse,
`warehouse-first-researcher.server.ts` calls `deterministicMarketMetric`
*before* the correct pathway (`protected-metric-wiring.server.ts`'s
`PROTECTED_COMPONENTS["043"]`/`["044"]`, already correctly built against
the real definitions) — so the wrong evidence was winning outright
whenever odds data existed for the match, live, in production.

**Fixed:** removed `"043"`/`"044"` from `MARKET_CODES` in
`deterministic-market-metrics.server.ts`. Both codes now correctly fall
through to their real, already-built, AI-research-gated pathway. Updated
`deterministic-market-metrics.test.ts`'s literal-source-text assertion to
match (only test referencing the old set). Blast radius checked: no
other test references `MARKET_CODES`' contents; full suite passes after
the change.

## Per-code table

| Code | Real name | Mechanism | Bullets covered / total | Treatment | Notes |
|---|---|---|---|---|---|
| 023 | Matchup-Adjusted Metrics | `style-matchup.server.ts` + `matchup-efficiency.server.ts` | 2 / 10 | PARTIAL | `style_serve_vs_return_edge`/`style_return_vs_serve_edge` (transparent numeric proxies, explicitly documented as "NOT subjective labels") cover Serve-vs-Return and Return-vs-Serve Compatibility Score. The other 8 (Second-Serve Mismatch, Rally/Movement Exploitation, Serve-Placement Matchup, Return-Position Compatibility, Style-Adjusted Elo, etc.) need shot-level or style-cluster data not present anywhere. No `partialReason` entry exists for family "023" in `hybrid-audit-research.server.ts` (same transparency gap already fixed for 004/006/014 -- not fixed this pass, flagged only, to manage scope). |
| 024 | Hidden Performance Quality | Mechanism B | not bullet-verifiable | PARTIAL | Generic warehouse PBP credit only; no engine computes any of the 12 named bullets (Score-Adjusted Point Dominance, Competitive-Point Win%, Expected vs Actual Hold/Break/Tiebreak/Deciding-Set, etc.) specifically. |
| 025 | Match Deterioration Metrics | Mechanism B | not bullet-verifiable | PARTIAL | Same as 024; none of the 12 set-by-set decay bullets (serve-speed decay, hold/break-rate Set1→2→3, etc.) are computed by name. |
| 026 | Early-Warning / Slow-Start Metrics | Mechanism C | 12 components registered | AI-dependent, no deterministic engine | `COMPOSITE_COMPONENTS["026"]` correctly lists all 12 real bullets (Opening Service-Game Hold %, Opening Return-Game Break %, First Four/Six Games differentials, Time-to-First-Break, Set-1 Slow-Start Index, etc.). |
| 028 | Scheduling/Context | Mechanism A | 2-3 / 14 | PARTIAL | Days Since Last Competitive Match and Matches Over Previous 30 Days are genuinely computed (`matches_30d`, `days_since_last_match`). The other ~12 (Optimal-Rest Deviation, Travel-to-Rest Ratio, Night/Day transitions, Recovery Hours, Court Assignment Effects, etc.) need data not carried here. |
| 030 | Tournament-Specific Strength | Mechanism A | genuine subset | PARTIAL | `same_tournament_matches_5y`/`same_tournament_wins_5y` -- a real, direct, exact-tournament historical record. |
| 033 | Break Quality Differential | Mechanisms B + C | 1 bullet total | PARTIAL-at-best | Single named bullet (Sustainable Break Score: sustained pressure vs. opponent donations); `COMPOSITE_COMPONENTS["033"]` correctly targets it for the AI path, generic PBP warehouse credit is the deterministic fallback. |
| 034 | Scoreline Deception Index | Mechanism C | 5 components registered | AI-dependent, no deterministic engine | `COMPOSITE_COMPONENTS["034"]` correctly lists all 5 real bullets. |
| 035 | False-Form Detector | `hybrid-audit-research.server.ts` (`SUMMARY_KEYS["035"]`) | 1 / 1 | PARTIAL (near-complete) | Single named bullet is "Observed vs Expected W/L" -- `observed_vs_expected_wl_gap_pct` in `ranking-performance.server.ts` (`overall_recent20_win_pct - comparable_strength_win_pct`) is an exact, direct match, not a proxy. This is the strongest single-bullet match found in this batch; left at PARTIAL (the file's blanket default) rather than pushed to RECONSTRUCTED this pass, to keep this batch's scope to documentation plus the one confirmed bug fix. |
| 038 | Opponent-Adjusted Residual Performance | Mechanism C | 8 components registered | AI-dependent, no deterministic engine | `COMPOSITE_COMPONENTS["038"]` correctly lists all 8 real bullets (hold/break/points/games/sets/dominance-ratio/serve-points/return-points residual vs. opponent norm). |
| 040 | Hidden Decline Detector | Mechanism C | 10 components registered | AI-dependent, no deterministic engine | `COMPOSITE_COMPONENTS["040"]` correctly lists all 10 real trend bullets. |
| 042 | Opponent Win Pathways | `opponent-win-pathways-meta.server.ts` | ~9-10 / 10 | PARTIAL, well-covered | A dedicated pathway classifier explicitly scoped to this code's real 9 "Opponent Win Pathway – X" bullets (serve dominance, return pressure, tiebreaks, long/short rallies, favorite collapse, deciding set, second-serve exploitation, physical/fatigue), with an explicit code comment guarding against importing unrelated pathways from a sibling "Dangerous Underdog" feature. Best-covered code in this batch. |
| 043 | Favorite Failure-Mode Score | Mechanism C (fixed this pass, see above) | 4 components registered | AI-dependent, no deterministic engine | `PROTECTED_COMPONENTS["043"]` correctly targets both real bullets. Previously preempted by the wrong market-odds engine; fixed. |
| 044 | Opponent Upset Compatibility | Mechanism C (fixed this pass, see above) | 12 components registered | AI-dependent, no deterministic engine | `PROTECTED_COMPONENTS["044"]` correctly targets all 9 named similarity dimensions plus role/outcome components. Previously preempted by the wrong market-odds engine; fixed. |
| 045 | Favorite Fragility Under Resistance | Mechanism C | 7 components registered | AI-dependent, no deterministic engine | `PROTECTED_COMPONENTS["045"]` correctly lists all 6 real bullets. |
| 052 | Entropy & Lead Durability | Mechanism C | 8 components registered | AI-dependent, no deterministic engine | `COMPOSITE_COMPONENTS["052"]` correctly lists all 8 real bullets. |
| 053 | Pressure & Clean-Game Metrics | `pbp-score-state-recovery.ts` + Mechanism C | 1 / 6 (deterministic) + AI fallback | PARTIAL | Already documented in `pbp-score-state-recovery.ts`: covers only "pressure accumulation score" deterministically from real PBP replay; `PROTECTED_COMPONENTS`/`COMPOSITE_COMPONENTS["053"]` firewall the other 5 (serve-escape dependency, clean-hold/break rate, love/15 hold rate, return-game abandonment) behind the AI path. |
| 055 | Trajectory / Rolling Metrics | `hybrid-audit-research.server.ts` (`SUMMARY_KEYS["055"]`) | 3+ / 13 | PARTIAL | `elo_change_last5`/`elo_change_last10` are direct matches for "Rolling 5/10-Match Elo Change"; `recent_performance_acceleration` matches "Performance Acceleration." No `partialReason` entry exists for family "055" (same transparency gap as 023, not fixed this pass). |
| 060 | Interaction / Matchup Residuals | `deterministic-environment-metrics.server.ts` (wrong family) + Mechanism C (right family) | 0 / 11 (deterministic) | PARTIAL (thin, same pattern as item 4) | Already flagged in `docs/evidence-work-blockers.md` item 4: shares the ENVIRONMENT-only engine with 021/030/071, and real 060 has zero weather-related bullets. `PROTECTED_COMPONENTS["060"]` correctly lists all 11 real bullets (serve-return interaction residual, opponent-adjusted shot tolerance, etc.) for the AI path -- that firewall is real and correct, it's the deterministic ENVIRONMENT credit that's mismatched. Not fixed this pass (same shared four-code-engine caution as item 4). |
| 062 | Motivation / Stakes | Mechanism C | forbidden-proxy list confirmed | AI-dependent, no deterministic engine | `protected-metric-wiring.server.ts` explicitly forbids generic serve/return/weather/travel/fatigue/odds/market/Elo/recent-form substitution for 062 -- correctly guards against exactly the proxy-substitution risk this project's HOUSE_RULES exist to prevent. |
| 064 | Draw Context | Mechanism A | 1 / 2 | PARTIAL | `qualifying_matches_14d` reasonably covers "Qualifying/Lucky-Loser Fatigue." "Draw Path Difficulty Beyond This Match" needs draw-bracket data not present anywhere. |
| 070 | Support Team / Prep | Mechanism C, `NON_RECONSTRUCTABLE_CONTEXT_CODES` | 3 components registered | AI-dependent, DIRECT-only (no reconstruction permitted) | `protected-metric-wiring.server.ts` explicitly forbids RECONSTRUCTED treatment for 070 -- only genuine direct public reporting (sports-psychologist presence, short-notice draw entry, walkover-into-round) is accepted, never inferred. Effectively as-good-as SOURCE REQUIRED absent live confirmed reporting. |
| 071 | Session / Environment | `deterministic-environment-metrics.server.ts` (wrong family) + Mechanism A (wrong fields) | 0 / 2 (deterministic) | PARTIAL (thin, mismatched -- same pattern as item 4) | Real bullets are Roof-Open-vs-Closed Split and Fixed-Start-Time-vs-"Not-Before"-Uncertainty. Neither the ENVIRONMENT engine (ambient weather) nor the schedule engine (`days_since_last_match`, generic schedule rows) touches roof state or start-time uncertainty at all. Strongest concrete instance of the item-4 pattern found in this whole batch; not fixed this pass for the same shared-engine reason. |
| 075 | Match Format / Rules Context | `deterministic-rules-context-metric.server.ts` | ~1 / 3 (thin) | PARTIAL | Reports `best_of` parsed from context text -- a real input toward "Best-of-3 vs Best-of-5 Adjustment," though it reports the raw format rather than computing the adjustment itself. Deciding-Set Tiebreak Format (10-point/7-point/advantage) and Challenge/Review Count Remaining are not tracked. |
| 077 | Season-Long Fatigue Context | `tennis-data-extended.server.ts` (`computeOffseasonRestLengthDays`) | 1 / 4 | PARTIAL | A real, deliberately-corrected engine (see commit `af5b21c`, "Build the honest Off-Season Rest Length (077)... engine[]" -- replaced a previously mislabeled figure that conflated mid-season injury layoffs with genuine off-season rest). Olympic/Team-Event Year Load, Preseason Exhibition Results, and Grand Slam Hangover Effect remain SOURCE REQUIRED. |

## Denominator effect

None of the 25 codes in this batch needed a `metric-classification.ts`
change (all are `LEGITIMATE_PLAYER_METRIC`, correctly in the denominator,
with genuine partial evidence or a correctly-built AI-research pathway --
none turned out to be structurally impossible the way 022 did). The only
code-level fix was the 043/044 market cross-wiring correction, which
redirects evidence to the correct pathway rather than changing whether
either code counts.

## Regression protection

`deterministic-market-metrics.test.ts` updated in place for the 043/044
fix (existing file). No new dedicated contract test files added for the
other 24 codes in this batch -- most either (a) already have real,
already-tested engines whose behavior did not change, or (b) depend on
live AI research that cannot be meaningfully unit-tested without a live
call. Flagged here rather than given a synthetic test that would not
actually catch a regression.

Certification: FIXED (043/044 cross-wiring) / mixed PARTIAL and
AI-dependent classifications for the rest, as tabulated above. No
evidence inflation introduced.
