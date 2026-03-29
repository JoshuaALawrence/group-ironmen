import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GroupData } from "../data/group-data";
import { Item } from "../data/item";
import { api } from "../data/api";
import { HomePage } from "../home-page/home-page";
import { EventsPage } from "../events-page/events-page";
import { GroupSettings } from "../group-settings/group-settings";
import { groupData } from "../data/group-data";
import { storage } from "../data/storage";
import { memberSelectDialogManager } from "../member-select-dialog/member-select-dialog-manager";
import { pubsub } from "../data/pubsub";
import { appearance } from "../appearance";
import { router } from "../router";
import { SkillName } from "../data/skill";
import { QuestState, Quest } from "../data/quest";

describe("targeted data and page module coverage", () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = "";
    (window as any).getTheme = () => "retro";
    (window as any).updateTheme = vi.fn();

    Item.itemDetails = {
      1: { name: "Rune sword", highalch: 12000, isTradeable: true },
      2: { name: "Rune sword 75", highalch: 11000, isTradeable: false },
      3: { name: "Rune sword 0", highalch: 10000, isTradeable: false },
      4: { name: "Quest item", highalch: 1, isTradeable: false },
      10: { name: "Coin stack", highalch: 1, isTradeable: true, stacks: [[1, 11], { count: 100, id: 12 }] },
      11: { name: "Coin stack image 1", highalch: 1, isTradeable: true },
      12: { name: "Coin stack image 2", highalch: 1, isTradeable: true },
    };
    Item.itemNameToId = { "rune sword": 1 };
    Item.gePrices = { 1: 250000 };

    Quest.questData = {
      101: { name: "Quest A", difficulty: "Novice", points: 1 },
      102: { name: "Quest B", difficulty: "Experienced", points: 2 },
    } as never;
    Quest.questIds = [101, 102] as never;

    groupData.members = new Map();
    groupData.groupItems = {};

    router.registeredRoutes.clear();
    router.routeAliases.clear();
    router.activeRoute = null;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    pubsub.unpublishAll();
  });

  it("covers GroupData transforms, filtering, and grouping", () => {
    const gd = new GroupData();
    const transformed = gd.transformFromStorage([
      {
        name: "Alice",
        inventory: [1, 2, 4, 1],
        bank: [1, 1],
        equipment: [4, 1],
        rune_pouch: [10, 50],
        seed_vault: [4, 3],
        skills: Array.from({ length: Object.keys(SkillName).length - 1 }, (_, i) => i + 1),
        stats: [90, 99, 70, 77, 5000, 0, 330],
        coordinates: [3200, 3200, 1],
        quests: [2, 0],
        collection_log_v2: [1, 1],
        interacting: { location: { x: 5, y: 5, plane: 0 } },
      },
    ] as never);

    const alice = transformed[0] as any;
    expect(alice.inventory).toEqual([{ id: 1, quantity: 2 }, { id: 4, quantity: 1 }]);
    expect(alice.coordinates).toEqual({ x: 3200, y: 3201, plane: 1 });
    expect(alice.stats.world).toBe(330);
    expect(alice.quests[101]).toBe(QuestState.FINISHED);
    expect(alice.interacting.location).toEqual({ x: 5, y: 6, plane: 0 });

    gd.groupItems = {
      2: {
        id: 2,
        name: "Rune sword 75",
        quantity: 1,
        quantities: { Alice: 1 },
        visible: true,
        isTradeable: false,
        highAlch: 1,
        gePrice: 1,
        imageUrl: "img75",
        wikiLink: "w75",
      },
      3: {
        id: 3,
        name: "Rune sword 0",
        quantity: 2,
        quantities: { Bob: 2 },
        visible: true,
        isTradeable: false,
        highAlch: 1,
        gePrice: 1,
        imageUrl: "img0",
        wikiLink: "w0",
      },
      4: {
        id: 4,
        name: "Quest item",
        quantity: 1,
        quantities: { Alice: 1, Bob: 0 },
        visible: true,
        isTradeable: false,
        highAlch: 1,
        gePrice: 1,
        imageUrl: "imgQ",
        wikiLink: "wQ",
      },
    } as never;

    const display = gd.getDisplayItems();
    expect(display.some((x) => x.name === "Rune sword")).toBe(true);
    expect(display.some((x) => (x as any).isGrouped)).toBe(true);

    gd.applyTextFilter('"rune sword"|quest');
    expect(gd.groupItems[4].visible).toBe(true);
    gd.applyPlayerFilter("Bob");
    expect(gd.groupItems[4].visible).toBe(false);
    gd.applyTradeabilityFilter(true);
    expect(gd.groupItems[2].visible).toBe(false);
  });

  it("covers Item parse/image/ge/tradeability and async loaders", async () => {
    expect(Item.imageUrl(10, 1)).toBe("/icons/items/11.webp");
    expect(Item.imageUrl(10, 100)).toBe("/icons/items/12.webp");

    const degraded = new Item(2, 1);
    expect(degraded.gePrice).toBe(250000);
    expect(degraded.isTradeable).toBe(true);
    expect(new Item(4, 1).isTradeable).toBe(false);

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const parsed = Item.parseItemData([
      { id: 0, quantity: 5 },
      { id: 4, quantity: 1 },
      { id: 9999, quantity: 1 },
    ]);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].id).toBe(0);
    expect(warnSpy).toHaveBeenCalled();

    const fetchMock = vi.fn(async () => ({
      json: async () => ({
        20: { name: "Stacked thing", highalch: 2, isTradeable: true, stacks: [[10, 21]] },
        21: { name: "Rune sword", highalch: 3, isTradeable: true },
      }),
    }));
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);
    await Item.loadItems();
    expect(Item.itemDetails[20].id).toBe(20);
    expect(Item.itemDetails[20].stacks).toEqual([{ count: 10, id: 21 }]);
    expect(Item.itemNameToId["rune sword"]).toBe(21);

    const geSpy = vi.spyOn(api, "getGePrices").mockResolvedValue({
      json: async () => ({ 21: 999 }),
    } as Response);
    await Item.loadGePrices();
    expect(geSpy).toHaveBeenCalledOnce();
    expect(Item.gePrices[21]).toBe(999);
  });

  it("covers HomePage fetch/render helpers and group math", async () => {
    storage.storeGroup("IRONS", "sekret");

    const home = new HomePage();
    home.innerHTML = `
      <div class="home-page__news-list"></div>
      <div class="home-page__events-list"></div>
      <div class="home-page__yt-list"></div>
      <div class="home-page__twitch-card"></div>
      <div class="home-page__members"></div>
      <div class="home-page__stats-grid"></div>
    `;

    const now = Date.now();
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("osrs-news")) return { ok: true, json: async () => [{ title: "News", description: "d", link: "https://x", category: "Community", pubDate: new Date(now).toISOString(), imageUrl: "" }] } as Response;
      if (url.includes("/events")) {
        return {
          ok: true,
          json: async () => [
            { event_id: 1, title: "Future", event_type: "raid", event_time: new Date(now + 3600000).toISOString(), event_end_time: null, icon: "" },
            { event_id: 2, title: "Ended", event_type: "boss", event_time: new Date(now - 7200000).toISOString(), event_end_time: new Date(now - 3600000).toISOString(), icon: "" },
            { event_id: 3, title: "Ongoing", event_type: "quest", event_time: new Date(now - 60000).toISOString(), event_end_time: new Date(now + 600000).toISOString(), icon: "" },
          ],
        } as Response;
      }
      if (url.includes("osrs-youtube")) return { ok: true, json: async () => [{ videoId: "abc", title: "Vid", thumbnail: "thumb", published: "today" }] } as Response;
      if (url.includes("osrs-twitch")) return { ok: true, json: async () => ({ live: false, title: "", thumbnail: "", link: "" }) } as Response;
      return { ok: false, json: async () => ({}) } as Response;
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    await home.fetchBlogPosts();
    await home.fetchEvents();
    await home.fetchYtVideos();
    await home.fetchTwitchStream();

    expect(fetchMock).toHaveBeenCalledWith("/api/group/IRONS/events", expect.objectContaining({ headers: expect.objectContaining({ Authorization: "sekret" }) }));
    expect(home.upcomingEvents.map((e) => e.title)).toEqual(["Ongoing", "Future"]);
    expect(home.querySelector(".home-page__news-list")?.innerHTML).toContain("News");
    expect(home.querySelector(".home-page__yt-list")?.innerHTML).toContain("youtube.com");
    expect(home.querySelector(".home-page__twitch-card")?.innerHTML).toContain("OFFLINE");

    const demo = new HomePage();
    storage.storeGroup("@EXAMPLE", "token");
    await demo.fetchEvents();
    expect(fetchMock).toHaveBeenCalledTimes(4);

    const memberA: any = {
      name: "Alice",
      inactive: false,
      quests: { 101: { id: 101, state: QuestState.FINISHED }, 102: { id: 102, state: QuestState.NOT_STARTED } },
      diaries: { Region: { Easy: [true, false], Medium: [true] } },
      skills: {
        [SkillName.Overall]: { name: SkillName.Overall, level: 1000, xp: 123456 },
        [SkillName.Attack]: { name: SkillName.Attack, level: 99 },
      },
      combatLevel: 100,
      allItems: () => [{ id: 1, gePrice: 10 }],
      totalItemQuantity: () => 3,
    };
    const memberB: any = { ...memberA, name: "Bob", inactive: true, combatLevel: 50, skills: { ...memberA.skills, [SkillName.Overall]: { name: SkillName.Overall, level: 900, xp: 100000 } } };
    home.members = [memberA, memberB, { ...memberA, name: "@SHARED" } as any];
    groupData.groupItems = {
      1: { id: 1, name: "A", quantity: 2, gePrice: 500, highAlch: 200, isTradeable: true, visible: true, imageUrl: "", wikiLink: "" },
    } as never;

    home.updateDashboard();
    expect(home.querySelector(".home-page__members")?.innerHTML).toContain("Alice");
    expect(home.querySelector(".home-page__stats-grid")?.innerHTML).toContain("Unique Items");

  });

  it("covers EventsPage fetch/submit/delete with dom + mocks", async () => {
    storage.storeGroup("IRONS", "sekret");
    storage.setActiveMember("Alice");
    groupData.members = new Map([
      ["Alice", { name: "Alice" } as never],
      ["Bob", { name: "Bob" } as never],
      ["@SHARED", { name: "@SHARED" } as never],
    ]);

    const page = new EventsPage();

    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith("/events") && (!init || init.method === undefined)) {
        return { ok: true, json: async () => [] } as Response;
      }
      if (url.endsWith("/events") && init?.method === "POST") {
        return { ok: true, json: async () => ({}) } as Response;
      }
      if (url.includes("/events/") && init?.method === "DELETE") {
        return { ok: true, json: async () => ({}) } as Response;
      }
      return { ok: false, json: async () => ({}) } as Response;
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    await page.fetchEvents();
    page.innerHTML = `
      <input id="event-title" />
      <select id="event-type"><option value="boss">Boss</option></select>
      <input id="event-time" />
      <input id="event-end-time" />
      <textarea id="event-desc"></textarea>
      <select id="event-author"><option value="Alice">Alice</option></select>
    `;

    const titleEl = page.querySelector("#event-title") as HTMLInputElement;
    const timeEl = page.querySelector("#event-time") as HTMLInputElement;
    const authorEl = page.querySelector("#event-author") as HTMLSelectElement;

    const focusSpy = vi.spyOn(titleEl, "focus");
    await page.handleSubmit();
    expect(focusSpy).toHaveBeenCalled();

    titleEl.value = "Raid night";
    timeEl.value = "2026-04-01T20:00";
    authorEl.value = "Alice";
    page.selectedIcon = "boss:zulrah";
    await page.handleSubmit();

    const postCall = fetchMock.mock.calls.find((c) => String(c[0]).endsWith("/events") && (c[1] as RequestInit)?.method === "POST");
    expect(postCall).toBeTruthy();
    expect(String((postCall?.[1] as RequestInit).body)).toContain("Raid night");

    page.events = [
      {
        event_id: 99,
        title: "Soon",
        description: "",
        event_type: "boss",
        event_time: new Date(Date.now() + 3600000).toISOString(),
        event_end_time: null,
        created_by: "Alice",
        created_at: new Date().toISOString(),
        icon: "",
      },
    ];
    await page.handleDelete(99);
    expect(page.events).toHaveLength(0);

  });

  it("covers GroupSettings identity + discord state paths", async () => {
    storage.storeGroup("IRONS", "sekret");
    storage.setActiveMember("Alice");

    const settings = new GroupSettings();
    settings.innerHTML = `
      <div class="group-settings__members"></div>
      <div class="group-settings__identity-name"></div>
      <div class="group-settings__discord-content"></div>
      <input type="radio" name="appearance-style" value="retro" checked />
      <input type="radio" name="panel-dock-side" value="right" checked />
      <div class="group-settings__panels"></div>
      <div class="group-settings__style"></div>
    `;
    settings.memberSection = settings.querySelector(".group-settings__members");

    const themeSpy = vi.spyOn(appearance, "setTheme");
    const layoutSpy = vi.spyOn(appearance, "setLayout");
    settings.handleStyleChange();
    settings.handlePanelDockSideChange();
    expect(themeSpy).toHaveBeenCalledWith("retro");
    expect(layoutSpy).toHaveBeenCalledWith("row-reverse");

    settings.handleUpdatedMembers([{ name: "Alice" }, { name: "Bob" }, { name: "@SHARED" }]);
    expect(settings.querySelectorAll("edit-member")).toHaveLength(3);

    settings.updateIdentityDisplay();
    expect(settings.querySelector(".group-settings__identity-name")?.textContent).toBe("Alice");

    const selectSpy = vi.spyOn(memberSelectDialogManager, "selectMember").mockResolvedValue("Bob");
    const publishSpy = vi.spyOn(pubsub, "publish");
    await settings.handleChangeIdentity();
    expect(selectSpy).toHaveBeenCalledWith(["Alice", "Bob"]);
    expect(storage.getActiveMember()).toBe("Bob");
    expect(publishSpy).toHaveBeenCalledWith("active-member-changed", "Bob");

    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === "PUT") {
        return { ok: true, text: async () => "" } as Response;
      }
      return {
        ok: true,
        json: async () => ({
          has_webhook: true,
          members: [
            { name: "Alice", has_discord_id: true },
            { name: "Bob", has_discord_id: false },
          ],
        }),
      } as Response;
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    await settings.fetchDiscordSettings();
    const webhookInput = settings.querySelector("#discord-webhook-url") as HTMLInputElement;
    webhookInput.value = "https://discord.com/api/webhooks/abc";
    const memberInput = settings.querySelector(".group-settings__discord-member input") as HTMLInputElement;
    memberInput.value = "123";
    await settings.saveDiscordSettings();

    const putCall = fetchMock.mock.calls.find((c) => (c[1] as RequestInit)?.method === "PUT");
    expect(putCall).toBeTruthy();
    expect(String((putCall?.[1] as RequestInit).body)).toContain("webhook_url");

    storage.storeGroup("@EXAMPLE", "demo");
    const demoSettings = new GroupSettings();
    await demoSettings.fetchDiscordSettings();
    await demoSettings.handleChangeIdentity();

  });

  it("covers Router matching, aliases, wrapper disable, and fallback", () => {
    const baseWrapper = { disable: vi.fn() };
    const secondaryWrapper = { disable: vi.fn() };
    const routeA = { enable: vi.fn(), disable: vi.fn(), wrapper: baseWrapper };
    const routeB = { enable: vi.fn(), disable: vi.fn(), wrapper: secondaryWrapper };

    expect(router.location).toBe("");
    expect(router.didMatch("/x", "*")).toBe(true);

    router.register("/a", routeA as never);
    router.register("/b", routeB as never);
    router.aliasRoute("/a", "/alias-a");

    window.history.pushState({}, "", "/alias-a");
    expect(routeA.enable).toHaveBeenCalled();
    expect(routeB.disable).toHaveBeenCalled();

    // Trigger a location that does not match routeB so wrapper disable path runs without unmatched-route recursion.
    window.history.pushState({}, "", "/a");
    expect(secondaryWrapper.disable).toHaveBeenCalled();

    router.unregister("/b");
    expect(router.registeredRoutes.has("/b")).toBe(false);
  });
});
