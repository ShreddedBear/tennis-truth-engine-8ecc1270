-- Constraints and indexes that drizzle-kit's schema diff does not generate.
--
-- Everything here is idempotent. Indexes use IF NOT EXISTS; constraints go through a DO
-- block that swallows duplicate_object, because ALTER TABLE ... ADD CONSTRAINT has no
-- IF NOT EXISTS form.
--
-- Primary keys and the unique indexes that back a UNIQUE constraint are NOT repeated here:
-- Postgres creates those itself from .primaryKey() in the Drizzle schema and from the
-- UNIQUE constraints below.

-- ===========================================================================
-- 1. CHECK and UNIQUE constraints
--
-- The CHECK constraints are the schema-level half of the engine's vocabulary: a
-- treatment can only be DIRECT / RECONSTRUCTED / PARTIAL / UNAVAILABLE / EXCLUDED, a
-- player_side only P1 / P2. They are the last line of defence against a writer
-- inventing a value the audit layers do not understand, so they are not optional.
--
-- THESE COME BEFORE THE FOREIGN KEYS, and the order is load-bearing. A foreign key can
-- only reference a column with a unique constraint on it, and
-- metric_coverage_rates.metric_code references metric_registry.metric_code -- so creating
-- the foreign keys first fails with "there is no unique constraint matching given keys"
-- on any database where both do not already exist. Against the live database, where they
-- did, the original order looked fine.
-- ===========================================================================
do $$
declare
  stmt text;
begin
  foreach stmt in array array[
    'alter table public.audit_coverage add constraint audit_coverage_player_side_check check (player_side = any (array[''P1''::text, ''P2''::text]))',
    'alter table public.audit_runs add constraint audit_runs_independent_winner_side_check check (independent_winner_side is null or independent_winner_side = any (array[''P1''::text, ''P2''::text]))',
    'alter table public.metric_coverage_rates add constraint metric_coverage_rates_player_side_check check (player_side = any (array[''P1''::text, ''P2''::text]))',
    'alter table public.metric_coverage_rates add constraint metric_coverage_rates_treatment_check check (treatment = any (array[''DIRECT''::text, ''RECONSTRUCTED''::text, ''PARTIAL''::text, ''UNAVAILABLE''::text, ''EXCLUDED''::text]))',
    'alter table public.metric_evidence_store add constraint metric_evidence_store_treatment_check check (treatment = any (array[''DIRECT''::text, ''RECONSTRUCTED''::text, ''PARTIAL''::text, ''UNAVAILABLE''::text, ''EXCLUDED''::text]))',
    'alter table public.metric_registry add constraint metric_registry_lifecycle_status_check check (lifecycle_status = any (array[''ACTIVE''::text, ''REVIEW FOR RETIREMENT''::text, ''RETIRED''::text]))',
    'alter table public.metric_results add constraint metric_results_p1_treatment_check check (p1_treatment = any (array[''DIRECT''::text, ''RECONSTRUCTED''::text, ''PARTIAL''::text, ''UNAVAILABLE''::text, ''EXCLUDED''::text]))',
    'alter table public.metric_results add constraint metric_results_p2_treatment_check check (p2_treatment = any (array[''DIRECT''::text, ''RECONSTRUCTED''::text, ''PARTIAL''::text, ''UNAVAILABLE''::text, ''EXCLUDED''::text]))',
    'alter table public.source_ingestion_runs add constraint source_ingestion_runs_status_check check (status = any (array[''QUEUED''::text, ''RUNNING''::text, ''COMPLETE''::text, ''PARTIAL''::text, ''FAILED''::text]))',
    'alter table public.truth_engine_calibration_observations add constraint truth_engine_calibration_observations_prediction_outcome_check check (prediction_outcome = any (array[''WIN''::text, ''LOSS''::text]))',
    'alter table public.audit_coverage add constraint audit_coverage_audit_run_id_player_side_key unique (audit_run_id, player_side)',
    'alter table public.audit_stage_runs add constraint audit_stage_runs_audit_run_id_stage_key unique (audit_run_id, stage)',
    'alter table public.evidence_family_coverage add constraint evidence_family_coverage_audit_run_id_family_code_key unique (audit_run_id, family_code)',
    'alter table public.formula_versions add constraint formula_versions_user_id_metric_code_version_number_key unique (user_id, metric_code, version_number)',
    'alter table public.ingestion_targets add constraint ingestion_targets_source_id_target_key_key unique (source_id, target_key)',
    'alter table public.metric_coverage_rates add constraint metric_coverage_rates_metric_code_player_side_audit_run_id_key unique (metric_code, player_side, audit_run_id)',
    'alter table public.metric_registry add constraint metric_registry_metric_code_key unique (metric_code)',
    'alter table public.probability_methods add constraint probability_methods_user_id_code_version_number_key unique (user_id, code, version_number)',
    'alter table public.probability_provenance add constraint probability_provenance_audit_run_id_metric_key_key unique (audit_run_id, metric_key)',
    'alter table public.summary_pages add constraint summary_pages_upload_id_page_number_key unique (upload_id, page_number)',
    'alter table public.user_roles add constraint user_roles_user_id_role_key unique (user_id, role)'
  ]
  loop
    begin
      execute stmt;
    exception when duplicate_object or duplicate_table then null;
    end;
  end loop;
end $$;

-- ===========================================================================
-- 2. Foreign keys
-- ===========================================================================
do $$
declare
  stmt text;
begin
  foreach stmt in array array[
    'alter table public.audit_color_ledger add constraint audit_color_ledger_match_id_fkey foreign key (match_id) references public.matches(id) on delete set null',
    'alter table public.audit_color_ledger add constraint audit_color_ledger_result_grade_id_fkey foreign key (result_grade_id) references public.result_grades(id) on delete cascade',
    'alter table public.audit_coverage add constraint audit_coverage_audit_run_id_fkey foreign key (audit_run_id) references public.audit_runs(id) on delete cascade',
    'alter table public.audit_runs add constraint audit_runs_independent_method_id_fkey foreign key (independent_method_id) references public.probability_methods(id)',
    'alter table public.audit_runs add constraint audit_runs_independent_winner_id_fkey foreign key (independent_winner_id) references public.players(id)',
    'alter table public.audit_runs add constraint audit_runs_match_id_fkey foreign key (match_id) references public.matches(id) on delete cascade',
    'alter table public.audit_stage_runs add constraint audit_stage_runs_audit_run_id_fkey foreign key (audit_run_id) references public.audit_runs(id) on delete cascade',
    'alter table public.audit_stage_runs add constraint audit_stage_runs_match_id_fkey foreign key (match_id) references public.matches(id) on delete cascade',
    'alter table public.autopsies add constraint autopsies_match_id_fkey foreign key (match_id) references public.matches(id) on delete set null',
    'alter table public.autopsies add constraint autopsies_result_grade_id_fkey foreign key (result_grade_id) references public.result_grades(id) on delete cascade',
    'alter table public.autopsy_findings add constraint autopsy_findings_autopsy_id_fkey foreign key (autopsy_id) references public.autopsies(id) on delete cascade',
    'alter table public.block_reasons add constraint block_reasons_audit_run_id_fkey foreign key (audit_run_id) references public.audit_runs(id) on delete cascade',
    'alter table public.block_reasons add constraint block_reasons_match_id_fkey foreign key (match_id) references public.matches(id) on delete cascade',
    'alter table public.calibration_buckets add constraint calibration_buckets_calibration_version_id_fkey foreign key (calibration_version_id) references public.calibration_versions(id) on delete cascade',
    'alter table public.calibration_ledger add constraint calibration_ledger_match_id_fkey foreign key (match_id) references public.matches(id) on delete set null',
    'alter table public.disagreement_results add constraint disagreement_results_audit_run_id_fkey foreign key (audit_run_id) references public.audit_runs(id) on delete cascade',
    'alter table public.disagreement_results add constraint disagreement_results_rule_id_fkey foreign key (rule_id) references public.rules(id) on delete set null',
    'alter table public.evidence_family_coverage add constraint evidence_family_coverage_audit_run_id_fkey foreign key (audit_run_id) references public.audit_runs(id) on delete cascade',
    'alter table public.execution_logs add constraint execution_logs_audit_run_id_fkey foreign key (audit_run_id) references public.audit_runs(id) on delete cascade',
    'alter table public.execution_logs add constraint execution_logs_match_id_fkey foreign key (match_id) references public.matches(id) on delete cascade',
    'alter table public.final_decisions add constraint final_decisions_audit_run_id_fkey foreign key (audit_run_id) references public.audit_runs(id) on delete cascade',
    'alter table public.final_decisions add constraint final_decisions_selected_player_id_fkey foreign key (selected_player_id) references public.players(id)',
    'alter table public.match_identity_records add constraint match_identity_records_match_id_fkey foreign key (match_id) references public.matches(id) on delete cascade',
    'alter table public.matches add constraint matches_player1_id_fkey foreign key (player1_id) references public.players(id) on delete set null',
    'alter table public.matches add constraint matches_player2_id_fkey foreign key (player2_id) references public.players(id) on delete set null',
    'alter table public.matches add constraint matches_slate_id_fkey foreign key (slate_id) references public.prediction_slates(id) on delete set null',
    'alter table public.matches add constraint matches_tournament_id_fkey foreign key (tournament_id) references public.tournaments(id) on delete set null',
    'alter table public.metric_coverage_rates add constraint metric_coverage_rates_audit_run_id_fkey foreign key (audit_run_id) references public.audit_runs(id) on delete cascade',
    'alter table public.metric_coverage_rates add constraint metric_coverage_rates_metric_code_fkey foreign key (metric_code) references public.metric_registry(metric_code)',
    'alter table public.metric_results add constraint metric_results_audit_run_id_fkey foreign key (audit_run_id) references public.audit_runs(id) on delete cascade',
    'alter table public.override_records add constraint override_records_audit_run_id_fkey foreign key (audit_run_id) references public.audit_runs(id) on delete set null',
    'alter table public.override_records add constraint override_records_match_id_fkey foreign key (match_id) references public.matches(id) on delete set null',
    'alter table public.parsed_summary_fields add constraint parsed_summary_fields_summary_version_id_fkey foreign key (summary_version_id) references public.summary_versions(id) on delete cascade',
    'alter table public.probability_provenance add constraint probability_provenance_audit_run_id_fkey foreign key (audit_run_id) references public.audit_runs(id) on delete cascade',
    'alter table public.reconstruction_results add constraint reconstruction_results_audit_run_id_fkey foreign key (audit_run_id) references public.audit_runs(id) on delete cascade',
    'alter table public.reconstruction_results add constraint reconstruction_results_formula_version_id_fkey foreign key (formula_version_id) references public.formula_versions(id)',
    'alter table public.result_grades add constraint result_grades_audit_run_id_fkey foreign key (audit_run_id) references public.audit_runs(id) on delete set null',
    'alter table public.result_grades add constraint result_grades_match_id_fkey foreign key (match_id) references public.matches(id) on delete cascade',
    'alter table public.rule_document_versions add constraint rule_document_versions_document_id_fkey foreign key (document_id) references public.rule_documents(id) on delete cascade',
    'alter table public.rules add constraint rules_version_id_fkey foreign key (version_id) references public.rule_document_versions(id) on delete cascade',
    'alter table public.source_conflicts add constraint source_conflicts_audit_run_id_fkey foreign key (audit_run_id) references public.audit_runs(id) on delete cascade',
    'alter table public.source_definitions add constraint source_definitions_fallback_source_id_fkey foreign key (fallback_source_id) references public.source_definitions(id)',
    'alter table public.source_health_events add constraint source_health_events_audit_run_id_fkey foreign key (audit_run_id) references public.audit_runs(id) on delete set null',
    'alter table public.source_health_events add constraint source_health_events_source_id_fkey foreign key (source_id) references public.source_definitions(id) on delete cascade',
    'alter table public.source_snapshots add constraint source_snapshots_audit_run_id_fkey foreign key (audit_run_id) references public.audit_runs(id) on delete cascade',
    'alter table public.source_snapshots add constraint source_snapshots_source_id_fkey foreign key (source_id) references public.source_definitions(id) on delete set null',
    'alter table public.stress_results add constraint stress_results_audit_run_id_fkey foreign key (audit_run_id) references public.audit_runs(id) on delete cascade',
    'alter table public.summary_pages add constraint summary_pages_upload_id_fkey foreign key (upload_id) references public.summary_uploads(id) on delete cascade',
    'alter table public.summary_versions add constraint summary_versions_match_id_fkey foreign key (match_id) references public.matches(id) on delete cascade',
    'alter table public.summary_versions add constraint summary_versions_upload_id_fkey foreign key (upload_id) references public.summary_uploads(id) on delete cascade',
    'alter table public.truth_engine_calibration_observations add constraint truth_engine_calibration_observations_actual_winner_id_fkey foreign key (actual_winner_id) references public.players(id)',
    'alter table public.truth_engine_calibration_observations add constraint truth_engine_calibration_observations_player1_id_fkey foreign key (player1_id) references public.players(id)',
    'alter table public.truth_engine_calibration_observations add constraint truth_engine_calibration_observations_player2_id_fkey foreign key (player2_id) references public.players(id)',
    'alter table public.truth_engine_calibration_observations add constraint truth_engine_calibration_observations_selected_player_id_fkey foreign key (selected_player_id) references public.players(id)',
    'alter table public.underdog_results add constraint underdog_results_audit_run_id_fkey foreign key (audit_run_id) references public.audit_runs(id) on delete cascade',
    'alter table public.verification_results add constraint verification_results_audit_run_id_fkey foreign key (audit_run_id) references public.audit_runs(id) on delete cascade',
    'alter table public.verification_results add constraint verification_results_rule_id_fkey foreign key (rule_id) references public.rules(id) on delete set null'
  ]
  loop
    begin
      execute stmt;
    exception when duplicate_object or duplicate_table then null;
    end;
  end loop;
end $$;

-- ===========================================================================
-- 3. Indexes
--
-- Several of these are not performance tuning -- they are correctness. Each one marked
-- CORRECTNESS below is the sole enforcement of an invariant the application relies on
-- and does not re-check in TypeScript.
-- ===========================================================================

-- CORRECTNESS: the ON CONFLICT target of upsert_metric_evidence_side. Without it that
-- function raises on every call, and duplicate evidence rows per (metric, player,
-- opponent, tournament, surface, date) become possible.
create unique index if not exists metric_evidence_context_unique_idx
  on public.metric_evidence_store
  using btree (metric_code, lower(player_name), coalesce(lower(opponent_name), ''::text),
               coalesce(lower(tournament), ''::text), coalesce(lower(surface), ''::text), as_of_date);

-- CORRECTNESS: exactly one un-retired slate can exist at a time. The (true) expression
-- makes every live row collide with every other live row.
create unique index if not exists prediction_slates_single_active
  on public.prediction_slates using btree ((true)) where (retired_at is null);

-- CORRECTNESS: one final decision per audit run.
create unique index if not exists final_decisions_run
  on public.final_decisions using btree (audit_run_id);

-- CORRECTNESS: one calibration ledger row per match, and one eligible calibration
-- observation per match -- this is what stops a single graded match being counted twice
-- in the win-rate the engine calibrates against.
create unique index if not exists calibration_ledger_one_per_match
  on public.calibration_ledger using btree (user_id, match_id) where (match_id is not null);
create unique index if not exists te_calibration_obs_eligible_match_unique
  on public.truth_engine_calibration_observations using btree (match_id) where calibration_eligible;
create unique index if not exists te_calibration_obs_run_unique
  on public.truth_engine_calibration_observations using btree (audit_run_id);

-- CORRECTNESS: run numbering and match identity within a slate.
create unique index if not exists audit_runs_match_run_number_idx
  on public.audit_runs using btree (match_id, run_number);
create unique index if not exists matches_user_slate_canonical
  on public.matches using btree (user_id, slate_id, canonical_key);
create unique index if not exists matches_slate_canonical_key_unique_nonblank
  on public.matches using btree (slate_id, canonical_key)
  where ((canonical_key is not null) and (btrim(canonical_key) <> ''::text));
create unique index if not exists players_user_key
  on public.players using btree (user_id, normalized_key);
create unique index if not exists prediction_slates_number_unique
  on public.prediction_slates using btree (slate_number);

-- CORRECTNESS: source observation de-duplication. The warehouse ingests the same feed
-- repeatedly; these two are what make a re-ingest idempotent instead of additive.
create unique index if not exists source_observations_dedupe_idx
  on public.source_observations
  using btree (source_id, coalesce(source_record_key, ''::text), coalesce(lower(player_name), ''::text),
               observation_key, coalesce(event_date, '1900-01-01'::date), coalesce(text_value, ''::text),
               coalesce(numeric_value, ('-9223372036854776000'::numeric)::double precision));
create unique index if not exists source_observations_source_record_unique_idx
  on public.source_observations using btree (source_id, source_record_key);

-- Performance only.
create index if not exists audit_coverage_run_idx on public.audit_coverage using btree (audit_run_id);
create index if not exists audit_runs_active_lease_idx on public.audit_runs using btree (status, lease_expires_at) where (status = 'RUNNING'::text);
create index if not exists final_decisions_selected_player_id_idx on public.final_decisions using btree (selected_player_id) where (selected_player_id is not null);
create index if not exists ingestion_targets_source_idx on public.ingestion_targets using btree (source_id, enabled);
create index if not exists matches_slate_id_idx on public.matches using btree (slate_id);
create index if not exists metric_coverage_rates_metric_idx on public.metric_coverage_rates using btree (metric_code, player_side);
create index if not exists metric_evidence_expiry_idx on public.metric_evidence_store using btree (valid_until);
create index if not exists metric_evidence_lookup_idx on public.metric_evidence_store using btree (metric_code, lower(player_name), as_of_date desc);
create index if not exists source_observations_player_idx on public.source_observations using btree (lower(player_name), observation_key, event_date desc);
create index if not exists source_observations_source_idx on public.source_observations using btree (source_id, retrieved_at desc);
create index if not exists te_calibration_obs_match_idx on public.truth_engine_calibration_observations using btree (match_id);
