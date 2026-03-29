import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../data/storage", () => ({
  storage: {
    getGroup: vi.fn(() => ({ groupName: "group", groupToken: "token" })),
    storeGroup: vi.fn(),
    clearGroup: vi.fn(),
  },
}));

vi.mock("../data/api", () => ({
  api: {
    setCredentials: vi.fn(),
    amILoggedIn: vi.fn(async () => ({ ok: true, status: 200, text: async () => "" })),
    disable: vi.fn(),
  },
}));

vi.mock("../data/example-data", () => ({
  exampleData: {
    disable: vi.fn(),
  },
}));

vi.mock("../router", () => ({
  router: {
    register: vi.fn(),
    unregister: vi.fn(),
    aliasRoute: vi.fn(),
  },
}));

vi.mock("../data/group-data", () => ({
  groupData: {
    members: new Map([[["alice"] as unknown as string, { hue: 120 }]]),
  },
}));

import { storage } from "../data/storage";
import { api } from "../data/api";
import { exampleData } from "../data/example-data";
import { router } from "../router";

import { AppNavigation } from "../app-navigation/app-navigation";
import { AppRoute } from "../app-route/app-route";
import { ItemsPage } from "../items-page/items-page";
import { MenLink } from "../men-link/men-link";
import { MenInput } from "../men-input/men-input";
import { MemberNameInput } from "../member-name-input/member-name-input";
import { MenHomepage } from "../men-homepage/men-homepage";
import { LoginPage } from "../login-page/login-page";
import { LogoutPage } from "../logout-page/logout-page";
import { PanelsPage } from "../panels-page/panels-page";
import { SocialLinks } from "../social-links/social-links";
import { DonateButton } from "../donate-button/donate-button";
import { MapPage } from "../map-page/map-page";
import { PlayerSkills } from "../player-skills/player-skills";

describe("simple components heavy", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("handles route activation in app navigation", () => {
    const nav = new AppNavigation();
    nav.innerHTML = '<button route-component="home"></button><button route-component="map"></button>';

    const route = document.createElement("div");
    route.setAttribute("route-component", "map");
    nav.handleRouteActivated(route);

    const buttons = Array.from(nav.querySelectorAll("button"));
    expect(buttons[1]?.classList.contains("active")).toBe(true);
    expect(buttons[0]?.classList.contains("active")).toBe(false);

    nav.handleRouteActivated({});
  });

  it("registers, enables and disables app routes", () => {
    const outlet = document.createElement("div");
    outlet.id = "outlet";
    document.body.appendChild(outlet);

    const wrapper = document.createElement("div") as HTMLDivElement & { enable: () => void; disable: () => void };
    wrapper.setAttribute("id", "wrapper");
    wrapper.setAttribute("route-path", "/group");
    wrapper.enable = vi.fn();
    wrapper.disable = vi.fn();
    document.body.appendChild(wrapper);

    const route = new AppRoute();
    route.setAttribute("route-wrapper", "#wrapper");
    route.setAttribute("route-path", "/map");
    route.setAttribute("route-outlet", "#outlet");
    route.setAttribute("route-component", "map-page");
    route.connectedCallback();

    expect((router.register as unknown as ReturnType<typeof vi.fn>)).toHaveBeenCalled();

    route.enable();
    expect(wrapper.enable).toHaveBeenCalled();
    expect(outlet.children.length).toBe(1);

    route.disable();
    expect(outlet.children.length).toBe(0);

    route.disconnectedCallback();
    expect((router.unregister as unknown as ReturnType<typeof vi.fn>)).toHaveBeenCalled();

    const redirectRoute = new AppRoute();
    redirectRoute.setAttribute("route-path", "/logout");
    redirectRoute.setAttribute("route-redirect", "/");
    redirectRoute.connectedCallback();
    redirectRoute.enable();

    const aliasRoute = new AppRoute();
    aliasRoute.setAttribute("route-path", "/new");
    aliasRoute.setAttribute("alias-for", "/old");
    aliasRoute.connectedCallback();
    expect((router.aliasRoute as unknown as ReturnType<typeof vi.fn>)).toHaveBeenCalled();
  });

  it("updates items page members", () => {
    const page = new ItemsPage();
    const select = document.createElement("select");
    select.className = "items-page__player-filter";
    select.value = "alice";
    const changeSpy = vi.spyOn(select, "dispatchEvent");
    page.appendChild(select);

    page.handleUpdatedMembers([{ name: "alice" }, { name: "bob" }]);
    expect(select.innerHTML).toContain("bob");
    expect(changeSpy).toHaveBeenCalled();
  });

  it("navigates with men-link", () => {
    const link = new MenLink();
    link.setAttribute("link-href", "/events");
    link.href = "/events";
    const pushState = vi.spyOn(window.history, "pushState");

    const event = new MouseEvent("click");
    const prevent = vi.spyOn(event, "preventDefault");
    link.navigate(event);

    expect(prevent).toHaveBeenCalled();
    expect(pushState).toHaveBeenCalled();
  });

  it("validates men-input and member-name-input", () => {
    const input = new MenInput();
    input.input = document.createElement("input");
    input.validationError = document.createElement("div");
    input.validators = [
      (value) => (value === "ok" ? null : "bad"),
      () => null,
    ];

    input.input.value = " no ";
    expect(input.valid).toBe(false);
    expect(input.validationError.textContent).toBe("bad");

    input.input.value = "ok";
    expect(input.valid).toBe(true);
    expect(input.validationError.textContent).toBe("");
    expect(input.trim(" x ")).toBe("x");

    const memberInput = new MemberNameInput();
    memberInput.input = document.createElement("input");
    memberInput.validationError = document.createElement("div");
    const baseConnected = vi.spyOn(MenInput.prototype, "connectedCallback").mockImplementation(() => undefined);
    memberInput.setAttribute("member-number", "3");
    memberInput.connectedCallback();
    expect(memberInput.getAttribute("input-id")).toBe("member-name3");
    expect(baseConnected).toHaveBeenCalled();
  });

  it("handles homepage/login/logout flows", async () => {
    const homepage = new MenHomepage();
    expect(homepage.hasLogin).toBe(true);

    const page = new LoginPage();
    page.name = { valid: true, value: "group" } as unknown as never;
    page.token = { valid: true, value: "token" } as unknown as never;
    page.loginButton = document.createElement("button");
    page.error = document.createElement("div");

    const pushState = vi.spyOn(window.history, "pushState");
    await page.login();
    expect((api.setCredentials as unknown as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith("group", "token");
    expect((storage.storeGroup as unknown as ReturnType<typeof vi.fn>)).toHaveBeenCalled();
    expect(pushState).toHaveBeenCalled();

    (api.amILoggedIn as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => "",
    });
    await page.login();
    expect(page.error.textContent).toContain("incorrect");

    (api.amILoggedIn as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => "oops",
    });
    await page.login();
    expect(page.error.textContent).toContain("oops");

    (api.amILoggedIn as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("fail"));
    await page.login();
    expect(page.error.textContent).toContain("Unable to login");

    const logout = new LogoutPage();
    logout.connectedCallback();
    expect((exampleData.disable as unknown as ReturnType<typeof vi.fn>)).toHaveBeenCalled();
    expect((api.disable as unknown as ReturnType<typeof vi.fn>)).toHaveBeenCalled();
    expect((storage.clearGroup as unknown as ReturnType<typeof vi.fn>)).toHaveBeenCalled();
  });

  it("handles map page interactions and player skills rendering", () => {
    const worldMap = document.createElement("div") as HTMLDivElement & {
      plane?: number;
      stopFollowingPlayer: () => void;
      showPlane: (plane: number) => void;
      followPlayer: (name: string | null) => void;
    };
    worldMap.id = "background-worldmap";
    worldMap.plane = 2;
    worldMap.stopFollowingPlayer = vi.fn();
    worldMap.showPlane = vi.fn();
    worldMap.followPlayer = vi.fn();
    document.body.appendChild(worldMap);

    const authed = document.createElement("div");
    authed.className = "authed-section";
    document.body.appendChild(authed);

    const page = new MapPage();
    page.playerButtons = document.createElement("div");
    page.planeSelect = document.createElement("select");
    page.planeSelect.innerHTML = '<option value="3">3</option><option value="4">4</option>';
    page.worldMap = worldMap;

    page.handleUpdatedMembers([{ name: "@SHARED" }, { name: "alice" }]);
    expect(page.playerButtons.innerHTML).toContain("alice");

    page.planeSelect.value = "3";
    page.handlePlaneSelect();
    expect(worldMap.stopFollowingPlayer).toHaveBeenCalled();
    expect(worldMap.showPlane).toHaveBeenCalledWith(3);

    page.handlePlaneChange(new CustomEvent("plane-changed", { detail: { plane: 4 } }));
    expect(page.planeSelect.value).toBe("4");

    const clickTarget = document.createElement("button");
    clickTarget.setAttribute("player-name", "alice");
    page.handleFocusPlayer({ target: clickTarget } as unknown as MouseEvent);
    expect(worldMap.followPlayer).toHaveBeenCalledWith("alice");

    const skills = new PlayerSkills();
    skills.setAttribute("player-name", "alice");
    const container = document.createElement("div");
    container.className = "player-skills__skills";
    skills.appendChild(container);
    skills.playerName = "alice";
    skills.renderSkillBoxes();
    expect(container.querySelectorAll("skill-box").length).toBeGreaterThan(10);
  });

  it("runs simple connected/disconnected methods", () => {
    const panels = new PanelsPage();
    panels.connectedCallback();
    expect(document.body.classList.contains("panels-page")).toBe(true);
    panels.disconnectedCallback();
    expect(document.body.classList.contains("panels-page")).toBe(false);

    const social = new SocialLinks();
    const socialRender = vi.spyOn(social, "render").mockImplementation(() => undefined);
    social.connectedCallback();
    social.disconnectedCallback();
    expect(socialRender).toHaveBeenCalled();

    const donate = new DonateButton();
    const donateRender = vi.spyOn(donate, "render").mockImplementation(() => undefined);
    donate.connectedCallback();
    donate.disconnectedCallback();
    expect(donateRender).toHaveBeenCalled();
  });
});
