import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { pubsub } from "../data/pubsub";
import { router as singletonRouter } from "../router";
import { StatBar } from "../stat-bar/stat-bar";

type RouterInstance = typeof singletonRouter;
type RouteLike = NonNullable<RouterInstance["activeRoute"]>;

const RouterClass = singletonRouter.constructor as new () => RouterInstance;
const nativeReplaceState = History.prototype.replaceState;
const liveRouters = new Set<RouterInstance>();

function setPath(path: string): void {
  nativeReplaceState.call(window.history, {}, "", path);
}

function createRouter(): RouterInstance {
  const instance = new RouterClass();
  liveRouters.add(instance);
  return instance;
}

function createRoute(wrapper?: RouteLike["wrapper"]): RouteLike {
  const route: RouteLike = {
    enable: vi.fn(),
    disable: vi.fn(),
  };

  if (wrapper !== undefined) {
    route.wrapper = wrapper;
  }

  return route;
}

function mountStatBar(attributes: Record<string, string>): StatBar {
  const statBar = document.createElement("stat-bar") as StatBar;
  statBar.render = vi.fn(function render(this: StatBar) {
    this.innerHTML = '<div class="stat-bar__current"></div>';
  });

  for (const [name, value] of Object.entries(attributes)) {
    statBar.setAttribute(name, value);
  }

  document.body.appendChild(statBar);
  return statBar;
}

beforeEach(() => {
  document.body.innerHTML = "";
  singletonRouter.destroy();
  singletonRouter.registeredRoutes.clear();
  singletonRouter.routeAliases.clear();
  singletonRouter.activeRoute = null;
  pubsub.unpublishAll();
  setPath("/");
});

afterEach(() => {
  for (const instance of liveRouters) {
    instance.destroy();
  }

  liveRouters.clear();
  singletonRouter.registeredRoutes.clear();
  singletonRouter.routeAliases.clear();
  singletonRouter.activeRoute = null;
  pubsub.unpublishAll();
  document.body.innerHTML = "";
  setPath("/");
  vi.restoreAllMocks();
});

describe("Router", () => {
  it("registers routes, normalizes locations, matches aliases, and unregisters", () => {
    setPath("/current/");
    const router = createRouter();
    const currentRoute = createRoute();
    const aliasRoute = createRoute();

    router.register("/current", currentRoute);
    router.register("/alias-target", aliasRoute);
    router.aliasRoute("/alias-target", "/alias-path");

    expect(router.location).toBe("/current");
    expect(currentRoute.enable).toHaveBeenCalledTimes(1);
    expect(router.didMatch("/alias-path", "/alias-target")).toBe(true);
    expect(router.didMatch("/anything", "*")).toBe(false);

    router.activeRoute = null;
    expect(router.didMatch("/anything", "*")).toBe(true);

    router.unregister("/alias-target");
    expect(router.registeredRoutes.has("/alias-target")).toBe(false);
  });

  it("activates a registered route when an alias is added later", () => {
    setPath("/alias-path");
    const router = createRouter();
    const route = createRoute();

    router.register("/base-path", route);
    expect(route.enable).not.toHaveBeenCalled();

    router.aliasRoute("/base-path", "/alias-path");

    expect(route.enable).toHaveBeenCalledTimes(1);
    expect(router.activeRoute).toBe(route);
    expect(router.routeAliases.get("/base-path")?.has("/alias-path")).toBe(true);
  });

  it("publishes route activation before enabling and skips duplicate activation", () => {
    const router = createRouter();
    const route = createRoute();
    const callOrder: string[] = [];
    const publishSpy = vi.spyOn(pubsub, "publish").mockImplementation(() => {
      callOrder.push("publish");
    });

    route.enable = vi.fn(() => {
      callOrder.push("enable");
    });

    router.activateRoute(route);

    expect(callOrder).toEqual(["publish", "enable"]);
    expect(router.activeRoute).toBe(route);

    router.activateRoute(route);

    expect(route.enable).toHaveBeenCalledTimes(1);
    expect(publishSpy).toHaveBeenCalledTimes(1);
  });

  it("handles location changes by disabling unmatched routes and wrapper siblings", () => {
    const router = createRouter();
    const sharedWrapper = { disable: vi.fn() };
    const secondaryWrapper = { disable: vi.fn() };
    const routeA = createRoute(sharedWrapper);
    const routeAlias = createRoute(sharedWrapper);
    const routeB = createRoute(secondaryWrapper);

    router.register("/dashboard", routeA);
    router.register("/dashboard/stats", routeAlias);
    router.register("/settings", routeB);

    vi.clearAllMocks();
    setPath("/dashboard");
    router.handleLocationChange();

    expect(routeA.enable).toHaveBeenCalledTimes(1);
    expect(routeAlias.disable).toHaveBeenCalledTimes(1);
    expect(routeB.disable).toHaveBeenCalledTimes(1);
    expect(sharedWrapper.disable).not.toHaveBeenCalled();
    expect(secondaryWrapper.disable).toHaveBeenCalledTimes(1);
    expect(router.activeRoute).toBe(routeA);
  });

  it("pushes the root location when no route matches", () => {
    const router = createRouter();
    const route = createRoute();
    const pushStateSpy = vi.spyOn(window.history, "pushState").mockImplementation(() => undefined);

    router.register("/dashboard", route);
    router.activeRoute = route;

    vi.clearAllMocks();
    setPath("/missing");
    router.handleLocationChange();

    expect(route.disable).toHaveBeenCalledTimes(1);
    expect(router.activeRoute).toBeNull();
    expect(pushStateSpy).toHaveBeenCalledWith("", "", "/");
  });

  it("stops handling location changes after destroy", () => {
    const router = createRouter();
    const route = createRoute();

    router.register("/dashboard", route);
    router.destroy();

    setPath("/dashboard");
    window.dispatchEvent(new Event("locationchange"));

    expect(route.enable).not.toHaveBeenCalled();
    expect(route.disable).not.toHaveBeenCalled();
  });

  it("dispatches history hook events for pushState, replaceState, and popstate", () => {
    const pushStateListener = vi.fn();
    const replaceStateListener = vi.fn();
    const locationChangeListener = vi.fn();

    window.addEventListener("pushstate", pushStateListener);
    window.addEventListener("replacestate", replaceStateListener);
    window.addEventListener("locationchange", locationChangeListener);

    window.history.pushState({}, "", "/push-hook");
    window.history.replaceState({}, "", "/replace-hook");
    window.dispatchEvent(new PopStateEvent("popstate"));

    expect(pushStateListener).toHaveBeenCalledTimes(1);
    expect(replaceStateListener).toHaveBeenCalledTimes(1);
    expect(locationChangeListener).toHaveBeenCalledTimes(3);

    window.removeEventListener("pushstate", pushStateListener);
    window.removeEventListener("replacestate", replaceStateListener);
    window.removeEventListener("locationchange", locationChangeListener);
  });
});

describe("StatBar", () => {
  it("derives a darker background from hex colors and applies the initial ratio", () => {
    const statBar = mountStatBar({
      "bar-color": "#336699",
      "bar-ratio": "0.5",
    });

    expect(statBar.bar).toBeInstanceOf(HTMLElement);
    expect(statBar.bgColor).toBe("rgb(17, 34, 51)");
    expect(statBar.style.background).toContain("linear-gradient(90deg");
    expect(statBar.style.background).toContain("50%");
    expect(statBar.style.background).toContain("rgb(17, 34, 51)");
  });

  it("respects explicit background colors and parses hsl bar colors", () => {
    const statBar = mountStatBar({
      "bar-color": "hsl(120, 80%, 40%)",
      "bar-bgcolor": "rgb(1, 2, 3)",
      "bar-ratio": "0.25",
    });

    expect(statBar.color).toEqual({ hue: 120, saturation: 80, lightness: 40 });
    expect(statBar.bgColor).toBe("rgb(1, 2, 3)");
    expect(statBar.getColor(0.5)).toBe("hsl(60, 80%, 40%)");
  });

  it("skips updates while disconnected and uses a solid fill at full ratio", () => {
    const disconnectedBar = new StatBar();
    disconnectedBar.color = "#336699";
    disconnectedBar.bgColor = "rgb(1, 2, 3)";

    disconnectedBar.update(0.5);
    expect(disconnectedBar.style.background).toBe("");

    const connectedBar = mountStatBar({ "bar-color": "#336699" });
    connectedBar.color = "#336699";
    connectedBar.bgColor = "rgb(1, 2, 3)";
    connectedBar.update(1);

    expect(connectedBar.style.background).not.toContain("linear-gradient");
    expect(connectedBar.style.background).toBe("rgb(51, 102, 153)");
  });

  it("covers color conversion helpers and invalid input", () => {
    const statBar = new StatBar();

    expect(statBar.hexToRgb("#03F")).toEqual({ r: 0, g: 51, b: 255 });
    expect(statBar.hexToRgb("not-a-color")).toBeNull();
    expect(statBar.darkenColor(null)).toBeNull();
    expect(statBar.darkenColor({ r: 9, g: 12, b: 15 })).toEqual({ r: 3, g: 4, b: 5 });
  });
});
