import { coverageFor } from './inventory-coverage';
import type { PlanRow } from './procurement-core';

/**
 * Supplier-integration priorities built from the demand the plan leaves unserved.
 *
 * Pre-buying is only one way to serve demand. Where the plan stops committing (budget, risk or the
 * supplier's capacity), the remaining demand is either lost or served through connectivity: free-sale
 * or on-request API inventory, a bigger allotment, or a second supplier. This list ranks products by
 * the booking value of that unserved demand so the supplier/integration team knows where to start.
 * Works for both engines (coverage comes from the same scenarios the optimiser used).
 */
export type SupplierAction = 'Refresh supplier quote' | 'Negotiate more units' | 'Extend allotment' | 'Connect free-sale / API supply' | 'Top up with free-sale';

export type SupplierPriority = {
  rank: number; id: string; name: string; destination: string; kind: PlanRow['kind']; period: string; integration: string;
  /** Expected unserved units after existing stock and the plan's commitments. */
  unmet: number;
  /** Unserved units in a strong season (P90 for risk-cvar-v5, the high case for v4): how much extra supply to connect. */
  highUnmet: number;
  /** Expected unserved units × selling price: booking value that goes to competitors without extra supply. */
  unmetValue: number;
  committed: number; capacity: number;
  action: SupplierAction; reason: string;
};

const fmt = (n: number) => Math.round(n).toLocaleString('en-IN');

/** `budget` lets the reasons say when the budget, rather than risk, stops further commitment. */
export function supplierPriorities(rows: PlanRow[], options: { budget?: number; minUnits?: number } = {}): SupplierPriority[] {
  const minUnits = options.minUnits ?? 1;
  const spend = rows.reduce((sum, row) => sum + Math.max(0, row.spend), 0);
  const budgetBound = options.budget !== undefined && options.budget > 0 && spend >= 0.99 * options.budget;
  const list: Omit<SupplierPriority, 'rank'>[] = [];
  for (const row of rows) {
    const c = coverageFor(row);
    if (!(c.unmet >= minUnits)) continue;
    const unit = row.kind === 'Flight' ? 'seats' : 'room-nights';
    const committed = Math.max(0, row.qty), capacity = Math.max(0, row.capacity);
    const prepaid = row.prepaidQty ?? row.qty, allotment = row.allotQty ?? 0;
    const allotmentRoom = Math.min(row.allotmentCapacity ?? 0, Math.max(0, capacity - prepaid));
    const expired = row.purchaseTiming === 'Quote expired' || row.strategy === 'Refresh supplier quote';
    const price = row.qty > 0 ? row.price : row.referencePrice;
    const gap = `About ${fmt(c.unmet)} ${unit} of modelled demand stay unserved (${fmt(c.highUnmet)} in a strong season).`;
    let action: SupplierAction, reason: string;
    if (expired) {
      action = 'Refresh supplier quote';
      reason = `${gap} The quote has expired, so nothing can be committed until it is refreshed.`;
    } else if (capacity > 0 && committed >= capacity) {
      action = 'Negotiate more units';
      reason = `${gap} The plan already takes all ${fmt(capacity)} ${unit} on offer; ask this supplier for more or add a second supplier.`;
    } else if (allotment > 0 && allotment >= allotmentRoom) {
      action = 'Extend allotment';
      reason = `${gap} The allotment is fully used; a larger allotment adds cover with only the deposit at risk.`;
    } else if (committed === 0) {
      action = 'Connect free-sale / API supply';
      reason = `${gap} Committing does not pay at this budget and risk setting; serve it through free-sale or on-request supply with no capital at risk.`;
    } else {
      action = 'Top up with free-sale';
      reason = budgetBound
        ? `${gap} The budget is fully committed; route the rest to free-sale or on-request supply, or raise the budget.`
        : `${gap} More commitment would add more unsold risk than profit; route the rest to free-sale or on-request supply.`;
    }
    list.push({
      id: row.id, name: row.name, destination: row.destination, kind: row.kind, period: row.period, integration: row.integration,
      unmet: c.unmet, highUnmet: c.highUnmet, unmetValue: c.unmet * price, committed, capacity, action, reason: `${reason} Current channel: ${row.integration}.`,
    });
  }
  return list.sort((a, b) => b.unmetValue - a.unmetValue || a.id.localeCompare(b.id)).map((item, i) => ({ ...item, rank: i + 1 }));
}
