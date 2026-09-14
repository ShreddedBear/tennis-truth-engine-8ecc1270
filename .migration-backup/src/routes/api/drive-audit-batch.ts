import { createFileRoute } from "@tanstack/react-router";
import { eq } from "drizzle-orm";

import { db } from "@/db/client.server";
import { auditRunsTable } from "@/db/schema";
import { tryQuery } from "@/db/try-query";

// Unattended continuation for audits: everything else that drives the
// pipeline (Upload's commit flow, Active Slate's poll loop) is triggered
// from a browser tab, so the instant that tab closes or backgrounds, every
// in-flight audit freezes exactly where it was -- confirmed in production,
// where a 27-match batch sat with zero heartbeat activity for over an hour
// once nobody was watching the Slate page. This route lets an external
// scheduler (Supabase pg_cron + pg_net, hitting this on a short interval)
// keep advancing RUNNING audits with no browser involved at all. It reuses
// driveAuditBatch -- the exact same fair, heartbeat-ordered scheduling the
// browser path uses -- rather than a second implementation of it.
//
// Fails closed: with no AUDIT_CRON_SECRET configured, every request is
// refused rather than silently accepted, so this can never become an open
// "run any audit for free" endpoint by omission.

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

export const Route = createFileRoute("/api/drive-audit-batch")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["AUDIT_CRON_SECRET"];
        if (!secret) return json({ ok: false, error: "AUDIT_CRON_SECRET is not configured; refusing to run unattended." }, 503);
        const auth = request.headers.get("authorization") ?? "";
        if (auth !== `Bearer ${secret}`) return json({ ok: false, error: "Unauthorized" }, 401);

        let body: { concurrency?: number; budgetMs?: number } = {};
        try {
          const text = await request.text();
          if (text) body = JSON.parse(text);
        } catch {
          return json({ ok: false, error: "Request body must be JSON" }, 400);
        }

        const { data: runs, error } = await tryQuery(() => db
          .select({ match_id: auditRunsTable.match_id })
          .from(auditRunsTable)
          .where(eq(auditRunsTable.status, "RUNNING"))
          .limit(100));
        if (error) return json({ ok: false, error: `audit_runs lookup: ${error.message}` }, 500);

        const matchIds: string[] = [...new Set<string>((runs ?? []).map((row) => row.match_id))];
        if (!matchIds.length) return json({ ok: true, total: 0, note: "No RUNNING audits to drive." });

        const { driveAuditBatch } = await import("@/lib/audit-pipeline.functions");
        try {
          const result = await driveAuditBatch({ matchIds, concurrency: body.concurrency, budgetMs: body.budgetMs });
          return json(result);
        } catch (e) {
          return json({ ok: false, error: e instanceof Error ? e.message : String(e) }, 500);
        }
      },
    },
  },
});
