export * from './procurement-core';
import { optimizePortfolio } from './portfolio-optimizer';
import type { Opportunity, PlanOptions, PlanRow } from './procurement-core';

/** The modeled allocation is an approximation, not a real-world optimum. */
export function createPlan(items:Opportunity[],budget:number,risk:number,options:PlanOptions={}):PlanRow[]{
 return optimizePortfolio(items,budget,risk,options).rows;
}
