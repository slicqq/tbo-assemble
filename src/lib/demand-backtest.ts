import {parseCSV} from './inventory-csv';
import {forecast,trendFactor,type Opportunity} from './procurement-core';

/** One retrospective snapshot per non-overlapping travel period for the SAME product.
 * The importer cannot verify whether the declared historical inputs were actually
 * available then, or whether realized sales represent unconstrained demand. */
export type DemandObservation={opportunityId:string;unit:'room_nights'|'seats';asOf:string;periodStart:string;periodEnd:string;outcomeAvailableOn:string;bookings:number;previousBookings:number;searches:number;previousSearches:number;conversion:number;seasonal:number;signal:number;cancellations:number;soldOut:number;priorNetUnits:number;actualNetUnits:number};
const columns=['opportunity_id','unit','as_of','period_start','period_end','outcome_available_on','bookings','previous_bookings','searches','previous_searches','conversion','seasonal','signal','cancellations','sold_out','prior_net_units','actual_net_units'] as const;
const date=(s:string)=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&s>='1900-01-01'&&s<='2100-12-31'&&Number.isFinite(Date.parse(s+'T00:00:00Z'))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
export function readDemandBacktestCSV(text:string):DemandObservation[]{
 const rows=parseCSV(text.replace(/^\uFEFF/,''));if(rows.length<2)throw new Error('Include a header and at least one observation.');if(rows.length>1001)throw new Error('Maximum 1,000 observations.');
 const h=rows[0];if(new Set(h).size!==h.length||columns.some(k=>!h.includes(k)))throw new Error('Missing or duplicate columns. Download the validation template.');
 const observations=rows.slice(1).map((v,i)=>{const label=`Row ${i+2}`;if(v.length!==h.length)throw new Error(`${label}: column count differs from the header.`);const r=Object.fromEntries(h.map((key,j)=>[key,v[j]]));
  if(!r.opportunity_id||r.opportunity_id.length>120)throw new Error(`${label}: opportunity_id is required and must be at most 120 characters.`);
  if(r.unit!=='room_nights'&&r.unit!=='seats')throw new Error(`${label}: unit must be room_nights or seats.`);
  for(const k of ['as_of','period_start','period_end','outcome_available_on'])if(!date(r[k]))throw new Error(`${label}: ${k} must be a valid YYYY-MM-DD date.`);
  if(r.as_of>=r.period_start||r.period_end<r.period_start||r.outcome_available_on<r.period_end)throw new Error(`${label}: as_of must precede the period and the outcome must be available no earlier than period end.`);
  function n(key:string,max:number){if(!r[key]||!Number.isFinite(Number(r[key]))||Number(r[key])<0||Number(r[key])>max)throw new Error(`${label}: ${key} must be a number between 0 and ${max}.`);return Number(r[key])}
  return {opportunityId:r.opportunity_id,unit:r.unit as 'room_nights'|'seats',asOf:r.as_of,periodStart:r.period_start,periodEnd:r.period_end,outcomeAvailableOn:r.outcome_available_on,bookings:n('bookings',1e6),previousBookings:n('previous_bookings',1e6),searches:n('searches',1e7),previousSearches:n('previous_searches',1e7),conversion:n('conversion',1),seasonal:n('seasonal',5),signal:n('signal',5),cancellations:n('cancellations',1),soldOut:n('sold_out',100),priorNetUnits:n('prior_net_units',1e6),actualNetUnits:n('actual_net_units',1e6)};
 });
 if(new Set(observations.map(r=>r.opportunityId)).size!==1)throw new Error('Use one opportunity_id per file; unrelated products cannot be pooled.');
 if(new Set(observations.map(r=>r.unit)).size!==1)throw new Error('Use one consistent unit per file.');
 const days=(a:string,b:string)=>(Date.parse(a+'T00:00:00Z')-Date.parse(b+'T00:00:00Z'))/86400000;
 if(new Set(observations.map(r=>days(r.periodEnd,r.periodStart))).size!==1||new Set(observations.map(r=>days(r.periodStart,r.asOf))).size!==1)throw new Error('All periods must have the same duration and same snapshot lead time.');
 const ordered=[...observations].sort((a,b)=>a.periodStart.localeCompare(b.periodStart));
 for(let i=1;i<ordered.length;i++)if(ordered[i].periodStart<=ordered[i-1].periodEnd)throw new Error('Travel periods must not overlap or repeat. Use one snapshot per non-overlapping period.');
 return observations;
}
function opportunity(r:DemandObservation):Opportunity{return {id:r.opportunityId,name:r.opportunityId,destination:'',kind:'Hotel',period:'',buy:1,referencePrice:1,capacity:0,bookings:r.bookings,previousBookings:r.previousBookings,searches:r.searches,previousSearches:r.previousSearches,conversion:r.conversion,seasonal:r.seasonal,signal:r.signal,cancellations:r.cancellations,soldOut:r.soldOut,volatility:0,integration:'',timing:''}}
function fitted(r:DemandObservation,weight:number){const o=opportunity(r);return Math.max(0,(r.bookings*weight+r.searches*r.conversion*(1-weight))*trendFactor(o)*r.seasonal*r.signal*(1+r.soldOut/100*.2)*(1-r.cancellations));}
const avg=(v:number[])=>v.reduce((a,b)=>a+b,0)/v.length;
export type BacktestResult={opportunityId:string;unit:'room_nights'|'seats';evaluationDate:string;trainCount:number;testCount:number;excludedFuture:number;purged:number;weight:number;testStart:string;trainLatestOutcome:string;baselineMae:number;currentMae:number;fittedMae:number;baselineWape:number|null;currentWape:number|null;fittedWape:number|null;sample: {asOf:string;periodStart:string;periodEnd:string;actual:number;baseline:number;current:number;fitted:number}[]};
/** Chronological locked holdout. The weight is fitted only on outcomes that were
 * available BEFORE the first holdout snapshot. Holdout never tunes the weight. */
export function evaluateDemandBacktest(rows:DemandObservation[],evaluationDate:string):BacktestResult {
 if(!date(evaluationDate))throw new Error('Choose a valid evaluation date.');
 const eligible=rows.filter(r=>r.outcomeAvailableOn<=evaluationDate&&r.asOf<=evaluationDate).sort((a,b)=>a.asOf.localeCompare(b.asOf)||a.periodStart.localeCompare(b.periodStart));
 const testCount=Math.max(8,Math.ceil(eligible.length*.25)),test=eligible.slice(-testCount),before=eligible.slice(0,-testCount);
 if(test.length<8)throw new Error('At least 8 completed holdout observations are required.');
 const testStart=test[0].asOf;const train=before.filter(r=>r.outcomeAvailableOn<testStart);
 if(train.length<20)throw new Error('At least 20 training outcomes must be available before the first holdout snapshot. Add earlier completed periods.');
 // 21 predetermined candidate weights, optimized using training MAE only.
 let weight=0,best=Infinity;for(let i=0;i<=20;i++){const w=i/20,e=avg(train.map(r=>Math.abs(fitted(r,w)-r.actualNetUnits)));if(e<best-1e-10){best=e;weight=w}}
 const sample=test.map(r=>({asOf:r.asOf,periodStart:r.periodStart,periodEnd:r.periodEnd,actual:r.actualNetUnits,baseline:r.priorNetUnits,current:forecast(opportunity(r)),fitted:fitted(r,weight)}));
 const errors=(key:'baseline'|'current'|'fitted')=>sample.map(r=>Math.abs(r[key]-r.actual));
 const total=sample.reduce((s,r)=>s+r.actual,0),wape=(key:'baseline'|'current'|'fitted')=>total>0?errors(key).reduce((a,b)=>a+b,0)/total:null;
 return {opportunityId:rows[0].opportunityId,unit:rows[0].unit,evaluationDate,trainCount:train.length,testCount:test.length,excludedFuture:rows.length-eligible.length,purged:before.length-train.length,weight,testStart,trainLatestOutcome:train.map(r=>r.outcomeAvailableOn).sort().at(-1)!,baselineMae:avg(errors('baseline')),currentMae:avg(errors('current')),fittedMae:avg(errors('fitted')),baselineWape:wape('baseline'),currentWape:wape('current'),fittedWape:wape('fitted'),sample};
}
export const demandBacktestTemplate=[columns.join(','),'sample-goa,room_nights,2025-01-03,2025-01-10,2025-01-16,2025-01-17,125,110,3100,2800,0.045,1.18,1.08,0.12,24,110,120'].join('\n');
/** Fully synthetic, constructed to exercise the validation interface. */
export function syntheticDemandBacktestCSV():string {
 const add=(base:string,days:number)=>new Date(Date.parse(base+'T00:00:00Z')+days*86400000).toISOString().slice(0,10);
 const lines=[columns.join(',')];
 for(let i=0;i<48;i++){
  const start=add('2024-01-08',i*7),end=add(start,6),asOf=add(start,-2),available=add(end,1);
  const bookings=45+(i*13)%55,searches=1000+(i*791)%4500,actual=Math.round(bookings*.2+searches*.05*.8);
  // Chosen deliberately to show a readable test, not random market data.
  const prior=80+(i*19)%65;
  lines.push(['synthetic-hotel','room_nights',asOf,start,end,available,bookings,bookings,searches,searches,.05,1,1,0,0,prior,actual].join(','));
 }
 return lines.join('\n');
}
