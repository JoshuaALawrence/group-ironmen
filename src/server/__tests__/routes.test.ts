import { beforeEach, describe, expect, it, vi } from "vitest";

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
  getGroup: vi.fn(),
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

vi.mock("../db", () => ({
  SHARED_MEMBER: "@SHARED",
  getGroup: state.getGroup,
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

type MockReq = {
  body?: any;
  query?: any;
  params?: any;
  headers?: any;
  app?: any;
  on?: (event: string, cb: () => void) => void;
  groupId?: number | null;
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
  };
}

function makeAppLocals() {
  return {
    notifier: {
      notifyGroup: vi.fn(),
      subscribe: vi.fn().mockReturnValue({
        on: vi.fn().mockReturnValue(vi.fn()),
      }),
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

function findMiddleware(router: any) {
  const layer = router.stack.find((entry: any) => !entry.route);
  if (!layer) {
    throw new Error("Router middleware not found");
  }
  return layer.handle;
}

async function flushPromises() {
  await Promise.resolve();
  await new Promise((resolve) => setImmediate(resolve));
}

async function loadRoutes() {
  return import("../routes");
}

describe("server routes", () => {
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

    state.getGroup.mockResolvedValue(77);
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

  it("enforces authed router auth branches through the mounted middleware", async () => {
    const { authedRouter } = await loadRoutes();
    const middleware = findMiddleware(authedRouter);
    const res = makeRes();
    const next = vi.fn();

    middleware({ params: {}, headers: {} } as any, res as any, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith("Missing group name from request");

    const bypassReq: MockReq = { params: { group_name: "_" }, headers: {} };
    middleware(bypassReq as any, res as any, next);
    expect(next).toHaveBeenCalled();
    expect(bypassReq.groupId).toBeNull();

    middleware({ params: { group_name: "Unit" }, headers: {} } as any, res as any, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith("Authorization header missing from request");

    state.getGroup.mockResolvedValueOnce(null);
    middleware(
      { params: { group_name: "Unit" }, headers: { authorization: "bad-token" } } as any,
      res as any,
      next
    );
    await flushPromises();
    expect(res.status).toHaveBeenCalledWith(401);

    state.getGroup.mockRejectedValueOnce(new Error("db down"));
    middleware(
      { params: { group_name: "Unit" }, headers: { authorization: "error-token" } } as any,
      res as any,
      next
    );
    await flushPromises();
    expect(res.status).toHaveBeenCalledWith(401);

    const successReq: MockReq = {
      params: { group_name: "Unit" },
      headers: { authorization: "good-token" },
    };
    middleware(successReq as any, res as any, next);
    await flushPromises();
    expect(successReq.groupId).toBe(77);
  });

  it("validates create-group failures and reports a server error on persistence failures", async () => {
    const { unauthedRouter } = await loadRoutes();
    const createGroup = findRouteHandler(unauthedRouter, "post", "/create-group");

    state.config.hcaptcha.enabled = true;
    state.axiosPost.mockResolvedValueOnce({ data: { success: false } });
    let res = makeRes();
    await createGroup(
      { body: { name: "Unit", captcha_response: "captcha-ok" } } as any,
      res as any
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith("Captcha response verification failed");

    state.config.hcaptcha.enabled = false;
    res = makeRes();
    await createGroup(
      { body: { name: "Unit", member_names: ["a", "b", "c", "d", "e", "f"] } } as any,
      res as any
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith("Too many member names provided");

    state.validName.mockReturnValueOnce(false);
    res = makeRes();
    await createGroup({ body: { name: "bad" } } as any, res as any);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith("Provided group name is not valid");

    state.validName.mockReturnValueOnce(true).mockReturnValueOnce(false);
    res = makeRes();
    await createGroup(
      { body: { name: "Unit", member_names: ["bad member"] } } as any,
      res as any
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith("Provided member name is not valid");

    state.createGroup.mockRejectedValueOnce(new Error("insert failed"));
    res = makeRes();
    await createGroup(
      { body: { name: "Unit", member_names: ["Alice"] } } as any,
      res as any
    );
    expect(res.status).toHaveBeenCalledWith(500);
    expect(state.loggerError).toHaveBeenCalledWith("Error creating group: insert failed");
  });

  it("creates groups successfully and serves the basic public metadata endpoints", async () => {
    const { unauthedRouter } = await loadRoutes();

    const createGroup = findRouteHandler(unauthedRouter, "post", "/create-group");
    let res = makeRes();
    await createGroup(
      {
        body: { name: "  Unit  ", member_names: ["Alice", "", " Bob ", null] },
      } as any,
      res as any
    );
    expect(state.createGroup).toHaveBeenCalledWith({
      name: "Unit",
      member_names: ["Alice", " Bob "],
      token: "generated-token",
    });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      name: "Unit",
      member_names: ["Alice", " Bob "],
      token: "generated-token",
    });

    res = makeRes();
    await findRouteHandler(unauthedRouter, "get", "/ge-prices")({} as any, res as any);
    expect(res.set).toHaveBeenCalledWith("Cache-Control", "public, max-age=86400");
    expect(res.set).toHaveBeenCalledWith("Content-Type", "application/json");
    expect(res.send).toHaveBeenCalledWith('{"4151":2300000}');

    state.config.hcaptcha.enabled = true;
    res = makeRes();
    await findRouteHandler(unauthedRouter, "get", "/captcha-enabled")({} as any, res as any);
    expect(res.json).toHaveBeenCalledWith({ enabled: true, sitekey: "hsite" });

    res = makeRes();
    await findRouteHandler(unauthedRouter, "get", "/collection-log-info")({} as any, res as any);
    expect(res.set).toHaveBeenCalledWith("Content-Type", "application/json");
    expect(res.send).toHaveBeenCalledWith('{"ok":true}');
  });

  it("distinguishes wise-old-man failures and cached public feed availability", async () => {
    const setIntervalSpy = vi.spyOn(globalThis, "setInterval").mockReturnValue(101 as never);
    const clearIntervalSpy = vi.spyOn(globalThis, "clearInterval").mockImplementation(() => undefined);
    const {
      unauthedRouter,
      startOsrsNewsRefresher,
      startOsrsYtRefresher,
      startTwitchRefresher,
    } = await loadRoutes();

    let res = makeRes();
    state.handleWiseOldManPlayerBossKc.mockRejectedValueOnce(new Error("wom offline"));
    await findRouteHandler(unauthedRouter, "get", "/wise-old-man/players/:playerName/boss-kc")(
      { params: { playerName: "Alice" } } as any,
      res as any
    );
    expect(res.status).toHaveBeenCalledWith(500);
    expect(state.loggerError).toHaveBeenCalledWith("Error fetching WOM boss kc: wom offline");

    res = makeRes();
    await findRouteHandler(unauthedRouter, "get", "/osrs-news")({} as any, res as any);
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.send).toHaveBeenCalledWith("News not yet available");

    res = makeRes();
    await findRouteHandler(unauthedRouter, "get", "/osrs-youtube")({} as any, res as any);
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.send).toHaveBeenCalledWith("YouTube data not yet available");

    res = makeRes();
    await findRouteHandler(unauthedRouter, "get", "/osrs-twitch")({} as any, res as any);
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.send).toHaveBeenCalledWith("Twitch data not yet available");

    state.axiosGet
      .mockResolvedValueOnce({
        data:
          "<rss><channel><item><title>News &amp; Notes</title><description>&lt;b&gt;Fresh&lt;/b&gt;</description><link>https://news</link><category>Updates</category><pubDate>Now</pubDate><enclosure url=\"https://img\"/></item></channel></rss>",
      })
      .mockResolvedValueOnce({
        data:
          "<feed><entry><yt:videoId>keep1</yt:videoId><title>Livestream Q and A</title><published>now</published></entry><entry><yt:videoId>abc123</yt:videoId><title>Patch Notes</title><published>later</published></entry></feed>",
      })
      .mockResolvedValueOnce({ data: "isLiveBroadcast" })
      .mockResolvedValueOnce({
        data:
          "<rss><channel><item><title>Vod &amp; Recap</title><link>https://vod</link><description>&lt;img src=&quot;https://thumb&quot;&gt;</description></item></channel></rss>",
      });

    startOsrsNewsRefresher();
    startOsrsYtRefresher();
    startTwitchRefresher();
    await flushPromises();

    res = makeRes();
    await findRouteHandler(unauthedRouter, "get", "/osrs-news")({} as any, res as any);
    expect(res.set).toHaveBeenCalledWith("Content-Type", "application/json");
    expect(res.set).toHaveBeenCalledWith("Cache-Control", "public, max-age=3600");
    expect(res.send).toHaveBeenCalledWith(
      '[{"title":"News & Notes","description":"<b>Fresh</b>","link":"https://news","category":"Updates","pubDate":"Now","imageUrl":"https://img"}]'
    );

    res = makeRes();
    await findRouteHandler(unauthedRouter, "get", "/osrs-youtube")({} as any, res as any);
    expect(res.send).toHaveBeenCalledWith(
      '[{"videoId":"abc123","title":"Patch Notes","thumbnail":"https://i.ytimg.com/vi/abc123/mqdefault.jpg","published":"later"}]'
    );

    res = makeRes();
    await findRouteHandler(unauthedRouter, "get", "/osrs-twitch")({} as any, res as any);
    expect(res.set).toHaveBeenCalledWith("Cache-Control", "public, max-age=60");
    expect(res.send).toHaveBeenCalled();

    clearIntervalSpy.mockRestore();
    setIntervalSpy.mockRestore();
  });

  it("covers member-management routes across shared-name, validation, public, and success branches", async () => {
    const { authedRouter } = await loadRoutes();
    const app = { locals: makeAppLocals() };

    let res = makeRes();
    await findRouteHandler(authedRouter, "post", "/add-group-member")(
      { body: { name: "@SHARED" }, app, groupId: 77 } as any,
      res as any
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith("Member name @SHARED not allowed");

    state.validName.mockReturnValueOnce(false);
    res = makeRes();
    await findRouteHandler(authedRouter, "post", "/add-group-member")(
      { body: { name: "bad" }, app, groupId: 77 } as any,
      res as any
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith("Provided member name is not valid");

    state.addGroupMember.mockRejectedValueOnce({ statusCode: 409, publicMessage: "Already exists" });
    res = makeRes();
    await findRouteHandler(authedRouter, "post", "/add-group-member")(
      { body: { name: "Alice" }, app, groupId: 77 } as any,
      res as any
    );
    expect(res.type).toHaveBeenCalledWith("text/plain");
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.send).toHaveBeenCalledWith("Already exists");

    res = makeRes();
    await findRouteHandler(authedRouter, "post", "/add-group-member")(
      { body: { name: "Alice" }, app, groupId: 77 } as any,
      res as any
    );
    expect(state.addGroupMember).toHaveBeenCalledWith(77, "Alice");
    expect(app.locals.notifier.notifyGroup).toHaveBeenCalledWith(77);
    expect(res.status).toHaveBeenCalledWith(201);

    res = makeRes();
    await findRouteHandler(authedRouter, "delete", "/delete-group-member")(
      { body: { name: "@SHARED" }, app, groupId: 77 } as any,
      res as any
    );
    expect(res.status).toHaveBeenCalledWith(400);

    state.deleteGroupMember.mockRejectedValueOnce(new Error("delete failed"));
    res = makeRes();
    await findRouteHandler(authedRouter, "delete", "/delete-group-member")(
      { body: { name: "Bob" }, app, groupId: 77 } as any,
      res as any
    );
    expect(res.status).toHaveBeenCalledWith(500);
    expect(state.loggerError).toHaveBeenCalledWith("Error deleting group member: delete failed");

    res = makeRes();
    await findRouteHandler(authedRouter, "put", "/rename-group-member")(
      { body: { original_name: "@SHARED", new_name: "Bob" }, app, groupId: 77 } as any,
      res as any
    );
    expect(res.status).toHaveBeenCalledWith(400);

    state.validName.mockReturnValueOnce(false);
    res = makeRes();
    await findRouteHandler(authedRouter, "put", "/rename-group-member")(
      { body: { original_name: "Old", new_name: "bad" }, app, groupId: 77 } as any,
      res as any
    );
    expect(res.status).toHaveBeenCalledWith(400);

    res = makeRes();
    await findRouteHandler(authedRouter, "put", "/rename-group-member")(
      { body: { original_name: "Old", new_name: "New" }, app, groupId: 77 } as any,
      res as any
    );
    expect(state.renameGroupMember).toHaveBeenCalledWith(77, "Old", "New");
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("handles update-group-member auth, public validation errors, and success queueing", async () => {
    const { authedRouter } = await loadRoutes();
    const app = { locals: makeAppLocals() };
    const updateGroupMember = findRouteHandler(authedRouter, "post", "/update-group-member");

    state.isMemberInGroup.mockResolvedValueOnce(false);
    let res = makeRes();
    await updateGroupMember(
      { body: { name: "Alice" }, app, groupId: 77 } as any,
      res as any
    );
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.send).toHaveBeenCalledWith("Player is not a member of this group");

    state.isMemberInGroup.mockResolvedValueOnce(true);
    state.validateMemberPropLength.mockImplementationOnce(() => {
      throw { statusCode: 422, publicMessage: "Bad stats payload" };
    });
    res = makeRes();
    await updateGroupMember(
      { body: { name: "Alice", stats: [] }, app, groupId: 77 } as any,
      res as any
    );
    expect(res.type).toHaveBeenCalledWith("text/plain");
    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.send).toHaveBeenCalledWith("Bad stats payload");

    state.isMemberInGroup.mockResolvedValueOnce(true);
    res = makeRes();
    await updateGroupMember(
      {
        body: {
          name: "Alice",
          stats: [1, 2, 3, 4, 5, 6, 7],
          coordinates: [1, 2, 3],
          skills: new Array(23).fill(1),
          quests: [],
          inventory: new Array(56).fill(0),
          equipment: new Array(28).fill(0),
          bank: [],
          shared_bank: [],
          rune_pouch: [1, 2, 3, 4, 5, 6],
          seed_vault: [],
          deposited: [],
          diary_vars: [],
          collection_log_v2: [],
        },
        app,
        groupId: 77,
      } as any,
      res as any
    );
    expect(app.locals.batcher.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Alice", group_id: 77 })
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("streams group-event updates and cleans up on close", async () => {
    let keepAliveCallback: (() => void) | undefined;
    const setIntervalSpy = vi
      .spyOn(globalThis, "setInterval")
      .mockImplementation((cb: any) => {
        keepAliveCallback = cb;
        return 202 as never;
      });
    const clearIntervalSpy = vi.spyOn(globalThis, "clearInterval").mockImplementation(() => undefined);
    const { authedRouter } = await loadRoutes();

    const subscriberCallback = vi.fn();
    const unsubscribe = vi.fn();
    const app = {
      locals: {
        notifier: {
          subscribe: vi.fn().mockReturnValue({
            on: vi.fn().mockImplementation((cb: () => void) => {
              subscriberCallback.mockImplementation(cb);
              return unsubscribe;
            }),
          }),
        },
      },
    };
    let closeHandler: (() => void) | undefined;
    const req: MockReq = {
      app,
      groupId: 77,
      on: vi.fn((event, cb) => {
        if (event === "close") {
          closeHandler = cb;
        }
      }),
    };
    const res = makeRes();

    await findRouteHandler(authedRouter, "get", "/group-events")(req as any, res as any);
    expect(res.set).toHaveBeenCalledWith({
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    expect(res.flushHeaders).toHaveBeenCalled();
    expect(res.write).toHaveBeenCalledWith(": connected\n\n");

    keepAliveCallback?.();
    expect(res.write).toHaveBeenCalledWith(": keep-alive\n\n");

    subscriberCallback();
    expect(res.write).toHaveBeenCalledWith("data: update\n\n");

    closeHandler?.();
    expect(clearIntervalSpy).toHaveBeenCalledWith(202);
    expect(unsubscribe).toHaveBeenCalled();

    clearIntervalSpy.mockRestore();
    setIntervalSpy.mockRestore();
  });

  it("covers group data, skill data, login, membership, and collection-log response branches", async () => {
    const { authedRouter } = await loadRoutes();

    let res = makeRes();
    await findRouteHandler(authedRouter, "get", "/get-group-data")(
      { query: { from_time: "2026-03-01T00:00:00Z" }, groupId: 77 } as any,
      res as any
    );
    expect(state.getGroupData).toHaveBeenCalledWith(77, "2026-03-01T00:00:00Z");
    expect(res.json).toHaveBeenCalledWith([{ name: "Alice" }]);

    state.getGroupData.mockRejectedValueOnce(new Error("group data failed"));
    res = makeRes();
    await findRouteHandler(authedRouter, "get", "/get-group-data")(
      { query: {}, groupId: 77 } as any,
      res as any
    );
    expect(res.status).toHaveBeenCalledWith(500);

    res = makeRes();
    await findRouteHandler(authedRouter, "get", "/get-skill-data")(
      { query: { period: "Week" }, groupId: 77 } as any,
      res as any
    );
    expect(state.getSkillsForPeriod).toHaveBeenCalledWith(77, "month");

    res = makeRes();
    await findRouteHandler(authedRouter, "get", "/get-skill-data")(
      { query: { period: "Year" }, groupId: 77 } as any,
      res as any
    );
    expect(state.getSkillsForPeriod).toHaveBeenCalledWith(77, "year");

    res = makeRes();
    await findRouteHandler(authedRouter, "get", "/get-skill-data")(
      { query: { period: "Unexpected" }, groupId: 77 } as any,
      res as any
    );
    expect(state.getSkillsForPeriod).toHaveBeenCalledWith(77, "day");

    res = makeRes();
    await findRouteHandler(authedRouter, "get", "/am-i-logged-in")({} as any, res as any);
    expect(res.status).toHaveBeenCalledWith(200);

    state.isMemberInGroup.mockResolvedValueOnce(false);
    res = makeRes();
    await findRouteHandler(authedRouter, "get", "/am-i-in-group")(
      { query: { member_name: "Alice" }, groupId: 77 } as any,
      res as any
    );
    expect(res.status).toHaveBeenCalledWith(401);

    state.isMemberInGroup.mockRejectedValueOnce(new Error("lookup failed"));
    res = makeRes();
    await findRouteHandler(authedRouter, "get", "/am-i-in-group")(
      { query: { member_name: "Alice" }, groupId: 77 } as any,
      res as any
    );
    expect(res.status).toHaveBeenCalledWith(500);

    res = makeRes();
    await findRouteHandler(authedRouter, "get", "/collection-log")({} as any, res as any);
    expect(res.json).toHaveBeenCalledWith({});
  });

  it("validates event creation and deletion branches, including public and not-found responses", async () => {
    const { authedRouter } = await loadRoutes();
    const createEvent = findRouteHandler(authedRouter, "post", "/events");
    const deleteEvent = findRouteHandler(authedRouter, "delete", "/events/:event_id");

    let res = makeRes();
    await createEvent({ body: { title: "" }, groupId: 77 } as any, res as any);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith("Title is required and must be 100 characters or less");

    res = makeRes();
    await createEvent(
      {
        body: {
          title: "Bossing",
          description: "x".repeat(501),
          event_time: new Date().toISOString(),
          created_by: "Alice",
        },
        groupId: 77,
      } as any,
      res as any
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith("Description must be 500 characters or less");

    res = makeRes();
    await createEvent(
      { body: { title: "Bossing", event_time: "not-a-date", created_by: "Alice" }, groupId: 77 } as any,
      res as any
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith("Invalid event time");

    res = makeRes();
    await createEvent(
      {
        body: {
          title: "Bossing",
          event_time: new Date().toISOString(),
          event_end_time: "still-not-a-date",
          created_by: "Alice",
        },
        groupId: 77,
      } as any,
      res as any
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith("Invalid event end time");

    state.createGroupEvent.mockRejectedValueOnce({ statusCode: 503 });
    res = makeRes();
    await createEvent(
      {
        body: {
          title: "Bossing",
          description: "  Bring supplies  ",
          event_type: "boss",
          event_time: "2026-03-30T18:00:00.000Z",
          created_by: "  Alice  ",
          icon: "INVALID ICON",
        },
        groupId: 77,
      } as any,
      res as any
    );
    expect(res.type).toHaveBeenCalledWith("text/plain");
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.send).toHaveBeenCalledWith("Request failed");

    res = makeRes();
    await createEvent(
      {
        body: {
          title: "  Bossing  ",
          description: "  Bring supplies  ",
          event_type: "boss",
          event_time: "2026-03-30T18:00:00.000Z",
          event_end_time: "2026-03-30T20:00:00.000Z",
          created_by: "  Alice  ",
          icon: "fa:dragon",
        },
        groupId: 77,
      } as any,
      res as any
    );
    expect(state.createGroupEvent).toHaveBeenCalledWith(
      77,
      "Bossing",
      "Bring supplies",
      "boss",
      "2026-03-30T18:00:00.000Z",
      "2026-03-30T20:00:00.000Z",
      "Alice",
      "fa:dragon"
    );
    expect(res.status).toHaveBeenCalledWith(201);

    res = makeRes();
    await deleteEvent({ params: { event_id: "NaN" }, groupId: 77 } as any, res as any);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith("Invalid event ID");

    state.deleteGroupEvent.mockResolvedValueOnce(false);
    res = makeRes();
    await deleteEvent({ params: { event_id: "9" }, groupId: 77 } as any, res as any);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.send).toHaveBeenCalledWith("Event not found");

    res = makeRes();
    await deleteEvent({ params: { event_id: "5" }, groupId: 77 } as any, res as any);
    expect(state.deleteGroupEvent).toHaveBeenCalledWith(77, 5);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("masks discord settings and validates webhook and member-id updates", async () => {
    const { authedRouter } = await loadRoutes();
    const getDiscordSettings = findRouteHandler(authedRouter, "get", "/discord-settings");
    const updateDiscordSettings = findRouteHandler(authedRouter, "put", "/discord-settings");

    state.getDiscordSettings.mockResolvedValueOnce({
      webhook_url: "https://discord.com/api/webhooks/a/b",
      members: [
        { name: "Alice", discord_id: "123" },
        { name: "Bob", discord_id: "" },
      ],
    });
    let res = makeRes();
    await getDiscordSettings({ groupId: 77 } as any, res as any);
    expect(res.json).toHaveBeenCalledWith({
      has_webhook: true,
      members: [
        { name: "Alice", has_discord_id: true },
        { name: "Bob", has_discord_id: false },
      ],
    });

    res = makeRes();
    await updateDiscordSettings(
      { body: { webhook_url: `https://discord.com/api/webhooks/${"x".repeat(190)}` }, groupId: 77 } as any,
      res as any
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith("Webhook URL must be 200 characters or less");

    res = makeRes();
    await updateDiscordSettings(
      { body: { webhook_url: "https://example.com/not-discord" }, groupId: 77 } as any,
      res as any
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith("Invalid Discord webhook URL");

    res = makeRes();
    await updateDiscordSettings(
      {
        body: {
          webhook_url: "https://discord.com/api/webhooks/a/b",
          members: [{ name: "Alice", discord_id: "bad-id" }],
        },
        groupId: 77,
      } as any,
      res as any
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith("Invalid Discord ID provided");

    res = makeRes();
    await updateDiscordSettings(
      {
        body: {
          webhook_url: "   ",
          members: [
            { name: "Alice", discord_id: " 123 " },
            { name: "Bob", discord_id: "" },
            { name: 7, discord_id: "999" },
          ],
        },
        groupId: 77,
      } as any,
      res as any
    );
    expect(state.updateDiscordSettings).toHaveBeenCalledWith(77, null, [
      { name: "Alice", discord_id: "123" },
    ]);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("validates request-item inputs and distinguishes no-webhook, success, and failure responses", async () => {
    const { authedRouter } = await loadRoutes();
    const requestItem = findRouteHandler(authedRouter, "post", "/request-item");

    let res = makeRes();
    await requestItem(
      { body: { item_name: "", quantity: 1, requested_by: "Alice" }, groupId: 77 } as any,
      res as any
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith("Invalid item name");

    res = makeRes();
    await requestItem(
      { body: { item_name: "Shark", quantity: 0, requested_by: "Alice" }, groupId: 77 } as any,
      res as any
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith("Invalid quantity");

    res = makeRes();
    await requestItem(
      { body: { item_name: "Shark", quantity: 1, requested_by: "" }, groupId: 77 } as any,
      res as any
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith("Invalid requester name");

    state.getDiscordSettings.mockResolvedValueOnce({ webhook_url: "", members: [] });
    res = makeRes();
    await requestItem(
      {
        body: { item_name: "Shark", quantity: 1, requested_by: "Alice", member_quantities: {} },
        groupId: 77,
      } as any,
      res as any
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith("No Discord webhook configured for this group");

    state.getDiscordSettings.mockResolvedValueOnce({
      webhook_url: "https://discord.com/api/webhooks/a/b",
      members: [
        { name: "Alice", discord_id: "111" },
        { name: "Bob", discord_id: "222" },
        { name: "Carol", discord_id: "" },
      ],
    });
    res = makeRes();
    await requestItem(
      {
        body: {
          item_name: "Shark",
          quantity: 2500,
          requested_by: "Alice",
          member_quantities: { Alice: 999, Bob: 1000, Carol: 2000 },
        },
        groupId: 77,
      } as any,
      res as any
    );
    expect(state.axiosPost).toHaveBeenCalledWith(
      "https://discord.com/api/webhooks/a/b",
      expect.objectContaining({
        username: "Group Ironmen",
        content: "<@222> **Alice** is requesting **2,500x Shark**",
        embeds: [
          expect.objectContaining({
            fields: expect.arrayContaining([
              { name: "Item", value: "Shark", inline: true },
              { name: "Quantity", value: "2,500", inline: true },
              { name: "Requested by", value: "Alice", inline: true },
              { name: "Current holders", value: "Bob: 1,000\nCarol: 2,000", inline: false },
            ]),
          }),
        ],
      }),
      expect.objectContaining({
        headers: { "Content-Type": "application/json" },
        timeout: 10000,
      })
    );
    expect(res.status).toHaveBeenCalledWith(200);

    state.getDiscordSettings.mockResolvedValueOnce({
      webhook_url: "https://discord.com/api/webhooks/a/b",
      members: [],
    });
    state.axiosPost.mockRejectedValueOnce(new Error("discord failed"));
    res = makeRes();
    await requestItem(
      {
        body: {
          item_name: "Shark",
          quantity: 1,
          requested_by: "Alice",
          member_quantities: {},
        },
        groupId: 77,
      } as any,
      res as any
    );
    expect(res.status).toHaveBeenCalledWith(500);
    expect(state.loggerError).toHaveBeenCalledWith("Error sending item request: discord failed");
  });
});