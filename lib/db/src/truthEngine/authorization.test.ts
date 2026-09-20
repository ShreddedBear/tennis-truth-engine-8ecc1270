import assert from "node:assert/strict";
import test from "node:test";
import { assertOperationalSlateAuthorization } from "./authorization";

test("operational slate requires explicit authorization", () => {
  assert.throws(
    () => assertOperationalSlateAuthorization({ isAuthorized: false }),
    /explicit administrative authorization/,
  );
  assert.doesNotThrow(() => assertOperationalSlateAuthorization({ isAuthorized: true }));
});