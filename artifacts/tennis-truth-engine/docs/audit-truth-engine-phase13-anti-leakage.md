# Truth Engine Phase 13 — forensic anti-leakage and decision-integrity audit

Baseline: commit e68db06 (22 active comparison codes). The question was not "does it work"
but "can information from after the audited match reach the winner".

## Leakage status: **LEAK FOUND AND FIXED**

### The defect

Eleven producer files filtered their source rows with this shape:

```ts
rows.filter(r => !cutoff || !r.date || r.date < cutoff)
```

It fails open twice:

1. **No cutoff means no filter.** The cutoff is parsed out of the pipeline's free-text
   context string (`"tournament X · date 2024-05-02 · surface clay"`). The date token is
   only present when `match.scheduled_date` is non-null. When it is null, `cutoff` is null,
   `!cutoff` short-circuits the whole predicate to true, and **the entire history —
   including every match played after the audited one — enters the metric.** The audit then
   reports the player's *current* state as their state at the match.

2. **An undated source row is always admitted.** `!r.date ||` lets a row with no date pass,
   asserting a temporal position the evidence does not support.

### Proof (live dataset, real producers, no mocks)

Same player, same producer, only the date token removed from the context:

| Statistic | context with date `2023-01-01` | context with no date |
|---|---|---|
| `current_overall_elo` | null | **1568.71** |
| `elo_change_last10` | null | **44.71** |
| `last10_win_pct` | null | **50** |

The correct answer is null — this player had no matches before that date. Without a
boundary the producer returned their latest state instead. This fed active registry codes
**001, 005, 055** (via `predixsport-strength` / `predixsport-recent`) and **007, 031, 080**
(via `predixsport-common`).

**Reachable in production:** 1 of the 55 live matches has a null `scheduled_date`.

### The fix

New `src/lib/temporal-boundary.ts` states the rule once: evidence is admissible only when it
can be *proven* to precede the audited match; if the boundary cannot be established, the
answer is no evidence — never all evidence.

```ts
export function auditCutoff(context: string): string | null
export function isBeforeCutoff(rowDate: string | null | undefined, cutoff: string): boolean
```

`isBeforeCutoff` returns false for a missing date, and takes a non-nullable `cutoff` — so
**the type checker located all nine call sites** where a null boundary was previously
swallowed, rather than my having to find them by eye. Each now bails explicitly (returning
`[]` or `null`, which surfaces as UNAVAILABLE).

Files corrected: `predixsport-strength`, `predixsport-recent`, `predixsport-h2h`,
`predixsport-derived`, `predixsport-dataset`, `predixsport-common`, `tennis-data-history`,
`tennis-data-extended`, `tennis-data-wta`, `availability-layoff`.

After the fix, all three undated-context values are null. Dated contexts are unaffected.

## Evidence the fix did not over-correct

Boundary advanced across five audit dates for one player, real data:

| cutoff | overall Elo | Δelo last10 | last10 win % | common opponents |
|---|---|---|---|---|
| 2016-01-01 | 2543.25 | +37.30 | 100 | 14 |
| 2018-01-01 | 2174.62 | −29.08 | 80 | 34 |
| 2020-01-01 | 2167.64 | +6.94 | 90 | 54 |
| 2022-01-01 | 2512.60 | −93.96 | 90 | 61 |
| 2024-01-01 | 2351.77 | +81.42 | 100 | 67 |

The common-opponent count grows monotonically — the observable signature of future shared
opponents being excluded at earlier boundaries.

## Historical immutability (Phase 3 / 17)

80 adversarial **future** rows were appended to the live source dataset: 40 future losses
collapsing one player's Elo from ~2350 to 900, 40 future wins for the other, and a brand new
shared opponent between them. A 2024-01-01 audit was run before and after.

Result: **byte-identical** across all nine measured quantities (Elo, peak, Δelo last10/last20,
last-5/last-10 win %, common-opponent count, both win percentages). The dataset was then
restored and verified by md5 checksum.

## Cross-run contamination (Phase 10)

The producers hold a module-level cache of raw source rows. A cache of *source* data is
legitimate; a cache carrying one match's state into another is not. Interleaved audits
prove which kind this is: `A → B → C → A` and `C → A → B → A` both reproduce A exactly, as
does the same audit run twice. Only the `retrieved_at` provenance stamp differs, which is
wall-clock metadata, not evidence.

## P1/P2 identity (Phase 11)

- Swapping the players swaps their common-opponent records exactly (`p1WinPct ↔ p2WinPct`,
  `p1Wins ↔ p2Wins`, `commonCount` unchanged).
- With identical evidence and the players exchanged, the winner **moves slots** (P1→P2) and
  the underdog moves with it. There is no hidden "P1 is the favourite" assumption.
- Phase 12 already added a swap test for every one of the 22 specs.

## Database audit (Phase 20)

| Check | Result |
|---|---|
| Evidence retrieved before its match date | 0 |
| Matches with no `scheduled_date` | 1 |
| Usable rows on that undated match | 8 — codes 021, 048, 049, 050, 056, 057, 058, 061 |
| Quarantined codes with usable treatment | 2 (both code 035, created 2026-08-30, before the 2026-09-03 quarantine) |
| Matrix Summary codes in the comparison registry | 0 (pinned by test) |

**The vulnerability was real and reachable, but no active registry code was contaminated in
persisted data**: all 8 usable rows on the undated match are META or non-registry codes. The
two 035 rows are pre-quarantine historical records the quarantine explicitly preserves, and
035 has no comparison spec, so it cannot vote.

## Known exposure NOT fixed, and why (Phase 19)

The nine pre-Phase-12 specs carry no sample guard. A live example of the resulting risk, from
run `c40f4025`: metric 005 compared P1 at `SAMPLE=1, last10_win_pct=50` against P2 at
`SAMPLE=5, last10_win_pct=0`. That 50-point differential — **ten times** the metric's
materiality — rests on a single match on one side, and it drove a CRITICAL-severity
RECENT_FORM finding.

A guard was deliberately **not** added. Metric 005 persists two shapes: `last10_matches=n`
(unambiguous) and `SAMPLE=n` (used by many predix statistics with differing meanings). A
guard keyed only to `last10_matches` would fire INSUFFICIENT_SAMPLE on every predix-shaped
row and silently remove 005 from most audits. Fixing this needs the producer to emit one
unambiguous denominator, not a registry change.

Same situation for 001 and 011, which persist no denominator at all. 008, 010, 027, 031,
051 and 080 *do* persist usable denominators (`deciding_matches`, `scored_wins`,
`lead_protection_n`, `common_opponents_n`, `n_h2h`, `common_opponents`) and are the
candidates for guards once the producer work above is done.

## The three known producer defects (Phase 18)

013, 014 and 030 remain out of the registry. None can currently cause leakage, false support
or false contradiction **because none participates in comparison**. Required work:
013 needs `return_after_layoff_win_pct` populated consistently (42/304 rows today);
014 needs the keyed shape instead of a bare scalar (31/304 keyed);
030 needs a `same_tournament_win_pct` — it persists wins and matches but no rate, and a raw
win count is confounded by matches played.

## Regression tests

`src/lib/truth-engine-temporal-integrity.leakage.test.ts` — 17 tests: boundary parsing, the
audited day excluded, undated rows refused, all three producers yielding nothing without a
boundary while still yielding evidence with one, monotonic common-opponent growth,
three cross-run contamination orderings, P1/P2 swap and slot-independence of the winner, and
the Matrix Summary quarantine.

Total suite: 1053 tests across 136 files, clean typecheck, worker bundle 7.7MB/25MB.

## Remaining limitations — honest

- **One unexplained intermittent.** One full-suite run showed a single failure in
  `deterministic-batch4-favorite-underdog-patterns.test.ts`. It did not reproduce in six
  further full runs, nor in three runs in isolation immediately after regenerating the 61MB
  runtime index (the hypothesis I tested). The cause is not established. It is recorded here
  rather than explained away.
- The nine original specs' small-sample exposure above is documented, not fixed.
- Surface/context normalisation is still not modelled: 001 is surface-specific while 011 and
  055 are overall, and the comparison layer does not reconcile them.
- The cutoff is still parsed from a free-text context string by regex. It now fails closed,
  but passing the match date as a typed value would remove the parsing step entirely.
- This audit covered the producers feeding the 22 active codes. Producers feeding only
  inactive codes were corrected where they shared the same defective pattern, but were not
  individually traced.
