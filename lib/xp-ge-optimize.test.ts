import { describe, expect, it } from "vitest";

import { buildMaxXpExecutionPlan, optimizeCrafts, type Highs, type MaxXpExecutionPlanNode, type SolutionCraftRow } from "./xp-ge-optimize";

function solutionRow(count: number): SolutionCraftRow {
  return {
    count,
    xp: 0,
    cost: 0,
    xpPerGe: 0,
    xpPerCraft: 0,
    costDetails: {
      baseCost: 0,
      discountedCost: 0,
      totalDirectCost: 0,
      craftCount: 0,
      discountPercent: 0,
      recursiveCost: 0,
      ingredients: [],
      saleApplied: false,
    },
    modeComparison: {
      direct: { count, xp: 0, cost: 0, xpPerGe: 0 },
      auto: null,
    },
  };
}

function collectNodes(nodes: MaxXpExecutionPlanNode[]): MaxXpExecutionPlanNode[] {
  const collected: MaxXpExecutionPlanNode[] = [];
  const visit = (node: MaxXpExecutionPlanNode) => {
    collected.push(node);
    for (const child of node.children) {
      visit(child);
    }
  };
  for (const node of nodes) {
    visit(node);
  }
  return collected;
}

describe("buildMaxXpExecutionPlan", () => {
  it("promotes planned crafts that would be suppressed by existing ingredient inventory", () => {
    const plan = buildMaxXpExecutionPlan(
      {
        crafts: {
          tachyon_deflector_4: solutionRow(1),
          tachyon_deflector_3: solutionRow(12),
        },
        totalXp: 0,
        totalCost: 0,
      },
      {
        tachyon_deflector_3: 5,
        tachyon_deflector_2: 120,
        quantum_metronome_4: 12,
        ship_in_a_bottle_4: 4,
      },
      {},
      ["tachyon_deflector_4", "tachyon_deflector_3"]
    );

    expect(plan.steps.map((step) => `${step.mode}:${step.artifact}:${step.count}`)).toEqual([
      "click:tachyon_deflector_4:1",
      "click:tachyon_deflector_3:5",
    ]);
    expect(plan.steps[0].children.map((step) => `${step.mode}:${step.artifact}:${step.count}`)).toEqual([
      "auto:tachyon_deflector_3:7",
    ]);
    expect(collectNodes(plan.steps).every((node) => (node.mode === "click") === plan.steps.includes(node))).toBe(true);
    expect(plan.finalCraftCounts.tachyon_deflector_4).toBe(1);
    expect(plan.finalCraftCounts.tachyon_deflector_3).toBe(12);
    expect(plan.remainingInventory.tachyon_deflector_3).toBe(5);
    expect(plan.usage.tachyon_deflector_3.manualCrafts).toBe(5);
    expect(plan.usage.tachyon_deflector_3.autoCrafts).toBe(7);
    expect(plan.usage.tachyon_deflector_3.inventoryConsumed).toBe(5);
    expect(plan.usage.tachyon_deflector_3.consumedBy.tachyon_deflector_4).toBe(12);
  });

  it("keeps promoted and originally top-level crafts in one main row", () => {
    const plan = buildMaxXpExecutionPlan(
      {
        crafts: {
          tachyon_deflector_4: solutionRow(1),
          tachyon_deflector_3: solutionRow(65),
        },
        totalXp: 0,
        totalCost: 0,
      },
      {
        tachyon_deflector_3: 5,
        tachyon_deflector_2: 650,
        quantum_metronome_4: 65,
        ship_in_a_bottle_4: 4,
      },
      {},
      ["tachyon_deflector_4", "tachyon_deflector_3"]
    );

    expect(plan.steps.map((step) => `${step.mode}:${step.artifact}:${step.count}`)).toEqual([
      "click:tachyon_deflector_4:1",
      "click:tachyon_deflector_3:58",
    ]);
    expect(plan.steps[0].children.map((step) => `${step.mode}:${step.artifact}:${step.count}`)).toEqual([
      "auto:tachyon_deflector_3:7",
    ]);
    expect(plan.usage.tachyon_deflector_3.manualCrafts).toBe(58);
    expect(plan.usage.tachyon_deflector_3.autoCrafts).toBe(7);
  });
});

describe("optimizeCrafts manual limits", () => {
  it("adds manual craft cap constraints without hard-capping total crafts", () => {
    let capturedProblem = "";
    const highs: Highs = {
      solve(problem) {
        capturedProblem = problem;
        return { Columns: {} };
      },
    };

    optimizeCrafts(highs, { tachyon_deflector_3: 49 }, {}, false, { tachyon_deflector_3: 0 });

    expect(capturedProblem).toContain("Binary");
    expect(capturedProblem).toContain("manual_limit_branch_tachyon_deflector_3");
    expect(capturedProblem).toContain("ml_tachyon_deflector_3_cap_under_inventory");
    expect(capturedProblem).toContain("ml_tachyon_deflector_3_cap_over_inventory");
    expect(capturedProblem).not.toMatch(/\n\s+tachyon_deflector_3 <= 0/);
  });
});
