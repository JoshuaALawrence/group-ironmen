import { BaseElement } from "../base-element/base-element";
import { utility } from "../utility";

type InteractingData = {
  last_updated: string;
  ratio: number;
  scale: number;
  name: string;
  location: { x: number; y: number; plane: number };
};

type InteractingMarker = {
  coordinates: { x: number; y: number; plane: number };
  label: string;
};

type WorldMapElement = HTMLElement & {
  addInteractingMarker: (x: number, y: number, label: string) => InteractingMarker;
  removeInteractingMarker: (marker: InteractingMarker) => void;
};

type StatBarElement = HTMLElement & {
  update: (ratio: number) => void;
};

export class PlayerInteracting extends BaseElement {
  staleTimeout: number;
  hitpointsBar: StatBarElement | null;
  nameEl: HTMLElement | null;
  map: WorldMapElement | null;
  hideTimeout?: number;
  marker?: InteractingMarker;
  interacting?: InteractingData;

  constructor() {
    super();
    this.staleTimeout = 30 * 1000;
    this.hitpointsBar = null;
    this.nameEl = null;
    this.map = null;
  }

  html(): string {
    return `{{player-interacting.html}}`;
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.render();

    this.hitpointsBar = this.querySelector<StatBarElement>("stat-bar");
    this.nameEl = this.querySelector<HTMLElement>(".player-interacting__name");
    this.map = document.querySelector<WorldMapElement>("#background-worldmap");
    const playerName = this.getAttribute("player-name");

    this.addMapMarker().then(() => {
      this.subscribe(`interacting:${playerName}`, (interacting) => this.handleInteracting(interacting as InteractingData));
    });
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    window.clearTimeout(this.hideTimeout);

    if (this.marker && this.map) {
      this.map.removeInteractingMarker(this.marker);
    }
  }

  handleInteracting(interacting: InteractingData): void {
    this.interacting = interacting;
    const timeSinceLastUpdate = utility.timeSinceLastUpdate(interacting.last_updated);
    const timeUntilHide = this.staleTimeout - timeSinceLastUpdate;

    if (timeUntilHide > 1000) {
      window.clearTimeout(this.hideTimeout);
      this.hideTimeout = window.setTimeout(this.hide.bind(this), this.staleTimeout);
      this.hitpointsBar?.update(interacting.ratio / interacting.scale);
      if (this.nameEl) {
        this.nameEl.textContent = interacting.name;
      }
      this.show();
    }
  }

  async addMapMarker(): Promise<void> {
    if (!this.map) {
      return;
    }
    this.marker = this.map.addInteractingMarker(0, 0, "");
  }

  hide(): void {
    if (!this.marker) {
      return;
    }
    this.style.visibility = "hidden";
    this.marker.coordinates = { x: -1000000, y: -1000000, plane: 0 };
  }

  show(): void {
    if (!this.marker || !this.interacting) {
      return;
    }
    this.style.visibility = "visible";
    this.marker.coordinates = this.interacting.location;
    this.marker.label = this.interacting.name;
  }
}

customElements.define("player-interacting", PlayerInteracting);
