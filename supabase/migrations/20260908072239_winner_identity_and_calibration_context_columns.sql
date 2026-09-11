-- Winner identity hardening: propagate a stable player_id alongside the existing
-- name-string winner columns. The ID is authoritative for integrity checks; the
-- name remains display data. Nullable and unbacked for any run/decision whose
-- match never had player1_id/player2_id resolved, or whose conclusion is
-- INSUFFICIENT_EVIDENCE -- never fabricated, never inferred by name-matching.
alter table public.audit_runs
  add column if not exists independent_winner_id uuid references public.players(id);

alter table public.final_decisions
  add column if not exists selected_player_id uuid references public.players(id);

-- Calibration observation context: player identity (mirrors audit_runs/
-- final_decisions above), pre-match context needed for feature evaluation
-- (tournament/surface/event level), and version identifiers so a future
-- calibration rebuild can never silently reinterpret an existing observation.
-- All additive; the two idempotency unique indexes (te_calibration_obs_run_unique,
-- te_calibration_obs_eligible_match_unique) already exist and are untouched.
alter table public.truth_engine_calibration_observations
  add column if not exists player1_id uuid references public.players(id),
  add column if not exists player2_id uuid references public.players(id),
  add column if not exists selected_player_id uuid references public.players(id),
  add column if not exists actual_winner_id uuid references public.players(id),
  add column if not exists tournament_name text,
  add column if not exists surface text,
  add column if not exists event_level text,
  add column if not exists metrics_version_id uuid,
  add column if not exists verification_version_id uuid,
  add column if not exists disagreement_version_id uuid,
  add column if not exists calibration_model_version text,
  add column if not exists feature_version text;
