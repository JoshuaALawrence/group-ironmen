import { BaseElement } from "../base-element/base-element";

type XpDrop = {
  icon: string;
  xp: number;
};

export class XpDropper extends BaseElement {
  constructor() {
    super();
  }

  html() {
    return `{{xp-dropper.html}}`;
  }

  connectedCallback() {
    super.connectedCallback();
    const playerName = this.getAttribute("player-name");
    this.render();
    this.subscribe(`xp:${playerName}`, this.handleNewXpDrops.bind(this));
  }

  disconnectedCallback() {
    super.disconnectedCallback();
  }

  handleNewXpDrops(xpDrops: XpDrop[]) {
    const dropContainer = document.createElement("div");
    dropContainer.classList.add("xp-dropper__drop");
    for (const drop of xpDrops) {
      const dropEl = document.createElement("div");
      const iconEl = document.createElement("img");
      iconEl.classList.add("xp-droppper__skill-icon");
      iconEl.src = drop.icon;
      dropEl.append(iconEl, document.createTextNode(`+${drop.xp}`));
      dropContainer.appendChild(dropEl);
    }
    dropContainer.style.paddingTop = this.offsetHeight + "px";
    dropContainer.addEventListener("animationend", () => dropContainer.remove());
    this.appendChild(dropContainer);
  }
}
customElements.define("xp-dropper", XpDropper);
