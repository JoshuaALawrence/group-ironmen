import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockedLoadingScreen = vi.hoisted(() => ({
  showLoadingScreen: vi.fn(),
  hideLoadingScreen: vi.fn(),
}));

vi.mock("../loading-screen/loading-screen-manager", () => ({
  loadingScreenManager: mockedLoadingScreen,
}));

import { CollectionLog as CollectionLogDialog } from "../collection-log/collection-log";
import { CollectionLogPage } from "../collection-log-page/collection-log-page";
import { CollectionLogTab } from "../collection-log-tab/collection-log-tab";
import { collectionLog } from "../data/collection-log";
import { pubsub } from "../data/pubsub";
import { Skill, SkillName } from "../data/skill";

type GroupMember = {
  name: string;
  collectionLog?: Array<{ id: number; quantity: number }>;
};

type GroupCollectionLogData = {
  members: Map<string, GroupMember>;
};

function resetCollectionLogState(): void {
  collectionLog.info = [];
  collectionLog.duplicateMapping = new Map();
  collectionLog.pageItems = new Map();
  collectionLog.totalUniqueItems = 0;
  collectionLog.playerLogs = new Map();
  collectionLog.playerNames = [];
  collectionLog.otherPlayers = [];
}

async function seedCollectionLog(groupData?: GroupCollectionLogData): Promise<GroupCollectionLogData> {
  collectionLog.info = [
    {
      pages: [{ name: "The Boss Page", items: [{ id: 1 }, { id: 2 }] }],
    },
    {
      pages: [{ name: "Raid Rewards", items: [{ id: 3 }] }],
    },
    {
      pages: [
        { name: "Shared Beginner", items: [{ id: 4 }], completion_labels: ["Caskets"] },
        { name: "Easy Treasure", items: [{ id: 5 }, { id: 6 }], completion_labels: ["Caskets"] },
      ],
    },
  ] as never;
  collectionLog.pageItems = new Map([
    ["The Boss Page", [{ id: 1 }, { id: 2 }]],
    ["Raid Rewards", [{ id: 3 }]],
    ["Shared Beginner", [{ id: 4 }]],
    ["Easy Treasure", [{ id: 5 }, { id: 6 }]],
  ]);
  collectionLog.totalUniqueItems = 6;

  const seededGroupData =
    groupData ??
    ({
      members: new Map([
        [
          "Alice",
          {
            name: "Alice",
            collectionLog: [
              { id: 29472, quantity: 1 },
              { id: 12013, quantity: 1 },
              { id: 5, quantity: 2 },
            ],
          },
        ],
        ["Bob", { name: "Bob", collectionLog: [{ id: 6, quantity: 1 }] }],
        ["@SHARED", { name: "@SHARED" }],
      ]),
    } satisfies GroupCollectionLogData);

  await collectionLog.load(seededGroupData as never);
  return seededGroupData;
}

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe("skill helpers", () => {
  it("normalizes known skill names and falls back for unknown icons", () => {
    const attack = new Skill("Attack", 0);
    const sailing = new Skill("Sailing", 0);
    const custom = new Skill("Custom Skill", 0);

    expect(attack.name).toBe(SkillName.Attack);
    expect(attack.icon).toBe("/ui/197-0.png");
    expect(Skill.getIcon(sailing.name)).toBe("/ui/228-0.png");
    expect(custom.name).toBe("Custom Skill");
    expect(custom.icon).toBe("");
  });

  it("calculates skill levels, progress, and next-level xp at exact thresholds", () => {
    const beforeLevelTwo = new Skill(SkillName.Attack, 82);
    const atLevelTwo = new Skill(SkillName.Attack, 83);
    const atLevelThree = new Skill(SkillName.Attack, 174);
    const overall = new Skill(SkillName.Overall, 999);

    expect(beforeLevelTwo.level).toBe(1);
    expect(beforeLevelTwo.levelProgress).toBeCloseTo(82 / 83, 6);
    expect(beforeLevelTwo.xpUntilNextLevel).toBe(1);

    expect(atLevelTwo.level).toBe(2);
    expect(atLevelTwo.levelProgress).toBe(0);
    expect(atLevelTwo.xpUntilNextLevel).toBe(91);

    expect(atLevelThree.level).toBe(3);
    expect(overall.level).toBe(0);
    expect(overall.calculateLevel()).toBe(0);
  });

  it("parses overall skill data, caps aggregate levels at 99, and fills missing overall entries", () => {
    const parsedWithOverall = Skill.parseSkillData({
      [SkillName.Attack]: 14391160,
      [SkillName.Strength]: 1154,
      [SkillName.Overall]: 1234,
    });
    const parsedWithoutOverall = Skill.parseSkillData({
      [SkillName.Attack]: 83,
    });

    expect(parsedWithOverall[SkillName.Attack].level).toBe(100);
    expect(parsedWithOverall[SkillName.Overall].xp).toBe(1234);
    expect(parsedWithOverall[SkillName.Overall].level).toBe(109);

    expect(parsedWithoutOverall[SkillName.Overall].xp).toBe(0);
    expect(parsedWithoutOverall[SkillName.Overall].level).toBe(2);
  });
});

describe("collection log branches", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    resetCollectionLogState();
    pubsub.unpublishAll();
    pubsub.subscribers.clear();
    mockedLoadingScreen.showLoadingScreen.mockReset();
    mockedLoadingScreen.hideLoadingScreen.mockReset();
  });

  afterEach(() => {
    document.body.innerHTML = "";
    resetCollectionLogState();
    pubsub.unpublishAll();
    pubsub.subscribers.clear();
    vi.restoreAllMocks();
  });

  it("filters other players, handles duplicate counts, and returns empty defaults for missing pages", async () => {
    await seedCollectionLog();
    collectionLog.loadPlayer("Alice");

    expect(collectionLog.otherPlayers).toEqual(["Bob"]);
    expect(collectionLog.totalUnlockedItems("Alice")).toBe(2);
    expect(collectionLog.pageInfo("Missing Page")).toBeNull();
    expect(collectionLog.completionStateClass("Missing Player", "Easy Treasure")).toBe("collection-log__not-started");
    expect(collectionLog.completionCountForPage("Missing Player", "Easy Treasure")).toBe(0);
  });

  it("builds collection log page links for shared clues, clue difficulties, npc pages, and missing pages", async () => {
    await seedCollectionLog();

    const renderSpy = vi.spyOn(CollectionLogPage.prototype, "render");
    const missingPage = new CollectionLogPage();
    missingPage.setAttribute("player-name", "Alice");
    missingPage.setAttribute("tab-id", "0");
    missingPage.setAttribute("page-name", "Missing Page");
    document.body.appendChild(missingPage);

    expect(missingPage.pageInfo).toBeNull();
    expect(renderSpy).not.toHaveBeenCalled();

    renderSpy.mockRestore();

    const sharedCluePage = new CollectionLogPage();
    sharedCluePage.setAttribute("player-name", "Alice");
    sharedCluePage.setAttribute("tab-id", "2");
    sharedCluePage.setAttribute("page-name", "Shared Beginner");
    document.body.appendChild(sharedCluePage);

    const easyCluePage = new CollectionLogPage();
    easyCluePage.setAttribute("player-name", "Alice");
    easyCluePage.setAttribute("tab-id", "2");
    easyCluePage.setAttribute("page-name", "Easy Treasure");
    document.body.appendChild(easyCluePage);

    const bossPage = new CollectionLogPage();
    bossPage.setAttribute("player-name", "Alice");
    bossPage.setAttribute("tab-id", "0");
    bossPage.setAttribute("page-name", "The Boss Page");
    document.body.appendChild(bossPage);

    expect(sharedCluePage.pageTitleLink).toBe(
      "https://oldschool.runescape.wiki/w/Collection_log#Shared_Treasure_Trail_Rewards"
    );
    expect(easyCluePage.pageTitleLink).toBe("https://oldschool.runescape.wiki/w/Clue_scroll_(easy)");
    expect(easyCluePage.unlockedItemsCount).toBe(1);
    expect(easyCluePage.completionStateClass).toBe("collection-log__in-progress");
    expect(bossPage.pageTitleLink).toBe(
      "https://oldschool.runescape.wiki/w/Special:Lookup?type=npc&name=The Boss Page"
    );
  });

  it("renders collection log tabs, switches active pages, and leaves empty tabs blank", async () => {
    await seedCollectionLog();

    const renderSpy = vi.spyOn(CollectionLogTab.prototype, "render").mockImplementation(function (this: CollectionLogTab) {
      this.innerHTML = `
        <div class="collection-log__tab-list">
          ${this.pages
            .map(
              (page) => `<button page-name="${page.name}">${page.name}</button>`
            )
            .join("")}
        </div>
        <div class="collection-log__page-container"></div>
      `;
    });

    const tab = new CollectionLogTab();
    tab.setAttribute("player-name", "Alice");
    tab.setAttribute("tab-id", "2");
    document.body.appendChild(tab);

    expect(renderSpy).toHaveBeenCalledOnce();
    expect(tab.pageContainer?.querySelector("collection-log-page")?.getAttribute("page-name")).toBe("Shared Beginner");
    expect(tab.tabList?.querySelector('button[page-name="Shared Beginner"]')?.classList.contains("collection-log__page-active")).toBe(true);

    tab.handlePageClick({ target: document.createTextNode("ignore") } as unknown as Event);
    expect(tab.pageContainer?.querySelector("collection-log-page")?.getAttribute("page-name")).toBe("Shared Beginner");

    tab.tabList?.querySelector<HTMLButtonElement>('button[page-name="Easy Treasure"]')?.dispatchEvent(
      new MouseEvent("click", { bubbles: true })
    );

    expect(tab.pageContainer?.querySelector("collection-log-page")?.getAttribute("page-name")).toBe("Easy Treasure");
    expect(tab.tabList?.querySelector('button[page-name="Easy Treasure"]')?.classList.contains("collection-log__page-active")).toBe(true);

    const emptyTab = new CollectionLogTab();
    emptyTab.setAttribute("player-name", "Alice");
    emptyTab.setAttribute("tab-id", "99");
    document.body.appendChild(emptyTab);

    expect(emptyTab.pages).toEqual([]);
    expect(emptyTab.pageContainer?.children.length ?? 0).toBe(0);
  });

  it("initializes the collection log dialog, switches tabs, and only closes on background clicks", async () => {
    const groupData = await seedCollectionLog();
    const renderSpy = vi.spyOn(CollectionLogDialog.prototype, "render").mockImplementation(function (this: CollectionLogDialog) {
      this.innerHTML = `
        <div class="dialog__visible"></div>
        <div class="collection-log__tab-buttons">
          <button tab-id="0">Bosses</button>
          <button tab-id="1">Raids</button>
          <button tab-id="2">Clues</button>
        </div>
        <div class="collection-log__tab-container"></div>
        <button class="dialog__close">Close</button>
      `;
    });

    const dialog = new CollectionLogDialog();
    dialog.setAttribute("player-name", "Alice");
    document.body.appendChild(dialog);

    expect(mockedLoadingScreen.showLoadingScreen).toHaveBeenCalledOnce();

    pubsub.publish("get-group-data", groupData);
    await flushPromises();

    expect(renderSpy).toHaveBeenCalledOnce();
    expect(mockedLoadingScreen.hideLoadingScreen).toHaveBeenCalledTimes(1);
    expect(dialog.totalUniqueItems).toBe(6);
    expect(dialog.unlockedUniqueItems).toBe(2);
    expect(collectionLog.otherPlayers).toEqual(["Bob"]);
    expect(dialog.tabContent?.querySelector("collection-log-tab")?.getAttribute("tab-id")).toBe("0");

    dialog.handleTabClick({ target: document.createTextNode("ignore") } as unknown as Event);
    expect(dialog.tabContent?.querySelector("collection-log-tab")?.getAttribute("tab-id")).toBe("0");

    dialog.tabButtons?.querySelector<HTMLButtonElement>('button[tab-id="2"]')?.dispatchEvent(
      new MouseEvent("click", { bubbles: true })
    );

    expect(dialog.tabContent?.querySelector("collection-log-tab")?.getAttribute("tab-id")).toBe("2");
    expect(dialog.tabButtons?.querySelector('button[tab-id="2"]')?.classList.contains("collection-log__tab-button-active")).toBe(
      true
    );

    dialog.closeIfBackgroundClick({ target: document.createElement("div") } as MouseEvent);
    expect(dialog.isConnected).toBe(true);

    dialog.background?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(dialog.isConnected).toBe(false);
    expect(mockedLoadingScreen.hideLoadingScreen).toHaveBeenCalledTimes(2);
  });
});