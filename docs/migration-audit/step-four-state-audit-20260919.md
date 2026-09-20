# FOUR-STATE FORENSIC AUDIT (RESOURCE-CONSCIOUS PASS)

**Audit date:** 2026-09-19
**Auditor:** Claude (read-only forensic audit)
**Scope:** STATE A (GitHub `tennis-truth-engine-8ecc1270`), STATE B (GitHub `Tennis-Stats-Engine`), STATE C (live Replit workspace), STATE D (live Replit Postgres database `heliumdb`). No state assumed authoritative. No migration performed or recommended.

Classification taxonomy: **VERIFIED / INFERRED / UNKNOWN / MISSING / CONFLICT / DUPLICATE / STATE-C UNIQUE / BLOCKER**

---

## 1. EXECUTIVE FINDINGS

- **Priorities 1–3 (Git provenance, DB schema, DB data inventory) are BLOCKED this session** — not because access doesn't exist, but because the Replit Agent (`ask_question`, the only channel available for shell/DB access to STATE C/D) returned "busy" on three consecutive attempts, including two of my own requests that were never delivered (their replies "outlived the call timeout" per the tool's own bounce message) plus whatever request was already in flight before I started. Per your resource-consciousness rule, I stopped after three bounces rather than continuing to retry or queuing a fourth. **This is the single material blocker for this pass** — see §9.
- **Priorities 4–6 (STATE C structure, three-way reconciliation, backup/manifest provenance) are answered below from evidence already fully established and verified across the two prior audit reports in this session** (`step-statec-provenance-20260918.md`, `step-statec-preservation-20260918.md`). Per your instruction not to re-investigate settled questions, I did not re-read files to reconfirm these — they're restated here for completeness of this consolidated report, with their original confidence tags preserved.
- **New this pass:** the only Supabase project accessible (`tennis-matrix-audit`, id `qyovnrkiknsiqjybxubf`) was created **2026-08-28T12:30:53Z** — the same calendar date encoded in both unopened backup-file names (`tennis-truth-engine_260828.backup` and `bucket-database_export_28_08_26-files.zip`, both "260828"/"28_08_26"). This is a new, previously unnoted correlation (**INFERRED**, not proven): those backups may date from around when this Supabase project was (re)provisioned, rather than from the later Drizzle migration as my prior report speculated. This revises, not confirms, the earlier timeline inference — still not verified.
- **STATE D (the live Replit Postgres database) remains entirely un-audited this session.** No Supabase project corresponds to it (confirmed — only one Supabase project exists, and it's STATE A's). The only access path is the Replit Agent, which was unavailable. **All of Priorities 2 and 3 are UNKNOWN, not inferred as empty or absent.**

---

## 2. GIT PROVENANCE — PRIORITY 1

**BLOCKER.** Could not be attempted this session beyond what was already established:

- `.git` at STATE C's workspace root returns "not found" via `list_app_files` (established in prior reports). Per the explicit classification rule already agreed in this audit, this is **GIT UNKNOWN**, not GIT ABSENT, because `list_app_files` is not a verified-reliable method for detecting `.git`.
- The eight `git` commands needed to resolve this definitively (`rev-parse --is-inside-work-tree`, `remote -v`, `status`, `rev-parse HEAD`, `branch -a`, `log`, `reflog`, `show-ref`) require shell access I don't have directly; the only proxy (Replit Agent `ask_question`) bounced three times as busy.
- **STATE C ↔ STATE A/B history connection: UNKNOWN**, unchanged from the prior report.

**No new information for Priority 1 this pass. Still GIT UNKNOWN across the board.**

---

## 3. DATABASE SCHEMA FINDINGS — PRIORITY 2

**BLOCKER / UNKNOWN — additional access/compute required.** STATE D (Replit Postgres `heliumdb`) has no Supabase-managed control plane (confirmed via `list_projects`, which returned only STATE A's `tennis-matrix-audit` Supabase project), so `mcp__Supabase__*` tools cannot reach it. The Replit Agent, the only other path, was unavailable. **None of the following were established this session:** database/schema names beyond the known env var (`STATS_DATABASE_NAME = "heliumdb"`, previously verified from `.replit`), tables, columns, types, keys, indexes, views, functions/triggers, Drizzle migration tracking table contents, or schema drift.

**What is already VERIFIED from prior file-listing work (not re-verified this pass, carried forward):** `lib/db/drizzle/` (a migrations directory) and `artifacts/tennis-truth-engine/src/db/schema/` both exist as directories; their contents were never opened in any session. This remains the single highest-value unopened item in the entire audit.

---

## 4. DATABASE DATA INVENTORY — PRIORITY 3

**UNKNOWN — additional access/compute required**, for the same reason as §3. No row counts, date ranges, provider counts, or null/duplicate/orphan counts were obtained for matches, players, tournaments, aliases, PBP, evidence, audits, canonicalization, runtime indexes, predictions, calibration, or OCR/import tables in STATE D this session. The one piece of *application-level* activity evidence that exists is not a database query result but a file already read in a prior session: `.reaudit-manifests/active-slate-reaudit.json` shows ~90 real audit-run records completing between **2026-09-14T10:07:36Z and 2026-09-14T10:41:51Z** — this proves the application was live and writing real audit state five days before this report, but says nothing about current row counts or table-level health.

---

## 5. STATE C APPLICATION INVENTORY — PRIORITY 4

**Carried forward, VERIFIED/INFERRED as originally tagged (no re-reads performed this session):**

| Package | Status |
|---|---|
| `artifacts/api-server/` | **VERIFIED**: Prediction Engine + Parlay Builder backend. `src/services/` is directory-for-directory identical (13/13) to STATE B's current `main`: `evaluation/, historicalData/, identity/, launchAudit.ts, launchAudit.test.ts, oddsData/, parlayBuilder/, payments/, playerStats/, predictionEngine/, screenshotImport/, shared/, tennisData/`. Contains real dated data (`predictions_backup_2026-07-13T*.json`) — **STATE-C UNIQUE** relative to both GitHub repos as checked. |
| `artifacts/tennis-predictor/` | **VERIFIED present**, path matches STATE B; has its own `e2e/`/Playwright suite. Internal contents not re-diffed this or prior session — **UNKNOWN** at file-content level. |
| `artifacts/tennis-truth-engine/` | **VERIFIED**: `@workspace/tennis-truth-engine`, fully on `drizzle-orm`/`pg`/`pg-query-stream`, **zero `@supabase/*` dependencies** — confirmed migrated off Supabase. Retains STATE A's TanStack/React/PDF-OCR stack and `prebuild`/`predev` runtime-index scripts unchanged. Has a real, working Replit multi-service route manifest (`artifact.toml`: mounted at `/truth-engine:19024` with production build/run/health config) — **VERIFIED not a scaffold stub**. |
| `lib/db/` | **VERIFIED present**: shared Drizzle package (`drizzle/` migrations dir, `drizzle.config.ts`, `src/{applySqlExtras.ts, index.ts, schema/, sql/}`). Contents of `schema/`/`sql/`/`drizzle/` **never opened** — highest-priority unopened item, see §3. |
| `.migration-backup/` | **INFERRED**: an intermediate, never-pushed snapshot of STATE A's tree taken *after* its Supabase→Drizzle conversion but *before* its restructuring into the `artifacts/tennis-truth-engine/` workspace package (single-package `package.json`/`bun.lock` shape, not the workspace-package shape). Not STATE A's current pushed state (missing `supabase/`, has `drizzle.config.ts` instead). |
| `.reaudit-manifests/` | **VERIFIED**: real audit-execution logs, one of three files read in full (see §4). |

**Prediction Engine / Parlay Builder / Truth Engine / audit system / shared DB layer / service routing:** all **VERIFIED present** at the structural/path level in STATE C; **UNKNOWN** at the internal-implementation-diff level (not re-verified this pass, and Part 5's original caveat stands: STATE B's `services/` subdirectory names match, but their file contents were never opened in either repo for byte-level comparison).

---

## 6. STATE A/B/C RECONCILIATION — PRIORITY 5

Carried forward from the prior three-way reconciliation report, condensed:

| Classification | Item |
|---|---|
| **STATE A → STATE C (transformed)** | Truth Engine UI/routes/components/hooks/PDF-OCR stack (**INFERRED** by name/dependency match); DB layer transformed from Supabase to Drizzle (**VERIFIED** dependency list, **INFERRED** intent from `driver-parity.test.ts`/`persistence-parity.test.ts`/`migration-checksum.test.ts` filenames — contents of those tests never read, so the *actual* parity guarantee remains unconfirmed) |
| **STATE B → STATE C** | `api-server/src/services/` (**VERIFIED** identical directory structure), `tennis-predictor/` (**VERIFIED** path match only) |
| **STATE A UNIQUE** | `src/integrations/supabase/*` (41 files) and `supabase/migrations/*` (22 files) in their original Supabase form; `TASK_PREDICTION_50_PERCENT.md` — none confirmed present in STATE C |
| **STATE C UNIQUE** | `artifacts/mockup-sandbox/`, `.reaudit-manifests/*`, `.migration-backup/`, dated prediction backup JSONs, the `/truth-engine` Replit service-routing manifest |
| **CONFLICT** | Database backend: STATE A (GitHub, as pushed) = Supabase; STATE C = Drizzle/Postgres. Both true simultaneously because they are genuinely different, diverged states of the same origin app — not a data-entry error. |
| **MISSING (open question, unresolved across all three reports)** | Whether any *non-Supabase* business logic that may have lived inside STATE A's `src/integrations/supabase/*` files was preserved somewhere in STATE C's `src/db/*`, or silently dropped when that folder was replaced. This requires reading actual file contents on both sides — never done, flagged as the top zero-loss risk in every report so far. |

---

## 7. BACKUP/PROVENANCE FINDINGS — PRIORITY 6

- **`.migration-backup/`**: see §5 — **INFERRED** intermediate STATE-A snapshot, not restored, not modified.
- **`tennis-truth-engine_260828.backup`** and **`bucket-database_export_28_08_26-files.zip`**: both unopened (binary/archive, outside the text-file-only `read_app_file` tool's scope). **New this pass**: both are name-dated 2026-08-28, the exact creation date of the sole Supabase project (`tennis-matrix-audit`). **INFERRED** (weakly — a same-day coincidence, not proof) these backups may relate to the Supabase project's initial setup rather than the later Drizzle migration. Neither confirmed as a complete workspace snapshot.
- **`.reaudit-manifests/`**: `active-slate-reaudit.json` **VERIFIED** as real audit-run output, 2026-09-14. Sibling files `active-slate-reaudit.run1.json`/`run3.json` **still unopened** — presence confirmed, content unknown, deliberately not read further per resource-consciousness (would not resolve a higher-priority open question).

---

## 8. ZERO-LOSS GAPS

| Item | Status |
|---|---|
| Application code (STATE A, B) | VERIFIED accounted for (full repo access) |
| Application code (STATE C) | VERIFIED structurally; UNKNOWN at content-diff level |
| Prediction Engine | VERIFIED present in STATE B and STATE C (path-level) |
| Parlay Builder | VERIFIED present in STATE B and STATE C (path-level) |
| Truth Engine | VERIFIED present in all of A/C; transformed DB layer VERIFIED, transformation completeness UNKNOWN |
| Database schema (STATE A/Supabase) | VERIFIED (22 migration files, Step 0) |
| Database schema (STATE D/Replit Postgres) | **UNKNOWN — BLOCKER** |
| Database data (any state) | **UNKNOWN — BLOCKER** for STATE D; STATE A's live Supabase data was never queried either (out of scope until now — flagged as a gap, not previously checked) |
| Historical data, PBP, evidence, identities, canonicalization | VERIFIED present as files in STATE A; presence in STATE C's `src/lib/` UNKNOWN (never enumerated) |
| Runtime indexes | INFERRED preserved (identical build scripts) |
| Tests | VERIFIED presence of `driver-parity`/`persistence-parity`/`migration-checksum` test files; contents UNKNOWN |
| Scripts, configuration | Partially VERIFIED, largely UNKNOWN at content level |
| Deployment | VERIFIED for STATE C (`artifact.toml`); UNKNOWN for STATE A/B's actual deployment target |
| Git history, branches, tags | VERIFIED for STATE A/B (GitHub); **UNKNOWN — BLOCKER** for STATE C |
| Backups/migration manifests | VERIFIED to exist; contents largely UNKNOWN (binary/unopened) |

---

## 9. BLOCKERS

**BLOCKER (primary, this session):** The Replit Agent (`mcp__Replit__ask_question`) — the only available channel for shell-level git inspection and for any query against STATE D (the live Replit Postgres database) — returned "busy" on three consecutive attempts this session, including two of my own submitted questions that were never delivered (the tool's own message confirms replies that outlive the call timeout are silently dropped server-side) plus an apparent earlier in-flight request. Per the resource-consciousness instruction, I stopped rather than continuing to retry or queue further requests. **This blocks Priorities 1, 2, 3, and the DB-dependent parts of Priority 7 in their entirety.**

**No other blockers were discovered this session** — no evidence of credential exposure, no destructive action taken or attempted, no schema-changing command issued.

---

## 10. RECOMMENDED NEXT AUDIT TASK ONLY

**Retry the combined Git-provenance + database-schema-metadata question via `mcp__Replit__ask_question` once the agent is confirmed idle**, ideally as two smaller, separate questions rather than one large combined one (the timeout on my first, larger combined attempt this session may itself have been a contributing cause of the subsequent "busy" state). Suggested split:
1. **Git-only** question (the 8 commands from Priority 1) — smallest, highest-value, resolves the single most-repeated open question across all four reports in this audit.
2. **Database-schema-only** question (Priority 2: table/column/constraint/index list plus Drizzle migration-tracking-table contents, explicitly no row-content dumps) — second priority, since it's needed before any data-inventory query in Priority 3 can be scoped sensibly.

Do not attempt Priority 3 (data inventory) or Priority 7 (health checks) until 1 and 2 above return successfully — they depend on knowing the actual table names and confirming git state first, per the priority-order instruction ("do not proceed to a lower-priority item if a higher-priority item reveals a blocker requiring investigation").

**No migration destination or timeline is recommended.** This report changes nothing about the standing verdict from the prior two reports: STATE C is preserved-in-place, not yet captured into an independently verifiable snapshot, and its Git/database provenance remains open questions requiring a working Replit Agent session to resolve.

No git, code, data, database, Supabase, or Replit-configuration modification was performed. This turn ends here per your instruction.
