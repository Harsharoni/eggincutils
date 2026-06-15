import { describe, expect, it } from "vitest";

import type { LootJson } from "./loot-data";
import { applyPrePlanSendsToProfile } from "./preplan-sends";
import type { PlayerProfile } from "./profile";
import { buildMissionOptions, computeShipLevelsFromLaunchCounts } from "./ship-data";

function makeProfile(): PlayerProfile {
  const shipLevels = computeShipLevelsFromLaunchCounts({});
  return {
    eid: "test",
    inventory: {},
    craftCounts: {},
    craftingXp: 0,
    epicResearchFTLLevel: 0,
    epicResearchZerogLevel: 0,
    shipLevels,
    missionOptions: buildMissionOptions(shipLevels, 0, 0),
  };
}

describe("applyPrePlanSendsToProfile", () => {
  it("adds expected untargeted mission drops and updates launch counts", async () => {
    const profile = makeProfile();
    const option = profile.missionOptions.find(
      (candidate) => candidate.ship === "CHICKEN_ONE" && candidate.durationType === "SHORT"
    );
    expect(option).toBeTruthy();

    const lootData: LootJson = {
      missions: [
        {
          afxShip: 0,
          afxDurationType: 0,
          missionId: "chicken-one-short",
          levels: [
            {
              level: 0,
              targets: [
                {
                  targetAfxId: 10000,
                  totalDrops: 100_000,
                  items: [
                    {
                      afxId: 0,
                      afxLevel: 1,
                      itemId: "lunar-totem-1",
                      counts: [10_000, 0, 0, 0],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };

    const result = await applyPrePlanSendsToProfile(
      profile,
      [{ ship: "CHICKEN_ONE", durationType: "SHORT", targetAfxId: 10000, launches: 2 }],
      { lootData }
    );

    expect(result.appliedLaunches).toBe(2);
    expect(result.skippedLaunches).toBe(0);
    expect(result.addedInventory.lunar_totem_1).toBeGreaterThan(0);
    expect(result.profile.inventory.lunar_totem_1).toBe(result.addedInventory.lunar_totem_1);
    expect(result.profile.shipLevels.find((ship) => ship.ship === "CHICKEN_ONE")?.launchesByDuration.SHORT).toBe(2);
  });

  it("skips targeted sends for untargeted-only ships", async () => {
    const result = await applyPrePlanSendsToProfile(
      makeProfile(),
      [{ ship: "CHICKEN_ONE", durationType: "SHORT", targetAfxId: 1, launches: 1 }],
      { lootData: { missions: [] } }
    );

    expect(result.appliedLaunches).toBe(0);
    expect(result.skippedLaunches).toBe(1);
    expect(result.addedInventory).toEqual({});
  });
});
