import { columns, optionalColumns, readInventoryCSV } from './inventory-csv';
import type { Opportunity } from './procurement';

export const PLAN_MODEL_VERSION = 'scenario-greedy-v2';
export type PlanInput = { items: Opportunity[]; budget: number; risk: number; asOf: string; source: 'synthetic' | 'uploaded' };

// Treat even persisted JSON as untrusted. Reuse the import validation and limits
// before it can reach the potentially expensive planner.
export function validatePlanInput(input: unknown): PlanInput {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid plan.');
  const obj = input as Record<string, unknown>;
  const { items, budget, risk, asOf, source } = obj;
  if (!Array.isArray(items) || items.length < 1 || items.length > 20) throw new Error('A plan needs 1–20 inventory items.');
  if (typeof budget !== 'number' || !Number.isFinite(budget) || budget < 0 || budget > 1e9 || !Number.isInteger(budget)) throw new Error('Invalid budget.');
  if (typeof risk !== 'number' || !Number.isFinite(risk) || risk < 0 || risk > .8) throw new Error('Invalid risk setting.');
  if (typeof asOf !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(asOf) || !Number.isFinite(Date.parse(asOf + 'T00:00:00Z')) || new Date(asOf + 'T00:00:00Z').toISOString().slice(0,10) !== asOf) throw new Error('Invalid quote review date.');
  if (asOf < '1900-01-01' || asOf > '2100-12-31') throw new Error('Quote review date must be between 1900 and 2100.');
  if (source !== 'synthetic' && source !== 'uploaded') throw new Error('Invalid data source.');
  const keys = [...columns, ...optionalColumns];
  const rows = items.map(item => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('Invalid inventory item.');
    return keys.map(key => {
      const value = (item as Record<string, unknown>)[key];
      if (value != null && typeof value !== 'string' && typeof value !== 'number') throw new Error('Invalid inventory value.');
      return `"${String(value ?? '').replaceAll('"','""')}"`;
    }).join(',');
  });
  return { items: readInventoryCSV([keys.join(','), ...rows].join('\n')), budget, risk, asOf, source };
}
