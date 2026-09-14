// The live wiring for the real-result capture path: the result SOURCE, and the Supabase-
// backed dependencies that drive captureAndResolveResults over the real slate.
//
// SOURCE CHOICE. No new external provider is introduced here. The repository already owns a
// verified match-result store -- the generated runtime tennis index, read through
// repository-results-history.server.ts -- and that is what supplies the winner. Using the
// existing reader also inherits its identity handling (including the WTA "Surname I."
// bucket-key convention) instead of re-deriving it. The live database has no other result
// source: source_observations carries only TOURNAMENT_SCHEDULE and RANKING rows, and nothing
// anywhere writes matches.actual_winner today.
//
// TEMPORAL SAFETY. This reader is the audited match's OWN result, so it is admissible for
// exactly one purpose -- grading a prediction after the fact -- and for no other. It must
// never be reachable from an evidence, metric or research path; that is enforced by a test.

import { eq, inArray } from "drizzle-orm";

import { db } from "@/db/client.server";
import { dbCall } from "@/db/query-errors";
import {
  auditRunsTable, executionLogsTable, finalDecisionsTable, matchesTable, resultGradesTable,
} from "@/db/schema";
import { LOCAL_WORKSPACE_ID } from "./constants";
import { repositoryResultsRows } from "./repository-results-history.server";
import { evidencePairMatches } from "./evidence-player-alias";
import type { EvidenceTourFamily } from "./evidence-match-identity";
import { captureAndResolveResults, type CaptureMatchRow, type ResultCaptureDeps, type ResultCaptureSummary } from "./match-result-capture";
import type { CapturedResult } from "./match-result-resolution";

const FAMILIES: EvidenceTourFamily[] = ["ATP_MAIN", "WTA_MAIN", "ATP_CHALLENGER", "WTA_CHALLENGER"];

type HistoryDetail = { status?: string | null; raw_score?: string | null };

/**
 * Map one history row's scoreline/status onto the match-level result vocabulary.
 *
 * A recorded history row exists because a match was PLAYED, so an absent status is FINAL,
 * not unknown -- that is the same reading every metric engine already applies to this store.
 * What must be pulled back out are the two shapes that name a winner without a played
 * result: walkovers and defaults. Those become WALKOVER, which resolution treats as
 * ungradable.
 */
export function resultStatusFromHistory(detail: HistoryDetail | undefined): string | null {
  const raw = String(detail?.raw_score ?? "");
  if (/\bw\.?\s*\/?\s*o\.?\b|walk\s*over|\bdef\.?\b|default/i.test(raw)) return "WALKOVER";
  if (/\bret\.?\b|\brtd\.?\b|retire/i.test(raw)) return "RETIRED";
  const status = String(detail?.status ?? "").trim().toUpperCase();
  if (!status || status === "FINISHED" || status === "COMPLETE" || status === "COMPLETED") return "FINAL";
  if (["WALKOVER", "RETIRED", "CANCELLED", "CANCELED", "POSTPONED", "ABANDONED"].includes(status)) {
    return status === "CANCELED" ? "CANCELLED" : status;
  }
  return null;
}

type Candidate = { winnerSide: "P1" | "P2"; status: string; score: string | null };

/**
 * Find this match's own recorded result. Returns null unless the store yields exactly one
 * consistent answer.
 *
 * The winner is returned as the match's OWN canonical player name, derived from which side
 * the row says won, never as the raw name string in the history row -- those are sometimes
 * abbreviated ("Micic E."), and passing one through would fail every later name comparison.
 */
export function repositoryFinalResult(match: Pick<CaptureMatchRow, "player1_name" | "player2_name" | "scheduled_date">): CapturedResult | null {
  const date = String(match.scheduled_date ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;

  const candidates: Candidate[] = [];
  for (const [self, other, selfSide] of [
    [match.player1_name, match.player2_name, "P1"],
    [match.player2_name, match.player1_name, "P2"],
  ] as Array<[string, string, "P1" | "P2"]>) {
    for (const family of FAMILIES) {
      for (const row of repositoryResultsRows(self, family, date, { strictBefore: false })) {
        if (row.event_date !== date) continue;
        const opponent = String(row.opponent_name ?? "");
        if (!evidencePairMatches(self, opponent, self, other)) continue;
        const payload = row.raw_payload as { winner?: string | null; history_detail?: HistoryDetail };
        const winner = String(payload?.winner ?? "");
        if (!winner) continue;
        const status = resultStatusFromHistory(payload?.history_detail);
        if (!status) continue;
        // `winner` is either the searched player or the opponent; that is what fixes the side.
        const selfWon = winner === self;
        candidates.push({
          winnerSide: selfWon ? selfSide : selfSide === "P1" ? "P2" : "P1",
          status,
          score: String(payload?.history_detail?.raw_score ?? "").trim() || null,
        });
      }
    }
  }
  if (!candidates.length) return null;
  const sides = new Set(candidates.map((c) => c.winnerSide));
  const statuses = new Set(candidates.map((c) => c.status));
  // Two sources disagreeing about who won, or about whether it was played, is a conflict to
  // surface -- not something to break by picking one. Leave the match open.
  if (sides.size !== 1 || statuses.size !== 1) return null;
  const winnerSide = [...sides][0];
  return {
    actual_winner: winnerSide === "P1" ? match.player1_name : match.player2_name,
    result_status: [...statuses][0],
    final_score: candidates.find((c) => c.score)?.score ?? null,
  };
}

export function makeResultCaptureDeps(): ResultCaptureDeps {
  const user_id = LOCAL_WORKSPACE_ID;
  return {
    now: () => new Date(),
    async listMatches() {
      const rows = await dbCall("read", "matches", () => db.select({
        id: matchesTable.id, player1_name: matchesTable.player1_name,
        player2_name: matchesTable.player2_name, tournament_name: matchesTable.tournament_name,
        scheduled_date: matchesTable.scheduled_date, surface: matchesTable.surface,
        actual_winner: matchesTable.actual_winner, result_status: matchesTable.result_status,
        final_score: matchesTable.final_score,
      }).from(matchesTable));
      return rows as CaptureMatchRow[];
    },
    async updateMatch(matchId, patch) {
      await dbCall("update", "matches", () => db.update(matchesTable).set(patch as never).where(eq(matchesTable.id, matchId)));
    },
    async lookupResult(match) { return repositoryFinalResult(match); },
    async listDecidedRuns() {
      const decided = await dbCall("read", "final_decisions", () => db
        .select({ audit_run_id: finalDecisionsTable.audit_run_id }).from(finalDecisionsTable));
      const ids = [...new Set(decided.map((row) => String(row.audit_run_id)).filter(Boolean))];
      if (!ids.length) return [];
      const out = [];
      for (let i = 0; i < ids.length; i += 200) {
        const rows = await dbCall("read", "audit_runs", () => db.select({
          id: auditRunsTable.id, match_id: auditRunsTable.match_id,
          run_number: auditRunsTable.run_number, independent_winner: auditRunsTable.independent_winner,
        }).from(auditRunsTable).where(inArray(auditRunsTable.id, ids.slice(i, i + 200))));
        out.push(...rows);
      }
      return out as never;
    },
    async listDecisions() {
      const rows = await dbCall("read", "final_decisions", () => db.select({
        audit_run_id: finalDecisionsTable.audit_run_id, gate_report: finalDecisionsTable.gate_report,
      }).from(finalDecisionsTable));
      return rows as never;
    },
    async listGrades() {
      const rows = await dbCall("read", "result_grades", () => db.select({
        id: resultGradesTable.id, match_id: resultGradesTable.match_id,
        audit_run_id: resultGradesTable.audit_run_id,
      }).from(resultGradesTable));
      return rows as never;
    },
    async saveGrade(existingId, row) {
      if (existingId) {
        await dbCall("update", "result_grades", () => db.update(resultGradesTable).set(row as never).where(eq(resultGradesTable.id, existingId)));
        return;
      }
      await dbCall("insert", "result_grades", () => db.insert(resultGradesTable).values({ ...row, user_id } as never));
    },
    async log(entry) { await db.insert(executionLogsTable).values({ ...entry, user_id } as never); },
  };
}

export async function runResultCapture(): Promise<ResultCaptureSummary> {
  return captureAndResolveResults(makeResultCaptureDeps());
}
