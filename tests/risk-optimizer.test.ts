import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { optimizePortfolio, engineOf } from '../src/lib/portfolio-optimizer';
import { opportunities, type Opportunity } from '../src/lib/procurement-core';
import { evaluateDecisions, riskModelInternals, smallestMean, RISK_ENGINE_DEFAULTS } from '../src/lib/risk-optimizer';
import { buildScenarioSet, regionOf } from '../src/lib/risk-scenarios';
import { simulatePortfolioStress } from '../src/lib/portfolio-stress';
import { compareBudgets } from '../src/lib/budget-comparison';

const asOf = '2026-11-16';
const engine = 'risk-cvar-v5' as const;
let seed = 4242;
const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

test('smallest-k mean matches a full sort', () => {
  for (let trial = 0; trial < 200; trial++) {
    const n = 1 + Math.floor(rand() * 300), values = Float64Array.from({ length: n }, () => Math.round((rand() - 0.4) * 1000) / 7);
    const k = 1 + Math.floor(rand() * n), sorted = Array.from(values).sort((a, b) => a - b);
    const expected = sorted.slice(0, k).reduce((a, b) => a + b, 0) / k;
    assert.ok(Math.abs(smallestMean(values, k) - expected) < 1e-9, `trial ${trial}`);
  }
});

test('scenario sets are deterministic, keyed per product and correlated by region', () => {
  const a = buildScenarioSet(opportunities, 4000, 7), b = buildScenarioSet(opportunities, 4000, 7);
  assert.deepEqual(Array.from(a.demand[3].slice(0, 50)), Array.from(b.demand[3].slice(0, 50)));
  const edited = buildScenarioSet(opportunities.map(o => o.id === 'goa' ? { ...o, volatility: 0.6 } : o), 4000, 7);
  assert.deepEqual(Array.from(edited.demand[1].slice(0, 200)), Array.from(a.demand[1].slice(0, 200)), 'editing Goa must not reshuffle Dubai');
  const log = (i: number) => Array.from(a.demand[i], v => Math.log(Math.max(v, 1e-9)));
  const corr = (x: number[], y: number[]) => { const mx = x.reduce((s, v) => s + v, 0) / x.length, my = y.reduce((s, v) => s + v, 0) / y.length; let sxy = 0, sxx = 0, syy = 0; for (let i = 0; i < x.length; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) ** 2; syy += (y[i] - my) ** 2; } return sxy / Math.sqrt(sxx * syy); };
  const idx = (id: string) => opportunities.findIndex(o => o.id === id);
  assert.equal(regionOf('Goa'), regionOf('Kerala'));
  const sameRegion = corr(log(idx('goa')), log(idx('kerala'))), crossRegion = corr(log(idx('goa')), log(idx('bali')));
  assert.ok(sameRegion > 0.35 && sameRegion < 0.75, `same-region correlation ${sameRegion}`);
  assert.ok(crossRegion > 0 && crossRegion < 0.3, `cross-region correlation ${crossRegion}`);
  for (const d of a.demand) { const mean = d.reduce((s, v) => s + v, 0) / d.length; assert.ok(mean > 0.9 && mean < 1.05, `mean demand multiplier ${mean}`); }
});

test('risk engine plans respect every hard constraint', () => {
  const expired = { ...opportunities[2], id: 'expired', quoteExpiry: '2026-11-01' };
  const minimum = { ...opportunities[4], id: 'minimum', minOrderUnits: 40, fixedOrderFee: 25000 };
  const items = [...opportunities, expired, minimum];
  for (const budget of [0, 50000, 900000, 5000000, 1e9]) for (const risk of [0, 0.35, 0.8]) {
    const plan = optimizePortfolio(items, budget, risk, { asOf, engine });
    assert.equal(plan.engine, engine);
    assert.ok(plan.rows.reduce((s, r) => s + r.spend, 0) <= budget + 1e-6, `over budget ${budget}/${risk}`);
    assert.ok(plan.upperBound + 1e-6 >= plan.objective, 'upper bound below objective');
    for (const r of plan.rows) {
      const q = r.prepaidQty ?? 0, a = r.allotQty ?? 0;
      assert.ok(Number.isInteger(q) && Number.isInteger(a) && q >= 0 && a >= 0);
      assert.equal(r.qty, q + a);
      assert.ok(r.qty <= r.capacity);
      assert.ok(a <= (r.allotmentCapacity ?? 0));
      assert.ok(q === 0 || q >= (r.minOrderUnits ?? 1), `minimum order ${r.id}`);
      assert.ok(r.downsideProfit <= r.expectedProfit + 1e-6 && r.baseProfit >= r.downsideProfit - 1e-6 && r.upsideProfit >= r.baseProfit - 1e-6);
      assert.ok(r.expectedSold <= r.qty + 1e-9 && r.unsoldExposure >= -1e-9);
    }
    assert.equal(plan.rows.find(r => r.id === 'expired')!.qty, 0);
    const summary = plan.risk!;
    assert.ok(summary.cvar <= summary.expectedProfit + 1e-6 && summary.pLoss >= 0 && summary.pLoss <= 1);
    assert.ok(summary.servedShare >= summary.servedShareBefore - 1e-9 && summary.servedShare <= 1 + 1e-9);
    assert.equal(summary.scenarioCount, RISK_ENGINE_DEFAULTS.scenarioCount);
  }
});

export function tinyCase(k: number) {
  let local = 1000 + k * 7919;
  const r = () => { local = (local * 16807) % 2147483647; return local / 2147483647; };
  const items: Opportunity[] = [0, 1].map(i => ({
    ...opportunities[i], id: `case-${k}-${i}`, destination: i ? 'Dubai' : 'Goa',
    buy: 40 + Math.floor(r() * 40), referencePrice: 90 + Math.floor(r() * 60), capacity: 2 + Math.floor(r() * 4),
    bookings: 1 + Math.floor(r() * 6), searches: Math.floor(r() * 60), conversion: 0.05, existingStock: 0, volatility: 0.15 + r() * 0.5,
    quoteExpiry: '2026-12-31', minOrderUnits: k % 5 === 0 ? 2 : undefined, fixedOrderFee: k % 7 === 0 ? 30 : undefined,
    allotmentBuy: k % 2 ? 60 + Math.floor(r() * 30) : undefined, allotmentDepositPct: 0.3, allotmentCapacity: k % 2 ? 2 : undefined,
  }));
  return { items, budget: 60 + Math.floor(r() * 400), risk: [0, 0.35, 0.8][k % 3] };
}

test('upper bound is valid and the allocator is near-optimal against exhaustive enumeration', () => {
  const { buildModel, profit, capital, objectiveOf } = riskModelInternals;
  for (let k = 0; k < 60; k++) {
    const { items, budget, risk } = tinyCase(k);
    const options = { asOf, engine, scenarioCount: 60, evaluationCount: 200, seed: 11 + k };
    const plan = optimizePortfolio(items, budget, risk, options);
    const set = buildScenarioSet(items, 60, 11 + k), kk = Math.ceil(0.1 * 60), work = new Float64Array(60);
    const models = items.map((item, i) => buildModel(item, i, set, plan.rows[i].price, asOf));
    let best = -Infinity;
    const P = new Float64Array(60);
    for (let q0 = 0; q0 <= models[0].cap; q0++) for (let a0 = 0; a0 <= models[0].capAllot && q0 + a0 <= models[0].cap; a0++)
      for (let q1 = 0; q1 <= models[1].cap; q1++) for (let a1 = 0; a1 <= models[1].capAllot && q1 + a1 <= models[1].cap; a1++) {
        if ((q0 > 0 && q0 < models[0].minimum) || (q1 > 0 && q1 < models[1].minimum)) continue;
        if (capital(models[0], q0, a0) + capital(models[1], q1, a1) > budget) continue;
        for (let s = 0; s < 60; s++) P[s] = profit(models[0], q0, a0, s) + profit(models[1], q1, a1, s);
        best = Math.max(best, objectiveOf(P, risk, kk, work));
      }
    assert.ok(plan.upperBound + 1e-6 >= best, `invalid upper bound in case ${k}: ${plan.upperBound} < ${best}`);
    assert.ok(plan.objective <= best + 1e-6, `objective above exhaustive optimum in case ${k}`);
    assert.ok(plan.objective >= best - Math.max(1e-6, 0.03 * Math.abs(best)), `case ${k}: ${plan.objective} vs optimum ${best}`);
  }
});

test('risk appetite trades expected profit for tail protection', () => {
  const growth = optimizePortfolio(opportunities, 5000000, 0, { asOf, engine }).risk!;
  const careful = optimizePortfolio(opportunities, 5000000, 0.8, { asOf, engine }).risk!;
  assert.ok(careful.cvar >= growth.cvar - 1e-6, `CVaR ${careful.cvar} < ${growth.cvar}`);
  assert.ok(growth.expectedProfit >= careful.expectedProfit - 1e-6);
});

test('flexible allotments are used when deposits make them the cheaper risk', () => {
  const volatile = { ...opportunities[0], id: 'volatile', volatility: 0.9, allotmentBuy: 6500, allotmentDepositPct: 0.15, allotmentCapacity: 80, quoteExpiry: '2026-12-31' };
  const plan = optimizePortfolio([volatile], 5000000, 0.6, { asOf, engine });
  assert.ok((plan.rows[0].allotQty ?? 0) > 0, 'expected allotment units for a volatile product');
  const noAllot = optimizePortfolio([{ ...volatile, allotmentCapacity: 0 }], 5000000, 0.6, { asOf, engine });
  assert.equal(noAllot.rows[0].allotQty, 0);
  assert.ok(plan.objective >= noAllot.objective - 1e-6, 'adding a flexible option should not lower the risk-adjusted objective');
});

test('risk engine beats the legacy plan under the same scenarios on the demo inputs', () => {
  const plan = optimizePortfolio(opportunities, 5000000, 0.35, { asOf, engine, compareLegacy: true });
  assert.ok(plan.risk!.legacy, 'legacy comparison missing');
  assert.ok(plan.objective >= plan.baselineObjective, 'in-sample objective below the legacy plan');
  assert.ok(plan.risk!.expectedProfit >= plan.risk!.legacy!.expectedProfit && plan.risk!.cvar >= plan.risk!.legacy!.cvar);
});

test('what-if tools replan with the engine that produced the rows', () => {
  const plan = optimizePortfolio(opportunities, 5000000, 0.35, { asOf, engine });
  assert.equal(engineOf(plan.rows), engine);
  const none = simulatePortfolioStress(plan.rows, 5000000, 0.35, asOf, { demandPercent: 0, pricePercent: 0, newQuotePercent: 0, cancellationPoints: 0 });
  assert.ok(Math.abs(none.fixed.expectedProfit - none.baseline.expectedProfit) < 1e-6, 'zero stress must reproduce the plan (common random numbers)');
  const stressed = simulatePortfolioStress(plan.rows, 5000000, 0.35, asOf, { demandPercent: -30, pricePercent: 0, newQuotePercent: 0, cancellationPoints: 5 });
  assert.ok(stressed.fixed.expectedProfit < none.fixed.expectedProfit);
  assert.ok(stressed.replanned.spend <= 5000000 + 1e-6 && stressed.replannedRows.every(r => r.engine === engine));
  const budgets = compareBudgets(opportunities, plan.rows, 5000000, 2000000, 0.35, asOf);
  assert.ok(budgets.candidate.spend <= 2000000 + 1e-6);
  const fixed = evaluateDecisions(opportunities, plan.rows.map(r => ({ prepaid: r.prepaidQty ?? 0, allotment: r.allotQty ?? 0, price: r.price })), 0.35, { asOf });
  assert.ok(Math.abs(fixed.metrics.expectedProfit - plan.risk!.expectedProfit) < 1e-6);
});

test('default engine is unchanged for existing callers', () => {
  const legacy = optimizePortfolio(opportunities, 5000000, 0.35, { asOf });
  assert.equal(legacy.engine, 'scenario-grid-v4');
  assert.equal(engineOf(legacy.rows), 'scenario-grid-v4');
  assert.equal(legacy.risk, undefined);
});
