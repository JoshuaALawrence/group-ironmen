import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SkillName } from "../data/skill";
import { pubsub } from "../data/pubsub";
import { storage } from "../data/storage";
import { PlayerSkills } from "../player-skills/player-skills";
import { RunePouch } from "../rune-pouch/rune-pouch";
import { tooltipManager } from "../rs-tooltip/tooltip-manager";
import { SetupInstructions } from "../setup-instructions/setup-instructions";
import { SidePanel } from "../side-panel/side-panel";

const currentDir = dirname(fileURLToPath(import.meta.url));
const setupInstructionsTemplate = readFileSync(
  resolve(currentDir, "../setup-instructions/setup-instructions.html"),
  "utf8"
);

const expectedSkillOrder = [
  SkillName.Attack,
  SkillName.Hitpoints,
  SkillName.Mining,
  SkillName.Strength,
  SkillName.Agility,
  SkillName.Smithing,
  SkillName.Defence,
  SkillName.Herblore,
  SkillName.Fishing,
  SkillName.Ranged,
  SkillName.Thieving,
  SkillName.Cooking,
  SkillName.Prayer,
  SkillName.Crafting,
  SkillName.Firemaking,
  SkillName.Magic,
  SkillName.Fletching,
  SkillName.Woodcutting,
  SkillName.Runecraft,
  SkillName.Slayer,
  SkillName.Farming,
  SkillName.Construction,
  SkillName.Hunter,
  SkillName.Sailing,
];

function renderTemplate(scope: Record<string, unknown>, template: string): string {
  const names = Object.keys(scope);
  const values = Object.values(scope);
  return Function(...names, `return \`${template}\`;`)(...values) as string;
}

function installLocalStorage(): void {
  const backingStore = new Map<string, string>();

  vi.stubGlobal("localStorage", {
    getItem(key: string) {
      return backingStore.has(key) ? backingStore.get(key) ?? null : null;
    },
    setItem(key: string, value: string) {
      backingStore.set(key, String(value));
    },
    removeItem(key: string) {
      backingStore.delete(key);
    },
    clear() {
      backingStore.clear();
    },
  });
}

function addTooltipElement(): HTMLElement & {
  showTooltip: ReturnType<typeof vi.fn>;
  hideTooltip: ReturnType<typeof vi.fn>;
} {
  const tooltip = document.createElement("rs-tooltip") as HTMLElement & {
    showTooltip: ReturnType<typeof vi.fn>;
    hideTooltip: ReturnType<typeof vi.fn>;
  };
  tooltip.showTooltip = vi.fn();
  tooltip.hideTooltip = vi.fn();
  document.body.appendChild(tooltip);
  tooltipManager._globalTooltip = undefined;
  return tooltip;
}

describe("target component DOM coverage", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    installLocalStorage();
    pubsub.subscribers.clear();
    pubsub.unpublishAll();
    tooltipManager._globalTooltip = undefined;
    vi.restoreAllMocks();
  });

  afterEach(() => {
    document.body.innerHTML = "";
    pubsub.subscribers.clear();
    pubsub.unpublishAll();
    tooltipManager._globalTooltip = undefined;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("subscribes rune pouch updates on connect and unsubscribes on disconnect", () => {
    const pouch = document.createElement("rune-pouch") as RunePouch;
    pouch.setAttribute("player-name", "Alice");
    pouch.setAttribute("pouch-name", "Combat pouch");

    expect(pouch.pouchName).toBe(null);
    expect(pouch.runePouch).toEqual([]);
    expect(pouch.html()).toBe("{{rune-pouch.html}}");

    document.body.appendChild(pouch);

    expect(pouch.pouchName).toBe("Combat pouch");
    expect(pubsub.anyoneListening("runePouch:Alice")).toBe(true);

    const updatedRunes = [{ id: 560, quantity: 321, name: "Death rune" }];
    const handleUpdatedRunePouch = vi.spyOn(pouch, "handleUpdatedRunePouch");

    pubsub.publish("runePouch:Alice", updatedRunes);

    expect(handleUpdatedRunePouch).toHaveBeenCalledWith(updatedRunes);
    expect(pouch.runePouch).toEqual(updatedRunes);

    pouch.remove();

    expect(pubsub.anyoneListening("runePouch:Alice")).toBe(false);
  });

  it("renders rune pouch item boxes and tooltip content", () => {
    const tooltip = addTooltipElement();
    const pouch = document.createElement("rune-pouch") as RunePouch;
    pouch.setAttribute("player-name", "Alice");
    document.body.appendChild(pouch);

    pouch.handleUpdatedRunePouch([
      { id: 556, quantity: 1234, name: "Air rune" },
      { id: 0, quantity: 0, name: "Empty" },
      { id: 554, quantity: 56, name: "Fire rune" },
    ]);

    const runeSlots = pouch.querySelectorAll(".rune-pouch__rune");
    const itemBoxes = pouch.querySelectorAll("item-box");
    const firstItemBox = itemBoxes[0] as HTMLElement & {
      item?: { id: number; quantity: number; name: string };
    };
    const secondItemBox = itemBoxes[1] as HTMLElement & {
      item?: { id: number; quantity: number; name: string };
    };

    expect(runeSlots).toHaveLength(3);
    expect(itemBoxes).toHaveLength(2);
    expect(firstItemBox.getAttribute("very-short-quantity")).toBe("true");
    expect(firstItemBox.getAttribute("no-tooltip")).toBe("true");
    expect(firstItemBox.item).toEqual({ id: 556, quantity: 1234, name: "Air rune" });
    expect(secondItemBox.item).toEqual({ id: 554, quantity: 56, name: "Fire rune" });
    expect(pouch.tooltipText).toBe("Rune pouch<br />1,234 Air rune<br />56 Fire rune");

    pouch.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));

    expect(tooltip.showTooltip).toHaveBeenCalledWith("Rune pouch<br />1,234 Air rune<br />56 Fire rune");

    pouch.remove();

    expect(tooltip.hideTooltip).toHaveBeenCalled();
  });

  it("renders side-panel member panels from subscription updates", () => {
    const sidePanel = document.createElement("side-panel") as SidePanel;
    sidePanel.render = vi.fn(() => {
      sidePanel.innerHTML = '<div class="side-panel__panels"></div>';
    });

    expect(sidePanel.sidePanels).toBe(null);
    expect(sidePanel.html()).toBe("{{side-panel.html}}");
    expect(() => sidePanel.handleUpdatedMembers([{ name: "Alice" }])).not.toThrow();

    document.body.appendChild(sidePanel);

    expect(sidePanel.render).toHaveBeenCalledTimes(1);
    expect(sidePanel.sidePanels).not.toBe(null);
    expect(pubsub.anyoneListening("members-updated")).toBe(true);

    pubsub.publish("members-updated", [{ name: "Alice" }, { name: "@SHARED" }, { name: "Bob" }]);

    const playerPanels = sidePanel.querySelectorAll("player-panel");
    expect(playerPanels).toHaveLength(2);
    expect(playerPanels[0]?.getAttribute("player-name")).toBe("Alice");
    expect(playerPanels[1]?.getAttribute("player-name")).toBe("Bob");
    expect(sidePanel.querySelector(".side-panel__panels")?.innerHTML).not.toContain("@SHARED");

    sidePanel.remove();

    expect(pubsub.anyoneListening("members-updated")).toBe(false);
  });

  it("renders player skills boxes in the expected order on connect", () => {
    const playerSkills = document.createElement("player-skills") as PlayerSkills;
    playerSkills.setAttribute("player-name", "Alice");
    playerSkills.render = vi.fn(() => {
      playerSkills.innerHTML = `<div class="player-skills__skills"></div><total-level-box player-name="${playerSkills.playerName}"></total-level-box>`;
    });

    expect(playerSkills.playerName).toBe(null);
    expect(playerSkills.html()).toBe("{{player-skills.html}}");

    document.body.appendChild(playerSkills);

    const skillBoxes = Array.from(playerSkills.querySelectorAll("skill-box"));

    expect(playerSkills.render).toHaveBeenCalledTimes(1);
    expect(playerSkills.playerName).toBe("Alice");
    expect(skillBoxes).toHaveLength(expectedSkillOrder.length);
    expect(skillBoxes.map((skillBox) => skillBox.getAttribute("skill-name"))).toEqual(expectedSkillOrder);
    expect(skillBoxes[0]?.getAttribute("player-name")).toBe("Alice");
    expect(skillBoxes[0]?.getAttribute("style")).toBe("z-index: 24");
    expect(skillBoxes[skillBoxes.length - 1]?.getAttribute("style")).toBe("z-index: 1");
    expect(playerSkills.querySelector("total-level-box")?.getAttribute("player-name")).toBe("Alice");

    expect(() => playerSkills.remove()).not.toThrow();
  });

  it("reads storage for setup instructions html and renders the stored credentials", () => {
    storage.storeGroup("@EXAMPLE", "token123");
    const storedGroup = storage.getGroup();

    expect(storedGroup).toEqual({ groupName: "@EXAMPLE", groupToken: "token123" });

    const getGroup = vi.spyOn(storage, "getGroup");
    const instructions = document.createElement("setup-instructions") as SetupInstructions;
    const renderedHtml = renderTemplate({ group: storedGroup }, setupInstructionsTemplate);
    instructions.render = vi.fn(() => {
      instructions.innerHTML = renderedHtml;
    });

    expect(instructions.html()).toBe("{{setup-instructions.html}}");
    expect(getGroup).toHaveBeenCalledTimes(1);

    document.body.appendChild(instructions);

    expect(instructions.render).toHaveBeenCalledTimes(1);
    expect(instructions.textContent).toContain("@EXAMPLE");
    expect(instructions.textContent).toContain("token123");
    expect(instructions.querySelector(".setup__credential-hide")?.textContent).toContain("Click to show");
    expect(instructions.querySelector('men-link[link-href="/group"]')).not.toBe(null);
  });
});