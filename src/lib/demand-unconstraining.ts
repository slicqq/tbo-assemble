import { trendFactor, type Opportunity } from './procurement-core';
import { learnDemand } from './learned-demand';

/**
 * Sold-out (censored) demand recovery used by the portfolio risk engine (risk-cvar-v5).
 *
 * Bookings stop once a product sells out, but searches keep arriving. Booking history therefore
 * under-states demand exactly when demand is highest. The engine adds back the bookings that were
 * turned away:
 *
 *  - measured (preferred data contract): lost = searches that found the product sold out × conversion,
 *    where conversion is the look-to-book rate on searches that found availability;
 *  - otherwise: lost = the search-implied shortfall (searches × conversion − bookings), capped by
 *    the sold-out share of searches. The cap stops ordinary conversion noise in periods that never
 *    sold out from being read as lost demand.
 *
 * `soldOut` is the percentage (0–100) of searches that found the product sold out (the CSV field
 * guide's definition); a sold-out-days share is an acceptable proxy when searches are spread evenly.
 * `soldOutSearches` is the optional measured count of searches that found it sold out.
 * This replaces scenario-grid-v4's fixed uplift of (1 + soldOut/100 × 0.2).
 */
export function soldOutShare(item: Pick<Opportunity, 'soldOut'>): number {
  const share = (Number.isFinite(item.soldOut) ? item.soldOut : 0) / 100;
  return Math.max(0, Math.min(0.95, share));
}

export function searchesOnSoldOutDays(item: Pick<Opportunity, 'soldOut' | 'searches' | 'soldOutSearches'>): { value: number; measured: boolean } {
  const searches = Math.max(0, item.searches || 0);
  if (item.soldOutSearches !== undefined && Number.isFinite(item.soldOutSearches) && item.soldOutSearches >= 0)
    return { value: Math.min(searches, item.soldOutSearches), measured: true };
  return { value: searches * soldOutShare(item), measured: false };
}

/** Bookings turned away while sold out. */
export function lostBookings(item: Pick<Opportunity, 'soldOut' | 'searches' | 'soldOutSearches' | 'conversion' | 'bookings'>): number {
  const conversion = Math.max(0, Math.min(1, item.conversion || 0));
  const denied = searchesOnSoldOutDays(item);
  if (denied.measured) return denied.value * conversion;
  const shortfall = Math.max(0, Math.max(0, item.searches || 0) * conversion - Math.max(0, item.bookings || 0));
  return Math.min(denied.value * conversion, shortfall);
}

export function unconstrainedBookings(item: Opportunity): number {
  return Math.max(0, item.bookings || 0) + lostBookings(item);
}

/**
 * Net-demand forecast for risk-cvar-v5: the same blend, trend, seasonality, signal and cancellation
 * terms as scenario-grid-v4, but with the booking term unconstrained instead of an arbitrary uplift.
 * `searches × conversion` already counts searches on every day, so it needs no correction.
 */
export function forecastUnconstrained(item: Opportunity): number {
  const weight = item.bookingWeight ?? 0.55;
  const searchDemand = Math.max(0, item.searches || 0) * Math.max(0, Math.min(1, item.conversion || 0));
  const blended = unconstrainedBookings(item) * weight + searchDemand * (1 - weight);
  // With a monthly history the planner uses exactly the forecast the rolling backtest validated (learned-demand.ts).
  const learned = learnDemand(item);
  if (learned) return Math.max(0, learned.forecast * (1 - item.cancellations));
  return Math.max(0, blended * trendFactor(item) * item.seasonal * item.signal * (1 - item.cancellations));
}

/**
 * True when the booking-vs-search blend weight can still change this product's v5 forecast.
 * When sold-out recovery explains the whole gap between bookings and search-implied demand, the
 * two signals coincide and any weight gives the same forecast (a fitted weight is then moot).
 */
export function blendWeightMatters(item: Opportunity): boolean {
  const searchDemand = Math.max(0, item.searches || 0) * Math.max(0, Math.min(1, item.conversion || 0));
  return Math.abs(unconstrainedBookings(item) - searchDemand) > 1e-6 * Math.max(1, searchDemand);
}
