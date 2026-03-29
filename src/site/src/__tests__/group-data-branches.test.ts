import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { collectionLog } from "../data/collection-log";
import { GroupData } from "../data/group-data";
import { Item } from "../data/item";
import { pubsub } from "../data/pubsub";
import { Quest, QuestState } from "../data/quest";

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

describe("group-data branches", () => {
  beforeEach(() => {
    resetPubsub();
    resetCollectionLog();

    Item.itemDetails = {
      1: { id: 1, name: "Coins", highalch: 1, isTradeable: true },
      2: { id: 2, name: "Untradeable token", highalch: 1, isTradeable: false },
      3: { id: 3, name: "Bob-only relic", highalch: 1, isTradeable: true },
      4: { id: 4, name: "Collection shard", highalch: 1, isTradeable: true },
      5: { id: 5, name: "Mystic robe", highalch: 1, isTradeable: true },
      6: { id: 6, name: "Mystic robe 100", highalch: 1, isTradeable: false },
      7: { id: 7, name: "Mystic robe 75", highalch: 1, isTradeable: false },
      8: { id: 8, name: "Already parsed", highalch: 1, isTradeable: true },
    };
    Item.itemNameToId = {
      coins: 1,
      "untradeable token": 2,
      "bob-only relic": 3,
      "collection shard": 4,
      "mystic robe": 5,
      "already parsed": 8,
    };
    Item.gePrices = { 5: 555 };

    Quest.questIds = [101, 102];
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    resetPubsub();
    resetCollectionLog();
  });

  it("transforms partial storage payloads and exercises filter edge cases", () => {
    const group = new GroupData();
    const rawMembers = [
      {
        name: "Alice",
        inventory: [1, 2, 3],
        bank: [{ id: 8, quantity: 4 }],
        skills: [10, 20],
        stats: [99, 100, 50, 60, 7000],
        coordinates: [3200, 3199, 1],
        quests: [2, 0],
        collection_log_v2: [4, 1],
        interacting: { location: { x: 50, y: 60, plane: 2 } },
      },
    ];

    const [normalized] = group.transformFromStorage(rawMembers as never);
    expect(GroupData.transformItemsFromStorage(undefined)).toBeUndefined();
    expect(GroupData.transformSkillsFromStorage(null)).toBeUndefined();
    expect(GroupData.transformStatsFromStorage(undefined)).toBeUndefined();
    expect(GroupData.transformCoordinatesFromStorage(null)).toBeUndefined();
    expect(GroupData.transformQuestsFromStorage(undefined)).toBeUndefined();

    expect(normalized?.inventory).toEqual([
      { id: 1, quantity: 2 },
      { id: 3, quantity: undefined },
    ]);
    expect(normalized?.bank).toEqual([{ id: 8, quantity: 4 }]);
    expect(normalized?.skills).toMatchObject({ Agility: 10, Attack: 20, Overall: 30 });
    expect(normalized?.stats).toEqual({
      hitpoints: { current: 99, max: 100 },
      prayer: { current: 50, max: 60 },
      energy: { current: 7000, max: 10000 },
      world: undefined,
    });
    expect(normalized?.coordinates).toEqual({ x: 3200, y: 3200, plane: 1 });
    expect(normalized?.quests).toEqual({
      101: QuestState.FINISHED,
      102: QuestState.IN_PROGRESS,
    });
    expect(normalized?.collection_log_v2).toEqual([{ id: 4, quantity: 1 }]);
    expect(normalized?.interacting?.location).toEqual({ x: 50, y: 61, plane: 2 });

    const grouped = GroupData.createGroupedItem("Mystic robe", [
      {
        id: 7,
        name: "Mystic robe 75",
        quantity: 2,
        quantities: { Alice: 0 },
        visible: true,
        isTradeable: false,
        highAlch: 1,
        gePrice: 75,
        imageUrl: "/75.webp",
        wikiLink: "/75",
      },
      {
        id: 6,
        name: "Mystic robe 100",
        quantity: 1,
        quantities: { Bob: 1 },
        visible: true,
        isTradeable: false,
        highAlch: 1,
        gePrice: 100,
        imageUrl: "/100.webp",
        wikiLink: "/100",
      },
    ] as never);

    expect(grouped.variantIds).toEqual([6, 7]);
    expect(grouped.quantity).toBe(3);
    expect(grouped.quantities).toEqual({ Alice: 0, Bob: 1 });
    expect(grouped.isTradeable).toBe(true);
    expect(grouped.gePrice).toBe(100);
    expect(grouped.imageUrl).toBe("/100.webp");
    expect(grouped.wikiLink).toBe("/100");
    expect(GroupData.getDegradedBaseName("Mystic robe 13")).toBeNull();
    expect(group.convertFilterToFilterList(' coins |  | "mystic robe" ')).toEqual(["coins", '"mystic robe"']);
    expect(group.passesTextFilter(grouped, ['"mystic robe"'])).toBe(true);
    expect(group.passesTextFilter(grouped, ["999", "token"])).toBe(false);
    expect(group.passesPlayerFilter(grouped, "Alice")).toBe(false);
    expect(group.passesPlayerFilter(grouped, "Charlie")).toBe(true);
    expect(group.passesTradeabilityFilter({ ...grouped, isTradeable: false } as never, true)).toBe(false);
    expect(group.shouldItemBeVisible(undefined as never, ["mystic"], "@ALL")).toBe(false);
  });

  it("merges updates, removes stale member data, and only republishes member lists when names change", () => {
    const group = new GroupData();
    group.playerFilter = "Bob";

    const publishSpy = vi.spyOn(pubsub, "publish");
    const nextRefresh = group.update([
      {
        name: "Alice",
        inventory: [1, 2, 2, 1],
        last_updated: "2024-01-01T00:00:00.000Z",
      },
      {
        name: "Bob",
        inventory: [1, 1, 3, 5],
        last_updated: "2024-01-01T00:00:00.000Z",
      },
    ] as never);

    expect(nextRefresh.toISOString()).toBe("2024-01-01T00:00:00.001Z");
    expect([...group.members.keys()]).toEqual(["Alice", "Bob"]);
    expect(group.groupItems[1]?.quantity).toBe(3);
    expect(group.groupItems[1]?.quantities).toEqual({ Alice: 2, Bob: 1 });
    expect(group.groupItems[2]?.visible).toBe(false);
    expect(group.groupItems[3]?.quantity).toBe(5);
    expect(publishSpy.mock.calls.some(([eventName]) => eventName === "members-updated")).toBe(true);
    expect(publishSpy.mock.calls.some(([eventName]) => eventName === "items-updated")).toBe(true);
    expect(publishSpy.mock.calls.some(([eventName]) => eventName === "item-update:1")).toBe(true);

    publishSpy.mockClear();

    group.update([
      {
        name: "Alice",
        inventory: [1, 2, 2, 2],
        last_updated: "2024-01-02T00:00:00.000Z",
      },
      {
        name: "Bob",
        inventory: [1, 1, 3, 5],
        last_updated: "2024-01-02T00:00:00.000Z",
      },
    ] as never);

    expect(group.groupItems[2]?.quantity).toBe(2);
    expect(publishSpy.mock.calls.some(([eventName]) => eventName === "members-updated")).toBe(false);
    expect(publishSpy.mock.calls.some(([eventName]) => eventName === "item-update:2")).toBe(true);
    expect(publishSpy.mock.calls.some(([eventName]) => eventName === "items-updated")).toBe(true);

    publishSpy.mockClear();

    group.update([
      {
        name: "Alice",
        inventory: [1, 2],
        last_updated: "2024-01-03T00:00:00.000Z",
      },
    ] as never);

    expect([...group.members.keys()]).toEqual(["Alice"]);
    expect(group.groupItems[1]?.quantity).toBe(2);
    expect(group.groupItems[1]?.quantities).toEqual({ Alice: 2 });
    expect(group.groupItems[2]).toBeUndefined();
    expect(group.groupItems[3]).toBeUndefined();
    expect(publishSpy.mock.calls.some(([eventName]) => eventName === "members-updated")).toBe(true);
    expect(publishSpy.mock.calls.some(([eventName]) => eventName === "items-updated")).toBe(true);
  });
});

describe("collection-log branches", () => {
  beforeEach(() => {
    resetPubsub();
    resetCollectionLog();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    resetCollectionLog();
  });

  it("skips duplicate reverse mappings, excludes shared members, and handles lookup fallbacks", async () => {
    const info = [
      {
        pages: [
          { name: "The Great Page", items: [{ id: 1 }, { id: 2 }] },
          { name: "Side Page", items: [{ id: 3 }, { id: 12013 }, { id: 29472 }, { id: 12014 }, { id: 29474 }] },
        ],
      },
    ];
    const duplicateMapping = {
      1: [2, 4],
      9: [4],
    };
    const fetchMock = vi.fn(async (url: string) => ({
      json: async () => (url.includes("duplicates") ? duplicateMapping : info),
    }));
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    await collectionLog.initLogInfo();

    expect(collectionLog.duplicateMapping.get(2)).toBe(1);
    expect(collectionLog.duplicateMapping.get(4)).toBe(1);
    expect(collectionLog.pageInfo("Missing Page")).toBeNull();

    await collectionLog.load({
      members: new Map([
        [
          "Alice",
          {
            name: "Alice",
            collectionLog: [
              { id: 1, quantity: 1 },
              { id: 2, quantity: 2 },
              { id: 12013, quantity: 1 },
              { id: 29472, quantity: 1 },
            ],
          },
        ],
        ["Bob", { name: "Bob", collectionLog: [{ id: 3, quantity: 1 }] }],
        ["@SHARED", { name: "@SHARED", collectionLog: [{ id: 999, quantity: 1 }] }],
      ]),
    } as never);

    collectionLog.loadPlayer("Alice");

    expect(collectionLog.playerNames).toEqual(["Alice", "Bob"]);
    expect(collectionLog.otherPlayers).toEqual(["Bob"]);
    expect(collectionLog.unlockedItemCount("Alice", 1)).toBe(3);
    expect(collectionLog.totalUnlockedItems("Alice")).toBe(2);
    expect(collectionLog.completionStateClass("Bob", "Side Page")).toBe("collection-log__in-progress");
    expect(collectionLog.completionStateClass("Missing", "The Great Page")).toBe("collection-log__not-started");
    expect(collectionLog.isLogComplete("Missing", "The Great Page")).toBe(false);
    expect(collectionLog.unlockedItemCount("Missing", 1)).toBe(0);
    expect(collectionLog.isItemUnlocked("Missing", 1)).toBe(false);
  });
});