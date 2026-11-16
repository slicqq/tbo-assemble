import type { Opportunity } from './procurement-core';
import { stayDate } from './buy-window';

/**
 * Learned demand (risk-cvar-v5).
 *
 * When a product carries a monthly history (`Opportunity.history`), the planner no longer relies on the typed
 * seasonality and signal multipliers. It fits a log-linear demand model on the history by least squares:
 *
 *     log U_t = a + g·(t/12) + s_month(t) + β·log(signal_t / mean) + e·log(price_t / mean) + ε_t
 *
 * fitted on at most the latest 48 months, where U is unconstrained demand (bookings plus measured sold-out bookings):
 *  - seasonality: the month effects s give multiplicative month-of-year indices (geometric mean 1);
 *  - growth: the last 12 months over the 12 before (net of signal and price effects; season cancels), clamped to
 *    0.8–1.3; the in-window trend g only absorbs drift while the month effects are estimated;
 *  - external signal: β (shrunk by m/(m+12) for short histories, clamped 0–2), applied to the product's `signal`
 *    (read as the target month's signal relative to its normal level);
 *  - price sensitivity: e combined with a prior (normal, sd 1: the Lerner-implied elasticity unless one is supplied),
 *    so a short or flat price history barely moves it; the planner prices with this elasticity;
 *  - forecast risk: the spread of rolling-origin forecast errors becomes the product's volatility.
 *
 * The forecast is anchored on the level of the last three months (season, signal and price removed), projected to the
 * target month with the trend, the month index, the planned price and the signal. Every component is refitted at each
 * origin of a rolling-origin backtest using only data available at that origin. The learned forecast is used only if
 * it beats seasonal-naive ("same month last year") by more than 5% MAE over at least 6 of the latest 36 origins; otherwise the planner
 * uses seasonal-naive. Either way the planner uses exactly the forecast that was validated (`LearnedDemand.forecast`).
 */

export type DemandHistoryPoint = {
  /** Travel month, YYYY-MM. */
  month: string;
  /** Gross bookings made for that travel month (room nights or seats) — same definition as `bookings`. */
  bookings: number;
  /** Searches for that travel month. */
  searches?: number;
  /** Searches that found the product sold out (measured sold-out demand). */
  soldOutSearches?: number;
  /**
   * External demand signal for that travel month, on any scale, known before the month starts (e.g. scheduled seat
   * capacity, an events-calendar intensity, a forward search index). The planner reads the product's typed `signal` as
   * the target month's signal relative to its normal level.
   */
  signal?: number;
  /** Average selling price achieved for that month (same currency as `referencePrice`). */
  price?: number;
  /**
   * Leave this month out of fitting and validation: a known shock (e.g. a lockdown) or a value imputed for a gap in the
   * source. The month still keeps the series consecutive; seasonal-naive skips it and uses the same month a year earlier.
   */
  exclude?: boolean;
};

export type LearnedDemand = {
  /** 'passed': learned model beat seasonal-naive on the rolling backtest and is used; 'fallback': seasonal-naive is used. */
  gate: 'passed' | 'fallback';
  /**
   * Gross unconstrained demand forecast for the target month at today's reference price — exactly the forecast the
   * rolling backtest validated (learned model if the gate passed, otherwise seasonal-naive). The planner uses it as is.
   */
  forecast: number;
  /** Demand level (deseasonalised, at mean price and signal) of the last three months: the anchor of the learned forecast. */
  level: number;
  reason: string;
  months: number;
  horizon: number;
  folds: number;
  /** Mean absolute error of the learned model and of seasonal-naive on the rolling backtest (units). */
  modelMae: number;
  naiveMae: number;
  /** 1 − modelMae / naiveMae. */
  skill: number;
  seasonalIndex: number;
  /** Learned index of the target month ÷ index of the latest observed month (replaces the typed `seasonal`). */
  seasonalRatio: number;
  /** Learned year-on-year growth (e.g. 1.08) and the factor applied over the horizon. */
  growth: number;
  growthFactor: number;
  /** Learned elasticity of demand to the external signal; null when the history has no usable signal. */
  signalBeta: number | null;
  /** Multiplier applied for the current signal: signal^β (or the typed signal when β is unknown). */
  signalEffect: number;
  /** Posterior price elasticity (null when the history has no usable price variation). */
  priceElasticity: number | null;
  priceElasticitySe: number | null;
  /** Spread (sd of relative error) of the rolling-origin forecast errors of the method in use. */
  volatility: number;
  /** Seasonal-naive forecast of unconstrained gross demand for the target month. */
  naiveForecast: number;
  /** 80% interval as multipliers of the point forecast (empirical quantiles of rolling relative errors). */
  lower80: number;
  upper80: number;
  /** Learned seasonal indices, January first (mean 1). */
  seasonal: number[];
};

export const PRIOR_PRICE_ELASTICITY = { Hotel: -3.0, Flight: -3.5 } as const;
const MIN_MONTHS = 24, MIN_FOLDS = 6, GATE = 0.95;
/**
 * The gate, error spread and interval use the latest 36 rolling origins (three years of evidence), so they describe how
 * forecastable the product is now rather than in a past regime such as 2020.
 */
const EVAL_ORIGINS = 36;
/** The model is fitted on at most the latest 48 months, so old regimes (e.g. 2020) do not distort recent seasonality. */
const FIT_WINDOW = 48;

const monthIndex = (ym: string) => { const m = /^(\d{4})-(\d{2})$/.exec(ym); return m ? Number(m[1]) * 12 + Number(m[2]) - 1 : NaN; };
const finite = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);

/** Bounds on any elasticity the planner uses (−8: near-commodity; −1.5: strongly differentiated). */
export const ELASTICITY_BOUNDS = { min: -8, max: -1.5 } as const;

/**
 * Prior price elasticity for a product without usable price history.
 * 1. A supplied `priceElasticity` (e.g. from a revenue-management team) wins.
 * 2. Otherwise the Lerner-implied elasticity e = −p / (p − c): the elasticity at which today's reference price p is the
 *    profit-maximising price for unit cost c. It assumes the market price is locally optimal, so without data the planner
 *    only moves price for reasons it can explain (stock to clear, scarce supply, pre-buy risk, a learned price response).
 * 3. With no usable margin (p ≤ 1.02·c), a firm-level prior by product kind.
 */
export function priorElasticity(item: Pick<Opportunity, 'kind' | 'priceElasticity' | 'referencePrice' | 'buy'>): number {
  if (finite(item.priceElasticity) && item.priceElasticity < 0) return Math.max(ELASTICITY_BOUNDS.min, Math.min(ELASTICITY_BOUNDS.max, item.priceElasticity));
  const p = item.referencePrice, c = item.buy;
  if (finite(p) && finite(c) && c > 0 && p > 1.02 * c) return Math.max(ELASTICITY_BOUNDS.min, Math.min(ELASTICITY_BOUNDS.max, -p / (p - c)));
  return PRIOR_PRICE_ELASTICITY[item.kind] ?? PRIOR_PRICE_ELASTICITY.Hotel;
}
/**
 * Kinked demand around today's market (reference) price: agents compare wholesale rates side by side, so a mark-up above
 * the market rate loses bookings faster than a discount wins them. Above the reference price demand responds with this
 * multiple of the elasticity. An explicit assumption (stress-tested by the model-risk worlds), not an estimate.
 */
export const ABOVE_MARKET_ELASTICITY_FACTOR = 2;
/** Demand multiplier at `price` relative to the reference price, with the kink at the reference price. */
export function priceResponse(price: number, referencePrice: number, elasticity: number): number {
  if (!(price > 0) || !(referencePrice > 0)) return 1;
  const ratio = price / referencePrice;
  return Math.pow(ratio, ratio > 1 ? elasticity * ABOVE_MARKET_ELASTICITY_FACTOR : elasticity);
}
/** Where the prior came from (for explanations). */
export function priorElasticitySource(item: Pick<Opportunity, 'kind' | 'priceElasticity' | 'referencePrice' | 'buy'>): 'supplied' | 'lerner' | 'kind' {
  if (finite(item.priceElasticity) && item.priceElasticity < 0) return 'supplied';
  return finite(item.referencePrice) && finite(item.buy) && item.buy > 0 && item.referencePrice > 1.02 * item.buy ? 'lerner' : 'kind';
}

/** Target travel month index (year × 12 + month) for a product period, or NaN. */
export function targetMonthIndex(period: string): number {
  const t = stayDate(period);
  if (t === null) return NaN;
  const d = new Date(t);
  return d.getUTCFullYear() * 12 + d.getUTCMonth();
}

type Series = { start: number; U: number[]; use: boolean[]; signal: (number | null)[]; price: (number | null)[] };

/** Latest run of consecutive months; unconstrained demand U = bookings + measured sold-out bookings. */
function seriesOf(history: DemandHistoryPoint[], fallbackConversion: number): Series | null {
  // One row per month (the last one supplied wins), in time order.
  const byMonth = new Map<number, DemandHistoryPoint & { i: number }>();
  for (const h of history) if (h && finite(monthIndex(h.month)) && finite(h.bookings) && h.bookings >= 0) byMonth.set(monthIndex(h.month), { ...h, i: monthIndex(h.month) });
  const rows = [...byMonth.values()].sort((a, b) => a.i - b.i);
  if (!rows.length) return null;
  const end = rows.length - 1;
  let startPos = end;
  while (startPos > 0 && rows[startPos - 1].i === rows[startPos].i - 1) startPos--;
  const run = rows.slice(startPos, end + 1);
  const U = run.map(h => {
    const searches = finite(h.searches) ? Math.max(0, h.searches) : 0, soldOut = finite(h.soldOutSearches) ? Math.min(searches, Math.max(0, h.soldOutSearches)) : 0;
    const available = searches - soldOut;
    const conversion = available > 0 ? Math.min(1, h.bookings / available) : fallbackConversion;
    return h.bookings + soldOut * conversion;
  });
  return { start: run[0].i, U, use: run.map(h => h.exclude !== true), signal: run.map(h => (finite(h.signal) && h.signal > 0 ? h.signal : null)), price: run.map(h => (finite(h.price) && h.price > 0 ? h.price : null)) };
}

type Fit = {
  S: number[]; growth: number; beta: number | null; elasticity: number | null; elasticitySe: number | null; signalMean: number | null; priceMean: number | null; ok: boolean;
  /** Log demand level at the fit origin (deseasonalised, at mean price and signal): mean of the last three months, trend-adjusted. */
  anchor: number;
};

/**
 * Fits a log-linear demand model on U[0..last] (inclusive) by least squares:
 *   log U_t = a + g·(t/12) + s_month(t) + β·log(signal_t / mean) + e·log(price_t / mean) + ε_t
 * (Huber-weighted, so shock months have bounded influence). Month effects give the seasonal indices; projection growth is
 * the median year-on-year change of the last 12 months (clamped 0.8–1.3), β the signal effect (shrunk by
 * m/(m+12), clamped 0–2) and e the price elasticity (combined with the prior as a normal posterior). The forecast anchor is
 * the mean of the last three months' level with season, signal and price removed, so it adapts to level shifts.
 */
function fit(series: Series, last: number, prior: number): Fit {
  const fail: Fit = { S: Array(12).fill(1), growth: 1, beta: null, elasticity: null, elasticitySe: null, signalMean: null, priceMean: null, ok: false, anchor: 0 };
  const n = last + 1, U = series.U;
  if (n < MIN_MONTHS) return fail;
  // The latest FIT_WINDOW usable months (excluded months do not count towards the window).
  const obs: number[] = [];
  for (let t = last; t >= 0 && obs.length < FIT_WINDOW; t--) if (series.use[t] && U[t] > 0) obs.unshift(t);
  const monthOf = (t: number) => (series.start + t) % 12;
  const seen = new Set(obs.map(monthOf));
  if (seen.size < 12 || obs.length < MIN_MONTHS - 2) return fail;
  const sig = obs.map(t => series.signal[t]).filter((v): v is number => v !== null), pr = obs.map(t => series.price[t]).filter((v): v is number => v !== null);
  const signalMean = sig.length >= 18 ? Math.exp(sig.reduce((a, b) => a + Math.log(b), 0) / sig.length) : null;
  const priceMean = pr.length >= 18 ? Math.exp(pr.reduce((a, b) => a + Math.log(b), 0) / pr.length) : null;
  const priceCv = priceMean ? Math.sqrt(pr.reduce((a, b) => a + (b - priceMean) ** 2, 0) / pr.length) / priceMean : 0;
  const x1 = (t: number) => (signalMean && series.signal[t] ? Math.log(series.signal[t]! / signalMean) : null);
  const x2 = (t: number) => (priceMean && priceCv >= 0.02 && series.price[t] ? Math.log(series.price[t]! / priceMean) : null);
  const useSignal = signalMean !== null && obs.filter(t => x1(t) !== null).length >= 18;
  const usePrice = priceMean !== null && priceCv >= 0.02 && obs.filter(t => x2(t) !== null).length >= 18;
  const data = obs.filter(t => (!useSignal || x1(t) !== null) && (!usePrice || x2(t) !== null));
  if (new Set(data.map(monthOf)).size < 12) return fail;
  // Columns: intercept, trend (years), 11 month dummies (base = the first month seen), signal, price.
  const base = monthOf(data[0]), dummies = Array.from({ length: 12 }, (_, m) => m).filter(m => m !== base);
  const X = data.map(t => [1, t / 12, ...dummies.map(m => (monthOf(t) === m ? 1 : 0)), ...(useSignal ? [x1(t)!] : []), ...(usePrice ? [x2(t)!] : [])]);
  // Huber-weighted least squares: a shock month (a lockdown, a strike, a data error) gets bounded influence on the month
  // effects instead of dragging the whole seasonal pattern.
  const ols = robustLeastSquares(X, data.map(t => Math.log(U[t])));
  if (!ols) return fail;
  const trend = ols.coef[1];
  const logS = Array.from({ length: 12 }, (_, m) => (m === base ? 0 : ols.coef[2 + dummies.indexOf(m)]));
  const meanLog = logS.reduce((a, b) => a + b, 0) / 12;
  const S = logS.map(v => Math.exp(v - meanLog));
  const j0 = 2 + dummies.length;
  let beta: number | null = null, elasticity: number | null = null, elasticitySe: number | null = null;
  const m = data.length;
  if (useSignal) beta = Math.min(2, Math.max(0, ols.coef[j0] * m / (m + 12)));
  if (usePrice) {
    const j = j0 + (useSignal ? 1 : 0), e = ols.coef[j], se = Math.max(0.05, ols.se[j]);
    // Normal prior N(prior, 1²) × likelihood N(e, se²): precision-weighted posterior.
    const wl = 1 / (se * se), wp = 1;
    elasticity = Math.min(-1.05, Math.max(ELASTICITY_BOUNDS.min, (e * wl + prior * wp) / (wl + wp)));
    elasticitySe = Math.sqrt(1 / (wl + wp));
  }
  // Projection growth: median of the last 12 year-on-year log changes, net of signal and price (season cancels). The
  // median ignores a few shock months in either year; the window's trend is only a nuisance term for the month effects.
  const net = (t: number) => Math.log(U[t]) - (beta !== null ? beta * (x1(t) ?? 0) : 0) - (elasticity !== null ? elasticity * (x2(t) ?? 0) : 0);
  const yoy: number[] = [];
  for (let t = Math.max(12, last - 11); t <= last; t++) if (series.use[t] && series.use[t - 12] && U[t] > 0 && U[t - 12] > 0) yoy.push(net(t) - net(t - 12));
  const growth = Math.min(1.3, Math.max(0.8, yoy.length >= 6 ? Math.exp(quantile(yoy, 0.5)) : Math.exp(trend)));
  // Anchor: median level of the last three usable months with season, signal and price removed, moved to `last` by the
  // growth (the median keeps one odd month from shifting the level).
  const recent = obs.slice(-3).filter(t => t > last - 6);
  const levels = recent.map(t => {
    let level = Math.log(U[t]) - Math.log(S[monthOf(t)]);
    if (beta !== null) level -= beta * (x1(t) ?? 0);
    if (elasticity !== null) level -= elasticity * (x2(t) ?? 0);
    return level + Math.log(growth) * (last - t) / 12;
  });
  if (!levels.length) return fail;
  const anchor = quantile(levels, 0.5);
  return { S, growth, beta, elasticity, elasticitySe, signalMean: beta !== null ? signalMean : null, priceMean: elasticity !== null ? priceMean : null, ok: true, anchor };
}

/** Weighted least squares with standard errors (small dense systems). */
function leastSquares(X: number[][], y: number[], w: number[] = y.map(() => 1)): { coef: number[]; se: number[]; resid: number[] } | null {
  const n = X.length, p = X[0]?.length ?? 0;
  if (n <= p + 2) return null;
  const A = Array.from({ length: p }, (_, i) => Array.from({ length: p }, (_, j) => X.reduce((s, r, k) => s + w[k] * r[i] * r[j], 0)));
  const b = Array.from({ length: p }, (_, i) => X.reduce((s, r, k) => s + w[k] * r[i] * y[k], 0));
  const inv = invert(A);
  if (!inv) return null;
  const coef = inv.map(row => row.reduce((s, v, j) => s + v * b[j], 0));
  const resid = y.map((v, k) => v - X[k].reduce((s, x, j) => s + x * coef[j], 0));
  const sigma2 = resid.reduce((s, r, k) => s + w[k] * r * r, 0) / (n - p);
  return { coef, se: inv.map((row, i) => Math.sqrt(Math.max(0, row[i] * sigma2))), resid };
}

/**
 * Huber M-estimate by iteratively reweighted least squares (tuning constant 1.345 × robust scale): ordinary least squares
 * for well-behaved data, bounded influence for shock months.
 */
function robustLeastSquares(X: number[][], y: number[]): { coef: number[]; se: number[] } | null {
  let fit = leastSquares(X, y);
  for (let iteration = 0; fit && iteration < 8; iteration++) {
    const abs = fit.resid.map(Math.abs), scale = Math.max(1e-6, quantile(abs, 0.5) / 0.6745), c = 1.345 * scale;
    const w = abs.map(r => (r <= c ? 1 : c / r));
    const next = leastSquares(X, y, w);
    if (!next) break;
    const moved = next.coef.reduce((m, v, j) => Math.max(m, Math.abs(v - fit!.coef[j])), 0);
    fit = next;
    if (moved < 1e-6) break;
  }
  return fit;
}

function invert(A: number[][]): number[][] | null {
  const n = A.length, M = A.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);
  for (let c = 0; c < n; c++) {
    let pivot = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[pivot][c])) pivot = r;
    if (Math.abs(M[pivot][c]) < 1e-12) return null;
    [M[c], M[pivot]] = [M[pivot], M[c]];
    const d = M[c][c];
    for (let j = 0; j < 2 * n; j++) M[c][j] /= d;
    for (let r = 0; r < n; r++) if (r !== c) { const f = M[r][c]; if (f) for (let j = 0; j < 2 * n; j++) M[r][j] -= f * M[c][j]; }
  }
  return M.map(row => row.slice(n));
}

/** Same month in the latest usable year at or before `origin` (excluded months are skipped a year at a time). */
function seasonalNaive(series: Series, origin: number, target: number): number | null {
  let j = target - 12;
  while (j > origin || (j >= 0 && !series.use[j])) j -= 12;
  return j >= 0 ? series.U[j] : null;
}

function quantile(values: number[], p: number): number {
  if (!values.length) return 0;
  const s = values.slice().sort((a, b) => a - b), x = p * (s.length - 1), i = Math.floor(x), f = x - i;
  return s[i] + (s[Math.min(s.length - 1, i + 1)] - s[i]) * f;
}

const cache = new WeakMap<DemandHistoryPoint[], Map<string, LearnedDemand | null>>();

/** Learns the product's demand model from its monthly history; null when there is no usable history. */
export function learnDemand(item: Opportunity): LearnedDemand | null {
  const history = item.history;
  if (!history || history.length < MIN_MONTHS) return null;
  const key = `${item.period}|${item.signal}|${item.kind}|${item.priceElasticity ?? ''}|${item.conversion}|${item.referencePrice}|${item.buy}`;
  let byKey = cache.get(history);
  if (byKey?.has(key)) return byKey.get(key)!;
  const result = computeLearned(item, history);
  if (!byKey) { byKey = new Map(); cache.set(history, byKey); }
  byKey.set(key, result);
  return result;
}

/** Learned forecast for month `t` from a model fitted at `origin`, given the target month's price and signal ratios (÷ mean). */
function project(series: Series, f: Fit, origin: number, t: number, priceRatio: number | null, signalRatio: number | null): number {
  let log = f.anchor + Math.log(f.growth) * (t - origin) / 12 + Math.log(f.S[(series.start + t) % 12]);
  if (f.elasticity !== null && priceRatio) log += f.elasticity * Math.log(priceRatio);
  if (f.beta !== null && signalRatio) log += f.beta * Math.log(signalRatio);
  return Math.exp(log);
}

function computeLearned(item: Opportunity, history: DemandHistoryPoint[]): LearnedDemand | null {
  const series = seriesOf(history, Math.max(0, Math.min(1, item.conversion || 0)));
  if (!series || series.U.length < MIN_MONTHS) return null;
  const n = series.U.length, lastMonth = series.start + n - 1;
  const target = targetMonthIndex(item.period);
  if (!finite(target) || target <= lastMonth) return null;
  const horizon = target - lastMonth, prior = priorElasticity(item);
  // Rolling-origin backtest: refit at every origin on data up to that origin only, forecast `horizon` months ahead.
  // Price and signal at the target month are inputs the planner knows (its own price; a forward-looking signal).
  const errModel: number[] = [], errNaive: number[] = [], relModel: number[] = [], relNaive: number[] = [];
  const lastOrigin = n - 1 - horizon;
  for (let origin = Math.max(MIN_MONTHS - 1, lastOrigin - EVAL_ORIGINS + 1); origin <= lastOrigin; origin++) {
    const f = fit(series, origin, prior);
    const t = origin + horizon, actual = series.U[t], naive = seasonalNaive(series, origin, t);
    if (!series.use[t] || !f.ok || naive === null || !(actual > 0)) continue;
    const p = series.price[t], g = series.signal[t];
    const forecast = project(series, f, origin, t, f.priceMean && p ? p / f.priceMean : null, f.signalMean && g ? g / f.signalMean : null);
    errModel.push(Math.abs(forecast - actual)); errNaive.push(Math.abs(naive - actual));
    relModel.push(forecast / actual - 1); relNaive.push(naive / actual - 1);
  }
  const final = fit(series, n - 1, prior);
  if (!final.ok) return null;
  const folds = errModel.length;
  const modelMae = folds ? errModel.reduce((a, b) => a + b, 0) / folds : NaN, naiveMae = folds ? errNaive.reduce((a, b) => a + b, 0) / folds : NaN;
  const passed = folds >= MIN_FOLDS && modelMae < GATE * naiveMae;
  const rel = passed ? relModel : relNaive;
  const sd = rel.length ? Math.sqrt(rel.reduce((a, b) => a + b * b, 0) / rel.length) : item.volatility;
  const targetM = target % 12, lastM = lastMonth % 12;
  const naiveForecast = seasonalNaive(series, n - 1, n - 1 + horizon) ?? series.U[n - 1];
  // Production forecast = the validated formula at the planner's reference price and the product's typed signal.
  const priceRatio = final.priceMean && item.referencePrice > 0 ? item.referencePrice / final.priceMean : null;
  const typedSignal = Math.max(0.01, item.signal || 1);
  const learnedForecast = project(series, final, n - 1, n - 1 + horizon, priceRatio, final.beta !== null ? typedSignal : null);
  // Without a learned signal effect, the typed external signal still applies as entered (it is not part of the validation).
  const forecast = passed ? learnedForecast * (final.beta === null ? Math.max(0, item.signal || 1) : 1) : naiveForecast;
  const signalEffect = final.beta !== null ? Math.pow(typedSignal, final.beta) : Math.max(0, item.signal || 1);
  // Interval: forecast ÷ (1 + relative error) — a forecast that ran 10% high means actual = forecast / 1.1.
  const lower80 = rel.length ? 1 / (1 + quantile(rel, 0.9)) : 1, upper80 = rel.length ? 1 / (1 + quantile(rel, 0.1)) : 1;
  return {
    gate: passed ? 'passed' : 'fallback', forecast: Math.max(0, forecast), level: Math.exp(final.anchor),
    reason: !folds ? 'Not enough history for a rolling backtest.' : passed
      ? `Learned model beat seasonal-naive by ${Math.round((1 - modelMae / naiveMae) * 100)}% MAE over ${folds} rolling origins.`
      : `Learned model did not beat seasonal-naive by more than 5% (${folds} origins); seasonal-naive is used.`,
    months: n, horizon, folds, modelMae, naiveMae, skill: folds ? 1 - modelMae / naiveMae : 0,
    seasonalIndex: final.S[targetM], seasonalRatio: final.S[targetM] / final.S[lastM],
    growth: final.growth, growthFactor: Math.pow(final.growth, horizon / 12),
    signalBeta: final.beta, signalEffect, priceElasticity: final.elasticity, priceElasticitySe: final.elasticitySe,
    volatility: Math.min(0.8, Math.max(0.05, sd)), naiveForecast,
    lower80: Math.min(1, lower80), upper80: Math.max(1, upper80),
    seasonal: Array.from({ length: 12 }, (_, m) => final.S[m]),
  };
}

/** Price elasticity the planner uses: learned (posterior) → typed → prior. */
export function elasticityOf(item: Opportunity): number {
  const learned = learnDemand(item);
  if (learned?.priceElasticity !== null && learned?.priceElasticity !== undefined) return learned.priceElasticity;
  return priorElasticity(item);
}

/**
 * Demand volatility the risk engine uses: the rolling-backtest error spread when the history passed, else the typed
 * value. A market-level history (`historyScope: 'market'`) is smoother than a single product, so the typed value is a floor.
 */
export function volatilityOf(item: Opportunity): number {
  const learned = learnDemand(item);
  if (!learned || learned.gate !== 'passed' || learned.folds < MIN_FOLDS) return item.volatility;
  return item.historyScope === 'market' ? Math.max(learned.volatility, item.volatility) : learned.volatility;
}

export type DemandSource = { kind: 'learned' | 'seasonal-naive' | 'formula'; label: string; detail: string };

/** Human-readable description of where the planner's forecast for this product comes from. */
export function demandSourceOf(item: Opportunity): DemandSource {
  const learned = learnDemand(item);
  if (!learned) return { kind: 'formula', label: 'Typed inputs', detail: 'No monthly history: seasonality and the external signal are typed multipliers.' };
  if (learned.gate === 'passed') return { kind: 'learned', label: 'Learned from history', detail: `${learned.months} months. ${learned.reason} Seasonality ×${learned.seasonalRatio.toFixed(2)}, growth ×${learned.growthFactor.toFixed(2)}${learned.signalBeta !== null ? `, signal β ${learned.signalBeta.toFixed(2)}` : ''}${learned.priceElasticity !== null ? `, price elasticity ${learned.priceElasticity.toFixed(1)}` : ''}.` };
  return { kind: 'seasonal-naive', label: 'Same month last year', detail: `${learned.months} months. ${learned.reason}` };
}
