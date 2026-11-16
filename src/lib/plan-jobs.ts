import type { ModelRiskOptions } from './model-risk';
import type { Opportunity, PlanOptions } from './procurement-core';

/** Work the planning worker can do (src/lib/plan-worker.ts). */
export type PlanJob =
  | { kind: 'plan'; items: Opportunity[]; budget: number; risk: number; options: PlanOptions }
  | { kind: 'model-risk'; items: Opportunity[]; budget: number; risk: number; options: ModelRiskOptions };
export type PlanJobMessage = { id: number; job: PlanJob };
export type PlanJobReply = { id: number; ok: true; result: unknown; ms: number } | { id: number; ok: false; error: string };

/**
 * Portfolios above this many products are planned in the background worker; smaller ones are planned
 * synchronously (they take well under a second, and the demo then renders its plan immediately).
 */
export const BACKGROUND_PLAN_THRESHOLD = 30;
