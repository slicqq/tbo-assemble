import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buyWindowFor, newsvendorProfit, normalQuantile, stayDate } from '../src/lib/buy-window';
import { opportunities } from '../src/lib/procurement-core';

test('travel periods parse to representative stay dates', () => {
  assert.equal(stayDate('Dec 2026'), Date.UTC(2026, 11, 15));
  assert.equal(stayDate('December 2026'), Date.UTC(2026, 11, 15));
  assert.equal(stayDate('2027-02'), Date.UTC(2027, 1, 15));
  assert.equal(stayDate('2027-02-20'), Date.UTC(2027, 1, 20));
  assert.equal(stayDate('2027-02-30'), null);
  assert.equal(stayDate('Q1 2027'), null);
});

test('normal quantile and newsvendor helpers behave', () => {
  assert.ok(Math.abs(normalQuantile(0.975) - 1.959964) < 1e-4 && Math.abs(normalQuantile(0.5)) < 1e-9);
  assert.equal(newsvendorProfit(100, 120, 10, 0.3), 0, 'no margin, no purchase');
  assert.ok(newsvendorProfit(150, 100, 20, 0.2) > newsvendorProfit(150, 100, 20, 0.6), 'more uncertainty, less value');
});

test('statuses: past, late, buy now, wait', () => {
  const goa = { ...opportunities[0] };
  assert.equal(buyWindowFor(goa, '2026-12-20', 9200)!.status, 'past');
  assert.equal(buyWindowFor(goa, '2026-12-05', 9200)!.status, 'late');
  const summer = { ...goa, period: 'Jun 2027' };
  const steady = buyWindowFor({ ...summer, volatility: 0.05 }, '2026-11-16', 9660)!;
  const volatile = buyWindowFor({ ...summer, volatility: 0.9 }, '2026-11-16', 9660)!;
  assert.equal(steady.status, 'in-window', steady.label);
  assert.equal(volatile.status, 'early', volatile.label);
  assert.ok(volatile.optimalLead < steady.optimalLead, 'uncertain products should commit later');
  for (const w of [steady, volatile]) {
    assert.ok(w.windowEnd >= 14 && w.windowStart <= w.leadDays && w.optimalLead >= w.windowEnd && w.optimalLead <= w.windowStart);
    assert.ok(w.reason.includes('Assumes'));
  }
  assert.equal(buyWindowFor({ ...goa, period: 'Peak season' }, '2026-11-16', 9200), undefined);
});
