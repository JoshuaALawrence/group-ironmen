import { BaseElement } from "../base-element/base-element";
import { collectionLog } from "../data/collection-log";
import { wiseOldMan } from "../data/wise-old-man";

const BOSS_NAME_COLLATOR = new Intl.Collator(undefined, {
  sensitivity: "base",
  numeric: true,
});

const DEFAULT_SORT_DIRECTION_BY_KEY = {
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

const BOSS_ICON_ALIASES = {
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

const SUMMARY_ICON_ALIASES = {
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

const BOSS_COLLECTION_LOG_LOOKUP_ALIASES = {
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

let bossCollectionLogPageMap;

function normalizeBossName(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizeCollectionLogLookupName(name) {
  let normalizedName = normalizeBossName(name);

  for (const suffix of COLLECTION_LOG_LABEL_SUFFIXES) {
    if (normalizedName.endsWith(suffix)) {
      normalizedName = normalizedName.slice(0, -suffix.length).trim();
      break;
    }
  }

  return BOSS_COLLECTION_LOG_LOOKUP_ALIASES[normalizedName] || normalizedName;
}

export function resolveBossIconSlug(bossName) {
  const normalizedBossName = normalizeBossName(bossName);
  return BOSS_ICON_ALIASES[normalizedBossName] || normalizedBossName.replace(/ +/g, "_");
}

export function resolveBossIconSources(bossName) {
  const bossIconSlug = resolveBossIconSlug(bossName);
  return [`${BOSS_ICON_DIRECTORY}/${bossIconSlug}_icon.png`, DEFAULT_BOSS_ICON];
}

export function resolveSummaryIconSlug(summaryMetric) {
  const normalizedMetric = String(summaryMetric || "")
    .trim()
    .toLowerCase();

  return SUMMARY_ICON_ALIASES[normalizedMetric] || null;
}

export function resolveSummaryIconSource(summaryEntry) {
  const summaryIconSlug = resolveSummaryIconSlug(summaryEntry?.metric);
  return summaryIconSlug ? `${SUMMARY_ICON_DIRECTORY}/${summaryIconSlug}.png` : null;
}

export function buildBossCollectionLogPageMap(collectionLogInfo) {
  const pageMap = new Map();

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
  boss,
  collectionLogPageMap,
  completionCountByPage = new Map(),
  pageSizeByPage = new Map()
) {
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

export function formatBossSummaryValue(summaryEntry) {
  const displayType = summaryEntry?.displayType === "rank" ? "rank" : "score";

  if (displayType === "rank") {
    return Number.isFinite(summaryEntry?.rank) && summaryEntry.rank > 0
      ? `#${summaryEntry.rank.toLocaleString()}`
      : "-";
  }

  return Number.isFinite(summaryEntry?.score) && summaryEntry.score >= 0 ? summaryEntry.score.toLocaleString() : "-";
}

export function sortBosses(bosses, sortKey = "boss", sortDirection = DEFAULT_SORT_DIRECTION_BY_KEY[sortKey] || "asc") {
  const directionMultiplier = sortDirection === "desc" ? -1 : 1;

  return [...bosses].sort((leftBoss, rightBoss) => {
    let comparison = 0;

    if (sortKey === "kills") {
      comparison = ((leftBoss.kills || 0) - (rightBoss.kills || 0)) * directionMultiplier;
    } else if (sortKey === "log") {
      const leftHasLog =
        Number.isFinite(leftBoss.logObtained) && Number.isFinite(leftBoss.logTotal) && leftBoss.logTotal > 0;
      const rightHasLog =
        Number.isFinite(rightBoss.logObtained) && Number.isFinite(rightBoss.logTotal) && rightBoss.logTotal > 0;

      if (!leftHasLog && !rightHasLog) {
        comparison = 0;
      } else if (!leftHasLog) {
        comparison = 1;
      } else if (!rightHasLog) {
        comparison = -1;
      } else {
        comparison = ((leftBoss.logObtained || 0) - (rightBoss.logObtained || 0)) * directionMultiplier;

        if (comparison === 0) {
          comparison = ((leftBoss.logTotal || 0) - (rightBoss.logTotal || 0)) * directionMultiplier;
        }
      }
    } else if (sortKey === "rank") {
      const leftHasRank = Number.isFinite(leftBoss.rank) && leftBoss.rank > 0;
      const rightHasRank = Number.isFinite(rightBoss.rank) && rightBoss.rank > 0;

      if (!leftHasRank && !rightHasRank) {
        comparison = 0;
      } else if (!leftHasRank) {
        comparison = 1;
      } else if (!rightHasRank) {
        comparison = -1;
      } else {
        comparison = (leftBoss.rank - rightBoss.rank) * directionMultiplier;
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
  constructor() {
    super();
    this.bosses = [];
    this.summary = [];
    this.collectionLogCompletionCountByPage = new Map();
    this.collectionLogPageSizeByPage = new Map();
    this.sortKey = "boss";
    this.sortDirection = DEFAULT_SORT_DIRECTION_BY_KEY.boss;
  }

  html() {
    return `{{boss-kc-dialog.html}}`;
  }

  connectedCallback() {
    super.connectedCallback();
    this.playerName = this.getAttribute("player-name");
    this.render();

    this.background = this.querySelector(".dialog__visible");
    this.statusEl = this.querySelector(".boss-kc-dialog__status");
    this.summaryEl = this.querySelector(".boss-kc-dialog__summary");
    this.summaryGridEl = this.querySelector(".boss-kc-dialog__summary-grid");
    this.tableEl = this.querySelector(".boss-kc-dialog__table");
    this.rowsEl = this.querySelector(".boss-kc-dialog__rows");
    this.titleEl = this.querySelector(".boss-kc-dialog__title");
    this.sortButtons = [...this.querySelectorAll(".boss-kc-dialog__header-button")];

    this.eventListener(this.querySelector(".dialog__close"), "click", this.close.bind(this));
    this.eventListener(this.background, "click", this.closeIfBackgroundClick.bind(this));
    for (const sortButton of this.sortButtons) {
      this.eventListener(sortButton, "click", () => this.handleSortChange(sortButton.dataset.sortKey));
    }

    this.updateSortButtons();

    this.loadBossKc();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
  }

  closeIfBackgroundClick(evt) {
    if (evt.target === this.background) {
      this.close();
    }
  }

  close() {
    this.remove();
  }

  setStatus(message, isError = false) {
    this.statusEl.textContent = message;
    this.statusEl.hidden = false;
    this.statusEl.classList.toggle("boss-kc-dialog__status-error", isError);
    this.tableEl.hidden = true;
  }

  normalizeBossName(name) {
    return normalizeBossName(name);
  }

  getBossIconSources(bossName) {
    return resolveBossIconSources(bossName);
  }

  handleSortChange(nextSortKey) {
    if (!nextSortKey) return;

    if (this.sortKey === nextSortKey) {
      this.sortDirection = this.sortDirection === "asc" ? "desc" : "asc";
    } else {
      this.sortKey = nextSortKey;
      this.sortDirection = DEFAULT_SORT_DIRECTION_BY_KEY[nextSortKey] || "asc";
    }

    this.updateSortButtons();
    this.renderSortedRows();
  }

  updateSortButtons() {
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

  createBossIcon(bossName) {
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

  createBossRow(boss) {
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
    log.textContent =
      Number.isFinite(boss.logObtained) && Number.isFinite(boss.logTotal)
        ? `${boss.logObtained.toLocaleString()}/${boss.logTotal.toLocaleString()}`
        : "-";

    const rank = document.createElement("span");
    rank.className = "boss-kc-dialog__numeric-cell";
    rank.textContent = boss.rank && boss.rank > 0 ? boss.rank.toLocaleString() : "-";

    bossCell.append(this.createBossIcon(boss.name), bossName);
    row.append(bossCell, kills, log, rank);
    return row;
  }

  createSummaryIcon(summaryEntry) {
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

  createSummaryCard(summaryEntry) {
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

  renderSummary(summary) {
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

  renderRows(bosses) {
    this.rowsEl.innerHTML = "";
    for (const boss of bosses) {
      this.rowsEl.appendChild(this.createBossRow(boss));
    }

    this.statusEl.hidden = true;
    this.tableEl.hidden = false;
  }

  renderSortedRows() {
    this.renderRows(sortBosses(this.bosses, this.sortKey, this.sortDirection));
  }

  async initCollectionLogProgress() {
    const groupData = await new Promise((resolve) => this.subscribeOnce("get-group-data", resolve));

    await collectionLog.initLogInfo();
    collectionLog.load(groupData);

    if (!bossCollectionLogPageMap) {
      bossCollectionLogPageMap = buildBossCollectionLogPageMap(collectionLog.info);
    }

    this.collectionLogCompletionCountByPage = new Map();
    this.collectionLogPageSizeByPage = new Map();

    for (const [, pageName] of bossCollectionLogPageMap.entries()) {
      if (this.collectionLogPageSizeByPage.has(pageName)) {
        continue;
      }

      this.collectionLogCompletionCountByPage.set(
        pageName,
        collectionLog.completionCountForPage(this.playerName, pageName)
      );
      this.collectionLogPageSizeByPage.set(pageName, collectionLog.pageSize(pageName));
    }

    return bossCollectionLogPageMap;
  }

  async loadBossKc() {
    this.renderSummary([]);
    this.setStatus("Loading boss kill counts and collection log...");

    try {
      const collectionLogPageMapPromise = this.initCollectionLogProgress().catch((error) => {
        console.warn("Unable to load collection log progress for boss KC dialog.", error);
        return null;
      });
      const playerBossKc = await wiseOldMan.getPlayerBossKc(this.playerName);
      const collectionLogPageMap = await collectionLogPageMapPromise;
      this.titleEl.textContent = `${playerBossKc.playerName}'s Boss KC`;
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
      this.setStatus(error.message || "Unable to load OSRS hiscore boss kill counts.", true);
    }
  }
}

customElements.define("boss-kc-dialog", BossKcDialog);
