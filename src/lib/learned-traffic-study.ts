import { forecastFrom, type DemandHistoryPoint } from './learned-demand';

/**
 * Adds the planner's learned seasonal model as a fifth candidate to the DGCA route study
 * (public/research/statsforecast-study.json) without changing anything else:
 *  - same input snapshot (data/statsforecast/route-traffic-snapshot.json, the hash pinned by the study), routes,
 *    target months, actuals and two-month cutoffs as the four StatsForecast-study candidates;
 *  - each learned forecast uses only monthly traffic up to its cutoff (`forecastFrom` refits the planner's model);
 *  - the study's own selection rule, on the 2024–25 selection window only: a model candidate must beat the better of the
 *    two baselines by more than 5% MAE, otherwise that baseline is used. The policy is then scored on Feb–Sep 2026.
 * Data hygiene matches the planner: COVID months (Mar 2020 – Feb 2022), months the source marks ambiguous or lacks, and
 * months the base study imputed are left out of the learned model's fit (it never uses a value the others did not have).
 * Two other rules are reported for transparency: the planner's rule (learned vs same month last year) and plain
 * lowest-selection-MAE.
 */
export type MonthlyTraffic = { month: string; passengers: number | null; quality: string };
export type StudyRow = { month: string; actual: number | null; cutoff: string; imputedMonths?: string[]; predictions: Record<string, number | null> };
type StudyPart = { count: number; mae: Record<string, number | null> | null; rows: StudyRow[] };
export type BaseStudy = {
  snapshotSha256: string; selectionWindow: string; laterWindow: string; horizonMonths: number; methods: string[];
  routes: { origin: string; destination: string; selectedPolicy: string | null; selection: StudyPart; later: StudyPart }[];
};
export type TrafficSnapshot = { routes: { origin: string; destination: string; monthly: MonthlyTraffic[] }[] };

export const LEARNED_POLICY = 'learned-seasonal';
export const BASELINES = ['last-observed', 'last-year'] as const;
/** The study's margin and the planner's gate (learned-demand.ts GATE): beat the benchmark by more than 5% MAE. */
export const MARGIN = 0.95;
/** Indian domestic aviation shock: lockdown from 25 Mar 2020, capacity caps until 18 Oct 2021, Omicron in Jan–Feb 2022. */
export const DGCA_SHOCK = { from: '2020-03', to: '2022-02' } as const;

const monthIndex = (m: string) => Number(m.slice(0, 4)) * 12 + Number(m.slice(5, 7)) - 1;
const monthName = (i: number) => `${Math.floor(i / 12).toString().padStart(4, '0')}-${String((i % 12) + 1).padStart(2, '0')}`;

/** Consecutive monthly history; shock, ambiguous, missing and imputed months are flagged `exclude`. */
export function routeHistory(monthly: MonthlyTraffic[], imputed: Set<string>): DemandHistoryPoint[] {
  const byMonth = new Map(monthly.map(p => [p.month, p]));
  const months = monthly.map(p => monthIndex(p.month));
  const out: DemandHistoryPoint[] = [];
  for (let i = Math.min(...months); i <= Math.max(...months); i++) {
    const month = monthName(i), p = byMonth.get(month);
    const usable = !!p && p.quality === 'ok' && typeof p.passengers === 'number' && Number.isFinite(p.passengers);
    const exclude = !usable || imputed.has(month) || (month >= DGCA_SHOCK.from && month <= DGCA_SHOCK.to);
    out.push({ month, bookings: usable ? p!.passengers! : 0, ...(exclude ? { exclude: true } : {}) });
  }
  return out;
}

/** The base study's rule: best model candidate if it beats the better baseline by more than 5%, otherwise that baseline. */
export function studyRule(mae: Record<string, number>, candidates: string[]): string {
  const baseline = BASELINES.reduce((best, m) => (mae[m] < mae[best] ? m : best), BASELINES[0] as string);
  const candidate = candidates.reduce((best, m) => (mae[m] < mae[best] ? m : best), candidates[0]);
  return mae[candidate] < MARGIN * mae[baseline] ? candidate : baseline;
}

export type LearnedRouteResult = {
  origin: string; destination: string;
  /** The base study's selection (four candidates). */
  baseSelectedPolicy: string | null;
  /** The base study's rule re-applied to its four candidates (must equal baseSelectedPolicy). */
  reproducedBasePolicy: string;
  /** The base study's rule with the learned model added as a candidate: the primary result. */
  selectedPolicy: string;
  /** The planner's rule: learned model if it beats "same month last year" by more than 5%, otherwise that baseline. */
  plannerPolicy: string;
  /** Lowest selection-window MAE among all five methods. */
  minMaePolicy: string;
  selection: { count: number; mae: Record<string, number> };
  later: { count: number; mae: Record<string, number> };
  rows: { part: 'selection' | 'later'; month: string; cutoff: string; actual: number; learned: number }[];
};

export function runLearnedTrafficStudy(base: BaseStudy, snapshot: TrafficSnapshot) {
  const methods = [...base.methods, LEARNED_POLICY];
  const modelCandidates = base.methods.filter(m => !(BASELINES as readonly string[]).includes(m));
  const routes: LearnedRouteResult[] = base.routes.map(route => {
    const key = `${route.origin}-${route.destination}`;
    const source = snapshot.routes.find(r => r.origin === route.origin && r.destination === route.destination);
    if (!source) throw new Error(`No snapshot for ${key}`);
    const imputed = new Set([...route.selection.rows, ...route.later.rows].flatMap(r => r.imputedMonths ?? []));
    const history = routeHistory(source.monthly, imputed);
    const rows: LearnedRouteResult['rows'] = [];
    const score = (part: 'selection' | 'later', p: StudyPart) => {
      // Months every base method could score, exactly the study's own MAE sample.
      const scored = p.rows.filter(r => r.actual !== null && base.methods.every(m => typeof r.predictions[m] === 'number'));
      const mae: Record<string, number> = {};
      for (const m of base.methods) mae[m] = scored.reduce((s, r) => s + Math.abs(r.predictions[m]! - r.actual!), 0) / scored.length;
      let sum = 0;
      for (const r of scored) {
        const learned = forecastFrom(history, r.cutoff, monthIndex(r.month) - monthIndex(r.cutoff), 'Flight');
        if (learned === null) throw new Error(`${key} ${r.month}: learned model could not be fitted at cutoff ${r.cutoff}`);
        rows.push({ part, month: r.month, cutoff: r.cutoff, actual: r.actual!, learned });
        sum += Math.abs(learned - r.actual!);
      }
      mae[LEARNED_POLICY] = sum / scored.length;
      return { count: scored.length, mae };
    };
    const selection = score('selection', route.selection), later = score('later', route.later);
    // Every rule sees the selection window only.
    return {
      origin: route.origin, destination: route.destination, baseSelectedPolicy: route.selectedPolicy,
      reproducedBasePolicy: studyRule(selection.mae, modelCandidates),
      selectedPolicy: studyRule(selection.mae, [...modelCandidates, LEARNED_POLICY]),
      plannerPolicy: selection.mae[LEARNED_POLICY] < MARGIN * selection.mae['last-year'] ? LEARNED_POLICY : 'last-year',
      minMaePolicy: methods.reduce((best, m) => (selection.mae[m] < selection.mae[best] ? m : best), methods[0]),
      selection, later, rows,
    };
  });
  const beats = (policy: (r: LearnedRouteResult) => string | null) =>
    routes.filter(r => { const p = policy(r); return !!p && p !== 'last-observed' && r.later.mae[p] < r.later.mae['last-observed']; }).length;
  return {
    schema: 'learned-traffic-study-v1',
    baseStudy: { file: 'public/research/statsforecast-study.json', snapshotSha256: base.snapshotSha256, selectionWindow: base.selectionWindow, laterWindow: base.laterWindow, horizonMonths: base.horizonMonths },
    model: 'src/lib/learned-demand.ts forecastFrom: Huber-weighted log-linear fit (month-of-year effects + trend) on the latest 48 usable months, median year-on-year growth, median-of-3 anchor; COVID, ambiguous, missing and imputed months excluded',
    rule: 'Base study rule, unchanged: best model candidate if its selection MAE is more than 5% below the better baseline (last observed, same month last year), else that baseline. Selection 2024–25 only; scored Feb–Sep 2026.',
    methods,
    routes,
    summary: {
      routes: routes.length,
      selectedBeatsLastObserved: beats(r => r.selectedPolicy),
      baseSelectedBeatsLastObserved: beats(r => r.baseSelectedPolicy),
      plannerRuleBeatsLastObserved: beats(r => r.plannerPolicy),
      minMaeRuleBeatsLastObserved: beats(r => r.minMaePolicy),
      learnedSelected: routes.filter(r => r.selectedPolicy === LEARNED_POLICY).length,
      learnedBeatsLastObservedLater: routes.filter(r => r.later.mae[LEARNED_POLICY] < r.later.mae['last-observed']).length,
      learnedBestLater: routes.filter(r => methods.every(m => r.later.mae[LEARNED_POLICY] <= r.later.mae[m])).length,
    },
  };
}
