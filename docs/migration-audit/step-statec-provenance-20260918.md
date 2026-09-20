# STATE C PROVENANCE & PRESERVATION INVENTORY

**Audit date:** 2026-09-18
**Auditor:** Claude (read-only forensic audit)
**Trigger:** follow-up to `step-threeway-reconciliation-20260918.md`, per instruction to determine what STATE C (live Replit workspace) is, where it came from, and what must be preserved before any Git operation. **No Git merge target is recommended in this report.**

**IMPORTANT — nothing new was attached to analyze:** the user's instructions describe a process for handling Shell/Git output or a full workspace export *if and when provided* ("If I provide Shell/Git output, analyze it first... If I provide a full workspace export, treat that export as an immutable forensic snapshot"). **Neither was attached to this turn.** Everything below was gathered through continued read-only use of the same two Replit MCP tools as the prior report (`list_app_files`, `read_app_file` — directory listing and single-file, <100KB reads only), plus one comparison against the local STATE B shallow clone. No shell, no `git`, no bulk export, and no `ask_question` (Replit Agent still unavailable, per the user's earlier confirmation it is out of credits) were used or available this turn. **This report should be re-run/extended once real shell or export output is provided**, per the user's own instruction.

Confidence tags: **VERIFIED** / **INFERRED** / **UNKNOWN** / **MISSING** / **CONFLICT**.

---

## 1. Is STATE C a Git repository?

**INFERRED: No, or at least not one reachable through `list_app_files`.** Re-confirmed this turn: `.git` is MISSING at workspace root (tool reports "No file or directory exists at that path"), consistent with the prior report. **Not VERIFIED** — `list_app_files`'s own documentation only guarantees it excludes "dependency and build folders (like node_modules)"; it does not state whether `.git` is deliberately hidden. I have no way to distinguish "no `.git` exists" from "`.git` exists but this tool won't show it" without shell access.

## 2. HEAD SHA, branches, refs, remotes, reflog, accessible history

**UNKNOWN — all of it.** No tool available this session can extract any of this from STATE C. If you run `git status`, `git log --oneline -20`, `git remote -v`, `git branch -a`, and `git reflog show --all` directly in the Replit shell and paste the output, I can analyze it immediately per your instruction.

## 3. Does STATE C's history connect to either GitHub repo?

**UNKNOWN**, for the same reason as #2. What I can say from file-content evidence (not history): STATE C's `artifacts/api-server/src/services/` directory listing is **VERIFIED identical**, entry-for-entry, to `Tennis-Stats-Engine`'s current `main`-branch shallow clone in this session (`evaluation/`, `historicalData/`, `identity/`, `launchAudit.test.ts`, `launchAudit.ts`, `oddsData/`, `parlayBuilder/`, `payments/`, `playerStats/`, `predictionEngine/`, `screenshotImport/`, `shared/`, `tennisData/` — all 13 match). That is strong **structural** provenance evidence connecting STATE C's `api-server` package to STATE B, but it is a directory-listing match, not a content or git-history match, so it does not by itself prove common commits.

## 4. Does STATE C contain commits that exist in either repo?

**UNKNOWN — cannot be answered without git access to STATE C.**

## 5. Does STATE C contain work that exists in neither repo?

**VERIFIED, at least in part.** New evidence this turn: `.reaudit-manifests/active-slate-reaudit.json` (read in full) contains ~90 real match-audit records, each with a `matchId`, `newRunId`, `runNumber: 5`, `status: "COMPLETE"`, and a `completedAt` timestamp — all dated **2026-09-14, 10:07–10:41 UTC**. This is live, real audit-run output from the Truth Engine's own audit pipeline, generated *after* STATE A's most recent GitHub-visible Supabase migration (2026-09-11) and clearly not present in either GitHub repo (neither repo has a `.reaudit-manifests/` path — STATE A was fully inventoried in Step 0 with no such directory; STATE B's shallow clone likewise has no such path visible at its root/`artifacts` level checked so far). Also still holding from the prior report: `artifacts/api-server/`'s dated prediction backups (`predictions_backup_2026-07-13T*.json`), `artifacts/mockup-sandbox/`, and `.migration-backup/`.

## 6. Does `.migration-backup/` correspond to State A, State B, or another historical state?

**Unchanged from the prior report, reconfirmed: an intermediate, never-pushed state of STATE A.** Its `src/` already has the post-migration `db/`-not-`integrations/` shape, so it is **not** a pre-migration Supabase snapshot. It most likely represents STATE A's tree at some point *during or after* the in-place Supabase→Drizzle conversion, kept as a rollback copy before further restructuring into `artifacts/tennis-truth-engine/`. This remains **INFERRED**, not verified — no timestamps or manifest inside `.migration-backup/` itself were found to pin this down further this session.

## 7. Does `.reaudit-manifests/` establish provenance?

**Partially — VERIFIED content, but it establishes *activity timeline*, not Git/code provenance.** The one file read in full (`active-slate-reaudit.json`) is a **runtime audit-execution log** (which matches went through audit run #5, when, with what internal run IDs), not a migration or code-provenance manifest. It proves the Truth Engine application was **live and actively processing real audit runs inside this workspace on 2026-09-14** — useful for establishing that STATE C is an operating application, not dead scaffolding, but it says nothing about git history, commit SHAs, or which files came from which source repo. Two sibling files (`active-slate-reaudit.run1.json`, `active-slate-reaudit.run3.json`) exist but were **not read this session** — MISSING from this analysis, flagged for follow-up if their content differs materially.

## 8. Does STATE C contain uncommitted migration work?

**UNKNOWN whether "uncommitted" is even the right frame** — if #1 holds (no `.git`), there is no commit/uncommitted distinction to make; everything in the workspace is simply the current filesystem state, full stop. If a `.git` does exist somewhere I can't see, then yes, by definition everything I've inventoried would be "uncommitted" relative to it, since no commit history is visible. **Cannot resolve without shell/git access to STATE C.**

## 9. Files/packages unique to STATE C

**VERIFIED this session:**
- `.reaudit-manifests/*.json` (3 files) — live audit-run logs
- `.migration-backup/` — intermediate STATE A snapshot, not on GitHub
- `artifacts/mockup-sandbox/` — a Vite-based mockup-preview tool (`mockupPreviewPlugin.ts`), not seen in either GitHub repo
- `predictions_backup_2026-07-13T22-51-29-114Z.json` and `predictions_backup_2026-07-13T23-16-23-444Z.json` in `artifacts/api-server/` — dated real prediction-outcome backups
- `tennis-truth-engine_260828.backup` — a single opaque backup file at workspace root (not opened; outside safe text-read scope and not needed for this classification)
- `artifacts/tennis-truth-engine/.replit-artifact/artifact.toml` and (INFERRED, by pattern) equivalent `.replit-artifact/` manifests likely exist under the other `artifacts/*` packages — only the truth-engine one was read this turn. This file (VERIFIED, read in full) is a **Replit multi-service router manifest**: it mounts the Truth Engine at path `/truth-engine`, port `19024`, with explicit dev/build/run commands (`pnpm --filter @workspace/tennis-truth-engine run {dev,build,start}`) and a health-check path. **This is deliberate, working production routing configuration, not an abandoned scaffold** — it describes a real deployed service alongside sibling services (by the `router = "path"` / multi-service pattern, the other `artifacts/*` packages are almost certainly mounted the same way at their own paths, though their individual `artifact.toml` files were not read this session — UNKNOWN their exact mount paths).

## 10. STATE A / STATE B files already migrated into STATE C

**Reconfirmed and extended from the prior report:**
- From STATE A: Truth Engine's UI/routes/components/hooks, PDF/OCR dependency stack, `prebuild`/`predev` runtime-index build script — INFERRED by matching file/dir names and dependency lists (Part 5/7 of the prior report; unchanged).
- From STATE B: **now VERIFIED at the directory level** (not just architecturally similar, as previously stated) — `artifacts/api-server/src/services/` is an exact 13-entry match to STATE B's current `main`. This upgrades that specific finding from INFERRED to VERIFIED (structural match only; contents of individual service files still not diffed).

## 11. STATE A / STATE B files still absent from STATE C

**Unchanged from the prior report, not re-checked this session:** STATE A's `src/integrations/supabase/*` (41 files) and `supabase/migrations/*` (22 files) were not found under `artifacts/tennis-truth-engine/` in the paths checked. Whether STATE B's `lib/{api-client-react,api-spec,api-zod,integrations-openai-ai-server}` packages exist in STATE C's `lib/` was **not re-checked this turn** — still UNKNOWN, carried over as an open item.

## 12. Has STATE C replaced, transformed, or removed functionality from either GitHub repo?

**VERIFIED (transformation, not removal, for the one case fully traced):** the Truth Engine's database access layer was transformed from Supabase-client calls (STATE A) to Drizzle/`pg` calls (STATE C), evidenced by `driver-parity.test.ts` and `persistence-parity.test.ts` file names (present, VERIFIED; contents still not read — so their *actual* assertions remain INFERRED, not confirmed, per the same discipline applied in the prior report). **No removal of functionality has been positively confirmed or ruled out** — that requires reading the 41 STATE-A-only Supabase integration files' actual logic (not just their filenames) to check whether anything beyond "talk to Supabase" lived in them, and comparing against what STATE C's `src/db/` actually implements. **This remains the single most important unresolved question for a zero-loss guarantee and is explicitly flagged as MISSING analysis, not answered here.**

---

## Forensic inventory (bounded — see access-boundary note)

A complete file list with SHA-256 hashes for STATE C, as requested, is **not achievable with the tools available this session**: `read_app_file` only returns file content (for hashing client-side) one text file at a time, caps at ~100KB, and cannot read binary files (e.g., the `.tar`, `.zip`, `.backup` files already noted) at all. Hashing even the ~150 files enumerated across this and the prior report would take that many additional tool round-trips for partial coverage, and would still miss every binary artifact. **This is flagged as a proportionality limit under the cost/stopping rule, not skipped silently:** a real forensic inventory with hashes requires either (a) shell/`sha256sum` output you run and paste, or (b) a downloadable export I can hash directly against the filesystem. Absent either, here is the **structural** inventory assembled across both sessions (this report + the prior one), which is everything currently VERIFIED to exist in STATE C:

```
/ (workspace root)
├── .agents/                          [present, not enumerated]
├── .gitattributes                    [present, not read]
├── .gitignore                        [present, not read]
├── .migration-backup/                [intermediate STATE-A snapshot, see #6]
│   ├── (root: matches STATE A layout minus supabase/, plus drizzle.config.ts, .scaffold-applied)
│   └── src/ → components/ db/ generated/ hooks/ lib/ router.tsx routes/ routeTree.gen.ts server.ts start.ts styles.css
├── .output/                          [build output, present]
├── .reaudit-manifests/
│   ├── active-slate-reaudit.json     [READ IN FULL — ~90 audit-run records, 2026-09-14]
│   ├── active-slate-reaudit.run1.json [present, NOT READ]
│   └── active-slate-reaudit.run3.json [present, NOT READ]
├── .replit                           [READ IN FULL — see prior report: postgresql-16 module, STATS_DATABASE_NAME=heliumdb]
├── .replitignore                     [present, not read]
├── .wrangler/                        [present, not enumerated — Cloudflare Workers build artifact, consistent with STATE A's wrangler deploy config seen in .replit]
├── artifacts/
│   ├── api-server/                   [Prediction Engine + Parlay Builder backend]
│   │   ├── src/services/ → evaluation historicalData identity launchAudit.{ts,test.ts} oddsData parlayBuilder payments playerStats predictionEngine screenshotImport shared tennisData  [VERIFIED IDENTICAL to STATE B main]
│   │   ├── predictions_backup_2026-07-13T22-51-29-114Z.json  [LIVE UNIQUE]
│   │   ├── predictions_backup_2026-07-13T23-16-23-444Z.json  [LIVE UNIQUE]
│   │   └── build.mjs, debug_save2.mts, docs/, reports/, scripts/, tsconfig*.json  [present, not opened]
│   ├── tennis-predictor/             [Prediction Engine + Parlay Builder frontend]
│   │   └── .gitignore .replit-artifact/ components.json e2e/ index.html package.json playwright.config.ts public/ src/ tsconfig.json vite.config.ts
│   ├── tennis-truth-engine/          [Truth Engine, migrated]
│   │   ├── package.json              [READ IN FULL — @workspace/tennis-truth-engine, drizzle-orm/pg/pg-query-stream, zero @supabase/*]
│   │   ├── src/ → components/ db/ generated/ hooks/ lib/ router.tsx routes/ routeTree.gen.ts server.ts start.ts styles.css
│   │   ├── src/db/ → apply-sql-extras.ts client.server.ts columns.ts driver-parity.test.ts index.ts json.ts migration-checksum.test.ts persistence-parity.test.ts query-errors.ts README.md schema/ schema.test.ts server-only.test.ts sql/ table-registry.ts try-query.ts upsert.ts
│   │   ├── src/start.ts              [READ IN FULL — shared admin auth w/ Stats Engine, explicit code comment confirms]
│   │   ├── .replit-artifact/artifact.toml  [READ IN FULL — mounts at /truth-engine:19024, real prod build/run/health config]
│   │   └── data/ docs/ public/ scripts/ drizzle.config.ts .output/ .reaudit-manifests/ components.json tsconfig.json vite.config.ts
│   └── mockup-sandbox/               [LIVE UNIQUE — .replit-artifact/ components.json index.html mockupPreviewPlugin.ts package.json src/ tsconfig.json vite.config.ts]
├── lib/
│   └── db/                           [shared Drizzle package]
│       ├── package.json              [present, NOT read this session]
│       ├── drizzle/                  [migrations — present, contents NOT read]
│       ├── drizzle.config.ts
│       └── src/ → applySqlExtras.ts index.ts schema/ sql/    [schema/ and sql/ contents NOT read — highest-value follow-up]
│   └── (api-client-react/, api-spec/, api-zod/, integrations-openai-ai-server/ — presence in STATE C UNKNOWN, not re-checked)
├── package.json                      [READ IN FULL — generic scaffold: only @replit/connectors-sdk, prettier, typescript]
├── replit.md                         [READ IN FULL — unfilled template, "[Project name]"]
├── pnpm-workspace.yaml, pnpm-lock.yaml, tsconfig.base.json, tsconfig.json  [present, not read]
├── reports/, screenshots/, attached_assets/, data/  [present at root, not enumerated]
└── tennis-truth-engine_260828.backup [opaque binary-ish file, name-dated 2026-08-28, NOT opened]
```

**Database schema/migrations, PBP/evidence directory contents, and deployment files beyond `.replit`/`artifact.toml` were not read this session** — each is a MISSING item for a future pass, not silently dropped: `lib/db/src/schema/`, `lib/db/drizzle/`, `artifacts/tennis-truth-engine/src/db/schema/`, and `artifacts/tennis-truth-engine/data/` are the specific next-highest-value reads.

---

## What must be preserved before any Git operation (unchanged conclusion, now with stronger evidence)

1. **`.reaudit-manifests/*`** — real, dated (2026-09-14) audit-run output not present in either GitHub repo.
2. **`.migration-backup/`** — the only located copy of an intermediate STATE-A tree; may be the only rollback point if the in-place Drizzle conversion needs to be re-verified against what preceded it.
3. **`predictions_backup_2026-07-13T*.json`** — dated real prediction data.
4. **`lib/db/` and `artifacts/tennis-truth-engine/src/db/`** in full, unread — cannot confirm what schema/data-shape decisions were made without reading them, and they are the crux of the Supabase→Drizzle transition.
5. **`artifacts/tennis-truth-engine/.replit-artifact/artifact.toml`** (and sibling manifests for the other three `artifacts/*` packages, not yet read) — this is live deployment/routing configuration with no GitHub equivalent.
6. **`tennis-truth-engine_260828.backup`** — unopened, unclassified; do not discard before its contents are understood.

## Verdict

**Still NOT READY to recommend a Git merge target, as instructed.** This pass upgraded one finding from inferred to verified (STATE C's `api-server/src/services/` structurally matches STATE B exactly) and surfaced new evidence (a live, dated audit-run log; a real production routing manifest) that STATE C is an actively operating, deliberately-configured consolidation — not abandoned scaffolding. But the central blocking question from the prior report is unchanged: **there is still no confirmed Git history for STATE C**, and core database-schema and PBP/evidence-directory contents remain unread. The next highest-value action is exactly what you anticipated needing to provide: real shell/`git` output from inside the Replit workspace (to resolve Part 1/2/3/4/8 definitively), or a full export (to enable hashing and complete content diffing for Parts 9–12).

No migration, merge, commit, push, reset, restore, delete, rename, or overwrite was performed. This turn ends here per your instruction.
