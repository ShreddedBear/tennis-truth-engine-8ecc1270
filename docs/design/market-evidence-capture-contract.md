# Market-Evidence Capture Contract

Status: **additive infrastructure, reviewed and approved for this scope**. Nothing here is wired
into a production call path yet. `builderScoringService.ts` is untouched.

## 0. Provenance of this document

This design work originated in an earlier audit session on a since-divergent branch
(`claude/tennis-engine-audit-32-razn75`). That branch's repo layout (`lib/db`, `artifacts/api-server`)
no longer matches any live branch directly — the repository was consolidated on
2026-09-20 (`6bc5166` "Merge consolidated three-engine PostgreSQL architecture", now an ancestor of
`origin/main`). This document, and the code it describes, were re-derived against current
`origin/main` (`402d65b` at the time of this commit) rather than copied verbatim from the stale
worktree: paths, imports, line numbers, and the `OddsStatus` vocabulary below were all
independently re-verified against the files actually on `main`, not assumed from the old branch.

One dependency from the original design genuinely did not exist on `main`: a
`readCurrentCommit()` provenance helper the original design imported from a `scripts/offlineExperiments/`
tree that was never merged into `main`. A minimal replacement,
`artifacts/api-server/src/lib/captureProvenance.ts`, was written instead — it does the same one
thing (read `git rev-parse HEAD` live, fail loudly if the result isn't a real SHA) with no
dependency on the missing offline-experiments scaffolding.

## A. Why a new table, not a retrofit

`market_snapshots` (`lib/db/src/schema/marketSnapshots.ts`) is a brand-new table rather than an
extension of the existing single-slot odds columns (`predictions.oddsStatus`/`odds*`,
`parlay_leg_outcomes.market_odds`), for two reasons:

1. **Single-slot vs. multi-observation.** A matchup observed multiple times before its cutoff
   (price movement is itself evidence) has nowhere to go in a single-column design.
2. **Provider-agnostic, dual-parent.** `parlay_leg_outcomes` only stores an already-derived
   `market_odds NUMERIC` with no raw two-sided price and no capture timestamp. `market_snapshots`
   is the general-purpose table both the Prediction Engine (`predictionId`) and Parlay Builder
   (`legId`) capture paths can write into — exactly one of the two FKs is set per row, enforced by
   a `CHECK` constraint (`market_snapshots_exactly_one_parent`) in the migration, not by
   convention.

Every row stores **raw decimal odds for both sides** (the auditable primitive) plus two
independently-computed derived probabilities (naive renormalized `1/odds`, and the vig-adjusted
figure via the existing `computeVigAdjustedImpliedProbability`), so a later re-derivation can
always be checked against what was actually stored.

## B. Attempt-aware capture, not just success-aware

A row is written for every capture **attempt**, whether or not it produced a usable quote. This
lets the table answer both "what was the market?" and "why did this prediction have no market?"
from the same place. The four possible outcomes are the corrected Task #146 vocabulary (see
section C):

- `included` — a real quote was captured; odds/derived-probability columns and `isEligible` are
  all populated.
- `no_market_available` — a configured, working provider was queried and genuinely had no odds.
- `provider_not_configured` — no provider had an API key set; nothing was queried.
- `provider_error` — a configured provider threw.

For every non-`included` status, the odds/derived-probability columns and `isEligible` are `NULL`
— a legitimate, expected shape, enforced by the `market_snapshots_status_shape` CHECK constraint
in the migration (`artifacts/api-server/src/lib/marketEvidenceMigrations.ts`), not left to
convention.

### The eligibility invariant

A successful (`included`) snapshot is eligible for a prediction-time experiment only when:

```
market_snapshot.captured_at <= prediction.cutoff_at
```

This is never enforced by silently dropping a late observation. `isSnapshotEligible()`
(`captureMarketSnapshot.ts`) is a small pure predicate computing this; the write path always
stores the row and always stamps `isEligible` (`true`/`false`) for `included` rows — flagged, never
discarded. The `market_snapshots_eligible` view in the migration encodes the exact same rule in
SQL, so read-time consumers filter through one query surface instead of re-deriving the invariant
ad hoc.

`isEligible` is `NULL` (a third truth value, not `false`) for the three no-quote statuses — there
is no `captured_at` observation timestamp to compare against a cutoff for a row that captured no
odds; treating that as a computed `false` would manufacture a false eligibility signal for a row
with no evidence in it.

## C. `OddsStatus` correction (Task #146, corrected)

The **existing** three-state `OddsStatus` (`services/oddsData/index.ts`) — `included` /
`outside_window` / `provider_error` — collapsed two genuinely different situations into
`outside_window`:

1. A provider **was** configured and queried, and genuinely had no odds for this matchup.
2. **No provider was configured at all** (no `THE_ODDS_API_KEY` / `ODDS_API_IO_KEY` set), so
   nothing was ever queried.

Both fell through to the same label, making "no market" and "no provider" indistinguishable
downstream — this was the root cause traced (in the original audit) for why `oddsFetchedAt` was
never populating on some deployments: a missing API key silently looked identical to "checked, no
odds available" rather than "never checked at all".

This is corrected here to a four-state vocabulary — `included` / `no_market_available` /
`provider_not_configured` / `provider_error` — applied consistently across every place the
original three-state value flowed:

| File | What changed |
|---|---|
| `artifacts/api-server/src/services/oddsData/index.ts` | `OddsStatus` type widened; `fetchMarketOddsWithStatus` now computes `anyProviderConfigured` up front and a `noQuoteStatus()` helper distinguishes "queried, nothing" from "never queried". The `included`/`provider_error` return paths are unchanged. |
| `lib/db/src/schema/predictions.ts` | `oddsStatus` column `.$type<>()` and the `insertPredictionSchema` zod override both widened. Doc comment explicitly flags that pre-existing rows may still hold the legacy `"outside_window"` string, ambiguous between the two new values. |
| `lib/api-zod/src/generated/api.ts` | `oddsStatus` enum on `CreatePredictionResponse` hand-synced ahead of the next `orval` regeneration; flagged with a comment that the schema source (`lib/db/src/schema/predictions.ts`) is the source of truth. |
| `artifacts/api-server/src/services/evaluation/predictionSnapshot.ts` | Doc comment only — `marketOddsStatus: OddsStatus` already just passed the value through; no logic changed. |

`artifacts/api-server/src/routes/predictions.ts` reads `marketOddsStatus` and writes it straight
through to `oddsStatus` on the response/DB row — no change needed there, it already treats the
field opaquely.

## D. DB-level immutability (section C.1 of the original design)

`market_snapshots` rows must never be overwritten or backfilled once written. Enforced with a
`BEFORE UPDATE OR DELETE` trigger that raises an exception, rather than a `REVOKE`-based approach:
a trigger fires regardless of which DB role executes the statement, so it needs no knowledge of
the actual application role name. Both the function and trigger statements are idempotent
(`CREATE OR REPLACE FUNCTION`, `DROP TRIGGER IF EXISTS` + `CREATE TRIGGER`), matching the rest of
the migration file's idiom.

## E. Provenance

Every row stamps `capturedByCommit` — the git SHA of the worktree `HEAD` at capture time, read
live via `readCurrentCommit()` (`artifacts/api-server/src/lib/captureProvenance.ts`), never
hardcoded or computed at build time. `captureRunId` groups every snapshot written by one capture
invocation (e.g. one paper-trading cycle); `capturePipeline` names which internal pipeline
performed the capture (e.g. `"paperTradingCycle"` vs. `"builderValidate"`).

## F. Risk Floor observability — schema only, no scoring change

`artifacts/api-server/src/lib/marketEvidenceMigrations.ts` adds six additive, nullable columns to
`parlay_leg_outcomes`, named to match the exact variable names in
`builderScoringService.ts`'s risk-floor sequence as of this commit:

| Column | Mirrors variable | Current line |
|---|---|---|
| `pre_closeness_risk` | `preClosenessRisk` | `builderScoringService.ts:1772` |
| `closeness_risk_floor_value` | `riskFloor` (`closenessRiskFloor(closenessScore)`) | `:1835` |
| `post_closeness_risk` | `postClosenessRisk` | `:1836` |
| `thin_data_risk_floor_value` | `_thinDataFloor` | `:1849` |
| `thin_data_floor_fired` | `_thinDataFloorFired` | `:1850` |
| (derived) | `riskScore = _thinDataFloorFired ? _thinDataFloor : postClosenessRisk` | `:1851` |

Sequence, confirmed by reading the current file (not assumed from the earlier audit): a matchup's
risk starts as `preClosenessRisk`; the closeness floor can only raise it
(`postClosenessRisk = max(preClosenessRisk, riskFloor)`, never lower it); the thin-data floor then
**overrides** (not `max`s with) `postClosenessRisk` when it fires. Capturing all of the
intermediate values, not just the final `riskScore`, is what makes it possible to tell after the
fact which floor (if either) actually determined the final score.

**These columns are added now, empty, ahead of and independent from any code change that would
populate them.** No file that writes to them exists yet. Populating them requires a small,
separate instrumentation change to `builderScoringService.ts` — reading the six already-computed
local variables above into the row it already writes — proposed as a follow-up, gated on its own
review and never bundled with a scoring, threshold, or weighting change. That diff is **not**
included in, or applied by, this commit. Its line references above will need to be re-verified
again at the time it's actually proposed, since this file continues to change.

## G. Testing status

`captureMarketSnapshot.test.ts` (21 assertions across eligibility boundary, late-but-still-written
flagging, prediction vs. leg parent linkage, derived-probability computation, raw-odds
preservation, fail-loud validation, provenance stamping, and all four capture-status shapes) and
`providerRouting.test.ts` (five-case coverage of `fetchMarketOddsWithStatus`'s four states plus a
precedence test) were run in the canonical environment for this commit — `pnpm install` succeeded,
`pnpm run test:marketEvidence` passed 21/21, and `pnpm run typecheck` is clean for every file this
commit touches (a handful of pre-existing `TS6305`/`TS7006`/`TS2345` errors elsewhere in the
package, and pre-existing `DATABASE_URL`-dependent test failures in unrelated suites, were verified
to already exist before this change and are unrelated to it).

`builderScoringService.ts` is unmodified — confirmed via `git diff --stat` immediately before this
commit.
