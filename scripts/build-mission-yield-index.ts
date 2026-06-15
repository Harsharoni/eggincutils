import fs from "fs/promises";
import path from "path";

import eiafxConfig from "../data/eiafx-config.json";
import { isUntargetedTargetAfxId, itemIdToKey } from "../lib/item-utils";
import { loadLootData } from "../lib/loot-data";
import type { DurationType } from "../lib/ship-data";

type MissionDurationConfig = {
  durationType: DurationType;
  seconds: number;
  capacity: number;
  levelCapacityBump: number;
};

type MissionShipConfig = {
  ship: string;
  durations: MissionDurationConfig[];
  levelMissionRequirements: number[];
};

type MissionYieldIndex = {
  schemaVersion: 1;
  generatedAt: string;
  source: {
    minTargetDrops: number;
    minSampleLaunches: number;
    topPerItem: number;
    includeActionYields: boolean;
  };
  actions: MissionYieldAction[];
  byItem: Record<string, ItemPostings>;
};

type MissionYieldAction = {
  id: string;
  missionId: string;
  ship: string;
  durationType: DurationType;
  lootLevel: number;
  targetAfxId: number;
  seconds: number;
  nominalCapacity: number;
  totalDrops: number;
  sampleLaunches: number;
  yields?: Record<string, RarityRates>;
};

type RarityRates = {
  common: number;
  rare: number;
  epic: number;
  legendary: number;
};

type ItemPosting = {
  actionId: string;
  ratePerCapacity: number;
  expectedPerHour: number;
};

type ItemPostings = {
  common: ItemPosting[];
  rare: ItemPosting[];
  epic: ItemPosting[];
  legendary: ItemPosting[];
  allRarities: ItemPosting[];
};

const DEFAULT_OUTPUT_PATH = path.join("data", "mission-yield-index.json");
const DEFAULT_TOP_PER_ITEM = 96;
const DEFAULT_MIN_TARGET_DROPS = 500;
const DEFAULT_MIN_SAMPLE_LAUNCHES = 10;
const UNTARGETED_ONLY_SHIPS = new Set(["CHICKEN_ONE", "CHICKEN_NINE", "CHICKEN_HEAVY", "BCR"]);

const shipConfig = (eiafxConfig as { missionParameters: MissionShipConfig[] }).missionParameters;

function parseArgs(argv: string[]): {
  outputPath: string;
  topPerItem: number;
  minTargetDrops: number;
  minSampleLaunches: number;
  includeActionYields: boolean;
} {
  let outputPath = DEFAULT_OUTPUT_PATH;
  let topPerItem = DEFAULT_TOP_PER_ITEM;
  let minTargetDrops = DEFAULT_MIN_TARGET_DROPS;
  let minSampleLaunches = DEFAULT_MIN_SAMPLE_LAUNCHES;
  let includeActionYields = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    if (arg === "--output" && next) {
      outputPath = next;
      index += 1;
      continue;
    }
    if (arg === "--top-per-item" && next) {
      topPerItem = parsePositiveInteger(next, "--top-per-item");
      index += 1;
      continue;
    }
    if (arg === "--min-target-drops" && next) {
      minTargetDrops = parsePositiveInteger(next, "--min-target-drops");
      index += 1;
      continue;
    }
    if (arg === "--min-sample-launches" && next) {
      minSampleLaunches = parsePositiveInteger(next, "--min-sample-launches");
      index += 1;
      continue;
    }
    if (arg === "--include-action-yields") {
      includeActionYields = true;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
    throw new Error(`unknown or incomplete argument: ${arg}`);
  }

  return {
    outputPath,
    topPerItem,
    minTargetDrops,
    minSampleLaunches,
    includeActionYields,
  };
}

function parsePositiveInteger(raw: string, label: string): number {
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} must be a positive integer`);
  }
  return Math.round(value);
}

function printHelp(): void {
  console.log(`Usage: tsx scripts/build-mission-yield-index.ts [options]

Options:
  --output <path>              Output JSON path. Default: ${DEFAULT_OUTPUT_PATH}
  --top-per-item <count>       Ranked candidates to retain per item/ranking. Default: ${DEFAULT_TOP_PER_ITEM}
  --min-target-drops <count>   Minimum target sample drops. Default: ${DEFAULT_MIN_TARGET_DROPS}
  --min-sample-launches <n>    Minimum sampled launches by nominal capacity. Default: ${DEFAULT_MIN_SAMPLE_LAUNCHES}
  --include-action-yields      Include full per-action sparse rarity yield vectors.
`);
}

function missionConfigFor(missionId: string): {
  ship: string;
  duration: MissionDurationConfig;
} | null {
  for (const ship of shipConfig) {
    for (const duration of ship.durations) {
      if (missionIdFor(ship.ship, duration.durationType) === missionId) {
        return {
          ship: ship.ship,
          duration,
        };
      }
    }
  }
  return null;
}

function missionIdFor(ship: string, durationType: DurationType): string {
  const shipPrefix = ship.toLowerCase().replaceAll("_", "-");
  const suffix: Record<DurationType, string> = {
    TUTORIAL: "tutorial",
    SHORT: "short",
    LONG: "standard",
    EPIC: "extended",
  };
  return `${shipPrefix}-${suffix[durationType]}`;
}

function nominalCapacity(duration: MissionDurationConfig, level: number): number {
  return Math.floor(duration.capacity + duration.levelCapacityBump * Math.max(0, Math.round(level)));
}

function canUseTarget(ship: string, targetAfxId: number): boolean {
  return !UNTARGETED_ONLY_SHIPS.has(ship) || isUntargetedTargetAfxId(targetAfxId);
}

function roundedRate(value: number): number {
  if (!Number.isFinite(value) || Math.abs(value) < 1e-12) {
    return 0;
  }
  return Number(value.toPrecision(12));
}

function postingFor(action: MissionYieldAction, itemKey: string, ratePerCapacity: number): ItemPosting {
  return {
    actionId: action.id,
    ratePerCapacity: roundedRate(ratePerCapacity),
    expectedPerHour: roundedRate(ratePerCapacity * action.nominalCapacity * 3600 / action.seconds),
  };
}

function sortPostings(a: ItemPosting, b: ItemPosting): number {
  const scoreDiff = b.expectedPerHour - a.expectedPerHour;
  if (Math.abs(scoreDiff) > 1e-12) {
    return scoreDiff;
  }
  const rateDiff = b.ratePerCapacity - a.ratePerCapacity;
  if (Math.abs(rateDiff) > 1e-12) {
    return rateDiff;
  }
  return a.actionId.localeCompare(b.actionId);
}

async function writeJson(filePath: string, payload: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.tmp`;
  await fs.writeFile(tempPath, `${JSON.stringify(payload)}\n`, "utf8");
  await fs.rename(tempPath, filePath);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const loot = await loadLootData();
  const actions: MissionYieldAction[] = [];
  const commonPostingsByItem = new Map<string, ItemPosting[]>();
  const rarePostingsByItem = new Map<string, ItemPosting[]>();
  const epicPostingsByItem = new Map<string, ItemPosting[]>();
  const legendaryPostingsByItem = new Map<string, ItemPosting[]>();
  const allPostingsByItem = new Map<string, ItemPosting[]>();

  for (const mission of loot.missions) {
    const config = missionConfigFor(mission.missionId);
    if (!config) {
      continue;
    }

    for (const level of mission.levels) {
      const capacity = nominalCapacity(config.duration, level.level);
      if (capacity <= 0) {
        continue;
      }

      for (const target of level.targets) {
        if (!canUseTarget(config.ship, target.targetAfxId)) {
          continue;
        }
        if (target.totalDrops < args.minTargetDrops) {
          continue;
        }
        const sampleLaunches = target.totalDrops / capacity;
        if (sampleLaunches < args.minSampleLaunches) {
          continue;
        }

        const yields: Record<string, RarityRates> = {};
        for (const item of target.items) {
          const itemKey = itemIdToKey(item.itemId);
          const rates: RarityRates = {
            common: roundedRate((item.counts[0] || 0) / target.totalDrops),
            rare: roundedRate((item.counts[1] || 0) / target.totalDrops),
            epic: roundedRate((item.counts[2] || 0) / target.totalDrops),
            legendary: roundedRate((item.counts[3] || 0) / target.totalDrops),
          };
          if (rates.common + rates.rare + rates.epic + rates.legendary <= 0) {
            continue;
          }
          yields[itemKey] = rates;
        }

        if (Object.keys(yields).length === 0) {
          continue;
        }

        const action: MissionYieldAction = {
          id: `${mission.missionId}|L${level.level}|T${target.targetAfxId}`,
          missionId: mission.missionId,
          ship: config.ship,
          durationType: config.duration.durationType,
          lootLevel: level.level,
          targetAfxId: target.targetAfxId,
          seconds: config.duration.seconds,
          nominalCapacity: capacity,
          totalDrops: Math.round(target.totalDrops),
          sampleLaunches: roundedRate(sampleLaunches),
        };
        if (args.includeActionYields) {
          action.yields = yields;
        }
        actions.push(action);

        for (const [itemKey, rates] of Object.entries(yields)) {
          if (rates.common > 0) {
            const postings = commonPostingsByItem.get(itemKey) || [];
            postings.push(postingFor(action, itemKey, rates.common));
            commonPostingsByItem.set(itemKey, postings);
          }
          if (rates.rare > 0) {
            const postings = rarePostingsByItem.get(itemKey) || [];
            postings.push(postingFor(action, itemKey, rates.rare));
            rarePostingsByItem.set(itemKey, postings);
          }
          if (rates.epic > 0) {
            const postings = epicPostingsByItem.get(itemKey) || [];
            postings.push(postingFor(action, itemKey, rates.epic));
            epicPostingsByItem.set(itemKey, postings);
          }
          if (rates.legendary > 0) {
            const postings = legendaryPostingsByItem.get(itemKey) || [];
            postings.push(postingFor(action, itemKey, rates.legendary));
            legendaryPostingsByItem.set(itemKey, postings);
          }
          const allRarityRate = rates.common + rates.rare + rates.epic + rates.legendary;
          if (allRarityRate > 0) {
            const postings = allPostingsByItem.get(itemKey) || [];
            postings.push(postingFor(action, itemKey, allRarityRate));
            allPostingsByItem.set(itemKey, postings);
          }
        }
      }
    }
  }

  actions.sort((a, b) => a.id.localeCompare(b.id));
  const itemKeys = Array.from(
    new Set([
      ...commonPostingsByItem.keys(),
      ...rarePostingsByItem.keys(),
      ...epicPostingsByItem.keys(),
      ...legendaryPostingsByItem.keys(),
      ...allPostingsByItem.keys(),
    ])
  ).sort();
  const byItem: Record<string, ItemPostings> = {};
  for (const itemKey of itemKeys) {
    byItem[itemKey] = {
      common: (commonPostingsByItem.get(itemKey) || []).sort(sortPostings).slice(0, args.topPerItem),
      rare: (rarePostingsByItem.get(itemKey) || []).sort(sortPostings).slice(0, args.topPerItem),
      epic: (epicPostingsByItem.get(itemKey) || []).sort(sortPostings).slice(0, args.topPerItem),
      legendary: (legendaryPostingsByItem.get(itemKey) || []).sort(sortPostings).slice(0, args.topPerItem),
      allRarities: (allPostingsByItem.get(itemKey) || []).sort(sortPostings).slice(0, args.topPerItem),
    };
  }

  const output: MissionYieldIndex = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    source: {
      minTargetDrops: args.minTargetDrops,
      minSampleLaunches: args.minSampleLaunches,
      topPerItem: args.topPerItem,
      includeActionYields: args.includeActionYields,
    },
    actions,
    byItem,
  };

  await writeJson(args.outputPath, output);
  console.log(`Wrote ${args.outputPath}`);
  console.log(`${actions.length.toLocaleString()} mission yield actions`);
  console.log(`${itemKeys.length.toLocaleString()} item posting lists`);
}

void main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`build mission yield index failed: ${message}`);
  process.exit(1);
});
