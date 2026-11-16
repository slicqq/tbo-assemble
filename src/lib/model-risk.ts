import type { Opportunity, PlanOptions, PlanRow } from './procurement-core';
import { optimizePortfolio } from './portfolio-optimizer';
import { evaluateDecisions, optimizePortfolioRisk, type Decision, type RiskMetrics } from './risk-optimizer';
import type { ScenarioAssumptions } from './risk-scenarios';

/**
 * Model-risk check ("mismatched worlds").
 *
 * Every plan is optimised under the planning assumptions in risk-scenarios.ts. This check keeps the
 * decisions fixed and scores them in worlds where those assumptions are wrong: demand forecast too high
 * or too low, lower selling prices, more cancellations, more volatility, destinations moving together,
 * more frequent shocks, and a combined bad case. All worlds reuse the same random draws (common random
 * numbers), so differences come from the assumption change, not from sampling noise.
 *
 * Regret is measured against an "oracle" plan re-optimised with perfect knowledge of the world (same
 * budget and risk setting, no availability target). It answers: how much risk-adjusted profit does the
 * plan give up because the assumptions were wrong? Synthetic worlds; they test robustness of the method,
 * not the accuracy of TBO's real demand.
 */

export type ModelRiskWorld = { id: string; label: string; description: string; overrides: Partial<ScenarioAssumptions> };

export const MODEL_RISK_WORLDS: readonly ModelRiskWorld[] = [
  { id: 'planned', label: 'As planned', description: 'The planning assumptions are right.', overrides: {} },
  { id: 'demand-low', label: 'Demand 15% below forecast', description: 'Every product sells 15% less than forecast (e.g. a soft season).', overrides: { demandBias: 0.85 } },
  { id: 'demand-high', label: 'Demand 15% above forecast', description: 'Every product sells 15% more than forecast; under-buying is the risk.', overrides: { demandBias: 1.15 } },
  { id: 'price-low', label: 'Selling prices 5% lower', description: 'Competitor or rate-parity pressure cuts achievable prices by 5%.', overrides: { priceBias: 0.95 } },
  { id: 'cancellations', label: 'Cancellations ×1.5', description: 'Cancellation rates are 50% higher than supplied.', overrides: { cancellationMultiplier: 1.5 } },
  { id: 'volatile', label: 'Demand 1.5× more volatile', description: 'Season-to-season swings are 50% larger than assumed.', overrides: { volatilityMultiplier: 1.5 } },
  { id: 'correlated', label: 'Destinations move together', description: 'Same-region correlation 0.80 and cross-region 0.40 (planned: 0.50 / 0.15).', overrides: { globalWeight: 0.4, regionWeight: 0.4 } },
  { id: 'shocks', label: 'Shocks 3× as likely', description: 'Regional shocks 12% and market-wide shocks 6% per season (planned: 4% / 2%).', overrides: { regionalShockProbability: 0.12, globalShockProbability: 0.06 } },
  {
    id: 'combined', label: 'Several things wrong at once',
    description: 'Demand −10%, prices −3%, cancellations ×1.25, volatility ×1.25, stronger correlation and shocks twice as likely.',
    overrides: { demandBias: 0.9, priceBias: 0.97, cancellationMultiplier: 1.25, volatilityMultiplier: 1.25, globalWeight: 0.3, regionWeight: 0.4, regionalShockProbability: 0.08, globalShockProbability: 0.04 },
  },
];

export type PlanInWorld = RiskMetrics & {
  /** Risk-adjusted objective (1 − r)·E[profit] + r·CVaR10 on the world's out-of-sample scenarios. */
  objective: number;
  /** Oracle objective minus this plan's objective (≥ 0 up to sampling noise); undefined without an oracle. */
  regret?: number;
};
export type WorldResult = {
  world: ModelRiskWorld;
  plan: PlanInWorld;
  legacy: PlanInWorld;
  oracle?: { objective: number; expectedProfit: number; cvar: number; servedShare: number };
};
export type ModelRiskReport = {
  budget: number; risk: number; worlds: WorldResult[];
  summary: {
    worstPlan: { worldId: string; label: string; objective: number };
    worstLegacy: { worldId: string; label: string; objective: number };
    /** Worlds in which the risk-cvar-v5 plan has the higher risk-adjusted objective / CVaR10 than scenario-grid-v4. */
    planBetterObjective: number; planBetterCvar: number;
    maxRegretPlan?: number; maxRegretLegacy?: number; meanRegretPlan?: number; meanRegretLegacy?: number;
  };
};

export type ModelRiskOptions = PlanOptions & {
  /** Decisions to test (risk-cvar-v5 rows). Re-planned with the same options when omitted. */
  planRows?: PlanRow[];
  /** scenario-grid-v4 rows to compare against. Re-planned when omitted. */
  legacyRows?: PlanRow[];
  worlds?: readonly ModelRiskWorld[];
  /** Re-optimise inside every world to measure regret (default true; costs one optimisation per world). */
  oracle?: boolean;
};

function decisionsFrom(items: Opportunity[], rows: PlanRow[], allotments: boolean): Decision[] {
  const byId = new Map(rows.map(row => [row.id, row]));
  return items.map((item, i) => {
    const row = byId.get(item.id) ?? rows[i];
    if (!row) return { prepaid: 0, allotment: 0, price: item.referencePrice };
    const prepaid = allotments ? (row.prepaidQty ?? row.qty) : row.qty;
    return { prepaid: Math.max(0, Math.floor(prepaid)), allotment: allotments ? Math.max(0, Math.floor(row.allotQty ?? 0)) : 0, price: row.price };
  });
}

export function checkModelRisk(items: Opportunity[], budget: number, risk: number, options: ModelRiskOptions = {}): ModelRiskReport {
  const r = Math.min(1, Math.max(0, Number.isFinite(risk) ? risk : 0));
  const { planRows, legacyRows, worlds = MODEL_RISK_WORLDS, oracle = true, ...planOptions } = options;
  const base = { asOf: planOptions.asOf, scenarioCount: planOptions.scenarioCount, evaluationCount: planOptions.evaluationCount, seed: planOptions.seed };
  const plan = decisionsFrom(items, planRows ?? optimizePortfolioRisk(items, budget, r, planOptions).rows, true);
  const legacy = decisionsFrom(items, legacyRows ?? optimizePortfolio(items, budget, r, { asOf: planOptions.asOf, engine: 'scenario-grid-v4' }).rows, false);
  const objectiveOf = (m: RiskMetrics) => (1 - r) * m.expectedProfit + r * m.cvar;

  const results: WorldResult[] = worlds.map(world => {
    const options = { ...base, scenarioOverrides: world.overrides };
    const planMetrics = evaluateDecisions(items, plan, r, options).metrics;
    const legacyMetrics = evaluateDecisions(items, legacy, r, options).metrics;
    const result: WorldResult = { world, plan: { ...planMetrics, objective: objectiveOf(planMetrics) }, legacy: { ...legacyMetrics, objective: objectiveOf(legacyMetrics) } };
    if (oracle && items.length) {
      const best = optimizePortfolioRisk(items, budget, r, { ...options, jointPricing: planOptions.jointPricing }).risk;
      const objective = objectiveOf(best);
      result.oracle = { objective, expectedProfit: best.expectedProfit, cvar: best.cvar, servedShare: best.servedShare };
      result.plan.regret = objective - result.plan.objective;
      result.legacy.regret = objective - result.legacy.objective;
    }
    return result;
  });

  const worst = (pick: (w: WorldResult) => PlanInWorld) => results.reduce((a, b) => (pick(b).objective < pick(a).objective ? b : a), results[0]);
  const worstPlan = worst(w => w.plan), worstLegacy = worst(w => w.legacy);
  const regrets = (pick: (w: WorldResult) => PlanInWorld) => results.map(w => pick(w).regret).filter((x): x is number => x !== undefined);
  const planRegrets = regrets(w => w.plan), legacyRegrets = regrets(w => w.legacy);
  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : undefined);
  return {
    budget, risk: r, worlds: results,
    summary: {
      worstPlan: { worldId: worstPlan?.world.id ?? '', label: worstPlan?.world.label ?? '', objective: worstPlan?.plan.objective ?? 0 },
      worstLegacy: { worldId: worstLegacy?.world.id ?? '', label: worstLegacy?.world.label ?? '', objective: worstLegacy?.legacy.objective ?? 0 },
      planBetterObjective: results.filter(w => w.plan.objective >= w.legacy.objective).length,
      planBetterCvar: results.filter(w => w.plan.cvar >= w.legacy.cvar).length,
      maxRegretPlan: planRegrets.length ? Math.max(...planRegrets) : undefined,
      maxRegretLegacy: legacyRegrets.length ? Math.max(...legacyRegrets) : undefined,
      meanRegretPlan: mean(planRegrets), meanRegretLegacy: mean(legacyRegrets),
    },
  };
}
