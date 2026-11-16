'use client';
import { useEffect, useMemo, useState } from 'react';
import { optimizePortfolio, type OptimizedPlan } from './portfolio-optimizer';
import type { Opportunity, PlanOptions } from './procurement-core';
import { BACKGROUND_PLAN_THRESHOLD } from './plan-jobs';
import { runPlanJob, SupersededError } from './plan-client';

/** Placeholder while the first background plan for a new inventory is being computed. */
export const EMPTY_PLAN: OptimizedPlan = { rows: [], objective: 0, upperBound: 0, gap: 0, baselineObjective: 0, algorithm: 'risk-cvar-decomposition', bucketCount: 0 };

export type BackgroundPlan = {
  plan: OptimizedPlan;
  /** True while a background plan for the current inputs is being computed. */
  pending: boolean;
  /** True when this portfolio is planned in the background worker. */
  background: boolean;
  /** True while the shown plan belongs to earlier inputs for the same products (e.g. before a budget change). */
  stale: boolean;
  /** Planning time of the shown plan, in milliseconds (background plans only). */
  ms?: number;
  error?: string;
};

const sameProducts = (a: Opportunity[] | null, b: Opportunity[]) => !!a && a.length === b.length && a.every((item, i) => item.id === b[i].id);

/**
 * Plans synchronously for small portfolios (as before) and in a background Web Worker above
 * BACKGROUND_PLAN_THRESHOLD products. While a background plan is pending, the previous plan for the same
 * products stays on screen (marked stale); for a new set of products an empty placeholder is shown.
 * Pass `enabled = false` to skip planning (returns null).
 */
export function useBackgroundPlan(items: Opportunity[], budget: number, risk: number, options: PlanOptions, channel = 'plan', enabled = true): BackgroundPlan | null {
  const background = items.length > BACKGROUND_PLAN_THRESHOLD;
  const optionsKey = JSON.stringify(options);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- options are keyed by value
  const stableOptions = useMemo(() => options, [optionsKey]);
  const syncPlan = useMemo(() => (enabled && !background ? optimizePortfolio(items, budget, risk, stableOptions) : null), [enabled, background, items, budget, risk, stableOptions]);
  const [result, setResult] = useState<{ plan: OptimizedPlan; items: Opportunity[]; budget: number; risk: number; optionsKey: string; ms: number } | null>(null);
  const [failure, setFailure] = useState<{ items: Opportunity[]; message: string } | null>(null);
  useEffect(() => {
    if (!enabled || !background) return;
    let cancelled = false;
    runPlanJob<OptimizedPlan>({ kind: 'plan', items, budget, risk, options: stableOptions }, channel)
      .then(({ result: plan, ms }) => { if (!cancelled) { setResult({ plan, items, budget, risk, optionsKey: JSON.stringify(stableOptions), ms }); setFailure(null); } })
      .catch(error => { if (!cancelled && !(error instanceof SupersededError)) setFailure({ items, message: error instanceof Error ? error.message : 'Planning failed.' }); });
    return () => { cancelled = true; };
  }, [enabled, background, items, budget, risk, stableOptions, channel]);

  if (!enabled) return null;
  if (!background) return { plan: syncPlan!, pending: false, background: false, stale: false };
  const current = !!result && result.items === items && result.budget === budget && result.risk === risk && result.optionsKey === optionsKey;
  const usable = !!result && (current || sameProducts(result.items, items));
  return {
    plan: usable ? result!.plan : EMPTY_PLAN,
    pending: !current && !(failure && failure.items === items),
    background: true,
    stale: usable && !current,
    ms: usable ? result!.ms : undefined,
    error: failure && failure.items === items ? failure.message : undefined,
  };
}
