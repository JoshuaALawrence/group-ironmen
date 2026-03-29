import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HomePage } from "../home-page/home-page";
import { EventsPage } from "../events-page/events-page";
import { groupData } from "../data/group-data";
import { storage } from "../data/storage";
import { collectionLog } from "../data/collection-log";
import { Quest, QuestState } from "../data/quest";
import { SkillName } from "../data/skill";

function flushPromises(): Promise<void> {
  return Promise.resolve().then(() => Promise.resolve());
}

function makeHomeMember(
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
      1: { id: "1", state: QuestState.FINISHED },
      2: { id: "2", state: QuestState.NOT_STARTED },
    },
    diaries: {
      Karamja: {
        Easy: [true, false],
        Medium: [true],
      },
    },
    skills: {
      [SkillName.Overall]: { name: SkillName.Overall, level: 1600, xp: 123_456_789 },
      [SkillName.Attack]: { name: SkillName.Attack, level: 99 },
      [SkillName.Magic]: { name: SkillName.Magic, level: 90 },
      [SkillName.Woodcutting]: { name: SkillName.Woodcutting, level: 85 },
    },
    combatLevel: 121,
    allItems: () => [{ id: 100, gePrice: 500_000 }, { id: 101, gePrice: 12_500 }],
    totalItemQuantity: (id: number) => (id === 100 ? 2 : 4),
    ...overrides,
  };
}

describe("home and events page branches", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-28T12:00:00.000Z"));

    groupData.members = new Map();
    groupData.groupItems = {};

    collectionLog.info = [];
    collectionLog.pageItems = new Map();
    collectionLog.totalUniqueItems = 0;
    collectionLog.playerLogs = new Map();
    collectionLog.playerNames = [];

    Quest.questData = {
      1: { name: "Quest One", difficulty: "Novice", points: 1 },
      2: { name: "Quest Two", difficulty: "Experienced", points: 2 },
    } as never;
    Quest.totalPoints = 3;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("covers home-page empty and populated rendering states plus event filtering", async () => {
    storage.storeGroup("IRONMEN", "sekret");

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
    const futureEvents = [
      {
        event_id: 11,
        title: "Five Days Out",
        event_type: "other",
        event_time: new Date(now + 5 * 24 * 60 * 60 * 1000).toISOString(),
        event_end_time: null,
        icon: "",
      },
      {
        event_id: 12,
        title: "Past Event",
        event_type: "boss",
        event_time: new Date(now - 4 * 60 * 60 * 1000).toISOString(),
        event_end_time: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
        icon: "",
      },
      {
        event_id: 13,
        title: "Ongoing Event",
        event_type: "quest",
        event_time: new Date(now - 10 * 60 * 1000).toISOString(),
        event_end_time: new Date(now + 45 * 60 * 1000).toISOString(),
        icon: "",
      },
      {
        event_id: 14,
        title: "In Thirty Minutes",
        event_type: "boss",
        event_time: new Date(now + 30 * 60 * 1000).toISOString(),
        event_end_time: null,
        icon: "",
      },
      {
        event_id: 15,
        title: "Tonight",
        event_type: "raid",
        event_time: new Date(now + 2 * 60 * 60 * 1000).toISOString(),
        event_end_time: null,
        icon: "",
      },
      {
        event_id: 16,
        title: "Tomorrow",
        event_type: "skilling",
        event_time: new Date(now + 28 * 60 * 60 * 1000).toISOString(),
        event_end_time: null,
        icon: "",
      },
      {
        event_id: 17,
        title: "Three Days Out",
        event_type: "minigame",
        event_time: new Date(now + 3 * 24 * 60 * 60 * 1000).toISOString(),
        event_end_time: null,
        icon: "",
      },
    ];

    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/osrs-news") {
        return {
          ok: true,
          json: async () => [
            {
              title: "Community Update",
              description: "desc",
              link: "https://example.com/news-a",
              category: "Community",
              pubDate: new Date(now).toISOString(),
              imageUrl: "/images/news-a.png",
            },
            {
              title: "Mystery Post",
              description: "desc",
              link: "https://example.com/news-b",
              category: "Unknown",
              pubDate: new Date(now - 24 * 60 * 60 * 1000).toISOString(),
              imageUrl: "",
            },
          ],
        } as Response;
      }
      if (url === "/api/osrs-youtube") {
        return {
          ok: true,
          json: async () => [
            {
              videoId: "abc123",
              title: "Guide",
              thumbnail: "/images/yt.png",
              published: "today",
            },
          ],
        } as Response;
      }
      if (url === "/api/osrs-twitch") {
        return {
          ok: true,
          json: async () => ({
            live: true,
            title: "",
            thumbnail: "/images/live.png",
            link: "https://www.twitch.tv/osrs",
          }),
        } as Response;
      }
      if (url === "/api/group/IRONMEN/events") {
        expect(init?.headers).toEqual({ Authorization: "sekret" });
        return {
          ok: true,
          json: async () => futureEvents,
        } as Response;
      }
      throw new Error(`Unexpected fetch URL: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    home.renderNews();
    expect(home.querySelector(".home-page__news-list")?.textContent).toContain("No news available.");

    home.renderEvents();
    expect(home.querySelector(".home-page__events-list")?.textContent).toContain("No upcoming events.");

    home.renderYtVideos();
    expect(home.querySelector(".home-page__yt-list")?.textContent).toContain("No videos available.");

    home.twitchStream = {
      live: false,
      title: "",
      thumbnail: "",
      link: "",
    };
    home.renderTwitchStream();
    const offlineTwitch = home.querySelector(".home-page__twitch-card")?.innerHTML ?? "";
    expect(offlineTwitch).toContain("OFFLINE");
    expect(offlineTwitch).toContain("Last stream");
    expect(offlineTwitch).toContain("home-page__twitch-thumb--placeholder");
    expect(offlineTwitch).toContain("https://www.twitch.tv/oldschoolrs");

    expect(home.getEventTimeLabel({ event_time: new Date(now - 1_000).toISOString() } as never)).toBe("Happening now");
    expect(home.getEventTimeLabel({ event_time: new Date(now + 12 * 60 * 1000).toISOString() } as never)).toBe("In 12m");
    expect(home.getEventTimeLabel({ event_time: new Date(now + 3 * 60 * 60 * 1000).toISOString() } as never)).toBe("In 3h");
    expect(home.getEventTimeLabel({ event_time: new Date(now + 2 * 24 * 60 * 60 * 1000).toISOString() } as never)).toBe("In 2d");

    await home.fetchBlogPosts();
    await home.fetchYtVideos();
    await home.fetchTwitchStream();
    await home.fetchEvents();

    expect(home.blogPosts).toHaveLength(2);
    expect(home.querySelector(".home-page__news-list")?.innerHTML).toContain("home-page__news-img");
    expect(home.querySelector(".home-page__news-list")?.innerHTML).toContain("color:#ccc");
    expect(home.querySelector(".home-page__yt-list")?.innerHTML).toContain("youtube.com/watch?v=abc123");
    expect(home.querySelector(".home-page__twitch-card")?.innerHTML).toContain("LIVE");
    expect(home.querySelector(".home-page__twitch-card")?.innerHTML).toContain("Live now");
    expect(home.upcomingEvents.map((event) => event.title)).toEqual([
      "Ongoing Event",
      "In Thirty Minutes",
      "Tonight",
      "Tomorrow",
      "Three Days Out",
    ]);

    home.upcomingEvents = [
      {
        event_id: 99,
        title: "Fallback Color Event",
        event_type: "mystery",
        event_time: new Date(now + 10 * 60 * 1000).toISOString(),
        event_end_time: null,
        icon: "",
      },
    ];
    home.renderEvents();
    expect(home.querySelector(".home-page__events-list")?.innerHTML).toContain("border-left-color:#cccccc");

    fetchMock.mockClear();
    storage.clearGroup();
    await home.fetchEvents();
    storage.storeGroup("@EXAMPLE", "demo");
    await home.fetchEvents();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("covers home-page dashboard branches for titles, empty skills, and diary parsing", () => {
    const home = new HomePage();
    home.innerHTML = `
      <div class="home-page__members"></div>
      <div class="home-page__stats-grid"></div>
    `;

    collectionLog.totalUniqueItems = 4;
    collectionLog.playerLogs = new Map([
      ["Alice", { unlockedItems: new Map([[1, 1], [2, 1]]) }],
      ["Bob", { unlockedItems: new Map() }],
    ]) as never;

    groupData.groupItems = {
      100: {
        id: 100,
        name: "Big Stack",
        quantity: 2,
        visible: true,
        gePrice: 800_000,
        highAlch: 300_000,
        isTradeable: true,
        imageUrl: "",
        wikiLink: "",
      },
      101: {
        id: 101,
        name: "Rune Platebody",
        quantity: 4,
        visible: true,
        gePrice: 12_500,
        highAlch: 9_000,
        isTradeable: true,
        imageUrl: "",
        wikiLink: "",
      },
    } as never;

    const alice = makeHomeMember("Alice");
    const bob = makeHomeMember("Bob", {
      inactive: true,
      combatLevel: 75,
      skills: {
        [SkillName.Overall]: { name: SkillName.Overall, level: 900, xp: 90_000_000 },
        [SkillName.Attack]: { name: SkillName.Attack, level: 70 },
      },
      allItems: () => [{ id: 101, gePrice: 12_500 }],
      totalItemQuantity: () => 1,
    });
    const shared = makeHomeMember("@SHARED");

    home.members = [alice as never, bob as never, shared as never];
    home.updateDashboard();

    const membersHtml = home.querySelector(".home-page__members")?.innerHTML ?? "";
    expect(membersHtml).toContain("Alice");
    expect(membersHtml).toContain("Gold Goblin");
    expect(membersHtml).toContain("home-page__dot--offline");
    expect(membersHtml).not.toContain("@SHARED");

    const statsHtml = home.querySelector(".home-page__stats-grid")?.innerHTML ?? "";
    expect(statsHtml).toContain("Online");
    expect(statsHtml).toContain("Unique Items");
    expect(statsHtml).toContain("GE Value");

    const skilllessCard = home.renderMemberCard(
      makeHomeMember("Charlie", {
        skills: undefined,
        quests: {},
        diaries: null,
        allItems: () => [],
        totalItemQuantity: () => 0,
      }) as never,
      "",
      "",
      ""
    );
    expect(skilllessCard).not.toContain("home-page__member-title");
    expect(skilllessCard).not.toContain("home-page__top-skills");

    collectionLog.totalUniqueItems = 0;
    const noCollectionTotalCard = home.renderMemberCard(
      makeHomeMember("Delta", {
        skills: undefined,
        quests: {},
        diaries: null,
        allItems: () => [],
        totalItemQuantity: () => 0,
      }) as never,
      "",
      "",
      ""
    );
    expect(noCollectionTotalCard).not.toMatch(/Collections<\/span>\s*<span class="home-page__bar-value">0<span class="home-page__bar-dim">/);

    expect(home.getTotalLevel({} as never)).toBe(0);
    expect(home.getTotalXp({} as never)).toBe(0);
    expect(home.getDiaryTasksCompleted({ diaries: null } as never)).toEqual({ done: 0, total: 0 });
    expect(
      home.getDiaryTasksCompleted({
        diaries: {
          Desert: null,
          Varrock: {
            Easy: [true, false],
            Medium: "invalid",
          },
        },
      } as never)
    ).toEqual({ done: 1, total: 2 });
  });

  it("covers events-page timing, filtering, demo rendering, and form branches", () => {
    storage.storeGroup("@EXAMPLE", "demo-token");
    storage.setActiveMember("Alice");
    groupData.members = new Map([
      ["Alice", { name: "Alice" } as never],
      ["Bob", { name: "Bob" } as never],
      ["@SHARED", { name: "@SHARED" } as never],
    ]);

    const page = new EventsPage();
    page.events = [
      {
        event_id: 1,
        title: "Future Raid",
        description: "Bring brews",
        event_type: "raid",
        event_time: new Date(Date.now() + 20 * 60 * 1000).toISOString(),
        event_end_time: null,
        created_by: "Alice",
        created_at: new Date(Date.now()).toISOString(),
        icon: "boss:zulrah",
      },
      {
        event_id: 2,
        title: "Past Boss",
        description: "",
        event_type: "boss",
        event_time: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        event_end_time: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        created_by: "Bob",
        created_at: new Date(Date.now()).toISOString(),
        icon: "",
      },
    ] as never;

    expect(page.getRelativeTime(new Date(Date.now() + 30 * 1000).toISOString())).toBe("Starting now");
    expect(page.getRelativeTime(new Date(Date.now() - 30 * 1000).toISOString())).toBe("Just ended");
    expect(page.getRelativeTime(new Date(Date.now() + 10 * 60 * 1000).toISOString())).toBe("In 10m");
    expect(page.getRelativeTime(new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString())).toBe("3h ago");
    expect(page.getRelativeTime(new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString())).toBe("In 2d");

    expect(page.getUpcomingEvents()).toHaveLength(1);
    expect(page.getPastEvents()).toHaveLength(1);

    page.filterType = "raid";
    expect(page.getFilteredEvents()).toHaveLength(1);
    expect(page.renderFilterTabs()).toContain("events-page__filter-tab active");

    page.filterType = "minigame";
    expect(page.renderUpcoming()).toContain("No upcoming adventures on the board");
    expect(page.renderPast()).toBe("");

    page.filterType = "all";
    const pastCard = page.renderEventCard(page.events[1]!);
    expect(pastCard).toContain("events-page__card--past");
    expect(pastCard).not.toContain("events-page__delete-btn");

    const fallbackCard = page.renderEventCard({
      event_id: 3,
      title: "Unknown Type",
      description: "",
      event_type: "mystery",
      event_time: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      event_end_time: null,
      created_by: "Alice",
      created_at: new Date(Date.now()).toISOString(),
      icon: "",
    } as never);
    expect(fallbackCard).toContain("Other");

    page.showForm = false;
    expect(page.renderForm()).toBe("");

    page.showForm = true;
    page.selectedIcon = "boss:zulrah";
    const formHtml = page.renderForm();
    expect(formHtml).toContain("Post a New Adventure");
    expect(formHtml).toContain('data-icon="boss:zulrah"');
    expect(formHtml).toContain('value="Alice" selected');
    expect(formHtml).not.toContain("@SHARED");
  });

  it("covers events-page event handlers, validation paths, submit flow, and delete flow", async () => {
    storage.storeGroup("IRONMEN", "sekret");
    storage.setActiveMember("Alice");
    groupData.members = new Map([
      ["Alice", { name: "Alice" } as never],
      ["Bob", { name: "Bob" } as never],
      ["@SHARED", { name: "@SHARED" } as never],
    ]);

    let serverEvents = [
      {
        event_id: 77,
        title: "Bossing Soon",
        description: "Meet at bank",
        event_type: "boss",
        event_time: new Date(Date.now() + 90 * 60 * 1000).toISOString(),
        event_end_time: null,
        created_by: "Alice",
        created_at: new Date(Date.now()).toISOString(),
        icon: "boss:zulrah",
      },
      {
        event_id: 88,
        title: "Old Trip",
        description: "Done already",
        event_type: "skilling",
        event_time: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
        event_end_time: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
        created_by: "Bob",
        created_at: new Date(Date.now()).toISOString(),
        icon: "",
      },
    ];

    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/group/IRONMEN/events" && !init?.method) {
        return { ok: true, json: async () => serverEvents } as Response;
      }

      if (url === "/api/group/IRONMEN/events" && init?.method === "POST") {
        return { ok: true, json: async () => ({ ok: true }) } as Response;
      }

      if (url.endsWith("/events/77") && init?.method === "DELETE") {
        serverEvents = serverEvents.filter((event) => event.event_id !== 77);
        return { ok: true, json: async () => ({ ok: true }) } as Response;
      }

      throw new Error(`Unexpected fetch call: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const page = new EventsPage();
    vi.spyOn(page, "html").mockImplementation(() => `
      <button id="events-new-btn">New Event</button>
      <div class="events-page__filters">${page.renderFilterTabs()}</div>
      <div class="events-page__form-shell">${page.renderForm()}</div>
      <div class="events-page__upcoming">${page.renderUpcoming()}</div>
      ${page.renderPast()}
    `);

    document.body.appendChild(page);
    await flushPromises();

    page.events = serverEvents as never;
    page.render();
    page.bindEvents();

    const bossTab = page.querySelector('[data-filter="boss"]') as HTMLButtonElement;
    bossTab.click();
    expect(page.filterType).toBe("boss");

    const deleteBtn = page.querySelector('[data-delete-id="77"]') as HTMLButtonElement;
    deleteBtn.click();
    await flushPromises();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/group/IRONMEN/events/77",
      expect.objectContaining({ method: "DELETE", headers: expect.objectContaining({ Authorization: "sekret" }) })
    );
    expect(page.events.map((event) => event.event_id)).toEqual([88]);

    const newBtn = page.querySelector("#events-new-btn") as HTMLButtonElement;
    newBtn.click();
    expect(page.showForm).toBe(true);

    const iconButton = page.querySelector('[data-icon="boss:zulrah"]') as HTMLButtonElement;
    iconButton.click();
    expect(page.selectedIcon).toBe("boss:zulrah");
    expect(iconButton.classList.contains("selected")).toBe(true);

    const cancelBtn = page.querySelector("#event-cancel") as HTMLButtonElement;
    cancelBtn.click();
    expect(page.showForm).toBe(false);
    expect(page.selectedIcon).toBe("");

    newBtn.click();
    const titleEl = page.querySelector("#event-title") as HTMLInputElement;
    const timeEl = page.querySelector("#event-time") as HTMLInputElement;
    const endTimeEl = page.querySelector("#event-end-time") as HTMLInputElement;
    const descEl = page.querySelector("#event-desc") as HTMLTextAreaElement;
    const authorEl = page.querySelector("#event-author") as HTMLSelectElement;
    const submitBtn = page.querySelector("#event-submit") as HTMLButtonElement;

    const titleFocusSpy = vi.spyOn(titleEl, "focus");
    submitBtn.click();
    await flushPromises();
    expect(titleFocusSpy).toHaveBeenCalled();

    titleEl.value = "ToA night";
    const timeFocusSpy = vi.spyOn(timeEl, "focus");
    submitBtn.click();
    await flushPromises();
    expect(timeFocusSpy).toHaveBeenCalled();

    const selectedIconButton = page.querySelector('[data-icon="boss:zulrah"]') as HTMLButtonElement;
    selectedIconButton.click();
    timeEl.value = "2026-03-29T18:30";
    endTimeEl.value = "2026-03-29T20:00";
    descEl.value = "Bring supplies";
    authorEl.value = "Bob";
    submitBtn.click();
    await flushPromises();

    const postCall = fetchMock.mock.calls.find(
      ([url, init]) => url === "/api/group/IRONMEN/events" && (init as RequestInit | undefined)?.method === "POST"
    );
    expect(postCall).toBeTruthy();
    expect((postCall?.[1] as RequestInit).headers).toEqual({
      "Content-Type": "application/json",
      Authorization: "sekret",
    });
    expect(String((postCall?.[1] as RequestInit).body)).toContain("ToA night");
    expect(String((postCall?.[1] as RequestInit).body)).toContain(new Date("2026-03-29T18:30").toISOString());
    expect(String((postCall?.[1] as RequestInit).body)).toContain(new Date("2026-03-29T20:00").toISOString());
    expect(String((postCall?.[1] as RequestInit).body)).toContain("Bring supplies");
    expect(String((postCall?.[1] as RequestInit).body)).toContain("boss:zulrah");
    expect(String((postCall?.[1] as RequestInit).body)).toContain("Bob");
    expect(page.showForm).toBe(false);
    expect(page.selectedIcon).toBe("");
    expect(page.events.map((event) => event.event_id)).toEqual([88]);
  });
});