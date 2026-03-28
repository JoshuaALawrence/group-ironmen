import { BaseElement } from "../base-element/base-element";
import { collectionLog } from "../data/collection-log";

type CollectionLogPageInfo = NonNullable<ReturnType<typeof collectionLog.pageInfo>>;

export class CollectionLogPage extends BaseElement {
  playerName: string | null;
  tabId: number;
  pageName: string;
  pageInfo: CollectionLogPageInfo | null;
  pageTitle: string;
  pageCountLabels: string[];
  pageItems: Array<{ id: number }>;
  unlockedItemsCount: number;
  completionStateClass: string;
  pageTitleLink: string;

  constructor() {
    super();
    this.playerName = null;
    this.tabId = 0;
    this.pageName = "";
    this.pageInfo = null;
    this.pageTitle = "";
    this.pageCountLabels = [];
    this.pageItems = [];
    this.unlockedItemsCount = 0;
    this.completionStateClass = "";
    this.pageTitleLink = "";
  }

  html(): string {
    return `{{collection-log-page.html}}`;
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.playerName = this.getAttribute("player-name");
    this.tabId = Number.parseInt(this.getAttribute("tab-id") ?? "0", 10);
    this.pageName = this.getAttribute("page-name") ?? "";
    this.pageInfo = collectionLog.pageInfo(this.pageName);
    if (!this.pageInfo) {
      return;
    }
    this.pageTitle = this.pageInfo.name;
    this.pageCountLabels = this.pageInfo.completion_labels ?? [];
    this.pageItems = collectionLog.pageItems.get(this.pageName) ?? [];

    this.unlockedItemsCount = collectionLog.completionCountForPage(this.playerName ?? "", this.pageName);
    this.completionStateClass = collectionLog.completionStateClass(this.playerName ?? "", this.pageName);

    if (this.tabId === 2) {
      // Clues tab
      if (this.pageTitle.startsWith("Shared")) {
        this.pageTitleLink = "https://oldschool.runescape.wiki/w/Collection_log#Shared_Treasure_Trail_Rewards";
      } else {
        const difficulty = this.pageTitle.split(" ")[0].toLowerCase();
        this.pageTitleLink = `https://oldschool.runescape.wiki/w/Clue_scroll_(${difficulty})`;
      }
    } else {
      this.pageTitleLink = `https://oldschool.runescape.wiki/w/Special:Lookup?type=npc&name=${this.pageTitle}`;
    }

    this.render();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
  }
}

customElements.define("collection-log-page", CollectionLogPage);
