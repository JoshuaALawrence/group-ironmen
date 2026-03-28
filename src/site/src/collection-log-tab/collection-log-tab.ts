import { BaseElement } from "../base-element/base-element";
import { collectionLog } from "../data/collection-log";

type CollectionLogPageInfo = {
  name: string;
};

export class CollectionLogTab extends BaseElement {
  playerName: string | null;
  tabId: number;
  pages: CollectionLogPageInfo[];
  pageContainer: HTMLElement | null;
  tabList: HTMLElement | null;

  constructor() {
    super();
    this.playerName = null;
    this.tabId = 0;
    this.pages = [];
    this.pageContainer = null;
    this.tabList = null;
  }

  html(): string {
    return `{{collection-log-tab.html}}`;
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.playerName = this.getAttribute("player-name");
    this.tabId = Number.parseInt(this.getAttribute("tab-id") ?? "0", 10);
    this.pages = collectionLog.info[this.tabId]?.pages ?? [];
    this.render();

    this.pageContainer = this.querySelector<HTMLElement>(".collection-log__page-container");
    this.tabList = this.querySelector<HTMLElement>(".collection-log__tab-list");
    if (this.pages[0]) {
      this.showPage(this.pages[0].name);
    }
    if (this.tabList) {
      this.eventListener(this.tabList, "click", this.handlePageClick.bind(this) as EventListener);
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
  }

  handlePageClick(event: Event): void {
    const target = event.target;
    const pageName = target instanceof Element ? target.getAttribute("page-name") : null;
    if (pageName) {
      this.showPage(pageName);
    }
  }

  showPage(pageName: string): void {
    this.tabList?.querySelectorAll("button[page-name]").forEach((button) => {
      if (button.getAttribute("page-name") === `${pageName}`) button.classList.add("collection-log__page-active");
      else button.classList.remove("collection-log__page-active");
    });
    if (this.pageContainer) {
      this.pageContainer.innerHTML = `<collection-log-page player-name="${this.playerName ?? ""}" page-name="${pageName}" tab-id="${this.tabId}"></collection-log-page>`;
    }
  }
}

customElements.define("collection-log-tab", CollectionLogTab);
