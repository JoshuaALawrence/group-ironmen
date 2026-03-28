import { BaseElement } from "../base-element/base-element";
import { router } from "../router";

type RouteWrapperElement = Element & {
  enable(): void;
  disable(): void;
};

export class AppRoute extends BaseElement {
  wrapper?: RouteWrapperElement | null;
  path = "";
  aliasFor: string | null = null;
  active = false;
  outletSelector: string | null = null;
  page?: HTMLElement;

  html(): string {
    return `{{app-route.html}}`;
  }

  connectedCallback(): void {
    super.connectedCallback();
    if (this.hasAttribute("route-wrapper")) {
      this.wrapper = document.querySelector(this.getAttribute("route-wrapper") ?? "") as RouteWrapperElement | null;
    }

    const basePath = this.getAttribute("route-path") ?? "";
    this.path = this.buildPath(basePath);
    this.aliasFor = this.getAttribute("alias-for");
    this.active = false;

    if (this.aliasFor) {
      router.aliasRoute(this.buildPath(this.aliasFor), this.path);
    } else {
      this.outletSelector = this.getAttribute("route-outlet");
      router.register(this.path, this);
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    router.unregister(this.path);
  }

  get outlet(): HTMLElement | null {
    if (!this.outletSelector) {
      return null;
    }

    return document.querySelector(this.outletSelector);
  }

  enable(): void {
    const redirect = this.getAttribute("route-redirect");
    if (redirect) {
      window.history.pushState("", "", redirect);
      return;
    }

    if (this.active) {
      return;
    }

    this.active = true;
    this.wrapper?.enable();

    if (this.page === undefined) {
      const routeComponent = this.getAttribute("route-component");
      if (!routeComponent) {
        return;
      }

      this.page = document.createElement(routeComponent);
    }

    const outlet = this.outlet;
    if (!outlet || !this.page) {
      return;
    }

    outlet.appendChild(this.page);
  }

  disable(): void {
    if (!this.active) {
      return;
    }

    this.active = false;
    const outlet = this.outlet;
    if (this.page && outlet && this.page.parentNode === outlet) {
      outlet.removeChild(this.page);
      this.page.innerHTML = "";
    }
  }

  buildPath(basePath: string): string {
    let normalizedBasePath = basePath;
    if (normalizedBasePath.trim() === "/") {
      normalizedBasePath = "";
    }

    let wrap = "";
    if (this.wrapper) {
      wrap = this.wrapper.getAttribute("route-path") ?? "";
    }

    return `${wrap}${normalizedBasePath}`;
  }
}

customElements.define("app-route", AppRoute);