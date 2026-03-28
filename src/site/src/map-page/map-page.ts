import { BaseElement } from "../base-element/base-element";

type WorldMapElement = HTMLElement & {
  plane?: number;
  stopFollowingPlayer: () => void;
  showPlane: (plane: number) => void;
  followPlayer: (playerName: string | null) => void;
};

export class MapPage extends BaseElement {
  worldMap: WorldMapElement | null;
  playerButtons: HTMLElement | null;
  planeSelect: HTMLSelectElement | null;
  authedSection: HTMLElement | null;

  constructor() {
    super();
    this.worldMap = null;
    this.playerButtons = null;
    this.planeSelect = null;
    this.authedSection = null;
  }

  html(): string {
    return `{{map-page.html}}`;
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.render();
    this.worldMap = document.querySelector<WorldMapElement>("#background-worldmap");
    this.authedSection = document.querySelector<HTMLElement>(".authed-section");
    this.authedSection?.classList.add("no-pointer-events");
    this.worldMap?.classList.add("interactable");
    this.playerButtons = this.querySelector<HTMLElement>(".map-page__focus-player-buttons");
    this.planeSelect = this.querySelector<HTMLSelectElement>(".map-page__plane-select");

    if (this.planeSelect) {
      this.planeSelect.value = String(this.worldMap?.plane || 1);
    }

    this.subscribe("members-updated", (members) => this.handleUpdatedMembers(members as Array<{ name: string }>));
    if (this.playerButtons) {
      this.eventListener(this.playerButtons, "click", this.handleFocusPlayer.bind(this) as EventListener);
    }
    if (this.planeSelect) {
      this.eventListener(this.planeSelect, "change", this.handlePlaneSelect.bind(this));
    }
    if (this.worldMap) {
      this.eventListener(this.worldMap, "plane-changed", this.handlePlaneChange.bind(this));
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.worldMap?.classList.remove("interactable");
    this.authedSection?.classList.remove("no-pointer-events");
  }

  getSelectedPlane(): number {
    return Number.parseInt(this.planeSelect?.value ?? "1", 10);
  }

  handlePlaneChange(evt: Event): void {
    const plane = (evt as CustomEvent<{ plane: number }>).detail?.plane;
    if (plane === undefined) {
      return;
    }
    if (this.getSelectedPlane() !== plane) {
      if (this.planeSelect) {
        this.planeSelect.value = String(plane);
      }
    }
  }

  handlePlaneSelect(): void {
    this.worldMap?.stopFollowingPlayer();
    this.worldMap?.showPlane(this.getSelectedPlane());
  }

  handleUpdatedMembers(members: Array<{ name: string }>): void {
    let playerButtons = "";
    for (const member of members) {
      if (member.name === "@SHARED") continue;
      playerButtons += `<button type="button" class="men-button" player-name="${member.name}">${member.name}</button>`;
    }

    if (this.playerButtons) {
      this.playerButtons.innerHTML = playerButtons;
    }
  }

  handleFocusPlayer(event: MouseEvent): void {
    const target = event.target;
    const playerName = target instanceof Element ? target.getAttribute("player-name") : null;
    this.worldMap?.followPlayer(playerName);
  }
}
customElements.define("map-page", MapPage);
