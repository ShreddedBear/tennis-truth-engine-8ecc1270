# FOUR-COMMIT PRESERVATION AUDIT — DID THE FUNCTIONALITY SURVIVE?

**Audit date:** 2026-09-19
**Auditor:** Claude (read-only forensic audit)
**Scope:** exactly the four backup-branch commits flagged CRITICAL/HIGH in the prior report. No migration, merge, cherry-pick, push, or modification of any kind was performed. This report answers "did the functionality survive elsewhere," not merely "does the SHA exist elsewhere."

**Method note:** filename-level comparison against the current branch's live file listing (obtained directly via `list_app_files`, no Replit Agent credits spent on this step) plus two small, targeted `git show --name-only` queries for the commits' file lists. This is filename/structural evidence, not byte-level diffing — classifications below reflect that honestly (mostly **B: functionally present under different code**, inferred from near-total filename survival, not proven identical by content).

---

## 1. FOUR-COMMIT SUMMARY

| Commit | Subject | Files | +/- | Parent (all share) |
|---|---|---|---|---|
| `86faff34` | Implement batching and alias resolution for the audit pipeline + memory docs | 11 | +743/-8 | chain within `backup/pre-authenticated-rebase`, merge-base `97bdf4ee...` with current branch |
| `096f2e30` | Update audit pipeline and run logic with associated index data | 21 | +1191/-89 | same chain |
| `49702125` | Make batch audit execution durable, leased, bounded, and truthful | 18 | +551/-324 | same chain |
| `a687c358` | Update research pipeline logic and refresh runtime index data | 17 | +310/-32 | same chain |

All four dated **2026-08-29**, consistent with the rest of the branch.

---

## 2. COMMIT-BY-COMMIT COMPARISON AGAINST `claude/tennis-engine-audit-32-razn75`

### `86faff34` — batching + alias resolution

**Files changed (VERIFIED via `git show --name-only`):** `.agents/memory/MEMORY.md`, `.agents/memory/audit-pbp-batching.md`, 2 `attached_assets/` text pastes, `data/generated/tennis-runtime-index.json`, `public/generated/tennis-runtime-index.json.gz`, `scripts/run-live-audit.ts`, **`src/lib/audit-pipeline.ts`**, `src/lib/bsd-atp-main-pbp.server.ts`, **`src/lib/evidence-player-alias.ts`** + `.test.ts`.

**Current-branch comparison (VERIFIED by direct file listing of `artifacts/tennis-truth-engine/src/lib/`):**
- `audit-pipeline.ts` — **A. EXACTLY PRESENT (by filename)** — exists in current branch's `lib/`
- `bsd-atp-main-pbp.server.ts` — **A. EXACTLY PRESENT (by filename)**
- `evidence-player-alias.ts` and `evidence-player-alias.test.ts` — **A. EXACTLY PRESENT (by filename), both the implementation and its test**
- `scripts/run-live-audit.ts`, `.agents/memory/*.md` — **UNKNOWN**, not checked (scripts/ and .agents/ directories not re-listed this pass)

**Classification: ALREADY PRESERVED (by filename evidence) — HIGH CONFIDENCE, NOT BYTE-VERIFIED.** All the substantive code files this commit touched still exist under the same names in the current branch. Given the current branch has 248 more commits than this one's branch point, the most plausible explanation is that this work was carried forward and further developed, not dropped and independently reinvented under identical filenames (that would be an implausible coincidence). **This is INFERRED from filename survival, not proven by content diff.**

### `096f2e30` — audit pipeline and run logic update (largest, 1191 insertions)

**Files changed (VERIFIED):** `attached_assets/` paste, `data/generated/tennis-runtime-index.json`, `docs/full-metric-wiring-audit.md`, `public/generated/tennis-runtime-index.json.gz`, `src/lib/audit-pipeline.ts`, `src/lib/audit-repo.server.ts`, `src/lib/audit-runs.test.ts`, `src/lib/audit-runs.ts`, `src/lib/calibration-snapshot.ts`+test, `src/lib/current-audit-state.ts`+test, **`src/lib/evidence-finding-selection.test.ts`**, `src/lib/source-observation-metric-bridge.server.ts`, `src/lib/tennis-data-history.server.ts`, `src/lib/warehouse-first-researcher.server.ts`+test, `src/routes/app/{board,dashboard,match.$matchId}.tsx`.

**Current-branch comparison:**
- `audit-pipeline.ts`, `audit-repo.server.ts`, `audit-runs.ts`/`.test.ts` — **A. EXACTLY PRESENT** (and the current branch has *additional* `audit-runs.functions.ts`/`audit-runs.server.ts` not in this commit — **INFERRED further refactoring happened on top**)
- `calibration-snapshot.ts`+test, `current-audit-state.ts`+test — **A. EXACTLY PRESENT**
- `source-observation-metric-bridge.server.ts` — **A. EXACTLY PRESENT** (current branch also has a `.test.ts` for it now)
- `tennis-data-history.server.ts` — **A. EXACTLY PRESENT**
- `warehouse-first-researcher.server.ts`+test — **A. EXACTLY PRESENT** (current branch has *more* variants: `-static-reconnect.test.ts`, `-temporal-boundary.leakage.test.ts`, `-research-orientation.test.ts` — further evolved)
- **`evidence-finding-selection.test.ts` — D. ABSENT.** This specific file does **not** appear anywhere in the current branch's `artifacts/tennis-truth-engine/src/lib/` listing. **This is the one concrete, specific gap found in this entire four-commit audit.**
- `docs/full-metric-wiring-audit.md`, routes — **UNKNOWN**, not checked

**Classification: PARTIALLY PRESERVED.** Every substantive `.ts`/`.server.ts` implementation file survives by name (strong evidence the core functionality continued forward), but **one specific test file, `evidence-finding-selection.test.ts`, is confirmed absent** — either its test coverage was folded into another file, deliberately removed, or genuinely lost. Not enough evidence to say which.

### `49702125` — durable/leased/bounded/truthful batch audit execution

**Files changed (VERIFIED):** `data/generated/tennis-runtime-index.json`, `public/generated/tennis-runtime-index.json.gz`, `src/integrations/supabase/types.ts`, `src/lib/audit-batch.ts`+test, `src/lib/audit-engine.ts`, `src/lib/audit-pipeline.functions.ts`, `src/lib/audit-pipeline.ts`+test, `src/lib/audit-repo.server.ts`, `src/lib/pipeline-client-error.ts`+test, `src/routes/app/{match.$matchId,slate,upload}.tsx`, `src/server.ts`, `src/start.ts`, **`supabase/migrations/20260829120000_audit_run_leases.sql`**.

**Current-branch comparison:**
- `audit-batch.ts`+test, `audit-engine.ts` (current branch also now has `audit-engine.test.ts`), `audit-pipeline.functions.ts`, `audit-pipeline.ts`+test, `audit-repo.server.ts`, `pipeline-client-error.ts`+test — **A. EXACTLY PRESENT, all of them, by filename**
- `src/integrations/supabase/types.ts` — **D. ABSENT, but EXPECTED to be absent**, not a loss: the current branch's `artifacts/tennis-truth-engine` has **no `supabase/` integration at all** (confirmed in every prior report — it's fully migrated to Drizzle). This file's absence is the *intended* consequence of the DB migration, not a regression.
- **`supabase/migrations/20260829120000_audit_run_leases.sql`** — **B. FUNCTIONALLY PRESENT UNDER DIFFERENT CODE, VERIFIED via two independent pieces of evidence:**
  1. The exact filename `20260829120000_audit_run_leases.sql` was recorded in this session's own Step 0 inventory of `tennis-truth-engine-8ecc1270`'s `supabase/migrations/` directory (on the `main`-line branch) — meaning this migration, in its original Supabase-SQL form, **does exist and is preserved on the `main`-line branch of the same GitHub repository.**
  2. On the *current consolidated* branch, `artifacts/tennis-truth-engine/src/db/schema/audit.ts` exists (VERIFIED, just confirmed by direct listing) — almost certainly the Drizzle reimplementation of the `audit_runs` table, and the live database (VERIFIED in a prior report) has real, populated `lease_expires_at`/`heartbeat_at` columns on `audit_runs`, with genuine non-null timestamp data from 2026-09-14/15. **This is not just a column existing — it has real data, meaning the application is actively writing to it, which is evidence of functional consumption, not just schema drift.**

**Classification: ALREADY PRESERVED — the strongest-evidenced finding in this report.** Both the original SQL form (on `main`) and a re-implemented, actively-used Drizzle form (on the current consolidated branch, with live data proving consumption) exist. **Per your explicit instruction not to infer that a column's mere existence proves consumption: the non-null, dated, realistic timestamp values in `lease_expires_at`/`heartbeat_at` (from the prior DB audit: `lease_expires_at: 2026-09-14 22:13:45... to 2026-09-15 01:30:20...`, moving in lockstep with `updated_at`) are what justify "consumed," not just "column exists."**

### `a687c358` — research pipeline logic (17 files)

**Files changed (VERIFIED):** `.agents/memory/MEMORY.md`, `.agents/memory/audit-source-latency.md`, `data/generated/tennis-runtime-index.json`, `public/generated/tennis-runtime-index.json.gz`, `src/lib/async-time-budget.ts`+test, `src/lib/audit-pipeline.ts`+test, `src/lib/bounded-promise-cache.ts`+test, `src/lib/hybrid-audit-research.server.ts`, `src/lib/metric-postfix-wiring-078-081.test.ts`, `src/lib/metric-wiring-072-076-provenance.test.ts`, `src/lib/warehouse-first-researcher-static-reconnect.test.ts`, `src/lib/warehouse-first-researcher.server.ts`, `src/routes/app/{slate,upload}.tsx`.

**Current-branch comparison:**
- `async-time-budget.ts`+test, `bounded-promise-cache.ts`+test — **A. EXACTLY PRESENT**
- `audit-pipeline.ts`+test (already counted above) — **A. EXACTLY PRESENT**
- `hybrid-audit-research.server.ts` — **A. EXACTLY PRESENT**
- `metric-postfix-wiring-078-081.test.ts`, `metric-wiring-072-076-provenance.test.ts` — **A. EXACTLY PRESENT**
- `warehouse-first-researcher-static-reconnect.test.ts`, `warehouse-first-researcher.server.ts` — **A. EXACTLY PRESENT**
- `.agents/memory/*.md`, routes — **UNKNOWN**, not checked

**Classification: ALREADY PRESERVED (by filename evidence) — every code/test file confirmed present by name.**

---

## 3. IDENTITY / CANONICALIZATION (specifically for `86faff34` and `096f2e30`)

- **Alias resolution:** **B. FUNCTIONALLY PRESENT** — `evidence-player-alias.ts`+test exist in the current branch under the identical name.
- **Canonical player resolution:** relevant to the shared `lib/db/src/schema/canonicalIdentity.ts` (VERIFIED present, containing `canonicalPlayersTable`/`playerAliasesTable`, read in full in the prior report) — this is a **separate, shared-package implementation**, not the same file as `evidence-player-alias.ts` (which lives in the Truth-Engine's own `src/lib/`). **Both exist simultaneously — INFERRED they serve different layers** (one is the Truth-Engine's own evidence/audit-facing alias logic, the other is the cross-app shared canonical-identity registry), not confirmed as redundant or conflicting.
- **Tournament resolution:** **UNKNOWN** — no `tournament-alias`-named file was seen in either the commit's file list or the current listing; `tournament-context.server.ts` and `tournament-history-reconstruction.ts` exist in the current branch but their relationship to these two commits is **UNKNOWN** (neither appears in `86faff34`'s or `096f2e30`'s file lists, so they're likely unrelated pre-existing files, not derived from these commits).
- **Ambiguity/conflict handling, batching, audit pipeline execution, audit run logic:** **B. FUNCTIONALLY PRESENT**, same filename-survival evidence as above (`audit-pipeline.ts`, `audit-runs.ts`, `audit-batch.ts` all present).
- **`players`/`tournaments` vs. `canonical_players`/`player_aliases` (the standing open question):** **Materially advanced, still not fully closed.** New finding this pass: `artifacts/tennis-truth-engine/src/db/schema/` (VERIFIED, just listed) contains `accessControl.ts, analysis.ts, audit.ts, calibration.ts, decisions.ts, index.ts, matches.ts, metrics.ts, rules.ts, sources.ts, uploads.ts` — **no `players.ts` or `tournaments.ts` file here either**, and none in the shared `lib/db/src/schema/` (confirmed in the prior report). **This means neither schema package defines `players`/`tournaments` at all** — strengthening the case for **classification C (legacy tables no longer used)** over A/B, though **still not proven**: it remains possible `matches.ts` internally references or was intended to reference `players`/`tournaments` via foreign keys not yet enumerated (not opened this pass, per resource-conscious scope).

---

## 4. AUDIT EXECUTION (`49702125`)

| Behavior | Status |
|---|---|
| Durable execution | **B. FUNCTIONALLY PRESENT** — `audit-batch.ts`, `audit-engine.ts`, `audit-pipeline.ts` all survive by name |
| Leases / lease expiration | **B. FUNCTIONALLY PRESENT, VERIFIED via live data** — `audit_runs.lease_expires_at` populated with real, moving timestamps (2026-09-14/15) |
| Heartbeat | **B. FUNCTIONALLY PRESENT, VERIFIED via live data** — `audit_runs.heartbeat_at` and `audit_stage_runs.heartbeat_at` both populated with real timestamps in the prior DB audit |
| Bounded execution | **B. INFERRED present** — `bounded-promise-cache.ts` (from `a687c358`) and `async-time-budget.ts` both survive by name; these are exactly the kind of primitives "bounded execution" would be built on |
| Retry behavior | **UNKNOWN** — not confirmed by any file/data evidence this pass |
| Truthful status | **UNKNOWN** — no specific file or data point checked for this |
| Crash/restart recovery | **INFERRED present** — the lease/heartbeat mechanism (VERIFIED live and populated) is the standard pattern for exactly this purpose, but no explicit recovery-path code was opened to confirm |
| Concurrency protection | **INFERRED present**, same reasoning as crash/restart recovery — not confirmed by opening code |

**Explicitly not inferring column-existence-as-proof:** the basis for "present" above is the *combination* of (a) the same-named implementation files existing in current code, and (b) the live database columns being non-null and moving in realistic patterns — not the column definitions alone.

---

## 5. RESEARCH PIPELINE (`a687c358`)

**What the 17 files implement (INFERRED from filenames + commit subject):** time-bounded async execution (`async-time-budget.ts`), a bounded promise cache (`bounded-promise-cache.ts`), and their integration into `hybrid-audit-research.server.ts` and `warehouse-first-researcher.server.ts` — i.e., **rate/latency/resource-bounding for the audit pipeline's research/data-gathering step.** This matches the "Add memory: audit-source-latency.md" note in the same commit.

- **Exists in current code:** **A. EXACTLY PRESENT**, all files, confirmed by name.
- **Equivalent elsewhere:** N/A, given direct presence.
- **Data/schema changes:** **VERIFIED NONE** — this commit's file list contains no `supabase/migrations/` or schema file, only `.ts`/`.tsx`/`.md`/generated-index files.
- **Tests depending on it:** **VERIFIED** — `async-time-budget.test.ts`, `bounded-promise-cache.test.ts` both exist in current branch alongside their implementations.

---

## 6. DATABASE CORRELATION

- **`audit_runs` table** (VERIFIED in prior report: 133 rows, `lease_expires_at`/`heartbeat_at` populated 2026-09-14/15) — **directly corroborates `49702125`'s "leased, bounded, truthful" functionality being live and in active use**, now traced to a specific current-branch schema file (`artifacts/tennis-truth-engine/src/db/schema/audit.ts`).
- **`audit_stage_runs` table** (VERIFIED: 2,128 rows, `heartbeat_at` populated) — same corroboration for the heartbeat/durability mechanism at a finer grain.
- **No large tables were dumped, no migrations were run, no database was modified.** All correlation here is against row counts and date ranges already established in prior reports plus this pass's schema-file listing.

---

## 7. PRESERVATION CLASSIFICATION — FINAL

| Commit | Classification | Basis |
|---|---|---|
| **`86faff34`** (batching + alias resolution) | **ALREADY PRESERVED** (filename-level, not byte-verified) | All 3 substantive code files present by name in current branch |
| **`096f2e30`** (audit pipeline/run logic, largest) | **PARTIALLY PRESERVED** | All implementation files present by name; **`evidence-finding-selection.test.ts` confirmed ABSENT** |
| **`49702125`** (durable/leased/bounded execution) | **ALREADY PRESERVED** — strongest evidence of the four | Implementation files present by name; original SQL migration preserved on `main`; Drizzle reimplementation confirmed present; **live database data confirms active consumption**, not just schema presence |
| **`a687c358`** (research pipeline) | **ALREADY PRESERVED** (filename-level, not byte-verified) | All implementation and test files present by name |

**What would be lost if the backup branch were discarded today, based on this pass's evidence:** only the **specific test coverage in `evidence-finding-selection.test.ts`** is a confirmed, concrete gap. Everything else shows strong filename-survival evidence, though **none of the four commits' actual code content was byte-diffed against its current-branch counterpart** — "ALREADY PRESERVED" here means "a same-named file with presumably-related purpose exists," not "verified identical or superseding." That distinction matters if you want full certainty before ever considering the branch safe to fully retire.

---

## 8. REMAINING UNKNOWNS

- Byte-level content diff of any of the four commits' files against their current-branch namesakes (not performed — would require pulling full file contents on both sides, a larger operation than this pass's scope)
- `evidence-finding-selection.test.ts`'s fate — folded elsewhere, deliberately removed, or lost (genuinely unknown)
- `scripts/run-live-audit.ts` and the various `.agents/memory/*.md` files' current-branch status (not checked)
- Routes (`board.tsx`, `dashboard.tsx`, `match.$matchId.tsx`, `slate.tsx`, `upload.tsx`) — not checked this pass
- Retry behavior and "truthful status" semantics specifically (no file/data evidence gathered)
- Whether `players`/`tournaments` are referenced anywhere inside `matches.ts` (not opened) — the standing open question from the prior report remains not fully closed, though now narrowed

---

## RECOMMENDED NEXT STEP (ONE ONLY)

**Byte-diff `096f2e30`'s `evidence-finding-selection.test.ts` against the current branch's evidence-related test files** (e.g., check whether its assertions were folded into `evidence-match-identity.test.ts`, `evidence-availability-accounting.test.ts`, or a similarly-named current file) — this is the one confirmed, concrete gap out of everything examined across four commits, and it's a small, bounded check rather than the larger byte-level audit of all four commits' full content.

No migration, merge, rebase, cherry-pick, push, deletion, or modification of source, data, database, or configuration was performed. This turn ends here per your instruction.
