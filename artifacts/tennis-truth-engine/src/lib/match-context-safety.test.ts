import { describe, expect, it } from "vitest";
import { identifiesSameEvent } from "./match-context.functions";

describe("prior-pair metadata safety", () => {
  it("does not treat a player pair or generic tour label as current-match identity", () => {
    expect(identifiesSameEvent("Indian Wells", null)).toBe(false);
    expect(identifiesSameEvent("WTA Indian Wells", "WTA")).toBe(false);
  });

  it("accepts a canonical event name and its specific labeled variant", () => {
    expect(identifiesSameEvent("Cincinnati Open", "WTA Cincinnati Open")).toBe(true);
  });
});