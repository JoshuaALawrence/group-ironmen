import { BaseElement } from "../base-element/base-element";
import { groupData } from "../data/group-data";
import quickselect from "../quick-select";

type DisplayItem = {
  id: number;
  name: string;
  quantity: number;
  quantities: Record<string, number>;
  highAlch: number;
  gePrice: number;
  visible: boolean;
  isGrouped?: boolean;
  variantIds?: number[];
};

type SearchElement = HTMLElement & {
  searchInput: HTMLInputElement;
  value: string | undefined;
};

export class InventoryPager extends BaseElement {
  pageLimit: number;
  currentPage: number;
  numberOfItems: number;
  numberOfPages: number;
  compare: (a: DisplayItem, b: DisplayItem) => number;
  pageTarget: HTMLElement | null;
  sortTarget: HTMLSelectElement | null;
  itemCount: HTMLElement | null;
  totalGeValue: HTMLElement | null;
  totalHaValue: HTMLElement | null;
  searchElement: SearchElement | null;
  showIndividualPricesInput: HTMLInputElement | null;
  showIndividualPrices: boolean;
  showGePriceInput: HTMLInputElement | null;
  showGePrice: boolean;
  showAlchPriceInput: HTMLInputElement | null;
  showAlchPrice: boolean;
  hideUntradeablesInput: HTMLInputElement | null;
  hideUntradeables: boolean;
  playerFilter: HTMLSelectElement | null;
  pageItems?: DisplayItem[];

  constructor() {
    super();
    this.pageLimit = 200;
    this.currentPage = 1;
    this.numberOfItems = 0;
    this.numberOfPages = 0;
    this.compare = this.compareOnQuantity.bind(this);
    this.pageTarget = null;
    this.sortTarget = null;
    this.itemCount = null;
    this.totalGeValue = null;
    this.totalHaValue = null;
    this.searchElement = null;
    this.showIndividualPricesInput = null;
    this.showIndividualPrices = false;
    this.showGePriceInput = null;
    this.showGePrice = true;
    this.showAlchPriceInput = null;
    this.showAlchPrice = true;
    this.hideUntradeablesInput = null;
    this.hideUntradeables = false;
    this.playerFilter = null;
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.pageTarget = document.querySelector<HTMLElement>(".items-page__list");
    this.sortTarget = document.querySelector<HTMLSelectElement>(".items-page__sort");
    this.itemCount = document.querySelector<HTMLElement>(".items-page__item-count");
    this.totalGeValue = document.querySelector<HTMLElement>(".items-page__total-ge-price");
    this.totalHaValue = document.querySelector<HTMLElement>(".items-page__total-ha-price");
    this.searchElement = document.querySelector<SearchElement>(".items-page__search");
    this.showIndividualPricesInput = document.querySelector<HTMLInputElement>("#items-page__individual-items");
    this.showIndividualPrices = this.showIndividualPricesInput?.checked ?? false;
    this.showGePriceInput = document.querySelector<HTMLInputElement>("#items-page__show-ge-price");
    if (this.showGePriceInput) {
      this.showGePriceInput.checked = localStorage.getItem("showGePrice") !== "false";
      this.showGePrice = this.showGePriceInput.checked;
    }
    this.showAlchPriceInput = document.querySelector<HTMLInputElement>("#items-page__show-alch-price");
    if (this.showAlchPriceInput) {
      this.showAlchPriceInput.checked = localStorage.getItem("showAlchPrice") !== "false";
      this.showAlchPrice = this.showAlchPriceInput.checked;
    }
    this.hideUntradeablesInput = document.querySelector<HTMLInputElement>("#items-page__hide-untradeables");
    if (this.hideUntradeablesInput) {
      this.hideUntradeablesInput.checked = localStorage.getItem("hideUntradeables") === "true";
      this.hideUntradeables = this.hideUntradeablesInput.checked;
    }
    this.playerFilter = document.querySelector<HTMLSelectElement>(".items-page__player-filter");
    if (this.searchElement) {
      this.eventListener(this.searchElement, "input", this.handleSearch.bind(this));
    }
    if (this.sortTarget) {
      this.eventListener(this.sortTarget, "change", this.handleSortChange.bind(this));
    }
    this.eventListener(this, "click", this.handleClick.bind(this) as EventListener);
    if (this.showIndividualPricesInput) {
      this.eventListener(this.showIndividualPricesInput, "change", this.handleIndividualPricesChange.bind(this));
    }
    if (this.showGePriceInput) {
      this.eventListener(this.showGePriceInput, "change", this.handleGePriceToggle.bind(this));
    }
    if (this.showAlchPriceInput) {
      this.eventListener(this.showAlchPriceInput, "change", this.handleAlchPriceToggle.bind(this));
    }
    if (this.hideUntradeablesInput) {
      this.eventListener(this.hideUntradeablesInput, "change", this.handleHideUntradeablesToggle.bind(this));
    }
    if (this.playerFilter) {
      this.eventListener(this.playerFilter, "change", this.handlePlayerFilterChange.bind(this));
    }
    this.subscribe("items-updated", this.handleUpdatedItems.bind(this));

    if (this.searchElement?.searchInput) {
      this.searchElement.searchInput.value = groupData.textFilter;
    }
    groupData.applyTradeabilityFilter(this.hideUntradeables);
  }

  /* eslint-disable no-unused-vars */
  html(): string {
    let pageButtonsHtml = "";
    const numberOfPages = this.numberOfPages;
    for (let i = 0; i < numberOfPages; ++i) {
      const active = i === this.currentPage - 1 ? "active" : "";
      pageButtonsHtml += `<button class="${active} inventory-pager__button men-button">${i + 1}</button>`;
    }
    return `{{inventory-pager.html}}`;
  }
  /* eslint-enable no-unused-vars */

  render(): void {
    super.render();
    if (this.numberOfItems !== undefined && this.itemCount) {
      this.itemCount.innerHTML = this.numberOfItems.toLocaleString();
    }
  }

  handlePlayerFilterChange(): void {
    const player = this.playerFilter?.value ?? "@ALL";
    groupData.applyPlayerFilter(player);
    this.maybeRenderPage(this.currentPage, true);
    this.render();
  }

  handleIndividualPricesChange(): void {
    this.showIndividualPrices = this.showIndividualPricesInput?.checked ?? false;
    this.maybeRenderPage(this.currentPage, true);
    this.render();
  }

  handleGePriceToggle(): void {
    this.showGePrice = this.showGePriceInput?.checked ?? true;
    localStorage.setItem("showGePrice", String(this.showGePrice));
    this.maybeRenderPage(this.currentPage, true);
    this.render();
  }

  handleAlchPriceToggle(): void {
    this.showAlchPrice = this.showAlchPriceInput?.checked ?? true;
    localStorage.setItem("showAlchPrice", String(this.showAlchPrice));
    this.maybeRenderPage(this.currentPage, true);
    this.render();
  }

  handleHideUntradeablesToggle(): void {
    this.hideUntradeables = this.hideUntradeablesInput?.checked ?? false;
    localStorage.setItem("hideUntradeables", String(this.hideUntradeables));
    groupData.applyTradeabilityFilter(this.hideUntradeables);
    this.maybeRenderPage(this.currentPage, true);
    this.render();
  }

  handleSearch(): void {
    const inputText = (this.searchElement?.value ?? "").trim().toLowerCase();
    groupData.applyTextFilter(inputText);
    this.maybeRenderPage(this.currentPage);
    this.render();
  }

  handleSortChange(): void {
    const selectedSort = this.sortTarget?.value;
    if (selectedSort === "totalquantity") {
      this.compare = this.compareOnQuantity.bind(this);
    } else if (selectedSort === "highalch") {
      this.compare = this.compareOnHighAlch.bind(this);
    } else if (selectedSort === "geprice") {
      this.compare = this.compareOnGePrice.bind(this);
    } else if (selectedSort === "alphabetical") {
      this.compare = this.compareAlphabetical.bind(this);
    }

    this.maybeRenderPage(this.currentPage);
    this.render();
  }

  handleClick(evt: Event): void {
    const target = evt.target;
    if (target instanceof HTMLElement && target.classList.contains("inventory-pager__button")) {
      const pageNumber = Number.parseInt(target.innerText, 10);
      this.currentPage = pageNumber;
      this.maybeRenderPage(pageNumber);
      this.render();
    }
  }

  compareOnQuantity(a: DisplayItem, b: DisplayItem): number {
    return this.itemQuantity(b) - this.itemQuantity(a);
  }

  compareOnHighAlch(a: DisplayItem, b: DisplayItem): number {
    if (this.showIndividualPrices) {
      return b.highAlch - a.highAlch;
    }

    return this.itemQuantity(b) * b.highAlch - this.itemQuantity(a) * a.highAlch;
  }

  compareOnGePrice(a: DisplayItem, b: DisplayItem): number {
    if (this.showIndividualPrices) {
      return b.gePrice - a.gePrice;
    }

    return this.itemQuantity(b) * b.gePrice - this.itemQuantity(a) * a.gePrice;
  }

  compareAlphabetical(a: DisplayItem, b: DisplayItem): number {
    return a.name.localeCompare(b.name);
  }

  handleUpdatedItems(): void {
    const previousItemCount = this.numberOfItems;
    this.maybeRenderPage(this.currentPage);

    if (this.numberOfItems !== previousItemCount) {
      this.render();
    }
  }

  maybeRenderPage(pageNumber: number, forceRender = false): void {
    const previousPageItems = this.pageItems;

    const items = groupData.getDisplayItems() as DisplayItem[];
    this.numberOfPages = Math.floor(items.length / this.pageLimit);
    this.numberOfItems = items.length;
    if (items.length - this.pageLimit * this.numberOfPages > 0) this.numberOfPages++;
    if (this.currentPage > this.numberOfPages) {
      this.currentPage = 1;
    }
    const newPageItems = this.getPage(this.currentPage, items);

    if (forceRender || this.pageUpdated(previousPageItems, newPageItems)) {
      this.pageItems = newPageItems;
      this.renderPage(newPageItems);
    }

    this.updateItemValues();
  }

  pageUpdated(previous: DisplayItem[] | undefined, current: DisplayItem[]): boolean {
    if (previous === undefined) return true;
    if (previous.length !== current.length) return true;

    for (let i = 0; i < current.length; ++i) {
      if (current[i].id !== previous[i].id) return true;
    }
    return false;
  }

  getPage(pageNumber: number, items: DisplayItem[]): DisplayItem[] {
    const compare = this.compare;
    let pageItems = [...items];
    for (let i = 0; i < pageNumber; ++i) {
      if (pageItems.length <= this.pageLimit) break;
      quickselect(pageItems, this.pageLimit, 0, pageItems.length - 1, compare);

      if (i !== pageNumber - 1) {
        pageItems = pageItems.slice(this.pageLimit, pageItems.length);
      }
    }

    pageItems = pageItems.slice(0, this.pageLimit);
    pageItems.sort(compare);
    return pageItems;
  }

  renderPage(page: DisplayItem[]): void {
    let items = "";
    for (const item of page) {
      const groupedAttr = item.isGrouped ? `grouped-ids="${(item.variantIds ?? []).join(",")}"` : "";
      items += `
<inventory-item item-id="${item.id}"
                ${groupedAttr}
                class="rsborder rsbackground"
                ${this.showIndividualPrices ? "individual-prices" : ""}
                ${!this.showGePrice ? "hide-ge-price" : ""}
                ${!this.showAlchPrice ? "hide-alch-price" : ""}
                ${groupData.playerFilter !== "@ALL" ? `player-filter="${groupData.playerFilter}"` : ""}>
</inventory-item>
`;
    }

    if (this.pageTarget) {
      this.pageTarget.innerHTML = items;
    }
  }

  updateItemValues(): void {
    let totalGeValue = 0;
    let totalHaValue = 0;
    for (const item of Object.values(groupData.groupItems)) {
      if (item.visible) {
        const quantity = this.itemQuantity(item as DisplayItem);
        totalGeValue += item.gePrice * quantity;
        totalHaValue += item.highAlch * quantity;
      }
    }

    if (this.totalGeValue) {
      this.totalGeValue.innerHTML = totalGeValue.toLocaleString();
    }
    if (this.totalHaValue) {
      this.totalHaValue.innerHTML = totalHaValue.toLocaleString();
    }
  }

  itemQuantity(item: DisplayItem): number {
    if (groupData.playerFilter !== "@ALL") {
      return item.quantities[groupData.playerFilter] ?? 0;
    }

    return item.quantity;
  }
}
customElements.define("inventory-pager", InventoryPager);
