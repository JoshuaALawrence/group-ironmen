import { BaseElement } from "../base-element/base-element";
import { storage } from "../data/storage";
import { api } from "../data/api";
import { exampleData } from "../data/example-data";

export class LogoutPage extends BaseElement {
  html(): string {
    return `{{logout-page.html}}`;
  }

  connectedCallback(): void {
    super.connectedCallback();
    exampleData.disable();
    api.disable();
    storage.clearGroup();
    window.history.pushState("", "", "/");
  }
}

customElements.define("logout-page", LogoutPage);