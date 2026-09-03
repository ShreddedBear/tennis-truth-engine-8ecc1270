import { describe, expect, it } from "vitest";
import { removableOperationalMatchIds } from "./reset-slate.functions";

describe("operational slate snapshot retention", () => {
  it("never selects matches with completed audit snapshots for normal slate deletion", () => {
    expect(removableOperationalMatchIds(
      ["complete-match", "running-match", "empty-match"],
      ["complete-match"],
    )).toEqual(["running-match", "empty-match"]);
  });
});