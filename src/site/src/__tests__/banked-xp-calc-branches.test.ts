import { describe, expect, it } from "vitest";
import {
  calculateBankedXpTotal,
  calculateSecondaries,
  createBankedItemMap,
  getActivityXpRate,
  getItemQty,
  rebuildLinkedMap,
  type Activity,
  type BankedItem,
  type EnabledModifier,
} from "../banked-xp-page/banked-xp-calc";
import { EXPERIENCE_ITEMS } from "../banked-xp-page/banked-xp-data";

function makeActivity(overrides: Partial<Activity> = {}): Activity {
  return {
    name: "TEST_ACTIVITY",
    icon: 0,
    displayName: "Test activity",
    level: 1,
    xp: 1,
    rngActivity: false,
    experienceItem: "LOGS",
    skill: "construction",
    secondaries: null,
    output: { id: 0, qty: 1 },
    linkedItem: null,
    ...overrides,
  };
}

function makeBankedItem(
  item: (typeof EXPERIENCE_ITEMS)[keyof typeof EXPERIENCE_ITEMS],
  qty: number,
  selectedActivity: Activity | null,
  ignored = false
): BankedItem {
  return {
    item,
    qty,
    selectedActivity,
    ignored,
  };
}

function makeMembers(counts: Record<number, number>) {
  return new Map<string, { totalItemQuantity: (itemId: number) => number }>([
    [
      "member",
      {
        totalItemQuantity: (itemId: number) => counts[itemId] ?? 0,
      },
    ],
  ]);
}

describe("banked xp calc branch coverage", () => {
  it("covers modifier applicability and outfit/save xp branches", () => {
    const logsActivity = makeActivity({
      skill: "construction",
      experienceItem: "LOGS",
      xp: 100,
    });
    const bonesActivity = makeActivity({
      skill: "prayer",
      experienceItem: "DRAGON_BONES",
      xp: 100,
    });

    expect(
      getActivityXpRate(logsActivity, [
        {
          skill: "firemaking",
          type: "static",
          multiplier: 5,
          included: [],
          ignored: [],
        } as EnabledModifier,
      ])
    ).toBe(100);

    expect(
      getActivityXpRate(logsActivity, [
        {
          skill: "construction",
          type: "static",
          multiplier: 5,
          included: ["OAK_LOGS"],
          ignored: [],
        } as EnabledModifier,
      ])
    ).toBe(100);

    expect(
      getActivityXpRate(logsActivity, [
        {
          skill: "construction",
          type: "static",
          multiplier: 5,
          included: [],
          ignored: ["LOGS"],
        } as EnabledModifier,
      ])
    ).toBe(100);

    expect(
      getActivityXpRate(logsActivity, [
        {
          skill: "construction",
          type: "skillingOutfit",
          baseBonus: 0.005,
          _enabledPieces: [false, false, false, false],
          included: [],
          ignored: [],
        } as EnabledModifier,
      ])
    ).toBe(100);

    expect(
      getActivityXpRate(logsActivity, [
        {
          skill: "construction",
          type: "skillingOutfit",
          baseBonus: 0.005,
          _enabledPieces: [true, true, false, false],
          included: [],
          ignored: [],
        } as EnabledModifier,
      ])
    ).toBe(101.2);

    expect(
      getActivityXpRate(logsActivity, [
        {
          skill: "construction",
          type: "skillingOutfit",
          baseBonus: 0.005,
          _enabledPieces: [true, true, true, true],
          included: [],
          ignored: [],
        } as EnabledModifier,
      ])
    ).toBe(102.5);

    expect(
      getActivityXpRate(logsActivity, [
        {
          skill: "construction",
          type: "consumption",
          multiplier: 2,
          savePercentage: 1,
          included: ["LOGS"],
          ignored: [],
        } as EnabledModifier,
      ])
    ).toBe(200);

    expect(
      getActivityXpRate(bonesActivity, [
        {
          skill: "prayer",
          type: "skillingOutfit",
          baseBonus: 0.0125,
          _enabledPieces: [true, true, true, false],
          included: ["DRAGON_BONES"],
          ignored: [],
        } as EnabledModifier,
      ])
    ).toBe(103.9);

    expect(
      getActivityXpRate(bonesActivity, [
        {
          skill: "prayer",
          type: "consumption",
          multiplier: 3.5,
          savePercentage: 0.5,
          included: ["DRAGON_BONES"],
          ignored: [],
        } as EnabledModifier,
        {
          skill: "prayer",
          type: "skillingOutfit",
          baseBonus: 0.0125,
          _enabledPieces: [true, true, false, false],
          included: ["DRAGON_BONES"],
          ignored: [],
        } as EnabledModifier,
      ])
    ).toBe(717.95);
  });

  it("filters activities, seeds linked targets, and multiplies by-dose quantities", () => {
    const guamLeafMap = createBankedItemMap(
      "herblore",
      makeMembers({
        [EXPERIENCE_ITEMS.GUAM_LEAF.itemID]: 5,
      }),
      1
    );

    const guamLeaf = guamLeafMap.bankedItems.find((item) => item.item.name === "GUAM_LEAF");
    const guamPotionUnf = guamLeafMap.bankedItems.find((item) => item.item.name === "GUAM_POTION_UNF");

    expect(guamLeaf).toBeDefined();
    expect(guamLeaf?.qty).toBe(5);
    expect(guamLeaf?.selectedActivity?.name).toBe("GUAM_POTION_UNF");
    expect(guamPotionUnf).toBeDefined();
    expect(guamPotionUnf?.qty).toBe(0);
    expect(guamLeafMap.linkedMap.get("GUAM_POTION_UNF")).toEqual([guamLeaf]);

    const superEnergy = EXPERIENCE_ITEMS.SUPER_ENERGY;
    const byDoseMap = createBankedItemMap(
      "herblore",
      makeMembers({
        [superEnergy.itemIds[0]]: 1,
        [superEnergy.itemIds[1]]: 1,
        [superEnergy.itemIds[2]]: 1,
        [superEnergy.itemIds[3]]: 1,
      }),
      50
    );

    const cappedByDose = byDoseMap.bankedItems.find((item) => item.item.name === "SUPER_ENERGY");

    expect(cappedByDose?.qty).toBe(10);
    expect(cappedByDose?.selectedActivity).toBeNull();
  });

  it("rebuilds linked maps and consolidates cascaded totals", () => {
    const source = makeBankedItem(
      EXPERIENCE_ITEMS.GRIMY_GUAM_LEAF,
      2,
      makeActivity({
        name: "DEGRIME_GUAM",
        displayName: "Degrime guam",
        experienceItem: "GRIMY_GUAM_LEAF",
        skill: "herblore",
        secondaries: "DEGRIME",
        output: { id: EXPERIENCE_ITEMS.GUAM_LEAF.itemID, qty: 2 },
        linkedItem: "GUAM_LEAF",
      })
    );
    const intermediate = makeBankedItem(
      EXPERIENCE_ITEMS.GUAM_LEAF,
      3,
      makeActivity({
        name: "GUAM_POTION_UNF",
        displayName: "Unfinished potion",
        experienceItem: "GUAM_LEAF",
        skill: "herblore",
        secondaries: "UNFINISHED_POTION",
        output: { id: EXPERIENCE_ITEMS.GUAM_POTION_UNF.itemID, qty: 3 },
        linkedItem: "GUAM_POTION_UNF",
      })
    );
    const goal = makeBankedItem(
      EXPERIENCE_ITEMS.GUAM_POTION_UNF,
      1,
      makeActivity({
        name: "ATTACK_POTION",
        displayName: "Attack potion",
        experienceItem: "GUAM_POTION_UNF",
        skill: "herblore",
        xp: 25,
        secondaries: "ATTACK_POTION",
        output: { id: 121, qty: 1 },
      })
    );
    const ignoredSource = makeBankedItem(
      EXPERIENCE_ITEMS.MARRENTILL,
      10,
      makeActivity({
        name: "IGNORED_SOURCE",
        displayName: "Ignored source",
        experienceItem: "MARRENTILL",
        skill: "herblore",
        output: { id: EXPERIENCE_ITEMS.GUAM_POTION_UNF.itemID, qty: 5 },
        linkedItem: "GUAM_POTION_UNF",
      }),
      true
    );
    const noLink = makeBankedItem(EXPERIENCE_ITEMS.LOGS, 4, null);
    const bankedItems = [source, intermediate, goal, ignoredSource, noLink];

    const linkedMap = rebuildLinkedMap(bankedItems);

    expect(linkedMap.get("GUAM_LEAF")).toEqual([source]);
    expect(linkedMap.get("GUAM_POTION_UNF")).toEqual([intermediate, ignoredSource]);
    expect(linkedMap.has("ATTACK_POTION")).toBe(false);
    expect(getItemQty(source, linkedMap, bankedItems, true)).toBe(2);
    expect(getItemQty(goal, linkedMap, bankedItems, false)).toBe(1);
    expect(getItemQty(goal, linkedMap, bankedItems, true)).toBe(22);
    expect(getItemQty({ ...goal, ignored: true }, linkedMap, bankedItems, true)).toBe(1);
  });

  it("calculates banked xp totals with cascade, skips, and multipliers", () => {
    const source = makeBankedItem(
      EXPERIENCE_ITEMS.GUAM_LEAF,
      2,
      makeActivity({
        name: "GUAM_POTION_UNF",
        displayName: "Unfinished potion",
        experienceItem: "GUAM_LEAF",
        skill: "herblore",
        xp: 0,
        secondaries: "UNFINISHED_POTION",
        output: { id: EXPERIENCE_ITEMS.GUAM_POTION_UNF.itemID, qty: 1 },
        linkedItem: "GUAM_POTION_UNF",
      })
    );
    const goal = makeBankedItem(
      EXPERIENCE_ITEMS.GUAM_POTION_UNF,
      1,
      makeActivity({
        name: "ATTACK_POTION",
        displayName: "Attack potion",
        experienceItem: "GUAM_POTION_UNF",
        skill: "herblore",
        xp: 10,
        secondaries: "ATTACK_POTION",
      })
    );
    const ignored = makeBankedItem(
      EXPERIENCE_ITEMS.MARRENTILL_POTION_UNF,
      5,
      makeActivity({
        name: "ANTIPOISON",
        displayName: "Antipoison",
        experienceItem: "MARRENTILL_POTION_UNF",
        skill: "herblore",
        xp: 50,
        secondaries: "ANTIPOISON",
      }),
      true
    );
    const noActivity = makeBankedItem(EXPERIENCE_ITEMS.LOGS, 6, null);
    const linkedMap = rebuildLinkedMap([source, goal, ignored, noActivity]);
    const modifiers = [
      {
        skill: "herblore",
        type: "static",
        multiplier: 2,
        included: [],
        ignored: [],
      } as EnabledModifier,
    ];

    expect(calculateBankedXpTotal([source, goal, ignored, noActivity], linkedMap, modifiers, 2, false)).toBe(40);
    expect(calculateBankedXpTotal([source, goal, ignored, noActivity], linkedMap, modifiers, 2, true)).toBe(120);
  });

  it("calculates secondaries for standard, degrime, by-dose, and crushable activities", () => {
    const grimy = makeBankedItem(
      EXPERIENCE_ITEMS.GRIMY_GUAM_LEAF,
      28,
      makeActivity({
        name: "DEGRIME_GUAM",
        displayName: "Degrime guam",
        experienceItem: "GRIMY_GUAM_LEAF",
        skill: "herblore",
        secondaries: "DEGRIME",
        output: { id: EXPERIENCE_ITEMS.GUAM_LEAF.itemID, qty: 1 },
        linkedItem: "GUAM_LEAF",
      })
    );
    const clean = makeBankedItem(
      EXPERIENCE_ITEMS.GUAM_LEAF,
      1,
      makeActivity({
        name: "GUAM_POTION_UNF",
        displayName: "Unfinished potion",
        experienceItem: "GUAM_LEAF",
        skill: "herblore",
        secondaries: "UNFINISHED_POTION",
        output: { id: EXPERIENCE_ITEMS.GUAM_POTION_UNF.itemID, qty: 1 },
        linkedItem: "GUAM_POTION_UNF",
      })
    );
    const amylase = makeBankedItem(
      EXPERIENCE_ITEMS.AMYLASE_CRYSTAL,
      5,
      makeActivity({
        name: "STAMINA_POTION",
        displayName: "Stamina potion",
        experienceItem: "AMYLASE_CRYSTAL",
        skill: "herblore",
        secondaries: "STAMINA_POTION",
        output: { id: 12631, qty: 1 },
        linkedItem: "EXTENDED_STAMINA_POTION",
      })
    );
    const crushable = makeBankedItem(
      EXPERIENCE_ITEMS.MARRENTILL_POTION_UNF,
      4,
      makeActivity({
        name: "ANTIPOISON",
        displayName: "Antipoison",
        experienceItem: "MARRENTILL_POTION_UNF",
        skill: "herblore",
        secondaries: "ANTIPOISON",
        output: { id: 175, qty: 1 },
      })
    );
    const unknownSecondary = makeBankedItem(
      EXPERIENCE_ITEMS.LOGS,
      9,
      makeActivity({
        name: "UNKNOWN_SECONDARY",
        displayName: "Unknown secondary",
        experienceItem: "LOGS",
        skill: "construction",
        secondaries: "NOT_REAL",
      })
    );
    const noSecondary = makeBankedItem(
      EXPERIENCE_ITEMS.OAK_LOGS,
      3,
      makeActivity({
        name: "NO_SECONDARY",
        displayName: "No secondary",
        experienceItem: "OAK_LOGS",
        skill: "construction",
        secondaries: null,
      })
    );
    const ignored = makeBankedItem(
      EXPERIENCE_ITEMS.GUAM_POTION_UNF,
      2,
      makeActivity({
        name: "ATTACK_POTION",
        displayName: "Attack potion",
        experienceItem: "GUAM_POTION_UNF",
        skill: "herblore",
        secondaries: "ATTACK_POTION",
      }),
      true
    );
    const bankedItems = [grimy, clean, amylase, crushable, unknownSecondary, noSecondary, ignored];
    const linkedMap = rebuildLinkedMap(bankedItems);

    const secondaries = calculateSecondaries(bankedItems, linkedMap, true);

    expect(secondaries.get(561)).toEqual({ id: 561, qty: 4 });
    expect(secondaries.get(227)).toEqual({ id: 227, qty: 29 });
    expect(secondaries.get(3022)).toEqual({ id: 3022, qty: 5 });
    expect(secondaries.get(235)).toEqual({ id: 235, qty: 4 });
    expect(secondaries.size).toBe(4);
  });
});