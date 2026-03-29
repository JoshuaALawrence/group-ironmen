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
import { BossKcDialog, resolveBossCollectionLogProgress } from "../boss-kc-dialog/boss-kc-dialog";

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
  const loadSpy = vi.spyOn(dialog, "loadBossKc").mockResolvedValue();

  document.body.appendChild(dialog);

  return { dialog, loadSpy };
}

function renderedBossNames(dialog: BossKcDialog): string[] {
  return Array.from(dialog.rowsEl?.querySelectorAll<HTMLElement>(".boss-kc-dialog__boss-name") ?? []).map(
    (element) => element.textContent || ""
  );
}

describe("boss kc dialog DOM coverage", () => {
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

  it("renders on connect, wires listeners, and clears them on disconnect", () => {
    const { dialog, loadSpy } = mountDialog();

    expect(loadSpy).toHaveBeenCalledOnce();
    expect(dialog.playerName).toBe("Alice");
    expect(dialog.background).not.toBeNull();
    expect(dialog.statusEl).not.toBeNull();
    expect(dialog.summaryEl).not.toBeNull();
    expect(dialog.tableEl).not.toBeNull();
    expect(dialog.rowsEl).not.toBeNull();
    expect(dialog.sortButtons).toHaveLength(4);
    expect(dialog.titleEl?.textContent).toBe("Alice's Boss KC");
    expect(dialog.querySelector<HTMLElement>('[data-sort-key="boss"]')?.dataset.sortActive).toBe("true");
    expect(dialog.querySelector<HTMLElement>('[data-sort-key="boss"]')?.dataset.sortDirection).toBe("asc");
    expect(dialog.eventUnbinders.size).toBe(6);

    dialog.remove();

    expect(dialog.eventUnbinders.size).toBe(0);
    expect(dialog.eventListeners.size).toBe(0);
  });

  it("ignores inner clicks, closes on backdrop clicks, and removes on close button clicks", () => {
    const { dialog } = mountDialog();
    const closeSpy = vi.spyOn(dialog, "close").mockImplementation(() => undefined);

    dialog.querySelector<HTMLElement>(".boss-kc-dialog__container")?.dispatchEvent(
      new MouseEvent("click", { bubbles: true })
    );
    expect(closeSpy).not.toHaveBeenCalled();

    dialog.background?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(closeSpy).toHaveBeenCalledOnce();

    closeSpy.mockRestore();

    const buttonDialog = mountDialog("Bob").dialog;
    buttonDialog.querySelector<HTMLElement>(".dialog__close")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(buttonDialog.isConnected).toBe(false);
  });

  it("filters empty lookup candidates and returns null when collection log progress cannot be resolved", () => {
    expect(resolveBossCollectionLogProgress({ name: "", metric: "" }, null)).toBeNull();

    const pageMap = new Map([["artio", "Callisto and Artio"]]);
    expect(resolveBossCollectionLogProgress({ name: "!!!", metric: "___" }, pageMap)).toBeNull();
  });

  it("sorts rendered rows through header clicks and keeps missing log and rank entries last", () => {
    const { dialog } = mountDialog();
    dialog.bosses = [
      { name: "Zulrah", kills: 10, logObtained: 1, logTotal: 4, rank: 200 },
      { name: "Artio", kills: 10, logObtained: undefined, logTotal: 0, rank: null },
      { name: "Vorkath", kills: 50, logObtained: 2, logTotal: 2, rank: 10 },
    ];

    dialog.renderSortedRows();
    expect(renderedBossNames(dialog)).toEqual(["Artio", "Vorkath", "Zulrah"]);
    expect(dialog.tableEl?.hidden).toBe(false);
    expect(dialog.statusEl?.hidden).toBe(true);

    dialog.querySelector<HTMLElement>('[data-sort-key="kills"]')?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(dialog.sortKey).toBe("kills");
    expect(dialog.sortDirection).toBe("desc");
    expect(renderedBossNames(dialog)).toEqual(["Vorkath", "Artio", "Zulrah"]);

    dialog.querySelector<HTMLElement>('[data-sort-key="kills"]')?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(dialog.sortDirection).toBe("asc");
    expect(renderedBossNames(dialog)).toEqual(["Artio", "Zulrah", "Vorkath"]);

    dialog.querySelector<HTMLElement>('[data-sort-key="log"]')?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(dialog.sortDirection).toBe("desc");
    expect(renderedBossNames(dialog)).toEqual(["Vorkath", "Zulrah", "Artio"]);

    dialog.querySelector<HTMLElement>('[data-sort-key="rank"]')?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(dialog.sortDirection).toBe("asc");
    expect(renderedBossNames(dialog)).toEqual(["Vorkath", "Zulrah", "Artio"]);

    dialog.handleSortChange("not-a-sort-key");
    expect(dialog.sortKey).toBe("rank");
    expect(dialog.querySelector<HTMLElement>('[data-sort-key="rank"]')?.dataset.sortActive).toBe("true");
    expect(dialog.querySelector<HTMLElement>('[data-sort-key="rank"]')?.dataset.sortDirection).toBe("asc");
  });

  it("renders summary and row differences, including icon fallback and removal branches", () => {
    const { dialog } = mountDialog();

    dialog.renderSummary([
      { label: "Collections Logged", metric: "collections_logged", displayType: "score", score: 15 },
      { label: "PvP Arena", metric: "unknown_metric", displayType: "rank", rank: 0 },
    ]);

    const summaryCards = dialog.summaryGridEl?.querySelectorAll<HTMLElement>(".boss-kc-dialog__summary-card") || [];
    expect(dialog.summaryEl?.hidden).toBe(false);
    expect(summaryCards).toHaveLength(2);
    expect(summaryCards[0]?.querySelector(".boss-kc-dialog__summary-icon")).not.toBeNull();
    expect(summaryCards[1]?.querySelector(".boss-kc-dialog__summary-icon")).toBeNull();
    expect(summaryCards[1]?.querySelector(".boss-kc-dialog__summary-value-missing")).not.toBeNull();

    const summaryIcon = summaryCards[0]?.querySelector("img") as HTMLImageElement;
    summaryIcon.dispatchEvent(new Event("error"));
    expect(summaryCards[0]?.querySelector("img")).toBeNull();

    dialog.renderRows([
      { name: "Zulrah", kills: 1234, logObtained: 1, logTotal: 4, rank: 99 },
      { name: "The Nightmare", kills: 0, logObtained: Number.NaN, logTotal: 2, rank: null },
    ]);

    const rows = dialog.rowsEl?.querySelectorAll<HTMLElement>(".boss-kc-dialog__row") || [];
    const bossIcon = rows[0]?.querySelector(".boss-kc-dialog__boss-icon") as HTMLImageElement;
    expect(bossIcon.getAttribute("src")).toContain("/images/boss-icons/zulrah_icon.png");

    bossIcon.dispatchEvent(new Event("error"));
    expect(bossIcon.getAttribute("src")).toContain("/images/skills/Combat_icon.png");
    expect(rows[1]?.textContent).toContain("-");

    dialog.renderSummary([]);
    expect(dialog.summaryEl?.hidden).toBe(true);
  });

  it("loads boss kc, resets prior state, and renders summary plus collection log progress on success", async () => {
    const { dialog } = mountDialog();

    dialog.renderSummary([{ label: "Stale", metric: "collections_logged", displayType: "score", score: 1 }]);
    dialog.renderRows([{ name: "Old Boss", kills: 1, logObtained: 0, logTotal: 1, rank: 1 }]);

    vi.spyOn(dialog, "initCollectionLogProgress").mockImplementation(async () => {
      dialog.collectionLogCompletionCountByPage = new Map([["Callisto and Artio", 2]]);
      dialog.collectionLogPageSizeByPage = new Map([["Callisto and Artio", 3]]);
      return new Map([["artio", "Callisto and Artio"]]);
    });
    mockedState.getPlayerBossKc.mockResolvedValueOnce({
      playerName: "Alice",
      summary: [{ label: "Collections Logged", metric: "collections_logged", displayType: "score", score: 12 }],
      bosses: [
        { name: "Artio", metric: "artio", kills: 17, rank: 55 },
        { name: "Zulrah", metric: "zulrah", kills: 4, rank: 100 },
      ],
    });

    await BossKcDialog.prototype.loadBossKc.call(dialog);

    const firstRowCells = dialog.rowsEl?.querySelectorAll(".boss-kc-dialog__row .boss-kc-dialog__numeric-cell") || [];
    expect(dialog.titleEl?.textContent).toBe("Alice's Boss KC");
    expect(dialog.summaryGridEl?.children).toHaveLength(1);
    expect(dialog.summaryEl?.hidden).toBe(false);
    expect(renderedBossNames(dialog)).toEqual(["Artio", "Zulrah"]);
    expect(firstRowCells[0]?.textContent).toBe("17");
    expect(firstRowCells[1]?.textContent).toBe("2/3");
    expect(firstRowCells[2]?.textContent).toBe("55");
  });

  it("shows empty and error statuses when no bosses are returned or loading fails", async () => {
    const { dialog } = mountDialog();
    vi.spyOn(dialog, "initCollectionLogProgress").mockResolvedValue(new Map());

    dialog.renderSummary([{ label: "Old", metric: "collections_logged", displayType: "score", score: 9 }]);
    mockedState.getPlayerBossKc.mockResolvedValueOnce({
      playerName: "Alice",
      bosses: [],
      summary: [],
    });

    await BossKcDialog.prototype.loadBossKc.call(dialog);

    expect(dialog.summaryEl?.hidden).toBe(true);
    expect(dialog.tableEl?.hidden).toBe(true);
    expect(dialog.statusEl?.textContent).toBe("No boss kill counts were found on the OSRS hiscores for this player.");

    mockedState.getPlayerBossKc.mockRejectedValueOnce(new Error("rate limited"));

    await BossKcDialog.prototype.loadBossKc.call(dialog);

    expect(dialog.statusEl?.textContent).toBe("rate limited");
    expect(dialog.statusEl?.classList.contains("boss-kc-dialog__status-error")).toBe(true);
    expect(dialog.tableEl?.hidden).toBe(true);
  });
});