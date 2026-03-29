import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HomePage } from "../home-page/home-page";
import { collectionLog } from "../data/collection-log";
import { GroupData, groupData } from "../data/group-data";
import { Item } from "../data/item";
import { pubsub } from "../data/pubsub";
import { Quest, QuestState } from "../data/quest";
import { SkillName } from "../data/skill";
import { storage } from "../data/storage";

function flushPromises(): Promise<void> {
  return Promise.resolve().then(() => Promise.resolve());
}

function resetPubsub() {
  pubsub.subscribers = new Map();
  pubsub.mostRecentPublish = new Map();
}

function resetCollectionLog() {
  collectionLog.info = [];
  collectionLog.duplicateMapping = new Map();
  collectionLog.pageItems = new Map();
  collectionLog.totalUniqueItems = 0;
  collectionLog.playerLogs = new Map();
  collectionLog.playerNames = [];
  collectionLog.otherPlayers = [];
}

function homeShell(): string {
  return `
    <div class="home-page__news-list"></div>
    <div class="home-page__events-list"></div>
    <div class="home-page__yt-list"></div>
    <div class="home-page__twitch-card"></div>
    <div class="home-page__members"></div>
    <div class="home-page__stats-grid"></div>
  `;
}

function makeMember(
  name: string,
  overrides: Record<string, unknown> = {}
): {
  name: string;
  inactive: boolean;
  quests: Record<string, { id: string; state: string }>;
  diaries: Record<string, Record<string, boolean[]>> | null;
  skills: Record<string, { name: string; level: number; xp?: number }> | undefined;
  combatLevel: number;
  allItems: () => Array<{ id: number; gePrice?: number }>;
  totalItemQuantity: (id: number) => number;
} {
  return {
    name,
    inactive: false,
    quests: {
      1: { id: "1", state: QuestState.NOT_STARTED },
    },
    diaries: {
      Karamja: {
        Easy: [true, false],
      },
    },
    skills: {
      [SkillName.Overall]: { name: SkillName.Overall, level: 800, xp: 8_000_000 },
      [SkillName.Attack]: { name: SkillName.Attack, level: 80 },
      [SkillName.Magic]: { name: SkillName.Magic, level: 70 },
      [SkillName.Woodcutting]: { name: SkillName.Woodcutting, level: 60 },
    },
    combatLevel: 90,
    allItems: () => [{ id: 20, gePrice: 250 }],
    totalItemQuantity: () => 2,
    ...overrides,
  };
}

describe("home and group data extra coverage", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();

    resetPubsub();
    resetCollectionLog();

    groupData.members = new Map();
    groupData.groupItems = {};

    Item.itemDetails = {};
    Item.itemNameToId = {};
    Item.gePrices = {};

    Quest.questData = {
      1: { name: "Quest One", difficulty: "Novice", points: 2 },
    } as never;
    Quest.questIds = [1] as never;
    Quest.totalPoints = 2;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    storage.clearGroup();
    resetPubsub();
  });

  it("connects home-page, fetches events without auth, and unsubscribes on removal", async () => {
    const home = new HomePage();
    const renderSpy = vi.spyOn(home, "render").mockImplementation(() => {
      home.innerHTML = homeShell();
    });
    const fetchBlogPostsSpy = vi.spyOn(home, "fetchBlogPosts").mockResolvedValue();
    const fetchYtVideosSpy = vi.spyOn(home, "fetchYtVideos").mockResolvedValue();
    const fetchTwitchStreamSpy = vi.spyOn(home, "fetchTwitchStream").mockResolvedValue();
    const fetchEventsSpy = vi.spyOn(home, "fetchEvents");
    const renderEventsSpy = vi.spyOn(home, "renderEvents");
    const updateDashboardSpy = vi.spyOn(home, "updateDashboard");

    vi.spyOn(storage, "getGroup").mockReturnValue({ groupName: "IRONMEN", groupToken: "" } as never);

    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toBe("/api/group/IRONMEN/events");
      expect(init).toEqual({ headers: {} });
      return {
        ok: true,
        json: async () => [
          {
            event_id: 1,
            title: "Future Event",
            event_type: "boss",
            event_time: "2099-01-01T00:00:00.000Z",
            event_end_time: null,
            icon: "",
          },
        ],
      } as Response;
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    document.body.appendChild(home);
    await flushPromises();

    expect(renderSpy).toHaveBeenCalledOnce();
    expect(fetchBlogPostsSpy).toHaveBeenCalledOnce();
    expect(fetchEventsSpy).toHaveBeenCalledOnce();
    expect(fetchYtVideosSpy).toHaveBeenCalledOnce();
    expect(fetchTwitchStreamSpy).toHaveBeenCalledOnce();
    expect(renderEventsSpy).toHaveBeenCalledOnce();
    expect(home.upcomingEvents.map((event) => event.title)).toEqual(["Future Event"]);
    expect(pubsub.anyoneListening("members-updated")).toBe(true);

    const alice = makeMember("Alice");
    pubsub.publish("members-updated", [alice]);

    expect(home.members).toEqual([alice]);
    expect(updateDashboardSpy).toHaveBeenCalledOnce();
    expect(home.querySelector(".home-page__members")?.textContent).toContain("Alice");

    home.remove();

    expect(pubsub.anyoneListening("members-updated")).toBe(false);
  });

  it("keeps only counted skills and known quest point data in home-page helpers", () => {
    const home = new HomePage();
    const topSkills = home.getTopSkills(
      makeMember("Alice", {
        skills: {
          [SkillName.Overall]: { name: SkillName.Overall, level: 1_200, xp: 12_000_000 },
          [SkillName.Attack]: { name: SkillName.Attack, level: 92 },
          [SkillName.Magic]: { name: SkillName.Magic, level: 88 },
          [SkillName.Woodcutting]: { name: SkillName.Woodcutting, level: 77 },
        },
      }) as never,
      2
    );

    expect(topSkills).toEqual([
      { name: SkillName.Attack, level: 92 },
      { name: SkillName.Magic, level: 88 },
    ]);

    const bestQuestPoints = home.getGroupQuestPoints([
      makeMember("Alice", {
        quests: {
          1: { id: "1", state: QuestState.FINISHED },
          999: { id: "999", state: QuestState.FINISHED },
        },
      }) as never,
      makeMember("Bob", {
        quests: {
          1: { id: "1", state: QuestState.NOT_STARTED },
        },
      }) as never,
    ]);

    expect(bestQuestPoints).toBe(2);
  });

  it("removes departed member quantities without rebuilding inventory state and supports inventory lookups", () => {
    Item.itemDetails = {
      10: { id: 10, name: "Bob relic", highalch: 1, isTradeable: true },
      20: { id: 20, name: "Shared ore", highalch: 2, isTradeable: true },
    };

    const group = new GroupData();
    group.update([
      {
        name: "Alice",
        inventory: [20, 1],
        last_updated: "2024-01-01T00:00:00.000Z",
      },
      {
        name: "Bob",
        inventory: [10, 5, 20, 5],
        last_updated: "2024-01-01T00:00:00.000Z",
      },
    ] as never);

    const publishSpy = vi.spyOn(pubsub, "publish");

    const nextRefresh = group.update([
      {
        name: "Alice",
        stats: { hp: 99 },
        last_updated: "2024-01-02T00:00:00.000Z",
      },
    ] as never);

    expect(nextRefresh.toISOString()).toBe("2024-01-02T00:00:00.001Z");
    expect([...group.members.keys()]).toEqual(["Alice"]);
    expect(group.groupItems[10]).toBeUndefined();
    expect(group.groupItems[20]?.quantity).toBe(1);
    expect(group.groupItems[20]?.quantities).toEqual({ Alice: 1 });
    expect(group.inventoryQuantityForItem(20, "Alice", "inventory")).toBe(1);
    expect(group.inventoryQuantityForItem(20, "Alice", "bank")).toBe(0);
    expect(group.inventoryQuantityForItem(20, "Missing", "inventory")).toBe(0);
    expect(publishSpy.mock.calls.some(([eventName]) => eventName === "members-updated")).toBe(true);
    expect(publishSpy.mock.calls.some(([eventName]) => eventName === "items-updated")).toBe(true);
  });

  it("covers single-variant degraded display items and direct helper branches in group-data", () => {
    const group = new GroupData();
    group.groupItems = {
      30: {
        id: 30,
        name: "Crystal shield 50",
        quantity: 1,
        quantities: { Alice: 1 },
        visible: true,
        isTradeable: false,
        highAlch: 10,
        gePrice: 50,
        imageUrl: "/50.webp",
        wikiLink: "/50",
      },
      31: {
        id: 31,
        name: "Hidden blade",
        quantity: 1,
        quantities: { Alice: 1 },
        visible: false,
        isTradeable: true,
        highAlch: 5,
        gePrice: 5,
        imageUrl: "/hidden.webp",
        wikiLink: "/hidden",
      },
    } as never;

    const displayItems = group.getDisplayItems();
    expect(displayItems).toHaveLength(1);
    expect(displayItems[0]?.name).toBe("Crystal shield 50");

    const grouped = GroupData.createGroupedItem("Unknown relic", [
      {
        id: 41,
        name: "Unknown relic 75",
        quantity: 2,
        quantities: { Alice: 2 },
        visible: true,
        isTradeable: false,
        highAlch: 7,
        gePrice: 75,
        imageUrl: "/75.webp",
        wikiLink: "/75",
      },
      {
        id: 42,
        name: "Unknown relic 25",
        quantity: 1,
        quantities: { Bob: 1 },
        visible: true,
        isTradeable: false,
        highAlch: 3,
        gePrice: 25,
        imageUrl: "/25.webp",
        wikiLink: "/25",
      },
    ] as never);

    group.members = new Map([
      ["Alice", { name: "Alice" } as never],
      ["Bob", { name: "Bob" } as never],
    ]);

    expect(grouped.isTradeable).toBe(false);
    expect(grouped.variantIds).toEqual([41, 42]);
    expect(group.convertFilterToFilterList("crystal shield")).toEqual(["crystal shield"]);
    expect(group.isExactItem(grouped as never, '"41"')).toBe(true);
    expect(group.quantitiesEqual({ Alice: 1, Bob: 0 }, { Alice: 1, Bob: 0 })).toBe(true);
    expect(group.quantitiesEqual(undefined, { Alice: 1, Bob: 0 })).toBe(false);
  });
});