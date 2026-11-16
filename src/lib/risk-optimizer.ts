import { timingFor, type BudgetBasis, type Opportunity, type PlanOptions, type PlanRow } from './procurement-core';
import { buildScenarioSet, type ScenarioAssumptions, type ScenarioSet } from './risk-scenarios';
import { forecastUnconstrained, lostBookings } from './demand-unconstraining';
import { buyWindowFor } from './buy-window';
import { demandSourceOf, elasticityOf, priceResponse, volatilityOf } from './learned-demand';

/**
 * Portfolio risk engine (risk-cvar-v5).
 *
 *   maximise  (1 − r) · E[season profit]  +  r · CVaR10%[season profit]
 *
 * over whole units of pre-paid inventory and (optionally) flexible allotments, subject to the
 * hard budget (cash committed by default, or capital at risk), supplier capacity, minimum order, fixed order fee and quote expiry.
 * Season profit is summed across products in each correlated scenario, so diversification and
 * shared shocks are priced in. `r` is the existing 0–0.8 risk-appetite setting.
 *
 * The plan is optimised on one scenario set and scored on a second, independent set, so the KPIs
 * are out-of-sample with respect to the scenarios used for optimisation. Both sets come from the
 * same assumed model (see risk-scenarios.ts). This does not validate the model itself.
 */
export const RISK_ENGINE_VERSION = 'risk-cvar-v5' as const;
export const RISK_ENGINE_DEFAULTS = { alpha: 0.1, scenarioCount: 500, evaluationCount: 2000, seed: 20261116 } as const;
export const DEFAULT_ALLOTMENT_DEPOSIT = 0.25;
/**
 * Candidate selling prices: the reference price ±15% in 2.5% steps (reference first, so it wins ties).
 * Demand responds with the product's own price elasticity (learned-demand.ts: learned from price history, otherwise
 * the Lerner-implied prior), kinked at the reference price (mark-ups lose demand faster than discounts win it).
 */
const PRICE_MULTIPLIERS = [1, 0.975, 1.025, 0.95, 1.05, 0.925, 1.075, 0.9, 1.1, 0.875, 1.125, 0.85, 1.15];
const MAX_GREEDY_STEPS = 12000;

export type Decision = { prepaid: number; allotment: number; price: number };
export type RiskMetrics = { spend: number; expectedProfit: number; cvar: number; valueAtRisk: number; pLoss: number; p05: number; p95: number; servedShare: number; expectedUnsold: number };
export type RiskSummary = RiskMetrics & {
  engine: typeof RISK_ENGINE_VERSION; alpha: number; scenarioCount: number; evaluationCount: number; seed: number; budgetBasis: BudgetBasis;
  servedShareBefore: number; units: number; prepaidUnits: number; allotmentUnits: number;
  histogram: { from: number; to: number; count: number; tail: boolean }[];
  legacy?: RiskMetrics;
};
/**
 * Availability target: the minimum expected share of modelled demand (incl. existing stock) the plan
 * should serve. The planner meets it by adding the smallest per-booking "service value" μ to every
 * unit sold that makes the optimal plan reach the target, so the trade-off stays explicit: μ is the
 * implied value of one more booking served, and the costs show the profit and CVaR given up.
 */
export type ServiceSummary = {
  target: number;
  status: 'off' | 'not-binding' | 'met' | 'unreachable';
  /** Out-of-sample share of modelled demand served by the chosen plan (incl. existing stock). */
  servedShare: number;
  /** The same measure for the plan without a target. */
  servedShareWithoutTarget: number;
  /** Implied ₹ value per extra booking served needed to meet the target (0 when off or not binding). */
  serviceValue: number;
  /** Out-of-sample expected profit and CVaR given up versus the plan without a target. */
  expectedProfitCost: number;
  cvarCost: number;
  /** When unreachable: about the most demand this budget and supplier capacity can serve (out-of-sample). */
  maxServedShare?: number;
};
export type RiskOptimizedPlan = {
  rows: PlanRow[]; objective: number; upperBound: number; gap: number; baselineObjective: number;
  /** 'risk-cvar-decomposition' is the default; 'risk-cvar-local-search' when `solver: 'local-search'` is requested. */
  algorithm: 'risk-cvar-local-search' | 'risk-cvar-decomposition'; bucketCount: number; engine: typeof RISK_ENGINE_VERSION; risk: RiskSummary;
  /** 'joint': selling prices are chosen together with quantities and covered by the upper bound. */
  pricing: 'joint' | 'fixed'; service: ServiceSummary;
};

type Model = {
  item: Opportunity; price: number; demand: Float64Array; gross: Float64Array; priceMultiplier: Float64Array;
  buy: number; salvage: number; allotBuy: number; deposit: number; capPrepaid: number; capAllot: number; cap: number;
  minimum: number; fee: number; stock: number; expired: boolean;
  /** Budget used per allotment unit: its full net cost ('cash') or only its deposit ('capital-at-risk'). */
  allotCapital: number;
  /** Per scenario: value of the stock already held at this price minus its value at the reference price (decision-independent). */
  stockTerm: Float64Array;
  /**
   * Availability is measured against max(demand at this price, demand at today's reference price), i.e. gross × marketScale.
   * Customers priced out by a mark-up therefore count as not served, and a price cut cannot push the share above 100%.
   */
  marketScale: number;
  /** Availability-target service value μ (₹ per unit sold) added to the optimisation objective only; 0 for reporting. */
  serviceValue: number;
};

const clamp = (x: number, lo: number, hi: number) => (Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : lo);

function buildModel(item: Opportunity, index: number, set: ScenarioSet, price: number, asOf: string, serviceValue = 0, basis: BudgetBasis = 'cash'): Model {
  const planned = forecastUnconstrained(item), elasticity = elasticityOf(item) * (set.elasticityMultiplier ?? 1);
  const base = planned * priceResponse(price, item.referencePrice, elasticity);
  const stock = Math.max(0, item.existingStock || 0);
  const salvage = item.buy * clamp(item.recoveryPct ?? 0, 0, 1), service = Math.max(0, Number.isFinite(serviceValue) ? serviceValue : 0);
  const refPrice = Math.max(1, Math.round(item.referencePrice)), refBase = planned * priceResponse(refPrice, item.referencePrice, elasticity);
  const demand = new Float64Array(set.count), gross = new Float64Array(set.count), stockTerm = stock > 0 ? new Float64Array(set.count) : zerosOf(set.count);
  for (let s = 0; s < set.count; s++) {
    gross[s] = base * set.demand[index][s]; demand[s] = Math.max(0, gross[s] - stock);
    if (stock > 0) {
      // Stock already held sells first, at the chosen price. A price change re-prices those units too, so the
      // objective counts their revenue relative to selling them at the reference price (unsold stock is salvaged).
      const soldNow = Math.min(stock, gross[s]), soldRef = Math.min(stock, refBase * set.demand[index][s]), multiplier = set.price[index][s];
      stockTerm[s] = soldNow * (price * multiplier + service) - soldRef * (refPrice * multiplier + service) + (soldRef - soldNow) * salvage;
    }
  }
  const expired = timingFor(item, asOf).expired;
  const cap = expired ? 0 : Math.max(0, Math.floor(item.capacity));
  const hasAllot = (item.allotmentBuy ?? 0) > 0 && (item.allotmentCapacity ?? 0) > 0;
  const allotBuy = hasAllot ? item.allotmentBuy! : 0, deposit = hasAllot ? clamp(item.allotmentDepositPct ?? DEFAULT_ALLOTMENT_DEPOSIT, 0, 1) : 0;
  return {
    item, price, demand, gross, priceMultiplier: set.price[index], buy: item.buy, salvage,
    allotBuy, deposit, allotCapital: basis === 'cash' ? allotBuy : deposit * allotBuy,
    capPrepaid: cap, capAllot: hasAllot ? Math.min(cap, Math.floor(item.allotmentCapacity!)) : 0, cap,
    minimum: Math.max(1, Math.floor(item.minOrderUnits ?? 1)), fee: Math.max(0, item.fixedOrderFee ?? 0), stock, expired,
    serviceValue: service, stockTerm, marketScale: base > 0 ? Math.max(1, refBase / base) : 1,
  };
}

/** Units sold in scenario s. Each unit type is sold only when selling beats leaving it unsold, best value first. */
function sales(m: Model, q: number, a: number, s: number): [number, number] {
  if (q <= 0 && a <= 0) return [0, 0];
  const p = m.price * m.priceMultiplier[s] + m.serviceValue, d = m.demand[s];
  const vq = p - m.salvage, va = a > 0 ? p - m.allotBuy * (1 - m.deposit) : -Infinity;
  let xq = 0, xa = 0;
  if (vq >= va) { if (vq > 0) xq = Math.min(q, d); if (va > 0) xa = Math.min(a, d - xq); }
  else { if (va > 0) xa = Math.min(a, d); if (vq > 0) xq = Math.min(q, d - xa); }
  return [xq, xa];
}

function profit(m: Model, q: number, a: number, s: number): number {
  if (q <= 0 && a <= 0) return 0;
  const [xq, xa] = sales(m, q, a, s);
  const p = m.price * m.priceMultiplier[s];
  return xq * p + (q - xq) * m.salvage - q * m.buy + xa * (p - m.allotBuy) - (a - xa) * m.deposit * m.allotBuy - m.fee + m.serviceValue * (xq + xa);
}

const ZEROS = new Map<number, Float64Array>();
/** A shared, never-written zero vector (products without held stock share one instead of allocating per price option). */
function zerosOf(length: number): Float64Array {
  let z = ZEROS.get(length);
  if (!z) { z = new Float64Array(length); ZEROS.set(length, z); }
  return z;
}

/** Budget usage: full pre-paid cost, allotment units at `allotCapital` (full value for 'cash', deposit for 'capital-at-risk') and the fixed fee. */
function capital(m: Model, q: number, a: number): number {
  return q > 0 || a > 0 ? q * m.buy + a * m.allotCapital + m.fee : 0;
}

/** Partially sorts `work` so work[0..k-1] are the k smallest values, then returns their mean. */
export function smallestMean(values: Float64Array, k: number, work: Float64Array = new Float64Array(values.length)): number {
  const n = values.length;
  if (n === 0) return 0;
  k = Math.max(1, Math.min(n, k));
  work.set(values);
  let lo = 0, hi = n - 1;
  const target = k - 1;
  while (lo < hi) {
    const pivot = work[(lo + hi) >> 1];
    let i = lo, j = hi;
    while (i <= j) {
      while (work[i] < pivot) i++;
      while (work[j] > pivot) j--;
      if (i <= j) { const t = work[i]; work[i] = work[j]; work[j] = t; i++; j--; }
    }
    if (target <= j) hi = j; else if (target >= i) lo = i; else break;
  }
  let sum = 0;
  for (let i = 0; i < k; i++) sum += work[i];
  return sum / k;
}

function objectiveOf(P: Float64Array, risk: number, k: number, work: Float64Array): number {
  let sum = 0;
  for (let s = 0; s < P.length; s++) sum += P[s];
  return (1 - risk) * (sum / P.length) + risk * smallestMean(P, k, work);
}

/** The five candidate selling prices (deduplicated after rounding), reference price first. */
function candidatePrices(item: Opportunity): number[] {
  return Array.from(new Set(PRICE_MULTIPLIERS.map(multiplier => Math.max(1, Math.round(item.referencePrice * multiplier)))));
}

/** Stand-alone starting price for one product (its own objective at a few quantities). Joint pricing refines it. */
function choosePrice(item: Opportunity, index: number, set: ScenarioSet, risk: number, k: number, asOf: string, budget: number, serviceValue = 0, basis: BudgetBasis = 'cash'): number {
  const reference = Math.max(1, Math.round(item.referencePrice));
  if (timingFor(item, asOf).expired || (item.capacity <= 0 && !((item.existingStock ?? 0) > 0))) return reference;
  const work = new Float64Array(set.count), vec = new Float64Array(set.count);
  let bestPrice = reference, bestScore = 0;
  for (const multiplier of PRICE_MULTIPLIERS) {
    const price = Math.max(1, Math.round(item.referencePrice * multiplier));
    const m = buildModel(item, index, set, price, asOf, serviceValue, basis);
    const candidates: [number, number][] = [];
    const maxQ = Math.min(m.capPrepaid, Math.floor((budget - m.fee) / m.buy));
    if (maxQ >= m.minimum) for (let j = 0; j <= 20; j++) candidates.push([Math.round(m.minimum + (maxQ - m.minimum) * j / 20), 0]);
    if (m.capAllot > 0 && m.allotCapital > 0) {
      const maxA = Math.min(m.capAllot, Math.floor((budget - m.fee) / m.allotCapital));
      for (let j = 1; j <= 10 && maxA >= 1; j++) candidates.push([0, Math.max(1, Math.round(maxA * j / 10))]);
    }
    if (m.stock > 0) candidates.push([0, 0]); // the price also matters for stock already held
    for (const [q, a] of candidates) {
      for (let s = 0; s < set.count; s++) vec[s] = profit(m, q, a, s) + m.stockTerm[s];
      const score = objectiveOf(vec, risk, k, work);
      if (score > bestScore + 1e-9) { bestScore = score; bestPrice = price; }
    }
  }
  return bestPrice;
}

type State = { q: Float64Array; a: Float64Array; itemProfit: Float64Array[]; P: Float64Array; spent: number; objective: number };

function cloneState(x: State): State {
  return { q: x.q.slice(), a: x.a.slice(), itemProfit: x.itemProfit.map(v => v.slice()), P: x.P.slice(), spent: x.spent, objective: x.objective };
}

class Allocator {
  readonly S: number;
  private work: Float64Array;
  private trial: Float64Array;
  steps = 0;
  constructor(private models: Model[], private budget: number, private risk: number, private k: number) {
    this.S = models[0]?.demand.length ?? 0;
    this.work = new Float64Array(this.S);
    this.trial = new Float64Array(this.S);
  }
  empty(): State {
    const P = new Float64Array(this.S);
    // Nothing bought: each product is worth its held-stock term (zero at the reference price or without stock).
    const itemProfit = this.models.map(m => { const v = m.stockTerm.slice(); for (let s = 0; s < this.S; s++) P[s] += v[s]; return v; });
    return { q: new Float64Array(this.models.length), a: new Float64Array(this.models.length), itemProfit, P, spent: 0, objective: objectiveOf(P, this.risk, this.k, this.work) };
  }
  /** Objective after changing item i to (q, a), without committing. */
  score(x: State, i: number, q: number, a: number): number {
    const m = this.models[i], old = x.itemProfit[i], t = this.trial;
    for (let s = 0; s < this.S; s++) t[s] = x.P[s] - old[s] + profit(m, q, a, s) + m.stockTerm[s];
    return objectiveOf(t, this.risk, this.k, this.work);
  }
  /** Recomputes item i's scenario profits after its model (price) changed; quantities are unchanged. */
  rebase(x: State, i: number): void {
    const m = this.models[i], old = x.itemProfit[i];
    for (let s = 0; s < this.S; s++) { const v = profit(m, x.q[i], x.a[i], s) + m.stockTerm[s]; x.P[s] += v - old[s]; old[s] = v; }
    x.objective = objectiveOf(x.P, this.risk, this.k, this.work);
  }
  set(x: State, i: number, q: number, a: number): void {
    const m = this.models[i], old = x.itemProfit[i];
    x.spent += capital(m, q, a) - capital(m, x.q[i], x.a[i]);
    for (let s = 0; s < this.S; s++) { const v = profit(m, q, a, s) + m.stockTerm[s]; x.P[s] += v - old[s]; old[s] = v; }
    x.q[i] = q; x.a[i] = a;
    x.objective = objectiveOf(x.P, this.risk, this.k, this.work);
  }
  /** Greedy: repeatedly apply the feasible increment with the best objective gain per rupee. */
  fill(x: State, startStep: number, allowAllot = true): void {
    let step = Math.max(1, Math.floor(startStep));
    while (this.steps < MAX_GREEDY_STEPS) {
      this.steps++;
      let best = -1, bestQ = 0, bestA = 0, bestRatio = 0;
      for (let i = 0; i < this.models.length; i++) {
        const m = this.models[i], q = x.q[i], a = x.a[i], room = m.cap - q - a;
        if (room <= 0) continue;
        const moves: [number, number][] = [];
        if (m.capPrepaid > q) {
          const nq = Math.min(q === 0 ? Math.max(m.minimum, step) : q + step, m.capPrepaid, q + room);
          if (nq > q && nq >= m.minimum) moves.push([nq, a]);
        }
        if (allowAllot && m.capAllot > a) {
          const na = Math.min(a + step, m.capAllot, a + room);
          if (na > a) moves.push([q, na]);
        }
        for (const [nq, na] of moves) {
          const cost = capital(m, nq, na) - capital(m, q, a);
          if (!(cost > 0) || x.spent + cost > this.budget) continue;
          const gain = this.score(x, i, nq, na) - x.objective;
          if (gain > 1e-9 && gain / cost > bestRatio) { best = i; bestQ = nq; bestA = na; bestRatio = gain / cost; }
        }
      }
      if (best < 0) { if (step === 1) return; step = Math.max(1, Math.floor(step / 2)); continue; }
      this.set(x, best, bestQ, bestA);
    }
  }
  /** Exact-on-a-grid best response for one product, holding the others fixed. */
  scan(x: State, i: number): boolean {
    const m = this.models[i];
    if (m.cap <= 0) return false;
    const available = this.budget - (x.spent - capital(m, x.q[i], x.a[i]));
    const add = (set: Set<number>, v: number, hi: number) => { if (v >= 0 && v <= hi) set.add(Math.round(v)); };
    const qs = new Set<number>([0]), as = new Set<number>([0]);
    const maxQ = Math.min(m.capPrepaid, Math.floor(Math.max(0, available - m.fee) / m.buy));
    if (maxQ >= m.minimum) for (let j = 0; j <= 14; j++) add(qs, m.minimum + (maxQ - m.minimum) * j / 14, maxQ);
    for (const d of [-2, -1, 0, 1, 2]) add(qs, x.q[i] + d, maxQ);
    const unitCapital = m.allotCapital;
    const maxA = m.capAllot > 0 ? Math.min(m.capAllot, unitCapital > 0 ? Math.floor(Math.max(0, available - m.fee) / unitCapital) : m.capAllot) : 0;
    for (let j = 1; j <= 8 && maxA > 0; j++) add(as, maxA * j / 8, maxA);
    for (const d of [-2, -1, 0, 1, 2]) add(as, x.a[i] + d, maxA);
    let best = x.objective, bq = x.q[i], ba = x.a[i];
    for (const q of qs) {
      if (q > 0 && q < m.minimum) continue;
      for (const a of as) {
        if (q + a > m.cap || (q === x.q[i] && a === x.a[i]) || capital(m, q, a) > available) continue;
        const v = this.score(x, i, q, a);
        if (v > best + 1e-9 * Math.max(1, Math.abs(best))) { best = v; bq = q; ba = a; }
      }
    }
    if (bq === x.q[i] && ba === x.a[i]) return false;
    this.set(x, i, bq, ba);
    return true;
  }
  /** Remove a block of units from one product and greedily re-spend the freed budget. */
  private removeRefill(x: State, maxCap: number): State {
    let current = x;
    for (let round = 0; round < 4 && this.steps < MAX_GREEDY_STEPS; round++) {
      let improved = false;
      for (let i = 0; i < this.models.length && !improved; i++) {
        for (const type of ['q', 'a'] as const) {
          const units = type === 'q' ? current.q[i] : current.a[i];
          if (units <= 0) continue;
          const sizes = Array.from(new Set([units, Math.ceil(units / 2), Math.max(1, Math.floor(units / 4)), Math.max(1, Math.floor(maxCap / 16)), 1])).filter(r => r >= 1 && r <= units);
          for (const r of sizes) {
            const trial = cloneState(current);
            let nq = trial.q[i], na = trial.a[i];
            if (type === 'q') { nq = units - r; if (nq > 0 && nq < this.models[i].minimum) nq = 0; } else na = units - r;
            this.set(trial, i, nq, na);
            // Best-objective responses first (ratio-greedy alone can re-buy the removed product), then top up.
            if (r === units) for (let j = 0; j < this.models.length; j++) if (j !== i) this.scan(trial, j);
            this.fill(trial, r);
            if (trial.objective > current.objective + 1e-7 * Math.max(1, Math.abs(current.objective))) { current = trial; improved = true; break; }
          }
          if (improved) break;
        }
      }
      if (!improved) break;
    }
    return current;
  }
  /**
   * Empty-plan escape: when no single product is worth buying on its own (each adds more tail risk than
   * value), a pair can still pay through diversification. Tries the smallest increment of every pair of
   * products and keeps the best improving one. Only acts on an empty plan, so non-empty plans are unchanged.
   */
  seedPair(x: State): boolean {
    if (x.q.some(v => v > 0) || x.a.some(v => v > 0)) return false;
    const first = (m: Model): [number, number][] => [...(m.capPrepaid >= m.minimum && m.cap >= m.minimum ? [[m.minimum, 0] as [number, number]] : []), ...(m.capAllot > 0 ? [[0, 1] as [number, number]] : [])];
    const t = this.trial;
    let best = x.objective + 1e-9 * Math.max(1, Math.abs(x.objective)), choice: [number, number, number, number, number, number] | null = null;
    for (let i = 0; i < this.models.length; i++) for (let j = i + 1; j < this.models.length; j++) {
      for (const [qi, ai] of first(this.models[i])) for (const [qj, aj] of first(this.models[j])) {
        if (capital(this.models[i], qi, ai) + capital(this.models[j], qj, aj) > this.budget) continue;
        for (let s = 0; s < this.S; s++) t[s] = x.P[s] + profit(this.models[i], qi, ai, s) + profit(this.models[j], qj, aj, s);
        const v = objectiveOf(t, this.risk, this.k, this.work);
        if (v > best) { best = v; choice = [i, qi, ai, j, qj, aj]; }
      }
    }
    if (!choice) return false;
    this.set(x, choice[0], choice[1], choice[2]);
    this.set(x, choice[3], choice[4], choice[5]);
    return true;
  }
  /** Cheap pass: per-product best responses, then top up any remaining budget. */
  light(x: State): void {
    for (let round = 0; round < 3; round++) {
      let any = false;
      for (let i = 0; i < this.models.length; i++) if (this.scan(x, i)) any = true;
      if (!any) break;
    }
    this.fill(x, 1);
    if (this.seedPair(x)) this.light(x);
  }
  /** Full local search: per-product best responses, then budget re-allocation between products. */
  improve(x: State, maxCap: number): State {
    let current = x;
    for (let outer = 0; outer < 4; outer++) {
      const before = current.objective;
      for (let round = 0; round < 3; round++) {
        let any = false;
        for (let i = 0; i < this.models.length; i++) if (this.scan(current, i)) any = true;
        if (!any) break;
      }
      this.fill(current, 1);
      current = this.removeRefill(current, maxCap);
      if (!(current.objective > before + 1e-7 * Math.max(1, Math.abs(before)))) break;
    }
    return current;
  }
}

/** LP-dual supergradient of one product's scenario profit with respect to (pre-paid, allotment) units; fees excluded. */
function supergradient(m: Model, q: number, a: number, s: number): [number, number] {
  const p = m.price * m.priceMultiplier[s] + m.serviceValue, d = m.demand[s];
  const vq = p - m.salvage, va = m.capAllot > 0 ? p - m.allotBuy * (1 - m.deposit) : -Infinity;
  const prepaidFirst = vq >= va;
  const vh = prepaidFirst ? vq : va, vl = prepaidFirst ? va : vq, ch = prepaidFirst ? q : a, cl = prepaidFirst ? a : q;
  let uh = 0, ul = 0;
  if (vh > 0) {
    if (d < ch) { uh = 0; ul = 0; } // demand binding: dual on demand = vh
    else if (!(vl > 0)) { uh = vh; ul = 0; }
    else if (d < ch + cl) { uh = vh - vl; ul = 0; } // dual on demand = vl
    else { uh = vh; ul = vl; }
  }
  const uq = prepaidFirst ? uh : ul, ua = prepaidFirst ? ul : uh;
  return [uq + m.salvage - m.buy, m.capAllot > 0 ? ua - m.deposit * m.allotBuy : 0];
}

/**
 * Upper bound on the in-sample optimum for the chosen prices (Frank–Wolfe duality).
 * The relaxation drops integrality, minimum orders and fixed fees, which can only raise the optimum.
 * The objective is concave in units (each scenario's profit is an LP value function; CVaR is concave
 * and nondecreasing), so for any point x_t and supergradient g_t:
 *   OPT ≤ f(x_t) + max_{x∈X} g_t·(x − x_t).
 * The linear maximum over the budget/capacity polytope is bounded by Lagrangian duality; every
 * multiplier gives a valid bound. Frank–Wolfe steps on the relaxation move x_t towards its optimum
 * so the bound tightens; the minimum over all iterates is returned.
 */
function linearMax(models: Model[], gq: Float64Array, ga: Float64Array, budget: number) {
  const vertices = models.map(m => {
    if (m.cap <= 0) return [[0, 0]];
    const Q = Math.min(m.capPrepaid, m.cap), A = Math.min(m.capAllot, m.cap), points = [[0, 0], [Q, 0], [0, A]];
    if (Q + A > m.cap) { points.push([Q, m.cap - Q], [m.cap - A, A]); } else points.push([Q, A]);
    return points;
  });
  const solve = (lambda: number) => {
    let value = Number.isFinite(budget) ? lambda * budget : 0, used = 0;
    const point = models.map((m, i) => {
      let best = 0, bestCost = 0, bestPoint = [0, 0];
      for (const v of vertices[i]) {
        const cost = v[0] * m.buy + v[1] * m.allotCapital, score = gq[i] * v[0] + ga[i] * v[1] - lambda * cost;
        if (score > best) { best = score; bestCost = cost; bestPoint = v; }
      }
      value += best; used += bestCost;
      return bestPoint;
    });
    return { value, used, point };
  };
  let lo = 0, hi = 0;
  models.forEach((m, i) => {
    if (m.buy > 0) hi = Math.max(hi, gq[i] / m.buy);
    if (m.allotCapital > 0) hi = Math.max(hi, ga[i] / m.allotCapital);
  });
  let best = solve(0), feasible = best.used <= budget ? best : null;
  for (let it = 0; it < 80 && hi > 0; it++) {
    const lambda = (lo + hi) / 2, d = solve(lambda);
    if (d.value < best.value) best = d;
    if (d.used > budget) lo = lambda; else { hi = lambda; if (!feasible || d.used <= budget) feasible = d; }
  }
  const last = solve(hi);
  if (last.value < best.value) best = last;
  if (last.used <= budget) feasible = last;
  return { bound: best.value, point: (feasible ?? { point: models.map(() => [0, 0]) }).point };
}

function upperBound(models: Model[], x: State, risk: number, k: number, budget: number): number {
  const S = x.P.length, n = models.length;
  const relaxed = models.map(m => ({ ...m, fee: 0 }));
  const q = Float64Array.from(x.q), a = Float64Array.from(x.a);
  const work = new Float64Array(S), P = new Float64Array(S), trial = new Float64Array(S);
  const evalAt = (qq: Float64Array, aa: Float64Array, out: Float64Array) => {
    out.fill(0);
    for (let i = 0; i < n; i++) {
      const held = relaxed[i].stockTerm;
      for (let s = 0; s < S; s++) out[s] += held[s];
      if (qq[i] > 0 || aa[i] > 0) for (let s = 0; s < S; s++) out[s] += profit(relaxed[i], qq[i], aa[i], s);
    }
    return objectiveOf(out, risk, k, work);
  };
  let f = evalAt(q, a, P), best = Infinity;
  for (let iteration = 0; iteration < 40; iteration++) {
    const order = Array.from({ length: S }, (_, s) => s).sort((u, v) => P[u] - P[v]);
    const weight = new Float64Array(S).fill((1 - risk) / S);
    for (let j = 0; j < k; j++) weight[order[j]] += risk / k;
    const gq = new Float64Array(n), ga = new Float64Array(n);
    let linear = 0;
    for (let i = 0; i < n; i++) {
      for (let s = 0; s < S; s++) { const [g1, g2] = supergradient(relaxed[i], q[i], a[i], s); gq[i] += weight[s] * g1; ga[i] += weight[s] * g2; }
      linear += gq[i] * q[i] + ga[i] * a[i];
    }
    const lm = linearMax(relaxed, gq, ga, budget);
    best = Math.min(best, f + lm.bound - linear);
    // Frank–Wolfe step towards the linear maximiser, with a small line search.
    const dq = Float64Array.from(lm.point, (v, i) => v[0] - q[i]), da = Float64Array.from(lm.point, (v, i) => v[1] - a[i]);
    let stepBest = 0, fBest = f;
    for (const gamma of [1, 0.5, 0.25, 0.125, 0.0625, 0.03125, 0.015625]) {
      const tq = Float64Array.from(q, (v, i) => v + gamma * dq[i]), ta = Float64Array.from(a, (v, i) => v + gamma * da[i]);
      const value = evalAt(tq, ta, trial);
      if (value > fBest + 1e-9) { fBest = value; stepBest = gamma; }
    }
    if (stepBest === 0) break;
    for (let i = 0; i < n; i++) { q[i] += stepBest * dq[i]; a[i] += stepBest * da[i]; }
    f = evalAt(q, a, P);
  }
  return Math.max(x.objective, best + Math.max(1e-7, Math.abs(best) * 1e-12));
}

/** F(u) = Σ_s w_s · min(u, d_s) for integer u = 0..U (w ≥ 0), via sorted demands and prefix sums. */
function minCurve(w: Float64Array, d: Float64Array, U: number): Float64Array {
  const order = Array.from(d.keys()).sort((u, v) => d[u] - d[v]);
  let total = 0;
  for (const s of order) total += w[s];
  const out = new Float64Array(U + 1);
  let below = 0, weightBelow = 0, j = 0;
  for (let u = 0; u <= U; u++) {
    while (j < order.length && d[order[j]] <= u) { below += w[order[j]] * d[order[j]]; weightBelow += w[order[j]]; j++; }
    out[u] = below + u * (total - weightBelow);
  }
  return out;
}

/**
 * Second upper bound, usually much tighter than Frank–Wolfe on non-smooth tails. CVaR is a minimum over
 * scenario weightings, so for the weights ω active at the plan, OPT ≤ max_x Σ_s ω_s · profit_s(x).
 * Per product this splits into 1-D concave curves (total units and the higher-value unit type), which
 * allows an exact search over whole units for each budget multiplier λ. Fees and minimums are relaxed.
 */
function minimaxBound(optionSets: Model[][], x: State, risk: number, k: number, budget: number): number {
  if (!Number.isFinite(budget)) return Infinity;
  const S = x.P.length, order = Array.from({ length: S }, (_, s) => s).sort((u, v) => x.P[u] - x.P[v]);
  const omega = new Float64Array(S).fill((1 - risk) / S);
  for (let j = 0; j < k; j++) omega[order[j]] += risk / k;
  const buildPart = (m: Model) => {
    if (m.cap <= 0) {
      // Nothing can be bought, but held stock is still worth its (price-dependent) value.
      let held = 0;
      for (let s = 0; s < S; s++) held += omega[s] * m.stockTerm[s];
      return { m, Qc: 0, Ac: 0, C: 0, prepaidFirst: true, total: new Float64Array(1), first: new Float64Array(1), step: new Float64Array(0), stockConst: held };
    }
    const Qc = Math.min(m.capPrepaid, m.cap), Ac = Math.min(m.capAllot, m.cap), C = m.cap;
    const prepaidFirst = Ac === 0 || m.salvage <= m.allotBuy * (1 - m.deposit);
    const wTotal = new Float64Array(S), wFirst = new Float64Array(S);
    for (let s = 0; s < S; s++) {
      const p = m.price * m.priceMultiplier[s] + m.serviceValue, vq = Math.max(0, p - m.salvage), va = Ac > 0 ? Math.max(0, p - m.allotBuy * (1 - m.deposit)) : 0;
      const hi = prepaidFirst ? vq : va, lo = Math.min(prepaidFirst ? va : vq, hi);
      wTotal[s] = omega[s] * lo; wFirst[s] = omega[s] * (hi - lo);
    }
    const total = minCurve(wTotal, m.demand, C), first = minCurve(wFirst, m.demand, prepaidFirst ? Qc : Ac);
    const step = new Float64Array(C);
    for (let t = 0; t < C; t++) step[t] = total[t + 1] - total[t];
    let stockConst = 0; // the held-stock term does not depend on units, only on this price option
    for (let s = 0; s < S; s++) stockConst += omega[s] * m.stockTerm[s];
    return { m, Qc, Ac, C, prepaidFirst, total, first, step, stockConst };
  };
  type Part = NonNullable<ReturnType<typeof buildPart>>;
  // Every product chooses its best (price, pre-paid, allotment) for each budget multiplier, so the bound covers joint pricing.
  const products = optionSets.map(options => options.map(buildPart).filter((part): part is Part => part !== null));
  const firstAtOrBelow = (step: Float64Array, kappa: number) => { let lo = 0, hi = step.length; while (lo < hi) { const mid = (lo + hi) >> 1; if (step[mid] <= kappa) hi = mid; else lo = mid + 1; } return lo; };
  const bestFor = (part: Part, lambda: number) => {
    const { m, Qc, Ac, C, prepaidFirst, total, first, step, stockConst } = part;
    const unitDeposit = m.deposit * m.allotBuy, unitCapital = m.allotCapital;
    // (0, 0) is always feasible with only the held-stock value; every other choice pays the fee and respects the minimum order.
    let best = stockConst, bestCost = 0;
    const consider = (q: number, a: number) => {
      if (q + a <= 0 || q + a > C || q > Qc || a > Ac || (q > 0 && q < m.minimum)) return;
      const cost = q * m.buy + a * unitCapital + m.fee;
      const v = stockConst + total[q + a] + first[prepaidFirst ? q : a] + (m.salvage - m.buy) * q - unitDeposit * a - m.fee - lambda * cost;
      if (v > best) { best = v; bestCost = cost; }
    };
    if (prepaidFirst) {
      const tStar = firstAtOrBelow(step, unitDeposit + lambda * unitCapital);
      for (let q = 0; q <= Qc; q++) {
        if (q > 0 && q < m.minimum) continue;
        const a = Math.max(0, Math.min(tStar - q, Ac, C - q));
        consider(q, q === 0 ? Math.max(1, a) : a);
      }
    } else {
      const tStar = firstAtOrBelow(step, (m.buy - m.salvage) + lambda * m.buy);
      for (let a = 0; a <= Ac; a++) {
        const q = Math.max(0, Math.min(tStar - a, Qc, C - a));
        consider(q > 0 && q < m.minimum ? 0 : q, a);
        if (q > 0 && q < m.minimum) consider(m.minimum, a);
        if (a === 0) consider(Math.max(m.minimum, q, 1), 0);
      }
    }
    return { best, bestCost };
  };
  const solve = (lambda: number) => {
    let value = lambda * budget, used = 0;
    for (const parts of products) {
      let best = parts.length ? -Infinity : 0, bestCost = 0;
      for (const part of parts) { const r = bestFor(part, lambda); if (r.best > best) { best = r.best; bestCost = r.bestCost; } }
      value += best; used += bestCost;
    }
    return { value, used };
  };
  let lo = 0, hi = 0;
  for (const parts of products) for (const part of parts) hi = Math.max(hi, ((part.m.price + part.m.serviceValue) * 2) / Math.max(1e-9, Math.min(part.m.buy, part.m.allotCapital || part.m.buy)));
  let bound = solve(0).value;
  for (let it = 0; it < 70 && hi > 0; it++) {
    const lambda = (lo + hi) / 2, d = solve(lambda);
    bound = Math.min(bound, d.value);
    if (d.used > budget) lo = lambda; else hi = lambda;
  }
  return Math.min(bound, solve(hi).value);
}

/**
 * Joint pricing: coordinate moves that switch one product to another candidate price, re-optimise its
 * quantities and top up the budget. Only improvements are accepted; the bound covers all price options.
 */
function pricePass(state: State, models: Model[], optionModels: Model[][], budget: number, risk: number, k: number, rounds: number): { state: State; models: Model[] } {
  let current = state, currentModels = models;
  for (let round = 0; round < rounds; round++) {
    let changed = false;
    for (let i = 0; i < currentModels.length; i++) {
      if (optionModels[i].length < 2 || currentModels[i].expired || (currentModels[i].cap <= 0 && currentModels[i].stock <= 0)) continue;
      // Local price search on the sorted grid: try the two neighbours on each side of the current price.
      const grid = optionModels[i].slice().sort((u, v) => u.price - v.price), at = grid.findIndex(o => o.price === currentModels[i].price);
      const neighbours = at < 0 ? grid : [grid[at - 1], grid[at + 1], grid[at - 2], grid[at + 2]].filter((o): o is Model => o !== undefined);
      for (const option of neighbours) {
        if (option.price === currentModels[i].price) continue;
        const trialModels = currentModels.slice();
        trialModels[i] = option;
        const allocator = new Allocator(trialModels, budget, risk, k), trial = cloneState(current);
        allocator.rebase(trial, i);
        allocator.scan(trial, i);
        allocator.fill(trial, 1);
        if (allocator.seedPair(trial)) allocator.light(trial);
        if (trial.objective > current.objective + 1e-7 * Math.max(1, Math.abs(current.objective))) { current = trial; currentModels = trialModels; changed = true; }
      }
    }
    if (!changed) break;
  }
  return { state: current, models: currentModels };
}

/** In-sample expected share of modelled demand served (existing stock first, then new units). */
function servedShareIn(models: Model[], x: State): number {
  let served = 0, gross = 0;
  models.forEach((m, i) => {
    for (let s = 0; s < m.gross.length; s++) {
      const [xq, xa] = sales(m, x.q[i], x.a[i], s);
      served += Math.min(m.gross[s], m.stock) + xq + xa; gross += m.gross[s] * m.marketScale;
    }
  });
  return gross > 0 ? served / gross : 0;
}

/** `bound`: a certified upper bound already computed by the solver (large portfolios); otherwise the caller computes one. */
type Solved = { state: State; models: Model[]; optionModels: Model[][]; pricesFixed: boolean; bound?: number };

/**
 * One optimisation at service value μ. `thorough` adds the certified escalation used for the final plan.
 * `fixedPrices` holds selling prices (the availability search keeps the no-target prices, so a target
 * is met by buying more cover for the same demand, not by discounting to create extra demand).
 */
function solvePortfolio(items: Opportunity[], set: ScenarioSet, budget: number, risk: number, k: number, asOf: string, mu: number, jointPricing: boolean, thorough: boolean, fixedPrices?: number[], warm?: State, basis: BudgetBasis = 'cash', large = true): Solved {
  if (large) {
    const solved = solveLarge(items, set, budget, risk, k, asOf, mu, jointPricing, thorough, fixedPrices, warm, basis);
    return { ...solved, state: withinBudget(solved.models, solved.state, budget, risk, k) };
  }
  const initial = fixedPrices ?? items.map((item, i) => choosePrice(item, i, set, risk, k, asOf, budget, mu, basis));
  const pricesFixed = !jointPricing || fixedPrices !== undefined;
  const optionModels = items.map((item, i) => (pricesFixed ? [initial[i]] : candidatePrices(item)).map(price => buildModel(item, i, set, price, asOf, mu, basis)));
  let models = items.map((item, i) => optionModels[i].find(m => m.price === initial[i]) ?? buildModel(item, i, set, initial[i], asOf, mu, basis));
  const maxCap = Math.max(1, ...models.map(m => m.cap));
  const startStep = Math.max(1, Math.floor(maxCap / 16));
  // A plan within 0.5% of the proven bound is accepted; the residual is mostly the budget relaxation.
  const tolerance = (x: State) => 5e-3 * Math.max(1, Math.abs(x.objective));
  const certified = (x: State) => minimaxBound(optionModels, x, risk, k, budget) - x.objective <= tolerance(x);
  let allocator = new Allocator(models, budget, risk, k);
  let state = allocator.empty();
  // Warm start (availability search): reuse the previous plan's units; capital does not depend on μ, so it stays feasible.
  if (warm) for (let i = 0; i < models.length; i++) if (warm.q[i] + warm.a[i] > 0) allocator.set(state, i, warm.q[i], warm.a[i]);
  allocator.fill(state, startStep);
  allocator.light(state);
  ({ state, models } = pricePass(state, models, optionModels, budget, risk, k, thorough ? 3 : 1));
  // Escalate the search only while the certified gap is still open.
  if (thorough && !certified(state)) {
    state = new Allocator(models, budget, risk, k).improve(state, maxCap);
    ({ state, models } = pricePass(state, models, optionModels, budget, risk, k, 2));
    if (!certified(state) && models.some(m => m.capAllot > 0 || m.minimum > 1 || m.fee > 0)) {
      // Second start: fill pre-paid first, then allotments. Keeps minimum-order jumps reachable.
      allocator = new Allocator(models, budget, risk, k);
      let alt = allocator.empty(), altModels = models;
      allocator.fill(alt, startStep, false);
      allocator.fill(alt, startStep);
      allocator.light(alt);
      if (!certified(alt)) alt = allocator.improve(alt, maxCap);
      ({ state: alt, models: altModels } = pricePass(alt, altModels, optionModels, budget, risk, k, 2));
      if (alt.objective > state.objective) { state = alt; models = altModels; }
    }
  }
  state = withinBudget(models, state, budget, risk, k);
  return { state, models, optionModels, pricesFixed };
}

/** Never return an over-budget plan, even by floating-point round-off. */
function withinBudget(models: Model[], state: State, budget: number, risk: number, k: number): State {
  const allocator = new Allocator(models, budget, risk, k);
  let guard = 0;
  while (models.reduce((sum, m, i) => sum + capital(m, state.q[i], state.a[i]), 0) > budget && guard++ < 100000) {
    let i = models.length - 1;
    while (i >= 0 && state.q[i] + state.a[i] === 0) i--;
    if (i < 0) break;
    if (state.a[i] > 0) allocator.set(state, i, state.q[i], state.a[i] - 1);
    else allocator.set(state, i, state.q[i] - 1 < models[i].minimum ? 0 : state.q[i] - 1, state.a[i]);
  }
  return state;
}

// ---------------------------------------------------------------------------------------------
// Large portfolios: scenario-weight decomposition
// ---------------------------------------------------------------------------------------------
// The decomposition solver below is the default for every portfolio size. The local search above (solver:
// 'local-search') is O(n²·S) per pass (≈0.9 s at 20 products, 9 s at 40, 23 s at 80), so it suits small portfolios only.

/**
 * CVaR is a minimum over scenario weightings ω (ω_s = (1−r)/S + r·ν_s, 0 ≤ ν_s ≤ 1/k, Σν = 1). For any such ω,
 * Σ_s ω_s·profit_s(plan) ≥ objective(plan), and once the budget is priced with a multiplier λ the problem splits
 * product by product:  λ·B + Σ_i max_{price, pre-paid, allotment} [Σ_s ω_s·profit_i,s − λ·cost_i].
 * Each product's maximum is found exactly on two 1-D concave curves (the relaxation `minimaxBound` uses), so every
 * pass yields a valid upper bound. The weights are averaged over the plans found so far (fictitious play); each
 * plan is a best response to the averaged weights, scored on the true objective, and the best plan is kept and
 * then improved by budget-neutral unit swaps between products.
 */
type LeanProduct = {
  index: number; D: Float64Array; M: Float64Array; order: Int32Array;
  prices: number[]; bases: number[]; refPrice: number; refBase: number; /** Options the plan may use (expired or empty products keep the reference price). */ choosable: number[];
  buy: number; salvage: number; allotBuy: number; deposit: number; unitDeposit: number; allotCapital: number;
  Qc: number; Ac: number; C: number; minimum: number; fee: number; stock: number; service: number; prepaidFirst: boolean;
};
type LeanCurve = { len: number; T: Float64Array; flen: number; F: Float64Array; stockConst: number };
type LeanChoice = { value: number; cost: number; q: number; a: number };

/** Mirrors buildModel (tests/risk-large.test.ts checks the curves against Σ ω·profit of buildModel for every price option). */
function leanProduct(item: Opportunity, index: number, set: ScenarioSet, prices: number[], asOf: string, serviceValue: number, basis: BudgetBasis): LeanProduct {
  const planned = forecastUnconstrained(item), elasticity = elasticityOf(item) * (set.elasticityMultiplier ?? 1);
  const stock = Math.max(0, item.existingStock || 0), salvage = item.buy * clamp(item.recoveryPct ?? 0, 0, 1);
  const service = Math.max(0, Number.isFinite(serviceValue) ? serviceValue : 0);
  const refPrice = Math.max(1, Math.round(item.referencePrice)), refBase = planned * priceResponse(refPrice, item.referencePrice, elasticity);
  const expired = timingFor(item, asOf).expired, cap = expired ? 0 : Math.max(0, Math.floor(item.capacity));
  const hasAllot = (item.allotmentBuy ?? 0) > 0 && (item.allotmentCapacity ?? 0) > 0;
  const allotBuy = hasAllot ? item.allotmentBuy! : 0, deposit = hasAllot ? clamp(item.allotmentDepositPct ?? DEFAULT_ALLOTMENT_DEPOSIT, 0, 1) : 0;
  const capAllot = hasAllot ? Math.min(cap, Math.floor(item.allotmentCapacity!)) : 0;
  const D = set.demand[index], order = Int32Array.from({ length: set.count }, (_, s) => s).sort((u, v) => D[u] - D[v]);
  const fixedAtReference = expired || (cap <= 0 && stock <= 0);
  const reference = prices.indexOf(refPrice);
  return {
    index, D, M: set.price[index], order, prices, bases: prices.map(price => planned * priceResponse(price, item.referencePrice, elasticity)), refPrice, refBase,
    choosable: fixedAtReference && reference >= 0 ? [reference] : prices.map((_, o) => o),
    buy: item.buy, salvage, allotBuy, deposit, unitDeposit: deposit * allotBuy, allotCapital: basis === 'cash' ? allotBuy : deposit * allotBuy,
    Qc: cap, Ac: capAllot, C: cap, minimum: Math.max(1, Math.floor(item.minOrderUnits ?? 1)), fee: Math.max(0, item.fixedOrderFee ?? 0), stock, service,
    prepaidFirst: capAllot === 0 || salvage <= allotBuy * (1 - deposit),
  };
}

const EMPTY_CURVE = new Float64Array(1);
/** Scratch buffers reused across curve builds (per solve). */
type LeanScratch = { wT: Float64Array; wF: Float64Array; d: Float64Array; T: Float64Array; F: Float64Array };
function leanScratch(S: number, maxLen: number): LeanScratch {
  return { wT: new Float64Array(S), wF: new Float64Array(S), d: new Float64Array(S), T: new Float64Array(maxLen + 1), F: new Float64Array(maxLen + 1) };
}

/**
 * Weighted curves of one product at one price: T(u) = Σ_s wT_s·min(u, d_s) over all units and F(v) = Σ_s wF_s·min(v, d_s)
 * over the unit type sold first, so Σ_s ω_s·profit_s(q, a) = stockConst + T(q + a) + F(first) + linear terms (see minimaxBound).
 * Both are flat beyond the largest scenario demand, so they are stored only up to min(capacity, ⌈max demand⌉).
 * Writes into `scratch` unless `keep` is set (then the curve owns new arrays).
 */
function leanCurve(p: LeanProduct, o: number, omega: Float64Array, scratch: LeanScratch, keep: boolean): LeanCurve {
  const S = omega.length, price = p.prices[o], base = p.bases[o];
  let stockConst = 0;
  if (p.stock > 0) {
    for (let s = 0; s < S; s++) {
      const gross = base * p.D[s], soldNow = Math.min(p.stock, gross), soldRef = Math.min(p.stock, p.refBase * p.D[s]), multiplier = p.M[s];
      stockConst += omega[s] * (soldNow * (price * multiplier + p.service) - soldRef * (p.refPrice * multiplier + p.service) + (soldRef - soldNow) * p.salvage);
    }
  }
  if (p.C <= 0) return { len: 0, T: EMPTY_CURVE, flen: 0, F: EMPTY_CURVE, stockConst };
  const { wT, wF, d } = scratch;
  const allotNet = p.allotBuy * (1 - p.deposit);
  let WT = 0, WF = 0;
  for (let j = 0; j < S; j++) {
    const s = p.order[j], ps = price * p.M[s] + p.service;
    const vq = Math.max(0, ps - p.salvage), va = p.Ac > 0 ? Math.max(0, ps - allotNet) : 0;
    const hi = p.prepaidFirst ? vq : va, lo = Math.min(p.prepaidFirst ? va : vq, hi);
    wT[j] = omega[s] * lo; wF[j] = omega[s] * (hi - lo); WT += wT[j]; WF += wF[j];
    d[j] = Math.max(0, base * p.D[s] - p.stock);
  }
  const len = Math.min(p.C, Math.ceil(d[S - 1])), flen = Math.min(p.prepaidFirst ? p.Qc : p.Ac, len);
  const T = keep ? new Float64Array(len + 1) : scratch.T, F = keep ? new Float64Array(flen + 1) : scratch.F;
  let j = 0, belowT = 0, weightT = 0, belowF = 0, weightF = 0;
  for (let u = 0; u <= len; u++) {
    while (j < S && d[j] <= u) { belowT += wT[j] * d[j]; weightT += wT[j]; belowF += wF[j] * d[j]; weightF += wF[j]; j++; }
    T[u] = belowT + u * (WT - weightT);
    if (u <= flen) F[u] = belowF + u * (WF - weightF);
  }
  return { len, T, flen, F, stockConst };
}

/**
 * Exact best (pre-paid, allotment) for one product and price at budget multiplier λ, maximising
 * Σ_s ω_s·profit_s − λ·cost. With pre-paid units sold first (the usual case) the objective is concave in the
 * pre-paid quantity once the allotment is chosen optimally, so a binary search finds the smallest maximiser;
 * minimum orders and the fixed fee are handled by comparing with "no order" and "allotment only".
 */
function leanBest(p: LeanProduct, c: LeanCurve, lambda: number, out: LeanChoice): LeanChoice {
  out.value = c.stockConst; out.cost = 0; out.q = 0; out.a = 0;
  if (p.C <= 0) return out;
  const T = c.T, F = c.F, len = c.len, flen = c.flen, base = c.stockConst - p.fee * (1 + lambda);
  const qSlope = p.salvage - p.buy - lambda * p.buy, aSlope = -p.unitDeposit - lambda * p.allotCapital;
  if (p.prepaidFirst) {
    // t* = first u with T(u+1) − T(u) ≤ τ (marginal cost of an allotment unit); T is flat from len on, so t* ≤ len.
    const tau = p.unitDeposit + lambda * p.allotCapital;
    let lo = 0, hi = len;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (T[mid + 1] - T[mid] <= tau) hi = mid; else lo = mid + 1; }
    const tStar = lo, Ac = p.Ac, C = p.C;
    if (Ac >= 1) {
      const a = Math.max(1, Math.min(tStar, Ac, C));
      const v = base + T[a < len ? a : len] + F[0] + aSlope * a;
      if (v > out.value) { out.value = v; out.cost = a * p.allotCapital + p.fee; out.q = 0; out.a = a; }
    }
    if (p.minimum <= p.Qc) {
      // g(q) = value with the best allotment for q; concave on [minimum, Qc], so binary search for the smallest maximiser.
      let l = p.minimum, h = p.Qc;
      while (l < h) {
        const mid = (l + h) >> 1;
        let a0 = tStar - mid; if (a0 > Ac) a0 = Ac; if (a0 > C - mid) a0 = C - mid; if (a0 < 0) a0 = 0;
        const m1 = mid + 1;
        let a1 = tStar - m1; if (a1 > Ac) a1 = Ac; if (a1 > C - m1) a1 = C - m1; if (a1 < 0) a1 = 0;
        const u0 = mid + a0, u1 = m1 + a1;
        const g0 = T[u0 < len ? u0 : len] + F[mid < flen ? mid : flen] + qSlope * mid + aSlope * a0;
        const g1 = T[u1 < len ? u1 : len] + F[m1 < flen ? m1 : flen] + qSlope * m1 + aSlope * a1;
        if (g1 - g0 <= 0) h = mid; else l = mid + 1;
      }
      let a = tStar - l; if (a > Ac) a = Ac; if (a > C - l) a = C - l; if (a < 0) a = 0;
      const u = l + a, v = base + T[u < len ? u : len] + F[l < flen ? l : flen] + qSlope * l + aSlope * a;
      if (v > out.value) { out.value = v; out.cost = l * p.buy + a * p.allotCapital + p.fee; out.q = l; out.a = a; }
    }
    return out;
  }
  // Allotment sold first (salvage above the allotment's net cost): rare, so an exact scan over allotment units.
  const consider = (q: number, a: number) => {
    if (q + a <= 0 || q + a > p.C || q > p.Qc || a > p.Ac || (q > 0 && q < p.minimum)) return;
    const u = q + a, v = base + T[u < len ? u : len] + F[a < flen ? a : flen] + qSlope * q + aSlope * a;
    if (v > out.value) { out.value = v; out.cost = q * p.buy + a * p.allotCapital + p.fee; out.q = q; out.a = a; }
  };
  const tau = (p.buy - p.salvage) + lambda * p.buy;
  let lo = 0, hi = len;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (T[mid + 1] - T[mid] <= tau) hi = mid; else lo = mid + 1; }
  const tStar = lo;
  for (let a = 0; a <= p.Ac; a++) {
    const q = Math.max(0, Math.min(tStar - a, p.Qc, p.C - a));
    consider(q > 0 && q < p.minimum ? 0 : q, a);
    if (q > 0 && q < p.minimum) consider(p.minimum, a);
    if (a === 0) consider(Math.max(p.minimum, q, 1), 0);
  }
  return out;
}

/** CVaR weighting at a plan: (1−r)/S everywhere plus r/k on its k worst scenarios. */
function tailWeights(P: Float64Array, risk: number, k: number): Float64Array {
  const S = P.length, order = Array.from({ length: S }, (_, s) => s).sort((u, v) => P[u] - P[v]);
  const omega = new Float64Array(S).fill((1 - risk) / S);
  for (let j = 0; j < k; j++) omega[order[j]] += risk / k;
  return omega;
}

type LeanPlan = { q: Int32Array; a: Int32Array; option: Int32Array };

function solveLarge(items: Opportunity[], set: ScenarioSet, budget: number, risk: number, k: number, asOf: string, mu: number, jointPricing: boolean, thorough: boolean, fixedPrices?: number[], warm?: State, basis: BudgetBasis = 'cash'): Solved {
  const n = items.length, S = set.count, B = Number.isFinite(budget) ? budget : Infinity;
  const pricesFixed = !jointPricing || fixedPrices !== undefined;
  // Fixed pricing without given prices: each product's stand-alone price (as in the local search) up to 200 products,
  // the reference price above (the stand-alone search costs O(13·31·S) per product).
  const standAlone = (): number[] => items.map((item, i) => (n <= 200 ? choosePrice(item, i, set, risk, k, asOf, budget, mu, basis) : Math.max(1, Math.round(item.referencePrice))));
  const fixed = pricesFixed ? (fixedPrices ?? standAlone()) : null;
  const products = items.map((item, i) => leanProduct(item, i, set, fixed ? [fixed[i]] : candidatePrices(item), asOf, mu, basis));
  const reference = products.map(p => Math.max(0, p.prices.indexOf(p.refPrice)));
  const scratch = leanScratch(S, Math.max(1, ...products.map(p => p.C)));
  const modelCache = new Map<number, Model>();
  const modelOf = (i: number, o: number): Model => {
    const key = i * 64 + o;
    let m = modelCache.get(key);
    if (!m) { if (modelCache.size > 4 * n) modelCache.clear(); m = buildModel(items[i], i, set, products[i].prices[o], asOf, mu, basis); modelCache.set(key, m); }
    return m;
  };
  const work = new Float64Array(S);
  const scenarioProfit = (plan: LeanPlan) => {
    const P = new Float64Array(S);
    for (let i = 0; i < n; i++) {
      const m = modelOf(i, plan.option[i]), q = plan.q[i], a = plan.a[i];
      for (let s = 0; s < S; s++) P[s] += m.stockTerm[s] + (q > 0 || a > 0 ? profit(m, q, a, s) : 0);
    }
    return P;
  };
  const choice: LeanChoice = { value: 0, cost: 0, q: 0, a: 0 };
  // λ large enough that no unit is worth its budget: above the best possible unit revenue per rupee of budget.
  let lambdaMax = 0;
  for (const p of products) {
    let maxMultiplier = 0;
    for (let s = 0; s < S; s++) if (p.M[s] > maxMultiplier) maxMultiplier = p.M[s];
    for (const price of p.prices) lambdaMax = Math.max(lambdaMax, ((price * maxMultiplier + p.service) * 2) / Math.max(1e-9, Math.min(p.buy, p.allotCapital || p.buy)));
  }
  lambdaMax = Math.max(lambdaMax, 1e-6);

  /**
   * Best response to ω: bisection on λ where every product picks its best (price, pre-paid, allotment) among its
   * active price options at each λ, then budget rounding. Choosing prices together with λ keeps them consistent
   * (a higher price needs fewer units, which lowers λ, which favours lower prices again).
   */
  type Active = { o: number; curve: LeanCurve }[];
  const respond = (active: Active[], lambdaHint: number): { plan: LeanPlan; lambda: number } => {
    const q = new Int32Array(n), a = new Int32Array(n), opt = new Int32Array(n), qLo = new Int32Array(n), aLo = new Int32Array(n), optLo = new Int32Array(n);
    const cost = new Float64Array(n), costLo = new Float64Array(n), value = new Float64Array(n), valueLo = new Float64Array(n);
    const at = (lambda: number, qq: Int32Array, aa: Int32Array, oo: Int32Array, cc: Float64Array, vv: Float64Array) => {
      let used = 0;
      for (let i = 0; i < n; i++) {
        let bestValue = -Infinity;
        for (const { o, curve } of active[i]) {
          leanBest(products[i], curve, lambda, choice);
          if (choice.value > bestValue + 1e-9 * Math.max(1, Math.abs(bestValue)) || bestValue === -Infinity) { bestValue = choice.value; qq[i] = choice.q; aa[i] = choice.a; oo[i] = o; cc[i] = choice.cost; vv[i] = choice.value + lambda * choice.cost; }
        }
        used += cc[i];
      }
      return used;
    };
    if (at(0, q, a, opt, cost, value) <= B) return { plan: { q, a, option: opt }, lambda: 0 };
    qLo.set(q); aLo.set(a); optLo.set(opt); costLo.set(cost); valueLo.set(value);
    const tq = new Int32Array(n), ta = new Int32Array(n), to = new Int32Array(n), tc = new Float64Array(n), tv = new Float64Array(n);
    // Bracket the critical λ: near the previous one when known (it moves little between iterations), otherwise [0, λmax].
    let lo = 0, hi = lambdaMax, steps = 48;
    if (lambdaHint > 0) {
      const down = lambdaHint * 0.8, up = lambdaHint * 1.25;
      if (at(down, tq, ta, to, tc, tv) > B) { lo = down; qLo.set(tq); aLo.set(ta); optLo.set(to); costLo.set(tc); valueLo.set(tv); }
      if (at(up, tq, ta, to, tc, tv) <= B) { hi = up; steps = 26; }
      if (lo === 0) steps = 48;
    }
    // Guard: make sure the upper end really is within budget (e.g. allotments that use no budget under capital-at-risk).
    for (let guard = 0; guard < 60 && at(hi, q, a, opt, cost, value) > B; guard++) { lo = hi; hi *= 2; }
    for (let it = 0; it < steps; it++) {
      const mid = (lo + hi) / 2;
      if (at(mid, tq, ta, to, tc, tv) > B) { lo = mid; qLo.set(tq); aLo.set(ta); optLo.set(to); costLo.set(tc); valueLo.set(tv); }
      else { hi = mid; q.set(tq); a.set(ta); opt.set(to); cost.set(tc); value.set(tv); }
    }
    // Rounding: switch products to their choice just below the critical λ while the budget allows (best ω-value per rupee first).
    let used = cost.reduce((sum, c) => sum + c, 0);
    const switches = Array.from({ length: n }, (_, i) => i).filter(i => costLo[i] > cost[i] && (qLo[i] !== q[i] || aLo[i] !== a[i] || optLo[i] !== opt[i]))
      .sort((u, v) => (valueLo[v] - value[v]) / (costLo[v] - cost[v]) - (valueLo[u] - value[u]) / (costLo[u] - cost[u]));
    for (const i of switches) if (used + costLo[i] - cost[i] <= B) { used += costLo[i] - cost[i]; q[i] = qLo[i]; a[i] = aLo[i]; opt[i] = optLo[i]; cost[i] = costLo[i]; }
    return { plan: { q, a, option: opt }, lambda: hi };
  };

  /**
   * Valid upper bound for weights ω over every allowed price: min over a λ grid of λ·B + Σ_i max_price h_i(λ).
   * Also returns each product's active options: those that are best at some grid λ (at most MAX_ACTIVE, nearest λ0 first).
   */
  const MAX_ACTIVE = 4;
  const boundAndActive = (omega: Float64Array, lambda0: number, full: boolean): { bound: number; active: number[][] } => {
    // Active options: best at λ near λ0 (first entries win the MAX_ACTIVE slots). Full pass: a finer grid for the bound.
    const grid = lambda0 > 0
      ? (full ? [lambda0, ...Array.from({ length: 24 }, (_, g) => lambda0 * Math.exp((g < 12 ? g - 12 : g - 11) * 0.02)), lambda0 * 0.5, lambda0 * 2, 0, lambdaMax]
        : [lambda0, lambda0 * 0.9, lambda0 * 1.1, lambda0 * 0.75, lambda0 * 1.33, lambda0 * 0.5, lambda0 * 2])
      : [0, ...Array.from({ length: full ? 30 : 16 }, (_, g) => lambdaMax * Math.pow(2, -g * (full ? 1 : 2)))];
    const totals = new Float64Array(grid.length), best = new Float64Array(grid.length), bestOption = new Int32Array(grid.length);
    const active: number[][] = [];
    for (let i = 0; i < n; i++) {
      const p = products[i];
      best.fill(-Infinity); bestOption.fill(-1);
      const bestAllowed = new Float64Array(grid.length).fill(-Infinity);
      // Only prices the plan may use (expired or empty products keep the reference price, as in the local search).
      for (const o of p.choosable) {
        const c = leanCurve(p, o, omega, scratch, false);
        for (let g = 0; g < grid.length; g++) {
          const v = leanBest(p, c, grid[g], choice).value;
          if (v > best[g]) best[g] = v;
          // Reference price first, so it wins ties.
          if (bestOption[g] < 0 || v > bestAllowed[g] + 1e-9 * Math.max(1, Math.abs(bestAllowed[g]))) { bestAllowed[g] = v; bestOption[g] = o; }
        }
      }
      const options: number[] = [];
      for (let g = 0; g < grid.length && options.length < MAX_ACTIVE; g++) if (bestOption[g] >= 0 && !options.includes(bestOption[g])) options.push(bestOption[g]);
      active.push(options.length ? options : [p.choosable[0]]);
      for (let g = 0; g < grid.length; g++) totals[g] += best[g];
    }
    let bound = Infinity;
    for (let g = 0; g < grid.length; g++) bound = Math.min(bound, (Number.isFinite(B) ? grid[g] * B : (grid[g] > 0 ? Infinity : 0)) + totals[g]);
    return { bound, active };
  };

  // Start: risk-neutral weights (a valid CVaR weighting).
  const omegaBar = new Float64Array(S).fill(1 / S);
  const best = { plan: null as LeanPlan | null, objective: -Infinity, P: null as Float64Array | null };
  let bound = Infinity, lambda = 0;
  const consider = (plan: LeanPlan) => {
    const P = scenarioProfit(plan), value = objectiveOf(P, risk, k, work);
    if (value > best.objective) { best.objective = value; best.plan = plan; best.P = P; }
    return P;
  };
  if (warm && warm.q.length === n) consider({ q: Int32Array.from(warm.q), a: Int32Array.from(warm.a), option: Int32Array.from(reference) });
  if (!pricesFixed && thorough && n <= 30) {
    // Small portfolios: seed with the fixed-price plan (stand-alone prices), so joint pricing never does worse than
    // fixed pricing. Larger portfolios skip it: joint pricing wins there by a wide margin and the extra solve costs time.
    const seed = solveLarge(items, set, budget, risk, k, asOf, mu, false, true, undefined, warm, basis);
    const option = Int32Array.from(seed.models, (m, i) => Math.max(0, products[i].prices.indexOf(m.price)));
    if (seed.models.every((m, i) => products[i].prices[option[i]] === m.price)) consider({ q: Int32Array.from(seed.state.q), a: Int32Array.from(seed.state.a), option });
  }
  // Checkpoints: the bound at the best plan's own CVaR weighting is the tight one; stop once the certified gap is small.
  const iterations = thorough ? 16 : 6, checkpoints = new Set(thorough ? [4, 8, 12] : [3]);
  const certify = () => { if (best.P) bound = Math.min(bound, boundAndActive(tailWeights(best.P, risk, k), lambda, true).bound); return bound - best.objective <= 5e-4 * Math.max(1, Math.abs(best.objective)); };
  for (let t = 0; t < iterations; t++) {
    const pass = boundAndActive(omegaBar, lambda, n <= 200);
    bound = Math.min(bound, pass.bound);
    const active: Active[] = pass.active.map((options, i) => options.map(o => ({ o, curve: leanCurve(products[i], o, omegaBar, scratch, true) })));
    const response = respond(active, lambda);
    lambda = response.lambda;
    const P = consider(response.plan);
    if (checkpoints.has(t + 1) && certify()) break;
    // Fictitious play: average the CVaR weighting of the new plan into the weights.
    const omega = tailWeights(P, risk, k), step = 1 / (t + 2);
    for (let s = 0; s < S; s++) omegaBar[s] += step * (omega[s] - omegaBar[s]);
  }
  certify();

  // Materialise the best plan and improve it with budget-neutral swaps on the true objective.
  const plan = best.plan ?? { q: new Int32Array(n), a: new Int32Array(n), option: Int32Array.from(reference) };
  const models = items.map((_, i) => modelOf(i, plan.option[i]));
  const allocator = new Allocator(models, B, risk, k);
  let state = allocator.empty();
  for (let i = 0; i < n; i++) if (plan.q[i] > 0 || plan.a[i] > 0) allocator.set(state, i, plan.q[i], plan.a[i]);
  state = swapPolish(allocator, models, state, B, !thorough ? 1 : n > 200 ? 1 : 4);
  if (!pricesFixed && thorough && n <= 100) {
    // Up to 100 products: also try neighbouring prices with an exact re-optimisation of that product's units (larger
    // portfolios gain about 0.01% from it, for about a second).
    if (pricePolish(allocator, models, products, plan.option, modelOf, state)) state = swapPolish(allocator, models, state, B, 2);
  }
  // Empty-plan escape (as in the local search): no single product pays on its own, but a pair can through diversification.
  if (n <= 60 && state.q.every(v => v === 0) && state.a.every(v => v === 0)) allocator.light(state);
  // Few products: whole-unit effects matter more. While the plan is not yet certified within 0.05% of the bound,
  // finish with the local search's full improvement pass (as the local search itself escalates).
  const open = () => bound - state.objective > 5e-4 * Math.max(1, Math.abs(state.objective));
  if (thorough && n <= 16 && open()) {
    const maxCap = Math.max(1, ...models.map(m => m.cap));
    state = allocator.improve(state, maxCap);
    if (!pricesFixed && open()) {
      // The local search's price pass: re-price one product, re-optimise its units and re-spend the budget it frees.
      const optionModels = products.map((p, i) => p.choosable.map(o => modelOf(i, o)));
      const priced = pricePass(state, models.slice(), optionModels, B, risk, k, 3);
      if (priced.state.objective > state.objective + 1e-9 * Math.max(1, Math.abs(state.objective))) {
        for (let i = 0; i < n; i++) models[i] = priced.models[i];
        state = new Allocator(models, B, risk, k).improve(priced.state, maxCap);
      }
    }
  }
  return { state, models, optionModels: models.map(m => [m]), pricesFixed, bound: Math.max(state.objective, bound + Math.max(1e-7, Math.abs(bound) * 1e-9)) };
}

/**
 * Price polish: for each product (largest spend first) try the neighbouring prices on its grid; each trial re-prices
 * the product, re-optimises its own units within the budget left (Allocator.scan) and is kept only if the true
 * objective improves. Mutates `models` and `option` in place; returns whether anything changed.
 */
function pricePolish(allocator: Allocator, models: Model[], products: LeanProduct[], option: Int32Array, modelOf: (i: number, o: number) => Model, state: State): boolean {
  let order = models.map((m, i) => i).sort((u, v) => capital(models[v], state.q[v], state.a[v]) - capital(models[u], state.q[u], state.a[u]));
  let changed = false;
  // Up to three rounds; later rounds revisit only the products whose price moved, so a price can walk along its grid.
  for (let round = 0; round < 3 && order.length; round++) {
    const moved: number[] = [];
    for (const i of order) {
      const p = products[i];
      if (p.choosable.length < 2) continue;
      const grid = p.choosable.slice().sort((u, v) => p.prices[u] - p.prices[v]), at = grid.indexOf(option[i]);
      for (const o of [grid[at - 1], grid[at + 1], grid[at - 2], grid[at + 2]]) {
        if (o === undefined || o === option[i]) continue;
        const before = state.objective, oldModel = models[i], oldQ = state.q[i], oldA = state.a[i];
        models[i] = modelOf(i, o);
        allocator.rebase(state, i);
        allocator.scan(state, i);
        if (state.objective > before + 1e-7 * Math.max(1, Math.abs(before))) { option[i] = o; changed = true; if (moved.at(-1) !== i) moved.push(i); continue; }
        models[i] = oldModel;
        allocator.set(state, i, oldQ, oldA);
      }
    }
    order = moved;
  }
  return changed;
}

/**
 * Local improvement for large plans: rank one-unit additions by objective gain per rupee and one-unit removals by
 * loss per rupee (both exact), then try transfers between the best candidates; only improving moves are kept.
 */
function swapPolish(allocator: Allocator, models: Model[], state: State, budget: number, rounds: number): State {
  const n = models.length;
  const up = (x: State, i: number): [number, number] | null => {
    const m = models[i], q = x.q[i], a = x.a[i];
    if (m.cap <= 0 || q + a >= m.cap) return null;
    const options: [number, number][] = [];
    if (q < m.capPrepaid) options.push([q === 0 ? m.minimum : q + 1, a]);
    if (a < m.capAllot) options.push([q, a + 1]);
    let best: [number, number] | null = null, bestRatio = 0;
    for (const [nq, na] of options) {
      if (nq + na > m.cap) continue;
      const cost = capital(m, nq, na) - capital(m, q, a);
      if (!(cost > 0)) continue;
      const ratio = (allocator.score(x, i, nq, na) - x.objective) / cost;
      if (best === null || ratio > bestRatio) { best = [nq, na]; bestRatio = ratio; }
    }
    return best;
  };
  const down = (x: State, i: number): [number, number] | null => {
    const m = models[i], q = x.q[i], a = x.a[i];
    const options: [number, number][] = [];
    if (a > 0) options.push([q, a - 1]);
    if (q > 0) options.push([q - 1 < m.minimum ? 0 : q - 1, a]);
    let best: [number, number] | null = null, bestRatio = Infinity;
    for (const [nq, na] of options) {
      const freed = capital(m, q, a) - capital(m, nq, na);
      if (!(freed > 0)) continue;
      const ratio = (x.objective - allocator.score(x, i, nq, na)) / freed;
      if (best === null || ratio < bestRatio) { best = [nq, na]; bestRatio = ratio; }
    }
    return best;
  };
  for (let round = 0; round < rounds; round++) {
    const gains: { i: number; move: [number, number]; ratio: number }[] = [], losses: { i: number; move: [number, number]; ratio: number }[] = [];
    for (let i = 0; i < n; i++) {
      const u = up(state, i);
      if (u) { const m = models[i]; gains.push({ i, move: u, ratio: (allocator.score(state, i, u[0], u[1]) - state.objective) / (capital(m, u[0], u[1]) - capital(m, state.q[i], state.a[i])) }); }
      const d = down(state, i);
      if (d) { const m = models[i]; losses.push({ i, move: d, ratio: (state.objective - allocator.score(state, i, d[0], d[1])) / (capital(m, state.q[i], state.a[i]) - capital(m, d[0], d[1])) }); }
    }
    gains.sort((u, v) => v.ratio - u.ratio); losses.sort((u, v) => u.ratio - v.ratio);
    let accepted = 0;
    const K = Math.min(24, gains.length), L = Math.min(24, losses.length);
    for (let gi = 0; gi < K; gi++) {
      for (let li = 0; li < L; li++) {
        const g = gains[gi], l = losses[li];
        if (g.i === l.i) continue;
        const add = up(state, g.i), remove = down(state, l.i);
        if (!add || !remove) continue;
        const before = state.objective, gq = state.q[g.i], ga = state.a[g.i], lq = state.q[l.i], la = state.a[l.i];
        allocator.set(state, l.i, remove[0], remove[1]);
        // Compound move: keep adding units of the gaining product while the freed budget allows (e.g. one expensive unit for two cheaper ones).
        let addedOk = false;
        for (let extra = 0; extra < 64; extra++) {
          const next = up(state, g.i);
          if (!next || state.spent + capital(models[g.i], next[0], next[1]) - capital(models[g.i], state.q[g.i], state.a[g.i]) > budget) break;
          const previous = state.objective, pq = state.q[g.i], pa = state.a[g.i];
          allocator.set(state, g.i, next[0], next[1]); addedOk = true;
          if (extra > 0 && state.objective <= previous) { allocator.set(state, g.i, pq, pa); break; }
        }
        if (addedOk && state.objective > before + 1e-7 * Math.max(1, Math.abs(before))) { accepted++; break; }
        if (addedOk) allocator.set(state, g.i, gq, ga);
        allocator.set(state, l.i, lq, la);
      }
    }
    // Top up any budget left over with the best single additions.
    for (const g of gains) {
      const add = up(state, g.i);
      if (!add) continue;
      const extra = capital(models[g.i], add[0], add[1]) - capital(models[g.i], state.q[g.i], state.a[g.i]);
      if (state.spent + extra > budget) continue;
      const before = state.objective, gq = state.q[g.i], ga = state.a[g.i];
      allocator.set(state, g.i, add[0], add[1]);
      if (state.objective > before + 1e-7 * Math.max(1, Math.abs(before))) accepted++; else allocator.set(state, g.i, gq, ga);
    }
    if (!accepted) break;
  }
  return state;
}


type Evaluated = { rows: PlanRow[]; metrics: RiskMetrics; servedShareBefore: number; histogram: RiskSummary['histogram']; P: Float64Array };

function quantile(sorted: Float64Array, p: number): number {
  if (!sorted.length) return 0;
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(p * (sorted.length - 1))))];
}

function strategyFor(row: { expired: boolean; prepaid: number; allotment: number; sellThrough: number; pLoss: number; tail: number; unmet: number; lost: number }) {
  const fmt = (n: number) => Math.round(n).toLocaleString('en-IN');
  if (row.expired) return { strategy: 'Refresh supplier quote', strategyReason: 'Expired quotes cannot be allocated.' };
  if (row.prepaid + row.allotment === 0)
    return { strategy: 'Integrate / monitor', strategyReason: row.unmet > 0.5 ? `About ${fmt(row.unmet)} units of modelled demand stay unserved, but committing does not pay at this budget and risk setting. Prioritise extra supplier/API connectivity and monitor quotes.` : 'Existing stock covers modelled demand; monitor quotes.' };
  const tail = row.tail >= 0 ? 'still adds profit' : 'loses money';
  const base = `Expected sell-through ${Math.round(row.sellThrough * 100)}%; the product loses money in ${Math.round(row.pLoss * 100)}% of modelled seasons and ${tail} in the portfolio's worst 10% of seasons.`;
  const lost = row.lost >= 1 ? ` Includes about ${fmt(row.lost)} bookings recovered from sold-out days.` : '';
  if (row.prepaid > 0 && row.allotment > 0) return { strategy: 'Pre-buy + allotment', strategyReason: `${base} The allotment layer adds upside with only the deposit at risk.${lost}` };
  if (row.allotment > 0) return { strategy: 'Allotment only', strategyReason: `${base} Flexible allotment beats a pre-paid block here because unsold units only forfeit the deposit.${lost}` };
  return { strategy: 'Consider pre-buy', strategyReason: `${base}${lost}` };
}

/** Plain-English reason for the chosen selling price (shown next to every row). */
function priceReasonFor(item: Opportunity, price: number, stock: number, units: number, cap: number, elasticity: number): string {
  const reference = Math.max(1, Math.round(item.referencePrice)), change = price / reference - 1, e = elasticity.toFixed(1);
  const label = `${change > 0 ? '+' : '−'}${Math.abs(Math.round(change * 1000) / 10)}% vs market`;
  if (Math.abs(change) < 0.0005) return `Market price. At price elasticity ${e}, a mark-up would lose bookings faster than it adds margin, and a discount would not pay for itself.`;
  if (change < 0 && stock > 0) return `${label}: sells more of the ${Math.round(stock)} units already held (their revenue is counted) instead of leaving them to salvage.`;
  if (change < 0) return `${label}: demand here is price-sensitive (elasticity ${e}), so the extra bookings earn more than the lower margin costs.`;
  if (cap > 0 && units >= cap) return `${label}: supply is capped at ${cap} units, so a higher price rations scarce inventory to the most valuable bookings.`;
  return `${label}: demand here is not very price-sensitive (elasticity ${e}), so the higher margin outweighs the bookings lost and lowers the pre-buy risk.`;
}

function evaluate(items: Opportunity[], decisions: Decision[], risk: number, set: ScenarioSet, asOf: string, alpha: number, withRows: boolean, basis: BudgetBasis = 'cash'): Evaluated {
  const S = set.count, k = Math.max(1, Math.ceil(alpha * S));
  // Two passes, one product at a time (models are rebuilt for the rows), so memory stays O(S) per product
  // instead of O(n·S) — needed for portfolios of thousands of products. Same arithmetic order as a single pass.
  const modelAt = (i: number) => buildModel(items[i], i, set, decisions[i].price, asOf, 0, basis);
  const unitsOf = (m: Model, i: number): [number, number] => { const q = Math.min(decisions[i].prepaid, m.cap); return [q, Math.min(decisions[i].allotment, Math.max(0, m.cap - q))]; };
  const P = new Float64Array(S), capitalUsed = new Float64Array(items.length);
  const soldMean = new Float64Array(items.length), unsoldCost = new Float64Array(items.length);
  let grossTotal = 0, stockServed = 0;
  for (let i = 0; i < items.length; i++) {
    const m = modelAt(i), [q, a] = unitsOf(m, i);
    capitalUsed[i] = capital(m, q, a);
    for (let s = 0; s < S; s++) {
      const v = profit(m, q, a, s) + m.stockTerm[s], [xq, xa] = sales(m, q, a, s);
      P[s] += v;
      soldMean[i] += (xq + xa) / S;
      unsoldCost[i] += ((q - xq) * (m.buy - m.salvage) + (a - xa) * m.deposit * m.allotBuy) / S;
      grossTotal += m.gross[s] * m.marketScale / S; stockServed += Math.min(m.gross[s], m.stock) / S;
    }
  }
  const order = Array.from({ length: S }, (_, s) => s).sort((u, v) => P[u] - P[v]);
  const tailSet = order.slice(0, k);
  const sortedP = Float64Array.from(order.map(s => P[s]));
  let mean = 0, losses = 0;
  for (let s = 0; s < S; s++) { mean += P[s] / S; if (P[s] < -1e-6) losses++; }
  const cvar = tailSet.reduce((sum, s) => sum + P[s], 0) / k;
  const spend = capitalUsed.reduce((sum, c) => sum + c, 0);
  const soldTotal = soldMean.reduce((a, b) => a + b, 0);
  const metrics: RiskMetrics = {
    spend, expectedProfit: mean, cvar, valueAtRisk: sortedP[k - 1], pLoss: losses / S, p05: quantile(sortedP, 0.05), p95: quantile(sortedP, 0.95),
    servedShare: grossTotal > 0 ? (stockServed + soldTotal) / grossTotal : 0, expectedUnsold: decisions.reduce((sum, d, i) => sum + Math.max(0, d.prepaid + d.allotment - soldMean[i]), 0),
  };
  const lo = sortedP[0], hi = sortedP[S - 1], bins = 28, width = (hi - lo) / bins || 1;
  const histogram = Array.from({ length: bins }, (_, b) => ({ from: lo + b * width, to: lo + (b + 1) * width, count: 0, tail: lo + (b + 1) * width <= metrics.valueAtRisk + 1e-9 }));
  for (let s = 0; s < S; s++) histogram[Math.min(bins - 1, Math.floor((P[s] - lo) / width))].count++;
  const rows: PlanRow[] = [];
  if (withRows) {
    const work = new Float64Array(S);
    items.forEach((item, i) => {
      const m = modelAt(i), [q, a] = unitsOf(m, i), units = q + a;
      const v = new Float64Array(S), unmetVector = new Float64Array(S);
      for (let s = 0; s < S; s++) { v[s] = profit(m, q, a, s) + m.stockTerm[s]; const [xq, xa] = sales(m, q, a, s); unmetVector[s] = Math.max(0, m.demand[s] - xq - xa); }
      const sorted = v.slice().sort();
      let expected = 0, itemLosses = 0, need = 0, unmet = 0, gross = 0, stock = 0;
      for (let s = 0; s < S; s++) { expected += v[s] / S; if (v[s] < -1e-6) itemLosses++; need += m.demand[s] / S; unmet += unmetVector[s] / S; gross += m.gross[s] * m.marketScale / S; stock += Math.min(m.gross[s], m.stock) / S; }
      const tail = tailSet.reduce((sum, s) => sum + v[s], 0) / k;
      const unmetSorted = unmetVector.slice().sort();
      const timing = timingFor(item, asOf), lost = lostBookings(item);
      const advice = strategyFor({ expired: m.expired, prepaid: q, allotment: a, sellThrough: units > 0 ? soldMean[i] / units : 0, pLoss: units > 0 ? itemLosses / S : 0, tail, unmet, lost });
      rows.push({
        ...item, engine: RISK_ENGINE_VERSION, forecast: forecastUnconstrained(item), demandSource: demandSourceOf(item), priceElasticity: elasticityOf(item), budgetBasis: basis, priceReason: priceReasonFor(item, decisions[i].price, m.stock, units, m.cap, elasticityOf(item)), price: decisions[i].price, qty: units, prepaidQty: q, allotQty: a,
        spend: capital(m, q, a), prepaidSpend: q > 0 ? q * m.buy + m.fee : 0, allotSpend: a * m.allotCapital + (q === 0 && a > 0 ? m.fee : 0),
        expectedProfit: expected, downsideProfit: units > 0 ? smallestMean(v, k, work) : 0, baseProfit: quantile(sorted, 0.5), upsideProfit: quantile(sorted, 0.9),
        expectedSold: soldMean[i], expectedUnsold: Math.max(0, units - soldMean[i]), unsoldExposure: unsoldCost[i],
        objective: (1 - risk) * expected + risk * tail, purchaseTiming: timing.purchaseTiming, timingReason: timing.timingReason, ...advice,
        pLoss: units > 0 ? itemLosses / S : 0, tailProfit: tail, lostDemand: lost, servedShare: gross > 0 ? (stock + soldMean[i]) / gross : 0,
        coverage: { need, served: soldMean[i], unmet, highUnmet: quantile(unmetSorted, 0.9) }, buyWindow: buyWindowFor({ ...item, volatility: volatilityOf(item) }, asOf, decisions[i].price),
      });
    });
  }
  return { rows, metrics, servedShareBefore: grossTotal > 0 ? stockServed / grossTotal : 0, histogram, P };
}

/**
 * Options of the risk engine. `scenarioOverrides` changes the simulated world (planning and evaluation
 * scenarios alike); the model-risk check uses it to score fixed decisions in worlds the plan did not assume.
 */
export type RiskPlanOptions = PlanOptions & { legacyRows?: PlanRow[]; scenarioOverrides?: Partial<ScenarioAssumptions>; /** Default 'auto' = the decomposition solver; 'local-search' selects the earlier local search (small portfolios only). */ solver?: 'auto' | 'local-search' | 'decomposition' };

function settings(options: RiskPlanOptions) {
  const asOf = options.asOf || new Date().toISOString().slice(0, 10);
  const scenarioCount = options.scenarioCount ?? RISK_ENGINE_DEFAULTS.scenarioCount;
  const evaluationCount = options.evaluationCount ?? RISK_ENGINE_DEFAULTS.evaluationCount;
  const seed = options.seed ?? RISK_ENGINE_DEFAULTS.seed;
  const basis: BudgetBasis = options.budgetBasis === 'capital-at-risk' ? 'capital-at-risk' : 'cash';
  return { asOf, scenarioCount, evaluationCount, seed, alpha: RISK_ENGINE_DEFAULTS.alpha, overrides: options.scenarioOverrides ?? {}, basis };
}

/** Scores fixed decisions (e.g. a committed plan under stress, or in a mismatched world) on the out-of-sample scenario set. */
export function evaluateDecisions(items: Opportunity[], decisions: Decision[], risk: number, options: RiskPlanOptions = {}) {
  if (items.length !== decisions.length) throw new Error('Each item needs one decision.');
  const o = settings(options);
  if (!items.length) return { rows: [] as PlanRow[], metrics: emptyMetrics() };
  const set = buildScenarioSet(items, o.evaluationCount, o.seed + 7919, o.overrides);
  const result = evaluate(items, decisions, clamp(risk, 0, 1), set, o.asOf, o.alpha, true, o.basis);
  return { rows: result.rows, metrics: result.metrics };
}

function emptyMetrics(): RiskMetrics {
  return { spend: 0, expectedProfit: 0, cvar: 0, valueAtRisk: 0, pLoss: 0, p05: 0, p95: 0, servedShare: 0, expectedUnsold: 0 };
}

export function optimizePortfolioRisk(items: Opportunity[], budget: number, risk: number, options: RiskPlanOptions = {}): RiskOptimizedPlan {
  const o = settings(options);
  const r = clamp(risk, 0, 1), B = Math.max(0, Number.isFinite(budget) ? budget : 0);
  const target = clamp(options.serviceTarget ?? 0, 0, 0.99), jointPricing = options.jointPricing !== false;
  const pricing: RiskOptimizedPlan['pricing'] = jointPricing ? 'joint' : 'fixed';
  const summaryBase = { engine: RISK_ENGINE_VERSION, alpha: o.alpha, scenarioCount: o.scenarioCount, evaluationCount: o.evaluationCount, seed: o.seed, budgetBasis: o.basis };
  let service: ServiceSummary = { target, status: target > 0 ? 'not-binding' : 'off', servedShare: 0, servedShareWithoutTarget: 0, serviceValue: 0, expectedProfitCost: 0, cvarCost: 0 };
  if (!items.length) {
    return { rows: [], objective: 0, upperBound: 0, gap: 0, baselineObjective: 0, algorithm: 'risk-cvar-local-search', bucketCount: 0, engine: RISK_ENGINE_VERSION, pricing, service,
      risk: { ...summaryBase, ...emptyMetrics(), servedShareBefore: 0, units: 0, prepaidUnits: 0, allotmentUnits: 0, histogram: [] } };
  }
  const optSet = buildScenarioSet(items, o.scenarioCount, o.seed, o.overrides);
  const evalSet = buildScenarioSet(items, o.evaluationCount, o.seed + 7919, o.overrides);
  const k = Math.max(1, Math.ceil(o.alpha * o.scenarioCount));
  // Default: the decomposition (better plans and tighter certificates than the local search in every head-to-head test,
  // and it scales); the local search stays available with solver: 'local-search'.
  const large = options.solver !== 'local-search';
  const algorithm: RiskOptimizedPlan['algorithm'] = large ? 'risk-cvar-decomposition' : 'risk-cvar-local-search';
  const base = solvePortfolio(items, optSet, B, r, k, o.asOf, 0, jointPricing, true, undefined, undefined, o.basis, large);
  let chosen = base, maxAvailability: Decision[] | null = null;
  if (target > 0 && servedShareIn(base.models, base.state) < target) {
    // Smallest service value μ whose optimal plan serves the target share at the same prices: double, then bisect.
    const prices = base.models.map(m => m.price);
    // Doubling builds each plan from scratch (μ jumps a lot, so budget must move between products);
    // bisection and the final certified solve warm-start from the feasible end of the bracket.
    const solve = (mu: number, thorough: boolean, warm?: State) => solvePortfolio(items, optSet, B, r, k, o.asOf, mu, false, thorough, prices, warm, o.basis, large);
    const meanPrice = Math.max(1, prices.reduce((sum, price) => sum + price, 0) / prices.length);
    let lo = 0, hi = 0.02 * meanPrice, reached = false, last: Solved = base, previousShare = servedShareIn(base.models, base.state);
    for (let t = 0; t < 9 && !reached; t++) {
      last = solve(hi, false);
      const share = servedShareIn(last.models, last.state);
      if (share >= target) reached = true;
      else {
        lo = hi; hi *= 2;
        // Saturated: a higher service value no longer buys availability (budget or supplier capacity binds).
        if (t >= 3 && share - previousShare < 1e-3) break;
        previousShare = share;
      }
    }
    if (!reached) {
      // Keep the no-target plan and report roughly the most this budget and supplier capacity can serve.
      maxAvailability = items.map((_, i) => ({ prepaid: last.state.q[i], allotment: last.state.a[i], price: prices[i] }));
      service = { ...service, status: 'unreachable' };
    } else {
      let feasible = last.state;
      for (let t = 0; t < 5; t++) {
        const mid = (lo + hi) / 2, trial = solve(mid, false, feasible);
        if (servedShareIn(trial.models, trial.state) >= target) { hi = mid; feasible = trial.state; } else lo = mid;
      }
      let final = solve(hi, true, feasible);
      for (let t = 0; t < 3 && servedShareIn(final.models, final.state) < target; t++) { hi *= 1.25; final = solve(hi, true, final.state); }
      if (servedShareIn(final.models, final.state) >= target) { chosen = final; service = { ...service, status: 'met', serviceValue: hi }; }
      else { maxAvailability = items.map((_, i) => ({ prepaid: final.state.q[i], allotment: final.state.a[i], price: prices[i] })); service = { ...service, status: 'unreachable' }; }
    }
  }
  const { state, models, optionModels } = chosen;
  // Frank–Wolfe is only valid for fixed prices; the minimax bound covers every candidate price.
  const fixedPriceBound = chosen.pricesFixed && chosen.bound === undefined ? upperBound(models, state, r, k, B) : Infinity;
  const bound = chosen.bound !== undefined ? Math.max(state.objective, chosen.bound)
    : Math.max(state.objective, Math.min(fixedPriceBound, minimaxBound(optionModels, state, r, k, B) + Math.max(1e-7, Math.abs(state.objective) * 1e-12)));
  const decisions: Decision[] = items.map((_, i) => ({ prepaid: state.q[i], allotment: state.a[i], price: models[i].price }));
  const result = evaluate(items, decisions, r, evalSet, o.asOf, o.alpha, true, o.basis);
  if (chosen !== base) {
    const baseDecisions = items.map((_, i) => ({ prepaid: base.state.q[i], allotment: base.state.a[i], price: base.models[i].price }));
    const baseMetrics = evaluate(items, baseDecisions, r, evalSet, o.asOf, o.alpha, false, o.basis).metrics;
    service = { ...service, servedShare: result.metrics.servedShare, servedShareWithoutTarget: baseMetrics.servedShare, expectedProfitCost: baseMetrics.expectedProfit - result.metrics.expectedProfit, cvarCost: baseMetrics.cvar - result.metrics.cvar };
  } else service = { ...service, servedShare: result.metrics.servedShare, servedShareWithoutTarget: result.metrics.servedShare };
  if (maxAvailability) service = { ...service, maxServedShare: evaluate(items, maxAvailability, r, evalSet, o.asOf, o.alpha, false, o.basis).metrics.servedShare };

  let baselineObjective = 0, legacy: RiskMetrics | undefined;
  if (options.legacyRows && options.legacyRows.length === items.length) {
    const legacyDecisions = options.legacyRows.map(row => ({ prepaid: row.qty, allotment: 0, price: row.price }));
    const legacyModels = items.map((item, i) => buildModel(item, i, optSet, legacyDecisions[i].price, o.asOf));
    const legacyAllocator = new Allocator(legacyModels, Infinity, r, k);
    const legacyState = legacyAllocator.empty();
    legacyDecisions.forEach((d, i) => { if (d.prepaid > 0) legacyAllocator.set(legacyState, i, Math.min(d.prepaid, legacyModels[i].cap), 0); });
    baselineObjective = legacyState.objective;
    legacy = evaluate(items, legacyDecisions, r, evalSet, o.asOf, o.alpha, false, o.basis).metrics;
  }
  const prepaidUnits = decisions.reduce((sum, d) => sum + d.prepaid, 0), allotmentUnits = decisions.reduce((sum, d) => sum + d.allotment, 0);
  const rows = target > 0 ? result.rows.map(row => ({ ...row, serviceTarget: target })) : result.rows;
  return {
    rows, objective: state.objective, upperBound: bound, gap: Math.max(0, bound - state.objective), baselineObjective,
    algorithm, bucketCount: 0, engine: RISK_ENGINE_VERSION, pricing, service,
    risk: { ...summaryBase, ...result.metrics, servedShareBefore: result.servedShareBefore, units: prepaidUnits + allotmentUnits, prepaidUnits, allotmentUnits, histogram: result.histogram, legacy },
  };
}

/** Exposed for tests (exhaustive-enumeration and bound-validity checks) only. */
export const riskModelInternals = { buildModel, profit, capital, objectiveOf, sales, leanProduct, leanCurve, leanBest, leanScratch, tailWeights, candidatePrices };
