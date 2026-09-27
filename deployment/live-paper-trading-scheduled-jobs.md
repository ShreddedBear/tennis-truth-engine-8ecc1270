# Live paper-trading scheduled deployments — manual setup manifest

**Status: not installed.** This document is a configuration handoff, **not** a
Replit-native deployment file. Committing it does not create, enable, publish, or
schedule any deployment. Do not treat a row marked `external_schedule` as proof
of a natural scheduled run on its own: a human can invoke the same standalone
command. Check the Replit schedule's execution history as well.

## Prerequisite: preserve the web/API deployment

The existing API Server deployment is Autoscale. **Do not change that deployment
to Scheduled**: it would replace the web API rather than add background jobs.
The current workspace does not contain three separately publishable worker
targets. Each job below needs its **own** Scheduled Deployment target. In the
Publishing interface, use a separate worker target if the project offers one.
If the only choice is to change the existing API Server's deployment type,
**stop**: do not use that choice. Additional Replit worker targets/projects and
secure access to the *same production database* must be arranged before these
steps can be completed. A different project's default database is not the same
production database.

All commands below run **once and exit**. Run them with the **project root** as
the working directory (the directory containing `pnpm-workspace.yaml`). Build
each worker from the same reviewed checkout with:

```sh
pnpm --filter @workspace/api-server run build
```

Use UTC as the schedule time zone. The listed timeouts are **deployment timeout
settings to enter in the UI**, not measured or code-enforced upper bounds on
provider response time. If Replit does not allow a listed timeout or cadence,
stop and review the constraint; do not silently change the requested cadence.
A cycle that takes longer than its cadence may cause the next run to skip
because the existing advisory lock is held.

| Deployment name | Cron (UTC) | Run command (project root) | UI job timeout | Expected `job_runs.job_name` | Advisory-lock key |
| --- | --- | --- | --- | --- | --- |
| `Tennis PE paper trading` | `*/15 * * * *` | `pnpm --filter @workspace/api-server run job:paper-trading` | 20 minutes | `paper-trading-cycle` | `190734864` |
| `Tennis Builder paper trading` | `*/15 * * * *` | `pnpm --filter @workspace/api-server run job:parlay-paper-trading` | 20 minutes | `parlay-paper-trading-cycle` | `481516234` |
| `Tennis recent official results` | `*/5 * * * *` | `pnpm --filter @workspace/api-server run job:recent-completed-results` | 10 minutes | `recent-completed-results-cycle` | `190734863` |

These production scripts already set their respective `*_STANDALONE=1` flags.
Do **not** use their `:dev` variants or an HTTP endpoint as the run command.
The recent-results command ingests official terminal results; the PE and
Builder cycles perform their own pending-outcome settlement/grading.

### Environment for each worker

- `NODE_ENV=production`.
- `DATABASE_URL`: must point to the **same production Postgres database** as
  the Autoscale API; the database import fails without it. Replit may supply it
  automatically only when the worker shares that database's project. Verify
  availability in each worker's production environment; do not paste its value
  into this file or chat.
- `Live_Tennis_Api` (or `LIVE_TENNIS_API_KEY`): the existing authenticated
  tennis provider credential. Without it the jobs cannot discover/ingest live
  provider fixtures. Configure it through each worker's production secrets.
- Preserve any other provider/AI/odds **production secrets used by the existing
  API prediction pipeline** on the PE/Builder worker targets, so standalone
  execution uses the same inputs as the API. Do not replace secrets with fake
  values or expose their contents. Recent-result ingestion needs the tennis
  provider and database, not the model's odds/AI keys.
- Do **not** set `BACKGROUND_JOB_MODE=external` on the Autoscale API yet.
  No `*_STANDALONE` flag needs to be added separately when using the commands
  in the table: their package scripts set those flags themselves.

## Manual Replit Publishing steps — repeat for each of the three rows

1. Open Replit **Publishing**. Keep the existing **API Server** deployment on
   **Autoscale**. Select a *separate, already-created worker deployment target*
   for the row. If the UI shows only API Server and offers only **Adjust
   settings → Deployment type**, stop rather than repurposing the API; this
   manifest cannot create the missing worker target.
2. Open that worker target's **Adjust settings** and choose **Scheduled** as its
   deployment type. Name it exactly as in the table so its execution history
   can be distinguished from the other two jobs.
3. Set the schedule to the row's cron expression and select **UTC**. Enter the
   row's **job timeout**. Do not use an hourly schedule as a substitute for a
   five- or fifteen-minute schedule.
4. Set working directory to the **project root**, build command to the command
   above, and run command to the row's exact command. A Scheduled Deployment
   does not need to serve a port or expose a web URL.
5. In that worker target's production **Deployment secrets/environment**
   settings, verify the variables listed above and that its database is the
   existing API's production database. Do not copy secret values into a
   repository file. Leave the API's `BACKGROUND_JOB_MODE` unchanged.
6. Review the settings, then **Publish/Enable** that worker in the UI. Repeat
   from step 1 for the next row. Publishing the API alone does not publish or
   enable these three schedules. If the UI cannot create/select separate
   worker targets, stop and report the missing capability instead of claiming
   this document has installed the schedules.

## Post-setup checks before changing any scheduling mode

- Observe **two consecutive natural** `paper-trading-cycle` Scheduled
  Deployment executions roughly 15 minutes apart, **two consecutive natural**
  `parlay-paper-trading-cycle` executions roughly 15 minutes apart, and
  **three consecutive natural** `recent-completed-results-cycle` executions
  roughly 5 minutes apart. Do not manually run the commands as proof.
- Match each Replit schedule execution to a `job_runs` row with the expected
  name, `trigger_type=external_schedule`, start/finish times, status, and
  summary/error. Verify its scheduler execution ID/timestamp independently:
  `trigger_type` alone cannot distinguish a human CLI run from a scheduler.
  A lock-skipped cycle can exit cleanly without creating a `job_runs` row;
  examine scheduler logs and overlap with the other invocation in that case.
- Check that no pair of **executed** cycles for the same job overlaps and no
  fixture receives duplicate predictions or grades. Preserve both the
  advisory locks and the existing per-process in-flight guards.
- Without self-pings, browser polling, keep-alive requests, or artificial
  traffic, verify scheduled executions continue while the Autoscale API is
  idle. An Autoscale request is not uptime proof.
- Only **after all three schedules exist and successful natural runs are
  verified**, set `BACKGROUND_JOB_MODE=external` on the **production API**,
  republish it, and verify its in-process timers are disabled while the
  external jobs and advisory locks remain active. Until then retain the
  in-process fallback. The manifest does not make this change.