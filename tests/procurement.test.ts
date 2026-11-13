import assert from 'node:assert/strict';
import {createPlan,forecast,opportunities} from '../src/lib/procurement';
for (const budget of [0, 5000, 100000, 5000000, 100000000]) for (const risk of [0, .35, .8]) {
 const plan=createPlan(opportunities,budget,risk);
 assert.ok(plan.reduce((a,r)=>a+r.spend,0)<=budget,`budget ${budget}`);
 for (const r of plan) {assert.ok(Number.isInteger(r.qty) && r.qty>=0 && r.qty<=r.capacity);assert.equal(r.spend,r.qty*r.buy);assert.ok(Number.isFinite(r.expectedProfit));assert.ok(r.expectedSold<=r.qty+1e-9);assert.ok(r.downsideProfit<=r.expectedProfit+1e-8);}
}
assert.equal(createPlan(opportunities,0,.35).reduce((a,r)=>a+r.qty,0),0);
assert.equal(createPlan([],100,.5).length,0);
const item=opportunities[0];assert.ok(forecast({...item,cancellations:.5})<forecast({...item,cancellations:0}));
const bad={...item,buy:1000000,referencePrice:100};assert.equal(createPlan([bad],1e8,0)[0].qty,0);
console.log('Procurement invariants passed');
const asOf='2026-11-13';const input={...opportunities[0],quoteExpiry:'2026-11-20',existingStock:0,recoveryPct:0};
const noStock=createPlan([input],1e7,.35,{asOf})[0];
const withStock=createPlan([{...input,existingStock:50}],1e7,.35,{asOf})[0];
assert.ok(withStock.qty<=noStock.qty, 'existing stock should not increase purchases');
const expired=createPlan([{...input,quoteExpiry:'2026-11-12'}],1e7,.35,{asOf})[0];
assert.equal(expired.qty,0);assert.equal(expired.purchaseTiming,'Quote expired');
const urgent=createPlan([input],1e7,.35,{asOf})[0];assert.equal(urgent.purchaseTiming,'Review now');
const negotiation=createPlan([{...input,quoteExpiry:'2026-12-20',previousBuy:4000}],1e7,.35,{asOf})[0];assert.equal(negotiation.purchaseTiming,'Negotiate');
assert.ok(noStock.expectedUnsold>=-1e-8);assert.ok(noStock.unsoldExposure>=-1e-8);assert.ok(noStock.upsideProfit>=noStock.baseProfit&&noStock.baseProfit>=noStock.downsideProfit);
const recovery=createPlan([{...input,recoveryPct:.5}],1e7,.35,{asOf})[0];assert.ok(recovery.expectedProfit>=noStock.expectedProfit-1e-8);
console.log('Stock, quote timing and scenario checks passed');
const recent={...input,bookings:100,searches:2000};
assert.ok(forecast({...recent,previousBookings:80,previousSearches:1500})>forecast(recent));
assert.ok(forecast({...recent,previousBookings:120,previousSearches:2500})<forecast(recent));
