import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { storage } from "../data/storage.js";

describe("storage", () => {
  beforeEach(() => {
    const backingStore = new Map();

    vi.stubGlobal("localStorage", {
      getItem(key) {
        return backingStore.has(key) ? backingStore.get(key) : null;
      },
      setItem(key, value) {
        backingStore.set(key, String(value));
      },
      removeItem(key) {
        backingStore.delete(key);
      },
      clear() {
        backingStore.clear();
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns null for malformed stored data", () => {
    localStorage.setItem("groupName", "");
    localStorage.setItem("groupToken", "token");

    expect(storage.getGroup()).toBe(null);
  });

  it("round-trips valid stored data", () => {
    storage.storeGroup("@EXAMPLE", "token123");

    expect(storage.getGroup()).toEqual({ groupName: "@EXAMPLE", groupToken: "token123" });
  });
});
