'use client';
import { ShieldAlert } from 'lucide-react';
import type { OptimizedPlan } from '@/lib/portfolio-optimizer';
import { RISK_ASSUMPTIONS } from '@/lib/risk-scenarios';

const money = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
const compact = (n: number) => (Math.abs(n) >= 1e7 ? `${n < 0 ? '−' : ''}₹${(Math.abs(n) / 1e7).toFixed(2)} Cr` : Math.abs(n) >= 1e5 ? `${n < 0 ? '−' : ''}₹${(Math.abs(n) / 1e5).toFixed(1)}L` : money(n));
const pct = (n: number, digits = 1) => `${(n * 100).toFixed(digits)}%`;
/** Profit (E) and worst-10% (CVaR) cost of an availability target, worded by sign. */
const costText = (expectedCost: number, cvarCost: number) => {
  const tail = `average profit in the worst 10% of seasons ${cvarCost > 0 ? `falls by ${compact(cvarCost)}` : cvarCost < 0 ? `rises by ${compact(-cvarCost)}` : 'is unchanged'}`;
  if (expectedCost > 0) return `Cost: ${compact(expectedCost)} of expected profit, and ${tail}.`;
  const mean = expectedCost < 0 ? `Expected profit rises by ${compact(-expectedCost)}` : 'Expected profit is unchanged';
  return cvarCost > 0 ? `${mean}, but ${tail} — more stock means more downside.` : `${mean}, and ${tail}.`;
};

const AVAILABILITY_TARGETS = [0, 0.85, 0.9, 0.95] as const;

/** Out-of-sample season-profit distribution, same-scenario comparison with the legacy plan, and the availability target. */
export default function RiskProfile({ plan, target = 0, onTarget, pending = false }: { plan: OptimizedPlan; target?: number; onTarget?: (target: number) => void; pending?: boolean }) {
  const r = plan.risk;
  if (!r || !r.histogram.length) return null;
  const bins = r.histogram, max = Math.max(1, ...bins.map(b => b.count));
  const W = 560, H = 168, L = 8, R = 8, T = 22, B = 30;
  const x0 = bins[0].from, x1 = bins[bins.length - 1].to, span = x1 - x0 || 1;
  const sx = (v: number) => L + ((v - x0) / span) * (W - L - R);
  const bw = (W - L - R) / bins.length;
  const legacy = r.legacy;
  const gapShare = Math.abs(plan.objective) > 0 ? plan.gap / Math.abs(plan.objective) : 0;
  const service = plan.service;
  const serviceText = !service || service.status === 'off' ? null
    : service.status === 'not-binding' ? `Target ${pct(service.target, 0)} is already met without changing the plan (serves ${pct(service.servedShare)}).`
    : service.status === 'met' ? `Target ${pct(service.target, 0)} met: the plan serves ${pct(service.servedShare)} of modelled demand (${pct(service.servedShareWithoutTarget)} without the target). ${costText(service.expectedProfitCost, service.cvarCost)} Implied value: ${money(service.serviceValue)} per extra booking served.`
    : `Target ${pct(service.target, 0)} is out of reach with this budget and supplier capacity (about ${pct(service.maxServedShare ?? service.servedShare)} at most). The plan is unchanged; raise the budget or connect more supply (see Coverage).`;
  const rows: { label: string; v5: string; v4?: string; better?: boolean }[] = [
    { label: 'Expected season profit', v5: compact(r.expectedProfit), v4: legacy && compact(legacy.expectedProfit), better: legacy && r.expectedProfit >= legacy.expectedProfit },
    { label: 'Worst 10% of seasons (CVaR)', v5: compact(r.cvar), v4: legacy && compact(legacy.cvar), better: legacy && r.cvar >= legacy.cvar },
    { label: 'Chance of a loss', v5: pct(r.pLoss), v4: legacy && pct(legacy.pLoss), better: legacy && r.pLoss <= legacy.pLoss },
    { label: 'Modelled demand served', v5: pct(r.servedShare, 0), v4: legacy && pct(legacy.servedShare, 0), better: legacy && r.servedShare >= legacy.servedShare },
    { label: 'Capital at risk', v5: compact(r.spend), v4: legacy && compact(legacy.spend) },
  ];
  return (
    <section className="panel risk-profile" aria-labelledby="risk-profile-title">
      <div className="panel-head">
        <div>
          <div className="title-line"><h2 id="risk-profile-title">Season risk profile</h2><span className="tag">OUT-OF-SAMPLE · {r.evaluationCount.toLocaleString('en-IN')} SCENARIOS</span></div>
          <p>Profit of the whole plan across correlated seasons, including regional and market-wide shocks. Red bars are the worst 10% of seasons.</p>
        </div>
        <div className="mini-icon"><ShieldAlert size={16} /></div>
      </div>
      <div className="risk-profile-grid">
        <figure className="risk-histogram">
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Season profit distribution: expected ${compact(r.expectedProfit)}, worst 10% average ${compact(r.cvar)}, loss probability ${pct(r.pLoss)}`}>
            {bins.map((b, i) => {
              const h = (b.count / max) * (H - T - B);
              return <rect key={i} x={L + i * bw + 1} y={H - B - h} width={Math.max(1, bw - 2)} height={h} rx={1.5} className={b.tail ? 'bar tail' : 'bar'} />;
            })}
            {x0 < 0 && x1 > 0 && <g><line x1={sx(0)} x2={sx(0)} y1={T - 4} y2={H - B} className="zero" /><text x={sx(0) + 4} y={T + 4} className="lbl">break-even</text></g>}
            <line x1={sx(r.cvar)} x2={sx(r.cvar)} y1={T + 8} y2={H - B} className="cvar" />
            <text x={sx(r.cvar) - 4} y={T + 2} textAnchor="end" className="lbl cvar-lbl">CVaR {compact(r.cvar)}</text>
            <line x1={sx(r.expectedProfit)} x2={sx(r.expectedProfit)} y1={T - 8} y2={H - B} className="mean" />
            <text x={sx(r.expectedProfit) + 4} y={T - 10} className="lbl mean-lbl">Expected {compact(r.expectedProfit)}</text>
            <line x1={L} x2={W - R} y1={H - B} y2={H - B} className="axis" />
            {[x0, (x0 + x1) / 2, x1].map((v, i) => <text key={i} x={sx(v)} y={H - B + 16} textAnchor={i === 0 ? 'start' : i === 2 ? 'end' : 'middle'} className="tick">{compact(v)}</text>)}
          </svg>
          <figcaption>Optimised on {r.scenarioCount.toLocaleString('en-IN')} seasons, scored on {r.evaluationCount.toLocaleString('en-IN')} different seasons. Same-region demand correlation {(RISK_ASSUMPTIONS.globalWeight + RISK_ASSUMPTIONS.regionWeight).toFixed(2)}; regional shocks {pct(RISK_ASSUMPTIONS.regionalShockProbability, 0)} and market-wide shocks {pct(RISK_ASSUMPTIONS.globalShockProbability, 0)} per season (assumptions).</figcaption>
        </figure>
        <div className="risk-compare">
          <table>
            <thead><tr><th scope="col">Same scenarios</th><th scope="col">Risk engine (v5)</th>{legacy && <th scope="col">Legacy grid plan (v4)</th>}</tr></thead>
            <tbody>{rows.map(row => <tr key={row.label}><th scope="row">{row.label}</th><td className={row.better ? 'better' : ''}>{row.v5}</td>{legacy && <td>{row.v4}</td>}</tr>)}</tbody>
          </table>
          {onTarget && (
            <div className="risk-target">
              <label htmlFor="availability-target">Availability target <span>serve at least this share of modelled demand</span></label>
              <select id="availability-target" value={String(target)} onChange={e => onTarget(Number(e.target.value))}>
                {AVAILABILITY_TARGETS.map(t => <option key={t} value={String(t)}>{t === 0 ? 'Off — maximise risk-adjusted profit' : `At least ${pct(t, 0)} of demand`}</option>)}
              </select>
              {pending ? <p className="risk-target-status" role="status">Re-planning…</p> : serviceText && <p className={`risk-target-status ${service?.status ?? ''}`} role="status">{serviceText}</p>}
            </div>
          )}
          <p className="risk-gap"><strong>Optimality check:</strong> {gapShare < 0.0005 ? 'less than 0.05%' : pct(gapShare, gapShare < 0.01 ? 2 : 1)} below a proven upper bound on the best achievable plan for this model ({money(plan.upperBound)}){plan.pricing === 'joint' ? ', with selling prices chosen together with quantities' : ''}{service && service.serviceValue > 0 ? '; objective includes the availability value' : ''}.</p>
          <p className="risk-note">{r.prepaidUnits.toLocaleString('en-IN')} pre-paid and {r.allotmentUnits.toLocaleString('en-IN')} allotment units. Demand served counts existing stock plus new units ({pct(r.servedShareBefore, 0)} with existing stock only). Results are model estimates on the loaded inputs, not forecasts of actual profit.</p>
        </div>
      </div>
    </section>
  );
}
