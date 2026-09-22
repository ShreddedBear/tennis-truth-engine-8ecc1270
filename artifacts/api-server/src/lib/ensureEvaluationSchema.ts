import { pool } from "@workspace/db";
import { logger } from "./logger";
import { extractFallbackInstrumentation } from "../services/evaluation/fallbackInstrumentation";
import { RISK_FLOOR_OBSERVABILITY_COLUMNS } from "./marketEvidenceMigrations.js";

const STATEMENTS: string[] = [
  // Ledger table used by /api/predictions (Run Model, Paste, Bulk).
  `
  CREATE TABLE IF NOT EXISTS predictions (
    id SERIAL PRIMARY KEY,
    player1_id TEXT NOT NULL,
    player1_name TEXT NOT NULL,
    player2_id TEXT NOT NULL,
    player2_name TEXT NOT NULL,
    surface TEXT NOT NULL,
    match_format TEXT NOT NULL,
    tournament_level TEXT,
    tournament_name TEXT,
    strategy_id TEXT,
    strategy_version TEXT,
    calibration_version TEXT,
    external_fixture_id TEXT,
    snapshot_captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    predicted_winner_id TEXT NOT NULL,
    predicted_winner_name TEXT NOT NULL,
    calibrated_probability REAL NOT NULL DEFAULT 0.5,
    predicted_winner_probability REAL NOT NULL DEFAULT 0.5,
    data_quality INTEGER NOT NULL DEFAULT 0,
    data_quality_label TEXT NOT NULL DEFAULT 'Unknown',
    upset_risk TEXT NOT NULL DEFAULT 'Unknown',
    recommendation TEXT NOT NULL DEFAULT 'No Bet',
    predicted_set_score TEXT NOT NULL DEFAULT 'N/A',
    engine JSONB NOT NULL DEFAULT '{}'::jsonb,
    match_identity_key TEXT,
    input_snapshot_hash TEXT,
    actual_winner_id TEXT,
    actual_winner_name TEXT,
    decision_trace JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at TIMESTAMPTZ
  )
  `,
  // Core runner tables used by walk-forward + paper-trade + optimizer.
  `
  CREATE TABLE IF NOT EXISTS evaluation_runs (
    id SERIAL PRIMARY KEY,
    fold_index INTEGER NOT NULL DEFAULT 0,
    model_version TEXT NOT NULL DEFAULT 'unknown',
    train_start TIMESTAMPTZ NOT NULL DEFAULT now(),
    train_end TIMESTAMPTZ NOT NULL DEFAULT now(),
    validation_start TIMESTAMPTZ NOT NULL DEFAULT now(),
    validation_end TIMESTAMPTZ NOT NULL DEFAULT now(),
    test_start TIMESTAMPTZ NOT NULL DEFAULT now(),
    test_end TIMESTAMPTZ NOT NULL DEFAULT now(),
    calibration_mapping JSONB NOT NULL DEFAULT '[]'::jsonb,
    validation_metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
    test_metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )
  `,
  `
  CREATE TABLE IF NOT EXISTS evaluation_predictions (
    id SERIAL PRIMARY KEY,
    run_kind TEXT NOT NULL,
    player1_id TEXT NOT NULL,
    player1_name TEXT NOT NULL,
    player2_id TEXT NOT NULL,
    player2_name TEXT NOT NULL,
    scheduled_start_at TIMESTAMPTZ NOT NULL,
    cutoff_at TIMESTAMPTZ NOT NULL,
    model_version TEXT NOT NULL,
    data_segment TEXT NOT NULL DEFAULT 'live',
    status TEXT NOT NULL DEFAULT 'pending',
    locked_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )
  `,
  `
  CREATE TABLE IF NOT EXISTS calibration_models (
    id SERIAL PRIMARY KEY,
    method TEXT NOT NULL DEFAULT 'isotonic',
    mapping JSONB NOT NULL DEFAULT '[]'::jsonb,
    validation_sample_size INTEGER NOT NULL DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT true,
    holdout_sample_size INTEGER NOT NULL DEFAULT 0,
    fitted_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )
  `,
  `
  CREATE TABLE IF NOT EXISTS specialist_models (
    id SERIAL PRIMARY KEY,
    segment_key TEXT NOT NULL,
    tour TEXT NOT NULL DEFAULT 'Unknown',
    surface TEXT NOT NULL DEFAULT 'Unknown',
    label TEXT NOT NULL DEFAULT 'Unknown',
    historical_match_count INTEGER NOT NULL DEFAULT 0,
    meets_threshold BOOLEAN NOT NULL DEFAULT false,
    validation_sample_size INTEGER NOT NULL DEFAULT 0,
    calibration_mapping JSONB NOT NULL DEFAULT '[]'::jsonb,
    weight REAL NOT NULL DEFAULT 0,
    computed_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )
  `,
  `
  CREATE TABLE IF NOT EXISTS prediction_settings (
    id SERIAL PRIMARY KEY,
    retirement_rule TEXT NOT NULL DEFAULT 'excluded',
    paper_trade_lead_minutes INTEGER NOT NULL DEFAULT 30,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )
  `,
  `
  CREATE TABLE IF NOT EXISTS threshold_evaluation_runs (
    id SERIAL PRIMARY KEY,
    total_graded INTEGER NOT NULL DEFAULT 0,
    thresholds JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )
  `,
  `
  CREATE TABLE IF NOT EXISTS pattern_analysis_runs (
    id SERIAL PRIMARY KEY,
    total_analyzed INTEGER NOT NULL DEFAULT 0,
    segments JSONB NOT NULL DEFAULT '[]'::jsonb,
    run_kinds_included JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )
  `,
  `
  CREATE TABLE IF NOT EXISTS job_runs (
    id SERIAL PRIMARY KEY,
    job_name TEXT NOT NULL,
    started_at TIMESTAMPTZ NOT NULL,
    finished_at TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 1,
    summary JSONB,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )
  `,
  `ALTER TABLE job_runs ALTER COLUMN finished_at DROP NOT NULL`,
  `
  CREATE TABLE IF NOT EXISTS candidate_configs (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )
  `,
  `
  CREATE TABLE IF NOT EXISTS config_promotions (
    id SERIAL PRIMARY KEY,
    candidate_config_id INTEGER NOT NULL,
    approved_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )
  `,
  // Additional strategy lifecycle tables requested by dashboard/system requirements.
  `
  CREATE TABLE IF NOT EXISTS optimizer_runs (
    id BIGSERIAL PRIMARY KEY,
    run_uid TEXT UNIQUE,
    status TEXT NOT NULL DEFAULT 'queued',
    stage TEXT,
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    error_summary TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )
  `,
  `
  CREATE TABLE IF NOT EXISTS strategy_versions (
    id BIGSERIAL PRIMARY KEY,
    strategy_id TEXT,
    strategy_name TEXT,
    strategy_version TEXT,
    strategy_fingerprint TEXT,
    status TEXT NOT NULL DEFAULT 'candidate',
    engine_version TEXT,
    calibration_version TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    promoted_at TIMESTAMPTZ,
    superseded_at TIMESTAMPTZ,
    archived_at TIMESTAMPTZ,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb
  )
  `,
  `
  CREATE TABLE IF NOT EXISTS strategy_metrics (
    id BIGSERIAL PRIMARY KEY,
    strategy_version_id BIGINT REFERENCES strategy_versions(id) ON DELETE CASCADE,
    sample_size INTEGER,
    accuracy REAL,
    log_loss REAL,
    brier_score REAL,
    ece REAL,
    roi REAL,
    high_confidence_accuracy REAL,
    elite_tier_accuracy REAL,
    coverage REAL,
    abstention_rate REAL,
    compared_to_strategy_version_id BIGINT REFERENCES strategy_versions(id) ON DELETE SET NULL,
    metric_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )
  `,
  `
  CREATE TABLE IF NOT EXISTS strategy_segment_metrics (
    id BIGSERIAL PRIMARY KEY,
    strategy_version_id BIGINT REFERENCES strategy_versions(id) ON DELETE CASCADE,
    segment_type TEXT NOT NULL,
    segment_key TEXT NOT NULL,
    sample_size INTEGER,
    accuracy REAL,
    log_loss REAL,
    brier_score REAL,
    ece REAL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )
  `,
  `
  CREATE TABLE IF NOT EXISTS strategy_weight_changes (
    id BIGSERIAL PRIMARY KEY,
    strategy_version_id BIGINT REFERENCES strategy_versions(id) ON DELETE CASCADE,
    model_key TEXT NOT NULL,
    from_value REAL,
    to_value REAL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )
  `,
  `
  CREATE TABLE IF NOT EXISTS strategy_threshold_changes (
    id BIGSERIAL PRIMARY KEY,
    strategy_version_id BIGINT REFERENCES strategy_versions(id) ON DELETE CASCADE,
    threshold_key TEXT NOT NULL,
    from_value REAL,
    to_value REAL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )
  `,
  `
  CREATE TABLE IF NOT EXISTS strategy_promotions (
    id BIGSERIAL PRIMARY KEY,
    strategy_version_id BIGINT REFERENCES strategy_versions(id) ON DELETE RESTRICT,
    previous_strategy_version_id BIGINT REFERENCES strategy_versions(id) ON DELETE SET NULL,
    promoted_by TEXT,
    reason TEXT,
    comparison JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )
  `,
  `
  CREATE TABLE IF NOT EXISTS strategy_rejections (
    id BIGSERIAL PRIMARY KEY,
    strategy_version_id BIGINT REFERENCES strategy_versions(id) ON DELETE RESTRICT,
    rejected_by TEXT,
    reason_code TEXT,
    reason_text TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )
  `,
  `
  CREATE TABLE IF NOT EXISTS strategy_audit_log (
    id BIGSERIAL PRIMARY KEY,
    strategy_version_id BIGINT REFERENCES strategy_versions(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL,
    actor TEXT,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )
  `,
  `
  CREATE TABLE IF NOT EXISTS walk_forward_runs (
    id BIGSERIAL PRIMARY KEY,
    run_uid TEXT UNIQUE,
    evaluation_only BOOLEAN NOT NULL DEFAULT true,
    status TEXT NOT NULL DEFAULT 'queued',
    fold_count INTEGER,
    matches_completed INTEGER NOT NULL DEFAULT 0,
    matches_total INTEGER,
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    checkpoint JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )
  `,
  `
  CREATE TABLE IF NOT EXISTS walk_forward_folds (
    id BIGSERIAL PRIMARY KEY,
    walk_forward_run_id BIGINT REFERENCES walk_forward_runs(id) ON DELETE CASCADE,
    fold_index INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued',
    sample_size INTEGER,
    metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )
  `,
  `
  CREATE TABLE IF NOT EXISTS paper_trade_runs (
    id BIGSERIAL PRIMARY KEY,
    run_uid TEXT UNIQUE,
    status TEXT NOT NULL DEFAULT 'queued',
    fixtures_found INTEGER NOT NULL DEFAULT 0,
    predictions_created INTEGER NOT NULL DEFAULT 0,
    predictions_skipped INTEGER NOT NULL DEFAULT 0,
    matches_graded INTEGER NOT NULL DEFAULT 0,
    error_count INTEGER NOT NULL DEFAULT 0,
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )
  `,
  `
  CREATE TABLE IF NOT EXISTS paper_trade_predictions (
    id BIGSERIAL PRIMARY KEY,
    paper_trade_run_id BIGINT REFERENCES paper_trade_runs(id) ON DELETE SET NULL,
    provider TEXT,
    external_fixture_id TEXT,
    prediction_timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
    scheduled_start TIMESTAMPTZ,
    lock_timestamp TIMESTAMPTZ,
    strategy_version TEXT,
    calibration_version TEXT,
    strategy_fingerprint TEXT,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    grading_status TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )
  `,
  // Structural aliases for downstream analytics or compatibility views.
  `
  CREATE TABLE IF NOT EXISTS candidate_strategies (
    id BIGSERIAL PRIMARY KEY,
    candidate_config_id INTEGER,
    strategy_id TEXT,
    strategy_version TEXT,
    status TEXT NOT NULL DEFAULT 'candidate',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb
  )
  `,
  // Critical columns used by current app code.
  `ALTER TABLE evaluation_predictions ADD COLUMN IF NOT EXISTS strategy_id TEXT`,
  `ALTER TABLE evaluation_predictions ADD COLUMN IF NOT EXISTS strategy_version TEXT`,
  `ALTER TABLE evaluation_predictions ADD COLUMN IF NOT EXISTS strategy_fingerprint TEXT`,
  `ALTER TABLE evaluation_predictions ADD COLUMN IF NOT EXISTS optimizer_run_id TEXT`,
  `ALTER TABLE evaluation_predictions ADD COLUMN IF NOT EXISTS prediction_mode TEXT`,
  `ALTER TABLE evaluation_predictions ADD COLUMN IF NOT EXISTS calibration_version TEXT`,
  `ALTER TABLE evaluation_predictions ADD COLUMN IF NOT EXISTS competitive_balance_version TEXT`,
  `ALTER TABLE evaluation_predictions ADD COLUMN IF NOT EXISTS evidence_reliability_version TEXT`,
  `ALTER TABLE evaluation_predictions ADD COLUMN IF NOT EXISTS fold_id INTEGER`,
  `ALTER TABLE evaluation_predictions ADD COLUMN IF NOT EXISTS segment TEXT`,
  `ALTER TABLE evaluation_predictions ADD COLUMN IF NOT EXISTS data_segment TEXT NOT NULL DEFAULT 'live'`,
  `ALTER TABLE evaluation_predictions ADD COLUMN IF NOT EXISTS shadow_batch_label TEXT`,
  `ALTER TABLE evaluation_predictions ADD COLUMN IF NOT EXISTS historical_match_id INTEGER`,
  `ALTER TABLE evaluation_predictions ADD COLUMN IF NOT EXISTS provider TEXT`,
  `ALTER TABLE evaluation_predictions ADD COLUMN IF NOT EXISTS external_fixture_id TEXT`,
  `ALTER TABLE evaluation_predictions ADD COLUMN IF NOT EXISTS surface TEXT`,
  `ALTER TABLE evaluation_predictions ADD COLUMN IF NOT EXISTS match_format TEXT`,
  `ALTER TABLE evaluation_predictions ADD COLUMN IF NOT EXISTS tournament_level TEXT`,
  `ALTER TABLE evaluation_predictions ADD COLUMN IF NOT EXISTS tournament_name TEXT`,
  `ALTER TABLE evaluation_predictions ADD COLUMN IF NOT EXISTS feature_snapshot JSONB`,
  `ALTER TABLE evaluation_predictions ADD COLUMN IF NOT EXISTS raw_probability REAL`,
  `ALTER TABLE evaluation_predictions ADD COLUMN IF NOT EXISTS calibrated_probability REAL`,
  `ALTER TABLE evaluation_predictions ADD COLUMN IF NOT EXISTS predicted_winner_id TEXT`,
  `ALTER TABLE evaluation_predictions ADD COLUMN IF NOT EXISTS predicted_winner_name TEXT`,
  `ALTER TABLE evaluation_predictions ADD COLUMN IF NOT EXISTS model_agreement TEXT`,
  `ALTER TABLE evaluation_predictions ADD COLUMN IF NOT EXISTS upset_risk_tier TEXT`,
  `ALTER TABLE evaluation_predictions ADD COLUMN IF NOT EXISTS used_fallback BOOLEAN`,
  `ALTER TABLE evaluation_predictions ADD COLUMN IF NOT EXISTS fallback_sources JSONB`,
  `ALTER TABLE evaluation_predictions ADD COLUMN IF NOT EXISTS actual_winner_id TEXT`,
  `ALTER TABLE evaluation_predictions ADD COLUMN IF NOT EXISTS actual_winner_name TEXT`,
  `ALTER TABLE evaluation_predictions ADD COLUMN IF NOT EXISTS result_type TEXT`,
  `ALTER TABLE evaluation_predictions ADD COLUMN IF NOT EXISTS included_in_accuracy BOOLEAN`,
  `ALTER TABLE evaluation_predictions ADD COLUMN IF NOT EXISTS graded_at TIMESTAMPTZ`,
  `ALTER TABLE evaluation_predictions ADD COLUMN IF NOT EXISTS odds_provider TEXT`,
  `ALTER TABLE evaluation_predictions ADD COLUMN IF NOT EXISTS odds_player1_decimal REAL`,
  `ALTER TABLE evaluation_predictions ADD COLUMN IF NOT EXISTS odds_player2_decimal REAL`,
  `ALTER TABLE evaluation_predictions ADD COLUMN IF NOT EXISTS odds_fetched_at TIMESTAMPTZ`,
  `ALTER TABLE evaluation_predictions ADD COLUMN IF NOT EXISTS implied_probability REAL`,
  `ALTER TABLE evaluation_predictions ADD COLUMN IF NOT EXISTS market_edge REAL`,
  `UPDATE evaluation_predictions SET data_segment = CASE WHEN run_kind = 'historical_test' THEN COALESCE(segment, 'live') ELSE 'live' END WHERE data_segment IS DISTINCT FROM CASE WHEN run_kind = 'historical_test' THEN COALESCE(segment, 'live') ELSE 'live' END`,
  `ALTER TABLE calibration_models ADD COLUMN IF NOT EXISTS validation_date_range_start TIMESTAMPTZ`,
  `ALTER TABLE calibration_models ADD COLUMN IF NOT EXISTS validation_date_range_end TIMESTAMPTZ`,
  `ALTER TABLE calibration_models ADD COLUMN IF NOT EXISTS isotonic_holdout_log_loss REAL`,
  `ALTER TABLE calibration_models ADD COLUMN IF NOT EXISTS platt_holdout_log_loss REAL`,
  // Task #198: explicit admin approval gate before walk-forward calibration goes live.
  `ALTER TABLE calibration_models ADD COLUMN IF NOT EXISTS pending_activation BOOLEAN NOT NULL DEFAULT false`,
  `ALTER TABLE calibration_models ADD COLUMN IF NOT EXISTS pending_specialist_data JSONB`,
  `ALTER TABLE specialist_models ADD COLUMN IF NOT EXISTS accuracy REAL`,
  `ALTER TABLE specialist_models ADD COLUMN IF NOT EXISTS log_loss REAL`,
  `ALTER TABLE specialist_models ADD COLUMN IF NOT EXISTS brier REAL`,
  `ALTER TABLE specialist_models ADD COLUMN IF NOT EXISTS general_accuracy REAL`,
  `ALTER TABLE specialist_models ADD COLUMN IF NOT EXISTS general_log_loss REAL`,
  `ALTER TABLE specialist_models ADD COLUMN IF NOT EXISTS general_brier REAL`,
  `ALTER TABLE candidate_configs ADD COLUMN IF NOT EXISTS strategy_id TEXT`,
  `ALTER TABLE candidate_configs ADD COLUMN IF NOT EXISTS strategy_version TEXT`,
  `ALTER TABLE candidate_configs ADD COLUMN IF NOT EXISTS strategy_name TEXT`,
  `ALTER TABLE candidate_configs ADD COLUMN IF NOT EXISTS strategy_family TEXT`,
  `ALTER TABLE candidate_configs ADD COLUMN IF NOT EXISTS strategy_fingerprint TEXT`,
  `ALTER TABLE candidate_configs ADD COLUMN IF NOT EXISTS parent_strategy_id TEXT`,
  `ALTER TABLE candidate_configs ADD COLUMN IF NOT EXISTS parent_strategy_version TEXT`,
  `ALTER TABLE candidate_configs ADD COLUMN IF NOT EXISTS creation_method TEXT`,
  `ALTER TABLE candidate_configs ADD COLUMN IF NOT EXISTS optimizer_run_id TEXT`,
  `ALTER TABLE candidate_configs ADD COLUMN IF NOT EXISTS last_tested_at TIMESTAMPTZ`,
  `ALTER TABLE candidate_configs ADD COLUMN IF NOT EXISTS production_status TEXT`,
  `ALTER TABLE candidate_configs ADD COLUMN IF NOT EXISTS lifecycle_status TEXT`,
  `ALTER TABLE candidate_configs ADD COLUMN IF NOT EXISTS validation_status TEXT`,
  `ALTER TABLE candidate_configs ADD COLUMN IF NOT EXISTS walk_forward_status TEXT`,
  `ALTER TABLE candidate_configs ADD COLUMN IF NOT EXISTS shadow_status TEXT`,
  `ALTER TABLE candidate_configs ADD COLUMN IF NOT EXISTS feature_set JSONB`,
  `ALTER TABLE candidate_configs ADD COLUMN IF NOT EXISTS weights JSONB`,
  `ALTER TABLE candidate_configs ADD COLUMN IF NOT EXISTS thresholds JSONB`,
  `ALTER TABLE candidate_configs ADD COLUMN IF NOT EXISTS calibration_method TEXT`,
  `ALTER TABLE candidate_configs ADD COLUMN IF NOT EXISTS specialist_routing TEXT`,
  `ALTER TABLE candidate_configs ADD COLUMN IF NOT EXISTS competitive_balance_behavior JSONB`,
  `ALTER TABLE candidate_configs ADD COLUMN IF NOT EXISTS evidence_reliability_behavior JSONB`,
  `ALTER TABLE candidate_configs ADD COLUMN IF NOT EXISTS abstention_rules JSONB`,
  `ALTER TABLE candidate_configs ADD COLUMN IF NOT EXISTS recommendation_gates JSONB`,
  `ALTER TABLE candidate_configs ADD COLUMN IF NOT EXISTS promoted_at TIMESTAMPTZ`,
  `ALTER TABLE candidate_configs ADD COLUMN IF NOT EXISTS promoted_by TEXT`,
  `ALTER TABLE candidate_configs ADD COLUMN IF NOT EXISTS rollback_strategy_id TEXT`,
  `ALTER TABLE candidate_configs ADD COLUMN IF NOT EXISTS source_run_id INTEGER`,
  `ALTER TABLE candidate_configs ADD COLUMN IF NOT EXISTS weight_diff JSONB`,
  `ALTER TABLE candidate_configs ADD COLUMN IF NOT EXISTS threshold_diff JSONB`,
  `ALTER TABLE candidate_configs ADD COLUMN IF NOT EXISTS proposed_config JSONB`,
  `ALTER TABLE candidate_configs ADD COLUMN IF NOT EXISTS holdout_metrics JSONB`,
  `ALTER TABLE candidate_configs ADD COLUMN IF NOT EXISTS validation_metrics JSONB`,
  `ALTER TABLE candidate_configs ADD COLUMN IF NOT EXISTS acceptance_checks_passed BOOLEAN`,
  `ALTER TABLE candidate_configs ADD COLUMN IF NOT EXISTS acceptance_checks JSONB`,
  `ALTER TABLE config_promotions ADD COLUMN IF NOT EXISTS strategy_id TEXT`,
  `ALTER TABLE config_promotions ADD COLUMN IF NOT EXISTS strategy_version TEXT`,
  `ALTER TABLE config_promotions ADD COLUMN IF NOT EXISTS strategy_fingerprint TEXT`,
  `ALTER TABLE config_promotions ADD COLUMN IF NOT EXISTS old_config JSONB`,
  `ALTER TABLE config_promotions ADD COLUMN IF NOT EXISTS new_config JSONB`,
  `ALTER TABLE config_promotions ADD COLUMN IF NOT EXISTS reason TEXT`,
  `ALTER TABLE config_promotions ADD COLUMN IF NOT EXISTS validation_period TEXT`,
  `ALTER TABLE config_promotions ADD COLUMN IF NOT EXISTS metrics JSONB`,
  `ALTER TABLE config_promotions ADD COLUMN IF NOT EXISTS promoted_by TEXT`,
  // Uniqueness and lookup indexes that prevent duplicates and speed runner APIs.
  `CREATE UNIQUE INDEX IF NOT EXISTS evaluation_predictions_historical_match_idx ON evaluation_predictions (run_kind, historical_match_id)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS evaluation_predictions_fixture_idx ON evaluation_predictions (run_kind, provider, external_fixture_id)`,
  `CREATE INDEX IF NOT EXISTS evaluation_predictions_status_idx ON evaluation_predictions (status)`,
  `CREATE INDEX IF NOT EXISTS evaluation_predictions_scheduled_start_idx ON evaluation_predictions (scheduled_start_at)`,
  `CREATE INDEX IF NOT EXISTS evaluation_predictions_run_kind_segment_idx ON evaluation_predictions (run_kind, segment)`,
  `CREATE INDEX IF NOT EXISTS evaluation_predictions_shadow_batch_idx ON evaluation_predictions (run_kind, shadow_batch_label)`,
  `CREATE INDEX IF NOT EXISTS candidate_configs_status_idx ON candidate_configs (status)`,
  `CREATE INDEX IF NOT EXISTS candidate_configs_created_idx ON candidate_configs (created_at)`,
  `CREATE INDEX IF NOT EXISTS strategy_versions_status_idx ON strategy_versions (status)`,
  `CREATE INDEX IF NOT EXISTS strategy_versions_fingerprint_idx ON strategy_versions (strategy_fingerprint)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS paper_trade_predictions_unique_fixture_idx ON paper_trade_predictions (provider, external_fixture_id)`,
  // predictions ledger forward-compat columns/indexes.
  `ALTER TABLE predictions ADD COLUMN IF NOT EXISTS strategy_id TEXT`,
  `ALTER TABLE predictions ADD COLUMN IF NOT EXISTS strategy_version TEXT`,
  `ALTER TABLE predictions ADD COLUMN IF NOT EXISTS calibration_version TEXT`,
  `ALTER TABLE predictions ADD COLUMN IF NOT EXISTS external_fixture_id TEXT`,
  `ALTER TABLE predictions ADD COLUMN IF NOT EXISTS snapshot_captured_at TIMESTAMPTZ NOT NULL DEFAULT now()`,
  `ALTER TABLE predictions ADD COLUMN IF NOT EXISTS predicted_winner_probability REAL`,
  `ALTER TABLE predictions ADD COLUMN IF NOT EXISTS data_quality_label TEXT`,
  `ALTER TABLE predictions ADD COLUMN IF NOT EXISTS match_identity_key TEXT`,
  `ALTER TABLE predictions ADD COLUMN IF NOT EXISTS input_snapshot_hash TEXT`,
  `ALTER TABLE predictions ADD COLUMN IF NOT EXISTS decision_trace JSONB`,
  `ALTER TABLE predictions ADD COLUMN IF NOT EXISTS data_segment TEXT NOT NULL DEFAULT 'live'`,
  `ALTER TABLE predictions ADD COLUMN IF NOT EXISTS used_fallback BOOLEAN`,
  `ALTER TABLE predictions ADD COLUMN IF NOT EXISTS fallback_sources JSONB`,
  `ALTER TABLE predictions ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ`,
  // Backfill defaults for columns introduced after early ledger versions.
  `UPDATE predictions SET predicted_winner_probability = calibrated_probability WHERE predicted_winner_probability IS NULL`,
  `UPDATE predictions SET data_quality_label = 'Unknown' WHERE data_quality_label IS NULL`,
  `UPDATE predictions SET data_segment = 'live' WHERE data_segment IS NULL`,
  `UPDATE predictions SET match_identity_key = concat_ws('::', concat_ws('|', least(player1_id, player2_id), greatest(player1_id, player2_id)), coalesce(nullif(lower(trim(tournament_name)), ''), '__no_tournament__'), surface, match_format) WHERE match_identity_key IS NULL`,
  `UPDATE predictions SET input_snapshot_hash = md5(concat_ws('|', coalesce(player1_id,''), coalesce(player2_id,''), coalesce(created_at::text,''), coalesce(id::text,''))) WHERE input_snapshot_hash IS NULL`,
  `UPDATE evaluation_predictions SET segment = 'live' WHERE segment IS NULL AND run_kind IN ('paper_trade', 'live', 'paper_trade_shadow')`,
  `CREATE INDEX IF NOT EXISTS predictions_created_at_idx ON predictions (created_at)`,
  `CREATE INDEX IF NOT EXISTS predictions_recommendation_idx ON predictions (recommendation)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS predictions_identity_input_snapshot_idx ON predictions (match_identity_key, input_snapshot_hash)`,
  // v2 Evidence Confidence Score columns — shadow-replay audit (Task #102).
  // recommendation_v2: recomputed value under the new 5-tier logic; null until shadow replay runs.
  // recommendation_version: integer version of the recommendation logic used (2 = current).
  // recommendation_changed: true when v2 differs from the original stored recommendation.
  // recommendation_changed_at: timestamp of the last shadow-replay run for this row.
  `ALTER TABLE predictions ADD COLUMN IF NOT EXISTS recommendation_v2 TEXT`,
  `ALTER TABLE predictions ADD COLUMN IF NOT EXISTS recommendation_version INTEGER`,
  `ALTER TABLE predictions ADD COLUMN IF NOT EXISTS recommendation_changed BOOLEAN`,
  `ALTER TABLE predictions ADD COLUMN IF NOT EXISTS recommendation_changed_at TIMESTAMPTZ`,
  // data_quality integer column for the predictions table (was missing — only label existed)
  `ALTER TABLE predictions ADD COLUMN IF NOT EXISTS data_quality INTEGER NOT NULL DEFAULT 0`,
  `UPDATE predictions SET data_quality = 0 WHERE data_quality IS NULL`,
  // Parlay Builder independent tables (separate from all Prediction Engine tables)
  `
  CREATE TABLE IF NOT EXISTS parlay_builder_settings (
    id SERIAL PRIMARY KEY,
    version INTEGER NOT NULL DEFAULT 1,
    weights JSONB NOT NULL DEFAULT '{}'::jsonb,
    thresholds JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by TEXT
  )
  `,
  `
  CREATE TABLE IF NOT EXISTS parlay_builder_sessions (
    id SERIAL PRIMARY KEY,
    session_id TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
    builder_version TEXT NOT NULL DEFAULT '1.0.0',
    settings_version INTEGER,
    legs JSONB NOT NULL DEFAULT '[]'::jsonb,
    summary JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by TEXT
  )
  `,
  `CREATE INDEX IF NOT EXISTS parlay_builder_sessions_created_idx ON parlay_builder_sessions (created_at DESC)`,
  // Parlay Builder outcome tracking — primary calibration data source.
  // One row per leg per /validate call. actual_winner_id stays NULL until
  // the resolution job (scripts/resolveParlayLegOutcomes.ts) fills it in.
  `
  CREATE TABLE IF NOT EXISTS parlay_leg_outcomes (
    id                   SERIAL PRIMARY KEY,
    session_id           INTEGER REFERENCES parlay_builder_sessions(id),
    selected_player_id   TEXT NOT NULL,
    opponent_id          TEXT NOT NULL,
    selected_player_name TEXT NOT NULL,
    opponent_name        TEXT NOT NULL,
    tournament_name      TEXT,
    surface              TEXT,
    validation_score     INTEGER NOT NULL,
    risk_score           INTEGER NOT NULL,
    reliability_grade    TEXT NOT NULL,
    parlay_grade         TEXT NOT NULL,
    decision             TEXT NOT NULL,
    data_coverage        INTEGER NOT NULL,
    source_agreement     INTEGER NOT NULL,
    removal_probability  INTEGER NOT NULL DEFAULT 0,
    factor_scores        JSONB NOT NULL,
    market_odds          NUMERIC,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    actual_winner_id     TEXT,
    resolved_at          TIMESTAMPTZ,
    -- 'live' = submitted via /validate; 'backfill' = scored from historical graded match
    source               TEXT NOT NULL DEFAULT 'live',
    -- evaluation_predictions.id that this backfill row was scored from (null for live legs)
    backfill_match_id    INTEGER
  )
  `,
  // Forward-compat: columns added after initial table creation
  `ALTER TABLE parlay_leg_outcomes ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'live'`,
  `ALTER TABLE parlay_leg_outcomes ADD COLUMN IF NOT EXISTS backfill_match_id INTEGER`,
  `ALTER TABLE parlay_leg_outcomes ADD COLUMN IF NOT EXISTS matchup_closeness INTEGER`,
  `ALTER TABLE parlay_leg_outcomes ADD COLUMN IF NOT EXISTS removal_probability INTEGER NOT NULL DEFAULT 0`,
  // Risk Floor observability (see marketEvidenceMigrations.ts's RISK_FLOOR_OBSERVABILITY_COLUMNS
  // for the full column-by-column rationale) -- additive, nullable, populated going forward by
  // writeParlayLegOutcomeRow in builderScoringService.ts; never backfilled onto existing rows.
  ...RISK_FLOOR_OBSERVABILITY_COLUMNS,
  // Backfill dedup: one row per graded match (prevents re-running from doubling data)
  `CREATE UNIQUE INDEX IF NOT EXISTS parlay_leg_outcomes_backfill_match_idx ON parlay_leg_outcomes (backfill_match_id) WHERE backfill_match_id IS NOT NULL`,
  // Resolution job: scan for unresolved rows ordered by age
  `CREATE INDEX IF NOT EXISTS parlay_leg_outcomes_unresolved_idx ON parlay_leg_outcomes (created_at) WHERE actual_winner_id IS NULL`,
  // Calibration query: join on session
  `CREATE INDEX IF NOT EXISTS parlay_leg_outcomes_session_idx ON parlay_leg_outcomes (session_id)`,
  // Resolution job: match player pairs quickly
  `CREATE INDEX IF NOT EXISTS parlay_leg_outcomes_players_idx ON parlay_leg_outcomes (selected_player_id, opponent_id)`,

  // ── Parlay Builder: user-saved legs ──────────────────────────────────────────
  // Persists individual BuilderLegResult snapshots for the "Saved Parlays" folder.
  // Completely separate from parlay_leg_outcomes (which is calibration data).
  `
  CREATE TABLE IF NOT EXISTS parlay_saved_legs (
    id          SERIAL PRIMARY KEY,
    saved_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    leg_payload JSONB NOT NULL
  )
  `,

  // ── historical_matches: player-name search indexes (for match search endpoint) ─
  `CREATE INDEX IF NOT EXISTS historical_matches_player1_name_idx ON historical_matches (player1_name)`,
  `CREATE INDEX IF NOT EXISTS historical_matches_player2_name_idx ON historical_matches (player2_name)`,
  `CREATE INDEX IF NOT EXISTS historical_matches_tour_idx ON historical_matches (tour)`,
  `CREATE INDEX IF NOT EXISTS historical_matches_surface_idx ON historical_matches (surface)`,
  `CREATE INDEX IF NOT EXISTS historical_matches_tournament_level_idx ON historical_matches (tournament_level)`,

  // ── Parlay Builder: active session ────────────────────────────────────────────
  // Single-row store (id=1 singleton) for the current in-progress parlay session.
  // Upserted on every change so the session survives browser close / device switch.
  `
  CREATE TABLE IF NOT EXISTS parlay_active_session (
    id              INTEGER PRIMARY KEY DEFAULT 1,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    session_payload JSONB NOT NULL DEFAULT '{}'::jsonb
  )
  `,

  // ── Builder Decision Log ───────────────────────────────────────────────────
  // One row per computeBuilderScore call (live validate). Grading job fills
  // actual_winner_id and included_in_accuracy when the match settles.
  // Rows with null historical_match_id are excluded from accuracy calculations
  // (match was unresolvable) but are never discarded.
  //
  // player_one_id / player_two_id / match_scheduled_at: stable fixture identity
  // stored at log time so the grading job can cross-reference settled matches
  // without relying on nearest-to-now heuristics.
  `
  CREATE TABLE IF NOT EXISTS builder_decision_log (
    id                             SERIAL PRIMARY KEY,
    historical_match_id            INTEGER,
    player_one_id                  TEXT NOT NULL DEFAULT '',
    player_two_id                  TEXT NOT NULL DEFAULT '',
    match_scheduled_at             TIMESTAMPTZ,
    builder_picked_player_id       TEXT NOT NULL,
    builder_calibrated_probability REAL NOT NULL,
    builder_decision               TEXT NOT NULL,
    caller_selected_player_id      TEXT NOT NULL,
    caller_agrees_with_engine      BOOLEAN NOT NULL,
    actual_winner_id               TEXT,
    included_in_accuracy           BOOLEAN,
    -- 'live'            = written by a real /validate request (full accurate engine outputs)
    -- 'backfill'        = written by the /backfill loop after Task #216 (accurate engine outputs)
    -- 'backfill_approx' = retroactively seeded from pre-existing parlay_leg_outcomes rows;
    --                     builder_picked_player_id and builder_calibrated_probability are
    --                     approximated (model pick used as proxy). #34/#63 must filter or
    --                     weight these rows separately from live/backfill rows.
    source                         TEXT NOT NULL DEFAULT 'live',
    created_at                     TIMESTAMPTZ NOT NULL DEFAULT now()
  )
  `,
  // Add new columns if the table already exists (idempotent ALTER TABLE guards).
  `ALTER TABLE builder_decision_log ADD COLUMN IF NOT EXISTS player_one_id TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE builder_decision_log ADD COLUMN IF NOT EXISTS player_two_id TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE builder_decision_log ADD COLUMN IF NOT EXISTS match_scheduled_at TIMESTAMPTZ`,
  `ALTER TABLE builder_decision_log ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'live'`,
  `CREATE INDEX IF NOT EXISTS builder_decision_log_created_at_idx ON builder_decision_log (created_at)`,
  `CREATE INDEX IF NOT EXISTS builder_decision_log_historical_match_id_idx ON builder_decision_log (historical_match_id)`,
  `CREATE INDEX IF NOT EXISTS builder_decision_log_players_idx ON builder_decision_log (player_one_id, player_two_id)`,
  // Partial index covering both grading query shapes in gradeBuilderDecisions():
  //   Step 1: WHERE historical_match_id IS NULL AND included_in_accuracy IS NULL
  //   Step 2: WHERE historical_match_id IS NOT NULL AND actual_winner_id IS NULL AND included_in_accuracy IS NULL
  // A full-table scan on these queries becomes expensive as the log grows; restricting
  // to ungraded rows keeps both scans near-instant regardless of table size.
  `CREATE INDEX IF NOT EXISTS builder_decision_log_ungraded_idx ON builder_decision_log (historical_match_id) WHERE actual_winner_id IS NULL AND included_in_accuracy IS NULL`,
  // FK with ON DELETE SET NULL so cleanup jobs can delete evaluation_predictions rows
  // without being blocked by graded builder log entries pointing at them.
  // Default RESTRICT would silently prevent those deletes.
  // Wrapped in a DO block because ALTER TABLE ADD CONSTRAINT has no IF NOT EXISTS
  // guard in Postgres — the block is safe to re-run on every server start.
  `DO $$ BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'builder_decision_log_historical_match_id_fk'
    ) THEN
      ALTER TABLE builder_decision_log
        ADD CONSTRAINT builder_decision_log_historical_match_id_fk
        FOREIGN KEY (historical_match_id)
        REFERENCES evaluation_predictions(id)
        ON DELETE SET NULL;
    END IF;
  END $$`,

  // ── Parlay Builder historical version-lineage layer ───────────────────────────
  //
  // Deliberately created here (auto-applied, idempotent, on every server boot) rather than via
  // `pnpm --filter db run push` (drizzle-kit push): this repository's live database currently has
  // columns on historical_matches/predictions/backtest_runs/backtest_predictions that are absent
  // from the checked-in Drizzle schema files, which makes a full `drizzle-kit push` schema DIFF
  // propose deleting those real, populated columns (530,097/2,575/2/5,150 rows respectively) --
  // confirmed by actually running it against the live database on 2026-09-21, where it correctly
  // refused only because the environment is non-interactive and cannot confirm a destructive
  // prompt. That pre-existing drift is unrelated to this feature and is NOT fixed here -- these
  // two CREATE TABLE statements are scoped to exactly the two new tables below, touching nothing
  // else, exactly like every other table in this file (parlay_builder_settings, parlay_leg_outcomes,
  // builder_decision_log, ...) already does for the same reason.
  //
  // The Drizzle definitions in lib/db/src/schema/builderVersioning.ts describe this exact shape
  // for type-safe querying (db.select().from(builderVersionManifestsTable), etc.) -- they are
  // never applied via drizzle-kit push; this raw SQL is the only thing that actually creates them.
  `
  CREATE TABLE IF NOT EXISTS parlay_builder_version_manifests (
    id                       SERIAL PRIMARY KEY,
    version                  INTEGER NOT NULL,
    effective_from           TIMESTAMPTZ NOT NULL,
    effective_to             TIMESTAMPTZ,
    algorithm_config         JSONB NOT NULL,
    calibration_model_id     INTEGER REFERENCES calibration_models(id),
    optimizer_run_id         TEXT,
    source_commit            TEXT NOT NULL,
    config_fingerprint       TEXT NOT NULL,
    reconstruction_method    TEXT NOT NULL,
    confidence               TEXT NOT NULL,
    provenance               JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by               TEXT
  )
  `,
  `CREATE UNIQUE INDEX IF NOT EXISTS parlay_builder_version_manifests_version_idx ON parlay_builder_version_manifests (version)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS parlay_builder_version_manifests_fingerprint_idx ON parlay_builder_version_manifests (config_fingerprint)`,
  `CREATE INDEX IF NOT EXISTS parlay_builder_version_manifests_effective_from_idx ON parlay_builder_version_manifests (effective_from)`,
  // At most one currently-open (effective_to IS NULL) row at a time.
  `CREATE UNIQUE INDEX IF NOT EXISTS parlay_builder_version_manifests_one_open_idx ON parlay_builder_version_manifests (effective_to) WHERE effective_to IS NULL`,
  `DO $$ BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'parlay_builder_version_manifests_interval_check'
    ) THEN
      ALTER TABLE parlay_builder_version_manifests
        ADD CONSTRAINT parlay_builder_version_manifests_interval_check
        CHECK (effective_to IS NULL OR effective_to > effective_from);
    END IF;
  END $$`,

  `
  CREATE TABLE IF NOT EXISTS parlay_builder_lineage_audit (
    id                             SERIAL PRIMARY KEY,
    audit_run_id                   TEXT NOT NULL,
    historical_match_id            INTEGER NOT NULL,
    cutoff_at                      TIMESTAMPTZ NOT NULL,
    status                         TEXT NOT NULL,
    resolved_manifest_id           INTEGER REFERENCES parlay_builder_version_manifests(id),
    resolved_manifest_version      INTEGER,
    resolved_calibration_model_id  INTEGER REFERENCES calibration_models(id),
    reason                         TEXT NOT NULL,
    created_at                     TIMESTAMPTZ NOT NULL DEFAULT now()
  )
  `,
  `CREATE UNIQUE INDEX IF NOT EXISTS parlay_builder_lineage_audit_run_match_idx ON parlay_builder_lineage_audit (audit_run_id, historical_match_id)`,
  `CREATE INDEX IF NOT EXISTS parlay_builder_lineage_audit_status_idx ON parlay_builder_lineage_audit (audit_run_id, status)`,

  // Immutability: parlay_builder_version_manifests permits exactly one UPDATE shape (closing an
  // open row's effective_to, NULL -> timestamp, nothing else changed) and no DELETE ever.
  // parlay_builder_lineage_audit is pure append-only -- no UPDATE or DELETE is ever legitimate.
  // Idempotent (CREATE OR REPLACE / DROP + CREATE), safe to re-run on every boot.
  `
  CREATE OR REPLACE FUNCTION parlay_builder_version_manifests_prevent_mutation()
  RETURNS trigger AS $BODY$
  BEGIN
    IF TG_OP = 'DELETE' THEN
      RAISE EXCEPTION
        'parlay_builder_version_manifests row % is immutable and cannot be deleted', OLD.id;
    END IF;

    IF OLD.effective_to IS NOT NULL
       OR NEW.effective_to IS NULL
       OR NEW.version IS DISTINCT FROM OLD.version
       OR NEW.effective_from IS DISTINCT FROM OLD.effective_from
       OR NEW.algorithm_config IS DISTINCT FROM OLD.algorithm_config
       OR NEW.calibration_model_id IS DISTINCT FROM OLD.calibration_model_id
       OR NEW.optimizer_run_id IS DISTINCT FROM OLD.optimizer_run_id
       OR NEW.source_commit IS DISTINCT FROM OLD.source_commit
       OR NEW.config_fingerprint IS DISTINCT FROM OLD.config_fingerprint
       OR NEW.reconstruction_method IS DISTINCT FROM OLD.reconstruction_method
       OR NEW.confidence IS DISTINCT FROM OLD.confidence
       OR NEW.provenance IS DISTINCT FROM OLD.provenance
       OR NEW.created_at IS DISTINCT FROM OLD.created_at
       OR NEW.created_by IS DISTINCT FROM OLD.created_by
    THEN
      RAISE EXCEPTION
        'parlay_builder_version_manifests row % is immutable; only closing effective_to (NULL -> timestamp) is permitted',
        OLD.id;
    END IF;

    RETURN NEW;
  END;
  $BODY$ LANGUAGE plpgsql;

  DROP TRIGGER IF EXISTS parlay_builder_version_manifests_immutable ON parlay_builder_version_manifests;

  CREATE TRIGGER parlay_builder_version_manifests_immutable
    BEFORE UPDATE OR DELETE ON parlay_builder_version_manifests
    FOR EACH ROW
    EXECUTE FUNCTION parlay_builder_version_manifests_prevent_mutation();

  CREATE OR REPLACE FUNCTION parlay_builder_lineage_audit_prevent_mutation()
  RETURNS trigger AS $BODY$
  BEGIN
    RAISE EXCEPTION
      'parlay_builder_lineage_audit row % is append-only and cannot be modified or deleted',
      COALESCE(OLD.id, NEW.id);
  END;
  $BODY$ LANGUAGE plpgsql;

  DROP TRIGGER IF EXISTS parlay_builder_lineage_audit_immutable ON parlay_builder_lineage_audit;

  CREATE TRIGGER parlay_builder_lineage_audit_immutable
    BEFORE UPDATE OR DELETE ON parlay_builder_lineage_audit
    FOR EACH ROW
    EXECUTE FUNCTION parlay_builder_lineage_audit_prevent_mutation();
  `,

  // ── COUNTERFACTUAL_RESEARCH_V1 — isolated Parlay Builder research/backtest tables ─────────
  //
  // Explicitly NOT the production Builder's historical lineage (Phase 0 established that could
  // not be reconstructed -- see docs/historical-builder-integration/). These tables hold a
  // counterfactual research question's results only: every row is tagged
  // researchBuilderVersion='COUNTERFACTUAL_RESEARCH_V1'. Never read by builderScoringService.ts,
  // builder_decision_log, or parlay_leg_outcomes; nothing here ever writes to those either.
  `
  CREATE TABLE IF NOT EXISTS parlay_builder_research_v1_runs (
    id                              SERIAL PRIMARY KEY,
    run_id                          TEXT NOT NULL,
    research_builder_version        TEXT NOT NULL DEFAULT 'COUNTERFACTUAL_RESEARCH_V1',
    config_fingerprint              TEXT NOT NULL,
    algorithm_config                JSONB NOT NULL,
    cohort_start                    TIMESTAMPTZ NOT NULL,
    cohort_end                      TIMESTAMPTZ NOT NULL,
    cohort_fingerprint              TEXT NOT NULL,
    cohort_match_count              INTEGER NOT NULL,
    status                          TEXT NOT NULL DEFAULT 'queued',
    started_at                      TIMESTAMPTZ,
    decisions_frozen_at             TIMESTAMPTZ,
    outcomes_attached_at            TIMESTAMPTZ,
    completed_at                    TIMESTAMPTZ,
    deterministic_comparison_run_id TEXT,
    deterministic_match             BOOLEAN,
    result_set_fingerprint          TEXT,
    summary                         JSONB,
    errors                          JSONB,
    created_at                      TIMESTAMPTZ NOT NULL DEFAULT now()
  )
  `,
  `CREATE UNIQUE INDEX IF NOT EXISTS parlay_builder_research_v1_runs_run_id_idx ON parlay_builder_research_v1_runs (run_id)`,
  `CREATE INDEX IF NOT EXISTS parlay_builder_research_v1_runs_status_idx ON parlay_builder_research_v1_runs (status)`,

  `
  CREATE TABLE IF NOT EXISTS parlay_builder_research_v1_results (
    id                          SERIAL PRIMARY KEY,
    run_id                      TEXT NOT NULL,
    historical_match_id         INTEGER NOT NULL,
    scheduled_start_at          TIMESTAMPTZ NOT NULL,
    cutoff_at                   TIMESTAMPTZ NOT NULL,
    player1_id                  TEXT NOT NULL,
    player1_name                TEXT NOT NULL,
    player2_id                  TEXT NOT NULL,
    player2_name                TEXT NOT NULL,
    surface                     TEXT,
    prediction_engine_output    JSONB,
    research_builder_version    TEXT NOT NULL DEFAULT 'COUNTERFACTUAL_RESEARCH_V1',
    config_fingerprint          TEXT NOT NULL,
    calibration_snapshot_id     TEXT,
    calibration_fitted_at       TIMESTAMPTZ,
    builder_score                REAL,
    builder_picked_player_id     TEXT,
    builder_decision             TEXT,
    eligibility                  TEXT NOT NULL,
    rejection_reason             TEXT,
    pit_status                   TEXT NOT NULL,
    data_coverage                REAL,
    factor_scores                JSONB,
    outcome_actual_winner_id     TEXT,
    outcome_included_in_accuracy BOOLEAN,
    outcome_correct              BOOLEAN,
    provenance                   JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at                   TIMESTAMPTZ NOT NULL DEFAULT now()
  )
  `,
  `CREATE UNIQUE INDEX IF NOT EXISTS parlay_builder_research_v1_results_run_match_idx ON parlay_builder_research_v1_results (run_id, historical_match_id)`,
  `CREATE INDEX IF NOT EXISTS parlay_builder_research_v1_results_decision_idx ON parlay_builder_research_v1_results (run_id, builder_decision)`,
  `CREATE INDEX IF NOT EXISTS parlay_builder_research_v1_results_eligibility_idx ON parlay_builder_research_v1_results (run_id, eligibility)`,

  // Immutability: a run row may only progress through its status/decisionsFrozenAt/
  // outcomesAttachedAt/completedAt/deterministic* fields forward (enforced at the application
  // layer, since this table is actively updated as a run progresses -- unlike results, which are
  // genuinely append-only once written).
  `
  CREATE OR REPLACE FUNCTION parlay_builder_research_v1_results_prevent_mutation()
  RETURNS trigger AS $BODY$
  BEGIN
    RAISE EXCEPTION
      'parlay_builder_research_v1_results row % is append-only and cannot be modified once written (outcome columns are populated via a single UPDATE from attachResearchV1Outcomes, see the one-time exception below)',
      COALESCE(OLD.id, NEW.id);
  END;
  $BODY$ LANGUAGE plpgsql;

  CREATE OR REPLACE FUNCTION parlay_builder_research_v1_results_check_outcome_only(
    OLD_ROW parlay_builder_research_v1_results,
    NEW_ROW parlay_builder_research_v1_results
  ) RETURNS boolean AS $BODY2$
  BEGIN
    RETURN NEW_ROW.historical_match_id = OLD_ROW.historical_match_id
       AND NEW_ROW.run_id = OLD_ROW.run_id
       AND NEW_ROW.builder_score IS NOT DISTINCT FROM OLD_ROW.builder_score
       AND NEW_ROW.builder_decision IS NOT DISTINCT FROM OLD_ROW.builder_decision
       AND NEW_ROW.builder_picked_player_id IS NOT DISTINCT FROM OLD_ROW.builder_picked_player_id
       AND NEW_ROW.eligibility IS NOT DISTINCT FROM OLD_ROW.eligibility
       AND NEW_ROW.rejection_reason IS NOT DISTINCT FROM OLD_ROW.rejection_reason
       AND NEW_ROW.pit_status IS NOT DISTINCT FROM OLD_ROW.pit_status
       AND NEW_ROW.data_coverage IS NOT DISTINCT FROM OLD_ROW.data_coverage
       AND NEW_ROW.factor_scores IS NOT DISTINCT FROM OLD_ROW.factor_scores
       AND OLD_ROW.outcome_actual_winner_id IS NULL; -- outcome can be attached exactly once
  END;
  $BODY2$ LANGUAGE plpgsql;

  CREATE OR REPLACE FUNCTION parlay_builder_research_v1_results_immutable_trigger()
  RETURNS trigger AS $BODY3$
  BEGIN
    IF TG_OP = 'DELETE' THEN
      RAISE EXCEPTION 'parlay_builder_research_v1_results row % is append-only and cannot be deleted', OLD.id;
    END IF;
    IF NOT parlay_builder_research_v1_results_check_outcome_only(OLD, NEW) THEN
      RAISE EXCEPTION
        'parlay_builder_research_v1_results row % is immutable except for the one-time outcome attachment (outcome_actual_winner_id/outcome_included_in_accuracy/outcome_correct, only when previously NULL)',
        OLD.id;
    END IF;
    RETURN NEW;
  END;
  $BODY3$ LANGUAGE plpgsql;

  DROP TRIGGER IF EXISTS parlay_builder_research_v1_results_immutable ON parlay_builder_research_v1_results;

  CREATE TRIGGER parlay_builder_research_v1_results_immutable
    BEFORE UPDATE OR DELETE ON parlay_builder_research_v1_results
    FOR EACH ROW
    EXECUTE FUNCTION parlay_builder_research_v1_results_immutable_trigger();
  `,
];

let ensured = false;

export async function ensureEvaluationSchema(): Promise<void> {
  if (ensured) return;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const statement of STATEMENTS) {
      await client.query(statement);
    }
    await backfillPersistedInstrumentation(client);
    await client.query("COMMIT");
    ensured = true;
    logger.info("Evaluation/optimizer schema check completed");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function backfillPersistedInstrumentation(client: {
  query: (text: string, params?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>;
}): Promise<void> {
  const predictionRows = await client.query(
    `SELECT id, engine, decision_trace, used_fallback, fallback_sources
       FROM predictions
      WHERE used_fallback IS NULL OR fallback_sources IS NULL`,
  );

  for (const row of predictionRows.rows) {
    const fallback = extractFallbackInstrumentation({
      engine: row.engine,
      decisionTrace: row.decision_trace,
    });

    if (fallback.usedFallback === null && fallback.fallbackSources === null) continue;

    await client.query(
      `UPDATE predictions
          SET used_fallback = COALESCE(used_fallback, $2),
              fallback_sources = COALESCE(fallback_sources, $3)
        WHERE id = $1`,
      [row.id, fallback.usedFallback, JSON.stringify(fallback.fallbackSources)],
    );
  }

  const evaluationRows = await client.query(
    `SELECT id, feature_snapshot, used_fallback, fallback_sources
       FROM evaluation_predictions
      WHERE data_segment IS NULL OR used_fallback IS NULL OR fallback_sources IS NULL`,
  );

  for (const row of evaluationRows.rows) {
    const featureSnapshot = row.feature_snapshot as { engine?: unknown } | null;
    const fallback = extractFallbackInstrumentation({
      engine: featureSnapshot?.engine,
    });

    await client.query(
      `UPDATE evaluation_predictions
          SET data_segment = COALESCE(data_segment, COALESCE(segment, 'live')),
              used_fallback = COALESCE(used_fallback, $2),
              fallback_sources = COALESCE(fallback_sources, $3)
        WHERE id = $1`,
      [row.id, fallback.usedFallback, JSON.stringify(fallback.fallbackSources)],
    );
  }
}
