// Plan API at TBO scale: 1,000 items plan in one request (risk-cvar-v5 by default above 100 items),
// and the limits answer with readable errors. Needs a running server (TEST_BASE, default http://127.0.0.1:3000).
const assert = require('node:assert/strict');
const BASE = process.env.TEST_BASE || 'http://127.0.0.1:3000';

function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
const DESTINATIONS = ['Goa', 'Dubai', 'Bali', 'Jaipur', 'Kerala', 'Bangkok', 'Singapore', 'Phuket', 'Maldives', 'Udaipur'];
function items(n, seed = 7) {
  const r = rng(seed), u = (a, b) => a + (b - a) * r();
  return Array.from({ length: n }, (_, i) => {
    const kind = r() < 0.3 ? 'Flight' : 'Hotel', buy = Math.round(u(kind === 'Flight' ? 7000 : 2500, kind === 'Flight' ? 20000 : 11000) / 50) * 50;
    const bookings = Math.round(u(15, 180)), conversion = +u(0.025, 0.065).toFixed(3);
    return { id: `api-${i + 1}`, name: `Product ${i + 1}`, destination: DESTINATIONS[i % DESTINATIONS.length], kind, period: ['Dec 2026', 'Jan 2027', 'Feb 2027'][i % 3],
      buy, referencePrice: Math.round(buy * u(1.12, 1.55) / 10) * 10, capacity: Math.round(u(20, 220)), bookings, searches: Math.round(bookings / conversion), conversion,
      seasonal: +u(0.8, 1.3).toFixed(2), signal: +u(0.9, 1.15).toFixed(2), cancellations: +u(0.04, 0.22).toFixed(2), volatility: +u(0.12, 0.42).toFixed(2), soldOut: Math.round(u(0, 28)),
      integration: 'Supplier API', timing: 'Monitor', quoteExpiry: '2026-12-20' };
  });
}
async function post(body) {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  const response = await fetch(BASE + '/api/procurement/plan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: text });
  return { status: response.status, body: await response.json().catch(() => ({})) };
}

(async () => {
  const thousand = items(1000), budget = 350000000;
  const started = Date.now();
  const plan = await post({ items: thousand, budget, risk: 0.35, asOf: '2026-11-16' });
  const seconds = (Date.now() - started) / 1000;
  assert.equal(plan.status, 200, JSON.stringify(plan.body).slice(0, 300));
  assert.equal(plan.body.model, 'risk-cvar-v5', 'default engine above 100 items');
  assert.equal(plan.body.recommendations.length, 1000);
  assert.equal(plan.body.optimization.algorithm, 'risk-cvar-decomposition');
  assert.ok(plan.body.summary.spend <= budget + 1e-6);
  assert.ok(plan.body.optimization.gap / plan.body.optimization.objective < 1e-3, 'certified gap under 0.1%');
  console.log(`1,000 items: ${seconds.toFixed(1)} s, spend ${(plan.body.summary.spend / budget * 100).toFixed(1)}% of budget, gap ${(plan.body.optimization.gap / plan.body.optimization.objective * 100).toFixed(3)}%`);

  const small = await post({ items: items(40), budget: 20000000, risk: 0.35, asOf: '2026-11-16' });
  assert.equal(small.status, 200);
  assert.equal(small.body.model, 'scenario-grid-v4', 'default engine up to 100 items is unchanged');

  const legacy = await post({ items: items(101), budget: 20000000, risk: 0.35, asOf: '2026-11-16', engine: 'scenario-grid-v4' });
  assert.equal(legacy.status, 400); assert.match(legacy.body.error, /scenario-grid-v4 supports up to 100 items/);
  const modelRisk = await post({ items: items(101), budget: 20000000, risk: 0.35, asOf: '2026-11-16', engine: 'risk-cvar-v5', modelRisk: true });
  assert.equal(modelRisk.status, 400); assert.match(modelRisk.body.error, /modelRisk .* up to 100 items/);
  const tooMany = await post({ items: items(2001), budget: 20000000, risk: 0.35, asOf: '2026-11-16', engine: 'risk-cvar-v5' });
  assert.equal(tooMany.status, 400); assert.match(tooMany.body.error, /Provide 1–2,000 items/);
  const huge = await post(JSON.stringify({ items: thousand, budget, risk: 0.35, asOf: '2026-11-16', padding: 'x'.repeat(4_100_000) }));
  assert.equal(huge.status, 413); assert.match(huge.body.error, /too large/);
  const badRow = await post({ items: [{ ...thousand[0], capacity: 5001 }], budget, risk: 0.35, asOf: '2026-11-16' });
  assert.equal(badRow.status, 400); assert.match(badRow.body.error, /capacity must be a whole number between 0 and 5000/);
  console.log('PASS plan-api-scale');
})().catch(error => { console.error('FAIL', error); process.exit(1); });
