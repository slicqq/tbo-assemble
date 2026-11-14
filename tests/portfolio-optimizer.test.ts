import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { optimizePortfolio } from '../src/lib/portfolio-optimizer';
import { bestAtQuantity, createGreedyPlan, opportunities, timingFor, type Opportunity } from '../src/lib/procurement-core';
const asOf='2026-11-13';
function brute(items:Opportunity[],budget:number,risk:number):number{
 function search(index:number,left:number,score:number):number{
  if(index===items.length)return score;
  const o=items[index];let best=search(index+1,left,score);
  if(timingFor(o,asOf).expired)return best;
  for(let q=1;q<=o.capacity&&o.buy*q<=left;q++)best=Math.max(best,search(index+1,left-o.buy*q,score+bestAtQuantity(o,q,risk).objective));
  return best;
 }
 return search(0,budget,0);
}
test('bounded allocator and dual bound agree with exhaustive small cases',()=>{
 let seed=92821;function rand(){seed=(seed*16807)%2147483647;return seed/2147483647;}
 for(let k=0;k<60;k++){
  const items=Array.from({length:3},(_,i)=>({...opportunities[i],id:`case-${k}-${i}`,buy:Math.floor(rand()*19)+3,referencePrice:Math.floor(rand()*35)+6,capacity:Math.floor(rand()*5)+1,bookings:Math.floor(rand()*8),searches:Math.floor(rand()*100),existingStock:Math.floor(rand()*4),quoteExpiry:i===2&&k%9===0?'2026-11-01':'2026-12-01'}));
  const budget=Math.floor(rand()*90),risk=[0,.35,.8][k%3];const optimum=brute(items,budget,risk);const result=optimizePortfolio(items,budget,risk,{asOf});
  assert.ok(result.rows.reduce((s,r)=>s+r.spend,0)<=budget,`over budget ${k}`);
  assert.ok(result.objective>=result.baselineObjective-1e-6,`worse than greedy ${k}`);
  assert.ok(result.objective<=optimum+1e-6,`exceeds optimum ${k}`);
  assert.ok(result.upperBound+1e-6>=optimum,`invalid upper bound ${k}: ${result.upperBound} < ${optimum}`);
  assert.ok(result.gap>=0);
 }
});
test('larger cases remain feasible and no worse than the old greedy model',()=>{
 for(const budget of [0,50000,5000000,1000000000])for(const risk of [0,.35,.8]){
  const result=optimizePortfolio(opportunities,budget,risk,{asOf});const greedy=createGreedyPlan(opportunities,budget,risk,{asOf});
  assert.ok(result.rows.reduce((s,r)=>s+r.spend,0)<=budget);
  assert.ok(result.objective+1e-6>=greedy.reduce((s,r)=>s+r.objective,0));
  assert.ok(result.upperBound+1e-6>=result.objective);
  for(const r of result.rows)assert.ok(Number.isInteger(r.qty)&&r.qty>=0&&r.qty<=r.capacity);
 }
});
test('fractional prices and budgets do not exceed the hard budget',()=>{
 const rows=[{...opportunities[0],id:'decimal1',buy:1.01,referencePrice:4.31,capacity:300,quoteExpiry:'2026-12-20'}, {...opportunities[1],id:'decimal2',buy:1.13,referencePrice:4.67,capacity:300,quoteExpiry:'2026-12-20'}];
 for(const budget of [1,20.2,50.5,101,101.001,503.9]){
  const result=optimizePortfolio(rows,budget,.35,{asOf});
  assert.ok(result.rows.reduce((s,r)=>s+r.spend,0)<=budget);
  assert.ok(result.upperBound>=result.objective);
 }
});
