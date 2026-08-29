import { describe, expect, it } from "vitest";
import { currentAuditRows, latestRunsByMatch } from "./current-audit-state";

describe("current audit state", () => {
  const runs = [
    { id: "old-a", match_id: "a", run_number: 1, status: "COMPLETE" },
    { id: "new-a", match_id: "a", run_number: 3, status: "RUNNING" },
    { id: "mid-a", match_id: "a", run_number: 2, status: "COMPLETE" },
    { id: "only-b", match_id: "b", run_number: 1, status: "COMPLETE" },
  ];

  it("selects the maximum run number independently for each match", () => {
    const latest = latestRunsByMatch(runs);
    expect(latest.get("a")?.id).toBe("new-a");
    expect(latest.get("b")?.id).toBe("only-b");
  });

  it("never lets a historical decision count as the current match decision", () => {
    const rows = currentAuditRows(
      [{ id: "a" }, { id: "b" }, { id: "c" }],
      runs,
      [
        { audit_run_id: "old-a", audit_complete: true, final_audit_color: "GREEN" },
        { audit_run_id: "only-b", audit_complete: true, final_audit_color: "YELLOW" },
      ],
    );
    expect(rows.find((row) => row.match.id === "a")?.decision).toBeNull();
    expect(rows.find((row) => row.match.id === "b")?.decision?.final_audit_color).toBe("YELLOW");
    expect(rows.filter((row) => row.decision?.audit_complete)).toHaveLength(1);
  });
});