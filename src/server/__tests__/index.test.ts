import { beforeEach, describe, expect, it, vi } from "vitest";

const appState = vi.hoisted(() => ({
  use: vi.fn(),
  get: vi.fn(),
  listen: vi.fn(),
  options: vi.fn(),
  locals: {},
  staticFn: vi.fn(() => "static-mw"),
  jsonFn: vi.fn(() => "json-mw"),
  rateLimitFn: vi.fn(() => "rate-mw"),
  updateSchema: vi.fn(),
  startGeUpdater: vi.fn(),
  startSkillsAggregator: vi.fn(),
  startEventScheduler: vi.fn(),
  startOsrsNewsRefresher: vi.fn(),
  startOsrsYtRefresher: vi.fn(),
  startTwitchRefresher: vi.fn(),
  loggerInfo: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock("express", () => {
  const app = {
    use: appState.use,
    get: appState.get,
    listen: appState.listen,
    options: appState.options,
    locals: appState.locals,
  };
  const expressFn = vi.fn(() => app);
  (expressFn as any).static = appState.staticFn;
  (expressFn as any).json = appState.jsonFn;
  return { default: expressFn };
});

vi.mock("compression", () => ({ default: vi.fn(() => "compression-mw") }));
vi.mock("express-rate-limit", () => ({ default: appState.rateLimitFn }));
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

vi.mock("fs", () => ({ default: { existsSync: vi.fn(() => true) }, existsSync: vi.fn(() => true) }));

vi.mock("../config", () => ({ default: { port: 4321 } }));
vi.mock("../logger", () => ({ default: { info: appState.loggerInfo, error: appState.loggerError } }));
vi.mock("../db", () => ({ updateSchema: appState.updateSchema }));
vi.mock("../notifier", () => ({ GroupEventNotifier: vi.fn(function () {}) }));
vi.mock("../update-batcher", () => ({ UpdateBatcher: vi.fn(function () {}) }));
vi.mock("../external-services", () => ({ startGeUpdater: appState.startGeUpdater, startSkillsAggregator: appState.startSkillsAggregator }));
vi.mock("../event-scheduler", () => ({ startEventScheduler: appState.startEventScheduler }));
vi.mock("../routes", () => ({
  unauthedRouter: "unauthed-router",
  authedRouter: "authed-router",
  startOsrsNewsRefresher: appState.startOsrsNewsRefresher,
  startOsrsYtRefresher: appState.startOsrsYtRefresher,
  startTwitchRefresher: appState.startTwitchRefresher,
}));

describe("server index bootstrap", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    appState.updateSchema.mockResolvedValue(undefined);
    appState.listen.mockImplementation((_port: number, _host: string, cb: () => void) => {
      cb();
      return undefined;
    });
  });

  it("boots app and wires middleware, routes, and background jobs", async () => {
    await import("../index");

    expect(appState.use).toHaveBeenCalled();
    expect(appState.get).toHaveBeenCalledWith("*", expect.anything(), expect.any(Function));
    expect(appState.options).toHaveBeenCalledWith("*", "rate-mw", expect.any(Function));
    expect(appState.updateSchema).toHaveBeenCalled();
    expect(appState.startGeUpdater).toHaveBeenCalled();
    expect(appState.startSkillsAggregator).toHaveBeenCalled();
    expect(appState.startEventScheduler).toHaveBeenCalled();
    expect(appState.startOsrsNewsRefresher).toHaveBeenCalled();
    expect(appState.startOsrsYtRefresher).toHaveBeenCalled();
    expect(appState.startTwitchRefresher).toHaveBeenCalled();
    expect(appState.listen).toHaveBeenCalledWith(4321, "0.0.0.0", expect.any(Function));
  });
});