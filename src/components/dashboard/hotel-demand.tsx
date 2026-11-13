'use client';

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowDownToLine, ArrowUpRight, CalendarDays, ChartNoAxesCombined, RotateCcw, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FeatureHeader, FeatureMetric, FeatureNotice } from '@/components/dashboard/feature-ui';
import { ComparisonBars, VisualCard } from '@/components/dashboard/data-visuals';
import { exampleHotelCSV, forecastHotel, parseHotelHistoryCSV, type HotelHistory } from '@/lib/hotel-forecast';

const today = () => new Date().toISOString().slice(0, 10);
const fmtDate = (date: string) => new Date(date + 'T00:00:00Z').toLocaleDateString('en-GB', { day:'numeric', month:'short', timeZone:'UTC' });
const value = (n:number) => new Intl.NumberFormat('en-IN', { maximumFractionDigits:1 }).format(n);
const label = 'text-[11px] font-semibold uppercase tracking-[.12em] text-muted-foreground';
const input = 'mt-2 h-10 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground outline-none focus:border-foreground focus:ring-2 focus:ring-foreground/10';
const card = 'rounded-2xl border bg-card p-5 sm:p-6';

export default function HotelDemand() {
 const [asOf,setAsOf]=useState(today);
 const [rows,setRows]=useState<HotelHistory[]>(()=>parseHotelHistoryCSV(exampleHotelCSV(today())));
 const [hotel,setHotel]=useState('Sample Goa Beach Hotel');
 const [source,setSource]=useState('Synthetic example');
 const [error,setError]=useState('');
 const file=useRef<HTMLInputElement>(null);
 const hotels=useMemo(()=>Array.from(new Map(rows.map(r=>[r.hotel.toLocaleLowerCase('en-US'),r.hotel])).values()).sort(),[rows]);
 const forecast=useMemo(()=>forecastHotel(rows,hotel,asOf),[rows,hotel,asOf]);
 const history=forecast.history.slice(-14);
 const max=Math.max(1,...history.map(r=>r.bookedRoomNights-r.cancelledRoomNights),...forecast.predictions.map(p=>p.netRoomNights||0));
 const chart=[...history.map(r=>({date:r.date,amount:r.bookedRoomNights-r.cancelledRoomNights,kind:'History'})),...forecast.predictions.map(p=>({date:p.date,amount:p.netRoomNights,kind:'Forecast'}))];
 function sample() { const r=parseHotelHistoryCSV(exampleHotelCSV(asOf));setRows(r);setHotel('Sample Goa Beach Hotel');setSource('Synthetic example');setError(''); }
 function download(){const link=document.createElement('a');const url=URL.createObjectURL(new Blob([exampleHotelCSV(asOf)],{type:'text/csv;charset=utf-8'}));link.href=url;link.download='synthetic-hotel-history.csv';link.click();URL.revokeObjectURL(url)}
 async function upload(f?:File){if(!f)return;try{if(f.size>1000000)throw new Error('File must be smaller than 1 MB.');const parsed=parseHotelHistoryCSV(await f.text());setRows(parsed);setHotel(parsed[0].hotel);setSource(f.name);setError('')}catch(e){setError((e instanceof Error?e.message:'Could not read the CSV.')+' Previous data was retained.')}finally{if(file.current)file.current.value=''}}
 return <div className="mx-auto max-w-6xl pb-12">
  <FeatureHeader title="Hotel demand" description="Forecast booking-day room-nights using your hotel history" status={source==='Synthetic example'?'Synthetic example':'Imported history'}/>
  <FeatureNotice><strong className="text-foreground">{source==='Synthetic example'?'Synthetic example data.':'Imported history.'}</strong> Estimates describe booking-day activity, not stay-date occupancy, confirmed bookings or supplier availability.</FeatureNotice>
  <section className={`${card} mt-6`}><div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="font-display text-xl font-bold">Your hotel history</h2><p className="mt-1 text-sm text-muted-foreground">{source} · {rows.length} rows · files stay in your browser</p></div><div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={download}><ArrowDownToLine /> Sample CSV</Button><Button size="sm" onClick={()=>file.current?.click()}><Upload /> Upload history</Button><input ref={file} type="file" accept=".csv,text/csv" hidden onChange={e=>upload(e.target.files?.[0])}/><Button size="sm" variant="secondary" onClick={sample}><RotateCcw /> Reset sample</Button></div></div>
   <div className="mt-5 grid gap-4 sm:grid-cols-2"><label className={label} htmlFor="hotel-choice">Hotel<select id="hotel-choice" className={input} value={hotel} onChange={e=>setHotel(e.target.value)}>{hotels.map(h=><option value={h} key={h}>{h}</option>)}</select></label><label className={label} htmlFor="hotel-asof">Forecast as of · UTC<input id="hotel-asof" type="date" className={input} value={asOf} onChange={e=>{if(e.target.value)setAsOf(e.target.value)}}/></label></div>
   <p className="mt-4 text-xs leading-relaxed text-muted-foreground">One row per hotel and UTC booking day, aggregated over all future stay dates: <code>date, hotel, bookedRoomNights, cancelledRoomNights, searches</code>. Cancellations must come from bookings made on the same day. Need seven consecutive completed days through yesterday. <a href="/research/hotel-forecast.md" target="_blank" rel="noreferrer" className="font-semibold underline underline-offset-4">CSV guide <ArrowUpRight className="inline size-3" /></a></p>
   {error&&<p role="alert" className="mt-4 rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
  </section>
  <div className="mt-8 flex flex-wrap items-end justify-between gap-3"><div><h2 className="font-display text-2xl font-bold">Demand outlook</h2><p className="mt-1 text-sm text-muted-foreground">Estimated net room-nights booked on each booking day.</p></div><span className="text-xs text-muted-foreground">{forecast.historyRows} completed rows · {forecast.ignoredRows} same-day/future rows excluded</span></div>
  <div className="mt-4 grid gap-4 sm:grid-cols-2">{forecast.predictions.map((p,i)=><FeatureMetric key={p.date} icon={<CalendarDays className="size-4"/>} label={`${i===0?'As-of day':'Next day'} · ${fmtDate(p.date)}`} value={p.netRoomNights===null?'—':value(p.netRoomNights)} caption={p.netRoomNights===null?'Insufficient, incomplete or outdated history.':`Estimated net room-nights · ${forecast.metrics[i]?.mae!=null?`rolling MAE ${value(forecast.metrics[i].mae!)} (${forecast.metrics[i].count} tests)`:'not enough tests for MAE'}`}/>)}</div>
  <section className={`${card} mt-4`}><div className="flex flex-wrap items-start justify-between gap-4"><div className="flex items-start gap-3"><ChartNoAxesCombined className="mt-1 size-5"/><div><h2 className="font-display text-xl font-bold">Recent booking activity</h2><p className="mt-1 text-sm text-muted-foreground">Last 14 available completed days and the next two estimates.</p></div></div><div className="flex gap-4 text-xs text-muted-foreground"><span><span className="mr-1.5 inline-block size-2 rounded-full bg-foreground"/>History</span><span><span className="mr-1.5 inline-block size-2 rounded-full bg-amber-400"/>Forecast</span></div></div>
   {history.length===0?<div className="mt-6 rounded-xl border border-dashed bg-surface/50 p-8 text-center text-sm text-muted-foreground">No completed history for this hotel before the selected as-of date.</div>:<div className="mt-6 overflow-x-auto"><div className="flex h-56 min-w-[580px] items-end gap-2 border-b pb-1" role="img" aria-label="Historical net room-nights and baseline estimates, by booking date">{chart.map((point,i)=><div key={`${point.date}-${point.kind}`} className="group flex h-full flex-1 flex-col justify-end"><div className="flex flex-1 items-end"><div title={`${point.kind} · ${point.date}: ${point.amount===null?'insufficient data':`${value(point.amount)} net room-nights`}`} className={`w-full rounded-t-md ${point.kind==='Forecast'?'bg-amber-400':'bg-foreground/80'}`} style={{height:point.amount===null?'0%':`${Math.max(point.amount>0?1:0,point.amount/max*90)}%`}}/></div><span className="mt-2 h-4 text-center text-[10px] text-muted-foreground">{i%2===0||point.kind==='Forecast'?fmtDate(point.date):''}</span></div>)}</div></div>}
   <p className="mt-4 text-xs leading-relaxed text-muted-foreground">Bars show only available dates; missing calendar days are not interpolated. Last included: {forecast.lastDate||'none'}. Forecast bars are estimates, not actual bookings.</p>
  </section>
  <VisualCard className="mt-4" title="Recent booking mix" description="Last 14 available completed booking days · room-nights, not stay-date occupancy">
    <ComparisonBars items={history.length ? [
      {label:'Net room-nights booked',value:history.reduce((sum,r)=>sum+r.bookedRoomNights-r.cancelledRoomNights,0),text:value(history.reduce((sum,r)=>sum+r.bookedRoomNights-r.cancelledRoomNights,0)),tone:'blue'},
      {label:'Cancelled room-nights',value:history.reduce((sum,r)=>sum+r.cancelledRoomNights,0),text:value(history.reduce((sum,r)=>sum+r.cancelledRoomNights,0)),tone:'amber'},
    ] : []} empty="No completed booking days available for this selection."/>
    <p className="mt-4 text-xs text-muted-foreground">Cancellations are from bookings made on the same day; missing days are not counted.</p>
  </VisualCard>
  <section className="mt-6 rounded-2xl border bg-surface/50 p-5"><h2 className="font-display text-lg font-bold">How the baseline works</h2><p className="mt-3 text-sm leading-relaxed text-muted-foreground">Each estimate combines the average of the latest seven completed days (50%) with historical observations for the same weekday (50%). Rolling MAE compares predictions with past observations at each horizon without using future data. Searches are stored for context but are not used in the forecast.</p><p className="mt-3 text-sm leading-relaxed text-muted-foreground">Results are uncalibrated and need validation against real hotel data. They aggregate stay dates and cannot determine how many rooms to procure for a particular stay period.</p><Link href="/dashboard/cancellation-risk" className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold underline underline-offset-4">Explore cancellation &amp; risk <ArrowUpRight className="size-4"/></Link></section>
 </div>;
}
