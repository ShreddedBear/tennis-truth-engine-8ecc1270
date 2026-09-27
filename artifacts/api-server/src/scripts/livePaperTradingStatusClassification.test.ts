import test from "node:test";
import assert from "node:assert/strict";
import {
  classifyBuilderPairs,
  classifyPredictionEngineFixtures,
  type BuilderTrade,
  type PEFixture,
} from "./livePaperTradingStatusClassification.js";

const NOW = new Date("2026-07-17T12:00:00.000Z");
const TODAY = new Date("2026-07-17T09:00:00.000Z");

function peFixture(overrides: Partial<PEFixture> = {}): PEFixture {
  return {
    provider: "live-tennis-api",
    externalFixtureId: "12001",
    runKind: "paper_trade",
    dataSegment: "live",
    status: "pending",
    lockedAt: TODAY,
    scheduledStartAt: new Date("2026-07-17T15:00:00.000Z"),
    predictedWinnerId: "p1",
    gradedAt: null,
    actualWinnerId: null,
    ...overrides,
  };
}

function builderTrade(overrides: Partial<BuilderTrade> = {}): BuilderTrade {
  return {
    pairId: "pair-1",
    externalFixtureId: "22001",
    fixtureProvider: "live-tennis-api",
    status: "FROZEN",
    scheduledStartAt: new Date("2026-07-17T15:00:00.000Z"),
    frozenAt: TODAY,
    matchStartedAt: null,
    decisionAt: TODAY,
    gradedAt: null,
    gradedCorrect: null,
    actualWinnerId: null,
    createdAt: TODAY,
    ...overrides,
  };
}

test("Prediction Engine counts only live numeric fixtures and reports UTC-today cohort separately", () => {
  const result = classifyPredictionEngineFixtures([
    peFixture({ externalFixtureId: "12001", status: "graded", actualWinnerId: "p1", gradedAt: NOW }),
    peFixture({ externalFixtureId: "12002", status: "missed", predictedWinnerId: null, scheduledStartAt: new Date("2026-07-17T10:00:00Z") }),
    peFixture({ externalFixtureId: "12003", status: "pending", scheduledStartAt: new Date("2026-07-17T10:00:00Z") }),
    peFixture({ externalFixtureId: "not-numeric" }),
    peFixture({ externalFixtureId: "12004", runKind: "paper_trade_shadow" }),
    peFixture({ externalFixtureId: "12005", provider: "manual-import" }),
    peFixture({ externalFixtureId: "12006", dataSegment: "test" }),
  ], NOW);

  assert.equal(result.fixtureCount, 3);
  assert.equal(result.todayFixtureCount, 3);
  assert.equal(result.prestartLocks, 2);
  assert.equal(result.counts.gradedCorrect, 1);
  assert.equal(result.counts.missed, 1);
  assert.equal(result.counts.started, 1);
  assert.equal(result.todayCounts.gradedCorrect, 1);
});

test("Builder counts overdue frozen pairs explicitly and classifies STARTED once as pending result", () => {
  const result = classifyBuilderPairs([
    builderTrade({ pairId: "overdue", externalFixtureId: "22001", scheduledStartAt: new Date("2026-07-16T15:00:00Z") }),
    builderTrade({ pairId: "overdue", externalFixtureId: "22001", scheduledStartAt: new Date("2026-07-16T15:00:00Z"), createdAt: TODAY }),
    builderTrade({ pairId: "started", externalFixtureId: "22002", status: "STARTED", matchStartedAt: NOW }),
    builderTrade({ pairId: "started", externalFixtureId: "22002", status: "STARTED", matchStartedAt: NOW }),
    builderTrade({ pairId: "prestart", externalFixtureId: "22003" }),
    builderTrade({ pairId: "old-cohort", externalFixtureId: "22004", createdAt: new Date("2026-07-16T22:00:00Z") }),
  ], NOW);

  assert.equal(result.pairCount, 4);
  assert.equal(result.todayPairCount, 3);
  assert.equal(result.counts.overdueFrozen, 1);
  assert.equal(result.counts.frozenPrestart, 2);
  assert.equal(result.counts.pendingResult, 1);
  assert.equal(result.counts.other, 0);
  assert.equal(result.todayCounts.overdueFrozen, 1);
  assert.equal(result.todayCounts.pendingResult, 1);
});

test("Builder excludes synthetic, research, manual, and nonnumeric fixtures", () => {
  const result = classifyBuilderPairs([
    builderTrade({ pairId: "manual", fixtureProvider: "manual" }),
    builderTrade({ pairId: "research", fixtureProvider: "research-provider" }),
    builderTrade({ pairId: "synthetic", fixtureProvider: "synthetic-feed" }),
    builderTrade({ pairId: "not-numeric", externalFixtureId: "sample-1" }),
  ], NOW);
  assert.equal(result.pairCount, 0);
  assert.equal(result.todayPairCount, 0);
});

test("Builder recognizes stale FROZEN status as overdue even when frozenAt is absent", () => {
  const result = classifyBuilderPairs([
    builderTrade({
      status: "FROZEN",
      frozenAt: null,
      scheduledStartAt: new Date("2026-07-16T15:00:00Z"),
    }),
  ], NOW);
  assert.equal(result.counts.overdueFrozen, 1);
  assert.equal(result.counts.other, 0);
});