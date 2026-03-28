import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { router as RouterInstance } from "../router";

describe("Router", () => {
  let router: typeof RouterInstance;

  beforeEach(async () => {
    // Set up minimal DOM
    document.body.innerHTML = '<div id="app"></div>';
    window.history.pushState({}, "", "/");

    const mod = await import("../router");
    router = mod.router;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("module exports a router", () => {
    expect(router).toBeDefined();
  });
});
