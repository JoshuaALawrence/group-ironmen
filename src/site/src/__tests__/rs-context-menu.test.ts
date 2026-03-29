import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { contextMenuManager } from "../rs-context-menu/context-menu-manager";
import { RsContextMenu, type ContextMenuOption } from "../rs-context-menu/rs-context-menu";

type PrivateMenuFields = {
  closeHandler?: (event: Event) => void;
  scrollHandler?: () => void;
  removeCloseListeners(): void;
};

const setViewport = (width: number, height: number): void => {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: width,
  });
  Object.defineProperty(window, "innerHeight", {
    configurable: true,
    value: height,
  });
};

const attachRenderStub = (menu: RsContextMenu, width = 150, height = 100): void => {
  menu.render = () => {
    menu.innerHTML = `<div class="context-menu"><h2>${menu.title}</h2>${menu.renderOptions()}</div>`;

    Object.defineProperty(menu.firstElementChild as Element, "getBoundingClientRect", {
      configurable: true,
      value: () => ({
        width,
        height,
        top: 0,
        left: 0,
        right: width,
        bottom: height,
        x: 0,
        y: 0,
        toJSON: () => null,
      }),
    });
  };
};

const createMenu = (width = 150, height = 100): RsContextMenu => {
  const menu = document.createElement("rs-context-menu") as RsContextMenu;
  attachRenderStub(menu, width, height);
  document.body.appendChild(menu);
  return menu;
};

describe("RsContextMenu", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = "";
    setViewport(1024, 768);
    (contextMenuManager as unknown as { _menu?: Element | null })._menu = undefined;
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
    document.body.innerHTML = "";
    (contextMenuManager as unknown as { _menu?: Element | null })._menu = undefined;
  });

  it("renders enabled, disabled, and highlighted options", () => {
    const menu = createMenu();
    menu.options = [
      { label: "Inspect", callback: vi.fn() },
      { label: "Request", highlightedText: "x14", disabled: true, callback: vi.fn() },
    ];

    const rendered = document.createElement("div");
    rendered.innerHTML = menu.renderOptions();

    const buttons = Array.from(rendered.querySelectorAll("button"));
    expect(buttons).toHaveLength(2);
    expect(buttons[0]?.className).toBe("context-menu__option");
    expect(buttons[0]?.textContent).toBe("Inspect");
    expect(buttons[1]?.className).toContain("context-menu__option--disabled");
    expect((buttons[1] as HTMLButtonElement).disabled).toBe(true);
    expect(buttons[1]?.querySelector("span")?.textContent).toBe("x14");
  });

  it("shows the menu and clamps its position to the viewport", () => {
    const menu = createMenu(80, 50);
    const options: ContextMenuOption[] = [{ label: "Inspect", callback: vi.fn() }];

    setViewport(200, 140);
    menu.show(190, 135, "Actions", options);

    expect(menu.classList.contains("context-menu--visible")).toBe(true);
    expect(menu.style.left).toBe("116px");
    expect(menu.style.top).toBe("86px");

    menu.show(-20, -10, "Actions", options);

    expect(menu.style.left).toBe("0px");
    expect(menu.style.top).toBe("0px");
  });

  it("hides and invokes the selected option callback when a button is clicked", () => {
    const menu = createMenu();
    const callback = vi.fn();
    const hideSpy = vi.spyOn(menu, "hide");

    menu.show(10, 20, "Actions", [{ label: "Inspect", callback }]);

    const button = menu.querySelector(".context-menu__option") as HTMLButtonElement;
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(hideSpy).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("defers outside-close listeners until the next tick", () => {
    const menu = createMenu();
    const hideSpy = vi.spyOn(menu, "hide");

    menu.show(10, 20, "Actions", [{ label: "Inspect", callback: vi.fn() }]);
    document.body.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(hideSpy).not.toHaveBeenCalled();

    vi.runAllTimers();
    (menu.firstElementChild as HTMLElement).dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(hideSpy).not.toHaveBeenCalled();

    document.body.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(hideSpy).toHaveBeenCalledTimes(1);
  });

  it("closes on scroll after the deferred listeners are installed", () => {
    const menu = createMenu();
    const hideSpy = vi.spyOn(menu, "hide");

    menu.show(10, 20, "Actions", [{ label: "Inspect", callback: vi.fn() }]);
    vi.runAllTimers();
    document.dispatchEvent(new Event("scroll"));

    expect(hideSpy).toHaveBeenCalledTimes(1);
  });

  it("removes close listeners and clears private handler references", () => {
    const menu = createMenu();
    const privateMenu = menu as unknown as PrivateMenuFields;
    const closeHandler = vi.fn();
    const scrollHandler = vi.fn();
    const removeSpy = vi.spyOn(document, "removeEventListener");

    privateMenu.closeHandler = closeHandler;
    privateMenu.scrollHandler = scrollHandler;

    privateMenu.removeCloseListeners();

    expect(removeSpy).toHaveBeenCalledWith("click", closeHandler);
    expect(removeSpy).toHaveBeenCalledWith("contextmenu", closeHandler);
    expect(removeSpy).toHaveBeenCalledWith("scroll", scrollHandler, true);
    expect(privateMenu.closeHandler).toBeUndefined();
    expect(privateMenu.scrollHandler).toBeUndefined();
  });

  it("hide removes listeners and the visible class", () => {
    const menu = createMenu();
    const removeCloseListenersSpy = vi.spyOn(menu as unknown as PrivateMenuFields, "removeCloseListeners");
    menu.classList.add("context-menu--visible");

    menu.hide();

    expect(removeCloseListenersSpy).toHaveBeenCalledTimes(1);
    expect(menu.classList.contains("context-menu--visible")).toBe(false);
  });
});

describe("contextMenuManager", () => {
  beforeEach(() => {
    (contextMenuManager as unknown as { _menu?: Element | null })._menu = undefined;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    (contextMenuManager as unknown as { _menu?: Element | null })._menu = undefined;
  });

  it("caches the queried menu element in the getter", () => {
    const queriedMenu = document.createElement("div") as Element;
    const querySpy = vi.spyOn(document, "querySelector").mockReturnValue(queriedMenu);

    expect(contextMenuManager.menu).toBe(queriedMenu);
    expect(contextMenuManager.menu).toBe(queriedMenu);
    expect(querySpy).toHaveBeenCalledTimes(1);
    expect(querySpy).toHaveBeenCalledWith("rs-context-menu");
  });

  it("delegates show and hide to the current menu", () => {
    const menu = {
      show: vi.fn(),
      hide: vi.fn(),
    } as unknown as Element & {
      show(x: number, y: number, title: string, options: ContextMenuOption[]): void;
      hide(): void;
    };
    const options: ContextMenuOption[] = [{ label: "Inspect", callback: vi.fn() }];

    (contextMenuManager as unknown as { _menu?: Element | null })._menu = menu;

    contextMenuManager.show(12, 34, "Actions", options);
    contextMenuManager.hide();

    expect(menu.show).toHaveBeenCalledWith(12, 34, "Actions", options);
    expect(menu.hide).toHaveBeenCalledTimes(1);
  });
});