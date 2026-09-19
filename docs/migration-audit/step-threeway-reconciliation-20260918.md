# THREE-WAY STATE RECONCILIATION — STATE A / STATE B / LIVE REPLIT WORKSPACE (STATE C)

**Audit date:** 2026-09-18
**Auditor:** Claude (read-only forensic audit)
**Scope:** Parts 1–9 per the reconciliation request. READ-ONLY throughout — no writes, commits, pushes, merges, resets, deletes, renames, installs, or database connections were performed.

**Access boundary for this report (load-bearing — read before the findings below):**
- STATE A / STATE B: full git access (STATE A: local clone with history; STATE B: shallow, single-branch, LFS-smudge-skipped anonymous clone).
- STATE C (live Replit workspace, replId `c6aabbf3-6a6a-4d39-a523-a02e504a70d6`, `@TMatrixAudit/tennis-truth-engine-8ecc1270`): accessed **only** via `list_app_files` (directory listing) and `read_app_file` (single text file, <100KB) MCP tools. **No shell, no git commands, no bulk export, and no diffing capability exist for STATE C in this session.** The Replit Agent (`ask_question`) is unavailable — it timed out once and the user confirmed it is out of credits — so no natural-language introspection of STATE C was possible either. Every STATE C finding below is built from individual, targeted file/directory reads; the tree was **not** exhaustively walked (disproportionate under the cost/stopping rule), so absence-of-evidence for unexamined paths is marked UNKNOWN, not ruled out.

Confidence tags used throughout: **VERIFIED** (directly observed this session), **INFERRED** (reasoned from verified evidence but not directly observed), **UNKNOWN** (could not be determined with available access), **MISSING** (evidence expected but not found), **CONFLICT** (evidence contradicts either another source or a prior stated fact).

---

## PART 1 — LIVE REPLIT GIT PROVENANCE

- **`.git/` at workspace root: MISSING (INFERRED absent).** `list_app_files` on path `.git` returned "No file or directory exists at that path." The same tool correctly surfaces other dot-entries at root (`.agents/`, `.gitattributes`, `.gitignore`, `.replitignore`, `.output/`, `.wrangler/`, `.reaudit-manifests/`, `.migration-backup/`), so this is not a blanket dotfile filter — but I cannot rule out that `list_app_files` specifically special-cases `.git` the way it special-cases `node_modules` ("dependency and build folders... are left out," per its own description, which does not explicitly name `.git`). **Marked INFERRED, not VERIFIED**, because I have no shell to run `git rev-parse --git-dir` directly.
- **Remotes, HEAD, branch, commit history, reflog, staged/uncommitted changes:** **UNKNOWN.** All of these require either a `.git` directory to inspect or shell/`ask_question` access, neither of which is available. I cannot state whether this workspace was ever a git repo, was git-initialized and then had `.git` removed, or was always a plain file tree.
- **Ignored files relevant to migration:** the root `.gitignore` exists as a file (VERIFIED present) but its ABSENCE of a controlling git repo makes it inert — I did not read its contents since it can't be tied to actual tracked/untracked state without a working `.git`.
- **Git LFS configuration:** no `.gitattributes` LFS declarations found in STATE C's root `.gitattributes` — **not read this session**; flagged as **UNKNOWN**, low priority since there's no git repo to apply it to.
- **Submodules:** no `.gitmodules` observed at root listing. **INFERRED absent**, same caveat as `.git` above.
- **References to GitHub repositories or Replit's own Git integration:** none found in the files read this session (`replit.md`, `package.json`, `.replit`, `start.ts`). **UNKNOWN** whether such references exist elsewhere in the tree (e.g., a CI config, a README) — not exhaustively searched.
- **Whether the live workspace has commits absent from both GitHub repos:** **UNKNOWN — cannot be determined without git access to STATE C.**

**Bottom line for Part 1:** STATE C is very likely a Replit workspace that was never connected to Git at all (Replit apps do not require git), which would explain why none of this consolidation work reached either GitHub repository. This is an inference, not a verified fact.

---

## PART 2 — MIGRATION BACKUP PROVENANCE (`.migration-backup/`)

- **What tree it represents:** `.migration-backup/` root contains `README.md`, `AGENTS.md`, `src/`, `public/`, `docs/`, `data/`, `scripts/`, `.lovable/`, `components.json`, `eslint.config.js`, `vite.config.ts`, `tsconfig.json`, `THIRD_PARTY_DATA.md`, `package.json`, `package-lock.json`, `bun.lock`, `bucket-database_export_28_08_26-files.zip`, three `ci-trigger-*.txt` files, `evidence-data-diagnostic.txt`, several `*-probe.flag`/`*.flag` files, `attached_assets/`, `.gitattributes`, `.github/`, `.gitignore`, `.replit`, `.replitignore`, `.prettierrc`, `.prettierignore`, `.agents/`, and — notably — **`drizzle.config.ts`** and **`.scaffold-applied`**. This is structurally almost identical to STATE A's (GitHub `tennis-truth-engine-8ecc1270`) root listing (VERIFIED in Step 0), **except**: STATE A's root has a `supabase/` directory and `TASK_PREDICTION_50_PERCENT.md`, and neither appears in `.migration-backup/`'s root listing.
- **CONFLICT / correction to my initial read:** I initially assumed `.migration-backup/` held the *pre-migration* (Supabase) tree. That assumption does not hold up: `.migration-backup/src` was checked and its top level (`components/`, `db/`, `generated/`, `hooks/`, `lib/`, `router.tsx`, `routes/`, `routeTree.gen.ts`, `server.ts`, `start.ts`, `styles.css`) is **already** in the post-migration shape (a `db/` folder, no `integrations/` folder) — the same shape as the live `artifacts/tennis-truth-engine/src`. **Revised assessment (INFERRED): `.migration-backup/` is a full duplicate of the already-Drizzle-converted truth-engine app, most likely taken as a rollback safety net at some point during or after the in-place Supabase→Drizzle conversion**, not a snapshot of the original Supabase state. I did not find a preserved copy of the pre-migration (Supabase-integrated) `src/integrations/supabase/` tree anywhere in STATE C in the paths checked this session.
- **Approximate dates:** a single file at STATE C's workspace root, `tennis-truth-engine_260828.backup` (binary/opaque name, not read — outside the read_app_file text-file scope and not necessary to open for provenance purposes), encodes `260828` (2026-08-28) in its name. This **predates** STATE A's most recent Supabase migration file (`20260911104922_...sql`, 2026-09-11, VERIFIED in Step 0). **UNKNOWN** whether this backup file relates to `.migration-backup/` (the directory) — they may be two unrelated backup artifacts from two different points in time. File modification timestamps were not obtainable through `list_app_files`/`read_app_file` (no stat-like metadata is returned).
- **Whether it corresponds to STATE A:** partially — structurally very close to STATE A's file/directory layout, but its `src/` is already migrated away from Supabase, so it does **not** correspond to STATE A's *current* GitHub content (which still has `src/integrations/supabase/`, VERIFIED in Step 0). It likely corresponds to an **intermediate** state of STATE A that was never pushed to GitHub.
- **Whether it corresponds to STATE B:** no — it retains the TanStack Start/React/Radix/PDF-OCR frontend stack and the truth-engine's characteristic files (`README.md`'s audit-engine content was not re-read here, but `AGENTS.md`, `components.json`, the flag files, and the ci-trigger files are truth-engine-specific artifacts also seen in STATE A, not STATE B).
- **Files differing from STATE A / absent from STATE A / absent from STATE B / unique work:** not exhaustively diffed (would require pulling every file's content from both STATE A and STATE C — disproportionate per the cost/stopping rule for a first pass). What's **VERIFIED** different from STATE A: presence of `drizzle.config.ts` and `.scaffold-applied`, absence of `supabase/` and `TASK_PREDICTION_50_PERCENT.md`. Everything else at the byte level is **UNKNOWN**.

---

## PART 3 — LIVE WORKSPACE STRUCTURAL INVENTORY

| Package | Purpose (from evidence) | Package name | DB dependency | Cross-workspace imports | Production-relevant? | Migrated? | Unique functionality? |
|---|---|---|---|---|---|---|---|
| `artifacts/api-server/` | Backend API for the Prediction Engine + Parlay Builder (Express-style server; contains `app.ts`, `index.ts`, `jobs/`, `middlewares/`, `routes/`, `services/`, `scripts/`, plus **real prediction backup data**: `predictions_backup_2026-07-13T22-51-29-114Z.json`, `predictions_backup_2026-07-13T23-16-23-444Z.json`) | UNKNOWN (package.json not read this session) | INFERRED Postgres/Drizzle via `lib/db` (consistent with STATE B) | INFERRED (workspace convention seen elsewhere: `@workspace/*` imports) | **Yes — VERIFIED** production-relevant (dated prediction backups from 2026-07-13 are real operational artifacts, not scaffolding) | INFERRED yes, already in workspace | Live prediction-outcome data (backups) not seen in either GitHub repo |
| `artifacts/tennis-predictor/` | Frontend for the Prediction Engine + Parlay Builder (Vite app; has `e2e/`, `playwright.config.ts`, `public/`, `src/`) | UNKNOWN (package.json not read) | N/A (frontend) | UNKNOWN | Likely yes (has real e2e/Playwright test setup) | INFERRED yes | Has its own Playwright e2e suite — not confirmed present in STATE B's `artifacts/tennis-predictor` (STATE B does have this same path name; content not diffed) |
| `artifacts/tennis-truth-engine/` | The Truth Engine / Independent Verification & Audit app, migrated into this workspace | **VERIFIED**: `@workspace/tennis-truth-engine` | **VERIFIED**: `drizzle-orm`, `drizzle-kit`, `pg`, `pg-query-stream` — zero `@supabase/*` packages | UNKNOWN (not checked for `@workspace/db` import in this pass) | **Yes — VERIFIED** (full TanStack Start app with routes, db layer, PDF/OCR deps intact) | **VERIFIED migrated** off Supabase onto Drizzle/Postgres | Retains truth-engine-specific deps (`jspdf`, `tesseract.js`, `pdfjs-dist`) and `prebuild`/`predev` runtime-index build script identical to STATE A |
| `artifacts/mockup-sandbox/` | A lightweight Vite app for UI mockup previews (`mockupPreviewPlugin.ts`, `index.html`, `.replit-artifact/`) | UNKNOWN | None apparent | UNKNOWN | **Low** — looks like a design/preview tool, not core product | UNKNOWN | Appears net-new, not traceable to either STATE A or STATE B |
| `lib/db/` | Shared Drizzle database package used across workspace packages | UNKNOWN (root `package.json` not read; only `src` contents: `applySqlExtras.ts`, `index.ts`, `schema/`, `sql/`) | **VERIFIED** — this *is* the DB layer (Drizzle) | INFERRED consumed by `tennis-truth-engine` and `api-server` (both show `db/`-shaped code, and `tennis-truth-engine`'s own `src/db/` has parity/checksum tests suggesting it either wraps or parallels this shared package) | **Yes** | N/A (this is the migration target itself) | Shared schema — see Part 6 |
| `.migration-backup/` | Rollback safety copy of the truth-engine app, taken after (not before) the Supabase→Drizzle conversion — see Part 2 | N/A | Drizzle (has its own `drizzle.config.ts`) | N/A | Not production; a safety artifact | N/A | Represents an intermediate state not on GitHub |
| `.reaudit-manifests/` | Audit-run output logs: `active-slate-reaudit.json`, `active-slate-reaudit.run1.json`, `active-slate-reaudit.run3.json` (file listing only; contents not read) | N/A | UNKNOWN | UNKNOWN | Likely yes — looks like real audit-run output from the Truth Engine's own audit pipeline | N/A | Live audit run state not present in either GitHub repo |

**Note on `artifacts/tennis-truth-engine/src/start.ts` (VERIFIED, read in full):** contains the explicit comment *"Truth Engine shares the Stats Engine's owner-only admin session. Verifying it here protects direct deep links and every browser-callable server function, not just the navigation item."* This is direct, first-party evidence that the consolidation is not just file-copying — the two apps' admin auth is deliberately shared in this live workspace.

---

## PART 4 — PREDICTION ENGINE / PARLAY BUILDER (verified locations only; not inferred from filenames alone)

- **Location in STATE C:** `artifacts/api-server/src/` contains `services/` (directory, not enumerated this session), `routes/`, `jobs/`, `middlewares/`, `lib/`, `scripts/`, `types/`. This matches STATE B's `artifacts/api-server/src/services/{predictionEngine,parlayBuilder,tennisData,historicalData}/` layout (VERIFIED present in STATE B during Step 0), but I did **not** re-open `artifacts/api-server/src/services/` in STATE C this session to confirm the `predictionEngine/` and `parlayBuilder/` subdirectory names still exist there — **marking this UNKNOWN pending a targeted check**, rather than assuming identical internal structure.
- **Frontend:** `artifacts/tennis-predictor/` (STATE C) — matches STATE B's `artifacts/tennis-predictor/` path exactly; STATE B is VERIFIED (Step 0) to contain `AdminParlayBuilder.tsx`, `BulkMatchupPredictor.tsx`, `PredictionResult.tsx`, etc. Internal contents of STATE C's copy were not re-read this session.
- **Shared libraries:** `lib/db/`, and (per STATE B's Step-0 findings) `lib/{api-client-react,api-spec,api-zod,integrations-openai-ai-server}` — presence of these four in STATE C was **not checked this session**; UNKNOWN.
- **Database tables for predictions/parlays:** UNKNOWN — `lib/db/src/schema/` exists (VERIFIED as a directory) but its file contents were not opened this session.
- **Tests:** `artifacts/tennis-predictor/e2e/` + `playwright.config.ts` VERIFIED present. Deeper unit-test inventory (e.g., STATE B's `builderScoringService.test.ts`, `builderProviderFetch.test.ts`) not re-verified in STATE C this session — UNKNOWN whether they moved over.
- **Production entry points:** `artifacts/api-server/src/index.ts` and `app.ts` (VERIFIED present, not read).

**Overall: strong structural evidence the Prediction Engine and Parlay Builder exist in STATE C in the same shape as STATE B, but their exact internal contents were not re-verified file-by-file this session — flagged UNKNOWN rather than assumed identical.**

---

## PART 5 — TRUTH ENGINE (`artifacts/tennis-truth-engine/`)

**VERIFIED from `src/` top level:** `components/`, `db/`, `generated/`, `hooks/`, `lib/`, `router.tsx`, `routes/`, `routeTree.gen.ts`, `server.ts`, `start.ts`, `styles.css`. **VERIFIED from top level of the package:** `data/`, `docs/`, `public/`, `scripts/`, `drizzle.config.ts`, `.output/`, `.reaudit-manifests/`, `.replit-artifact/`, `components.json`, `package.json`, `tsconfig.json`, `vite.config.ts`.

This matches STATE A's file/directory shape (`src/`, `data/`, `docs/`, `public/`, `scripts/`, VERIFIED in Step 0) almost exactly, **with the database layer swapped**: STATE A has `src/integrations/supabase/` + root `supabase/` (Supabase migrations); STATE C's `artifacts/tennis-truth-engine` has `src/db/` (VERIFIED contents: `apply-sql-extras.ts`, `client.server.ts`, `columns.ts`, `driver-parity.test.ts`, `index.ts`, `json.ts`, `migration-checksum.test.ts`, `persistence-parity.test.ts`, `query-errors.ts`, `README.md`, `schema/`, `schema.test.ts`, `server-only.test.ts`, `sql/`, `table-registry.ts`, `try-query.ts`, `upsert.ts`) and `drizzle.config.ts` instead.

**The `driver-parity.test.ts`, `persistence-parity.test.ts`, and `migration-checksum.test.ts` filenames are significant (VERIFIED to exist, contents not read):** their names strongly suggest this was a deliberate, *tested* migration — checking that the new Drizzle driver behaves equivalently to the old Supabase client and that data persists/round-trips with a verifiable checksum — rather than an untested rewrite. This is **INFERRED** intent from filenames; I did not open these test files to confirm what they actually assert, per the instruction not to infer functionality from filenames alone for Part 4 — applying the same discipline here: **treat this as a strong signal, not a confirmed fact, until the test bodies are read** (deferred — would require additional file reads not yet performed).

- **PBP infrastructure, evidence infrastructure, canonicalization, player identity, tournament identity, data-quality, audit/verification functionality:** these live under STATE A's `src/lib/` (dozens of files VERIFIED in Step 0, e.g. `evidence-canonical-identity.server.ts`, `bsd-atp-main-pbp.server.ts`, `calibration.ts`, `warehouse-first-researcher.server.ts`). STATE C's `artifacts/tennis-truth-engine/src/lib/` was listed as present (a directory) but **not enumerated this session** — UNKNOWN whether the same 40+ files carried over unchanged, were renamed, or were partially ported.
- **Runtime indexes:** `package.json`'s `prebuild`/`predev` scripts (`node scripts/build-runtime-tennis-index.mjs`) are **VERIFIED identical** to STATE A's, strongly suggesting the runtime-index generation pipeline carried over unchanged.
- **Database integration:** **VERIFIED** — fully Drizzle/Postgres (`drizzle-orm`, `drizzle-kit`, `pg`, `pg-query-stream` in `package.json`; zero `@supabase/*`).
- **State A vs. State B origin attribution:** the application logic, routes, and UI (`components/`, `hooks/`, `routes/`, PDF/OCR deps) are **INFERRED to originate from STATE A** (they match STATE A's audit-engine purpose and dependency list almost line-for-line, per Step 0). The **database layer** (`db/` folder shape, Drizzle usage, `pg`/`pg-query-stream`) is **INFERRED to be modeled on / share code with STATE B's `lib/db` package** (STATE B is the one that already used Drizzle+Postgres, per Step 0), though I have not confirmed the two `db/` implementations are byte-identical or merely architecturally similar.

---

## PART 6 — SHARED DATABASE (`lib/db/`)

**VERIFIED:** `lib/db/` contains `drizzle/` (migrations directory), `drizzle.config.ts`, `package.json`, `src/`, `tsconfig.json`, `tsconfig.tsbuildinfo`. `lib/db/src/` contains `applySqlExtras.ts`, `index.ts`, `schema/`, `sql/`.

- **Schema files / migrations / tables / relations:** the `schema/` and `drizzle/` directories exist but their **contents were not opened this session** — UNKNOWN what tables/relations are actually defined. This is the single highest-value follow-up read for a future pass (would directly answer whether Prediction Engine and Truth Engine share literal tables or merely a driver/package).
- **Consumers:** INFERRED to be both `artifacts/api-server` (Prediction Engine backend) and `artifacts/tennis-truth-engine` (Truth Engine) — both show Drizzle/`pg` usage — but I have **not verified an actual import statement** (e.g. `import ... from "@workspace/db"`) linking either package to this shared package. **UNKNOWN, not VERIFIED.**
- **Whether Prediction Engine and Truth Engine share the same database:** UNKNOWN — they may share the same **package/driver** (Drizzle+pg) while still pointing at two different physical Postgres databases/connection strings. Given `.replit`'s single `STATS_DATABASE_NAME = "heliumdb"` env var (VERIFIED) is a *workspace-level* shared env var, it's **INFERRED plausible** they point at the same physical database, but not confirmed — I have no access to actual `DATABASE_URL` values (and would not print them if I did).
- **Whether this replaces the old Supabase architecture:** **VERIFIED for `artifacts/tennis-truth-engine`** specifically (no Supabase dependency remains there). Whether it's a full replacement or a partial/parallel one for the wider system is UNKNOWN.
- **Migration scripts:** `drizzle/` directory (migrations) VERIFIED present; `src/db/apply-sql-extras.ts` in the truth-engine package and `lib/db/src/applySqlExtras.ts` (near-identical names) both VERIFIED present but not read — UNKNOWN what "SQL extras" they apply (could be RLS-equivalent policies, extensions, or seed data).
- **No database connection was made or attempted. No credentials were requested, viewed, or printed.**

---

## PART 7 — THREE-WAY FILE/FUNCTION RECONCILIATION MANIFEST (structural pass, not byte-for-byte)

| Item | Classification | Basis |
|---|---|---|
| Truth-engine UI/routes/components (`src/components`, `src/routes`, `src/hooks`) | **STATE A → LIVE** | INFERRED: same file/dir names, same dependency list, same prebuild scripts as STATE A |
| Truth-engine database layer (`src/db/*`, `drizzle.config.ts`, `pg`/`drizzle-orm` deps) | **STATE A → LIVE, reconciled with STATE B pattern (MERGE_RECONCILE)** | VERIFIED: replaces STATE A's `src/integrations/supabase/`; architecturally matches STATE B's DB approach |
| `src/integrations/supabase/*` (41 files, VERIFIED in Step 0 for STATE A) | **STATE A UNIQUE (not carried into LIVE, as far as checked)** | Not found under `artifacts/tennis-truth-engine/src` top level (no `integrations/` dir observed) — **CONFLICT risk**: if any of those 41 files' *non-Supabase* logic (e.g., business logic incidentally living in an `integrations/supabase/*.ts` file) wasn't ported when the folder was dropped, that would be a silent loss. **Flagged as a required Phase-2 check, not resolved here.** |
| `supabase/migrations/*` (22 files, STATE A) | **STATE A UNIQUE / HISTORICAL** unless a Drizzle-equivalent schema was hand-recreated | UNKNOWN whether `lib/db/drizzle/` or `artifacts/tennis-truth-engine/src/db/schema/` reproduce the same tables these migrations built — **not diffed** |
| Prediction Engine (`artifacts/api-server/src/services/predictionEngine/`, `artifacts/tennis-predictor`) | **STATE B → LIVE (INFERRED, path-level only)** | Directory paths match STATE B exactly; internal contents not re-verified in LIVE this session |
| Parlay Builder (`artifacts/api-server/src/services/parlayBuilder/`) | **STATE B → LIVE (UNKNOWN — path not re-opened this session)** | Not directly re-checked in LIVE; flagged for follow-up |
| `predictions_backup_2026-07-13T*.json` (LIVE, `artifacts/api-server/`) | **LIVE UNIQUE** | Dated real data not present in either GitHub repo (STATE B's git history was only shallow-cloned; cannot rule out these existed there historically — UNKNOWN provenance beyond "present in LIVE now") |
| `artifacts/mockup-sandbox/` | **LIVE UNIQUE** | Not traceable to STATE A or STATE B by name or evidence gathered |
| `.reaudit-manifests/*` (LIVE) | **LIVE UNIQUE** | Live audit-run output; STATE A's git history was not checked for a same-named directory — UNKNOWN if this is genuinely new or an untracked/gitignored STATE A pattern |
| `.migration-backup/` (LIVE) | **LIVE UNIQUE / DUPLICATE of an intermediate, never-pushed STATE A** | See Part 2 |
| `TASK_PREDICTION_50_PERCENT.md` (STATE A root, VERIFIED Step 0) | **STATE A UNIQUE (not seen in LIVE root or `.migration-backup` root)** | Simple absence check; content relevance unknown |
| `lib/{api-client-react,api-spec,api-zod,integrations-openai-ai-server}` (STATE B) | **UNKNOWN whether present in LIVE** | Not re-checked this session under `lib/` in LIVE beyond `lib/db` |

**I did not attempt exhaustive byte-for-byte comparison** — per the instruction, and because STATE C offers no bulk-diff mechanism through the tools available. The manifest above is a structural/path-level reconciliation; a binding migration manifest (as required by the original Phase 1 prompt's Step 13) would need targeted file-content reads against this list as a Phase 2 (or continued Phase 1) follow-up.

---

## PART 8 — GIT HISTORY RECONCILIATION

**Not possible with current access.** As established in Part 1, no `.git` was found in STATE C via the only tool available (`list_app_files`), and there is no way to run `git log`, obtain SHAs, or otherwise establish a git-level relationship between STATE C and either GitHub repository. Consequently:

- **Common ancestors:** UNKNOWN.
- **Unrelated histories:** UNKNOWN (though the strong file/dependency-list overlap with STATE A makes "wholly unrelated" implausible — this is a fork/derivative of STATE A's tree, just not one connected by git).
- **Migration commits, cherry-picks, copied-file migrations:** UNKNOWN mechanism; the evidence (identical prebuild scripts, near-identical dependency lists, matching file/folder names) is consistent with either an in-place Replit Agent edit of a checked-out copy of STATE A, or a manual copy — cannot distinguish between these without git or shell access.
- **Commits existing only in the live workspace:** UNKNOWN — there may be no commits at all if STATE C was never a git repo.

---

## PART 9 — DATABASE/DEPLOYMENT ARCHITECTURE: OLD vs. CURRENT LIVE

| Aspect | OLD (STATE A on GitHub) | CURRENT LIVE (STATE C) |
|---|---|---|
| DB backend | Supabase (hosted Postgres + RLS + RPC), VERIFIED | Plain Postgres via Drizzle ORM, VERIFIED (`drizzle-orm`, `pg`, `pg-query-stream`, `drizzle-kit`) |
| DB provisioning | Supabase project `qyovnrkiknsiqjybxubf`, VERIFIED | Replit-provisioned Postgres, env var `STATS_DATABASE_NAME = "heliumdb"`, VERIFIED present in `.replit` |
| Auth | `attachSupabaseAuth` middleware in `start.ts`, VERIFIED (STATE A) | Custom HMAC-signed admin-cookie + Replit-owner-header auth in `start.ts`, VERIFIED (STATE C) — explicitly shared with the Stats Engine per its own code comment |
| Workspace shape | Single-package TanStack app (`package.json` name `tanstack_start_ts`) | pnpm workspace (`pnpm-workspace.yaml`) with 4 `artifacts/*` packages + 5 `lib/*` packages (only `lib/db` confirmed this session) |
| Migrations | 22 SQL files under `supabase/migrations/`, VERIFIED | `drizzle/` directory under `lib/db/`, presence VERIFIED, contents not read |

**Is the live architecture complete, partial, scaffolded, or inconsistent?**

**INFERRED: substantially migrated, not merely scaffolded, but not confirmed complete.** Evidence for "real, not just scaffolded": `driver-parity.test.ts`, `persistence-parity.test.ts`, `migration-checksum.test.ts` exist (suggesting deliberate validation work happened); the `db/` layer has 15+ real-looking files (`columns.ts`, `table-registry.ts`, `upsert.ts`, `query-errors.ts`, a `schema/` directory) rather than stub files; `start.ts` contains genuine, non-trivial auth logic referencing the Stats Engine by name. Evidence the picture is **not fully settled**: the root-level `replit.md` and root `package.json` are still the **generic, unfilled scaffold template** ("[Project name]", placeholder sections) — meaning whoever did this migration never finished documenting/finalizing the workspace-level metadata, which is at minimum a housekeeping gap and at most a sign the consolidation itself is still in progress. **I cannot confirm required tables/configuration/services are complete** without reading `lib/db/src/schema/` and `lib/db/drizzle/` contents, which was not done this session.

---

## PART 10 — ANSWERS TO THE ELEVEN QUESTIONS

1. **What is the actual current live application?** A pnpm-workspace monorepo, replId `c6aabbf3-6a6a-4d39-a523-a02e504a70d6`, containing what appear to be four applications (`api-server`, `tennis-predictor`, `tennis-truth-engine`, `mockup-sandbox`) and a shared `lib/db` Drizzle package, running on a Replit-provisioned Postgres database (`heliumdb`). **VERIFIED** at the structural level described above.
2. **What functionality has already been consolidated?** The Truth Engine's frontend/business logic has been moved into the same workspace as the Prediction Engine/Parlay Builder, its database layer has been switched from Supabase to the same Drizzle/Postgres approach the Prediction Engine uses, and its admin auth is explicitly shared with the Stats Engine (**VERIFIED** via `start.ts` comment). Whether *data* (not just code/schema) has been consolidated is **UNKNOWN**.
3. **What came from State A?** The Truth Engine's UI, routes, hooks, components, PDF/OCR ingestion stack, and runtime-index build pipeline — **INFERRED**, based on near-identical file names and dependency lists.
4. **What came from State B?** The architectural pattern of using Drizzle + `pg` for the database layer, and the `api-server`/`tennis-predictor` packages themselves (Prediction Engine, Parlay Builder) — **INFERRED / partially VERIFIED** (package paths match; internal contents not fully re-checked this session).
5. **What exists only in the live workspace?** `artifacts/mockup-sandbox/`, `.reaudit-manifests/` run logs, `.migration-backup/` (an intermediate never-pushed state), the dated prediction backup JSON files in `artifacts/api-server/`, and the specific shared-auth wiring in `start.ts`. **VERIFIED presence; uniqueness relative to STATE B's git history is UNKNOWN since STATE B was only shallow-cloned.**
6. **What exists only in either GitHub repository?** STATE A uniquely has `src/integrations/supabase/` (41 files) and `supabase/migrations/` (22 files) in their original Supabase form, plus `TASK_PREDICTION_50_PERCENT.md`. Whether STATE B has anything not reflected in LIVE is **UNKNOWN** (not checked this session beyond path-level assumptions in Part 7).
7. **Does the live workspace have its own Git history?** **INFERRED no** (no `.git` found) — but this is not fully verified due to tool limitations (see Part 1).
8. **Can that history be connected to either GitHub repository?** **N/A / UNKNOWN** — there is no confirmed history to connect.
9. **Is the current live workspace a viable migration base?** **Tentatively promising but NOT YET ESTABLISHED.** It appears to already contain the desired end state (unified workspace, Prediction Engine + Parlay Builder + Truth Engine + shared DB), which is a strong argument for treating it as the real basis for consolidation rather than redoing the work from the two GitHub repos. But: it has no git history to preserve/import, its root scaffold metadata is unfinished, key schema/test file contents are unread, and there is currently **no way to get it into a git-inspectable or exportable form** with the tools available in this session — which blocks any of the zero-loss verification the original Phase 1 audit requires (SHA-256 fingerprints, record counts, etc.) for whatever it contains. **A file-by-file export mechanism (or restored git connectivity) is a prerequisite before this can be formally adopted as a migration base.**
10. **What must be preserved before any Git operation?** At minimum: `.migration-backup/` (in case it holds the only surviving copy of something dropped during the in-place edit), the `predictions_backup_2026-07-13T*.json` files, `.reaudit-manifests/*`, and the full `lib/db/` schema/migrations — none of these exist in either GitHub repo today, so any git operation that treats GitHub as the sole source of truth would silently lose them.
11. **What must NOT be merged?** STATE A's `supabase/` directory and `src/integrations/supabase/*` should **not** be blindly merged on top of LIVE's already-Drizzle-based `tennis-truth-engine` package (this would reintroduce two competing DB layers). Conversely, LIVE's unfinished scaffold files (root `replit.md`, root `package.json` still template-only) should not be merged into either GitHub repo as-is.

**12. What remains unaccounted for (this pass):**
- Contents of `lib/db/src/schema/`, `lib/db/drizzle/` (actual tables/migrations)
- Contents of `artifacts/tennis-truth-engine/src/db/schema/` and whether it duplicates or extends `lib/db`
- Full enumeration of `artifacts/api-server/src/services/` and `artifacts/tennis-predictor/src/` in LIVE, to confirm `predictionEngine/`/`parlayBuilder/` internals match STATE B
- Whether `lib/{api-client-react,api-spec,api-zod,integrations-openai-ai-server}` exist in LIVE
- Any git history for STATE C via a mechanism other than `list_app_files` (e.g., if the user has direct shell/SSH access to the Replit workspace, a `git log` there would resolve Part 1 and Part 8 definitively)
- Byte-level diffing of any file this report treated as "matching by name/shape"

---

## VERDICT

**NOT READY for any merge/migration decision.** This reconciliation surfaces a live, third state that is plausibly the most advanced and most relevant one, but it cannot yet be verified to the standard the zero-loss migration requires, and critically **cannot currently be captured into a form (git history, full export) that would let a future migration preserve it safely.** The immediate next step is access, not more reading: establish whether STATE C has any git connectivity you can grant, or a way to export/download its full file tree, before further forensic effort is spent reading it file-by-file through this constrained tool interface.

No migration, merge, commit, push, reset, restore, delete, rename, or overwrite was performed. This turn ends here per your instruction.
