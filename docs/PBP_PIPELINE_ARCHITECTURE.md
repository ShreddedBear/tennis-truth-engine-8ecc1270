# ATP main-tour PBP pipeline: architecture, audit, and boundary design

Companion to `PBP_SOURCE_LICENSE_AUDIT.md`. Nothing in this document authorizes
any production write; it establishes the architecture so a write can eventually
happen safely, deliberately, and only for data that is actually cleared.

## Phase 1 — Preserved overlap-experiment results (corrected)

Commit `9c0ecb6` is preserved as-is; nothing here rewrites it. Correcting the
arithmetic error in this session's own prose summary (not in the data):

| | 2012 ATP_MAIN | 2013 ATP_MAIN |
|---|---:|---:|
| candidates | 2,645 | 2,648 |
| internally validated | 1,318 | 1,525 |
| conflicts | 0 | 0 |
| ambiguous/duplicates | 3 | 5 |
| independently corroborated | 0 | 0 |

**Total internally validated: 1,318 + 1,525 = 2,843** (not "~2,873" as previously
misstated — that was a plain addition error in a chat summary, not a data or
script defect; re-verified directly against the committed JSON files and by
re-running the script, which reproduced identical numbers both times).

## Phase 2 — Independent corroboration source candidates

Investigated via public documentation and web search (direct `WebFetch` to
`api-tennis.com`, `tennis-api.com`, and `developer.sportradar.com` was blocked
by this environment's network egress policy — findings below come from search
result synthesis, not a first-hand read of the actual terms pages, and **must
be re-verified against the real terms/contract before being relied on**).

| Source | Already used here? | PBP claimed? | Historical depth | Commercial terms | Verdict |
|---|---|---|---|---|---|
| **api-tennis.com** (`api.api-tennis.com`) | Yes — primary live provider (`historicalMatchesTable.provider` default) | Not currently wired to any PBP/point endpoint in this codebase; unknown if the API offers one | Unknown (only `get_fixtures`/`get_H2H`/etc. currently called) | General ToS found (account termination for violation, IP-content caveats); redistribution/storage terms not confirmed | **Needs direct account/contract review** — cheapest lead since already paid for |
| **MatchStat / RapidAPI** (`tennis-api-atp-wta-itf.p.rapidapi.com`) | Yes — tier-2 live provider, but only the `upcoming/matches` endpoint is currently called | Vendor's own marketing (matchstat.com) claims "comprehensive point-by-point data...designed for commercial use" | Vendor claims "extensive historical coverage" | Marketing claim only — actual RapidAPI listing terms for the SPECIFIC subscribed plan not confirmed | **Most promising lead** — already integrated infrastructure, needs the actual RapidAPI plan's terms checked in the dashboard |
| **matchstat.com scraper** (`parlayBuilder/matchstatScraper.ts`) | Yes — but scrapes matchstat.com's **public website HTML directly**, not their API | No — aggregate surface win/loss stats only, not match-level or PBP | N/A | Scraping a commercial site's public pages (not their licensed API) is a materially different, less clear posture than using MatchStat via RapidAPI | **Flagged, not a PBP candidate** — out of scope for this task but worth the team's awareness: this is a different risk category from the RapidAPI integration above despite sharing a name |
| **Sportradar Tennis API** | No | Yes — "point-by-point scoring (when available)", official ATP partnership | "4,000+ competitions", depth not confirmed | Enterprise marketplace licensing, commercial terms available but require a sales conversation, not self-serve | Real, credible, but a new vendor relationship and likely real cost — a business decision, not an engineering one |
| **tennis-data.co.uk** | Yes — the original corroborator | No — results/odds only | Full historical archive, 2000→current per its own naming convention | Historically personal/non-commercial-use statements (not re-confirmed this session; site down) | Corroborator only, license unconfirmed, currently unreachable |

None of these were added, subscribed to, or wired into any code this session.
**Recommendation:** check the actual RapidAPI dashboard terms for the existing
MatchStat subscription first (zero new cost, already paid for) before evaluating
a new Sportradar relationship.

## Phase 3 — status taxonomy

Implemented in `scripts/lib/pbp_source_adapter.py`: `SourceAuthorization`,
`LicenseStatus`, `SourceProvenance`, `ValidationState`, `CorroborationState`,
and the derived `ProductionEligibility` — six independent axes on
`PBPRecordEvidence`, never collapsed into one boolean. `PPAULOJR_CURRENT_STATUS`
encodes the exact worked example from the task spec and is covered by 5 unit
tests in `pbp_source_adapter.test.py` (`TestMultiDimensionalStatus`), including
a regression guard that `describe()` can never claim a record is corroborated
when it isn't.

## Phase 4 — Sackmann dependency, traced across both repos

### tennis-truth-engine-8ecc1270

- **Source**: `Aneeshers/tennis-sackmann-archive` (`HIST_BASE` in every
  `verify-sackmann-pbp*.py` script, and now `scripts/lib/pbp_source_adapter.py`).
- **Used for**: match identity (tournament/date/round/surface/winner/score)
  cross-referenced against `ppaulojr` PBP tapes. Confined to
  `scripts/verify-sackmann-pbp*.py`, `scripts/enforce-pbp-global-uniqueness.py`,
  `scripts/pbp-firewall-queue.py`, and now `scripts/atp-pbp-source-overlap.py`
  / `scripts/atp-pbp-parser-quality.py`.
- **Persistence**: writes only to git-committed JSON under `data/audit/` —
  confirmed by grep that no script inserts Sackmann-sourced rows into Supabase
  (`matches`, `source_observations`, `metric_evidence_store`, etc.).
- **One narrow live-app exception found**: `src/lib/evidence-coverage-runtime-diagnostic.server.ts`
  has a `sampling_source: "verified_pbp_index"` code path that reads the local
  `data/audit/verified-pbp*` index files directly at runtime, as one of several
  sample sources for an internal coverage-diagnostic display. This is currently
  inert in practice (0 verified records exist anywhere in that index), but it
  IS a live-app (not offline-script) code path — worth knowing if that index is
  ever populated with license-uncertain data.
- **The actual production historical-match ingestion is NOT Sackmann**:
  `src/lib/ingestion/tour-results-schedule.server.ts` sources ATP/WTA/Challenger
  results directly from official tour sites (`atptour.com`, `wtatennis.com`),
  and `tour-results-schedule.test.ts` has an explicit regression test asserting
  that adapter must **never** reference `JeffSackmann` or `protennislive.com`.
  So: this repo's live match database and Sackmann/Aneeshers data are already
  kept structurally separate; Sackmann only ever enters through the
  PBP-verification scripts, output to git-committed files.
- **Documented restriction**: `docs/ATP_DATA_ATTRIBUTION.md` — "intended only
  for the app's current non-commercial/free use." Pre-existing, not new.

### Tennis-Stats-Engine

- **Sources found** (three separate lineages, all ultimately Jeff Sackmann's
  own CC BY-NC-SA 4.0 data regardless of which mirror serves it):
  1. `sackmannBackfill.ts` — points at `JeffSackmann/tennis_atp`/`tennis_wta`
     directly (currently private/404 per `.agents/memory/sackmann-kaggle-source.md`).
  2. `farhadGithub/tennis-atp-data` — the actual public mirror in active use
     per `.agents/memory/sackmann-mirror-source.md` (ATP main-draw only,
     1968–2024, no Challenger/ITF, no WTA).
  3. A local-ZIP import path (`.agents/memory/sackmann-local-zip-import.md`).
- **Row count**: the most credible, most recent evidence found is a **dated,
  in-code comment** in `artifacts/api-server/src/services/evaluation/calibration.ts`
  (lines 15–24): *"confirmed by DB query on 2026-08-10: sackmann | 100.00%
  (276,677 rows)"*. This supersedes the older `.agents/memory` note's
  "34,229 total sackmann rows" (that note describes one earlier, narrower
  backfill run's own delta, not a current total).
  **I could not run a live query myself — no `DATABASE_URL` is configured in
  this environment.** 276,677 is the best documented evidence available, dated
  2026-08-10 (~5 weeks before this audit); it may be stale if more imports ran
  since. To get the true current count, run in the real environment:
  `SELECT count(*) FROM historical_matches WHERE provider = 'sackmann';`
- **No license documentation exists anywhere in this repo** for this data —
  confirmed by grep (no `THIRD_PARTY_DATA.md`, no attribution doc, no license
  comment in `sackmannBackfill.ts` itself).
- **Reaches commercial production — confirmed, not inferred**:
  `provider = 'sackmann'` rows are NOT walled off. `calibration.ts`'s
  `WINNER_ALWAYS_PLAYER1_PROVIDERS` set explicitly includes `"sackmann"` and
  actively adjusts how these rows are used when **fitting the live calibration
  model**. `walkForward.ts`, `opponentStrength.ts`, and `compositeProvider.ts`
  all reference Sackmann-sourced rows/IDs directly in feature and identity
  logic. No query anywhere excludes `provider = 'sackmann'` (grepped for
  exclusion patterns — none found). This repo has payments infrastructure
  (`paymentsAccountTable`, `paymentWebhookEventsTable`).
- **Exposed through the API/UI**: not directly checked (would require tracing
  every route that serves calibrated probabilities or historical match records
  to the frontend — out of scope for this pass, but given calibration training
  itself uses these rows, any prediction the app serves is at minimum
  indirectly shaped by them).

**This is the same finding as the prior turn, now with harder evidence** (a
dated, specific row count from an actual DB query, not just "no exclusion
found"). It is a pre-existing condition, not something this session
introduced, and fixing it is a business/legal decision outside this task's
authority — flagged, not fixed.

## Phase 5 — Commercial / research data boundary

Proposed explicit boundary (not yet implemented in any schema):

- **RESEARCH_ONLY** data may be used for: validation experiments, methodology
  development (this repo's `data/audit/` outputs, the overlap experiment, the
  parser-quality audit), internal audits, source comparison, Truth Engine
  research. It stays in git-committed JSON / research-only tables, never in
  `historical_matches` or `pbp_evidence` without passing Phase 6 below.
- **COMMERCIAL_ELIGIBLE** data is the only tier allowed into
  `tennis-stats-engine`'s production tables. Today, that requires (a) a
  license that actually permits the intended use, confirmed against real
  terms (not marketing copy), AND (b) passing the existing validation
  pipeline to at least `VERIFIED`.

This is a **data-tagging boundary, not a repo boundary** — tennis-truth-engine
can and does hold non-commercial research data (that's what it's for, per its
own `ATP_DATA_ATTRIBUTION.md`); the boundary that actually matters is at the
door of tennis-stats-engine's commercial tables.

## Phase 6 — Safe PBP data pipeline design

```
PBP source
    |
license/provenance classification  (LicenseStatus, SourceProvenance)
    |
research staging                    (data/audit/*, RESEARCH_ONLY, this repo)
    |
structural validation                (reconstruct_pbp -- already built, this commit)
    |
independent corroboration            (CorroborationState -- blocked today, no source live)
    |
production eligibility check         (PBPRecordEvidence.production_eligibility --
    |                                  BOTH license AND validation must clear)
commercial PBP store                  (tennis-stats-engine pbp_evidence, ONLY
                                       rows where production_eligibility ==
                                       PRODUCTION_ELIGIBLE)
```

A source with `LicenseStatus.LICENSE_UNCERTAIN` or `NONCOMMERCIAL_ONLY` stops
at the "production eligibility check" gate, permanently, until that license
status changes -- it never reaches "commercial PBP store" no matter how well
it validates. It is NOT deleted or hidden from research staging; the whole
point of `PBPRecordEvidence` is to keep saying "this reconstructs correctly
and matches history" out loud, forever, right alongside "and it cannot be
persisted commercially yet."

No code in this commit writes anything into `tennis-stats-engine`'s
`pbp_evidence` table. The `production_eligibility` property exists so that,
whenever this pipeline eventually finds a licensed source, the SAME gate
automatically applies -- nothing about the gate itself needs to change.

## Phase 7 — Derived statistics: the technical distinction (not a legal conclusion)

Two genuinely different operations, both currently possible on the SAME
underlying `pbp_evidence`-shaped data model without new schema:

1. **Storing the raw tape** (`PBPRecord.pbp_tape`, `pbp_evidence.pbpRaw`) —
   this reproduces the source's own expression (its specific point-sequence
   encoding), which is much closer to what "redistribution" typically means.
2. **Storing a derived statistic** (e.g. hold%, break%, comeback-pressure
   value) computed FROM the tape but never persisting the tape itself — this
   stores a number your own code computed, not the source's expression.

**What the sources actually say, as documented, without a legal conclusion
from me:**
- `ppaulojr/tennis_pointbypoint`: no license statement of any kind (see
  `PBP_SOURCE_LICENSE_AUDIT.md`) — silent on both uses.
- `Aneeshers/tennis-sackmann-archive` (CC BY-NC-SA 4.0): explicitly
  non-commercial and requires share-alike redistribution under the same
  license for ANY use, which on a literal reading could extend to derived
  works, not just verbatim copies — this is exactly the kind of question that
  needs actual legal confirmation, not an engineering guess.

**Questions that need legal/licensing confirmation, not further code:**
- Does deriving a numeric statistic from CC BY-NC-SA 4.0 data, without storing
  the source expression itself, still trigger the share-alike/non-commercial
  terms, given the data (a compiled sports database) may itself be protected
  as a compilation independent of the underlying facts?
- Does ppaulojr's silence (no license at all) mean "all rights reserved" for
  both raw storage AND derived statistics, or does it fall under a narrower
  facts-are-not-copyrightable exception for derived numbers specifically?

**Design consequence** (implemented, not just proposed): `PBPRecordEvidence`
tracks `license` at the SOURCE level, but nothing stops a future
`DerivedStatEvidence` type from carrying its OWN separate provenance chain
(source, source record, calculation method, validation state, commercial
eligibility) distinct from the raw tape's. That type is not built yet — no
derived PBP statistics are being computed or stored by anything in this
commit — but the `PBPRecordEvidence` axes are designed so extending to a
parallel `DerivedStatEvidence` requires no changes to the existing model.

## Phase 10 — confirmed untouched

No prediction-logic file was read for editing purposes this session beyond
what Phase 4's Sackmann trace required (read-only `grep`/`Read` of
`calibration.ts`, `walkForward.ts`, `opponentStrength.ts`,
`compositeProvider.ts` — zero edits). Serve/return weights, calibration,
Parlay Builder scoring, and the prediction model itself are unchanged by this
session's second half. (Note: the calibration LEAK FIX from earlier in this
session — removing the Builder's dependency on Prediction Engine calibration —
was a separate, already-completed, already-reported, already-approved task;
it predates and is unrelated to this PBP phase's Phase 10 instruction.)

## Phase 11 — future feature-activation flow (design only, not implemented)

```
PBP  ->  PBP validation (this commit's pipeline)
     ->  PBP-derived point statistics (NOT YET BUILT -- Phase 7's open question
         blocks this for ppaulojr/Sackmann-sourced tapes specifically)
     ->  feature snapshot (match_feature_snapshots -- EXISTING table, unchanged)
     ->  walk-forward cutoff validation (EXISTING, unchanged)
     ->  Prediction Engine (EXISTING, unchanged)
```

The feature-snapshot step already has the right shape for this
(`match_feature_snapshots.sourceTimestamp` / `matchCutoffAt` /
`existedBeforeCutoff` — see `historicalMatches.ts`); a future
`pbpDerivedFeature` write would need to additionally carry:
`sourceRecordId` (which `pbp_evidence` row), `validationStatus` (from
`ValidationState`), and `dataQuality` (e.g. from the parser-quality
diagnostics in this commit) alongside the existing leak-guard fields. No
schema change is made in this commit — this is documented as the target
shape for when a licensed, verified source exists.
