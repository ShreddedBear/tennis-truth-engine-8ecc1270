# `evidence-finding-selection.test.ts` PRESERVATION CHECK — CORRECTION OF A PRIOR FALSE NEGATIVE

**Audit date:** 2026-09-19
**Auditor:** Claude (read-only forensic audit)
**Scope:** exactly this one file, per the requested bounded follow-up to the four-commit preservation audit. No migration, mutation, restore, or code change was performed.

**HEADLINE — read this first:** the prior report's classification of `evidence-finding-selection.test.ts` as **ABSENT** was **wrong**. It is a genuine error on my part — the file is present in the exact file listing I already had in hand two turns ago (`artifacts/tennis-truth-engine/src/lib/evidence-finding-selection.test.ts` appears in that alphabetical listing, between `evidence-coverage-runtime-diagnostic.test.ts` and `evidence-freshness.server.ts`), and I missed it while scanning a ~350-entry list. I'm not smoothing this over: the prior report should be read as superseded on this one specific point.

---

## 1. Scope

Investigated whether `evidence-finding-selection.test.ts` (from commit `096f2e30`, flagged as possibly missing in the prior four-commit preservation audit) represents a real test-coverage/functionality loss in the current consolidated branch (`claude/tennis-engine-audit-32-razn75` / live STATE C workspace). Read-only `git show`, `git log`, and `grep` only. Nothing was modified, restored, or recreated.

## 2. Original File

- **Original path (at commit `096f2e30`):** `src/lib/evidence-finding-selection.test.ts`
- **Current path (VERIFIED, confirmed present via direct grep this pass):** `artifacts/tennis-truth-engine/src/lib/evidence-finding-selection.test.ts`
- **Full original content (VERIFIED, retrieved via `git show 096f2e30:src/lib/evidence-finding-selection.test.ts`):**
  ```ts
  import { describe, expect, it } from "vitest";
  import { mergeMetricFindingSides } from "./warehouse-first-researcher.server";

  describe("warehouse evidence finding selection", () => {
    it("keeps pair-complete primary evidence intact", () => {
      const live = {
        metric_code: "001", p1_value: "A", p2_value: "B",
        p1_treatment: "DIRECT" as const, p2_treatment: "DIRECT" as const,
        differential: null, evidence_family: "RESULTS_SCHEDULE", reliability: 90,
        sample: null, unavailable_reason: null, sources: [],
      };
      const fallback = { ...live, p1_value: "fallback A", p2_value: "fallback B" };
      expect(mergeMetricFindingSides(live, fallback)).toMatchObject({ p1_value: "A", p2_value: "B" });
    });
  });
  ```
- **What it tests:** `mergeMetricFindingSides`, a function in `warehouse-first-researcher.server.ts` that merges two candidate metric-evidence "sides" (a primary/live finding and a fallback). This one test asserts that when the primary/live finding already has both `p1_value` and `p2_value` populated ("pair-complete"), the merge must keep the primary's values rather than overwriting with the fallback's.
- **Dependencies:** only `mergeMetricFindingSides` from `./warehouse-first-researcher.server` (relative import, same directory).

## 3. Original Test Coverage

The single behavior/edge case covered: **pair-completeness precedence** — a primary finding with both sides already populated must not be clobbered by a fallback finding, even if the fallback has plausible-looking alternate values.

## 4. Current Tree Search

**VERIFIED via `grep -rn "mergeMetricFindingSides" artifacts/tennis-truth-engine/src/`:**
- `evidence-finding-selection.test.ts` **exists at its current path and still imports/calls `mergeMetricFindingSides` exactly as originally written** — this is the original test, not a re-derived one.
- `warehouse-first-researcher.server.ts:153` — the function's current definition (`export function mergeMetricFindingSides(primary, fallback)`), confirmed present.
- `warehouse-first-researcher.test.ts` — a **much larger**, dedicated test suite (`describe("mergeMetricFindingSides", ...)`) covering additional cases: `p1Only`/`p2Only` merging, cached/computed precedence, provider-failure precedence, `unavailable_reason` preservation, and generic live/fallback-with-`undefined` handling.
- `warehouse-deterministic-wiring.test.ts` — a "wiring guard" test asserting that certain code literally contains calls to `mergeMetricFindingSides` in a specific order (`computed=mergeMetricFindingSides(live,deterministic)`, `merged=mergeMetricFindingSides(cached,computed)`).
- `warehouse-first-researcher-static-reconnect.test.ts` — references `mergeMetricFindingSides` in a comment, contextual only.

**Conclusion: the exact original test file is present, unchanged, at its new path, and is additionally surrounded by a substantially larger test suite for the same function.**

## 5. Git History

**VERIFIED via `git show bf3b5724 --stat`:** the commit **`bf3b5724` "Port Tennis Truth Engine into multi-app workspace"** shows `evidence-finding-selection.test.ts`, `warehouse-first-researcher.server.ts`, and `warehouse-first-researcher.test.ts` all listed with a `| 0` change count in git's rename-detected stat format — **this is git's standard signature for a pure path rename with zero content changes.** The file was moved from its old single-package path (`src/lib/...`) to the new workspace-package path (`artifacts/tennis-truth-engine/src/lib/...`) as part of the same commit that restructured the whole app into the pnpm workspace, **with byte-for-byte identical content.**

**`git log --all --oneline --follow`** for this file's original path independently corroborates this: it shows a continuous history culminating in `bf3b5724` (the port commit) at the top (most recent), with no gap or deletion commit interrupting the chain. The one `git log --diff-filter=D` query that specifically searches for deletion commits **returned no distinct deletion commit** for this path — consistent with a rename, not a delete.

**Classification: A. RENAMED/MOVED.** Cleanly, with no content loss, as part of the same commit that restructured the entire Truth Engine into the multi-app pnpm workspace.

## 6. Coverage Mapping

| Original behavior | Current implementation | Current test | Status | Evidence |
|---|---|---|---|---|
| Pair-complete primary evidence is not overwritten by a fallback | `mergeMetricFindingSides` in `warehouse-first-researcher.server.ts:153` (VERIFIED present, unchanged function name) | `evidence-finding-selection.test.ts` at its current path (VERIFIED, byte-identical per the `git show --stat` rename evidence) | **EXACTLY PRESERVED** | Clean git-detected rename, zero content diff, function still exists under the same name |
| (Broader) merge/precedence behavior of `mergeMetricFindingSides` in general | same function | `warehouse-first-researcher.test.ts` (VERIFIED, larger dedicated suite covering p1Only/p2Only, cached/computed, provider precedence, `unavailable_reason`, undefined-fallback handling) | **EXACTLY PRESERVED, and expanded** | Direct grep hits showing multiple additional test cases for the same function |
| Structural "wiring" guarantee that certain code paths actually call `mergeMetricFindingSides` in the right order | same function, called from elsewhere in `warehouse-first-researcher.server.ts` (lines 559-560, confirmed) | `warehouse-deterministic-wiring.test.ts` (VERIFIED) | **EXACTLY PRESERVED** (a test that didn't exist in the original commit but covers a related, stronger guarantee) | Direct grep hit |

## 7. Final Classification

**EXACTLY PRESERVED.**

This is not "filename exists" reasoning (which the instructions correctly warn against as insufficient) — this is git-verified, content-identical rename evidence (`| 0` changes in the rename-detected stat) plus direct confirmation the file's actual text is byte-for-byte the same at its current path, confirmed by reading the original content and independently confirming the same import/function-call pattern exists in the current file via grep.

## 8. Preservation Requirement

**NO PRESERVATION ACTION REQUIRED.**

## 9. Recommended Next Step

None required for this specific file — it is fully accounted for. If you want to continue closing out the broader four-commit audit's remaining UNKNOWNs (not part of this task's bounded scope), the smallest next bounded step would be checking the current-branch status of `scripts/run-live-audit.ts` and the `.agents/memory/*.md` files from `86faff34`/`a687c358`, which were the only items left unchecked in that report — but that is a separate task, not implied or started here.

---

## FINAL RESPONSE SUMMARY

1. **Final classification: EXACTLY PRESERVED.**
2. **Key evidence:** `git show bf3b5724 --stat` shows `evidence-finding-selection.test.ts` (along with `warehouse-first-researcher.server.ts` and `.test.ts`) renamed with zero content changes during the "Port Tennis Truth Engine into multi-app workspace" commit; direct `grep` confirms the file and its tested function (`mergeMetricFindingSides`) both exist at the current path today, surrounded by additional, more extensive test coverage for the same function.
3. **Does the "missing" test represent a real functional/coverage loss? NO.** My prior report's "ABSENT" finding was a mistake — a scan error on a long file listing I already had, not a genuine gap. There is no loss here.
4. **Audit artifact path:** `docs/migration-audit/step-evidence-finding-test-preservation-20260919.md` (this file — newly created, no existing report overwritten).
5. **Confirmation:** no source code, git history, database, deployment, or configuration was modified. Only `git show`, `git log`, and `grep` (all read-only) were run, plus this one new audit-artifact file was written under `docs/migration-audit/`. Nothing was committed or pushed.
