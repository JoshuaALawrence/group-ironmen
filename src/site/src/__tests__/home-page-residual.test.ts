import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HomePage } from "../home-page/home-page";
import { collectionLog } from "../data/collection-log";
import { groupData } from "../data/group-data";
import { Quest, QuestState } from "../data/quest";
import { SkillName } from "../data/skill";
import { storage } from "../data/storage";

function createHomePage(): HomePage {
  const home = new HomePage();
  home.innerHTML = `
    <div class="home-page__news-list"></div>
    <div class="home-page__events-list"></div>
    <div class="home-page__yt-list"></div>
    <div class="home-page__twitch-card"></div>
    <div class="home-page__members"></div>
    <div class="home-page__stats-grid"></div>
  `;
  return home;
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
      2: { id: "2", state: QuestState.NOT_STARTED },
    },
    diaries: {
      Karamja: {
        Easy: [true, false],
      },
    },
    skills: {
      [SkillName.Overall]: { name: SkillName.Overall, level: 500, xp: 5_000_000 },
      [SkillName.Woodcutting]: { name: SkillName.Woodcutting, level: 50 },
      [SkillName.Magic]: { name: SkillName.Magic, level: 40 },
    },
    combatLevel: 80,
    allItems: () => [{ id: 100, gePrice: 100 }],
    totalItemQuantity: () => 1,
    ...overrides,
  };
}

describe("home-page residual branches", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();

    groupData.members = new Map();
    groupData.groupItems = {};

    collectionLog.info = [];
    collectionLog.pageItems = new Map();
    collectionLog.totalUniqueItems = 0;
    collectionLog.playerLogs = new Map();
    collectionLog.playerNames = [];

    Quest.questData = {
      1: { name: "Quest One", difficulty: "Novice", points: 1 },
      2: { name: "Quest Two", difficulty: "Intermediate", points: 2 },
    } as never;
    Quest.totalPoints = 3;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    storage.clearGroup();
  });

  it("skips state updates and rerenders when home-page fetches fail or return non-ok", async () => {
    const home = createHomePage();
    storage.storeGroup("IRONMEN", "sekret");

    const renderNews = vi.spyOn(home, "renderNews");
    const renderEvents = vi.spyOn(home, "renderEvents");
    const renderYtVideos = vi.spyOn(home, "renderYtVideos");
    const renderTwitchStream = vi.spyOn(home, "renderTwitchStream");

    const nonOkFetch = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/group/IRONMEN/events") {
        expect(init).toEqual({ headers: { Authorization: "sekret" } });
      }
      return { ok: false } as Response;
    });
    vi.stubGlobal("fetch", nonOkFetch as unknown as typeof fetch);

    await home.fetchBlogPosts();
    await home.fetchEvents();
    await home.fetchYtVideos();
    await home.fetchTwitchStream();

    expect(home.blogPosts).toEqual([]);
    expect(home.upcomingEvents).toEqual([]);
    expect(home.ytVideos).toEqual([]);
    expect(home.twitchStream).toBeNull();
    expect(renderNews).not.toHaveBeenCalled();
    expect(renderEvents).not.toHaveBeenCalled();
    expect(renderYtVideos).not.toHaveBeenCalled();
    expect(renderTwitchStream).not.toHaveBeenCalled();

    const rejectedFetch = vi.fn(async () => {
      throw new Error("network down");
    });
    vi.stubGlobal("fetch", rejectedFetch as unknown as typeof fetch);

    await home.fetchBlogPosts();
    await home.fetchEvents();
    await home.fetchYtVideos();
    await home.fetchTwitchStream();

    expect(home.blogPosts).toEqual([]);
    expect(home.upcomingEvents).toEqual([]);
    expect(home.ytVideos).toEqual([]);
    expect(home.twitchStream).toBeNull();
    expect(renderNews).not.toHaveBeenCalled();
    expect(renderEvents).not.toHaveBeenCalled();
    expect(renderYtVideos).not.toHaveBeenCalled();
    expect(renderTwitchStream).not.toHaveBeenCalled();
  });

  it("covers title ranking collisions, @SHARED-only filtering, and GE or HA fallbacks", () => {
    const home = createHomePage();

    const sharedOnly = makeMember("@SHARED");
    home.members = [sharedOnly as never];
    home.renderMemberCards();
    home.renderGroupStats();

    expect(home.querySelector(".home-page__members")?.innerHTML).toBe("");
    expect(home.querySelector(".home-page__stats-grid")?.innerHTML).toContain("0<span class=\"home-page__stat-dim\">/0</span>");

    groupData.groupItems = {
      100: {
        id: 100,
        name: "Coins",
        quantity: 2,
        visible: true,
        gePrice: 250,
        highAlch: 100,
        isTradeable: true,
        imageUrl: "",
        wikiLink: "",
      },
      101: {
        id: 101,
        name: "Mystery Box",
        quantity: 3,
        visible: true,
        gePrice: undefined,
        highAlch: undefined,
        isTradeable: false,
        imageUrl: "",
        wikiLink: "",
      },
      102: {
        id: 102,
        name: "Zero Stack",
        quantity: 0,
        visible: true,
        gePrice: 999,
        highAlch: 999,
        isTradeable: true,
        imageUrl: "",
        wikiLink: "",
      },
    } as never;

    expect(home.getGroupGeValue()).toBe(500);
    expect(home.getGroupHaValue()).toBe(200);

    const zeroTitleMember = makeMember("Zero", {
      combatLevel: 3,
      skills: {
        [SkillName.Overall]: { name: SkillName.Overall, level: 0, xp: 0 },
      },
      quests: {},
      diaries: null,
      allItems: () => [],
      totalItemQuantity: () => 0,
    });
    const zeroTitles = home.getMemberTitles([zeroTitleMember as never]);
    expect(zeroTitles.get("Zero")?.title).toBe("Broke Boy");

    const lowMember = makeMember("Low", {
      combatLevel: 10,
      skills: {
        [SkillName.Overall]: { name: SkillName.Overall, level: 400, xp: 4_000_000 },
      },
      quests: {},
      allItems: () => [],
      totalItemQuantity: () => 0,
    });
    const richMember = makeMember("Rich", {
      combatLevel: 126,
      skills: {
        [SkillName.Overall]: { name: SkillName.Overall, level: 1_500, xp: 150_000_000 },
        [SkillName.Woodcutting]: { name: SkillName.Woodcutting, level: 99 },
        [SkillName.Magic]: { name: SkillName.Magic, level: 96 },
      },
      quests: {
        1: { id: "1", state: QuestState.FINISHED },
      },
      allItems: () => [{ id: 200, gePrice: 1_000_000 }],
      totalItemQuantity: () => 10,
    });
    const questMember = makeMember("Quester", {
      combatLevel: 90,
      skills: {
        [SkillName.Overall]: { name: SkillName.Overall, level: 1_000, xp: 90_000_000 },
      },
      quests: {
        1: { id: "1", state: QuestState.FINISHED },
        2: { id: "2", state: QuestState.FINISHED },
      },
      allItems: () => [{ id: 201 }],
      totalItemQuantity: () => 5,
    });

    const titles = home.getMemberTitles([
      lowMember as never,
      richMember as never,
      questMember as never,
    ]);

    expect(titles.get("Rich")?.title).toBe("Gold Goblin");
    expect(titles.get("Low")?.title).toBe("Broke Boy");
    expect(titles.get("Quester")?.title).toBe("Lore Nerd");
    expect(home.getMemberGeValue(questMember as never)).toBe(0);
  });

  it("covers missing skill icons and twitch rendering with an explicit title", () => {
    const home = createHomePage();

    const card = home.renderMemberCard(
      makeMember("Iconless", {
        skills: {
          [SkillName.Overall]: { name: SkillName.Overall, level: 1_200, xp: 12_000_000 },
          Mystery: { name: "Mystery", level: 88 },
          [SkillName.Magic]: { name: SkillName.Magic, level: 70 },
        },
      }) as never,
      "Archivist",
      "#abcdef",
      "Reads <everything>"
    );

    expect(card).toContain("home-page__top-skills");
    expect(card).toContain('img src="" alt=""');
    expect(card).toContain("Reads &lt;everything&gt;");

    home.twitchStream = {
      live: false,
      title: "Bossing <Soon>",
      thumbnail: "/images/stream.png",
      link: "https://twitch.tv/custom",
    };
    home.renderTwitchStream();

    const twitchHtml = home.querySelector(".home-page__twitch-card")?.innerHTML ?? "";
    expect(twitchHtml).toContain("Bossing &lt;Soon&gt;");
    expect(twitchHtml).toContain("/images/stream.png");
    expect(twitchHtml).toContain("https://twitch.tv/custom");
    expect(twitchHtml).toContain("OFFLINE");
  });
});