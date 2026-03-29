import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockedStorage = vi.hoisted(() => ({
  storeGroup: vi.fn(),
  clearGroup: vi.fn(),
  getGroup: vi.fn(() => null as { groupName: string; groupToken: string } | null),
  getActiveMember: vi.fn(),
  setActiveMember: vi.fn(),
}));
const mockedApi = vi.hoisted(() => ({ disable: vi.fn() }));
const mockedExampleData = vi.hoisted(() => ({ disable: vi.fn() }));

vi.mock("../data/storage", () => ({ storage: mockedStorage }));
vi.mock("../data/api", () => ({ api: mockedApi }));
vi.mock("../data/example-data", () => ({ exampleData: mockedExampleData }));

import { pubsub } from "../data/pubsub";
import { AppNavigation } from "../app-navigation/app-navigation";
import { DemoPage } from "../demo-page/demo-page";
import { DiaryCompletion } from "../diary-completion/diary-completion";
import { DonateButton } from "../donate-button/donate-button";
import { ItemsPage } from "../items-page/items-page";
import { LogoutPage } from "../logout-page/logout-page";
import { MenHomepage } from "../men-homepage/men-homepage";
import { MenLink } from "../men-link/men-link";
import { PanelsPage } from "../panels-page/panels-page";
import { SocialLinks } from "../social-links/social-links";

describe("simple-page-components", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    pubsub.subscribers.clear();
    pubsub.unpublishAll();
    vi.restoreAllMocks();
    mockedStorage.storeGroup.mockClear();
    mockedStorage.clearGroup.mockClear();
    mockedStorage.getGroup.mockClear();
    mockedStorage.getGroup.mockReturnValue(null);
    mockedApi.disable.mockClear();
    mockedExampleData.disable.mockClear();
  });

  afterEach(() => {
    document.body.innerHTML = "";
    pubsub.subscribers.clear();
    pubsub.unpublishAll();
    vi.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  // DemoPage
  // ---------------------------------------------------------------------------

  describe("DemoPage", () => {
    it("html() returns the template placeholder", () => {
      const el = new DemoPage();
      expect(el.html()).toBe("{{demo-page.html}}");
    });

    it("connectedCallback calls storage.storeGroup with correct args and pushState to /group", () => {
      const pushState = vi.spyOn(window.history, "pushState");
      const el = new DemoPage();
      document.body.appendChild(el);
      expect(mockedStorage.storeGroup).toHaveBeenCalledWith(
        "@EXAMPLE",
        "00000000-0000-0000-0000-000000000000"
      );
      expect(pushState).toHaveBeenCalledWith("", "", "/group");
    });

    it("disconnectedCallback cleans up without errors", () => {
      const el = new DemoPage();
      document.body.appendChild(el);
      expect(() => document.body.removeChild(el)).not.toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  // LogoutPage
  // ---------------------------------------------------------------------------

  describe("LogoutPage", () => {
    it("html() returns the template placeholder", () => {
      const el = new LogoutPage();
      expect(el.html()).toBe("{{logout-page.html}}");
    });

    it("connectedCallback calls exampleData.disable, api.disable, storage.clearGroup, and pushState to /", () => {
      const pushState = vi.spyOn(window.history, "pushState");
      const el = new LogoutPage();
      document.body.appendChild(el);
      expect(mockedExampleData.disable).toHaveBeenCalled();
      expect(mockedApi.disable).toHaveBeenCalled();
      expect(mockedStorage.clearGroup).toHaveBeenCalled();
      expect(pushState).toHaveBeenCalledWith("", "", "/");
    });
  });

  // ---------------------------------------------------------------------------
  // DonateButton
  // ---------------------------------------------------------------------------

  describe("DonateButton", () => {
    it("html() returns the template placeholder", () => {
      const el = new DonateButton();
      expect(el.html()).toBe("{{donate-button.html}}");
    });

    it("connects and disconnects without errors", () => {
      const el = new DonateButton();
      const renderSpy = vi.spyOn(el, "render").mockImplementation(() => undefined);
      expect(() => document.body.appendChild(el)).not.toThrow();
      expect(renderSpy).toHaveBeenCalled();
      expect(() => document.body.removeChild(el)).not.toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  // SocialLinks
  // ---------------------------------------------------------------------------

  describe("SocialLinks", () => {
    it("html() returns the template placeholder", () => {
      const el = new SocialLinks();
      expect(el.html()).toBe("{{social-links.html}}");
    });

    it("connects and disconnects without errors", () => {
      const el = new SocialLinks();
      const renderSpy = vi.spyOn(el, "render").mockImplementation(() => undefined);
      expect(() => document.body.appendChild(el)).not.toThrow();
      expect(renderSpy).toHaveBeenCalled();
      expect(() => document.body.removeChild(el)).not.toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  // PanelsPage
  // ---------------------------------------------------------------------------

  describe("PanelsPage", () => {
    it("html() returns the template placeholder", () => {
      const el = new PanelsPage();
      expect(el.html()).toBe("{{panels-page.html}}");
    });

    it("connectedCallback adds 'panels-page' class to body", () => {
      const el = new PanelsPage();
      document.body.appendChild(el);
      expect(document.body.classList.contains("panels-page")).toBe(true);
    });

    it("disconnectedCallback removes 'panels-page' class from body", () => {
      const el = new PanelsPage();
      document.body.appendChild(el);
      expect(document.body.classList.contains("panels-page")).toBe(true);
      document.body.removeChild(el);
      expect(document.body.classList.contains("panels-page")).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // MenLink
  // ---------------------------------------------------------------------------

  describe("MenLink", () => {
    it("html() sets this.href from link-href attribute and returns the placeholder", () => {
      const el = new MenLink();
      el.setAttribute("link-href", "/test-path");
      const result = el.html();
      expect(el.href).toBe("/test-path");
      expect(result).toBe("{{men-link.html}}");
    });

    it("connectedCallback binds a click listener on the inner anchor", () => {
      const el = new MenLink();
      el.setAttribute("link-href", "/home");
      // Explicitly set href because html() is mocked and won't run the attribute-reading logic
      el.href = "/home";
      vi.spyOn(el, "html").mockReturnValue('<a href="#">link</a>');
      document.body.appendChild(el);
      const pushState = vi.spyOn(window.history, "pushState");
      const anchor = el.querySelector("a")!;
      anchor.click();
      expect(pushState).toHaveBeenCalledWith("", "", "/home");
    });

    it("navigate calls evt.preventDefault() and history.pushState with href", () => {
      const el = new MenLink();
      el.href = "/navigate-target";
      const pushState = vi.spyOn(window.history, "pushState");
      const event = new MouseEvent("click");
      const preventDefault = vi.spyOn(event, "preventDefault");
      el.navigate(event);
      expect(preventDefault).toHaveBeenCalled();
      expect(pushState).toHaveBeenCalledWith("", "", "/navigate-target");
    });

    it("connectedCallback does not error when querySelector finds no anchor", () => {
      const el = new MenLink();
      vi.spyOn(el, "html").mockReturnValue("<span>no link here</span>");
      expect(() => document.body.appendChild(el)).not.toThrow();
    });

    it("disconnectedCallback cleans up without errors", () => {
      const el = new MenLink();
      vi.spyOn(el, "html").mockReturnValue('<a href="#">link</a>');
      document.body.appendChild(el);
      expect(() => document.body.removeChild(el)).not.toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  // MenHomepage
  // ---------------------------------------------------------------------------

  describe("MenHomepage", () => {
    it("hasLogin returns truthy when group has name and token and name is not @EXAMPLE", () => {
      mockedStorage.getGroup.mockReturnValue({ groupName: "mygroup", groupToken: "abc123" });
      const el = new MenHomepage();
      expect(el.hasLogin).toBeTruthy();
    });

    it("hasLogin returns falsy when getGroup returns null", () => {
      mockedStorage.getGroup.mockReturnValue(null);
      const el = new MenHomepage();
      expect(el.hasLogin).toBeFalsy();
    });

    it("hasLogin returns falsy when groupName is @EXAMPLE", () => {
      mockedStorage.getGroup.mockReturnValue({ groupName: "@EXAMPLE", groupToken: "abc123" });
      const el = new MenHomepage();
      expect(el.hasLogin).toBeFalsy();
    });

    it("html() returns the placeholder and connectedCallback calls render", () => {
      const el = new MenHomepage();
      expect(el.html()).toBe("{{men-homepage.html}}");
      const renderSpy = vi.spyOn(el, "render").mockImplementation(() => undefined);
      document.body.appendChild(el);
      expect(renderSpy).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // ItemsPage
  // ---------------------------------------------------------------------------

  describe("ItemsPage", () => {
    it("handleUpdatedMembers does nothing when playerFilter element is absent", () => {
      const el = new ItemsPage();
      expect(() => el.handleUpdatedMembers([{ name: "alice" }])).not.toThrow();
    });

    it("handleUpdatedMembers populates an option for each member plus the All Players option", () => {
      const el = new ItemsPage();
      const select = document.createElement("select");
      select.className = "items-page__player-filter";
      el.appendChild(select);
      el.handleUpdatedMembers([{ name: "alice" }, { name: "bob" }]);
      expect(select.innerHTML).toContain("@ALL");
      expect(select.innerHTML).toContain("alice");
      expect(select.innerHTML).toContain("bob");
    });

    it("handleUpdatedMembers dispatches a change event when the selected value changes", () => {
      const el = new ItemsPage();
      const select = document.createElement("select");
      select.className = "items-page__player-filter";
      const opt = document.createElement("option");
      opt.value = "alice";
      opt.selected = true;
      select.appendChild(opt);
      el.appendChild(select);
      const dispatchSpy = vi.spyOn(select, "dispatchEvent");
      // Pass members that do NOT include "alice" so the selected value changes
      el.handleUpdatedMembers([{ name: "bob" }]);
      expect(dispatchSpy).toHaveBeenCalledWith(expect.any(CustomEvent));
    });

    it("handleUpdatedMembers does NOT dispatch change when the selected value stays the same", () => {
      const el = new ItemsPage();
      const select = document.createElement("select");
      select.className = "items-page__player-filter";
      const opt = document.createElement("option");
      opt.value = "@ALL";
      select.appendChild(opt);
      // select.value is now "@ALL" (the only/first option)
      el.appendChild(select);
      const dispatchSpy = vi.spyOn(select, "dispatchEvent");
      // Pass members that don't include "@ALL"; after innerHTML update the first
      // option remains "@ALL", so the value is unchanged → no change event
      el.handleUpdatedMembers([{ name: "alice" }]);
      expect(dispatchSpy).not.toHaveBeenCalled();
    });

    it("pubsub members-updated event triggers handleUpdatedMembers", () => {
      const el = new ItemsPage();
      vi.spyOn(el, "html").mockReturnValue("");
      const handlerSpy = vi.spyOn(el, "handleUpdatedMembers");
      document.body.appendChild(el);
      pubsub.publish("members-updated", [{ name: "test" }]);
      expect(handlerSpy).toHaveBeenCalledWith([{ name: "test" }]);
    });
  });

  // ---------------------------------------------------------------------------
  // DiaryCompletion
  // ---------------------------------------------------------------------------

  describe("DiaryCompletion", () => {
    it("connectedCallback calculates tierCompletions, total, and totalComplete correctly", () => {
      const el = new DiaryCompletion();
      el.setAttribute("player-name", "PlayerOne");
      el.setAttribute("diary-name", "Ardougne");
      vi.spyOn(el, "render").mockImplementation(() => undefined);
      el.diaryCompletion = {
        Easy: [true, false],
        Medium: [true],
        Hard: [],
        Elite: [false],
      };
      document.body.appendChild(el);
      expect(el.playerName).toBe("PlayerOne");
      expect(el.diaryName).toBe("Ardougne");
      expect(el.tierCompletions.Easy).toEqual({ total: 2, complete: 1 });
      expect(el.tierCompletions.Medium).toEqual({ total: 1, complete: 1 });
      expect(el.tierCompletions.Hard).toEqual({ total: 0, complete: 0 });
      expect(el.tierCompletions.Elite).toEqual({ total: 1, complete: 0 });
      expect(el.total).toBe(4);
      expect(el.totalComplete).toBe(2);
    });

    it("openDiaryDialog appends a diary-dialog element with correct attributes", () => {
      const el = new DiaryCompletion();
      el.playerName = "PlayerOne";
      el.diaryName = "Karamja";
      el.openDiaryDialog();
      const dialog = document.body.querySelector("diary-dialog");
      expect(dialog).not.toBeNull();
      expect(dialog!.getAttribute("player-name")).toBe("PlayerOne");
      expect(dialog!.getAttribute("diary-name")).toBe("Karamja");
    });

    it("disconnectedCallback cleans up without errors", () => {
      const el = new DiaryCompletion();
      vi.spyOn(el, "render").mockImplementation(() => undefined);
      el.diaryCompletion = { Easy: [], Medium: [], Hard: [], Elite: [] };
      document.body.appendChild(el);
      expect(() => document.body.removeChild(el)).not.toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  // AppNavigation
  // ---------------------------------------------------------------------------

  describe("AppNavigation", () => {
    it("handleRouteActivated with a non-Element argument returns without error", () => {
      const nav = new AppNavigation();
      expect(() => nav.handleRouteActivated({})).not.toThrow();
      expect(() => nav.handleRouteActivated(null)).not.toThrow();
      expect(() => nav.handleRouteActivated("string")).not.toThrow();
    });

    it("handleRouteActivated marks matching button as active and removes active from others", () => {
      const nav = new AppNavigation();
      vi.spyOn(nav, "html").mockReturnValue(
        '<button route-component="home"></button><button route-component="map"></button>'
      );
      document.body.appendChild(nav);
      const [homeBtn, mapBtn] = Array.from(nav.querySelectorAll("button"));
      // Pre-mark home as active to verify it gets removed
      homeBtn!.classList.add("active");

      const route = document.createElement("div");
      route.setAttribute("route-component", "map");
      nav.handleRouteActivated(route);

      expect(mapBtn!.classList.contains("active")).toBe(true);
      expect(homeBtn!.classList.contains("active")).toBe(false);
    });

    it("pubsub route-activated event triggers handleRouteActivated", () => {
      const nav = new AppNavigation();
      vi.spyOn(nav, "html").mockReturnValue('<button route-component="home"></button>');
      const handlerSpy = vi.spyOn(nav, "handleRouteActivated");
      document.body.appendChild(nav);
      const route = document.createElement("div");
      route.setAttribute("route-component", "home");
      pubsub.publish("route-activated", route);
      expect(handlerSpy).toHaveBeenCalledWith(route);
    });
  });
});
