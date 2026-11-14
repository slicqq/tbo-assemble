import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {opportunities,minimumPurchase,purchaseCost,bestAtQuantity,evaluateAtPrice,timingFor,type Opportunity} from '../src/lib/procurement-core';
import {optimizePortfolio} from '../src/lib/portfolio-optimizer';
import {validatePlanInput} from '../src/lib/private-plan';
import {readInventoryCSV,columns} from '../src/lib/inventory-csv';
import {noStress,simulatePortfolioStress} from '../src/lib/portfolio-stress';
const asOf='2026-11-13';
function brute(items:Opportunity[],budget:number,risk:number):number{
 function go(i:number,left:number,score:number):number{if(i===items.length)return score;const o=items[i];let best=go(i+1,left,score);if(timingFor(o,asOf).expired)return best;for(let q=minimumPurchase(o);q<=o.capacity;q++){const cost=purchaseCost(o,q);if(cost<=left)best=Math.max(best,go(i+1,left-cost,score+bestAtQuantity(o,q,risk).objective))}return best}return go(0,budget,0);
}
test('minimums and nonrefundable fee count in objective and budget, including zero and exact boundary',()=>{
 const item={...opportunities[0],buy:100,referencePrice:500,capacity:8,bookings:100,searches:5000,existingStock:0,volatility:0,quoteExpiry:'2026-12-01',minOrderUnits:3,fixedOrderFee:50};
 const none=optimizePortfolio([item],349,.35,{asOf});assert.equal(none.rows[0].qty,0);assert.equal(none.rows[0].spend,0);assert.equal(none.rows[0].expectedProfit,0);
 const yes=optimizePortfolio([item],350,.35,{asOf});assert.equal(yes.rows[0].qty,3);assert.equal(yes.rows[0].spend,350);
 assert.equal(evaluateAtPrice(item,3,500,0).expectedProfit,1150);assert.equal(evaluateAtPrice(item,0,500,0).expectedProfit,0);
 const expired=optimizePortfolio([{...item,quoteExpiry:'2026-11-01'}],10000,.35,{asOf});assert.equal(expired.rows[0].qty,0);
 const neutral=simulatePortfolioStress(yes.rows,350,.35,asOf,noStress);assert.equal(neutral.fixed.spend,350);assert.equal(neutral.fixed.expectedProfit,yes.rows[0].expectedProfit);
 const shocked=simulatePortfolioStress(yes.rows,350,.35,asOf,{...noStress,newQuotePercent:25});assert.equal(shocked.fixed.spend,350);assert.equal(shocked.replanned.units,0);
});
test('constrained budget-grid output remains feasible and dual bound covers exact tiny optimum',()=>{
 let seed=613;const rand=()=>((seed=seed*16807%2147483647)/2147483647);
 for(let k=0;k<120;k++){
  const items=Array.from({length:3},(_,i)=>{const capacity=Math.floor(rand()*5)+1;return {...opportunities[i],id:`contract-${k}-${i}`,buy:Math.floor(rand()*18)+2,referencePrice:Math.floor(rand()*45)+5,capacity,minOrderUnits:1+Math.floor(rand()*capacity),fixedOrderFee:Math.floor(rand()*20),bookings:Math.floor(rand()*9),searches:Math.floor(rand()*90),existingStock:0,quoteExpiry:i===2&&k%11===0?'2026-11-01':'2026-12-01'}});
  const budget=Math.floor(rand()*120),risk=[0,.35,.8][k%3];const optimum=brute(items,budget,risk);const result=optimizePortfolio(items,budget,risk,{asOf});
  assert.ok(result.rows.reduce((s,r)=>s+r.spend,0)<=budget,`budget ${k}`);for(const row of result.rows){assert.ok(row.qty===0||row.qty>=(row.minOrderUnits??1));assert.ok(row.qty<=row.capacity);assert.equal(row.spend,purchaseCost(row,row.qty))}
  assert.ok(result.objective<=optimum+1e-6,`objective ${k}`);assert.ok(result.upperBound+1e-6>=optimum,`bound ${k}`);assert.ok(result.objective>=result.baselineObjective-1e-6);
 }
});
test('CSV/API and saved plan validation preserve optional terms and reject invalid values',()=>{
 const base={items:[{...opportunities[0],minOrderUnits:5,fixedOrderFee:150.25}],budget:100000,risk:.35,asOf,source:'uploaded'};
 const validated=validatePlanInput(base);assert.equal(validated.items[0].minOrderUnits,5);assert.equal(validated.items[0].fixedOrderFee,150.25);
 for(const item of [{minOrderUnits:0},{minOrderUnits:2.5},{minOrderUnits:161},{minOrderUnits:-1},{fixedOrderFee:-1},{fixedOrderFee:10000001},{fixedOrderFee:Infinity}])assert.throws(()=>validatePlanInput({...base,items:[{...base.items[0],...item}]}));
 const rows=columns.map(k=>String(opportunities[0][k]??''));const old=readInventoryCSV([columns.join(','),rows.join(',')].join('\n'));assert.equal(old[0].minOrderUnits,undefined);assert.equal(old[0].fixedOrderFee,undefined);
});
test('decimal unit prices and fixed fees never exceed budget or break minimums',()=>{
 const item={...opportunities[0],id:'fractional-terms',buy:1.01,referencePrice:9,capacity:100,minOrderUnits:7,fixedOrderFee:2.09,quoteExpiry:'2026-12-01'};
 for(const budget of [0,9.15,9.16,9.17,10,20.21,50.33,101.11,500]){
  const r=optimizePortfolio([item],budget,.35,{asOf});const row=r.rows[0];assert.ok(row.spend<=budget,`overspent ${budget}: ${row.spend}`);assert.ok(row.qty===0||row.qty>=7);assert.equal(row.spend,purchaseCost(item,row.qty));assert.ok(r.upperBound>=r.objective);
 }
});
