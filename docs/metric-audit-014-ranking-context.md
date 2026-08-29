# Metric 014 — Ranking Context — Sequential Audit Record

Status: FIXED / PARTIAL / SOURCE REQUIRED

**First audit for this code.** `docs/evidence-coverage/81-metric-recoverability-audit.md`
previously labeled code 014 "Ranking & Rating" and classified it
DIRECTLY AVAILABLE — the name is a reasonable paraphrase of the real
"Ranking Context," but as this audit found, the classification itself was
wrong for the composite metric. This is the first audit written against
the real definition.

## 1. Exact master definition
Authoritative source: `public/seed/metrics.txt`, section 14.

Required submetrics:
- Current Ranking
- Ranking Trajectory
- Rapid Riser/Faller Status
- Ranking–Performance Disconnect

## 2. Permitted raw inputs
Official ATP/WTA ranking snapshots (`source_observations` rows with
`observation_type = "RANKING"`), with an as-of-date future-leakage guard.
Ranking–Performance Disconnect additionally needs a performance baseline
independent of ranking (e.g. derived Elo) to compute a gap against.

## 3. Sources inspected
- `src/lib/deterministic-ranking-metrics.server.ts` (`directRankingFinding`, `rankingSummary`, `rankingValue`) — the live, production, per-request engine, queries `source_observations` directly.
- `src/lib/deterministic-ranking-metrics.test.ts` — existing coverage; found an explicit `p1_treatment: "DIRECT"` / `p2_treatment: "DIRECT"` assertion (see §5).
- Repository search found no cross-reference between this file's ranking snapshots and any performance/Elo signal.

## 4. P1/P2 orientation
`rankingSummary(player, opponent, rows, asOf)` is called once per side (`args.p1, args.p2` then `args.p2, args.p1`) and filters `rows` to that side's own identity via `evidenceNameMatches`; each side's rank, trend, and rapid-status figures are independently computed from that side's own snapshots.

## 5. Treatment classification

**Owner decision made this pass, same pattern as metric 001's earlier
resolution.** Changed from `DIRECT` to `PARTIAL`. Rationale: this
project's own house rule (`audit-research.server.ts`) defines DIRECT as
"the exact metric itself is published at a named source." Code 014's
"exact metric" is the full four-bullet composite; only Current Ranking is
a raw published value. Ranking Trajectory and (after this pass) Rapid
Riser/Faller Status are genuinely computed from that same published
history — legitimate, but not "published," reconstructed. Ranking–
Performance Disconnect is not computed at all. An unconditional DIRECT for
all four bullets does not meet the project's own bar.

Blast-radius check before changing it: `deterministic-ranking-metrics.test.ts`
explicitly asserted the literal source text `p1_treatment: "DIRECT"` /
`p2_treatment: "DIRECT"` — updated in the same pass, with a comment
pointing back here. No other test file references code 014's treatment
(checked via grep across `src/lib/*.test.ts`); `evidence-availability-accounting.test.ts`
uses code 014 as an arbitrary fixture example but calls
`enrichEvidenceCoverageAccounting` directly with literal fixture data, not
`directRankingFinding`, so it does not depend on this engine's real
output and was left unchanged. Full test suite passes after the change.

This does not, by itself, change the true 60-code denominator or the
324/240-cell math (see `docs/evidence-work-blockers.md` item 0) — 014 was
already counted as usable either way; it changes the per-request treatment
label surfaced to callers.

## 6. Reconstruction/formula verification
- `rank` — the most recent ranking snapshot at or before `asOfDate`, taken directly from the row's `numeric_value`/payload — a genuine DIRECT-quality value for that one bullet.
- `rank_change_30d` / `rank_change_90d` — difference between the current rank and the nearest snapshot to 30/90 days prior — matches "Ranking Trajectory: the recent direction of movement" (sign and magnitude both reported).
- **New this pass:** `rapid_status` — `rapidStatus(rankChange30d)` in `deterministic-ranking-metrics.server.ts`, exported for direct unit testing. A documented, transparent threshold (`RAPID_RANK_MOVE_THRESHOLD = 20` ranking positions within 30 days) classifies `RAPID_RISER` / `RAPID_FALLER` / `STABLE` from the already-computed `rank_change_30d` — no new data source, purely a categorical label on an existing value, the same additive-fix style used for metric 001's Elo Win Probability. Matches "Rapid Riser/Faller Status: whether a player is moving unusually quickly up or down the rankings."
- Ranking–Performance Disconnect has no formula anywhere in this file; not attempted this pass (would need to cross-reference `task18c-rank-form-workload.ts`'s Elo replay against the same as-of-date, a larger lift outside this file's own data).

## 7. Provenance/sample/persistence
`sourceRefs(rows)` preserves `source_name`/`source_url` per row; `sample` states the exact query window, calculation, tour circuit, and future-leakage guard. Unchanged by this pass except `sample`'s `calculation=` text now also names the rapid-riser/faller threshold.

## 8. Cross-wiring audit
No other code's `OWNED` set includes 014 (`deterministic-ranking-metrics.server.ts`'s `OWNED = new Set(["001", "014"])`, and `HISTORY_CODES` is separately locked to `["001"]` only). No cross-wiring risk found.

## 9. Legitimate unavailable-data recovery
Recovered/confirmed:
- Current Ranking, Ranking Trajectory, and (new this pass) Rapid Riser/Faller Status all have genuine, correctly-oriented, provenance-carrying evidence.

Still SOURCE REQUIRED:
- Ranking–Performance Disconnect — needs a performance baseline (e.g. derived Elo) this engine does not cross-reference.

## 10. Regression protection
Added `src/lib/metric-014-ranking-context-contract.test.ts` proving:
- `rapidStatus` classifies exactly at and around the ±20 threshold (boundary-tested, not just interior values).
- The live engine's source text now reads `p1_treatment: "PARTIAL"` / `p2_treatment: "PARTIAL"` and reports a non-null `unavailable_reason` naming Ranking–Performance Disconnect.
- `deterministic-ranking-metrics.test.ts` updated in place (same file, existing test) to match.

Certification: FIXED / PARTIAL / SOURCE REQUIRED. No evidence inflation; the fix was additive (Rapid Riser/Faller Status) plus a treatment correction consistent with this project's own house rule.
