import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockedState = vi.hoisted(() => ({
  collectionLog: {
    initLogInfo: vi.fn(),
    load: vi.fn(),
    completionCountForPage: vi.fn(),
    pageSize: vi.fn(),
    info: [] as unknown[],
  },
  getPlayerBossKc: vi.fn(),
}));

vi.mock("../data/collection-log", () => ({
  collectionLog: mockedState.collectionLog,
}));

vi.mock("../data/wise-old-man", () => ({
  wiseOldMan: {
    getPlayerBossKc: mockedState.getPlayerBossKc,
  },
}));

import { pubsub } from "../data/pubsub";
import {
  BossKcDialog,
  buildBossCollectionLogPageMap,
  resolveBossCollectionLogProgress,
  sortBosses,
} from "../boss-kc-dialog/boss-kc-dialog";

const currentDir = dirname(fileURLToPath(import.meta.url));
const dialogTemplate = readFileSync(resolve(currentDir, "../boss-kc-dialog/boss-kc-dialog.html"), "utf8");

function renderDialogTemplate(dialog: BossKcDialog): string {
  return Function("self", `return \`${dialogTemplate.replace(/\$\{this\./g, "${self.")}\`;`)(dialog) as string;
}

function mountDialog(playerName = "Alice") {
  const dialog = document.createElement("boss-kc-dialog") as BossKcDialog;
  dialog.setAttribute("player-name", playerName);

  vi.spyOn(dialog, "render").mockImplementation(() => {
    dialog.innerHTML = renderDialogTemplate(dialog);
  });
  vi.spyOn(dialog, "loadBossKc").mockResolvedValue();

  document.body.appendChild(dialog);
  return dialog;
}

describe("boss kc dialog residual coverage", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    pubsub.subscribers.clear();
    pubsub.unpublishAll();
    mockedState.collectionLog.initLogInfo.mockReset().mockResolvedValue(undefined);
    mockedState.collectionLog.load.mockReset().mockResolvedValue(undefined);
    mockedState.collectionLog.completionCountForPage.mockReset().mockReturnValue(0);
    mockedState.collectionLog.pageSize.mockReset().mockReturnValue(0);
    mockedState.collectionLog.info = [];
    mockedState.getPlayerBossKc.mockReset().mockResolvedValue({
      playerName: "Alice",
      bosses: [],
      summary: [],
    });
  });

  afterEach(() => {
    document.body.innerHTML = "";
    pubsub.subscribers.clear();
    pubsub.unpublishAll();
    vi.restoreAllMocks();
  });

  it("maps collection log aliases back to original pages", () => {
    const pageMap = buildBossCollectionLogPageMap([
      {
        pages: [
          { name: "The Royal Titans", completion_labels: ["Royal Titans completion count"] },
          { name: "Vet'ion", completion_labels: ["Vet'ion kills"] },
          { name: "Theatre of Blood Hard Mode", completion_labels: ["Theatre of Blood Hard completions"] },
          { name: "Ignore Me", completion_labels: ["Royal Titans completions"] },
        ],
      },
    ]);

    const completionCounts = new Map([
      ["The Royal Titans", 4],
      ["Vet'ion", 2],
      ["Theatre of Blood Hard Mode", 6],
    ]);
    const pageSizes = new Map([
      ["The Royal Titans", 8],
      ["Vet'ion", 5],
      ["Theatre of Blood Hard Mode", 9],
    ]);

    expect(pageMap.get("royal titans")).toBe("The Royal Titans");
    expect(
      resolveBossCollectionLogProgress({ name: "The Royal Titans", metric: null }, pageMap, completionCounts, pageSizes)
    ).toEqual({
      pageName: "The Royal Titans",
      obtained: 4,
      total: 8,
    });
    expect(resolveBossCollectionLogProgress({ name: "Vetion", metric: "vetion" }, pageMap, completionCounts, pageSizes)).toEqual({
      pageName: "Vet'ion",
      obtained: 2,
      total: 5,
    });
    expect(
      resolveBossCollectionLogProgress(
        { name: "Unknown", metric: "theatre_of_blood_hard_mode" },
        pageMap,
        completionCounts,
        pageSizes
      )
    ).toEqual({
      pageName: "Theatre of Blood Hard Mode",
      obtained: 6,
      total: 9,
    });
  });

  it("uses aliased summary icons and removes them after a load failure", () => {
    const dialog = mountDialog();
    const card = dialog.createSummaryCard({
      label: "PvP Arena",
      metric: "pvp_arena",
      displayType: "rank",
      rank: 42,
    });

    const icon = card.querySelector(".boss-kc-dialog__summary-icon") as HTMLImageElement;
    expect(icon).not.toBeNull();
    expect(icon.getAttribute("src")).toBe("/images/summary-icons/pvp_arena_rank.png");
    expect(card.querySelector(".boss-kc-dialog__summary-value")?.textContent).toBe("#42");

    icon.dispatchEvent(new Event("error"));

    expect(card.querySelector(".boss-kc-dialog__summary-icon")).toBeNull();
  });

  it("breaks kills, log, and rank ties by boss name", () => {
    const bosses = [
      { name: "Zulrah", kills: 5, logObtained: 2, logTotal: 3, rank: 7 },
      { name: "Artio", kills: 5, logObtained: 2, logTotal: 3, rank: 7 },
      { name: "Vorkath", kills: 5, logObtained: 2, logTotal: 4, rank: 2 },
    ];

    expect(sortBosses(bosses, "kills", "desc").map((boss) => boss.name)).toEqual(["Artio", "Vorkath", "Zulrah"]);
    expect(sortBosses(bosses, "log", "desc").map((boss) => boss.name)).toEqual(["Vorkath", "Artio", "Zulrah"]);
    expect(sortBosses(bosses, "rank", "asc").map((boss) => boss.name)).toEqual(["Vorkath", "Artio", "Zulrah"]);
  });

  it("clears status errors before rendering rows and falls back invalid numeric fields", () => {
    const dialog = mountDialog();

    dialog.setStatus("rate limited", true);
    expect(dialog.statusEl?.classList.contains("boss-kc-dialog__status-error")).toBe(true);
    expect(dialog.tableEl?.hidden).toBe(true);

    dialog.setStatus("Loading boss kill counts and collection log...");
    expect(dialog.statusEl?.classList.contains("boss-kc-dialog__status-error")).toBe(false);

    dialog.renderRows([
      {
        name: "Artio",
        kills: 1234,
        logObtained: Number.POSITIVE_INFINITY,
        logTotal: 2,
        rank: 0,
      },
    ]);

    const numericCells = Array.from(dialog.rowsEl?.querySelectorAll<HTMLElement>(".boss-kc-dialog__numeric-cell") ?? []).map(
      (cell) => cell.textContent
    );

    expect(numericCells).toEqual(["1,234", "-", "-"]);
    expect(dialog.statusEl?.hidden).toBe(true);
    expect(dialog.tableEl?.hidden).toBe(false);
  });

  it("shows a generic error message when boss KC loading rejects with a non-Error", async () => {
    const dialog = mountDialog();

    vi.spyOn(dialog, "initCollectionLogProgress").mockResolvedValue(new Map());
    mockedState.getPlayerBossKc.mockRejectedValueOnce("throttled");

    await BossKcDialog.prototype.loadBossKc.call(dialog);

    expect(dialog.statusEl?.textContent).toBe("Unable to load OSRS hiscore boss kill counts.");
    expect(dialog.statusEl?.classList.contains("boss-kc-dialog__status-error")).toBe(true);
    expect(dialog.tableEl?.hidden).toBe(true);
  });

  it("continues loading when collection log progress initialization fails", async () => {
    const dialog = mountDialog();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    dialog.setStatus("stale error", true);
    dialog.renderSummary([{ label: "Old", metric: "collections_logged", displayType: "score", score: 1 }]);

    vi.spyOn(dialog, "initCollectionLogProgress").mockRejectedValueOnce(new Error("missing collection log"));
    mockedState.getPlayerBossKc.mockResolvedValueOnce({
      playerName: "Bob",
      summary: [{ label: "PvP Arena", metric: "pvp_arena", displayType: "rank", rank: 15 }],
      bosses: [{ name: "Artio", metric: "artio", kills: 22, rank: 11 }],
    });

    await BossKcDialog.prototype.loadBossKc.call(dialog);

    expect(warnSpy).toHaveBeenCalledWith(
      "Unable to load collection log progress for boss KC dialog.",
      expect.any(Error)
    );
    expect(dialog.titleEl?.textContent).toBe("Bob's Boss KC");
    expect(dialog.summaryGridEl?.children).toHaveLength(1);
    expect(dialog.statusEl?.hidden).toBe(true);
    expect(dialog.statusEl?.classList.contains("boss-kc-dialog__status-error")).toBe(false);
    expect(dialog.rowsEl?.querySelector(".boss-kc-dialog__boss-name")?.textContent).toBe("Artio");
  });

  it("caches the collection log page map and only computes unique page totals per load", async () => {
    const dialog = mountDialog();

    mockedState.collectionLog.info = [
      {
        pages: [
          { name: "Callisto and Artio", completion_labels: ["Artio kills"] },
          { name: "The Royal Titans" },
        ],
      },
    ];
    mockedState.collectionLog.completionCountForPage.mockImplementation(
      (_playerName: string, pageName: string) => (pageName === "Callisto and Artio" ? 2 : 7)
    );
    mockedState.collectionLog.pageSize.mockImplementation((pageName: string) =>
      pageName === "Callisto and Artio" ? 5 : 8
    );

    pubsub.publish("get-group-data", { members: new Map() });
    const firstMap = await BossKcDialog.prototype.initCollectionLogProgress.call(dialog);

    expect(firstMap?.get("artio")).toBe("Callisto and Artio");
    expect(firstMap?.get("royal titans")).toBe("The Royal Titans");
    expect(mockedState.collectionLog.completionCountForPage).toHaveBeenCalledTimes(2);
    expect(mockedState.collectionLog.pageSize).toHaveBeenCalledTimes(2);
    expect(mockedState.collectionLog.completionCountForPage).toHaveBeenNthCalledWith(1, "Alice", "Callisto and Artio");
    expect(mockedState.collectionLog.completionCountForPage).toHaveBeenNthCalledWith(2, "Alice", "The Royal Titans");

    mockedState.collectionLog.info = [{ pages: [{ name: "Should Not Be Used" }] }];

    pubsub.publish("get-group-data", { members: new Map() });
    const secondMap = await BossKcDialog.prototype.initCollectionLogProgress.call(dialog);

    expect(secondMap).toBe(firstMap);
    expect(secondMap?.has("should not be used")).toBe(false);
    expect(mockedState.collectionLog.initLogInfo).toHaveBeenCalledTimes(2);
    expect(mockedState.collectionLog.load).toHaveBeenCalledTimes(2);
    expect(mockedState.collectionLog.completionCountForPage).toHaveBeenCalledTimes(4);
    expect(dialog.collectionLogCompletionCountByPage.get("Callisto and Artio")).toBe(2);
    expect(dialog.collectionLogPageSizeByPage.get("The Royal Titans")).toBe(8);
  });
});