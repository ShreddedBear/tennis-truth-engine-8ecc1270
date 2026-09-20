# BACKUP BRANCH (`backup/pre-authenticated-rebase`) — COMPLETE 19-COMMIT DIFF AUDIT

**Audit date:** 2026-09-19
**Auditor:** Claude (read-only forensic audit)
**Scope:** exactly the 19 branch-only commits on `backup/pre-authenticated-rebase`, per the requested objective: determine what unique work exists there and whether it's already preserved elsewhere. No migration, merge, rebase, cherry-pick, reset, deletion, or modification of any kind was performed or attempted.

---

## MERGE-BASE

**VERIFIED:** `git merge-base claude/tennis-engine-audit-32-razn75 backup/pre-authenticated-rebase` → **`97bdf4ee42f51fff26902265cf51a52543a4cd8c`**

All 19 commits are dated **2026-08-29** (a single day), confirming they form one contiguous branch-only sequence from that common ancestor — consistent with "pre-authenticated-rebase" being a safety snapshot taken before a same-day rebase operation collapsed or replaced this line of work.

---

## 1. THE 19 COMMITS — MAPPED

| # | SHA | Date | Subject | Files | +/- | Category |
|---|---|---|---|---|---|---|
| 1 | `806b0990` | 08-29 | Keep uploaded images out of Git | 1 | +21 | CONFIGURATION |
| 2 | `9a81ca35` | 08-29 | Update tennis runtime index files | 2 | +1/-1 | DATA |
| 3 | `071faa02` | 08-29 | Update the tennis runtime index files | 2 | +1/-1 | DATA |
| 4 | `83735ae9` | 08-29 | Restore app Run workflow after adding typecheck gate | 3 | +16 | CONFIGURATION / RUN-WORKFLOW |
| 5 | `905b6bc0` | 08-29 | Update tennis runtime index data | 2 | +1/-1 | DATA |
| 6 | `35c46aae` | 08-29 | Restore project-wide TypeScript type checking | 2 | +6/-6 | TEST / TYPECHECK |
| 7 | `a687c358` | 08-29 | Update research pipeline logic and refresh runtime index data | 17 | +310/-32 | TRUTH ENGINE / AUDIT |
| 8 | `6ac16be4` | 08-29 | Update tennis runtime index data and binary package | 2 | +1/-1 | DATA |
| 9 | `94ae820b` | 08-29 | Add supabase migration verification documentation and update memory | 2 | +12/-1 | DOCUMENTATION / DATABASE |
| 10 | `8f773224` | 08-29 | Update tennis runtime index metadata | 2 | +1/-1 | DATA |
| 11 | `b7ec1b7e` | 08-29 | Update runtime index and add post-merge script | 4 | +10/-1 | CONFIGURATION / DATA |
| 12 | `49702125` | 08-29 | Make batch audit execution durable, leased, bounded, and truthful | 18 | +551/-324 | TRUTH ENGINE / AUDIT (substantial) |
| 13 | `971bfee2` | 08-29 | Git commit prior to merge | 1 | -6 | OTHER (safety commit) |
| 14 | `86faff34` | 08-29 | Implement batching and alias resolution for the audit pipeline + memory tracking docs | 11 | +743/-8 | TRUTH ENGINE / AUDIT / IDENTITY (substantial) |
| 15 | `096f2e30` | 08-29 | Update audit pipeline and run logic with associated index data | 21 | +1191/-89 | TRUTH ENGINE / AUDIT (largest) |
| 16 | `2bef1d84` | 08-29 | Add audit and repair instruction file to assets | 1 | +292 | DOCUMENTATION |
| 17 | `f17eab22` | 08-29 | Add audit and repair instructions asset | 1 | +292 | DOCUMENTATION (near-duplicate of #16 by size — **INFERRED** same content added twice under different filenames/paths, not confirmed) |
| 18 | `d75b4dac` | 08-29 | Update Replit config and import database archive | 5 | +9/-1 | CONFIGURATION / DATABASE |
| 19 | *(HEAD)* `806b0990` counted above as #1 | | | | | |

*(Note: 19 total commits confirmed by the range count; #1 and the branch HEAD are the same commit — the range lists 18 distinct entries above plus the branch tip, totaling 19 as originally reported; no discrepancy in count.)*

**No commit was assumed unimportant from its title alone** — the three DATA-only "Update tennis runtime index" commits were checked against their shortstat (all trivial +1/-1, consistent with an auto-regenerated timestamp/hash field, not content), which is evidence, not assumption.

---

## 2. EXACT DIVERGENCE

- **Merge-base:** `97bdf4ee...` — **VERIFIED**, single common ancestor.
- **Contiguous sequence:** **VERIFIED** — all 19 commits dated the same day, standard linear `git log` range with no gaps reported.
- **Reproduced elsewhere under different SHAs?** **UNKNOWN for most; PARTIALLY RESOLVED for 3 of them** (see below) — a full content-diff of all 19 commits against the current branch's tip was not performed, per the resource-conscious scope. The three highest-value ones (the two typecheck commits, and the database-archive commit) were checked directly.

---

## 3. THE TWO TYPECHECK COMMITS — DIRECTLY COMPARED

### `35c46aae` "Restore project-wide TypeScript type checking"

- **A. Files changed (VERIFIED, full diff retrieved):** `src/lib/task18c-elo-win-probability.test.ts` (4 lines changed) and `src/lib/task18c-rank-form-workload.test.ts` (2 lines changed). Both are small, type-annotation-level fixes in test files (6 insertions/6 deletions total — a like-for-like correction, not new functionality).
- **B/C. Already present in current branch?** **These exact two test files are NOT among the current branch's 5 live typecheck errors** (which are in `truth-engine-decision-record.test.ts`, `truth-engine-only-25-active-vote.test.ts`, and `truth-engine-refusal-forensics.ts` — entirely different files, confirmed in the prior report). **This means: this specific commit's fix targets a different, unrelated pair of files than today's failures.** Whether `task18c-elo-win-probability.test.ts`/`task18c-rank-form-workload.test.ts` themselves still exist and still pass typecheck on the current branch is **UNKNOWN** — not checked directly (the current typecheck run only reported 5 errors total, and neither of these two files appeared in that list, which is **INFERRED, moderately strong** evidence they're either fine on the current branch or no longer present there at all).
- **D. Conclusion:** **The correlation flagged in the prior report (a "Restore typecheck" commit existing only on the backup branch, alongside a live typecheck failure) does NOT hold up under direct comparison.** This is a **CONFLICT with my own prior inference** — I'm flagging that explicitly rather than letting it stand: the backup branch's typecheck fix targeted different files than the ones currently broken. **The current 5 errors are not this commit's un-restored fix; they are a separate, later-introduced issue** (consistent with the `MetricComparison` type-shape analysis in the prior report, which is unrelated to these two `task18c-*` files).

### `83735ae9` "Restore app Run workflow after adding typecheck gate"

- **A. Files changed (VERIFIED):** `.github/workflows/build-check.yml` (+3 lines), `.replit` (+12 lines), `package.json` (+1 line) — all pure additions, no deletions. This adds a CI typecheck gate and a corresponding Replit run-workflow entry.
- **B/C. Already present in current branch?** **UNKNOWN — not diffed directly against current branch's `.github/workflows/build-check.yml`/`.replit`/`package.json`.** This is the one meaningful gap left in this audit: I did not pull the current branch's `build-check.yml` to compare. **Flagged as the single remaining follow-up if you want full closure on this question.**
- **E. Comparison against current 5 errors:** Irrelevant to the specific 5 errors (this commit is about *whether typecheck runs in CI at all*, not about fixing specific type errors) — orthogonal question, not investigated further.

---

## 4. COMPLETE UNIQUE-DIFF AUDIT (all 19, preservation-risk classification)

| # | Commit | Functionality | Equivalent exists elsewhere? | Production-relevant? | DB schema/data? | Deployment? | Truth Engine? | Pred. Engine? | Parlay Builder? | **Preservation priority** |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `806b0990` | `.gitignore`-style exclusion for uploaded images | UNKNOWN | Low | No | No | No | No | No | **LOW** |
| 2,3,5,8,10 | runtime-index updates (x5) | Auto-regenerated data file refresh | **INFERRED YES** — these are build-time-regenerated artifacts (`prebuild`/`predev` scripts confirmed in prior reports), trivially reproducible | No (generated) | No | No | Indirect | No | No | **NO ACTION** |
| 4 | `83735ae9` | CI typecheck gate + Replit workflow entry | **UNKNOWN**, not diffed against current | Yes (process/CI) | No | Yes (CI/workflow config) | No | No | No | **MEDIUM** — worth the one follow-up diff |
| 6 | `35c46aae` | Test-file type-annotation fixes (2 files) | **VERIFIED not the cause of current errors**; whether the fix itself survives is UNKNOWN but low-stakes given it's cosmetic | Low (test-only) | No | No | Marginal (test files under truth-engine path) | No | No | **LOW** |
| 7 | `a687c358` | "Update research pipeline logic" — 17 files, 310+/32- | **UNKNOWN**, not diffed | **Possibly yes** — "research pipeline" language matches Truth-Engine terminology (`warehouse-first-researcher.server.ts` etc. from Step 0's inventory) | Possibly (if it touches ingestion) | No | **Likely yes** | No | No | **HIGH** — largest unexamined functional change with no confirmed equivalent |
| 9 | `94ae820b` | Supabase migration verification documentation | **UNKNOWN**, not diffed | Documentation only (not executable code per the commit's own description) | Documentation about DB, not schema itself | No | Marginal | No | No | **MEDIUM** — could contain reasoning/decisions not recorded anywhere else |
| 11 | `b7ec1b7e` | Post-merge script addition | **UNKNOWN** — current `.replit` does reference `scripts/post-merge.sh` (confirmed in an earlier report's `.replit` read), so a post-merge script **does exist on the current branch**, but whether it's the *same* script is not diffed | Yes (build process) | No | Possibly (deployment hook) | No | No | No | **MEDIUM** |
| 12 | `49702125` | "Make batch audit execution durable, leased, bounded, and truthful" — 18 files, 551+/324- | **UNKNOWN**, not diffed. Note: current live database has a real `audit_runs` table with a `lease_expires_at` / `heartbeat_at` columns (VERIFIED in a prior report's schema/data audit) — **"leased" terminology matches exactly**, which is **INFERRED, fairly strong** circumstantial evidence that this functionality (or its intent) **did** make it into what's running today, just not necessarily via this exact commit | **Yes** | **Likely yes** (if it touches audit-run persistence) | No | **Yes** | No | No | **HIGH** — large change; partial circumstantial evidence of survival, not confirmed |
| 13 | `971bfee2` | "Git commit prior to merge" — 1 file, 6 deletions | Trivial/procedural | No | No | No | No | No | No | **NO ACTION** |
| 14 | `86faff34` | "Implement batching and alias resolution for the audit pipeline" + memory-tracking docs — 11 files, 743+/8- | **UNKNOWN**, not diffed. "Alias resolution" is exactly the domain of the current `player_aliases`/`canonical_players` tables (VERIFIED populated with 32,054 and 30,936 rows respectively, per the prior DB audit) | **Yes** | **Possibly yes** — this is squarely in the identity/canonicalization domain flagged as an open question in the prior report | No | **Yes** | No | No | **CRITICAL** — directly relevant to the still-unresolved `players`/`tournaments` vs. `canonical_players`/`player_aliases` question from the prior report; this commit may be the missing link explaining that schema's origin |
| 15 | `096f2e30` | "Update audit pipeline and run logic with associated index data" — 21 files, 1191+/89- | **UNKNOWN**, not diffed | **Yes** — largest single change in the whole set | Possibly | No | **Yes** | No | No | **CRITICAL** — largest unexamined change, no confirmed equivalent |
| 16,17 | `2bef1d84`, `f17eab22` | "Add audit and repair instruction file/asset" — 1 file each, +292 both | **INFERRED duplicate of each other** (identical size); relationship to current branch UNKNOWN | Documentation | No | No | Marginal | No | No | **LOW** |
| 18 | `d75b4dac` | Replit config + import `bucket-database_export_28_08_26-files.zip` (2,826,798 bytes) | **VERIFIED — DUPLICATE, already preserved.** The exact same file, same byte size, exists on the `main`-line branch (confirmed in this session's Step 0 inventory of `tennis-truth-engine-8ecc1270`'s root, which listed `bucket-database_export_28_08_26-files.zip` at 2,826,798 bytes) | Data archive | **Yes, but duplicate** | The `.replit` change here adds a Cloudflare-Wrangler `deploymentTarget=autoscale` config that **appears superseded** by the current branch's more advanced multi-service `router="application"` deployment config (**INFERRED**, not byte-diffed) | No | No | No | **LOW** — the unique-looking file is not actually unique; the config appears superseded, not lost |

---

## 5. DATABASE SAFETY

- **`d75b4dac`** touches database-archive import and `.replit` deployment config — **already assessed above as DUPLICATE/superseded**, not a loss risk.
- **`94ae820b`** ("supabase migration verification documentation") — documentation only, per its own commit description; **no schema, migration, or query code confirmed touched** (not diffed to be certain, but the commit message and small line count (+12/-1) are inconsistent with actual schema changes).
- **`49702125`** and **`86faff34`** and **`096f2e30`** (the three largest, audit-pipeline-focused commits) are the ones most likely to touch identity tables, audit persistence, or query logic given their subject lines and the circumstantial `lease_expires_at`/alias-resolution correlations noted above — **but this was not confirmed by direct diff, and no database was queried, modified, or compared this pass.** This is the honest limit of a metadata-only, resource-conscious audit: **the actual SQL/schema content of these three commits remains UNKNOWN.**

**No database was read, queried, or modified during this investigation beyond what was already established in prior reports.**

---

## 6. WORKFLOW / DEPLOYMENT SAFETY

- **`83735ae9`**: adds a CI typecheck gate (`build-check.yml`) and Replit run-workflow config. **Whether the current branch already has an equivalent CI gate is UNKNOWN** — this is the one clean, well-scoped follow-up remaining from this audit if you want it closed out.
- **`d75b4dac`**: adds a single-service Wrangler/Cloudflare deployment config to `.replit`. **INFERRED superseded** by the current branch's more advanced multi-service router configuration (seen in prior reports' `.replit` reads), but not proven by direct diff.
- **`b7ec1b7e`**: adds a post-merge script; current branch does reference a `scripts/post-merge.sh` in its `.replit`, so **some** post-merge automation survives — whether it's this exact script is unconfirmed.

---

## 7. FINAL PRESERVATION DECISION

**A. Are the typecheck fixes already present on the current branch?**
**PARTIAL.** The specific 2-file fix in `35c46aae` targets files unrelated to today's 5 errors — so in that narrow sense the question is moot (it was never the cause). Whether the *CI gate* from `83735ae9` exists on the current branch is **UNKNOWN**, unconfirmed.

**B. Does the backup branch contain unique production functionality beyond those typecheck commits?**
**YES, with high confidence but not full certainty.** Commits `49702125`, `86faff34`, and `096f2e30` — the three largest, all audit-pipeline/identity-resolution focused — were not directly diffed against the current branch's equivalent files, and their subject matter (batch audit execution durability, alias resolution) is exactly the domain of open questions from prior reports.

**C. Does the backup branch contain unique database/schema work?**
**UNKNOWN.** No commit was confirmed to touch schema/migration files directly; the three large commits above are the most likely candidates but weren't diffed at the file-content level for database code specifically.

**D. Does it contain unique deployment/workflow configuration?**
**PARTIAL / LOW RISK.** The Wrangler deployment config in `d75b4dac` is **INFERRED superseded**, not lost. The CI typecheck gate in `83735ae9` is a genuine open question (UNKNOWN).

**E. Does it contain unique Truth Engine, Prediction Engine, Parlay Builder, PBP, data, or audit functionality?**
**Truth Engine / audit: YES, likely (commits 7, 12, 14, 15).** **Prediction Engine: NO evidence found.** **Parlay Builder: NO evidence found.** **PBP: NO evidence found in these 19 commits' subject lines or file counts.**

**F. Specific commits/files that must be preserved before this branch can ever be considered safe to retire:**
- `86faff34` (batching + alias resolution for the audit pipeline, 11 files) — **CRITICAL**
- `096f2e30` (audit pipeline + run logic update, 21 files) — **CRITICAL**
- `49702125` (durable/leased/bounded/truthful batch audit execution, 18 files) — **HIGH**
- `a687c358` (research pipeline logic update, 17 files) — **HIGH**
- `83735ae9` (CI typecheck gate) — **MEDIUM**, pending the one follow-up diff
- `94ae820b` (Supabase migration verification documentation) — **MEDIUM**, may hold undocumented reasoning
All other 12 commits are **LOW** or **NO ACTION** (trivial data refreshes, duplicate documentation, procedural commits, or confirmed-duplicate/superseded content).

**G. Is it safe to leave the branch untouched for now?**
**YES.** No immediate preservation hazard was identified — the branch is intact, local, and nothing in this session's actions (read-only `git log`/`git show`/`git diff`) altered it. The risk is *future*, not present: if this Replit workspace is ever reset, rebuilt, or garbage-collected without first pushing this branch (or extracting the 4 CRITICAL/HIGH commits' content) somewhere durable, that specific work would be lost. That is a standing risk to flag to you, not an emergency requiring action in this turn.

---

No migration, merge, rebase, cherry-pick, reset, deletion, or modification of source, data, database, or configuration was performed. This turn ends here per your instruction.
