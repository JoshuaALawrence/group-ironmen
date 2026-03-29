import { BaseElement } from "../base-element/base-element";
import { storage } from "../data/storage";

type RouteLike = Element & {
  getAttribute(qualifiedName: string): string | null;
};

export class AppNavigation extends BaseElement {
  private routeButtons: HTMLButtonElement[] = [];

  html(): string {
    const group = storage.getGroup();
    return `{{app-navigation.html}}`;
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.render();
    this.routeButtons = Array.from(this.querySelectorAll("button"));
    this.subscribe("route-activated", this.handleRouteActivated.bind(this));
  }

  handleRouteActivated(route: unknown): void {
    if (!(route instanceof Element)) {
      return;
    }

    const routeComponent = (route as RouteLike).getAttribute("route-component");
    const buttons = this.routeButtons.length > 0
      ? this.routeButtons
      : Array.from(this.querySelectorAll("button"));
    for (const button of buttons) {
      const component = button.getAttribute("route-component");
      if (routeComponent === component) {
        button.classList.add("active");
      } else {
        button.classList.remove("active");
      }
    }
  }
}

customElements.define("app-navigation", AppNavigation);