'use client';

import { useEffect, useState } from 'react';
import {
  ArrowDownRight, ArrowLeftRight, ArrowUpRight,
  BarChart3, CalendarDays, CheckCircle2, ChevronDown, Clock3,
  ExternalLink, Info, Plane, RefreshCw, ShieldCheck,
  Table2, Ticket, TrendingUp,
} from 'lucide-react';
import { ROUTES, shiftMonth, type MonthlyTraffic } from '@/lib/india-market';
import { FeatureHeader, FeatureMetric, FeatureNotice } from '@/components/dashboard/feature-ui';
import { ComparisonBars } from '@/components/dashboard/data-visuals';

type Traffic = {
  sourceRowCount: number;
  monthly: MonthlyTraffic[];
  retrievedAt: string;
  reference: { target: string; estimate: number | null; mae: number | null; holdoutCount: number; holdout: string } | null;
};
type Fare = {
  collection_day: string;
  departure_date: string;
  observed_at: string;
  status: 'ok' | 'empty' | 'error';
  price_inr: number | null;
  airline: string | null;
  stops: number | null;
  provider_found_at: string | null;
};
type Load<T> = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; data: T };
type FareFilter = 'all' | 'ok' | 'empty' | 'error';
const panel = 'rounded-2xl border border-border bg-card';
const tiny = 'text-[10px] font-bold uppercase tracking-[0.13em] text-muted-foreground';
const value = (n: number) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(n);
const shortMonth = (month: string) => {
  const [year, m] = month.split('-').map(Number);
  return new Date(Date.UTC(year, m - 1, 1)).toLocaleDateString('en-IN', { month: 'short', year: '2-digit', timeZone: 'UTC' });
};
const shortDate = (date: string) => new Date(`${date.slice(0, 10)}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const utcTime = (date: string) => {
  const d = new Date(date);
  return Number.isFinite(d.getTime()) ? `${d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })}, ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })} UTC` : 'Unknown';
};
function calendarMonths(rows: MonthlyTraffic[], count: number): Array<MonthlyTraffic | { month: string; passengers: null; quality: 'missing' }> {
  if (!rows.length) return [];
  const last = rows[rows.length - 1].month;
  const lookup = new Map(rows.map(row => [row.month, row]));
  return Array.from({ length: count }, (_, i) => {
    const month = shiftMonth(last, i - count + 1);
    return lookup.get(month) ?? { month, passengers: null, quality: 'missing' as const };
  });
}
function leadDays(fare: Fare) {
  return Math.round((Date.parse(`${fare.departure_date}T00:00:00Z`) - Date.parse(`${fare.collection_day}T00:00:00Z`)) / 86400000);
}

export default function IndiaMarket() {
  const [routeKey, setRouteKey] = useState('DEL-PNQ');
  const [revision, setRevision] = useState(0);
  const route = ROUTES.find(r => `${r.origin}-${r.destination}` === routeKey)!;
  const reverse = ROUTES.find(r => r.origin === route.destination && r.destination === route.origin);

  return <div className="mx-auto max-w-[1240px] pb-16">
    <FeatureHeader title="India travel data" description="Explore Indian route traffic and collected fare observations" status="Public market data" actions={<a href="/research/india-market-data.md" target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-md border bg-background px-3 text-xs font-medium shadow-xs transition-colors hover:bg-accent">Data guide <ArrowUpRight className="size-3.5"/></a>}/>
    <FeatureNotice><strong className="text-foreground">Market data, not TBO transactions.</strong> Passenger traffic is industry-wide; cached fares are not guaranteed live prices or booking volumes.</FeatureNotice>

    <section aria-labelledby="route-selector" className="mt-5 flex flex-wrap items-end gap-3">
      <div className="min-w-[220px] flex-1 sm:max-w-md"><label id="route-selector" htmlFor="india-route" className="text-sm font-medium text-muted-foreground">Route and direction</label><div className="relative mt-2"><select id="india-route" value={routeKey} onChange={e=>setRouteKey(e.target.value)} className="h-10 w-full appearance-none rounded-full border border-input bg-background pl-4 pr-10 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring/30">{ROUTES.map(r=><option key={`${r.origin}-${r.destination}`} value={`${r.origin}-${r.destination}`}>{r.from} ({r.origin}) → {r.to} ({r.destination})</option>)}</select><ChevronDown aria-hidden="true" className="pointer-events-none absolute right-4 top-3 size-4 text-muted-foreground"/></div></div>
      <button type="button" disabled={!reverse} onClick={()=>reverse&&setRouteKey(`${reverse.origin}-${reverse.destination}`)} className="inline-flex h-10 items-center justify-center gap-2 rounded-full border bg-background px-4 text-sm font-medium shadow-xs transition-colors hover:bg-accent disabled:opacity-50"><ArrowLeftRight className="size-4"/> Reverse</button>
    </section>
    <RouteData key={`${routeKey}-${revision}`} routeKey={routeKey} refresh={()=>setRevision(n=>n+1)}/>
  </div>;
}

function RouteData({routeKey,refresh}:{routeKey:string;refresh:()=>void}) {
  const [traffic, setTraffic] = useState<Load<Traffic>>({status:'loading'});
  const [fares, setFares] = useState<Load<Fare[]>>({status:'loading'});
  const [view, setView] = useState<'chart'|'table'>('chart');
  const [range, setRange] = useState<6|12>(12);
  const [filter, setFilter] = useState<FareFilter>('all');
  const [showAll, setShowAll] = useState(false);
  const [origin,destination] = routeKey.split('-');

  useEffect(()=>{
    const controller = new AbortController();
    const query = `origin=${origin}&destination=${destination}`;
    fetch(`/api/india-market/traffic?${query}`, {signal:controller.signal})
      .then(async response=>{const json=await response.json();if(!response.ok)throw new Error(json.error||'Could not load traffic.');return json as Traffic;})
      .then(data=>setTraffic({status:'ready',data}))
      .catch(error=>{if(!controller.signal.aborted)setTraffic({status:'error',message:error.message||'Could not load traffic.'});});
    fetch(`/api/india-market/fares?${query}`, {signal:controller.signal})
      .then(async response=>{const json=await response.json();if(!response.ok)throw new Error(json.error||'Could not load fares.');return json.rows as Fare[];})
      .then(data=>setFares({status:'ready',data}))
      .catch(error=>{if(!controller.signal.aborted)setFares({status:'error',message:error.message||'Could not load fares.'});});
    return ()=>controller.abort();
  },[origin,destination]);

  const data=traffic.status==='ready'?traffic.data:null;
  const last=data?.monthly.at(-1);
  const previousYear=last?data?.monthly.find(row=>row.month===shiftMonth(last.month,-12)):undefined;
  const yoy=last?.passengers!=null&&previousYear?.passengers!=null&&previousYear.passengers>0?(last.passengers-previousYear.passengers)/previousYear.passengers*100:null;
  const latestCheck=fares.status==='ready'&&fares.data.length?fares.data[0].observed_at:null;
  const lastDay=fares.status==='ready'&&fares.data.length?fares.data[0].collection_day:null;
  const lastDayFares=fares.status==='ready'&&lastDay?fares.data.filter(f=>f.collection_day===lastDay):[];

  return <>
    <div className="mt-6 flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-xl font-bold">Route overview</h2><p className="mt-1 text-sm text-muted-foreground">{origin} → {destination} · Latest available observations</p></div><button type="button" onClick={refresh} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-surface hover:text-foreground focus-visible:outline-2 focus-visible:outline-brand"><RefreshCw className="size-3.5"/> Reload data</button></div>
    <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Metric icon={<CalendarDays className="size-4"/>} label="Latest reported month" main={last?shortMonth(last.month):traffic.status==='loading'?'Loading…':'—'} detail="DGCA route traffic · delayed"/>
      <Metric icon={<Plane className="size-4"/>} label="Passengers carried" main={last?.passengers!=null?value(last.passengers):traffic.status==='loading'?'Loading…':'—'} detail={last?.quality==='ambiguous'?'Conflicting source rows':last?'In the latest reported month':traffic.status==='error'?'Traffic unavailable':traffic.status==='loading'?'Loading traffic':'No traffic data'}/>
      <Metric icon={<TrendingUp className="size-4"/>} label="Year-over-year" main={yoy===null?'—':`${yoy>0?'+':''}${yoy.toFixed(1)}%`} detail="Versus the same month last year" trend={yoy}/>
      <Metric icon={<Clock3 className="size-4"/>} label="Last fare check" main={latestCheck?shortDate(latestCheck):fares.status==='loading'?'Loading…':'—'} detail={latestCheck?`${lastDayFares.filter(f=>f.status==='ok').length} of ${lastDayFares.length} checks found an offer`:fares.status==='error'?'Fare data unavailable':fares.status==='loading'?'Loading fares':'No recorded observations'}/>
    </div>

    <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(280px,1fr)]">
      <section className={`${panel} min-w-0 overflow-hidden`} aria-labelledby="traffic-heading">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b px-5 py-5 sm:px-6"><div><div className="flex items-center gap-2"><span className="flex size-8 items-center justify-center rounded-lg bg-surface text-foreground"><BarChart3 className="size-4"/></span><h2 id="traffic-heading" className="font-display text-lg font-bold">Passenger traffic</h2></div><p className="mt-2 text-xs leading-relaxed text-muted-foreground">Monthly passengers carried · {origin} → {destination}</p></div><span className="rounded-full border bg-surface/60 px-2.5 py-1 text-[10px] font-semibold text-muted-foreground">Historical data</span></div>
        {traffic.status==='loading'?<Loading text="Loading route traffic"/>:traffic.status==='error'?<Problem message={traffic.message} onRetry={refresh}/>:<>
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5 sm:px-6"><div><p className={tiny}>Latest reported</p><div className="mt-1 flex flex-wrap items-baseline gap-2"><span className="font-display text-3xl font-bold tracking-tight tabular-nums">{last?.passengers==null?'—':value(last.passengers)}</span><span className="text-xs text-muted-foreground">passengers · {last?shortMonth(last.month):'—'}</span></div></div><div className="flex flex-wrap items-center gap-2"><div className="flex rounded-lg border bg-surface/50 p-0.5" aria-label="Traffic time range">{([6,12] as const).map(n=><button key={n} onClick={()=>setRange(n)} aria-pressed={range===n} className={`rounded-md px-2.5 py-1.5 text-[11px] font-semibold ${range===n?'bg-card text-foreground shadow-sm':'text-muted-foreground hover:text-foreground'}`}>{n}M</button>)}</div><div className="flex rounded-lg border bg-surface/50 p-0.5" aria-label="Traffic display mode"><button aria-label="Chart view" aria-pressed={view==='chart'} onClick={()=>setView('chart')} className={`rounded-md p-1.5 ${view==='chart'?'bg-card text-foreground shadow-sm':'text-muted-foreground'}`}><BarChart3 className="size-4"/></button><button aria-label="Table view" aria-pressed={view==='table'} onClick={()=>setView('table')} className={`rounded-md p-1.5 ${view==='table'?'bg-card text-foreground shadow-sm':'text-muted-foreground'}`}><Table2 className="size-4"/></button></div></div></div>
          {view==='chart'?<TrafficChart rows={calendarMonths(traffic.data.monthly,range)}/>:<TrafficTable rows={calendarMonths(traffic.data.monthly,range)}/>}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t px-5 py-3 text-[11px] text-muted-foreground sm:px-6"><span>Source: DGCA via Vonter · {value(traffic.data.sourceRowCount)} records across all routes</span><span>Source retrieved: {utcTime(traffic.data.retrievedAt)}</span></div>
        </>}
      </section>
      <section className={`${panel} flex flex-col overflow-hidden`} aria-labelledby="baseline-heading">
        <div className="border-b px-5 py-5 sm:px-6"><div className="flex items-center gap-2"><span className="flex size-8 items-center justify-center rounded-lg bg-brand/10 text-brand"><TrendingUp className="size-4"/></span><h2 id="baseline-heading" className="font-display text-lg font-bold">Seasonal reference</h2></div><p className="mt-2 text-xs leading-relaxed text-muted-foreground">A simple benchmark, not a TBO forecast</p></div>
        {traffic.status==='loading'?<Loading text="Calculating reference"/>:traffic.status==='error'?<Problem message="Reference unavailable while traffic data is offline."/>:<div className="flex flex-1 flex-col p-5 sm:p-6">
          <div className="rounded-xl border border-brand/15 bg-brand/[0.04] p-4"><div className="flex items-center justify-between gap-2"><p className={tiny}>Next reported month</p><span className="rounded-md bg-card px-2 py-1 text-[10px] font-semibold text-muted-foreground">{traffic.data.reference?.target?shortMonth(traffic.data.reference.target):'—'}</span></div><p className="font-display mt-4 text-3xl font-bold tracking-tight tabular-nums">{traffic.data.reference?.estimate==null?'—':value(traffic.data.reference.estimate)}</p><p className="mt-1 text-xs text-muted-foreground">Reference passengers</p></div>
          <div className="mt-5 flex items-center justify-between gap-3 border-b pb-4"><div><p className="text-xs font-semibold">How it works</p><p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">Uses the same month in the previous year.</p></div><span className="rounded-lg bg-surface p-2 text-muted-foreground"><CalendarDays className="size-4"/></span></div>
          <div className="mt-4"><p className="text-xs font-semibold">Historical test · 2025</p><p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{traffic.data.reference?.mae==null?'Not enough comparable months.':`Average absolute error: ${value(traffic.data.reference.mae)} passengers across ${traffic.data.reference.holdoutCount} months.`}</p></div>
          <p className="mt-auto pt-5 text-[11px] leading-relaxed text-muted-foreground">Reporting is delayed, so the next reported month may already have passed. Past errors are not a guarantee of accuracy.</p>
        </div>}
      </section>
    </div>

    <section className={`${panel} mt-4 overflow-hidden`} aria-labelledby="fare-heading">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b px-5 py-5 sm:px-6"><div><div className="flex items-center gap-2"><span className="flex size-8 items-center justify-center rounded-lg bg-surface text-foreground"><Ticket className="size-4"/></span><h2 id="fare-heading" className="font-display text-lg font-bold">Fare observations</h2></div><p className="mt-2 text-xs leading-relaxed text-muted-foreground">Cached one-way fares · INR · checks at 1, 7 and 30 days ahead</p></div><span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-semibold text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"><Clock3 className="size-3"/> Historical, not live</span></div>
      {fares.status==='loading'?<Loading text="Loading fare observations"/>:fares.status==='error'?<Problem message={fares.message} onRetry={refresh}/>:fares.data.length===0?<div className="m-5 rounded-xl border border-dashed bg-surface/30 p-8 text-center sm:m-6"><Ticket className="mx-auto size-6 text-muted-foreground/60"/><h3 className="mt-3 text-sm font-bold">No fare observations yet</h3><p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-muted-foreground">The daily collector may not have run for this route yet. Empty provider responses are recorded separately, not as zero prices.</p></div>:<>
        {lastDayFares.length>0&&<div className="mx-5 mt-5 rounded-xl border bg-surface/30 p-4 sm:mx-6"><div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="text-sm font-semibold">Latest collection · fare snapshots</h3><p className="mt-1 text-xs text-muted-foreground">Checked {lastDay} UTC · cached one-way fares by departure date</p></div><span className="rounded-full border bg-card px-2.5 py-1 text-[10px] font-medium text-muted-foreground">Not live prices</span></div><ComparisonBars items={[...lastDayFares].sort((a,b)=>a.departure_date.localeCompare(b.departure_date)).map(f=>({label:`${shortDate(f.departure_date)} · ${leadDays(f)} days ahead`,value:f.status==='ok'?f.price_inr:null,text:f.status==='ok'&&f.price_inr!==null?`₹${value(f.price_inr)}`:f.status==='empty'?'No cached offer':f.status==='error'?'Provider error':'Price unavailable',tone:'blue'}))}/><p className="mt-4 text-xs leading-relaxed text-muted-foreground">Each bar is a different departure date, not a fare trend. Empty responses and errors are not zero or sold-out flights.</p></div>}
        <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-6"><div className="flex flex-wrap items-center gap-2"><span className="inline-flex items-center gap-1.5 text-xs font-semibold"><CheckCircle2 className="size-3.5 text-emerald-600"/> Last check</span><span className="text-xs text-muted-foreground">{latestCheck?utcTime(latestCheck):'Unknown'}</span></div><div className="flex flex-wrap gap-1.5" aria-label="Filter fare observations">{([['all','All'],['ok','Offers'],['empty','Empty'],['error','Errors']] as const).map(([id,label])=><button key={id} onClick={()=>{setFilter(id);setShowAll(false)}} aria-pressed={filter===id} className={`rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-colors ${filter===id?'bg-foreground text-background':'bg-surface/70 text-muted-foreground hover:text-foreground'}`}>{label}</button>)}</div></div>
        <FareTable fares={fares.data.filter(f=>filter==='all'||f.status===filter)} showAll={showAll}/>
        {fares.data.filter(f=>filter==='all'||f.status===filter).length>9&&<div className="px-5 pb-4 sm:px-6"><button onClick={()=>setShowAll(!showAll)} className="text-xs font-semibold text-brand underline-offset-4 hover:underline">{showAll?'Show fewer':'Show all loaded observations'}</button></div>}
        <div className="flex items-start gap-2 border-t bg-surface/40 px-5 py-4 text-[11px] leading-relaxed text-muted-foreground sm:px-6"><Info className="mt-0.5 size-3.5 shrink-0"/><p>These are snapshots, not fares available now. An empty result is not a sold-out flight. Collection may happen after the provider found the price. Confirm historical retention and commercial use with Travelpayouts.</p></div>
      </>}
    </section>

    <section className="mt-5 grid gap-4 rounded-2xl border bg-surface/40 p-5 sm:p-6 md:grid-cols-[auto_1fr_auto] md:items-start"><span className="flex size-9 items-center justify-center rounded-xl border bg-card text-brand"><ShieldCheck className="size-4"/></span><div><h2 className="text-sm font-bold">Know what the data means</h2><p className="mt-1.5 max-w-3xl text-xs leading-relaxed text-muted-foreground">Passenger figures are industry-wide, can be revised and arrive with a reporting delay. Conflicting or invalid records are excluded, and missing months are not treated as zero. Fare observations do not measure TBO bookings, inventory or demand.</p></div><div className="flex flex-wrap gap-x-4 gap-y-2 text-xs font-semibold"><a href="/research/india-market-data.md" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-brand">Methodology <ExternalLink className="size-3"/></a><a href="https://github.com/Vonter/india-aviation-traffic" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-brand">Source &amp; license <ExternalLink className="size-3"/></a></div></section>
  </>;
}

function Metric({icon,label,main,detail,trend}:{icon:React.ReactNode;label:string;main:string;detail:string;trend?:number|null}) {
 return <FeatureMetric icon={icon} label={label} value={<span className="flex items-center gap-1.5">{main}{trend!=null&&(trend>=0?<ArrowUpRight className="size-4 text-emerald-600"/>:<ArrowDownRight className="size-4 text-amber-600"/>)}</span>} caption={detail}/>;
}
function TrafficChart({rows}:{rows:Array<MonthlyTraffic|{month:string;passengers:null;quality:'missing'}>}) {
 const max=Math.max(1,...rows.map(r=>r.passengers??0));
 return <div className="px-5 pb-5 pt-6 sm:px-6"><div className="relative overflow-x-auto"><div className="relative min-w-[480px] pl-10"><div className="pointer-events-none absolute inset-x-0 top-0 flex h-44 flex-col justify-between text-[10px] text-muted-foreground"><div className="flex items-center gap-2"><span className="w-8 text-right">{value(max)}</span><span className="flex-1 border-t border-dashed"/></div><div className="flex items-center gap-2"><span className="w-8 text-right">{value(Math.round(max/2))}</span><span className="flex-1 border-t border-dashed"/></div><div className="flex items-center gap-2"><span className="w-8 text-right">0</span><span className="flex-1 border-t"/></div></div><div className="relative flex h-44 items-end gap-2 px-1 sm:gap-3" role="img" aria-label="Monthly reported passengers. Missing or ambiguous months have no passenger value.">{rows.map((r,i)=><div key={r.month} className="group flex h-full flex-1 items-end justify-center"><div title={`${shortMonth(r.month)}: ${r.passengers===null?r.quality:value(r.passengers)+' passengers'}`} className={`w-full max-w-10 rounded-t-md transition-colors ${r.passengers===null?'border border-dashed border-amber-400 bg-amber-50 dark:bg-amber-950/30':i===rows.length-1?'bg-brand':'bg-foreground/80 group-hover:bg-brand/75'}`} style={{height:r.passengers===null?'7px':`${Math.max(r.passengers>0?1:0,r.passengers/max*100)}%`}}/></div>)}</div><div className="flex gap-2 px-1 pt-2 sm:gap-3">{rows.map(r=><div key={r.month} className="flex-1 text-center text-[10px] text-muted-foreground">{shortMonth(r.month)}</div>)}</div></div></div><div className="mt-5 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground"><span><span className="mr-1.5 inline-block size-2 rounded-sm bg-foreground/80"/>Reported</span><span><span className="mr-1.5 inline-block size-2 rounded-sm bg-brand"/>Latest month</span><span><span className="mr-1.5 inline-block size-2 rounded-sm border border-dashed border-amber-500"/>Missing / ambiguous</span></div><p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">Hover for exact values; use table view for accessible month-by-month details. Missing and ambiguous records are not zero.</p></div>;
}
function TrafficTable({rows}:{rows:Array<MonthlyTraffic|{month:string;passengers:null;quality:'missing'}>}) {
 return <div className="px-5 py-5 sm:px-6"><div className="max-h-64 overflow-auto rounded-xl border"><table className="w-full text-left text-xs"><thead className="sticky top-0 bg-surface text-muted-foreground"><tr><th className="px-4 py-3 font-semibold">Month</th><th className="px-4 py-3 font-semibold">Passengers</th><th className="px-4 py-3 font-semibold">Status</th></tr></thead><tbody>{[...rows].reverse().map(r=><tr key={r.month} className="border-t"><td className="px-4 py-2.5 font-medium">{shortMonth(r.month)}</td><td className="px-4 py-2.5 tabular-nums">{r.passengers===null?'—':value(r.passengers)}</td><td className="px-4 py-2.5 capitalize text-muted-foreground">{r.quality==='ok'?'Reported':r.quality}</td></tr>)}</tbody></table></div></div>;
}
function FareTable({fares,showAll}:{fares:Fare[];showAll:boolean}) {
 if(!fares.length)return <p className="px-6 pb-8 pt-3 text-sm text-muted-foreground">No observations match this filter.</p>;
 return <div className="overflow-x-auto px-5 pb-5 sm:px-6"><table className="w-full min-w-[670px] text-left text-xs"><thead><tr className="border-y bg-surface/50 text-[10px] font-semibold uppercase tracking-[.08em] text-muted-foreground"><th className="px-3 py-3">Checked · UTC</th><th className="px-3 py-3">Departure</th><th className="px-3 py-3">Lead time</th><th className="px-3 py-3">Observed fare</th><th className="px-3 py-3">Airline</th><th className="px-3 py-3">Result</th></tr></thead><tbody>{fares.slice(0,showAll?undefined:9).map(f=><tr key={`${f.collection_day}-${f.departure_date}`} className="border-b last:border-0"><td className="px-3 py-3.5 text-muted-foreground">{utcTime(f.observed_at)}</td><td className="px-3 py-3.5 font-medium">{shortDate(f.departure_date)}</td><td className="px-3 py-3.5 text-muted-foreground">{leadDays(f)} days</td><td className="px-3 py-3.5 font-bold tabular-nums">{f.price_inr==null?'—':`₹${value(f.price_inr)}`}</td><td className="px-3 py-3.5 text-muted-foreground">{f.airline??'—'}</td><td className="px-3 py-3.5"><span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-semibold ${f.status==='ok'?'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300':f.status==='empty'?'bg-surface text-muted-foreground':'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300'}`}>{f.status==='ok'?'Cached offer':f.status==='empty'?'No cached offer':'Provider error'}</span></td></tr>)}</tbody></table></div>;
}
function Loading({text}:{text:string}){return <div role="status" className="space-y-3 p-6"><div className="h-3 w-32 animate-pulse rounded bg-surface"/><div className="h-20 animate-pulse rounded-xl bg-surface/70"/><p className="text-xs text-muted-foreground">{text}…</p></div>}
function Problem({message,onRetry}:{message:string;onRetry?:()=>void}){return <div role="alert" className="m-5 rounded-xl border border-red-200 bg-red-50 p-4 text-xs leading-relaxed text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200"><p>{message}</p>{onRetry&&<button type="button" onClick={onRetry} className="mt-2 font-bold underline underline-offset-4">Try again</button>}</div>}
