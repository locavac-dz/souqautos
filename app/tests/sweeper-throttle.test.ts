import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  shouldRunSweep,
  markSweepRan,
  throttledSweep,
  resetSweepTimestampsForTests,
  SWEEP_WINDOW_MS,
} from "@/lib/sweeper-throttle";

beforeEach(() => resetSweepTimestampsForTests());
afterEach(() => resetSweepTimestampsForTests());

describe("shouldRunSweep", () => {
  it("returns true for a key that has never run", () => {
    expect(shouldRunSweep("k1")).toBe(true);
  });

  it("returns false immediately after markSweepRan when window > 0", () => {
    if (SWEEP_WINDOW_MS <= 0) return; // skip in test env (window = 0)
    const now = Date.now();
    markSweepRan("k1", now);
    expect(shouldRunSweep("k1", now + 100)).toBe(false);
  });

  it("returns true after the window has elapsed", () => {
    if (SWEEP_WINDOW_MS <= 0) return;
    const now = Date.now();
    markSweepRan("k1", now);
    expect(shouldRunSweep("k1", now + SWEEP_WINDOW_MS)).toBe(true);
  });

  it("in test mode (SWEEP_WINDOW_MS=0) always returns true", () => {
    if (SWEEP_WINDOW_MS > 0) return;
    markSweepRan("k1");
    expect(shouldRunSweep("k1")).toBe(true);
  });
});

describe("throttledSweep", () => {
  it("calls the function on first invocation", async () => {
    const fn = vi.fn().mockResolvedValue(undefined);
    await throttledSweep("k1", fn);
    expect(fn).toHaveBeenCalledOnce();
  });

  it("does not call the function again within the window (window > 0)", async () => {
    if (SWEEP_WINDOW_MS <= 0) return;
    const fn = vi.fn().mockResolvedValue(undefined);
    const now = Date.now();
    await throttledSweep("k1", fn, now);
    await throttledSweep("k1", fn, now + 100);
    expect(fn).toHaveBeenCalledOnce();
  });

  it("does not update the timestamp when the function throws", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("oops"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const now = 1_000_000;
    await throttledSweep("k1", fn, now);
    // should still be runnable since timestamp was not stored on failure
    expect(shouldRunSweep("k1", now + 1)).toBe(true);
    spy.mockRestore();
  });

  it("logs the error but does not propagate it", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("boom"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(throttledSweep("k1", fn)).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("runs the function again after the window in test mode (SWEEP_WINDOW_MS=0)", async () => {
    if (SWEEP_WINDOW_MS > 0) return;
    const fn = vi.fn().mockResolvedValue(undefined);
    await throttledSweep("k1", fn);
    await throttledSweep("k1", fn);
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
