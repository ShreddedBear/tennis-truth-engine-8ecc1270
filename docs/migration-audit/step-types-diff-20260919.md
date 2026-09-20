# `types.ts` — HASH-BISECTION DIFF AUDIT

**Audit date:** 2026-09-19
**Auditor:** Claude (read-only forensic audit)
**Scope:** `artifacts/api-server/src/services/predictionEngine/types.ts`, exactly as requested. No merge, copy, restore, or modification of either source file was performed. **Methodology: SHA-256 hash bisection only, as instructed — no reliance on relayed source text for exact character-level claims.** Short snippets quoted below were relayed via the Agent for readability, but every structural claim (line boundaries, presence/absence of content) rests on hash comparisons, not on trusting the relay's exact character reproduction.

---

## 1. Classification

**REAL DIFFERENCES FOUND — one isolated, bounded, content-verified region. Not byte-identical.**

---

## 2. File Identity and Whole-File Comparison

| | `Tennis-Stats-Engine` | State C |
|---|---|---|
| Path | `artifacts/api-server/src/services/predictionEngine/types.ts` | same |
| Line count | **165** (VERIFIED, local `wc -l`) | **162** (VERIFIED, Agent `wc -l`) — 3 lines shorter |
| SHA-256 | `c5049912d64bb008f09c06af4fb6a0779eef22120cf16d630026cd50c66a3674` | `743470dc0f8bbc7e61487b318c018a0424b23d8e0385815d871cc757a6cecdd5` |
| Whole-file match? | **NO** | |

---

## 3. Hash Bisection — Isolating the Exact Differing Region

| Range | TSE hash | State C hash | Match? |
|---|---|---|---|
| Prefix 1–100 | `d27989c4...` | `d27989c4...` | ✅ |
| Prefix 1–115 | `9989c69b...` | *(equivalent point confirmed matching)* | ✅ |
| Prefix 1–116 | `b2b5ee30...` | `f5d61a69...` | ❌ first divergence |
| Prefix 1–117, 1–118 | `92e9dfb1...`, `f35c9752...` | `0007446b...`, `7232ef48...` | ❌ |
| Prefix 1–120 | `24cacc02...` | `d2749e2b...` | ❌ |
| Suffix, last 10 lines | `c78d010e...` | `c78d010e...` | ✅ |
| Suffix, last 20 lines | `25aaa942...` | `25aaa942...` | ✅ |
| Suffix, last 30 lines | `8218235f...` | `8218235f...` | ✅ |
| Suffix, last 40 lines | `55f127d2...` | `55f127d2...` | ✅ |
| Suffix, last 50 lines | `457689f9...` | `1c99665b...` | ❌ first divergence from the end |

**Conclusion from bisection (VERIFIED via hashes, not text):** the prefix (lines 1–115 in both files) is byte-identical, and the suffix (TSE's last 40 lines = 126–165; State C's last 40 lines = 123–162) is byte-identical. **The entire difference between the two files is confined to a single bounded region: TSE lines 116–125 (10 lines) versus State C lines 116–122 (7 lines)** — a net 3-line difference, which exactly and fully accounts for the whole file's 165-vs-162 line-count gap. **No other difference exists anywhere else in this file.**

---

## 4. The Differing Region — Exact Location, Both Versions

This is the JSDoc comment for the `asOfDate?: Date` field on `PredictionEngineInput` (the same field visible in the earlier reconnaissance of lines 100–135).

**TSE, lines 116–125 (10 lines; relayed via local file read, trusted — read directly from disk, not through the Agent):**
> *"The instant every recency-window module (`fatigue.ts`, `matchLoadRecovery.ts`, `availability.ts`'s rest-days/recent-walkover/recent-retirement windows) measures against. Omit for every live call -- it defaults to the real current time, which is correct there. Walk-forward/backtest evaluation (`historicalScoring.ts`, `ablation.ts`, and the one-off `scripts/` replays) passes each match's own frozen `cutoffAt` here instead, so historical rows measure recency against their own as-of moment rather than today's wall-clock time. 2026-07-14 fix -- before this, backtest Fatigue always compared match dates from years ago against `Date.now()`, so the windows were always empty. **2026-09-16: the same fix extended to Availability, which had the identical `new Date()` bug independently.**"*

**State C, lines 116–122 (7 lines; relayed via the Agent — treated as approximate for exact punctuation/backticks per the methodology note, but the substantive wording and, critically, the *presence/absence* of entire sentences is a structural fact, not a punctuation nuance):**
> *"The instant Fatigue's 3/7/14-day recency windows are measured against (see fatigue.ts). Omit for every live call -- it defaults to the real current time, which is correct there. Walk-forward/backtest evaluation (historicalScoring.ts) passes each match's own frozen cutoffAt here instead, so historical rows measure recency against their own as-of moment rather than today's wall-clock time. 2026-07-14 fix -- before this, backtest fatigue always compared match dates from years ago against Date.now(), so the windows were always empty."*

**State C's version does not mention `matchLoadRecovery.ts` or `availability.ts` in the opening sentence (only "Fatigue's... windows"), and entirely lacks the closing sentence about a 2026-09-16 fix extending the same date-handling correction to Availability.**

---

## 5. Behavioral/Structural Significance

| Location | TSE version | State C version | Significance | Callers/dependents | Affects behavior? | Missing functionality? | Migration conflict? |
|---|---|---|---|---|---|---|---|
| `asOfDate` JSDoc, `PredictionEngineInput` | Documents `asOfDate` as governing Fatigue, MatchLoadRecovery, **and Availability** recency windows; explicitly records a **2026-09-16 fix** that extended a backtest date-handling correction to the Availability module | Documents `asOfDate` as governing **only Fatigue's** recency windows; only records the earlier **2026-07-14** fix | **Comments are documentation, not executable code — this specific diff, by itself, changes nothing at runtime.** But per the note itself, it is describing a real code-level bug-and-fix pair (`new Date()` used instead of a frozen `asOfDate`/`cutoffAt`) | The type is consumed wherever `PredictionEngineInput.asOfDate` is read — most directly `availability.ts` and `index.ts` (the file that threads `asOfDate` into each feature module's call) | **Not by this comment directly** — but it is documentary evidence that a corresponding code change (dated 2026-09-16) exists in `Tennis-Stats-Engine`'s `main` and is **not described as present** in State C's copy of this file | **Possibly yes — this is the open question, not resolved by this file alone.** `availability.ts` itself was already confirmed **byte-identical** between the two trees in the prior reconciliation report. That means either (a) the actual 2026-09-16 fix lived somewhere else (most likely `index.ts`, which the prior report already confirmed differs between the two trees, and which is the file responsible for actually passing `asOfDate` into each module's call), not in `availability.ts` itself, or (b) the fix was purely comment/documentation and no code change actually accompanied it in the file that changed. **Not determined by this file alone — see §7.** | **No direct migration conflict from this file** — it's a type/comment file, not executable logic on its own. But it is the clearest documentary breadcrumb yet for whether State C's `availability.ts`-via-`index.ts` wiring has the same historical-backtest bug that Fatigue had before 2026-07-14, just for Availability, unfixed as of whatever point State C's tree was taken |

---

## 6. Does either side contain functionality missing from the other?

**In this file specifically: no executable functionality differs — this is a comment-only difference.** `PredictionEngineInput`, `ModuleResult`, `AblationModelKey`, `SimulatorAdoptionInput`, `SegmentSpecialistInput`, and every other exported type/interface in the file (confirmed via the byte-identical prefix and suffix regions, which cover the entire rest of the file) are structurally and textually identical between the two trees. **The only thing "missing" from State C is a sentence of documentation describing a dated bug fix — but that sentence's existence in TSE `main` is itself strong evidence that the underlying bug fix exists in TSE's `index.ts`/`availability.ts` wiring and may not exist in State C's.** This file cannot answer that on its own; it can only point at it.

---

## 7. Recommended Next Single Step (not executed)

**Hash-bisect `index.ts`** (already known to differ between the two trees, per the prior reconciliation report) **specifically around wherever it threads `asOfDate` into the `availability.ts` module call**, to determine whether State C's `index.ts` passes a frozen `asOfDate`/`cutoffAt` into Availability's recency-window calculations, or whether it still relies on `new Date()` there — which is precisely the bug this comment describes being fixed on `Tennis-Stats-Engine`'s side on 2026-09-16. This is the smallest, most direct step that would convert this section's "possibly yes" into a confirmed yes/no on real behavioral impact.

---

## FINAL SUMMARY

1. **Byte-identical?** No.
2. **Real differences found, isolated via hash bisection to an exact, bounded region:** TSE lines 116–125 vs. State C lines 116–122, entirely within one JSDoc comment on the `asOfDate` field.
3. **Nature of the difference:** State C's comment is missing the sentence documenting a 2026-09-16 fix that (per TSE's own comment) extended a backtest date-handling bug fix from Fatigue to Availability.
4. **Does this affect application behavior by itself?** No — it's a comment-only diff in this file.
5. **Does it suggest a real, unresolved functional gap elsewhere?** Yes, plausibly — in `index.ts` and/or `availability.ts`'s actual runtime wiring, not confirmed by this file alone.
6. **Migration conflict from this file?** None directly.
7. **Nothing was modified, restored, merged, or chosen between.** All findings rest on SHA-256 hash comparisons; the only relayed-text quotation (§4) is flagged as approximate for exact punctuation per the stated methodology, with the structural claim (sentence present/absent) treated as reliable since it's corroborated by the hash-bounded region size, not by trusting the text's exact characters.

**STOP after this file, per instruction. No merge, cherry-pick, rebase, commit, or push was performed or is being recommended for execution at this time.**
