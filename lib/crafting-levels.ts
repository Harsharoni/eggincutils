import eiafxConfig from "../data/eiafx-config.json";

type CraftingLevelInfo = {
  xpRequired?: number;
  rarityMult?: number;
};

type CraftingLevelProgress = {
  level: number;
  maxLevel: number;
  xp: number;
  nextLevelXp: number | null;
  xpIntoLevel: number;
  xpForLevel: number | null;
};

const craftingLevelInfos = (eiafxConfig.craftingLevelInfos || []) as CraftingLevelInfo[];
const MAX_CRAFTING_LEVEL = craftingLevelInfos.length || 30;
const LEVEL_XP_REQUIREMENTS = craftingLevelInfos
  .slice(0, Math.max(0, craftingLevelInfos.length - 1))
  .map((entry) => Math.max(0, Math.round(entry.xpRequired || 0)))
  .filter((xp) => xp > 0);

const LEVEL_TOTAL_XP_THRESHOLDS = (() => {
  const thresholds = [0];
  let total = 0;
  for (const requirement of LEVEL_XP_REQUIREMENTS) {
    total += requirement;
    thresholds.push(total);
  }
  return thresholds;
})();

export function getCraftingLevelTotalXpForLevel(level: number): number {
  const normalizedLevel = Math.max(1, Math.min(MAX_CRAFTING_LEVEL, Math.round(level)));
  return LEVEL_TOTAL_XP_THRESHOLDS[normalizedLevel - 1] || 0;
}

export function getCraftingLevelThresholds(): Array<{ level: number; xp: number }> {
  return Array.from({ length: MAX_CRAFTING_LEVEL }, (_, index) => ({
    level: index + 1,
    xp: LEVEL_TOTAL_XP_THRESHOLDS[index] || 0,
  }));
}

export function getCraftingLevelProgress(rawXp: number): CraftingLevelProgress {
  const xp = Math.max(0, Math.floor(Number.isFinite(rawXp) ? rawXp : 0));
  let level = 1;
  let previousLevelXp = 0;
  for (const requirement of LEVEL_XP_REQUIREMENTS) {
    if (xp < previousLevelXp + requirement) {
      break;
    }
    previousLevelXp += requirement;
    level += 1;
  }

  level = Math.min(MAX_CRAFTING_LEVEL, level);
  const xpForLevel = level >= MAX_CRAFTING_LEVEL ? null : LEVEL_XP_REQUIREMENTS[level - 1] ?? null;
  const nextLevelXp = xpForLevel == null ? null : previousLevelXp + xpForLevel;
  return {
    level,
    maxLevel: MAX_CRAFTING_LEVEL,
    xp,
    nextLevelXp,
    xpIntoLevel: Math.max(0, xp - previousLevelXp),
    xpForLevel,
  };
}
