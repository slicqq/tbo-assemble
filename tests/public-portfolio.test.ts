import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import snapshot from '../src/data/public-portfolio.json';
import { publicPortfolio, publicPortfolioSources, PUBLIC_HISTORY_MONTHS } from '../src/lib/public-portfolio';
import { learnDemand, volatilityOf, demandSourceOf } from '../src/lib/learned-demand';
import { optimizePortfolio } from '../src/lib/portfolio-optimizer';
import { POST } from '../src/app/api/procurement/plan/route';

const asOf = '2026-11-16', engine = 'risk-cvar-v5' as const;
const monthIndex = (ym: string) => Number(ym.slice(0, 4)) * 12 + Number(ym.slice(5, 7)) - 1;

test('snapshot: cited sources, consecutive real monthly series, documented shock windows', () => {
  const { sources, anomalies } = publicPortfolioSources();
  assert.ok(sources.length >= 2);
  for (const s of sources) {
    assert.match(s.url, /^https:\/\//, `${s.id} has a source URL`);
    assert.match(s.sha256, /^[0-9a-f]{64}$/, `${s.id} has a content hash`);
  }
  assert.ok(anomalies.some(a => a.source === 'dgca' && a.from === '2020-03' && a.to === '2022-02'));
  for (const [key, series] of Object.entries(snapshot.series as Record<string, { month: string; value: number; imputed?: boolean }[]>)) {
    assert.ok(series.length >= 120, `${key}: at least ten years`);
    for (let i = 1; i < series.length; i++) assert.equal(monthIndex(series[i].month) - monthIndex(series[i - 1].month), 1, `${key}: consecutive at ${series[i].month}`);
    assert.ok(series.every(p => Number.isFinite(p.value) && p.value >= 0), `${key}: non-negative values`);
    assert.ok(series.filter(p => p.imputed).length <= 3, `${key}: at most a few imputed months`);
    assert.ok(series[series.length - 1].month >= '2026-06', `${key}: recent data`);
  }
});

test('public-data portfolio: hotels and flights with real histories, shocks and imputed months excluded from fitting', () => {
  const items = publicPortfolio();
  assert.equal(items.length, 8);
  assert.deepEqual(new Set(items.map(i => i.kind)), new Set(['Hotel', 'Flight']));
  assert.equal(new Set(items.map(i => i.id)).size, items.length, 'unique ids');
  for (const item of items) {
    const h = item.history!;
    assert.ok(h.length >= 96 && h.length <= PUBLIC_HISTORY_MONTHS, `${item.id}: 8–10 years of months`);
    assert.equal(item.historyScope, 'market');
    assert.match(item.dataSource ?? '', /DGCA|Singapore Tourism Board/);
    const covid = h.filter(p => p.month >= '2020-04' && p.month <= '2021-12');
    assert.ok(covid.length > 0 && covid.every(p => p.exclude === true), `${item.id}: COVID months are excluded from fitting`);
    assert.ok(h.filter(p => p.month >= '2023-01').every(p => p.exclude !== true || p.month === '2024-05'), `${item.id}: recent months are used (2024-05 is imputed in the DGCA file)`);
    const recent = h.slice(-12).reduce((s, p) => s + p.bookings, 0) / 12;
    assert.ok(recent > 20 && recent < 400, `${item.id}: product-sized level`);
    assert.ok(item.capacity <= 500 && item.buy < item.referencePrice);
  }
});

test('learned demand on the real series: most beat seasonal-naive out of sample, the rest fall back honestly', () => {
  const items = publicPortfolio();
  const learned = items.map(item => ({ item, L: learnDemand(item)! }));
  for (const { item, L } of learned) {
    assert.ok(L, `${item.id}: learned`);
    assert.ok(L.folds >= 30, `${item.id}: validated on ≥30 recent rolling origins`);
    if (L.gate === 'passed') {
      assert.ok(L.modelMae < 0.95 * L.naiveMae && L.skill > 0.05, `${item.id}: beats seasonal-naive by >5% MAE`);
      assert.equal(demandSourceOf(item).kind, 'learned');
    } else {
      assert.equal(L.forecast, L.naiveForecast, `${item.id}: falls back to exactly seasonal-naive`);
      assert.equal(demandSourceOf(item).kind, 'seasonal-naive');
    }
    assert.ok(L.lower80 <= 1 && L.upper80 >= 1 && L.volatility >= 0.05 && L.volatility <= 0.8);
    assert.ok(volatilityOf(item) >= item.volatility, `${item.id}: market-level history keeps the typed product volatility as a floor`);
    // December peaks in Goa and Singapore are learned from the data, not typed.
    if (item.id === 'pub-goa') assert.ok(L.seasonal[11] > L.seasonal[6], 'Goa: December above July (monsoon)');
  }
  const passed = learned.filter(x => x.L.gate === 'passed').length;
  assert.ok(passed >= 5, `at least 5 of 8 pass the gate (got ${passed})`);
  // Leaving shock months in the fit is what breaks the gate: the exclusion is load-bearing, not cosmetic.
  const raw = items.map(item => ({ ...item, history: item.history!.map(p => ({ month: p.month, bookings: p.bookings })) }));
  const passedRaw = raw.filter(item => learnDemand(item)?.gate === 'passed').length;
  assert.ok(passedRaw < passed, `without excluding COVID months fewer pass (${passedRaw} vs ${passed})`);
});

test('the planner runs on real data: validated forecasts, budget respected, scarce budget raises prices', () => {
  const items = publicPortfolio();
  for (const budget of [2_500_000, 4_000_000]) {
    const plan = optimizePortfolio(items, budget, 0.35, { asOf, engine });
    const spend = plan.rows.reduce((s, r) => s + r.spend, 0);
    assert.ok(spend <= budget + 1, `cash spend ${spend} within ${budget}`);
    for (const row of plan.rows) {
      const item = items.find(i => i.id === row.id)!, L = learnDemand(item)!;
      assert.ok(Math.abs(row.forecast - L.forecast * (1 - item.cancellations)) < 1e-6, `${row.id}: plan uses the validated forecast net of cancellations`);
      assert.ok(row.demandSource && row.demandSource.kind !== 'formula', `${row.id}: demand source cited`);
    }
    if (budget === 2_500_000) assert.ok(plan.rows.some(r => r.price > r.referencePrice), 'a scarce budget prices above market');
  }
});

test('plan API accepts the public-data portfolio with exclude flags and history scope', async () => {
  const post = async (body: unknown) => { const response = await POST(new Request('http://localhost/api/procurement/plan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })); return { status: response.status, body: await response.json() }; };
  const items = publicPortfolio();
  const ok = await post({ items, budget: 4_000_000, risk: 0.35, asOf, engine });
  assert.equal(ok.status, 200, JSON.stringify(ok.body).slice(0, 300));
  const kinds = ok.body.recommendations.map((r: { demandSource?: { kind: string } }) => r.demandSource?.kind);
  assert.ok(ok.body.summary.spend <= 4_000_000 + 1);
  assert.ok(kinds.filter((k: string) => k === 'learned').length >= 5, `learned forecasts used through the API (${kinds.join(',')})`);
  const bad = structuredClone(items); (bad[0].history![0] as unknown as Record<string, unknown>).exclude = 'yes';
  assert.equal((await post({ items: bad, budget: 4_000_000, risk: 0.35, asOf, engine })).status, 400);
  const badScope = structuredClone(items); (badScope[0] as unknown as Record<string, unknown>).historyScope = 'city';
  assert.equal((await post({ items: badScope, budget: 4_000_000, risk: 0.35, asOf, engine })).status, 400);
});
