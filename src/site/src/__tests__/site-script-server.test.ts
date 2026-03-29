import { beforeEach, describe, expect, it, vi } from "vitest";

const st = vi.hoisted(() => ({
  use: vi.fn(),
  get: vi.fn(),
  listen: vi.fn(),
  staticFn: vi.fn(() => "static-mw"),
  jsonFn: vi.fn(() => "json-mw"),
  rateLimitFn: vi.fn(() => "rate-mw"),
  axios: vi.fn(),
  log: vi.fn(),
  err: vi.fn(),
}));

vi.mock("express", () => {
  const app = {
    use: st.use,
    get: st.get,
    listen: st.listen,
  };
  const expressFn = vi.fn(() => app);
  (expressFn as any).static = st.staticFn;
  (expressFn as any).json = st.jsonFn;
  return { default: expressFn };
});

vi.mock("express-rate-limit", () => ({ default: st.rateLimitFn }));
vi.mock("compression", () => ({ default: vi.fn(() => "compression-mw") }));
vi.mock("dotenv", () => ({ default: { config: vi.fn() } }));
vi.mock("axios", () => ({ default: st.axios }));
vi.mock("express-winston", () => ({ default: { logger: vi.fn(() => "winston-mw") } }));
vi.mock("winston", () => ({
  default: {
    transports: { Console: vi.fn() },
    format: {
      combine: vi.fn(() => "combine"),
      colorize: vi.fn(() => "colorize"),
      simple: vi.fn(() => "simple"),
    },
  },
}));

describe("site scripts server", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(st.log as any);
    vi.spyOn(console, "error").mockImplementation(st.err as any);
    st.listen.mockImplementation((_port: number, cb: () => void) => {
      cb();
      return undefined;
    });
  });

  it("boots and registers middleware/routes", async () => {
    await import("../../../site/scripts/server.ts");

    expect(st.use).toHaveBeenCalled();
    expect(st.get).toHaveBeenCalledWith("*", expect.anything(), expect.any(Function));
    expect(st.listen).toHaveBeenCalled();
  });
});