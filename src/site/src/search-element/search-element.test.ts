import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SearchElement } from "./search-element";

function mockRenderedInput(element: SearchElement, value = ""): void {
  vi.spyOn(element, "render").mockImplementation(function renderInput(this: SearchElement) {
    this.innerHTML = `<input class="search-element__input" value="${value}">`;
  });
}

describe("SearchElement", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("starts with no cached input, returns its html template, and exposes an empty value", () => {
    const element = new SearchElement();

    expect(element.searchInput).toBeNull();
    expect(element.html()).toBe("{{search-element.html}}");
    expect(element.value).toBe("");
  });

  it("renders and caches the input on connect without auto focus", () => {
    const element = new SearchElement();
    const button = document.createElement("button");
    mockRenderedInput(element, "rune");

    document.body.append(button, element);

    expect(element.searchInput).toBeInstanceOf(HTMLInputElement);
    expect(element.value).toBe("rune");
    expect(element.eventListeners.get(document.body)?.has("keydown")).not.toBe(true);

    button.focus();
    document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "r" }));

    expect(document.activeElement).toBe(button);
  });

  it("adds the body keydown listener when auto focus is enabled", () => {
    const element = new SearchElement();
    const button = document.createElement("button");
    element.setAttribute("auto-focus", "");
    mockRenderedInput(element, "zulrah");

    document.body.append(button, element);

    expect(element.eventListeners.get(document.body)?.has("keydown")).toBe(true);

    button.focus();
    document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "z" }));

    expect(document.activeElement).toBe(element.searchInput);
  });

  it("focusSearch only moves focus for non-tab keys when a non-input element is active", () => {
    const element = new SearchElement();
    const button = document.createElement("button");
    const otherInput = document.createElement("input");
    const searchInput = document.createElement("input");

    document.body.append(button, otherInput, searchInput);
    element.searchInput = searchInput;

    button.focus();
    element.focusSearch(new KeyboardEvent("keydown", { key: "x" }));
    expect(document.activeElement).toBe(searchInput);

    otherInput.focus();
    element.focusSearch(new KeyboardEvent("keydown", { key: "x" }));
    expect(document.activeElement).toBe(otherInput);

    button.focus();
    element.focusSearch(new KeyboardEvent("keydown", { key: "Tab" }));
    expect(document.activeElement).toBe(button);
  });
});