'use client';

import {useState} from 'react';
import {ArrowRight, ChartNoAxesCombined, Clock3, Info, Search, Sparkles, Ticket} from 'lucide-react';

type Fare={source:string;origin:string;destination:string;departureDate:string;fetchedAt:string;sourceSearchTime:string|null;lowest:number|null;level:string|null;typicalRange:[number,number]|null;history:{date:string;price:number}[];forecast:{pairCount:number;trainCount:number;testCount:number;status:'insufficient'|'stale'|'ready';reason:string|null;forecast:number|null;mae:number|null;baselineMae:number|null;method:'regression'|'unchanged'|null;targetDate?:string;holdoutStart?:string}};
const cash=(n:number)=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(n);
const offset=(days:number)=>{const d=new Date();d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10)};
const dateLabel=(date:string)=>new Date(`${date}T00:00:00Z`).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});
const label='text-[11px] font-semibold uppercase tracking-[.11em] text-muted-foreground';

export default function SerpFareSearch({route}:{route:string}){
 const [date,setDate]=useState(()=>offset(30));
 const [fare,setFare]=useState<Fare|null>(null);
 const [state,setState]=useState<'idle'|'loading'|'ready'|'error'>('idle');
 const [error,setError]=useState('');
 async function run(){
  setFare(null);setState('loading');setError('');
  const [origin,destination]=route.split('-');
  try{
   const response=await fetch('/api/flight/serp-fares',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({origin,destination,departureDate:date})});
   const data=await response.json();if(!response.ok)throw new Error(data.error||'Search unavailable.');
   setFare(data);setState('ready');
  }catch(e){setError(e instanceof Error?e.message:'Search unavailable.');setState('error')}
 }
 const current=fare&&`${fare.origin}-${fare.destination}`===route&&fare.departureDate===date?fare:null;
 const [origin,destination]=route.split('-');
 return <section className="mt-5 overflow-hidden rounded-2xl border bg-card shadow-xs">
  <div className="p-5 sm:p-7">
   <div className="flex flex-wrap items-start justify-between gap-4">
    <div className="flex items-start gap-3.5"><span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-brand dark:bg-orange-950/30"><Ticket className="size-5"/></span><div><p className={label}>Google Flights via SerpApi</p><h2 className="mt-1 text-xl font-semibold tracking-tight">Check fare &amp; price history</h2><p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">See the latest available fare and an experimental seven-day estimate for your route.</p></div></div>
    <span className="rounded-full border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground">One-way · Economy</span>
   </div>
   <div className="mt-6 grid gap-4 rounded-xl border bg-surface/45 p-4 sm:p-5 md:grid-cols-[1fr_1fr_auto] md:items-end">
    <div><p className="text-xs font-semibold text-muted-foreground">Selected route</p><div className="mt-2 flex h-11 items-center gap-2 rounded-lg border bg-background px-4 text-sm font-semibold"><span>{origin}</span><ArrowRight className="size-4 text-muted-foreground"/><span>{destination}</span><span className="ml-auto text-xs font-normal text-muted-foreground">Change above</span></div></div>
    <div><label htmlFor="serp-departure" className="text-xs font-semibold text-muted-foreground">Departure date · UTC</label><input id="serp-departure" type="date" value={date} min={offset(8)} max={offset(180)} onChange={e=>setDate(e.target.value)} className="mt-2 h-11 w-full min-w-0 rounded-lg border border-input bg-background px-3 text-sm font-medium outline-none focus:ring-2 focus:ring-ring/40"/></div>
    <button type="button" disabled={state==='loading'||!date} onClick={()=>void run()} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-foreground px-5 text-sm font-semibold text-background transition-opacity hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50"><Search className="size-4"/>{state==='loading'?'Searching…':'Search fares'}</button>
   </div>
   <p className="mt-3 text-xs leading-relaxed text-muted-foreground">Searches use your SerpApi quota. App limit: 8 attempts per UTC day and 180 in any 30 days; other uses of your key are not included. No automatic searches.</p>
   {state==='loading'&&<div role="status" className="mt-5 flex items-center gap-3 rounded-xl border border-dashed p-4 text-sm text-muted-foreground"><span className="size-4 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-brand"/>Looking up fares and history…</div>}
   {state==='error'&&<p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">{error}</p>}
   {state==='idle'&&<div className="mt-5 flex items-start gap-3 rounded-xl border border-dashed p-4 text-sm text-muted-foreground"><ChartNoAxesCombined className="mt-0.5 size-4 shrink-0"/><p>Choose a departure date and search to see fare insights. Price history may not be available for every search.</p></div>}
  </div>
  {current&&<div className="border-t bg-surface/25 p-5 sm:p-7">
   <div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><p className={label}>Search results</p><h3 className="mt-1 text-lg font-semibold tracking-tight">{current.origin} → {current.destination} <span className="font-normal text-muted-foreground">· {dateLabel(current.departureDate)}</span></h3></div><span className="text-xs text-muted-foreground">One adult · INR</span></div>
   <div className="grid gap-3 sm:grid-cols-3"><ResultStat label="Lowest fare in insights" value={current.lowest===null?'Unavailable':cash(current.lowest)}/><ResultStat label="Typical range" value={current.typicalRange?`${cash(current.typicalRange[0])} – ${cash(current.typicalRange[1])}`:'Unavailable'}/><ResultStat label="Price level" value={current.level??'Unavailable'} capitalize/></div>
   <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1.1fr]">
    <section className="rounded-xl border bg-card p-5"><div className="flex items-start justify-between gap-3"><div><p className={label}>Seven days from now</p><h3 className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">{current.forecast.forecast===null?'Estimate unavailable':cash(current.forecast.forecast)}</h3><p className="mt-2 text-xs text-muted-foreground">{current.forecast.targetDate?`Estimate for ${dateLabel(current.forecast.targetDate)} · `:''}Experimental, not a bookable quote</p></div><span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-brand dark:bg-orange-950/30"><Sparkles className="size-4"/></span></div>
     <div className="mt-5 rounded-lg bg-surface/70 p-3.5"><span className="inline-flex rounded-full border bg-card px-2.5 py-1 text-[11px] font-semibold">{current.forecast.method==='regression'?'Regression model':current.forecast.method==='unchanged'?'Unchanged baseline':'Insufficient data'}</span><p className="mt-2 text-xs leading-relaxed text-muted-foreground">{current.forecast.reason??(current.forecast.method==='unchanged'?'The model did not outperform the unchanged-fare baseline, or the current fare is outside its training range. The estimate keeps the current fare unchanged.':'A regularised regression beat the unchanged-fare baseline in this search’s historical holdout.')}</p></div>
     <div className="mt-5 grid grid-cols-2 gap-3 border-t pt-4"><div><p className="text-xs text-muted-foreground">Model holdout MAE</p><p className="mt-1 text-sm font-semibold tabular-nums">{current.forecast.mae===null?'—':cash(current.forecast.mae)}</p></div><div><p className="text-xs text-muted-foreground">Baseline holdout MAE</p><p className="mt-1 text-sm font-semibold tabular-nums">{current.forecast.baselineMae===null?'—':cash(current.forecast.baselineMae)}</p></div></div><p className="mt-4 text-xs leading-relaxed text-muted-foreground">{current.forecast.trainCount} training pairs · {current.forecast.testCount} holdout pairs. Single-provider history may be revised or incomplete.</p>
    </section>
    <section className="min-w-0 rounded-xl border bg-card p-5"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className={label}>Price movement</p><h3 className="mt-1 text-base font-semibold">Reported price history</h3></div><span className="rounded-full bg-surface px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">{current.history.length} points</span></div><p className="mt-1 text-xs leading-relaxed text-muted-foreground">Provider-reported INR fares · dates in UTC</p><FareHistoryChart points={current.history}/></section>
   </div>
   <div className="mt-5 flex items-start gap-2.5 text-xs leading-relaxed text-muted-foreground"><Info className="mt-0.5 size-4 shrink-0"/><p>The estimate applies to the lowest fare for this route and departure date, not a specific ticket or a purchase recommendation. The cheapest itinerary can change. SerpApi data is not mixed with Travelpayouts data.</p></div>
   <p className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground"><Clock3 className="size-3"/> Retrieved {new Date(current.fetchedAt).toLocaleString('en-IN')} · provider timestamp {current.sourceSearchTime??'unavailable'}</p>
  </div>}
 </section>;
}
function ResultStat({label:heading,value,capitalize=false}:{label:string;value:string;capitalize?:boolean}){
 return <div className="rounded-xl border bg-card p-4"><p className="text-xs text-muted-foreground">{heading}</p><p className={`mt-2 text-lg font-semibold tracking-tight tabular-nums ${capitalize?'capitalize':''}`}>{value}</p></div>;
}
function FareHistoryChart({points}:{points:{date:string;price:number}[]}){
 if(!points.length)return <div className="mt-5 flex min-h-44 items-center justify-center rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">No price history returned for this route and date.</div>;
 const min=Math.min(...points.map(p=>p.price)),max=Math.max(...points.map(p=>p.price));
 const padding=Math.max((max-min)*.12,max*.01,1),low=min-padding,high=max+padding;
 const first=Date.parse(`${points[0].date}T00:00:00Z`),last=Date.parse(`${points[points.length-1].date}T00:00:00Z`);
 const x=(date:string)=>20+(Date.parse(`${date}T00:00:00Z`)-first)/Math.max(last-first,1)*560;
 const y=(price:number)=>164-(price-low)/(high-low)*140;
 const path=points.map((p,i)=>`${i===0||Date.parse(`${p.date}T00:00:00Z`)-Date.parse(`${points[i-1].date}T00:00:00Z`)>2*86400000?'M':'L'} ${x(p.date).toFixed(1)} ${y(p.price).toFixed(1)}`).join(' ');
 return <div className="mt-5"><div className="flex justify-between text-[11px] text-muted-foreground"><span>High {cash(max)}</span><span>Low {cash(min)}</span></div><svg viewBox="0 0 600 185" className="mt-2 h-36 w-full overflow-visible sm:h-40" role="img" aria-label={`Price history from ${dateLabel(points[0].date)} to ${dateLabel(points[points.length-1].date)}. Highest ${cash(max)}, lowest ${cash(min)}. Exact points are available in the table below.`}>
  {[24,94,164].map(n=><line key={n} x1="20" x2="580" y1={n} y2={n} stroke="currentColor" className="text-border" strokeDasharray="4 4"/>)}
  <path d={path} fill="none" stroke="currentColor" className="text-blue-500" strokeWidth="3" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round"/>
  {points.map((p,i)=><circle key={`${p.date}-${i}`} cx={x(p.date)} cy={y(p.price)} r={i===points.length-1?4:2.5} fill="currentColor" className="text-blue-500"><title>{`${dateLabel(p.date)}: ${cash(p.price)}`}</title></circle>)}
 </svg><div className="flex justify-between gap-2 text-[11px] text-muted-foreground"><span>{dateLabel(points[0].date)}</span><span>{dateLabel(points[points.length-1].date)}</span></div><p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">Dates can contain gaps; a break in the line means more than two days between observations. The cheapest itinerary can change.</p><details className="mt-3 text-xs text-muted-foreground"><summary className="cursor-pointer font-semibold hover:text-foreground">View all historical prices</summary><div className="mt-2 max-h-56 overflow-auto rounded-lg border"><table className="w-full text-left"><thead className="sticky top-0 bg-surface"><tr><th className="px-3 py-2">Date · UTC</th><th className="px-3 py-2">Price</th></tr></thead><tbody>{points.map(p=><tr key={p.date} className="border-t"><td className="px-3 py-2">{dateLabel(p.date)}</td><td className="px-3 py-2 tabular-nums">{cash(p.price)}</td></tr>)}</tbody></table></div></details></div>;
}
