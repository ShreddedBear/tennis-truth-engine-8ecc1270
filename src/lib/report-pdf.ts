import { CALIBRATION_BUCKETS } from "./constants";

export interface ReportRow {
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

const BUCKET_RGB: Record<string, [number, number, number]> = {
  ORANGE: [242, 169, 96],
  TAN: [206, 179, 134],
  PURPLE: [149, 108, 200],
  BLUE: [110, 145, 214],
  PINK: [232, 160, 188],
  BROWN: [140, 98, 62],
  INDIGO: [88, 74, 168],
  GOLD: [232, 197, 84],
};

export async function buildBoardPdf(rows: ReportRow[]) {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const now = new Date();

  doc.setFillColor(31, 41, 71);
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), 56, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(15);
  doc.text("TENNIS MATRIX — MASTER AUDIT REPORT", 32, 26);
  doc.setFontSize(9);
  doc.text(`Report generated ${now.toLocaleString()}`, 32, 42);

  doc.setTextColor(40, 40, 40);
  doc.setFontSize(9);
  const counts = ["DOUBLE GREEN", "GREEN", "YELLOW", "RED / PASS", "INCOMPLETE"]
    .map((c) => `${c}: ${rows.filter((r) => r.color === c).length}`)
    .join("    ");
  doc.text(counts, 32, 76);
  doc.text(
    `Matches on report: ${rows.length}    Complete: ${rows.filter((r) => r.completion === 100).length}    Unresolved: ${rows.filter((r) => r.completion < 100).length}`,
    32,
    90,
  );

  autoTable(doc, {
    startY: 104,
    head: [["Bucket", "Range", "Baseline record"]],
    body: CALIBRATION_BUCKETS.map((b) => [b.code, `${b.min}–${b.max}%`, `${b.wins}/${b.graded}`]),
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: { fillColor: [31, 41, 71] },
    tableWidth: 240,
  });

  autoTable(doc, {
    startY: 104,
    margin: { left: 300 },
    head: [
      ["#", "Selection", "Match", "Tournament", "Surf", "Matrix", "WP", "Bucket", "VWR", "Ind.", "Ind. range", "Calib.", "Ev", "Color", "Action", "%"],
    ],
    body: rows.map((r, i) => [
      i + 1,
      r.selection,
      r.matchLabel,
      r.tournament,
      r.surface,
      r.matrixPick,
      r.matrixWp,
      r.bucket ?? "—",
      r.verifiedWinRate != null ? `${r.verifiedWinRate}%` : "—",
      r.independentWinner,
      r.independentRange,
      r.calibratedRange,
      r.evidence,
      r.color,
      r.action,
      `${r.completion}%`,
    ]),
    styles: { fontSize: 6.5, cellPadding: 2 },
    headStyles: { fillColor: [31, 41, 71] },
    didParseCell: (data) => {
      if (data.section !== "body") return;
      const row = rows[data.row.index];
      if (!row?.bucket) return;
      const rgb = BUCKET_RGB[row.bucket];
      if (rgb && data.column.index <= 12) data.cell.styles.fillColor = rgb;
    },
  });

  doc.save(`tennis-master-audit-${now.toISOString().slice(0, 10)}.pdf`);
}
