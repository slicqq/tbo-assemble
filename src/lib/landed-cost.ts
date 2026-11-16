import {engineOf,optimizePortfolio} from './portfolio-optimizer';
import type {Opportunity,PlanRow} from './procurement-core';

export type LandedCostSettings={itemId:string;percent:number;perUnit:number};
/** A hypothetical added cost on one item. Added charges are non-recoverable.
 * No inputs are mutated and no assumption is made about actual tax rules. */
export function compareLandedCost(items:Opportunity[],baseRows:PlanRow[],budget:number,risk:number,asOf:string,settings:LandedCostSettings){
 if(!Number.isFinite(settings.percent)||settings.percent<0||settings.percent>100||!Number.isFinite(settings.perUnit)||settings.perUnit<0||settings.perUnit>1000000)throw new Error('Invalid landed cost assumptions');
 const target=items.find(x=>x.id===settings.itemId);if(!target)throw new Error('Inventory item no longer exists');
 const added=target.buy*settings.percent/100+settings.perUnit;
 const landed=target.buy+added;
 const changed=items.map(item=>item.id!==target.id?item:{...item,buy:landed,recoveryPct:item.buy*(item.recoveryPct??0)/landed});
 const scenario=settings.percent===0&&settings.perUnit===0?baseRows:optimizePortfolio(changed,budget,risk,{asOf,engine:engineOf(baseRows)}).rows;
 const totals=(rows:PlanRow[])=>rows.reduce((a,r)=>({spend:a.spend+r.spend,profit:a.profit+r.expectedProfit,downside:a.downside+r.downsideProfit,objective:a.objective+r.objective}),{spend:0,profit:0,downside:0,objective:0});
 return {target,landed,added,baseline:totals(baseRows),scenario:totals(scenario),rows:scenario,changes:scenario.map(row=>({row,old:baseRows.find(r=>r.id===row.id)}))};
}
