import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RsTooltip } from "./rs-tooltip";
import { tooltipManager } from "./tooltip-manager";

describe("RsTooltip", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    tooltipManager._globalTooltip = undefined;
    Object.defineProperty(document.body, "clientWidth", {
      configurable: true,
      value: 200,
    });
  });

  afterEach(() => {
    document.body.innerHTML = "";
    tooltipManager._globalTooltip = undefined;
    vi.restoreAllMocks();
  });

  it("shows rendered html when tooltip text exists and hides otherwise", () => {
    const tooltip = new RsTooltip();

    expect(tooltip.html()).toBe("");
    expect(tooltip.style.display).toBe("none");

    tooltip.tooltipText = "Abyssal whip";

    expect(tooltip.html()).toBe("{{rs-tooltip.html}}");
    expect(tooltip.style.display).toBe("block");
  });

  it("renders when connected to the document", () => {
    const tooltip = new RsTooltip();
    const renderSpy = vi.spyOn(tooltip, "render").mockImplementation(() => {});

    document.body.appendChild(tooltip);

    expect(renderSpy).toHaveBeenCalledTimes(1);
  });

  it("positions to the right or left depending on the cursor location", () => {
    const tooltip = new RsTooltip();
    tooltip.height = 10;
    Object.defineProperty(tooltip, "offsetWidth", {
      configurable: true,
      value: 40,
    });

    tooltip.updatePosition(new MouseEvent("mousemove", { clientX: 20, clientY: 30 }));
    expect(tooltip.style.transform).toBe("translate(22px, 20px)");

    tooltip.updatePosition(new MouseEvent("mousemove", { clientX: 150, clientY: 30 }));
    expect(tooltip.style.transform).toBe("translate(110px, 20px)");
  });

  it("shows the tooltip, tracks mouse movement, and hides it cleanly", () => {
    const tooltip = new RsTooltip();
    document.body.appendChild(tooltip);

    const renderSpy = vi.spyOn(tooltip, "render").mockImplementation(() => {});
    const updatePositionSpy = vi.spyOn(tooltip, "updatePosition");
    const unbindSpy = vi.spyOn(tooltip, "unbindEvents");

    Object.defineProperty(tooltip, "offsetHeight", {
      configurable: true,
      value: 25,
    });

    tooltip.showTooltip("Barrows chest");

    expect(tooltip.tooltipText).toBe("Barrows chest");
    expect(tooltip.height).toBe(25);
    expect(renderSpy).toHaveBeenCalledTimes(1);
    expect(tooltip.eventListeners.get(document.body)?.has("mousemove")).toBe(true);

    document.body.dispatchEvent(new MouseEvent("mousemove", { clientX: 50, clientY: 60 }));
    expect(updatePositionSpy).toHaveBeenCalledTimes(1);

    tooltip.hideTooltip();

    expect(tooltip.tooltipText).toBeUndefined();
    expect(unbindSpy).toHaveBeenCalledTimes(1);
    expect(renderSpy).toHaveBeenCalledTimes(2);
    expect(tooltip.eventListeners.size).toBe(0);
  });
});

describe("tooltipManager", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    tooltipManager._globalTooltip = undefined;
  });

  afterEach(() => {
    document.body.innerHTML = "";
    tooltipManager._globalTooltip = undefined;
    vi.restoreAllMocks();
  });

  it("caches the global tooltip lookup and delegates show and hide calls", () => {
    const globalTooltip = document.createElement("rs-tooltip") as Element & {
      showTooltip: (tooltipText: string) => void;
      hideTooltip: () => void;
    };
    const showTooltipSpy = vi.fn();
    const hideTooltipSpy = vi.fn();

    globalTooltip.showTooltip = showTooltipSpy;
    globalTooltip.hideTooltip = hideTooltipSpy;
    document.body.appendChild(globalTooltip);

    const querySpy = vi.spyOn(document, "querySelector");

    expect(tooltipManager.globalTooltip).toBe(globalTooltip);
    expect(tooltipManager.globalTooltip).toBe(globalTooltip);
    expect(querySpy).toHaveBeenCalledTimes(1);

    tooltipManager.showTooltip("Dragon claws");
    tooltipManager.hideTooltip();

    expect(showTooltipSpy).toHaveBeenCalledWith("Dragon claws");
    expect(hideTooltipSpy).toHaveBeenCalledTimes(1);
  });
});