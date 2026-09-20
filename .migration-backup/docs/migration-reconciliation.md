# Migration / schema reconciliation — production `qyovnrkiknsiqjybxubf`

Verified read-only against the live project. **Every repo migration's schema is already
present in production.** Nothing is pending in the "schema is missing" sense; what was out of
sync was the *ledger*, plus one migration that must never be applied.

## Reconciliation table

| migration | repo | production ledger | schema present | action |
| --- | --- | --- | --- | --- |
| 202608210001_metric_treatments_registry_coverage | yes | no | yes (`metric_results.p1_treatment`) | replay-safe no-op; ledger entry on next push |
| 202608210002_detailed_audit_provenance | yes | no | yes (`metric_results.source_attempts`) | replay-safe no-op |
| 20260821195118_d3fb29dd… | yes | **yes** | yes | none |
| 202608220001_safe_match_dedupe | yes | no | yes (`consolidate_duplicate_matches()`) | replay-safe no-op |
| 20260823115200_warehouse_first_evidence | yes | no | yes (`source_observations`) | replay-safe no-op |
| 20260823120500_ingestion_targets | yes | no | yes (`ingestion_targets`) | replay-safe no-op |
| 20260823122000_seed_tour_ingestion_targets | yes | no | yes (5 rows) | replay-safe — INSERT is conflict-guarded |
| 20260823172500_seed_ranking_ingestion_targets | yes | no | yes | replay-safe — conflict-guarded |
| 20260823173500_seed_rules_context_targets | yes | no | yes | replay-safe — conflict-guarded |
| 20260824013000_repair_warehouse_runtime_schema | yes | no | yes | replay-safe no-op |
| 20260824211500_ensure_source_observation_conflict_index | yes | no | yes | replay-safe no-op |
| 20260825152500_evidence_lookup_hotpath_indexes | yes | no | yes | replay-safe no-op |
| **20260826103000_supabase_security_rls_repair** | **moved out** | **no** | **no** (`security_admin%` policies absent) | **NEVER APPLY — see below** |
| 20260829091200_allow_no_source_treatment | yes | no | yes | replay-safe — drops/recreates constraints by introspection |
| 20260829203718_audit_run_leases | yes | **yes** | yes (`audit_runs.lease_owner`) | none |
| 20260830065709 / 065756 atomic_metric_evidence_upsert (+conflict target) | yes (one file) | **yes** (two rows) | yes | none |
| 20260905014306 prediction_slate_boundary | **no file** | yes | yes (`matches.slate_id`) | production-only; schema present |
| 20260905015023 truth_engine_calibration_observations | **no file** | yes | yes | production-only; schema present |
| 20260905022408 prediction_slate_scope_user_canonical_index | **no file** | yes | yes | production-only; schema present |
| 20260905045546 hard_delete_clear_slate | yes | **yes** | yes | none |
| 20260905045923 clear_slate_covers_calibration_observations | yes | **yes** | yes | none |
| 20260908072239 winner_identity_and_calibration_context_columns | yes (renamed) | **yes** | yes | filename aligned to ledger |
| 20260910143203 persist_selected_player_identity | **no file** | yes | yes (`final_decisions.selected_player_id`) | production-only; schema present |
| 20260910201442 stress_results_player_specific | **no file** | yes | yes (`p1_outcome_when_stressed` …) | production-only; schema present |
| 20260910213746 warehouse_evidence_rls_lockdown | yes (renamed) | **yes** | yes | filename aligned to ledger |
| 20260911091646 decision_table_write_lockdown | yes (renamed) | **yes** | yes | filename aligned to ledger |
| 20260911095459 security_definer_rpc_lockdown | yes (renamed) | **yes** | yes | filename aligned to ledger |
| 20260911104922 calibration_control_plane_lockdown | yes (renamed) | **yes** | yes | filename aligned to ledger |

## The one migration that must never be applied

`20260826103000_supabase_security_rls_repair.sql` has been **moved out of
`supabase/migrations/`** to `supabase/security/superseded-…sql`.

`deploy-supabase-migrations.yml` and `supabase-security-repair.yml` both run
`supabase db push`, which applies every repo migration absent from the ledger. That migration
runs `revoke all on all tables in schema public from anon` and re-grants SELECT to
`authenticated` only, gating writes behind `has_role('admin')`. Production has **zero
auth.users**, so the UI reaches Postgres as `anon`: applying it takes the whole application
offline, with no admin account for its bootstrap to find. It would also drop the scoped
`browser_read` / `browser_write` policies and re-grant `authenticated` full DML.

Leaving it in `migrations/` meant the next push to `main` would have applied it. Moving it is
what makes `db push` safe to run at all.

It is superseded by four scoped, applied, verified migrations: warehouse lockdown, decision
table write lockdown, SECURITY DEFINER RPC lockdown, calibration control-plane lockdown.
Together they close the same surface while preserving the anonymous SELECT the UI needs.

## Filename ↔ ledger alignment

Five migrations were applied to production under timestamps different from their repo
filenames (they were applied directly, then written to the repo). Their files are renamed to
the **ledger** version so `db push` recognises them as applied instead of replaying them under
a second version. Relative ordering is unchanged.

## What a `db push` will now do

Apply the twelve legacy migrations listed as "replay-safe no-op" and record them in the
ledger. Each is guarded (`if not exists` / `or replace` / `drop … if exists` / conflict-guarded
inserts) and every object it creates is already present, so the effect is ledger-only. Every
`delete from` in the repo's migrations sits inside a *function body* (clear-slate,
match-dedupe) and is defined, never executed, at migration time.

The five production-only ledger entries have no repo file. Their schema is present and
verified; writing reconstructed files for them was deliberately **not** done, because a
hand-written file that only approximates what was actually applied is worse than an honest
gap. They are recorded here instead.
