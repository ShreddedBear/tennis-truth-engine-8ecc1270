import { describe, expect, it } from "vitest";
import { ingestionSourceId } from "../truth-server-api";

describe("live ingestion source contract", () => {
  it("keeps source ids as TEXT values used by heliumdb", () => {
    expect(ingestionSourceId("open_meteo")).toBe("open_meteo");
    expect(ingestionSourceId("wta")).toBe("wta");
    expect(typeof ingestionSourceId("wta")).toBe("string");
  });

  it("rejects an empty source id instead of coercing it to a UUID", () => {
    expect(() => ingestionSourceId("  ")).toThrow(/text value/);
  });
});