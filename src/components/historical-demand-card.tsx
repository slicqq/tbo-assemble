'use client';
import {useMemo,useState} from 'react';
import {Activity, ArrowRight} from 'lucide-react';
import data from '@/data/public-hotel-cohorts.json';
import {evaluateWalkForward} from '@/lib/hotel-walk-forward';

const n=(v:number)=>v.toFixed(1);
export default function HistoricalDemandCard(){
 const [hotel,setHotel]=useState('City Hotel');
 const [date,setDate]=useState('2016-09-01');
 const result=useMemo(()=>evaluateWalkForward(data.rows,hotel,'2016-09-01','2016-09-30'),[hotel]);
 const sample=result.samples.find(x=>x.date===date)!;
 const usable=result.selectedMae<result.baselineMae&&result.coverage>=0.8&&result.trainedDays>0;
 return <section className="panel historical-demand" aria-labelledby="historical-demand-title">
  <div className="historical-head"><div><span className="historical-kicker"><Activity size={14}/> HISTORICAL RESEARCH · 2016</span><h2 id="historical-demand-title">Does the demand forecast beat a baseline?</h2><p>Portugal hotel data · Gross booking records, not room-nights or TBO demand</p></div><span className="historical-status">{usable?'Historical test passed':'Historical test not passed'}</span></div>
  <div className="historical-controls"><label htmlFor="historical-hotel">Hotel <select id="historical-hotel" value={hotel} onChange={e=>setHotel(e.target.value)}><option>City Hotel</option><option>Resort Hotel</option></select></label><label htmlFor="historical-date">Historical as-of date <select id="historical-date" value={date} onChange={e=>setDate(e.target.value)}>{result.samples.map(p=><option key={p.date}>{p.date}</option>)}</select></label></div>
  <p className="historical-target">Estimate bookings in the next 7 days for stays arriving 30–59 days later. This is a historical replay, not a live forecast.</p>
  <div className="historical-metrics"><div><span>Retrospective estimate</span><strong>{n(sample.estimate)}</strong><small>{sample.method==='trained'?'Trained model':'Seven-day baseline'} selected using earlier results</small></div><div><span>Actual recorded</span><strong>{sample.actual}</strong><small>Bookings in the following 7 days</small></div><div><span>Illustrative 80% range</span><strong>{n(sample.lower)}–{n(sample.upper)}</strong><small>Not a guaranteed prediction interval</small></div></div>
  <div className="historical-validation"><strong>September holdout · {result.count} overlapping historical dates</strong><p>Adaptive approach MAE <b>{n(result.selectedMae)}</b> vs seven-day baseline <b>{n(result.baselineMae)}</b> booking records (lower is better). The trained model was selected on <b>{result.trainedDays} of {result.count}</b> dates; otherwise the baseline was used.</p><p>The nominal 80% range covered <b>{Math.round(result.coverage*100)}%</b> of outcomes. Windows overlap; coverage is descriptive, not a guarantee.</p></div>
  <p className="historical-warning"><strong>Not used in the allocation.</strong> {usable?'This retrospective result still requires independent validation and matching units before use.':'This result does not establish a reliable trained forecast or uncertainty range.'} The arrival-selected extract uses inferred booking dates and lacks searches, stockouts and reliable as-of cancellation labels. It cannot predict current Indian or TBO demand.</p>
  <a href="/research/hotel-cohort-method.md" target="_blank" rel="noreferrer">Data and evaluation method <ArrowRight size={14}/></a>
 </section>
}
