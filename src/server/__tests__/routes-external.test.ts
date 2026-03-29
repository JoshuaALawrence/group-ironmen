import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  axiosGet: vi.fn(),
  axiosPost: vi.fn(),
  loggerInfo: vi.fn(),
  loggerError: vi.fn(),
  validName: vi.fn(),
  validateMemberPropLength: vi.fn(),
  v4: vi.fn(),
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
  aggregateSkills: vi.fn(),
  applySkillsRetention: vi.fn(),
  getCachedWiseOldManPlayerBossKc: vi.fn(),
  upsertWiseOldManPlayerBossKc: vi.fn(),
  setInterval: vi.fn(),
  clearInterval: vi.fn(),
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
  default: {
    hcaptcha: {
      enabled: false,
      secret: "hsecret",
      sitekey: "hsite",
    },
    port: 4000,
  },
}));

vi.mock("../auth-middleware", () => ({
  default: (req: any, _res: any, next: () => void) => {
    req.groupId = req.groupId ?? 1;
    next();
  },
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
  aggregateSkills: state.aggregateSkills,
  applySkillsRetention: state.applySkillsRetention,
  getCachedWiseOldManPlayerBossKc: state.getCachedWiseOldManPlayerBossKc,
  upsertWiseOldManPlayerBossKc: state.upsertWiseOldManPlayerBossKc,
}));

type MockReq = {
  body?: any;
  query?: any;
  params?: any;
  headers?: any;
  app?: any;
  path?: string;
  on?: (event: string, cb: () => void) => void;
  groupId?: number;
};

function makeRes() {
  return {
    status: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    end: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    type: vi.fn().mockReturnThis(),
    flushHeaders: vi.fn().mockReturnThis(),
    write: vi.fn().mockReturnThis(),
    header: vi.fn().mockReturnThis(),
    sendStatus: vi.fn().mockReturnThis(),
  };
}

function findRouteHandler(router: any, method: string, routePath: string) {
  const layer = router.stack.find((l: any) => l.route && l.route.path === routePath && l.route.methods[method]);
  if (!layer) throw new Error(`Route not found: ${method.toUpperCase()} ${routePath}`);
  return layer.route.stack[layer.route.stack.length - 1].handle;
}

describe("server routes and external services", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    state.validName.mockReturnValue(true);
    state.v4.mockReturnValue("generated-token");
    state.getDiscordSettings.mockResolvedValue({ webhook_url: "", members: [] });
    state.isMemberInGroup.mockResolvedValue(true);
    state.getGroupData.mockResolvedValue([{ name: "Alice" }]);
    state.getSkillsForPeriod.mockResolvedValue([{ name: "Alice", skill_data: [] }]);
    state.getGroupEvents.mockResolvedValue([]);
    state.createGroupEvent.mockResolvedValue({ event_id: 1 });
    state.deleteGroupEvent.mockResolvedValue(true);
  });

  it("covers unauthed and authed route handlers", async () => {
    const { unauthedRouter, authedRouter, startOsrsNewsRefresher, startOsrsYtRefresher, startTwitchRefresher } = await import("../routes");

    const appLocals = {
      notifier: {
        notifyGroup: vi.fn(),
        subscribe: vi.fn().mockReturnValue({ on: vi.fn().mockReturnValue(vi.fn()) }),
      },
      batcher: {
        enqueue: vi.fn(),
      },
    };

    let res = makeRes();
    let req: MockReq = { body: { name: "MyGroup", member_names: ["Alice", "Bob"] } };
    state.createGroup.mockResolvedValue(undefined);
    await findRouteHandler(unauthedRouter, "post", "/create-group")(req as any, res as any);
    expect(state.createGroup).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);

    res = makeRes();
    req = { body: { name: "bad" } };
    state.validName.mockReturnValueOnce(false);
    await findRouteHandler(unauthedRouter, "post", "/create-group")(req as any, res as any);
    expect(res.status).toHaveBeenCalledWith(400);

    res = makeRes();
    await findRouteHandler(unauthedRouter, "get", "/ge-prices")({} as any, res as any);
    expect(res.send).toHaveBeenCalled();

    res = makeRes();
    await findRouteHandler(unauthedRouter, "get", "/captcha-enabled")({} as any, res as any);
    expect(res.json).toHaveBeenCalled();

    res = makeRes();
    await findRouteHandler(unauthedRouter, "get", "/collection-log-info")({} as any, res as any);
    expect(res.send).toHaveBeenCalledWith('{"ok":true}');

    res = makeRes();
    await findRouteHandler(unauthedRouter, "get", "/wise-old-man/players/:playerName/boss-kc")({ params: { playerName: "Alice" } } as any, res as any);
    expect(res.status).not.toHaveBeenCalledWith(500);

    state.axiosGet.mockResolvedValue({ data: "<rss><channel><item><title>News</title><description>Desc</description><link>https://x</link><category>Game Updates</category><pubDate>Now</pubDate><enclosure url=\"https://img\"/></item></channel></rss>" });
    startOsrsNewsRefresher();
    await Promise.resolve();
    res = makeRes();
    await findRouteHandler(unauthedRouter, "get", "/osrs-news")({} as any, res as any);
    expect(res.send).toHaveBeenCalled();

    state.axiosGet.mockResolvedValue({ data: "<feed><entry><yt:videoId>abc</yt:videoId><title>Video</title><published>now</published></entry></feed>" });
    startOsrsYtRefresher();
    await Promise.resolve();
    res = makeRes();
    await findRouteHandler(unauthedRouter, "get", "/osrs-youtube")({} as any, res as any);
    expect(res.send).toHaveBeenCalled();

    state.axiosGet
      .mockResolvedValueOnce({ data: "isLiveBroadcast" })
      .mockResolvedValueOnce({ data: "<rss><channel><item><title>Vod</title><link>https://vod</link><description>&lt;img src=&quot;https://thumb&quot;&gt;</description></item></channel></rss>" });
    startTwitchRefresher();
    await Promise.resolve();
    res = makeRes();
    await findRouteHandler(unauthedRouter, "get", "/osrs-twitch")({} as any, res as any);
    expect(res.send).toHaveBeenCalled();

    res = makeRes();
    req = { body: { name: "NewMember" }, app: { locals: appLocals }, groupId: 1 };
    await findRouteHandler(authedRouter, "post", "/add-group-member")(req as any, res as any);
    expect(state.addGroupMember).toHaveBeenCalled();

    res = makeRes();
    req = { body: { name: "Old" }, app: { locals: appLocals }, groupId: 1 };
    await findRouteHandler(authedRouter, "delete", "/delete-group-member")(req as any, res as any);
    expect(state.deleteGroupMember).toHaveBeenCalled();

    res = makeRes();
    req = { body: { original_name: "Old", new_name: "New" }, app: { locals: appLocals }, groupId: 1 };
    await findRouteHandler(authedRouter, "put", "/rename-group-member")(req as any, res as any);
    expect(state.renameGroupMember).toHaveBeenCalled();

    res = makeRes();
    req = { body: { name: "Alice", stats: [1, 2, 3, 4, 5, 6, 7], coordinates: [1, 2, 3], skills: new Array(23).fill(1), quests: [], inventory: new Array(56).fill(0), equipment: new Array(28).fill(0), bank: [], shared_bank: [], rune_pouch: [1,2,3,4,5,6], seed_vault: [], deposited: [], diary_vars: [], collection_log_v2: [] }, app: { locals: appLocals }, groupId: 1 };
    await findRouteHandler(authedRouter, "post", "/update-group-member")(req as any, res as any);
    expect(appLocals.batcher.enqueue).toHaveBeenCalled();

    res = makeRes();
    state.validateMemberPropLength.mockImplementationOnce(() => {
      const error = Object.assign(new Error("inventory length violated range constraint 56..=56 actual=1"), {
        statusCode: 400,
        publicMessage: "Invalid member data length",
      });
      throw error;
    });
    req = { body: { name: "Alice", stats: [1, 2, 3, 4, 5, 6, 7], coordinates: [1, 2, 3], skills: new Array(23).fill(1), quests: [], inventory: [1], equipment: new Array(28).fill(0), bank: [], shared_bank: [], rune_pouch: [1,2,3,4,5,6], seed_vault: [], deposited: [], diary_vars: [], collection_log_v2: [] }, app: { locals: appLocals }, groupId: 1 };
    await findRouteHandler(authedRouter, "post", "/update-group-member")(req as any, res as any);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith("Invalid member data length");

    res = makeRes();
    req = { query: { from_time: "2024-01-01T00:00:00Z" }, groupId: 1 };
    await findRouteHandler(authedRouter, "get", "/get-group-data")(req as any, res as any);
    expect(res.json).toHaveBeenCalledWith([{ name: "Alice" }]);

    res = makeRes();
    req = { query: { period: "Year" }, groupId: 1 };
    await findRouteHandler(authedRouter, "get", "/get-skill-data")(req as any, res as any);
    expect(state.getSkillsForPeriod).toHaveBeenCalledWith(1, "year");

    res = makeRes();
    await findRouteHandler(authedRouter, "get", "/am-i-logged-in")({} as any, res as any);
    expect(res.status).toHaveBeenCalledWith(200);

    res = makeRes();
    req = { query: { member_name: "Alice" }, groupId: 1 };
    await findRouteHandler(authedRouter, "get", "/am-i-in-group")(req as any, res as any);
    expect(res.status).toHaveBeenCalledWith(200);

    res = makeRes();
    await findRouteHandler(authedRouter, "get", "/collection-log")({} as any, res as any);
    expect(res.json).toHaveBeenCalledWith({});

    res = makeRes();
    req = { groupId: 1 };
    await findRouteHandler(authedRouter, "get", "/events")(req as any, res as any);
    expect(state.getGroupEvents).toHaveBeenCalledWith(1);

    res = makeRes();
    req = { body: { title: "Bossing", description: "desc", event_type: "boss", event_time: new Date().toISOString(), created_by: "Alice", icon: "fa:dragon" }, groupId: 1 };
    await findRouteHandler(authedRouter, "post", "/events")(req as any, res as any);
    expect(state.createGroupEvent).toHaveBeenCalled();

    res = makeRes();
    req = { params: { event_id: "1" }, groupId: 1 };
    await findRouteHandler(authedRouter, "delete", "/events/:event_id")(req as any, res as any);
    expect(state.deleteGroupEvent).toHaveBeenCalledWith(1, 1);

    res = makeRes();
    state.getDiscordSettings.mockResolvedValue({ webhook_url: "https://discord.com/api/webhooks/abc", members: [{ name: "Alice", discord_id: "1" }] });
    req = { groupId: 1 };
    await findRouteHandler(authedRouter, "get", "/discord-settings")(req as any, res as any);
    expect(res.json).toHaveBeenCalled();

    res = makeRes();
    req = { body: { webhook_url: "https://discord.com/api/webhooks/a/b", members: [{ name: "Alice", discord_id: "123" }] }, groupId: 1 };
    await findRouteHandler(authedRouter, "put", "/discord-settings")(req as any, res as any);
    expect(state.updateDiscordSettings).toHaveBeenCalled();

    res = makeRes();
    state.getDiscordSettings.mockResolvedValue({ webhook_url: "https://discord.com/api/webhooks/a/b", members: [{ name: "Bob", discord_id: "123" }] });
    req = { body: { item_name: "Shark", quantity: 10, requested_by: "Alice", member_quantities: { Bob: 100 } }, groupId: 1 };
    await findRouteHandler(authedRouter, "post", "/request-item")(req as any, res as any);
    expect(state.axiosPost).toHaveBeenCalled();
  });

  it("covers external services updater and WOM handler", async () => {
    const ext = await import("../external-services");

    const setIntervalSpy = vi.spyOn(globalThis, "setInterval").mockReturnValue(777 as never);
    const clearIntervalSpy = vi.spyOn(globalThis, "clearInterval").mockImplementation(() => undefined);

    state.axiosGet.mockResolvedValue({ data: { data: { 1: { high: 120, low: 100 }, 2: { low: 50 } } } });
    ext.startGeUpdater();
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));
    expect(ext.getGePricesJson()).toContain('"1":110');

    state.aggregateSkills.mockResolvedValue(undefined);
    state.applySkillsRetention.mockResolvedValue(undefined);
    ext.startSkillsAggregator();
    await Promise.resolve();
    expect(state.aggregateSkills).toHaveBeenCalled();
    expect(state.applySkillsRetention).toHaveBeenCalled();

    state.validName.mockReturnValueOnce(false);
    let res = makeRes();
    await ext.handleGetWiseOldManPlayerBossKc({ params: { playerName: "@@bad" } } as any, res as any);
    expect(res.status).toHaveBeenCalledWith(400);

    state.validName.mockReturnValue(true);
    state.getCachedWiseOldManPlayerBossKc.mockResolvedValueOnce({ schemaVersion: 3, bosses: [] });
    res = makeRes();
    await ext.handleGetWiseOldManPlayerBossKc({ params: { playerName: "Alice" } } as any, res as any);
    expect(res.json).toHaveBeenCalled();

    state.getCachedWiseOldManPlayerBossKc.mockResolvedValueOnce(null);
    state.axiosGet
      .mockResolvedValueOnce({ status: 200, data: { name: "Alice", activities: [{ name: "Vorkath", score: 20, rank: 100 }] } })
      .mockResolvedValueOnce({ status: 404, data: {} });
    state.upsertWiseOldManPlayerBossKc.mockResolvedValue(undefined);
    res = makeRes();
    await ext.handleGetWiseOldManPlayerBossKc({ params: { playerName: "Alice" } } as any, res as any);
    expect(state.upsertWiseOldManPlayerBossKc).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalled();

    state.getCachedWiseOldManPlayerBossKc.mockResolvedValueOnce(null);
    state.axiosGet
      .mockResolvedValueOnce({ status: 404, data: {} })
      .mockResolvedValueOnce({ status: 404, data: {} })
      .mockResolvedValueOnce({ status: 404, data: {} })
      .mockResolvedValueOnce({ status: 404, data: {} });
    res = makeRes();
    await ext.handleGetWiseOldManPlayerBossKc({ params: { playerName: "Alice" } } as any, res as any);
    expect(res.status).toHaveBeenCalledWith(404);

    expect(setIntervalSpy).toHaveBeenCalled();
    clearIntervalSpy.mockRestore();
    setIntervalSpy.mockRestore();
  });
});