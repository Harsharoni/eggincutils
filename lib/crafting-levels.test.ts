import { describe, expect, it } from "vitest";

import { getCraftingLevelProgress, getCraftingLevelTotalXpForLevel } from "./crafting-levels";

describe("getCraftingLevelProgress", () => {
  it("uses cumulative crafting XP requirements", () => {
    const progress = getCraftingLevelProgress(393_454_167);

    expect(progress.level).toBe(19);
    expect(progress.xpIntoLevel).toBe(147_511_167);
    expect(progress.xpForLevel).toBe(150_000_000);
    expect(progress.nextLevelXp).toBe(395_943_000);
  });

  it("returns total XP thresholds for crafting levels", () => {
    expect(getCraftingLevelTotalXpForLevel(1)).toBe(0);
    expect(getCraftingLevelTotalXpForLevel(19)).toBe(245_943_000);
    expect(getCraftingLevelTotalXpForLevel(30)).toBe(5_070_943_000);
  });
});
