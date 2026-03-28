import { pubsub } from "./data/pubsub";

type RouteWrapper = {
  disable(): void;
};

type RouteLike = {
  enable(): void;
  disable(): void;
  wrapper?: RouteWrapper | null;
};

class Router {
  registeredRoutes: Map<string, RouteLike>;
  routeAliases: Map<string, Set<string>>;
  activeRoute: RouteLike | null;
  private locationChangeHandler: () => void;

  constructor() {
    this.registeredRoutes = new Map();
    this.routeAliases = new Map();
    this.activeRoute = null;
    this.locationChangeHandler = this.handleLocationChange.bind(this);
    window.addEventListener("locationchange", this.locationChangeHandler);
  }

  destroy(): void {
    window.removeEventListener("locationchange", this.locationChangeHandler);
  }

  register(path: string, route: RouteLike): void {
    this.registeredRoutes.set(path, route);
    const matches = this.didMatch(this.location, path);

    if (matches) {
      this.activateRoute(route);
    }
  }

  aliasRoute(base: string, alias: string): void {
    if (!this.routeAliases.has(base)) {
      this.routeAliases.set(base, new Set());
    }

    this.routeAliases.get(base)?.add(alias);

    const route = this.registeredRoutes.get(base);
    if (route) {
      const matches = this.didMatch(this.location, base);
      if (matches) {
        this.activateRoute(route);
      }
    }
  }

  unregister(path: string): void {
    this.registeredRoutes.delete(path);
  }

  get location(): string {
    const pathname = window.location.pathname;
    if (pathname.endsWith("/")) {
      return pathname.slice(0, -1);
    }

    return pathname;
  }

  didMatch(location: string, path: string): boolean {
    return (path === "*" && !this.activeRoute) || path === location || this.routeAliases.get(path)?.has(location) === true;
  }

  activateRoute(route: RouteLike): void {
    if (this.activeRoute !== route) {
      this.activeRoute = route;
      // NOTE: This publish needs to happen before the route is enabled. Otherwise the enabled route
      // could activate other routes and the published events go out of order.
      pubsub.publish("route-activated", route);
      route.enable();
    }
  }

  handleLocationChange(): void {
    const location = this.location;
    let matchedRoute: RouteLike | null = null;

    // Find the matched route and disable any that don't match
    for (const path of this.registeredRoutes.keys()) {
      const route = this.registeredRoutes.get(path);
      if (!route) {
        continue;
      }

      const matches = this.didMatch(location, path);
      if (matches) {
        matchedRoute = route;
      } else {
        route.disable();
      }
    }

    // Disable any unmatched wrappers
    for (const route of this.registeredRoutes.values()) {
      if ((matchedRoute === null || route.wrapper !== matchedRoute.wrapper) && route.wrapper) {
        route.wrapper.disable();
      }
    }

    // Enable the matched route
    if (matchedRoute) {
      this.activateRoute(matchedRoute);
    } else {
      this.activeRoute = null;
      window.history.pushState("", "", "/");
    }
  }
}

const router = new Router();

export { router };

// NOTE: This will send out extra events when we change
// the history state since it does not do that already
const originalPushState = history.pushState;
history.pushState = function pushState(this: History, ...args: Parameters<History["pushState"]>) {
  const ret = originalPushState.apply(this, args);
  window.dispatchEvent(new Event("pushstate"));
  window.dispatchEvent(new Event("locationchange"));
  return ret;
};

const originalReplaceState = history.replaceState;
history.replaceState = function replaceState(this: History, ...args: Parameters<History["replaceState"]>) {
  const ret = originalReplaceState.apply(this, args);
  window.dispatchEvent(new Event("replacestate"));
  window.dispatchEvent(new Event("locationchange"));
  return ret;
};

window.addEventListener("popstate", () => {
  window.dispatchEvent(new Event("locationchange"));
});