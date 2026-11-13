import { createPlan, forecast, type Opportunity, type PlanRow } from './procurement';

/** Illustrative portfolio view. Cancellation uplift is in percentage points, not percent growth. */
export function createRiskView(items: Opportunity[], budget: number, risk: number, asOf: string, cancellationUplift: number) {
  const uplift = Number.isFinite(cancellationUplift) ? cancellationUplift : 0;
  const adjusted = items.map(item => ({ ...item, cancellations: Math.max(0, Math.min(1, item.cancellations + uplift)) }));
  const rows = createPlan(adjusted, budget, risk, { asOf });
  const modeledCancellations = adjusted.reduce((sum, item) => sum + forecast({ ...item, cancellations: 0 }) * item.cancellations, 0);
  return { rows, modeledCancellations, ...summarizeRisk(rows) };
}

export function summarizeRisk(rows: PlanRow[]) {
  return {
    allocatedUnits: rows.reduce((sum, row) => sum + row.qty, 0),
    expectedUnsold: rows.reduce((sum, row) => sum + row.expectedUnsold, 0),
    unsoldExposure: rows.reduce((sum, row) => sum + row.unsoldExposure, 0),
    downsideProfit: rows.reduce((sum, row) => sum + row.downsideProfit, 0),
    spend: rows.reduce((sum, row) => sum + row.spend, 0),
  };
}
