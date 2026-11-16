import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { forecastUnconstrained, lostBookings, searchesOnSoldOutDays, soldOutShare, unconstrainedBookings } from '../src/lib/demand-unconstraining';
import { forecast, opportunities } from '../src/lib/procurement-core';

const base = { ...opportunities[0], previousBookings: undefined, previousSearches: undefined };

test('a consistent censored history is recovered exactly', () => {
  // 200 true bookings, 5% look-to-book, sold out on 25% of days; bookings only happen on open days.
  const item = { ...base, bookings: 150, searches: 4000, conversion: 0.05, soldOut: 25 };
  assert.equal(soldOutShare(item), 0.25);
  assert.ok(Math.abs(unconstrainedBookings(item) - 200) < 1e-9);
  assert.ok(Math.abs(lostBookings({ ...item, soldOutSearches: 1000 }) - 50) < 1e-9);
});

test('measured sold-out searches override the even-spread assumption', () => {
  const item = { ...base, bookings: 150, searches: 4000, conversion: 0.05, soldOut: 25 };
  assert.deepEqual(searchesOnSoldOutDays(item), { value: 1000, measured: false });
  assert.equal(lostBookings({ ...item, bookings: 190 }), 10, 'capped by the search-implied shortfall');
  assert.equal(lostBookings({ ...item, soldOut: 0 }), 0, 'never sold out: no correction');
  assert.deepEqual(searchesOnSoldOutDays({ ...item, soldOutSearches: 1600 }), { value: 1600, measured: true });
  assert.equal(searchesOnSoldOutDays({ ...item, soldOutSearches: 99999 }).value, 4000, 'cannot exceed total searches');
  assert.ok(lostBookings({ ...item, soldOutSearches: 1600 }) > lostBookings(item));
});

test('without sell-outs the forecast equals scenario-grid-v4; with sell-outs it adds recovered bookings', () => {
  for (const o of opportunities) {
    assert.ok(Math.abs(forecastUnconstrained({ ...o, soldOut: 0 }) - forecast({ ...o, soldOut: 0 })) < 1e-9, o.id);
    assert.ok(forecastUnconstrained(o) >= forecastUnconstrained({ ...o, soldOut: 0 }), o.id);
  }
  assert.ok(forecastUnconstrained({ ...base, cancellations: 0.5 }) < forecastUnconstrained({ ...base, cancellations: 0 }));
});

/**
 * Real demand, simulated censoring. Daily booking requests for two Portuguese hotels (public dataset,
 * Jan–Jun 2016) are capped at each hotel's 80th-percentile day, so roughly the busiest fifth of days
 * "sell out". Searches are simulated as requests ÷ 5% look-to-book with 10% noise (the dataset has
 * no search logs). Each method estimates monthly unconstrained demand from what a seller would see.
 */
export function censoringExperiment() {
  const data = JSON.parse(readFileSync(new URL('../src/data/public-hotel-booking-daily.json', import.meta.url), 'utf8')) as { rows: { date: string; hotel: string; requests: number }[] };
  let seed = 20160101;
  const normal = () => { seed = (seed * 16807) % 2147483647; const u = Math.max(1e-12, seed / 2147483647); seed = (seed * 16807) % 2147483647; return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * seed / 2147483647); };
  const results: { key: string; truth: number; raw: number; v4: number; v5Even: number; v5Measured: number }[] = [];
  for (const hotel of ['City Hotel', 'Resort Hotel']) {
    const days = data.rows.filter(r => r.hotel === hotel).sort((a, b) => a.date.localeCompare(b.date));
    const sorted = days.map(d => d.requests).sort((a, b) => a - b), cap = sorted[Math.floor(0.8 * (sorted.length - 1))];
    // Searches arrive evenly through the day; once capacity is reached, later searches find the hotel sold out.
    const enriched = days.map(d => { const searches = d.requests / 0.05 * Math.exp(0.1 * normal() - 0.005); return { ...d, searches, soldOut: d.requests >= cap, denied: d.requests > cap ? searches * (d.requests - cap) / d.requests : 0 }; });
    // Look-to-book measured on searches that found availability.
    const conversion = enriched.reduce((s, d) => s + Math.min(d.requests, cap), 0) / enriched.reduce((s, d) => s + d.searches - d.denied, 0);
    for (const month of Array.from(new Set(enriched.map(d => d.date.slice(0, 7))))) {
      const m = enriched.filter(d => d.date.startsWith(month));
      const truth = m.reduce((s, d) => s + d.requests, 0), bookings = m.reduce((s, d) => s + Math.min(d.requests, cap), 0);
      const soldOut = 100 * m.filter(d => d.soldOut).length / m.length, searches = m.reduce((s, d) => s + d.searches, 0);
      const soldOutSearches = m.reduce((s, d) => s + d.denied, 0);
      const item = { bookings, searches, conversion, soldOut };
      results.push({ key: `${hotel} ${month}`, truth, raw: bookings, v4: bookings * (1 + soldOut / 100 * 0.2), v5Even: bookings + lostBookings(item), v5Measured: bookings + lostBookings({ ...item, soldOutSearches }) });
    }
  }
  const mape = (k: 'raw' | 'v4' | 'v5Even' | 'v5Measured') => results.reduce((s, r) => s + Math.abs(r[k] / r.truth - 1), 0) / results.length;
  return { results, mape: { raw: mape('raw'), v4: mape('v4'), v5Even: mape('v5Even'), v5Measured: mape('v5Measured') } };
}

test('public hotel data with simulated sell-outs: look-to-book recovery beats the fixed uplift', () => {
  const { results, mape } = censoringExperiment();
  assert.equal(results.length, 12);
  console.log(`  monthly demand error (MAPE): raw bookings ${(mape.raw * 100).toFixed(1)}% · v4 uplift ${(mape.v4 * 100).toFixed(1)}% · v5 even-spread ${(mape.v5Even * 100).toFixed(1)}% · v5 measured ${(mape.v5Measured * 100).toFixed(1)}%`);
  assert.ok(mape.v5Measured < mape.v4 && mape.v4 < mape.raw, JSON.stringify(mape));
  assert.ok(mape.v5Even < mape.raw, JSON.stringify(mape));
  assert.ok(mape.v5Measured < 0.03, 'measured recovery should be within a few percent');
});
