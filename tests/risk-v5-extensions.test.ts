import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { optimizePortfolio, planOptionsOf } from '../src/lib/portfolio-optimizer';
import { opportunities, type Opportunity } from '../src/lib/procurement-core';
import { evaluateDecisions, riskModelInternals } from '../src/lib/risk-optimizer';
import { buildScenarioSet } from '../src/lib/risk-scenarios';
import { checkModelRisk, MODEL_RISK_WORLDS } from '../src/lib/model-risk';
import { supplierPriorities } from '../src/lib/supplier-priority';
import { compareBudgets } from '../src/lib/budget-comparison';
import { POST } from '../src/app/api/procurement/plan/route';

const asOf = '2026-11-16';
const engine = 'risk-cvar-v5' as const;
/** Same generator as tests/risk-optimizer.test.ts (copied: importing that file would re-run its tests). */
function tinyCase(k: number) {
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
const prices = (item: Opportunity) => Array.from(new Set([1, 0.95, 1.05, 0.9, 1.1].map(m => Math.max(1, Math.round(item.referencePrice * m)))));

test('joint pricing: the bound covers every price option and the plan is near the joint optimum', () => {
  const { buildModel, profit, capital, objectiveOf } = riskModelInternals;
  for (let k = 0; k < 24; k++) {
    const { items, budget, risk } = tinyCase(k);
    const plan = optimizePortfolio(items, budget, risk, { asOf, engine, scenarioCount: 60, evaluationCount: 200, seed: 11 + k });
    assert.equal(plan.pricing, 'joint');
    const set = buildScenarioSet(items, 60, 11 + k), kk = Math.ceil(0.1 * 60), work = new Float64Array(60), P = new Float64Array(60);
    let best = -Infinity;
    for (const p0 of prices(items[0])) for (const p1 of prices(items[1])) {
      const models = [buildModel(items[0], 0, set, p0, asOf), buildModel(items[1], 1, set, p1, asOf)];
      for (let q0 = 0; q0 <= models[0].cap; q0++) for (let a0 = 0; a0 <= models[0].capAllot && q0 + a0 <= models[0].cap; a0++)
        for (let q1 = 0; q1 <= models[1].cap; q1++) for (let a1 = 0; a1 <= models[1].capAllot && q1 + a1 <= models[1].cap; a1++) {
          if ((q0 > 0 && q0 < models[0].minimum) || (q1 > 0 && q1 < models[1].minimum)) continue;
          if (capital(models[0], q0, a0) + capital(models[1], q1, a1) > budget) continue;
          for (let s = 0; s < 60; s++) P[s] = profit(models[0], q0, a0, s) + profit(models[1], q1, a1, s);
          best = Math.max(best, objectiveOf(P, risk, kk, work));
        }
    }
    assert.ok(plan.upperBound + 1e-6 >= best, `case ${k}: bound ${plan.upperBound} below the joint optimum ${best}`);
    assert.ok(plan.objective <= best + 1e-6, `case ${k}: objective above the joint optimum`);
    assert.ok(plan.objective >= best - Math.max(1e-6, 0.03 * Math.abs(best)), `case ${k}: ${plan.objective} vs joint optimum ${best}`);
  }
});

test('fixed pricing reproduces the stand-alone price choice and never beats joint pricing', () => {
  for (const risk of [0, 0.35, 0.8]) {
    const joint = optimizePortfolio(opportunities, 5_000_000, risk, { asOf, engine });
    const fixed = optimizePortfolio(opportunities, 5_000_000, risk, { asOf, engine, jointPricing: false });
    assert.equal(fixed.pricing, 'fixed');
    assert.ok(joint.objective >= fixed.objective - 1e-6 * Math.abs(fixed.objective), `r=${risk}: joint ${joint.objective} < fixed ${fixed.objective}`);
  }
});

test('availability target: met targets serve more demand within budget and say what it costs', () => {
  const base = optimizePortfolio(opportunities, 5_000_000, 0.35, { asOf, engine });
  assert.equal(base.service?.status, 'off');
  let previousValue = 0;
  for (const target of [0.85, 0.9]) {
    const plan = optimizePortfolio(opportunities, 5_000_000, 0.35, { asOf, engine, serviceTarget: target });
    const s = plan.service!;
    assert.equal(s.status, 'met', `target ${target}`);
    assert.ok(s.servedShare >= target - 0.01, `target ${target}: served ${s.servedShare}`);
    assert.ok(s.servedShare > s.servedShareWithoutTarget, 'a binding target must raise the served share');
    assert.ok(Math.abs(s.servedShareWithoutTarget - base.risk!.servedShare) < 1e-12, 'baseline share is the no-target plan');
    assert.ok(s.serviceValue > previousValue, 'a higher target needs a higher service value');
    assert.ok(plan.risk!.spend <= 5_000_000 + 1e-6, 'budget is a hard limit');
    assert.ok(plan.upperBound >= plan.objective - 1e-6 && plan.gap >= 0);
    assert.ok(Math.abs(s.cvarCost - (base.risk!.cvar - plan.risk!.cvar)) < 1e-6 && Math.abs(s.expectedProfitCost - (base.risk!.expectedProfit - plan.risk!.expectedProfit)) < 1e-6);
    assert.ok(plan.rows.every(row => row.serviceTarget === target), 'rows carry the target');
    assert.deepEqual(planOptionsOf(plan.rows), { engine, serviceTarget: target });
    previousValue = s.serviceValue;
  }
  const easy = optimizePortfolio(opportunities, 5_000_000, 0.35, { asOf, engine, serviceTarget: 0.5 });
  assert.equal(easy.service?.status, 'not-binding');
  assert.deepEqual(easy.rows.map(r => r.qty), base.rows.map(r => r.qty));
  const impossible = optimizePortfolio(opportunities, 2_000_000, 0.35, { asOf, engine, serviceTarget: 0.95 });
  const sameBudget = optimizePortfolio(opportunities, 2_000_000, 0.35, { asOf, engine });
  assert.equal(impossible.service?.status, 'unreachable');
  assert.deepEqual(impossible.rows.map(r => r.qty), sameBudget.rows.map(r => r.qty), 'an unreachable target leaves the plan unchanged');
  assert.ok((impossible.service!.maxServedShare ?? 1) < 0.95 && (impossible.service!.maxServedShare ?? 0) >= sameBudget.risk!.servedShare - 0.01);
  assert.equal(optimizePortfolio(opportunities, 5_000_000, 0.35, { asOf, serviceTarget: 0.9 }).service, undefined, 'v4 ignores the target');
});

test('what-if re-plans keep the availability target of the plan they start from', () => {
  const plan = optimizePortfolio(opportunities, 5_000_000, 0.35, { asOf, engine, serviceTarget: 0.9 });
  const same = compareBudgets(opportunities, plan.rows, 5_000_000, 5_000_000, 0.35, asOf);
  assert.equal(same.changes.length, 0);
  const bigger = compareBudgets(opportunities, plan.rows, 5_000_000, 6_000_000, 0.35, asOf);
  const direct = optimizePortfolio(opportunities, 6_000_000, 0.35, { asOf, engine, serviceTarget: 0.9 });
  assert.equal(bigger.candidate.spend, direct.rows.reduce((s, r) => s + r.spend, 0));
});

test('scenario overrides change the world but keep common random numbers', () => {
  const planned = buildScenarioSet(opportunities, 400, 99), low = buildScenarioSet(opportunities, 400, 99, { demandBias: 0.85, priceBias: 0.95 });
  for (let i = 0; i < opportunities.length; i++) for (let s = 0; s < 400; s += 37) {
    assert.ok(Math.abs(low.demand[i][s] - 0.85 * planned.demand[i][s]) < 1e-9);
    assert.ok(Math.abs(low.price[i][s] - 0.95 * planned.price[i][s]) < 1e-12);
  }
  assert.deepEqual(Array.from(buildScenarioSet(opportunities, 200, 5, {}).demand[2]), Array.from(buildScenarioSet(opportunities, 200, 5).demand[2]));
  assert.throws(() => buildScenarioSet(opportunities, 200, 5, { globalWeight: 0.6, regionWeight: 0.5 }), /sum to at most 1/);
});

test('model-risk check: consistent with the plan, zero regret as planned, v5 ahead in every world on the demo', () => {
  const plan = optimizePortfolio(opportunities, 5_000_000, 0.35, { asOf, engine, compareLegacy: true });
  const report = checkModelRisk(opportunities, 5_000_000, 0.35, { asOf, planRows: plan.rows });
  assert.equal(report.worlds.length, MODEL_RISK_WORLDS.length);
  const planned = report.worlds.find(w => w.world.id === 'planned')!;
  assert.ok(Math.abs(planned.plan.expectedProfit - plan.risk!.expectedProfit) < 1e-6 && Math.abs(planned.plan.cvar - plan.risk!.cvar) < 1e-6);
  assert.ok(Math.abs(planned.legacy.cvar - plan.risk!.legacy!.cvar) < 1e-6, 'legacy scored on the same scenarios as the risk panel');
  assert.ok(Math.abs(planned.plan.regret!) < 1e-6 * Math.abs(planned.plan.objective), 'no regret when the world is as planned');
  for (const w of report.worlds) {
    assert.ok(w.plan.objective >= w.legacy.objective, `${w.world.id}: v5 ${w.plan.objective} < v4 ${w.legacy.objective}`);
    assert.ok(w.plan.regret! > -0.01 * Math.abs(w.oracle!.objective), `${w.world.id}: large negative regret`);
  }
  const low = report.worlds.find(w => w.world.id === 'demand-low')!, high = report.worlds.find(w => w.world.id === 'demand-high')!;
  assert.ok(low.plan.expectedProfit < planned.plan.expectedProfit && high.plan.expectedProfit > planned.plan.expectedProfit);
  assert.equal(report.summary.worstPlan.worldId, 'combined');
  assert.ok(report.summary.meanRegretPlan! < report.summary.meanRegretLegacy!);
  const direct = evaluateDecisions(opportunities, plan.rows.map(r => ({ prepaid: r.prepaidQty!, allotment: r.allotQty!, price: r.price })), 0.35, { asOf, scenarioOverrides: { demandBias: 0.85 } });
  assert.ok(Math.abs(direct.metrics.expectedProfit - low.plan.expectedProfit) < 1e-6);
});

test('supplier-integration priorities rank unserved demand and pick the right supplier step', () => {
  const tight = optimizePortfolio(opportunities, 2_000_000, 0.35, { asOf, engine });
  const list = supplierPriorities(tight.rows, { budget: 2_000_000 });
  assert.ok(list.length > 0);
  list.forEach((p, i) => { assert.equal(p.rank, i + 1); if (i) assert.ok(list[i - 1].unmetValue >= p.unmetValue); assert.ok(p.unmet >= 1 && p.highUnmet >= 0); });
  for (const p of list) {
    const row = tight.rows.find(r => r.id === p.id)!;
    if (p.action === 'Extend allotment') assert.ok((row.allotQty ?? 0) > 0 && (row.allotQty ?? 0) >= Math.min(row.allotmentCapacity ?? 0, row.capacity - (row.prepaidQty ?? 0)));
    if (p.action === 'Top up with free-sale') assert.match(p.reason, /budget is fully committed/);
  }
  const legacy = optimizePortfolio(opportunities, 2_000_000, 0.35, { asOf });
  const zero = supplierPriorities(legacy.rows).filter(p => p.committed === 0);
  assert.ok(zero.length > 0 && zero.every(p => p.action === 'Connect free-sale / API supply'));
  const scarce: Opportunity = { ...opportunities[0], id: 'scarce', capacity: 5, allotmentCapacity: 0, allotmentBuy: undefined, bookings: 400, searches: 9000, existingStock: 0 };
  const capped = optimizePortfolio([scarce], 5_000_000, 0, { asOf, engine });
  assert.equal(capped.rows[0].qty, 5);
  assert.equal(supplierPriorities(capped.rows)[0].action, 'Negotiate more units');
  const expired = optimizePortfolio(opportunities, 5_000_000, 0.35, { asOf: '2026-11-20', engine });
  assert.equal(supplierPriorities(expired.rows).find(p => p.id === 'goa')?.action, 'Refresh supplier quote');
});

test('plan API validates and returns the availability target, joint pricing and model risk', async () => {
  const post = async (body: unknown) => { const response = await POST(new Request('http://localhost/api/procurement/plan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })); return { status: response.status, body: await response.json() }; };
  const input = { items: opportunities, budget: 5_000_000, risk: 0.35, asOf };
  for (const bad of [-0.1, 1, '0.9', {}]) assert.equal((await post({ ...input, engine, serviceTarget: bad })).status, 400);
  assert.equal((await post({ ...input, engine, jointPricing: 'yes' })).status, 400);
  assert.equal((await post({ ...input, serviceTarget: 0.9 })).status, 400, 'v4 rejects v5-only options');
  const ok = await post({ ...input, engine, serviceTarget: 0.9 });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.optimization.service.status, 'met');
  assert.equal(ok.body.optimization.pricing, 'joint');
  assert.ok(ok.body.summary.demandServedShare >= 0.89);
  const robust = await post({ ...input, engine, modelRisk: true });
  assert.equal(robust.status, 200);
  assert.equal(robust.body.modelRisk.worlds.length, 9);
  assert.ok(Math.abs(robust.body.modelRisk.worlds[0].plan.regret) < 1);
  const legacy = await post(input);
  assert.equal(legacy.status, 200);
  assert.equal(legacy.body.optimization.service, undefined);
  assert.equal(legacy.body.modelRisk, undefined);
});
