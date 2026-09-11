# Truth Engine — Production-Readiness Gap Audit

Scope: everything **not** covered by the two in-flight workstreams —
(A) winner identity persistence/display, and (B) the 14-case Stress-veto fix.
Every finding below was traced through actual code, the actual production schema, and
**read-only** queries against the live database (project `qyovnrkiknsiqjybxubf`,
`tennis-matrix-audit`). No production row was written, updated or deleted.

Production snapshot at audit time: 60 matches, 60 audit runs (all `COMPLETE`), 1,980
`metric_results` rows, 960 `audit_stage_runs` rows (all `COMPLETE`), 60 `final_decisions`,
0 `result_grades`, 0 `calibration_ledger`, 0 `truth_engine_calibration_observations`.

---

## A. Executive summary

The deterministic core is sound. `decideTruthEngineSelection`, `compareMetricRows`,
`runTruthEngineAudit` and the 16-stage state machine do what they claim: the 25 active
codes are the only ones that can vote, UNAVAILABLE is never zeroed, families vote once,
leave-one-family-out is a real recomputation, and stage dependencies are enforced at a
single choke point. Production confirms it: zero duplicate metric rows, zero duplicate
stage rows, zero duplicate decisions, zero stages left non-`COMPLETE`, zero metrics left
in a non-terminal state.

What is broken sits **around** that core, in the evidence-acquisition and
evidence-accounting layers:

1. **The evidence layer is world-writable.** Four tables — including
   `source_observations` (887 rows) and `metric_evidence_store` (6,945 rows), which the
   deterministic metric producers read to build evidence — have RLS **disabled** and full
   `SELECT/INSERT/UPDATE/DELETE/TRUNCATE` granted to `anon`. The repo contains a migration
   that fixes exactly this; it has never been applied to production. **P0.**
2. **Repo migrations and production schema have diverged.** Nine repo migrations are
   absent from production's ledger; three production migrations are absent from the repo.
   The repo is not the source of truth for the deployed schema. **P1.**
3. **The dynamic evidence denominator was inert.** The per-match denominator
   (`evidence_coverage_eligible`) equalled the fixed 25 in **all 60 runs**, and all 776
   unusable metric-sides were recorded as `PRODUCER_FAILURE` — because the decision-record
   call site dropped the two `*_unavailable_reason` columns the classifier needs.
   **Fixed in this commit.**
4. **The pass-2 dossier write-back wrote the wrong statistic into active metric rows.**
   It routed catalogued stats by *family* and took whichever member arrived first,
   bypassing the field contract every other write path obeys. Production shows 57/60
   metric-008 rows and 57/60 metric-010 rows holding a bare count (0..915, 0..280) under
   treatment `DIRECT`, for two metrics whose declared quantity is a percentage.
   **Fixed in this commit.**
5. **P1 and P2 are executed under two different eligibility rules** — status-driven for
   P1, positional-cursor-driven for P2 — and production shows a 3.9:1 one-sided-evidence
   asymmetry in P1's favour (97 P1-only vs 25 P2-only). **P1 severity, not implemented.**
6. **Four stress tests are permanently persisted as `UNSTABLE` while `status` is
   `UNAVAILABLE`**, which makes `DOUBLE GREEN` structurally unreachable for every match
   forever and reports a never-run test as a failed one. **P1 severity, not implemented.**
7. **The 70% coverage gate runs on a fixed 25 denominator**, not the dynamic one, and is
   the single dominant reason 42 of 60 decisions are green-locked. **P2.**

---

## B. Prioritized gap table

| ID | Sev | Area | Problem | Evidence | Production impact | Affected files | Recommended fix | Already covered? | Impl. required? |
|----|-----|------|---------|----------|-------------------|----------------|-----------------|------------------|-----------------|
| G1 | P0 | Security / evidence integrity (§48) | RLS disabled + full DML granted to `anon`/`authenticated` on `source_observations`, `metric_evidence_store`, `ingestion_targets`, `source_ingestion_runs` | `pg_class.relrowsecurity=false`; `role_table_grants` shows `DELETE,INSERT,SELECT,TRUNCATE,UPDATE` for `anon` on all four | Anyone holding the browser publishable key can poison or truncate the evidence the Truth Engine computes winners from | `supabase/migrations/20260826103000_supabase_security_rls_repair.sql` (written, never applied) | Apply the existing migration's section 4 | No | Yes — deploy decision is the user's |
| G2 | P1 | Schema governance (§40/§41) | Repo `supabase/migrations/` ≠ production ledger | `supabase_migrations.schema_migrations` missing 9 repo migrations; contains 3 not in repo (`winner_identity_and_calibration_context_columns`, `persist_selected_player_identity`, `stress_results_player_specific`) | Repo cannot reproduce prod schema; a "fixed" migration may never be live (see G1) | `supabase/migrations/*`, `.github/workflows/deploy-supabase-migrations.yml` | Reconcile ledger; make deploy workflow authoritative | Partly (the 3 prod-only ones are workstreams A/B) | Yes — separate task |
| G3 | P1 | Dynamic denominator (§2/§8/§36/§37) | `commitFinalDecision` omitted `p1/p2_unavailable_reason` when building `metricRows`, so the activation classifier saw `undefined` and filed every unusable side as `PRODUCER_FAILURE` | `evidence_coverage_eligible = 25` in 60/60 runs; `metric_activation` holds 776 `PRODUCER_FAILURE` and **0** `SOURCE_EMPTY`, while `metric_results` holds 652 `NO_SOURCE_FOUND` | Dynamic denominator never moved; decision records misclassify honest absence as pipeline defect; corrupts future learning inputs | `src/lib/audit-pipeline.ts` | Pass the reason columns through | No | **Done** |
| G4 | P1 | Substitute metric / provenance (§5/§9/§12/§27/§39) | Pass-2 write-back routed by evidence *family* and took the first-emitted member, bypassing `usableAgainstComparisonSpec`; overwrote already-usable sides; replaced the shared `sources` column with one side's provenance | 57/60 metric-008 and 57/60 metric-010 rows hold bare counts (max 915 / 280) under `DIRECT`; `reconstruction_result <> p1_value` in 44/45 touched metric-001 rows (P2 clobbered P1's provenance) | Wrong quantity persisted as usable evidence; inflated coverage; destroyed provenance; provider ordering could change persisted values | `src/lib/audit-pipeline.ts` | Bind the write-back to the metric's declared field/alias, persist keyed, never overwrite, merge sources | No | **Done** |
| G5 | P1 | P1/P2 symmetry (§4) | P1 resumes by **status**, P2 by a **positional cursor** (`priorDone`) — two different eligibility rules for the two players | `metricRowsForSideExecution`; production: 821 P1-usable vs 749 P2-usable active metric-sides, 97 P1-only vs 25 P2-only | P2 rows can be skipped permanently on a resumed slice; 97 comparisons lost to a P2-side miss vs 25 the other way | `src/lib/audit-pipeline.ts` | Make P2 status-driven like P1; keep `done_count` for display only | No | Yes — separate task (existing tests encode the cursor) |
| G6 | P1 | Stress diagnostics / colour (§18/§21/§46) | ST04/ST08/ST09/ST10 persist `outcome='UNSTABLE'` with `status='UNAVAILABLE'` — a never-run test reported as a failed one | 240 such rows (60 each). `audit-engine.ts` requires `stress.every(outcome==='STABLE')` for DOUBLE GREEN | `DOUBLE GREEN` is unreachable for every match, permanently; "UNSTABLE" misreports missing data as instability | `src/lib/truth-engine-stage-mapping.ts`, `src/lib/audit-engine.ts` | Introduce a non-failing outcome for unavailable tests; exclude `status<>'COMPLETE'` rows from the DOUBLE GREEN predicate | No | Yes — needs a DB check-constraint review first |
| G7 | P1 | Calibration target (§14/§28/§29) | The decision record's `selected_player`/`outcome` are the **pre-audit** decision-core values; `audit_runs.independent_winner` is the **post-audit** winner. `selectedPlayerForRun()` grades on the former | 14 of 32 refusals carry a non-null `gate_report.deterministic_decision.selected_player` while `independent_winner` is null | Result capture would grade the engine as having predicted a player it explicitly refused to predict — contaminating calibration | `src/lib/truth-engine-decision-record.ts`, `src/lib/match-result-capture.ts` | Record the post-audit winner (or record both, and grade on the authoritative one) | **Yes — workstream B**: the stress veto is the only layer that can create this gap | No (verify after B merges) |
| G8 | P2 | Coverage denominator (§12) | The 70% green-lock uses `coverageFor()`'s fixed denominator (instantiated rows minus EXCLUDED/NO_SOURCE ≈ 25), not the dynamic eligible denominator | 42 of 60 decisions carry a "Usable metric coverage = X% (min 70%)" green-lock; values as low as 4% | Real winners are downgraded GREEN→YELLOW by a static denominator the architecture says must not be static | `src/lib/audit-engine.ts` | Feed `activeMetricReadiness().eligible` into `coverageFor()` once G3 makes it real | No | Yes — only after G3 has produced live eligible≠25 data |
| G9 | P2 | Provenance schema (§5) | `sources`, `source_attempts`, `reconstruction_result`, `reconstruction_reason`, `missing_inputs` are **shared, un-sided** columns on a two-sided row | `reconstruction_result` equals `p2_value` in 100% of touched rows; differs from `p1_value` in 44/45 metric-001 rows | A row cannot state where P1's number came from independently of P2's | `metric_results` schema, `src/lib/audit-pipeline.ts` | Add `p1_/p2_` variants (additive migration); G4 mitigates by merging rather than replacing | No | Yes — schema change, out of this task's scope |
| G10 | P2 | Snapshot immutability (§27) | `applyMetaIfReady` reopens `COVERAGE PERSISTENCE`, `FINAL DECISION` and `FINAL COMBINATION GATE` and rewrites the decision row; `commitFinalDecision` reads `matches.actual_winner` into the record | `src/lib/audit-pipeline.functions.ts`; `buildDecisionRecord({actualWinner})` | A re-run after a result is known folds the outcome into the prediction record; the "frozen snapshot" is not frozen | `src/lib/audit-pipeline.functions.ts`, `src/lib/audit-pipeline.ts` | Freeze the decision record at first write; carry the outcome only in `result_grades` | No | Yes — separate task |
| G11 | P2 | `final_selection` semantics (§22) | `final_decisions.final_selection` is written from `final_recommendation` — an **action** string (`"PLAY — Alex Michelsen"`), not a player | `audit-repo.server.ts:50`; production shows `action='PLAY — Laurent Lokoli'` | A same-named column in `result_grades` holds a *player*; the two invite exactly the string-parsing bug §22 forbids | `src/lib/audit-repo.server.ts` | Stop mirroring the action into `final_selection`; use `selected_player_id` | **Yes — workstream A** (the unpopulated `selected_player_id` column already exists) | No |
| G12 | P2 | Retry policy (§8) | Only `PROVIDER_TIMEOUT` and `API_RATE_LIMIT` are retried, in-stage only. Anything else is terminal on first attempt and never revisited across slices or runs | `RETRIABLE_REASONS` in `audit-pipeline.ts`; 652 `NO_SOURCE_FOUND` sides, 0 retried | An `INTERNAL_EXCEPTION`/parser failure becomes a permanent "no evidence" for that run | `src/lib/audit-pipeline.ts`, `src/lib/metric-activation-status.ts` | Add `PARSING_FAILED`/`RECONSTRUCTION_FAILED` to the bounded retry set | No | Yes — separate task |
| G13 | P3 | Underdog diagnostics (§15) | Rows are instantiated for **both** players (15 × 2), but `runUnderdogAnalysis` by design only analyses the non-selected side, so half can never complete | 1,800 rows; 210 `COMPLETE`; 18 runs with neither side analysed (no selection), 42 with exactly one | "0 of N complete" reads like a data bug when it is intended behaviour | `src/lib/audit-pipeline.ts`, `src/lib/truth-engine-stage-mapping.ts` | Instantiate underdog rows for the underdog side only, or label the other side `NOT_APPLICABLE` rather than `UNAVAILABLE` | No | No — diagnostic clarity only |
| G14 | P3 | Config drift | `supabase/config.toml` names project `teblxzfqdqzwwooswncc`; the live project is `qyovnrkiknsiqjybxubf` | `supabase/config.toml:1` | A local `supabase` CLI run targets the wrong project | `supabase/config.toml` | Correct the ref | No | Yes — trivial |

---

## C. P0 / P1 issues in detail

### G1 (P0) — the evidence warehouse is publicly writable

`supabase/migrations/20260826103000_supabase_security_rls_repair.sql` section 4 reads:

```sql
foreach t in array array['ingestion_targets','metric_evidence_store',
                         'source_ingestion_runs','source_observations'] loop
  execute format('alter table public.%I enable row level security', t);
  execute format('revoke all on table public.%I from anon, authenticated', t);
  execute format('grant all on table public.%I to service_role', t);
```

That is the correct fix and it is already written. Production disagrees with it:

```
relrowsecurity = false  for all four tables
anon  → DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE  (all four)
```

and `supabase_migrations.schema_migrations` has no `20260826103000` row — the migration was
never applied.

Why it is P0 rather than a hygiene item: `source_observations` and `metric_evidence_store`
are not incidental. `deterministic-pbp-metrics.server.ts`, `deterministic-ranking-metrics.server.ts`,
`deterministic-results-schedule-metrics.server.ts`, `deterministic-market-metrics.server.ts`,
`deterministic-environment-metrics.server.ts` and `evidence-canonical-identity.server.ts` all
read them to produce the metric values the Truth Engine grades on. The publishable key is
shipped in the browser bundle. An outsider can therefore insert a fabricated observation for a
named player and change which player the engine selects — with correct-looking provenance
attached, because the fabricated row *is* the provenance.

Remedy: apply the existing migration (server-side writers all use the service-role client, which
bypasses RLS, so the ingestion workflows are unaffected). **Not applied here** — per the task's
"do not fix production during this task" and "STOP before broad changes" rules, the deploy is
your call.

### G3 (P1) — the dynamic denominator was silently inert *(fixed)*

`metric-activation-status.ts` is a correct classifier: `NO_SOURCE_FOUND → SOURCE_EMPTY`,
`INSUFFICIENT_SAMPLE → INSUFFICIENT_SAMPLE`, `HISTORICAL_DATA_UNAVAILABLE →
GENUINELY_UNAVAILABLE` — the three statuses that may excuse a metric from the per-match
denominator — and everything unrecognised → `PRODUCER_FAILURE`, deliberately *not* excused.

`commitFinalDecision` fed it this:

```ts
metricRows: decisionMetrics.map(m => ({ metric_code, p1_treatment, p2_treatment,
                                        p1_value, p2_value }))   // ← no reasons
```

`MetricRowForReadiness` declares `p1_unavailable_reason`/`p2_unavailable_reason` as optional,
so this typechecked. `classifySideActivation` received `reason: undefined`, fell through to
`default:`, and returned `PRODUCER_FAILURE` for every unusable side in every run.

The production consequences are exact:

| Metric | Value |
|---|---|
| `evidence_coverage_eligible` across 60 runs | min 25, max 25, avg 25 — never moved off the fixed denominator |
| `metric_activation` statuses | 724 `ACTIVATED` / 776 `PRODUCER_FAILURE` / **0** of everything else |
| `metric_results.p1_unavailable_reason` on those same sides | 652 `NO_SOURCE_FOUND`, 39 `MISSING_REQUIRED_INPUT`, 78 null |

So 652 sides that had *proved* the source holds nothing were recorded in the permanent decision
record as producer defects, and the entire dynamic-denominator feature shipped in `00459bc` has
never once produced a number different from the static one.

Fix: pass the two columns through. Diagnostic-only — nothing on this path can reach the winner,
the colour, or the 60% threshold. Regression test asserts `SOURCE_EMPTY` and
`counts_toward_denominator === false` end-to-end; it fails with `PRODUCER_FAILURE` when the fix
is reverted.

### G4 (P1) — pass-2 wrote a different statistic into active metric rows *(fixed)*

`executeMetrics`' second pass extracted catalogued atomic statistics from the player dossier and
wrote them back onto `metric_results` **by evidence family**:

```ts
for (const stat of [...raw, ...outcome.derived]) {
  const family = familyOf(stat.key);
  if (family && !statsByFamily.has(family)) statsByFamily.set(family, stat);   // first wins
}
for (const row of rows) {                                    // every row, not just pending
  const stat = statsByFamily.get(normalize(row.metric_code));
  await deps.update("metric_results", row.id, {
    [`${side}_value`]: String(stat.value),                   // bare number
    [`${side}_status`]: "COMPLETE",
    [`${side}_treatment`]: stat.origin,                      // DIRECT / RECONSTRUCTED
    sources: stat.sources ?? [],                             // replaces the shared column
    ...
  });
}
```

A catalogue family is a *group* of statistics, not one measurement. Family `008` holds
`sets_played`, `sets_won`, `set_win_pct` and several imported aliases; Truth Engine metric 008
means exactly "deciding-set win %". Family `009` is deciding-set statistics; Truth Engine metric
009 is "Pressure point win %". So the write-back persisted whichever family member the producer
emitted first, as the metric's value, under a usable treatment — and it was the **only** write
path in the pipeline that never passed through `usableAgainstComparisonSpec`, the field-contract
guard `metricPairPatch` applies to every pass-1 write.

Four distinct defects, all live:

1. **Wrong quantity persisted as usable evidence.** 57 of 60 metric-008 rows and 57 of 60
   metric-010 rows hold a bare count — ranges `0..915` and `0..280` — under treatment `DIRECT`,
   for metrics whose declared quantity is a percentage. Sample rows: `p1_value='841'`,
   `p1_value='259'`, `p1_value='5'`. `COMPARISON_SPECS` correctly refuses them
   (`VALUE_NOT_PARSEABLE`), so the *winner* was protected — but `coverageFor()` and
   `activeMetricReadiness()` both count them as usable, so coverage was inflated by roughly two
   metrics in 25 per run, and the row itself lies about what it holds.
2. **Genuine evidence overwritten.** The loop ran over `rows`, not `pending`, with no
   equivalent of `preserveUsableCurrentSide`, so a real researcher-produced value could be
   replaced by an unrelated family member in the same stage execution.
3. **Provenance destroyed across sides.** `sources` and `reconstruction_result` are *shared,
   un-sided* columns. The P2 pass replaced them wholesale: `reconstruction_result` equals
   `p2_value` in 100% of touched rows and differs from `p1_value` in **44 of 45** metric-001
   rows. P1's number was left attributed to P2's source.
4. **Non-determinism.** "First stat in the family" makes the persisted value a function of
   provider response ordering — §39's "provider result order affecting winner", one step
   removed. Metric 001 (`bareScalarFallback: true`, the single most decision-relevant code) was
   populated by this path in 45 of 60 runs; had `surface_win_pct` or `surface_matches` sorted
   ahead of `surface_elo` for one player, a 0..100 number would have been compared against a
   ~1500 Elo. That has not happened in the 60 observed runs; nothing prevented it.

Fix (`pass2WriteBackPatch`, extracted and exported so it is testable), three rules, each derived
from a contract that already exists in the codebase:

1. **Only a gradeable code.** No `COMPARISON_SPEC` → no write. This also keeps the path away
   from rows `instantiate()` deliberately seeds `EXCLUDED`/`NO_SOURCE` (META codes, quarantined
   codes, 042), which it could previously resurrect into `COMPLETE`.
2. **Only the declared quantity.** The stat's own catalogue key must **be** the spec's `field`
   or one of its `fieldAliases`, and the value is persisted in that metric's **keyed** form
   (`straight_set_win_pct=63.2`) rather than as a bare number. Selection is by key, not by
   arrival order, so provider ordering cannot change the result. Because the write is keyed it
   satisfies `usableAgainstComparisonSpec` through the named-field branch and never leans on a
   `bareScalarFallback` that 008/010 deliberately withhold.
3. **Never overwrite, never clobber.** A side already holding usable evidence is left alone;
   `sources` is merged with what the row already holds rather than replacing it.

Net effect: metric 001 keeps its legitimate `surface_elo` write; metric 010 now receives its
real `straight_set_win_pct` percentage in comparable form (an improvement — that value was
previously discarded in favour of a count); metrics 002/003/008/009 stop being written from
unrelated family members.

### G5 (P1) — P1 and P2 execute under two different rules *(not implemented)*

```ts
if (side === "p1") {
  const pending = active.filter(row => !DONE.includes(String(row["p1_status"])));   // status-driven
  ...
}
const eligible = active.filter(row => !["EXCLUDED","NO_SOURCE"].includes(String(row["p2_status"])));
const completedOrientationCount = Math.max(0, Math.min(eligible.length, priorDone - protectedCount));
return { pending: eligible.slice(completedOrientationCount), ... };                 // positional
```

P1 resumes from *what is unfinished*. P2 resumes from *an index* derived from the stage row's
`done_count`. Any change in row count or sort order between two slices of the same stage silently
skips P2 rows, permanently, with no trace — they end the run in whatever state P1's pass left
them. Production shows the asymmetry: across the 1,500 active metric-sides, P1 has usable
evidence on 821 and P2 on 749, and one-sided outcomes run **97 P1-only against 25 P2-only**.

This does not invert a winner — `compareMetricRow` correctly refuses to lean on one-sided
evidence — but it means 97 comparisons were lost to a P2-side miss versus 25 the other way, and
the two players are demonstrably not treated identically. Recommended fix: make P2 status-driven
exactly like P1 and demote `done_count` to a display counter. Not implemented here because the
existing suite encodes the positional cursor in several tests; unpicking that is its own task
with its own regression risk.

### G6 (P1) — a never-run stress test is persisted as a failed one *(not implemented)*

`stressRowPatch`'s fallback branch writes `outcome: "UNSTABLE"` with `status: "UNAVAILABLE"` for
ST04/ST08/ST09/ST10 — tests whose evidence the active set genuinely cannot produce. That is
missing data recorded as instability. 240 such rows exist (60 of each).

`audit-engine.ts` then requires, for DOUBLE GREEN:

```ts
input.stress.every((s) => s.outcome === "STABLE")
```

Four rows are permanently `UNSTABLE`, so **DOUBLE GREEN can never be produced for any match**,
regardless of evidence. Production confirms: 0 DOUBLE GREEN in 60 runs. Recommended fix: give
unavailable tests a non-failing outcome (or exclude `status <> 'COMPLETE'` rows from the
predicate). Not implemented because `stress_results.outcome` may carry a DB check constraint
that the production/repo divergence (G2) makes unsafe to assume from the repo alone.

---

## D. P2 / P3 issues

**G8 — coverage denominator (P2).** `coverageFor()` subtracts EXCLUDED and NO_SOURCE codes from
`metrics.length`, which since the 25-code restriction lands on a constant 25 — precisely the
"denominator must not be 25 automatically" rule. It is the dominant green-lock: 42 of 60
decisions carry a "Usable metric coverage = X% (min 70%)" reason, ranging down to 4%. Colour is
correctly *not* gated on it (a real winner can never be turned into "no winner"), so this only
downgrades GREEN→YELLOW. Fix after G3, once `eligible` actually differs from `expected` in live
data — wiring it in today would change nothing.

**G9 — un-sided provenance columns (P2).** `sources`, `source_attempts`,
`reconstruction_result`, `reconstruction_reason`, `missing_inputs` are single columns on a
two-sided row. §5 asks that provenance reconstruct exactly where each number came from; with
shared columns that is impossible for the side that did not write last. G4 mitigates (merge, not
replace) but the schema is the real fix.

**G10 — snapshot immutability (P2).** `applyMetaIfReady` reopens the three closing stages and
rewrites `final_decisions` whenever a meta-derived writer changes an underlying metric, and
`commitFinalDecision` reads `matches.actual_winner` into the decision record. A late re-run
after the result is known therefore folds the outcome into the prediction record. Today
`actual_winner` is 0 of 60, so nothing is contaminated yet.

**G12 — retry breadth (P2).** `RETRIABLE_REASONS = {PROVIDER_TIMEOUT, API_RATE_LIMIT}`. A
parser failure, a schema failure or an internal exception is terminal on first attempt and is
never revisited — not in a later slice, not in a later run. Bounds (max 2, same metric, same
producer, deadline-aware, no substitution) are all correctly implemented; the *set* is too narrow.

**G13 — underdog row instantiation (P3).** Rows are created for both players; only the
non-selected player can ever be analysed. 18 runs analysed neither side (no selection existed),
42 analysed exactly one. This is intended behaviour reported as though it were a failure.

**G14 — `supabase/config.toml` names the wrong project (P3).**

---

## E. Production read-only data findings

| Question | Answer |
|---|---|
| Current slate size | 60 matches, all with an active `summary_version`; 60 runs, 0 stale/invalidated |
| Runs stuck RUNNING / PENDING / BLOCKED | 0 / 0 / 0 |
| Stage rows | 960 = 60 × 16, **all COMPLETE**, no duplicates |
| Active metrics executed | 25 of 25 per run |
| Inactive metrics executing | 8 codes per run beyond the 25 — 042 plus the 7 META_OR_NON_PLAYER codes (048/049/050/056/057/058/059). All are the *documented* exceptions, seeded settled and never handed to a researcher, so they consume no provider calls and cannot vote. 059 holds 0 usable values in 60 runs (dead rows) |
| Unresolved metric states | 0 (`p1_status`/`p2_status` terminal in all 1,980 rows) |
| Duplicate metric results / stage rows / decisions | 0 / 0 / 0 |
| Winners without colours | 0 |
| Refusals carrying a winner | **14** — `gate_report.deterministic_decision.selected_player` is set while `independent_winner` is null (workstream B; see G7) |
| Colour distribution | INSUFFICIENT EVIDENCE 32, YELLOW 22, RED/PASS 4, GREEN 2, DOUBLE GREEN 0 |
| `selected_player_id` populated | 0 of 60 (workstream A) |
| Green-lock reasons | coverage < 70% on 42 rows; "Unresolved CRITICAL contradiction" on 6; "Multiple STRONG opposing underdog pathways" on 1. The `effective_evidence_count < 3` lock never fired |
| Dynamic denominator | `evidence_coverage_eligible` = 25 in **60 of 60** runs (G3) |
| Metric activation | 724 ACTIVATED, 776 PRODUCER_FAILURE, 0 SOURCE_EMPTY / INSUFFICIENT_SAMPLE / GENUINELY_UNAVAILABLE / NOT_ATTEMPTED (G3) |
| Underlying reasons actually persisted | 652 `NO_SOURCE_FOUND`, 39 `MISSING_REQUIRED_INPUT`, 78 null |
| P1/P2 evidence asymmetry | 821 P1-usable vs 749 P2-usable sides; 97 P1-only vs 25 P2-only (G5) |
| Wrong-quantity metric values | 57/60 metric-008 and 57/60 metric-010 rows hold bare counts under `DIRECT` (G4) |
| Underdog rows | 1,800; 210 COMPLETE; 7 STRONG (G13) |
| Stress rows | 600; ST01/ST02/ST03 all COMPLETE; ST05/06/07 = 28 STABLE / 14 UNSTABLE / 18 UNAVAILABLE; ST04/08/09/10 = 240 rows permanently `UNAVAILABLE`+`UNSTABLE` (G6) |
| Calibration observations | `result_grades` 0, `calibration_ledger` 0, `truth_engine_calibration_observations` 0 |
| Unresolved results | `matches.actual_winner` populated on 0 of 60 |
| Tables without RLS | 4, all writable by `anon` (G1) |

**Production rows modified: 0.** Every statement above was a `SELECT`.

---

## F. Test gaps

Already well covered, and verified as such: the 25-metric execution boundary
(`audit-pipeline.test.ts` — "instantiates only the 25 active codes plus the two documented
exceptions; every other registry code gets zero rows and zero research calls"), inactive-code
voting (`truth-engine-only-25-active-vote.test.ts`), P1/P2 inversion symmetry
(`truth-engine-immutability-inversion.test.ts`), temporal leakage (14 `*.leakage.test.ts`
files), stage ordering and dependency enforcement, Clear Slate cross-run isolation, and result
capture's open/resolved semantics.

Genuinely unprotected before this commit, in priority order:

1. **Pass-2 write-back field contract** — nothing asserted that a written value was the metric's
   declared quantity. *Added: 6 tests.*
2. **Activation classification end-to-end** — `metric-activation-status.test.ts` tests the
   classifier in isolation; nothing asserted that the pipeline actually *feeds* it the reasons.
   That gap is exactly what let G3 ship. *Added: 1 end-to-end test.*
3. **P2 resume-cursor safety (G5)** — no test drives a partial P2 slice and asserts no row is
   skipped when the row set changes between slices.
4. **Decision-record ↔ audit-winner agreement (G7)** — no test asserts that the record's
   `selected_player` equals the authoritative post-audit winner. Add once workstream B lands.
5. **Colour ↔ persisted-decision agreement** — no test asserts `final_audit_color ===
   'INSUFFICIENT EVIDENCE' ⇒ no persisted selected player`, or that DOUBLE GREEN is reachable at
   all (G6 makes it unreachable, and no test noticed).
6. **RLS/grant posture (G1)** — `supabase-security-migration.test.ts` tests the migration's SQL
   text, not the deployed state. A CI check that queries `pg_class.relrowsecurity` and
   `role_table_grants` against the live project would have caught G1 the day it regressed.
7. **Migration-ledger parity (G2)** — nothing compares `supabase/migrations/` against
   `supabase_migrations.schema_migrations`.

---

## G. Architecture gaps that will cause future regressions

1. **Optional fields on a classifier's input type.** `MetricRowForReadiness` makes the two
   reason columns optional, so dropping them typechecks and fails silently (G3). Inputs a
   classifier *needs in order to be correct* should be required, or the classifier should
   distinguish "absent" from "unknown" explicitly.
2. **One write path outside the shared guard.** `usableAgainstComparisonSpec` is the field
   contract, and pass-2 was the one door that did not go through it (G4). Every writer to
   `metric_results` should route through a single validated patch builder.
3. **Two-sided data in one-sided columns.** `sources`/`reconstruction_*` on a P1+P2 row (G9)
   guarantees that one side's provenance is destroyed by the other's write.
4. **Two coverage numbers with two denominators.** `coverageFor()` (audit-engine) and
   `activeMetricReadiness()` (decision record) answer the same question differently; the gate
   uses the static one and the record persists the dynamic one (G8).
5. **Two persisted winners per run.** `audit_runs.independent_winner` (post-audit) and
   `gate_report.deterministic_decision.selected_player` (pre-audit) can disagree, and different
   consumers read different ones (G7). One authoritative field, everything else derived.
6. **Missing data encoded as a failing value.** `outcome='UNSTABLE'` for a test that never ran
   (G6) is the same category of error as treating UNAVAILABLE as zero — which the decision core
   is scrupulous about and the stage-mapping layer is not.
7. **Repo migrations that are not the deployed schema** (G2) means any security or constraint
   fix in `supabase/migrations/` may be fiction.

---

## H. Recommended implementation order

Lowest regression risk first; each step is independently shippable.

1. **G14** — fix `supabase/config.toml`'s project ref. Zero risk, prevents a CLI run hitting the
   wrong database during any of the steps below.
2. **G2** — reconcile the migration ledger before touching anything schema-shaped, so steps 3
   and 6 are applied to a known state.
3. **G1** — apply the existing RLS repair. Server writers use the service-role client and bypass
   RLS, so the blast radius is limited to any browser code reading those four tables directly
   (there is none). **Do this early; it is the only P0.**
4. **G3 + G4** — already in this commit; they are pure application-layer changes with no schema
   dependency and full test cover.
5. **Verify G7** once workstream B (stress veto) merges, then add the
   decision-record ↔ audit-winner invariant test (F.4). No code change should be needed.
6. **G6** — check the live `stress_results.outcome` check constraint, then stop reporting an
   unavailable test as UNSTABLE and exclude non-COMPLETE rows from the DOUBLE GREEN predicate.
   Do this *after* G2 so the constraint is known.
7. **G5** — make P2 status-driven. Highest regression risk of the remaining items (it touches
   resume/retry and several existing tests), so it goes after the cheap wins and needs the
   partial-slice test from F.3 written first.
8. **G8** — feed the now-real dynamic denominator into the coverage gate. Only meaningful once
   G3 has produced live runs where `eligible ≠ 25`.
9. **G12**, then **G9**, then **G10** — retry breadth, per-side provenance columns, decision
   immutability. All additive; none blocks the others.
10. **G13** — underdog row instantiation, purely diagnostic clarity.

Nothing in this list requires changing the 25 metric definitions, the 60% threshold, family
consolidation, or the deterministic winner mathematics, and nothing here was changed.

---

## Validation

```
FULL TEST SUITE:  150 files, 1,262 tests — 1,261 passed, 1 failed
                  (the single failure is a 5s-default-timeout flake under full-suite
                   parallel load in a runtime-tennis-index test; it passes in isolation,
                   and the same class of flake is present on the unmodified baseline)
TYPECHECK:        PASS
BUILD:            PASS
WORKER BUNDLE:    PASS (7.6MB across 103 chunks; limits 8MB/chunk, 25MB total)
PRODUCTION DATA:  READ-ONLY
PRODUCTION ROWS MODIFIED: 0
```
