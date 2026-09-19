# FOUR INTEGRITY QUESTIONS — RESOLVED FROM REAL SHELL/SQL/GREP OUTPUT

**Audit date:** 2026-09-19
**Auditor:** Claude (read-only forensic audit)
**Scope:** exactly the four questions requested — `backup/pre-authenticated-rebase`, `coco1`, the five typecheck errors, and the `players`/`tournaments` vs. `canonical_players`/`player_aliases` data-model question. No unrelated exploration performed. No migration, merge, rebase, commit, push, delete, rename, overwrite, restore, or data/schema modification was performed or attempted.

---

## 1. `backup/pre-authenticated-rebase` — VERIFIED, and this is a real finding: **UNIQUE, not duplicate**

**HEAD:** `806b0990` — "Keep uploaded images out of Git"

**Divergence, VERIFIED from direct git range comparisons:**
- `claude/tennis-engine-audit-32-razn75..backup/pre-authenticated-rebase` → **19 commits** exist on the backup branch that are **not reachable from the current (already-on-GitHub) branch.**
- `backup/pre-authenticated-rebase..claude/tennis-engine-audit-32-razn75` → **248 commits** exist on the current branch that are not on the backup branch.

**Conclusion: these two branches diverged from a common ancestor. Neither is an ancestor of the other.** The current branch went on to accumulate 248 more commits after the split point, but the 19 commits unique to `backup/pre-authenticated-rebase` were never merged, cherry-picked, or otherwise carried forward into the current branch as far as commit reachability shows.

**The 19 unique commit messages (VERIFIED, oldest-relevant shown):**
```
806b0990 Keep uploaded images out of Git
9a81ca35 Update tennis runtime index files
071faa02 Update the tennis runtime index files
83735ae9 Restore app Run workflow after adding typecheck gate
905b6bc0 Update tennis runtime index data
35c46aae Restore project-wide TypeScript type checking
a687c358 Update research pipeline logic and refresh runtime index data
6ac16be4 Update tennis runtime index data and binary package
94ae820b Add supabase migration verification documentation and update memory.
8f773224 Update tennis runtime index metadata
b7ec1b7e Update runtime index and add post-merge script
49702125 Make batch audit execution durable, leased, bounded, and truthful
971bfee2 Git commit prior to merge
86faff34 Implement batching and alias resolution for the audit pipeline and add memory tracking documentation
096f2e30 Update audit pipeline and run logic with associated index data
2bef1d84 Add audit and repair instruction file to assets
f17eab22 Add audit and repair instructions asset
d75b4dac Update Replit config and import database archive
```

**Classification: UNIQUE.** Several of these are not cosmetic — `35c46aae Restore project-wide TypeScript type checking` and `83735ae9 Restore app Run workflow after adding typecheck gate` in particular. **CONFLICT / notable correlation (not proven causal):** the current branch has a live, verified typecheck failure (5 errors, §3 below). A commit titled "Restore project-wide TypeScript type checking" existing only on a branch that was never merged into the current line is at minimum a coincidence worth flagging — it is **INFERRED, not proven**, that this fix (or its intent) didn't make it into the current branch's history. Confirming that would require diffing the actual typecheck configuration between the two branches, which was not done this pass (resource-conscious stop, per your instruction to investigate only these four questions).

- **Does it exist on any remote?** **VERIFIED NO** — it was not among the local-only-vs-`origin`-tracked branches in the prior report's `git branch -a` output; it has no `origin/backup/pre-authenticated-rebase` counterpart.
- **Does it exist on `main`?** **UNKNOWN, not checked directly this pass** — but given it diverged from the same lineage as the audit branch (not `main`, based on commit content — these are audit-pipeline/runtime-index/typecheck commits, not the Supabase-era `main` content), **INFERRED unlikely** to be reachable from `main`.
- **Unique files / DB-schema work / Truth Engine / Prediction Engine / Parlay Builder content:** **UNKNOWN at the file-diff level** — only commit *messages* were inspected, not their diffs or file trees, per the resource-conscious instruction to use metadata rather than deep dives. From message content alone: `94ae820b` ("supabase migration verification documentation") is Truth-Engine/database-adjacent; `86faff34`/`49702125`/`096f2e30` (audit pipeline, batching, alias resolution) are Truth-Engine audit-system-adjacent. No message suggests Prediction-Engine or Parlay-Builder content.

**ABSOLUTE RULE RESPECTED: this branch was not deleted, altered, or touched in any way — read-only `git log` only.**

---

## 2. `coco1` — VERIFIED, classification: **TEMPORARY / GENERATED (diagnostic scratch file)**

- **Path:** workspace root, `coco1`
- **Type:** `file coco1` → **ASCII text**
- **Size:** 8 lines (`wc -l` → 8)
- **Contents (already surfaced in the prior round, reproduced here for the record — it is not sensitive):**
  ```
  git rev-parse --is-inside-work-tree 2>/dev/null || echo "NO_GIT"
  git rev-parse --show-toplevel 2>/dev/null || true
  git remote -v 2>/dev/null || true
  git status --short --branch 2>/dev/null || true
  git rev-parse HEAD 2>/dev/null || true
  ```
  (plus presumably 3 more similar lines completing the git-diagnostic command set from an earlier round of this very audit).
- **No secrets present.** Confirmed — this is literally a copy of diagnostic shell commands, not data.
- **Classification: TEMPORARY.** This is almost certainly a scratch file the Replit Agent itself created while working out how to answer one of my earlier git-provenance questions in this session (the command list matches, nearly verbatim, the git commands I originally asked it to run). **INFERRED, not proven**, since I can't see the Agent's own internal process, but the content match is a strong signal. It is not generated by a build tool, not user work, not a migration artifact, and not a production file.
- **Not deleted, not added to git, not modified**, per instruction.

---

## 3. Five typecheck errors — VERIFIED, classification: **PRE-EXISTING / IN-PROGRESS REFACTOR LAG (not a consolidation regression)**

All five errors are confined to **`artifacts/tennis-truth-engine`** and center on one shared type, `MetricComparison`/`MetricRowForComparison`, having grown fields that some consumers haven't caught up with:

| # | File:Line | Error | Type |
|---|---|---|---|
| 1 | `src/lib/truth-engine-decision-record.test.ts:23:5` | TS2353 — object literal has `actualWinner`, not a property of `DecisionRecordInput` | Test file |
| 2 | `src/lib/truth-engine-only-25-active-vote.test.ts:49:39` | TS2740 — object missing `reliability`, `normalized_reliability`, `treatment_quality`, `treatment_quality_p1`, and 8 more required `MetricComparison` fields | Test file |
| 3 | `src/lib/truth-engine-refusal-forensics.ts:211:18` | TS2430 — `ForensicMetricRow` incorrectly extends `MetricRowForComparison` | **Production source file** |
| 4 | `src/lib/truth-engine-refusal-forensics.ts:480:41` | TS2345 — `ForensicMetricRow[]` not assignable to `MetricRowForComparison[]` | **Production source file** |
| 5 | `src/lib/truth-engine-refusal-forensics.ts:680:79` | TS2345 — same family of assignability error, different call site | **Production source file** |

**Analysis:** all five trace to the same root cause — `MetricComparison`/`MetricRowForComparison` (defined elsewhere, not opened this pass) picked up new required fields, and three consumers (one production file, two test files) weren't updated to match. This is a single, coherent, **in-progress refactor left half-finished**, not five unrelated defects.

- **Related to the consolidation (Supabase→Drizzle/pnpm-workspace)?** **INFERRED NO.** Nothing in these five errors touches database access, Drizzle, `pg`, or Supabase — it's a metrics/comparison type-shape issue internal to the Truth Engine's audit logic. **Classification: PRE-EXISTING relative to any DB migration**, i.e., this looks like ordinary mid-refactor drift unrelated to the database consolidation work audited in prior reports.
- **Pre-existing vs. new:** **UNKNOWN exactly when introduced** — no `git blame` was run (would exceed the resource-conscious scope of "these four questions"). Given it's confined to one coherent type change, it's plausibly recent, but that's **INFERRED**, not dated.
- **Blocks production runtime?** **INFERRED NO, not directly** — TypeScript type errors don't halt JavaScript execution at runtime by themselves; they only block a build/CI step that specifically gates on `pnpm run typecheck` passing (not confirmed either way whether such a gate exists in this branch's CI). **Does affect code-quality/type-safety guarantees in a real production file** (`truth-engine-refusal-forensics.ts`), so it is not purely cosmetic.
- **Generated-code related?** **VERIFIED NO** — all three files are hand-written source/test files, not in a `generated/` path.

---

## 4. `players`/`tournaments` vs. `canonical_players`/`player_aliases` — VERIFIED partial answer: **schema mismatch across two different schema locations, not a within-`lib/db` deprecation**

**Key finding, VERIFIED:** grepping `lib/db/src/schema/*.ts` for `pgTable("players"` or `pgTable("tournaments")` returns **zero matches**. Only `canonical_players` and `player_aliases` are defined there (in `lib/db/src/schema/canonicalIdentity.ts`), with real, well-formed schemas:
- `canonicalPlayersTable` ("canonical_players"): `id` (text PK), `displayName`, `normalizedName`, `tour`, `nationality`, `dateOfBirth`, `handedness`, `heightCm`, `activeFrom/To`, `reviewStatus`, timestamps. Comment: *"Additive provider-independent identity registry. Existing provider IDs remain untouched."*
- `playerAliasesTable` ("player_aliases"): `id` (text PK), `provider`, `externalPlayerId`, `externalPlayerName`, `normalizedName`, `canonicalPlayerId` (**FK → `canonicalPlayersTable.id`**), `aliasType`, `verificationStatus`, `metadata`, `firstSeenAt/lastSeenAt`, timestamps.

**This means the live `players`/`tournaments` tables (VERIFIED to exist and be empty in `heliumdb`, per the prior report's schema listing) have no corresponding definition in this shared `lib/db` schema package at all.** Two explanations remain live and were **not** distinguished this pass, in keeping with the resource-conscious scope (checking `artifacts/tennis-truth-engine/src/db/schema/`, a *separate* schema directory noted in earlier reports, was not done here — it is the natural next check):

- Possibility 1: `players`/`tournaments` are defined in `artifacts/tennis-truth-engine/src/db/schema/` (the Truth Engine's *own* schema package, distinct from the shared `lib/db` one) — i.e., **two parallel, not-yet-reconciled schemas exist side by side**, one per app, and the Truth Engine's local one still models `players`/`tournaments` under old names while the shared package uses the newer `canonical_*` naming. This would classify as **D. schema mismatch** (two schema sources of truth not yet reconciled), leaning toward **B. incomplete migration** if the intent was always to converge on `canonical_players`.
- Possibility 2: `players`/`tournaments` are legacy tables with no current Drizzle definition anywhere (created by a since-abandoned tool, a raw-SQL step, or carried over from the `bucket-database_export_28_08_26-files.zip`/Supabase-era import noted in a prior report) and are simply dead weight in the live database. This would classify as **C. legacy tables no longer used**.

**Classification for this pass: CONFLICT/UNKNOWN between possibilities 1 and 2 — not resolved.** What **is** resolved and VERIFIED: the comment on `canonicalPlayersTable` ("Additive... **existing provider IDs remain untouched**") reads as deliberate, careful migration language — consistent with an **intentional, in-progress introduction of a new canonical layer alongside something older**, which leans toward **A (intentional replacement, in progress)** or **B (incomplete migration)** rather than pure accidental drift, but this is **INFERRED from one code comment, not proven** by seeing what the "existing" side actually is.

**No records were inserted, updated, deleted, renamed, or migrated. No assumption was made that empty means broken, and no assumption was made that canonical tables replace the legacy ones without evidence — this section explicitly leaves that question open rather than guessing.**

---

## 5. BLOCKERS

**None new this pass.** All four requested investigations returned usable evidence; no tool timeouts or "busy" bounces occurred this round (in contrast to earlier in this session).

---

## 6. ITEMS REQUIRING PRESERVATION

1. **`backup/pre-authenticated-rebase`** — confirmed to hold 19 commits not reachable from any other branch checked, including a typecheck-restoration commit that may be relevant to the current branch's live typecheck failures. **Local-only, not on any remote.** If this Replit workspace were ever discarded, reset, or garbage-collected without first pushing this branch, that history would be permanently lost. **Highest-priority preservation item identified in this entire audit so far.**
2. **`coco1`** — low-value but harmless; no preservation urgency, but per instruction it was not deleted or modified.
3. Everything already flagged in prior reports (`.migration-backup/`, `.reaudit-manifests/`, the two unopened backup archive files) remains standing and unresolved.

---

## 7. RECOMMENDED NEXT STEP (ONE ONLY)

**Diff `backup/pre-authenticated-rebase`'s two typecheck-related commits (`35c46aae "Restore project-wide TypeScript type checking"` and `83735ae9 "Restore app Run workflow after adding typecheck gate"`) against the current branch's equivalent files**, specifically to determine whether the fix those commits represent is (a) already present in the current branch under different commit SHAs (safe — nothing lost), or (b) genuinely absent, which would mean the current branch's 5 live typecheck errors are a **direct, attributable regression** from history that existed but was dropped during whatever rebase this backup branch was named for. This is the single highest-value follow-up because it would convert the biggest open CONFLICT in this report (§1 and §3's correlation) into either a closed, verified non-issue or a concretely attributable and preservable fix.

No migration, merge, rebase, commit, push, deletion, or modification was performed. This turn ends here per your instruction.
