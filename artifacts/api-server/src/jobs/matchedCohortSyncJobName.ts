/**
 * Shared identifier for the matched-cohort sync job's `job_runs` rows -- same rationale as
 * `historicalBackfillJobName.ts`: kept in its own tiny module so importing it doesn't pull the
 * job's retry-and-run entrypoint into the server's bundle.
 */
export const MATCHED_COHORT_SYNC_JOB_NAME = "matched-cohort-sync-cycle";
