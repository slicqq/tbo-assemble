import type { Opportunity } from './procurement-core';

/**
 * Deterministic synthetic portfolios at TBO-like scale, for benchmarks, tests and the "large portfolio" demo.
 * Every value is invented (clearly labelled in the UI); the shapes follow the demo inventory: hotel and flight
 * products across many destinations and travel periods, some with allotment terms, minimum orders, order fees,
 * stock already held and expiring supplier quotes.
 */
const DESTINATIONS: [string, number][] = [
  ['Goa', 1.3], ['Dubai', 1.4], ['Bali', 1.2], ['Jaipur', 1.0], ['Kerala', 1.1], ['Bangkok', 1.2], ['Singapore', 1.3], ['Phuket', 1.1],
  ['Maldives', 1.5], ['Udaipur', 1.0], ['Manali', 0.9], ['Shimla', 0.9], ['Srinagar', 1.0], ['Andaman', 1.2], ['Rishikesh', 0.8], ['Varanasi', 0.8],
  ['Kuala Lumpur', 1.1], ['Colombo', 0.9], ['Kathmandu', 0.9], ['Hanoi', 1.0], ['Ho Chi Minh City', 1.0], ['Istanbul', 1.2], ['London', 1.4], ['Paris', 1.4],
  ['Zurich', 1.5], ['Tokyo', 1.4], ['Seoul', 1.2], ['Hong Kong', 1.3], ['Doha', 1.2], ['Abu Dhabi', 1.3], ['Muscat', 1.0], ['Baku', 0.9],
  ['Almaty', 0.9], ['Tbilisi', 0.9], ['Mauritius', 1.3], ['Seychelles', 1.4], ['Cairo', 1.0], ['Nairobi', 1.0], ['Sydney', 1.4], ['Bengaluru', 1.0],
];
const PERIODS = ['Dec 2026', 'Jan 2027', 'Feb 2027', 'Mar 2027'];
const CHANNELS: Opportunity['integration'][] = ['Supplier API', 'Direct contract', 'Airline allotment', 'Bedbank'];

function rng(seed: number) {
  let s = (seed >>> 0) || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

export function syntheticPortfolio(n: number, seed = 20261116): Opportunity[] {
  const R = rng(seed), u = (a: number, b: number) => a + (b - a) * R(), pick = <T,>(xs: T[]) => xs[Math.floor(R() * xs.length)];
  const items: Opportunity[] = [];
  for (let i = 0; i < n; i++) {
    const [destination, priceLevel] = DESTINATIONS[i % DESTINATIONS.length];
    const kind: Opportunity['kind'] = R() < 0.3 ? 'Flight' : 'Hotel';
    const buy = Math.round(u(kind === 'Flight' ? 7000 : 2500, kind === 'Flight' ? 20000 : 11000) * priceLevel / 50) * 50;
    const referencePrice = Math.round(buy * u(1.12, 1.55) / 10) * 10;
    const capacity = Math.max(10, Math.round(u(20, 220)));
    const conversion = +u(0.025, 0.065).toFixed(3), bookings = Math.round(u(15, 180));
    const item: Opportunity = {
      id: `syn-${i + 1}`, name: `${destination} ${kind === 'Hotel' ? 'hotel' : 'seats'} ${Math.floor(i / DESTINATIONS.length) + 1}`,
      destination, kind, period: pick(PERIODS), buy, referencePrice, capacity, bookings,
      searches: Math.round(bookings / conversion * u(0.8, 1.25)), conversion,
      seasonal: +u(0.8, 1.3).toFixed(2), signal: +u(0.9, 1.15).toFixed(2), cancellations: +u(0.04, 0.22).toFixed(2),
      volatility: +u(0.12, 0.42).toFixed(2), soldOut: Math.round(u(0, 28)), integration: pick(CHANNELS), timing: 'Monitor',
      quoteExpiry: `2026-12-${String(1 + Math.floor(R() * 27)).padStart(2, '0')}`,
    };
    if (R() < 0.6) { item.previousBookings = Math.round(bookings * u(0.75, 1.2)); item.previousSearches = Math.round(item.searches * u(0.75, 1.2)); }
    if (R() < 0.5) item.previousBuy = Math.round(buy * u(0.85, 1.05));
    if (R() < 0.3) item.existingStock = Math.round(u(0, 15));
    if (R() < 0.35) {
      item.allotmentBuy = Math.round(buy * u(1.04, 1.12) / 50) * 50;
      item.allotmentCapacity = Math.max(5, Math.round(capacity * u(0.2, 0.5)));
      item.allotmentDepositPct = +u(0.15, 0.35).toFixed(2);
    }
    if (R() < 0.15) item.minOrderUnits = Math.round(u(5, 20));
    if (R() < 0.1) item.fixedOrderFee = Math.round(u(5000, 25000) / 500) * 500;
    item.recoveryPct = +u(0, 0.3).toFixed(2);
    items.push(item);
  }
  return items;
}

/** Total cost of buying every product's full capacity at its pre-paid price (a natural budget scale). */
export const fullCapacityCost = (items: Opportunity[]) => items.reduce((sum, o) => sum + o.capacity * o.buy, 0);
