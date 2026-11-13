export type InventoryOption = {
  id: string;
  roomType: string;
  supplier: string;
  buyRate: number;
  currentBlock: number;
  booked: number;
};

export type OptimizationInputs = {
  budget: number;
  roomDemand: number;
  sellMarkupPct: number;
  cancellationPct: number;
  marketSignalPct: number;
};

export type InventoryRecommendation = InventoryOption & {
  demandTarget: number;
  buyQty: number;
  sellRate: number;
  expectedProfit: number;
  expectedRevenue: number;
  budgetUsed: number;
  unsoldExposure: number;
  sellThroughPct: number;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/**
 * Risk-aware budget allocation. It first estimates demand by room-type share,
 * then allocates available budget to the highest expected profit per rupee.
 * Market uplift is an explicit user-entered signal, not an external data feed.
 */
export function optimizeInventory(
  options: InventoryOption[],
  inputs: OptimizationInputs,
): InventoryRecommendation[] {
  if (options.length === 0) return [];

  const totalBlock = options.reduce((sum, option) => sum + Math.max(0, option.currentBlock), 0);
  const weightedShare = options.map((option) =>
    totalBlock > 0 ? Math.max(0, option.currentBlock) / totalBlock : 1 / options.length,
  );
  const effectiveDemand = Math.max(
    0,
    Math.ceil(inputs.roomDemand * (1 + inputs.marketSignalPct / 100) * (1 - inputs.cancellationPct / 100)),
  );
  const cancelFactor = clamp(1 - inputs.cancellationPct / 100, 0, 1);
  const budget = Math.max(0, inputs.budget);

  const rows = options.map((option, index) => {
    const demandTarget = Math.max(0, Math.ceil(effectiveDemand * weightedShare[index]));
    const remainingDemand = Math.max(0, demandTarget - Math.max(option.currentBlock, option.booked));
    const sellRate = Math.max(0, option.buyRate * (1 + inputs.sellMarkupPct / 100));
    const expectedUnitProfit = sellRate * cancelFactor - option.buyRate;
    const demandCoverage = demandTarget > 0
      ? clamp((demandTarget - option.booked) / Math.max(1, remainingDemand), 0, 1)
      : 0;
    const sellThroughPct = Math.round(clamp(cancelFactor * demandCoverage, 0, 1) * 100);
    const riskAdjustedUnitProfit = expectedUnitProfit * (sellThroughPct / 100);

    return {
      ...option,
      demandTarget,
      remainingDemand,
      sellRate,
      expectedUnitProfit,
      riskAdjustedUnitProfit,
      sellThroughPct,
      buyQty: 0,
    };
  });

  // Greedy discrete allocation maximizes risk-adjusted profit under budget and
  // forecast-demand constraints. A zero/negative return never gets purchased.
  const ranked = [...rows].sort((a, b) => b.riskAdjustedUnitProfit - a.riskAdjustedUnitProfit);
  let remainingBudget = budget;
  for (const row of ranked) {
    if (row.buyRate <= 0 || row.riskAdjustedUnitProfit <= 0) continue;
    const affordable = Math.floor(remainingBudget / row.buyRate);
    row.buyQty = Math.min(row.remainingDemand, affordable);
    remainingBudget -= row.buyQty * row.buyRate;
  }

  return rows.map((row) => {
    const budgetUsed = row.buyQty * row.buyRate;
    const expectedRevenue = row.buyQty * row.sellRate * cancelFactor;
    const expectedProfit = expectedRevenue - budgetUsed;
    const unsoldExposure = Math.max(0, budgetUsed - expectedRevenue);
    return {
      id: row.id,
      roomType: row.roomType,
      supplier: row.supplier,
      buyRate: row.buyRate,
      currentBlock: row.currentBlock,
      booked: row.booked,
      demandTarget: row.demandTarget,
      buyQty: row.buyQty,
      sellRate: row.sellRate,
      expectedProfit,
      expectedRevenue,
      budgetUsed,
      unsoldExposure,
      sellThroughPct: row.sellThroughPct,
    };
  });
}
