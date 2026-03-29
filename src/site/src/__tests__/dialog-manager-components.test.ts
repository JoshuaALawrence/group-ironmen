import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { pubsub } from "../data/pubsub";

import { ConfirmDialog } from "../confirm-dialog/confirm-dialog";
import { confirmDialogManager } from "../confirm-dialog/confirm-dialog-manager";
import { LoadingScreen } from "../loading-screen/loading-screen";
import { loadingScreenManager } from "../loading-screen/loading-screen-manager";
import { WrapRoutes } from "../wrap-routes/wrap-routes";
import { XpDropper } from "../xp-dropper/xp-dropper";
import { MemberSelectDialog } from "../member-select-dialog/member-select-dialog";
import { memberSelectDialogManager } from "../member-select-dialog/member-select-dialog-manager";
import { BlogPage } from "../blog-page/blog-page";

describe("dialog and manager components", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    pubsub.subscribers.clear();
    pubsub.unpublishAll();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    document.body.innerHTML = "";
    pubsub.subscribers.clear();
    pubsub.unpublishAll();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  // ---------------------------------------------------------------------------
  // ConfirmDialog
  // ---------------------------------------------------------------------------
  describe("ConfirmDialog", () => {
    it("show() sets headline and body, adds visible class, and calls yesCallback on yes click", () => {
      const dialog = new ConfirmDialog();
      vi.spyOn(dialog, "html").mockReturnValue(
        `<button class="confirm-dialog__yes">Yes</button><button class="confirm-dialog__no">No</button>`
      );
      document.body.appendChild(dialog);

      const yesCallback = vi.fn();
      const noCallback = vi.fn();
      dialog.show({ headline: "Delete?", body: "This cannot be undone.", yesCallback, noCallback });

      expect(dialog.headline).toBe("Delete?");
      expect(dialog.body).toBe("This cannot be undone.");
      expect(dialog.classList.contains("dialog__visible")).toBe(true);

      const yesBtn = dialog.querySelector(".confirm-dialog__yes") as HTMLButtonElement;
      yesBtn.click();
      expect(yesCallback).toHaveBeenCalledTimes(1);
      expect(dialog.classList.contains("dialog__visible")).toBe(false);
    });

    it("show() calls noCallback when no button is clicked", () => {
      const dialog = new ConfirmDialog();
      vi.spyOn(dialog, "html").mockReturnValue(
        `<button class="confirm-dialog__yes">Yes</button><button class="confirm-dialog__no">No</button>`
      );
      document.body.appendChild(dialog);

      const yesCallback = vi.fn();
      const noCallback = vi.fn();
      dialog.show({ headline: "Sure?", body: "Are you sure?", yesCallback, noCallback });

      const noBtn = dialog.querySelector(".confirm-dialog__no") as HTMLButtonElement;
      noBtn.click();
      expect(noCallback).toHaveBeenCalledTimes(1);
      expect(dialog.classList.contains("dialog__visible")).toBe(false);
    });

    it("show() does not throw when buttons are absent", () => {
      const dialog = new ConfirmDialog();
      vi.spyOn(dialog, "html").mockReturnValue(`<div></div>`);
      document.body.appendChild(dialog);

      expect(() =>
        dialog.show({ headline: "H", body: "B", yesCallback: vi.fn(), noCallback: vi.fn() })
      ).not.toThrow();
      expect(dialog.classList.contains("dialog__visible")).toBe(true);
    });

    it("hide() removes dialog__visible class", () => {
      const dialog = new ConfirmDialog();
      document.body.appendChild(dialog);
      dialog.classList.add("dialog__visible");
      dialog.hide();
      expect(dialog.classList.contains("dialog__visible")).toBe(false);
    });

    it("html() returns the template placeholder", () => {
      const dialog = new ConfirmDialog();
      expect(dialog.html()).toBe("{{confirm-dialog.html}}");
    });
  });

  // ---------------------------------------------------------------------------
  // ConfirmDialogManager
  // ---------------------------------------------------------------------------
  describe("ConfirmDialogManager", () => {
    it("confirm() delegates to the global confirm-dialog element", () => {
      const dialog = new ConfirmDialog();
      vi.spyOn(dialog, "html").mockReturnValue(`<div></div>`);
      document.body.appendChild(dialog);

      const showSpy = vi.spyOn(dialog, "show").mockImplementation(() => {});
      vi.spyOn(confirmDialogManager, "globalConfirmDialog", "get").mockReturnValue(dialog as never);

      const opts = {
        headline: "Hi",
        body: "Body",
        yesCallback: vi.fn(),
        noCallback: vi.fn(),
      };
      confirmDialogManager.confirm(opts);
      expect(showSpy).toHaveBeenCalledWith(opts);
    });

    it("confirm() is a no-op when globalConfirmDialog returns null", () => {
      vi.spyOn(confirmDialogManager, "globalConfirmDialog", "get").mockReturnValue(null);
      expect(() =>
        confirmDialogManager.confirm({
          headline: "H",
          body: "B",
          yesCallback: vi.fn(),
          noCallback: vi.fn(),
        })
      ).not.toThrow();
    });

    it("globalConfirmDialog getter queries DOM and caches the result", async () => {
      vi.resetModules();
      const { confirmDialogManager: freshManager } = await import(
        "../confirm-dialog/confirm-dialog-manager"
      );

      const mockDialog = document.createElement("div");
      const querySpy = vi.spyOn(document, "querySelector").mockReturnValue(mockDialog as never);

      const result = freshManager.globalConfirmDialog;
      expect(result).toBe(mockDialog);

      // Second call uses cached value
      freshManager.globalConfirmDialog;
      expect(querySpy).toHaveBeenCalledTimes(1);
    });
  });

  // ---------------------------------------------------------------------------
  // LoadingScreen
  // ---------------------------------------------------------------------------
  describe("LoadingScreen", () => {
    it("returns correct html template string", () => {
      const screen = new LoadingScreen();
      expect(screen.html()).toBe("{{loading-screen.html}}");
    });

    it("connects and disconnects without errors", () => {
      const screen = new LoadingScreen();
      document.body.appendChild(screen);
      expect(screen.isConnected).toBe(true);
      document.body.removeChild(screen);
      expect(screen.isConnected).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // LoadingScreenManager
  // ---------------------------------------------------------------------------
  describe("LoadingScreenManager", () => {
    it("showLoadingScreen sets display to block", () => {
      const mockEl = document.createElement("div");
      vi.spyOn(loadingScreenManager, "globalLoadingScreen", "get").mockReturnValue(mockEl as HTMLElement);

      loadingScreenManager.showLoadingScreen();
      expect(mockEl.style.display).toBe("block");
    });

    it("hideLoadingScreen sets display to none", () => {
      const mockEl = document.createElement("div");
      vi.spyOn(loadingScreenManager, "globalLoadingScreen", "get").mockReturnValue(mockEl as HTMLElement);

      loadingScreenManager.hideLoadingScreen();
      expect(mockEl.style.display).toBe("none");
    });

    it("globalLoadingScreen getter queries DOM then creates element when absent", async () => {
      vi.resetModules();
      const { loadingScreenManager: freshManager } = await import(
        "../loading-screen/loading-screen-manager"
      );

      // First call: element exists in DOM
      const existingEl = document.createElement("div");
      vi.spyOn(document, "querySelector").mockReturnValueOnce(existingEl as never);
      expect(freshManager.globalLoadingScreen).toBe(existingEl);

      // Second call: uses cached value (no querySelector call)
      const secondResult = freshManager.globalLoadingScreen;
      expect(secondResult).toBe(existingEl);
    });

    it("globalLoadingScreen getter creates and appends element when not found in DOM", async () => {
      vi.resetModules();
      const { loadingScreenManager: freshManager } = await import(
        "../loading-screen/loading-screen-manager"
      );

      vi.spyOn(document, "querySelector").mockReturnValue(null);
      const appendSpy = vi.spyOn(document.body, "appendChild");

      const result = freshManager.globalLoadingScreen;
      expect(result).not.toBeNull();
      expect(appendSpy).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // WrapRoutes
  // ---------------------------------------------------------------------------
  describe("WrapRoutes", () => {
    it("stores template and path on connect, and enable/disable toggle content", () => {
      const wrapper = new WrapRoutes();
      wrapper.setAttribute("route-path", "/group");

      const template = document.createElement("template");
      template.innerHTML = `<span class="child">hello</span>`;
      wrapper.appendChild(template);

      document.body.appendChild(wrapper);

      expect(wrapper.path).toBe("/group");
      expect(wrapper.active).toBe(false);
      expect(wrapper.template).toBe(template);

      wrapper.enable();
      expect(wrapper.active).toBe(true);
      expect(wrapper.style.display).toBe("flex");
      expect(wrapper.querySelector(".child")).not.toBeNull();

      // Calling enable() again should be a no-op
      wrapper.enable();
      expect(wrapper.querySelectorAll(".child").length).toBe(1);

      wrapper.disable();
      expect(wrapper.active).toBe(false);
      expect(wrapper.style.display).toBe("none");
      expect(wrapper.querySelector(".child")).toBeNull();

      // Calling disable() again should be a no-op
      wrapper.disable();
    });

    it("enable() does nothing if there is no template", () => {
      const wrapper = new WrapRoutes();
      document.body.appendChild(wrapper);
      expect(wrapper.template).toBeNull();
      wrapper.enable();
      expect(wrapper.active).toBe(false);
    });

    it("html() returns the template placeholder", () => {
      const wrapper = new WrapRoutes();
      expect(wrapper.html()).toBe("{{wrap-routes.html}}");
    });
  });

  // ---------------------------------------------------------------------------
  // XpDropper
  // ---------------------------------------------------------------------------
  describe("XpDropper", () => {
    it("subscribes to xp events on connect and renders drop elements", () => {
      const dropper = new XpDropper();
      vi.spyOn(dropper, "html").mockReturnValue(`<div></div>`);
      dropper.setAttribute("player-name", "Alice");
      document.body.appendChild(dropper);

      expect(pubsub.anyoneListening("xp:Alice")).toBe(true);

      const drops = [
        { icon: "/icons/attack.png", xp: 150 },
        { icon: "/icons/strength.png", xp: 200 },
      ];

      vi.spyOn(dropper, "offsetHeight", "get").mockReturnValue(40);
      dropper.handleNewXpDrops(drops);

      const container = dropper.querySelector(".xp-dropper__drop");
      expect(container).not.toBeNull();
      expect(container?.querySelectorAll("img").length).toBe(2);
      expect(container?.textContent).toContain("+150");
      expect(container?.textContent).toContain("+200");
    });

    it("fires animationend to remove drop container", () => {
      const dropper = new XpDropper();
      vi.spyOn(dropper, "html").mockReturnValue(`<div></div>`);
      dropper.setAttribute("player-name", "Bob");
      document.body.appendChild(dropper);

      vi.spyOn(dropper, "offsetHeight", "get").mockReturnValue(0);
      dropper.handleNewXpDrops([{ icon: "/icons/hp.png", xp: 10 }]);
      const container = dropper.querySelector(".xp-dropper__drop") as HTMLElement;
      expect(container).not.toBeNull();

      container.dispatchEvent(new Event("animationend"));
      expect(dropper.querySelector(".xp-dropper__drop")).toBeNull();
    });

    it("disconnectedCallback unsubscribes events", () => {
      const dropper = new XpDropper();
      vi.spyOn(dropper, "html").mockReturnValue(`<div></div>`);
      dropper.setAttribute("player-name", "Charlie");
      document.body.appendChild(dropper);

      expect(pubsub.anyoneListening("xp:Charlie")).toBe(true);
      document.body.removeChild(dropper);
      expect(pubsub.anyoneListening("xp:Charlie")).toBe(false);
    });

    it("html() returns the template placeholder", () => {
      const dropper = new XpDropper();
      expect(dropper.html()).toBe("{{xp-dropper.html}}");
    });
  });

  // ---------------------------------------------------------------------------
  // MemberSelectDialog
  // ---------------------------------------------------------------------------
  describe("MemberSelectDialog", () => {
    it("show() renders member buttons and resolves promise on click", async () => {
      const dialog = new MemberSelectDialog();
      vi.spyOn(dialog, "html").mockImplementation(() => `<div>${dialog.renderMembers()}</div>`);
      document.body.appendChild(dialog);

      const promise = dialog.show(["Alice", "Bob"]);
      expect(dialog.classList.contains("dialog__visible")).toBe(true);
      expect(dialog.members).toEqual(["Alice", "Bob"]);

      const btn = dialog.querySelector(".member-select__btn") as HTMLButtonElement;
      btn.click();

      await expect(promise).resolves.toBe("Alice");
      expect(dialog.classList.contains("dialog__visible")).toBe(false);
    });

    it("hide() removes visible class and unbinds events", () => {
      const dialog = new MemberSelectDialog();
      vi.spyOn(dialog, "html").mockReturnValue(`<div></div>`);
      document.body.appendChild(dialog);
      dialog.classList.add("dialog__visible");
      dialog.hide();
      expect(dialog.classList.contains("dialog__visible")).toBe(false);
    });

    it("renderMembers() escapes HTML in member names", () => {
      const dialog = new MemberSelectDialog();
      document.body.appendChild(dialog);
      dialog.members = ["<script>alert(1)</script>", "Normal"];
      const html = dialog.renderMembers();
      expect(html).not.toContain("<script>");
      expect(html).toContain("Normal");
    });

    it("html() returns the template placeholder", () => {
      const dialog = new MemberSelectDialog();
      expect(dialog.html()).toBe("{{member-select-dialog.html}}");
    });
  });

  // ---------------------------------------------------------------------------
  // MemberSelectDialogManager
  // ---------------------------------------------------------------------------
  describe("MemberSelectDialogManager", () => {
    it("selectMember() resolves to first member when dialog returns null", async () => {
      vi.spyOn(memberSelectDialogManager, "dialog", "get").mockReturnValue(null);
      const result = await memberSelectDialogManager.selectMember(["Alice", "Bob"]);
      expect(result).toBe("Alice");
    });

    it("selectMember() resolves to empty string when dialog is null and no members", async () => {
      vi.spyOn(memberSelectDialogManager, "dialog", "get").mockReturnValue(null);
      const result = await memberSelectDialogManager.selectMember([]);
      expect(result).toBe("");
    });

    it("selectMember() delegates to dialog element when found", async () => {
      const mockDialog = { show: vi.fn().mockResolvedValue("Bob") };
      vi.spyOn(memberSelectDialogManager, "dialog", "get").mockReturnValue(
        mockDialog as never
      );

      const result = await memberSelectDialogManager.selectMember(["Alice", "Bob"]);
      expect(result).toBe("Bob");
    });

    it("dialog getter queries DOM for member-select-dialog element", async () => {
      vi.resetModules();
      const { memberSelectDialogManager: freshManager } = await import(
        "../member-select-dialog/member-select-dialog-manager"
      );

      const mockEl = document.createElement("div");
      const querySpy = vi.spyOn(document, "querySelector").mockReturnValue(mockEl as never);

      const result = freshManager.dialog;
      expect(result).toBe(mockEl);

      // Second call uses cached value
      freshManager.dialog;
      expect(querySpy).toHaveBeenCalledTimes(1);
    });
  });

  // ---------------------------------------------------------------------------
  // BlogPage
  // ---------------------------------------------------------------------------
  describe("BlogPage", () => {
    it("returns loading message when loading", () => {
      const page = new BlogPage();
      page.loading = true;
      page.error = "";
      page.posts = [];
      expect(page.renderContent()).toContain("Loading news");
    });

    it("returns error message when error is set", () => {
      const page = new BlogPage();
      page.loading = false;
      page.error = "Failed to load OSRS news.";
      page.posts = [];
      expect(page.renderContent()).toContain("Failed to load OSRS news");
    });

    it("returns empty state when no posts and not loading", () => {
      const page = new BlogPage();
      page.loading = false;
      page.error = "";
      page.posts = [];
      expect(page.renderContent()).toContain("No news posts found");
    });

    it("renders posts list when posts exist", () => {
      const page = new BlogPage();
      page.loading = false;
      page.error = "";
      page.posts = [
        {
          title: "Update 1",
          description: "Big update",
          link: "https://example.com",
          category: "Game Updates",
          pubDate: "2024-01-15T00:00:00Z",
          imageUrl: "https://example.com/img.jpg",
        },
      ];
      const content = page.renderContent();
      expect(content).toContain("Update 1");
      expect(content).toContain("Big update");
      expect(content).toContain("#ff981f"); // Game Updates color
    });

    it("renderPost() omits img tag when imageUrl is empty", () => {
      const page = new BlogPage();
      const html = page.renderPost({
        title: "Post",
        description: "Desc",
        link: "https://example.com",
        category: "Community",
        pubDate: "2024-02-01T00:00:00Z",
        imageUrl: "",
      });
      expect(html).not.toContain("<img");
      expect(html).toContain("Post");
    });

    it("renderPost() uses fallback color for unknown category", () => {
      const page = new BlogPage();
      const html = page.renderPost({
        title: "Post",
        description: "Desc",
        link: "https://example.com",
        category: "Unknown Category",
        pubDate: "2024-02-01T00:00:00Z",
        imageUrl: "",
      });
      expect(html).toContain("#cccccc");
    });

    it("fetchBlog() populates posts on successful fetch", async () => {
      const page = new BlogPage();
      vi.spyOn(page, "html").mockReturnValue(`<div></div>`);

      const mockPosts = [
        {
          title: "News",
          description: "Desc",
          link: "https://example.com",
          category: "Game Updates",
          pubDate: "2024-01-01T00:00:00Z",
          imageUrl: "",
        },
      ];
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({ ok: true, json: vi.fn().mockResolvedValue(mockPosts) })
      );

      document.body.appendChild(page);
      await new Promise((r) => setTimeout(r, 10));

      expect(page.loading).toBe(false);
      expect(page.posts).toEqual(mockPosts);
    });

    it("fetchBlog() sets error on non-ok response", async () => {
      const page = new BlogPage();
      vi.spyOn(page, "html").mockReturnValue(`<div></div>`);
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));

      document.body.appendChild(page);
      await new Promise((r) => setTimeout(r, 10));

      expect(page.loading).toBe(false);
      expect(page.error).toBe("Failed to load OSRS news.");
    });

    it("fetchBlog() sets error on network failure", async () => {
      const page = new BlogPage();
      vi.spyOn(page, "html").mockReturnValue(`<div></div>`);
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network error")));

      document.body.appendChild(page);
      await new Promise((r) => setTimeout(r, 10));

      expect(page.loading).toBe(false);
      expect(page.error).toBe("Failed to load OSRS news.");
    });

    it("html() returns the template placeholder", () => {
      const page = new BlogPage();
      expect(page.html()).toBe("{{blog-page.html}}");
    });
  });
});
