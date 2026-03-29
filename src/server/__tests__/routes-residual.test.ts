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

function makeRes() {
  return {
    status: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    end: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    type: vi.fn().mockReturnThis(),
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

async function loadRoutes() {
  return import("../routes");
}

describe("server routes residual branches", () => {
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

  it("covers create-group fallbacks and remaining member-management error branches", async () => {
    const { unauthedRouter, authedRouter } = await loadRoutes();
    const app = { locals: makeAppLocals() };

    const createGroup = findRouteHandler(unauthedRouter, "post", "/create-group");
    let res = makeRes();
    state.validName.mockReturnValueOnce(false);
    await createGroup({} as any, res as any);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith("Provided group name is not valid");

    state.config.hcaptcha.enabled = true;
    state.axiosPost.mockResolvedValueOnce({ data: { success: false } });
    res = makeRes();
    await createGroup({ body: { name: "Unit" } } as any, res as any);
    expect(state.axiosPost).toHaveBeenCalledWith(
      "https://hcaptcha.com/siteverify",
      expect.any(URLSearchParams),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );
    expect(String(state.axiosPost.mock.calls[0][1])).toBe("response=&secret=hsecret");
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith("Captcha response verification failed");

    const addGroupMember = findRouteHandler(authedRouter, "post", "/add-group-member");
    state.addGroupMember.mockRejectedValueOnce({ statusCode: "conflict" });
    res = makeRes();
    await addGroupMember({ body: { name: "Alice" }, app, groupId: 77 } as any, res as any);
    expect(res.type).toHaveBeenCalledWith("text/plain");
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith("Invalid request");

    state.addGroupMember.mockRejectedValueOnce(new Error("db exploded"));
    res = makeRes();
    await addGroupMember({ body: { name: "Alice" }, app, groupId: 77 } as any, res as any);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(state.loggerError).toHaveBeenCalledWith("Error adding group member: db exploded");

    const renameGroupMember = findRouteHandler(authedRouter, "put", "/rename-group-member");
    state.validName.mockReturnValueOnce(false);
    res = makeRes();
    await renameGroupMember({ app, groupId: 77 } as any, res as any);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith("Provided member name is not valid");

    state.renameGroupMember.mockRejectedValueOnce(new Error("rename failed"));
    res = makeRes();
    await renameGroupMember(
      { body: { original_name: "Old", new_name: "New" }, app, groupId: 77 } as any,
      res as any
    );
    expect(res.status).toHaveBeenCalledWith(500);
    expect(state.loggerError).toHaveBeenCalledWith("Error renaming group member: rename failed");

    const updateGroupMember = findRouteHandler(authedRouter, "post", "/update-group-member");
    state.isMemberInGroup.mockRejectedValueOnce(new Error("membership lookup failed"));
    res = makeRes();
    await updateGroupMember({ body: { name: "Alice" }, app, groupId: 77 } as any, res as any);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(state.loggerError).toHaveBeenCalledWith(
      "Error updating group member: membership lookup failed"
    );
  });

  it("covers remaining skill and event route branches, including defaulted event success", async () => {
    const { authedRouter } = await loadRoutes();
    const getSkillData = findRouteHandler(authedRouter, "get", "/get-skill-data");
    const getEvents = findRouteHandler(authedRouter, "get", "/events");
    const createEvent = findRouteHandler(authedRouter, "post", "/events");
    const deleteEvent = findRouteHandler(authedRouter, "delete", "/events/:event_id");

    let res = makeRes();
    await getSkillData({ query: { period: "Day" }, groupId: 77 } as any, res as any);
    expect(state.getSkillsForPeriod).toHaveBeenLastCalledWith(77, "day");

    res = makeRes();
    await getSkillData({ query: { period: "Month" }, groupId: 77 } as any, res as any);
    expect(state.getSkillsForPeriod).toHaveBeenLastCalledWith(77, "month");

    state.getSkillsForPeriod.mockRejectedValueOnce(new Error("skills failed"));
    res = makeRes();
    await getSkillData({ query: { period: "Day" }, groupId: 77 } as any, res as any);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(state.loggerError).toHaveBeenCalledWith("Error getting skill data: skills failed");

    state.getGroupEvents.mockRejectedValueOnce(new Error("events failed"));
    res = makeRes();
    await getEvents({ groupId: 77 } as any, res as any);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(state.loggerError).toHaveBeenCalledWith("Error getting group events: events failed");

    res = makeRes();
    await createEvent({} as any, res as any);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith("Title is required and must be 100 characters or less");

    res = makeRes();
    await createEvent(
      {
        body: {
          title: "Raid night",
          created_by: "Alice",
        },
        groupId: 77,
      } as any,
      res as any
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith("Event time is required");

    res = makeRes();
    await createEvent(
      {
        body: {
          title: "Raid night",
          event_time: "2026-03-30T18:00:00.000Z",
        },
        groupId: 77,
      } as any,
      res as any
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith("Created by is required");

    state.createGroupEvent.mockRejectedValueOnce({ statusCode: "db-public-error" });
    res = makeRes();
    await createEvent(
      {
        body: {
          title: "Raid night",
          event_time: "2026-03-30T18:00:00.000Z",
          created_by: "Alice",
        },
        groupId: 77,
      } as any,
      res as any
    );
    expect(res.type).toHaveBeenCalledWith("text/plain");
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith("Invalid request");

    state.createGroupEvent.mockRejectedValueOnce(new Error("calendar down"));
    res = makeRes();
    await createEvent(
      {
        body: {
          title: "Raid night",
          event_time: "2026-03-30T18:00:00.000Z",
          created_by: "Alice",
        },
        groupId: 77,
      } as any,
      res as any
    );
    expect(res.status).toHaveBeenCalledWith(500);
    expect(state.loggerError).toHaveBeenCalledWith("Error creating group event: calendar down");

    res = makeRes();
    await createEvent(
      {
        body: {
          title: "  Raid night  ",
          event_time: "2026-03-30T18:00:00.000Z",
          created_by: "  Alice  ",
        },
        groupId: 77,
      } as any,
      res as any
    );
    expect(state.createGroupEvent).toHaveBeenLastCalledWith(
      77,
      "Raid night",
      "",
      "boss",
      "2026-03-30T18:00:00.000Z",
      null,
      "Alice",
      ""
    );
    expect(res.status).toHaveBeenCalledWith(201);

    state.deleteGroupEvent.mockRejectedValueOnce(new Error("delete event failed"));
    res = makeRes();
    await deleteEvent({ params: { event_id: "9" }, groupId: 77 } as any, res as any);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(state.loggerError).toHaveBeenCalledWith("Error deleting group event: delete event failed");
  });

  it("covers discord settings response variants and remaining update failures", async () => {
    const { authedRouter } = await loadRoutes();
    const getDiscordSettings = findRouteHandler(authedRouter, "get", "/discord-settings");
    const updateDiscordSettings = findRouteHandler(authedRouter, "put", "/discord-settings");

    state.getDiscordSettings.mockResolvedValueOnce({
      webhook_url: "",
      members: [
        { name: "Alice", discord_id: "" },
        { name: "Bob", discord_id: "123" },
      ],
    });
    let res = makeRes();
    await getDiscordSettings({ groupId: 77 } as any, res as any);
    expect(res.json).toHaveBeenCalledWith({
      has_webhook: false,
      members: [
        { name: "Alice", has_discord_id: false },
        { name: "Bob", has_discord_id: true },
      ],
    });

    state.getDiscordSettings.mockRejectedValueOnce(new Error("settings read failed"));
    res = makeRes();
    await getDiscordSettings({ groupId: 77 } as any, res as any);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(state.loggerError).toHaveBeenCalledWith("Error getting discord settings: settings read failed");

    res = makeRes();
    await updateDiscordSettings(
      {
        body: {
          webhook_url: "  https://discordapp.com/api/webhooks/a/b  ",
        },
        groupId: 77,
      } as any,
      res as any
    );
    expect(state.updateDiscordSettings).toHaveBeenCalledWith(
      77,
      "https://discordapp.com/api/webhooks/a/b",
      []
    );
    expect(res.status).toHaveBeenCalledWith(200);

    state.updateDiscordSettings.mockRejectedValueOnce(new Error("settings write failed"));
    res = makeRes();
    await updateDiscordSettings(
      {
        body: {
          webhook_url: "https://discord.com/api/webhooks/a/b",
          members: [],
        },
        groupId: 77,
      } as any,
      res as any
    );
    expect(res.status).toHaveBeenCalledWith(500);
    expect(state.loggerError).toHaveBeenCalledWith("Error updating discord settings: settings write failed");
  });

  it("covers request-item body fallback, no-mention success, and service failure branches", async () => {
    const { authedRouter } = await loadRoutes();
    const requestItem = findRouteHandler(authedRouter, "post", "/request-item");

    let res = makeRes();
    await requestItem({ groupId: 77 } as any, res as any);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith("Invalid item name");

    state.getDiscordSettings.mockResolvedValueOnce({
      webhook_url: "https://discord.com/api/webhooks/a/b",
      members: [
        { name: "Alice", discord_id: "111" },
        { name: "Bob", discord_id: "222" },
      ],
    });
    res = makeRes();
    await requestItem(
      {
        body: {
          item_name: "Shark",
          quantity: 10,
          requested_by: "Alice",
        },
        groupId: 77,
      } as any,
      res as any
    );
    expect(state.axiosPost).toHaveBeenLastCalledWith(
      "https://discord.com/api/webhooks/a/b",
      {
        username: "Group Ironmen",
        content: "**Alice** is requesting **10x Shark**",
        embeds: [
          {
            title: "📦 Item Request",
            color: 0xff981f,
            fields: [
              { name: "Item", value: "Shark", inline: true },
              { name: "Quantity", value: "10", inline: true },
              { name: "Requested by", value: "Alice", inline: true },
            ],
            footer: {
              text: "Group Ironmen • Item Request",
            },
          },
        ],
      },
      {
        headers: { "Content-Type": "application/json" },
        timeout: 10000,
      }
    );
    expect(res.status).toHaveBeenCalledWith(200);

    state.getDiscordSettings.mockRejectedValueOnce(new Error("settings unavailable"));
    res = makeRes();
    await requestItem(
      {
        body: {
          item_name: "Shark",
          quantity: 10,
          requested_by: "Alice",
        },
        groupId: 77,
      } as any,
      res as any
    );
    expect(res.status).toHaveBeenCalledWith(500);
    expect(state.loggerError).toHaveBeenCalledWith("Error sending item request: settings unavailable");
  });
});