export const SkillName = {
  Agility: "Agility",
  Attack: "Attack",
  Construction: "Construction",
  Cooking: "Cooking",
  Crafting: "Crafting",
  Defence: "Defence",
  Farming: "Farming",
  Firemaking: "Firemaking",
  Fishing: "Fishing",
  Fletching: "Fletching",
  Herblore: "Herblore",
  Hitpoints: "Hitpoints",
  Hunter: "Hunter",
  Magic: "Magic",
  Mining: "Mining",
  Overall: "Overall",
  Prayer: "Prayer",
  Ranged: "Ranged",
  Runecraft: "Runecraft",
  Slayer: "Slayer",
  Smithing: "Smithing",
  Strength: "Strength",
  Thieving: "Thieving",
  Woodcutting: "Woodcutting",
  Sailing: "Sailing",
};

type SkillNameValue = (typeof SkillName)[keyof typeof SkillName];

const levelLookup = new Map<number, number>();
levelLookup.set(1, 0);
function xpForLevel(level: number): number {
  let xp = 0;
  for (let i = 1; i <= level; ++i) {
    xp += Math.floor(i + 300 * 2 ** (i / 7));
  }
  return Math.floor(0.25 * xp);
}

for (let i = 1; i <= 126; ++i) {
  levelLookup.set(i + 1, xpForLevel(i));
}

export class Skill {
  name: SkillNameValue | string;
  xp: number;
  level: number;

  constructor(name: string, xp: number) {
    this.name = SkillName[name as keyof typeof SkillName] ?? name;
    this.xp = xp;
    this.level = this.name === SkillName.Overall ? 0 : this.calculateLevel();
  }

  static getIcon(skillName: string): string {
    switch (skillName) {
      case SkillName.Attack:
        return "/ui/197-0.png";
      case SkillName.Strength:
        return "/ui/198-0.png";
      case SkillName.Defence:
        return "/ui/199-0.png";
      case SkillName.Ranged:
        return "/ui/200-0.png";
      case SkillName.Prayer:
        return "/ui/201-0.png";
      case SkillName.Magic:
        return "/ui/202-0.png";
      case SkillName.Hitpoints:
        return "/ui/203-0.png";
      case SkillName.Agility:
        return "/ui/204-0.png";
      case SkillName.Herblore:
        return "/ui/205-0.png";
      case SkillName.Thieving:
        return "/ui/206-0.png";
      case SkillName.Crafting:
        return "/ui/207-0.png";
      case SkillName.Fletching:
        return "/ui/208-0.png";
      case SkillName.Mining:
        return "/ui/209-0.png";
      case SkillName.Smithing:
        return "/ui/210-0.png";
      case SkillName.Fishing:
        return "/ui/211-0.png";
      case SkillName.Cooking:
        return "/ui/212-0.png";
      case SkillName.Firemaking:
        return "/ui/213-0.png";
      case SkillName.Woodcutting:
        return "/ui/214-0.png";
      case SkillName.Runecraft:
        return "/ui/215-0.png";
      case SkillName.Slayer:
        return "/ui/216-0.png";
      case SkillName.Farming:
        return "/ui/217-0.png";
      case SkillName.Hunter:
        return "/ui/220-0.png";
      case SkillName.Construction:
        return "/ui/221-0.png";
      case SkillName.Sailing:
        return "/ui/228-0.png";
    }
    return "";
  }

  get icon(): string {
    return Skill.getIcon(this.name);
  }

  calculateLevel(): number {
    if (this.name === SkillName.Overall) return this.level;

    for (let i = 1; i <= 126; ++i) {
      const start = levelLookup.get(i) ?? 0;
      const end = levelLookup.get(i + 1) ?? Number.MAX_SAFE_INTEGER;
      if (this.xp >= start && this.xp < end) {
        return i;
      }
    }
    return 1;
  }

  get levelProgress(): number {
    const currentLevel = this.level;
    const start = levelLookup.get(currentLevel) ?? 0;
    const end = levelLookup.get(currentLevel + 1) ?? start;
    const xpInLevel = this.xp - start;
    return end === start ? 0 : xpInLevel / (end - start);
  }

  get xpUntilNextLevel(): number {
    const nextLevelXp = levelLookup.get(this.level + 1) ?? this.xp;
    return nextLevelXp - this.xp;
  }

  static parseSkillData(skills: Record<string, number>): Record<string, Skill> {
    const result: Record<string, Skill> = {};
    let overallLevel = 0;
    for (const [name, xp] of Object.entries(skills)) {
      const skill = new Skill(name, xp);
      result[name] = skill;
      if (name !== SkillName.Overall) overallLevel += Math.min(99, skill.level);
    }

    if (!result[SkillName.Overall]) {
      result[SkillName.Overall] = new Skill(SkillName.Overall, skills[SkillName.Overall] ?? 0);
    }
    result[SkillName.Overall].level = overallLevel;
    return result;
  }
}
