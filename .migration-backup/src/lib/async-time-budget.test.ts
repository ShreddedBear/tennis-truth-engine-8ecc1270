import { describe, expect, it, vi } from "vitest";
import { BoundedOperationPool, withTimeBudget } from "./async-time-budget";

describe("withTimeBudget", () => {
  it("returns completed source work", async () => {
    await expect(withTimeBudget("local", 50, Promise.resolve("evidence"))).resolves.toBe("evidence");
  });

  it("returns null and reports a slow source without rejecting the audit", async () => {
    vi.useFakeTimers();
    const onTimeout = vi.fn();
    const result = withTimeBudget("pbp", 50, new Promise<string>(() => {}), onTimeout);
    await vi.advanceTimersByTimeAsync(50);
    await expect(result).resolves.toBeNull();
    expect(onTimeout).toHaveBeenCalledWith("pbp", 50);
    vi.useRealTimers();
  });

  it("retains a slot until timed-out background work actually settles", async () => {
    vi.useFakeTimers();
    const pool = new BoundedOperationPool(1);
    let finishFirst!: () => void;
    const firstWork = new Promise<void>(resolve => { finishFirst = resolve; });
    const first = pool.runWithBudget("first", 10, () => firstWork.then(() => "done"), () => "fallback");
    await vi.advanceTimersByTimeAsync(10);
    await expect(first).resolves.toBe("fallback");
    expect(pool.activeCount).toBe(1);

    let secondStarted = false;
    const second = pool.runWithBudget("second", 10, async () => { secondStarted = true; return "second"; }, () => "fallback");
    await Promise.resolve();
    expect(secondStarted).toBe(false);
    finishFirst();
    await Promise.resolve();
    await expect(second).resolves.toBe("second");
    vi.useRealTimers();
  });
});