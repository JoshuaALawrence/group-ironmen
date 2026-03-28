export interface EventIconEntry {
  id: string;
  src: string;
}

export interface EventIconCategory {
  category: string;
  icons: EventIconEntry[];
}

export const EVENT_ICON_CATEGORIES: EventIconCategory[] = [
  {
    category: "Bosses",
    icons: [
      "general_graardor", "commander_zilyana", "kreearra", "kril_tsutsaroth",
      "corporeal_beast", "chambers_of_xeric", "theatre_of_blood", "tombs_of_amascut",
      "tombs_of_amascut_expert", "the_gauntlet", "the_corrupted_gauntlet",
      "nex", "nightmare", "vorkath", "zulrah", "cerberus", "alchemical_hydra",
      "king_black_dragon", "kalphite_queen", "giant_mole", "dagannoth_kings",
      "kraken", "thermonuclear_smoke_devil", "grotesque_guardians",
      "phantom_muspah", "duke_sucellus", "the_leviathan", "the_whisperer", "vardorvis",
      "araxxor", "the_hueycoatl", "sol_heredit",
      "barrows_chests", "sarachnis", "scorpia", "chaos_elemental",
      "wintertodt", "tempoross", "zalcano",
      "tzkal_zuk", "tztok_jad", "skotizo",
    ].map((n) => ({ id: `boss:${n}`, src: `/images/boss-icons/${n}_icon.png` })),
  },
  {
    category: "Skills",
    icons: [
      "Strength", "Defence", "Ranged", "Prayer", "Magic",
      "Hitpoints", "Runecraft", "Crafting", "Mining", "Smithing",
      "Fishing", "Cooking", "Firemaking", "Woodcutting", "Agility",
      "Herblore", "Thieving", "Fletching", "Slayer", "Farming",
      "Hunter",
    ].map((n) => ({ id: `skill:${n}`, src: `/images/skills/${n}_icon_(detail).png` })).concat([
      { id: "skill:Attack", src: "/images/skills/24px-Attack_icon_(detail).png" },
      { id: "skill:Construction", src: "/images/skills/24px-Construction_icon_(detail).png" },
    ]),
  },
  {
    category: "Activities",
    icons: [
      { id: "misc:diary", src: "/images/misc/diary.png" },
      { id: "misc:slayer", src: "/images/misc/slayer.webp" },
      { id: "misc:skull", src: "/images/misc/skull.webp" },
      { id: "misc:chinchompa", src: "/images/misc/chinchompa.png" },
      { id: "summary:clue_scrolls_all", src: "/images/summary-icons/clue_scrolls_all.png" },
      { id: "summary:colosseum_glory", src: "/images/summary-icons/colosseum_glory.png" },
      { id: "summary:soul_wars_zeal", src: "/images/summary-icons/soul_wars_zeal.png" },
      { id: "summary:last_man_standing", src: "/images/summary-icons/last_man_standing.png" },
      { id: "tab:combat", src: "/images/tabs/combat.png" },
      { id: "tab:prayer", src: "/images/tabs/prayer.png" },
      { id: "tab:equipment", src: "/images/tabs/equipment.png" },
      { id: "img:raids", src: "/images/raids_icon.webp" },
    ],
  },
];

const ICON_SRC_MAP: Record<string, string> = {};
for (const cat of EVENT_ICON_CATEGORIES) {
  for (const ic of cat.icons) {
    ICON_SRC_MAP[ic.id] = ic.src;
  }
}

export function iconSrc(iconId: string): string {
  return ICON_SRC_MAP[iconId] || "";
}
