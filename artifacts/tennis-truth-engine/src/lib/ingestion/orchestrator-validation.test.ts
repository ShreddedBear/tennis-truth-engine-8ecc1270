import { describe, expect, it } from "vitest";
import { assertMeaningfulIngestion } from "./orchestrator.server";

describe("historical ingestion result validation", () => {
  it("rejects a target-backed source with no enabled targets", () => {
    expect(() => assertMeaningfulIngestion("open_meteo", { targets: 0, observations_written: 0 }))
      .toThrow(/No enabled ingestion target/);
  });

  it("rejects a target-backed source that produced zero observations", () => {
    expect(() => assertMeaningfulIngestion("wta_rankings", { targets: 1, observations_written: 0 }))
      .toThrow(/without producing any source observations/);
  });

  it("rejects odds ingestion that made zero requests", () => {
    expect(() => assertMeaningfulIngestion("odds_api", { requests: 0, observations_written: 0 }))
      .toThrow(/without making any historical API requests/);
  });

  it("accepts a meaningful target-backed ingestion", () => {
    expect(() => assertMeaningfulIngestion("atp", { targets: 1, observations_written: 12 })).not.toThrow();
  });

  it("accepts a meaningful Odds API ingestion", () => {
    expect(() => assertMeaningfulIngestion("odds_api", { requests: 2, observations_written: 8 })).not.toThrow();
  });
});
