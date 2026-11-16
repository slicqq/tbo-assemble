import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { columns, optionalColumns, readInventoryCSV } from '../src/lib/inventory-csv';
import { validatePlanInput } from '../src/lib/private-plan';
import { INPUT_LIMITS } from '../src/lib/input-limits';
import { syntheticPortfolio } from '../src/lib/synthetic-portfolio';
import type { Opportunity } from '../src/lib/procurement-core';

const header = [...columns, ...optionalColumns];
const toCSV = (items: Opportunity[]) => [header.join(','), ...items.map(item => header.map(key => {
  const value = (item as Record<string, unknown>)[key];
  return value === undefined || value === null ? '' : String(value);
}).join(','))].join('\n');
const message = (fn: () => unknown) => { try { fn(); return ''; } catch (e) { return e instanceof Error ? e.message : String(e); } };

test('the CSV import accepts TBO-sized portfolios (1,000 and 2,000 products)', () => {
  for (const n of [1000, INPUT_LIMITS.maxItems]) {
    const items = syntheticPortfolio(n, 3), parsed = readInventoryCSV(toCSV(items));
    assert.equal(parsed.length, n);
    assert.equal(parsed[n - 1].id, items[n - 1].id);
    assert.equal(parsed[17].capacity, items[17].capacity);
    assert.equal(parsed[17].allotmentCapacity, items[17].allotmentCapacity);
  }
});

test('the CSV import rejects inputs beyond the limits with readable messages', () => {
  const items = syntheticPortfolio(INPUT_LIMITS.maxItems + 1, 4);
  assert.match(message(() => readInventoryCSV(toCSV(items))), /Maximum 2,000 inventory rows per file\./);
  const big = syntheticPortfolio(3, 5);
  assert.match(message(() => readInventoryCSV(toCSV([{ ...big[0], capacity: INPUT_LIMITS.maxUnitsPerProduct + 1 }]))), /Row 2: capacity must be a whole number between 0 and 5000\./);
  assert.equal(readInventoryCSV(toCSV([{ ...big[0], capacity: INPUT_LIMITS.maxUnitsPerProduct, minOrderUnits: undefined }]))[0].capacity, INPUT_LIMITS.maxUnitsPerProduct);
  assert.match(message(() => readInventoryCSV(toCSV([{ ...big[1], allotmentCapacity: INPUT_LIMITS.maxUnitsPerProduct + 1 }]))), /allotmentCapacity must be a whole number from 0 to 5,000/);
  // Total capacity: 101 products × 5,000 units = 505,000 > 500,000.
  const many = syntheticPortfolio(101, 6).map(o => ({ ...o, capacity: INPUT_LIMITS.maxUnitsPerProduct, minOrderUnits: undefined }));
  assert.match(message(() => readInventoryCSV(toCSV(many))), /Total capacity cannot exceed 5,00,000 units\./);
  // Invalid values still fail closed, as before.
  assert.match(message(() => readInventoryCSV(toCSV([{ ...big[2], kind: 'Bus' as never }]))), /kind must be Hotel or Flight/);
  assert.match(message(() => readInventoryCSV(toCSV([{ ...big[2], conversion: 2 }]))), /conversion must be between 0 and 1/);
});

test('saved plans accept the same portfolio sizes as the planner', () => {
  const items = syntheticPortfolio(1000, 8);
  const plan = validatePlanInput({ items, budget: 400000000, risk: 0.35, asOf: '2026-11-16', source: 'uploaded' });
  assert.equal(plan.items.length, 1000);
  assert.match(message(() => validatePlanInput({ items: syntheticPortfolio(INPUT_LIMITS.maxItems + 1, 9), budget: 1, risk: 0.35, asOf: '2026-11-16', source: 'uploaded' })), /A plan needs 1–2,000 inventory items\./);
});
