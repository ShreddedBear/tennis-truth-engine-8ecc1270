import assert from "node:assert/strict";
import { test } from "node:test";
import { mock } from "node:test";
import { TheOddsApiProvider } from "./theOddsApiProvider";
import { OddsApiIoProvider } from "./oddsApiIoProvider";
import { fetchMarketOddsWithStatus, _resetOddsProvidersForTest } from "./index";

// Task #146 (corrected): four-state `fetchMarketOddsWithStatus` coverage. Each test controls the
// two provider singletons entirely through env vars (matching the module's own lazy-init pattern)
// plus a prototype-level mock of getMatchOdds, then resets both via _resetOddsProvidersForTest so
// no state leaks between tests.

const ORIGINAL_THE_ODDS_KEY = process.env.THE_ODDS_API_KEY;
const ORIGINAL_ODDS_API_IO_KEY = process.env.ODDS_API_IO_KEY;

function restoreEnv() {
  if (ORIGINAL_THE_ODDS_KEY === undefined) delete process.env.THE_ODDS_API_KEY;
  else process.env.THE_ODDS_API_KEY = ORIGINAL_THE_ODDS_KEY;
  if (ORIGINAL_ODDS_API_IO_KEY === undefined) delete process.env.ODDS_API_IO_KEY;
  else process.env.ODDS_API_IO_KEY = ORIGINAL_ODDS_API_IO_KEY;
  _resetOddsProvidersForTest();
}

test("fetchMarketOddsWithStatus returns provider_not_configured when neither provider has an API key", async () => {
  delete process.env.THE_ODDS_API_KEY;
  delete process.env.ODDS_API_IO_KEY;
  _resetOddsProvidersForTest();

  const primarySpy = mock.method(TheOddsApiProvider.prototype, "getMatchOdds");
  const fallbackSpy = mock.method(OddsApiIoProvider.prototype, "getMatchOdds");
  try {
    const result = await fetchMarketOddsWithStatus("Carlos Alcaraz", "Novak Djokovic", null);
    assert.deepEqual(result, { quote: null, status: "provider_not_configured" });
    // Neither provider was even constructed, so getMatchOdds must never have been called.
    assert.equal(primarySpy.mock.callCount(), 0);
    assert.equal(fallbackSpy.mock.callCount(), 0);
  } finally {
    primarySpy.mock.restore();
    fallbackSpy.mock.restore();
    restoreEnv();
  }
});

test("fetchMarketOddsWithStatus returns no_market_available when a configured provider is queried and has no odds", async () => {
  process.env.THE_ODDS_API_KEY = "test-key";
  delete process.env.ODDS_API_IO_KEY;
  _resetOddsProvidersForTest();

  const primarySpy = mock.method(TheOddsApiProvider.prototype, "getMatchOdds", async () => null);
  try {
    const result = await fetchMarketOddsWithStatus("Carlos Alcaraz", "Novak Djokovic", null);
    assert.deepEqual(result, { quote: null, status: "no_market_available" });
    assert.equal(primarySpy.mock.callCount(), 1);
  } finally {
    primarySpy.mock.restore();
    restoreEnv();
  }
});

test("fetchMarketOddsWithStatus returns provider_error when a configured provider throws", async () => {
  process.env.THE_ODDS_API_KEY = "test-key";
  delete process.env.ODDS_API_IO_KEY;
  _resetOddsProvidersForTest();

  const primarySpy = mock.method(TheOddsApiProvider.prototype, "getMatchOdds", async () => {
    throw new Error("simulated quota exhaustion");
  });
  try {
    const result = await fetchMarketOddsWithStatus("Carlos Alcaraz", "Novak Djokovic", null);
    assert.deepEqual(result, { quote: null, status: "provider_error" });
    assert.equal(primarySpy.mock.callCount(), 1);
  } finally {
    primarySpy.mock.restore();
    restoreEnv();
  }
});

test("fetchMarketOddsWithStatus returns included when a provider returns a real quote", async () => {
  process.env.THE_ODDS_API_KEY = "test-key";
  delete process.env.ODDS_API_IO_KEY;
  _resetOddsProvidersForTest();

  const quote = {
    provider: "TheOddsAPI",
    player1DecimalOdds: 1.85,
    player2DecimalOdds: 2.05,
    fetchedAt: new Date().toISOString(),
  };
  const primarySpy = mock.method(TheOddsApiProvider.prototype, "getMatchOdds", async () => quote);
  try {
    const result = await fetchMarketOddsWithStatus("Carlos Alcaraz", "Novak Djokovic", null);
    assert.deepEqual(result, { quote, status: "included" });
  } finally {
    primarySpy.mock.restore();
    restoreEnv();
  }
});

test("fetchMarketOddsWithStatus prefers provider_error over no_market_available when one provider errors and another has no odds", async () => {
  process.env.THE_ODDS_API_KEY = "test-key";
  process.env.ODDS_API_IO_KEY = "test-key-2";
  _resetOddsProvidersForTest();

  const primarySpy = mock.method(TheOddsApiProvider.prototype, "getMatchOdds", async () => {
    throw new Error("simulated network error");
  });
  const fallbackSpy = mock.method(OddsApiIoProvider.prototype, "getMatchOdds", async () => null);
  try {
    const result = await fetchMarketOddsWithStatus("Carlos Alcaraz", "Novak Djokovic", null);
    assert.deepEqual(result, { quote: null, status: "provider_error" });
    assert.equal(primarySpy.mock.callCount(), 1);
    assert.equal(fallbackSpy.mock.callCount(), 1);
  } finally {
    primarySpy.mock.restore();
    fallbackSpy.mock.restore();
    restoreEnv();
  }
});
