import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "../data/api";
import { Item } from "../data/item";
import { pubsub } from "../data/pubsub";
import { Skill, SkillName } from "../data/skill";

describe("Item residual coverage", () => {
  beforeEach(() => {
    Item.itemDetails = {};
    Item.itemNameToId = {};
    Item.gePrices = {};
    pubsub.unpublishAll();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    pubsub.unpublishAll();
  });

  it("selects stack image ids from raw and normalized stack data", () => {
    Item.itemDetails = {
      4151: {
        id: 5000,
        name: "Abyssal whip",
        highalch: 72000,
        stacks: [
          [10, 5001],
          { count: 100, id: 5002 },
        ],
      },
    };

    expect(Item.imageUrl(4151, 1)).toBe("/icons/items/5000.webp");
    expect(Item.imageUrl(4151, 10)).toBe("/icons/items/5001.webp");
    expect(new Item(4151, 250).imageUrl).toBe("/icons/items/5002.webp");
  });

  it("falls back to degraded base items for ge price and tradeability", () => {
    Item.itemDetails = {
      100: { name: "Crystal helm", highalch: 1, isTradeable: true },
      101: { name: "Crystal helm 75", highalch: 1, isTradeable: false },
      102: { name: "Crystal helm 10", highalch: 1, isTradeable: false },
      103: { name: "Crystal helm 25", highalch: 1, isTradeable: false },
      104: { name: "Direct price item", highalch: 1, isTradeable: false },
      105: { name: "Unmapped item 75", highalch: 1, isTradeable: false },
    };
    Item.itemNameToId = {
      "crystal helm": 100,
      "direct price item": 104,
    };
    Item.gePrices = {
      100: 2500000,
      104: 999,
    };

    expect(new Item(104, 1).gePrice).toBe(999);
    expect(new Item(101, 1).gePrice).toBe(2500000);
    expect(new Item(102, 1).gePrice).toBe(0);
    expect(new Item(105, 1).gePrice).toBe(0);

    expect(new Item(101, 1).isTradeable).toBe(true);
    expect(new Item(103, 1).isTradeable).toBe(true);
    expect(new Item(102, 1).isTradeable).toBe(false);
    expect(new Item(105, 1).isTradeable).toBe(false);
  });

  it("parses payloads, skips unknown items, and loads item metadata", async () => {
    Item.itemDetails = {
      100: { name: "Known item", highalch: 50, isTradeable: true },
    };

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(
      Item.parseItemData([
        { id: "100", quantity: 3 },
        { id: 0, quantity: 99 },
        { id: "999", quantity: 1 },
      ])
    ).toEqual([
      expect.objectContaining({ id: 100, quantity: 3, visible: true }),
      expect.objectContaining({ id: 0, quantity: 0, visible: true }),
    ]);
    expect(warnSpy).toHaveBeenCalledWith("Unrecognized item id: 999");

    const publishSpy = vi.spyOn(pubsub, "publish");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        json: async () => ({
          200: { name: "Stacked item", highalch: 10, stacks: [[5, 201], { count: 50, id: 202 }] },
          201: { name: "Duplicate name", highalch: 11 },
          202: { name: "Duplicate name", highalch: 12, stacks: null },
        }),
      })) as unknown as typeof fetch
    );

    await Item.loadItems();

    expect(Item.itemDetails[200]).toEqual({
      id: 200,
      name: "Stacked item",
      highalch: 10,
      stacks: [
        { count: 5, id: 201 },
        { count: 50, id: 202 },
      ],
    });
    expect(Item.itemDetails[201]?.id).toBe(201);
    expect(Item.itemDetails[201]?.stacks).toBeNull();
    expect(Item.itemNameToId["stacked item"]).toBe(200);
    expect(Item.itemNameToId["duplicate name"]).toBe(201);
    expect(publishSpy).toHaveBeenCalledWith("item-data-loaded");
  });

  it("loads ge prices and generates random items through the helpers", async () => {
    Item.itemDetails = {
      1: { id: 1, name: "Bronze arrow", highalch: 0 },
      2: { id: 2, name: "Rune arrow", highalch: 0 },
    };

    vi.spyOn(api, "getGePrices").mockResolvedValue({
      json: async () => ({ 1: 7, 2: 188 }),
    } as Response);

    await Item.loadGePrices();
    expect(Item.gePrices).toEqual({ 1: 7, 2: 188 });

    const randomSpy = vi.spyOn(Math, "random");
    randomSpy.mockReturnValueOnce(0.74);
    expect(Item.randomItem(500)).toEqual([2, 500]);

    randomSpy.mockReturnValueOnce(0).mockReturnValueOnce(0.49999);
    expect(Item.randomItem()).toEqual([1, 50000]);

    vi.spyOn(Item, "randomItem")
      .mockReturnValueOnce([1, 12])
      .mockReturnValueOnce([2, 12]);
    expect(Item.randomItems(2, 12)).toEqual([1, 12, 2, 12]);
  });
});

describe("Skill residual coverage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns icons for each mapped skill and an empty string for unknown skills", () => {
    const iconBySkill: Record<string, string> = {
      [SkillName.Attack]: "/ui/197-0.png",
      [SkillName.Strength]: "/ui/198-0.png",
      [SkillName.Defence]: "/ui/199-0.png",
      [SkillName.Ranged]: "/ui/200-0.png",
      [SkillName.Prayer]: "/ui/201-0.png",
      [SkillName.Magic]: "/ui/202-0.png",
      [SkillName.Hitpoints]: "/ui/203-0.png",
      [SkillName.Agility]: "/ui/204-0.png",
      [SkillName.Herblore]: "/ui/205-0.png",
      [SkillName.Thieving]: "/ui/206-0.png",
      [SkillName.Crafting]: "/ui/207-0.png",
      [SkillName.Fletching]: "/ui/208-0.png",
      [SkillName.Mining]: "/ui/209-0.png",
      [SkillName.Smithing]: "/ui/210-0.png",
      [SkillName.Fishing]: "/ui/211-0.png",
      [SkillName.Cooking]: "/ui/212-0.png",
      [SkillName.Firemaking]: "/ui/213-0.png",
      [SkillName.Woodcutting]: "/ui/214-0.png",
      [SkillName.Runecraft]: "/ui/215-0.png",
      [SkillName.Slayer]: "/ui/216-0.png",
      [SkillName.Farming]: "/ui/217-0.png",
      [SkillName.Hunter]: "/ui/220-0.png",
      [SkillName.Construction]: "/ui/221-0.png",
      [SkillName.Sailing]: "/ui/228-0.png",
    };

    for (const [skillName, icon] of Object.entries(iconBySkill)) {
      expect(Skill.getIcon(skillName)).toBe(icon);
    }

    expect(new Skill(SkillName.Attack, 0).icon).toBe("/ui/197-0.png");
    expect(Skill.getIcon(SkillName.Overall)).toBe("");
    expect(Skill.getIcon("Unknown")).toBe("");
  });

  it("calculates levels, progress, xp until next level, and keeps overall at level zero", () => {
    const lowAttack = new Skill(SkillName.Attack, 82);
    const levelTwoAttack = new Skill(SkillName.Attack, 83);
    const progressingAttack = new Skill(SkillName.Attack, 128);
    const overall = new Skill(SkillName.Overall, 123456);

    expect(lowAttack.level).toBe(1);
    expect(levelTwoAttack.level).toBe(2);
    expect(progressingAttack.level).toBe(2);
    expect(progressingAttack.levelProgress).toBeCloseTo(45 / 91);
    expect(progressingAttack.xpUntilNextLevel).toBe(46);
    expect(overall.level).toBe(0);
    expect(overall.levelProgress).toBe(0);
  });

  it("parses skill payloads with provided and missing overall data", () => {
    const parsed = Skill.parseSkillData({
      Attack: 14391160,
      Strength: 83,
      "Custom Skill": 174,
      Overall: 99999999,
    });

    expect(parsed.Attack.level).toBe(100);
    expect(parsed.Strength.level).toBe(2);
    expect(parsed["Custom Skill"]?.name).toBe("Custom Skill");
    expect(parsed[SkillName.Overall].xp).toBe(99999999);
    expect(parsed[SkillName.Overall].level).toBe(104);

    const withoutOverall = Skill.parseSkillData({
      Attack: 83,
    });

    expect(withoutOverall[SkillName.Overall].xp).toBe(0);
    expect(withoutOverall[SkillName.Overall].level).toBe(2);
  });
});