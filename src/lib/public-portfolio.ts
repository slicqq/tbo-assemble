import type { Opportunity } from './procurement-core';
import type { DemandHistoryPoint } from './learned-demand';
import snapshot from '../data/public-portfolio.json';

/**
 * Public-data portfolio: the planner on real monthly demand histories.
 *
 * Demand histories are real public series (src/data/public-portfolio.json, built by
 * docs/data/build_public_portfolio.py): DGCA domestic city-pair passengers (routes, and air arrivals into leisure
 * cities as a proxy for hotel demand there) and Singapore Tourism Board occupied hotel room nights.
 *
 * Each market series is scaled to a product-sized level (the learned model is log-linear, so scaling changes
 * nothing about the learned seasonality, growth, error spread or backtest gate). Costs, selling prices, capacity
 * and contract terms are illustrative assumptions, not TBO data. Market series are smoother than a single product,
 * so the planner uses the larger of the learned error spread and the product's typed volatility
 * (`historyScope: 'market'`).
 */
export type PublicSeriesPoint = { month: string; value: number; imputed?: boolean };
type Snapshot = {
  schema: string; builtAt: string;
  sources: { id: string; name: string; url: string; sha256: string; note: string; licenseUrl?: string }[];
  anomalies: { source: string; from: string; to: string; reason: string }[];
  seriesSource: Record<string, string>;
  series: Record<string, PublicSeriesPoint[]>;
};
const data = snapshot as Snapshot;

/** Latest months of each history passed to the planner (also the API's per-item history limit). */
export const PUBLIC_HISTORY_MONTHS = 120;

type ProductSpec = Omit<Opportunity, 'bookings' | 'searches' | 'conversion' | 'seasonal' | 'signal' | 'soldOut' | 'history' | 'previousBookings' | 'previousSearches'> & {
  /** Series key in the snapshot. */
  series: string;
  /** Product-sized average monthly demand over the latest 12 months (units). */
  level: number;
  /** Human-readable description of the series. */
  seriesLabel: string;
};

const PRODUCTS: ProductSpec[] = [
  { id: 'pub-goa', name: 'Goa beach hotels', destination: 'Goa', kind: 'Hotel', period: 'Dec 2026', series: 'arrivals:GOA', seriesLabel: 'DGCA air arrivals into Goa', level: 140, buy: 6400, referencePrice: 9200, capacity: 160, allotmentBuy: 6850, allotmentDepositPct: 0.25, allotmentCapacity: 60, cancellations: 0.12, volatility: 0.28, recoveryPct: 0.15, quoteExpiry: '2026-12-05', integration: 'Direct contract', timing: 'Buy now', existingStock: 0 },
  { id: 'pub-jaipur', name: 'Jaipur heritage hotels', destination: 'Jaipur', kind: 'Hotel', period: 'Jan 2027', series: 'arrivals:JAIPUR', seriesLabel: 'DGCA air arrivals into Jaipur', level: 90, buy: 5100, referencePrice: 7600, capacity: 150, cancellations: 0.1, volatility: 0.26, recoveryPct: 0.1, quoteExpiry: '2026-12-20', integration: 'Bedbank', timing: 'Negotiate', existingStock: 0 },
  { id: 'pub-kerala', name: 'Kerala backwater resorts', destination: 'Kerala', kind: 'Hotel', period: 'Dec 2026', series: 'arrivals:KOCHI', seriesLabel: 'DGCA air arrivals into Kochi', level: 80, buy: 5800, referencePrice: 8400, capacity: 130, allotmentBuy: 6200, allotmentDepositPct: 0.25, allotmentCapacity: 50, cancellations: 0.11, volatility: 0.3, recoveryPct: 0.2, quoteExpiry: '2026-12-10', integration: 'Direct contract', timing: 'Buy now', existingStock: 0 },
  { id: 'pub-srinagar', name: 'Srinagar hotels and houseboats', destination: 'Srinagar', kind: 'Hotel', period: 'May 2027', series: 'arrivals:SRINAGAR', seriesLabel: 'DGCA air arrivals into Srinagar', level: 70, buy: 5600, referencePrice: 8100, capacity: 120, cancellations: 0.14, volatility: 0.34, recoveryPct: 0.1, quoteExpiry: '2027-01-31', integration: 'Bedbank', timing: 'Monitor quote', existingStock: 0 },
  { id: 'pub-singapore', name: 'Singapore city hotels', destination: 'Singapore', kind: 'Hotel', period: 'Dec 2026', series: 'stb:SINGAPORE', seriesLabel: 'Singapore Tourism Board occupied room nights', level: 110, buy: 10600, referencePrice: 14800, capacity: 130, allotmentBuy: 11300, allotmentDepositPct: 0.25, allotmentCapacity: 40, cancellations: 0.09, volatility: 0.22, recoveryPct: 0.2, quoteExpiry: '2026-12-01', integration: 'Direct contract', timing: 'Buy now', existingStock: 0 },
  { id: 'pub-del-bom', name: 'Delhi → Mumbai', destination: 'Mumbai', kind: 'Flight', period: 'Dec 2026', series: 'route:DELHI>MUMBAI', seriesLabel: 'DGCA passengers Delhi → Mumbai', level: 120, buy: 4600, referencePrice: 6100, capacity: 150, allotmentBuy: 4850, allotmentDepositPct: 0.2, allotmentCapacity: 60, cancellations: 0.07, volatility: 0.18, recoveryPct: 0.05, quoteExpiry: '2026-12-01', integration: 'Airline allotment', timing: 'Buy now', existingStock: 0 },
  { id: 'pub-blr-del', name: 'Bengaluru → Delhi', destination: 'Delhi', kind: 'Flight', period: 'Jan 2027', series: 'route:BENGALURU>DELHI', seriesLabel: 'DGCA passengers Bengaluru → Delhi', level: 100, buy: 5200, referencePrice: 6900, capacity: 120, cancellations: 0.07, volatility: 0.18, recoveryPct: 0.05, quoteExpiry: '2026-12-15', integration: 'GDS fare', timing: 'Negotiate', existingStock: 0 },
  { id: 'pub-del-goa', name: 'Delhi → Goa', destination: 'Goa', kind: 'Flight', period: 'Dec 2026', series: 'route:DELHI>GOA', seriesLabel: 'DGCA passengers Delhi → Goa', level: 90, buy: 4900, referencePrice: 6600, capacity: 110, allotmentBuy: 5150, allotmentDepositPct: 0.2, allotmentCapacity: 40, cancellations: 0.08, volatility: 0.22, recoveryPct: 0.05, quoteExpiry: '2026-12-01', integration: 'Airline allotment', timing: 'Buy now', existingStock: 0 },
];

const CONVERSION = 0.04;

/** The public-data portfolio as planner inputs (histories scaled to product size; economics are assumptions). */
export function publicPortfolio(): Opportunity[] {
  return PRODUCTS.map(spec => {
    const { series: key, level, seriesLabel, ...rest } = spec;
    const raw = (data.series[key] ?? []).slice(-PUBLIC_HISTORY_MONTHS);
    const recent = raw.slice(-12), mean = recent.reduce((s, p) => s + p.value, 0) / Math.max(1, recent.length);
    const scale = mean > 0 ? level / mean : 0;
    const windows = data.anomalies.filter(a => a.source === data.seriesSource[key]);
    const shocked = (month: string) => windows.some(a => month >= a.from && month <= a.to);
    // Shock months and months imputed for gaps in the source stay in the series but are left out of fitting and validation.
    const history: DemandHistoryPoint[] = raw.map(p => ({ month: p.month, bookings: Math.round(p.value * scale * 10) / 10, ...(p.imputed || shocked(p.month) ? { exclude: true } : {}) }));
    const excluded = history.filter(h => h.exclude).length;
    const latest = history[history.length - 1]?.bookings ?? level, yearAgo = history[history.length - 13]?.bookings ?? latest;
    return {
      ...rest,
      bookings: Math.round(latest), searches: Math.round(latest / CONVERSION), conversion: CONVERSION,
      previousBookings: Math.round(yearAgo), previousSearches: Math.round(yearAgo / CONVERSION),
      seasonal: 1, signal: 1, soldOut: 0,
      history, historyScope: 'market' as const,
      dataSource: `${seriesLabel}, ${raw[0]?.month ?? '?'} to ${raw[raw.length - 1]?.month ?? '?'} (${raw.length} months; ${excluded} COVID or imputed months left out of fitting); scaled ×${scale.toPrecision(3)} to product size.`,
    };
  });
}

/** Sources of the public series and the shock windows left out of fitting, for citations in the UI and docs. */
export function publicPortfolioSources() {
  return { builtAt: data.builtAt, sources: data.sources, anomalies: data.anomalies };
}
