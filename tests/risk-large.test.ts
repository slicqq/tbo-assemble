import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { opportunities, type Opportunity } from '../src/lib/procurement-core';
import { optimizePortfolioRisk, riskModelInternals } from '../src/lib/risk-optimizer';
import { buildScenarioSet } from '../src/lib/risk-scenarios';
import { syntheticPortfolio, fullCapacityCost } from '../src/lib/synthetic-portfolio';

const asOf = '2026-11-16';
let seed = 97;
const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const { buildModel, profit, capital, objectiveOf, leanProduct, leanCurve, leanBest, leanScratch, tailWeights, candidatePrices } = riskModelInternals;

/** Small products that exercise every model feature: held stock, minimum orders, fees, allotments, allotment-first selling. */
function smallProducts(count: number): Opportunity[] {
  return syntheticPortfolio(count, 11).map((o, i) => ({
    ...o, capacity: 6 + (i % 5) * 9, allotmentCapacity: o.allotmentBuy ? 4 + (i % 4) * 5 : undefined,
    existingStock: i % 3 === 0 ? 7 : 0, minOrderUnits: i % 4 === 1 ? 5 : undefined, fixedOrderFee: i % 5 === 2 ? 9000 : undefined,
    // A high recovery rate makes the allotment the unit type sold first (salvage above the allotment's net cost).
    recoveryPct: i % 6 === 5 ? 0.97 : o.recoveryPct,
    ...(i % 6 === 5 ? { allotmentBuy: Math.round(o.buy * 1.06), allotmentCapacity: 5, allotmentDepositPct: 0.3 } : {}),
  }));
}

test('lean curves equal the scenario-weighted profit at every price, and the per-product search is exact', () => {
  const items = smallProducts(24), set = buildScenarioSet(items, 120, 5), S = set.count;
  let worstCurve = 0, worstBest = 0, allotFirst = 0;
  for (const basis of ['cash', 'capital-at-risk'] as const) items.forEach((item, i) => {
    const prices = candidatePrices(item), service = i % 4 === 0 ? 700 : 0;
    const lean = leanProduct(item, i, set, prices, asOf, service, basis), scratch = leanScratch(S, item.capacity);
    if (!lean.prepaidFirst) allotFirst++;
    const omega = tailWeights(Float64Array.from({ length: S }, () => rand() * 1000 - 300), 0.35, 12);
    prices.forEach((price, o) => {
      const m = buildModel(item, i, set, price, asOf, service, basis), curve = leanCurve(lean, o, omega, scratch, true);
      const exact = (q: number, a: number) => { let v = 0; for (let s = 0; s < S; s++) v += omega[s] * (m.stockTerm[s] + (q > 0 || a > 0 ? profit(m, q, a, s) : 0)); return v; };
      const viaCurve = (q: number, a: number) => q + a === 0 ? curve.stockConst
        : curve.stockConst + curve.T[Math.min(q + a, curve.len)] + curve.F[Math.min(lean.prepaidFirst ? q : a, curve.flen)] + (lean.salvage - lean.buy) * q - lean.unitDeposit * a - lean.fee;
      let brute = new Map<number, number>();
      for (let q = 0; q <= m.capPrepaid; q++) for (let a = 0; a <= m.capAllot && q + a <= m.cap; a++) {
        const e = exact(q, a);
        worstCurve = Math.max(worstCurve, Math.abs(e - viaCurve(q, a)) / Math.max(1, Math.abs(e)));
        if (q > 0 && q < m.minimum) continue;
        for (const lambda of [0, 0.08, 0.3]) brute.set(lambda, Math.max(brute.get(lambda) ?? -Infinity, e - lambda * capital(m, q, a)));
      }
      for (const [lambda, value] of brute) {
        const best = leanBest(lean, curve, lambda, { value: 0, cost: 0, q: 0, a: 0 });
        worstBest = Math.max(worstBest, Math.abs(best.value - value) / Math.max(1, Math.abs(value)));
      }
      brute = new Map();
    });
  });
  assert.ok(allotFirst > 0, 'the allotment-first branch is exercised');
  assert.ok(worstCurve < 1e-9, `curve error ${worstCurve}`);
  assert.ok(worstBest < 1e-9, `per-product search error ${worstBest}`);
});

test('decomposition bound is valid and the plan is near-optimal against exhaustive enumeration', () => {
  for (let trial = 0; trial < 6; trial++) {
    const items = syntheticPortfolio(2, 300 + trial).map((o, i) => ({ ...o, capacity: 5 + ((trial + i) % 3), allotmentCapacity: o.allotmentBuy ? 3 : undefined, existingStock: (trial + i) % 4 === 0 ? 3 : 0, minOrderUnits: trial === 3 && i === 0 ? 3 : undefined, fixedOrderFee: trial === 4 ? 6000 : undefined }));
    const budget = Math.round(fullCapacityCost(items) * (0.25 + 0.1 * (trial % 3))), risk = [0, 0.35, 0.8][trial % 3];
    const options = { asOf, solver: 'decomposition' as const, scenarioCount: 80, evaluationCount: 80, seed: 11 + trial };
    const plan = optimizePortfolioRisk(items, budget, risk, options);
    assert.equal(plan.algorithm, 'risk-cvar-decomposition');
    assert.ok(plan.risk.spend <= budget + 1e-6, 'within budget');
    // Exhaustive search over every price, pre-paid and allotment choice on the same optimisation scenarios.
    const set = buildScenarioSet(items, 80, options.seed), k = Math.ceil(0.1 * 80), work = new Float64Array(80);
    const choices = items.map((item, i) => candidatePrices(item).flatMap(price => {
      const m = buildModel(item, i, set, price, asOf);
      const out: { m: typeof m; q: number; a: number; cost: number }[] = [];
      for (let q = 0; q <= m.capPrepaid; q++) for (let a = 0; a <= m.capAllot && q + a <= m.cap; a++) if (!(q > 0 && q < m.minimum)) out.push({ m, q, a, cost: capital(m, q, a) });
      return out;
    }));
    let optimum = -Infinity;
    for (const x of choices[0]) for (const y of choices[1]) {
      if (x.cost + y.cost > budget) continue;
      const P = new Float64Array(80);
      for (const c of [x, y]) for (let s = 0; s < 80; s++) P[s] += c.m.stockTerm[s] + (c.q > 0 || c.a > 0 ? profit(c.m, c.q, c.a, s) : 0);
      optimum = Math.max(optimum, objectiveOf(P, risk, k, work));
    }
    assert.ok(plan.upperBound >= optimum - 1e-6 * Math.max(1, Math.abs(optimum)), `trial ${trial}: bound ${plan.upperBound} below optimum ${optimum}`);
    assert.ok(plan.objective >= optimum - 0.01 * Math.max(1, Math.abs(optimum)), `trial ${trial}: plan ${plan.objective} vs optimum ${optimum}`);
  }
});

test('decomposition matches or beats the local search on the demo and a 20-product portfolio, with a tighter certificate', () => {
  const syn = syntheticPortfolio(20, 7);
  for (const [items, budget] of [[opportunities, 5_000_000], [syn, Math.round(fullCapacityCost(syn) * 0.35)]] as const) {
    for (const risk of [0, 0.35, 0.8]) {
      const local = optimizePortfolioRisk(items, budget, risk, { asOf, solver: 'local-search' });
      const decomposition = optimizePortfolioRisk(items, budget, risk, { asOf, solver: 'decomposition' });
      assert.ok(decomposition.objective >= local.objective * (1 - 2e-3), `risk ${risk}: ${decomposition.objective} vs ${local.objective}`);
      const gap = decomposition.gap / Math.abs(decomposition.objective), localGap = local.gap / Math.abs(local.objective);
      assert.ok(gap <= Math.max(localGap, 5e-4) && gap < 5e-3, `risk ${risk}: certified gap ${gap} vs local search ${localGap}`);
      assert.ok(decomposition.risk.spend <= budget + 1e-6);
    }
  }
});

test('the decomposition is the default solver; 1,000 products plan within budget with a certified gap', () => {
  const items = syntheticPortfolio(1000, 7), budget = Math.round(fullCapacityCost(items) * 0.35);
  const started = Date.now(), plan = optimizePortfolioRisk(items, budget, 0.35, { asOf }), seconds = (Date.now() - started) / 1000;
  assert.equal(plan.algorithm, 'risk-cvar-decomposition');
  assert.equal(plan.rows.length, 1000);
  assert.ok(plan.risk.spend <= budget + 1e-6 && plan.risk.spend >= 0.99 * budget, `spend ${plan.risk.spend} of ${budget}`);
  assert.ok(plan.gap / plan.objective < 1e-3, `certified gap ${plan.gap / plan.objective}`);
  assert.ok(seconds < 60, `took ${seconds} s`);
  assert.ok(plan.rows.every(row => row.qty >= 0 && (row.prepaidQty ?? row.qty) + (row.allotQty ?? 0) <= row.capacity));
});

test('the decomposition is deterministic', () => {
  const items = syntheticPortfolio(150, 3), budget = Math.round(fullCapacityCost(items) * 0.3);
  const a = optimizePortfolioRisk(items, budget, 0.5, { asOf }), b = optimizePortfolioRisk(items, budget, 0.5, { asOf });
  assert.deepEqual(a.rows.map(r => [r.prepaidQty, r.allotQty, r.price]), b.rows.map(r => [r.prepaidQty, r.allotQty, r.price]));
  assert.equal(a.objective, b.objective);
});

test('availability targets work on large portfolios: met when affordable, unreachable with the most that can be served', () => {
  const items = syntheticPortfolio(80, 21), full = fullCapacityCost(items);
  const generous = optimizePortfolioRisk(items, full, 0.35, { asOf, serviceTarget: 0.6 });
  assert.ok(['met', 'not-binding'].includes(generous.service.status), generous.service.status);
  if (generous.service.status === 'met') assert.ok(generous.service.servedShare >= 0.57, `served ${generous.service.servedShare}`);
  const tight = optimizePortfolioRisk(items, full * 0.05, 0.35, { asOf, serviceTarget: 0.9 });
  assert.equal(tight.service.status, 'unreachable');
  assert.ok((tight.service.maxServedShare ?? 0) < 0.9);
  assert.ok(tight.risk.spend <= full * 0.05 + 1e-6);
});

test('expired quotes, held stock and the capital-at-risk basis are respected on large portfolios', () => {
  const items = syntheticPortfolio(60, 5).map((o, i) => ({ ...o, quoteExpiry: i % 10 === 0 ? '2026-11-01' : o.quoteExpiry, existingStock: i % 7 === 0 ? 20 : o.existingStock }));
  const budget = Math.round(fullCapacityCost(items) * 0.3);
  for (const budgetBasis of ['cash', 'capital-at-risk'] as const) {
    const plan = optimizePortfolioRisk(items, budget, 0.35, { asOf, budgetBasis });
    plan.rows.forEach((row, i) => {
      if (i % 10 === 0) { assert.equal(row.qty, 0, 'expired quotes are not bought'); assert.equal(row.price, Math.round(items[i].referencePrice), 'expired products keep the reference price'); }
    });
    assert.ok(plan.risk.spend <= budget + 1e-6);
    assert.ok(plan.gap / Math.abs(plan.objective) < 2e-3, `${budgetBasis}: gap ${plan.gap / plan.objective}`);
  }
});
