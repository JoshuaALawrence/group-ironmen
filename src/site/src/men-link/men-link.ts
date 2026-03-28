import { BaseElement } from "../base-element/base-element";

export class MenLink extends BaseElement {
  href: string;

  constructor() {
    super();
    this.href = "";
  }

  html(): string {
    this.href = this.getAttribute("link-href") ?? "";
    return `{{men-link.html}}`;
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.render();
    const link = this.querySelector<HTMLAnchorElement>("a");
    if (link) {
      this.eventListener(link, "click", this.navigate.bind(this) as EventListener, { passive: false });
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
  }

  navigate(evt: MouseEvent): void {
    evt.preventDefault();
    window.history.pushState("", "", this.href);
  }
}

customElements.define("men-link", MenLink);
