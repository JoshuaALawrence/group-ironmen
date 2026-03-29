import { describe, expect, it } from "vitest";
import {
  calculateBankedXpTotal,
  calculateSecondaries,
  createBankedItemMap,
  getActivityXpRate,
  getItemQty,
  rebuildLinkedMap,
  type BankedItem,
  type EnabledModifier,
} from "../banked-xp-page/banked-xp-calc";
import { EXPERIENCE_ITEMS } from "../banked-xp-page/banked-xp-data";

describe("banked xp calc", () => {
  it("applies consumption, outfit, and static modifiers to xp rates", () => {
    const activity = { skill: "construction", experienceItem: "LOGS", xp: 100 };

    expect(
      getActivityXpRate(activity as never, [
        { skill: "construction", type: "static", multiplier: 2, included: ["LOGS"], ignored: [] } as EnabledModifier,
      ])
    ).toBe(200);

    expect(
      getActivityXpRate(activity as never, [
        { skill: "construction", type: "consumption", savePercentage: 0.25, multiplier: 1.5, included: ["LOGS"], ignored: [] } as EnabledModifier,
      ])
    ).toBe(200);

    expect(
      getActivityXpRate(activity as never, [
        {
          skill: "construction",
          type: "skillingOutfit",
          baseBonus: 0,
          _enabledPieces: [true, true, true, true],
          included: ["LOGS"],
          ignored: [],
        } as EnabledModifier,
      ])
    ).toBe(102.5);
  });

  it("creates item maps, resolves linked quantities, and totals banked xp", () => {
    const members = new Map<string, { totalItemQuantity: (itemId: number) => number }>([
      ["Alice", { totalItemQuantity: (itemId: number) => (itemId === 1511 ? 2 : 0) }],
      ["Bob", { totalItemQuantity: (itemId: number) => (itemId === 1511 ? 1 : 0) }],
    ]);

    const bankedConstruction = createBankedItemMap("construction", members, 99);
    expect(bankedConstruction.bankedItems.length).toBeGreaterThan(0);

    const source: BankedItem = {
      item: EXPERIENCE_ITEMS.GRIMY_GUAM_LEAF,
      qty: 2,
      selectedActivity: {
        skill: "herblore",
        experienceItem: "GRIMY_GUAM_LEAF",
        xp: 50,
        linkedItem: "GUAM_POTION_UNF",
        output: { qty: 1 },
      },
      ignored: false,
    } as never;
    const target: BankedItem = {
      item: EXPERIENCE_ITEMS.GUAM_POTION_UNF,
      qty: 1,
      selectedActivity: {
        skill: "herblore",
        experienceItem: "GUAM_POTION_UNF",
        xp: 100,
        linkedItem: null,
      },
      ignored: false,
    } as never;

    const linkedMap = rebuildLinkedMap([source, target]);

    expect(getItemQty(target, linkedMap, [source, target], true)).toBe(3);
    expect(getItemQty(target, linkedMap, [source, target], false)).toBe(1);
    expect(calculateBankedXpTotal([source, target], linkedMap, [], 1, true)).toBe(400);
  });

  it("calculates secondaries for standard potion requirements", () => {
    const bankedItems: BankedItem[] = [
      {
        item: {
          name: "Guam leaf",
          itemID: 199,
          skill: "herblore",
          category: "Herbs",
          itemIds: [199],
          byDose: false,
        } as never,
        qty: 3,
        selectedActivity: {
          skill: "herblore",
          experienceItem: "Guam leaf",
          xp: 25,
          secondaries: "UNFINISHED_POTION",
        } as never,
        ignored: false,
      },
    ];

    const secondaries = calculateSecondaries(bankedItems, new Map(), false);

    expect(secondaries.get(227)).toEqual({ id: 227, qty: 3 });
  });
});