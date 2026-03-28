import { Quest, QuestState } from "./quest";
import { Item } from "./item";
import { Skill, SkillName } from "./skill";
import { pubsub } from "./pubsub";
import { utility } from "../utility";
import { AchievementDiary } from "./diaries";

type InventoryName = "bank" | "inventory" | "equipment" | "runePouch" | "seedVault";

type ItemQuantities = Record<InventoryName, Map<number, number>>;

type ItemPayloadLike = {
  id: number | string;
  quantity: number;
};

type InteractingData = {
  name: string;
  location?: unknown;
} & Record<string, unknown>;

type MemberUpdatePayload = {
  stats?: unknown;
  last_updated?: string | number | Date;
  coordinates?: unknown;
  quests?: Record<string, (typeof QuestState)[keyof typeof QuestState]>;
  skills?: Record<string, number>;
  inventory?: ItemPayloadLike[];
  equipment?: ItemPayloadLike[];
  bank?: ItemPayloadLike[];
  rune_pouch?: ItemPayloadLike[];
  interacting?: InteractingData;
  seed_vault?: ItemPayloadLike[];
  diary_vars?: number[];
  collection_log_v2?: ItemPayloadLike[];
};

const playerColors = [
  "hsl(41, 100%, 40%)", // yellow
  "hsl(151, 69%, 26%)", // green
  "hsl(210, 50%, 40%)", // blue
  "hsl(355, 76%, 36%)", // red
  "hsl(288, 65%, 19%)", // purple
];
let currentColor = 0;

export class MemberData {
  name: string;
  itemQuantities: ItemQuantities;
  inactive: boolean;
  color: string;
  hue: string;
  stats?: unknown;
  lastUpdated?: Date;
  coordinates?: unknown;
  quests: Record<string, Quest>;
  skills?: Record<string, Skill>;
  inventory?: Item[];
  equipment?: Item[];
  bank?: Item[];
  runePouch?: Item[];
  interacting?: InteractingData;
  seedVault?: Item[];
  diaries?: Record<string, Record<string, boolean[]>>;
  collectionLog?: Item[];
  combatLevel?: number;

  constructor(name: string) {
    this.name = name;
    this.itemQuantities = {
      bank: new Map(),
      inventory: new Map(),
      equipment: new Map(),
      runePouch: new Map(),
      seedVault: new Map(),
    };
    this.inactive = false;
    this.quests = {};

    this.color = playerColors[currentColor];
    currentColor = (currentColor + 1) % playerColors.length;
    // Store the hue for player-icon
    this.hue = this.color.substring(this.color.indexOf("(") + 1, this.color.indexOf(","));
  }

  update(memberData: MemberUpdatePayload): Set<string> {
    const updatedAttributes = new Set<string>();

    if (memberData.stats) {
      this.stats = memberData.stats;
      this.publishUpdate("stats");
      updatedAttributes.add("stats");
    }

    if (memberData.last_updated) {
      this.lastUpdated = new Date(memberData.last_updated);
      const timeSinceLastUpdated = utility.timeSinceLastUpdate(memberData.last_updated);
      let wasInactive = this.inactive;

      this.inactive = !isNaN(timeSinceLastUpdated) && timeSinceLastUpdated > 300 * 1000;

      if (!wasInactive && this.inactive) {
        this.publishUpdate("inactive");
      } else if (wasInactive && !this.inactive) {
        this.publishUpdate("active");
      }
    }

    if (memberData.coordinates) {
      this.coordinates = memberData.coordinates;
      pubsub.publish("coordinates", this);
      updatedAttributes.add("coordinates");
    }

    if (memberData.quests) {
      this.quests = Quest.parseQuestData(memberData.quests);
      this.publishUpdate("quests");
      updatedAttributes.add("quests");
    }

    if (memberData.skills) {
      const previousSkills = this.skills;
      this.skills = Skill.parseSkillData(memberData.skills);
      this.publishUpdate("skills");
      updatedAttributes.add("skills");

      this.computeXpDrops(previousSkills);
      this.computeCombatLevel();
    }

    if (memberData.inventory) {
      this.inventory = Item.parseItemData(memberData.inventory);
      this.updateItemQuantitiesIn("inventory");
      this.publishUpdate("inventory");
      updatedAttributes.add("inventory");
    }

    if (memberData.equipment) {
      this.equipment = Item.parseItemData(memberData.equipment);
      this.updateItemQuantitiesIn("equipment");
      this.publishUpdate("equipment");
      updatedAttributes.add("equipment");
    }

    if (memberData.bank) {
      this.bank = Item.parseItemData(memberData.bank);
      this.updateItemQuantitiesIn("bank");
      this.publishUpdate("bank");
      updatedAttributes.add("bank");
    }

    if (memberData.rune_pouch) {
      this.runePouch = Item.parseItemData(memberData.rune_pouch);
      this.updateItemQuantitiesIn("runePouch");
      this.publishUpdate("runePouch");
      updatedAttributes.add("runePouch");
    }

    if (memberData.interacting) {
      memberData.interacting.name = utility.removeTags(memberData.interacting.name);
      this.interacting = memberData.interacting;
      this.publishUpdate("interacting");
      updatedAttributes.add("interacting");
    }

    if (memberData.seed_vault) {
      this.seedVault = Item.parseItemData(memberData.seed_vault);
      this.updateItemQuantitiesIn("seedVault");
      this.publishUpdate("seedVault");
      updatedAttributes.add("seedVault");
    }

    if (memberData.diary_vars) {
      this.diaries = AchievementDiary.parseDiaryData(memberData.diary_vars);
      this.publishUpdate("diaries");
      updatedAttributes.add("diaries");
    }

    if (memberData.collection_log_v2) {
      this.collectionLog = Item.parseItemData(memberData.collection_log_v2);
      this.publishUpdate("collection_log_v2");
      updatedAttributes.add("collection_log_v2");
    }

    return updatedAttributes;
  }

  publishUpdate(attributeName: string): void {
    pubsub.publish(`${attributeName}:${this.name}`, (this as Record<string, unknown>)[attributeName], this);
  }

  totalItemQuantity(itemId: number): number {
    return (
      (this.itemQuantities.bank.get(itemId) || 0) +
      (this.itemQuantities.equipment.get(itemId) || 0) +
      (this.itemQuantities.inventory.get(itemId) || 0) +
      (this.itemQuantities.runePouch.get(itemId) || 0) +
      (this.itemQuantities.seedVault.get(itemId) || 0)
    );
  }

  updateItemQuantitiesIn(inventoryName: InventoryName): void {
    this.itemQuantities[inventoryName] = new Map();
    for (const item of this.itemsIn(inventoryName)) {
      const x = this.itemQuantities[inventoryName];
      x.set(item.id, (x.get(item.id) || 0) + item.quantity);
    }
  }

  *allItems(): Generator<Item> {
    const yieldedIds = new Set<number>();
    for (const item of this.itemsIn("inventory", "bank", "equipment", "runePouch", "seedVault")) {
      if (!yieldedIds.has(item.id)) {
        yieldedIds.add(item.id);
        yield item;
      }
    }
  }

  *itemsIn(...inventoryNames: InventoryName[]): Generator<Item> {
    for (const inventoryName of inventoryNames) {
      const inventory = this[inventoryName];
      if (inventory === undefined) continue;
      for (const item of inventory) {
        if (item.isValid()) yield item;
      }
    }
  }

  computeXpDrops(previousSkills?: Record<string, Skill>): void {
    if (!this.skills) {
      return;
    }

    if (!previousSkills) {
      for (const skillName of Object.values(SkillName)) {
        pubsub.publish(`${skillName}:${this.name}`, this.skills[skillName]);
      }
      return;
    }

    const xpDrops: Skill[] = [];
    for (const skillName of Object.values(SkillName)) {
      if (!this.skills[skillName] || !previousSkills[skillName]) continue;
      const xpDiff = this.skills[skillName].xp - previousSkills[skillName].xp;
      if (xpDiff > 0 && skillName !== "Overall") xpDrops.push(new Skill(skillName, xpDiff));
      if (xpDiff !== 0) pubsub.publish(`${skillName}:${this.name}`, this.skills[skillName]);
    }

    if (xpDrops.length > 0) {
      pubsub.publish(`xp:${this.name}`, xpDrops);
    }
  }

  computeCombatLevel(): void {
    if (!this.skills) {
      return;
    }

    const s = 0.325;
    const defence = Math.min(this.skills.Defence.level, 99);
    const hitpoints = Math.min(this.skills.Hitpoints.level, 99);
    const prayer = Math.min(this.skills.Prayer.level, 99);
    const attack = Math.min(this.skills.Attack.level, 99);
    const strength = Math.min(this.skills.Strength.level, 99);
    const ranged = Math.min(this.skills.Ranged.level, 99);
    const magic = Math.min(this.skills.Magic.level, 99);

    const base = (defence + hitpoints + Math.floor(prayer / 2)) / 4;
    const melee = s * (attack + strength);
    const range = s * (Math.floor(ranged / 2) + ranged);
    const mage = s * (Math.floor(magic / 2) + magic);

    const combatLevel = Math.floor(base + Math.max(melee, range, mage));

    if (combatLevel !== this.combatLevel) {
      this.combatLevel = combatLevel;
      this.publishUpdate("combatLevel");
    }
  }

  hasQuestComplete(questName: string): boolean {
    const questId = Quest.lookupByName.get(questName);

    if (!questId) {
      console.warn(`Unknown quest ${questName}`);
      return false;
    }

    const questComplete = this.quests[questId]?.state === QuestState.FINISHED;

    return questComplete;
  }
}
