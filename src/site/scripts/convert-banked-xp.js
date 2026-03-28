#!/usr/bin/env node
/**
 * Parses the banked-experience plugin Java enum files + RuneLite's ItemID.java
 * and generates a single JS data module for the web banked-xp calculator.
 */
const fs = require("fs");
const path = require("path");

const PLUGIN_DATA = path.resolve(
  __dirname,
  "../../../banked-experience/src/main/java/thestonedturtle/bankedexperience/data"
);
const ITEM_ID_FILE = path.resolve(
  __dirname,
  "../../cache/runelite/runelite-api/src/main/java/net/runelite/api/gameval/ItemID.java"
);
const OUTPUT_FILE = path.resolve(__dirname, "../src/banked-xp-page/banked-xp-data.js");
const CACHE_ITEM_DATA = path.resolve(__dirname, "../../cache/dumps/2026-03-26T20-13-14-790Z/item_data.json");
const WEB_ITEM_DATA = path.resolve(__dirname, "../public/data/item_data.json");

// ──────────── 1. Parse ItemID.java ────────────
function parseItemIdFile(filePath) {
  const map = {};
  const content = fs.readFileSync(filePath, "utf8");
  const re = /public\s+static\s+final\s+int\s+(\w+)\s*=\s*(\d+)\s*;/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    map[m[1]] = parseInt(m[2]);
  }
  return map;
}

function resolveItemId(token, itemIdMap) {
  token = token.trim();
  if (/^\d+$/.test(token)) return parseInt(token);
  // ItemID.FOO → FOO
  const name = token.replace("ItemID.", "");
  if (itemIdMap[name] !== undefined) return itemIdMap[name];
  console.warn(`  [WARN] Unknown ItemID: ${token}`);
  return -1;
}

// ──────────── 2. Parse ExperienceItem.java ────────────
function parseExperienceItems(filePath, itemIdMap) {
  const content = fs.readFileSync(filePath, "utf8");
  // Extract enum body (before the first field declaration with types)
  const enumBodyMatch = content.match(/public\s+enum\s+ExperienceItem\s*\{([\s\S]*?);\s*\n\s*private\s+final/);
  if (!enumBodyMatch) throw new Error("Could not find ExperienceItem enum body");
  const enumBody = enumBodyMatch[1];

  const items = {};
  // Match each enum entry
  // Patterns:
  // NAME(ItemID.X, Skill.Y, "Category"),
  // NAME(ItemID.X, Skill.Y),
  // NAME(Skill.Y, true, ItemID.A, ItemID.B, ...),
  const entryRe = /(\w+)\s*\(([^)]+)\)\s*(?:,|$)/g;
  let m;
  while ((m = entryRe.exec(enumBody)) !== null) {
    const name = m[1];
    const argsStr = m[2].trim();
    const args = splitArgs(argsStr);

    let item;
    if (args[0].startsWith("Skill.")) {
      // byDose constructor: NAME(Skill.Y, true, ItemID.A, ItemID.B, ...)
      const skill = args[0].replace("Skill.", "").toLowerCase();
      const byDose = args[1].trim() === "true";
      const itemIds = args.slice(2).map((a) => resolveItemId(a, itemIdMap));
      item = {
        name,
        itemID: itemIds[0],
        skill,
        category: "NA",
        itemIds,
        byDose,
      };
    } else {
      // Standard: NAME(ItemID.X, Skill.Y) or NAME(ItemID.X, Skill.Y, "Category")
      const itemID = resolveItemId(args[0], itemIdMap);
      const skill = args[1].trim().replace("Skill.", "").toLowerCase();
      const category = args.length > 2 ? args[2].replace(/"/g, "").trim() : "NA";
      item = {
        name,
        itemID,
        skill,
        category,
        itemIds: [itemID],
        byDose: false,
      };
    }
    items[name] = item;
  }
  return items;
}

// ──────────── 3. Parse Secondaries.java ────────────
function parseSecondaries(filePath, itemIdMap) {
  const content = fs.readFileSync(filePath, "utf8");
  const enumBodyMatch = content.match(/public\s+enum\s+Secondaries\s*\{([\s\S]*?);\s*\n\s*private\s+final/);
  if (!enumBodyMatch) throw new Error("Could not find Secondaries enum body");
  const enumBody = enumBodyMatch[1];

  const secondaries = {};
  // Each entry is NAME(...),
  const entryRe = /(\w+)\s*\(([\s\S]*?)\)\s*(?:,|$)/g;
  let m;
  while ((m = entryRe.exec(enumBody)) !== null) {
    const name = m[1];
    const argsStr = m[2].trim();

    // Detect special types: ByDose, Degrime, Crushable
    if (argsStr.startsWith("new ByDose")) {
      const idsMatch = argsStr.match(/new\s+ByDose\s*\(([^)]+)\)/);
      if (idsMatch) {
        const ids = splitArgs(idsMatch[1]).map((a) => resolveItemId(a, itemIdMap));
        secondaries[name] = { type: "byDose", doseItemIds: ids, items: [{ id: ids[0], qty: 0 }] };
      }
    } else if (argsStr.startsWith("new Degrime")) {
      secondaries[name] = { type: "degrime", items: [] };
    } else if (argsStr.startsWith("new Crushable")) {
      const idsMatch = argsStr.match(/new\s+Crushable\s*\(([^)]+)\)/);
      if (idsMatch) {
        const ids = splitArgs(idsMatch[1]).map((a) => resolveItemId(a, itemIdMap));
        secondaries[name] = { type: "crushable", crushableItemIds: ids, items: [{ id: ids[ids.length - 1], qty: 0 }] };
      }
    } else {
      // Regular ItemStack args: new ItemStack(ItemID.X, qty), ...
      const stacks = [];
      const stackRe = /new\s+ItemStack\s*\(\s*([\w.]+)\s*,\s*([\d.]+)\s*\)/g;
      let sm;
      while ((sm = stackRe.exec(argsStr)) !== null) {
        stacks.push({ id: resolveItemId(sm[1], itemIdMap), qty: parseFloat(sm[2]) });
      }
      secondaries[name] = { type: "standard", items: stacks };
    }
  }
  return secondaries;
}

// ──────────── 4. Parse Activity.java ────────────
function parseActivities(filePath, itemIdMap, experienceItems) {
  let content = fs.readFileSync(filePath, "utf8");
  // Strip block comments (/** ... */ and /* ... */) and single-line comments
  content = content.replace(/\/\*[\s\S]*?\*\//g, "");
  content = content.replace(/\/\/[^\n]*/g, "");
  const enumBodyMatch = content.match(/public\s+enum\s+Activity\s*\{([\s\S]*?);\s*\n\s*private\s+final\s+int\s+icon/);
  if (!enumBodyMatch) throw new Error("Could not find Activity enum body");
  const enumBody = enumBodyMatch[1];

  const activities = [];
  // Multi-line entries, terminated by ),\n or );\n
  // We need a more robust parser since args span multiple lines
  const entries = splitEnumEntries(enumBody);

  for (const entry of entries) {
    const nameMatch = entry.match(/^(\w+)\s*\(/);
    if (!nameMatch) continue;
    const name = nameMatch[1];
    const argsStr = entry.slice(nameMatch[0].length, entry.lastIndexOf(")"));
    const args = splitArgs(argsStr);

    if (args.length < 6) continue; // Skip malformed

    // Determine which constructor: 7 args (no rngActivity) or 8 args (with rngActivity)
    let icon, actName, level, xp, rngActivity, expItemName, secName, outputStr;
    if (args.length === 7) {
      [icon, actName, level, xp, expItemName, secName, outputStr] = args;
      rngActivity = false;
    } else {
      [icon, actName, level, xp, rngActivity, expItemName, secName, outputStr] = args;
      rngActivity = rngActivity.trim() === "true";
    }

    const iconId = resolveItemId(icon, itemIdMap);
    const displayName = actName.replace(/"/g, "").trim();
    const lvl = parseInt(level);
    const xpVal = parseFloat(xp);
    const expItem = expItemName.trim().replace("ExperienceItem.", "");
    const sec = secName.trim() === "null" ? null : secName.trim().replace("Secondaries.", "");

    // Parse output ItemStack
    let output = null;
    const outputTrimmed = outputStr.trim();
    if (outputTrimmed !== "null") {
      const outMatch = outputTrimmed.match(/new\s+ItemStack\s*\(\s*([\w.]+)\s*,\s*([\d.]+)\s*\)/);
      if (outMatch) {
        output = { id: resolveItemId(outMatch[1], itemIdMap), qty: parseFloat(outMatch[2]) };
      }
    }

    // Determine linked item (if output item ID matches an ExperienceItem)
    let linkedItem = null;
    if (output) {
      for (const [eName, eItem] of Object.entries(experienceItems)) {
        if (eItem.itemIds.includes(output.id)) {
          linkedItem = eName;
          break;
        }
      }
    }

    // Get skill from experience item
    const expItemObj = experienceItems[expItem];
    const skill = expItemObj ? expItemObj.skill : "unknown";

    activities.push({
      name,
      icon: iconId,
      displayName,
      level: lvl,
      xp: xpVal,
      rngActivity,
      experienceItem: expItem,
      skill,
      secondaries: sec,
      output,
      linkedItem,
    });
  }
  return activities;
}

// ──────────── Helpers ────────────
function splitArgs(str) {
  const args = [];
  let depth = 0;
  let current = "";
  for (const ch of str) {
    if (ch === "(" || ch === "[" || ch === "{") depth++;
    else if (ch === ")" || ch === "]" || ch === "}") depth--;
    if (ch === "," && depth === 0) {
      args.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim()) args.push(current.trim());
  return args;
}

function splitEnumEntries(enumBody) {
  const entries = [];
  let depth = 0;
  let current = "";
  let inString = false;

  for (let i = 0; i < enumBody.length; i++) {
    const ch = enumBody[i];

    if (ch === '"' && enumBody[i - 1] !== "\\") {
      inString = !inString;
    }

    if (!inString) {
      if (ch === "(") depth++;
      else if (ch === ")") depth--;

      if (ch === "," && depth === 0) {
        if (current.trim()) entries.push(current.trim());
        current = "";
        continue;
      }
    }

    current += ch;
  }
  if (current.trim()) entries.push(current.trim());

  // Filter to only actual enum entries (start with UPPERCASE identifier followed by parenthesis)
  return entries.filter((e) => /^\w+\s*\(/.test(e));
}

// ──────────── Modifier definitions (hardcoded since they're complex) ────────────
function buildModifiers(_activities) {
  // Build name sets for bones/ashes
  const bonesNames = [
    "BONES",
    "WOLF_BONES",
    "BURNT_BONES",
    "MONKEY_BONES",
    "BAT_BONES",
    "JOGRE_BONES",
    "BIG_BONES",
    "ZOGRE_BONES",
    "SHAIKAHAN_BONES",
    "BABYDRAGON_BONES",
    "WYVERN_BONES",
    "DRAGON_BONES",
    "FAYRG_BONES",
    "LAVA_DRAGON_BONES",
    "RAURG_BONES",
    "DAGANNOTH_BONES",
    "OURG_BONES",
    "SUPERIOR_DRAGON_BONES",
    "WYRM_BONES",
    "DRAKE_BONES",
    "HYDRA_BONES",
    "FROST_DRAGON_BONES",
    "STRYKEWYRM_BONES_BURY",
  ];
  const ashesNames = ["FIENDISH_ASHES", "VILE_ASHES", "MALICIOUS_ASHES", "ABYSSAL_ASHES", "INFERNAL_ASHES"];
  const salvageNames = [
    "SORT_SMALL_SALVAGE",
    "SORT_FISHY_SALVAGE",
    "SORT_BARRACUDA_SALVAGE",
    "SORT_LARGE_SALVAGE",
    "SORT_PIRATE_SALVAGE",
    "SORT_MARTIAL_SALVAGE",
    "SORT_FREMENNIK_SALVAGE",
    "SORT_OPULENT_SALVAGE",
  ];
  const conBones = ["LONG_BONE", "CURVED_BONE"];

  return [
    {
      skill: "prayer",
      name: "Demonic Offering (300% xp)",
      type: "static",
      multiplier: 3,
      included: ashesNames,
      ignored: [],
      tooltip: "Only applies to ashes",
    },
    {
      skill: "prayer",
      name: "Sinister Offering (300% xp)",
      type: "static",
      multiplier: 3,
      included: bonesNames,
      ignored: [],
      tooltip: "Only applies to bones",
    },
    {
      skill: "prayer",
      name: "Lit Gilded Altar (350% xp)",
      type: "static",
      multiplier: 3.5,
      included: bonesNames,
      ignored: [],
      tooltip: "Only applies to bones",
    },
    {
      skill: "prayer",
      name: "Ectofuntus (400% xp)",
      type: "static",
      multiplier: 4,
      included: bonesNames,
      ignored: ["STRYKEWYRM_BONES_BURY"],
      tooltip: "Only applies to bones",
    },
    {
      skill: "prayer",
      name: "Wildy Altar (350% xp & 50% Save)",
      type: "consumption",
      multiplier: 3.5,
      savePercentage: 0.5,
      included: bonesNames,
      ignored: [],
      tooltip: "Only applies to bones",
    },
    {
      skill: "prayer",
      name: "Zealot's Robes (Per Piece)",
      type: "skillingOutfit",
      baseBonus: 0.0125,
      included: bonesNames,
      ignored: [],
    },
    { skill: "farming", name: "Farmer's Outfit", type: "skillingOutfit", baseBonus: 0.005, included: [], ignored: [] },
    {
      skill: "construction",
      name: "Carpenter's Outfit",
      type: "skillingOutfit",
      baseBonus: 0.005,
      included: [],
      ignored: conBones,
    },
    {
      skill: "firemaking",
      name: "Pyromancer Outfit",
      type: "skillingOutfit",
      baseBonus: 0.005,
      included: [],
      ignored: [],
    },
    {
      skill: "sailing",
      name: "Horizon's Lure (102.5% xp)",
      type: "static",
      multiplier: 1.025,
      included: salvageNames,
      ignored: [],
      tooltip: null,
    },
  ];
}

// ──────────── XP Table ────────────
function buildXpTable() {
  const table = [0];
  for (let level = 1; level <= 126; level++) {
    let total = 0;
    for (let l = 1; l < level; l++) {
      total += Math.floor(l + 300 * Math.pow(2, l / 7));
    }
    table.push(Math.floor(total / 4));
  }
  return table;
}

// ──────────── MAIN ────────────
console.log("Parsing ItemID.java...");
const itemIdMap = parseItemIdFile(ITEM_ID_FILE);
console.log(`  Found ${Object.keys(itemIdMap).length} item IDs`);

console.log("Parsing ExperienceItem.java...");
const experienceItems = parseExperienceItems(path.join(PLUGIN_DATA, "ExperienceItem.java"), itemIdMap);
console.log(`  Found ${Object.keys(experienceItems).length} experience items`);

console.log("Parsing Secondaries.java...");
const secondaries = parseSecondaries(path.join(PLUGIN_DATA, "Secondaries.java"), itemIdMap);
console.log(`  Found ${Object.keys(secondaries).length} secondaries`);

console.log("Parsing Activity.java...");
const activities = parseActivities(path.join(PLUGIN_DATA, "Activity.java"), itemIdMap, experienceItems);
console.log(`  Found ${activities.length} activities`);

const modifiers = buildModifiers(activities);
const xpTable = buildXpTable();

// Build skill list from activities
const skills = [...new Set(activities.map((a) => a.skill))].sort();

// ──────────── Remap gameval IDs → real game IDs ────────────
console.log("Remapping gameval IDs to real game IDs...");
const cacheItemData = JSON.parse(fs.readFileSync(CACHE_ITEM_DATA, "utf8"));
const webItemData = JSON.parse(fs.readFileSync(WEB_ITEM_DATA, "utf8"));

// Build name→realId from web item_data (keep lowest ID per name)
const nameToRealId = {};
for (const [id, info] of Object.entries(webItemData)) {
  const lower = info.name.toLowerCase();
  const realId = parseInt(id);
  if (!nameToRealId[lower] || realId < nameToRealId[lower]) {
    nameToRealId[lower] = realId;
  }
}

// Build gameval→realId using cache dump as bridge
const gamevalToReal = {};
for (const [gvId, info] of Object.entries(cacheItemData)) {
  const lower = info.name.toLowerCase();
  const realId = nameToRealId[lower];
  if (realId !== undefined) {
    gamevalToReal[parseInt(gvId)] = realId;
  }
}

function remapId(gvId) {
  if (webItemData[gvId]) return gvId; // already a real ID
  const mapped = gamevalToReal[gvId];
  if (mapped !== undefined) return mapped;
  // Try to find by name in cache dump
  const info = cacheItemData[gvId];
  if (info) {
    const realId = nameToRealId[info.name.toLowerCase()];
    if (realId !== undefined) return realId;
  }
  return gvId; // unmapped, keep as-is
}

let remappedCount = 0;
for (const item of Object.values(experienceItems)) {
  const oldId = item.itemID;
  item.itemID = remapId(item.itemID);
  item.itemIds = item.itemIds.map((id) => remapId(id));
  if (item.itemID !== oldId) remappedCount++;
}

for (const act of activities) {
  act.icon = remapId(act.icon);
  if (act.output) act.output.id = remapId(act.output.id);
}

for (const sec of Object.values(secondaries)) {
  if (sec.items) sec.items = sec.items.map((i) => ({ ...i, id: remapId(i.id) }));
  if (sec.doseItemIds) sec.doseItemIds = sec.doseItemIds.map((id) => remapId(id));
  if (sec.crushableItemIds) sec.crushableItemIds = sec.crushableItemIds.map((id) => remapId(id));
}

console.log(`  Remapped ${remappedCount} / ${Object.keys(experienceItems).length} experience item IDs`);

// Generate output
const output = `// Auto-generated from banked-experience plugin Java sources
// Do not edit manually - run scripts/convert-banked-xp.js to regenerate

export const XP_TABLE = ${JSON.stringify(xpTable)};

export const EXPERIENCE_ITEMS = ${JSON.stringify(experienceItems, null, 2)};

export const ACTIVITIES = ${JSON.stringify(activities, null, 2)};

export const SECONDARIES = ${JSON.stringify(secondaries, null, 2)};

export const MODIFIERS = ${JSON.stringify(modifiers, null, 2)};

export const BANKABLE_SKILLS = ${JSON.stringify(skills)};

// Helper: get level for XP
export function getLevelForXp(xp) {
  for (let i = XP_TABLE.length - 1; i >= 1; i--) {
    if (xp >= XP_TABLE[i]) return i;
  }
  return 1;
}

// Helper: get XP for level
export function getXpForLevel(level) {
  return XP_TABLE[Math.min(level, XP_TABLE.length - 1)] || 0;
}

// Helper: get activities for an experience item
export function getActivitiesForItem(experienceItemName) {
  return ACTIVITIES.filter((a) => a.experienceItem === experienceItemName);
}

// Helper: get experience items for a skill
export function getExperienceItemsForSkill(skill) {
  return Object.values(EXPERIENCE_ITEMS).filter((item) => item.skill === skill);
}
`;

// Ensure output directory exists
const outDir = path.dirname(OUTPUT_FILE);
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

fs.writeFileSync(OUTPUT_FILE, output, "utf8");
console.log(`\nGenerated: ${OUTPUT_FILE}`);
console.log(`  ${Object.keys(experienceItems).length} experience items`);
console.log(`  ${activities.length} activities`);
console.log(`  ${Object.keys(secondaries).length} secondaries`);
console.log(`  ${modifiers.length} modifiers`);
console.log(`  ${skills.length} skills: ${skills.join(", ")}`);
