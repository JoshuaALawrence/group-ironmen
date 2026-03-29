import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockedGroupData = vi.hoisted(() => ({
  members: new Map<string, { hue?: number }>(),
  inventoryQuantityForItem: vi.fn(() => 1),
}));

const mockedItem = vi.hoisted(() => ({
  itemName: vi.fn((id: number) => `Item ${id}`),
  imageUrl: vi.fn((id: number) => `/icons/${id}.webp`),
}));

const mockedCollectionLog = vi.hoisted(() => ({
  playerNames: ["Alice", "Bob"],
  otherPlayers: ["Bob"],
  unlockedItemCount: vi.fn((playerName: string, itemId: number) => {
    if (playerName === "Alice" && itemId === 1) return 3;
    return 0;
  }),
}));

const mockedUtility = vi.hoisted(() => ({
  timeSinceLastUpdate: vi.fn(() => 0),
}));

vi.mock("../data/group-data", () => ({
  groupData: mockedGroupData,
}));

vi.mock("../data/item", () => ({
  Item: mockedItem,
}));

vi.mock("../data/collection-log", () => ({
  collectionLog: mockedCollectionLog,
}));

vi.mock("../utility", () => ({
  utility: mockedUtility,
}));

import { pubsub } from "../data/pubsub";
import { PlayerIcon } from "../player-icon/player-icon";
import { PlayerInventory } from "../player-inventory/player-inventory";
import { PlayerEquipment } from "../player-equipment/player-equipment";
import { PlayerDiaries } from "../player-diaries/player-diaries";
import { PlayerInteracting } from "../player-interacting/player-interacting";
import { ItemBox } from "../item-box/item-box";
import { CollectionLogItem } from "../collection-log-item/collection-log-item";

describe("player and item components", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    pubsub.subscribers.clear();
    pubsub.unpublishAll();
    vi.restoreAllMocks();
    mockedGroupData.members.clear();
    mockedGroupData.inventoryQuantityForItem.mockReturnValue(1);
    mockedItem.itemName.mockImplementation((id: number) => `Item ${id}`);
    mockedCollectionLog.unlockedItemCount.mockImplementation((playerName: string, itemId: number) => {
      if (playerName === "Alice" && itemId === 1) return 3;
      return 0;
    });
    mockedUtility.timeSinceLastUpdate.mockReturnValue(0);
  });

  afterEach(() => {
    document.body.innerHTML = "";
    pubsub.subscribers.clear();
    pubsub.unpublishAll();
    vi.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  // PlayerIcon
  // ---------------------------------------------------------------------------
  describe("PlayerIcon", () => {
    it("sets CSS hue variable from groupData member on connect", () => {
      mockedGroupData.members.set("Alice", { hue: 120 });
      const icon = new PlayerIcon();
      icon.setAttribute("player-name", "Alice");
      document.body.appendChild(icon);

      expect(icon.style.getPropertyValue("--player-icon-color")).toBe("120deg");
    });

    it("defaults to 0deg when member has no hue", () => {
      mockedGroupData.members.set("Bob", {});
      const icon = new PlayerIcon();
      icon.setAttribute("player-name", "Bob");
      document.body.appendChild(icon);

      expect(icon.style.getPropertyValue("--player-icon-color")).toBe("0deg");
    });

    it("html() returns the template placeholder", () => {
      const icon = new PlayerIcon();
      expect(icon.html()).toBe("{{player-icon.html}}");
    });

    it("disconnectedCallback cleans up without errors", () => {
      mockedGroupData.members.set("Alice", { hue: 60 });
      const icon = new PlayerIcon();
      icon.setAttribute("player-name", "Alice");
      document.body.appendChild(icon);
      expect(() => document.body.removeChild(icon)).not.toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  // PlayerInventory
  // ---------------------------------------------------------------------------
  describe("PlayerInventory", () => {
    it("subscribes to inventory events on connect", () => {
      const inv = new PlayerInventory();
      vi.spyOn(inv, "html").mockReturnValue(
        `<div class="player-inventory__inventory"></div>`
      );
      inv.setAttribute("player-name", "Alice");
      document.body.appendChild(inv);

      expect(pubsub.anyoneListening("inventory:Alice")).toBe(true);
    });

    it("handleUpdatedInventory() creates item-box elements for valid items", () => {
      const inv = new PlayerInventory();
      vi.spyOn(inv, "html").mockReturnValue(
        `<div class="player-inventory__inventory"></div>`
      );
      inv.setAttribute("player-name", "Alice");
      document.body.appendChild(inv);

      const inventory = [
        { isValid: () => true, isRunePouch: () => false },
        { isValid: () => false, isRunePouch: () => false },
        { isValid: () => true, isRunePouch: () => true },
        { isValid: () => true, isRunePouch: () => false },
      ];

      inv.handleUpdatedInventory(inventory as never);
      const inventoryEl = inv.querySelector(".player-inventory__inventory");
      const items = inventoryEl?.querySelectorAll("item-box");
      expect(items?.length).toBe(3); // 3 valid items

      // Rune pouch gets no-tooltip attribute
      const runePouchEl = Array.from(items ?? []).find((el) =>
        el.hasAttribute("no-tooltip")
      );
      expect(runePouchEl).not.toBeNull();
    });

    it("handleUpdatedInventory() does nothing when inventoryEl is null", () => {
      const inv = new PlayerInventory();
      vi.spyOn(inv, "html").mockReturnValue(`<div></div>`);
      inv.setAttribute("player-name", "Alice");
      document.body.appendChild(inv);

      // inventoryEl is null since the rendered HTML has no .player-inventory__inventory
      expect(() =>
        inv.handleUpdatedInventory([{ isValid: () => true, isRunePouch: () => false }] as never)
      ).not.toThrow();
    });

    it("disconnectedCallback unsubscribes events", () => {
      const inv = new PlayerInventory();
      vi.spyOn(inv, "html").mockReturnValue(`<div class="player-inventory__inventory"></div>`);
      inv.setAttribute("player-name", "Dave");
      document.body.appendChild(inv);

      expect(pubsub.anyoneListening("inventory:Dave")).toBe(true);
      document.body.removeChild(inv);
      expect(pubsub.anyoneListening("inventory:Dave")).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // PlayerEquipment
  // ---------------------------------------------------------------------------
  describe("PlayerEquipment", () => {
    function makeEquipmentHtml() {
      return `
        <div class="equipment-head"></div>
        <div class="equipment-cape"></div>
        <div class="equipment-neck"></div>
        <div class="equipment-weapon"></div>
        <div class="equipment-torso"></div>
        <div class="equipment-shield"></div>
        <div class="equipment-legs"></div>
        <div class="equipment-gloves"></div>
        <div class="equipment-boots"></div>
        <div class="equipment-ring"></div>
        <div class="equipment-ammo"></div>
      `;
    }

    it("subscribes to equipment events on connect", () => {
      const equip = new PlayerEquipment();
      vi.spyOn(equip, "html").mockReturnValue(makeEquipmentHtml());
      equip.setAttribute("player-name", "Alice");
      document.body.appendChild(equip);

      expect(pubsub.anyoneListening("equipment:Alice")).toBe(true);
    });

    it("handleUpdatedEquipment() places item-box for valid items and img for empty slots", () => {
      const equip = new PlayerEquipment();
      vi.spyOn(equip, "html").mockReturnValue(makeEquipmentHtml());
      equip.setAttribute("player-name", "Alice");
      document.body.appendChild(equip);

      // Equipment slots: 0=Head, 1=Back, 2=Neck, 3=Weapon, etc.
      const equipment = new Array(14).fill({ id: 0, isValid: () => false });
      const headItem = { id: 1234, isValid: () => true };
      const modifiedEquipment = [...equipment];
      modifiedEquipment[0] = headItem; // Head slot

      equip.handleUpdatedEquipment(modifiedEquipment as never);

      const headEl = equip.querySelector(".equipment-head");
      expect(headEl?.querySelector("item-box")).not.toBeNull();

      const capeEl = equip.querySelector(".equipment-cape");
      expect(capeEl?.querySelector("img")).not.toBeNull();
    });

    it("handleUpdatedEquipment() skips slots with no corresponding element", () => {
      const equip = new PlayerEquipment();
      vi.spyOn(equip, "html").mockReturnValue(makeEquipmentHtml());
      equip.setAttribute("player-name", "Alice");
      document.body.appendChild(equip);

      // Slot 6 has no equipment element - should not throw
      const equipment = new Array(14).fill({ id: 0, isValid: () => false });
      equipment[6] = { id: 9999, isValid: () => true };

      expect(() => equip.handleUpdatedEquipment(equipment as never)).not.toThrow();
    });

    it("disconnectedCallback unsubscribes events", () => {
      const equip = new PlayerEquipment();
      vi.spyOn(equip, "html").mockReturnValue(makeEquipmentHtml());
      equip.setAttribute("player-name", "Eve");
      document.body.appendChild(equip);

      expect(pubsub.anyoneListening("equipment:Eve")).toBe(true);
      document.body.removeChild(equip);
      expect(pubsub.anyoneListening("equipment:Eve")).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // PlayerDiaries
  // ---------------------------------------------------------------------------
  describe("PlayerDiaries", () => {
    it("subscribes to diaries events on connect", () => {
      const diaries = new PlayerDiaries();
      vi.spyOn(diaries, "html").mockReturnValue(`<div class="player-diaries__completions"></div>`);
      diaries.setAttribute("player-name", "Alice");
      document.body.appendChild(diaries);

      expect(pubsub.anyoneListening("diaries:Alice")).toBe(true);
    });

    it("handleDiaries() creates diary-completion elements for each diary", () => {
      const diaries = new PlayerDiaries();
      vi.spyOn(diaries, "html").mockReturnValue(`<div class="player-diaries__completions"></div>`);
      diaries.setAttribute("player-name", "Alice");
      document.body.appendChild(diaries);

      diaries.handleDiaries({
        completion: {
          Ardougne: { Easy: [true, false] },
          Varrock: { Easy: [true], Medium: [false, true] },
        },
      });

      const completionsEl = diaries.querySelector(".player-diaries__completions");
      expect(completionsEl?.querySelectorAll("diary-completion").length).toBe(2);
    });

    it("handleDiaries() does nothing when completionsEl is null", () => {
      const diaries = new PlayerDiaries();
      vi.spyOn(diaries, "html").mockReturnValue(`<div></div>`);
      diaries.setAttribute("player-name", "Alice");
      document.body.appendChild(diaries);

      expect(() =>
        diaries.handleDiaries({ completion: { Ardougne: { Easy: [true] } } })
      ).not.toThrow();
    });

    it("disconnectedCallback unsubscribes events", () => {
      const diaries = new PlayerDiaries();
      vi.spyOn(diaries, "html").mockReturnValue(`<div class="player-diaries__completions"></div>`);
      diaries.setAttribute("player-name", "Frank");
      document.body.appendChild(diaries);

      expect(pubsub.anyoneListening("diaries:Frank")).toBe(true);
      document.body.removeChild(diaries);
      expect(pubsub.anyoneListening("diaries:Frank")).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // PlayerInteracting
  // ---------------------------------------------------------------------------
  describe("PlayerInteracting", () => {
    function makeInteractingHtml() {
      const statBar = document.createElement("stat-bar") as HTMLElement & { update: () => void };
      statBar.update = vi.fn();
      return `<div class="player-interacting__name"></div>`;
    }

    it("subscribes to interacting events on connect", async () => {
      const comp = new PlayerInteracting();
      vi.spyOn(comp, "html").mockReturnValue(makeInteractingHtml());
      comp.setAttribute("player-name", "Alice");
      document.body.appendChild(comp);

      await new Promise((r) => setTimeout(r, 0));

      expect(pubsub.anyoneListening("interacting:Alice")).toBe(true);
    });

    it("handleInteracting() shows component and updates name when data is recent", async () => {
      const comp = new PlayerInteracting();
      vi.spyOn(comp, "html").mockReturnValue(
        `<stat-bar></stat-bar><div class="player-interacting__name"></div>`
      );

      const statBar = document.createElement("div") as HTMLElement & { update: ReturnType<typeof vi.fn> };
      statBar.update = vi.fn();

      comp.setAttribute("player-name", "Alice");
      document.body.appendChild(comp);

      mockedUtility.timeSinceLastUpdate.mockReturnValue(0);

      comp.hitpointsBar = statBar as unknown as PlayerInteracting["hitpointsBar"];
      comp.nameEl = comp.querySelector(".player-interacting__name");
      comp.marker = {
        coordinates: { x: 0, y: 0, plane: 0 },
        label: "",
      };

      comp.handleInteracting({
        last_updated: new Date().toISOString(),
        ratio: 50,
        scale: 100,
        name: "Dragon",
        location: { x: 3200, y: 3200, plane: 0 },
      });

      expect(comp.nameEl?.textContent).toBe("Dragon");
      expect(statBar.update).toHaveBeenCalledWith(0.5);
      expect(comp.style.visibility).toBe("visible");
      expect(comp.marker.coordinates).toEqual({ x: 3200, y: 3200, plane: 0 });
    });

    it("handleInteracting() does not show when data is stale", () => {
      const comp = new PlayerInteracting();
      vi.spyOn(comp, "html").mockReturnValue(`<div class="player-interacting__name"></div>`);
      comp.setAttribute("player-name", "Alice");
      document.body.appendChild(comp);

      mockedUtility.timeSinceLastUpdate.mockReturnValue(40000); // > 30s stale

      expect(() =>
        comp.handleInteracting({
          last_updated: new Date(Date.now() - 40000).toISOString(),
          ratio: 50,
          scale: 100,
          name: "Dragon",
          location: { x: 3200, y: 3200, plane: 0 },
        })
      ).not.toThrow();
    });

    it("hide() hides component and moves marker off-screen", () => {
      const comp = new PlayerInteracting();
      document.body.appendChild(comp);
      comp.marker = { coordinates: { x: 100, y: 100, plane: 0 }, label: "Test" };
      comp.hide();
      expect(comp.style.visibility).toBe("hidden");
      expect(comp.marker.coordinates.x).toBe(-1000000);
    });

    it("hide() is a no-op when there is no marker", () => {
      const comp = new PlayerInteracting();
      document.body.appendChild(comp);
      expect(() => comp.hide()).not.toThrow();
    });

    it("show() updates marker coordinates from interacting data", () => {
      const comp = new PlayerInteracting();
      document.body.appendChild(comp);
      comp.marker = { coordinates: { x: 0, y: 0, plane: 0 }, label: "" };
      comp.interacting = {
        last_updated: "",
        ratio: 80,
        scale: 100,
        name: "Boss",
        location: { x: 3100, y: 3500, plane: 1 },
      };
      comp.show();
      expect(comp.style.visibility).toBe("visible");
      expect(comp.marker.coordinates).toEqual({ x: 3100, y: 3500, plane: 1 });
      expect(comp.marker.label).toBe("Boss");
    });

    it("show() is a no-op when there is no marker or interacting data", () => {
      const comp = new PlayerInteracting();
      document.body.appendChild(comp);
      expect(() => comp.show()).not.toThrow();
    });

    it("addMapMarker() does nothing when no map element exists", async () => {
      const comp = new PlayerInteracting();
      document.body.appendChild(comp);
      expect(comp.map).toBeNull();
      await expect(comp.addMapMarker()).resolves.toBeUndefined();
    });

    it("addMapMarker() calls map.addInteractingMarker when map is present", async () => {
      const comp = new PlayerInteracting();
      vi.spyOn(comp, "html").mockReturnValue(`<div></div>`);
      document.body.appendChild(comp);

      const mockMap = {
        addInteractingMarker: vi.fn().mockReturnValue({ coordinates: { x: 0, y: 0, plane: 0 }, label: "" }),
        removeInteractingMarker: vi.fn(),
      };
      comp.map = mockMap as unknown as PlayerInteracting["map"];

      await comp.addMapMarker();
      expect(mockMap.addInteractingMarker).toHaveBeenCalledWith(0, 0, "");
      expect(comp.marker).toBeDefined();
    });

    it("disconnectedCallback cleans up marker and timeout", () => {
      const comp = new PlayerInteracting();
      vi.spyOn(comp, "html").mockReturnValue(`<div></div>`);
      document.body.appendChild(comp);

      const mockMap = {
        addInteractingMarker: vi.fn().mockReturnValue({ coordinates: { x: 0, y: 0, plane: 0 }, label: "" }),
        removeInteractingMarker: vi.fn(),
      };
      comp.map = mockMap as unknown as PlayerInteracting["map"];
      comp.marker = { coordinates: { x: 0, y: 0, plane: 0 }, label: "" };

      document.body.removeChild(comp);
      expect(mockMap.removeInteractingMarker).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // ItemBox
  // ---------------------------------------------------------------------------
  describe("ItemBox", () => {
    it("sets tooltip from item data when item is provided and no-tooltip is absent", () => {
      mockedGroupData.members.set("Alice", {});
      mockedGroupData.inventoryQuantityForItem.mockReturnValue(5);

      const box = new ItemBox();
      box.item = {
        id: 1234,
        name: "Abyssal whip",
        quantity: 1,
        highAlch: 72000,
        gePrice: 2000000,
        isValid: () => true,
        isRunePouch: () => false,
      } as never;
      box.setAttribute("player-name", "Alice");
      box.setAttribute("inventory-type", "inventory");
      document.body.appendChild(box);

      expect(box.itemId).toBe(1234);
      expect(box.quantity).toBe(1);
      expect(box.tooltipText).toContain("Abyssal whip");
      expect(box.tooltipText).toContain("5"); // total quantity from groupData
    });

    it("sets tooltip from Item.itemName when no item object is provided", () => {
      mockedItem.itemName.mockReturnValue("Dragon scimitar");
      const box = new ItemBox();
      box.setAttribute("item-id", "4587");
      box.setAttribute("item-quantity", "3");
      document.body.appendChild(box);

      expect(box.itemId).toBe(4587);
      expect(box.quantity).toBe(3);
      expect(box.tooltipText).toContain("Dragon scimitar");
    });

    it("skips tooltip when no-tooltip attribute is set", () => {
      const box = new ItemBox();
      box.setAttribute("no-tooltip", "");
      box.setAttribute("item-id", "4587");
      document.body.appendChild(box);

      expect(box.noTooltip).toBe(true);
      expect(box.tooltipText).toBeUndefined();
    });

    it("html() returns the template placeholder", () => {
      const box = new ItemBox();
      expect(box.html()).toBe("{{item-box.html}}");
    });

    it("disconnectedCallback cleans up without errors", () => {
      const box = new ItemBox();
      box.setAttribute("item-id", "1");
      document.body.appendChild(box);
      expect(() => document.body.removeChild(box)).not.toThrow();
    });

    it("uses item.quantity when no inventory type is provided", () => {
      mockedGroupData.members.set("Alice", {});

      const box = new ItemBox();
      box.item = {
        id: 995,
        name: "Coins",
        quantity: 100000,
        highAlch: 1,
        gePrice: 1,
        isValid: () => true,
        isRunePouch: () => false,
      } as never;
      // No inventory-type or player-name attribute
      document.body.appendChild(box);

      expect(box.tooltipText).toContain("Coins");
      // quantity = item.quantity since no inventoryType
      expect(box.tooltipText).toContain("100,000");
    });
  });

  // ---------------------------------------------------------------------------
  // CollectionLogItem
  // ---------------------------------------------------------------------------
  describe("CollectionLogItem", () => {
    it("builds tooltip with player name and count for items owned", () => {
      mockedItem.itemName.mockReturnValue("Twisted bow");
      mockedCollectionLog.playerNames = ["Alice", "Bob"];
      mockedCollectionLog.unlockedItemCount.mockImplementation((player, id) => {
        if (player === "Alice" && id === 1) return 2;
        return 0;
      });
      mockedCollectionLog.otherPlayers = ["Bob"];

      const item = new CollectionLogItem();
      item.setAttribute("item-id", "1");
      item.setAttribute("player-name", "Alice");
      document.body.appendChild(item);

      expect(item.tooltipText).toContain("Twisted bow");
      expect(item.tooltipText).toContain("Alice");
      expect(item.tooltipText).toContain("2");
      expect(item.otherPlayers).toEqual(["Bob"]);
    });

    it("excludes players with 0 count from tooltip", () => {
      mockedItem.itemName.mockReturnValue("Dragon claws");
      mockedCollectionLog.playerNames = ["Alice", "Bob"];
      mockedCollectionLog.unlockedItemCount.mockReturnValue(0);

      const item = new CollectionLogItem();
      item.setAttribute("item-id", "13652");
      item.setAttribute("player-name", "Alice");
      document.body.appendChild(item);

      expect(item.tooltipText).toBe("Dragon claws");
    });

    it("html() returns the template placeholder", () => {
      const item = new CollectionLogItem();
      expect(item.html()).toBe("{{collection-log-item.html}}");
    });

    it("disconnectedCallback cleans up without errors", () => {
      const item = new CollectionLogItem();
      item.setAttribute("item-id", "1");
      document.body.appendChild(item);
      expect(() => document.body.removeChild(item)).not.toThrow();
    });
  });
});
