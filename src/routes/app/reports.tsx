import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { buildBoardPdf } from "@/lib/report-pdf";
import { useBoardRows } from "./board";

export const Route = createFileRoute("/app/reports")({
  head: () => ({
    meta: [
      { title: "PDF Reports — Tennis Matrix Audit System" },
      { name: "description", content: "Generate the colour-coded master audit report with calibration buckets, verified win rates and completion status." },
      { property: "og:title", content: "PDF Reports — Tennis Matrix Audit System" },
      { property: "og:description", content: "One combined report, sorted by audit colour then verified win rate." },
    ],
  }),
  component: Reports,
});

function Reports() {
  const { data } = useBoardRows();
  const rows = data ?? [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">PDF reports</h1>
        <p className="text-sm text-muted-foreground">
          The report mirrors the master ranked board exactly: audit colour first, verified win rate second, calibration
          buckets colour-coded, and unresolved matches shown as incomplete rather than hidden.
        </p>
      </div>

      <div className="panel p-4">
        <p className="mono-num text-sm">
          {rows.length} matches ready · {rows.filter((r) => r.completion === 100).length} complete ·{" "}
          {rows.filter((r) => r.completion < 100).length} unresolved
        </p>
        <Button
          className="mt-3"
          disabled={rows.length === 0}
          onClick={async () => {
            await buildBoardPdf(rows);
            toast.success("Report downloaded");
          }}
        >
          Generate master audit report
        </Button>
      </div>
    </div>
  );
}
