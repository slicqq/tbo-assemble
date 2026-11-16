'use client';
import { useState } from 'react';
import { FlaskConical } from 'lucide-react';
import { checkModelRisk, MODEL_RISK_WORLDS, type ModelRiskReport, type PlanInWorld } from '@/lib/model-risk';
import type { Opportunity, PlanEngine, PlanRow } from '@/lib/procurement-core';

const compact = (n: number) => `${n < 0 ? '−' : ''}₹${(Math.abs(n) / 1e5).toFixed(2)}L`;
const signature = (engine: PlanEngine, budget: number, risk: number, asOf: string, rows: PlanRow[]) =>
  JSON.stringify([engine, budget, risk, asOf, rows.map(r => [r.id, r.prepaidQty ?? r.qty, r.allotQty ?? 0, r.price])]);

/**
 * Mismatched-world robustness check: keeps today's decisions fixed and scores them in worlds where the
 * planning assumptions are wrong, against the legacy plan and a plan re-optimised with hindsight.
 */
export default function ModelRiskCheck({ items, rows, budget, risk, asOf, engine }: { items: Opportunity[]; rows: PlanRow[]; budget: number; risk: number; asOf: string; engine: PlanEngine }) {
  const key = signature(engine, budget, risk, asOf, rows);
  const [saved, setSaved] = useState<{ key: string; report: ModelRiskReport } | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const report = saved?.key === key ? saved.report : null;
  const stale = saved !== null && saved.key !== key;

  function run() {
    setRunning(true);
    setError('');
    // Let the "Running…" state paint before the synchronous optimisations start.
    window.setTimeout(() => {
      try {
        const result = checkModelRisk(items, budget, risk, { asOf, ...(engine === 'risk-cvar-v5' ? { planRows: rows } : { legacyRows: rows }) });
        setSaved({ key, report: result });
      } catch (e) {
        setError(e instanceof Error ? e.message : 'The model-risk check failed.');
      } finally {
        setRunning(false);
      }
    }, 30);
  }

  const cell = (p: PlanInWorld, better: boolean) => <td className={better ? 'better' : ''}>{compact(p.objective)}</td>;
  const s = report?.summary;
  return (
    <section className="panel model-risk-panel" aria-labelledby="model-risk-title">
      <div className="coverage-head">
        <div className="control-icon"><FlaskConical size={18} /></div>
        <div>
          <h2 id="model-risk-title">Model-risk check: what if our assumptions are wrong?</h2>
          <p>Keeps today&apos;s decisions fixed and scores them in {MODEL_RISK_WORLDS.length} worlds the plan did not assume — demand off by ±15%, lower prices, more cancellations, more volatility, destinations moving together, more shocks, and all of these at once. Each world is compared with the legacy grid plan (v4) and with a plan re-optimised with hindsight.</p>
        </div>
      </div>
      <div className="model-risk-actions">
        <button type="button" className="outline-button" onClick={run} disabled={running || !items.length}>{running ? 'Running… (about 5 seconds)' : report ? 'Run again' : 'Run model-risk check'}</button>
        <span>{stale ? 'Settings changed since the last run — run again to refresh.' : `Risk-adjusted result = (1 − r)·expected profit + r·worst-10% average, with r = ${risk.toFixed(2)}. Same random seasons in every world.`}</span>
      </div>
      {error && <p className="coverage-alert" role="alert">{error}</p>}
      {report && s && (
        <>
          <div className="model-risk-summary" role="status">
            <div><span>Risk engine (v5) ahead</span><strong>{s.planBetterObjective} of {report.worlds.length} worlds</strong><small>Higher worst-10% average in {s.planBetterCvar} of {report.worlds.length}</small></div>
            <div><span>Worst world for v5</span><strong>{compact(s.worstPlan.objective)}</strong><small>{s.worstPlan.label} · v4 worst {compact(s.worstLegacy.objective)}</small></div>
            {s.meanRegretPlan !== undefined && s.meanRegretLegacy !== undefined && <div><span>Average regret vs hindsight</span><strong>{compact(s.meanRegretPlan)}</strong><small>v4 {compact(s.meanRegretLegacy)} · largest v5 regret {compact(s.maxRegretPlan ?? 0)}</small></div>}
          </div>
          <div className="coverage-table-wrap">
            <table>
              <thead><tr><th>World</th><th>v5 risk-adjusted</th><th>v5 worst 10%</th><th>v5 regret</th><th>v4 risk-adjusted</th><th>v4 worst 10%</th><th>v4 regret</th></tr></thead>
              <tbody>
                {report.worlds.map(w => (
                  <tr key={w.world.id}>
                    <td><strong>{w.world.label}</strong><small>{w.world.description}</small></td>
                    {cell(w.plan, w.plan.objective >= w.legacy.objective)}
                    <td>{compact(w.plan.cvar)}</td>
                    <td>{w.plan.regret === undefined ? '—' : compact(Math.max(0, w.plan.regret))}</td>
                    {cell(w.legacy, w.legacy.objective > w.plan.objective)}
                    <td>{compact(w.legacy.cvar)}</td>
                    <td>{w.legacy.regret === undefined ? '—' : compact(Math.max(0, w.legacy.regret))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="coverage-foot"><strong>How to read it:</strong> regret is the risk-adjusted profit given up versus a plan re-optimised knowing the world in advance (same budget and risk setting, no availability target); small negative values from sampling noise show as ₹0. The worlds are synthetic stress tests of the method, not forecasts. {engine === 'risk-cvar-v5' && rows.some(r => (r.serviceTarget ?? 0) > 0) ? 'The current plan has an availability target, so its regret includes the deliberate cost of that target.' : ''}</p>
        </>
      )}
    </section>
  );
}
