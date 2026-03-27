import {
  EXPERIENCE_ITEMS,
  ACTIVITIES,
  SECONDARIES,
  MODIFIERS,
  BANKABLE_SKILLS,
  getLevelForXp,
  getActivitiesForItem,
  getExperienceItemsForSkill,
} from "./banked-xp-data.js";

function round2(value) {
  return Math.round(value * 100) / 100;
}

/**
 * Gets the total quantity of an item across all group members.
 * @param {number} itemId
 * @param {Map} members - groupData.members
 * @returns {number}
 */
function getItemQtyFromBank(itemId, members) {
  let total = 0;
  for (const member of members.values()) {
    total += member.totalItemQuantity(itemId);
  }
  return total;
}

/**
 * Calculate XP rate for an activity given active modifiers.
 * Ports Activity.getXpRate(Collection<Modifier>) from Java.
 */
export function getActivityXpRate(activity, enabledModifiers) {
  let tempXp = activity.xp;
  let savePercentage = 0;
  let savePercentageMultiplicative = 1;

  for (const modifier of enabledModifiers) {
    if (!modifierAppliesTo(modifier, activity)) continue;

    if (modifier.type === "consumption") {
      // Additive consumption modifier
      savePercentage += modifier.savePercentage;
      tempXp += activity.xp * modifier.multiplier - activity.xp;
    } else if (modifier.type === "skillingOutfit") {
      // Skilling outfit: multiplicative save, additive XP bonus per piece
      const bonusMultiplier = calculateOutfitBonusXPMultiplier(modifier);
      const outfitSave = calculateOutfitSavePercentage(modifier);
      if (outfitSave > 0) {
        // Multiplicative stacking (like Zealot's robes)
        savePercentageMultiplicative *= 1 - outfitSave;
      }
      tempXp += activity.xp * bonusMultiplier - activity.xp;
    } else if (modifier.type === "static") {
      tempXp += activity.xp * modifier.multiplier - activity.xp;
    }
  }

  if (savePercentage !== 0 || savePercentageMultiplicative !== 1) {
    const consumptionChance = (1 - savePercentage) * savePercentageMultiplicative;
    if (consumptionChance > 0) {
      tempXp = tempXp / consumptionChance;
    }
  }

  return round2(tempXp);
}

function modifierAppliesTo(modifier, activity) {
  if (modifier.skill !== activity.skill) return false;
  if (modifier.ignored.length > 0 && modifier.ignored.includes(activity.experienceItem)) return false;
  if (modifier.included.length > 0) return modifier.included.includes(activity.experienceItem);
  return true;
}

function calculateOutfitBonusXPMultiplier(modifier) {
  if (!modifier._enabledPieces) return 1;
  const pieces = modifier._enabledPieces;
  const count = pieces.filter(Boolean).length;
  if (count === 0) return 1;

  // Standard outfit: helm 0.4%, top 0.8%, bottom 0.6%, boots 0.2% + 0.5% set bonus
  const pieceBonus = [0.004, 0.008, 0.006, 0.002];
  let bonus = 0;
  for (let i = 0; i < 4; i++) {
    if (pieces[i]) bonus += pieceBonus[i];
  }
  if (count === 4) bonus += 0.005; // set bonus

  // Check if this is a Zealot's robe (prayer - no XP bonus, only consumption save)
  if (modifier.baseBonus && modifier.baseBonus > 0.01) {
    // Zealot's robes: 1.25% save per piece, no XP bonus
    return 1;
  }

  return 1 + bonus;
}

function calculateOutfitSavePercentage(modifier) {
  if (!modifier._enabledPieces) return 0;
  // Only Zealot's robes have save percentages via skilling outfit
  if (!modifier.baseBonus || modifier.baseBonus <= 0.01) return 0;
  const count = modifier._enabledPieces.filter(Boolean).length;
  return modifier.baseBonus * count;
}

/**
 * Recreate the banked item map for a given skill.
 * Returns { bankedItems, linkedMap }
 */
export function createBankedItemMap(skill, members, levelLimit) {
  const experienceItems = getExperienceItemsForSkill(skill);
  const bankedItems = [];
  // linkedMap: experienceItemName -> [bankedItem, ...] (items that produce this as output)
  const linkedMap = new Map();

  function getFilteredActivities(itemName) {
    const all = getActivitiesForItem(itemName);
    if (!levelLimit || levelLimit <= 0) return all;
    return all.filter((a) => a.level <= levelLimit);
  }

  // Track which experience items are linked-to by other items
  const linkedTargets = new Set();

  for (const expItem of experienceItems) {
    let qty = 0;
    for (let i = 0; i < expItem.itemIds.length; i++) {
      const multiplier = expItem.byDose ? i + 1 : 1;
      qty += getItemQtyFromBank(expItem.itemIds[i], members) * multiplier;
    }

    if (qty <= 0) continue;

    const activities = getFilteredActivities(expItem.name);
    const selectedActivity = activities.length > 0 ? activities[0] : null;

    const bankedItem = {
      item: expItem,
      qty,
      selectedActivity,
      ignored: false,
    };

    bankedItems.push(bankedItem);

    // Register linked items
    if (selectedActivity && selectedActivity.linkedItem) {
      linkedTargets.add(selectedActivity.linkedItem);
      if (!linkedMap.has(selectedActivity.linkedItem)) {
        linkedMap.set(selectedActivity.linkedItem, []);
      }
      linkedMap.get(selectedActivity.linkedItem).push(bankedItem);
    }
  }

  // Add missing linked targets (e.g. saplings produced from seeds) with qty 0
  // so cascade can flow into them
  const existingNames = new Set(bankedItems.map((bi) => bi.item.name));
  for (const targetName of linkedTargets) {
    if (existingNames.has(targetName)) continue;
    const expItem = EXPERIENCE_ITEMS[targetName];
    if (!expItem) continue;
    const activities = getFilteredActivities(targetName);
    const selectedActivity = activities.length > 0 ? activities[0] : null;
    bankedItems.push({
      item: expItem,
      qty: 0,
      selectedActivity,
      ignored: false,
    });
    // This target may itself link to another target
    if (selectedActivity && selectedActivity.linkedItem) {
      linkedTargets.add(selectedActivity.linkedItem);
      if (!linkedMap.has(selectedActivity.linkedItem)) {
        linkedMap.set(selectedActivity.linkedItem, []);
      }
      linkedMap.get(selectedActivity.linkedItem).push(bankedItems[bankedItems.length - 1]);
    }
  }

  return { bankedItems, linkedMap };
}

/**
 * Update linked map when an activity changes
 */
export function rebuildLinkedMap(bankedItems) {
  const linkedMap = new Map();
  for (const bi of bankedItems) {
    if (bi.selectedActivity && bi.selectedActivity.linkedItem) {
      if (!linkedMap.has(bi.selectedActivity.linkedItem)) {
        linkedMap.set(bi.selectedActivity.linkedItem, []);
      }
      linkedMap.get(bi.selectedActivity.linkedItem).push(bi);
    }
  }
  return linkedMap;
}

/**
 * Get the effective item quantity including cascaded linked items.
 * Ports BankedCalculator.getItemQty().
 */
export function getItemQty(bankedItem, linkedMap, bankedItems, cascadeEnabled) {
  let qty = bankedItem.qty;
  if (!cascadeEnabled) return qty;
  // Don't cascade into ignored items
  if (bankedItem.ignored) return qty;

  const linked = createLinksMap(bankedItem, linkedMap, bankedItems, new Set());
  const cascadeTotal = getConsolidatedTotal(linked, bankedItem.item, bankedItems);
  return qty + cascadeTotal;
}

/**
 * Walk backwards through linked items to find all sources.
 * Returns Map<experienceItemName, bankQty>
 */
function createLinksMap(bankedItem, linkedMap, bankedItems, visited) {
  const result = new Map();
  const sources = linkedMap.get(bankedItem.item.name);
  if (!sources) return result;

  for (const source of sources) {
    if (source.ignored) continue;
    if (visited.has(source.item.name)) continue;
    visited.add(source.item.name);

    result.set(source.item.name, source.qty);

    // Recurse
    const subLinks = createLinksMap(source, linkedMap, bankedItems, visited);
    for (const [name, subQty] of subLinks) {
      result.set(name, (result.get(name) || 0) + subQty);
    }
  }

  return result;
}

/**
 * Walk forward from linked sources toward goalItem, multiplying by output qtys.
 */
function getConsolidatedTotal(linked, goalItem, bankedItems) {
  let total = 0;

  for (const [sourceName, sourceQty] of linked) {
    let subTotal = sourceQty;

    // Walk the chain from source toward goal
    let currentName = sourceName;
    while (currentName !== goalItem.name) {
      const sourceBankedItem = bankedItems.find((bi) => bi.item.name === currentName);
      if (!sourceBankedItem || !sourceBankedItem.selectedActivity) break;

      const activity = sourceBankedItem.selectedActivity;
      const outputQty = activity.output ? activity.output.qty : 1;
      subTotal *= outputQty;

      if (!activity.linkedItem) break;
      // Find the next item in the chain
      const nextItem = EXPERIENCE_ITEMS[activity.linkedItem];
      if (!nextItem) break;
      currentName = nextItem.name;
    }

    if (currentName === goalItem.name) {
      total += subTotal;
    }
  }

  return Math.floor(total);
}

/**
 * Calculate total banked XP for a skill.
 */
export function calculateBankedXpTotal(bankedItems, linkedMap, enabledModifiers, xpMultiplier, cascadeEnabled) {
  let total = 0;
  for (const bi of bankedItems) {
    if (bi.ignored) continue;
    if (!bi.selectedActivity) continue;

    const qty = getItemQty(bi, linkedMap, bankedItems, cascadeEnabled);
    const xpRate = getActivityXpRate(bi.selectedActivity, enabledModifiers) * xpMultiplier;
    total += qty * xpRate;
  }
  return total;
}

/**
 * Calculate secondaries needed for all non-ignored items.
 * Returns Map<itemId, { name, qty, icon }>
 */
export function calculateSecondaries(bankedItems, linkedMap, cascadeEnabled) {
  const needed = new Map();

  for (const bi of bankedItems) {
    if (bi.ignored) continue;
    if (!bi.selectedActivity) continue;
    if (!bi.selectedActivity.secondaries) continue;

    const secondary = SECONDARIES[bi.selectedActivity.secondaries];
    if (!secondary) continue;

    const qty = getItemQty(bi, linkedMap, bankedItems, cascadeEnabled);

    if (secondary.type === "degrime") {
      // Degrime: ceil(qty/27) * 2 nature runes
      const natureRuneId = 561;
      const natureQty = Math.ceil(qty / 27) * 2;
      const existing = needed.get(natureRuneId) || { id: natureRuneId, qty: 0 };
      existing.qty += natureQty;
      needed.set(natureRuneId, existing);
    } else if (secondary.type === "byDose") {
      // By-dose secondary: need qty doses worth
      if (secondary.doseItemIds && secondary.doseItemIds.length > 0) {
        const primaryId = secondary.doseItemIds[0];
        const existing = needed.get(primaryId) || { id: primaryId, qty: 0 };
        existing.qty += qty;
        needed.set(primaryId, existing);
      }
    } else if (secondary.type === "crushable") {
      // Crushable: count whole + crushed as available
      if (secondary.items) {
        for (const item of secondary.items) {
          const existing = needed.get(item.id) || { id: item.id, qty: 0 };
          existing.qty += qty * (item.qty || 1);
          needed.set(item.id, existing);
        }
      }
    } else {
      // Standard
      if (secondary.items) {
        for (const item of secondary.items) {
          if (item.qty <= 0) continue;
          const existing = needed.get(item.id) || { id: item.id, qty: 0 };
          existing.qty += qty * item.qty;
          needed.set(item.id, existing);
        }
      }
    }
  }

  return needed;
}

export {
  BANKABLE_SKILLS,
  EXPERIENCE_ITEMS,
  ACTIVITIES,
  SECONDARIES,
  MODIFIERS,
  getLevelForXp,
  getActivitiesForItem,
  getExperienceItemsForSkill,
};
