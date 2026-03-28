#!/usr/bin/env node
/**
 * Parses the emote-clue-items plugin Java sources + RuneLite's ItemID.java
 * and generates a JS data module for the web stash/clue tracker.
 */
const fs = require("fs");
const path = require("path");

const PLUGIN_DATA = path.resolve(
  __dirname,
  "../../../emote-clue-items/src/main/java/com/larsvansoest/runelite/clueitems/data"
);
const ITEM_ID_FILE = path.resolve(
  __dirname,
  "../../cache/runelite/runelite-api/src/main/java/net/runelite/api/gameval/ItemID.java"
);
const OUTPUT_FILE = path.resolve(__dirname, "../src/stash-page/stash-data.js");
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
  const name = token.replace("ItemID.", "");
  if (itemIdMap[name] !== undefined) return itemIdMap[name];
  console.warn(`  [WARN] Unknown ItemID: ${token}`);
  return -1;
}

// ──────────── 2. Parse StashUnit.java ────────────
function parseStashUnits(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  const units = {};
  // Match: NAME("Display Name", STASHUnit.X, Type.Y) or NAME("Display Name", "Watson", STASHUnit.X, Type.Y)
  const re = /(\w+)\s*\(\s*"([^"]+)"(?:\s*,\s*"([^"]+)")?\s*,\s*STASHUnit\.\w+\s*,\s*Type\.(\w+)\s*\)/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    units[m[1]] = {
      enumName: m[1],
      name: m[2],
      type: m[4],
    };
  }
  return units;
}

// ──────────── 3. Parse EmoteClueItem.java ────────────
function parseEmoteClueItems(filePath, itemIdMap) {
  let content = fs.readFileSync(filePath, "utf8");
  // Strip comments
  content = content.replace(/\/\*[\s\S]*?\*\//g, "");
  content = content.replace(/\/\/[^\n]*/g, "");

  // Extract enum body
  const enumBodyMatch = content.match(
    /public\s+enum\s+EmoteClueItem\s+implements\s+ItemRequirement\s*\{([\s\S]*?);\s*\n\s*private\s+final/
  );
  if (!enumBodyMatch) throw new Error("Could not find EmoteClueItem enum body");
  const enumBody = enumBodyMatch[1];

  const items = {};
  // Leaf items: NAME("display name", ItemID.X)
  const leafRe = /(\w+)\s*\(\s*"([^"]+)"\s*,\s*(ItemID\.\w+|\d+)\s*\)/g;
  let match;
  while ((match = leafRe.exec(enumBody)) !== null) {
    const name = match[1];
    const displayName = match[2];
    const itemId = resolveItemId(match[3], itemIdMap);
    items[name] = { name, displayName, itemId, children: null, isAll: false };
  }

  // Aggregate items: NAME("display name", true/false, EmoteClueItem.X, EmoteClueItem.Y, ...)
  // These span multiple lines, so we need a more careful parser
  const aggRe = /(\w+)\s*\(\s*"([^"]+)"\s*,\s*\n?\s*(true|false)\s*,\s*([\s\S]*?)\)/g;
  while ((match = aggRe.exec(enumBody)) !== null) {
    const name = match[1];
    if (items[name]) continue; // already parsed as leaf
    const displayName = match[2];
    const isAll = match[3] === "true";
    const childrenStr = match[4];
    const children = [];
    const childRe = /(?:EmoteClueItem\.)?(\w+)/g;
    let cm;
    while ((cm = childRe.exec(childrenStr)) !== null) {
      children.push(cm[1]);
    }
    items[name] = { name, displayName, itemId: null, children, isAll };
  }

  return items;
}

// ──────────── 4. Parse EmoteClue.java ────────────
function parseEmoteClues(filePath) {
  let content = fs.readFileSync(filePath, "utf8");
  // Strip comments
  content = content.replace(/\/\*[\s\S]*?\*\//g, "");
  content = content.replace(/\/\/[^\n]*/g, "");

  // Extract the CLUES set
  const cluesMatch = content.match(/CLUES\s*=\s*ImmutableSet\.of\(([\s\S]*?)\)\s*;/);
  if (!cluesMatch) throw new Error("Could not find CLUES set");
  const cluesBody = cluesMatch[1];

  // Split into individual EmoteClue constructors using proper paren matching
  const clues = [];
  const startRe = /new\s+EmoteClue\s*\(/g;
  let m;
  while ((m = startRe.exec(cluesBody)) !== null) {
    // Find matching closing paren
    let depth = 1;
    let i = m.index + m[0].length;
    let inStr = false;
    while (i < cluesBody.length && depth > 0) {
      const ch = cluesBody[i];
      if (ch === '"' && cluesBody[i - 1] !== "\\") inStr = !inStr;
      if (!inStr) {
        if (ch === "(") depth++;
        else if (ch === ")") depth--;
      }
      i++;
    }
    const argsStr = cluesBody.substring(m.index + m[0].length, i - 1);
    const clue = parseClueArgs(argsStr);
    if (clue) clues.push(clue);
  }
  return clues;
}

function parseClueArgs(argsStr) {
  // Extract difficulty
  const diffMatch = argsStr.match(/^\s*(Beginner|Easy|Medium|Hard|Elite|Master)\s*,/);
  if (!diffMatch) return null;
  const difficulty = diffMatch[1];

  // Extract text (first quoted string after difficulty)
  const textMatch = argsStr.match(/,\s*"((?:[^"\\]|\\.)*)"\s*,/);
  const text = textMatch ? textMatch[1] : "";

  // Extract location name (second quoted string)
  const allStrings = [...argsStr.matchAll(/"((?:[^"\\]|\\.)*)"/g)];
  const locationName = allStrings.length >= 2 ? allStrings[1][1] : "";

  // Extract stash unit - look for a bare identifier that matches a StashUnit enum name
  // It comes after the location string and before WorldPoint
  const stashMatch = argsStr.match(/"\s*,\s*\n?\s*(\w+)\s*,\s*\n?\s*new\s+WorldPoint/);
  let stashUnit = null;
  if (stashMatch) {
    const val = stashMatch[1].trim();
    if (val !== "null") {
      stashUnit = val;
    }
  }

  // Extract EmoteClueItem references
  const itemRefs = [];
  const itemRefRe = /EmoteClueItem\.(\w+)/g;
  let im;
  while ((im = itemRefRe.exec(argsStr)) !== null) {
    itemRefs.push(im[1]);
  }

  return { difficulty, text, locationName, stashUnit, items: itemRefs };
}

// ──────────── 5. Resolve leaf item IDs for aggregate items ────────────
function resolveLeafItemIds(item, allItems, visited) {
  if (!visited) visited = new Set();
  if (visited.has(item.name)) return [];
  visited.add(item.name);

  if (item.itemId !== null) return [item.itemId];
  if (!item.children) return [];

  const ids = [];
  for (const childName of item.children) {
    const child = allItems[childName];
    if (child) {
      ids.push(...resolveLeafItemIds(child, allItems, visited));
    }
  }
  return ids;
}

// ──────────── Main ────────────
console.log("Parsing ItemID.java...");
const itemIdMap = parseItemIdFile(ITEM_ID_FILE);
console.log(`  Found ${Object.keys(itemIdMap).length} item IDs`);

console.log("Parsing StashUnit.java...");
const stashUnits = parseStashUnits(path.join(PLUGIN_DATA, "StashUnit.java"));
console.log(`  Found ${Object.keys(stashUnits).length} stash units`);

console.log("Parsing EmoteClueItem.java...");
const emoteClueItems = parseEmoteClueItems(path.join(PLUGIN_DATA, "EmoteClueItem.java"), itemIdMap);
console.log(`  Found ${Object.keys(emoteClueItems).length} emote clue items`);

console.log("Parsing EmoteClue.java...");
const emoteClues = parseEmoteClues(path.join(PLUGIN_DATA, "EmoteClue.java"));
console.log(`  Found ${emoteClues.length} emote clues`);

// ──────────── Remap gameval IDs to real game IDs ────────────
console.log("Remapping gameval IDs to real game IDs...");
const cacheItemData = JSON.parse(fs.readFileSync(CACHE_ITEM_DATA, "utf8"));
const webItemData = JSON.parse(fs.readFileSync(WEB_ITEM_DATA, "utf8"));

const nameToRealId = {};
for (const [id, info] of Object.entries(webItemData)) {
  const lower = info.name.toLowerCase();
  const realId = parseInt(id);
  if (!nameToRealId[lower] || realId < nameToRealId[lower]) {
    nameToRealId[lower] = realId;
  }
}

const gamevalToReal = {};
for (const [gvId, info] of Object.entries(cacheItemData)) {
  const lower = info.name.toLowerCase();
  const realId = nameToRealId[lower];
  if (realId !== undefined) {
    gamevalToReal[parseInt(gvId)] = realId;
  }
}

function remapId(gvId) {
  if (gvId === null || gvId === -1) return gvId;
  if (webItemData[gvId]) return gvId;
  const mapped = gamevalToReal[gvId];
  if (mapped !== undefined) return mapped;
  const info = cacheItemData[gvId];
  if (info) {
    const realId = nameToRealId[info.name.toLowerCase()];
    if (realId !== undefined) return realId;
  }
  return gvId;
}

// Remap all leaf item IDs
let remapped = 0;
for (const item of Object.values(emoteClueItems)) {
  if (item.itemId !== null) {
    const old = item.itemId;
    item.itemId = remapId(item.itemId);
    if (item.itemId !== old) remapped++;
  }
}
console.log(
  `  Remapped ${remapped} / ${Object.values(emoteClueItems).filter((i) => i.itemId !== null).length} item IDs`
);

// ──────────── Build stash data structure ────────────
// Group clues by stash unit
const stashClueMap = {};
for (const clue of emoteClues) {
  if (!clue.stashUnit) continue; // skip clues without stash
  if (!stashClueMap[clue.stashUnit]) stashClueMap[clue.stashUnit] = [];
  stashClueMap[clue.stashUnit].push(clue);
}

// Build final stash data: for each stash, collect all unique item requirements
// flattened to leaf item IDs
const stashes = [];
for (const [stashEnum, clues] of Object.entries(stashClueMap)) {
  const stash = stashUnits[stashEnum];
  if (!stash) {
    console.warn(`  [WARN] Unknown stash unit: ${stashEnum}`);
    continue;
  }

  const difficulty = clues[0].difficulty;
  const requirements = [];

  for (const clue of clues) {
    const clueReqs = [];
    for (const itemRef of clue.items) {
      const item = emoteClueItems[itemRef];
      if (!item) {
        console.warn(`  [WARN] Unknown EmoteClueItem: ${itemRef}`);
        continue;
      }
      const leafIds = resolveLeafItemIds(item, emoteClueItems);
      const validIds = leafIds.filter((id) => id !== null && id !== -1);
      if (validIds.length === 0) continue;

      clueReqs.push({
        name: item.displayName,
        itemIds: validIds,
        isAll: item.isAll,
        // For simple leaf items, just use the one ID as the icon
        iconId: item.itemId !== null ? item.itemId : validIds.length > 0 ? validIds[0] : null,
      });
    }
    requirements.push({
      text: clue.text,
      items: clueReqs,
    });
  }

  stashes.push({
    enumName: stashEnum,
    name: stash.name,
    type: stash.type,
    difficulty,
    clues: requirements,
  });
}

// Sort by difficulty order, then name
const diffOrder = { Beginner: 0, Easy: 1, Medium: 2, Hard: 3, Elite: 4, Master: 5 };
stashes.sort((a, b) => diffOrder[a.difficulty] - diffOrder[b.difficulty] || a.name.localeCompare(b.name));

console.log(`\n  ${stashes.length} stash units with item requirements`);
console.log(
  `  By difficulty: ${["Beginner", "Easy", "Medium", "Hard", "Elite", "Master"]
    .map((d) => `${d}: ${stashes.filter((s) => s.difficulty === d).length}`)
    .join(", ")}`
);

// ──────────── Generate output ────────────
const output = `// Auto-generated from emote-clue-items plugin Java sources
// Do not edit manually - run scripts/convert-stash-data.js to regenerate

export const DIFFICULTIES = ["Beginner", "Easy", "Medium", "Hard", "Elite", "Master"];

export const DIFFICULTY_COLORS = {
  Beginner: "#9e9e9e",
  Easy: "#4caf50",
  Medium: "#00bcd4",
  Hard: "#9c27b0",
  Elite: "#ffc107",
  Master: "#f44336",
};

export const STASHES = ${JSON.stringify(stashes, null, 2)};

/**
 * Get all stashes for a given difficulty.
 */
export function getStashesByDifficulty(difficulty) {
  return STASHES.filter(s => s.difficulty === difficulty);
}
`;

// Ensure output directory exists
const outDir = path.dirname(OUTPUT_FILE);
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

fs.writeFileSync(OUTPUT_FILE, output, "utf8");
console.log(`\nGenerated: ${OUTPUT_FILE}`);
