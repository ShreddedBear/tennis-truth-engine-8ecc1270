import { describe, expect, it } from "vitest";
import type { MetricFinding } from "./audit-pipeline";
import { localMetricRows, mergeMetrics } from "./hybrid-audit-research.server";

const unavailable = (metric_code: string): MetricFinding => ({
  metric_code,
  p1_value: null,
  p2_value: null,
  p1_treatment: "UNAVAILABLE",
  p2_treatment: "UNAVAILABLE",
  differential: null,
  evidence_family: null,
  reliability: null,
  sample: null,
  unavailable_reason: null,
  p1_unavailable_reason: null,
  p2_unavailable_reason: null,
  sources: [],
});

describe("hybrid evidence absence reasons", () => {
  it("records side-specific historical absence instead of an unexplained producer failure", () => {
    const [row] = localMetricRows(
      "Definitely Unknown Player Alpha",
      "Definitely Unknown Player Beta",
      "date 2026-09-01 · surface hard",
      [{ code: "055", name: "Trajectory", body: null }],
    );

    expect(row.p1_value).toBeNull();
    expect(row.p2_value).toBeNull();
    expect(row.p1_unavailable_reason).toContain("historical data does not support");
    expect(row.p2_unavailable_reason).toContain("historical data does not support");
  });

  it("does not let null live reasons erase source-proven local absence", () => {
    const local = {
      ...unavailable("055"),
      p1_unavailable_reason: "Synced public historical data does not support this metric for this player",
      p2_unavailable_reason: "Synced public historical data does not support this metric for this player",
    };

    const [merged] = mergeMetrics([unavailable("055")], [local]);
    expect(merged.p1_unavailable_reason).toBe(local.p1_unavailable_reason);
    expect(merged.p2_unavailable_reason).toBe(local.p2_unavailable_reason);
    expect(merged.p1_value).toBeNull();
    expect(merged.p2_value).toBeNull();
  });
});