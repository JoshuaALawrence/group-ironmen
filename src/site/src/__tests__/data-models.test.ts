import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { collectionLog } from "../data/collection-log";
import { AchievementDiary } from "../data/diaries";
import { GroupData } from "../data/group-data";
import { Item } from "../data/item";
import { MemberData } from "../data/member-data";
import { Quest, QuestState } from "../data/quest";

describe("achievement diary data", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("parses diary bitfields and loads the diary dataset", async () => {
    const diaries = AchievementDiary.parseDiaryData(Array.from({ length: 62 }, (_, index) => (index < 6 ? 0xffffffff : 0)));

    expect(diaries.completion.Ardougne.Easy).toHaveLength(10);
    expect(diaries.completion.Ardougne.Easy.every(Boolean)).toBe(true);
    expect(diaries.completion.Desert.Easy[0]).toBe(true);

    const fetchMock = vi.fn(async () => ({ json: async () => ({ regions: ["example"] }) }));
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);
    await AchievementDiary.loadDiaries();

    expect(AchievementDiary.diaries).toEqual({ regions: ["example"] });
  });
});

describe("collection log data", () => {
  beforeEach(() => {
    collectionLog.info = [];
    collectionLog.duplicateMapping = new Map();
    collectionLog.pageItems = new Map();
    collectionLog.totalUniqueItems = 0;
    collectionLog.playerLogs = new Map();
    collectionLog.playerNames = [];
    collectionLog.otherPlayers = [];
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("initializes log metadata and resolves player progress", async () => {
    const info = [
      {
        tabId: 0,
        pages: [
          { name: "The Great Page", items: [{ id: 1 }, { id: 2 }] },
          { name: "Another Page", items: [{ id: 3 }] },
        ],
      },
    ];
    const duplicateMapping = {};
    const fetchMock = vi.fn(async (url: string) => ({
      json: async () => (url.includes("duplicates") ? duplicateMapping : info),
    }));
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    await collectionLog.initLogInfo();

    expect(collectionLog.pageSize("The Great Page")).toBe(2);
    expect(collectionLog.pageInfo("The Great Page")?.sortName).toBe("Great Page");
    expect(collectionLog.tabName(0)).toBe("Bosses");
    expect(collectionLog.tabName(9)).toBe("Other");

    await collectionLog.load({
      members: new Map([
        ["Alice", { name: "Alice", collectionLog: [{ id: 1, quantity: 1 }, { id: 2, quantity: 1 }] }],
        ["Bob", { name: "Bob", collectionLog: [] }],
        ["@SHARED", { name: "@SHARED" }],
      ]),
    } as never);

    collectionLog.loadPlayer("Alice");

    expect(collectionLog.otherPlayers).toEqual(["Bob"]);
    expect(collectionLog.completionCountForPage("Alice", "The Great Page")).toBe(2);
    expect(collectionLog.isLogComplete("Alice", "The Great Page")).toBe(true);
    expect(collectionLog.completionStateClass("Alice", "The Great Page")).toBe("collection-log__complete");
    expect(collectionLog.completionStateClass("Bob", "The Great Page")).toBe("collection-log__not-started");
    expect(collectionLog.totalUnlockedItems("Alice")).toBe(2);
    expect(collectionLog.unlockedItemCount("Alice", 1)).toBe(1);
    expect(collectionLog.isItemUnlocked("Alice", 2)).toBe(true);
  });
});

describe("group and member data", () => {
  beforeEach(() => {
    Item.itemDetails = {
      1: { name: "Mystic robe 100", highalch: 1, isTradeable: true },
      2: { name: "Mystic robe 75", highalch: 1, isTradeable: true },
      3: { name: "Bronze axe", highalch: 1, isTradeable: true },
      4: { name: "Rune pouch", highalch: 1, isTradeable: true },
      5: { name: "Seed box", highalch: 1, isTradeable: true },
      6: { name: "Collection shard", highalch: 1, isTradeable: true },
      7: { name: "Quest token", highalch: 1, isTradeable: true },
      8: { name: "Diary token", highalch: 1, isTradeable: true },
    };
    Item.itemNameToId = { "mystic robe": 1 };

    Quest.questData = {
      1: { name: "Cook's Assistant", difficulty: "Novice", points: 1 },
    } as never;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("groups degraded items and evaluates visibility filters", () => {
    const group = new GroupData();
    group.groupItems = {
      1: { id: 1, name: "Mystic robe 100", quantity: 1, quantities: { Alice: 1 }, visible: true, isTradeable: true, highAlch: 1, gePrice: 10, imageUrl: "a", wikiLink: "a" },
      2: { id: 2, name: "Mystic robe 75", quantity: 2, quantities: { Bob: 2 }, visible: true, isTradeable: true, highAlch: 1, gePrice: 20, imageUrl: "b", wikiLink: "b" },
      3: { id: 3, name: "Bronze axe", quantity: 1, quantities: { Alice: 1 }, visible: true, isTradeable: false, highAlch: 1, gePrice: 30, imageUrl: "c", wikiLink: "c" },
    } as never;

    expect(GroupData.getDegradedBaseName("Mystic robe 75")).toBe("Mystic robe");

    const grouped = GroupData.createGroupedItem("Mystic robe", [group.groupItems[1] as never, group.groupItems[2] as never]);
    expect(grouped.quantity).toBe(3);
    expect(grouped.variantIds).toEqual([1, 2]);

    const displayItems = group.getDisplayItems();
    expect(displayItems).toHaveLength(2);
    expect(displayItems[0]?.name).toBe("Bronze axe");
    expect(displayItems[1]?.name).toBe("Mystic robe");

    expect(group.convertFilterToFilterList('foo | "Mystic robe" | ')).toEqual(["foo", '"Mystic robe"']);
    expect(group.isExactItem(grouped, '"mystic robe"')).toBe(true);
    expect(group.passesTextFilter(grouped, ["mystic"])).toBe(true);
    expect(group.passesTextFilter(grouped, ["1"])).toBe(true);
    expect(group.passesPlayerFilter(grouped, "Alice")).toBe(true);
    expect(group.passesTradeabilityFilter({ ...grouped, isTradeable: false } as never, true)).toBe(false);
    expect(group.shouldItemBeVisible(grouped, ["mystic"], "@ALL")).toBe(true);
    expect(group.shouldItemBeVisible({ ...grouped, quantities: undefined } as never, ["mystic"], "@ALL")).toBe(false);
  });

  it("updates member state across item, quest, skill, diary, and activity payloads", () => {
    const member = new MemberData("Alice");
    const updatedAttributes = member.update({
      stats: { hp: 10 },
      last_updated: new Date(Date.now() - 301_000),
      coordinates: { x: 3200, y: 3200, plane: 0 },
      quests: { 1: QuestState.FINISHED },
      skills: {
        Attack: 1154,
        Strength: 1154,
        Defence: 1154,
        Hitpoints: 1154,
        Prayer: 1154,
        Ranged: 1154,
        Magic: 1154,
        Overall: 1154,
      },
      inventory: [{ id: 1, quantity: 2 }],
      equipment: [{ id: 2, quantity: 1 }],
      bank: [{ id: 1, quantity: 5 }],
      rune_pouch: [{ id: 4, quantity: 1 }],
      interacting: { name: "<p>Goblin</p>", location: { x: 1, y: 2, plane: 0 } },
      seed_vault: [{ id: 5, quantity: 7 }],
      diary_vars: Array.from({ length: 62 }, (_, index) => (index < 4 ? 0xffffffff : 0)),
      collection_log_v2: [{ id: 6, quantity: 1 }],
    });

    expect(updatedAttributes.has("inventory")).toBe(true);
    expect(updatedAttributes.has("skills")).toBe(true);
    expect(updatedAttributes.has("diaries")).toBe(true);
    expect(updatedAttributes.has("collection_log_v2")).toBe(true);
    expect(member.inactive).toBe(true);
    expect(member.totalItemQuantity(1)).toBe(7);
    expect(Array.from(member.allItems()).map((item) => item.id)).toEqual([1, 2, 4, 5]);
    expect(member.quests["1"].state).toBe(QuestState.FINISHED);
    expect(member.skills?.Attack.xp).toBe(1154);
    expect(member.combatLevel).toBeGreaterThan(0);
    expect(member.interacting?.name).toBe("Goblin");
    expect(member.diaries).toBeDefined();
    expect(member.collectionLog).toHaveLength(1);

    const activeAttributes = member.update({
      last_updated: new Date(),
      skills: {
        Attack: 1300,
        Strength: 1154,
        Defence: 1154,
        Hitpoints: 1154,
        Prayer: 1154,
        Ranged: 1154,
        Magic: 1154,
        Overall: 1300,
      },
    });

    expect(activeAttributes.has("skills")).toBe(true);
    expect(member.inactive).toBe(false);
  });
});