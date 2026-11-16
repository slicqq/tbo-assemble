'use client';
import { optimizePortfolio } from './portfolio-optimizer';
import { checkModelRisk } from './model-risk';
import type { PlanJob, PlanJobReply } from './plan-jobs';

/** Rejection reason when a newer job on the same channel replaced this one. */
export class SupersededError extends Error {
  constructor() { super('Superseded by a newer request.'); this.name = 'SupersededError'; }
}

type Pending = { id: number; resolve: (value: { result: unknown; ms: number }) => void; reject: (reason: Error) => void };
type Channel = { worker: Worker | null; running: Pending | null };
const channels = new Map<string, Channel>();
let nextId = 1;

function createWorker(): Worker | null {
  if (typeof window === 'undefined' || typeof Worker === 'undefined') return null;
  try {
    return new Worker(new URL('./plan-worker.ts', import.meta.url), { type: 'module', name: 'inventory-planner' });
  } catch {
    return null;
  }
}

/** Same work on the main thread (browsers without module workers); deferred so the "planning" state can paint first. */
function runInline(job: PlanJob): Promise<{ result: unknown; ms: number }> {
  return new Promise((resolve, reject) => setTimeout(() => {
    const started = performance.now();
    try {
      const result = job.kind === 'plan' ? optimizePortfolio(job.items, job.budget, job.risk, job.options) : checkModelRisk(job.items, job.budget, job.risk, job.options);
      resolve({ result, ms: performance.now() - started });
    } catch (error) { reject(error instanceof Error ? error : new Error('Planning failed.')); }
  }, 30));
}

/**
 * Runs a planning job in a background Web Worker. One job runs per channel: a new job on the same channel
 * terminates the one in progress (its promise rejects with SupersededError), so rapid budget or risk changes
 * never queue up stale multi-second plans. Different channels (e.g. the plan and the model-risk check) run in parallel.
 */
export function runPlanJob<T>(job: PlanJob, channelName = 'plan'): Promise<{ result: T; ms: number }> {
  let channel = channels.get(channelName);
  if (!channel) { channel = { worker: null, running: null }; channels.set(channelName, channel); }
  if (channel.running) {
    channel.running.reject(new SupersededError());
    channel.running = null;
    channel.worker?.terminate();
    channel.worker = null;
  }
  if (!channel.worker) {
    channel.worker = createWorker();
    if (!channel.worker) return runInline(job) as Promise<{ result: T; ms: number }>;
    const owner = channel, worker = channel.worker;
    worker.onmessage = (event: MessageEvent<PlanJobReply>) => {
      // Reading event.data decodes the plan; the measure lets tests and the profiler see how long that takes.
      const decodeStart = performance.now(), reply = event.data, running = owner.running;
      performance.measure?.('plan-reply-decode', { start: decodeStart, end: performance.now() });
      if (!running || running.id !== reply.id) return;
      owner.running = null;
      if (reply.ok) running.resolve({ result: reply.result, ms: reply.ms });
      else running.reject(new Error(reply.error));
    };
    worker.onerror = (event: ErrorEvent) => {
      event.preventDefault();
      const running = owner.running;
      owner.running = null;
      worker.terminate();
      if (owner.worker === worker) owner.worker = null;
      // The worker could not start or crashed: run this job on the main thread instead.
      if (running) runInline(job).then(running.resolve, running.reject);
    };
  }
  const id = nextId++;
  return new Promise<{ result: T; ms: number }>((resolve, reject) => {
    channel.running = { id, resolve: resolve as Pending['resolve'], reject };
    channel.worker!.postMessage({ id, job });
  });
}
