import { BaseElement } from "../base-element/base-element";

export class ItemsPage extends BaseElement {
  constructor() {
    super();
  }

  html(): string {
    return `{{items-page.html}}`;
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.render();

    this.subscribe("members-updated", (members) => this.handleUpdatedMembers(members as Array<{ name: string }>));
  }

  handleUpdatedMembers(members: Array<{ name: string }>): void {
    const playerFilter = this.querySelector<HTMLSelectElement>(".items-page__player-filter");
    if (!playerFilter) {
      return;
    }
    const selected = playerFilter.value;

    let playerOptions = `<option value="@ALL">All Players</option>`;
    for (const member of members) {
      playerOptions += `<option value="${member.name}" ${member.name === selected ? "selected" : ""}>${
        member.name
      }</option>`;
    }

    playerFilter.innerHTML = playerOptions;

    if (playerFilter.value !== selected) {
      playerFilter.dispatchEvent(new CustomEvent("change"));
    }
  }
}
customElements.define("items-page", ItemsPage);
