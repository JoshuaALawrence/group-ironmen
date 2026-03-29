import { beforeEach, describe, expect, it, vi } from "vitest";

describe("quickselect", () => {
  it("partitions values around kth element", async () => {
    const mod = await import("../quick-select");
    const quickselect = mod.default;

    const arr = [9, 1, 4, 7, 3, 2, 6, 5, 8];
    quickselect(arr, 4);

    const pivot = arr[4];
    expect(arr.slice(0, 4).every((x) => x <= pivot)).toBe(true);
    expect(arr.slice(5).every((x) => x >= pivot)).toBe(true);
  });

  it("supports custom compare and deep ranges", async () => {
    const mod = await import("../quick-select");
    const quickselect = mod.default;

    const arr = Array.from({ length: 800 }, (_, i) => 800 - i);
    quickselect(arr, 400, 0, arr.length - 1, (a, b) => a - b);
    expect(arr[400]).toBeGreaterThanOrEqual(arr[399]);
  });
});

const initState = vi.hoisted(() => ({
  itemLoadItems: vi.fn(),
  itemLoadGePrices: vi.fn(),
  questLoadQuests: vi.fn(),
  diaryLoadDiaries: vi.fn(),
  apiEnable: vi.fn(),
  apiDisable: vi.fn(),
  apiExampleDataEnabled: false,
  pubsubPublish: vi.fn(),
  pubsubUnpublishAll: vi.fn(),
  pubsubWaitUntilNextEvent: vi.fn(),
  storageGetGroup: vi.fn(),
  storageGetActiveMember: vi.fn(),
  storageSetActiveMember: vi.fn(),
  loadingShow: vi.fn(),
  loadingHide: vi.fn(),
  exampleEnable: vi.fn(),
  exampleDisable: vi.fn(),
  selectMember: vi.fn(),
  membersMap: new Map<string, any>(),
}));

vi.mock("../data/item", () => ({
  Item: {
    loadItems: initState.itemLoadItems,
    loadGePrices: initState.itemLoadGePrices,
  },
}));

vi.mock("../data/quest", () => ({
  Quest: {
    loadQuests: initState.questLoadQuests,
  },
}));

vi.mock("../data/diaries", () => ({
  AchievementDiary: {
    loadDiaries: initState.diaryLoadDiaries,
  },
}));

vi.mock("../data/api", () => ({
  api: {
    enable: initState.apiEnable,
    disable: initState.apiDisable,
    get exampleDataEnabled() {
      return initState.apiExampleDataEnabled;
    },
    set exampleDataEnabled(v: boolean) {
      initState.apiExampleDataEnabled = v;
    },
  },
}));

vi.mock("../data/storage", () => ({
  storage: {
    getGroup: initState.storageGetGroup,
    getActiveMember: initState.storageGetActiveMember,
    setActiveMember: initState.storageSetActiveMember,
  },
}));

vi.mock("../data/pubsub", () => ({
  pubsub: {
    publish: initState.pubsubPublish,
    unpublishAll: initState.pubsubUnpublishAll,
    waitUntilNextEvent: initState.pubsubWaitUntilNextEvent,
  },
}));

vi.mock("../loading-screen/loading-screen-manager", () => ({
  loadingScreenManager: {
    showLoadingScreen: initState.loadingShow,
    hideLoadingScreen: initState.loadingHide,
  },
}));

vi.mock("../data/example-data", () => ({
  exampleData: {
    enable: initState.exampleEnable,
    disable: initState.exampleDisable,
  },
}));

vi.mock("../data/group-data", () => ({
  groupData: {
    members: initState.membersMap,
  },
}));

vi.mock("../member-select-dialog/member-select-dialog-manager", () => ({
  memberSelectDialogManager: {
    selectMember: initState.selectMember,
  },
}));

describe("app initializer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    initState.itemLoadItems.mockResolvedValue(undefined);
    initState.itemLoadGePrices.mockResolvedValue(undefined);
    initState.questLoadQuests.mockResolvedValue(undefined);
    initState.diaryLoadDiaries.mockResolvedValue(undefined);
    initState.apiEnable.mockResolvedValue(undefined);
    initState.apiDisable.mockResolvedValue(undefined);
    initState.pubsubWaitUntilNextEvent.mockResolvedValue(undefined);
    initState.storageSetActiveMember.mockResolvedValue(undefined);
    initState.selectMember.mockResolvedValue("Alice");
    initState.membersMap = new Map<string, any>([
      ["Alice", { name: "Alice" }],
      ["Bob", { name: "Bob" }],
      ["@SHARED", { name: "@SHARED" }],
    ]);
  });

  it("initializes login flow, example flow, and normal group flow", async () => {
    const pushStateSpy = vi.spyOn(window.history, "pushState").mockImplementation(() => undefined);
    const { AppInitializer } = await import("../app-initializer/app-initializer");

    const app = new AppInitializer();
    Object.defineProperty(app, "isConnected", { value: true });

    initState.storageGetGroup.mockReturnValueOnce(null);
    await app.initializeApp();
    expect(pushStateSpy).toHaveBeenCalledWith("", "", "/login");

    initState.storageGetGroup.mockReturnValueOnce({ groupName: "@EXAMPLE", groupToken: "tok" });
    await app.initializeApp();
    expect(initState.exampleEnable).toHaveBeenCalled();
    expect(initState.apiEnable).toHaveBeenCalled();

    initState.storageGetGroup.mockReturnValueOnce({ groupName: "MyGroup", groupToken: "tok" });
    initState.storageGetActiveMember.mockReturnValueOnce("Alice");
    await app.initializeApp();
    expect(initState.apiEnable).toHaveBeenCalledWith("MyGroup", "tok");
    expect(initState.pubsubPublish).toHaveBeenCalledWith("active-member-changed", "Alice");

    pushStateSpy.mockRestore();
  });

  it("asks for active member when none saved and cleans up", async () => {
    const { AppInitializer } = await import("../app-initializer/app-initializer");
    const app = new AppInitializer();
    Object.defineProperty(app, "isConnected", { value: true });

    initState.storageGetActiveMember.mockReturnValueOnce(null);
    await app.ensureActiveMember("MyGroup");
    expect(initState.selectMember).toHaveBeenCalledWith(["Alice", "Bob"]);
    expect(initState.storageSetActiveMember).toHaveBeenCalledWith("Alice");

    app.cleanup();
    expect(initState.apiDisable).toHaveBeenCalled();
    expect(initState.pubsubUnpublishAll).toHaveBeenCalled();
    expect(initState.exampleDisable).toHaveBeenCalled();
  });
});