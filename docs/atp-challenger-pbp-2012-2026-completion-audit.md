# ATP Challenger historical PBP — completion audit (2012–2026)

Scope: ATP Challenger only. This document consolidates two pre-existing, independently
generated audit lineages in this repository into one accurate picture, and states exactly
what is and is not approved production evidence. It does not re-run, mutate, or regenerate
either lineage's output artifacts — those remain the generated audit trail of the tools
that produced them.

## Bottom line

The commonly cited **9,218** figure (2012: 2,274; 2013: 2,897; 2014: 3,329; 2015 partial:
718) is a count of **structural existence mappings**, not persisted raw PBP tapes.

**0 of the 9,218** have resulted in an approved, persisted raw point-by-point tape, and
**0 of the 9,218** are fully firewall-certified even as mappings — all 9,218 are
`PROVISIONAL_REAUDIT_REQUIRED` under the v2 re-audit
(`data/audit/challenger-pbp-firewall-queue/validity-reaudit-v2-summary.md`). No code path
in this repository writes any of these 9,218 rows, or any raw PBP string, into
`source_observations` or any other Supabase table. The metrics engine does not consume
them. This matches the brief's own caution not to count all 9,218 as approved production
PBP without verification.

Real, currently-active ATP Challenger PBP evidence in production comes from a **separate,
already-certified lane**: the BSD/Bzzoiro live API adapter
(`src/lib/bsd-atp-challenger-pbp.server.ts`), certified in
`docs/NEWLY_GREEN_COVERAGE_AUDIT.md` for **2025 → current**. That lane was already wired
in before this audit; nothing needed to be "activated" for it, and nothing in this audit
changed its behavior.

## Two audit lineages, not one

| Lineage | Purpose | Source | Persists raw tape? | Feeds engines? |
|---|---|---|---|---|
| `scripts/verify-challenger-pbp.py` → `data/audit/verified-pbp/atp_challenger/<year>/*` | Historical existence audit: "can a 2012–2026 result row be structurally matched to an external tape?" | TennisMyLife result CSV (identity anchor only) + `ppaulojr/tennis_pointbypoint` GitHub CSVs (tape, fetched transiently, hashed, discarded) | No — only a SHA-256 + derived summary (`sets`, `points`, `games`, `winner`) is kept | No |
| `src/lib/bsd-atp-challenger-pbp.server.ts` (+ `scripts/bsd-atp-challenger-pbp-history.py` scan) | Production evidence: live point-by-point reconstruction for the metric engine | BSD/Bzzoiro `/matches/{id}/point-by-point/` API | No — in-memory per request, process-lifetime cache only | Yes — `deterministic-pbp-metrics.server.ts`, `RECONSTRUCTED_OR_TASK17_PARTIAL_ONLY` treatment only |

These two lineages independently confirm the same underlying fact from different angles:
Sackmann's own `atp_matches_qual_chall_<year>.csv` (see `docs/ATP_DATA_ATTRIBUTION.md`) and
every other historical-results source used here carry scores/rankings only — never point
sequences — so a Challenger-level raw tape only exists at all where a third-party PBP
provider (the GitHub PBP mirror, or BSD/Bzzoiro) separately recorded it.

## Coverage by year (existence-audit lineage, `verify-challenger-pbp.py`)

| Year | Historical Challenger matches | PBP candidates found | Verified (mapping only, provisional) | Note |
|---:|---:|---:|---:|---|
| 2012 | 4,231 | 4,709 | 2,274 | GitHub PBP mirror has coverage |
| 2013 | 4,293 | 5,097 | 2,897 | GitHub PBP mirror has coverage |
| 2014 | 4,324 | 4,353 | 3,329 | GitHub PBP mirror has coverage |
| 2015 | 4,603 | 990 | 718 | GitHub PBP mirror coverage drops off mid-year |
| 2016 | 4,929 | 0 | 0 | GitHub PBP mirror has no data this year |
| 2017 | 4,495 | 0 | 0 | GitHub PBP mirror has no data this year |
| 2018–2022 | — | — | — | Hard-excluded by `scripts/audit-challenger-verified-mappings-v2.py` (`EXCLUDED=range(2018,2023)`); never queued, no source ever configured for this window |
| 2023 | 5,693 | 0 | 0 | `BLOCKED_RETRYABLE`: `NO_MODERN_CHALLENGER_PBP_SOURCE_CONFIGURED` — this specific tool has no post-2017 PBP source wired in |
| 2024 | 5,939 | 0 | 0 | Same as 2023 in this lineage. Independently, the BSD historical scan (below) also finds 0 real ATP Challenger matches from BSD for 2024 — so this year is genuinely empty, not just unwired |
| 2025 | 6,318 | 0 (in this lineage) | 0 (in this lineage) | **Misleading in isolation** — see BSD lineage below: this year is live-certified production coverage via a different tool |
| 2026 | 4,964 | 0 (in this lineage) | 0 (in this lineage) | Same caveat as 2025 |

Source: `data/audit/challenger-pbp-firewall-queue/summary.md` and per-year
`data/audit/verified-pbp/atp_challenger/<year>/summary.json`.

## Coverage by year (production lineage, BSD/Bzzoiro live scan)

`data/audit/bsd-atp-challenger-pbp-history/progress.json` (incremental, one year per run,
walking backward from the current year):

| Year | ATP Challenger matches examined | Usable BSD PBP | Status |
|---:|---:|---:|---|
| 2026 | 306 | 304 | Confirmed — live production lane |
| 2025 | 1,450 | 1,436 | Confirmed — live production lane, earliest date 2025-01-12 |
| 2024 | 0 | 0 | Confirmed empty — BSD's own match listing returns no ATP Challenger matches this far back |
| 2023 and earlier | not yet scanned | — | `next_year: 2023`, `scan_complete: false` |

**This is the reason the runtime adapter's `COVERAGE_START = "2025-01-01"` is correct and
not an arbitrary policy gate**: it is the earliest year the live BSD scan has confirmed
usable Challenger PBP, and 2024 has already been checked and found empty. It is not a
TennisMyLife-style reuse-terms block — there is no known-good source being needlessly
withheld here.

## Why the 2025–2026 mismatch between the two lineages is not a bug

The existence-audit lineage (`verify-challenger-pbp.py`) was built before the BSD adapter
existed and was never pointed at BSD; it only knows about the GitHub PBP mirror, which has
no 2023+ coverage. Its `BLOCKED_RETRYABLE`/`NO_MODERN_CHALLENGER_PBP_SOURCE_CONFIGURED`
status for 2025–2026 is accurate for *that tool's* configured source — it is not a false
negative in production. Production evidence for 2025–2026 is unaffected: it flows through
the separate, already-certified BSD runtime adapter, confirmed in
`docs/NEWLY_GREEN_COVERAGE_AUDIT.md`. No code change was made to reconcile the two
lineages' bookkeeping, per the multi-agent-safety instruction not to build a duplicate
source/config system on top of an already-working runtime path; this document is the
reconciliation.

## TennisMyLife — impact, precisely

- `src/lib/historical-source-policy.ts`: `tennismylife` has `enabled: false`,
  `reuseTermsVerified: false`. This governs the general 2005→present multi-source
  historical-results aggregation layer (player records, H2H, form, surface, Elo,
  fatigue, common-opponent, reconstruction). TennisMyLife contributes **nothing** to that
  layer today, and this audit did not change that.
- Separately, `data/public/tennismylife-challenger/raw/*.csv` (TennisMyLife match
  **results**, not PBP) are used only inside `verify-challenger-pbp.py` as the
  independent-identity anchor for the existence-audit lineage above — i.e., "does a
  structurally-reconstructed external tape match a real recorded result." No PBP content
  originates from TennisMyLife; the tape itself comes from the unrelated
  `ppaulojr/tennis_pointbypoint` GitHub mirror.
- Whether this identity-anchor use falls inside or outside the intent of
  `historical-source-policy.ts`'s TennisMyLife gate is a policy judgment call, not a
  technical one — this audit surfaces it rather than resolving it silently in either
  direction, per the brief's instruction not to silently promote an unapproved source.
  **Recommendation, not applied**: if TennisMyLife must be avoided entirely, the
  existence-audit lineage's identity anchor should be re-anchored to one of the four
  already-enabled sources (`current`, `official`, `tennis-data`, `datahub-atp`) — this
  is a scoped, single-file change to `scripts/verify-challenger-pbp.py` /
  `scripts/sync-tennismylife-challenger.py`, left undone here because it touches an
  external-network sync script this session cannot re-run or validate (no credentials,
  no dependency install available — see Remaining gaps).

## BSD — impact, precisely

"BSD" = this codebase's short name for the Bzzoiro API (`sports.bzzoiro.com`), unrelated
to the Berkeley Software Distribution license. It is the only source in this repository
that has ever produced a real, usable ATP Challenger point-by-point sequence
(server, point winner, game/set/tiebreak structure) — confirmed structurally valid for
1,740 of 1,756 examined 2025–2026 matches. It is already an approved production source
(`docs/NEWLY_GREEN_COVERAGE_AUDIT.md`); this audit added no new BSD wiring and required
none.

## Sackmann — impact, precisely

Sackmann's `tennis_atp` (`atp_matches_qual_chall_<year>.csv`) is used for ATP Challenger
**match-result** ingestion in both repositories, filtered to `tourney_level=C`. Confirmed
by direct inspection of both repos: **no Sackmann file consumed by either repository
contains point-by-point data.** Sackmann's separate point-by-point projects
(`tennis_slam_pointbypoint`, the Match Charting Project) are Grand-Slam/exhibition only
and are not referenced by name or fetched anywhere in either repo. `scripts/verify-sackmann-pbp*.py`
in the truth-engine repo is an independent/exploratory verification lane that was not
found wired into the 9,218 figure or any production metric packet.

## Metric impact — 002, 003, 009, 016, 018, 032, 034, 053

All eight requested codes are already present in **both** places in the codebase that
gate PBP eligibility:

- `src/lib/pbp-score-state-recovery.ts`: `TASK18B_METRIC_CODES = {"009","018","032","002","003","016"}`
- `src/lib/metric-source-family-policy.ts` (line 131): `PBP_METRICS` includes
  `002,003,004,008,009,010,011,016,018,...,032,033,034,...,053,...`
- `src/lib/bsd-atp-challenger-pbp.server.ts`: `PBP_CODES` includes `016,024,025,033,034,...,053,060` plus `TASK18B_METRIC_CODES`

So all eight were already PBP-eligible before this audit; none needed to be added. Their
evidence treatment when BSD Challenger PBP is available is fixed at
`evidence_treatment: "RECONSTRUCTED_OR_TASK17_PARTIAL_ONLY"` with
`direct_satisfaction_allowed: false` (`bsd-atp-challenger-pbp.server.ts`, packet builder).
**This audit does not raise any of these eight metrics to DIRECT/full-confidence
treatment for Challenger matches, and does not change voting eligibility** — consistent
with the brief's instruction. The only change in evidence *availability* these metrics see
from this audit is zero: the BSD lane was already live for 2025→current, and no new
approved data was added for any other year.

## Persistence architecture (confirmed, not introduced)

- **Truth Engine** (this repo): Supabase, already in production use before this audit
  (`supabase/migrations/*`, `source_observations`, `metric_evidence_store`,
  `source_ingestion_runs`). This audit did not introduce Supabase and made no schema
  changes — there is no dedicated PBP/point-sequence table, and none was added, because
  no new raw payload exists to store.
- **Stats Engine** (`tennis-stats-engine`): plain PostgreSQL via `pg` + Drizzle ORM
  (`lib/db/src/index.ts`), confirmed by grep to contain zero references to Supabase
  anywhere in that repository. See that repo's own audit note
  (`docs/atp-challenger-pbp-audit-notes.md`) for detail.

## Engine access and separation

- **Truth Engine** (this repo) already owns independent Challenger PBP evidence through
  the BSD adapter + `deterministic-pbp-metrics.server.ts`, gated by the fail-closed
  `explicitContext()`/`strictRow()` tour guards and the canonical-identity firewall
  (`pbp-evidence-firewall.ts`) — duplicate players, duplicate matches, and A/B vs B/A
  orientation are already handled there (`canonicalApprovedPbpIdentity`,
  `claimUniqueApprovedPbp`).
- **Statistical Engine / Decision Engine**: no module in either repository in this
  session's scope is formally named "Statistical Engine" or "Decision Engine" in code or
  docs (confirmed by grep across both repos). `tennis-stats-engine` is the closest match
  to "Statistical Engine" by name, and its `predictionEngine/` module is the closest match
  to "Decision Engine" by function, but neither consumes any PBP data today (only
  aggregate results/rankings), and neither repo documents a formal three-engine
  separation. No new cross-repo evidence-sharing integration was built to connect them:
  the two repositories use different databases (Supabase vs. plain Postgres) with no
  existing bridge, and building one was out of scope for a gap-fill/activation audit and
  would risk violating the "do not create duplicate...persistence systems" constraint.
  Recommendation, not applied: if `tennis-stats-engine` is meant to consume Truth Engine
  PBP evidence, that requires a deliberate architecture decision (e.g., an API contract or
  read replica) made by a human maintainer, not inferred here.

## Tests

This session could not execute the TypeScript/Vitest test suite: `bun install` fails in
this sandbox because the repo's `.npmrc`/lockfile point at a private Google Artifact
Registry npm proxy (`*-npm.pkg.dev/lovable-core-prod/...`) that returns HTTP 403 with no
credentials available here, so `node_modules` could not be installed. No test files were
run; none were skipped or disabled. Validation for this audit was done by static code
inspection of the firewall/identity/reconstruction logic listed above
(`pbp-evidence-firewall.ts`, `pbp-score-state-recovery.ts`,
`bsd-atp-challenger-pbp.server.ts`) and by cross-checking the generated JSON/MD audit
artifacts against each other and against the source scripts that produced them. No
runtime code in this repository was modified by this audit, so no regression risk was
introduced.

## Remaining gaps

1. **2023 BSD scan incomplete.** `data/audit/bsd-atp-challenger-pbp-history/queue.json`
   already has `next_year: 2023` queued. Running it requires `BSD_TENNIS_API_KEY` and
   outbound network access to `sports.bzzoiro.com`, neither available in this session.
   Until that scan runs, 2023 status is genuinely unknown — it is not reported here as
   either covered or empty.
2. **2018–2022 has no known PBP source of any kind** (GitHub PBP mirror: no data;
   BSD: not yet checked that far back, and 2024 was already checked and found empty,
   making it likely — not confirmed — that 2018–2022 will also be empty from BSD).
   No fabricated coverage was added for this window.
3. **TennisMyLife-as-identity-anchor policy ambiguity** is flagged above and left
   unresolved by design — a policy call, not a technical one.
4. **Two audit lineages remain separate on disk** (existence-audit vs. BSD production
   scan) rather than merged into one dashboard. They are reconciled here in prose; no new
   merged data artifact was generated, to avoid duplicating the two existing, independently
   trustworthy audit trails per the multi-agent-safety guidance against creating
   duplicate/parallel systems.
