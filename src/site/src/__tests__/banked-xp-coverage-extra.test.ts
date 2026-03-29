import { beforeEach, describe, expect, it, vi } from "vitest";

const groupDataMock = vi.hoisted(() => ({
  members: new Map<string, any>(),
}));

const itemDataMock = vi.hoisted(() => ({
  itemDetails: {} as Record<number, { name?: string }>,
}));

const pubsubMock = vi.hoisted(() => ({
  subscribe: vi.fn(),
  unsubscribe: vi.fn(),
  publish: vi.fn(),
}));

const tooltipManagerMock = vi.hoisted(() => ({
  showTooltip: vi.fn(),
  hideTooltip: vi.fn(),
}));

vi.mock("../data/group-data", () => ({
  groupData: groupDataMock,
}));

vi.mock("../data/item", () => ({
  Item: {
    itemDetails: itemDataMock.itemDetails,
    itemName: vi.fn((id: number) => {
      const item = itemDataMock.itemDetails[id];
      if (!item?.name) {
        throw new Error(`Missing item ${id}`);
      }
      return item.name;
    }),
    imageUrl: vi.fn((id: number) => `/icons/items/${id}.webp`),
  },
}));

vi.mock("../data/skill", () => ({
  Skill: {
    getIcon: vi.fn((skill: string) => `/skills/${skill}.webp`),
  },
  SkillName: {
    Construction: "Construction",
    Cooking: "Cooking",
    Crafting: "Crafting",
    Farming: "Farming",
    Firemaking: "Firemaking",
    Fletching: "Fletching",
    Herblore: "Herblore",
    Hunter: "Hunter",
    Prayer: "Prayer",
    Sailing: "Sailing",
    Smithing: "Smithing",
    Thieving: "Thieving",
  },
}));

vi.mock("../data/pubsub", () => ({
  pubsub: pubsubMock,
}));

vi.mock("../rs-tooltip/tooltip-manager", () => ({
  tooltipManager: tooltipManagerMock,
}));

import { BankedXpPage } from "../banked-xp-page/banked-xp-page";
import {
  calculateSecondaries,
  createBankedItemMap,
  getActivityXpRate,
  getItemQty,
  type Activity,
  type BankedItem,
  type EnabledModifier,
} from "../banked-xp-page/banked-xp-calc";
import { BANKABLE_SKILLS, EXPERIENCE_ITEMS, MODIFIERS, SECONDARIES } from "../banked-xp-page/banked-xp-data";

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

function getSubscribedHandler(topic: string): (() => void) | undefined {
  const calls = [...pubsubMock.subscribe.mock.calls].reverse();
  const match = calls.find(([name]) => name === topic);
  return match?.[1] as (() => void) | undefined;
}

describe("banked xp coverage extra calc", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    vi.clearAllMocks();
  });

  it("defaults missing modifier values instead of changing xp", () => {
    const activity = makeActivity({
      xp: 100,
      skill: "construction",
      experienceItem: "LOGS",
    });

    expect(
      getActivityXpRate(activity, [
        {
          skill: "construction",
          type: "consumption",
          included: [],
          ignored: [],
        } as EnabledModifier,
      ])
    ).toBe(100);

    expect(
      getActivityXpRate(activity, [
        {
          skill: "construction",
          type: "skillingOutfit",
          baseBonus: 0.0125,
          included: [],
          ignored: [],
        } as EnabledModifier,
      ])
    ).toBe(100);
  });

  it("keeps existing linked targets and skips level filtering when the level limit is disabled", () => {
    const unrestrictedSuperEnergy = createBankedItemMap(
      "herblore",
      makeMembers({
        [EXPERIENCE_ITEMS.SUPER_ENERGY.itemIds[0]]: 1,
        [EXPERIENCE_ITEMS.SUPER_ENERGY.itemIds[1]]: 1,
        [EXPERIENCE_ITEMS.SUPER_ENERGY.itemIds[2]]: 1,
        [EXPERIENCE_ITEMS.SUPER_ENERGY.itemIds[3]]: 1,
      }),
      0
    );

    expect(unrestrictedSuperEnergy.bankedItems.find((item) => item.item.name === "SUPER_ENERGY")?.selectedActivity).not.toBeNull();

    const guamMap = createBankedItemMap(
      "herblore",
      makeMembers({
        [EXPERIENCE_ITEMS.GUAM_LEAF.itemID]: 2,
        [EXPERIENCE_ITEMS.GUAM_POTION_UNF.itemID]: 3,
      }),
      0
    );

    const guamPotionTargets = guamMap.bankedItems.filter((item) => item.item.name === "GUAM_POTION_UNF");

    expect(guamMap.bankedItems.find((item) => item.item.name === "GUAM_LEAF")?.selectedActivity?.name).toBe("GUAM_POTION_UNF");
    expect(guamPotionTargets).toHaveLength(1);
    expect(guamPotionTargets[0]?.qty).toBe(3);
    expect(guamMap.linkedMap.get("GUAM_POTION_UNF")?.map((item) => item.item.name)).toContain("GUAM_LEAF");
  });

  it("drops broken cascade links instead of inventing extra quantity", () => {
    const sourceWithoutLink = makeBankedItem(
      EXPERIENCE_ITEMS.MARRENTILL,
      2,
      makeActivity({
        name: "NO_LINK_SOURCE",
        displayName: "No-link source",
        experienceItem: "MARRENTILL",
        skill: "herblore",
        output: null,
        linkedItem: null,
      })
    );
    const sourceWithMissingTarget = makeBankedItem(
      EXPERIENCE_ITEMS.GUAM_LEAF,
      4,
      makeActivity({
        name: "UNKNOWN_TARGET_SOURCE",
        displayName: "Unknown target source",
        experienceItem: "GUAM_LEAF",
        skill: "herblore",
        output: null,
        linkedItem: "NOT_A_REAL_ITEM",
      })
    );
    const duplicateSourceName = makeBankedItem(
      EXPERIENCE_ITEMS.GUAM_LEAF,
      99,
      makeActivity({
        name: "DUPLICATE_UNKNOWN_TARGET_SOURCE",
        displayName: "Duplicate unknown target source",
        experienceItem: "GUAM_LEAF",
        skill: "herblore",
        output: null,
        linkedItem: "NOT_A_REAL_ITEM",
      })
    );
    const sourceWithoutActivity = makeBankedItem(EXPERIENCE_ITEMS.GRIMY_GUAM_LEAF, 1, null);
    const goal = makeBankedItem(
      EXPERIENCE_ITEMS.GUAM_POTION_UNF,
      5,
      makeActivity({
        name: "ATTACK_POTION",
        displayName: "Attack potion",
        experienceItem: "GUAM_POTION_UNF",
        skill: "herblore",
        xp: 10,
      })
    );

    const linkedMap = new Map<string, BankedItem[]>([
      ["GUAM_POTION_UNF", [sourceWithoutLink, sourceWithMissingTarget, duplicateSourceName, sourceWithoutActivity]],
    ]);

    expect(getItemQty(goal, linkedMap, [sourceWithoutLink, sourceWithMissingTarget, sourceWithoutActivity, goal], true)).toBe(5);
  });

  it("skips empty by-dose and zero-quantity standard secondaries", () => {
    const secondaryMap = SECONDARIES as Record<string, any>;
    secondaryMap.TEST_EMPTY_BY_DOSE = {
      type: "byDose",
      doseItemIds: [],
    };
    secondaryMap.TEST_STANDARD_ZERO = {
      type: "standard",
      items: [
        { id: 561, qty: 0 },
        { id: 227, qty: 2 },
      ],
    };

    const secondaries = calculateSecondaries(
      [
        makeBankedItem(EXPERIENCE_ITEMS.LOGS, 8, null),
        makeBankedItem(
          EXPERIENCE_ITEMS.GUAM_LEAF,
          4,
          makeActivity({
            name: "EMPTY_BY_DOSE",
            displayName: "Empty by-dose",
            experienceItem: "GUAM_LEAF",
            skill: "herblore",
            secondaries: "TEST_EMPTY_BY_DOSE",
          })
        ),
        makeBankedItem(
          EXPERIENCE_ITEMS.GUAM_POTION_UNF,
          2,
          makeActivity({
            name: "STANDARD_ZERO_QTY",
            displayName: "Standard zero qty",
            experienceItem: "GUAM_POTION_UNF",
            skill: "herblore",
            secondaries: "TEST_STANDARD_ZERO",
          })
        ),
      ],
      new Map(),
      false
    );

    expect(secondaries.has(561)).toBe(false);
    expect(secondaries.get(227)).toEqual({ id: 227, qty: 4 });
  });
});

describe("banked xp coverage extra page", () => {
  let backingStore: Map<string, string>;

  beforeEach(() => {
    document.body.innerHTML = "";
    vi.clearAllMocks();

    backingStore = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem(key: string) {
        return backingStore.has(key) ? backingStore.get(key)! : null;
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

    Object.keys(itemDataMock.itemDetails).forEach((key) => delete itemDataMock.itemDetails[Number(key)]);
    itemDataMock.itemDetails[561] = { name: "Nature rune" };

    groupDataMock.members = new Map([
      [
        "Alice",
        {
          name: "Alice",
          skills: {
            Prayer: { xp: 5000, level: 70 },
          },
          totalItemQuantity: () => 0,
        },
      ],
      [
        "Bob",
        {
          name: "Bob",
          skills: {
            Prayer: { xp: 6000, level: 75 },
          },
          totalItemQuantity: () => 0,
        },
      ],
      [
        "@SHARED",
        {
          name: "@SHARED",
          totalItemQuantity: () => 0,
        },
      ],
    ]);
  });

  it("runs connected and member-update skill subscriptions and cleans them up on disconnect", () => {
    const page = new BankedXpPage();
    const refreshSpy = vi.spyOn(page, "refreshData").mockImplementation(() => undefined);
    const updateSpy = vi.spyOn(page, "updateDisplay").mockImplementation(() => undefined);
    vi.spyOn(page, "render").mockImplementation(() => {
      page.innerHTML = "";
    });

    document.body.appendChild(page);

    const aliceHandler = getSubscribedHandler("skills:Alice");
    expect(aliceHandler).toBeDefined();

    const refreshAfterConnect = refreshSpy.mock.calls.length;
    const updateAfterConnect = updateSpy.mock.calls.length;
    aliceHandler?.();

    expect(refreshSpy.mock.calls.length).toBe(refreshAfterConnect + 1);
    expect(updateSpy.mock.calls.length).toBe(updateAfterConnect + 1);

    groupDataMock.members.set("Charlie", {
      name: "Charlie",
      skills: {
        Prayer: { xp: 7000, level: 80 },
      },
      totalItemQuantity: () => 0,
    });

    page.selectedMember = "@SHARED";
    page.handleMembersUpdated();

    const charlieHandler = getSubscribedHandler("skills:Charlie");
    expect(charlieHandler).toBeDefined();

    const refreshAfterMembersUpdate = refreshSpy.mock.calls.length;
    const updateAfterMembersUpdate = updateSpy.mock.calls.length;
    charlieHandler?.();

    expect(refreshSpy.mock.calls.length).toBe(refreshAfterMembersUpdate + 1);
    expect(updateSpy.mock.calls.length).toBe(updateAfterMembersUpdate + 1);

    page.disconnectedCallback();

    expect(pubsubMock.unsubscribe).toHaveBeenCalledWith("members-updated", expect.any(Function));
    expect(pubsubMock.unsubscribe).toHaveBeenCalledWith("items-updated", expect.any(Function));
    expect(pubsubMock.unsubscribe).toHaveBeenCalledWith("skills:Alice", expect.any(Function));
    expect(pubsubMock.unsubscribe).toHaveBeenCalledWith("skills:Charlie", expect.any(Function));
  });

  it("renders active skill tabs, outfit piece images, and secondary icons from real data", () => {
    const page = new BankedXpPage();
    page.selectedSkill = "prayer";

    const prayerModifiers = MODIFIERS.filter((modifier) => modifier.skill === "prayer");
    const zealotIndex = prayerModifiers.findIndex((modifier) => modifier.name === "Zealot's Robes (Per Piece)");
    page.modifierStates[`prayer_${zealotIndex}`] = { pieces: [true, false, true, false] };

    const tabsHtml = page.renderSkillTabs();
    expect(BANKABLE_SKILLS).toContain("prayer");
    expect(tabsHtml).toContain('class="banked-xp__skill-tab active" data-skill="prayer"');
    expect(tabsHtml).toContain("/skills/Prayer.webp");

    const modifiersHtml = page.renderModifiers();
    expect(modifiersHtml).toContain("/icons/items/25438.webp");
    expect(modifiersHtml).toContain("/icons/items/25436.webp");

    page.bankedItems = [
      makeBankedItem(
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
      ),
    ];
    page.linkedMap = new Map();

    const secondariesHtml = page.renderSecondaries();
    expect(secondariesHtml).toContain("Nature rune");
    expect(secondariesHtml).toContain("/icons/items/561.webp");
    expect(secondariesHtml).toContain("x4");
  });
});