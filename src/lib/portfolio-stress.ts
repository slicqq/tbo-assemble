import {evaluateAtPrice,type Opportunity,type PlanRow} from './procurement-core';
import {optimizePortfolio} from './portfolio-optimizer';

export type StressSettings={demandPercent:number;pricePercent:number;newQuotePercent:number;cancellationPoints:number};
export const noStress:StressSettings={demandPercent:0,pricePercent:0,newQuotePercent:0,cancellationPoints:0};
type Metrics={spend:number;units:number;expectedProfit:number;downsideProfit:number;unsoldExposure:number;expectedUnsold:number};
const clamp=(x:number,min:number,max:number)=>Number.isFinite(x)?Math.min(max,Math.max(min,x)):0;
function summarize(rows:{spend:number;qty:number;expectedProfit:number;downsideProfit:number;unsoldExposure:number;expectedUnsold:number}[]):Metrics{return rows.reduce((a,r)=>({spend:a.spend+r.spend,units:a.units+r.qty,expectedProfit:a.expectedProfit+r.expectedProfit,downsideProfit:a.downsideProfit+r.downsideProfit,unsoldExposure:a.unsoldExposure+r.unsoldExposure,expectedUnsold:a.expectedUnsold+r.expectedUnsold}),{spend:0,units:0,expectedProfit:0,downsideProfit:0,unsoldExposure:0,expectedUnsold:0});}
/** Scenario sandbox, NOT an execution or live supplier quote. Existing committed
 * unit costs stay locked; changed quote costs apply only to the replanned case. */
export function simulatePortfolioStress(baseRows:PlanRow[],budget:number,risk:number,asOf:string,settings:StressSettings){
 const demand=clamp(settings.demandPercent,-50,50),price=clamp(settings.pricePercent,-30,30),quote=clamp(settings.newQuotePercent,-30,30),cancel=clamp(settings.cancellationPoints,0,30);
 const stressed=(o:Opportunity,newQuote:boolean):Opportunity=>({...o,seasonal:o.seasonal*(1+demand/100),referencePrice:o.referencePrice*(1+price/100),buy:newQuote?o.buy*(1+quote/100):o.buy,cancellations:Math.min(1,o.cancellations+cancel/100)});
 const fixedRows=baseRows.map(row=>{const item=stressed(row,false),salePrice=Math.max(1,Math.round(row.price*(1+price/100))),calc=evaluateAtPrice(item,row.qty,salePrice,risk);return {id:row.id,name:row.name,period:row.period,qty:row.qty,price:salePrice,spend:row.spend,...calc,originalExpectedProfit:row.expectedProfit,delta:calc.expectedProfit-row.expectedProfit};});
 const baseline=summarize(baseRows),fixed=summarize(fixedRows);
 const replannedRows=demand===0&&price===0&&quote===0&&cancel===0?baseRows:optimizePortfolio(baseRows.map(row=>stressed(row,true)),budget,risk,{asOf}).rows;
 const replanned=summarize(replannedRows);
 return {baseline,fixed,replanned,exposures:fixedRows.filter(r=>r.qty>0).sort((a,b)=>a.delta-b.delta),replannedRows};
}
