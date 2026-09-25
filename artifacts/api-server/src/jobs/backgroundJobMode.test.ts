import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isExternalSchedulingMode } from "./backgroundJobMode.js";

describe("isExternalSchedulingMode", () => {
  it("defaults to false (in-process scheduling) when unset", () => {
    assert.equal(isExternalSchedulingMode({}), false);
  });

  it("false for any value other than the exact string 'external'", () => {
    assert.equal(isExternalSchedulingMode({ BACKGROUND_JOB_MODE: "true" }), false);
    assert.equal(isExternalSchedulingMode({ BACKGROUND_JOB_MODE: "EXTERNAL" }), false);
    assert.equal(isExternalSchedulingMode({ BACKGROUND_JOB_MODE: "in-process" }), false);
    assert.equal(isExternalSchedulingMode({ BACKGROUND_JOB_MODE: "" }), false);
  });

  it("true only when exactly 'external'", () => {
    assert.equal(isExternalSchedulingMode({ BACKGROUND_JOB_MODE: "external" }), true);
  });
});
