import assert from 'node:assert/strict';
import { csvTemplate, readInventoryCSV, columns, optionalColumns } from '../src/lib/inventory-csv';
import { opportunities } from '../src/lib/procurement-core';
import { optimizePortfolio } from '../src/lib/portfolio-optimizer';

// The four optional risk-cvar-v5 columns parse from the template.
const rows = readInventoryCSV(csvTemplate);
assert.equal(rows[0].allotmentBuy, 6850);
assert.equal(rows[0].allotmentDepositPct, 0.25);
assert.equal(rows[0].allotmentCapacity, 60);
assert.equal(rows[0].soldOutSearches, 640);

// Round-trip the synthetic dataset through CSV (saved plans and downloads use this path).
const keys = [...columns, ...optionalColumns];
const cell = (v: unknown) => `"${String(v ?? '').replaceAll('"', '""')}"`;
const csv = [keys.join(','), ...opportunities.map(o => keys.map(k => cell((o as Record<string, unknown>)[k])).join(','))].join('\n');
const back = readInventoryCSV(csv);
for (let i = 0; i < opportunities.length; i++)
  for (const k of ['allotmentBuy', 'allotmentDepositPct', 'allotmentCapacity'] as const)
    assert.equal(back[i][k], opportunities[i][k], `${opportunities[i].id}.${k}`);

// Out-of-range values are rejected with the column name.
assert.throws(() => readInventoryCSV(csvTemplate.replace(',6850,0.25,60,640', ',6850,0.25,5001,640')), /allotmentCapacity/); // above the 5,000-unit limit (src/lib/input-limits.ts)
assert.throws(() => readInventoryCSV(csvTemplate.replace(',6850,0.25,60,640', ',6850,1.5,60,640')), /allotmentDepositPct/);

// Files without the new columns still load and plan exactly as before (backwards compatible).
const v5Columns = ['allotmentBuy', 'allotmentDepositPct', 'allotmentCapacity', 'soldOutSearches'];
const legacyKeys = keys.filter(k => !v5Columns.includes(k));
const legacyCsv = [legacyKeys.join(','), ...opportunities.map(o => legacyKeys.map(k => cell((o as Record<string, unknown>)[k])).join(','))].join('\n');
const legacy = readInventoryCSV(legacyCsv);
assert.ok(legacy.every(o => o.allotmentBuy === undefined && o.soldOutSearches === undefined));
const plan = optimizePortfolio(legacy, 2_000_000, 0.35, { asOf: '2026-11-16', engine: 'risk-cvar-v5' }).rows;
assert.ok(plan.reduce((s, r) => s + r.spend, 0) <= 2_000_000);
assert.ok(plan.every(r => (r.allotQty ?? 0) === 0), 'no allotment terms → no allotment units');
console.log('inventory CSV allotment columns: parse, round-trip, validation and backwards compatibility ok');
