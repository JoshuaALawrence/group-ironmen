import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { storage } from "../data/storage";

describe("storage", () => {
  beforeEach(() => {
    const backingStore = new Map<string, string>();

    vi.stubGlobal("localStorage", {
      getItem(key: string) {
        return backingStore.has(key) ? backingStore.get(key) : null;
      },
      setItem(key: string, value: string) {
        backingStore.set(key, String(value));
      },
      removeItem(key: string) {
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
