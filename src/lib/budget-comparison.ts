import {optimizePortfolio,planOptionsOf} from './portfolio-optimizer';
import type {Opportunity,PlanRow} from './procurement-core';

export type BudgetTotals={budget:number;spend:number;remaining:number;expectedProfit:number;lowProfit:number;objective:number;unsoldExposure:number;hotelUnits:number;flightUnits:number;selected:number};
export function budgetTotals(rows:PlanRow[],budget:number):BudgetTotals{
 const sums=rows.reduce((a,r)=>({spend:a.spend+r.spend,expectedProfit:a.expectedProfit+r.expectedProfit,lowProfit:a.lowProfit+r.downsideProfit,objective:a.objective+r.objective,unsoldExposure:a.unsoldExposure+r.unsoldExposure,hotelUnits:a.hotelUnits+(r.kind==='Hotel'?r.qty:0),flightUnits:a.flightUnits+(r.kind==='Flight'?r.qty:0),selected:a.selected+(r.qty>0?1:0)}),{spend:0,expectedProfit:0,lowProfit:0,objective:0,unsoldExposure:0,hotelUnits:0,flightUnits:0,selected:0});
 return {...sums,budget,remaining:Math.max(0,budget-sums.spend)};
}
/** Budget-only what-if: all items, risk, dates and model assumptions stay fixed.
 * The caller provides current unfiltered rows from the same inputs. */
export function compareBudgets(items:Opportunity[],currentRows:PlanRow[],budget:number,candidateBudget:number,risk:number,asOf:string){
 if(!Number.isInteger(budget)||budget<0||budget>1e9||!Number.isInteger(candidateBudget)||candidateBudget<0||candidateBudget>1e9)throw new Error('Budget must be a whole amount between ₹0 and ₹1,00,00,00,000.');
 if(!Number.isFinite(risk)||risk<0||risk>.8)throw new Error('Invalid risk setting.');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(asOf)||!Number.isFinite(Date.parse(asOf+'T00:00:00Z'))||new Date(asOf+'T00:00:00Z').toISOString().slice(0,10)!==asOf)throw new Error('Invalid review date.');
 const plan=candidateBudget===budget?{rows:currentRows}:optimizePortfolio(items,candidateBudget,risk,{asOf,...planOptionsOf(currentRows)});
 const before=new Map(currentRows.map(row=>[row.id,row]));
 return {current:budgetTotals(currentRows,budget),candidate:budgetTotals(plan.rows,candidateBudget),changes:plan.rows.map(row=>({id:row.id,name:row.name,destination:row.destination,kind:row.kind,period:row.period,before:before.get(row.id)?.qty??0,after:row.qty,price:row.price,timing:row.purchaseTiming})).filter(row=>row.before!==row.after).sort((a,b)=>Math.abs(b.after-b.before)-Math.abs(a.after-a.before)||a.name.localeCompare(b.name))};
}
