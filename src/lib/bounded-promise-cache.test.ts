import { describe, expect, it, vi } from "vitest";
import { BoundedPromiseCache } from "./bounded-promise-cache";

describe("BoundedPromiseCache", () => {
  it("shares only exact keys and expires entries", async () => {
    let now = 0;
    const cache = new BoundedPromiseCache<number>(4, 100, () => now);
    const factory = vi.fn(async () => factory.mock.calls.length);

    expect(await Promise.all([cache.getOrCreate("pair-a", factory), cache.getOrCreate("pair-a", factory)])).toEqual([1, 1]);
    expect(await cache.getOrCreate("pair-b", factory)).toBe(2);
    now = 101;
    expect(await cache.getOrCreate("pair-a", factory)).toBe(3);
  });

  it("evicts oldest entries and never caches failures", async () => {
    const cache = new BoundedPromiseCache<number>(2, 1_000);
    await cache.getOrCreate("a", async () => 1);
    await cache.getOrCreate("b", async () => 2);
    await cache.getOrCreate("c", async () => 3);
    expect(cache.size).toBe(2);

    let attempts = 0;
    await expect(cache.getOrCreate("failure", async () => {
      attempts++;
      throw new Error("provider failed");
    })).rejects.toThrow("provider failed");
    await expect(cache.getOrCreate("failure", async () => {
      attempts++;
      throw new Error("provider failed again");
    })).rejects.toThrow("provider failed again");
    expect(attempts).toBe(2);
  });
});