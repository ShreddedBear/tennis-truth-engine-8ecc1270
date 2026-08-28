# Metric 019 — Market Calibration — Sequential Audit Record

Status: FIXED

## 1. Exact master definition
Authoritative source: `public/seed/metrics.txt`, section 19.

Required submetrics:
- Upset History by Implied Market Probability
- Favorite Performance by Price Bucket
- Player-Specific Calibration

All three require a **realized-outcome-linked, historical** view: a player's actual win/loss record cross-referenced against the market price they were given, across many past matches. None of them can be answered from a single match's current odds.

## 2. Permitted raw inputs
Historical odds observations paired with the realized winner of each of those historical matches. Today's price for today's match, on its own, cannot satisfy this definition no matter how it's summarized (average, de-vig, movement, or favorite share) -- it has no outcome attached yet.

## 3. Sources inspected
- `src/lib/deterministic-market-metrics.server.ts` — the live, production per-request path (wired into `warehouse-first-researcher.server.ts`, which is the actual `research` implementation used by `audit-repo.server.ts`'s `makeDeps()`).
- `src/lib/metric-certification.ts` — a conservative, already-tested, "never upgrades, only downgrades" post-validation safety net keyed by metric code, with a registered policy for code 019 (`metric-certification.test.ts`'s "metric 019 Market Calibration certification" suite already codified the correct behavior).
- `src/lib/completion-sweep-research.server.ts` and `src/lib/evidence-coverage-runtime-diagnostic.server.ts` — the only two callers of `certifyMetricFinding` before this fix.

## 4. Defect found and fixed
`deterministic-market-metrics.server.ts` only ever queries `source_observations` for a single `event_date` (the match being audited) -- see `loadSide`'s `.eq("event_date", matchDate)`. Its output for code 019 is therefore always a same-match odds/de-vig/movement summary (`avg_de_vig=...; avg_raw=...; move=...; favorite_share=...; n=...; paired=...`), never a historical price-bucket win rate or an outcomes count. Despite that, the function's own `isCoreMarket` check marked code 019 `RECONSTRUCTED` -- the same full-delivery treatment as code 015 (Market Layer), whose definition genuinely is current-match pricing. The function's own `unavailable_reason` text for 019 ("Outcome-linked calibration completion still requires verified result labels...") already admitted this gap in plain language; the treatment field just didn't agree with it.

This treatment inflation reached live scoring uncorrected: `certifyMetricFinding` -- the exact safety net built and tested for this precise "current odds only" case -- was never called from `warehouse-first-researcher.server.ts`'s path. It was only invoked from two callers unrelated to live per-request scoring (a completion sweep and a diagnostic tool). So every live audit run counted metric 019 as delivered (RECONSTRUCTED -> COMPLETE -> counted toward usable evidence coverage) when it had only ever supplied a same-match snapshot.

**Fix:** `deterministic-market-metrics.server.ts` now wraps its return value in `certifyMetricFinding(...)` before returning, so the existing, already-tested certification policy for 019 applies at the source -- covering the live path as well as the two callers that already had it. Codes without a registered policy (015, 043, 044 today) pass through `certifyMetricFinding` unchanged, confirmed by a new test.

`isCoreMarket` itself was deliberately left untouched (it's asserted verbatim in the pre-existing `deterministic-market-metrics.test.ts`); the fix corrects the outcome without touching that line, by adding a downstream check rather than hand-editing the per-code treatment logic.

## 5. Treatment classification
019 stays honestly UNAVAILABLE whenever it only has current-match odds (which, given `deterministic-market-metrics.server.ts`'s single-event-date query, is always). It would only earn RECONSTRUCTED if a future change actually aggregates a player's historical price-bucket record with realized outcomes and produces text containing a bucket, an outcomes count, and a calibration error, per `metric-certification.ts`'s `CERTIFIED_METRIC_POLICIES["019"]`.

## 6. Reconstruction/formula verification
No formula changed. `avg_de_vig`/`avg_raw`/`move`/`favorite_share` math in `deterministic-market-metrics.server.ts` is unchanged and legitimate for code 015; it was simply never sufficient for code 019.

## 7. Provenance/sample/persistence
Unchanged; `certifyMetricFinding` only ever narrows `p1_value`/`p2_value`/`p1_treatment`/`p2_treatment`/`unavailable_reason`/`missing_inputs`, never touches `sources`/`sample`/`reliability`.

## 8. Cross-wiring audit
Confirmed no other live-path caller of `deterministic-market-metrics.server.ts` bypasses the new wrap (there is exactly one call site, `warehouse-first-researcher.server.ts`). Confirmed 015/043/044 have no registered `CERTIFIED_METRIC_POLICIES` entry, so this fix cannot silently downgrade them.

## 9. Legitimate unavailable-data recovery
Recovered/fixed: metric 019 no longer falsely counts as delivered evidence on the live per-request scoring path.

Still SOURCE REQUIRED: a genuine historical price-bucket-vs-outcome join for 019 does not exist yet in this codebase on any path (live or sweep) -- building it is a real feature, not a wiring fix, and is a legitimate next item for this series rather than something this pass invented.

## 10. Regression protection
Added `src/lib/deterministic-market-metrics-certification.test.ts` proving:
- `deterministic-market-metrics.server.ts` actually calls `certifyMetricFinding` on its return value.
- The exact current-odds-only text shape this function produces is downgraded to UNAVAILABLE for code 019.
- The same text is left as RECONSTRUCTED for code 015, proving the fix doesn't over-correct.

Certification: FIXED. No evidence inflation.
