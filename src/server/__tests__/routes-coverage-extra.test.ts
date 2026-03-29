import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  axiosGet: vi.fn(),
  axiosPost: vi.fn(),
  loggerInfo: vi.fn(),
  loggerError: vi.fn(),
  validName: vi.fn(),
  validateMemberPropLength: vi.fn(),
  v4: vi.fn(),
  config: {
    hcaptcha: {
      enabled: false,
      secret: "hsecret",
      sitekey: "hsite",
    },
    port: 4000,
  },
  getGePricesJson: vi.fn(),
  handleWiseOldManPlayerBossKc: vi.fn(),
  createGroup: vi.fn(),
  addGroupMember: vi.fn(),
  deleteGroupMember: vi.fn(),
  renameGroupMember: vi.fn(),
  isMemberInGroup: vi.fn(),
  getGroupData: vi.fn(),
  getSkillsForPeriod: vi.fn(),
  getGroupEvents: vi.fn(),
  createGroupEvent: vi.fn(),
  deleteGroupEvent: vi.fn(),
  getDiscordSettings: vi.fn(),
  updateDiscordSettings: vi.fn(),
}));

vi.mock("axios", () => ({
  default: {
    get: state.axiosGet,
    post: state.axiosPost,
  },
}));

vi.mock("../logger", () => ({
  default: {
    info: state.loggerInfo,
    error: state.loggerError,
  },
}));

vi.mock("../validators", () => ({
  validName: state.validName,
  validateMemberPropLength: state.validateMemberPropLength,
}));

vi.mock("uuid", () => ({
  v4: state.v4,
}));

vi.mock("../collection-log", () => ({
  COLLECTION_LOG_DATA: '{"ok":true}',
}));

vi.mock("../config", () => ({
  default: state.config,
}));

vi.mock("../external-services", () => ({
  getGePricesJson: state.getGePricesJson,
  handleGetWiseOldManPlayerBossKc: state.handleWiseOldManPlayerBossKc,
}));

vi.mock("../auth-middleware", () => ({
  default: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock("../db", () => ({
  SHARED_MEMBER: "@SHARED",
  createGroup: state.createGroup,
  addGroupMember: state.addGroupMember,
  deleteGroupMember: state.deleteGroupMember,
  renameGroupMember: state.renameGroupMember,
  isMemberInGroup: state.isMemberInGroup,
  getGroupData: state.getGroupData,
  getSkillsForPeriod: state.getSkillsForPeriod,
  getGroupEvents: state.getGroupEvents,
  createGroupEvent: state.createGroupEvent,
  deleteGroupEvent: state.deleteGroupEvent,
  getDiscordSettings: state.getDiscordSettings,
  updateDiscordSettings: state.updateDiscordSettings,
}));

function makeRes(overrides: Record<string, unknown> = {}) {
  return {
    status: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    end: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    type: vi.fn().mockReturnThis(),
    flushHeaders: vi.fn().mockReturnThis(),
    write: vi.fn().mockReturnThis(),
    writableEnded: false,
    destroyed: false,
    ...overrides,
  };
}

function makeAppLocals() {
  return {
    notifier: {
      notifyGroup: vi.fn(),
      subscribe: vi.fn(),
    },
    batcher: {
      enqueue: vi.fn(),
    },
  };
}

function findRouteHandler(router: any, method: string, routePath: string) {
  const layer = router.stack.find(
    (entry: any) => entry.route && entry.route.path === routePath && entry.route.methods[method]
  );

  if (!layer) {
    throw new Error(`Route not found: ${method.toUpperCase()} ${routePath}`);
  }

  return layer.route.stack[layer.route.stack.length - 1].handle;
}

async function flushPromises() {
  await Promise.resolve();
  await new Promise((resolve) => setImmediate(resolve));
}

async function loadRoutes() {
  return import("../routes");
}

describe("server routes extra coverage", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    state.config.hcaptcha.enabled = false;
    state.config.hcaptcha.secret = "hsecret";
    state.config.hcaptcha.sitekey = "hsite";

    state.validName.mockReturnValue(true);
    state.validateMemberPropLength.mockImplementation(() => undefined);
    state.v4.mockReturnValue("generated-token");

    state.getGePricesJson.mockReturnValue('{"4151":2300000}');
    state.handleWiseOldManPlayerBossKc.mockResolvedValue(undefined);

    state.createGroup.mockResolvedValue(undefined);
    state.addGroupMember.mockResolvedValue(undefined);
    state.deleteGroupMember.mockResolvedValue(undefined);
    state.renameGroupMember.mockResolvedValue(undefined);
    state.isMemberInGroup.mockResolvedValue(true);
    state.getGroupData.mockResolvedValue([{ name: "Alice" }]);
    state.getSkillsForPeriod.mockResolvedValue([{ name: "Alice", skill_data: [] }]);
    state.getGroupEvents.mockResolvedValue([{ event_id: 1 }]);
    state.createGroupEvent.mockResolvedValue({ event_id: 5 });
    state.deleteGroupEvent.mockResolvedValue(true);
    state.getDiscordSettings.mockResolvedValue({ webhook_url: "", members: [] });
    state.updateDiscordSettings.mockResolvedValue(undefined);

    state.axiosGet.mockResolvedValue({ data: "<rss></rss>" });
    state.axiosPost.mockResolvedValue({ data: { success: true } });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("covers OSRS news parsing fallbacks and refresh failures", async () => {
    const setIntervalSpy = vi
      .spyOn(globalThis, "setInterval")
      .mockReturnValueOnce(101 as never)
      .mockReturnValueOnce(102 as never);
    const clearIntervalSpy = vi.spyOn(globalThis, "clearInterval").mockImplementation(() => undefined);
    const { unauthedRouter, startOsrsNewsRefresher } = await loadRoutes();

    state.axiosGet.mockResolvedValueOnce({
      data: "<rss><channel><item><title>News &quot;Flash&quot;</title><link>https://news</link><pubDate>Today</pubDate></item></channel></rss>",
    });

    startOsrsNewsRefresher();
    await flushPromises();

    let res = makeRes();
    await findRouteHandler(unauthedRouter, "get", "/osrs-news")({} as any, res as any);
    expect(JSON.parse((res.send as any).mock.calls[0][0])).toEqual([
      {
        title: 'News "Flash"',
        description: "",
        link: "https://news",
        category: "",
        pubDate: "Today",
        imageUrl: "",
      },
    ]);

    state.axiosGet.mockRejectedValueOnce(new Error("news down"));
    startOsrsNewsRefresher();
    await flushPromises();

    expect(clearIntervalSpy).toHaveBeenCalledWith(101);
    expect(state.loggerError).toHaveBeenCalledWith("Error refreshing OSRS news: news down");

    res = makeRes();
    await findRouteHandler(unauthedRouter, "get", "/osrs-news")({} as any, res as any);
    expect(JSON.parse((res.send as any).mock.calls[0][0])).toEqual([
      {
        title: 'News "Flash"',
        description: "",
        link: "https://news",
        category: "",
        pubDate: "Today",
        imageUrl: "",
      },
    ]);

    clearIntervalSpy.mockRestore();
    setIntervalSpy.mockRestore();
  });

  it("covers OSRS YouTube parsing fallbacks and refresh failures", async () => {
    const setIntervalSpy = vi
      .spyOn(globalThis, "setInterval")
      .mockReturnValueOnce(201 as never)
      .mockReturnValueOnce(202 as never);
    const clearIntervalSpy = vi.spyOn(globalThis, "clearInterval").mockImplementation(() => undefined);
    const { unauthedRouter, startOsrsYtRefresher } = await loadRoutes();

    state.axiosGet.mockResolvedValueOnce({
      data: "<feed><entry><yt:videoId>skipme</yt:videoId><published>2026-03-28T00:00:00Z</published></entry><entry><yt:videoId>abc123</yt:videoId><title>Patch &amp; Notes</title></entry><entry><yt:videoId>live123</yt:videoId><title>Weekly Livestream</title><published>2026-03-28T01:00:00Z</published></entry></feed>",
    });

    startOsrsYtRefresher();
    await flushPromises();

    let res = makeRes();
    await findRouteHandler(unauthedRouter, "get", "/osrs-youtube")({} as any, res as any);
    expect(res.send).toHaveBeenCalledWith(
      '[{"videoId":"abc123","title":"Patch & Notes","thumbnail":"https://i.ytimg.com/vi/abc123/mqdefault.jpg","published":""}]'
    );

    state.axiosGet.mockRejectedValueOnce(new Error("yt down"));
    startOsrsYtRefresher();
    await flushPromises();

    expect(clearIntervalSpy).toHaveBeenCalledWith(201);
    expect(state.loggerError).toHaveBeenCalledWith(
      "Error refreshing OSRS YouTube feed (YouTube may be blocking server IPs): yt down"
    );

    clearIntervalSpy.mockRestore();
    setIntervalSpy.mockRestore();
  });

  it("covers Twitch offline fallback fields and refresh failures", async () => {
    const setIntervalSpy = vi
      .spyOn(globalThis, "setInterval")
      .mockReturnValueOnce(301 as never)
      .mockReturnValueOnce(302 as never);
    const clearIntervalSpy = vi.spyOn(globalThis, "clearInterval").mockImplementation(() => undefined);
    const { unauthedRouter, startTwitchRefresher } = await loadRoutes();

    state.axiosGet
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce({
        data: "<rss><channel><item><description>&lt;img src=&quot;https://thumb&quot;&gt;</description></item></channel></rss>",
      });

    startTwitchRefresher();
    await flushPromises();

    let res = makeRes();
    await findRouteHandler(unauthedRouter, "get", "/osrs-twitch")({} as any, res as any);
    expect(res.send).toHaveBeenCalledWith(
      '{"live":false,"title":"","thumbnail":"https://thumb","link":""}'
    );

    state.axiosGet
      .mockRejectedValueOnce(new Error("offline"))
      .mockRejectedValueOnce(new Error("vod feed failed"));

    startTwitchRefresher();
    await flushPromises();

    expect(clearIntervalSpy).toHaveBeenCalledWith(301);
    expect(state.loggerError).toHaveBeenCalledWith("Error refreshing Twitch stream: vod feed failed");

    clearIntervalSpy.mockRestore();
    setIntervalSpy.mockRestore();
  });

  it("covers group-event streaming cleanup after an immediate subscriber write failure", async () => {
    const setIntervalSpy = vi.spyOn(globalThis, "setInterval").mockReturnValue(303 as never);
    const clearIntervalSpy = vi.spyOn(globalThis, "clearInterval").mockImplementation(() => undefined);
    const { authedRouter } = await loadRoutes();

    const unsubscribe = vi.fn();
    const resCloseHandlers: Record<string, () => void> = {};
    const app = {
      locals: {
        notifier: {
          subscribe: vi.fn().mockReturnValue({
            on: vi.fn().mockImplementation((cb: () => void) => {
              cb();
              return unsubscribe;
            }),
          }),
        },
      },
    };

    const res = makeRes({
      on: vi.fn((event: string, cb: () => void) => {
        resCloseHandlers[event] = cb;
      }),
      write: vi
        .fn()
        .mockImplementationOnce(() => true)
        .mockImplementationOnce(() => {
          throw new Error("socket closed");
        }),
    });

    await findRouteHandler(authedRouter, "get", "/group-events")(
      {
        app,
        groupId: 77,
        on: vi.fn(),
      } as any,
      res as any
    );

    expect((res as any).on).toHaveBeenCalledWith("close", expect.any(Function));
    expect((res as any).on).toHaveBeenCalledWith("error", expect.any(Function));
    expect(clearIntervalSpy).toHaveBeenCalledWith(303);
    expect(unsubscribe).toHaveBeenCalledTimes(1);

    resCloseHandlers.close?.();
    resCloseHandlers.error?.();
    expect(unsubscribe).toHaveBeenCalledTimes(1);

    clearIntervalSpy.mockRestore();
    setIntervalSpy.mockRestore();
  });

  it("covers remaining req.body fallback branches for member updates and discord settings", async () => {
    const { authedRouter } = await loadRoutes();
    const app = { locals: makeAppLocals() };

    state.isMemberInGroup.mockResolvedValueOnce(false);
    let res = makeRes();
    await findRouteHandler(authedRouter, "post", "/update-group-member")(
      { app, groupId: 77 } as any,
      res as any
    );
    expect(state.isMemberInGroup).toHaveBeenCalledWith(77, undefined);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.send).toHaveBeenCalledWith("Player is not a member of this group");

    res = makeRes();
    await findRouteHandler(authedRouter, "put", "/discord-settings")(
      { groupId: 77 } as any,
      res as any
    );
    expect(state.updateDiscordSettings).toHaveBeenLastCalledWith(77, null, []);
    expect(res.status).toHaveBeenCalledWith(200);
  });
});