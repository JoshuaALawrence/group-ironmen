import { BaseElement } from "../base-element/base-element";
import { groupData } from "../data/group-data";
import { utility } from "../utility";

type BankItem = {
  id: number;
  quantity: number;
  highAlch: number;
  isValid: () => boolean;
};

const COINS_ID = 995;

const COIN_STACKS: Array<[number, number]> = [
  [1000000000, 1004],
  [100000000, 1003],
  [50000000, 1002],
  [10000000, 1001],
  [5000000, 1000],
  [1000000, 999],
  [100000, 998],
  [10000, 997],
  [1, 996],
];

const PANEL_COMPONENTS = [
  "player-inventory",
  "player-equipment",
  "player-skills",
  "player-quests",
  "player-diaries",
] as const;

type PanelComponent = (typeof PANEL_COMPONENTS)[number];

const PANEL_COMPONENT_SET = new Set<string>(PANEL_COMPONENTS);

function escapeHtml(str: string): string {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function isPanelComponent(value: string | null): value is PanelComponent {
  return value !== null && PANEL_COMPONENT_SET.has(value);
}

function createPanelComponent(component: PanelComponent): HTMLElement {
  switch (component) {
    case "player-inventory":
      return document.createElement("player-inventory");
    case "player-equipment":
      return document.createElement("player-equipment");
    case "player-skills":
      return document.createElement("player-skills");
    case "player-quests":
      return document.createElement("player-quests");
    case "player-diaries":
      return document.createElement("player-diaries");
  }
}

export class PlayerPanel extends BaseElement {
  playerName: string | null;
  contentArea: HTMLElement | null;
  bankValueTextEl: HTMLElement | null;
  bankValueImgEl: HTMLImageElement | null;
  activeComponent: PanelComponent | null;
  componentButtons: Map<PanelComponent, HTMLElement>;

  constructor() {
    super();
    this.playerName = null;
    this.contentArea = null;
    this.bankValueTextEl = null;
    this.bankValueImgEl = null;
    this.activeComponent = null;
    this.componentButtons = new Map();
  }

  html(): string {
    return `{{player-panel.html}}`;
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.playerName = this.getAttribute("player-name");
    this.render();
    this.contentArea = this.querySelector<HTMLElement>(".player-panel__content");
    const minibar = this.querySelector<HTMLElement>(".player-panel__minibar");
    const collectionLogButton = this.querySelector<HTMLElement>(".player-panel__collection-log");
    const bankButton = this.querySelector<HTMLElement>(".player-panel__bank");
    const bossKcButton = this.querySelector<HTMLElement>(".player-panel__boss-kc");
    this.componentButtons = new Map();
    for (const button of Array.from(this.querySelectorAll<HTMLElement>("button[data-component]"))) {
      const component = button.getAttribute("data-component");
      if (isPanelComponent(component)) {
        this.componentButtons.set(component, button);
      }
    }
    if (minibar) {
      this.eventListener(minibar, "click", this.handleMiniBarClick.bind(this) as EventListener);
    }
    if (collectionLogButton) {
      this.eventListener(collectionLogButton, "click", this.handleCollectionLogClick.bind(this));
    }
    if (bankButton) {
      this.eventListener(bankButton, "click", this.handleBankClick.bind(this));
    }
    if (bossKcButton) {
      this.eventListener(bossKcButton, "click", this.handleBossKcClick.bind(this));
    }

    this.bankValueTextEl = this.querySelector<HTMLElement>(".player-panel__bank-value-text");
    this.bankValueImgEl = this.querySelector<HTMLImageElement>(".player-panel__bank-value img");
    if (this.bankValueTextEl) {
      this.bankValueTextEl.textContent = "0M";
    }
    this.subscribe(`bank:${this.playerName}`, (bank) => this.handleBankValueUpdate(bank as BankItem[]));
    const memberData = groupData.members.get(this.playerName ?? "");
    if (memberData && memberData.bank && memberData.bank.length > 0) {
      this.handleBankValueUpdate(memberData.bank);
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
  }

  handleCollectionLogClick(): void {
    const collectionLogEl = document.createElement("collection-log");
    collectionLogEl.setAttribute("player-name", this.playerName ?? "");
    document.body.appendChild(collectionLogEl);
  }

  handleBankClick(): void {
    const bankDialogEl = document.createElement("bank-dialog");
    bankDialogEl.setAttribute("player-name", this.playerName ?? "");
    document.body.appendChild(bankDialogEl);
  }

  handleBossKcClick(): void {
    const bossKcDialogEl = document.createElement("boss-kc-dialog");
    bossKcDialogEl.setAttribute("player-name", this.playerName ?? "");
    document.body.appendChild(bossKcDialogEl);
  }

  handleBankValueUpdate(bank: BankItem[]): void {
    let totalValue = 0;
    for (const item of bank) {
      if (!item.isValid()) continue;
      if (item.id === COINS_ID) {
        totalValue += item.quantity;
      } else {
        totalValue += item.highAlch * item.quantity;
      }
    }
    if (this.bankValueTextEl) {
      this.bankValueTextEl.textContent = String(utility.formatShortQuantity(totalValue));
    }
    let coinImg = 995;
    for (const [threshold, imgId] of COIN_STACKS) {
      if (totalValue >= threshold) {
        coinImg = imgId;
        break;
      }
    }
    if (this.bankValueImgEl) {
      this.bankValueImgEl.src = `/icons/items/${coinImg}.webp`;
    }
  }

  handleMiniBarClick(event: Event): void {
    const target = event.target;
    const requestedComponent = target instanceof Element ? target.getAttribute("data-component") : null;
    const component = isPanelComponent(requestedComponent) ? requestedComponent : null;
    if (component && this.activeComponent !== component) {
      if (this.contentArea) {
        this.contentArea.textContent = '';
        const el = createPanelComponent(component);
        el.setAttribute('player-name', this.playerName ?? '');
        this.contentArea.appendChild(el);
      }

      if (this.activeComponent) {
        this.componentButtons.get(this.activeComponent)?.classList.remove("player-panel__tab-active");
      }
      this.componentButtons.get(component)?.classList.add("player-panel__tab-active");
      this.activeComponent = component;
      this.classList.add("expanded");
    } else if (this.activeComponent && this.activeComponent === component) {
      if (this.contentArea) {
        this.contentArea.textContent = "";
      }
      this.componentButtons.get(this.activeComponent)?.classList.remove("player-panel__tab-active");
      this.activeComponent = null;
      this.classList.remove("expanded");
    }
  }
}
customElements.define("player-panel", PlayerPanel);
