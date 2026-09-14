import { defineConfig } from "drizzle-kit";
import path from "path";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

const databaseUrl = new URL(process.env.DATABASE_URL);
const configuredDatabaseName = decodeURIComponent(databaseUrl.pathname.slice(1));
const requestedDatabaseName =
  process.env.STATS_DATABASE_NAME ??
  process.env.PGDATABASE ??
  configuredDatabaseName;
const databaseName =
  requestedDatabaseName === "tennis_stats_engine" ? "heliumdb" : requestedDatabaseName;
if (databaseName) {
  if (!/^[a-z_][a-z0-9_]*$/u.test(databaseName)) {
    throw new Error("STATS_DATABASE_NAME must be a valid PostgreSQL database name");
  }
  databaseUrl.pathname = `/${databaseName}`;
}

// Positive whitelist of EVERY table that has a pgTable() definition in
// lib/db/src/schema/.  Drizzle ignores all other tables it finds in the DB
// (including the ones created exclusively by ensureEvaluationSchema.ts raw SQL
// such as optimizer_runs, walk_forward_runs, parlay_*, strategy_*, etc.).
//
// Rule: when you add a new pgTable() to the schema, add the table name here.
// When ensureEvaluationSchema.ts creates a raw-SQL-only table, do NOT add it here.
const DRIZZLE_MANAGED_TABLES = [
  // core prediction/evaluation ledger
  "predictions",
  "historical_matches",
  "match_feature_snapshots",
  "calibration_models",
  "evaluation_predictions",
  "evaluation_runs",
  "job_runs",
  "pattern_analysis_runs",
  "prediction_settings",
  "simulator_validation",
  "specialist_models",
  "threshold_evaluation_runs",
  // backtesting
  "backtest_predictions",
  "backtest_runs",
  // strategy lifecycle (Drizzle-managed subset)
  "candidate_configs",
  "config_promotions",
  // players / stats
  "master_players",
  "player_stats",
  // payments / billing
  "payments_accounts",
  "webhook_events",
  // user-facing / CRM
  "legal_consents",
  "support_attachments",
  "support_messages",
  "support_tickets",
  "admin_audit_log",
  "admin_user_notes",
  "saved_prediction_cards",
  // canonical identity / match linking
  "canonical_matches",
  "canonical_players",
  "historical_feature_diagnostics",
  "match_source_links",
  "player_aliases",
  "player_resolution_reviews",
];

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl.toString(),
  },
  tablesFilter: DRIZZLE_MANAGED_TABLES,
});
