# Source vetting audit — data/public/tennisdata-wta-main/ (TennisData.app)

Requested as a check on whether this already-present local dataset could independently
corroborate WTA Main PBP evidence for 2021-2024 (upgrading LEVEL_2 Slam matches to LEVEL_1).
**Verdict: does not currently qualify. No records were modified — all 7,165 approved rows are
unchanged from before this audit.**

## 1. Provenance

- MANIFEST.json's stated source: "TennisData.app user-supplied season CSVs" — no URL, no
  license, no collection methodology.
- Added in commit `6e7713c` ("Add regression tests for the 16-stage canonical model and
  harden slate.tsx") — a commit message with no relationship to data ingestion, and no
  dedicated GitHub Actions workflow analogous to `.github/workflows/sync-tennis-data-wta.yml`
  (the properly-audited Tennis-Data.co.uk sync this project already treats as an independent
  source). There is no reproducible pipeline that produced these files — just a static drop.
- No entry in `THIRD_PARTY_DATA.md` or any other attribution doc anywhere in the repo.
- `round` values use "1/64-finals", "1/32-finals", "1/16-finals" phrasing — a naming
  convention characteristic of certain third-party live-scores APIs (e.g. SofaScore-family),
  not standard tennis terminology ("R64"/"R32"/"R16"). This is circumstantial but real
  evidence that TennisData.app itself may be a downstream aggregator of another live-scoring
  API rather than a primary data collector — the opposite of what "independent" requires.

**Conclusion: provenance cannot currently be confirmed as independent primary collection.**

## 2. Independence from the existing PBP pipeline's sources

Not derived from Sackmann/ppaulojr/Aneeshers (different site, different schema, different
`round`/score-column conventions). This part is fine — it is not literally the same dataset.
But "not the same dataset" is not the same as "confirmed-independent, confirmed-reliable
data collection" (see §1 and §6).

## 3. File dates / coverage years

Six files, `2021wtaseason.csv` .. `2026wtaseason.csv`. `wta_tour_rows_accepted: 23,027` per
the manifest. No file modification timestamps beyond the single commit that added them all at
once; no evidence of periodic/versioned updates.

## 4. Main-draw only, or also qualifying/other rounds?

**The MANIFEST's own claim ("scope: WTA Tour (main draw) ONLY") is factually wrong.**
Direct count against the raw files: of 23,150 `tour_type_human=="WTA Tour"` +
`status=="FINISHED"` rows, **7,918 (34.2%) are labeled `round=="Qualifier"`**. A further 885
rows have a blank round and turn out to be Billie Jean King Cup (Fed Cup) and United Cup —
team competitions, not individual WTA main-tour matches (the same category this project's own
`WTA_MAIN_LEVELS` already excludes as `D`/team events). After excluding both, 14,347 genuine
main-draw individual-event rows remain across 2021-2026.

## 5/6. Identity/score mapping, duplicates, conflicts

Restricted to the only subset that could possibly matter here — Grand Slam, 2021-2024 (the
only years/tournaments where this project has LEVEL_2 PBP evidence to potentially upgrade):
**2,032 TennisData.app Grand Slam main-draw rows**. Matched against the **1,174** existing
LEVEL_2 approved rows for the same window by (year, normalized player pair):

- **1,083 exact identity matches** (one-to-one player pair + year).
- **28 ambiguous** (matched more than one candidate — not pursued further).
- **921 of our approved rows have no TennisData.app counterpart at all** (mostly Australian
  Open/Roland Garros 2022-2024, which this source's own Grand-Slam name list shows are
  present in principle, but the identity-matching didn't resolve them — not investigated
  further given the verdict below).

Of the 1,083 identity-matched pairs, actually comparing set-by-set scores (TD.app's
`home_set_N_score`/`away_set_N_score` columns, oriented to the historical winner):

- **1,056 agree exactly** on score.
- **27 (2.5%) conflict** — real score discrepancies, not near-misses. Examples: Halep vs
  Frech recorded as a 2-set 6-4 6-3 win here vs. 6-4 6-1 in our hist record; Cirstea vs Maria
  recorded as 2 sets (6-3 6-3) here vs. a real 3-set match (6-3 1-6 7-5) in our hist record —
  a difference in match *length*, not just a score detail.

## 7. Can this source corroborate the actual PBP tape, or only reproduce match-level results?

TennisData.app's rows are match-level results (set scores, not point sequences) — the same
category of evidence Tennis-Data.co.uk already provides for the LEVEL_1 non-Slam lane. It
could only ever corroborate *identity and score*, never the point-by-point tape itself
(nothing can, short of a second independent point-by-point feed) — consistent with how LEVEL_1
already works elsewhere in this project. This alone would have been acceptable if the source
qualified.

## Verdict: does not qualify (yet)

Per the standing rule — do not call something independently verified merely because two local
datasets agree — this source is **not accepted as a LEVEL_1 corroboration source**:

1. No confirmable independent provenance (§1) — the naming-convention fingerprint plus zero
   ingestion audit trail leaves real doubt about whether this is genuinely independent primary
   collection versus a repackaged downstream aggregation.
2. The source's own accompanying documentation (the MANIFEST) is demonstrably wrong about its
   most basic scope claim (§4), which undermines confidence in trusting any of its other
   unverified claims.
3. A real, non-trivial 2.5% score-conflict rate exists even among identity-matched rows (§5/6)
   — using this source uncritically would have risked upgrading some genuinely incorrect
   records to LEVEL_1 "independently verified."

**If this is to be used in the future**, it needs: a documented license/provenance statement
(matching `docs/WTA_MAIN_HISTORICAL_PBP_ATTRIBUTION.md`'s bar), a real ingestion
workflow (matching `sync-tennis-data-wta.yml`'s bar), and the 27 score conflicts above
resolved or explained before any upgrade — not before.

## What did NOT change

Zero rows in `data/metrics/pbp/wta_main/approved-index.jsonl` were modified. All 7,165
existing records keep their existing trust tier.

## Project-boundary correction

WTA Main Tour PBP target is **2012 -> current**. Of the 7,165 total approved rows, **156 are
2011** (out-of-target historical coverage the pipeline happens to also cover, since the source
archive's own year range starts there) and **7,009 are 2012-current** (the actual in-target
figure). Prior reporting stated "4,174 LEVEL_1" without separating out the 156 2011 rows
included in that figure — corrected here: **4,018 of the 4,174 LEVEL_1 rows are 2012-current**
(156 are 2011).
