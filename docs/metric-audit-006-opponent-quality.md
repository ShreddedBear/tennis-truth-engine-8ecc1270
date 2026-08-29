# Metric 006 — Opponent Quality — Sequential Audit Record

Status: FIXED / PARTIAL / SOURCE REQUIRED

**First audit for this code.** `docs/evidence-coverage/81-metric-recoverability-audit.md`
previously labeled code 006 "Head-to-Head" — that name does not exist in
`public/seed/metrics.txt`; real code 006 is "Opponent Quality" (see
`docs/evidence-work-blockers.md` item 0). This is the first audit written
against the real definition.

## 1. Exact master definition
Authoritative source: `public/seed/metrics.txt`, section 6.

Required submetrics:
- Opponent-Adjusted Strength of Schedule
- Ranking-Adjusted Performance
- Performance Against Comparable-Ranked Players
- Performance Against Specific Archetypes
- Bad-Loss Rate

## 2. Permitted raw inputs
Each player's own pre-match chronological match history with, for every
opponent faced, that opponent's own derived Elo rating at the time of the
match (PredixSport public Elo ratings — official ATP/WTA ranking points
are not connected; the module computing this data explicitly documents
Elo is not being mislabeled as rank). Playing-style/archetype labels
(server type, baseline vs. net game, etc.) are not part of the permitted
input set because no such classification exists anywhere in the approved
evidence universe.

## 3. Sources inspected
- `src/lib/predixsport-recent.server.ts` (`getRecentReconstruction`) — computes `recent_opponent_avg_elo`, `best_recent_win_opponent_elo`, `bad_loss_rate_pct` from the player's own trailing 10 matches and each opponent's own most-recent-prior Elo.
- `src/lib/predixsport-derived.server.ts` (`getDerivedHistoricalStats`) — computes `comparable_strength_win_pct` (win rate against opponents within 100 Elo points).
- `src/lib/ranking-performance.server.ts` (`getRankingPerformanceStats`) — re-exposes `comparable_strength_win_pct` as `performance_vs_comparable_strength_pct`.
- `src/lib/hybrid-audit-research.server.ts` — `SUMMARY_KEYS["006"]` (correctly lists all five keys above) and `SUMMARY_KEYS["080"]` (found to also list all five of these keys, incorrectly — see §8).
- Repository search found no playing-style/archetype dataset anywhere (no server-type, baseline/net-game, or similar classification field in any ingested source).

## 4. P1/P2 orientation
`getRecentReconstruction(player, context)` and `getDerivedHistoricalStats(player, context)` each take a single player and compute that player's own trailing-match opponent-quality profile; `allStats(p, o, c)` in `hybrid-audit-research.server.ts` calls both once per side (`p1` as player, then `p2` as player), so each side's opponent-quality figures are independently computed from that side's own results, not mirrored or negated from the other.

## 5. Treatment classification
PARTIAL. Four of five named submetrics have genuine, correctly-oriented evidence (using derived Elo as the opponent-strength signal, since no official ranking feed is connected — the same substitution this project's `ranking-performance.server.ts` already documents and defends). Performance Against Specific Archetypes has none. `localMetricRows` hardcodes `treatment:"PARTIAL"` for every code on this path; the defect found and fixed this pass was the same class as code 004's: no `partialReason` existed for family `"006"`, so `unavailable_reason` silently went `null` whenever evidence existed. Added.

## 6. Reconstruction/formula verification
- `recent_opponent_avg_elo` / `best_recent_win_opponent_elo` — mean and max of the trailing-10-match opponents' own most-recent-prior Elo (as of each match date, no future leakage) — a genuine strength-of-schedule proxy, matching "Opponent-Adjusted Strength of Schedule."
- `bad_loss_rate_pct` — of the player's own trailing-10 losses, the share where the opponent's Elo was ≥100 points below the player's own current Elo — matches "Bad-Loss Rate: the frequency of losses to significantly lower-ranked or weaker opponents," substituting derived Elo for official ranking (documented substitution, not silent).
- `comparable_strength_win_pct` — win rate restricted to opponents within ±100 Elo of the player's own — matches "Performance Against Comparable-Ranked Players."
- `performance_vs_comparable_strength_pct` — currently a direct re-exposure of `comparable_strength_win_pct` under a different key name, not an independent actual-vs-expected computation. A more literal match for "Ranking-Adjusted Performance" already exists in the same file as `observed_vs_expected_wl_gap_pct` (`overall_recent20_win_pct − comparable_strength_win_pct`, a genuine actual-vs-expected gap) but that key is not in `SUMMARY_KEYS["006"]` — flagged here as a real, minor gap for a future pass, not fixed this pass (renaming/retargeting risks breaking any existing consumer of the `performance_vs_comparable_strength_pct` key; out of scope for an additive audit).

## 7. Provenance/sample/persistence
Every value carries `source_name: "PredixSport public tennis ratings (CC BY 4.0)"`, `url: https://www.kaggle.com/datasets/predixsport/sports-elo-ratings`, `retrieved_at`, and `sample` (count of qualifying trailing matches / opponents). Preserved through to the final `MetricFinding` by `localMetricRows`.

## 8. Cross-wiring audit
**Real bug found and fixed this pass.** `SUMMARY_KEYS["080"]` ("Common-Opponent & Opponent-Caliber Metrics") duplicated all five of code 006's own keys, plus two of code 007's own keys (`common_opponent_strength_weighted_win_pct`, `common_opponent_recency_weighted_win_pct`) — none of which satisfy 080's actual two named bullets (Common-Opponent Divergent Outcome; Opponent-Caliber Performance Gap). This meant 080's finding text, when generated through this path, reported unrelated recent-opponent-quality and common-opponent figures as if they were evidence for 080's own definition. Removed the entire `"080"` entry from `SUMMARY_KEYS` rather than guess at a replacement — 080's real "Divergent Outcome" bullet is already correctly, independently computed by `historical-results-recovery.ts`'s own `code==="080"` branch (Task 18A), unaffected by this fix. See `docs/metric-audit-080-common-opponent-caliber.md`.

## 9. Legitimate unavailable-data recovery
Recovered/confirmed:
- Opponent-Adjusted Strength of Schedule, Bad-Loss Rate, Performance Against Comparable-Ranked Players, and Ranking-Adjusted Performance all have genuine, correctly-oriented, provenance-carrying evidence.

Still SOURCE REQUIRED:
- Performance Against Specific Archetypes — needs a playing-style/archetype classification dataset (server type, baseline/net-game tendencies, etc.) not present anywhere in the approved evidence universe.

## 10. Regression protection
Added `src/lib/metric-006-opponent-quality-contract.test.ts` proving:
- `SUMMARY_KEYS["006"]` contains all five covered keys.
- `SUMMARY_KEYS["080"]` no longer contains any of code 006's or code 007's keys (locks the cross-wiring fix in place).
- The live `partialReason` for family `"006"` explicitly names Performance Against Specific Archetypes as the missing component.

Certification: FIXED / PARTIAL / SOURCE REQUIRED. Evidence-inflation bug found and fixed (080's cross-wiring); no new inflation introduced.
