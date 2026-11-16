import type { Opportunity } from './procurement-core';

/**
 * Forward-looking buy-window advisor (risk-cvar-v5): commit now at the supplied quote, or wait?
 * Waiting sharpens the demand forecast, but contract prices usually drift up as arrival nears,
 * while committing early ties up capital for longer. Expected newsvendor profit is evaluated for
 * every possible commit date from today until 14 days before the stay. The window is every date
 * within 5% of the best one, and its last day is the buy-by date.
 *
 * All parameters are explicit assumptions until dated TBO quote and forecast-error histories exist.
 */
export const TIMING_ASSUMPTIONS = {
  /** Price drift if you wait: +2% of the reference price per 30 days, capped at +8%. */
  driftPerMonth: 0.02,
  maxDrift: 0.08,
  /** Annual cost of capital tied up in pre-paid inventory. */
  capitalCostRate: 0.12,
  /** Forecast CV shrinks with lead time L: CV(L) ∝ floor + (1 − floor)·√(L/90), anchored to the supplied volatility today. */
  uncertaintyFloor: 0.5,
  /** Commitments closer than this to the stay are treated as spot / free-sale. */
  minimumLead: 14,
  windowShare: 0.95,
} as const;

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const DAY = 86400000;

/** Representative stay date for a travel period: mid-month for "Dec 2026" / "2026-12", or an exact YYYY-MM-DD. */
export function stayDate(period: string): number | null {
  const text = period.trim().toLowerCase();
  let m = /^([a-z]{3})[a-z]*\.?\s+(\d{4})$/.exec(text);
  if (m && MONTHS.includes(m[1])) return Date.UTC(Number(m[2]), MONTHS.indexOf(m[1]), 15);
  m = /^(\d{4})-(\d{2})$/.exec(text);
  if (m && Number(m[2]) >= 1 && Number(m[2]) <= 12) return Date.UTC(Number(m[1]), Number(m[2]) - 1, 15);
  m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (m) { const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])); if (new Date(t).toISOString().slice(0, 10) === text) return t; }
  return null;
}

function normalCdf(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989422804014327 * Math.exp(-x * x / 2);
  const p = d * t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return x >= 0 ? 1 - p : p;
}

/** Acklam's rational approximation of the standard normal quantile. */
export function normalQuantile(p: number): number {
  const q0 = Math.min(1 - 1e-12, Math.max(1e-12, p));
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  const lo = 0.02425, hi = 1 - lo;
  if (q0 < lo) { const q = Math.sqrt(-2 * Math.log(q0)); return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
  if (q0 > hi) { const q = Math.sqrt(-2 * Math.log(1 - q0)); return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
  const q = q0 - 0.5, r = q * q;
  return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}

/** Expected newsvendor profit per unit of mean demand (lognormal demand, mean 1, coefficient of variation cv). */
export function newsvendorProfit(price: number, cost: number, salvage: number, cv: number): number {
  if (!(price > cost) || cost <= 0) return 0;
  const s = Math.sqrt(Math.log(1 + Math.max(1e-6, cv) ** 2)), mu = -s * s / 2;
  const critical = Math.min(0.999, Math.max(0.001, (price - cost) / (price - Math.min(salvage, cost))));
  const q = Math.exp(mu + s * normalQuantile(critical));
  const expectedSold = normalCdf((Math.log(q) - mu - s * s) / s) + q * (1 - normalCdf((Math.log(q) - mu) / s));
  return price * expectedSold + salvage * (q - expectedSold) - cost * q;
}

const iso = (t: number) => new Date(t).toISOString().slice(0, 10);

export function buyWindowFor(item: Opportunity, asOf: string, price: number): NonNullable<import('./procurement-core').PlanRow['buyWindow']> | undefined {
  const stay = stayDate(item.period), today = Date.parse(asOf + 'T00:00:00Z');
  if (stay === null || !Number.isFinite(today) || !(item.referencePrice > 0) || !(item.buy > 0)) return undefined;
  const A = TIMING_ASSUMPTIONS, lead = Math.round((stay - today) / DAY);
  if (lead <= 0) return { leadDays: lead, optimalLead: 0, windowStart: 0, windowEnd: 0, status: 'past', label: 'Travel period has started', reason: 'The representative stay date has passed; only in-season selling decisions remain.' };
  if (lead < A.minimumLead) return { leadDays: lead, optimalLead: lead, windowStart: lead, windowEnd: lead, status: 'late', label: 'Late: spot / free-sale only', reason: `Only ${lead} days remain before the representative stay date. Use free-sale or flexible allotment for the remaining need.` };
  const recovery = Math.min(1, Math.max(0, item.recoveryPct ?? 0));
  const volatility = Math.max(0.01, item.volatility);
  const shape = (L: number) => A.uncertaintyFloor + (1 - A.uncertaintyFloor) * Math.sqrt(L / 90);
  const value = (L: number) => {
    const drift = Math.min(A.maxDrift, A.driftPerMonth * (lead - L) / 30);
    const cost = item.buy + item.referencePrice * drift;
    const carried = cost * (1 + A.capitalCostRate * L / 365);
    return newsvendorProfit(price, carried, cost * recovery, volatility * shape(L) / shape(lead));
  };
  const values = new Map<number, number>();
  let best = lead, bestValue = -Infinity;
  for (let L = lead; L >= A.minimumLead; L--) { const v = value(L); values.set(L, v); if (v > bestValue + 1e-12) { bestValue = v; best = L; } }
  if (!(bestValue > 0)) return { leadDays: lead, optimalLead: best, windowStart: best, windowEnd: best, status: 'late', label: 'No profitable commit date at this price', reason: 'At the selected selling price the modelled contract cost leaves no expected margin on any remaining commit date.' };
  let hi = best, lo = best;
  while (hi < lead && values.get(hi + 1)! >= A.windowShare * bestValue) hi++;
  while (lo > A.minimumLead && values.get(lo - 1)! >= A.windowShare * bestValue) lo--;
  const opens = iso(stay - hi * DAY), closes = iso(stay - lo * DAY), bestDate = iso(stay - best * DAY);
  const last = values.get(A.minimumLead)!, uplift = last > 0 ? bestValue / last - 1 : null;
  const status: 'early' | 'in-window' = hi >= lead ? 'in-window' : 'early';
  const label = status === 'in-window' ? `Buy now · buy by ${closes}` : `Wait · window ${opens} → ${closes}`;
  const reason = `${status === 'in-window' ? 'Committing now is within 5% of the best modelled timing' : `Waiting until about ${bestDate} is modelled to beat committing now, as the forecast sharpens`}; the window closes ${closes} (${lo} days before the stay).${uplift !== null && uplift > 0.005 ? ` Best timing is worth about ${Math.round(uplift * 100)}% more than a last-minute commitment.` : ''} Assumes +${Math.round(A.driftPerMonth * 100)}% price drift per 30 days of waiting (cap ${Math.round(A.maxDrift * 100)}%), ${Math.round(A.capitalCostRate * 100)}% annual cost of capital and forecast uncertainty that falls as the stay approaches.`;
  return { leadDays: lead, optimalLead: best, windowStart: hi, windowEnd: lo, status, label, reason };
}
