import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { _resetOddsProvidersForTest, getOddsProviderStatuses } from "./index.js";

const names = ["THE_ODDS_API_KEY", "The_Odds_Api", "The_Open_Api", "ODDS_API_IO_KEY"] as const;
const original = new Map<string, string | undefined>();

function clearOddsEnv(): void {
  for (const name of names) {
    if (!original.has(name)) original.set(name, process.env[name]);
    delete process.env[name];
  }
  _resetOddsProvidersForTest();
}

afterEach(() => {
  for (const name of names) {
    const value = original.get(name);
    if (value == null) delete process.env[name];
    else process.env[name] = value;
  }
  original.clear();
  _resetOddsProvidersForTest();
});

test("The Odds API compatibility aliases route to the existing provider without a network call", () => {
  for (const alias of ["The_Odds_Api", "The_Open_Api"] as const) {
    clearOddsEnv();
    process.env[alias] = "test-key";
    assert.deepEqual(getOddsProviderStatuses().map((status) => status.provider), ["The Odds API"]);
  }
});

test("canonical The Odds API key takes precedence over compatibility aliases", () => {
  clearOddsEnv();
  process.env.THE_ODDS_API_KEY = "canonical-test-key";
  process.env.The_Odds_Api = "compatibility-test-key";
  process.env.The_Open_Api = "older-compatibility-test-key";
  assert.deepEqual(getOddsProviderStatuses().map((status) => status.provider), ["The Odds API"]);
});

test("no odds provider is configured without keys, while Odds-API.io uses its canonical key", () => {
  clearOddsEnv();
  assert.deepEqual(getOddsProviderStatuses(), []);

  process.env.ODDS_API_IO_KEY = "odds-io-test-key";
  _resetOddsProvidersForTest();
  assert.deepEqual(getOddsProviderStatuses().map((status) => status.provider), ["Odds-API.io"]);
});