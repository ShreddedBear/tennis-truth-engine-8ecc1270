import { describe, expect, it } from "vitest";
import { metricResultSeedRows } from "./audit-runs";
import {
  META_OR_NON_PLAYER_CODES,
  PROTECTED_UNAVAILABLE_CODES,
  playerEvidenceDenominatorCodes,
} from "./metric-classification";

describe("metricResultSeedRows", () => {
  const rules = Array.from({ length: 81 }, (_, index) => ({
    rule_code: String(index + 1).padStart(3, "0"),
    rule_name: `Metric ${index + 1}`,
  }));
  const rows = metricResultSeedRows("run-1", rules);

  it("preserves the canonical 60/7/14 denominator policy in the alternate client seed path", () => {
    expect(playerEvidenceDenominatorCodes()).toHaveLength(60);
    expect(rows.filter((row) => row.status === "EXCLUDED")).toHaveLength(META_OR_NON_PLAYER_CODES.size);
    expect(rows.filter((row) => row.status === "NO_SOURCE")).toHaveLength(PROTECTED_UNAVAILABLE_CODES.size);
    expect(rows.filter((row) => row.status === "NOT STARTED")).toHaveLength(60);
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