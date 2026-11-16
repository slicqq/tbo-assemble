/**
 * Input limits shared by the CSV import, the plan API, saved plans and the workspace.
 *
 * The risk engine (risk-cvar-v5) plans portfolios of this size with its decomposition solver
 * (src/lib/risk-optimizer.ts: about 4 s for 1,000 products and 7 s for 2,000 on one core).
 * The legacy engine (scenario-grid-v4) is O(n²) in its greedy fallback (≈2 s at 100 products,
 * 40 s at 500, 160 s at 1,000), so it — and the tools that compare against it — stay at 100 products.
 */
export const INPUT_LIMITS = {
  /** Products per plan, CSV file or API request. */
  maxItems: 2000,
  /** Supplier capacity (and allotment capacity) per product, in units. */
  maxUnitsPerProduct: 5000,
  /** Total supplier capacity across all products, in units (bounds solver memory). */
  maxTotalUnits: 500_000,
  /** Products the legacy engine scenario-grid-v4 (and the comparisons that run it) accepts. */
  maxItemsLegacyEngine: 100,
  /** Plan API request body, in bytes (below Vercel's 4.5 MB request limit). */
  maxRequestBytes: 4_000_000,
  /** CSV upload size, in bytes. */
  maxCsvBytes: 2_000_000,
  /** Monthly history rows per product (plan API). */
  maxHistoryMonths: 120,
} as const;

const integer = new Intl.NumberFormat('en-IN');
/** e.g. 2000 → "2,000" (Indian grouping, as elsewhere in the workspace). */
export const formatLimit = (value: number) => integer.format(value);
