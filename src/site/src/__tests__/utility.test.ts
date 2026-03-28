import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { utility as UtilityInstance } from "../utility";

/**
 * Utility is a singleton class instantiated at module level.
 * We dynamically import it in each test to get a fresh module scope.
 */

describe("Utility", () => {
  let utility: typeof UtilityInstance;

  beforeEach(async () => {
    vi.useFakeTimers();
    const mod = await import("../utility");
    utility = mod.utility;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe("formatShortQuantity", () => {
    it("leaves small values unchanged", () => {
      expect(utility.formatShortQuantity(999)).toBe(999);
    });

    it("formats thousands as K", () => {
      expect(utility.formatShortQuantity(1000)).toBe("1K");
      expect(utility.formatShortQuantity(100000)).toBe("100K");
    });

    it("formats millions as M", () => {
      expect(utility.formatShortQuantity(1000000)).toBe("1M");
      expect(utility.formatShortQuantity(25000000)).toBe("25M");
    });

    it("formats billions as B with 1 decimal", () => {
      expect(utility.formatShortQuantity(1000000000)).toBe("1.0B");
      expect(utility.formatShortQuantity(2500000000)).toBe("2.5B");
      expect(utility.formatShortQuantity(2560000000)).toBe("2.5B");
    });
  });

  describe("formatVeryShortQuantity", () => {
    it("keeps very small values unchanged", () => {
      expect(utility.formatVeryShortQuantity(999)).toBe(999);
    });

    it("formats 4 digit values as K", () => {
      expect(utility.formatVeryShortQuantity(1200)).toBe("1K");
    });

    it("falls back to the standard formatter for large values", () => {
      expect(utility.formatVeryShortQuantity(250000)).toBe("250K");
    });
  });

  describe("removeArticles", () => {
    it("strips leading articles", () => {
      expect(utility.removeArticles("the grumbler")).toBe("grumbler");
      expect(utility.removeArticles("A boss")).toBe("boss");
      expect(utility.removeArticles("an item")).toBe("item");
    });

    it("keeps non-article prefixes intact", () => {
      expect(utility.removeArticles("boss")).toBe("boss");
      expect(utility.removeArticles("phantom muspah")).toBe("phantom muspah");
    });
  });

  describe("setsEqual", () => {
    it("returns true for sets with the same members", () => {
      expect(utility.setsEqual(new Set([1, 2]), new Set([2, 1]))).toBe(true);
    });

    it("returns false for different sets", () => {
      expect(utility.setsEqual(new Set([1, 2]), new Set([1, 3]))).toBe(false);
    });

    it("returns false when either side is missing", () => {
      expect(utility.setsEqual(null, new Set([1]))).toBe(false);
      expect(utility.setsEqual(new Set([1]), undefined)).toBe(false);
    });
  });

  describe("isBitSet", () => {
    it("detects set and unset bits", () => {
      expect(utility.isBitSet(0b1010, 1)).toBe(true);
      expect(utility.isBitSet(0b1010, 0)).toBe(false);
    });
  });

  describe("average", () => {
    it("returns the arithmetic mean", () => {
      expect(utility.average([2, 4, 6])).toBe(4);
    });
  });

  describe("removeTags", () => {
    it("strips html tags", () => {
      expect(utility.removeTags("<p>Hello <strong>world</strong></p>")).toBe("Hello world");
    });

    it("passes through nullish values", () => {
      expect(utility.removeTags(null)).toBeUndefined();
    });
  });

  describe("throttle", () => {
    it("delays the call until the interval elapses", () => {
      const fn = vi.fn();
      const throttled = utility.throttle(fn, 100);

      throttled();
      expect(fn).toHaveBeenCalledTimes(0);

      vi.advanceTimersByTime(100);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("coalesces repeated calls while paused", () => {
      const fn = vi.fn();
      const throttled = utility.throttle(fn, 100);

      throttled();
      throttled();
      throttled();

      expect(fn).toHaveBeenCalledTimes(0);

      vi.advanceTimersByTime(100);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("allows another call after the pause clears", () => {
      const fn = vi.fn();
      const throttled = utility.throttle(fn, 100);

      throttled();
      vi.advanceTimersByTime(150);
      throttled();

      vi.advanceTimersByTime(100);
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });
});
