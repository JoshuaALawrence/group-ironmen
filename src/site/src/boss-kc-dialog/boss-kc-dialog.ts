import { BaseElement } from "../base-element/base-element";
import { collectionLog } from "../data/collection-log";
import { wiseOldMan } from "../data/wise-old-man";

const BOSS_NAME_COLLATOR = new Intl.Collator(undefined, {
  sensitivity: "base",
  numeric: true,
});

type SortKey = "boss" | "kills" | "log" | "rank";
type SortDirection = "asc" | "desc";

type CollectionLogInfoPage = {
  name: string;
  completion_labels?: string[];
};

type CollectionLogInfoTab = {
  pages?: CollectionLogInfoPage[];
};

type CollectionLogGroupData = {
  members: Map<string, { name: string; collectionLog?: Array<{ id: number; quantity: number }> }>;
};

type BossLogProgress = {
  pageName: string;
  obtained: number;
  total: number;
};

type BossKcEntry = {
  name: string;
  metric?: string | null;
  kills: number;
  rank: number | null;
  logObtained?: number;
  logTotal?: number;
};

type BossSummaryEntry = {
  label: string;
  metric?: string | null;
  displayType?: string;
  rank?: number | null;
  score?: number | null;
};

type BossKcResponse = {
  playerName: string;
  bosses: BossKcEntry[];
  summary: BossSummaryEntry[];
};

type CollectionLogPageMap = Map<string, string>;

const DEFAULT_SORT_DIRECTION_BY_KEY: Record<SortKey, SortDirection> = {
  boss: "asc",
  kills: "desc",
  log: "desc",
  rank: "asc",
};

const COLLECTION_LOG_LABEL_SUFFIXES = [
  " completion count",
  " completions",
  " chests opened",
  " rewards claimed",
  " kills",
  " opened",
];

const BOSS_ICON_ALIASES: Record<string, string> = {
  artio: "artio_callisto",
  callisto: "artio_callisto",
  "callisto and artio": "artio_callisto",
  calvarion: "calvarion_vetion",
  "calvar ion": "calvarion_vetion",
  "dagannoth kings": "dagannoth_kings",
  "kree arra": "kreearra",
  "k ril tsutsaroth": "kril_tsutsaroth",
  "moons of peril": "lunar_chests",
  nightmare: "nightmare",
  "phosani s nightmare": "nightmare",
  "phosanis nightmare": "nightmare",
  "royal titans": "royal_titans",
  spindel: "spindel_venenatis",
  "the nightmare": "nightmare",
  "the royal titans": "royal_titans",
  "theatre of blood hard mode": "theatre_of_blood",
  "tombs of amascut expert mode": "tombs_of_amascut_expert",
  venenatis: "spindel_venenatis",
  vetion: "calvarion_vetion",
  "vet ion": "calvarion_vetion",
  "vetion and calvarion": "calvarion_vetion",
  "vet ion and calvar ion": "calvarion_vetion",
};

const BOSS_ICON_DIRECTORY = "/images/boss-icons";

const SUMMARY_ICON_DIRECTORY = "/images/summary-icons";

const DEFAULT_BOSS_ICON = "/images/skills/Combat_icon.png";

const SUMMARY_ICON_ALIASES: Record<string, string> = {
  bounty_hunter_hunter: "bounty_hunter_hunter",
  bounty_hunter_rogue: "bounty_hunter_rogue",
  clue_scrolls_all: "clue_scrolls_all",
  collections_logged: "collections_logged",
  colosseum_glory: "colosseum_glory",
  guardians_of_the_rift: "rifts_closed",
  last_man_standing: "last_man_standing",
  league_points: "league_points",
  pvp_arena: "pvp_arena_rank",
  soul_wars_zeal: "soul_wars_zeal",
};

const BOSS_COLLECTION_LOG_LOOKUP_ALIASES: Record<string, string> = {
  calvarion: "calvar ion",
  "chambers of xeric challenge mode": "chambers of xeric cm",
  "phosanis nightmare": "phosani s nightmare",
  "the royal titans": "royal titans",
  "theatre of blood entry mode": "theatre of blood entry",
  "theatre of blood hard mode": "theatre of blood hard",
  "tombs of amascut entry mode": "tombs of amascut entry",
  "tombs of amascut expert mode": "tombs of amascut expert",
  vetion: "vet ion",
};

let bossCollectionLogPageMap: CollectionLogPageMap | undefined;

function normalizeBossName(name?: string | null): string {
  return String(name || "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizeCollectionLogLookupName(name?: string | null): string {
  let normalizedName = normalizeBossName(name);

  for (const suffix of COLLECTION_LOG_LABEL_SUFFIXES) {
    if (normalizedName.endsWith(suffix)) {
      normalizedName = normalizedName.slice(0, -suffix.length).trim();
      break;
    }
  }

  return BOSS_COLLECTION_LOG_LOOKUP_ALIASES[normalizedName] || normalizedName;
}

export function resolveBossIconSlug(bossName: string): string {
  const normalizedBossName = normalizeBossName(bossName);
  return BOSS_ICON_ALIASES[normalizedBossName] || normalizedBossName.replace(/ +/g, "_");
}

export function resolveBossIconSources(bossName: string): string[] {
  const bossIconSlug = resolveBossIconSlug(bossName);
  return [`${BOSS_ICON_DIRECTORY}/${bossIconSlug}_icon.png`, DEFAULT_BOSS_ICON];
}

export function resolveSummaryIconSlug(summaryMetric?: string | null): string | null {
  const normalizedMetric = String(summaryMetric || "")
    .trim()
    .toLowerCase();

  return SUMMARY_ICON_ALIASES[normalizedMetric] || null;
}

export function resolveSummaryIconSource(summaryEntry: Partial<BossSummaryEntry>): string | null {
  const summaryIconSlug = resolveSummaryIconSlug(summaryEntry?.metric);
  return summaryIconSlug ? `${SUMMARY_ICON_DIRECTORY}/${summaryIconSlug}.png` : null;
}

export function buildBossCollectionLogPageMap(collectionLogInfo: CollectionLogInfoTab[]): CollectionLogPageMap {
  const pageMap = new Map<string, string>();

  for (const tab of collectionLogInfo || []) {
    for (const page of tab.pages || []) {
      const normalizedPageName = normalizeCollectionLogLookupName(page.name);
      if (normalizedPageName) {
        pageMap.set(normalizedPageName, page.name);
      }

      for (const completionLabel of page.completion_labels || []) {
        const normalizedCompletionLabel = normalizeCollectionLogLookupName(completionLabel);
        if (normalizedCompletionLabel && !pageMap.has(normalizedCompletionLabel)) {
          pageMap.set(normalizedCompletionLabel, page.name);
        }
      }
    }
  }

  return pageMap;
}

export function resolveBossCollectionLogProgress(
  boss: Pick<BossKcEntry, "name" | "metric">,
  collectionLogPageMap: CollectionLogPageMap | null,
  completionCountByPage = new Map<string, number>(),
  pageSizeByPage = new Map<string, number>()
): BossLogProgress | null {
  if (!collectionLogPageMap) {
    return null;
  }

  const lookupCandidates = [boss?.name, boss?.metric?.replaceAll("_", " ")]
    .map((value) => normalizeCollectionLogLookupName(value))
    .filter(Boolean);

  for (const lookupCandidate of lookupCandidates) {
    const pageName = collectionLogPageMap.get(lookupCandidate);
    if (!pageName) {
      continue;
    }

    return {
      pageName,
      obtained: completionCountByPage.get(pageName) || 0,
      total: pageSizeByPage.get(pageName) || 0,
    };
  }

  return null;
}

export function formatBossSummaryValue(summaryEntry: Partial<BossSummaryEntry>): string {
  const displayType = summaryEntry?.displayType === "rank" ? "rank" : "score";
  const rank = summaryEntry.rank ?? 0;
  const score = summaryEntry.score ?? -1;

  if (displayType === "rank") {
    return Number.isFinite(rank) && rank > 0 ? `#${rank.toLocaleString()}` : "-";
  }

  return Number.isFinite(score) && score >= 0 ? score.toLocaleString() : "-";
}

export function sortBosses(
  bosses: BossKcEntry[],
  sortKey: SortKey = "boss",
  sortDirection: SortDirection = DEFAULT_SORT_DIRECTION_BY_KEY[sortKey] || "asc"
): BossKcEntry[] {
  const directionMultiplier = sortDirection === "desc" ? -1 : 1;

  return [...bosses].sort((leftBoss, rightBoss) => {
    let comparison = 0;

    if (sortKey === "kills") {
      comparison = ((leftBoss.kills || 0) - (rightBoss.kills || 0)) * directionMultiplier;
    } else if (sortKey === "log") {
      const leftLogObtained = leftBoss.logObtained ?? 0;
      const leftLogTotal = leftBoss.logTotal ?? 0;
      const rightLogObtained = rightBoss.logObtained ?? 0;
      const rightLogTotal = rightBoss.logTotal ?? 0;
      const leftHasLog = Number.isFinite(leftLogObtained) && Number.isFinite(leftLogTotal) && leftLogTotal > 0;
      const rightHasLog = Number.isFinite(rightLogObtained) && Number.isFinite(rightLogTotal) && rightLogTotal > 0;

      if (!leftHasLog && !rightHasLog) {
        comparison = 0;
      } else if (!leftHasLog) {
        comparison = 1;
      } else if (!rightHasLog) {
        comparison = -1;
      } else {
        comparison = (leftLogObtained - rightLogObtained) * directionMultiplier;

        if (comparison === 0) {
          comparison = (leftLogTotal - rightLogTotal) * directionMultiplier;
        }
      }
    } else if (sortKey === "rank") {
      const leftRank = leftBoss.rank ?? 0;
      const rightRank = rightBoss.rank ?? 0;
      const leftHasRank = Number.isFinite(leftRank) && leftRank > 0;
      const rightHasRank = Number.isFinite(rightRank) && rightRank > 0;

      if (!leftHasRank && !rightHasRank) {
        comparison = 0;
      } else if (!leftHasRank) {
        comparison = 1;
      } else if (!rightHasRank) {
        comparison = -1;
      } else {
        comparison = (leftRank - rightRank) * directionMultiplier;
      }
    } else {
      comparison = BOSS_NAME_COLLATOR.compare(leftBoss.name, rightBoss.name) * directionMultiplier;
    }

    if (comparison !== 0) {
      return comparison;
    }

    return BOSS_NAME_COLLATOR.compare(leftBoss.name, rightBoss.name);
  });
}

export class BossKcDialog extends BaseElement {
  bosses: BossKcEntry[];
  summary: BossSummaryEntry[];
  collectionLogCompletionCountByPage: Map<string, number>;
  collectionLogPageSizeByPage: Map<string, number>;
  sortKey: SortKey;
  sortDirection: SortDirection;
  playerName: string | null;
  background: HTMLElement | null;
  statusEl: HTMLElement | null;
  summaryEl: HTMLElement | null;
  summaryGridEl: HTMLElement | null;
  tableEl: HTMLElement | null;
  rowsEl: HTMLElement | null;
  titleEl: HTMLElement | null;
  sortButtons: HTMLButtonElement[];

  constructor() {
    super();
    this.bosses = [];
    this.summary = [];
    this.collectionLogCompletionCountByPage = new Map();
    this.collectionLogPageSizeByPage = new Map();
    this.sortKey = "boss";
    this.sortDirection = DEFAULT_SORT_DIRECTION_BY_KEY.boss;
    this.playerName = null;
    this.background = null;
    this.statusEl = null;
    this.summaryEl = null;
    this.summaryGridEl = null;
    this.tableEl = null;
    this.rowsEl = null;
    this.titleEl = null;
    this.sortButtons = [];
  }

  html(): string {
    return `{{boss-kc-dialog.html}}`;
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.playerName = this.getAttribute("player-name");
    this.render();

    this.background = this.querySelector<HTMLElement>(".dialog__visible");
    this.statusEl = this.querySelector<HTMLElement>(".boss-kc-dialog__status");
    this.summaryEl = this.querySelector<HTMLElement>(".boss-kc-dialog__summary");
    this.summaryGridEl = this.querySelector<HTMLElement>(".boss-kc-dialog__summary-grid");
    this.tableEl = this.querySelector<HTMLElement>(".boss-kc-dialog__table");
    this.rowsEl = this.querySelector<HTMLElement>(".boss-kc-dialog__rows");
    this.titleEl = this.querySelector<HTMLElement>(".boss-kc-dialog__title");
    this.sortButtons = [...this.querySelectorAll<HTMLButtonElement>(".boss-kc-dialog__header-button")];

    const closeButton = this.querySelector<HTMLElement>(".dialog__close");
    if (closeButton) {
      this.eventListener(closeButton, "click", this.close.bind(this));
    }
    if (this.background) {
      this.eventListener(this.background, "click", this.closeIfBackgroundClick.bind(this) as EventListener);
    }
    for (const sortButton of this.sortButtons) {
      this.eventListener(sortButton, "click", () => this.handleSortChange(sortButton.dataset.sortKey));
    }

    this.updateSortButtons();

    this.loadBossKc();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
  }

  closeIfBackgroundClick(evt: MouseEvent): void {
    if (evt.target === this.background) {
      this.close();
    }
  }

  close(): void {
    this.remove();
  }

  setStatus(message: string, isError = false): void {
    if (this.statusEl) {
      this.statusEl.textContent = message;
      this.statusEl.hidden = false;
      this.statusEl.classList.toggle("boss-kc-dialog__status-error", isError);
    }
    if (this.tableEl) {
      this.tableEl.hidden = true;
    }
  }

  normalizeBossName(name: string): string {
    return normalizeBossName(name);
  }

  getBossIconSources(bossName: string): string[] {
    return resolveBossIconSources(bossName);
  }

  handleSortChange(nextSortKey?: string): void {
    if (!nextSortKey || !(nextSortKey in DEFAULT_SORT_DIRECTION_BY_KEY)) return;

    const sortKey = nextSortKey as SortKey;
    if (this.sortKey === sortKey) {
      this.sortDirection = this.sortDirection === "asc" ? "desc" : "asc";
    } else {
      this.sortKey = sortKey;
      this.sortDirection = DEFAULT_SORT_DIRECTION_BY_KEY[sortKey] || "asc";
    }

    this.updateSortButtons();
    this.renderSortedRows();
  }

  updateSortButtons(): void {
    if (!this.sortButtons) return;

    for (const sortButton of this.sortButtons) {
      const isActive = sortButton.dataset.sortKey === this.sortKey;
      sortButton.dataset.sortActive = String(isActive);
      if (isActive) {
        sortButton.dataset.sortDirection = this.sortDirection;
      } else {
        delete sortButton.dataset.sortDirection;
      }
    }
  }

  createBossIcon(bossName: string): HTMLImageElement {
    const icon = document.createElement("img");
    const sources = this.getBossIconSources(bossName);
    let sourceIndex = 0;

    icon.className = "boss-kc-dialog__boss-icon";
    icon.loading = "lazy";
    icon.alt = `${bossName} icon`;
    icon.src = sources[sourceIndex];
    icon.addEventListener("error", () => {
      sourceIndex += 1;
      if (sourceIndex >= sources.length) return;
      icon.src = sources[sourceIndex];
    });

    return icon;
  }

  createBossRow(boss: BossKcEntry): HTMLDivElement {
    const row = document.createElement("div");
    row.className = "boss-kc-dialog__row";

    const bossCell = document.createElement("div");
    bossCell.className = "boss-kc-dialog__boss-cell";

    const bossName = document.createElement("span");
    bossName.className = "boss-kc-dialog__boss-name";
    bossName.textContent = boss.name;

    const kills = document.createElement("span");
    kills.className = "boss-kc-dialog__numeric-cell";
    kills.textContent = boss.kills.toLocaleString();

    const log = document.createElement("span");
    log.className = "boss-kc-dialog__numeric-cell";
    const logObtained = boss.logObtained ?? 0;
    const logTotal = boss.logTotal ?? 0;
    log.textContent =
      Number.isFinite(logObtained) && Number.isFinite(logTotal)
        ? `${logObtained.toLocaleString()}/${logTotal.toLocaleString()}`
        : "-";

    const rank = document.createElement("span");
    rank.className = "boss-kc-dialog__numeric-cell";
    rank.textContent = boss.rank && boss.rank > 0 ? boss.rank.toLocaleString() : "-";

    bossCell.append(this.createBossIcon(boss.name), bossName);
    row.append(bossCell, kills, log, rank);
    return row;
  }

  createSummaryIcon(summaryEntry: BossSummaryEntry): HTMLImageElement | null {
    const source = resolveSummaryIconSource(summaryEntry);
    if (!source) {
      return null;
    }

    const icon = document.createElement("img");
    icon.className = "boss-kc-dialog__summary-icon";
    icon.loading = "lazy";
    icon.alt = `${summaryEntry.label} icon`;
    icon.src = source;
    icon.addEventListener(
      "error",
      () => {
        icon.remove();
      },
      { once: true }
    );

    return icon;
  }

  createSummaryCard(summaryEntry: BossSummaryEntry): HTMLDivElement {
    const card = document.createElement("div");
    card.className = "boss-kc-dialog__summary-card";

    const header = document.createElement("div");
    header.className = "boss-kc-dialog__summary-card-header";

    const label = document.createElement("span");
    label.className = "boss-kc-dialog__summary-label";
    label.textContent = summaryEntry.label;

    const value = document.createElement("span");
    value.className = "boss-kc-dialog__summary-value";
    value.textContent = formatBossSummaryValue(summaryEntry);
    if (value.textContent === "-") {
      value.classList.add("boss-kc-dialog__summary-value-missing");
    }

    const icon = this.createSummaryIcon(summaryEntry);
    if (icon) {
      header.append(icon);
    }

    header.append(label);
    card.append(header, value);
    return card;
  }

  renderSummary(summary: BossSummaryEntry[]): void {
    this.summary = Array.isArray(summary) ? summary : [];

    if (!this.summaryEl || !this.summaryGridEl) {
      return;
    }

    this.summaryGridEl.innerHTML = "";
    for (const summaryEntry of this.summary) {
      this.summaryGridEl.appendChild(this.createSummaryCard(summaryEntry));
    }

    this.summaryEl.hidden = this.summary.length === 0;
  }

  renderRows(bosses: BossKcEntry[]): void {
    if (!this.rowsEl || !this.statusEl || !this.tableEl) {
      return;
    }

    this.rowsEl.innerHTML = "";
    for (const boss of bosses) {
      this.rowsEl.appendChild(this.createBossRow(boss));
    }

    this.statusEl.hidden = true;
    this.tableEl.hidden = false;
  }

  renderSortedRows(): void {
    this.renderRows(sortBosses(this.bosses, this.sortKey, this.sortDirection));
  }

  async initCollectionLogProgress(): Promise<CollectionLogPageMap | null> {
    const groupData = await new Promise<CollectionLogGroupData>((resolve) =>
      this.subscribeOnce("get-group-data", (data) => resolve(data as CollectionLogGroupData))
    );

    await collectionLog.initLogInfo();
    await collectionLog.load(groupData);

    if (!bossCollectionLogPageMap) {
      bossCollectionLogPageMap = buildBossCollectionLogPageMap(collectionLog.info as CollectionLogInfoTab[]);
    }

    this.collectionLogCompletionCountByPage = new Map();
    this.collectionLogPageSizeByPage = new Map();

    for (const [, pageName] of bossCollectionLogPageMap.entries()) {
      if (this.collectionLogPageSizeByPage.has(pageName)) {
        continue;
      }

      this.collectionLogCompletionCountByPage.set(
        pageName,
        collectionLog.completionCountForPage(this.playerName ?? "", pageName)
      );
      this.collectionLogPageSizeByPage.set(pageName, collectionLog.pageSize(pageName));
    }

    return bossCollectionLogPageMap;
  }

  async loadBossKc(): Promise<void> {
    this.renderSummary([]);
    this.setStatus("Loading boss kill counts and collection log...");

    try {
      const collectionLogPageMapPromise = this.initCollectionLogProgress().catch((error): null => {
        console.warn("Unable to load collection log progress for boss KC dialog.", error);
        return null;
      });
      const playerBossKc = (await wiseOldMan.getPlayerBossKc(this.playerName ?? "")) as BossKcResponse;
      const collectionLogPageMap = await collectionLogPageMapPromise;
      if (this.titleEl) {
        this.titleEl.textContent = `${playerBossKc.playerName}'s Boss KC`;
      }
      this.renderSummary(playerBossKc.summary);

      if (playerBossKc.bosses.length === 0) {
        this.setStatus("No boss kill counts were found on the OSRS hiscores for this player.");
        return;
      }

      this.bosses = playerBossKc.bosses.map((boss) => {
        const logProgress = resolveBossCollectionLogProgress(
          boss,
          collectionLogPageMap,
          this.collectionLogCompletionCountByPage,
          this.collectionLogPageSizeByPage
        );

        return {
          ...boss,
          logObtained: logProgress?.obtained,
          logTotal: logProgress?.total,
        };
      });
      this.renderSortedRows();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unable to load OSRS hiscore boss kill counts.";
      this.setStatus(errorMessage, true);
    }
  }
}

customElements.define("boss-kc-dialog", BossKcDialog);
