# ATP Main PBP: downstream-readiness report

Companion to `MATCH_IDENTITY_RESOLVER.md` and `INDEPENDENT_CORROBORATION.md`.
This document is the ATP Main population's SOURCE → IDENTITY RECONCILIATION →
STRUCTURAL VALIDATION → INDEPENDENT CORROBORATION → TRUST/VALIDATION STATUS →
APPROVED MANIFEST → TRUTH ENGINE ACCESSIBLE readiness report, built entirely
on the existing ATP Main reconciliation/validation work from this repo's
`claude/atp-pbp-completion-t9cxue` branch -- no prior work was redone.

## 0. Important scope note on "the same standard as WTA Main"

Before building anything, I checked the actual current state of WTA Main's
own validation, rather than assuming it. The result is directly relevant to
what "bring ATP Main to the same standard" can honestly mean right now:

- WTA Main's completed pipeline is `scripts/bsd-wta-main-pbp-history.py` /
  `scripts/validate-bsd-wta-main-pbp-integration.py`, built on a **live
  commercial API** (`sports.bzzoiro.com`, "BSD"), covering **live/recent
  matches from 2024-12-02 onward** -- a different source, different era, and
  different pipeline shape than ATP Main's 2012-2013 GitHub-archive-based
  identity-resolution work this document is about.
- Its own committed validation report
  (`data/audit/bsd-wta-main-pbp-integration-validation.md`, confirmed current
  on `origin/main` at commit `f6e5d0a`, not stale) reads **`Validation: FAIL`**
  -- 2 of 8 checks fail (`coverage_floor_enforced_in_metrics_module`,
  `strict_wta_main_tour_guard_present`). WTA Main's own validation has not
  actually reached a fully-passing state.
- No "WTA Main approved manifest" artifact exists anywhere in this
  repository (searched the full repo; zero hits for `approved_manifest` /
  `approved manifest` in any form before this document).

Given this, "the same standard as WTA Main" is treated here as **the same
rigor and pipeline shape** the task's own Step 1-8 vocabulary describes
(source → identity reconciliation → structural validation → corroboration →
trust status → approved manifest) -- which maps directly onto ATP Main's
already-built identity-resolution pipeline -- not as literally re-platforming
ATP Main onto BSD/Bzzoiro (a different source, for a different era, that this
task does not ask for and that this document does not touch). This is stated
plainly rather than silently assumed, exactly as the earlier architecture
correction in this same PBP workstream required.

## 1. Real, non-estimated inventory

Produced by `scripts/atp-main-pbp-inventory.py` (new this session, built on
the already-tested `resolve_and_validate`/`resolve_match_identity` from
`export-pbp-structurally-validated-corpus.py` and `match_identity_resolver.py`
-- no classification logic re-implemented a third time). Run live against
ATP_MAIN 2012 and 2013 -- the exact population the existing ATP Main
reconciliation work covers; no new years were added (this task's Step 2
explicitly directs "verify... the previous ATP audit['s]... 2012-2013
population", not an expansion).

Full output: `data/audit/atp-main-pbp-inventory/atp_main_{2012,2013}.json`,
`atp_main_combined_summary.json`.

| Category | 2012 | 2013 | Combined |
|---|---:|---:|---:|
| Total hist matches (Aneeshers/Sackmann, ATP_MAIN main-draw) | 2,697 | 2,631 | 5,328 |
| Total PBP candidates (ppaulojr) | 2,645 | 2,648 | 5,293 |
| **LEVEL_1 (independently verified)** | 0 | 0 | **0** |
| **LEVEL_2 (structurally validated)** | 1,919 | 2,146 | **4,065** |
| **REVIEW_REQUIRED** | 0 | 0 | **0** |
| **AMBIGUOUS** | 0 | 0 | **0** |
| **CONFLICT** | 0 | 0 | **0** |
| **STRUCTURAL_FAIL** | 89 | 124 | **213** |
| **UNMATCHED** | 637 | 378 | **1,015** |
| &nbsp;&nbsp;-- no historical player pair | 608 | 350 | 958 |
| &nbsp;&nbsp;-- candidate pair exists, score/winner disagree | 29 | 28 | 57 |
| **NO_PBP** (hist matches with zero ppaulojr candidate for that pair) | 590 | 297 | **887** |

**Match identity status** (`resolve_match_identity`'s own RESOLVED/AMBIGUOUS/
UNRESOLVED, counted from the PBP-candidate side): RESOLVED 4,278, AMBIGUOUS 0,
UNRESOLVED 1,015 (combined). RESOLVED = LEVEL_2 + CONFLICT (4,065 + 0); every
resolved identity that reached structural validation happened to pass it in
this population.

`NO_PBP` (887) is a genuinely new metric this repo had never computed before
this session -- counted from the **historical side**, not the PBP-candidate
side (a different denominator/direction than every other row above): "how
many real ATP Main matches does ppaulojr have zero PBP rows for at all,"
independent of whether any resolution was ever attempted for that pair. See
`no_pbp_examples_sample` in the per-year JSON for real examples.

**Identity-resolution tier breakdown, LEVEL_2 only** (the "auditable reason"
for every promotion, Step 3):

| Tier | 2012 | 2013 |
|---|---:|---:|
| FUZZY_FALLBACK (tier 7, gated by independent score+winner agreement) | 1,318 | 1,525 |
| ALIAS_TABLE (tier 6, controlled/evidence-backed) | 601 | 621 |

These numbers exactly reproduce the already-committed identity-resolver
recovery counts (`MATCH_IDENTITY_RESOLVER.md`), confirming the new inventory
script's classification agrees with the existing, separately-tested
`atp-pbp-identity-resolution-experiment.py`.

**Tournament breakdown, LEVEL_2 only**: 63 distinct tournaments per year (both
2012 and 2013); top 5 by volume in 2012: US Open (92), Wimbledon (89), Roland
Garros (84), Miami Masters (68), Indian Wells Masters (66). Full breakdown in
the per-year JSON (`tournament_breakdown_LEVEL_2_only`).

**Source breakdown**: one PBP source (`ppaulojr/tennis_pointbypoint`,
`LICENSE_UNCERTAIN`), one identity/hist source
(`Aneeshers/tennis-sackmann-archive`, `NONCOMMERCIAL_ONLY`) -- unchanged from
the existing source-license audit (`PBP_SOURCE_LICENSE_AUDIT.md`); no new
source was integrated this session.

## 2. The existing 4,065 -- verified against the current repository state

Re-ran `export-pbp-structurally-validated-corpus.py` fresh (live network
fetch, same sources) rather than trusting the previously-committed export
file unread. Result: **4,065** STRUCTURALLY_VALIDATED records still exist
(1,919 + 2,146), matching `INDEPENDENT_CORROBORATION.md` section 8 exactly.
None have been promoted to LEVEL_1/MATCH_CORROBORATED/PBP_CORROBORATED --
every one of the 4,065 is still, and only, STRUCTURALLY_VALIDATED.

## 3. Identity reconciliation

Unchanged from the existing, already-tested `match_identity_resolver.py`
(24 tests, all still passing) -- reconciled on player identity, date,
tournament (alias table + gated fuzzy fallback), round, surface, score,
winner, and tour, exactly as Step 3 requires. No canonical ID is ever
fabricated: every exported `externalId` is `f"{tourneyId}-{matchNum}"`,
verified byte-for-byte derivable from `tournamentId` by
`atp-main-pbp-integrity-check.py`'s `no_canonical_id_fabrication` check
(PASS, 0 violations across all 4,048 approved records).

## 4. Corroboration

`scripts/lib/corroboration_source.py`'s interface (built in an earlier
session on this branch) remains unused for a real corroboration run, for the
same reason stated honestly in `INDEPENDENT_CORROBORATION.md`: every
candidate independent source is still unreachable. Re-checked fresh this
session, not assumed stale:

- Direct fetch from this sandbox to `tennis-data.co.uk` and
  `www.atptour.com`: both refused by the sandbox's own egress proxy (403 on
  the CONNECT tunnel) when tested again this session.
- A fresh GitHub Actions run (real internet access) was triggered this
  session (`verified-pbp-pipeline.yml`, run 35070530803) specifically to
  re-check `tennis-data.co.uk`'s reachability; **as of this report, the run
  is still in progress** -- its "Diagnose tennis-data.co.uk reachability"
  step completed, but the full verification step (which retries with
  backoff against a load-shedding server) has not finished. This report does
  not wait indefinitely on it or fabricate a result; if it comes back up,
  that changes this section in a follow-up commit, exactly as the prior
  corroboration document already committed to.

**LEVEL_1 remains 0 by construction.** No record has been promoted based on
"another copy of the same source exists" -- `SourceFamily.is_independent()`
already prevents that by design (Aneeshers/JeffSackmann/farhadGithub all
collapse to `SACKMANN_COMPILED`, never independent of the hist source itself).

## 5. ATP Main approved manifest

`scripts/export-pbp-structurally-validated-corpus.py`, extended this session
with every field Step 5 requires (previously missing: `round`, `surface`,
canonical `player1Id`/`player2Id`, identity-source provenance, cutoff
metadata) -- not a new script, the existing export **is** the approved
manifest, completed rather than duplicated.

Per-record schema (see `data/audit/pbp-structurally-validated-export/
atp_main_{2012,2013}.json`):

```
provider, externalId, tour, year, tournamentId, tournamentName, date, round,
surface, level, player1Name, player2Name, player1Id, player2Id, winner,
score, pbpSourceRepo, pbpSourceFile, pbpSourceRow, pbpRaw, pbpSha256,
reconstructed, verifierVersion, identitySourceName, identitySourceLicense,
identityResolutionTier, validationLevel, licenseStatus, cutoffBasisDate
```

`player1Name`/`player1Id` are always the winner (Sackmann's own convention,
which tennis-stats-engine's `sackmannBackfill.ts` also follows) -- taken from
the canonical identity-source record (`matched`), never from ppaulojr's own,
differently-ordered `player_1`/`player_2` fields.

`cutoffBasisDate` documents, rather than invents, the one fact a downstream
cutoff computation must be based on: truth-engine does not compute an actual
cutoff timestamp itself (that is a deployment-configured concept, e.g.
tennis-stats-engine's `cutoffMinutes`/`cutoffAt`) -- it asserts the real match
date and nothing more.

**Approved manifest count: 4,048** (after deduplication -- see Section 6).

## 6. Data integrity

`scripts/atp-main-pbp-integrity-check.py` (new this session), run directly
against the real exported manifest files, mirroring the PASS/FAIL checklist
style of `bsd-wta-main-pbp-integration-validation.md` so both populations'
reports are directly comparable in format.

**First run against the un-deduplicated 4,065-record manifest found two real
problems, not zero:**

1. **`score_agrees_with_reconstruction`: FAIL, 1,924/4,065 violations.** A
   real bug in the manifest-building code (not the underlying validation
   pipeline, which was already correct): `reconstructed.sets`/`winner` were
   exported in ppaulojr's own raw server1/server2 tape orientation, which
   does not always agree with the exported `player1Name`/`player2Name`
   (Sackmann winner-is-player1) orientation. **Fixed** in
   `export-pbp-structurally-validated-corpus.py` (the orientation flip
   already computed for the internal score check is now applied to the
   stored/exported reconstruction too) and pinned with a dedicated
   regression test (`export-pbp-structurally-validated-corpus.test.py`,
   `TestOrientationFlip`, 3 tests) built from a synthetic case reproducing
   exactly this condition. Re-run: **PASS, 0 violations.**

2. **`duplicate_pbp_hashes` / `duplicate_canonical_matches`: FAIL, 17
   duplicate canonical matches** (3 of which also share an identical
   `pbpSha256`) -- the same real ppaulojr-source duplicate-row condition
   already found and handled on the tennis-stats-engine import side this
   branch (`dedupeByExternalId`, lowest `pbpSourceRow` kept). Applied the
   identical deterministic tie-break **inside the manifest export itself**
   this time, so the manifest tennis-stats-engine (or any future consumer)
   receives is already clean, rather than relying on every downstream
   consumer to re-implement the same dedup rule. Every discarded duplicate
   is retained in the manifest JSON's `discarded_duplicates` array, never
   silently dropped.

**Final run against the deduplicated 4,048-record manifest: all 10 checks
PASS.**

| Check | Result |
|---|---|
| duplicate_pbp_hashes | PASS |
| duplicate_canonical_matches | PASS |
| winner_is_always_player1 | PASS |
| score_agrees_with_reconstruction | PASS |
| no_tournament_identity_missing | PASS |
| no_date_missing | PASS |
| date_is_valid_iso | PASS |
| cross_tour_contamination | PASS |
| malformed_pbp_excluded | PASS |
| no_canonical_id_fabrication | PASS |

Other Step 6 items, verified by construction rather than a separate runtime
check (with the code-level reason why):
- **Player swaps**: impossible for an approved record -- `player1Name` is
  always re-derived from `matched.player_1` (the canonical winner), never
  independently settable.
- **Cross-tour contamination**: `PpaulojrPbpAdapter.fetch_year` filters
  `r.get("tour").upper() != expected` and `AneeshersSackmannHistAdapter`
  fetches a tour-specific file (`atp_matches_*.csv` vs `wta_matches_*.csv`)
  -- verified empirically too (`cross_tour_contamination` check above, PASS).
- **Temporal leakage**: out of scope for truth-engine itself to enforce (it
  has no concept of a "match being predicted" or a cutoff window) -- what
  this population guarantees is `cutoffBasisDate`/`date` is never null or
  malformed (`no_date_missing`, `date_is_valid_iso`, both PASS), which is the
  precondition any downstream leak-safety check depends on.

## 7. Standard not lowered

No ATP record was promoted to increase the count. Concretely:
- LEVEL_1 stayed 0 -- corroboration sources remain unreachable (Section 4),
  not bypassed.
- REVIEW_REQUIRED and AMBIGUOUS stayed 0 -- no ambiguous identity match was
  forced to RESOLVED.
- The 1,015 UNMATCHED and 213 STRUCTURAL_FAIL records remain exactly where
  they are, for the reasons already documented in
  `MATCH_IDENTITY_RESOLVER.md` section 3 (out-of-scope-by-design rows --
  doubles/Davis Cup entries, and a genuine qualifying-round/year-boundary gap
  -- for UNMATCHED; genuinely malformed or illegal PBP tapes for
  STRUCTURAL_FAIL). No fuzzy matching was loosened and no new alias-table
  entry was added this session.
- The only two changes to the promoted population this session were a **bug
  fix** (the orientation flip, which changed zero records' validation level,
  only the internal representation of already-approved records) and a
  **dedup pass** that *removed* 17 records from "approved" status (4,065 to
  4,048), not added any.

## 8. Final ATP Main inventory (exact)

```
TOTAL CANDIDATES (PBP-side, 2012+2013):     5,293
TOTAL STRUCTURALLY VALIDATED (raw):         4,065
TOTAL LEVEL_1:                                  0
TOTAL LEVEL_2:                              4,065
TOTAL REVIEW:                                   0
TOTAL AMBIGUOUS:                                0
TOTAL CONFLICT:                                 0
TOTAL STRUCTURAL FAIL:                        213
TOTAL UNMATCHED:                            1,015
TOTAL NO PBP (hist-side):                     887
```

1. **Exact approved manifest count: 4,048** (after deduplication; see
   Section 6).
2. **Exact unresolved count: 1,228** (213 STRUCTURAL_FAIL + 1,015 UNMATCHED;
   REVIEW_REQUIRED/AMBIGUOUS/CONFLICT are 0). Matches
   `INDEPENDENT_CORROBORATION.md` section 9's "Remaining 1,228" exactly.
3. **Unresolved records list/manifest**: not re-exported as a new artifact
   this session (would duplicate `data/audit/pbp-identity-resolution-
   experiment/atp_main_{2012,2013}.json`'s already-committed
   `newly_ambiguous_examples`/`newly_conflicting_examples` fields, both
   empty, and the new `no_pbp_examples_sample` in this session's inventory
   output) -- see Section 1's files for the real, already-produced examples;
   nothing here is estimated or summarized-only.
4. **Source-by-source breakdown**: Section 1 ("Source breakdown").
5. **Year-by-year breakdown**: Section 1's table (2012 vs 2013 columns).
6. **Validation methodology**: Sections 3-4 plus the pre-existing
   `MATCH_IDENTITY_RESOLVER.md`/`INDEPENDENT_CORROBORATION.md` (identity
   resolution priority order, structural reconstruction rules, corroboration
   interface/source-family independence).
7. **Tests run and results**: 107 tests across 8 files, 0 failures (see
   commit message for the exact per-file counts) -- includes 2 new test
   files this session (`export-pbp-structurally-validated-corpus.test.py`,
   5 tests including the orientation-flip regression;
   `atp-main-pbp-integrity-check.test.py`, 15 tests).
8. **Git commit**: see this branch's commit history for this session's exact
   commit SHA (this document is committed in the same commit as the
   scripts/exports it describes).
9. **Tennis Matrix AI**: not touched. This entire session's work is confined
   to `tennis-truth-engine-8ecc1270` -- no file in the `tennis-stats-engine`
   (Tennis Matrix AI) repository was read or modified.

## Final condition

The approved population (4,048 records,
`data/audit/pbp-structurally-validated-export/atp_main_{2012,2013}.json`) is
machine-readable JSON with a documented, stable per-record schema (Section
5), individually keyed by `(provider, externalId)` with zero duplicates
(Section 6), and uses the exact identity convention
(`provider="sackmann"`, `externalId=f"{tourneyId}-{matchNum}"`) already
proven to resolve against a real downstream system's own historical-match
table in this same session's prior work (tennis-stats-engine's
`historical_matches`/`sackmannBackfill.ts`). It is ready for the same
downstream ingestion contract intended to eventually receive WTA Main, ATP
Challenger, and WTA Challenger -- **contingent on** that shared contract
itself existing in a stable, cross-population form, which is a separate,
not-yet-done piece of work this document does not claim to complete.
