import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response;
}

function eventStreamResponse(chunks: string[], status = 200, ok = true): Response {
  const encodedChunks = chunks.map((chunk) => new TextEncoder().encode(chunk));

  return {
    ok,
    status,
    body: {
      getReader() {
        let index = 0;

        return {
          read: vi.fn(async () => {
            if (index >= encodedChunks.length) {
              return { done: true, value: undefined };
            }

            return { done: false, value: encodedChunks[index++] };
          }),
        };
      },
    },
  } as unknown as Response;
}

describe("api/example-data residual coverage", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();

    const { exampleData } = await import("../data/example-data");
    const { groupData } = await import("../data/group-data");
    const { pubsub } = await import("../data/pubsub");

    exampleData.disable();
    exampleData.members = {};
    exampleData.intervals = [];
    groupData.members = new Map();
    groupData.groupItems = {};
    groupData.textFilters = [""];
    pubsub.unpublishAll();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("covers api request helpers, auth branches, and interval cleanup", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith("/captcha-enabled")) {
        return jsonResponse({ enabled: true, sitekey: "site-key" });
      }

      return jsonResponse({ ok: true });
    });
    vi.stubGlobal("fetch", fetchMock);

    const { Api } = await import("../data/api");
    const { pubsub } = await import("../data/pubsub");
    const { utility } = await import("../utility");

    const api = new Api();
    expect(api.collectionLogInfoUrl).toBe("/api/collection-log-info");
    expect(api.authHeaders({ Accept: "application/json" })).toEqual({ Accept: "application/json" });

    api.setCredentials("Iron", "secret-token");
    expect(api.authHeaders({ Accept: "application/json" })).toEqual({
      Accept: "application/json",
      Authorization: "secret-token",
    });

    await api.createGroup("Iron", ["Alice", "Bob"], "captcha-value");
    await api.addMember(undefined);
    await api.removeMember("Alice");
    await api.renameMember("Alice", "Alicia");
    await api.amILoggedIn();
    await api.getGePrices();
    await expect(api.getCaptchaEnabled()).resolves.toEqual({ enabled: true, sitekey: "site-key" });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/create-group",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Iron",
          member_names: ["Alice", "Bob"],
          captcha_response: "captcha-value",
        }),
      })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/group/Iron/add-group-member",
      expect.objectContaining({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "secret-token",
        },
        body: JSON.stringify({ name: undefined }),
      })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "/api/group/Iron/delete-group-member",
      expect.objectContaining({
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: "secret-token",
        },
        body: JSON.stringify({ name: "Alice" }),
      })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      "/api/group/Iron/rename-group-member",
      expect.objectContaining({
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: "secret-token",
        },
        body: JSON.stringify({ original_name: "Alice", new_name: "Alicia" }),
      })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      5,
      "/api/group/Iron/am-i-logged-in",
      expect.objectContaining({ headers: { Authorization: "secret-token" } })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(6, "/api/ge-prices");
    expect(fetchMock).toHaveBeenNthCalledWith(7, "/api/captcha-enabled");

    const waitForAllEventsSpy = vi.spyOn(pubsub, "waitForAllEvents").mockResolvedValue(undefined);
    const callOnIntervalSpy = vi.spyOn(utility, "callOnInterval").mockReturnValue(77);
    const clearIntervalSpy = vi.spyOn(window, "clearInterval").mockImplementation(() => undefined);

    api.exampleDataEnabled = true;
    await api.enable("Iron", "secret-token");

    expect(waitForAllEventsSpy).toHaveBeenCalledWith("item-data-loaded", "quest-data-loaded");
    expect(callOnIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 1000);
    expect(api.usingIntervalUpdates).toBe(true);

    await api.disable();

    expect(clearIntervalSpy).toHaveBeenCalledWith(77);
    expect(api.groupName).toBeUndefined();
    expect(api.groupToken).toBeUndefined();
    expect(api.usingIntervalUpdates).toBe(false);
  });

  it("covers group-data sync, fetch status branches, and skill-data delegation", async () => {
    const { Api } = await import("../data/api");
    const { groupData } = await import("../data/group-data");
    const { pubsub } = await import("../data/pubsub");
    const { exampleData } = await import("../data/example-data");

    const api = new Api();
    api.setCredentials("Iron", "token");

    const updateSpy = vi.spyOn(groupData, "update").mockReturnValue(new Date("2024-02-03T04:05:06.000Z") as never);
    const publishSpy = vi.spyOn(pubsub, "publish");
    const pushStateSpy = vi.spyOn(window.history, "pushState").mockImplementation(() => undefined);

    api.exampleDataEnabled = true;
    const exampleGroupData = [{ name: "Example" }];
    const exampleGetGroupDataSpy = vi.spyOn(exampleData, "getGroupData").mockReturnValue(exampleGroupData as never);
    const exampleGetSkillDataSpy = vi.spyOn(exampleData, "getSkillData").mockReturnValue([{ name: "Example", skill_data: [] }] as never);

    await api.getGroupData();
    await expect(api.getSkillData("Week")).resolves.toEqual([{ name: "Example", skill_data: [] }]);

    expect(exampleGetGroupDataSpy).toHaveBeenCalled();
    expect(updateSpy).toHaveBeenCalledWith(exampleGroupData);
    expect(publishSpy).toHaveBeenCalledWith("get-group-data", groupData);
    expect(exampleGetSkillDataSpy).toHaveBeenCalledWith("Week", groupData);

    api.exampleDataEnabled = false;
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse({}, false, 401))
        .mockResolvedValueOnce(jsonResponse({}, false, 500))
        .mockResolvedValueOnce(jsonResponse([{ name: "Live" }]))
        .mockResolvedValueOnce(jsonResponse([{ name: "Skill", skill_data: [1, 2, 3] }]))
    );

    const disableSpy = vi.spyOn(api, "disable").mockImplementation(async () => {
      api.enabled = false;
    });

    await api.getGroupData();
    expect(disableSpy).toHaveBeenCalledTimes(1);
    expect(pushStateSpy).toHaveBeenCalledWith("", "", "/login");
    expect(publishSpy).toHaveBeenCalledWith("get-group-data");

    publishSpy.mockClear();
    pushStateSpy.mockClear();
    updateSpy.mockClear();

    await api.getGroupData();
    expect(pushStateSpy).not.toHaveBeenCalled();
    expect(publishSpy).not.toHaveBeenCalled();
    expect(updateSpy).not.toHaveBeenCalled();

    await api.getGroupData();
    expect(updateSpy).toHaveBeenCalledWith([{ name: "Live" }]);
    expect(api.nextCheck).toBe("2024-02-03T04:05:06.000Z");

    await expect(api.getSkillData("Year")).resolves.toEqual([{ name: "Skill", skill_data: [1, 2, 3] }]);

    const fetchCalls = vi.mocked(fetch);
    expect(fetchCalls).toHaveBeenNthCalledWith(
      4,
      "/api/group/Iron/get-skill-data?period=Year",
      expect.objectContaining({ headers: { Authorization: "token" } })
    );

    let syncCalls = 0;
    const getGroupDataSpy = vi.spyOn(api, "getGroupData").mockImplementation(async () => {
      syncCalls += 1;
      if (syncCalls === 1) {
        api.groupDataSyncQueued = true;
        return;
      }

      api.enabled = false;
    });

    api.enabled = false;
    await api.triggerGroupDataSync();
    expect(getGroupDataSpy).not.toHaveBeenCalled();

    api.enabled = true;
    await api.triggerGroupDataSync();
    expect(getGroupDataSpy).toHaveBeenCalledTimes(2);
    expect(api.groupDataSyncInFlight).toBe(false);
    expect(api.groupDataSyncQueued).toBe(false);

    api.enabled = true;
    api.groupDataSyncInFlight = true;
    await api.triggerGroupDataSync();
    expect(api.groupDataSyncQueued).toBe(true);
  });

  it("covers group event streaming, start/stop wrappers, and error handling", async () => {
    vi.useFakeTimers();

    const { Api } = await import("../data/api");
    const { pubsub } = await import("../data/pubsub");

    const api = new Api();
    api.setCredentials("Iron", "stream-token");

    const triggerSpy = vi.spyOn(api, "triggerGroupDataSync").mockResolvedValue(undefined);
    expect(api.processGroupEventBuffer("partial-only")).toBe("partial-only");
    expect(api.processGroupEventBuffer("data: update\n\n: comment\n\npartial")).toBe("partial");
    expect(triggerSpy).toHaveBeenCalledTimes(1);

    await expect(api.consumeGroupEvents(jsonResponse({}) as Response, new AbortController().signal)).rejects.toThrow(
      "Group event stream did not include a readable body."
    );

    triggerSpy.mockClear();
    api.enabled = true;
    await api.consumeGroupEvents(eventStreamResponse(["data: first\r\n\r\npartial", "\n: keepalive\n\n"]) as Response, new AbortController().signal);
    expect(triggerSpy).toHaveBeenCalledTimes(1);

    const runGroupEventsLoopSpy = vi.spyOn(api, "runGroupEventsLoop").mockResolvedValue(undefined);
    api.startGroupEvents();
    expect(api.groupEventsAbortController).toBeInstanceOf(AbortController);
    expect(runGroupEventsLoopSpy).toHaveBeenCalledWith(api.groupEventsAbortController?.signal as AbortSignal);
    expect(api.groupEventsTask).toBeInstanceOf(Promise);
    runGroupEventsLoopSpy.mockRestore();

    const abortSpy = vi.fn();
    api.groupEventsAbortController = { abort: abortSpy, signal: new AbortController().signal } as unknown as AbortController;
    api.groupEventsTask = Promise.resolve();
    await api.disable();
    expect(abortSpy).toHaveBeenCalledTimes(1);
    expect(api.groupEventsTask).toBeUndefined();

    const pushStateSpy = vi.spyOn(window.history, "pushState").mockImplementation(() => undefined);
    const publishSpy = vi.spyOn(pubsub, "publish");
    const disableSpy = vi.spyOn(api, "disable").mockImplementation(async () => {
      api.enabled = false;
    });

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({}, false, 401)));
    api.enabled = true;
    await api.runGroupEventsLoop(new AbortController().signal);
    expect(disableSpy).toHaveBeenCalledTimes(1);
    expect(pushStateSpy).toHaveBeenCalledWith("", "", "/login");
    expect(publishSpy).toHaveBeenCalledWith("get-group-data");

    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const abortingController = new AbortController();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async () => {
        abortingController.abort();
        throw new Error("network aborted");
      })
    );

    api.enabled = true;
    await api.runGroupEventsLoop(abortingController.signal);
    expect(consoleErrorSpy).not.toHaveBeenCalled();

    const steadyController = new AbortController();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({}, false, 503)));
    api.enabled = true;
    const loopPromise = api.runGroupEventsLoop(steadyController.signal);
    await Promise.resolve();
    await Promise.resolve();
    api.enabled = false;
    await vi.advanceTimersByTimeAsync(1000);
    await loopPromise;

    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.any(Error));
  });

  it("covers example-data enable/reset/state reduction and skill generation branches", async () => {
    const { exampleData } = await import("../data/example-data");
    const { utility } = await import("../utility");
    const { SkillName } = await import("../data/skill");
    const { SkillGraph } = await import("../skill-graph/skill-graph");
    const { GroupData } = await import("../data/group-data");
    const { Item } = await import("../data/item");
    const { Quest } = await import("../data/quest");
    const { AchievementDiary } = await import("../data/diaries");

    const clearIntervalSpy = vi.spyOn(window, "clearInterval").mockImplementation(() => undefined);
    const scheduledCallbacks: Array<() => void> = [];
    vi.spyOn(utility, "callOnInterval").mockImplementation((fn) => {
      scheduledCallbacks.push(fn as () => void);
      return scheduledCallbacks.length * 100;
    });
    vi.spyOn(Item, "randomItems").mockImplementation((_count: number, quantity?: number) => [995, quantity ?? 1]);
    vi.spyOn(Quest, "randomQuestStates").mockReturnValue([0, 1, 2]);
    vi.spyOn(AchievementDiary, "randomDiaries").mockReturnValue([1, 2, 3]);

    exampleData.intervals = [11, 12];
    exampleData.enable();

    expect(clearIntervalSpy).toHaveBeenCalledWith(11);
    expect(clearIntervalSpy).toHaveBeenCalledWith(12);
    expect(exampleData.intervals).toEqual([100, 200, 300]);
    expect(exampleData.members.Zezima.coordinates).toEqual([3029, 3000, 0]);
    expect(exampleData.members["group alt two"].inventory?.length).toBeGreaterThan(0);
    expect(exampleData.members["Bank alt"].bank?.length).toBeGreaterThan(2);

    exampleData.members.Zezima.coordinates = [10, 20, 2];
    scheduledCallbacks[2]();
    expect(exampleData.members.Zezima.coordinates).toEqual([11, 20, 3]);

    scheduledCallbacks[2]();
    expect(exampleData.members.Zezima.coordinates).toEqual([12, 20, 0]);

    const previousXp = exampleData.members["group alt two"].skills?.[0] as number;
    scheduledCallbacks[1]();
    expect(exampleData.members["group alt two"].skills?.[0]).toBe(previousXp + 50);

    vi.spyOn(Math, "random").mockReturnValue(0);
    scheduledCallbacks[0]();
    expect(exampleData.members["group alt two"].stats).toEqual([1, 93, 13, 70, 75, 100, 330]);

    exampleData.disable();
    expect(clearIntervalSpy).toHaveBeenCalledWith(100);
    expect(clearIntervalSpy).toHaveBeenCalledWith(200);
    expect(clearIntervalSpy).toHaveBeenCalledWith(300);
    expect(exampleData.intervals).toEqual([]);

    exampleData.members = {
      Skilled: { skills: [1, 2, 3], coordinates: [1, 2, 0] },
      External: {},
      Zezima: { coordinates: [5, 6, 1] },
      "group alt two": { skills: [7, 8, 9] },
      "Bank alt": { bank: [995, 100] },
      "@SHARED": { bank: [995, 250] },
    };

    const reducedGroupData = exampleData.getGroupData();
    expect(reducedGroupData).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "Skilled", skills: [1, 2, 3] }),
        expect.objectContaining({ name: "External" }),
      ])
    );
    expect(exampleData.members).toEqual({
      "group alt two": { skills: [7, 8, 9] },
      Zezima: { coordinates: [5, 6, 1] },
      "Bank alt": {},
      "@SHARED": {},
    });

    const skillCount = Object.values(SkillName).filter((skillName) => skillName !== SkillName.Overall).length;
    const storedSkills = Array.from({ length: skillCount }, (_, index) => index + 1000);
    const transformedSkills = GroupData.transformSkillsFromStorage(storedSkills)!;
    const toMemberSkillRecord = () => {
      return Object.fromEntries(Object.entries(transformedSkills).map(([skillName, xp]) => [skillName, { xp }])) as Record<
        string,
        { xp: number }
      >;
    };

    exampleData.members = {
      Skilled: { skills: [...storedSkills] },
      External: {},
    };

    vi.spyOn(SkillGraph, "datesForPeriod").mockReturnValue([
      new Date("2024-01-01T00:00:00.000Z"),
      new Date("2024-01-02T00:00:00.000Z"),
    ]);
    vi.spyOn(Math, "random").mockReturnValue(0);

    const members = new Map<string, { name: string; skills?: Record<string, { xp: number }> }>([
      ["Skilled", { name: "Skilled", skills: toMemberSkillRecord() }],
      ["External", { name: "External", skills: toMemberSkillRecord() }],
      ["NoSkills", { name: "NoSkills" }],
    ]);

    const skillData = exampleData.getSkillData("Day", { members });
    expect(skillData).toHaveLength(2);
    expect(skillData[0]?.skill_data).toHaveLength(2);
    expect(skillData.map((member) => member.name)).toEqual(["Skilled", "External"]);
    expect(members.get("Skilled")?.skills?.[SkillName.Overall]?.xp).toBeGreaterThan(0);
    expect(exampleData.members.Skilled.skills).toHaveLength(Object.values(SkillName).length);
    expect(exampleData.members.External.skills).toBeUndefined();
    expect(exampleData.getCollectionLog()).toEqual({});
  });
});