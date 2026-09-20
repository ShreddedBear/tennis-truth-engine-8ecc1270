/**
 * Market-evidence capture: additive-only migration statements for the forward-looking capture
 * layer described in docs/design/market-evidence-capture-contract.md.
 *
 * NOT WIRED IN. This file is not imported by `ensureEvaluationSchema.ts` (whose own `STATEMENTS`
 * array follows the exact same idiom) or by any startup path, so nothing here currently executes.
 * It can be merged into that file's own migration array (simply spread this array into it) once
 * reviewed and approved -- see design doc section E for the merge plan.
 *
 * Everything below is additive only:
 *   - `market_snapshots` is a brand-new table (mirrors lib/db/src/schema/marketSnapshots.ts),
 *     attempt-aware (design doc section A/B): one row per capture attempt, success or not, with a
 *     `capture_status` column and a CHECK constraint enforcing which columns are populated for
 *     which status.
 *   - The `parlay_leg_outcomes` changes are `ADD COLUMN IF NOT EXISTS` only, exactly matching the
 *     forward-compat pattern already used in ensureEvaluationSchema.ts's own STATEMENTS array
 *     (e.g. its `source`/`backfill_match_id`/`matchup_closeness`/`removal_probability` columns on
 *     the same table) that this migration is designed to extend, never replace.
 *   - The immutability trigger (design doc section C.1) is a `CREATE OR REPLACE FUNCTION` plus a
 *     `DROP TRIGGER IF EXISTS` + `CREATE TRIGGER` pair -- idempotent to re-run, and additive in
 *     the sense that it only ever REJECTS a statement (UPDATE/DELETE) that this migration's own
 *     design already forbids by policy; it grants no new capability and touches no existing row.
 *   - Nothing here ALTERs or DROPs an existing column, index, or table.
 */
export const MARKET_EVIDENCE_MIGRATIONS: string[] = [
  // ── New table: market_snapshots ────────────────────────────────────────────────────────────
  // Attempt-aware (design doc section A/B): one row per capture ATTEMPT, not only per success.
  // capture_status carries the Task #146 (corrected) four-state vocabulary; every column below it
  // that only makes sense for a real observation (provider*, odds*, the derived probabilities,
  // is_eligible) is nullable and NULL for the three no-quote statuses -- a "no market" row is a
  // legitimate, expected shape, enforced by the market_snapshots_status_shape CHECK constraint
  // below, not left to convention.
  `
  CREATE TABLE IF NOT EXISTS market_snapshots (
    id                              SERIAL PRIMARY KEY,

    capture_run_id                  TEXT NOT NULL,
    captured_by_commit              TEXT NOT NULL,
    capture_pipeline                TEXT NOT NULL,

    prediction_id                   INTEGER REFERENCES evaluation_predictions(id),
    leg_id                          INTEGER REFERENCES parlay_leg_outcomes(id),

    captured_at                     TIMESTAMPTZ NOT NULL,
    prediction_cutoff_at            TIMESTAMPTZ NOT NULL,
    -- NULL (not false) for every non-"included" capture_status -- "ineligible" implies a real,
    -- late observation, which a no-quote attempt is not. See market_snapshots_status_shape below.
    is_eligible                     BOOLEAN,

    -- Task #146 (corrected) four-state capture outcome (see services/oddsData/index.ts's
    -- OddsStatus doc comment for the shared vocabulary and naming-choice rationale).
    capture_status                  TEXT NOT NULL,

    provider                        TEXT,
    market_type                     TEXT NOT NULL DEFAULT 'h2h_moneyline',

    player1_id                      TEXT NOT NULL,
    player1_name                    TEXT NOT NULL,
    player2_id                      TEXT NOT NULL,
    player2_name                    TEXT NOT NULL,

    odds_player1_decimal            REAL,
    odds_player2_decimal            REAL,

    normalized_probability_player1  REAL,
    devig_probability_player1       REAL,

    created_at                      TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Exactly one of prediction_id / leg_id must be set -- a snapshot always belongs to either
    -- a Prediction Engine row or a Builder leg, never both and never neither.
    CONSTRAINT market_snapshots_exactly_one_parent CHECK (
      (prediction_id IS NOT NULL AND leg_id IS NULL) OR
      (prediction_id IS NULL AND leg_id IS NOT NULL)
    ),

    -- capture_status must be one of the four known values -- a text column has no native enum
    -- constraint, so this is enforced explicitly rather than left to the TS $type<> annotation.
    CONSTRAINT market_snapshots_capture_status_valid CHECK (
      capture_status IN ('included', 'no_market_available', 'provider_not_configured', 'provider_error')
    ),

    -- The attempt-aware shape (design doc section A/B): exactly which columns are populated is
    -- determined entirely by capture_status, enforced here rather than by convention alone.
    --   "included"                -> provider, both raw-odds columns, both derived-probability
    --                                 columns, and is_eligible are all NOT NULL.
    --   "provider_not_configured" -> provider is NULL (nothing was even queried); odds/derived
    --                                 columns and is_eligible are NULL.
    --   "no_market_available" / "provider_error" -> provider is NOT NULL (which provider was
    --                                 queried/threw); odds/derived columns and is_eligible are
    --                                 NULL (no observation was captured).
    CONSTRAINT market_snapshots_status_shape CHECK (
      CASE capture_status
        WHEN 'included' THEN
          provider IS NOT NULL
          AND odds_player1_decimal IS NOT NULL AND odds_player2_decimal IS NOT NULL
          AND normalized_probability_player1 IS NOT NULL AND devig_probability_player1 IS NOT NULL
          AND is_eligible IS NOT NULL
        WHEN 'provider_not_configured' THEN
          provider IS NULL
          AND odds_player1_decimal IS NULL AND odds_player2_decimal IS NULL
          AND normalized_probability_player1 IS NULL AND devig_probability_player1 IS NULL
          AND is_eligible IS NULL
        ELSE -- 'no_market_available' / 'provider_error'
          provider IS NOT NULL
          AND odds_player1_decimal IS NULL AND odds_player2_decimal IS NULL
          AND normalized_probability_player1 IS NULL AND devig_probability_player1 IS NULL
          AND is_eligible IS NULL
      END
    )
  )
  `,
  `CREATE UNIQUE INDEX IF NOT EXISTS market_snapshots_prediction_run_idx ON market_snapshots (prediction_id, capture_run_id) WHERE prediction_id IS NOT NULL`,
  `CREATE UNIQUE INDEX IF NOT EXISTS market_snapshots_leg_run_idx ON market_snapshots (leg_id, capture_run_id) WHERE leg_id IS NOT NULL`,
  `CREATE INDEX IF NOT EXISTS market_snapshots_prediction_idx ON market_snapshots (prediction_id)`,
  `CREATE INDEX IF NOT EXISTS market_snapshots_leg_idx ON market_snapshots (leg_id)`,
  `CREATE INDEX IF NOT EXISTS market_snapshots_eligible_idx ON market_snapshots (is_eligible, captured_at)`,
  `CREATE INDEX IF NOT EXISTS market_snapshots_capture_status_idx ON market_snapshots (capture_status)`,

  // ── Read-time enforcement of the eligibility invariant (design doc section B: "both") ─────────
  // A convenience view so every consumer of prediction-time market evidence filters through the
  // SAME query surface rather than re-deriving `captured_at <= prediction_cutoff_at` ad hoc in
  // each experiment script. Purely additive (a view, not a table mutation); safe to `OR REPLACE`
  // since it has no stored state of its own. `is_eligible = true` naturally excludes both `false`
  // (late, real observation) and `NULL` (not applicable -- no-quote attempt) rows, which is
  // exactly the desired behavior: only successful, on-time observations are usable evidence.
  `
  CREATE OR REPLACE VIEW market_snapshots_eligible AS
    SELECT * FROM market_snapshots WHERE is_eligible = true
  `,

  // ── DB-level immutability enforcement (design doc section C.1) ─────────────────────────────────
  // market_snapshots rows must never be overwritten or backfilled once written. A BEFORE UPDATE OR
  // DELETE trigger that raises an exception is used here rather than a REVOKE-based approach: a
  // trigger fires regardless of which DB role executes the statement, so it needs no knowledge of
  // the actual application role name. `CREATE OR REPLACE FUNCTION` / `DROP TRIGGER IF EXISTS ... ;
  // CREATE TRIGGER` make both statements idempotent, the same idiom as the rest of this file.
  `
  CREATE OR REPLACE FUNCTION market_snapshots_forbid_update_or_delete() RETURNS trigger AS $$
  BEGIN
    RAISE EXCEPTION
      'market_snapshots rows are append-only (id=%): UPDATE and DELETE are forbidden at the database level -- see docs/design/market-evidence-capture-contract.md section C',
      COALESCE(OLD.id, NEW.id);
  END;
  $$ LANGUAGE plpgsql
  `,
  `DROP TRIGGER IF EXISTS market_snapshots_immutable ON market_snapshots`,
  `
  CREATE TRIGGER market_snapshots_immutable
    BEFORE UPDATE OR DELETE ON market_snapshots
    FOR EACH ROW EXECUTE FUNCTION market_snapshots_forbid_update_or_delete()
  `,

  // ── Risk Floor observability: parlay_leg_outcomes additive columns ────────────────────────────
  // Mirrors builderScoringService.ts's preClosenessRisk/closenessRiskFloor/postClosenessRisk/
  // _thinDataFloor/_thinDataFloorFired variable names exactly (see design doc section C) so a
  // reader can match a stored column to the exact variable in the scoring function that would
  // have produced it, with no renaming/relabeling step. These columns are added now, ahead of and
  // independent from the (still unapplied, still unapproved) builderScoringService.ts
  // instrumentation diff itself -- populating them is future work gated on that separate approval.
  `ALTER TABLE parlay_leg_outcomes ADD COLUMN IF NOT EXISTS pre_closeness_risk INTEGER`,
  `ALTER TABLE parlay_leg_outcomes ADD COLUMN IF NOT EXISTS closeness_risk_floor_value INTEGER`,
  `ALTER TABLE parlay_leg_outcomes ADD COLUMN IF NOT EXISTS closeness_floor_fired BOOLEAN`,
  `ALTER TABLE parlay_leg_outcomes ADD COLUMN IF NOT EXISTS post_closeness_risk INTEGER`,
  `ALTER TABLE parlay_leg_outcomes ADD COLUMN IF NOT EXISTS thin_data_risk_floor_value INTEGER`,
  `ALTER TABLE parlay_leg_outcomes ADD COLUMN IF NOT EXISTS thin_data_floor_fired BOOLEAN`,
  // Provenance for the observability write itself -- lets a reader tell which code commit
  // computed these new columns on any given row, since (unlike risk_score/matchup_closeness) they
  // will only be populated going forward, never backfilled.
  `ALTER TABLE parlay_leg_outcomes ADD COLUMN IF NOT EXISTS risk_observability_captured_by_commit TEXT`,
];
