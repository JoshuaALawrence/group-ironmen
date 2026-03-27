import { BaseElement } from "../base-element/base-element";
import { groupData } from "../data/group-data";
import { utility } from "../utility";

const COINS_ID = 995;

const COIN_STACKS = [
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

export class PlayerPanel extends BaseElement {
  constructor() {
    super();
  }

  html() {
    return `{{player-panel.html}}`;
  }

  connectedCallback() {
    super.connectedCallback();
    this.playerName = this.getAttribute("player-name");
    this.render();
    this.contentArea = this.querySelector(".player-panel__content");
    this.eventListener(this.querySelector(".player-panel__minibar"), "click", this.handleMiniBarClick.bind(this));
    this.eventListener(
      this.querySelector(".player-panel__collection-log"),
      "click",
      this.handleCollectionLogClick.bind(this)
    );
    this.eventListener(this.querySelector(".player-panel__bank"), "click", this.handleBankClick.bind(this));
    this.eventListener(this.querySelector(".player-panel__boss-kc"), "click", this.handleBossKcClick.bind(this));

    this.bankValueTextEl = this.querySelector(".player-panel__bank-value-text");
    this.bankValueImgEl = this.querySelector(".player-panel__bank-value img");
    this.bankValueTextEl.textContent = "0M";
    this.subscribe(`bank:${this.playerName}`, this.handleBankValueUpdate.bind(this));
    const memberData = groupData.members.get(this.playerName);
    if (memberData && memberData.bank && memberData.bank.length > 0) {
      this.handleBankValueUpdate(memberData.bank);
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
  }

  handleCollectionLogClick() {
    const collectionLogEl = document.createElement("collection-log");
    collectionLogEl.setAttribute("player-name", this.playerName);
    document.body.appendChild(collectionLogEl);
  }

  handleBankClick() {
    const bankDialogEl = document.createElement("bank-dialog");
    bankDialogEl.setAttribute("player-name", this.playerName);
    document.body.appendChild(bankDialogEl);
  }

  handleBossKcClick() {
    const bossKcDialogEl = document.createElement("boss-kc-dialog");
    bossKcDialogEl.setAttribute("player-name", this.playerName);
    document.body.appendChild(bossKcDialogEl);
  }

  handleBankValueUpdate(bank) {
    let totalValue = 0;
    for (const item of bank) {
      if (!item.isValid()) continue;
      if (item.id === COINS_ID) {
        totalValue += item.quantity;
      } else {
        totalValue += item.highAlch * item.quantity;
      }
    }
    this.bankValueTextEl.textContent = utility.formatShortQuantity(totalValue);
    let coinImg = 995;
    for (const [threshold, imgId] of COIN_STACKS) {
      if (totalValue >= threshold) {
        coinImg = imgId;
        break;
      }
    }
    this.bankValueImgEl.src = `/icons/items/${coinImg}.webp`;
  }

  handleMiniBarClick(event) {
    const component = event.target.getAttribute("data-component");
    if (component && this.activeComponent !== component) {
      this.contentArea.innerHTML = `<${component} player-name="${this.playerName}"></${component}>`;

      if (this.activeComponent) {
        this.querySelector(`button[data-component="${this.activeComponent}"]`).classList.remove(
          "player-panel__tab-active"
        );
      }
      this.querySelector(`button[data-component="${component}"]`).classList.add("player-panel__tab-active");
      this.activeComponent = component;
      this.classList.add("expanded");
    } else if (this.activeComponent && this.activeComponent === component) {
      this.contentArea.innerHTML = "";
      this.querySelector(`button[data-component="${this.activeComponent}"]`).classList.remove(
        "player-panel__tab-active"
      );
      this.activeComponent = null;
      this.classList.remove("expanded");
    }
  }
}
customElements.define("player-panel", PlayerPanel);
