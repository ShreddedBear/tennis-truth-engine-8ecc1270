ALTER TABLE "historical_matches"
  ADD COLUMN IF NOT EXISTS "canonical_player1_id" text,
  ADD COLUMN IF NOT EXISTS "canonical_player2_id" text,
  ADD COLUMN IF NOT EXISTS "source_file" text,
  ADD COLUMN IF NOT EXISTS "source_url" text,
  ADD COLUMN IF NOT EXISTS "source_license" text,
  ADD COLUMN IF NOT EXISTS "import_provenance" jsonb NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'historical_matches_canonical_player1_fk'
  ) THEN
    ALTER TABLE "historical_matches"
      ADD CONSTRAINT "historical_matches_canonical_player1_fk"
      FOREIGN KEY ("canonical_player1_id") REFERENCES "canonical_players"("id");
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'historical_matches_canonical_player2_fk'
  ) THEN
    ALTER TABLE "historical_matches"
      ADD CONSTRAINT "historical_matches_canonical_player2_fk"
      FOREIGN KEY ("canonical_player2_id") REFERENCES "canonical_players"("id");
  END IF;
END $$;