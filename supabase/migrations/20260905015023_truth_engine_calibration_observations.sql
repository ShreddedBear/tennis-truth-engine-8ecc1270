-- TRUTH ENGINE CALIBRATION OBSERVATIONS
--
-- The dataset the calibration layer is allowed to learn from, and the only one.
--
-- One row = one RESOLVED Truth Engine prediction: what the engine decided, what the decision
-- looked like when it decided, and what actually happened. The learning direction is
--
--     FINAL DECISION CHARACTERISTICS  ->  OBSERVED MATCH OUTCOME
--
-- and never any of the three things it has historically been confused with:
--   * NOT "25 metrics completed -> outcome". evidence_coverage_percent is stored because it
--     is worth analysing, and is excluded from every probability path by construction (see
--     truth-engine-calibrated-probability.ts, which cannot read this column).
--   * NOT "evidence support -> assumed probability". evidence_support_percent is a FEATURE
--     of the decision here, exactly like stress_result or corroborated. It is not a
--     probability and is never copied into one.
--   * NOT Matrix AI's WP. calibration_ledger / calibration_buckets remain the separate
--     Matrix population keyed on matrix_wp; nothing here writes to them and nothing here
--     reads them.
--
-- ADMISSION RULES, enforced by the writer (calibration-observations.server.ts) and mirrored
-- by the constraints below:
--   * prediction_outcome is WIN or LOSS only. An unknown/absent/ambiguous result is not an
--     observation at all -- it is simply not inserted. A missing winner never becomes a LOSS.
--   * one row per audit_run_id, and at most one CALIBRATION-ELIGIBLE row per match, so a
--     match audited seven times carries the weight of one match.
--   * calibration_eligible is true only for a run whose decision is PROVABLY pre-match
--     (audit_runs.independent_decision_committed_at on an earlier calendar day than
--     matches.scheduled_date). Post-match reruns are stored with the reason and excluded.

create table if not exists public.truth_engine_calibration_observations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default '00000000-0000-0000-0000-000000000001'::uuid,

  -- IDENTITY: enough to reconstruct the historical prediction end to end.
  match_id uuid not null,
  audit_run_id uuid not null,
  slate_id uuid,
  run_number integer not null default 0,
  predicted_at timestamptz,
  scheduled_date date,
  player1_name text not null,
  player2_name text not null,

  -- THE PREDICTION.
  selected_player text not null,
  decision_outcome text not null,

  -- DECISION FEATURES. Inputs to learning; none of them is a probability.
  evidence_support_percent numeric,
  directional_families integer,
  supporting_families text[] not null default '{}',
  contradicting_families text[] not null default '{}',
  neutral_families text[] not null default '{}',
  conflicted_families text[] not null default '{}',
  supporting_family_count integer,
  contradicting_family_count integer,
  corroborated boolean,
  stability text,
  verification_result text,
  disagreement_result text,
  underdog_result text,
  stress_result text,

  -- DIAGNOSTIC ONLY. Stored for analysis, never read by any probability path.
  evidence_coverage_percent numeric,
  evidence_coverage_usable integer,
  evidence_coverage_expected integer,

  -- THE CALIBRATION TARGET.
  actual_winner text not null,
  result_status text,
  final_score text,
  prediction_outcome text not null check (prediction_outcome in ('WIN','LOSS')),

  -- GOVERNANCE.
  calibration_eligible boolean not null default false,
  eligibility_reason text,

  observed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists te_calibration_obs_run_unique
  on public.truth_engine_calibration_observations(audit_run_id);
-- One match contributes at most one row to the learning population.
create unique index if not exists te_calibration_obs_eligible_match_unique
  on public.truth_engine_calibration_observations(match_id) where calibration_eligible;
create index if not exists te_calibration_obs_match_idx
  on public.truth_engine_calibration_observations(match_id);

grant select on public.truth_engine_calibration_observations to anon, authenticated;
grant all on public.truth_engine_calibration_observations to service_role;
alter table public.truth_engine_calibration_observations enable row level security;
drop policy if exists "single user open access" on public.truth_engine_calibration_observations;
create policy "single user open access" on public.truth_engine_calibration_observations
  for all to anon, authenticated using (true) with check (true);
