/**
 * Tests for sharedValidation.ts against synthetic, test-only fixtures.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  requireFields,
  accuracy,
  brierScore,
  logLoss,
  calibrationError,
  auc,
  ExclusionTracker,
  assessMeaningfulness,
} from "./sharedValidation.js";

test("requireFields: throws naming the exact missing field(s), does not throw when all present", () => {
  assert.throws(
    () => requireFields({ a: 1, b: null }, ["a", "b", "c"] as const, "row 3"),
    /row 3: missing required field\(s\) \[b, c\]/,
  );
  assert.doesNotThrow(() => requireFields({ a: 1, b: 2 }, ["a", "b"] as const, "row 1"));
});

test("accuracy: percent correct, null when empty", () => {
  assert.equal(accuracy([{ correct: true }, { correct: true }, { correct: false }, { correct: false }]), 50);
  assert.equal(accuracy([]), null);
});

test("brierScore: 0 for perfect confident-correct predictions, 1 for perfect confident-wrong", () => {
  assert.equal(brierScore([{ prob0to1: 1, correct: true }]), 0);
  assert.equal(brierScore([{ prob0to1: 1, correct: false }]), 1);
});

test("logLoss: lower for confident-correct than for confident-wrong", () => {
  const good = logLoss([{ prob0to1: 0.9, correct: true }])!;
  const bad = logLoss([{ prob0to1: 0.9, correct: false }])!;
  assert.ok(good < bad);
});

test("calibrationError: 0 when stated probability exactly matches observed frequency per bucket", () => {
  // All rows land in the [0.5,0.6) bucket with prob=0.55; exactly 55% correct in that bucket.
  const rows = [
    ...Array.from({ length: 55 }, () => ({ prob0to1: 0.55, correct: true })),
    ...Array.from({ length: 45 }, () => ({ prob0to1: 0.55, correct: false })),
  ];
  const ece = calibrationError(rows, 10)!;
  assert.ok(ece < 0.01, `expected near-zero ECE, got ${ece}`);
});

test("auc: perfect separation -> 1.0; null with a single class", () => {
  const rows = [
    { prob0to1: 0.9, correct: true },
    { prob0to1: 0.8, correct: true },
    { prob0to1: 0.2, correct: false },
    { prob0to1: 0.1, correct: false },
  ];
  assert.equal(auc(rows), 1);
  assert.equal(auc([{ prob0to1: 0.5, correct: true }]), null);
});

test("ExclusionTracker: totals and per-reason breakdown reconcile", () => {
  const tracker = new ExclusionTracker();
  tracker.admit();
  tracker.admit();
  tracker.exclude("missing field X");
  tracker.exclude("missing field X");
  tracker.exclude("temporally inadmissible");
  assert.equal(tracker.nTotal, 5);
  assert.equal(tracker.nEligible, 2);
  assert.deepEqual(tracker.toReasonsRecord(), { "missing field X": 2, "temporally inadmissible": 1 });
});

test("assessMeaningfulness: fails below the sample floor even with 100% admissible fraction", () => {
  const v = assessMeaningfulness(10, 10, 50, 0.5);
  assert.equal(v.meetsSampleFloor, false);
  assert.equal(v.isMeaningful, false);
});

test("assessMeaningfulness: fails below the admissible-fraction floor even with n above the sample floor", () => {
  const v = assessMeaningfulness(60, 1000, 50, 0.5);
  assert.equal(v.meetsSampleFloor, true);
  assert.equal(v.meetsAdmissibleFraction, false);
  assert.equal(v.isMeaningful, false);
});

test("assessMeaningfulness: passes when both floors are cleared", () => {
  const v = assessMeaningfulness(200, 300, 50, 0.5);
  assert.equal(v.isMeaningful, true);
});
