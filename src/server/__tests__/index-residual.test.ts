import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type StopFn = (() => void) | undefined;
type ShutdownHandler = (signal: NodeJS.Signals) => void;

const state = vi.hoisted(() => {
  const stopGeUpdaterSpy = vi.fn();
  const stopSkillsAggregatorSpy = vi.fn();
  const stopEventSchedulerSpy = vi.fn();

  return {
    use: vi.fn(),
    get: vi.fn(),
    listen: vi.fn(),
    options: vi.fn(),
    locals: {},
    staticFn: vi.fn(),
    jsonFn: vi.fn(),
    rateLimitFn: vi.fn(),
    existsSync: vi.fn(),
    updateSchema: vi.fn(),
    startGeUpdater: vi.fn(),
    startSkillsAggregator: vi.fn(),
    startEventScheduler: vi.fn(),
    startOsrsNewsRefresher: vi.fn(),
    startOsrsYtRefresher: vi.fn(),
    startTwitchRefresher: vi.fn(),
    loggerInfo: vi.fn(),
    loggerError: vi.fn(),
    stopGeUpdaterSpy,
    stopSkillsAggregatorSpy,
    stopEventSchedulerSpy,
    stopGeUpdaterImpl: stopGeUpdaterSpy as StopFn,
    stopSkillsAggregatorImpl: stopSkillsAggregatorSpy as StopFn,
    stopEventSchedulerImpl: stopEventSchedulerSpy as StopFn,
  };
});

vi.mock("express", () => {
  const app = {
    use: state.use,
    get: state.get,
    set: vi.fn(),
    listen: state.listen,
    options: state.options,
    locals: state.locals,
  };
  const expressFn = vi.fn(() => app);
  (expressFn as any).static = state.staticFn;
  (expressFn as any).json = state.jsonFn;
  return { default: expressFn };
});

vi.mock("compression", () => ({ default: vi.fn(() => "compression-mw") }));
vi.mock("express-rate-limit", () => ({ default: state.rateLimitFn }));
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

vi.mock("fs", () => ({ default: { existsSync: state.existsSync }, existsSync: state.existsSync }));

vi.mock("../config", () => ({ default: { port: 4321 } }));
vi.mock("../logger", () => ({ default: { info: state.loggerInfo, error: state.loggerError } }));
vi.mock("../db", () => ({ updateSchema: state.updateSchema }));
vi.mock("../notifier", () => ({ GroupEventNotifier: vi.fn(function () {}) }));
vi.mock("../update-batcher", () => ({ UpdateBatcher: vi.fn(function () {}) }));
vi.mock("../external-services", () => ({
  startGeUpdater: state.startGeUpdater,
  startSkillsAggregator: state.startSkillsAggregator,
  get stopGeUpdater() {
    return state.stopGeUpdaterImpl;
  },
  get stopSkillsAggregator() {
    return state.stopSkillsAggregatorImpl;
  },
}));
vi.mock("../event-scheduler", () => ({
  startEventScheduler: state.startEventScheduler,
  get stopEventScheduler() {
    return state.stopEventSchedulerImpl;
  },
}));
vi.mock("../routes", () => ({
  unauthedRouter: "unauthed-router",
  authedRouter: "authed-router",
  startOsrsNewsRefresher: state.startOsrsNewsRefresher,
  startOsrsYtRefresher: state.startOsrsYtRefresher,
  startTwitchRefresher: state.startTwitchRefresher,
}));

function makeResponse() {
  return {
    sendStatus: vi.fn().mockReturnThis(),
    sendFile: vi.fn().mockReturnThis(),
  };
}

function getCatchAllHandler() {
  const catchAllCall = state.get.mock.calls.find(([route]) => route instanceof RegExp);

  if (!catchAllCall) {
    throw new Error("Catch-all route was not registered");
  }

  return catchAllCall[2] as (req: { path: string }, res: ReturnType<typeof makeResponse>) => void;
}

function registerShutdownHandlers() {
  const handlers: Partial<Record<NodeJS.Signals, ShutdownHandler>> = {};

  vi.spyOn(process, "once").mockImplementation(((signal: string, handler: ShutdownHandler) => {
    handlers[signal as NodeJS.Signals] = handler;
    return process;
  }) as never);

  return handlers;
}

async function flushPromises() {
  await Promise.resolve();
  await new Promise((resolve) => setImmediate(resolve));
}

async function loadServer() {
  await import("../index");
  await flushPromises();
}

describe("server index residual branches", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    for (const key of Object.keys(state.locals)) {
      delete (state.locals as Record<string, unknown>)[key];
    }

    state.staticFn.mockImplementation(() => "static-mw");
    state.jsonFn.mockImplementation(() => "json-mw");
    state.rateLimitFn.mockImplementation(() => "rate-mw");
    state.existsSync.mockReturnValue(true);
    state.updateSchema.mockResolvedValue(undefined);
    state.listen.mockImplementation((_port: number, _host: string, cb: () => void) => {
      cb();
      return undefined;
    });

    state.stopGeUpdaterImpl = state.stopGeUpdaterSpy;
    state.stopSkillsAggregatorImpl = state.stopSkillsAggregatorSpy;
    state.stopEventSchedulerImpl = state.stopEventSchedulerSpy;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("falls back to the dist site assets and serves index.html for non-map routes", async () => {
    const distSitePublicDir = path.resolve(process.cwd(), "dist", "site", "public");

    state.existsSync.mockImplementation((candidate: string) => candidate === distSitePublicDir);

    await loadServer();

    expect(state.staticFn).toHaveBeenCalledWith(distSitePublicDir);

    const handler = getCatchAllHandler();
    const res = makeResponse();
    handler({ path: "/groups/ironmen" }, res);

    expect(res.sendStatus).not.toHaveBeenCalled();
    expect(res.sendFile).toHaveBeenCalledWith(path.join(distSitePublicDir, "index.html"));
  });

  it("falls back to the source site assets resolved from __dirname when cwd candidates miss", async () => {
    const originalCwd = process.cwd();
    const alternateCwd = path.join(originalCwd, "tmp-run-dir");
    const sourceSitePublicDir = path.resolve(originalCwd, "src", "site", "public");

    vi.spyOn(process, "cwd").mockReturnValue(alternateCwd);
    state.existsSync.mockImplementation((candidate: string) => candidate === sourceSitePublicDir);

    await loadServer();

    expect(state.staticFn).toHaveBeenCalledWith(sourceSitePublicDir);
  });

  it("returns a 404 for map png requests in the SPA catch-all", async () => {
    await loadServer();

    const handler = getCatchAllHandler();
    const res = makeResponse();
    handler({ path: "/map/tiles/42.png" }, res);

    expect(res.sendStatus).toHaveBeenCalledWith(404);
    expect(res.sendFile).not.toHaveBeenCalled();
  });

  it("treats missing stop handlers as a no-op and exits immediately when no server handle exists", async () => {
    const handlers = registerShutdownHandlers();
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);

    state.stopGeUpdaterImpl = undefined;
    state.stopSkillsAggregatorImpl = undefined;
    state.stopEventSchedulerImpl = undefined;

    await loadServer();

    handlers.SIGTERM?.("SIGTERM");

    expect(state.stopGeUpdaterSpy).not.toHaveBeenCalled();
    expect(state.stopSkillsAggregatorSpy).not.toHaveBeenCalled();
    expect(state.stopEventSchedulerSpy).not.toHaveBeenCalled();
    expect(state.loggerError).not.toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it("ignores repeated shutdown signals after the first graceful stop", async () => {
    const handlers = registerShutdownHandlers();
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);
    const close = vi.fn((cb: (err?: Error) => void) => cb());

    state.listen.mockImplementation((_port: number, _host: string, cb: () => void) => {
      cb();
      return { close } as never;
    });

    await loadServer();

    handlers.SIGINT?.("SIGINT");
    handlers.SIGINT?.("SIGINT");

    expect(state.stopGeUpdaterSpy).toHaveBeenCalledTimes(1);
    expect(state.stopSkillsAggregatorSpy).toHaveBeenCalledTimes(1);
    expect(state.stopEventSchedulerSpy).toHaveBeenCalledTimes(1);
    expect(state.loggerInfo).toHaveBeenCalledWith("Received SIGINT, shutting down gracefully");
    expect(close).toHaveBeenCalledTimes(1);
    expect(exitSpy).toHaveBeenCalledTimes(1);
    expect(exitSpy).toHaveBeenCalledWith(0);
  });
});