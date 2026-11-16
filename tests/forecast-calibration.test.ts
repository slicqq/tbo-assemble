import { test } from 'node:test';
import assert from 'node:assert/strict';
import sg from '../src/data/singapore-gross-lettings.json';
import snapshot from '../data/statsforecast/route-traffic-snapshot.json';
import { publicPortfolio } from '../src/lib/public-portfolio';
import { bandCoverage, learnDemand } from '../src/lib/learned-demand';
import { routeHistory, type TrafficSnapshot } from '../src/lib/learned-traffic-study';
import { SINGAPORE_SHOCK } from '../src/lib/singapore-demand';

/** Out-of-sample coverage of the planner's "80%" demand band on 15 real monthly series (360 forecasts). */
test('the 80% demand band covers about 80% of later outcomes on real series', () => {
  const cases: { name: string; r: ReturnType<typeof bandCoverage> }[] = [];
  for (const item of publicPortfolio()) cases.push({ name: item.id, r: bandCoverage(item.history!, learnDemand(item)!.horizon, item.kind) });
  const sgHistory = sg.rows.map(r => ({ month: r.month, bookings: r.occupiedRoomNights, ...(r.month >= SINGAPORE_SHOCK.from && r.month <= SINGAPORE_SHOCK.to ? { exclude: true } : {}) }));
  cases.push({ name: 'singapore h3', r: bandCoverage(sgHistory, 3) });
  for (const route of (snapshot as unknown as TrafficSnapshot).routes)
    cases.push({ name: `${route.origin}-${route.destination} h2`, r: bandCoverage(routeHistory(route.monthly, new Set(['2021-05', '2024-05'])), 2, 'Flight') });
  const n = cases.reduce((s, c) => s + c.r.n, 0), covered = cases.reduce((s, c) => s + c.r.covered, 0);
  for (const c of cases) console.log(`${c.name.padEnd(16)} ${c.r.covered}/${c.r.n} = ${(c.r.coverage * 100).toFixed(0)}%  width ×${c.r.meanWidth.toFixed(2)}`);
  console.log(`pooled ${covered}/${n} = ${(covered / n * 100).toFixed(1)}%`);
  assert.equal(cases.length, 15);
  assert.ok(n >= 300, `${n} forecasts`);
  assert.ok(covered / n >= 0.75 && covered / n <= 0.88, `pooled coverage ${covered / n}`);
});
