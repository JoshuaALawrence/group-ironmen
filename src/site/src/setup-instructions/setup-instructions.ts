import { BaseElement } from "../base-element/base-element";
import { storage } from "../data/storage";

export class SetupInstructions extends BaseElement {
  html(): string {
    const group = storage.getGroup();
    return `{{setup-instructions.html}}`;
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.render();
  }
}

customElements.define("setup-instructions", SetupInstructions);