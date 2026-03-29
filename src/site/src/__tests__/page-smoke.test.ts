import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { HomePage } from "../home-page/home-page";
import { EventsPage } from "../events-page/events-page";
import { GroupSettings } from "../group-settings/group-settings";
import { MapPage } from "../map-page/map-page";
import { CollectionLogPage } from "../collection-log-page/collection-log-page";
import { collectionLog } from "../data/collection-log";
import { groupData } from "../data/group-data";
import { storage } from "../data/storage";
import { Quest, QuestState } from "../data/quest";
import { Skill, SkillName } from "../data/skill";
import { MemberData } from "../data/member-data";
import { Item } from "../data/item";

function makeMember(name: string, totalXp = 2000): MemberData {
  const member = new MemberData(name);
  member.skills = {
  [SkillName.Overall]: new Skill(SkillName.Overall, totalXp),
    [SkillName.Attack]: new Skill(SkillName.Attack, 1154),
    [SkillName.Strength]: new Skill(SkillName.Strength, 1154),
    [SkillName.Defence]: new Skill(SkillName.Defence, 1154),
    [SkillName.Hitpoints]: new Skill(SkillName.Hitpoints, 1154),
    [SkillName.Prayer]: new Skill(SkillName.Prayer, 1154),
    [SkillName.Ranged]: new Skill(SkillName.Ranged, 1154),
    [SkillName.Magic]: new Skill(SkillName.Magic, 1154),
    [SkillName.Woodcutting]: new Skill(SkillName.Woodcutting, 1154),
    [SkillName.Mining]: new Skill(SkillName.Mining, 1154),
    [SkillName.Fishing]: new Skill(SkillName.Fishing, 1154),
    [SkillName.Cooking]: new Skill(SkillName.Cooking, 1154),
    [SkillName.Farming]: new Skill(SkillName.Farming, 1154),
    [SkillName.Thieving]: new Skill(SkillName.Thieving, 1154),
    [SkillName.Hunter]: new Skill(SkillName.Hunter, 1154),
    [SkillName.Firemaking]: new Skill(SkillName.Firemaking, 1154),
    [SkillName.Agility]: new Skill(SkillName.Agility, 1154),
  } as Record<string, Skill>;
  member.skills[SkillName.Overall].level = Math.max(1, Math.floor(totalXp / 1000));
  member.quests = {
    1: new Quest(1, QuestState.FINISHED),
  } as Record<string, Quest>;
  member.diaries = {
    Ardougne: { Easy: [true, false], Medium: [true], Hard: [false], Elite: [] },
  } as never;
  member.inventory = [new Item(1, 1)];
  member.equipment = [new Item(2, 1)];
  member.bank = [new Item(1, 2)];
  member.runePouch = [new Item(4, 1)];
  member.seedVault = [new Item(5, 1)];
  member.updateItemQuantitiesIn("inventory");
  member.updateItemQuantitiesIn("equipment");
  member.updateItemQuantitiesIn("bank");
  member.updateItemQuantitiesIn("runePouch");
  member.updateItemQuantitiesIn("seedVault");
  member.combatLevel = 99;
  return member;
}

beforeEach(() => {
  groupData.members = new Map();
  groupData.groupItems = {
    1: { id: 1, name: "Bronze axe", quantity: 3, quantities: { Alice: 1, Bob: 2 }, visible: true, isTradeable: true, variantIds: [], highAlch: 10, gePrice: 100, imageUrl: "", wikiLink: "" },
    2: { id: 2, name: "Mystic robe", quantity: 1, quantities: { Alice: 1 }, visible: true, isTradeable: true, variantIds: [], highAlch: 200, gePrice: 2000, imageUrl: "", wikiLink: "" },
  } as never;
  Item.gePrices = { 1: 100, 2: 2000, 4: 50, 5: 75 };
  collectionLog.info = [
    { tabId: 0, pages: [{ name: "Boss Page", items: [{ id: 1 }, { id: 2 }], completion_labels: ["Kills"] }] },
  ] as never;
  collectionLog.pageItems = new Map([["Boss Page", [{ id: 1 }, { id: 2 }]]]);
  collectionLog.playerLogs = new Map();
  collectionLog.playerNames = ["Alice"];
  collectionLog.totalUniqueItems = 2;
  collectionLog.playerLogs.set(
    "Alice",
    {
      unlockedItems: new Map([[1, 1], [2, 1]]),
      unlockedItemsCountByPage: new Map([["Boss Page", 2]]),
      logs: [],
      isLogComplete: () => true,
      completionStateClass: () => "collection-log__complete",
      getPage: () => undefined,
      playerName: "Alice",
    } as never
  );
  Quest.questData = { 1: { name: "Cook's Assistant", difficulty: "Novice", points: 1 } } as never;
  Item.itemDetails = {
    1: { name: "Bronze axe", highalch: 1, isTradeable: true },
    2: { name: "Mystic robe", highalch: 2000, isTradeable: true },
    4: { name: "Rune pouch", highalch: 1, isTradeable: true },
    5: { name: "Seed box", highalch: 1, isTradeable: true },
  };
  storage.storeGroup("@EXAMPLE", "token");
  storage.setActiveMember("Alice");
  (window as typeof window & { updateTheme?: () => void }).updateTheme = vi.fn();
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    if (url.includes("osrs-news")) return { ok: true, json: async () => [] } as Response;
    if (url.includes("osrs-youtube")) return { ok: true, json: async () => [] } as Response;
    if (url.includes("osrs-twitch")) return { ok: true, json: async () => null } as Response;
    if (url.includes("events")) return { ok: true, json: async () => [] } as Response;
    if (url.includes("discord-settings")) return { ok: true, json: async () => ({ has_webhook: false, members: [] }) } as Response;
    return { ok: true, json: async () => ({}) } as Response;
  }) as unknown as typeof fetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("home page helpers", () => {
  it("formats dashboard values and titles", () => {
    const home = new HomePage();
    const members = [makeMember("Alice", 5000), makeMember("Bob", 1000)];

    expect(home.getEventTimeLabel({ event_time: new Date(Date.now() - 10_000).toISOString() } as never)).toBe("Happening now");
    expect(home.getEventTimeLabel({ event_time: new Date(Date.now() + 30 * 60_000).toISOString() } as never)).toBe("In 30m");
    expect(home.getEventTimeLabel({ event_time: new Date(Date.now() + 3 * 60 * 60_000).toISOString() } as never)).toBe("In 3h");

    expect(home.getTotalLevel(members[0])).toBeGreaterThan(0);
    expect(home.getTotalXp(members[0])).toBe(5000);
    expect(home.getQuestsCompleted(members[0])).toBe(1);
    expect(home.getDiaryTasksCompleted(members[0])).toEqual({ done: 2, total: 4 });
    expect(home.getTopSkills(members[0], 2).length).toBe(2);
    expect(home.getGroupQuestPoints(members)).toBe(1);
    expect(home.getGroupGeValue()).toBeGreaterThan(0);
    expect(home.getGroupHaValue()).toBeGreaterThan(0);
    expect(home.getMemberGeValue(members[0])).toBeGreaterThan(0);

    const titles = home.getMemberTitles(members);
    expect(titles.size).toBeGreaterThan(0);
    expect(home.renderMemberCard(members[0], "Gold Goblin", "#ffd700", "demo")).toContain("Gold Goblin");
  });
});

describe("events page helpers", () => {
  it("filters and formats event cards", () => {
    const events = new EventsPage();
    events.events = [
      {
        event_id: 1,
        title: "Future Raid",
        description: "Bring supplies",
        event_type: "raid",
        event_time: new Date(Date.now() + 60 * 60_000).toISOString(),
        event_end_time: null,
        created_by: "Alice",
        created_at: new Date().toISOString(),
        icon: "cox",
      },
      {
        event_id: 2,
        title: "Past Boss",
        description: "Already done",
        event_type: "boss",
        event_time: new Date(Date.now() - 2 * 60 * 60_000).toISOString(),
        event_end_time: new Date(Date.now() - 60 * 60_000).toISOString(),
        created_by: "Bob",
        created_at: new Date().toISOString(),
        icon: "zulrah",
      },
    ] as never;

    expect(events.getFilteredEvents()).toHaveLength(2);
    expect(events.getUpcomingEvents()).toHaveLength(1);
    expect(events.getPastEvents()).toHaveLength(1);
    expect(events.formatEventTime(events.events[0].event_time)).toContain(",");
    expect(events.getRelativeTime(new Date(Date.now() + 30_000).toISOString())).toBe("Starting now");
    expect(events.renderEventCard(events.events[0])).toContain("Future Raid");
    expect(events.renderUpcoming()).toContain("Future Raid");
    expect(events.renderPast()).toContain("Past Boss");
    expect(events.renderFilterTabs()).toContain("All");
    events.showForm = true;
    expect(events.renderForm()).toContain("Post a New Adventure");
  });
});

describe("group settings helpers", () => {
  it("manages members and settings state", async () => {
    const settings = new GroupSettings();
    settings.innerHTML = `
      <div class="group-settings__members"></div>
      <div class="group-settings__panels"></div>
      <div class="group-settings__style"></div>
      <div class="group-settings__identity-name"></div>
      <div class="group-settings__discord-content"></div>
      <button id="change-identity-btn"></button>
      <input type="radio" name="appearance-style" value="dark" checked />
      <input type="radio" name="panel-dock-side" value="right" checked />
      <button class="group-settings__tab" data-tab="general"></button>
      <div class="group-settings__panel" data-panel="general"></div>
    `;
    settings.memberSection = settings.querySelector(".group-settings__members");
    settings.panelDockSide = settings.querySelector(".group-settings__panels");
    settings.appearanceStyle = settings.querySelector(".group-settings__style");

    expect(settings.isDemo).toBe(true);
    expect(settings.getApiBase()).toBe("/api/group/@EXAMPLE");
    expect(settings.getAuthHeaders()).toEqual({ "Content-Type": "application/json", Authorization: "token" });

    settings.updateIdentityDisplay();
    expect(settings.querySelector(".group-settings__identity-name")?.textContent).toBe("Alice");
    settings.handleStyleChange();
    settings.handlePanelDockSideChange();
    settings.handleUpdatedMembers([{ name: "Alice" }, { name: "Bob" }, { name: "@SHARED" }]);
    expect(settings.querySelectorAll("edit-member")).toHaveLength(3);
    await expect(settings.handleChangeIdentity()).resolves.toBeUndefined();
    expect(settings.querySelector(".group-settings__members")?.children.length).toBeGreaterThan(0);
  });
});

describe("map page helpers", () => {
  it("handles planes and focus actions", () => {
    const map = new MapPage();
    const worldMap = document.createElement("div") as HTMLElement & {
      plane?: number;
      stopFollowingPlayer: () => void;
      showPlane: (plane: number) => void;
      followPlayer: (playerName: string | null) => void;
    };
    worldMap.id = "background-worldmap";
    worldMap.plane = 2;
    worldMap.stopFollowingPlayer = vi.fn();
    worldMap.showPlane = vi.fn();
    worldMap.followPlayer = vi.fn();
    const authedSection = document.createElement("div");
    authedSection.className = "authed-section";
    document.body.appendChild(worldMap);
    document.body.appendChild(authedSection);
    map.innerHTML = `<div class="map-page__focus-player-buttons"></div><select class="map-page__plane-select"><option value="1">1</option><option value="2">2</option></select>`;
    (map as unknown as { worldMap: typeof worldMap }).worldMap = worldMap;
    (map as unknown as { authedSection: HTMLElement }).authedSection = authedSection;
    (map as unknown as { playerButtons: HTMLElement }).playerButtons = map.querySelector(".map-page__focus-player-buttons");
    (map as unknown as { planeSelect: HTMLSelectElement }).planeSelect = map.querySelector(".map-page__plane-select");

    expect(map.getSelectedPlane()).toBe(1);
    map.handlePlaneChange(new CustomEvent("plane-changed", { detail: { plane: 2 } }));
    map.handlePlaneSelect();
    map.handleUpdatedMembers([{ name: "Alice" }, { name: "@SHARED" }]);
    map.handleFocusPlayer({ target: map.querySelector("button[player-name]") } as MouseEvent);
    expect(worldMap.showPlane).toHaveBeenCalledWith(2);
    expect(worldMap.followPlayer).toHaveBeenCalledWith("Alice");
    map.disconnectedCallback();
    expect(authedSection.classList.contains("no-pointer-events")).toBe(false);
  });
});

describe("collection log page helper", () => {
  it("resolves page metadata from the collection log cache", () => {
    const page = new CollectionLogPage();
    page.setAttribute("player-name", "Alice");
    page.setAttribute("tab-id", "0");
    page.setAttribute("page-name", "Boss Page");
    page.connectedCallback();

    expect(page.pageTitle).toBe("Boss Page");
    expect(page.pageItems).toHaveLength(2);
    expect(page.completionStateClass).toBe("collection-log__complete");
    expect(page.pageTitleLink).toContain("Special:Lookup");
  });
});