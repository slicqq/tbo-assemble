import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import base from '../public/research/statsforecast-study.json';
import snapshot from '../data/statsforecast/route-traffic-snapshot.json';
import saved from '../public/research/learned-traffic-study.json';
import { forecastFrom } from '../src/lib/learned-demand';
import { DGCA_SHOCK, LEARNED_POLICY, routeHistory, runLearnedTrafficStudy, type BaseStudy, type TrafficSnapshot } from '../src/lib/learned-traffic-study';

const study = base as unknown as BaseStudy, snap = snapshot as unknown as TrafficSnapshot;
const result = runLearnedTrafficStudy(study, snap);

test('uses the exact snapshot pinned by the base study', () => {
  const bytes = readFileSync('data/statsforecast/route-traffic-snapshot.json');
  assert.equal(createHash('sha256').update(bytes).digest('hex'), study.snapshotSha256);
});

test('the study rule re-applied to the four original candidates reproduces every original selection', () => {
  for (const r of result.routes) assert.equal(r.reproducedBasePolicy, r.baseSelectedPolicy, `${r.origin}-${r.destination}`);
});

test('base-method MAEs reproduce the study and every route scores the same months', () => {
  for (const r of result.routes) {
    const route = study.routes.find(x => x.origin === r.origin && x.destination === r.destination)!;
    for (const m of study.methods) {
      assert.ok(Math.abs(r.selection.mae[m] - route.selection.mae![m]!) < 1e-6, `${m} selection`);
      assert.ok(Math.abs(r.later.mae[m] - route.later.mae![m]!) < 1e-6, `${m} later`);
    }
    assert.equal(r.selection.count, route.selection.count);
    assert.equal(r.later.count, route.later.count);
  }
});

test('with the learned model added under the unchanged rule, the selected policy beats "last month" on at least 4 of 6 routes', () => {
  assert.equal(result.summary.routes, 6);
  assert.equal(result.summary.baseSelectedBeatsLastObserved, 2);
  assert.ok(result.summary.selectedBeatsLastObserved >= 4, JSON.stringify(result.summary));
  assert.equal(result.summary.selectedBeatsLastObserved, 4);
  assert.equal(result.summary.learnedSelected, 3);
});

test('learned forecasts use no data after their cutoff, and leave out COVID, ambiguous and imputed months', () => {
  const route = snap.routes.find(r => r.origin === 'BOM' && r.destination === 'DEL')!;
  const h = routeHistory(route.monthly, new Set(['2021-05', '2024-05']));
  const at = (m: string) => h.find(p => p.month === m)!;
  assert.equal(at('2020-06').exclude, true);
  assert.equal(at(DGCA_SHOCK.to).exclude, true);
  assert.equal(at('2022-03').exclude, undefined);
  assert.equal(at('2025-12').exclude, true, 'ambiguous month (Navi Mumbai opening)');
  assert.equal(at('2024-05').exclude, true, 'imputed month');
  const original = forecastFrom(h, '2026-01', 2, 'Flight');
  const future = h.map(p => p.month > '2026-01' ? { ...p, bookings: p.bookings * 5 } : p);
  assert.equal(forecastFrom(future, '2026-01', 2, 'Flight'), original);
  const past = h.map(p => p.month === '2026-01' ? { ...p, bookings: p.bookings * 1.5 } : p);
  assert.notEqual(forecastFrom(past, '2026-01', 2, 'Flight'), original);
});

test('the checked-in artifact matches a fresh run', () => {
  assert.deepEqual(saved.summary, result.summary);
  for (const r of result.routes) {
    const s = saved.routes.find(x => x.origin === r.origin && x.destination === r.destination)!;
    assert.equal(s.selectedPolicy, r.selectedPolicy);
    assert.ok(Math.abs(s.later.mae[LEARNED_POLICY as 'learned-seasonal'] - r.later.mae[LEARNED_POLICY]) < 0.1);
  }
});
