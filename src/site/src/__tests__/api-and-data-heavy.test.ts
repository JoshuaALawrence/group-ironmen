import { beforeEach, describe, expect, it, vi } from "vitest";

function mockResponse(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => body,
    text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
    body: undefined,
  } as Response;
}

describe("api and data modules", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("covers pubsub behavior", async () => {
    const { pubsub } = await import("../data/pubsub");
    const cb = vi.fn();
    pubsub.subscribe("x", cb, false);
    pubsub.publish("x", 1, 2, 3);
    expect(cb).toHaveBeenCalledWith(1, 2, 3);
    expect(pubsub.getMostRecent("x")).toEqual([1, 2, 3]);
    expect(pubsub.anyoneListening("x")).toBe(true);

    const once = pubsub.waitUntilNextEvent("y", false);
    pubsub.publish("y");
    await once;

    const all = pubsub.waitForAllEvents("a", "b");
    pubsub.publish("a");
    pubsub.publish("b");
    await all;

    pubsub.unpublish("x");
    expect(pubsub.getMostRecent("x")).toBeUndefined();
    pubsub.unpublishAll();
    pubsub.unsubscribe("x", cb);
  });

  it("covers quest loading and parsing", async () => {
    const questsPayload = {
      1: { name: "Cook's Assistant", difficulty: "Novice", points: "1", member: false },
      2: { name: "Monkey Madness", difficulty: "Master", points: 3, member: true },
      3: { name: "Tutorial Island", difficulty: "Special", points: "0", tutorial: true },
      4: { name: "Mage Arena", difficulty: "Intermediate", points: 2, miniquest: true },
      5: { name: "Hidden Quest", difficulty: "Experienced", points: 2, hidden: true },
    };

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse(questsPayload)));
    const { Quest, QuestState } = await import("../data/quest");

    await Quest.loadQuests();
    expect(Object.keys(Quest.freeToPlayQuests)).toContain("1");
    expect(Object.keys(Quest.memberQuests)).toContain("2");
    expect(Object.keys(Quest.tutorial)).toContain("3");
    expect(Object.keys(Quest.miniQuests)).toContain("4");
    expect(Quest.lookupByName.get("Cook's Assistant")).toBe("1");

    const parsed = Quest.parseQuestData({ 1: QuestState.FINISHED, 2: QuestState.NOT_STARTED });
    expect(parsed["1"].points).toBe(1);
    expect(parsed["2"].points).toBe(0);
    expect(parsed["2"].wikiLink).toContain("Monkey_Madness");
    expect(parsed["2"].icon).toContain("3403");
    expect(Array.isArray(Quest.randomQuestStates())).toBe(true);

    vi.unstubAllGlobals();
  });

  it("covers webhook status and storage-backed flow", async () => {
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

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse({ has_webhook: true })));
    const { storage } = await import("../data/storage");
    const { webhookStatus } = await import("../data/webhook-status");

    storage.storeGroup("MyGroup", "token");
    await webhookStatus.fetch();
    expect(webhookStatus.hasWebhook).toBe(true);

    await webhookStatus.ensure();

    storage.storeGroup("@EXAMPLE", "token");
    await webhookStatus.fetch();
    expect(webhookStatus.hasWebhook).toBe(false);

    vi.unstubAllGlobals();
  });

  it("covers api methods and group event processing", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes("captcha-enabled")) return mockResponse({ enabled: true, sitekey: "abc" });
      if (String(url).includes("get-group-data")) return mockResponse([{ name: "Alice" }]);
      if (String(url).includes("get-skill-data")) return mockResponse([{ name: "Alice", skill_data: [] }]);
      if (String(url).includes("group-events")) {
        const chunks = [new TextEncoder().encode("data: update\\n\\n")];
        return {
          ok: true,
          status: 200,
          body: {
            getReader() {
              let i = 0;
              return {
                async read() {
                  if (i >= chunks.length) return { done: true, value: undefined };
                  return { done: false, value: chunks[i++] };
                },
              };
            },
          },
        } as Response;
      }
      return mockResponse({ ok: true });
    });

    vi.stubGlobal("fetch", fetchMock as any);
    const pushStateSpy = vi.spyOn(window.history, "pushState").mockImplementation(() => undefined);

    const { api } = await import("../data/api");
    const { pubsub } = await import("../data/pubsub");
    const { groupData } = await import("../data/group-data");

    const updateSpy = vi.spyOn(groupData, "update").mockReturnValue(new Date("2024-01-01T00:00:00Z") as never);

    api.setCredentials("MyGroup", "tok");
    expect(api.authHeaders({ Accept: "application/json" })).toEqual({ Accept: "application/json", Authorization: "tok" });

    await api.createGroup("MyGroup", ["A"], "captcha");
    await api.addMember("A");
    await api.removeMember("A");
    await api.renameMember("A", "B");
    await api.amILoggedIn();
    await api.getGePrices();
    await api.getCaptchaEnabled();

    await api.getGroupData();
    expect(updateSpy).toHaveBeenCalled();

    await api.getSkillData("Year");
    expect(fetchMock).toHaveBeenCalled();

    const rem = api.processGroupEventBuffer("data: update\n\n: keep\n\npartial");
    expect(rem).toBe("partial");

    const fakeResponse = await fetchMock("/api/group/MyGroup/group-events");
    await api.consumeGroupEvents(fakeResponse as Response, new AbortController().signal);

    api.enable("MyGroup", "tok");
    pubsub.publish("item-data-loaded");
    pubsub.publish("quest-data-loaded");
    await Promise.resolve();
    await api.disable();
    await api.restart();

    pushStateSpy.mockRestore();
    vi.unstubAllGlobals();
  });

  it("covers example data helpers", async () => {
    const { exampleData } = await import("../data/example-data");
    const { SkillName } = await import("../data/skill");

    exampleData.members = {
      "group alt two": { skills: [1000], stats: [1, 2, 3, 4, 5, 6, 7], coordinates: [1, 1, 0] as [number, number, number] },
      Zezima: { coordinates: [2, 2, 0] as [number, number, number] },
      "Bank alt": {},
      "@SHARED": {},
    };

    exampleData.doXpDrop();
    expect(exampleData.members["group alt two"].skills?.[0]).toBe(1050);

    exampleData.doHealthUpdate();
    expect(exampleData.members["group alt two"].stats?.length).toBe(7);

    const groupData = exampleData.getGroupData();
    expect(Array.isArray(groupData)).toBe(true);

    const members = new Map<string, { name: string; skills?: Record<string, { xp: number }> }>();
    members.set("Example", {
      name: "Example",
      skills: Object.fromEntries(Object.values(SkillName).sort().map((n) => [n, { xp: 1000 }])) as Record<string, { xp: number }>,
    });

    exampleData.members["Example"] = { skills: Object.values(SkillName).map(() => 1000) };
    const skillData = exampleData.getSkillData("Day", { members });
    expect(skillData.length).toBe(1);
    expect(exampleData.getCollectionLog()).toEqual({});
  });
});