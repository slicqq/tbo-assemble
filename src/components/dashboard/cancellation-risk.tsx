'use client';

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowDownToLine, ArrowUpRight, BarChart3, RefreshCw, ShieldAlert, TrendingDown, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FeatureHeader, FeatureMetric, FeatureNotice } from '@/components/dashboard/feature-ui';
import { ComparisonBars, VisualCard } from '@/components/dashboard/data-visuals';
import { csvTemplate, readInventoryCSV } from '@/lib/inventory-csv';
import { createRiskView } from '@/lib/cancellation-risk';
import { opportunities, type Opportunity } from '@/lib/procurement';

const money = (value: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);
const number = (value: number) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 1 }).format(value);
const card = 'rounded-2xl border bg-card p-5';
const label = 'text-[11px] font-semibold uppercase tracking-[.12em] text-muted-foreground';
const input = 'mt-2 h-10 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground outline-none focus:border-foreground focus:ring-2 focus:ring-foreground/10';

export default function CancellationRisk() {
  const [items, setItems] = useState<Opportunity[]>(opportunities);
  const [fileName, setFileName] = useState('');
  const [budgetText, setBudgetText] = useState('5000000');
  const [budget, setBudget] = useState(5000000);
  const [risk, setRisk] = useState(0.35);
  const [uplift, setUplift] = useState(0);
  const [asOf, setAsOf] = useState(() => new Date().toISOString().slice(0, 10));
  const [error, setError] = useState('');
  const file = useRef<HTMLInputElement>(null);
  const view = useMemo(() => createRiskView(items, budget, risk, asOf, uplift / 100), [items, budget, risk, asOf, uplift]);
  const rows = [...view.rows].sort((a, b) => b.unsoldExposure - a.unsoldExposure);
  const maxExposure = Math.max(0, ...rows.map(row => row.unsoldExposure));
  const active = rows.filter(row => row.qty > 0).length;
  const unallocated = rows.length - active;
  function applyBudget() {
    const amount = Number(budgetText);
    if (!budgetText.trim() || !Number.isFinite(amount) || amount < 0 || amount > 1000000000) { setError('Enter a budget between ₹0 and ₹1,00,00,00,000.'); return; }
    setBudget(Math.floor(amount)); setError('');
  }
  async function upload(f?: File) {
    if (!f) return;
    try { if (f.size > 500000) throw new Error('File must be smaller than 500 KB.'); const parsed = readInventoryCSV(await f.text()); setItems(parsed); setFileName(f.name); setError(''); }
    catch (e) { setError((e instanceof Error ? e.message : 'Could not read CSV.') + ' Previous inputs were retained.'); }
    finally { if (file.current) file.current.value = ''; }
  }
  function downloadTemplate() {
    const link = document.createElement('a'); const url = URL.createObjectURL(new Blob([csvTemplate], { type: 'text/csv;charset=utf-8' }));
    link.href = url; link.download = 'inventory-input-template.csv'; link.click(); URL.revokeObjectURL(url);
  }
  return <div className="mx-auto max-w-6xl pb-12">
    <FeatureHeader title="Cancellation & risk" description="Explore cancellation and unsold inventory scenarios" status={fileName?'Imported inputs':'Synthetic example'}/>
    <FeatureNotice><strong className="text-foreground">{fileName?'Imported inputs.':'Synthetic demo data.'}</strong> These are modeled estimates, not actual cancellations, guaranteed losses or supplier availability. The model is not calibrated or backtested for this portfolio.</FeatureNotice>
    <section className={`${card} mt-6`} aria-labelledby="risk-input-title"><div className="flex flex-wrap items-start justify-between gap-4"><div><h2 id="risk-input-title" className="font-display text-xl font-bold">Your inventory inputs</h2><p className="mt-1 text-sm text-muted-foreground">{fileName ? `${fileName} · ${items.length} imported opportunities` : `${items.length} synthetic opportunities · hotel and flight examples`}. CSV files stay in your browser.</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={downloadTemplate}><ArrowDownToLine /> Template</Button><Button size="sm" onClick={() => file.current?.click()}><Upload /> Upload CSV</Button><input ref={file} type="file" accept=".csv,text/csv" hidden onChange={e => upload(e.target.files?.[0])} />{fileName && <Button variant="secondary" size="sm" onClick={() => { setItems(opportunities); setFileName(''); setError(''); }}><RefreshCw /> Restore demo</Button>}</div></div><p className="mt-3 text-xs text-muted-foreground">Use the inventory template; cancellation, recovery and volatility fields are fractions between 0 and 1. <a className="font-semibold underline underline-offset-4" href="/research/inventory-input.md" target="_blank" rel="noreferrer">Input guide <ArrowUpRight className="inline size-3" /></a></p></section>
    <section className={`${card} mt-4`} aria-labelledby="settings-title"><div className="flex items-center gap-2"><BarChart3 className="size-4" /><h2 id="settings-title" className="font-display text-xl font-bold">Explore a scenario</h2></div><p className="mt-1 text-sm text-muted-foreground">Changes recalculate the allocation and risk estimates; nothing is purchased.</p><div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-4"><div><label className={label} htmlFor="risk-budget">Maximum budget · INR</label><div className="flex gap-2"><input id="risk-budget" type="number" min="0" max="1000000000" className={input} value={budgetText} onChange={e => setBudgetText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') applyBudget(); }} /><Button variant="secondary" className="mt-2 h-10" onClick={applyBudget}>Apply</Button></div></div><div><label className={label} htmlFor="risk-date">Quote review date · UTC</label><input id="risk-date" type="date" className={input} value={asOf} onChange={e => { if (e.target.value) setAsOf(e.target.value); }} /></div><div><label className={label} htmlFor="cancellation-uplift">Cancellation uplift · +{uplift} pp</label><input id="cancellation-uplift" type="range" min="0" max="30" step="1" value={uplift} onChange={e => setUplift(Number(e.target.value))} className="mt-4 w-full accent-foreground" /><p className="mt-1 text-xs text-muted-foreground">Added to each input rate, capped at 100%.</p></div><div><label className={label} htmlFor="risk-penalty">Downside penalty · {Math.round(risk * 100)}%</label><input id="risk-penalty" type="range" min="0" max="0.8" step="0.05" value={risk} onChange={e => setRisk(Number(e.target.value))} className="mt-4 w-full accent-foreground" /><p className="mt-1 text-xs text-muted-foreground">Higher values prioritize low-scenario results.</p></div></div>{error && <p role="alert" className="mt-4 text-sm text-red-600">{error}</p>}</section>
    <div className="mt-8 flex flex-wrap items-end justify-between gap-2"><div><h2 className="font-display text-2xl font-bold">Portfolio snapshot</h2><p className="mt-1 text-sm text-muted-foreground">Illustrative outcomes for the current assumptions.</p></div><p className="text-xs text-muted-foreground">Allocation: {money(view.spend)} of {money(budget)}</p></div>
    <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric icon={<ShieldAlert className="size-4 text-orange-600" />} label="Modeled cancellations" value={number(view.modeledCancellations)} detail="Before price adjustment and stock deduction" /><Metric icon={<AlertTriangle className="size-4 text-amber-600" />} label="Expected unsold units" value={number(view.expectedUnsold)} detail="Across newly allocated units only" /><Metric icon={<TrendingDown className="size-4 text-red-600" />} label="Expected unsold exposure" value={money(view.unsoldExposure)} detail="Purchase cost less assumed recovery" /><Metric icon={<BarChart3 className="size-4 text-violet-600" />} label="Low-scenario profit" value={money(view.downsideProfit)} detail="Not a worst-case loss or guarantee" /></div>
    <div className="mt-4 rounded-xl bg-surface/70 px-4 py-3 text-xs leading-relaxed text-muted-foreground">The modeled cancellation total applies each assumed rate to gross modeled demand before price effects. It is not a count of real cancelled bookings. Unsold exposure concerns new allocation only and is not an additional charge to subtract from displayed profit.</div>
    <div className="mt-6 grid gap-4 lg:grid-cols-2">
      <VisualCard title="Budget allocation" description="Illustrative allocation under the current scenario">
        <div className="mt-5 flex items-end justify-between gap-3"><div><p className="text-2xl font-semibold tabular-nums">{money(view.spend)}</p><p className="mt-1 text-xs text-muted-foreground">Allocated of {money(budget)}</p></div><span className="text-sm font-semibold tabular-nums">{budget>0?`${Math.min(100,view.spend/budget*100).toFixed(1)}%`:'—'}</span></div>
        <div className="mt-4 h-3 overflow-hidden rounded-full bg-muted" role="img" aria-label={budget>0?`${(view.spend/budget*100).toFixed(1)} percent of budget allocated`:'No budget set'}><div className="h-full rounded-full bg-blue-500" style={{width:`${budget>0?Math.min(100,view.spend/budget*100):0}%`}}/></div>
        <div className="mt-4 flex justify-between gap-4 text-xs text-muted-foreground"><span><span className="mr-1.5 inline-block size-2 rounded-full bg-blue-500"/>Allocated</span><span>Unallocated: {money(Math.max(0,budget-view.spend))}</span></div>
        <p className="mt-4 text-xs leading-relaxed text-muted-foreground">Scenario output only; no purchase has been made.</p>
      </VisualCard>
      <VisualCard title="Largest unsold exposures" description="Top five opportunities · purchase cost less assumed recovery">
        <ComparisonBars items={rows.filter(r=>r.unsoldExposure>0).slice(0,5).map(r=>({label:r.name,detail:r.period,value:r.unsoldExposure,text:money(r.unsoldExposure),tone:'amber'}))} empty="No positive modeled unsold exposure in this scenario."/>
        <p className="mt-4 text-xs leading-relaxed text-muted-foreground">Relative to the largest exposure; estimates are not guaranteed losses.</p>
      </VisualCard>
    </div>
    <section className={`${card} mt-7`} aria-labelledby="breakdown-title"><div className="flex flex-wrap items-start justify-between gap-2"><div><h2 id="breakdown-title" className="font-display text-xl font-bold">Opportunity breakdown</h2><p className="mt-1 text-sm text-muted-foreground">Sorted by expected unsold exposure · {active} allocated, {unallocated} not allocated</p></div><span className="rounded-full border px-3 py-1 text-xs text-muted-foreground">{view.allocatedUnits} new units</span></div>
      <div className="mt-5 space-y-3 lg:hidden" aria-label="Opportunity breakdown">
        {rows.map(row => <article key={row.id} className="rounded-xl border bg-surface/30 p-4">
          <h3 className="font-semibold">{row.name}</h3>
          <p className="mt-1 text-xs text-muted-foreground">{row.kind} · {row.period}{row.purchaseTiming === 'Quote expired' ? ' · Quote expired' : ''}</p>
          <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-4 text-sm">
            <div><dt className="text-xs text-muted-foreground">Assumed cancellation</dt><dd className="mt-1 font-medium tabular-nums">{number(row.cancellations * 100)}%</dd></div>
            <div><dt className="text-xs text-muted-foreground">Allocation</dt><dd className="mt-1 font-medium tabular-nums">{row.qty} units</dd></div>
            <div><dt className="text-xs text-muted-foreground">Expected unsold</dt><dd className="mt-1 font-medium tabular-nums">{number(row.expectedUnsold)}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Unsold exposure</dt><dd className="mt-1 font-medium tabular-nums">{money(row.unsoldExposure)}</dd></div>
            <div className="col-span-2"><dt className="text-xs text-muted-foreground">Low-scenario profit</dt><dd className="mt-1 font-medium tabular-nums">{money(row.downsideProfit)}</dd></div>
          </dl>
          <div aria-hidden="true" className="mt-4 h-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-amber-500" style={{width: `${maxExposure ? row.unsoldExposure / maxExposure * 100 : 0}%`}} /></div>
        </article>)}
      </div>
      <div className="mt-5 hidden overflow-x-auto lg:block"><table className="w-full min-w-[780px] text-left text-sm"><thead><tr className="border-b text-xs text-muted-foreground"><th scope="col" className="pb-3 pr-4 font-medium">Opportunity</th><th scope="col" className="pb-3 pr-4 font-medium">Assumed cancellation</th><th scope="col" className="pb-3 pr-4 font-medium">Allocation</th><th scope="col" className="pb-3 pr-4 font-medium">Expected unsold</th><th scope="col" className="pb-3 pr-4 font-medium">Unsold exposure</th><th scope="col" className="pb-3 font-medium">Low-scenario profit</th></tr></thead><tbody>{rows.map(row => <tr key={row.id} className="border-b last:border-0"><th scope="row" className="py-4 pr-4 font-medium"><span className="block">{row.name}</span><span className="mt-1 block text-xs font-normal text-muted-foreground">{row.kind} · {row.period}{row.purchaseTiming === 'Quote expired' ? ' · Quote expired' : ''}</span></th><td className="py-4 pr-4 tabular-nums">{number(row.cancellations * 100)}%</td><td className="py-4 pr-4 tabular-nums">{row.qty} units</td><td className="py-4 pr-4 tabular-nums">{number(row.expectedUnsold)}</td><td className="py-4 pr-4"><span className="tabular-nums">{money(row.unsoldExposure)}</span><span className="mt-2 block h-1 w-24 overflow-hidden rounded-full bg-surface"><span className="block h-full rounded-full bg-amber-500" style={{width: `${maxExposure ? row.unsoldExposure / maxExposure * 100 : 0}%`}} /></span></td><td className="py-4 tabular-nums">{money(row.downsideProfit)}</td></tr>)}</tbody></table></div><p className="mt-4 text-xs leading-relaxed text-muted-foreground">Zero allocation can result from budget, low risk-adjusted return, supplier capacity or an expired quote—not necessarily low underlying demand. Horizontal bars are relative to the highest exposure in this view.</p>
    </section>
    <section className="mt-6 rounded-2xl border bg-surface/50 p-5"><h2 className="font-display text-lg font-bold">How to read this</h2><ul className="mt-3 space-y-2 text-sm leading-relaxed text-muted-foreground"><li><strong className="text-foreground">Cancellation uplift:</strong> adds percentage points to each supplied cancellation rate before demand is forecast.</li><li><strong className="text-foreground">Unsold risk:</strong> averages low, base and high demand scenarios (25% / 50% / 25%), then reduces unsold cost using the supplied recovery fraction.</li><li><strong className="text-foreground">Important:</strong> allocation uses a greedy heuristic and fixed pricing assumptions. No supplier is connected, no orders are placed and CSV inputs are not persisted.</li></ul><Link href="/inventory" className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold underline underline-offset-4">Explore full inventory planner <ArrowUpRight className="size-4" /></Link></section>
  </div>;
}
function Metric({icon,label,value,detail}:{icon:React.ReactNode;label:string;value:string;detail:string}) { return <FeatureMetric icon={icon} label={label} value={value} caption={detail}/>; }
