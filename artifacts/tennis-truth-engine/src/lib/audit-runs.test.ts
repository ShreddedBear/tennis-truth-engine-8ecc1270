import { describe, expect, it } from "vitest";
import { metricResultSeedRows } from "./audit-runs";
import {
  META_OR_NON_PLAYER_CODES,
  PROTECTED_UNAVAILABLE_CODES,
  MATRIX_SUMMARY_REQUIRED_CODES,
  metricUniverseAccounting,
  playerEvidenceDenominatorCodes,
} from "./metric-classification";

describe("metricResultSeedRows", () => {
  const rules = Array.from({ length: 81 }, (_, index) => ({
    rule_code: String(index + 1).padStart(3, "0"),
    rule_name: `Metric ${index + 1}`,
  }));
  const rows = metricResultSeedRows("run-1", rules);

  it("preserves the canonical denominator policy in the alternate client seed path, with quarantined codes settled not researched", () => {
    // The 7 META / 14 PROTECTED policy is unchanged; what is new is that
    // MATRIX_SUMMARY_REQUIRED codes also seed settled (NO_SOURCE) instead of
    // "NOT STARTED", so this client path can never hand a quarantined code to a
    // researcher. See matrix-summary-quarantine.test.ts for the full contract.
    const accounting = metricUniverseAccounting();
    expect(playerEvidenceDenominatorCodes()).toHaveLength(accounting.legitimate_player_metric_count);
    expect(rows.filter((row) => row.status === "EXCLUDED")).toHaveLength(META_OR_NON_PLAYER_CODES.size);
    expect(rows.filter((row) => row.status === "NO_SOURCE")).toHaveLength(
      PROTECTED_UNAVAILABLE_CODES.size + MATRIX_SUMMARY_REQUIRED_CODES.size,
    );
    expect(rows.filter((row) => row.status === "NOT STARTED")).toHaveLength(accounting.legitimate_player_metric_count);
  });

  it("gives a Matrix-Summary-quarantined code its own distinct reason, never the permanent no-pathway one", () => {
    const row = rows.find((candidate) => MATRIX_SUMMARY_REQUIRED_CODES.has(candidate.metric_code));
    expect(row).toMatchObject({
      status: "NO_SOURCE",
      p1_status: "NO_SOURCE",
      p2_status: "NO_SOURCE",
      p1_treatment: "UNAVAILABLE",
      p2_treatment: "UNAVAILABLE",
      unavailable_reason: "MATRIX_SUMMARY_EVIDENCE_REQUIRED",
    });
  });

  it("stores protected-unavailable treatment schema-safely without making it usable", () => {
    const row = rows.find((candidate) => PROTECTED_UNAVAILABLE_CODES.has(candidate.metric_code));
    expect(row).toMatchObject({
      status: "NO_SOURCE",
      p1_status: "NO_SOURCE",
      p2_status: "NO_SOURCE",
      p1_treatment: "UNAVAILABLE",
      p2_treatment: "UNAVAILABLE",
      unavailable_reason: "NO_SOURCE_NO_LEGITIMATE_PATHWAY",
    });
  });
});