import { BaseElement } from "../base-element/base-element";

export class WrapRoutes extends BaseElement {
  template: HTMLTemplateElement | null = null;
  path: string | null = null;
  active = false;

  html(): string {
    return `{{wrap-routes.html}}`;
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.template = this.querySelector("template");
    this.path = this.getAttribute("route-path");
    this.active = false;
  }

  enable(): void {
    if (!this.active && this.template) {
      this.active = true;
      this.appendChild(this.template.content.cloneNode(true));
      this.style.display = "flex";
    }
  }

  disable(): void {
    if (this.active) {
      this.active = false;
      this.innerHTML = "";
      this.style.display = "none";
    }
  }
}

customElements.define("wrap-routes", WrapRoutes);