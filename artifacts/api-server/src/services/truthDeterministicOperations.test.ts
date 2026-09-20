import assert from "node:assert/strict";
import test from "node:test";
import {
  DETERMINISTIC_OPERATION_MAP,
  executeDeterministicOperation,
} from "./truthDeterministicOperations";

test("allowlisted deterministic operations map to fixed table/action pairs", () => {
  assert.deepEqual(DETERMINISTIC_OPERATION_MAP.get("deterministic-select-source_observations"), {
    table: "source_observations",
    action: "select",
  });
  assert.deepEqual(DETERMINISTIC_OPERATION_MAP.get("deterministic-upsert-metric_evidence_store"), {
    table: "metric_evidence_store",
    action: "upsert",
  });
});

test("unknown operation, table, and action are rejected before database access", async () => {
  await assert.rejects(
    executeDeterministicOperation("deterministic-select-arbitrary_table", {}, "00000000-0000-0000-0000-000000000001"),
    /Unknown deterministic operation/,
  );
  await assert.rejects(
    executeDeterministicOperation("deterministic-query-matches", {}, "00000000-0000-0000-0000-000000000001"),
    /Unknown deterministic operation/,
  );
  await assert.rejects(
    executeDeterministicOperation("deterministic-select-source_observations", {
      columns: "secret_column",
    }, "00000000-0000-0000-0000-000000000001"),
    /Unsupported source_observations column/,
  );
});