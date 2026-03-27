/**
 * Constants - 1:1 port from osrs-dps-calc constants.ts
 * All monster IDs and game constants used in DPS calculations.
 */

export const SECONDS_PER_TICK = 0.6;

export const DEFAULT_ATTACK_SPEED = 4;

export const TTK_DIST_MAX_ITER_ROUNDS = 1000;

export const TTK_DIST_EPSILON = 0.0001;

// ── Monster IDs ──

export const BLOWPIPE_IDS = [12926, 28688, 31575, 31579, 31583];

export const AKKHA_IDS = [11789, 11790, 11791, 11792, 11793, 11794, 11795, 11796];

export const AKKHA_SHADOW_IDS = [11797, 11798, 11799];

export const BABA_IDS = [11778, 11779, 11780];

export const KEPHRI_SHIELDED_IDS = [11719];

export const KEPHRI_UNSHIELDED_IDS = [11721];

export const KEPHRI_OVERLORD_IDS = [11724, 11725, 11726];

export const ZEBAK_IDS = [11730, 11732, 11733];

export const TOA_OBELISK_IDS = [11751, 11750, 11752];

export const P2_WARDEN_IDS = [11753, 11754, 11756, 11757];

export const P3_WARDEN_IDS = [11761, 11763, 11762, 11764];

export const TOA_WARDEN_CORE_EJECTED_IDS = [11755, 11758];

export const TOMBS_OF_AMASCUT_PATH_MONSTER_IDS = [
  ...AKKHA_IDS,
  ...AKKHA_SHADOW_IDS,
  ...BABA_IDS,
  ...KEPHRI_SHIELDED_IDS,
  ...KEPHRI_UNSHIELDED_IDS,
  ...KEPHRI_OVERLORD_IDS,
  ...ZEBAK_IDS,
];

export const TOMBS_OF_AMASCUT_MONSTER_IDS = [
  ...TOMBS_OF_AMASCUT_PATH_MONSTER_IDS,
  ...TOA_OBELISK_IDS,
  ...P2_WARDEN_IDS,
  ...TOA_WARDEN_CORE_EJECTED_IDS,
  ...P3_WARDEN_IDS,
];

export const VERZIK_P1_IDS = [10830, 10831, 10832, 8369, 8370, 8371, 10847, 10848, 10849];

export const VERZIK_IDS = [...VERZIK_P1_IDS, 10833, 10834, 10835, 8372, 8373, 8374, 10850, 10851, 10852];

export const SOTETSEG_IDS = [8387, 8388, 10867, 10868];

export const TOB_MONSTER_IDS = [
  ...VERZIK_P1_IDS,
  8360,
  8361,
  8362,
  8363,
  8364,
  8365,
  8366,
  8367,
  8359,
  8342,
  8343,
  8344,
  8345,
  8346,
  8347,
  8348,
  8349,
  8350,
  8351,
  8352,
  8353,
  8355,
  8356,
  8357,
  ...SOTETSEG_IDS,
  8339,
  8340,
  8372,
  8373,
  8374,
  8376,
  8381,
  8382,
  8383,
  8384,
  8385,
  10822,
  10823,
  10824,
  10825,
  10826,
  10827,
  10828,
  10829,
  10813,
  10791,
  10792,
  10793,
  10794,
  10795,
  10796,
  10797,
  10798,
  10799,
  10800,
  10801,
  10802,
  10804,
  10805,
  10806,
  10808,
  10809,
  10810,
  10770,
  10771,
  10772,
  10850,
  10851,
  10852,
  10854,
  10858,
  10859,
  10860,
  10861,
  10862,
];

export const TOB_EM_MONSTER_IDS = [
  10814, 10815, 10816, 10817, 10818, 10819, 10820, 10821, 10812, 10774, 10775, 10776, 10777, 10778, 10779, 10780, 10781,
  10782, 10783, 10784, 10785, 10787, 10788, 10789, 10864, 10865, 10767, 10768, 10833, 10834, 10835, 10837, 10841, 10842,
  10843, 10844, 10845,
];

export const TEKTON_IDS = [7540, 7543, 7544, 7545];

export const GUARDIAN_IDS = [7569, 7571, 7570, 7572];

export const OLM_HEAD_IDS = [7551, 7554];

export const OLM_MELEE_HAND_IDS = [7552, 7555];

export const OLM_MAGE_HAND_IDS = [7550, 7553];

export const OLM_IDS = [...OLM_HEAD_IDS, ...OLM_MELEE_HAND_IDS, ...OLM_MAGE_HAND_IDS];

export const SCAVENGER_BEAST_IDS = [7548, 7549];

export const ABYSSAL_PORTAL_IDS = [7533];

export const GLOWING_CRYSTAL_IDS = [7568];

export const ICE_DEMON_IDS = [7584, 7585];

export const VESPINE_SOLDIER_IDS = [7538, 7539];

export const DEATHLY_RANGER_IDS = [7559];

export const VESPULA_IDS = [7530, 7531, 7532];

export const COX_MAGIC_IS_DEFENSIVE_IDS = [
  ...DEATHLY_RANGER_IDS,
  ...TEKTON_IDS,
  ...ABYSSAL_PORTAL_IDS,
  ...VESPULA_IDS,
  ...VESPINE_SOLDIER_IDS,
  ...OLM_MELEE_HAND_IDS,
  ...OLM_MAGE_HAND_IDS,
];

export const FRAGMENT_OF_SEREN_IDS = [8917, 8918, 8919, 8920];

export const NIGHTMARE_IDS = [
  378, 9425, 9426, 9427, 9428, 9429, 9430, 9431, 9432, 9433, 9460, 377, 9423, 9416, 9417, 9418, 9419, 9420, 9421, 9422,
  9424, 11153, 11154, 11155,
];

export const NIGHTMARE_TOTEM_IDS = [9434, 9437, 9440, 9443, 9435, 9438, 9441, 9444];

export const NEX_IDS = [11278, 11279, 11280, 11281, 11282];

export const USES_DEFENCE_LEVEL_FOR_MAGIC_DEFENCE_NPC_IDS = [
  ...ICE_DEMON_IDS,
  ...VERZIK_IDS,
  ...FRAGMENT_OF_SEREN_IDS,
  11709,
  11712,
  9118,
];

const DUSK_IDS = [7851, 7854, 7855, 7882, 7883, 7886, 7887, 7888, 7889];
const WARRIORS_GUILD_CYCLOPES = [2463, 2465, 2467, 2464, 2466, 2468, 2137, 2138, 2139, 2140, 2141, 2142];

export const ZULRAH_IDS = [2042, 2043, 2044];

export const IMMUNE_TO_MELEE_DAMAGE_NPC_IDS = [
  494,
  ...ABYSSAL_PORTAL_IDS,
  7706,
  7708,
  12214,
  12215,
  12219,
  ...ZULRAH_IDS,
];

export const IMMUNE_TO_NON_SALAMANDER_MELEE_DAMAGE_NPC_IDS = [
  3169, 3170, 3171, 3172, 3173, 3174, 3175, 3176, 3177, 3178, 3179, 3180, 3181, 3182, 3183, 7037,
];

export const IMMUNE_TO_RANGED_DAMAGE_NPC_IDS = [
  ...TEKTON_IDS,
  ...DUSK_IDS,
  ...GLOWING_CRYSTAL_IDS,
  ...WARRIORS_GUILD_CYCLOPES,
];

export const IMMUNE_TO_BURN_DAMAGE_NPC_IDS = [
  ...TEKTON_IDS,
  ...DUSK_IDS,
  ...GLOWING_CRYSTAL_IDS,
  ...WARRIORS_GUILD_CYCLOPES,
];

export const IMMUNE_TO_MAGIC_DAMAGE_NPC_IDS = [...DUSK_IDS, ...WARRIORS_GUILD_CYCLOPES];

export const BA_ATTACKER_MONSTERS = [
  1667, 5739, 5740, 5741, 5742, 5743, 5744, 5745, 5746, 5747, 1668, 5757, 5758, 5759, 5760, 5761, 5762, 5763, 5764,
  5765,
];

export const VARDORVIS_IDS = [12223, 12224, 12228, 12425, 12426, 13656];

export const TITAN_BOSS_IDS = [12596, 14147];

export const TITAN_ELEMENTAL_IDS = [14150, 14151];

export const UNDERWATER_MONSTERS = [7796];

export const YAMA_VOID_FLARE_IDS = [14179];

export const ONE_HIT_MONSTERS = [7223, 8584, 11193];

export const ALWAYS_MAX_HIT_MONSTERS = {
  melee: [11710, 11713, 12814, ...TOA_WARDEN_CORE_EJECTED_IDS, ...YAMA_VOID_FLARE_IDS],
  ranged: [11711, 11714, 12815, 11717, 11715, ...YAMA_VOID_FLARE_IDS],
  magic: [11709, 11712, 12816, 14151, 14150, ...YAMA_VOID_FLARE_IDS],
};

export const GUARANTEED_ACCURACY_MONSTERS = [5916];

export const NPC_HARDCODED_MAX_HIT = { 5947: 10, 5961: 10 };

export const TD_IDS = [13599, 13600, 13601, 13602, 13603, 13604, 13605, 13606];

export const TD_PHASES = ["Shielded", "Shielded (Defenceless)", "Unshielded"];

export const ARAXXOR_IDS = [13668];

export const HUEYCOATL_HEAD_IDS = [14009, 14010, 14013];

export const HUEYCOATL_BODY_IDS = [14017];

export const HUEYCOATL_TAIL_IDS = [14014];

export const HUEYCOATL_IDS = [...HUEYCOATL_HEAD_IDS, ...HUEYCOATL_BODY_IDS, ...HUEYCOATL_TAIL_IDS];

export const HUEYCOATL_PHASE_IDS = [...HUEYCOATL_HEAD_IDS, ...HUEYCOATL_TAIL_IDS];

export const DOOM_OF_MOKHAIOTL_IDS = [14707];

export const ABYSSAL_SIRE_TRANSITION_IDS = [5886, 5889, 5891];

export const YAMA_IDS = [14176];

export const INFINITE_HEALTH_MONSTERS = [14779];

export const ECLIPSE_MOON_IDS = [13012];

export const MONSTER_PHASES_BY_ID = {};
TD_IDS.forEach((id) => {
  MONSTER_PHASES_BY_ID[id] = TD_PHASES;
});
ARAXXOR_IDS.forEach((id) => {
  MONSTER_PHASES_BY_ID[id] = ["Standard", "Enraged"];
});
HUEYCOATL_PHASE_IDS.forEach((id) => {
  MONSTER_PHASES_BY_ID[id] = ["Without Pillar", "With Pillar"];
});
TITAN_BOSS_IDS.forEach((id) => {
  MONSTER_PHASES_BY_ID[id] = ["In Melee Range", "Out of Melee Range"];
});
DOOM_OF_MOKHAIOTL_IDS.forEach((id) => {
  MONSTER_PHASES_BY_ID[id] = ["Normal", "Shielded", "Burrowing"];
});
ABYSSAL_SIRE_TRANSITION_IDS.forEach((id) => {
  MONSTER_PHASES_BY_ID[id] = ["Standard", "Transition"];
});
YAMA_IDS.forEach((id) => {
  MONSTER_PHASES_BY_ID[id] = ["Tank using magic", "Tank not using magic"];
});

// ── Weapon Spec Costs ──

export const WEAPON_SPEC_COSTS = {
  "Abyssal dagger": 25,
  "Dragon dagger": 25,
  "Dragon longsword": 25,
  "Dragon mace": 25,
  "Osmumten's fang": 25,
  "Osmumten's fang (or)": 25,
  "Dual macuahuitl": 25,
  "Scorching bow": 25,
  "Dragon knife": 25,
  "Purging staff": 25,
  "Rosewood blowpipe": 25,
  Dawnbringer: 30,
  "Dragon halberd": 30,
  "Crystal halberd": 30,
  "Burning claws": 30,
  "Arkan blade": 30,
  "Magic longbow": 35,
  "Magic comp bow": 35,
  "Dragon sword": 40,
  "Elder maul": 50,
  "Dragon warhammer": 50,
  "Bandos godsword": 50,
  "Saradomin godsword": 50,
  "Accursed sceptre": 50,
  "Accursed sceptre (a)": 50,
  Arclight: 50,
  Emberlight: 50,
  "Tonalztics of ralos": 50,
  "Dragon claws": 50,
  Voidwaker: 50,
  "Toxic blowpipe": 50,
  "Blazing blowpipe": 50,
  "Webweaver bow": 50,
  "Magic shortbow (i)": 50,
  "Ancient godsword": 50,
  "Armadyl godsword": 50,
  "Zamorak godsword": 50,
  "Abyssal bludgeon": 50,
  "Abyssal whip": 50,
  "Barrelchest anchor": 50,
  "Eye of ayak": 50,
  "Magic shortbow": 55,
  "Dark bow": 55,
  "Eldritch nightmare staff": 55,
  "Volatile nightmare staff": 55,
  "Dragon scimitar": 55,
  "Granite hammer": 60,
  "Heavy ballista": 65,
  "Light ballista": 65,
  "Saradomin's blessed sword": 65,
  "Brine sabre": 75,
  "Zaryte crossbow": 75,
  "Saradomin sword": 100,
  Seercull: 100,
};

// ── Cast Stances ──
export const AUTOCAST_STANCES = ["Autocast", "Defensive Autocast"];

export const CAST_STANCES = [...AUTOCAST_STANCES, "Manual Cast"];

// ── Monster Attributes ──
export const MonsterAttribute = {
  DEMON: "demon",
  DRAGON: "dragon",
  FIERY: "fiery",
  FLYING: "flying",
  GOLEM: "golem",
  KALPHITE: "kalphite",
  LEAFY: "leafy",
  PENANCE: "penance",
  RAT: "rat",
  SHADE: "shade",
  SPECTRAL: "spectral",
  UNDEAD: "undead",
  VAMPYRE_1: "vampyre1",
  VAMPYRE_2: "vampyre2",
  VAMPYRE_3: "vampyre3",
  XERICIAN: "xerician",
};

// ── Equipment Categories ──
export const EquipmentCategory = {
  NONE: "",
  TWO_HANDED_SWORD: "2h Sword",
  AXE: "Axe",
  BANNER: "Banner",
  BLADED_STAFF: "Bladed Staff",
  BLASTER: "Blaster",
  BLUDGEON: "Bludgeon",
  BLUNT: "Blunt",
  BOW: "Bow",
  BULWARK: "Bulwark",
  CHINCHOMPA: "Chinchompas",
  CLAW: "Claw",
  CROSSBOW: "Crossbow",
  DAGGER: "Dagger",
  GUN: "Gun",
  PARTISAN: "Partisan",
  PICKAXE: "Pickaxe",
  POLEARM: "Polearm",
  POLESTAFF: "Polestaff",
  POWERED_STAFF: "Powered Staff",
  POWERED_WAND: "Powered Wand",
  SALAMANDER: "Salamander",
  SCYTHE: "Scythe",
  SLASH_SWORD: "Slash Sword",
  SPEAR: "Spear",
  SPIKED: "Spiked",
  STAB_SWORD: "Stab Sword",
  STAFF: "Staff",
  THROWN: "Thrown",
  UNARMED: "Unarmed",
  WHIP: "Whip",
};

// Partially implemented / unimplemented spec lists
export const PARTIALLY_IMPLEMENTED_SPECS = [];

export const UNIMPLEMENTED_SPECS = [];
