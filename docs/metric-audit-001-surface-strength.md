# Metric 001 — Surface Strength — Sequential Audit Record

Status: FIXED (partial) / PARTIAL / SOURCE REQUIRED

## 1. Exact master definition
Authoritative source: `public/seed/metrics.txt`, section 1.

Required submetrics:
- Surface Elo
- Elo Win Probability
- Surface Sample Depth
- Effective Weighted Sample
- Surface Elo Trend/Momentum
- Peak Elo vs Current Elo
- Hard-Court Record
- Last-52-Week Hard-Court Record

## 2. Permitted raw inputs
Chronological four-tour match results (date, surface, opponent, winner), replayed forward with no future leakage, into a deterministic Elo model.

## 3. Sources inspected
- `src/lib/task18c-rank-form-workload.ts` (`computeHistoryMetric`, `replayElo`) — the live, production per-request engine, owned by `deterministic-ranking-metrics.server.ts`'s `historyFinding` and wired into `warehouse-first-researcher.server.ts`.
- `src/lib/task18c-rank-form-workload.test.ts` — existing coverage, including a Task 20 reconciliation note explaining that "Elo Win Probability" was folded into this file's 001 handling.

## 4. Defect found and partially fixed
The engine unconditionally returns `treatment: "RECONSTRUCTED"` while only ever delivering 2-3 of the 8 named submetrics (Surface Elo, and — after this fix — Elo Win Probability; loosely, a raw 52-week match/win count as a rough stand-in for Surface Sample Depth). It never computes Effective Weighted Sample (recency/quality-weighted, not a raw count), Surface Elo Trend/Momentum, Peak Elo vs Current Elo, or either Hard-Court Record bullet (both of which the master definition fixes specifically to hard courts, not to whatever surface today's match happens to be on — the engine only ever reports stats for `currentSurface`, the match being audited, which conflates "today's surface" with "hard court" whenever today's match isn't on hard).

Of the defect found, only one component was fixed this pass, and precisely: the existing `differential` value reported `overall_elo_delta_p1_minus_p2` (a raw Elo point spread, e.g. `+120`) and treated that as satisfying "Elo Win Probability." A point spread is a correlated/neighboring statistic for a win probability, not the exact named value itself — precisely the substitution `audit-research.server.ts`'s HOUSE_RULES firewall forbids ("Never substitute a proxy, correlated statistic, broader aggregate, or neighboring metric for the exact statistic named by a metric definition"). The standard Elo logistic formula that converts a rating differential into a win probability (`expected(a,b)`) was already implemented in this same file, just never applied to produce the actual named output. Fixed: `differential` now also reports `elo_win_probability_p1=XX.X%`, computed via that same formula, alongside the existing raw delta (kept for backward compatibility with any existing consumer of that exact substring).

## 5. Treatment classification

**Owner decision made (this pass, closing `docs/evidence-work-blockers.md`
item 3).** Changed from `RECONSTRUCTED` to `PARTIAL`. Rationale: this
project's own stated rule in `audit-research.server.ts`'s HOUSE_RULES is
that "RECONSTRUCTED is allowed only when every required component of the
exact definition/formula is sourced." This engine only ever delivers 2-3 of
code 001's 8 named submetrics (Surface Elo, Elo Win Probability, and a
rough 52-week match count standing in for Surface Sample Depth); it never
computes Effective Weighted Sample, Surface Elo Trend/Momentum, Peak Elo vs
Current Elo, or either Hard-Court Record bullet. That is not "every
required component," so by the project's own bar this cannot be
RECONSTRUCTED.

Blast-radius check before changing it: `HistoryMetricCode` /
`HISTORY_CODES` in `deterministic-ranking-metrics.server.ts` are locked to
`["001"]` only (a Task 20 reconciliation already moved 005/007/021/061 off
this file), so the treatment constant is not shared with any other metric
code. The only other consumer of this file's Elo replay,
`historical-twin-match-search.server.ts`, calls `replayElo` directly and
never reads the `treatment` field, so it is unaffected. No other test file
references code 001's treatment as RECONSTRUCTED (checked via grep across
`src/lib/*.test.ts`). `task18c-rank-form-workload.test.ts` updated to
assert `PARTIAL` with a comment pointing back here; full test suite (534
tests, 80 files) passes after the change.

This does not, by itself, change the 324-cell coverage count: 001 was
already counted as RECONSTRUCTABLE-potential in
`docs/evidence-coverage/81-metric-recoverability-audit.md` row 001, and
PARTIAL still keeps its 55/81-family "potentially usable" status per that
audit's own classification totals — it changes the per-request treatment
label surfaced to callers, not whether the cell counts as usable.

## 6. Reconstruction/formula verification
- `elo_win_probability_p1` = `100 / (1 + 10^(-(elo_p1 - elo_p2)/400))`, the same standard logistic Elo formula already used internally by `replayElo`'s `expected()` to run the K=32 rating updates — not a new or independently-invented formula.
- Verified against an independent from-scratch recomputation of the same formula in the new test, not merely checked for presence.

## 7. Provenance/sample/persistence
No change; `sample`/`source_names`/`reliability` fields are untouched by this fix.

## 8. Cross-wiring audit
Confirmed the existing `overall_elo_delta_p1_minus_p2=` substring is preserved verbatim (some consumer or test could depend on it), with the new `elo_win_probability_p1=` field appended after it rather than replacing it.

## 9. Legitimate unavailable-data recovery
Recovered/fixed:
- Elo Win Probability now reports the exact named quantity (a probability), not a proxy (a point spread).

Still SOURCE REQUIRED / not attempted this pass (each is a real engineering item, not a quick wiring fix, and is logged here rather than guessed at):
- **Effective Weighted Sample** — needs a defined recency/quality weighting scheme, not just a raw count; no such scheme exists yet in this engine.
- **Surface Elo Trend/Momentum** — needs a comparison between an earlier-window and later-window surface Elo (or delta-per-period), not currently computed.
- **Peak Elo vs Current Elo** — needs the player's highest-ever replayed Elo tracked over the whole replay, not just the current value; `replayElo` does not currently retain a running maximum.
- **Hard-Court Record / Last-52-Week Hard-Court Record** — both are specifically about hard courts, not "today's surface." The engine only ever reports `surfaceStrengthValue` for `currentSurface`; when today's match is on clay/grass/carpet, no hard-court-specific record is computed at all, and even when today's match is on hard, the code has no explicit "this is the fixed hard-court bullet, not a coincidence" handling — it would need a `surfaceStrengthValue(... , "hard")` call independent of `currentSurface`.

## 10. Regression protection
Added `src/lib/task18c-elo-win-probability.test.ts` proving:
- The differential includes a well-formed `elo_win_probability_p1=NN.N%` figure.
- That figure matches an independently recomputed standard Elo logistic formula from the reported point delta, to a decimal place, and isn't a placeholder or the delta itself relabeled.

Certification: FIXED (partial) / PARTIAL / SOURCE REQUIRED. No evidence inflation introduced; existing inflation (unconditional RECONSTRUCTED despite an incomplete submetric set) is documented but deliberately not changed this pass, pending an owner decision.
