-- Isolated near-live terminal results. Never add feature snapshots or historical backfill rows
-- through this table; historical research retains its own 24-hour cutoff and ingestion path.
CREATE TABLE IF NOT EXISTS live_completed_results (
  id SERIAL PRIMARY KEY,
  provider TEXT NOT NULL,
  external_id TEXT NOT NULL,
  provider_player1_id TEXT NOT NULL,
  provider_player2_id TEXT NOT NULL,
  canonical_player1_id TEXT NOT NULL REFERENCES canonical_players(id),
  canonical_player2_id TEXT NOT NULL REFERENCES canonical_players(id),
  canonical_winner_id TEXT NOT NULL REFERENCES canonical_players(id),
  terminal_result_type TEXT NOT NULL CHECK (terminal_result_type IN ('finished', 'retired', 'walkover')),
  scheduled_start_at TIMESTAMPTZ NOT NULL,
  tournament_name TEXT,
  surface TEXT,
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_verified_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT live_completed_results_winner_participant_check CHECK (
    canonical_winner_id = canonical_player1_id OR canonical_winner_id = canonical_player2_id
  ),
  CONSTRAINT live_completed_results_distinct_players_check CHECK (
    canonical_player1_id <> canonical_player2_id
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS live_completed_results_provider_external_idx
  ON live_completed_results (provider, external_id);
CREATE INDEX IF NOT EXISTS live_completed_results_scheduled_start_idx
  ON live_completed_results (scheduled_start_at);
CREATE INDEX IF NOT EXISTS live_completed_results_canonical_players_idx
  ON live_completed_results (canonical_player1_id, canonical_player2_id);