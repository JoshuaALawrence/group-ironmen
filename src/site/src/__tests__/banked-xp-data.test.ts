import { describe, expect, it } from "vitest";
import {
  ACTIVITIES,
  BANKABLE_SKILLS,
  EXPERIENCE_ITEMS,
  MODIFIERS,
  SECONDARIES,
  XP_TABLE,
  getActivitiesForItem,
  getExperienceItemsForSkill,
  getLevelForXp,
  getXpForLevel,
} from "../banked-xp-page/banked-xp-data";

describe("banked xp data", () => {
  it("exposes the xp ladder and level lookups", () => {
    expect(XP_TABLE[1]).toBe(0);
    expect(getXpForLevel(1)).toBe(0);
    expect(getLevelForXp(0)).toBe(1);
    expect(getLevelForXp(82)).toBe(1);
    expect(getLevelForXp(83)).toBe(2);
    expect(getXpForLevel(2)).toBe(83);
    expect(getXpForLevel(126)).toBeGreaterThan(getXpForLevel(2));
  });

  it("groups experience items, activities, and modifiers by skill", () => {
    expect(BANKABLE_SKILLS).toContain("sailing");
    expect(EXPERIENCE_ITEMS.LOGS.skill).toBe("construction");
    expect(getExperienceItemsForSkill("construction").some((item) => item.name === "LOGS")).toBe(true);
    expect(getActivitiesForItem("LOGS").length).toBeGreaterThan(0);
    expect(ACTIVITIES.length).toBeGreaterThan(0);
    expect(Object.keys(SECONDARIES).length).toBeGreaterThan(0);
    expect(MODIFIERS.length).toBeGreaterThan(0);
  });
});