import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { opportunities, type Opportunity } from '../src/lib/procurement-core';
import { learnDemand, elasticityOf, volatilityOf, priorElasticity, priorElasticitySource, demandSourceOf, priceResponse, ABOVE_MARKET_ELASTICITY_FACTOR, ELASTICITY_BOUNDS, type DemandHistoryPoint } from '../src/lib/learned-demand';
import { forecastUnconstrained } from '../src/lib/demand-unconstraining';
import { optimizePortfolio } from '../src/lib/portfolio-optimizer';

const asOf = '2026-11-16';
const TRUE_SEASON = [0.8, 0.75, 0.85, 0.9, 0.95, 1.0, 1.1, 1.05, 0.9, 1.0, 1.25, 1.45];
function rng(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function normal(r: () => number) { return Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r()); }

/** 48 months to 2026-10 with known season, 8% growth, price elasticity −2.5, signal β 0.6 and 6% noise. */
function synthetic(seed: number, { elasticity = -2.5, beta = 0.6, noise = 0.06, months = 48, growth = 1.08 } = {}): DemandHistoryPoint[] {
  const r = rng(seed), out: DemandHistoryPoint[] = [];
  const meanSeason = TRUE_SEASON.reduce((a, b) => a + b, 0) / 12;
  for (let t = 0; t < months; t++) {
    const index = 2026 * 12 + 9 - (months - 1) + t, year = Math.floor(index / 12), month = index % 12;
    const price = 9200 * (1 + 0.08 * (r() * 2 - 1)), signal = 100 * (1 + 0.25 * (r() * 2 - 1));
    const mean = 150 * Math.pow(growth, (t - months) / 12) * (TRUE_SEASON[month] / meanSeason) * Math.pow(price / 9200, elasticity) * Math.pow(signal / 100, beta);
    out.push({ month: `${year}-${String(month + 1).padStart(2, '0')}`, bookings: Math.round(mean * Math.exp(noise * normal(r))), price: Math.round(price), signal: Math.round(signal * 10) / 10 });
  }
  return out;
}
const goa = (patch: Partial<Opportunity> = {}): Opportunity => ({ ...opportunities[0], period: 'Jan 2027', signal: 1, ...patch });

test('no or short history: the typed formula is used unchanged', () => {
  assert.equal(learnDemand(goa()), null);
  assert.equal(learnDemand(goa({ history: synthetic(1).slice(-20) })), null);
  assert.equal(forecastUnconstrained(goa({ history: synthetic(1).slice(-20) })), forecastUnconstrained(goa()));
  assert.equal(demandSourceOf(goa()).kind, 'formula');
  assert.equal(volatilityOf(goa()), goa().volatility);
});

test('learns season, growth, signal effect and price elasticity, and beats seasonal-naive out of sample', () => {
  let passed = 0;
  for (const seed of [1, 2, 3, 4, 5]) {
    const item = goa({ history: synthetic(seed) }), learned = learnDemand(item)!;
    assert.ok(learned, `seed ${seed}: learned`);
    assert.equal(learned.months, 48);
    assert.equal(learned.horizon, 3, 'history ends 2026-10, target Jan 2027');
    assert.ok(learned.folds >= 6, `seed ${seed}: ${learned.folds} folds`);
    if (learned.gate === 'passed') passed++;
    const meanTrue = TRUE_SEASON.reduce((a, b) => a + b, 0) / 12;
    const worst = Math.max(...learned.seasonal.map((v, m) => Math.abs(Math.log(v / (TRUE_SEASON[m] / meanTrue)))));
    assert.ok(worst < 0.12, `seed ${seed}: seasonal index error ${worst.toFixed(3)}`);
    assert.ok(learned.growth > 1.0 && learned.growth < 1.17, `seed ${seed}: growth ${learned.growth}`);
    assert.ok(learned.signalBeta !== null && learned.signalBeta > 0.25 && learned.signalBeta < 1.0, `seed ${seed}: beta ${learned.signalBeta}`);
    assert.ok(learned.priceElasticity !== null && learned.priceElasticity < -1.6 && learned.priceElasticity > -3.6, `seed ${seed}: elasticity ${learned.priceElasticity}`);
    assert.ok(learned.priceElasticitySe !== null && learned.priceElasticitySe < 1, 'the posterior is tighter than the prior');
    assert.ok(learned.volatility >= 0.05 && learned.volatility < 0.2, `seed ${seed}: volatility ${learned.volatility}`);
    assert.ok(learned.lower80 <= 1 && learned.upper80 >= 1);
  }
  assert.ok(passed >= 4, `the learned model should beat seasonal-naive on most seeds (passed ${passed}/5)`);
});

test('the planner uses exactly the validated forecast, error spread and elasticity', () => {
  const item = goa({ history: synthetic(2) }), learned = learnDemand(item)!;
  assert.equal(learned.gate, 'passed');
  assert.ok(Math.abs(forecastUnconstrained(item) - learned.forecast * (1 - item.cancellations)) < 1e-9);
  assert.equal(volatilityOf(item), learned.volatility);
  assert.equal(elasticityOf(item), learned.priceElasticity);
  assert.equal(demandSourceOf(item).kind, 'learned');
  // A higher planned price lowers the learned forecast through the learned elasticity.
  const dearer = learnDemand({ ...item, referencePrice: item.referencePrice * 1.1 })!;
  assert.ok(dearer.forecast < learned.forecast, 'forecast is conditional on the planned price');
  // A stronger forward signal raises it through β.
  const hotter = learnDemand({ ...item, signal: 1.2 })!;
  assert.ok(hotter.forecast > learned.forecast);
  assert.ok(Math.abs(hotter.forecast / learned.forecast - Math.pow(1.2, learned.signalBeta!)) < 1e-9);
});

test('too few backtest origins: seasonal-naive fallback, typed volatility', () => {
  const item = goa({ history: synthetic(3, { months: 26 }) }), learned = learnDemand(item)!;
  assert.equal(learned.gate, 'fallback');
  assert.equal(learned.forecast, learned.naiveForecast);
  assert.equal(demandSourceOf(item).kind, 'seasonal-naive');
  assert.equal(volatilityOf(item), item.volatility);
  assert.ok(Math.abs(forecastUnconstrained(item) - learned.naiveForecast * (1 - item.cancellations)) < 1e-9);
});

test('history hygiene: duplicates, gaps, bad rows and memoisation', () => {
  const h = synthetic(4);
  const messy = [...h.slice(0, 10), { month: '2023-13', bookings: 5 }, { month: 'x', bookings: 1 }, ...h.slice(10), { ...h[h.length - 1] }] as DemandHistoryPoint[];
  const clean = learnDemand(goa({ history: h }))!, dirty = learnDemand(goa({ history: messy }))!;
  assert.equal(dirty.months, clean.months, 'invalid rows and duplicates are ignored');
  assert.ok(Math.abs(dirty.forecast - clean.forecast) < 1e-9);
  const gap = h.filter((_, i) => i !== 5);
  assert.equal(learnDemand(goa({ history: gap }))!.months, 42, 'only the latest unbroken run is used');
  const item = goa({ history: h });
  assert.equal(learnDemand(item), learnDemand(item), 'memoised per history and inputs');
  assert.notEqual(learnDemand(item), learnDemand({ ...item, referencePrice: 9500 }), 'cache key includes the price');
});

test('price elasticity priors: supplied → Lerner-implied → by kind, all bounded', () => {
  const item = opportunities[0];
  assert.ok(Math.abs(priorElasticity(item) - -item.referencePrice / (item.referencePrice - item.buy)) < 1e-12);
  assert.equal(priorElasticitySource(item), 'lerner');
  assert.equal(priorElasticity({ ...item, priceElasticity: -1.6 }), -1.6);
  assert.equal(priorElasticitySource({ ...item, priceElasticity: -1.6 }), 'supplied');
  assert.equal(priorElasticity({ ...item, priceElasticity: -30 }), ELASTICITY_BOUNDS.min);
  assert.equal(priorElasticity({ ...item, referencePrice: item.buy }), -3.0, 'no margin: kind prior');
  assert.equal(priorElasticity({ ...item, kind: 'Flight', referencePrice: item.buy }), -3.5);
  assert.equal(priorElasticity({ ...item, referencePrice: item.buy * 1.05 }), ELASTICITY_BOUNDS.min, 'thin margin is bounded');
  for (const o of opportunities) { const e = elasticityOf(o); assert.ok(e >= ELASTICITY_BOUNDS.min && e <= ELASTICITY_BOUNDS.max, `${o.id}: ${e}`); }
  // Kinked response: a mark-up loses demand faster than the same discount gains it.
  assert.equal(priceResponse(100, 100, -3), 1);
  assert.ok(Math.abs(priceResponse(110, 100, -3) - Math.pow(1.1, -3 * ABOVE_MARKET_ELASTICITY_FACTOR)) < 1e-12);
  assert.ok(Math.abs(priceResponse(90, 100, -3) - Math.pow(0.9, -3)) < 1e-12);
  assert.ok(1 - priceResponse(110, 100, -3) > priceResponse(90, 100, -3) - 1);
});

test('end to end: learned price sensitivity moves the planned price, and the plan cites its demand source', () => {
  const insensitive = goa({ history: synthetic(5, { elasticity: -1.3 }) }), sensitive = goa({ history: synthetic(5, { elasticity: -6 }) });
  const run = (item: Opportunity) => optimizePortfolio([item, ...opportunities.slice(1)], 5_000_000, 0.35, { asOf, engine: 'risk-cvar-v5' }).rows[0];
  const a = run(insensitive), b = run(sensitive);
  assert.ok(elasticityOf(insensitive) > elasticityOf(sensitive), `learned ${elasticityOf(insensitive)} vs ${elasticityOf(sensitive)}`);
  assert.ok(a.price > b.price, `less price-sensitive demand should not be priced lower (${a.price} vs ${b.price})`);
  assert.equal(a.demandSource?.kind, learnDemand(insensitive)!.gate === 'passed' ? 'learned' : 'seasonal-naive');
  assert.equal(a.priceElasticity, elasticityOf(insensitive));
});
