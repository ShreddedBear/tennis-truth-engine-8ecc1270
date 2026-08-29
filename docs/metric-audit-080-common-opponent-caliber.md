# Metric 080 — Common-Opponent & Opponent-Caliber Metrics — Sequential Audit Record

Status: FIXED / PARTIAL / SOURCE REQUIRED

**First audit for this code.** `docs/evidence-coverage/81-metric-recoverability-audit.md`
previously labeled code 080 "Stability / Variance" — that name does not
exist in `public/seed/metrics.txt`; real code 080 is "Common-Opponent &
Opponent-Caliber Metrics." This is the first audit written against the
real definition, and it closes out a real cross-wiring bug found while
auditing code 006 (see `docs/metric-audit-006-opponent-quality.md` §8).

## 1. Exact master definition
Authoritative source: `public/seed/metrics.txt`, section 80.

Required submetrics:
- Common-Opponent Divergent Outcome
- Opponent-Caliber Performance Gap

## 2. Permitted raw inputs
Canonical shared-opponent identity across both players' pre-match
chronological results (same identity-resolution method as code 007), each
side's own win/loss outcome against each shared opponent. Opponent-Caliber
Performance Gap additionally needs each player's own historical
rank/Elo *at match time* to compute a ceiling (best win, or closest
near-upset loss, relative to own level) vs. floor (worst loss relative to
own level) spread — not currently carried by the row type this engine
reads.

## 3. Sources inspected
- `src/lib/historical-results-recovery.ts` — `code==="080"` branch (Task 18A), already live and correctly targeted at real code 080.
- `src/lib/hybrid-audit-research.server.ts` — `SUMMARY_KEYS["080"]` (found, this pass, to wrongly duplicate code 006's and code 007's own keys; fixed — see §8).
- `src/lib/common-opponent-enhanced.server.ts` (feeds code 007, not 080 — confirmed no overlap in what it actually computes vs. what 080's own definition needs).
- Repository search found no per-player historical rank/Elo-at-match-time series carried alongside the shared-opponent row type `historical-results-recovery.ts` uses, so the ceiling-vs-floor Opponent-Caliber Performance Gap cannot be computed from that engine as it stands.

## 4. P1/P2 orientation
`historical-results-recovery.ts`'s `code==="080"` branch is called once per side with `args.player`/`args.opponent` set to that side's identity; `favorable`/`unfavorable` divergence counts are computed from that side's own win/loss record against each shared opponent, correctly oriented per side (not a mirrored shortcut — the reverse call independently recomputes from the other side's own rows).

## 5. Treatment classification
PARTIAL. One of two named submetrics (Common-Opponent Divergent Outcome) has genuine, correctly-oriented, already-tested evidence via Task 18A's engine — a real, live, connected pathway that had no narrative audit doc until this pass. Opponent-Caliber Performance Gap is SOURCE REQUIRED. This was already the honest treatment output by the engine itself (`"PARTIAL"` literal in the `reconstruction()` call) before this pass; nothing about the treatment value changed here.

## 6. Reconstruction/formula verification
- `favorable_divergent_outcomes` = count of shared opponents where the requested player has ever beaten them while the match opponent has ever lost to them; `unfavorable_divergent_outcomes` is the reverse. Matches "Common-Opponent Divergent Outcome: cases where Player A beat a specific opponent but Player B lost to that same opponent, used as a direct proxy comparison between the two" exactly, with no proxy substitution.
- Opponent-Caliber Performance Gap is not computed anywhere; no formula to verify.

## 7. Provenance/sample/persistence
`reconstruction()` (used by every code in `historical-results-recovery.ts`) attaches `sampleSize` (shared-opponent count) and the same source metadata as the rest of Task 18A's engine; unaffected by this pass.

## 8. Cross-wiring audit — the actual defect found and fixed this pass
`SUMMARY_KEYS["080"]` in `hybrid-audit-research.server.ts` (a *separate* pathway from the correct Task 18A engine above) listed all five of code 006's own keys (`recent_opponent_avg_elo`, `best_recent_win_opponent_elo`, `bad_loss_rate_pct`, `comparable_strength_win_pct`, `performance_vs_comparable_strength_pct`) plus two of code 007's own keys (`common_opponent_strength_weighted_win_pct`, `common_opponent_recency_weighted_win_pct`). None of these seven keys satisfy either of 080's real two named bullets — they're recent-opponent-quality and common-opponent-network figures, not a shared-opponent divergent-outcome count or a ceiling/floor caliber gap. This meant any finding for code 080 generated through `localMetricRows` (the `hybrid-audit-research.server.ts` path used by the live evidence-coverage diagnostic's `certifiedLocalRows`/`historicalLocalByCode` fallback) would report unrelated evidence under 080's name — a real instance of exactly the cross-code mismatch class this project's Task 19/20 reconciliation already fought to eliminate elsewhere (026/027, 069/070/071/079, etc.), just not previously caught here.

**Fixed:** removed the `"080"` entry from `SUMMARY_KEYS` entirely rather than invent a replacement. 080's genuine evidence continues to flow through `historical-results-recovery.ts`'s own `code==="080"` branch, which was never affected by this bug (it's a fully independent code path — `deterministicResultsScheduleMetric`/`completionSweepHistoricalFinding`, not `localMetricRows`'s `SUMMARY_KEYS` lookup).

## 9. Legitimate unavailable-data recovery
Recovered/confirmed:
- Common-Opponent Divergent Outcome has genuine, correctly-oriented, already-tested evidence (Task 18A, pre-dating this pass).

Still SOURCE REQUIRED:
- Opponent-Caliber Performance Gap — needs each player's own historical rank/Elo-at-match-time series, not currently carried by the row type `historical-results-recovery.ts` reads.

Fixed (evidence-inflation removal, not evidence recovery):
- The `SUMMARY_KEYS["080"]` cross-wiring bug (§8) — removes false credit, does not add real coverage.

## 10. Regression protection
`src/lib/metric-006-opponent-quality-contract.test.ts` (added alongside code 006's audit, since the bug was found while auditing 006) asserts `SUMMARY_KEYS["080"]` no longer contains code 006's or code 007's keys. `historical-results-recovery.ts`'s own existing test coverage for the `code==="080"` branch is unaffected and unchanged by this pass.

Certification: FIXED / PARTIAL / SOURCE REQUIRED. Evidence-inflation bug found and fixed; no new inflation introduced.
