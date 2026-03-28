import { pubsub } from "./pubsub";
import { MemberData } from "./member-data";
import { Item } from "./item";
import { SkillName } from "./skill";
import { QuestState, Quest } from "./quest";
import { utility } from "../utility";

type GroupedItemRecord = {
  id: number;
  name: string;
  quantity: number;
  quantities: Record<string, number>;
  visible: boolean;
  isTradeable: boolean | null;
  variantIds: number[];
  isGrouped: true;
  highAlch: number;
  gePrice: number;
  imageUrl: string;
  wikiLink: string;
};
type BasicGroupItemRecord = {
  id: number;
  name: string;
  quantity: number;
  visible: boolean;
  quantities?: Record<string, number>;
  isTradeable: boolean | null;
  highAlch: number;
  gePrice: number;
  imageUrl: string;
  wikiLink: string;
};

type GroupItemRecord = BasicGroupItemRecord | GroupedItemRecord;

type MemberRecord = {
  name: string;
  inventory?: number[] | Array<{ id: number; quantity: number }>;
  bank?: number[] | Array<{ id: number; quantity: number }>;
  equipment?: number[] | Array<{ id: number; quantity: number }>;
  rune_pouch?: number[] | Array<{ id: number; quantity: number }>;
  seed_vault?: number[] | Array<{ id: number; quantity: number }>;
  skills?: number[] | Record<string, number>;
  stats?: number[] | Record<string, unknown>;
  coordinates?: number[] | { x: number; y: number; plane: number };
  quests?: number[] | Record<number, string>;
  collection_log_v2?: number[] | Array<{ id: number; quantity: number }>;
  interacting?: {
    location?: { x: number; y: number; plane: number };
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

type NormalizedMemberRecord = { name: string } & Parameters<MemberData["update"]>[0];

function isStoredItemArray(
  value: number[] | Array<{ id: number; quantity: number }> | undefined
): value is number[] {
  return Array.isArray(value) && (value.length === 0 || typeof value[0] === "number");
}

export class GroupData {
  static DEGRADED_CHARGES: Set<number>;
  members: Map<string, MemberData>;
  groupItems: Record<number, GroupItemRecord>;
  textFilter: string;
  textFilters: string[];
  playerFilter: string;
  hideUntradeables: boolean;

  constructor() {
    this.members = new Map();
    this.groupItems = {};
    this.textFilter = "";
    this.textFilters = [""];
    this.playerFilter = "@ALL";
    this.hideUntradeables = false;
  }

  static getDegradedBaseName(itemName: string) {
    const match = itemName.match(/^(.+)\s+(\d+)$/);
    if (match && GroupData.DEGRADED_CHARGES.has(parseInt(match[2]))) {
      return match[1];
    }
    return null;
  }

  getDisplayItems() {
    const visibleItems = Object.values(this.groupItems).filter((item) => item.visible);

    const degradedGroups = new Map<string, GroupItemRecord[]>();
    const result: GroupItemRecord[] = [];

    for (const item of visibleItems) {
      const baseName = GroupData.getDegradedBaseName(item.name);
      if (baseName) {
        if (!degradedGroups.has(baseName)) {
          degradedGroups.set(baseName, []);
        }
        degradedGroups.get(baseName)?.push(item);
      } else {
        result.push(item);
      }
    }

    for (const [baseName, variants] of degradedGroups) {
      if (variants.length === 1) {
        const variant = variants[0];
        if (variant) {
          result.push(variant);
        }
      } else {
        result.push(GroupData.createGroupedItem(baseName, variants));
      }
    }

    return result;
  }

  static createGroupedItem(baseName: string, variants: GroupItemRecord[]): GroupedItemRecord {
    variants.sort((a, b) => {
      const chargeA = parseInt(a.name.match(/(\d+)$/)?.[1] ?? "0");
      const chargeB = parseInt(b.name.match(/(\d+)$/)?.[1] ?? "0");
      return chargeB - chargeA;
    });

    const primaryVariant = variants[0]!;

    let totalQuantity = 0;
    const combinedQuantities: Record<string, number> = {};

    for (const variant of variants) {
      totalQuantity += variant.quantity;
      for (const [player, qty] of Object.entries(variant.quantities ?? {})) {
        combinedQuantities[player] = (combinedQuantities[player] || 0) + Number(qty || 0);
      }
    }

    const baseId = Item.itemNameToId?.[baseName.toLowerCase()];
    const baseTradeability = baseId !== undefined ? Item.itemDetails[baseId]?.isTradeable : primaryVariant.isTradeable;

    return {
      id: primaryVariant.id,
      name: baseName,
      isGrouped: true,
      isTradeable: baseTradeability === true ? true : primaryVariant.isTradeable,
      variantIds: variants.map((v) => v.id),
      quantity: totalQuantity,
      quantities: combinedQuantities,
      highAlch: primaryVariant.highAlch,
      gePrice: primaryVariant.gePrice,
      get imageUrl() {
        return primaryVariant.imageUrl;
      },
      get wikiLink() {
        return primaryVariant.wikiLink;
      },
      visible: true,
    };
  }

  update(groupData: MemberRecord[]) {
    const normalizedGroupData = this.transformFromStorage(groupData);
    normalizedGroupData.sort((a, b) => a.name.localeCompare(b.name));
    const removedMembers = new Set(this.members.keys());

    const updatedAttributes = new Set<string>();
    let lastUpdated = new Date(0);
    for (const memberData of normalizedGroupData) {
      const memberName = memberData.name;
      removedMembers.delete(memberName);
      if (!this.members.has(memberName)) {
        this.members.set(memberName, new MemberData(memberName));
      }

      const member = this.members.get(memberName);
      if (!member) {
        continue;
      }
      member.update(memberData).forEach((attribute) => updatedAttributes.add(attribute));

      if (member.lastUpdated && member.lastUpdated > lastUpdated) {
        lastUpdated = member.lastUpdated;
      }
    }

    for (const removedMember of removedMembers.values()) {
      this.members.delete(removedMember);
    }

    let anyItemUpdates = false;
    if (removedMembers.size > 0) {
      for (const groupItem of Object.values(this.groupItems)) {
        for (const removedMember of removedMembers.values()) {
          if (groupItem.quantities?.[removedMember]) {
            groupItem.quantity -= groupItem.quantities[removedMember];

            if (groupItem.quantity === 0) {
              delete this.groupItems[groupItem.id];
            } else {
              delete groupItem.quantities[removedMember];
            }
            anyItemUpdates = true;
          }
        }
      }
    }

    const receivedItemData =
      updatedAttributes.has("inventory") ||
      updatedAttributes.has("bank") ||
      updatedAttributes.has("equipment") ||
      updatedAttributes.has("runePouch") ||
      updatedAttributes.has("seedVault");

    const encounteredItemIds = new Set<number>();
    if (receivedItemData) {
      for (const item of this.allItems()) {
        encounteredItemIds.add(item.id);
        const previous = this.groupItems[item.id];
        const itemQuantities = this.itemQuantities(item.id);
        if (!this.quantitiesEqual(previous?.quantities, itemQuantities)) {
          let total = 0;
          for (const quantity of Object.values(itemQuantities)) {
            total += quantity;
          }

          let groupItem = this.groupItems[item.id];
          let applyFilter = false;
          if (!groupItem) {
            groupItem = new Item(item.id, 0) as Item & { visible: boolean; quantities?: Record<string, number> };
            applyFilter = true;
          }
          groupItem.quantity = total;
          groupItem.quantities = itemQuantities;
          this.groupItems[item.id] = groupItem;

          if (applyFilter) {
            groupItem.visible = this.shouldItemBeVisible(groupItem, this.textFilters, this.playerFilter);
          }

          pubsub.publish(`item-update:${item.id}`, groupItem);
          anyItemUpdates = true;
        }
      }

      for (const item of Object.values(this.groupItems)) {
        if (!encounteredItemIds.has(item.id)) {
          delete this.groupItems[item.id];
          anyItemUpdates = true;
        }
      }
    }

    const [lastMemberListPublished] = (pubsub.getMostRecent("members-updated") || []) as [MemberData[]?];
    const previousNames = lastMemberListPublished?.map((x) => x.name);
    const currentNames = [...this.members.values()].map((x) => x.name);
    const membersUpdated = !utility.setsEqual(new Set(currentNames), new Set(previousNames));
    if (membersUpdated) {
      pubsub.publish("members-updated", [...this.members.values()]);
    }

    if (anyItemUpdates) {
      pubsub.publish("items-updated");
    }

    return new Date(lastUpdated.getTime() + 1);
  }

  convertFilterToFilterList(filter: string): string[] {
    if (!filter.includes("|")) return [filter];
    const splitFilters = filter.split("|");
    const resultFilters: string[] = [];
    splitFilters.forEach((splitFilter) => {
      const trimmedFilter = splitFilter.trim();
      if (trimmedFilter.length !== 0) {
        resultFilters.push(trimmedFilter);
      }
    });
    return resultFilters;
  }

  isExactItem(item: GroupItemRecord, filter: string): boolean {
    const filterWord = filter.replaceAll('"', "");

    // Normal item search
    if (item.name.toLowerCase() === filterWord || item.id.toString() === filterWord) {
      return true;
    }
    return false;
  }

  passesTextFilter(item: GroupItemRecord, textFilters: string[]): boolean {
    for (const filter of textFilters) {
      // Exact search
      if (filter.startsWith('"') && filter.endsWith('"') && this.isExactItem(item, filter)) {
        return true;
        // Normal item search
      } else if (filter.length === 0 || item.name.toLowerCase().includes(filter) || item.id.toString() === filter) {
        return true;
      }
    }
    return false;
  }

  passesPlayerFilter(item: GroupItemRecord, playerFilter: string): boolean {
    const quantities = item.quantities ?? {};
    return playerFilter === "@ALL" || quantities[playerFilter] === undefined || quantities[playerFilter] > 0;
  }

  passesTradeabilityFilter(item: GroupItemRecord, hideUntradeables: boolean): boolean {
    return !hideUntradeables || item.isTradeable !== false;
  }

  shouldItemBeVisible(item: GroupItemRecord, textFilters: string[], playerFilter: string): boolean {
    if (!item || !item.quantities) return false;

    return (
      this.passesTextFilter(item, textFilters) &&
      this.passesPlayerFilter(item, playerFilter) &&
      this.passesTradeabilityFilter(item, this.hideUntradeables)
    );
  }

  applyTextFilter(textFilter: string) {
    this.textFilter = textFilter || "";
    const textFilters = this.convertFilterToFilterList(textFilter);
    this.textFilters = textFilters;
    const items = Object.values(this.groupItems);
    for (const item of items) {
      item.visible = this.shouldItemBeVisible(item, textFilters, this.playerFilter);
    }
  }

  applyPlayerFilter(playerFilter: string) {
    this.playerFilter = playerFilter;
    const items = Object.values(this.groupItems);
    for (const item of items) {
      item.visible = this.shouldItemBeVisible(item, this.textFilters, playerFilter);
    }
  }

  applyTradeabilityFilter(hideUntradeables: boolean) {
    this.hideUntradeables = hideUntradeables;
    const items = Object.values(this.groupItems);
    for (const item of items) {
      item.visible = this.shouldItemBeVisible(item, this.textFilters, this.playerFilter);
    }
  }

  itemQuantities(itemId: number): Record<string, number> {
    const result: Record<string, number> = {};
    for (const member of this.members.values()) {
      result[member.name] = member.totalItemQuantity(itemId);
    }

    return result;
  }

  inventoryQuantityForItem(itemId: number, memberName: string, inventoryType: string) {
    const member = this.members.get(memberName);
    if (!member) {
      return 0;
    }

    return member.itemQuantities[inventoryType as keyof typeof member.itemQuantities]?.get(itemId) || 0;
  }

  quantitiesEqual(a: Record<string, number> | undefined, b: Record<string, number> | undefined): boolean {
    if (!a || !b) return false;
    for (const member of this.members.values()) {
      if (a[member.name] !== b[member.name]) return false;
    }
    return true;
  }

  *allItems(): Generator<Item> {
    const yieldedIds = new Set<number>();
    for (const member of this.members.values()) {
      for (const item of member.allItems()) {
        if (!yieldedIds.has(item.id)) {
          yieldedIds.add(item.id);
          yield item;
        }
      }
    }
  }

  static transformItemsFromStorage(items: number[] | null | undefined): Array<{ id: number; quantity: number }> | undefined {
    if (items === undefined || items === null) return;

    const result: Array<{ id: number; quantity: number }> = [];
    for (let i = 0; i < items.length; i += 2) {
      result.push({
        id: items[i],
        quantity: items[i + 1],
      });
    }
    return result;
  }

  static transformSkillsFromStorage(skills: number[] | null | undefined): Record<string, number> | undefined {
    if (skills === undefined || skills === null) return;

    const result: Record<string, number> = {};
    let i = 0;
    let overall = 0;
    for (const skillName of Object.keys(SkillName)) {
      if (skillName !== SkillName.Overall) {
        const xp = skills[i] ?? 0;
        result[skillName] = xp;

        if (skillName !== SkillName.Overall) {
          overall += xp;
        }

        i += 1;
      }
    }

    result[SkillName.Overall] = overall;
    return result;
  }

  static transformStatsFromStorage(stats: number[] | null | undefined):
    | {
        hitpoints: { current: number; max: number };
        prayer: { current: number; max: number };
        energy: { current: number; max: number };
        world: number;
      }
    | undefined {
    if (stats === undefined || stats === null) return;

    return {
      hitpoints: {
        current: stats[0],
        max: stats[1],
      },
      prayer: {
        current: stats[2],
        max: stats[3],
      },
      energy: {
        current: stats[4],
        max: 10000,
      },
      world: stats[6],
    };
  }

  static transformCoordinatesFromStorage(coordinates: number[] | null | undefined): { x: number; y: number; plane: number } | undefined {
    if (coordinates === undefined || coordinates === null) return;

    // NOTE: need to offset Y for some reason
    const yOffset = 1;
    return {
      x: coordinates[0],
      y: coordinates[1] + yOffset,
      plane: coordinates[2],
    };
  }

  static transformQuestsFromStorage(quests: number[] | null | undefined): Record<number, string> | undefined {
    if (quests === undefined || quests === null) return;

    const result: Record<number, string> = {};
    const questStates = Object.values(QuestState);
    const questIds = Quest.questIds;
    for (let i = 0; i < quests.length; ++i) {
      const questState = quests[i];
      const questId = questIds[i];
      result[questId] = questStates[questState];
    }
    return result;
  }

  transformFromStorage(groupData: MemberRecord[]): NormalizedMemberRecord[] {
    for (const memberData of groupData) {
      if (isStoredItemArray(memberData.inventory)) memberData.inventory = GroupData.transformItemsFromStorage(memberData.inventory);
      if (isStoredItemArray(memberData.bank)) memberData.bank = GroupData.transformItemsFromStorage(memberData.bank);
      if (isStoredItemArray(memberData.equipment)) memberData.equipment = GroupData.transformItemsFromStorage(memberData.equipment);
      if (isStoredItemArray(memberData.rune_pouch)) memberData.rune_pouch = GroupData.transformItemsFromStorage(memberData.rune_pouch);
      if (isStoredItemArray(memberData.seed_vault)) memberData.seed_vault = GroupData.transformItemsFromStorage(memberData.seed_vault);
      if (Array.isArray(memberData.skills)) memberData.skills = GroupData.transformSkillsFromStorage(memberData.skills);
      if (Array.isArray(memberData.stats)) memberData.stats = GroupData.transformStatsFromStorage(memberData.stats);
      if (Array.isArray(memberData.coordinates)) memberData.coordinates = GroupData.transformCoordinatesFromStorage(memberData.coordinates);
      if (Array.isArray(memberData.quests)) memberData.quests = GroupData.transformQuestsFromStorage(memberData.quests);
      if (isStoredItemArray(memberData.collection_log_v2)) {
        memberData.collection_log_v2 = GroupData.transformItemsFromStorage(memberData.collection_log_v2);
      }

      if (memberData.interacting && memberData.interacting.location && typeof memberData.interacting.location === "object") {
        const location = memberData.interacting.location as { x: number; y: number; plane: number };
        memberData.interacting.location = GroupData.transformCoordinatesFromStorage([
          location.x,
          location.y,
          location.plane,
        ]);
      }
    }

    return groupData as NormalizedMemberRecord[];
  }
}

GroupData.DEGRADED_CHARGES = new Set([0, 25, 50, 75, 100]);

const groupData = new GroupData();

export { groupData };
