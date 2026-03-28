import { describe, expect, it } from "vitest";
import {
  buildBossCollectionLogPageMap,
  formatBossSummaryValue,
  resolveBossCollectionLogProgress,
  resolveBossIconSlug,
  resolveBossIconSources,
  resolveSummaryIconSlug,
  resolveSummaryIconSource,
  sortBosses,
} from "./boss-kc-dialog";

const collectionLogInfo = [
  {
    tabId: 0,
    pages: [
      {
        name: "Callisto and Artio",
        completion_labels: ["Callisto kills", "Artio kills"],
        items: [{ id: 1 }, { id: 2 }, { id: 3 }],
      },
      {
        name: "Vet'ion and Calvar'ion",
        completion_labels: ["Vet'ion kills", "Calvar'ion kills"],
        items: [{ id: 4 }, { id: 5 }],
      },
      {
        name: "The Nightmare",
        completion_labels: ["Phosani's Nightmare kills", "Nightmare kills"],
        items: [{ id: 6 }, { id: 7 }, { id: 8 }, { id: 9 }],
      },
      {
        name: "Royal Titans",
        completion_labels: ["Royal Titan kills"],
        items: [{ id: 10 }, { id: 11 }],
      },
    ],
  },
  {
    tabId: 1,
    pages: [
      {
        name: "Tombs of Amascut",
        completion_labels: [
          "Tombs of Amascut completions",
          "Tombs of Amascut (Entry) completions",
          "Tombs of Amascut (Expert) completions",
        ],
        items: [{ id: 12 }, { id: 13 }, { id: 14 }, { id: 15 }, { id: 16 }],
      },
      {
        name: "Theatre of Blood",
        completion_labels: [
          "Theatre of Blood completions",
          "Theatre of Blood (Entry) completions",
          "Theatre of Blood (Hard) completions",
        ],
        items: [{ id: 17 }, { id: 18 }, { id: 19 }],
      },
    ],
  },
];

describe("boss kc collection log resolution", () => {
  const pageMap = buildBossCollectionLogPageMap(collectionLogInfo);
  const completionCountsByPage = new Map([
    ["Callisto and Artio", 2],
    ["Vet'ion and Calvar'ion", 1],
    ["The Nightmare", 3],
    ["Royal Titans", 1],
    ["Tombs of Amascut", 4],
    ["Theatre of Blood", 2],
  ]);
  const pageSizesByPage = new Map([
    ["Callisto and Artio", 3],
    ["Vet'ion and Calvar'ion", 2],
    ["The Nightmare", 4],
    ["Royal Titans", 2],
    ["Tombs of Amascut", 5],
    ["Theatre of Blood", 3],
  ]);

  it("maps boss rows onto collection log pages using page names and completion labels", () => {
    expect(
      resolveBossCollectionLogProgress(
        { name: "Artio", metric: "artio" },
        pageMap,
        completionCountsByPage,
        pageSizesByPage
      )
    ).toEqual({
      pageName: "Callisto and Artio",
      obtained: 2,
      total: 3,
    });
    expect(
      resolveBossCollectionLogProgress(
        { name: "Vetion", metric: "vetion" },
        pageMap,
        completionCountsByPage,
        pageSizesByPage
      )
    ).toEqual({
      pageName: "Vet'ion and Calvar'ion",
      obtained: 1,
      total: 2,
    });
    expect(
      resolveBossCollectionLogProgress(
        { name: "Phosanis Nightmare", metric: "phosanis_nightmare" },
        pageMap,
        completionCountsByPage,
        pageSizesByPage
      )
    ).toEqual({
      pageName: "The Nightmare",
      obtained: 3,
      total: 4,
    });
    expect(
      resolveBossCollectionLogProgress(
        { name: "The Royal Titans", metric: "royal_titans" },
        pageMap,
        completionCountsByPage,
        pageSizesByPage
      )
    ).toEqual({
      pageName: "Royal Titans",
      obtained: 1,
      total: 2,
    });
    expect(
      resolveBossCollectionLogProgress(
        { name: "Tombs of Amascut: Expert Mode", metric: "tombs_of_amascut_expert_mode" },
        pageMap,
        completionCountsByPage,
        pageSizesByPage
      )
    ).toEqual({
      pageName: "Tombs of Amascut",
      obtained: 4,
      total: 5,
    });
    expect(
      resolveBossCollectionLogProgress(
        { name: "Theatre of Blood: Hard Mode", metric: "theatre_of_blood_hard_mode" },
        pageMap,
        completionCountsByPage,
        pageSizesByPage
      )
    ).toEqual({
      pageName: "Theatre of Blood",
      obtained: 2,
      total: 3,
    });
  });
});

describe("boss kc icon resolution", () => {
  it("builds direct cache icon paths for standard boss names", () => {
    expect(resolveBossIconSources("Zulrah")).toEqual([
      "/images/boss-icons/zulrah_icon.png",
      "/images/skills/Combat_icon.png",
    ]);
    expect(resolveBossIconSources("The Whisperer")).toEqual([
      "/images/boss-icons/the_whisperer_icon.png",
      "/images/skills/Combat_icon.png",
    ]);
  });

  it("maps Wise Old Man names that differ from the cache icon filenames", () => {
    expect(resolveBossIconSlug("Artio")).toBe("artio_callisto");
    expect(resolveBossIconSlug("Kree'Arra")).toBe("kreearra");
    expect(resolveBossIconSlug("K'ril Tsutsaroth")).toBe("kril_tsutsaroth");
    expect(resolveBossIconSlug("Callisto")).toBe("artio_callisto");
    expect(resolveBossIconSlug("Callisto and Artio")).toBe("artio_callisto");
    expect(resolveBossIconSlug("Vet'ion")).toBe("calvarion_vetion");
    expect(resolveBossIconSlug("Vetion")).toBe("calvarion_vetion");
    expect(resolveBossIconSlug("Venenatis")).toBe("spindel_venenatis");
    expect(resolveBossIconSlug("Calvar'ion")).toBe("calvarion_vetion");
    expect(resolveBossIconSlug("Calvarion")).toBe("calvarion_vetion");
    expect(resolveBossIconSlug("The Royal Titans")).toBe("royal_titans");
    expect(resolveBossIconSlug("Tombs of Amascut: Expert Mode")).toBe("tombs_of_amascut_expert");
    expect(resolveBossIconSlug("Theatre of Blood: Hard Mode")).toBe("theatre_of_blood");
    expect(resolveBossIconSlug("Phosani's Nightmare")).toBe("nightmare");
    expect(resolveBossIconSlug("Phosanis Nightmare")).toBe("nightmare");
    expect(resolveBossIconSlug("Dagannoth Kings")).toBe("dagannoth_kings");
  });

  it("formats summary scores, ranks, and unavailable metrics", () => {
    expect(formatBossSummaryValue({ displayType: "score", score: 3210 })).toBe("3,210");
    expect(formatBossSummaryValue({ displayType: "score", score: 0 })).toBe("0");
    expect(formatBossSummaryValue({ displayType: "rank", rank: 9876 })).toBe("#9,876");
    expect(formatBossSummaryValue({ displayType: "score", score: null })).toBe("-");
  });

  it("maps summary metrics onto cache activity icon filenames", () => {
    expect(resolveSummaryIconSlug("clue_scrolls_all")).toBe("clue_scrolls_all");
    expect(resolveSummaryIconSlug("guardians_of_the_rift")).toBe("rifts_closed");
    expect(resolveSummaryIconSlug("pvp_arena")).toBe("pvp_arena_rank");
    expect(resolveSummaryIconSource({ metric: "collections_logged" })).toBe(
      "/images/summary-icons/collections_logged.png"
    );
    expect(resolveSummaryIconSource({ metric: "unknown_metric" })).toBeNull();
  });

  it("sorts by boss name, kc, log, and rank with stable tie-breaking", () => {
    const bosses = [
      { name: "Zulrah", kills: 50, logObtained: 1, logTotal: 4, rank: 120 },
      { name: "Artio", kills: 200, logObtained: 2, logTotal: 3, rank: 0 },
      { name: "Vorkath", kills: 200, logObtained: 2, logTotal: 5, rank: 30 },
    ];

    expect(sortBosses(bosses, "boss", "asc").map((boss) => boss.name)).toEqual(["Artio", "Vorkath", "Zulrah"]);
    expect(sortBosses(bosses, "kills", "desc").map((boss) => boss.name)).toEqual(["Artio", "Vorkath", "Zulrah"]);
    expect(sortBosses(bosses, "log", "desc").map((boss) => boss.name)).toEqual(["Vorkath", "Artio", "Zulrah"]);
    expect(sortBosses(bosses, "rank", "asc").map((boss) => boss.name)).toEqual(["Vorkath", "Zulrah", "Artio"]);
  });
});
