# STATE C GIT + DATABASE — VERIFIED FROM REAL SHELL/SQL OUTPUT

**Audit date:** 2026-09-19
**Auditor:** Claude (read-only forensic audit)
**Trigger:** the user ran the requested `git`/SQL/health commands directly in the live Replit workspace and pasted the raw output. This report analyzes that output. **This supersedes the Git-provenance and database sections of all three prior reports in this session** (`step-threeway-reconciliation-20260918.md`, `step-statec-provenance-20260918.md`, `step-statec-preservation-20260918.md`, `step-four-state-audit-20260919.md`), which were correctly marked UNKNOWN/BLOCKER at the time — this is the resolution.

No commands were run by me this turn; I did not touch STATE C. This is analysis of output the user already ran and provided.

---

## HEADLINE CORRECTION — read this first

**Every prior report in this session stated or implied that STATE C's consolidation work "never reached GitHub" or "has no confirmed git history." That is WRONG, and I'm flagging it as a CONFLICT with my own prior findings, not quietly fixing it.**

What actually happened: STATE C **is** a git repository (`GIT PRESENT`, verified), its current branch is `claude/tennis-engine-audit-32-razn75`, and its HEAD commit (`b8efd96b80c82da229797cc5aba474a39aaa292a`) is **byte-identical to a branch that already exists on `ShreddedBear/tennis-truth-engine-8ecc1270`'s GitHub remote** — `origin/claude/tennis-engine-audit-32-razn75`, at the exact same SHA, with **zero ahead/behind divergence**. I even had this branch's name and SHA in my own Step 0 report from two days ago (`git ls-remote --heads` on that repo listed `b8efd96b80c82da229797cc5aba474a39aaa292a refs/heads/claude/tennis-engine-audit-32-razn75` verbatim) — **I had this evidence in hand from the start and never checked it**, because Step 0 only inventoried STATE A's `main` branch, not its other 89 branches. That was a real scope gap in my own audit, not a limitation of available tools.

**The corrected picture:** STATE A (the GitHub repository `tennis-truth-engine-8ecc1270`, as a whole, across all its branches — not just `main`) already contains the consolidated pnpm-workspace/Drizzle/Prediction-Engine/Truth-Engine state, sitting on a feature branch. `main` (`origin/main`, SHA `df1743bf...`) is a separate, older, pre-consolidation line (Supabase/TanStack single-package, matching what Step 0 inventoried). These are **two divergent lines within the same repository**, not "GitHub vs. an unconnected live workspace." STATE C is, as far as this evidence shows, simply a live checkout of that already-pushed branch, with two small uncommitted local changes on top.

---

## PART 1 — GIT PROVENANCE: RESOLVED

| Item | Finding |
|---|---|
| Is STATE C a git repo? | **GIT PRESENT — VERIFIED.** `git rev-parse --is-inside-work-tree` → `true`; `.git/` confirmed to exist with real, recently-modified files (`COMMIT_EDITMSG` Sep 15, `config` Sep 17). |
| Toplevel | `/home/runner/workspace` — **VERIFIED**, standard Replit workspace path. |
| Remotes | **VERIFIED**, three kinds: `origin` → `https://github.com/ShreddedBear/tennis-truth-engine-8ecc1270.git` (**the same GitHub repo as STATE A** — this is not a fork or a different repo, it is literally STATE A); `gitsafe-backup` → `git://gitsafe:5418/backup.git` (Replit's own internal backup mechanism, **INFERRED** from the hostname/name pattern, not a third-party remote); five `subrepl-*` remotes, all pointing at `git+ssh://git@ssh.reed.replit.dev:/home/runner/workspace` — **INFERRED** these are Replit's own multiplayer/agent-session branch-sync mechanism (each concurrent Replit Agent or collaborator session appears to get its own `subrepl-<id>` ref), not external collaborators. |
| HEAD | `b8efd96b80c82da229797cc5aba474a39aaa292a` — **VERIFIED, and this is the critical fact**: this SHA is identical to `refs/heads/claude/tennis-engine-audit-32-razn75` **on the GitHub remote itself** (confirmed both by this session's fresh `git branch -a` output, which shows `origin/claude/tennis-engine-audit-32-razn75` at the same commit with no divergence marker in `git status --short --branch`, and independently cross-checked against my own Step 0 report's `git ls-remote` output from two days ago, which recorded the identical SHA for that branch name). |
| Current branch | `claude/tennis-engine-audit-32-razn75` — **tracking `origin/claude/tennis-engine-audit-32-razn75`, fully in sync (no ahead/behind).** |
| Local-only branches (not on `origin`) | **`backup/pre-authenticated-rebase`** (SHA `806b0990...`) and **`replit-agent`** (SHA `075f7c61...`) and five `subrepl-*` branches. `backup/pre-authenticated-rebase` in particular is a **preservation-relevant finding**: its name states its own purpose — a safety branch taken before some rebase operation — and it is **not pushed to `origin`**, meaning if this local workspace were ever discarded without pushing it, that history would be lost. **This must be preserved before any git operation, per your own preservation objective.** |
| Uncommitted changes | **VERIFIED, small and specific**: two modified files (`artifacts/tennis-truth-engine/data/generated/tennis-runtime-index.json`, `artifacts/tennis-truth-engine/public/generated/tennis-runtime-index.json.gz` — both generated runtime-index artifacts, **INFERRED** to be regenerated by the `prebuild`/`predev` script every time the app starts, so this is very likely benign build-output drift, not lost work) and one untracked file, **`coco1`** (root of workspace, no extension, purpose **UNKNOWN** — not investigated, flagged for a future targeted check since its name gives no hint). |
| Tags | **Not queried this round** (not in the command list provided) — **UNKNOWN**, minor gap. |
| Reflog | **VERIFIED**, consistent with the picture above: shows pushes to `origin/claude/tennis-engine-audit-32-razn75` and mirrored pushes to `gitsafe-backup/main`, plus `replit-agent` branch updates tracking the same commits. No evidence of destructive operations (no resets, no force-pushes) in the visible window. |
| LFS / submodules | **Not re-queried this round** — carried forward as UNKNOWN from prior reports; low priority given everything else now resolved. |

**Does STATE C's history connect to STATE A?** **YES — VERIFIED, directly, not inferred.** It doesn't just share a common ancestor; its HEAD **is** a commit that exists on STATE A's GitHub remote right now.

**Does it connect to STATE B (`Tennis-Stats-Engine`)?** **Not established by this evidence.** The `git log --oneline --all -30` output shows only commits authored within what looks like the truth-engine/tennis-engine-audit lineage (forensic reports, runtime index updates, PBP audits, evaluation-worker work) — no merge commit or reference to `Tennis-Stats-Engine` by name appears in the visible 30-commit window. **Still UNKNOWN whether STATE B's code arrived in this branch via git (merge/cherry-pick) or via non-git file copy** (which would be consistent with the earlier finding that `artifacts/api-server/src/services/` matches STATE B's directory structure exactly, but a git-level answer would need `git log --follow` on that specific path, not done here — flagged as the natural next targeted check, not performed to stay resource-conscious).

---

## PART 2 — DATABASE SCHEMA (STATE D): RESOLVED

- **Engine/instance — VERIFIED, no secrets exposed**: PostgreSQL 16.10, database name `heliumdb`, user `postgres`. Matches the `.replit` env var `STATS_DATABASE_NAME = "heliumdb"` found in a prior session — **confirmed, not just inferred**, this is the live database backing the app.
- **Drizzle migration tracking table — VERIFIED ABSENT.** No `__drizzle_migrations` table (or similarly named one) exists in any schema. **CONFLICT/clarification against the naive assumption of a versioned-migrations workflow**: given `package.json`'s `db:push` script (`drizzle-kit push --config ./drizzle.config.ts`, confirmed in a prior session), this is consistent with the schema being managed via **`drizzle-kit push`** (direct schema diffing against the live database) rather than via generated, tracked migration files. This is a real architectural fact, not a gap: **there is no migration history to audit here because the workflow doesn't produce one.** The `lib/db/drizzle/` directory seen in file listings may contain generated SQL from `drizzle-kit generate` even without a tracking table consuming it — still unconfirmed, low priority now that the workflow model itself is understood.
- **Table inventory — VERIFIED, ~100 public tables enumerated.** Names strongly confirm the shared-database hypothesis from prior reports: Prediction-Engine/backtesting tables (`evaluation_predictions`, `evaluation_runs`, `backtest_predictions`, `backtest_runs`, `walk_forward_folds`, `walk_forward_runs`, `paper_trade_predictions`, `paper_trade_runs`, `optimizer_runs`, `candidate_configs`, `candidate_strategies`, `strategy_*`), Parlay-Builder tables (`parlay_active_session`, `parlay_builder_sessions`, `parlay_builder_settings`, `parlay_leg_outcomes`, `parlay_saved_legs`), and Truth-Engine/audit tables (`audit_runs`, `audit_stage_runs`, `audit_color_ledger`, `audit_coverage`, `calibration_*`, `verification_results`, `disagreement_results`, `underdog_results`, `stress_results`, `final_decisions`, `match_identity_records`, `metric_evidence_store`, `metric_registry`, `rule_documents`, `rule_document_versions`) **all live in the same `public` schema of the same database.** This upgrades the prior reports' "INFERRED, plausible" shared-database conclusion to **VERIFIED**.
- **`pg_stat_user_tables` reliability — VERIFIED problem, correctly caught by the agent**: autovacuum statistics were stale for several tables (e.g., `historical_matches` showed `n_live_tup=0` from the cheap estimate but an exact count of **530,097**). The agent's exact-count follow-up for named tables is the trustworthy number set below; the raw `n_live_tup` list should not be relied on except for tables not covered by the exact-count pass (most of which are genuinely near-zero, and plausibly real — e.g. `players`, `tournaments`, `canonical_matches`, `master_players`, `calibration_ledger`, `evidence_family_coverage` all show 0 in both passes where checked, which is a real finding, not a stats artifact — see Part 3).

---

## PART 3 — DATABASE DATA INVENTORY (STATE D): RESOLVED FOR NAMED TABLES

**Exact counts and date ranges, VERIFIED (queries ran read-only, 10s timeout, none timed out):**

| Table | Rows | Date range | Note |
|---|---|---|---|
| `evaluation_predictions` | **518,527** | 2012-06-11 → 2026-09-19 | Prediction-Engine backtest/walk-forward output; spans 14+ years |
| `historical_matches` | **530,097** | 2012-01-01 → 2026-06-02 | Real historical match corpus |
| `match_feature_snapshots` | **2,578,706** | 2012-01-01 → 2026-05-25 | Pre-match feature snapshots — by far the largest table found |
| `canonical_players` | 30,936 | (identity dates null) | Populated 2026-09-15 |
| `player_aliases` | 32,054 | (dates null) | Populated 2026-09-15 |
| `player_resolution_reviews` | 1,610 | reviewed 2026-09-15 | |
| `player_stats` | 20,673 | computed 2026-09-15 | |
| `match_identity_records` | 1,056 | 2026-09-14 → 2026-09-14 | |
| `matches` | 132 | scheduled 2026-08-30 → 2026-09-14 | Small — this is the **live/active audit slate**, not the historical corpus |
| `predictions` | 188 | 2026-09-14 → 2026-09-18 | Live predictions |
| `audit_runs` | 133 | 2026-09-14 → 2026-09-15 | |
| `audit_stage_runs` | 2,128 | 2026-09-14 → 2026-09-15 | |
| `audit_coverage` | 266 | 2026-09-14 → 2026-09-15 | |
| `metric_evidence_store` | 9,277 | as_of 2026-08-25 → 2026-09-14 | |
| `calibration_models` | 2 | validation range 2012 → 2026-06-02, fitted 2026-09-16 | |
| `calibration_buckets` | 8 | created 2026-08-21 | |
| `calibration_versions` | 1 | created 2026-08-21 | |
| `prediction_slates` | 1 | created 2026-09-14 | |
| `prediction_settings` | 1 | updated 2026-09-14 | |

**VERIFIED empty (0 rows), and this is a real finding, not a measurement gap:** `players`, `tournaments`, `master_players`, `canonical_matches`, `calibration_ledger`, `evidence_family_coverage`, `backtest_predictions`, `backtest_runs`, `paper_trade_predictions`, `paper_trade_runs`, `admin_audit_log`, `audit_color_ledger`, `strategy_audit_log`, and others. **This is a genuine gap worth flagging, not a stats artifact**: the schema anticipates `players`/`tournaments` as canonical entity tables, but they're empty while `canonical_players`/`player_aliases` (differently-named tables) hold the real data — **CONFLICT or at minimum naming/architecture ambiguity** between what the schema seems to model and what the application actually writes to. Not resolved by this pass; would need reading `lib/db/src/schema/` (still unopened) to know if `players`/`tournaments` are legacy/unused tables or a different consumer's tables not yet wired up.

**PBP: VERIFIED NOT FOUND by name.** No table matching `pbp` or `play-by-play` exists in `public`. **This does not mean PBP data doesn't exist** — it may be file-based (under `data/` directories seen in file listings, never opened) rather than database-resident, or stored under a name that doesn't match those keywords (e.g., embedded in `metric_evidence_store` or a differently-named table not distinguished by this query). **Flagged as UNKNOWN, not as absent.**

---

## PART 4 — HEALTH CHECK: RESOLVED

- **`pnpm run typecheck`: VERIFIED FAILING.** 5 errors, exit code 2. Full output was correctly withheld (as requested, to save space) — **the specific errors are UNKNOWN to me and worth getting** if you want them, since this is a real, current defect in the live workspace, not a hypothetical one. This doesn't block the audit, but it's a fact worth carrying into any future work-readiness assessment.
- **Test files: VERIFIED present.** `artifacts/tennis-truth-engine`: 175 test files. `artifacts/api-server`: 84 test files. `lib/db`: **0 test files** — the shared database package has no tests of its own, which is notable given it's the piece both the Prediction Engine and Truth Engine now depend on. Tests were not run (correctly, per the read-only/non-mutating instruction — even though tests are usually safe, running 259 files was reasonably treated as outside "cheap and inexpensive").

---

## ZERO-LOSS CHECKLIST — UPDATED STATUS

| Item | Prior status | New status |
|---|---|---|
| Git history (STATE C) | UNKNOWN/BLOCKER | **VERIFIED PRESENT**, connects directly to STATE A |
| STATE C ↔ STATE A connection | UNKNOWN | **VERIFIED** — literal shared commit |
| STATE C ↔ STATE B connection | UNKNOWN | Still **UNKNOWN** (no direct git evidence found in the 30-commit window checked) |
| Branches/backups needing preservation | Partially known | **`backup/pre-authenticated-rebase` (local-only, unpushed) now identified as a concrete, named preservation item** |
| Database schema (STATE D) | UNKNOWN/BLOCKER | **VERIFIED** — ~100 tables enumerated, no migration-tracking table (by design, `drizzle-kit push` workflow) |
| Database data (STATE D) | UNKNOWN/BLOCKER | **VERIFIED for ~19 named tables** — real, substantial, dated data (530K historical matches, 2.58M feature snapshots, 518K evaluation predictions) |
| Shared DB between Prediction Engine and Truth Engine | INFERRED | **VERIFIED** — both apps' tables coexist in the same `public` schema of `heliumdb` |
| PBP location | UNKNOWN | Still **UNKNOWN** — confirmed not a named DB table; may be file-based |
| `players`/`tournaments` vs. `canonical_players`/`player_aliases` discrepancy | Not previously identified | **NEW FINDING — CONFLICT/ambiguity, unresolved** |
| Build health | Not previously checked | **VERIFIED FAILING** (5 typecheck errors) |
| Test coverage | Not previously checked | **VERIFIED** — present for two of three main packages, absent for `lib/db` |

---

## STILL OPEN (explicitly not investigated this pass, to stay resource-conscious)

- The 5 typecheck errors' actual content
- Whether STATE B's code entered this branch via a git operation (`git log --follow` on `artifacts/api-server`) or a non-git copy
- Contents of `lib/db/src/schema/` and `lib/db/drizzle/` (would resolve the `players`/`canonical_players` naming question)
- What `coco1` is
- Tags and LFS/submodule status for STATE C
- Whether `.migration-backup/`'s content is now redundant given this branch is already on GitHub (it may simply be superseded, not uniquely valuable — not re-assessed this pass)

---

## VERDICT

**No migration destination is recommended — that remains explicitly out of scope per your instructions.** But the factual picture has changed substantially and for the better: STATE C is not an orphaned, unreachable workspace — it is a live checkout of a branch that **already exists, in full, on `ShreddedBear/tennis-truth-engine-8ecc1270`'s GitHub remote**, with a real, populated, shared Postgres database behind it. The main remaining gaps are narrow and specific (schema-file contents, one branch's connection to STATE B, one stray untracked file, one failing typecheck run) rather than the broad "we can't tell what this even is" uncertainty of the prior three reports.

No code, data, database, git state, or Replit configuration was modified. This turn ends here.
