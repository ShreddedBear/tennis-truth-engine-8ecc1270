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

## Addendum — targeted gap-completion determination (per-year)

This addendum resolves the one open question the body of this document left as a policy
judgment call — whether the PBP content behind the 9,218 mappings is *usable*, not just
*hashed* — and gives a strict per-year table. It changes no data and no code; it is a
determination, made against the source-approval evidence already in this repository.

**Is `ppaulojr/tennis_pointbypoint` an approved PBP source? No.** Unlike TennisMyLife
(explicit disabled-pending-reuse-terms entry in `historical-source-policy.ts`), PredixSport
(`THIRD_PARTY_DATA.md`), or Sackmann (`docs/ATP_DATA_ATTRIBUTION.md`), `ppaulojr/tennis_pointbypoint`
has no license/reuse-terms entry anywhere in this repository — it was never put through an
approval process at all. It is referenced only as a hardcoded raw-GitHub URL in
`scripts/verify-challenger-pbp.py` and the exploratory `scripts/verify-sackmann-pbp*.py`
scripts, and the code that reads it discards the fetched tape immediately after hashing
(never writes it to disk). The only certified production PBP source in this repository is
BSD/Bzzoiro (`docs/NEWLY_GREEN_COVERAGE_AUDIT.md`). Therefore: **the PBP content behind the
9,218 mappings cannot be legitimately recovered/used under current source policy** — not
because it is technically inaccessible, but because it has never been approved, and this
audit does not approve it. The 9,218 mappings stay exactly as they are: non-approved
identity/existence mappings. No mapping was modified. **9,218 of 9,218 remain mappings-only.**

**2016–2017 — NO APPROVED SOURCE FOUND.** Confirmed at the code level: even the unapproved
`ppaulojr` mirror returns 0 PBP candidates for these two years
(`data/audit/verified-pbp/atp_challenger/2016/summary.json`,
`.../2017/summary.json`: `"pbp_candidates": 0`). No coverage manufactured.

**2018–2022 — confirmed empty as far as this repository's source inventory can establish.**
`scripts/verify-challenger-pbp.py` hard-excludes this range (`HARD_EXCLUDED = range(2018, 2023)`)
before attempting any source resolution. Repo-wide search confirms no local override file
exists at any of the three paths the pipeline would otherwise check
(`data/raw/pbp/challenger/<year>.csv`, `data/raw/pbp/atp_challenger_<year>.csv`,
`data/public/pbp/challenger/<year>.csv` — none exist for any year), and no
`CHALLENGER_PBP_URL_TEMPLATE` is configured. BSD's own live-API coverage for 2018–2022 has
not been scanned (`data/audit/bsd-atp-challenger-pbp-history/progress.json`:
`next_year: 2023`, walking backward) — that remains unknown rather than confirmed-empty,
but per instruction no download was attempted to resolve it (no credentials available
regardless; see 2023 below). Left empty.

**2023 — unresolved, blocked on missing credentials, not fabricated.** The only approved
PBP source is BSD/Bzzoiro. Its incremental historical scan
(`scripts/advance-bsd-atp-challenger-pbp-history.py`) has 2023 queued as `next_year` but
has not run. Exact blocker, verified this session: `BSD_TENNIS_API_KEY` is not set in this
environment (checked directly, not inferred), so `scripts/bsd-atp-challenger-pbp-history.py`
cannot authenticate to `sports.bzzoiro.com`. Separately, `scripts/verify-challenger-pbp.py`
also fails closed for 2023 with `FileNotFoundError("NO_MODERN_CHALLENGER_PBP_SOURCE_CONFIGURED")`
(no local file, no `CHALLENGER_PBP_URL_TEMPLATE` — also confirmed unset). No unapproved API
was substituted to produce a number. **2023 status: UNKNOWN, blocked on credentials.**

**2024 — preserved.** BSD's own listing already confirmed 0 ATP Challenger matches
returned for 2024 (`data/audit/bsd-atp-challenger-pbp-history/2024/summary.json`). No other
approved source exists to check against. Finding preserved unchanged.

**2025–2026 — untouched.** No modification, duplication, or migration of the certified BSD
lane. Confirmed unchanged by `git status`/`git diff` against this session's starting state.

### Final per-year table

| Year | Raw PBP tapes | Persisted PBP | Approved PBP | Verified PBP | Mappings only | Source | Unresolved gap |
|---:|---|---|---|---|---|---|---|
| 2012 | 0 | 0 | 0 | 0 | 2,274 | ppaulojr (unapproved) | Source never approved |
| 2013 | 0 | 0 | 0 | 0 | 2,897 | ppaulojr (unapproved) | Source never approved |
| 2014 | 0 | 0 | 0 | 0 | 3,329 | ppaulojr (unapproved) | Source never approved |
| 2015 | 0 | 0 | 0 | 0 | 718 | ppaulojr (unapproved) | Source never approved |
| 2016 | 0 | 0 | 0 | 0 | 0 | none | NO APPROVED SOURCE FOUND |
| 2017 | 0 | 0 | 0 | 0 | 0 | none | NO APPROVED SOURCE FOUND |
| 2018 | 0 | 0 | 0 | 0 | 0 | none | Confirmed empty (repo inventory); BSD unscanned |
| 2019 | 0 | 0 | 0 | 0 | 0 | none | Confirmed empty (repo inventory); BSD unscanned |
| 2020 | 0 | 0 | 0 | 0 | 0 | none | Confirmed empty (repo inventory); BSD unscanned |
| 2021 | 0 | 0 | 0 | 0 | 0 | none | Confirmed empty (repo inventory); BSD unscanned |
| 2022 | 0 | 0 | 0 | 0 | 0 | none | Confirmed empty (repo inventory); BSD unscanned |
| 2023 | 0 | 0 | 0 | 0 | 0 | none | **UNKNOWN — blocked on missing `BSD_TENNIS_API_KEY`** |
| 2024 | 0 | 0 | 0 | 0 | 0 | BSD (checked, empty) | None — confirmed empty |
| 2025 | 0 (live, not persisted) | 0 (by design — in-memory only) | 1,436 | 1,436 | 0 | BSD/Bzzoiro (certified) | None |
| 2026 | 0 (live, not persisted) | 0 (by design — in-memory only) | 304 | 304 | 0 | BSD/Bzzoiro (certified) | None |

**TOTAL VERIFIED APPROVED ATP CHALLENGER PBP: 1,740** (2025: 1,436 + 2026: 304). Mappings
are excluded from this total by design.

**9,218 of 9,218 existing mappings remain mappings-only** — none were promoted, none were
demoted, none were modified.

Completion status: **not complete**. One credential-blocked year (2023) remains genuinely
unresolved; this is reported, not concealed.

## Addendum 2 — re-audit: an approved Sackmann PBP corpus exists, unused, for ATP Challenger

**This corrects a gap in Addendum 1.** That addendum treated `ppaulojr/tennis_pointbypoint` as
the only PBP-tape source ever consulted for the 9,218 mappings, and concluded 2016–2022 had "no
approved source." That remains true of the pipelines already wired into this repo. It was never
true of Jeff Sackmann's own ecosystem as a whole — this repo's `verify-sackmann-pbp*.py` scripts
are misleadingly named: they use Sackmann's `tennis_atp`/`tennis_wta` **only for match-result
identity** (via `Aneeshers/tennis-sackmann-archive`, already relied on elsewhere in this
codebase) and still pull the **PBP tape itself from `ppaulojr`**
(`verify-sackmann-pbp-v4.py` line 12: `PBP_BASE='https://raw.githubusercontent.com/ppaulojr/tennis_pointbypoint/master'`),
and are scoped to ATP/WTA Main only (`MAIN_LEVELS={'G','M','A','F'}` — no `'C'`). **No script in
this repository has ever queried Jeff Sackmann's real point-by-point dataset for Challenger
matches.**

No repository named `JeffSackmann/tennis_pointbypoint` exists (confirmed this session: direct
fetch returns HTTP 404; a GitHub repository search for that name, and for `user:JeffSackmann`
generally, returns zero and one result respectively). Jeff Sackmann/Tennis Abstract publishes
exactly one repository with real shot-by-shot point sequences beyond the four Grand Slams:
**`JeffSackmann/tennis_MatchChartingProject`** ("MCP") — confirmed by directly cloning and
inspecting it this session, not by memory or inference.

**1. Does MCP contain ATP Challenger PBP?** Yes. Challenger-level tournaments are encoded with a
`_CH` suffix on the tournament name inside `charting-m-matches.csv`'s `match_id` (e.g.
`20140613-M-Nottingham_CH-SF-Nick_Kyrgios-Miloslav_Mecir_Jr`), not the literal word "Challenger"
— a plain-text search for "challenger" (the method used earlier in this audit) returns zero and
misses this entirely. Corresponding point rows were confirmed present and non-trivial (63–179
real points per match) in `charting-m-points-2010s.csv` for every match checked.

**2. Which years?** 407 men's ATP Challenger (`_CH`) matches total, spanning 2013–2026 (0 in
2012): 2013: 1 · 2014: 20 · 2015: 30 · 2016: 27 · 2017: 25 · 2018: 17 · 2019: 85 · 2020: 18 ·
2021: 29 · 2022: 38 · 2023: 8 · 2024: 76 · 2025: 27 · 2026: 6. (Women's equivalent tier uses an
`ITF_` prefix, not `_CH` — out of scope here per this mission's ATP-Challenger-only mandate.)

**3. Which matches?** All 51 in the 2012–2015 window were extracted and spot-checked (list kept
in this session's ephemeral scratch space, not committed). They span tournaments including
Lexington, Nottingham, Mons, Knoxville, Sacramento, and Prague, with players who were
Challenger-level at the time — including several now-familiar tour names (Kyrgios, Zverev,
Goffin, Donaldson, Lorenzi).

**4. Overlap with the 9,218 mappings?** Cross-referenced by exact match date
(`exact_match_date`) plus normalized winner/loser name against `verified-mappings.json` for
2013–2015 (6,944 mapping rows checked). **12 of the 51 MCP 2012–2015 Challenger matches match an
existing mapping identity exactly** — e.g. `20141003-M-Mons_CH-QF-Alexander_Zverev-David_Goffin`
matches the existing Mons/2014-10-03/Goffin–Zverev mapping. This is a conservative,
exact-string-match count; the codebase's own canonical-identity firewall
(`canonicalApprovedPbpIdentity`) does fuzzier normalization than this session's ad hoc check and
would plausibly find a few more among the remaining 39. No mapping was modified to establish
this — the check was read-only.

**5. Can overlapping matches be canonically matched using existing mapping identities?** Yes —
the same date + winner + loser identity fields already present in each mapping's `historical`
block are sufficient; this is exactly the identity contract the existing firewall code already
implements for other sources.

**6. Is Sackmann/MCP license/provenance sufficient under current project source policy?**
Materially stronger than either existing PBP input. MCP publishes an explicit, unambiguous
license — CC BY-NC-SA 4.0 (Attribution, NonCommercial, ShareAlike) — the same license category
this repository already accepts for `tennis_atp` under `docs/ATP_DATA_ATTRIBUTION.md` ("intended
only for the app's current non-commercial/free use... do not use in a commercial or monetized
version without... appropriate permission"). By that same already-applied standard, MCP is
usable under the identical condition. This is not automatic clearance: MCP has never been
individually attributed in this repo (only `tennis_atp`/`tennis_wta` are named in
`ATP_DATA_ATTRIBUTION.md`), so treating it as approved requires adding it to that attribution
document under the same terms — a documentation action, not a policy change, since no new
license category or exception is being introduced. **This audit does not make that addition
itself** (no production writes were requested or made this turn); it is a recommendation for a
maintainer to ratify, not a fait accompli.

**7. Can approved Sackmann PBP be ingested without using ppaulojr as the content source?** Yes —
MCP is a fully self-contained CSV corpus (`charting-m-matches.csv` + `charting-m-points-*.csv`),
with no dependency on `ppaulojr` or any other source.

**8. Can the 9,218 mappings be used only as identity aids while the PBP comes from
Sackmann/MCP?** Yes, for the 12 confirmed-overlapping matches: their existing `historical` block
(date, tournament, round, winner, loser) already is the identity aid; only the `pbp_ref`
(currently pointing at the unapproved ppaulojr tape) would need to point at the MCP tape instead
— the mapping row's identity fields need not change. For the 39 non-overlapping 2012–2015 MCP
matches and all 356 matches from 2016–2026, MCP's own match index already carries sufficient
identity (date/tournament/round/players) independent of the 9,218 mappings entirely.

**9. How much 2012–2015 Challenger PBP can actually be recovered from this newly-identified
source?** 51 real matches with genuine point sequences (2012: 0, 2013: 1, 2014: 20, 2015: 30) —
small next to 9,218, but for the first time in this audit, **real, licensed, non-fabricated** PBP
content, not just a hash of a tape from an unapproved mirror. 12 of the 51 resolve an existing
mapping's identity; the remaining 39 stand on their own.

**10. Additional Challenger PBP years beyond 2015?** Yes — 356 more MCP Challenger matches
across 2016–2026 (table in point 2 above). **This revises Addendum 1's 2016–2022 conclusion**:
those years are not sourceless — MCP has sparse but real coverage for every one of them (2016:
27, 2017: 25, 2018: 17, 2019: 85, 2020: 18, 2021: 29, 2022: 38). Addendum 1's "NO APPROVED SOURCE
FOUND" / "hard-excluded, no source ever existed" language described this repo's two existing
pipelines accurately; it should not be read as "no source exists anywhere," which was not fully
verified until this pass. 2023 also gains 8 MCP matches, 2024 gains 76 (both previously reported
as fully empty from the BSD/legacy-pipeline perspective) — this neither touches nor contradicts
the BSD findings for those years (BSD is a live-match-listing check; MCP is a disjoint,
volunteer-charted corpus); it adds an independent, additional, much smaller pool.

### What this does and does not change

No file under `data/audit/verified-pbp/`, no `historical-source-policy.ts`, no BSD adapter, no
Supabase table, and no metric code was touched this turn, per explicit instruction. The 9,218
mappings are unchanged and remain non-approved identity mappings. The certified 2025–2026 BSD
lane is unchanged, not duplicated, not migrated (confirmed by `git status`/`git diff` before and
after this addendum). **Total verified approved ATP Challenger PBP remains 1,740** (BSD
2025+2026 only) until a maintainer ratifies MCP's attribution and someone builds the
(straightforward, but not-yet-built) ingestion path described in points 7–8. This addendum's
contribution is solely to the source inventory: a previously-unexamined, better-licensed PBP
corpus exists and has a credible path to legitimately recovering a modest amount of 2012–2026
Challenger coverage without ppaulojr, without a new paid API, and without touching TennisMyLife,
BSD, or Supabase.

## Addendum 3 — the requested "JeffSackmann/tennis_pointbypoint" does not exist

**Direct answer to the final question asked this pass: zero.** "How many additional verified
ATP Challenger main-draw PBP matches can we legitimately recover from Jeff Sackmann's
`tennis_pointbypoint` repository beyond the 407 MCP matches?" **Zero — for two independent,
each-sufficient reasons**, both verified firsthand this session (not inferred, not assumed):

**Reason 1: that repository does not exist.** `https://github.com/JeffSackmann/tennis_pointbypoint`
returns HTTP 404 from both a direct fetch and the GitHub REST API
(`api.github.com/repos/JeffSackmann/tennis_pointbypoint`), checked twice. Jeff Sackmann's only
GitHub repositories relevant here are `tennis_atp`, `tennis_wta`, `tennis_slam_pointbypoint`, and
`tennis_MatchChartingProject` (the 407-match MCP corpus already reported in Addendum 2). There is
no fifth repository under that account with the requested name.

**Reason 2: the repository that actually has those four filenames is not Jeff Sackmann's, and
is the same source already fully consumed.** `pbp_matches_ch_main_archive.csv` /
`pbp_matches_ch_main_current.csv` (and the `_qual_` variants) live at
`ppaulojr/tennis_pointbypoint` — confirmed via `api.github.com/repos/ppaulojr/tennis_pointbypoint`:
**`"license": null`, `"is_fork": false`, `"parent": null`**, owner `ppaulojr`, created and pushed
once on 2015-04-18 and never updated since. Its own README (cloned and read directly, not
excerpted secondhand) is written in the first person by "ppaulojr" describing a personal,
imperfect scrape ("I've done what I can... probably imperfect parser... surely many errors
remaining... probably also some duplicate matches") of unspecified upstream source data. It does
not mention Jeff Sackmann anywhere. **This is the exact same unlicensed, unaffiliated source
already identified and correctly excluded in the original audit and in Addendum 1** — the user's
premise that it is Jeff Sackmann's authoritative repository is incorrect, and this audit does not
adopt it. Per the instruction not to silently combine ppaulojr and Jeff Sackmann data: they are
not combined here, and the finding is that they were never the same thing to begin with.

### File-level audit of `ppaulojr/tennis_pointbypoint`'s CH files (performed as requested)

Freshly cloned and parsed directly from GitHub this session (not from this repo's cached
scripts), for full independence from the existing pipeline's own accounting:

| Metric | `pbp_matches_ch_main_archive.csv` | `pbp_matches_ch_main_current.csv` | Combined |
|---|---:|---:|---:|
| Rows | 15,515 | 990 | 16,505 |
| `tour` value | 100% `CH` | 100% `CH` | 100% `CH` |
| `draw` value | 100% `Main` | 100% `Main` | 100% `Main` |

- **Year range**: 2010–2015 only (2010: 1 · 2011: 1,353 · 2012: 4,711 · 2013: 5,097 · 2014:
  4,353 · 2015: 990). Nothing from 2016 onward — matches the README's own claim
  ("`_current` files contain 2015 matches, `_archive` ... most ... from 2012-14").
- **Matches per tournament**: 526 distinct tournament-name strings (unnormalized; the same
  event appears under several spellings across years, e.g. `ATPChallengerTourSaoPaulo` vs.
  `ATPChallengerTour-SaoPaulo`). Top by row count: São Paulo (186), Astana (120), Braunschweig
  (116), San Benedetto (109), Milan (104).
- **Matches per surface**: not derivable from this file — it has no surface column
  (`date,tny_name,tour,draw,server1,server2,winner,pbp,score,adf_flag` only). Surface is only
  knowable after joining to a result source (TennisMyLife, as the existing pipeline already
  does), so no per-surface number is reported here rather than fabricating one.
- **Duplicate count**: 101 exact-content duplicate groups (same `pbp` string), 203 rows
  involved; separately, 111 duplicate groups by (date, both player names, tournament), 223 rows
  — these overlap substantially but are not computed on the same key, so are reported separately
  rather than merged into one number.
- **Malformed PBP count**: 0. Every one of the 16,505 `pbp` strings uses only the documented
  charset (`S R A D . ; /`) — the file is internally well-formed at the character level.
- **Valid PBP count**: 16,505 of 16,505 (100%) pass the charset check above. (This is a
  structural-syntax check only, not proof of correctness against a real match — that is what the
  existing firewall's independent-result-verification step is for, see below.)
- **Retirement/excluded count**: 0 — confirmed by the absence of any `RET`/`W/O`/`DEF` marker in
  the `score` field, consistent with the README's own statement that retirements were excluded
  by ppaulojr before publishing.
- **Player identity completeness**: 16,503 of 16,505 rows (99.99%) have both `server1` and
  `server2` populated; 2 rows are missing one or both names.
- **Date completeness**: 16,505 of 16,505 (100%) — every date parses cleanly (`DD Mon YY`
  format).
- **Winner completeness**: 16,505 of 16,505 (100%) — every row's `winner` field is `1` or `2`.

### Comparison against the three existing pools

**1. Against the existing 9,218 identity mappings — this file already produced all of them.**
Every one of the 9,218 mappings' `pbp_ref.pbp_sha256` values (9,218 of 9,218, 100%) was found
among the SHA-256 hashes of the `pbp` field in this freshly-cloned copy of the file — an exact,
byte-level match, not an inference. **Exact overlap: 9,218 of 9,218. Exact new matches: 0.**
7,185 additional rows exist in the raw file that were never promoted into a mapping — these are
not new legitimate coverage; they are the leftover candidates from the same already-run firewall
process (rows with no matching TennisMyLife result, ambiguous matches, or rows that lost a
uniqueness/duplicate check) from the same unlicensed source, carrying the same licensing
blocker as the 9,218 already do.

**2. Against the 407 MCP matches — small, informative overlap, no new licensed coverage.** Of
the 51 MCP Challenger matches in the 2012–2015 window, 15 also appear as a raw row in this
ppaulojr file (matched by date + both player names). Of those 15, 12 were already promoted into
the existing 9,218 mappings (per Addendum 2's identity check); the other 3 exist as a raw
ppaulojr candidate row but were not promoted (a data-quality gap in the already-run pipeline, not
a new-source opportunity). All 356 MCP matches from 2016–2026 fall entirely outside this file's
2010–2015 date range, so overlap there is 0 by construction.

**3. Against the 1,740 certified BSD/Bzzoiro matches — zero overlap by construction.** BSD's
confirmed coverage starts 2025-01-12; this file ends in 2015. No shared date range exists.

**Possible canonical matches / unresolved identities**: the 7,185 unconsumed ppaulojr rows could
in principle yield a handful more confirmed identities under a more thorough re-match against
TennisMyLife (or another approved result source) — but this session did not attempt that
re-match (it would not change the underlying licensing conclusion, and no production writes were
requested), so no number is claimed for it. The 101/203 duplicate-content rows and 111/223
duplicate-key rows are additional identity-resolution risk within the file itself.

**Duplicate PBP tapes**: confirmed by direct inspection — e.g. two identical rows for
`Joao Sousa vs Juan Pablo Brzezicki, ATPChallenger-SaoPaulo2010, 05 Jan 11` share the same
`pbp` string verbatim. These are duplicate rows in ppaulojr's own file, not duplicates introduced
by this repo's pipeline.

### What this does and does not change

No production writes were made. `data/audit/verified-pbp/`, `historical-source-policy.ts`, the
BSD adapter, Supabase, and metric files remain untouched (confirmed by `git status`/`git diff`
before and after this addendum). The 9,218 mappings, the 407 MCP finding, and the 1,740
certified BSD total are all unchanged. **This addendum's only contribution is to close off a
line of inquiry**: the URL given this turn does not point at a real, licensed, previously-unused
Sackmann corpus — it points at the same unlicensed file this repository already fully mined. The
only legitimate expansion path already identified remains Addendum 2's MCP corpus (407 matches,
51 of them 2012–2015, 12 of those already identity-matched to the existing 9,218).

## Addendum 4 — second expansion audit: Source 1 reconfirmed, "Live Tennis API" not found

**Source 1 (JeffSackmann/tennis_pointbypoint) — reconfirmed nonexistent, three independent
ways this pass**, in response to a report of "conflicting evidence": (1) a direct fetch of
`api.github.com/repos/JeffSackmann/tennis_pointbypoint` returned HTTP 403 this time rather than
404 — this is almost certainly unauthenticated GitHub API rate-limiting noise on the fetch path,
not a signal that the repository exists (a 403 on a private repo and a rate-limit 403 are
indistinguishable from an unauthenticated caller, so it is not treated as evidence either way);
(2) the GitHub search API, queried authenticated via this session's GitHub App integration with
`repo:JeffSackmann/tennis_pointbypoint`, returned: *"The listed users and repositories cannot be
searched either because the resources do not exist or you do not have permission to view them"*
— GitHub's own authenticated API explicitly rejecting the path; (3) `user:JeffSackmann` search
still returns exactly one repository, `tennis_MatchChartingProject` (the MCP corpus already
counted in Addendum 2). A direct anonymous git clone attempt also still fails the same way as in
Addendum 3 (falls through to requiring credentials, the proxy's behavior for a target that
doesn't resolve). **Conclusion unchanged from Addendum 3: this repository does not exist. Answer
remains 0.** Per source policy for this pass, `ppaulojr/tennis_pointbypoint` (the real repository
holding those four filenames, already fully audited in Addendum 3) is not treated as an approved
source and was not re-ingested or re-counted here.

**Source 2 ("Live Tennis API") — no service by that name found in either repository.** A broad,
repeated search (case-insensitive, across code, docs, memory files, and every `*_API_KEY`-style
env var name referenced in both repos) found no service literally named "Live Tennis API" in
`tennis-truth-engine-8ecc1270` or `tennis-stats-engine`. Two candidates were checked because they
are the closest real matches to that description:

1. **`api-tennis.com` ("API-Tennis"), `API_TENNIS_KEY`** — the actual live tennis data API
   integrated in `tennis-stats-engine` (`artifacts/api-server/src/services/tennisData/apiTennisProvider.ts`),
   already approved and in production use there for fixtures, H2H, standings, and live scores
   (not PBP). Checked directly in the source code (`get_fixtures`, `get_H2H`, `get_standings`,
   `get_players`, `get_tournaments` — no `get_pointbypoint`-style method exists) and against a
   dedicated memory note (`.agents/memory/api-tennis-provider.md`): **"No point-level serve/return
   stats exist from this provider — any serve/return or style-matchup module must be a proxy
   derived from set/game score margins."** This is a direct, in-repo, previously-recorded
   statement that this provider has zero point-by-point capability, for any tour or level — not
   just Challenger. `API_TENNIS_KEY` is not set in this session, so no live call could be made to
   double-check that finding, and `api-tennis.com`'s own public documentation is unreachable from
   this sandbox (blocked by the network egress proxy at the domain level) — both limits are
   reported rather than worked around. Based on the evidence that is available (source code plus
   a note written from direct prior testing against the live API), this provider does not offer
   the Challenger PBP coverage described in this pass's brief.
2. **ProTennisLive, `PROTENNISLIVE_API_KEY`** (found in `tennis-truth-engine-8ecc1270`) — not a
   PBP source at all (rankings/results only), and not currently approved: two regression tests
   (`src/lib/ingestion/tour-results-schedule.test.ts`, `src/lib/github-oidc-ingestion-bridge.test.ts`)
   explicitly assert the current results/schedule adapter does **not** contain
   `PROTENNISLIVE_API_KEY` or `api.protennislive.com`, and `docs/historical-hard-pull-source-inventory.md`
   describes it as a later, non-required addition. This is a previously-removed/rejected source
   actively guarded against reintroduction, not an approved one.

**Neither candidate matches this pass's description** (Challenger PBP from January 2023 onward,
under an already-approved account). No number is fabricated for either. If a specific product
name, domain, or account is meant that isn't one of the two checked here, naming it precisely
would let this audit check it directly rather than guessing further.

**Source 3 (MCP)** — unchanged, treated strictly as the existing 407-match baseline. Not
re-counted, not duplicated, not modified.

### Source-by-source table

| Source | Years | Raw PBP matches | Valid matches | Overlap w/ 407 | Overlap w/ 9,218 | Overlap w/ BSD (1,740) | New legitimate matches | License/access status | Ingest? |
|---|---|---:|---:|---:|---:|---:|---:|---|---|
| `JeffSackmann/tennis_pointbypoint` | — | — | — | — | — | — | 0 | Does not exist (confirmed 3 ways) | NO |
| `ppaulojr/tennis_pointbypoint` (for reference only — same file re-verified in Addendum 3) | 2010–2015 | 16,505 | 16,505 (charset-valid) | 15 | 9,218 (100% — this file is their source) | 0 | 0 | No license (`license: null`), unaffiliated, explicitly excluded by this pass's source policy | NO |
| "Live Tennis API" (as named) | — | — | — | — | — | — | 0 | Not found under that name in either repo | N/A |
| `api-tennis.com` / API-Tennis (`API_TENNIS_KEY`) | N/A | 0 | 0 | 0 | 0 | 0 | 0 | Approved & active for non-PBP data; confirmed no PBP capability in code + memory note; key not present this session; provider docs unreachable (egress-blocked) | NO (no PBP product) |
| ProTennisLive (`PROTENNISLIVE_API_KEY`) | N/A | 0 | 0 | 0 | 0 | 0 | 0 | Previously removed; actively blocked from reintroduction by tests; not PBP | NO |
| MCP (baseline) | 2013–2026 | 407 | 407 | — (is the 407) | 12 (of 51 in 2012–2015) | 0 | 0 (already counted) | CC BY-NC-SA 4.0, same category already accepted for `tennis_atp` | Baseline, unchanged |

### Answer

**What is the maximum legitimate ATP Challenger PBP coverage we can add beyond the 407 MCP
matches, using sources we are actually authorized to use, verified this session?**

**Zero**, from every source checked in this pass. The requested Jeff Sackmann repository does
not exist; the file that does exist under similar names is the same unlicensed, already-exhausted
source excluded by this pass's own policy; and no "Live Tennis API" with Challenger PBP from
2023 could be located in either repository — the two closest real candidates are either
demonstrably PBP-incapable (API-Tennis) or not currently approved and actively blocked
(ProTennisLive). **The 407 MCP matches remain the only legitimate expansion identified across
all audit passes.** No production writes were made this turn (confirmed by `git status`/`git
diff`); this is audit-only, as requested. If there is a specific "Live Tennis API"
account/domain/product this project already holds that wasn't surfaced by this search, naming it
would let this be checked directly rather than left as a negative result.

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
