const fs = require('fs');
const path = require('path');

function findLatestDumpDir() {
  const dumpDirArg = process.argv.find(a => a.startsWith('--dump-dir'));
  if (dumpDirArg) {
    const idx = process.argv.indexOf(dumpDirArg);
    const dir = dumpDirArg.includes('=') ? dumpDirArg.split('=')[1] : process.argv[idx + 1];
    if (dir && fs.existsSync(dir)) return dir;
  }

  const dumpsRoot = path.join(__dirname, '..', 'cache', 'dumps');
  if (!fs.existsSync(dumpsRoot)) {
    throw new Error('No cache/dumps/ directory found. Run the cache update first.');
  }
  const dirs = fs.readdirSync(dumpsRoot)
    .filter(d => fs.statSync(path.join(dumpsRoot, d)).isDirectory())
    .sort()
    .reverse();
  if (dirs.length === 0) {
    throw new Error('No dump directories found in cache/dumps/');
  }
  return path.join(dumpsRoot, dirs[0]);
}

const LATEST_DUMP = findLatestDumpDir();
const CACHE_ITEM_DIR = path.join(LATEST_DUMP, 'item-data');
const EQUIPMENT_JSON = path.join(__dirname, '..', 'site', 'public', 'data', 'equipment.json');

// Param ID -> equipment stat mapping (from OSRS cache)
const PARAM = {
  ASTAB: 0,
  ASLASH: 1,
  ACRUSH: 2,
  AMAGIC: 3,
  ARANGE: 4,
  DSTAB: 5,
  DSLASH: 6,
  DCRUSH: 7,
  DMAGIC: 8,
  DRANGE: 9,
  STR: 10,
  PRAYER: 11,
  ASPEED: 14,
  RSTR: 189,    // ranged strength
  MDMG: 299,    // magic damage (stored as value * 10, e.g. 150 = 15%)
};

// wearPos1 -> equipment.json slot name
const SLOT_MAP = {
  0: 'head',
  1: 'cape',
  2: 'neck',
  3: 'weapon',
  4: 'body',
  5: 'shield',
  7: 'legs',
  9: 'hands',
  10: 'feet',
  12: 'ring',
  13: 'ammo',
};

function getParam(params, key, defaultVal = 0) {
  if (!params) return defaultVal;
  const val = params[String(key)];
  return val !== undefined ? val : defaultVal;
}

function isEquippable(item) {
  // Must have a valid equipment slot
  if (item.wearPos1 === undefined || item.wearPos1 < 0) return false;
  if (!(item.wearPos1 in SLOT_MAP)) return false;

  // Skip noted items
  if (item.notedTemplate !== undefined && item.notedTemplate !== -1) return false;

  // Skip placeholder items
  if (item.placeholderTemplateId !== undefined && item.placeholderTemplateId !== -1) return false;

  // Skip bought/GE template items
  if (item.boughtTemplateId !== undefined && item.boughtTemplateId !== -1) return false;

  // Must have a name and not be "null"
  if (!item.name || item.name === 'null' || item.name === 'Null') return false;

  // Must have "Wield", "Wear", or "Equip" in interface options
  if (item.interfaceOptions) {
    const hasEquipOption = item.interfaceOptions.some(
      opt => opt && (opt === 'Wield' || opt === 'Wear' || opt === 'Equip')
    );
    if (!hasEquipOption) return false;
  } else {
    return false;
  }

  return true;
}

function cacheItemToEquipment(item) {
  const params = item.params || {};
  const slot = SLOT_MAP[item.wearPos1];
  const isTwoHanded = item.wearPos2 === 5; // blocks shield slot

  const mdmgRaw = getParam(params, PARAM.MDMG);
  // magic damage stored as value * 10 (150 = 15%), convert to integer percentage
  const magicStr = mdmgRaw !== 0 ? Math.round(mdmgRaw / 10) : 0;

  return {
    name: item.name,
    id: item.id,
    version: '',
    slot: slot,
    image: item.name + '.png',
    speed: getParam(params, PARAM.ASPEED, slot === 'weapon' ? 4 : 0),
    category: '',
    bonuses: {
      str: getParam(params, PARAM.STR),
      ranged_str: getParam(params, PARAM.RSTR),
      magic_str: magicStr,
      prayer: getParam(params, PARAM.PRAYER),
    },
    offensive: {
      stab: getParam(params, PARAM.ASTAB),
      slash: getParam(params, PARAM.ASLASH),
      crush: getParam(params, PARAM.ACRUSH),
      magic: getParam(params, PARAM.AMAGIC),
      ranged: getParam(params, PARAM.ARANGE),
    },
    defensive: {
      stab: getParam(params, PARAM.DSTAB),
      slash: getParam(params, PARAM.DSLASH),
      crush: getParam(params, PARAM.DCRUSH),
      magic: getParam(params, PARAM.DMAGIC),
      ranged: getParam(params, PARAM.DRANGE),
    },
    isTwoHanded: isTwoHanded,
  };
}

function main() {
  console.log(`Using dump directory: ${LATEST_DUMP}`);
  console.log(`Item data directory:  ${CACHE_ITEM_DIR}`);

  if (!fs.existsSync(CACHE_ITEM_DIR)) {
    console.error(`ERROR: item-data directory not found at ${CACHE_ITEM_DIR}`);
    process.exit(1);
  }

  // Load existing equipment.json
  console.log('Loading existing equipment.json...');
  const existingEquipment = JSON.parse(fs.readFileSync(EQUIPMENT_JSON, 'utf8'));
  const existingIds = new Set(existingEquipment.map(e => e.id));
  console.log(`Existing equipment: ${existingEquipment.length} items`);

  // Read all cache item files
  console.log('Reading cache item files...');
  const files = fs.readdirSync(CACHE_ITEM_DIR).filter(f => f.endsWith('.json'));
  console.log(`Found ${files.length} item files in cache`);

  let added = 0;
  let skippedNonEquippable = 0;
  let skippedAlreadyExists = 0;

  for (const file of files) {
    const filePath = path.join(CACHE_ITEM_DIR, file);
    let item;
    try {
      item = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (e) {
      continue;
    }

    if (existingIds.has(item.id)) {
      skippedAlreadyExists++;
      continue;
    }

    if (!isEquippable(item)) {
      skippedNonEquippable++;
      continue;
    }

    const equipment = cacheItemToEquipment(item);
    existingEquipment.push(equipment);
    existingIds.add(item.id);
    added++;
  }

  // Sort by ID
  existingEquipment.sort((a, b) => a.id - b.id);

  console.log(`\nResults:`);
  console.log(`  Already existed: ${skippedAlreadyExists}`);
  console.log(`  Non-equippable:  ${skippedNonEquippable}`);
  console.log(`  NEW items added: ${added}`);
  console.log(`  Total equipment: ${existingEquipment.length}`);

  // Write merged equipment.json
  fs.writeFileSync(EQUIPMENT_JSON, JSON.stringify(existingEquipment));
  console.log(`\nWrote ${EQUIPMENT_JSON}`);
}

main();
