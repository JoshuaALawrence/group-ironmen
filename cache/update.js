const child_process = require('child_process');
const fs = require('fs');
const glob = require('glob');
const path = require('path');
const axios = require('axios');
const sharp = require('sharp');
const unzipper = require('unzipper');
// NOTE: sharp will keep some files open and prevent them from being deleted
sharp.cache(false);

const localOsrsCacheCandidates = [
  path.join(process.env.USERPROFILE || '', '.runelite', 'jagexcache', 'oldschool', 'LIVE'),
  path.join(process.env.LOCALAPPDATA || '', 'Jagex', 'Old School RuneScape', 'data', 'cache'),
  path.join(process.env.LOCALAPPDATA || '', 'Jagex', 'Old School RuneScape'),
].filter(Boolean);

function findExistingDirectory(paths) {
  return paths.find((candidatePath) => candidatePath && fs.existsSync(candidatePath));
}

const runTimestamp = new Date().toISOString().replace(/[.:]/g, '-');
const dumpRoot = path.resolve(process.env.OSRS_CACHE_DUMP_DIR || `./dumps/${runTimestamp}`);
const syncSiteOutputs = process.env.OSRS_CACHE_SYNC_SITE === '1';
const configuredLocalCacheDirectory = process.env.OSRS_CACHE_PATH ? path.resolve(process.env.OSRS_CACHE_PATH) : null;

const runelitePath = path.resolve('./runelite');
const cacheProjectPath = `${runelitePath}/cache`;
const runeliteGradleCommand = process.platform === 'win32' ? '.\\gradlew.bat' : './gradlew';
const runeliteGradleInitScriptPath = `${dumpRoot}/run-cache-main.init.gradle`;
const runeliteGradleArgsFilePath = `${dumpRoot}/run-cache-main.args.txt`;
const cacheDownloadPath = `${dumpRoot}/cache`;
const downloadedOsrsCacheDirectory = `${cacheDownloadPath}/cache`;
const localOsrsCacheDirectory = configuredLocalCacheDirectory || findExistingDirectory(localOsrsCacheCandidates);
const usingLocalCache = Boolean(localOsrsCacheDirectory);
const osrsCacheDirectory = usingLocalCache ? localOsrsCacheDirectory : downloadedOsrsCacheDirectory;
const xteasPath = `${cacheDownloadPath}/xteas.json`;
const xteasRunelitePath = `${cacheDownloadPath}/xteas-runelite.json`;
const itemDataDirectory = `${dumpRoot}/item-data`;
const itemImagesDirectory = `${dumpRoot}/item-images`;
const mapDataDirectory = `${dumpRoot}/map-data`;
const mapLabelsDirectory = `${mapDataDirectory}/labels`;
const mapTilesDirectory = `${mapDataDirectory}/tiles`;
const mapIconsDirectory = `${mapDataDirectory}/icons`;
const spritesDirectory = `${dumpRoot}/sprites`;
const outputFilesDirectory = `${dumpRoot}/output_files`;
const itemsNeedImagesPath = `${dumpRoot}/items_need_images.csv`;
const itemDataJsonPath = `${dumpRoot}/item_data.json`;
const collectionLogInfoPath = `${dumpRoot}/collection_log_info.json`;
const collectionLogDuplicatesPath = `${dumpRoot}/collection_log_duplicates.json`;
const bossIconsPath = `${dumpRoot}/boss_icons.json`;

const FORCE_TRADEABLE_ITEM_IDS = new Set([995, 13204]);
const npcHeadIconsPath = `${dumpRoot}/npc_head_icons.json`;
const outputDziPath = `${dumpRoot}/output.dz`;
const siteItemDataPath = path.resolve('../site/public/data/item_data.json');
const siteMapIconMetaPath = path.resolve('../site/public/data/map_icons.json');
const siteMapLabelMetaPath = path.resolve('../site/public/data/map_labels.json');
const siteItemImagesPath = path.resolve('../site/public/icons/items');
const siteMapImagesPath = path.resolve('../site/public/map');
const siteMapLabelsPath = path.resolve('../site/public/map/labels');
const siteMapIconPath = path.resolve('../site/public/map/icons/map_icons.webp');
const siteCollectionLogPath = path.resolve('../site/public/data/collection_log_info.json');
const siteCollectionLogDuplicatesPath = path.resolve('../site/public/data/collection_log_duplicates.json');
const tileSize = 256;

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function globSyncPortable(pattern) {
  return glob.sync(pattern.replace(/\\/g, '/'));
}

function ensureDumpDirectories() {
  [
    dumpRoot,
    cacheDownloadPath,
    itemDataDirectory,
    itemImagesDirectory,
    mapDataDirectory,
    mapLabelsDirectory,
    mapTilesDirectory,
    mapIconsDirectory,
    spritesDirectory,
    outputFilesDirectory,
  ].forEach(ensureDir);
}

function hasCacheStoreFiles(cacheDirectory) {
  return fs.existsSync(path.join(cacheDirectory, 'main_file_cache.dat2'))
    && fs.existsSync(path.join(cacheDirectory, 'main_file_cache.idx255'));
}

function exec(command, options) {
  console.log(command);
  options = options || {};
  options.stdio = 'inherit';
  try {
    child_process.execSync(command, options);
  } catch (err) {
    console.log(err);
    process.exit(1);
  }
}

async function retry(fn, skipLast) {
  const attempts = 10;
  for (let i = 0; i < attempts; ++i) {
    try {
      await fn();
      return;
    } catch (ex) {
      await new Promise(resolve => setTimeout(resolve, 100));
      if (i === (attempts - 1) && skipLast) {
        console.error(ex);
      }
    }
  }

  if (!skipLast) {
    fn();
  }
}

function ensureRuneliteGradleRunner() {
  fs.writeFileSync(runeliteGradleInitScriptPath, `gradle.afterProject { project ->
  if (project.name != 'cache') {
    return
  }

  def sourceSets = project.extensions.getByType(org.gradle.api.tasks.SourceSetContainer)
  if (project.tasks.findByName('runCacheMain') == null) {
    project.tasks.register('runCacheMain', JavaExec) {
      dependsOn 'classes'
      classpath = sourceSets.getByName('main').runtimeClasspath
      mainClass.set(project.providers.gradleProperty('cacheMainClass').get())
      workingDir = project.projectDir

      def argsFile = project.providers.gradleProperty('cacheArgsFile').orNull
      if (argsFile != null) {
        args project.file(argsFile).readLines().findAll { line -> !line.trim().isEmpty() }
      }
    }
  }
}
`);
}

function execRuneliteCache(mainClass, args) {
  ensureRuneliteGradleRunner();
  fs.writeFileSync(runeliteGradleArgsFilePath, args.join('\n'));

  const cmd = `${runeliteGradleCommand} -p cache -I "${runeliteGradleInitScriptPath}" -PcacheMainClass=${mainClass} -PcacheArgsFile="${runeliteGradleArgsFilePath}" runCacheMain`;
  exec(cmd, { cwd: runelitePath });
}

async function readAllItemFiles() {
  const itemFiles = globSyncPortable(`${itemDataDirectory}/*.json`);
  const result = {};

  const batchSize = 200;
  for (let i = 0; i < itemFiles.length; i += batchSize) {
    const batch = itemFiles.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(async (itemFile) => {
      const itemFileData = await fs.promises.readFile(itemFile, 'utf8');
      return JSON.parse(itemFileData);
    }));

    for (const item of batchResults) {
      if (isNaN(item.id)) {
        console.log(item);
        continue;
      }

      result[item.id] = item;
    }
  }

  return result;
}

function buildCacheProject() {
  ensureRuneliteGradleRunner();
  exec(`${runeliteGradleCommand} -p cache classes`, { cwd: runelitePath });
}

function syncCustomCacheDriver() {
  const imageDumperDriver = fs.readFileSync('./Cache.java', 'utf8');
  fs.writeFileSync(`${cacheProjectPath}/src/main/java/net/runelite/cache/Cache.java`, imageDumperDriver);
}

async function setupRunelite() {
  console.log('Step: Setting up runelite');
  if (!fs.existsSync(runelitePath)) {
    exec(`git clone "https://github.com/runelite/runelite.git"`);
  }
  exec(`git fetch origin master`, { cwd: runelitePath });
  exec(`git checkout master`, { cwd: runelitePath });
  exec(`git pull --ff-only origin master`, { cwd: runelitePath });
}

async function getLatestCacheMetadata() {
  const caches = (await axios.get('https://archive.openrs2.org/caches.json')).data;
  const latestOSRSCache = caches.filter((cache) => {
    return cache.scope === 'runescape' && cache.game === 'oldschool' && cache.environment === 'live' && !!cache.timestamp;
  }).sort((a, b) => (new Date(b.timestamp)) - (new Date(a.timestamp)))[0];

  console.log(latestOSRSCache);
  return latestOSRSCache;
}

async function ensureCacheSource() {
  if (usingLocalCache) {
    if (!hasCacheStoreFiles(osrsCacheDirectory)) {
      throw new Error(`Local OSRS cache directory does not look valid: ${osrsCacheDirectory}`);
    }

    console.log(`Using local OSRS cache: ${osrsCacheDirectory}`);
    return;
  }

  await downloadLatestGameCache();
}

async function ensureXteas() {
  if (fs.existsSync(xteasPath)) {
    return xteasPath;
  }

  const latestOSRSCache = await getLatestCacheMetadata();
  const pctValidKeys = latestOSRSCache.keys === 0 ? 1 : latestOSRSCache.valid_keys / latestOSRSCache.keys;
  if (pctValidKeys < 0.85) {
    console.warn(`Skipping xtea download because valid_keys coverage is too low: ${latestOSRSCache.valid_keys}/${latestOSRSCache.keys}`);
    return null;
  }

  const xteas = (await axios.get(`https://archive.openrs2.org/caches/${latestOSRSCache.scope}/${latestOSRSCache.id}/keys.json`)).data;
  fs.writeFileSync(xteasPath, JSON.stringify(xteas));
  return xteasPath;
}

async function dumpItemData() {
  console.log('\nStep: Unpacking item data from cache');
  syncCustomCacheDriver();
  buildCacheProject();
  execRuneliteCache('net.runelite.cache.Cache', [
    '-c',
    osrsCacheDirectory,
    '-items',
    itemDataDirectory,
  ]);
}

async function getNonAlchableItemNames() {
  console.log('\nStep: Fetching unalchable items from wiki');
  const nonAlchableItemNames = new Set();
  let cmcontinue = '';
  do {
    const url = `https://oldschool.runescape.wiki/api.php?cmtitle=Category:Items_that_cannot_be_alchemised&action=query&list=categorymembers&format=json&cmlimit=500&cmcontinue=${cmcontinue}`;
    const response = await axios.get(url);
    const itemNames = response.data.query.categorymembers.map((member) => member.title).filter((title) => !title.startsWith('File:') && !title.startsWith('Category:'));
    itemNames.forEach((name) => nonAlchableItemNames.add(name));
    cmcontinue = response.data?.continue?.cmcontinue || null;
  } while(cmcontinue);

  return nonAlchableItemNames;
}

async function buildItemDataJson() {
  console.log('\nStep: Build item_data.json');
  const items = await readAllItemFiles();
  const includedItems = {};
  const allIncludedItemIds = new Set();
  for (const [itemId, item] of Object.entries(items)) {
    if (item.name && item.name.trim().toLowerCase() !== 'null') {
      const includedItem = {
        name: item.name,
        highalch: Math.floor(item.cost * 0.6),
        isTradeable: item.isTradeable === true || FORCE_TRADEABLE_ITEM_IDS.has(item.id)
      };
      const stackedList = [];
      if (item.countCo && item.countObj && item.countCo.length > 0 && item.countObj.length > 0) {
        for (let i = 0; i < item.countCo.length; ++i) {
          const stackBreakPoint = item.countCo[i];
          const stackedItemId = item.countObj[i];

          if (stackBreakPoint > 0 && stackedItemId === 0) {
            console.log(`${itemId}: Item has a stack breakpoint without an associated item id for that stack.`);
          } else if (stackBreakPoint > 0 && stackedItemId > 0) {
            allIncludedItemIds.add(stackedItemId);
            stackedList.push([stackBreakPoint, stackedItemId]);
          }
        }

        if (stackedList.length > 0) {
          includedItem.stacks = stackedList;
        }
      }
      allIncludedItemIds.add(item.id);
      includedItems[itemId] = includedItem;
    }
  }

  const nonAlchableItemNames = await getNonAlchableItemNames();

  let itemsMadeNonAlchable = 0;
  for (const item of Object.values(includedItems)) {
    const itemName = item.name;
    if (nonAlchableItemNames.has(itemName)) {
      // NOTE: High alch value = 0 just means unalchable in the context of this program
      item.highalch = 0;
      itemsMadeNonAlchable++;
    }

    // NOTE: The wiki data does not list every variant of an item such as 'Abyssal lantern (yew logs)'
    // which is also not alchable. So this step is to handle that case by searching for the non variant item.
    if (itemName.trim().endsWith(')') && itemName.indexOf('(') !== -1) {
      const nonVariantItemName = itemName.substring(0, itemName.indexOf('(')).trim();
      if (nonAlchableItemNames.has(nonVariantItemName)) {
        item.highalch = 0;
        itemsMadeNonAlchable++;
      }
    }
  }
  console.log(`${itemsMadeNonAlchable} items were updated to be unalchable`);
  fs.writeFileSync(itemDataJsonPath, JSON.stringify(includedItems));
  console.log(`Wrote ${Object.keys(includedItems).length} items to ${itemDataJsonPath}`);

  return allIncludedItemIds;
}

async function dumpItemImages(allIncludedItemIds) {
  console.log('\nStep: Extract item model images');

  console.log(`Generating images for ${allIncludedItemIds.size} items`);
  fs.writeFileSync(itemsNeedImagesPath, Array.from(allIncludedItemIds.values()).join(','));
  syncCustomCacheDriver();
  const itemSpriteFactory = fs.readFileSync('./ItemSpriteFactory.java', 'utf8');
  fs.writeFileSync(`${cacheProjectPath}/src/main/java/net/runelite/cache/item/ItemSpriteFactory.java`, itemSpriteFactory);
  buildCacheProject();
  execRuneliteCache('net.runelite.cache.Cache', [
    '-c',
    osrsCacheDirectory,
    '-ids',
    itemsNeedImagesPath,
    '-output',
    itemImagesDirectory,
  ]);

  const itemImages = globSyncPortable(`${itemImagesDirectory}/*.png`);
  let p = [];
  for (const itemImage of itemImages) {
    p.push(new Promise(async (resolve) => {
      await sharp(itemImage).webp({ lossless: true, effort: 6 }).toFile(itemImage.replace('.png', '.webp')).then(resolve);
    }));
  }

  await Promise.all(p);
}

async function convertXteasToRuneliteFormat() {
  if (!fs.existsSync(xteasPath)) {
    return null;
  }

  const xteas = JSON.parse(fs.readFileSync(xteasPath, 'utf8'));
  let result = xteas.map((region) => ({
    region: region.mapsquare,
    keys: region.key
  }));

  fs.writeFileSync(xteasRunelitePath, JSON.stringify(result));

  return xteasRunelitePath;
}

async function dumpMapData(xteasLocation) {
  console.log('\nStep: Dumping map data');
  const mapImageDumper = fs.readFileSync('./MapImageDumper.java', 'utf8');
  fs.writeFileSync(`${cacheProjectPath}/src/main/java/net/runelite/cache/MapImageDumper.java`, mapImageDumper);
  buildCacheProject();
  execRuneliteCache('net.runelite.cache.MapImageDumper', [
    '--cachedir',
    osrsCacheDirectory,
    '--xteapath',
    xteasLocation,
    '--outputdir',
    mapDataDirectory,
  ]);
}

async function dumpMapLabels() {
  console.log('\nStep: Dumping map labels');
  const mapLabelDumper = fs.readFileSync('./MapLabelDumper.java', 'utf8');
  fs.writeFileSync(`${cacheProjectPath}/src/main/java/net/runelite/cache/MapLabelDumper.java`, mapLabelDumper);
  buildCacheProject();
  execRuneliteCache('net.runelite.cache.MapLabelDumper', [
    '--cachedir',
    osrsCacheDirectory,
    '--outputdir',
    mapLabelsDirectory,
  ]);

  const mapLabels = globSyncPortable(`${mapLabelsDirectory}/*.png`);
  let p = [];
  for (const mapLabel of mapLabels) {
    p.push(new Promise(async (resolve) => {
      await sharp(mapLabel).webp({ lossless: true, effort: 6 }).toFile(mapLabel.replace('.png', '.webp')).then(resolve);
    }));
  }
  await Promise.all(p);
}

async function dumpCollectionLog() {
  console.log('\nStep: Dumping collection log');
  const collectionLogDumper = fs.readFileSync('./CollectionLogDumper.java', 'utf8');
  fs.writeFileSync(`${cacheProjectPath}/src/main/java/net/runelite/cache/CollectionLogDumper.java`, collectionLogDumper);
  buildCacheProject();
  execRuneliteCache('net.runelite.cache.CollectionLogDumper', [
    '--cachedir',
    osrsCacheDirectory,
    '--outputdir',
    dumpRoot,
  ]);
}

async function dumpSprites() {
  console.log('\nStep: Dumping cache sprites');
  const spriteDumper = fs.readFileSync('./SpriteDumper.java', 'utf8');
  fs.writeFileSync(`${cacheProjectPath}/src/main/java/net/runelite/cache/SpriteDumper.java`, spriteDumper);
  buildCacheProject();
  execRuneliteCache('net.runelite.cache.SpriteDumper', [
    '--cachedir',
    osrsCacheDirectory,
    '--outputdir',
    spritesDirectory,
  ]);
}

async function dumpNpcHeadIcons() {
  console.log('\nStep: Dumping NPC head icon metadata');
  const npcIconDumper = fs.readFileSync('./NpcIconDumper.java', 'utf8');
  fs.writeFileSync(`${cacheProjectPath}/src/main/java/net/runelite/cache/NpcIconDumper.java`, npcIconDumper);
  buildCacheProject();
  execRuneliteCache('net.runelite.cache.NpcIconDumper', [
    '--cachedir',
    osrsCacheDirectory,
    '--output',
    npcHeadIconsPath,
  ]);
}

async function buildBossIconManifest() {
  console.log('\nStep: Building boss icon manifest');
  const spriteIdFile = fs.readFileSync(`${runelitePath}/runelite-api/src/main/java/net/runelite/api/gameval/SpriteID.java`, 'utf8');
  const hiscoreSkillFile = fs.readFileSync(`${runelitePath}/runelite-client/src/main/java/net/runelite/client/hiscore/HiscoreSkill.java`, 'utf8');

  const bossSpriteClass = spriteIdFile.match(/public static final class IconBoss25x25\s*\{([\s\S]*?)\n\t\}/);
  if (!bossSpriteClass) {
    throw new Error('Could not find IconBoss25x25 in runelite SpriteID.java');
  }

  const rawSpriteValues = new Map();
  for (const match of bossSpriteClass[1].matchAll(/public static final int (_\d+) = (\d+);/g)) {
    rawSpriteValues.set(match[1], parseInt(match[2], 10));
  }

  const namedSpriteValues = new Map();
  for (const match of bossSpriteClass[1].matchAll(/public static final int ([A-Z0-9_]+) = (_\d+|\d+);/g)) {
    const constantName = match[1];
    if (constantName.startsWith('_')) {
      continue;
    }

    const rawValue = match[2];
    const spriteId = /^\d+$/.test(rawValue) ? parseInt(rawValue, 10) : rawSpriteValues.get(rawValue);
    if (spriteId !== undefined) {
      namedSpriteValues.set(constantName, spriteId);
    }
  }

  const bossIcons = [];
  for (const match of hiscoreSkillFile.matchAll(/([A-Z0-9_]+)\("([^"]+)", BOSS, SpriteID\.IconBoss25x25\.([A-Z0-9_]+)\),/g)) {
    const spriteId = namedSpriteValues.get(match[3]);
    if (spriteId === undefined) {
      continue;
    }

    bossIcons.push({
      name: match[2],
      spriteId,
      frame: 0,
      file: `${spriteId}-0.png`,
    });
  }

  fs.writeFileSync(bossIconsPath, JSON.stringify(bossIcons, null, 2));
}

async function tilePlane(plane) {
  const planeOutputDirectory = `${outputFilesDirectory}/0`;
  await retry(() => fs.rmSync(outputFilesDirectory, { recursive: true, force: true }));
  ensureDir(planeOutputDirectory);
  const planeImage = sharp(`${mapDataDirectory}/img-${plane}.png`, { limitInputPixels: false }).flip();
  await planeImage.webp({ lossless: true }).tile({
    size: tileSize,
    depth: "one",
    background: { r: 0, g: 0, b: 0, alpha: 0 },
    skipBlanks: 0
  }).toFile(outputDziPath);
}

async function outputTileImage(s, plane, x, y) {
  return s.flatten({ background: '#000000' })
    .webp({ lossless: true, alphaQuality: 0, effort: 6 })
    .toFile(`${mapTilesDirectory}/${plane}_${x}_${y}.webp`);
}

async function finalizePlaneTiles(plane, previousTiles) {
  const tileImages = globSyncPortable(`${outputFilesDirectory}/0/*.webp`);

  for (const tileImage of tileImages) {
    const filename = path.basename(tileImage, '.webp');
    const [x, y] = filename.split('_').map((coord) => parseInt(coord, 10));

    const finalX = x + 15;
    const finalY = y + 19;

    let s;
    if (plane > 0) {
      const backgroundPath = `${mapTilesDirectory}/${plane-1}_${finalX}_${finalY}.webp`;
      const backgroundExists = fs.existsSync(backgroundPath);

      if (backgroundExists) {
        const [tile, background] = await Promise.all([
          sharp(tileImage).flip().webp({ lossless: true }).toBuffer(),
          sharp(backgroundPath).linear(0.5).webp({ lossless: true }).toBuffer()
        ]);
        s = sharp(background)
          .composite([
            { input: tile }
          ]);
      }
    }

    if (!s) {
      s = sharp(tileImage).flip();
    }

    previousTiles.add(`${plane}_${finalX}_${finalY}`);
    await outputTileImage(s, plane, finalX, finalY);
  }

  // NOTE: This is just so the plane will have a darker version of the tile below it
  // even if the plane does not have its own image for a tile.
  if (plane > 0) {
    const belowTiles = [...previousTiles].filter(x => x.startsWith(plane - 1));
    for (const belowTile of belowTiles) {
      const [belowPlane, x, y] = belowTile.split('_');
      const  lookup = `${plane}_${x}_${y}`;
      if (!previousTiles.has(lookup)) {
        const outputPath = `${mapTilesDirectory}/${plane}_${x}_${y}.webp`;
        if (fs.existsSync(outputPath) === true) {
          throw new Error(`Filling tile ${outputPath} but it already exists!`);
        }

        const s = sharp(`${mapTilesDirectory}/${belowTile}.webp`).linear(0.5);
        previousTiles.add(lookup);
        await outputTileImage(s, plane, x, y);
      }
    }
  }
}

async function generateMapTiles() {
  console.log('\nStep: Generate map tiles');
  ensureDir(mapTilesDirectory);

  const previousTiles = new Set();
  const planes = 4;
  for (let i = 0; i < planes; ++i) {
    console.log(`Tiling map plane ${i + 1}/${planes}`);
    await tilePlane(i);
    console.log(`Finalizing map plane ${i + 1}/${planes}`);
    await finalizePlaneTiles(i, previousTiles);
  }
}

async function moveFiles(globSource, destination) {
  const files = globSyncPortable(globSource);
  for (const file of files) {
    const base = path.parse(file).base;
    if (base) {
      await retry(() => fs.copyFileSync(file, `${destination}/${base}`), true);
    }
  }
}

async function moveResults() {
  console.log('\nStep: Moving results to site');
  await retry(() => fs.copyFileSync(itemDataJsonPath, siteItemDataPath), true);
  await retry(() => fs.copyFileSync(collectionLogInfoPath, siteCollectionLogPath), true);

  await moveFiles(`${itemImagesDirectory}/*.webp`, siteItemImagesPath);
  await moveFiles(`${mapTilesDirectory}/*.webp`, siteMapImagesPath);
  await moveFiles(`${mapLabelsDirectory}/*.webp`, siteMapLabelsPath);

  // Create a tile sheet of the map icons
  const mapIcons = globSyncPortable(`${mapIconsDirectory}/*.png`);
  if (mapIcons.length === 0) {
    return;
  }
  let mapIconsCompositeOpts = [];
  const iconIdToSpriteMapIndex = {};
  for (let i = 0; i < mapIcons.length; ++i) {
    mapIconsCompositeOpts.push({
      input: mapIcons[i],
      left: 15 * i,
      top: 0
    });

    iconIdToSpriteMapIndex[path.basename(mapIcons[i], '.png')] = i;
  }
  await sharp({
    create: {
      width: 15 * mapIcons.length,
      height: 15,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  }).composite(mapIconsCompositeOpts).webp({ lossless: true, effort: 6 }).toFile(siteMapIconPath);

  // Convert the output of the map-icons locations to be keyed by the X an Y of the regions
  // that they are in. This is done so that the canvas map component can quickly lookup
  // all of the icons in each of the regions that are being shown.
  const mapIconsMeta = JSON.parse(fs.readFileSync(`${mapIconsDirectory}/map-icons.json`, 'utf8'));
  const locationByRegion = {};

  for (const [iconId, coordinates] of Object.entries(mapIconsMeta)) {
    for (let i = 0; i < coordinates.length; i += 2) {
      const x = coordinates[i];
      const y = coordinates[i + 1] + 1;

      const regionX = Math.floor(x / 64);
      const regionY = Math.floor(y / 64);

      const spriteMapIndex = iconIdToSpriteMapIndex[iconId];
      if (spriteMapIndex === undefined) {
        throw new Error("Could not find sprite map index for map icon: " + iconId);
      }

      locationByRegion[regionX] = locationByRegion[regionX] || {};
      locationByRegion[regionX][regionY] = locationByRegion[regionX][regionY] || {};
      locationByRegion[regionX][regionY][spriteMapIndex] = locationByRegion[regionX][regionY][spriteMapIndex] || [];

      locationByRegion[regionX][regionY][spriteMapIndex].push(x, y);
    }
  }

  fs.writeFileSync(siteMapIconMetaPath, JSON.stringify(locationByRegion));

  // Do the same for map labels
  const mapLabelsMeta = JSON.parse(fs.readFileSync(`${mapLabelsDirectory}/map-labels.json`, 'utf8'));
  const labelByRegion = {};

  for (let i = 0; i < mapLabelsMeta.length; ++i) {
    const coordinates = mapLabelsMeta[i];
    const x = coordinates[0];
    const y = coordinates[1] + 1;
    const z = coordinates[2];

    const regionX = Math.floor(x / 64);
    const regionY = Math.floor(y / 64);

    labelByRegion[regionX] = labelByRegion[regionX] || {};
    labelByRegion[regionX][regionY] = labelByRegion[regionX][regionY] || {};
    labelByRegion[regionX][regionY][z] = labelByRegion[regionX][regionY][z] || [];

    labelByRegion[regionX][regionY][z].push(x, y, i);
  }

  fs.writeFileSync(siteMapLabelMetaPath, JSON.stringify(labelByRegion));
}

async function downloadLatestGameCache() {
  ensureDir(cacheDownloadPath);

  const latestOSRSCache = await getLatestCacheMetadata();
  const pctValidArchives = latestOSRSCache.valid_indexes / latestOSRSCache.indexes;
  if (pctValidArchives < 1) {
    throw new Error(`valid_indexes was less than indexes valid_indexes=${latestOSRSCache.valid_indexes} indexes=${latestOSRSCache.indexes} pctValidArchives=${pctValidArchives}`);
  }

  const pctValidGroups = latestOSRSCache.valid_groups / latestOSRSCache.groups;
  if (pctValidGroups < 1) {
    throw new Error(`valid_groups was less than groups valid_groups=${latestOSRSCache.valid_groups} groups=${latestOSRSCache.groups} pctValidGroups=${pctValidGroups}`);
  }

  const pctValidKeys = latestOSRSCache.keys === 0 ? 1 : latestOSRSCache.valid_keys / latestOSRSCache.keys;
  if (pctValidKeys < 0.85) {
    throw new Error(`pctValidKeys was less that 85% valid_keys=${latestOSRSCache.valid_keys} keys=${latestOSRSCache.keys} pctValidKeys=${pctValidKeys}`);
  }

  const cacheFilesResponse = await axios.get(`https://archive.openrs2.org/caches/${latestOSRSCache.scope}/${latestOSRSCache.id}/disk.zip`, {
    responseType: 'arraybuffer'
  });
  const cacheFiles = await unzipper.Open.buffer(cacheFilesResponse.data);
  await cacheFiles.extract({ path: cacheDownloadPath });

  await ensureXteas();
}

async function findDuplicateCollectionLogItems() {
  console.log('Step: build duplicate mapping for collection log items');
  // get all collection log item ids
  const collectionLogInfo = JSON.parse(fs.readFileSync(syncSiteOutputs ? siteCollectionLogPath : collectionLogInfoPath, 'utf8'));
  const itemIds = new Set();
  for (const tab of collectionLogInfo) {
    for (const page of tab.pages) {
      for (const item of page.items) {
        itemIds.add(item.id);
      }
    }
  }

  // get image stats for every item
  const itemImagesSource = syncSiteOutputs ? siteItemImagesPath : itemImagesDirectory;
  const itemImages = globSyncPortable(`${itemImagesSource}/*.webp`);
  const itemImageStats = new Map();
  const p = [];
  for (const itemImage of itemImages) {
    const itemId = parseInt(path.basename(itemImage, '.webp'), 10);
    p.push(sharp(itemImage).stats().then((stats) => itemImageStats.set(itemId, stats)));
  }
  await Promise.all(p);

  const dupeMapping = {};
  // if the images are the same then we consider it a duplicate
  for (const itemId of itemIds) {
    const stats = itemImageStats.get(itemId);
    for (const [otherItemId, otherStats] of itemImageStats) {
      if (otherItemId === itemId) continue;
      const colorDiff = Math.abs(stats.channels[0].mean - otherStats.channels[0].mean)
            + Math.abs(stats.channels[1].mean - otherStats.channels[1].mean)
            + Math.abs(stats.channels[2].mean - otherStats.channels[2].mean);
      if (colorDiff > 0.0001) continue;

      // do not consider it a dupe if both items are in the collection log
      if (itemIds.has(otherItemId)) {
        continue;
      }

      dupeMapping[itemId]?.push(otherItemId) || (dupeMapping[itemId] = [otherItemId]);
    }
  }

  // now only include duplicates with similar item names
  const itemData = JSON.parse(fs.readFileSync(syncSiteOutputs ? siteItemDataPath : itemDataJsonPath, 'utf8'));
  for (const [itemId, otherItemIds] of Object.entries(dupeMapping)) {
    const itemName = itemData[itemId.toString()].name;
    const dupesWithMatchingNames = [];

    for (const otherItemId of otherItemIds) {
      const otherItemName = itemData[otherItemId.toString()].name;
      if (itemName.startsWith(otherItemName) || otherItemName.startsWith(itemName)) {
        dupesWithMatchingNames.push(otherItemId);
      }
    }

    if (dupesWithMatchingNames.length === 0) {
      delete dupeMapping[itemId];
    } else {
      dupeMapping[itemId] = dupesWithMatchingNames;
    }
  }

  fs.writeFileSync(syncSiteOutputs ? siteCollectionLogDuplicatesPath : collectionLogDuplicatesPath, JSON.stringify(dupeMapping));
}

async function main() {
  ensureDumpDirectories();
  console.log(`Dump root: ${path.resolve(dumpRoot)}`);
  console.log(`Site sync: ${syncSiteOutputs ? 'enabled' : 'disabled'}`);
  console.log(`Cache source: ${usingLocalCache ? 'local' : 'openrs2'}`);
  await ensureCacheSource();
  await setupRunelite();
  await dumpItemData();
  const allIncludedItemIds = await buildItemDataJson();
  await dumpItemImages(allIncludedItemIds);

  await ensureXteas();
  const xteasLocation = await convertXteasToRuneliteFormat();
  if (xteasLocation) {
    await dumpMapData(xteasLocation);
    await generateMapTiles();
    await dumpMapLabels();
  } else {
    console.warn('Skipping map image and label dump because no xteas were available.');
  }
  await dumpCollectionLog();
  await dumpSprites();
  await buildBossIconManifest();
  await dumpNpcHeadIcons();

  if (syncSiteOutputs) {
    await moveResults();
  }

  await findDuplicateCollectionLogItems();
}

main().catch((error) => {
  console.error('Fatal cache dump error:');
  console.error(error?.stack || error);
  process.exit(1);
});
