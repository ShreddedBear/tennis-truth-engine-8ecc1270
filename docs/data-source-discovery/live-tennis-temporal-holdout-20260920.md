# Post-June temporal holdout construction audit — 2026-09-20

## Decision

**BLOCKED_NOT_CONSTRUCTED**

No holdout rows were ingested or frozen. No Candidate B/D scoring, calibration, tuning, migration, destructive operation, push, merge, or deployment was performed.

The mandatory preflight failed before persistent ingestion:

1. written Live Tennis storage/evaluation authorization remains unconfirmed;
2. the canonical provider layer has no normalized Live Tennis bulk historical adapter;
3. deterministic player identity coverage is insufficient;
4. tournament-category coverage has material unresolved ATP/WTA residue; and
5. the current database has no completed post-June historical-match corpus from which a point-in-time population can be frozen.

Under the task's stop rule, these failures prohibit selecting, ingesting, fingerprinting, or scoring a population.

## Current database boundary

Direct runtime and database inspection establishes two active database boundaries.

### Prediction API

- **Technology:** PostgreSQL 16.10, database `heliumdb`.
- **Connection:** `DATABASE_URL`, consumed by `node-postgres` and Drizzle in `lib/db/src/index.ts`.
- **Active use:** Prediction, evaluation, historical-match, calibration, paper-trading, and parlay routes query this database.
- **Supabase:** not used by the Prediction API.

Current counts observed at `2026-09-20T06:36:06Z`:

| Table/measure | Rows |
|---|---:|
| `evaluation_predictions` | 518,636 |
| `historical_matches` | 530,097 |
| `predictions` | 188 |
| Evaluation rows after 2026-06-02 | 427 |
| Historical matches after 2026-06-02 | 0 |

### Truth Engine

- **Technology:** Supabase-hosted PostgreSQL 17.6 with PostgREST, database `postgres`.
- **Connection:** the current application imports `@supabase/supabase-js` and reads `VITE_SUPABASE_URL`/`SUPABASE_URL`.
- **Active use:** current Truth Engine browser and server clients query Supabase.

Current counts:

| Table | Rows |
|---|---:|
| `matches` | 60 |
| `audit_runs` | 60 |
| `final_decisions` | 60 |

Therefore, Supabase is active for the Truth Engine but is **not** the Prediction/evaluation database. Supabase export limits do not constrain the 518,636-row Prediction evaluation corpus.

## The 427 post-June evaluation rows

All 427 current post-June evaluation rows are `paper_trade` rows with status `missed`, scheduled from `2026-09-16T06:10:00Z` through `2026-09-20T05:40:00Z`.

| Check | Rows |
|---|---:|
| Total | 427 |
| Locked before scheduled start | 62 |
| Locked at or after scheduled start | 365 |
| Missing frozen feature snapshot | 427 |
| Missing verified outcome | 427 |
| Invalid cutoff (`cutoff_at >= scheduled_start_at`) | 0 |
| Meet all minimum temporal fields | 0 |

These rows are **invalid as a holdout population**. The 62 pre-start locks still lack both frozen features and verified outcomes. The rows were not substituted for completed historical matches.

## Current data-source readiness

The earlier read-only Live Tennis API Pro audit observed 33,357 rows from 2026-06-03 through 2026-09-20. That count is evidence of provider capability, not a frozen population:

- it includes non-singles rows;
- the endpoint was still updating;
- it was not normalized and persisted through a canonical Live Tennis historical adapter; and
- no eligible population was fixed before outcome/performance inspection.

The current normalized `getCompletedMatchesByDateRange` production path remains API-Tennis-specific. This assignment prohibits reactivating API-Tennis or MatchStat, so it cannot be used as a substitute.

## Licensing/storage gate

No written authorization was found that clearly covers all required operations:

- persistent private storage of raw `/history/matches` or package data;
- point-by-point retention;
- raw data in private backups;
- internal backtesting and temporal holdout construction;
- point-in-time feature reconstruction and model validation;
- long-term retention of provider match/player IDs and derived features;
- commercial prediction use and attribution obligations; and
- deletion/retention requirements after cancellation.

The existing audit explicitly requires written provider confirmation before bulk ingestion. No persistent Live Tennis ingestion was performed.

## Point-in-time controls

The historical scoring path reconstructs player history and head-to-head strictly before each `historical_matches.cutoff_at`, and passes that cutoff to the Prediction Engine as `asOfDate`.

Availability now follows the same contract:

- explicit replay `asOfDate` controls rest-day and 21-day retirement/walkover windows;
- omitted `asOfDate` preserves live wall-clock behavior; and
- current web research is suppressed whenever an explicit replay date is supplied, even if a future caller accidentally passes both.

Regression coverage verifies:

1. replay Availability is invariant when wall-clock time moves but the simulated cutoff is fixed;
2. current web research cannot change historical replay output; and
3. live predictions still use wall-clock time and can consume current research.

This resolves the known Availability wall-clock defect, but it does not satisfy the independent licensing, adapter, identity, category, ranking-snapshot, or population-size gates.

## Holdout freeze record

| Field | Value |
|---|---|
| Earliest permitted date | 2026-06-03 |
| Frozen start date | Not established |
| Frozen end date | Not established |
| Candidate population | 0 |
| Eligible population | 0 |
| Gradeable population | 0 |
| Exclusion population | Not computed; candidate set was never authorized or frozen |
| Deterministic orientation | Not applied |
| Deterministic ordering | Not applied |
| Overlap with protected 1,644 | Not computed; no new population exists |
| Population fingerprint | Not computed |
| Frozen | No |

A SHA-256 fingerprint would imply that a deterministic eligible row set exists. Because the preflight stopped before population construction, fabricating an empty or observational fingerprint would misrepresent readiness.

## Exact missing evidence

1. Written Live Tennis authorization for the required storage and evaluation workflow.
2. A normalized Live Tennis completed-singles bulk adapter in the active provider layer.
3. Deterministic provider aliases for the final singles-only population.
4. A predeclared deterministic treatment for null/ambiguous tournament categories.
5. Point-in-time ranking and historical-input snapshots bounded strictly before every match cutoff.
6. A sufficiently large, fixed, gradeable population selected without model-outcome inspection.

## Final readiness

- Valid post-June population constructed: **No**
- Population frozen: **No**
- Ready for B1/B2/D1/D2: **No**
- Candidate B/D execution permitted: **No**

Work stops here under the mandatory stop condition.