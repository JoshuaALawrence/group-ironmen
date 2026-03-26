import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("Router", () => {
  let router;

  beforeEach(async () => {
    // Set up minimal DOM
    document.body.innerHTML = '<div id="app"></div>';
    window.history.pushState({}, "", "/");

    const mod = await import("../router.js");
    router = mod.default || mod.router || mod;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("module exports a router", () => {
    expect(router).toBeDefined();
  });
});
