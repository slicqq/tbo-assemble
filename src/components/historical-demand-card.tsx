'use client';
import {useMemo,useState} from 'react';
import {Activity, ArrowRight} from 'lucide-react';
import data from '@/data/public-hotel-cohorts.json';
import {assessHotelCohorts} from '@/lib/hotel-cohort-forecast';

const n=(v:number)=>v.toFixed(1);
export default function HistoricalDemandCard(){
 const [hotel,setHotel]=useState('City Hotel');
 const [date,setDate]=useState('2016-06-01');
 const result=useMemo(()=>assessHotelCohorts(data.rows,hotel),[hotel]);
 const sample=result.predictions.find(x=>x.date===date)!;
 const beat=result.chosen==='trained' && result.modelMae<result.baselineMae;
 const coverageOk=result.coverage>=0.8;
 const usable=beat&&coverageOk;
 return <section className="panel historical-demand" aria-labelledby="historical-demand-title">
  <div className="historical-head"><div><span className="historical-kicker"><Activity size={14}/> HISTORICAL RESEARCH · 2016</span><h2 id="historical-demand-title">Can a trained model predict bookings?</h2><p>Portugal hotel data · Gross booking records, not room-nights or TBO demand</p></div><span className="historical-status">{usable?'Research gate passed':'Research gate not passed'}</span></div>
  <div className="historical-controls"><label htmlFor="historical-hotel">Hotel <select id="historical-hotel" value={hotel} onChange={e=>setHotel(e.target.value)}><option>City Hotel</option><option>Resort Hotel</option></select></label><label htmlFor="historical-date">Historical as-of date <select id="historical-date" value={date} onChange={e=>setDate(e.target.value)}>{result.predictions.map(p=><option key={p.date}>{p.date}</option>)}</select></label></div>
  <p className="historical-target">At this date, estimate bookings recorded in the next 7 days for stays arriving 30–59 days later. Historical replay only.</p>
  <div className="historical-metrics"><div><span>Retrospective estimate</span><strong>{n(sample.estimate)}</strong><small>{result.chosen==='trained'?'Trained model':'Seven-day baseline'} selected before test</small></div><div><span>Actual recorded</span><strong>{sample.actual}</strong><small>Bookings in the following 7 days</small></div><div><span>Illustrative 80% range</span><strong>{n(sample.lower)}–{n(sample.upper)}</strong><small>Not reliable if holdout coverage is low</small></div></div>
  <div className="historical-validation"><strong>June holdout · {result.testCount} historical dates</strong><p>Trained model MAE <b>{n(result.modelMae)}</b> vs seven-day baseline <b>{n(result.baselineMae)}</b> booking records. Selected method: {result.chosen==='trained'?'trained model':'baseline'} (chosen on May calibration, before June). Selected-method MAE: <b>{n(result.selectedMae)}</b>.</p><p>The nominal 80% range covered <b>{Math.round(result.coverage*100)}%</b> of June outcomes. Overlapping date windows are not independent; coverage is descriptive, not a guarantee.</p></div>
  <p className="historical-warning"><strong>Not used in the allocation.</strong> {usable?'This historical result still requires independent validation and matching units before use.':'This evaluation does not establish a reliable trained forecast or uncertainty range.'} The source is an old, arrival-selected extract with inferred booking dates; it lacks searches, stockouts and reliable as-of cancellation labels. It cannot predict current Indian or TBO demand.</p>
  <a href="/research/hotel-cohort-method.md" target="_blank" rel="noreferrer">Data and evaluation method <ArrowRight size={14}/></a>
 </section>
}
