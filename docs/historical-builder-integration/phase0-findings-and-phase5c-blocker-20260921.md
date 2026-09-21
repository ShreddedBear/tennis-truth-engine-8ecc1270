# Historical Builder Integration — Phase 0 Findings & Phase 5C Blocker

**Date:** 2026-09-21
**Author:** Claude (historical-builder-integration audit)
**Main SHA at time of writing:** `64831cac96daf3831e447e02f3d79b50989914f8`
**Related work merged to main:** `90fe3b1` (Builder version-lineage infrastructure), `1203f70` (migration-mechanism fix), `64831ca` (live calibration-parity regression check)

This document is the permanent record of two independent investigations:

1. Whether the Parlay Builder's and Truth Engine's historical decision/evidence lineage for the 2026-04-22–2026-06-02 cohort (2,575 Prediction Engine matches) could be legitimately reconstructed.
2. An exhaustive search for the Phase 5C authority artifacts (`phase5_preregistration_v2.json`, `phase5c_final_run_prompt_rev_b.md`, and their associated signoff/addendum/approval-receipt hashes).

Nothing in this document was fabricated, guessed, or reconstructed from memory. Every claim below is cited to a specific commit, a live (now-archived) database query, or a specific search that returned zero results.

---

## 1. Parlay Builder historical lineage — evidence, not merely absence

**Finding: the Parlay Builder algorithm and its calibration model did not exist during the target cohort's window. This is a structural fact, not a retention gap.**

Evidence:

- `BUILDER_VERSION = "1.0.0"` (`artifacts/api-server/src/services/parlayBuilder/builderScoringService.ts`) has never changed since its first commit. The current weight configuration is confirmed present verbatim as of commit `82e372353c527f248fba95e11375bf1802262a7e` ("Integrate the complete Truth Engine under the Stats Engine navigation"), dated **2026-09-14T12:16:31Z**.
- A live, read-only query against `heliumdb` on 2026-09-21 found `calibration_models` has exactly 2 rows, both fitted **2026-09-16**. No calibration model existed before that date.
- `parlay_builder_settings` (the table designed to hold versioned Builder weights/thresholds) has **0 rows, ever**.
- `parlay_leg_outcomes` (the Builder's own decision-outcome ledger) contains exactly 958 rows, spanning **2026-09-14T20:33:40.834Z to 2026-09-20T14:49:11.844Z** — nowhere near the target cohort.
- The target cohort (2026-04-22–2026-06-02) predates all of the above by roughly 3.5–4.5 months.

**Additional, separately-disclosed risk:** the current Builder weights are attributed in-code to a "2026-08-11, n=39,000-leg" ablation run (`auditParlayFactorWeights.ts`), but that script's own documented source table (`parlay_leg_outcomes`) contains no rows older than 2026-09-14 — the cited ablation's source data no longer exists in the live database, so overlap with the target cohort can be neither confirmed nor ruled out. This is recorded verbatim in the seeded `parlay_builder_version_manifests` row's `provenance.conflictingEvidence` field, not silently dropped.

**Conclusion:** for 2026-04-22–2026-06-02, the correct, evidence-backed lineage status for every match is `NO_BUILDER_DECISION`. This was verified by actually running the audit (see §3).

## 2. Truth Engine historical lineage — audited independently

Per explicit instruction not to presume Truth Engine shares the Builder's failure mode, its lineage was audited on its own evidence:

- Truth Engine's Supabase migration history (23 migrations) starts **2026-08-21**.
- A `hard_delete_clear_slate` migration on **2026-09-05** wiped prior evidence/observation data.
- Evidence-warehouse write-lockdown migrations landed **2026-09-10/11**.
- No `rule_version`, `evidence_version`, `ruleset`, or equivalent versioning column exists anywhere in its schema.

**Conclusion, independently reached:** Truth Engine evidence/rules also cannot be reconstructed for 2026-04-22–2026-06-02 — for different, Truth-Engine-specific reasons (evidence was deleted), not because the Builder's conclusion was assumed to carry over.

## 3. Future-proofing infrastructure — built, tested, and verified live

Rather than leave this gap to recur, an immutable, point-in-time-aware version-lineage layer was built for the Builder (merged to `main` at `90fe3b1`/`1203f70`/`64831ca`):

- `parlay_builder_version_manifests` — immutable `effective_from`/`effective_to` interval timeline of algorithm config, calibration pairing, source commit, config fingerprint, and provenance. DB-enforced immutable (only permitted mutation is closing an open row's `effective_to`).
- `parlay_builder_lineage_audit` — append-only, one row per (auditRunId, historicalMatchId), classified into exactly one of six explicit statuses: `VALID_HISTORICAL_LINEAGE`, `NO_BUILDER_DECISION`, `CALIBRATION_UNAVAILABLE`, `ALGORITHM_VERSION_UNAVAILABLE`, `CONFLICTING_LINEAGE`, `PIT_VIOLATION`.
- `resolveBuilderLineage`/`getBuilderVersionAsOf`/`getCalibrationModelAsOf` — binary-search PIT lookups mirroring the Prediction Engine's own proven `getCalibrationMappingAsOf` pattern.
- `computeBuilderScore` now resolves calibration via `resolveBuilderCalibrationForScoring(asOfDate)` instead of an unconditional `getActiveCalibration()` — live-mode behavior (asOfDate unset) is provably byte-for-byte unchanged (see the live parity check below); backfill-mode calibration is now genuinely point-in-time.

**Live verification performed against the real Replit/heliumdb environment before merging to main** (full detail in conversation record; summarized here for permanence):

- Migration applied via `ensureEvaluationSchema.ts`'s existing idempotent auto-apply-on-boot mechanism (not `drizzle-kit push`, which was found to be unsafe in this environment — see §5).
- Tables, indexes, constraints, and both immutability triggers confirmed present in the live database via direct catalog queries.
- `v1` manifest seeded and verified: `effectiveFrom=2026-09-14T12:16:31.000Z`, `sourceCommit=82e37235...`, fingerprint `d1cac2a9a84b2627d6c71d3abb2da2e074ab4722a75233b0bc66eee9ef70a3a1` — independently recomputed from source and matched exactly.
- **`auditBuilderHistoricalLineage.ts` run against the real, live `historical_matches` table for 2026-04-22–2026-06-02: 5,524 non-cancelled matches found, 100% classified `NO_BUILDER_DECISION`, zero exceptions in any other status.** (Note: 5,524 is a broader population than the Prediction Engine's specific 2,575-row figure — this script queries `historical_matches` directly by date, not the Prediction Engine's own filtered population; the exact population definitions were not reconciled this session. The conclusion is unaffected: no Builder/calibration state existed for any match in this window, under any reasonable population definition.)
- Zero-touch verified: `predictions` (2,575), `parlay_leg_outcomes` (958, identical timestamps), `evaluation_holdout_populations` (1 finalized, `eligible_count=9`, window 2026-06-03–06-17), `evaluation_holdout_members` (9), and `calibration_models` (2) were all confirmed unchanged before and after.
- 140/140 tests passed live (122 pre-existing + 18 new). Idempotence verified via a second fresh server restart. A dedicated regression script (`verifyLiveCalibrationParity.ts`) proved the old and new live-mode calibration code paths return identical output against the real database.
- Fast-forward merged to `main` with zero conflicts; confirmed independently via the GitHub API (not just git CLI) that `main`'s tip is `64831cac96daf3831e447e02f3d79b50989914f8` with the expected linear 3-commit history.

## 4. Phase 5C authority artifacts — exhaustive search, zero results

Searched, exhaustively, for `phase5_preregistration_v2.json`, `phase5c_final_run_prompt_rev_b.md`, and the associated signoff/addendum/approval-receipt SHA-256 values named in the task specification:

- **Full local git history, all branches, all commits** (`git log --all -S`, `git log --all --diff-filter=A --name-only`) on both in-scope repositories (`tennis-truth-engine-8ecc1270`, `Tennis-Stats-Engine`): zero matches.
- **GitHub code search** (current default-branch tree, both repos): zero matches for either filename.
- **GitHub commit-message search** (default branch, both repos): zero matches for either filename or any of the cited hash strings.
- **All tags** on both repos: none exist.
- **All releases** on both repos: none exist.
- **All pull requests, all states** — 89 in `tennis-truth-engine-8ecc1270`, 8 in `Tennis-Stats-Engine` — reviewed by title: zero reference "Phase 5C," "preregistration," "signoff," or any related concept. (This repo does have an unrelated, much larger "Evidence Coverage Phase N" PBP-ingestion audit thread spanning dozens of PRs — a completely different "Phase" numbering scheme, not to be confused with Phase 5C.)
- **Live Replit workspace filesystem** (searched before Replit went offline, including `attached_assets/`, `.migration-backup/`, and everywhere else, not just git-tracked source): confirmed absent.

**These artifacts do not exist anywhere accessible from this repository, its history, or the connected live environment.** Per explicit instruction, their content was not reconstructed from the conversation/prompt text that originally described the Phase 5C arms/Stage 8 definitions — even though much of that specification appears verbatim in the originating conversation, using it as a substitute for the authority files would defeat the entire purpose of a hash-verified, pre-registered, signed-off artifact (preventing exactly this kind of after-the-fact reconstruction).

## 5. Separately-flagged pre-existing issue (not caused by, or fixed by, this work)

While applying the Builder versioning migration, `drizzle-kit push` was found to propose deleting real, populated columns on `historical_matches` (530,097 rows), `predictions` (2,575 rows), `backtest_runs`, and `backtest_predictions` — schema drift between the live database and the checked-in Drizzle schema files, entirely unrelated to Builder versioning. It correctly refused only because the environment was non-interactive. **This drift was not touched or resolved** and remains a separate, pre-existing issue for whoever owns the affected tables to address; `pnpm --filter db run push` should not be run in this environment without first reconciling it.

## What would unblock Phase 5C

The exact bytes of `phase5_preregistration_v2.json` and `phase5c_final_run_prompt_rev_b.md` (or a verifiable pointer to where they are actually stored, if not in this repository or the connected Replit workspace), such that their SHA-256 hashes can be confirmed to match the values named in the task specification before any Stage 1 population work begins.
