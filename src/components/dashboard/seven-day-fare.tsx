'use client';

import {useEffect,useState} from 'react';
import {ArrowLeftRight, ArrowUpRight, CalendarDays, ChartNoAxesCombined, ChevronDown, Clock3, Database, Plane} from 'lucide-react';
import {ROUTES} from '@/lib/india-market';
import {FeatureHeader,FeatureMetric,FeatureNotice} from '@/components/dashboard/feature-ui';
import SerpFareSearch from '@/components/dashboard/serp-fare-search';

type Result={pairCount:number;distinctDays:number;trainCount:number;testCount:number;minimumTrain:number;minimumTest:number;minimumDays:number;firstTestDay:string|null;status:'collecting'|'baseline-better'|'no-fresh-fare'|'ready';mae:number|null;baselineMae:number|null;reason:string|null;forecast:{departureDate:string;asOf:string;targetDate:string;currentFare:number;estimatedFare:number}|null};
type Data={pilotEnabled:boolean;result:Result};
const money=(n:number)=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(n);
const panel='rounded-2xl border border-border bg-card';

export default function SevenDayFare(){
 const [route,setRoute]=useState('BOM-DEL');
 const [data,setData]=useState<Data|null>(null);
 const [error,setError]=useState('');
 const [loading,setLoading]=useState(true);
 useEffect(()=>{
  const controller=new AbortController();const [origin,destination]=route.split('-');
  fetch(`/api/flight/seven-day?${new URLSearchParams({origin,destination})}`,{signal:controller.signal,cache:'no-store'}).then(async r=>{const j=await r.json();if(!r.ok)throw new Error(j.error);return j}).then(setData).catch(e=>{if(e.name!=='AbortError')setError(e.message||'Could not load fare history.')}).finally(()=>{if(!controller.signal.aborted)setLoading(false)});
  return ()=>controller.abort();
 },[route]);
 function changeRoute(next:string){if(next===route)return;setData(null);setError('');setLoading(true);setRoute(next)}
 const selected=ROUTES.find(r=>`${r.origin}-${r.destination}`===route)!;
 const reverse=ROUTES.find(r=>r.origin===selected.destination&&r.destination===selected.origin);
 const r=data?.result;
 return <div className="mx-auto max-w-[1240px] pb-16">
  <FeatureHeader title="Seven-day fare forecast" description="Explore current fares, price history and experimental estimates" status="Research pilot" actions={<a className="inline-flex h-9 items-center gap-1 rounded-md border bg-background px-3 text-xs font-medium shadow-xs transition-colors hover:bg-accent" href="/research/seven-day-fares.md" target="_blank" rel="noreferrer">Methodology <ArrowUpRight className="size-3.5"/></a>}/>
  <FeatureNotice><strong className="text-foreground">Decision support, not a quote.</strong> Estimates are experimental and apply to the lowest route fare, not a specific ticket. Fares and availability can change.</FeatureNotice>
  <section className={`${panel} mt-5 p-5 sm:p-6`} aria-labelledby="route-heading"><div className="flex flex-wrap items-end justify-between gap-4"><div className="flex w-full min-w-0 items-start gap-3 sm:w-auto sm:flex-1"><span className="hidden size-10 shrink-0 items-center justify-center rounded-xl bg-surface text-foreground sm:flex"><Plane className="size-4"/></span><div className="min-w-0 flex-1"><h2 id="route-heading" className="text-sm font-semibold">Choose your route</h2><p className="mt-1 text-xs text-muted-foreground">Choose a direction, then select a departure date below.</p><div className="relative mt-3 max-w-md"><label htmlFor="fare-route" className="sr-only">Route and direction</label><select id="fare-route" value={route} onChange={e=>changeRoute(e.target.value)} className="h-11 w-full appearance-none rounded-lg border border-input bg-background pl-3 pr-10 text-sm font-medium outline-none focus:ring-2 focus:ring-ring/40">{ROUTES.map(x=><option key={`${x.origin}-${x.destination}`} value={`${x.origin}-${x.destination}`}>{x.from} → {x.to}</option>)}</select><ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-3.5 size-4 text-muted-foreground"/></div><p className="mt-2 text-xs text-muted-foreground">{selected.origin} → {selected.destination}</p></div></div><button type="button" disabled={!reverse} onClick={()=>reverse&&changeRoute(`${reverse.origin}-${reverse.destination}`)} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg border bg-background px-4 text-sm font-medium shadow-xs transition-colors hover:bg-accent disabled:opacity-50 sm:w-auto"><ArrowLeftRight className="size-4"/>Reverse</button></div></section>
  <SerpFareSearch key={route} route={route}/>
  <details className={`${panel} group mt-5 overflow-hidden`}><summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 p-5 sm:p-6"><span className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-xl bg-surface"><Database className="size-4"/></span><span><span className="block text-sm font-semibold">Travelpayouts forecasting pilot</span><span className="mt-1 block text-xs text-muted-foreground">View collection progress and the separate cached-fare model</span></span></span><span className="flex items-center gap-2 text-xs font-medium text-muted-foreground">{loading?'Checking history':r?.status==='ready'?'Experimental estimate':'Building history'}<ChevronDown className="size-4 transition-transform group-open:rotate-180"/></span></summary>
   <div className="border-t p-5 sm:p-6">
    {loading&&<p role="status" className="text-sm text-muted-foreground">Checking fare history…</p>}
    {error&&<p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">{error}</p>}
    {r&&<>
     <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><FeatureMetric icon={<Database className="size-4"/>} label="Matched pairs" value={String(r.pairCount)} caption="Same route and departure, 7 days apart"/><FeatureMetric icon={<CalendarDays className="size-4"/>} label="Observation dates" value={String(r.distinctDays)} caption={`Minimum ${r.minimumDays} distinct days`}/><FeatureMetric icon={<ChartNoAxesCombined className="size-4"/>} label="Training pairs" value={String(r.trainCount)} caption={`Minimum ${r.minimumTrain}, before the test`}/><FeatureMetric icon={<Clock3 className="size-4"/>} label="Holdout pairs" value={String(r.testCount)} caption={`Minimum ${r.minimumTest}, chronologically later`}/></div>
     <div className="mt-4 rounded-xl border bg-surface/35 p-5"><h3 className="text-sm font-semibold">{r.status==='ready'?'Experimental forecast ready':r.status==='baseline-better'?'Baseline outperformed the model':r.status==='no-fresh-fare'?'Waiting for a fresh eligible fare':'Building fare history'}</h3><p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{r.reason??'The model passed this historical holdout. Performance can change and should not be treated as a guarantee.'}</p>
     {r.forecast&&<div className="mt-4 grid gap-4 sm:grid-cols-2"><p className="text-xs text-muted-foreground">Current cached fare · {r.forecast.asOf} UTC <strong className="mt-1 block text-lg text-foreground">{money(r.forecast.currentFare)}</strong></p><p className="text-xs text-muted-foreground">Estimated fare · {r.forecast.targetDate} UTC <strong className="mt-1 block text-lg text-brand">{money(r.forecast.estimatedFare)}</strong>For departure {r.forecast.departureDate}. Not an offer or booking recommendation.</p></div>}
     {r.mae!==null&&r.baselineMae!==null&&<div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground"><p>Model holdout MAE <strong className="text-foreground">{money(r.mae)}</strong></p><p>Unchanged-fare baseline MAE <strong className="text-foreground">{money(r.baselineMae)}</strong></p><p className="w-full">Holdout starts {r.firstTestDay}; historical results are not proof of future accuracy.</p></div>}</div>
     <p className="mt-4 text-xs leading-relaxed text-muted-foreground">{data?.pilotEnabled?'The additional +23-day collection is enabled.':'The additional +23-day collection is not enabled. Confirm long-term retention permission with Travelpayouts before enabling it; otherwise these pairs will not accumulate.'} The existing collector may be delayed or return no offer. Free hosting and provider terms apply. <a href="/research/seven-day-fares.md" className="font-semibold text-foreground underline underline-offset-4">Read the methodology</a>.</p>
    </>}
   </div>
  </details>
 </div>;
}
