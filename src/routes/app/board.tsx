import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { fetchBoardScreen } from "@/lib/screen-queries.functions";
import { AuditColorBadge, BucketBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { buildBoardPdf } from "@/lib/report-pdf";
import { toast } from "sonner";
import { currentAuditRows, activeSlateMatchIds } from "@/lib/current-audit-state";

export const Route = createFileRoute("/app/board")({
  head: () => ({
    meta: [
      { title: "Master Ranked Board — Tennis Matrix Audit System" },
      { name: "description", content: "One combined ranked board sorted by final audit color, then by current verified win rate." },
      { property: "og:title", content: "Master Ranked Board — Tennis Matrix Audit System" },
      { property: "og:description", content: "Audit color first, verified win rate second — never Matrix WP." },
    ],
  }),
  component: Board,
});

const ORDER = ["DOUBLE GREEN", "GREEN", "YELLOW", "RED / PASS", "INCOMPLETE"];

export interface BoardRow {
  matchLabel: string;
  selection: string;
  tournament: string;
  surface: string;
  matrixPick: string;
  matrixWp: string;
  bucket: string | null;
  verifiedWinRate: number | null;
  independentWinner: string;
  independentRange: string;
  calibratedRange: string;
  evidence: number;
  color: string;
  action: string;
  completion: number;
}

export function useBoardRows() {
  return useQuery({
    queryKey: ["board"],
    queryFn: async (): Promise<BoardRow[]> => {
      // The five per-table error checks this replaced existed because PostgREST returned
      // errors as values, so a failed read arrived as an empty list and the board would
      // silently rank fewer matches. A server function rejects instead, which react-query
      // surfaces as a query error -- the same "never render a partial board" guarantee,
      // reached without five separate checks.
      const { decisions, runs, matches, fields, versions } = await fetchBoardScreen();

      const matrixFor = (matchId: string, key: string) => {
        const sv = versions?.find((v) => v.match_id === matchId && v.is_active);
        if (!sv) return null;
        return fields?.find((f) => f.summary_version_id === sv.id && f.field_key === key)?.normalized_value ?? null;
      };

      // A cleared match must never rank on the board: only matches still on
      // the active slate (an active summary_version) are eligible, using the
      // same definition every other operational page reuses.
      const slateMatchIds = activeSlateMatchIds(versions);
      const activeMatches = matches.filter((match) => slateMatchIds.has(match.id));

      return currentAuditRows(activeMatches, runs, decisions).filter((row) => row.decision).map(({ match, run, decision: d }) => {
        const snapshot = (d!.gate_report as Record<string, any> | null)?.calibration_snapshot;
        const frozenRange = snapshot?.calibratedLow != null && snapshot?.calibratedHigh != null
          ? `${snapshot.calibratedLow}–${snapshot.calibratedHigh}%`
          : null;
        return {
          matchLabel: `${match.player1_name} vs ${match.player2_name}`,
          selection: d!.final_selection ?? run?.independent_winner ?? "—",
          tournament: match?.tournament_name ?? "—",
          surface: match?.surface ?? "—",
          matrixPick: matrixFor(match.id, "matrix_predicted_winner") ?? "—",
          matrixWp: matrixFor(match.id, "matrix_wp") ?? "—",
          bucket: d!.calibration_bucket,
          verifiedWinRate: d!.verified_win_rate,
          independentWinner: run?.independent_winner ?? "—",
          independentRange:
            run?.independent_low != null ? `${run.independent_low}–${run.independent_high}%` : "—",
          calibratedRange: frozenRange ?? (run?.calibrated_low != null ? `${run.calibrated_low}–${run.calibrated_high}%` : "—"),
          evidence: run?.effective_evidence_count ?? 0,
          color: d!.audit_complete ? d!.final_audit_color : "INCOMPLETE",
          action: d!.action ?? "—",
          completion: Number(d!.completion_percent),
        };
      });
    },
  });
}

function Board() {
  const { data } = useBoardRows();
  const rows = [...(data ?? [])].sort((a, b) => {
    const o = ORDER.indexOf(a.color) - ORDER.indexOf(b.color);
    if (o !== 0) return o;
    return (b.verifiedWinRate ?? -1) - (a.verifiedWinRate ?? -1);
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Master ranked board</h1>
          <p className="text-sm text-muted-foreground">
            Primary sort: final audit color. Secondary sort: current calibration verified win rate.
          </p>
        </div>
        <Button
          onClick={async () => {
            await buildBoardPdf(rows);
            toast.success("Report generated");
          }}
          disabled={rows.length === 0}
        >
          Generate PDF report
        </Button>
      </div>

      <div className="panel overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-header text-header-foreground">
            <tr className="text-left">
              {["#", "Final selection", "Match", "Tournament", "Surface", "Matrix pick", "Matrix WP", "Bucket", "Verified WR", "Independent", "Ind. range", "Calibrated", "Evidence", "Color", "Action", "Completion"].map((h) => (
                <th key={h} className="px-2 py-2 text-xs font-semibold uppercase tracking-wide whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-border">
                <td className="mono-num px-2 py-2">{i + 1}</td>
                <td className="px-2 py-2 font-medium">{r.selection}</td>
                <td className="px-2 py-2">{r.matchLabel}</td>
                <td className="px-2 py-2">{r.tournament}</td>
                <td className="px-2 py-2">{r.surface}</td>
                <td className="px-2 py-2">{r.matrixPick}</td>
                <td className="mono-num px-2 py-2">{r.matrixWp}</td>
                <td className="px-2 py-2">
                  <BucketBadge code={r.bucket} />
                </td>
                <td className="mono-num px-2 py-2">{r.verifiedWinRate ?? "—"}%</td>
                <td className="px-2 py-2">{r.independentWinner}</td>
                <td className="mono-num px-2 py-2">{r.independentRange}</td>
                <td className="mono-num px-2 py-2">{r.calibratedRange}</td>
                <td className="mono-num px-2 py-2">{r.evidence}</td>
                <td className="px-2 py-2">
                  <AuditColorBadge color={r.color} />
                </td>
                <td className="px-2 py-2">{r.action}</td>
                <td className="mono-num px-2 py-2">{r.completion}%</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={16} className="px-3 py-8 text-center text-sm text-muted-foreground">
                  No final decisions yet. Run the Final Combination Gate on a match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
