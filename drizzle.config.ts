import { defineConfig } from "drizzle-kit";
import { resolve } from "node:path";

if (!process.env["DATABASE_URL"]) {
  throw new Error("DATABASE_URL must be set before running drizzle-kit.");
}

// Positive whitelist of every table that has a pgTable() definition in src/db/schema/.
// drizzle-kit ignores everything else it finds in the database, so an extension's or the
// platform's own tables are never proposed for deletion.
//
// Rule: add a pgTable() to the schema -> add its table name here.
const DRIZZLE_MANAGED_TABLES = [
  // matches and identity
  "matches", "players", "tournaments", "match_identity_records", "prediction_slates",
  // uploads and parsing
  "summary_uploads", "summary_versions", "summary_pages", "parsed_summary_fields",
  // audit pipeline
  "audit_runs", "audit_stage_runs", "audit_coverage", "audit_color_ledger",
  "execution_logs", "batch_integrity_checks",
  // metrics and evidence
  "metric_registry", "metric_results", "metric_coverage_rates", "metric_evidence_store",
  "evidence_family_coverage",
  // audit layers
  "verification_results", "disagreement_results", "underdog_results", "stress_results",
  "reconstruction_results", "autopsies", "autopsy_findings", "block_reasons",
  // decisions and reporting
  "final_decisions", "probability_methods", "probability_provenance", "formula_versions",
  "override_records", "generated_reports", "result_grades",
  // calibration
  "calibration_versions", "calibration_buckets", "calibration_ledger",
  "truth_engine_calibration_observations",
  // ingestion and sources
  "source_definitions", "source_observations", "source_conflicts", "source_snapshots",
  "source_ingestion_runs", "source_health_events", "ingestion_targets",
  // rules
  "rules", "rule_documents", "rule_document_versions",
  // access control
  "user_roles",
];

export default defineConfig({
  schema: resolve(import.meta.dirname, "./src/db/schema/index.ts"),
  out: resolve(import.meta.dirname, "./src/db/drizzle"),
  dialect: "postgresql",
  dbCredentials: { url: process.env["DATABASE_URL"] },
  tablesFilter: DRIZZLE_MANAGED_TABLES,
});
