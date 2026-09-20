/**
 * Tests for experimentProvenance.ts against synthetic, test-only fixtures — never real rows.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { buildProvenance, hashDataset, computeDateRange, readCurrentCommit } from "./experimentProvenance.js";

test("readCurrentCommit: returns a 40-char git SHA for this worktree", () => {
  const sha = readCurrentCommit();
  assert.match(sha, /^[0-9a-f]{40}$/);
});

test("hashDataset: identical rows (different key order) hash the same", () => {
  const a = [{ x: 1, y: 2 }];
  const b = [{ y: 2, x: 1 }];
  assert.equal(hashDataset(a), hashDataset(b));
});

test("hashDataset: different rows hash differently", () => {
  const a = [{ x: 1 }];
  const b = [{ x: 2 }];
  assert.notEqual(hashDataset(a), hashDataset(b));
});

test("computeDateRange: min/max across a date field, ignoring nulls", () => {
  const rows = [{ d: "2026-01-01T00:00:00Z" }, { d: null }, { d: "2026-03-01T00:00:00Z" }, { d: "2025-12-01T00:00:00Z" }];
  const range = computeDateRange(rows, (r) => r.d);
  assert.equal(range.min, "2025-12-01T00:00:00.000Z");
  assert.equal(range.max, "2026-03-01T00:00:00.000Z");
});

test("computeDateRange: empty rows -> both null", () => {
  const range = computeDateRange([] as { d: string | null }[], (r) => r.d);
  assert.equal(range.min, null);
  assert.equal(range.max, null);
});

test("buildProvenance: correctly reflects a synthetic fixture's excluded rows and reasons", () => {
  // Synthetic, test-only fixture: 5 rows, 2 admitted, 3 excluded for two different reasons.
  const rows = [
    { id: 1, cutoff: "2026-01-01T00:00:00Z" },
    { id: 2, cutoff: "2026-01-02T00:00:00Z" },
    { id: 3, cutoff: "2026-01-03T00:00:00Z" },
    { id: 4, cutoff: "2026-01-04T00:00:00Z" },
    { id: 5, cutoff: "2026-01-05T00:00:00Z" },
  ];
  const provenance = buildProvenance({
    experimentId: "unit-test-experiment@v1",
    formulaVersion: "n/a (unit test)",
    datasetIdentifier: "synthetic fixture in experimentProvenance.test.ts",
    rows,
    getDate: (r) => r.cutoff,
    predictionCutoffRule: "test cutoff rule",
    nEligible: 2,
    exclusionReasons: {
      "missing required field: foo": 2,
      "temporally inadmissible": 1,
    },
    temporalValidationMethod: "unit test — no real leakage check performed",
  });
  assert.equal(provenance.nTotal, 5);
  assert.equal(provenance.nEligible, 2);
  assert.equal(provenance.nExcluded, 3);
  assert.deepEqual(provenance.exclusionReasons, {
    "missing required field: foo": 2,
    "temporally inadmissible": 1,
  });
  assert.equal(provenance.dateRange.min, "2026-01-01T00:00:00.000Z");
  assert.equal(provenance.dateRange.max, "2026-01-05T00:00:00.000Z");
  assert.match(provenance.codeCommit, /^[0-9a-f]{40}$/);
  assert.equal(provenance.experimentId, "unit-test-experiment@v1");
});

test("buildProvenance: BLOCKED run with zero rows still emits a full record, not skipped", () => {
  const provenance = buildProvenance({
    experimentId: "blocked-experiment@v1",
    formulaVersion: "n/a",
    datasetIdentifier: "synthetic empty fixture",
    rows: [] as { cutoff: string }[],
    getDate: (r) => r.cutoff,
    predictionCutoffRule: "n/a — no rows loaded",
    nEligible: 0,
    exclusionReasons: {},
    temporalValidationMethod: "n/a — no rows loaded",
  });
  assert.equal(provenance.nTotal, 0);
  assert.equal(provenance.nEligible, 0);
  assert.equal(provenance.nExcluded, 0);
  assert.deepEqual(provenance.exclusionReasons, {});
  assert.equal(provenance.dateRange.min, null);
});

test("buildProvenance: throws when exclusionReasons doesn't reconcile with nTotal/nEligible", () => {
  assert.throws(
    () =>
      buildProvenance({
        experimentId: "bad-bookkeeping@v1",
        formulaVersion: "n/a",
        datasetIdentifier: "synthetic",
        rows: [{ cutoff: "2026-01-01T00:00:00Z" }, { cutoff: "2026-01-02T00:00:00Z" }],
        getDate: (r) => r.cutoff,
        predictionCutoffRule: "n/a",
        nEligible: 1,
        exclusionReasons: { "some reason": 5 }, // doesn't match nExcluded=1
        temporalValidationMethod: "n/a",
      }),
    /exclusionReasons sums to/,
  );
});
