import { BaseElement } from "../base-element/base-element";
import { loadingScreenManager } from "../loading-screen/loading-screen-manager";
import { collectionLog } from "../data/collection-log";

type CollectionLogGroupData = {
  members: Map<string, { name: string; collectionLog?: Array<{ id: number; quantity: number }> }>;
};

export class CollectionLog extends BaseElement {
  playerName: string | null;
  totalUniqueItems: number;
  unlockedUniqueItems: number;
  tabContent: HTMLElement | null;
  tabButtons: HTMLElement | null;
  background: HTMLElement | null;

  constructor() {
    super();
    this.playerName = null;
    this.totalUniqueItems = 0;
    this.unlockedUniqueItems = 0;
    this.tabContent = null;
    this.tabButtons = null;
    this.background = null;
  }

  html(): string {
    return `{{collection-log.html}}`;
  }

  async connectedCallback(): Promise<void> {
    super.connectedCallback();
    loadingScreenManager.showLoadingScreen();
    this.playerName = this.getAttribute("player-name");
    this.subscribeOnce("get-group-data", (groupData) => this.init(groupData as CollectionLogGroupData));
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    loadingScreenManager.hideLoadingScreen();
  }

  closeIfBackgroundClick(evt: MouseEvent): void {
    if (evt.target === this.background) {
      this.close();
    }
  }

  close(): void {
    this.remove();
  }

  async init(groupData: CollectionLogGroupData): Promise<void> {
    await collectionLog.initLogInfo();
    collectionLog.load(groupData);
    collectionLog.loadPlayer(this.playerName ?? "");
    loadingScreenManager.hideLoadingScreen();

    this.totalUniqueItems = collectionLog.totalUniqueItems;
    this.unlockedUniqueItems = collectionLog.totalUnlockedItems(this.playerName ?? "");
    this.render();

    this.tabContent = this.querySelector<HTMLElement>(".collection-log__tab-container");
    this.tabButtons = this.querySelector<HTMLElement>(".collection-log__tab-buttons");
    this.background = this.querySelector<HTMLElement>(".dialog__visible");
    this.showTab(0);

    if (this.tabButtons) {
      this.eventListener(this.tabButtons, "click", this.handleTabClick.bind(this) as EventListener);
    }
    if (this.background) {
      this.eventListener(this.background, "click", this.closeIfBackgroundClick.bind(this) as EventListener);
    }
    const closeButton = this.querySelector<HTMLElement>(".dialog__close");
    if (closeButton) {
      this.eventListener(closeButton, "click", this.close.bind(this));
    }
  }

  handleTabClick(event: Event): void {
    const target = event.target;
    const tabId = target instanceof Element ? target.getAttribute("tab-id") : null;
    if (tabId) {
      this.showTab(tabId);
    }
  }

  showTab(tabId: number | string): void {
    this.tabButtons?.querySelectorAll("button[tab-id]").forEach((button) => {
      if (button.getAttribute("tab-id") === `${tabId}`) button.classList.add("collection-log__tab-button-active");
      else button.classList.remove("collection-log__tab-button-active");
    });
    if (this.tabContent) {
      const tabEl = document.createElement("collection-log-tab");
      tabEl.setAttribute("player-name", this.playerName ?? "");
      tabEl.setAttribute("tab-id", String(tabId));
      this.tabContent.replaceChildren(tabEl);
    }
  }
}

customElements.define("collection-log", CollectionLog);
