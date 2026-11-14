'use client';
import {useMemo,useState} from 'react';
import {Activity,RotateCcw} from 'lucide-react';
import {noStress,simulatePortfolioStress,type StressSettings} from '@/lib/portfolio-stress';
import type {PlanRow} from '@/lib/procurement-core';
const money=(n:number)=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(n);
const signed=(n:number)=>`${n>0?'+':n<0?'−':''}${money(Math.abs(n))}`;
function StressForm({rows,budget,risk,asOf}:{rows:PlanRow[];budget:number;risk:number;asOf:string}){
 const [inputs,setInputs]=useState<StressSettings>(noStress),[applied,setApplied]=useState<StressSettings>(noStress);
 const result=useMemo(()=>simulatePortfolioStress(rows,budget,risk,asOf,applied),[rows,budget,risk,asOf,applied]);
 const changed=(key:keyof StressSettings,value:number)=>setInputs(s=>({...s,[key]:value}));
 const controls=[{key:'demandPercent' as const,title:'Demand level',min:-50,max:50,unit:'%',help:'Changes modeled demand before stock and pricing.'},{key:'pricePercent' as const,title:'Selling price level',min:-30,max:30,unit:'%',help:'Shifts modeled sale and reference prices together.'},{key:'newQuotePercent' as const,title:'New supplier quote',min:-30,max:30,unit:'%',help:'Applies only to a new plan, not locked purchase costs.'},{key:'cancellationPoints' as const,title:'Cancellation increase',min:0,max:30,unit:' pp',help:'Added to the assumed cancellation rate; capped at 100%.'}];
 const columns=[{name:'Original model plan',data:result.baseline},{name:'If quantities are committed',data:result.fixed},{name:'Replan before buying',data:result.replanned}];
 const declines=result.exposures.filter(r=>r.delta<-.01).slice(0,3);
 return <div className="stress-body"><p className="stress-intro">Test a hypothetical change across every opportunity. The middle column assumes the original quantities and purchase prices are locked; the last column reallocates the same budget before buying. No supplier quote is fetched and no purchase is made.</p>
 <div className="stress-controls">{controls.map(c=><div key={c.key}><label htmlFor={`stress-${c.key}`}>{c.title} <strong>{inputs[c.key]>0?'+':''}{inputs[c.key]}{c.unit}</strong></label><input id={`stress-${c.key}`} type="range" min={c.min} max={c.max} step="1" value={inputs[c.key]} onChange={e=>changed(c.key,Number(e.target.value))}/><small>{c.help}</small></div>)}</div>
 <div className="stress-actions"><button className="import-button" type="button" onClick={()=>setApplied({...inputs})}>Run stress test</button><button className="outline-button" type="button" onClick={()=>{setInputs(noStress);setApplied(noStress)}}><RotateCcw size={14}/> Reset</button><span>Applied: demand {applied.demandPercent>0?'+':''}{applied.demandPercent}% · selling price {applied.pricePercent>0?'+':''}{applied.pricePercent}% · new quote {applied.newQuotePercent>0?'+':''}{applied.newQuotePercent}% · cancellations +{applied.cancellationPoints} pp</span></div>
 <div className="stress-grid">{columns.map(c=><div key={c.name}><h3>{c.name}</h3><dl><div><dt>Modeled expected profit</dt><dd>{money(c.data.expectedProfit)}</dd></div><div><dt>Low-scenario profit</dt><dd>{money(c.data.downsideProfit)}</dd></div><div><dt>Expected unsold exposure</dt><dd>{money(c.data.unsoldExposure)}</dd></div><div><dt>Units / purchase cost</dt><dd>{c.data.units} · {money(c.data.spend)}</dd></div></dl></div>)}</div>
 <div className="stress-declines"><h3>Largest modeled declines in the committed plan</h3>{declines.length?<ul>{declines.map(row=><li key={row.id}><span>{row.name} · {row.period} <small>({row.qty} units)</small></span><strong>{signed(row.delta)}</strong></li>)}</ul>:<p>No modeled declines under the applied scenario.</p>}</div>
 <p className="stress-disclaimer"><strong>Illustrative only.</strong> Demand and price responses, scenario probabilities, cancellation and recovery are unvalidated assumptions. A selling-price shock shifts the reference and planned price together; relative price elasticity is therefore mostly unchanged apart from rounding. New quote costs affect only the hypothetical replan. Supplied minimums and fixed fees are included; fixed fees remain unchanged by quote shocks. Unsold exposure excludes the fixed fee. These figures exclude refunds, taxes and contractual penalties. A replan is a comparison—not a guaranteed improvement or an actual order. <a href="/research/portfolio-stress.md" target="_blank" rel="noreferrer">Method and limitations</a></p>
 </div>;
}
export default function PortfolioStress(props:{rows:PlanRow[];budget:number;risk:number;asOf:string}){
 const [open,setOpen]=useState(false);
 return <section className="panel stress-panel" aria-labelledby="stress-title"><details onToggle={e=>setOpen(e.currentTarget.open)}><summary><div className="control-icon"><Activity size={18}/></div><div><h2 id="stress-title">Stress-test your decision</h2><p>Compare a hypothetical committed plan with a fresh allocation under demand, price and cancellation changes.</p></div><span>{open?'Close':'Open scenario'}</span></summary>{open&&<StressForm {...props}/>}</details></section>;
}
