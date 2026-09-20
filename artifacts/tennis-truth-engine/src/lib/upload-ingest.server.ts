// Summary-PDF ingestion. SERVER ONLY.
//
// This whole transaction used to run in the browser with the publishable key: it inserted
// summary_uploads, created or reused `matches`, deactivated prior summary_versions, wrote a
// new one, repointed matches.active_summary_version_id, and inserted parsed_summary_fields.
// That was the single largest write surface the browser had, and it is the one the
// decision-table lockdown could never actually close while the UI depended on it.
//
// The logic below is a move, not a rewrite: same ordering, same reuse rules, same
// per-matchup error isolation. Only the transport and the trust boundary changed.
import { desc, eq, inArray } from "drizzle-orm";

import { db } from "@/db/client.server";
import {
  auditStageRunsTable, matchesTable, parsedSummaryFieldsTable, summaryUploadsTable,
  summaryVersionsTable,
} from "@/db/schema";
import { log } from "./audit-runs.server";
import { canonicalKey, type ParsedMatchup } from "./summary-parser";
import { compatible, dedupeMatchups, nameTokens, samePair } from "./upload-matchup";

export interface StagedFile {
  filename: string;
  pages: string[];
  matchups: ParsedMatchup[];
  source: "TEXT" | "LOCAL_OCR" | "VISION";
}

/** One failure, shaped so the screen can show it with the same context it always did. */
export interface IngestFailure {
  stage: string;
  message: string;
  file?: string;
  match?: string;
}

export interface IngestResult {
  created: number;
  reused: number;
  versions: number;
  matchIds: string[];
  failures: IngestFailure[];
}

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));
const fieldValue = (m: ParsedMatchup, key: string) =>
  m.fields.find((f) => f.field_key === key)?.normalized_value ?? "";

/**
 * Finds an existing match this parsed matchup should attach to, rather than creating a
 * duplicate. Exact canonical_key first, then the same player pair with compatible context,
 * then a lone pair match when neither side carries conflicting context.
 */
async function findReusable(m: ParsedMatchup, key: string) {
  const [exact] = await db.select().from(matchesTable).where(eq(matchesTable.canonical_key, key)).limit(1);
  if (exact) return exact;

  const candidates = await db.select().from(matchesTable).orderBy(desc(matchesTable.created_at)).limit(500);
  const date = fieldValue(m, "scheduled_date");
  const tour = fieldValue(m, "tournament");
  const round = fieldValue(m, "round");
  const pairMatches = candidates.filter((c) => samePair(c.player1_name, c.player2_name, m.player1_name, m.player2_name));
  const contextual = pairMatches.find((c) =>
    compatible(c.scheduled_date, date) && compatible(c.tournament_name, tour) && compatible(c.round, round));
  if (contextual) return contextual;
  if (pairMatches.length === 1 && (!date || !pairMatches[0].scheduled_date) && (!tour || !pairMatches[0].tournament_name)) {
    return pairMatches[0];
  }
  return null;
}

export async function ingestStagedFiles(files: StagedFile[]): Promise<IngestResult> {
  let created = 0;
  let versions = 0;
  let reused = 0;
  const matchIds = new Set<string>();
  const failures: IngestFailure[] = [];

  for (const file of files) {
    let upload: { id: string } | undefined;
    try {
      [upload] = await db.insert(summaryUploadsTable).values({
        filename: file.filename,
        page_count: file.pages.length,
        parse_status: "COMPLETE",
        raw_text: file.pages.join("\n\f\n"),
      } as never).returning({ id: summaryUploadsTable.id });
    } catch (error) {
      failures.push({ stage: "SUMMARY UPLOAD DATABASE WRITE", message: message(error), file: file.filename });
      continue;
    }
    if (!upload) continue;
    const uploadId = upload.id;

    for (const m of dedupeMatchups(file.matchups)) {
      const matchLabel = `${m.player1_name} vs ${m.player2_name}`;
      try {
        const key = canonicalKey({
          tournament: fieldValue(m, "tournament") || null,
          round: fieldValue(m, "round") || null,
          date: fieldValue(m, "scheduled_date") || null,
          p1: m.player1_name,
          p2: m.player2_name,
        });
        const existing = await findReusable(m, key);
        let matchId = existing?.id;

        if (existing) {
          reused++;
          // Only ever widen: a longer name and a newly-present context field win, an
          // absent one never overwrites what is already recorded.
          const patch: { [k: string]: unknown } = {};
          if (nameTokens(m.player1_name).length > nameTokens(existing.player1_name).length) patch.player1_name = m.player1_name;
          if (nameTokens(m.player2_name).length > nameTokens(existing.player2_name).length) patch.player2_name = m.player2_name;
          const tv = fieldValue(m, "tournament"), ev = fieldValue(m, "event_level"), rv = fieldValue(m, "round");
          const dv = fieldValue(m, "scheduled_date"), sv = fieldValue(m, "surface"), bv = Number(fieldValue(m, "best_of"));
          if (tv && tv !== existing.tournament_name) patch.tournament_name = tv;
          if (ev && ev !== existing.event_level) patch.event_level = ev;
          if (rv && rv !== existing.round) patch.round = rv;
          if (dv && dv !== existing.scheduled_date) patch.scheduled_date = dv;
          if (sv && sv !== existing.surface) patch.surface = sv;
          if (bv && bv !== existing.best_of) patch.best_of = bv;
          if (Object.keys(patch).length) {
            await db.update(matchesTable).set(patch as never).where(eq(matchesTable.id, existing.id));
          }
        }

        if (!matchId) {
          const [match] = await db.insert(matchesTable).values({
            canonical_key: key,
            player1_name: m.player1_name,
            player2_name: m.player2_name,
            tournament_name: fieldValue(m, "tournament") || null,
            event_level: fieldValue(m, "event_level") || null,
            round: fieldValue(m, "round") || null,
            scheduled_date: fieldValue(m, "scheduled_date") || null,
            surface: fieldValue(m, "surface") || null,
            best_of: Number(fieldValue(m, "best_of")) || null,
          } as never).returning({ id: matchesTable.id });
          matchId = match?.id;
          if (matchId) created++;
        }
        if (!matchId) throw new Error("Match row was not created or reused");

        const priorVersions = await db
          .select({ id: summaryVersionsTable.id, version_number: summaryVersionsTable.version_number })
          .from(summaryVersionsTable)
          .where(eq(summaryVersionsTable.match_id, matchId))
          .orderBy(desc(summaryVersionsTable.version_number));
        if (priorVersions.length) {
          await db.update(summaryVersionsTable).set({ is_active: false }).where(eq(summaryVersionsTable.match_id, matchId));
        }

        const [version] = await db.insert(summaryVersionsTable).values({
          match_id: matchId,
          upload_id: uploadId,
          version_number: (priorVersions[0]?.version_number ?? 0) + 1,
          page_number: m.page_number,
          is_active: true,
        } as never).returning({ id: summaryVersionsTable.id });
        if (!version) throw new Error("Summary version was not created");
        versions++;

        await db.update(matchesTable)
          .set({ active_summary_version_id: version.id, canonical_key: key })
          .where(eq(matchesTable.id, matchId));

        if (m.fields.length) {
          await db.insert(parsedSummaryFieldsTable).values(m.fields.map((f) => ({
            summary_version_id: version.id,
            field_key: f.field_key,
            raw_value: f.raw_value,
            normalized_value: f.normalized_value,
            extraction_status: f.extraction_status,
            confidence: f.confidence,
            page_number: f.page_number,
          })) as never);
        }

        await log({
          match_id: matchId,
          stage: "SUMMARY PDF INGESTION",
          status: "COMPLETE",
          output: { file: file.filename, page: m.page_number, source: file.source },
        });
        matchIds.add(matchId);
      } catch (error) {
        // Per-matchup isolation, exactly as before: one bad matchup must not abandon the
        // rest of the file.
        failures.push({ stage: "MATCH INGESTION", message: message(error), file: file.filename, match: matchLabel });
      }
    }
  }

  return { created, reused, versions, matchIds: [...matchIds], failures };
}

/** Stage rows for a set of audit runs, for the upload screen's batch progress bar. */
export async function loadStageProgress(runIds: string[]) {
  if (!runIds.length) return [];
  return db.select({
    audit_run_id: auditStageRunsTable.audit_run_id,
    stage: auditStageRunsTable.stage,
    status: auditStageRunsTable.status,
    done_count: auditStageRunsTable.done_count,
    total_count: auditStageRunsTable.total_count,
  }).from(auditStageRunsTable).where(inArray(auditStageRunsTable.audit_run_id, runIds));
}
