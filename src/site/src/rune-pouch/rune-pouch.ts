import { BaseElement } from "../base-element/base-element";

type RuneItem = {
  id: number;
  quantity: number;
  name: string;
};

type ItemBoxElement = HTMLElement & {
  item?: RuneItem;
};

export class RunePouch extends BaseElement {
  pouchName: string | null;
  runePouch: RuneItem[];

  constructor() {
    super();
    this.pouchName = null;
    this.runePouch = [];
  }

  html(): string {
    return `{{rune-pouch.html}}`;
  }

  connectedCallback(): void {
    super.connectedCallback();
    const playerName = this.getAttribute("player-name");
    this.pouchName = this.getAttribute("pouch-name");
    this.subscribe(`runePouch:${playerName}`, (runePouch) => this.handleUpdatedRunePouch(runePouch as RuneItem[]));
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
  }

  handleUpdatedRunePouch(runePouch: RuneItem[]): void {
    this.runePouch = runePouch;
    this.render();

    const runeEls = document.createDocumentFragment();
    const tooltipRunes: string[] = [];
    for (const rune of this.runePouch) {
      const runeEl = document.createElement("div");
      runeEl.classList.add("rune-pouch__rune");

      if (rune.id > 0) {
        const itemBox = document.createElement("item-box") as ItemBoxElement;
        itemBox.setAttribute("very-short-quantity", "true");
        itemBox.setAttribute("no-tooltip", "true");
        itemBox.item = rune;
        runeEl.appendChild(itemBox);

        tooltipRunes.push(`${rune.quantity.toLocaleString()} ${rune.name}`);
      }

      runeEls.appendChild(runeEl);
    }

    this.appendChild(runeEls);

    this.enableTooltip();
    this.tooltipText = `${this.pouchName ?? "Rune pouch"}<br />${tooltipRunes.join("<br />")}`;
  }
}

customElements.define("rune-pouch", RunePouch);
