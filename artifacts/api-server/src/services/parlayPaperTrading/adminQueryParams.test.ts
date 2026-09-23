import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parsePagination, parsePairListFilters, isSyntheticTestFixture, MAX_PAGE_SIZE, DEFAULT_PAGE_SIZE } from "./adminQueryParams.js";

describe("parsePagination", () => {
  it("defaults when no params given", () => {
    assert.deepStrictEqual(parsePagination({}), { limit: DEFAULT_PAGE_SIZE, offset: 0 });
  });
  it("clamps limit to MAX_PAGE_SIZE — never unlimited rows", () => {
    assert.deepStrictEqual(parsePagination({ limit: "999999" }), { limit: MAX_PAGE_SIZE, offset: 0 });
  });
  it("clamps limit to at least 1", () => {
    assert.strictEqual(parsePagination({ limit: "0" }).limit, 1);
    assert.strictEqual(parsePagination({ limit: "-5" }).limit, 1);
  });
  it("clamps offset to at least 0", () => {
    assert.strictEqual(parsePagination({ offset: "-10" }).offset, 0);
  });
  it("garbage input falls back to defaults rather than NaN", () => {
    assert.deepStrictEqual(parsePagination({ limit: "not-a-number", offset: "also-garbage" }), { limit: DEFAULT_PAGE_SIZE, offset: 0 });
  });
  it("valid values pass through", () => {
    assert.deepStrictEqual(parsePagination({ limit: "25", offset: "50" }), { limit: 25, offset: 50 });
  });
});

describe("parsePairListFilters", () => {
  it("empty query yields no filters", () => {
    assert.deepStrictEqual(parsePairListFilters({}), {});
  });
  it("parses status filter", () => {
    assert.strictEqual(parsePairListFilters({ status: "FROZEN" }).status, "FROZEN");
  });
  it("parses date range", () => {
    const filters = parsePairListFilters({ dateFrom: "2026-09-01", dateTo: "2026-09-30" });
    assert.strictEqual(filters.dateFrom?.toISOString().slice(0, 10), "2026-09-01");
    assert.strictEqual(filters.dateTo?.toISOString().slice(0, 10), "2026-09-30");
  });
  it("invalid date is silently omitted, not thrown", () => {
    assert.strictEqual(parsePairListFilters({ dateFrom: "not-a-date" }).dateFrom, undefined);
  });
  it("evaluatedSide only accepts PLAYER_1/PLAYER_2, rejects garbage", () => {
    assert.strictEqual(parsePairListFilters({ evaluatedSide: "PLAYER_1" }).evaluatedSide, "PLAYER_1");
    assert.strictEqual(parsePairListFilters({ evaluatedSide: "PLAYER_3" }).evaluatedSide, undefined);
  });
  it("parses crossSideAgreement boolean", () => {
    assert.strictEqual(parsePairListFilters({ crossSideAgreement: "true" }).crossSideAgreement, true);
    assert.strictEqual(parsePairListFilters({ crossSideAgreement: "false" }).crossSideAgreement, false);
    assert.strictEqual(parsePairListFilters({ crossSideAgreement: "maybe" }).crossSideAgreement, undefined);
  });
  it("parses calibrationModelId as an integer", () => {
    assert.strictEqual(parsePairListFilters({ calibrationModelId: "7" }).calibrationModelId, 7);
  });
  it("parses gradingStatus enum, rejects garbage", () => {
    assert.strictEqual(parsePairListFilters({ gradingStatus: "graded" }).gradingStatus, "graded");
    assert.strictEqual(parsePairListFilters({ gradingStatus: "bogus" }).gradingStatus, undefined);
  });
  it("parses tournament/surface/builderVersion/configFingerprint/resultType as plain strings", () => {
    const filters = parsePairListFilters({
      tournamentName: "US Open", surface: "Hard", builderVersion: "1.0.0",
      builderConfigFingerprint: "abc123", resultType: "normal",
    });
    assert.strictEqual(filters.tournamentName, "US Open");
    assert.strictEqual(filters.surface, "Hard");
    assert.strictEqual(filters.builderVersion, "1.0.0");
    assert.strictEqual(filters.builderConfigFingerprint, "abc123");
    assert.strictEqual(filters.resultType, "normal");
  });
});

describe("isSyntheticTestFixture", () => {
  it("flags TEST- prefixed fixture ids", () => {
    assert.strictEqual(isSyntheticTestFixture("TEST-ACCEPTANCE-1790125461522"), true);
    assert.strictEqual(isSyntheticTestFixture("TEST-SEQUENTIAL-1790154765397"), true);
    assert.strictEqual(isSyntheticTestFixture("TEST-CONCURRENT2-1790160123456"), true);
  });
  it("does not flag real-looking fixture ids", () => {
    assert.strictEqual(isSyntheticTestFixture("lta-57736"), false);
    assert.strictEqual(isSyntheticTestFixture("130086"), false);
  });
});
