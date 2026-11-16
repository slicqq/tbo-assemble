import type { Opportunity } from './procurement-core';

/**
 * Correlated Monte-Carlo season scenarios for the portfolio risk engine (risk-cvar-v5).
 *
 * Every constant below is an explicit modelling assumption, not a value estimated from
 * TBO data. They are exported so the UI, docs and tests show exactly what is assumed.
 * Replace them with estimates once dated TBO booking/search/cancellation histories exist.
 */
export const RISK_ASSUMPTIONS = {
  /** Share of log-demand variance common to every product (macro / India outbound mood). */
  globalWeight: 0.15,
  /** Additional share common to products in the same region. Same-region correlation = 0.50, cross-region = 0.15. */
  regionWeight: 0.35,
  /** Probability that a region suffers a demand shock in a season (conflict, visa rule, airline failure, disaster). */
  regionalShockProbability: 0.04,
  /** Demand multiplier range applied to every product in a shocked region. */
  regionalShockRange: [0.45, 0.75] as const,
  /** Probability of a market-wide shock in a season. */
  globalShockProbability: 0.02,
  globalShockRange: [0.6, 0.85] as const,
  /** Lognormal sigma of the achievable selling price around the planned price. */
  priceSigma: 0.05,
  /** Selling-price multiplier range in a shocked season (discounting to move stock). */
  shockPriceRange: [0.85, 0.95] as const,
  /** Lognormal sigma of the season's cancellation rate around the supplied rate. */
  cancellationSigma: 0.25,
  /** Cancellation-rate multiplier in a shocked season. */
  shockCancellationMultiplier: 1.5,
} as const;

const REGION_BY_DESTINATION: Record<string, string> = {
  goa: 'India', jaipur: 'India', kerala: 'India', udaipur: 'India', shimla: 'India', mumbai: 'India', delhi: 'India',
  'new delhi': 'India', bengaluru: 'India', hyderabad: 'India', chennai: 'India', kolkata: 'India', manali: 'India', andaman: 'India',
  dubai: 'Middle East', 'abu dhabi': 'Middle East', doha: 'Middle East', muscat: 'Middle East', riyadh: 'Middle East',
  bali: 'South-East Asia', bangkok: 'South-East Asia', phuket: 'South-East Asia', singapore: 'South-East Asia',
  'kuala lumpur': 'South-East Asia', hanoi: 'South-East Asia', 'ho chi minh city': 'South-East Asia', krabi: 'South-East Asia',
  maldives: 'Indian Ocean', mauritius: 'Indian Ocean', seychelles: 'Indian Ocean', colombo: 'South Asia', kathmandu: 'South Asia',
  london: 'Europe', paris: 'Europe', istanbul: 'Europe', zurich: 'Europe', rome: 'Europe', amsterdam: 'Europe',
  baku: 'Caucasus & Central Asia', tbilisi: 'Caucasus & Central Asia', almaty: 'Caucasus & Central Asia',
};

/** Unknown destinations get their own region: they then share only the global factor with other places. */
export function regionOf(destination: string): string {
  const key = destination.trim().toLowerCase();
  return REGION_BY_DESTINATION[key] ?? `Other · ${key}`;
}

/** FNV-1a string hash → 32-bit seed. */
export function hashString(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/** Mulberry32: small, fast, deterministic PRNG (uniform in [0, 1)). */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function standardNormal(random: () => number): number {
  let u = random();
  while (u <= 1e-12) u = random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * random());
}

export type ScenarioSet = {
  count: number;
  seed: number;
  /** Per item: multiplier on the product's planned net demand (after its supplied cancellation rate). */
  demand: Float64Array[];
  /** Per item: multiplier on the planned selling price. */
  price: Float64Array[];
  /** Per scenario: 0 = normal, 1 = at least one regional shock somewhere, 2 = global shock. */
  shock: Uint8Array;
  regions: string[];
};

/**
 * Builds `count` joint seasons. Random streams are keyed by seed + region/product id, so editing
 * one product does not reshuffle the draws of unrelated products or regions.
 */
export function buildScenarioSet(items: Opportunity[], count: number, seed: number): ScenarioSet {
  if (!Number.isInteger(count) || count < 20 || count > 20000) throw new Error('Scenario count must be a whole number from 20 to 20,000.');
  const A = RISK_ASSUMPTIONS;
  const regions = items.map(item => regionOf(item.destination));

  // Global factor and global shock.
  const globalRandom = seededRandom(seed ^ hashString('global'));
  const globalZ = new Float64Array(count), globalShock = new Float64Array(count).fill(1);
  for (let s = 0; s < count; s++) {
    globalZ[s] = standardNormal(globalRandom);
    const hit = globalRandom() < A.globalShockProbability, severity = globalRandom();
    if (hit) globalShock[s] = A.globalShockRange[0] + (A.globalShockRange[1] - A.globalShockRange[0]) * severity;
  }

  // Region factors and regional shocks.
  const regionZ = new Map<string, Float64Array>(), regionShock = new Map<string, Float64Array>();
  for (const region of new Set(regions)) {
    const random = seededRandom(seed ^ hashString('region:' + region));
    const z = new Float64Array(count), shock = new Float64Array(count).fill(1);
    for (let s = 0; s < count; s++) {
      z[s] = standardNormal(random);
      const hit = random() < A.regionalShockProbability, severity = random();
      if (hit) shock[s] = A.regionalShockRange[0] + (A.regionalShockRange[1] - A.regionalShockRange[0]) * severity;
    }
    regionZ.set(region, z); regionShock.set(region, shock);
  }

  const shockFlag = new Uint8Array(count);
  for (let s = 0; s < count; s++) {
    if (globalShock[s] < 1) shockFlag[s] = 2;
    else for (const shock of regionShock.values()) if (shock[s] < 1) { shockFlag[s] = 1; break; }
  }

  const loadGlobal = Math.sqrt(A.globalWeight), loadRegion = Math.sqrt(A.regionWeight), loadOwn = Math.sqrt(1 - A.globalWeight - A.regionWeight);
  const demand: Float64Array[] = [], price: Float64Array[] = [];
  items.forEach((item, i) => {
    const random = seededRandom(seed ^ hashString('item:' + item.id));
    const sigma = Math.max(0, Math.min(1.5, item.volatility));
    const baseCancel = Math.max(0, Math.min(0.95, item.cancellations));
    const zRegion = regionZ.get(regions[i])!, sRegion = regionShock.get(regions[i])!;
    const d = new Float64Array(count), p = new Float64Array(count);
    for (let s = 0; s < count; s++) {
      const own = standardNormal(random), priceNoise = standardNormal(random), cancelNoise = standardNormal(random), shockPrice = random();
      const z = loadGlobal * globalZ[s] + loadRegion * zRegion[s] + loadOwn * own;
      const shocked = globalShock[s] < 1 || sRegion[s] < 1;
      // Mean-preserving lognormal before shocks; shocks then lower demand in that season.
      const level = Math.exp(sigma * z - sigma * sigma / 2) * globalShock[s] * sRegion[s];
      const cancel = Math.min(0.95, baseCancel * Math.exp(A.cancellationSigma * cancelNoise - A.cancellationSigma ** 2 / 2) * (shocked ? A.shockCancellationMultiplier : 1));
      const cancelAdjustment = baseCancel < 0.95 ? (1 - cancel) / (1 - baseCancel) : 0;
      d[s] = Math.max(0, level * cancelAdjustment);
      const shockMultiplier = shocked ? A.shockPriceRange[0] + (A.shockPriceRange[1] - A.shockPriceRange[0]) * shockPrice : 1;
      p[s] = Math.exp(A.priceSigma * priceNoise - A.priceSigma ** 2 / 2) * shockMultiplier;
    }
    demand.push(d); price.push(p);
  });
  return { count, seed, demand, price, shock: shockFlag, regions };
}
