import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { policyForMetric } from "./metric-source-family-policy";
import { reconstructPbpScoreState, TASK18B_METRIC_CODES, type PbpSide } from "./pbp-score-state-recovery";
import { canonicalApprovedPbpIdentity, claimUniqueApprovedPbp } from "./pbp-evidence-firewall";

// Historical WTA Main-tour PBP evidence, distinct from bsd-wta-main-pbp.server.ts
// (which serves the LIVE BSD/Bzzoiro feed, 2024-12-02 onward, fetched per-query and
// never persisted). This module serves *persisted* historical point-by-point
// evidence built by scripts/verify-sackmann-wta-main-pbp.py (non-Slam, 2011-2015,
// ppaulojr/tennis_pointbypoint cross-verified against a local Tennis-Data.co.uk
// sync) and scripts/verify-sackmann-wta-main-slam-pbp.py (Grand Slams, 2016-2024,
// Aneeshers Sackmann archive mirror, single-source structurally validated), merged
// by scripts/build-wta-main-pbp-approved-index.py into
// data/metrics/pbp/wta_main/approved-index.jsonl. See docs/audit-wta-main-historical-pbp.md
// for the full before/after coverage accounting and the trust-tier distinction
// between the two sources (LEVEL_1_RESULT_VERIFIED_PBP vs
// LEVEL_2_SINGLE_SOURCE_STRUCTURALLY_VALIDATED) -- both are reported downstream via
// `provenance.trust_level`, never collapsed into one undifferentiated number.
//
// LICENSE STATUS -- see docs/WTA_MAIN_HISTORICAL_PBP_ATTRIBUTION.md before any
// commercial/monetized use: both source archives are CC BY-NC-SA 4.0 or, for the
// non-Slam ppaulojr archive specifically, entirely unlicensed (no LICENSE file at
// all). Registered NONCOMMERCIAL_ONLY in yellow-metric-sources.ts section 16,
// same posture this project already takes with the Match Charting Project.
//
// "034" and "053" are named here (not just spread from TASK18B_METRIC_CODES) for the
// same reason as bsd-wta-main-pbp.server.ts: reconstructPbpScoreState already computes
// them and they must not be silently dropped by an allowlist gap (docs/audit-task-026-034-053.md).
const PBP_CODES = new Set(["016", "024", "025", "033", "034", "042", "043", "044", "053", "060", ...TASK18B_METRIC_CODES]);

type MetricLike = { code: string; name: string };
type IndexRow = {
  tour: "WTA_MAIN"; year: number; player1: string; player2: string; tournament: string | null;
  date: string | null; round: string | null; surface: string | null; event_level: string | null;
  source: "SACKMANN_ARCHIVE_PPAULOJR" | "SACKMANN_SLAM_ARCHIVE"; trust_level: string;
  independent_verification_source: string | null; pbp_sha256: string; match_key: string;
  status: string; games: Array<{ server: string; tiebreak: boolean; points: Array<{ winner: string; ace: boolean | null; double_fault: boolean | null }> }>;
};

const norm = (v: unknown) => String(v ?? "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const codeOf = (v: unknown) => { const m = String(v ?? "").match(/(\d{1,3})$/); return m ? m[1].padStart(3, "0") : String(v ?? "").padStart(3, "0"); };

let indexCache: Promise<IndexRow[]> | null = null;
async function loadIndex(): Promise<IndexRow[]> {
  if (!indexCache) {
    indexCache = (async () => {
      try {
        const text = await readFile(join(process.cwd(), "data", "metrics", "pbp", "wta_main", "approved-index.jsonl"), "utf8");
        return text.split("\n").filter((line) => line.trim()).map((line) => JSON.parse(line) as IndexRow).filter((row) => row.status === "APPROVED_WTA_MAIN_PBP");
      } catch {
        return [];
      }
    })();
  }
  return indexCache;
}

function candidates(rows: IndexRow[], p1n: string, p2n: string) {
  const seen = new Set<string>();
  return rows
    .filter((r) => norm(r.player1) === p1n || norm(r.player2) === p1n || norm(r.player1) === p2n || norm(r.player2) === p2n)
    .filter((r) => { if (seen.has(r.match_key)) return false; seen.add(r.match_key); return true; })
    .sort((a, b) => String(b.date ?? "").localeCompare(String(a.date ?? "")));
}

type ObservationStatus = { eligible: boolean; reason: string; matches_used: number; rejected_pbp: number; source: string };
const observationCache = new Map<string, Promise<{ status: ObservationStatus; observations: unknown[] }>>();

async function computeObservations(args: { p1: string; p2: string; asOfDate: string; context?: string | null }) {
  const key = `${norm(args.p1)}|${norm(args.p2)}|${args.asOfDate}|${args.context ?? ""}`;
  const cached = observationCache.get(key);
  if (cached) return cached;
  const promise = (async (): Promise<{ status: ObservationStatus; observations: unknown[] }> => {
    const status: ObservationStatus = { eligible: true, reason: "", matches_used: 0, rejected_pbp: 0, source: "Sackmann historical WTA Main PBP (ppaulojr archive 2011-2015 cross-verified; Grand Slam archive 2016-2024 structurally validated)" };
    const rows = await loadIndex();
    const p1n = norm(args.p1), p2n = norm(args.p2);
    const eligible = candidates(rows, p1n, p2n).filter((r) => String(r.date ?? "") < args.asOfDate);

    const observations: unknown[] = [];
    const seenMatchIds = new Set<string>(), seenCanonicalKeys = new Set<string>();
    const claimed: Array<{ row: IndexRow; identity: NonNullable<ReturnType<typeof canonicalApprovedPbpIdentity>> }> = [];
    for (const row of eligible) {
      const identity = canonicalApprovedPbpIdentity({ tour: "WTA_MAIN", player1: row.player1, player2: row.player2, tournament: row.tournament, date: row.date, round: row.round, eventLevel: row.event_level });
      if (!claimUniqueApprovedPbp({ matchId: row.match_key, identity, seenMatchIds, seenCanonicalKeys })) { status.rejected_pbp++; continue; }
      claimed.push({ row, identity: identity! });
    }
    for (const { row, identity } of claimed) {
      const payload = { games: row.games.map((g) => ({ server: g.server, tiebreak: g.tiebreak, points: g.points.map((p) => ({ winner: p.winner, ace: p.ace, double_fault: p.double_fault })) })) };
      const recovery = reconstructPbpScoreState(payload);
      if (!recovery.valid) { status.rejected_pbp++; continue; }
      const names = [row.player1, row.player2];
      for (const target of [args.p1, args.p2]) {
        const idx = names.findIndex((n) => norm(n) === norm(target));
        if (idx < 0) continue;
        const side: PbpSide = idx === 0 ? "player1" : "player2";
        const derived = recovery.derived[side];
        if (!Object.keys(derived).length) continue;
        observations.push({
          family: "POINT_BY_POINT", source: row.source === "SACKMANN_ARCHIVE_PPAULOJR" ? "Sackmann Archive (ppaulojr, cross-verified)" : "Sackmann Grand Slam Archive",
          player: target, opponent: names[idx === 0 ? 1 : 0], tournament: row.tournament, event_date: row.date, surface: row.surface,
          key: "wta_main_historical_approved_pbp_score_state",
          value: { totalPoints: recovery.point_count, gamesObserved: recovery.game_count, derived, field_support: recovery.field_support },
          sample: `${recovery.point_count} parsed points; ${recovery.game_count} complete games`,
          provenance: {
            tour: "WTA_MAIN", match_key: row.match_key, canonical_match_key: identity.key, player_orientation: side,
            approved_only: true, approval_source: row.source, trust_level: row.trust_level,
            independent_verification_source: row.independent_verification_source, pbp_sha256: row.pbp_sha256,
            parsed_point_state: true, transformation: "pbp-score-state-recovery", duplicate_match_guard: true, one_match_one_pbp: true,
          },
        });
        status.matches_used++;
      }
    }
    status.reason = observations.length ? "Approved historical WTA Main PBP (Sackmann-sourced) reconstructed through canonical match identity where metric-specific raw fields are satisfied." : "No matching approved historical WTA Main PBP satisfied Task 18B field requirements.";
    return { status, observations };
  })();
  observationCache.set(key, promise);
  promise.catch(() => observationCache.delete(key));
  return promise;
}

export async function buildSackmannWtaMainPbpContext(args: { metrics: MetricLike[]; p1: string; p2: string; asOfDate: string; context?: string | null }) {
  const { status, observations } = await computeObservations(args);
  const packet: Record<string, unknown> = {};
  for (const metric of args.metrics) {
    const code = codeOf(metric.code);
    const codeRows = (observations as any[]).filter((o) => Boolean(o.value?.derived?.[code]));
    if (!PBP_CODES.has(code) || !codeRows.length) continue;
    const p = policyForMetric(code);
    packet[code] = {
      metric_name: metric.name, allowed_families: [...new Set([...p.allowed_families, "POINT_BY_POINT"])],
      sufficient_families: [...new Set([...p.sufficient_families, "POINT_BY_POINT"])],
      support_only_families: (p.support_only_families ?? []).filter((x) => x !== "POINT_BY_POINT"),
      observed_families: ["POINT_BY_POINT"], direct_satisfaction_allowed: false, observations: codeRows.slice(0, 80),
      tour_guard: "STRICT_WTA_MAIN_ONLY", evidence_treatment: "RECONSTRUCTED_OR_TASK17_PARTIAL_ONLY",
    };
  }
  return { packet, status: { ...status } };
}
