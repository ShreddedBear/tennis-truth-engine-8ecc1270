# Live Tennis historical adapter — read-only validation — 2026-09-20

## Status

**PREFLIGHT_FAILED_NO_RESET**

This task adds an architecture-compatible Live Tennis historical adapter without:

- writing provider data to PostgreSQL;
- modifying existing evaluation rows;
- wiring Live Tennis as the production primary or fallback;
- reactivating API-Tennis or MatchStat;
- running Candidate B or Candidate D;
- changing model logic; or
- constructing or freezing a temporal holdout.

The adapter also supports the tournament catalogue as a read-only prerequisite for the audit
path. It does not persist catalogue rows or wire the provider into the production factory.

## Provider contract

The adapter is `LiveTennisHistoricalProvider` in:

`artifacts/api-server/src/services/tennisData/liveTennisHistoricalProvider.ts`

It implements the existing `TennisDataProvider` contract and focuses on:

`getCompletedMatchesByDateRange(dateStart, dateStop)`

The other provider methods fail explicitly with `ProviderUnavailableError`; they do not return fabricated fixtures or silently fall back to another provider.

### Live Tennis request

- Base URL: `https://api.livetennisapi.com/api/public/v1`
- Authentication: `X-API-Key`
- Endpoint: `GET /history/matches`
- Date filters: inclusive `from` and `to`
- Draw filter: `draw=singles`
- Page size: `limit=200`, the observed provider cap
- Pagination: offset-based, guarded by a configurable maximum page count
- Response: `{ data, meta }`

The adapter rejects:

- non-singles rows;
- rows marked as doubles teams;
- rows without both stable player IDs and names;
- rows without a parseable scheduled timestamp; and
- rows without a terminal status.

It accepts terminal `completed`, `cancelled`, `canceled`, `retired`, and `walkover` statuses. Duplicate provider match IDs are collapsed deterministically.

## Tournament catalogue

`getTournamentCatalogue()` calls `GET /tournaments` with deterministic 200-row offset pagination
and the same configurable max-page guard. The read-only validation path automatically fetches
this catalogue before normalizing history rows, so `tournament_id` can be resolved to an
explicit category without guessing from tournament names or tour.

Catalogue behavior:

- stable numeric/string `id` is the map key;
- duplicate IDs keep the first occurrence;
- an explicit `category: null` remains null;
- request failures are surfaced as `ProviderUnavailableError`; and
- the catalogue is held in memory only.

The parent-verified representative catalogue response was:

```json
{"id":2360,"name":"Tiburon","category":"challenger","surface":"hard","tour":"challenger","indoor":false}
```

The normalized level is `Challenger`. No category is inferred when the catalogue or match
payload does not provide one.

## Verified read-only sample

A single authenticated read-only request was made for:

`from=2026-09-19&to=2026-09-19&draw=singles&limit=200&offset=0`

Observed result:

| Field | Value |
|---|---:|
| HTTP status | 200 |
| Response shape | `{data,meta}` |
| Rows returned | 124 |
| Provider `meta.count` | 124 |
| Provider `meta.has_more` | false |
| Provider `meta.limit` | 200 |
| Provider `meta.offset` | 0 |
| Provider `meta.total` | null |

The representative response exposed the required match fields:

- provider match ID;
- explicit `draw`;
- terminal status/outcome;
- player IDs, names, tours, and rankings;
- scheduled timestamp;
- tournament and stable tournament ID;
- tour;
- surface;
- round and round code;
- BO3/BO5 format;
- winner;
- final player-major `score.games`; and
- indoor flag.

Representative observed row:

- provider match ID: `192070`;
- draw: `singles`;
- status: `completed`;
- format: `BO3`;
- surface: `hard`;
- tour: `challenger`;
- round code: `SF`;
- score games: `[[6,6],[2,2]]`;
- winner: player 1.

## Latest three-week preflight (primary audit result)

Two independent read-only runs covered the exact window `2026-08-30` through `2026-09-20`.
Both produced byte-identical aggregate outputs. The SHA-256 below is an **aggregate
audit-output fingerprint**, not a frozen population fingerprint.

| Measure | Count |
|---|---:|
| Raw rows returned | 23,982 |
| Normalized terminal singles | 4,929 |
| Catalogue requests | 52 |
| History requests | 25 |
| Total requests | 77 |
| Unique Live Tennis provider players | 3,266 |
| Resolved identities (exact normalized) | 2,149 |
| Ambiguous identities | 0 |
| Unresolved identities | 1,117 |

The 4,929 normalized rows include terminal endpoint rows; 4,864 have explicit winners.

### Field coverage

Coverage is reported over the 4,929 normalized terminal singles:

| Field | Count |
|---|---:|
| Provider ID | 4,929 |
| Date | 4,929 |
| Time | 4,929 |
| Player IDs | 4,929 |
| Player names | 4,929 |
| Tournament | 4,929 |
| Tour | 4,929 |
| Format | 4,929 |
| Provenance | 4,929 |
| Winner | 4,864 |
| Tournament ID | 4,815 |
| Tournament level | 4,662 |
| Surface | 4,499 |
| Round | 4,834 |
| Final-set games | 4,872 |

### Match eligibility (non-exclusive reasons)

| Reason | Count |
|---|---:|
| Missing winner | 65 |
| Unresolved or ambiguous player identity | 1,995 |
| Missing tournament level | 267 |
| Missing surface | 430 |
| Missing round | 95 |
| Missing format | 0 |
| Missing final-set games | 57 |
| All required fields present | 2,687 |

`deterministicOrdering` was `true` and duplicate provider IDs were `0` in both runs.

Aggregate audit-output SHA-256: `72b2ff0f5be76751bb4dc0a8acbf3abcd16827b9936384e960d35dc5710cebbd`.

### Stop decision

Status is **PREFLIGHT_FAILED_NO_RESET**. No backup, reset, or replay proceeded because the
replacement population is not point-in-time safe: canonical identities remain unresolved and
provider ranking fields are current/listing values, not proven as-of-match records. No Prediction
Engine, Parlay Builder, or Truth Engine state was deleted or modified. No Candidate B/D run or
replay ran. There is no holdout population fingerprint, freeze, or performance metric.

The current `players.*.ranking` values in Live Tennis match rows must **not** be treated as
as-of-match rankings. Point-in-time ranking support remains unproven, so those fields are not
safe historical ranking snapshots.

## Broader post-June observation (secondary context)

The earlier read-only observation covered `2026-06-03` through `2026-09-20` and returned 23,982
raw rows and 23,982 normalized terminal singles, with 120 history requests. It remains secondary
context only and was not a holdout: no population fingerprint was generated and no population
was frozen.

## Normalization and provenance

The normalized output is the existing `HistoricalFixture` type. It preserves:

- provider match ID;
- UTC calendar date and scheduled time;
- provider tour;
- tournament name and ID;
- nullable canonical tournament level;
- round;
- nullable surface;
- nullable BO3/BO5 format;
- player IDs and names;
- winner;
- score string and per-set game margins;
- retirement, walkover, and cancellation flags;
- indoor flag;
- provider rankings when supplied; and
- raw provider payload plus field-level provenance metadata.

### Identity behavior

The adapter preserves Live Tennis provider IDs and names. It does not claim those IDs are canonical IDs in the existing historical database, and it does not use fuzzy matching.

Canonical identity resolution remains a separate explicit step. Unresolved provider identities remain unresolved.

### Tournament behavior

Tournament level is mapped only from:

1. `match.tournament.category`; or
2. an explicitly supplied deterministic catalogue map.

The adapter never infers ATP 250, WTA 250, surface, or format from tour or tournament name alone. Missing category remains `null`.

Supported explicit mappings include:

| Provider category | Normalized level |
|---|---|
| `grand_slam` | `GrandSlam` |
| `masters_1000` | `Masters1000` |
| `atp_500` | `ATP500` |
| `atp_250` | `ATP250` |
| `wta_1000` | `WTA1000` |
| `wta_500` | `WTA500` |
| `wta_250` | `WTA250` |
| `challenger`, `wta_125` | `Challenger` |
| `itf` | `ITF` |
| `other` | `Other` |

### Score and cutoff behavior

The provider documents `score.games` as player-major. The adapter preserves that orientation as `setGameMargins`.

`scheduled_time` is used for the historical match date/time. Later `updated_at` values remain available inside the raw payload for audit provenance but are not used as prediction-time evidence.

## Validation script

The script is:

`artifacts/api-server/src/scripts/auditLiveTennisHistoricalAdapter.ts`

Example invocation:

```text
pnpm exec tsx src/scripts/auditLiveTennisHistoricalAdapter.ts \
  --from 2026-09-19 \
  --to 2026-09-19 \
  --max-pages 10 \
  --output /tmp/live-tennis-audit.json
```

It reads the API key from either:

- `Live_Tennis_Api`; or
- `LIVE_TENNIS_API_KEY`.

The script:

- calls the provider only when explicitly invoked;
- never prints the API key;
- keeps raw responses in memory only;
- never writes to the database (the identity audit reads the existing identity index only);
- writes aggregate audit JSON only when an explicit output path is supplied;
- reports field coverage and exclusion reasons;
- reports duplicate IDs and deterministic ordering; and
- stops if pagination exceeds `--max-pages`.

The same `--max-pages` value applies to `/tournaments` and `/history/matches`. Passing
`--max-pages 250` permits an explicitly authorized audit to exceed 100 pages without silently
truncating. The script reports resolved, ambiguous, and unresolved Live Tennis players together
with resolution methods.

The output includes `catalogueRequests`, `historyRequests`, and `totalRequests`. It also
includes a match-level, non-exclusive eligibility audit counting missing winner, unresolved or
ambiguous player identity, missing tournament level, surface, round, format, and final-set
games, plus `allRequiredFieldsPresent`. This is diagnostic only: it does not alter gradeability,
freeze a population, or run Candidate B/D.

## Canonical identity audit

The validation script reuses the existing `PlayerIdentityIndex` and
`resolvePlayerNameWithAmbiguity` functions through the pure
`liveTennisIdentityAudit.ts` helper. It does not insert Live Tennis aliases or write database
rows.

Resolution priority is:

1. existing `canonicalIdById` provider mapping;
2. exact normalized identity;
3. deterministic metadata disambiguation supplied by a caller; and
4. explicit unresolved/ambiguous status.

No fuzzy matching is used. Because Live Tennis IDs are a separate provider namespace and the
existing index is built from local historical data, an ID absent from the index cannot become
canonical merely because its name looks similar. The audit reports that limitation instead of
mutating the identity index.

The full-range figures above are the first real observation and are not a frozen holdout.

## Tests

Focused tests cover:

1. completed singles normalization;
2. inclusive date and pagination query construction;
3. stable player IDs and provenance;
4. tournament category mapping and explicit unknowns;
5. surface mapping;
6. BO3/BO5 mapping;
7. round mapping;
8. scheduled timestamp cutoff provenance;
9. deterministic ordering;
10. duplicate prevention;
11. byte-identical repeated construction;
12. non-singles, nonterminal, malformed, and doubles-team exclusion; and
13. provider errors and maximum-page safety.

Additional tests cover tournament pagination, duplicate catalogue IDs, explicit null categories,
catalogue request failures, exact unique identity resolution, ambiguous normalized-name
collisions, unresolved identities, and metadata disambiguation.

Current web-research suppression is already covered by the Prediction Engine historical replay regression test:

`artifacts/api-server/src/services/predictionEngine/index.test.ts`

## Holdout status

No population was frozen. No holdout population SHA-256 fingerprint was generated. The
three-week SHA-256 above fingerprints only the byte-identical aggregate audit output.

The existing temporal holdout remains blocked by the previously documented gates:

- written provider storage/evaluation authorization;
- deterministic canonical player aliases;
- deterministic tournament/category coverage;
- point-in-time ranking and historical feature inputs; and
- a reproducible, sufficiently gradeable post-June population.

The 427 paper-trade rows remain excluded and were not used.

## Files changed

- `artifacts/api-server/src/services/tennisData/liveTennisHistoricalProvider.ts`
- `artifacts/api-server/src/services/tennisData/liveTennisHistoricalProvider.test.ts`
- `artifacts/api-server/src/services/tennisData/liveTennisIdentityAudit.ts`
- `artifacts/api-server/src/services/tennisData/liveTennisIdentityAudit.test.ts`
- `artifacts/api-server/src/scripts/auditLiveTennisHistoricalAdapter.ts`
- `docs/data-source-discovery/live-tennis-historical-adapter-20260920.md`
- `docs/data-source-discovery/live-tennis-historical-adapter-20260920.json`

No production provider factory, database schema, model code, or holdout artifact was modified.