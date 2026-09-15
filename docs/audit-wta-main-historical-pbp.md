# WTA Main-tour historical point-by-point completion — audit + fix + fill

Scope: **WTA Main Tour only** (not ATP, not ATP/WTA Challenger, not WTA 125, not WTA
ITF), 2012–current, real point-level data only. See
docs/WTA_MAIN_HISTORICAL_PBP_ATTRIBUTION.md for the license status of the two new
sources this fill uses — **read that before any commercial/monetized use.**

## BEFORE

- **0** persisted raw WTA Main PBP tapes. **0** POINT_BY_POINT observations reachable
  by any engine for WTA Main.
- A legacy attempt existed (`data/audit/verified-pbp/wta_main/2012/`) but every one
  of its 538 candidate matches was `RETRIEVAL_FAILED` (0.0% coverage) — its
  independent-verification step called `tennis-data.co.uk` live and that domain is
  unreachable from this environment (confirmed directly: `curl` to it returns
  `403`/`CONNECT tunnel failed`; the same failure is baked into the stored
  `verified-pbp-v4/atp_main/2012/summary.json` from a prior ATP-only run of the
  newer v4 script, which independently hit the identical `URLError` on every
  `tennis-data.co.uk` candidate URL).
- The live path (`src/lib/bsd-wta-main-pbp.server.ts`, BSD/Bzzoiro) only covers
  **2024-12-02 onward**, fetched per-query, and is **never persisted to disk or
  Supabase** — a single BSD outage or a missing `BSD_TENNIS_API_KEY` means zero WTA
  Main PBP evidence for any match, with no historical record to fall back on.
- No PBP table exists in Supabase/Postgres for any tour (confirmed: 22 migration
  files inspected, none define one). `SUPABASE_SERVICE_ROLE_KEY` is unset in this
  environment, so there is no live path to Supabase from here regardless — the
  actual, currently-working persistence pattern for PBP in this repo is flat
  JSONL/JSON under `data/`, which is what this fill also uses (WTA Challenger's
  `data/metrics/pbp/wta_challenger/approved-index.jsonl` is the precedent).

## ROOT CAUSE (why WTA Main PBP was stuck at 0% despite code existing for it)

Two independent, compounding bugs in the pre-existing pipeline, found by direct
inspection — not assumptions:

1. **`MAIN_LEVELS={'G','M','A','F'}` in `scripts/verify-sackmann-pbp-v4.py` is an
   ATP-shaped level set applied to WTA too.** WTA's real `tourney_level` codes
   (confirmed against `Aneeshers/tennis-sackmann-archive/wta/wta_matches_2012.csv`)
   are `G`=Grand Slam(508), `PM`=Premier Mandatory(312), `P`=Premier(634),
   `I`=International(923), `F`=Finals(30), `D`=Fed Cup(378, team), `O`=Olympics(64).
   Reusing ATP's set kept only `G`+`F` (538 of 2,849 individual-event matches) —
   silently dropping essentially the entire WTA regular season before PBP matching
   even started.
2. **The independent-verification step live-fetches `tennis-data.co.uk` on every
   run**, and that domain is unreachable from this sandbox. This blocks 100% of
   `RESULT_VERIFIED_PBP` classification (`ACCESS_LIMITATION`) regardless of whether
   real PBP candidates exist. The real point-level source itself
   (`ppaulojr/tennis_pointbypoint`, the WTA `PBP_BASE` this pipeline already
   pointed at) was **never actually broken** — confirmed reachable and genuinely
   contains real per-point S/R/A/D sequences, not just match results.

Fix: `scripts/verify-sackmann-wta-main-pbp.py` (new) uses WTA-correct level codes
(`{G,PM,P,I,F}` — Fed Cup/Olympics deliberately excluded as out of "main tour
individual match" scope, not a data gap) and reads the **already-committed local
sync** `data/public/tennis-data-wta/wta_matches_2007_2016.csv` (produced by
`.github/workflows/sync-tennis-data-wta.yml`, which genuinely reached
`tennis-data.co.uk` from a GitHub Actions runner) instead of live-fetching — no
network dependency for the years that matter (2011–2015, where the real PBP source
has data).

## Sources actually inspected (Phase 4)

`Aneeshers/tennis-sackmann-archive` (the archive Phase 4 named) contains **no WTA
main-tour point-by-point data outside the four Grand Slams** — its `wta/` folder is
match-results/rankings CSVs only (confirmed by directly listing and grepping it).
Real point-level data exists in two places:

- `Aneeshers/tennis-sackmann-archive/slam_pointbypoint/` — a mirror of Jeff
  Sackmann's `tennis_slam_pointbypoint`, Grand Slams only, 2011–2024 with real gaps
  (2020 Wimbledon cancelled; 2022–2024 has no Australian Open/Roland Garros files in
  this mirror; 2016 Wimbledon's women's singles file exists but contains zero
  women's rows — confirmed by direct inspection, a genuine upstream gap, not a
  filter bug).
- `ppaulojr/tennis_pointbypoint` — a **different, previously-unverified-by-this-repo
  repository** the pre-existing pipeline code already pointed at (`PBP_BASE`), a
  real point-by-point archive (S/R/A/D per-point grammar) covering non-Slam
  **and** Slam WTA Main matches, but only 2010–2015 (`_archive` + `_current` files).
  No LICENSE file at all — see attribution doc.

Non-Slam coverage (2011–2015) is sourced from `ppaulojr` and cross-verified against
an independent result record. Grand Slam coverage 2016–2024 (years `ppaulojr` does
not reach) is sourced from the Aneeshers slam archive. **These two lanes never
overlap by construction** (the Slam script is hard-restricted to years ≥2016), so no
de-duplication logic was needed to keep them from double-counting the same match —
confirmed zero `pbp_sha256` collisions when merged.

`TennisMyLife` and `BSD/Bzzoiro` were **not used** as a historical source, per
instruction — BSD remains live-only (2024-12-02+), never persisted by this work.

## ADDED

**7,165 real, structurally-validated WTA Main matches**, 0 → 7,165, across two
distinct trust tiers that are reported separately, never combined into one
undifferentiated "coverage %":

| Trust tier | Meaning | Count |
|---|---|---|
| `LEVEL_1_RESULT_VERIFIED_PBP` | Non-Slam 2011–2015. PBP candidate cross-verified against **two independent sources** (Aneeshers canonical result record + local Tennis-Data.co.uk sync) that must independently agree on player pair, exact date, score and tournament, *plus* the PBP string must structurally replay (legal games/sets/tiebreaks) to the same score and winner. Duplicate-protected (no historical match or PBP candidate reused). | 4,174 |
| `LEVEL_2_SINGLE_SOURCE_STRUCTURALLY_VALIDATED` | Grand Slam 2016–2024. Single-sourced (no independent second result record for these years) but the discrete point-by-point rows are replayed through the same legal-game/legal-set logic and must match the canonical Grand Slam result exactly; Slam draws are single-elimination, so player-pair+tournament+round already disambiguates uniquely without needing date-based cross-verification. Genuinely a lower trust tier, reported as such. | 2,991 |

### By year

| Year | Lane | Candidates examined | Verified | Rejected/quarantined (review-required + ambiguous + conflicts + no-hist-match + unusable) |
|---|---|---|---|---|
| 2011 | Non-Slam | 1,433 PBP rows / 2,467 hist matches | 156 | 2,467−156 rejected/no-PBP (low PBP-source coverage for this year) |
| 2012 | Non-Slam | 2,517 / 2,407 | 1,124 | 423 review/ambiguous/conflict |
| 2013 | Non-Slam | 2,636 / 2,442 | 1,261 | 580 |
| 2014 | Non-Slam | 2,515 / 2,476 | 1,258 | 627 |
| 2015 | Non-Slam | 833 / 2,506 | 375 | 302 |
| 2016 | Slam | 288 listed | 243 | 45 |
| 2017 | Slam | 451 listed | 369 | 82 |
| 2018 | Slam | 472 listed | 419 | 53 |
| 2019 | Slam | 505 listed | 452 | 53 |
| 2020 | Slam | 378 listed | 334 | 43 |
| 2021 | Slam | 507 listed | 462 | 43 |
| 2022 | Slam | 253 listed | 236 | 17 |
| 2023 | Slam | 253 listed | 240 | 13 |
| 2024 | Slam | 253 listed | 236 | 17 |

Full per-year breakdown (verified / review_required / ambiguous / conflicts /
no_pbp for the non-Slam lane; verified / no_hist_match / pbp_unusable for the Slam
lane) is preserved in `data/audit/verified-pbp-v4/wta_main/<year>/summary.json` and
`data/audit/verified-pbp-v4/wta_main_slam/<year>/<slam>/summary.json` — nothing was
discarded, every rejection has a named, machine-readable reason in that year's
`records.json`.

### By tournament tier / surface

- Grand Slam: 3,918 · Premier: 1,190 · International: 1,474 · Premier Mandatory:
  580 · Finals: 3 (small — Finals is an 8-player round-robin event; correct, not a
  bug).
- Hard: 4,307 · Clay: 1,545 · Grass: 1,313.

### By source / approval

- `SACKMANN_ARCHIVE_PPAULOJR` (raw tape, non-Slam): 4,174, all
  `APPROVED_WTA_MAIN_PBP`.
- `SACKMANN_SLAM_ARCHIVE` (raw tape, Slam): 2,991, all `APPROVED_WTA_MAIN_PBP`.
- **0 rows are a mapping/reference without raw PBP** — every approved row carries
  the actual replayed per-point game sequence
  (`data/metrics/pbp/wta_main/approved-index.jsonl`, consumed directly by
  `reconstructPbpScoreState()`), not merely an index pointer. This is a materially
  different (stronger) evidence shape than WTA Challenger's existing
  `approved-index.jsonl`, which stores aggregate-only fields
  (`task18b_raw_fields_available:false`) — WTA Main's new index has full
  server/point-winner chronology.
- Quarantined/rejected, non-Slam: 2,104 `REVIEW_REQUIRED` (PBP candidate matched by
  player+score+tournament but no exactly-one independent-source match), 138
  `AMBIGUOUS_MATCH`, 331 `PBP_CONFLICT`/`PBP_UNUSABLE` (structural or score
  mismatch — never forced through). Quarantined/rejected, Slam: 366
  `NO_HIST_MATCH` (name-matching or hist-lookup failed), 90 `PBP_UNUSABLE`
  (illegal game/set replay). None of these were force-approved.

## PERSISTENCE

Flat JSONL, same architecture as the existing WTA Challenger PBP evidence (no
Supabase PBP table exists to write to, and none was added):

- `data/metrics/pbp/wta_main/approved-index.jsonl` — the single consumable
  evidence artifact (7,165 rows, 65 MB), one JSON object per match with full
  per-point game sequence, canonical identity fields, source, trust tier,
  `pbp_sha256`.
- `data/audit/verified-pbp-v4/wta_main/<year>/{summary,verified-mappings,records}.json`
  and `data/audit/verified-pbp-v4/wta_main_slam/<year>/<slam>/{...}.json` — the
  audit trail (identity/provenance only; the bulky per-point game data was
  deliberately stripped from here once folded into `approved-index.jsonl`, so the
  point data exists exactly once on disk, not duplicated).

## ENGINE ACCESS (Phase 9)

New adapter `src/lib/sackmann-wta-main-pbp.server.ts` (`buildSackmannWtaMainPbpContext`)
reuses the **existing** `reconstructPbpScoreState()` consumer
(`src/lib/pbp-score-state-recovery.ts`) — the same function BSD's live WTA Main feed
already uses — so historical evidence flows through the exact same
metric-derivation logic, firewall (`pbp-evidence-firewall.ts`
`canonicalApprovedPbpIdentity`/`claimUniqueApprovedPbp`), and metric codes
(`002,003,009,016,018,032,033,034,042,043,044,053,060,024,025`) as the live source,
rather than a parallel implementation.

Wired into the two places WTA Main PBP already reaches engines from, alongside the
live BSD source (never replacing it — the two cover disjoint date ranges):

- `src/lib/source-observation-metric-bridge.server.ts` — WTA_MAIN branch now calls
  both `buildBsdWtaMainPbpContext` and `buildSackmannWtaMainPbpContext` in parallel
  and merges their packets per metric code via the existing `mergePacketEntry`
  helper (already used one line below for the same purpose).
- `src/lib/warehouse-first-researcher.server.ts` — added as a sixth parallel source
  packet alongside the existing five (mirrors the file's own established pattern of
  calling each per-tour PBP builder directly, in addition to the bridge).

Each individual observation still names its own `provenance.approval_source` and
`provenance.trust_level`, so a Statistical/Truth/Decision Engine consumer can tell
live-BSD, LEVEL_1-verified-historical and LEVEL_2-single-source-historical evidence
apart — never collapsed into one undifferentiated label. Engine independence is
preserved: this only adds observations to the shared evidence layer each engine
already reads from; no engine-specific code was touched.

## METRICS RE-AUDIT (Phase 10) — not auto-promoted

Per instruction, no metric's certification status was changed by this work; this is
a factual re-check of what changed and what did not.

- **002 (Serve Profile), 003 (Return Profile), 009 (Clutch/Pressure), 016
  (Point-by-Point & Score-State), 032 (Point-to-Game Conversion), 034, 053**: these
  are exactly `TASK18B_METRIC_CODES` / the explicit `PBP_CODES` allowlist already
  used by the live BSD adapters. WTA Main now has 7,165 real historical matches of
  evidence feeding them (previously 0) for any `asOfDate` after a covered match —
  still `PARTIAL`/`RECONSTRUCTED` per `reconstructPbpScoreState`'s own existing
  per-code treatment (unchanged code, unchanged treatment logic).
- **018 (Rally-Length Profile)**: still correctly `TRULY_UNAVAILABLE`
  (`metric-recoverability-map.ts`) — this fill's data has no rally-length/shot-count
  field, same limitation the map already documents; not affected by this work,
  verified rather than assumed.
- No change made to `src/lib/metric-recoverability-map.ts`.

## TESTS

- `src/lib/sackmann-wta-main-pbp.test.ts` (new, 4 tests): real production-index
  fixtures (not synthetic), same convention as
  `evidence-coverage-approved-pbp-bridge.test.ts`. Covers: observations actually
  reconstruct for a known verified match; the audited match's own PBP is never
  admitted as evidence for itself (temporal-leakage boundary, same class of bug the
  existing Phase-14 Challenger test guards); provenance always names a real
  source + trust tier; no false-positive observations for a nonexistent pair.
- Full pre-existing PBP + bridge + researcher test suites re-run clean after this
  change: `pbp-score-state-recovery`, `pbp-evidence-firewall`,
  `bsd-pbp-code-allowlist`, `deterministic-pbp-metrics`,
  `evidence-coverage-approved-pbp-bridge`, `pbp-hold-break-percentage`,
  `newly-green-end-to-end-coverage-audit`, `source-observation-metric-bridge`,
  `warehouse-first-researcher*`, `warehouse-deterministic-wiring`,
  `warehouse-research-orientation`, plus the full deterministic-batch/metric-wiring
  suite that imports the two files this change touched — **201 tests, 0
  failures**.
- `npx tsc --noEmit` clean.

## PRODUCTION VERIFICATION

**Not independently verifiable from this environment**: `SUPABASE_SERVICE_ROLE_KEY`
is unset here, so there is no live connection to the production database to confirm
against (consistent with the pre-existing `evidence-coverage-baseline.json`
diagnostic, which already reports the same missing-credential state). This fill
does not touch Supabase at all — it is file-based, matching the WTA Challenger
precedent — so that gap does not block it, but a human/CI run with real credentials
should confirm the merged packets actually surface through a live
Statistical/Truth/Decision Engine call before this is relied on in production.

## REMAINING GAPS

- **No WTA Main PBP exists anywhere (checked) for non-Slam matches 2016–2024** or
  **any year before 2011**. The live BSD feed only starts 2024-12-02. This is a
  genuine hole in available historical evidence, not a gap this task's tooling
  failed to fill — no approved source contains that data.
- Non-Slam 2011 and 2015 have much lower coverage (6.3%, 15.0%) than 2012–2014
  (~47–52%) because `ppaulojr`'s own PBP archive has far fewer candidate rows for
  those partial years (its README: "_archive" is "most of which are from 2012-14").
  Not a bug in this fill.
- 2,104 non-Slam `REVIEW_REQUIRED` matches (PBP candidate found, but no unique
  independent-source match) were deliberately left unresolved rather than
  force-matched — a legitimate future improvement would be tightening the
  name-normalization further, but never by relaxing the independent-verification
  requirement itself.
- 2016 Wimbledon women's singles PBP does not exist in the upstream archive at all
  (confirmed, not a filter bug).
- **License review outstanding** (see
  docs/WTA_MAIN_HISTORICAL_PBP_ATTRIBUTION.md) — both sources are non-commercial or
  unlicensed; flagged `NONCOMMERCIAL_ONLY` in `yellow-metric-sources.ts`, matching
  the Match Charting Project's existing precedent. **Do not ship this in a
  commercial/monetized path without resolving that first.**

## Git

Scripts: `scripts/verify-sackmann-wta-main-pbp.py`,
`scripts/verify-sackmann-wta-main-slam-pbp.py`,
`scripts/build-wta-main-pbp-approved-index.py`.
TS: `src/lib/sackmann-wta-main-pbp.server.ts` (+ test), edits to
`src/lib/source-observation-metric-bridge.server.ts`,
`src/lib/warehouse-first-researcher.server.ts`,
`src/lib/yellow-metric-sources.ts`.
Docs: this file, `docs/WTA_MAIN_HISTORICAL_PBP_ATTRIBUTION.md`.
Data: `data/metrics/pbp/wta_main/approved-index.jsonl`,
`data/audit/verified-pbp-v4/wta_main/`, `data/audit/verified-pbp-v4/wta_main_slam/`.
