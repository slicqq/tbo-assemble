/**
 * Web Worker that runs the planner off the main thread, so the workspace stays responsive while large
 * portfolios (hundreds or thousands of products) are planned. Loaded by src/lib/plan-client.ts with
 * `new Worker(new URL('./plan-worker.ts', import.meta.url))`; the same library code runs on the server.
 */
import { optimizePortfolio } from './portfolio-optimizer';
import { checkModelRisk } from './model-risk';
import type { PlanJob, PlanJobMessage, PlanJobReply } from './plan-jobs';

type WorkerScope = { postMessage(message: PlanJobReply): void; onmessage: ((event: MessageEvent<PlanJobMessage>) => void) | null };
const scope = self as unknown as WorkerScope;

function run(job: PlanJob): unknown {
  if (job.kind === 'plan') return optimizePortfolio(job.items, job.budget, job.risk, job.options);
  return checkModelRisk(job.items, job.budget, job.risk, job.options);
}

scope.onmessage = event => {
  const { id, job } = event.data;
  const started = performance.now();
  try {
    scope.postMessage({ id, ok: true, result: run(job), ms: performance.now() - started });
  } catch (error) {
    scope.postMessage({ id, ok: false, error: error instanceof Error ? error.message : 'Planning failed.' });
  }
};
