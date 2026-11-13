/** Deterministic illustrative model. Not calibrated to TBO data. */
export type Opportunity = { id:string; name:string; destination:string; kind:'Hotel'|'Flight'; period:string; buy:number; referencePrice:number; capacity:number; bookings:number; searches:number; conversion:number; seasonal:number; signal:number; cancellations:number; volatility:number; soldOut:number; integration:string; timing:string; existingStock?:number; recoveryPct?:number; previousBuy?:number; quoteExpiry?:string; previousBookings?:number; previousSearches?:number };
export const opportunities: Opportunity[] = [
 {id:'goa',quoteExpiry:'2026-11-18',previousBuy:6900,previousBookings:108,previousSearches:2650,existingStock:12,recoveryPct:.15,name:'North Goa beach hotels',destination:'Goa',kind:'Hotel',period:'Dec 2026',buy:6400,referencePrice:9200,capacity:160,bookings:125,searches:3100,conversion:.045,seasonal:1.18,signal:1.08,cancellations:.12,volatility:.28,soldOut:24,integration:'Direct contract',timing:'Buy now'},
 {id:'dubai',quoteExpiry:'2026-12-10',previousBuy:7300,previousBookings:90,previousSearches:2450,existingStock:5,recoveryPct:.2,name:'Dubai city hotels',destination:'Dubai',kind:'Hotel',period:'Jan 2027',buy:8200,referencePrice:11700,capacity:135,bookings:102,searches:2500,conversion:.046,seasonal:1.12,signal:1.06,cancellations:.1,volatility:.24,soldOut:18,integration:'Supplier API',timing:'Buy now'},
 {id:'bali',quoteExpiry:'2026-12-15',previousBuy:7100,previousBookings:92,previousSearches:2150,existingStock:6,recoveryPct:.25,name:'Bali resort collection',destination:'Bali',kind:'Hotel',period:'Feb 2027',buy:7100,referencePrice:10600,capacity:125,bookings:88,searches:2200,conversion:.043,seasonal:1.08,signal:1.10,cancellations:.14,volatility:.32,soldOut:16,integration:'Direct contract',timing:'Negotiate now'},
 {id:'del',quoteExpiry:'2026-11-25',previousBuy:14500,existingStock:8,recoveryPct:.1,name:'Delhi → Dubai',destination:'Dubai',kind:'Flight',period:'Dec 2026',buy:14800,referencePrice:19200,capacity:100,bookings:82,searches:1950,conversion:.046,seasonal:1.13,signal:1.05,cancellations:.08,volatility:.22,soldOut:21,integration:'Airline allotment',timing:'Buy now'},
 {id:'jaipur',name:'Jaipur heritage stays',destination:'Jaipur',kind:'Hotel',period:'Jan 2027',buy:5100,referencePrice:7600,capacity:150,bookings:93,searches:1800,conversion:.045,seasonal:1.10,signal:1.04,cancellations:.11,volatility:.26,soldOut:11,integration:'Supplier API',timing:'Negotiate now'},
 {id:'singapore',name:'Mumbai → Singapore',destination:'Singapore',kind:'Flight',period:'Feb 2027',buy:17400,referencePrice:22600,capacity:85,bookings:65,searches:1550,conversion:.045,seasonal:1.05,signal:1.03,cancellations:.07,volatility:.25,soldOut:12,integration:'Airline allotment',timing:'Monitor'},
 {id:'kerala',name:'Kerala backwater stays',destination:'Kerala',kind:'Hotel',period:'Feb 2027',buy:5800,referencePrice:8400,capacity:130,bookings:76,searches:1650,conversion:.044,seasonal:1.08,signal:1.02,cancellations:.13,volatility:.30,soldOut:10,integration:'Direct contract',timing:'Monitor'},
 {id:'bangkok',name:'Bangkok city hotels',destination:'Bangkok',kind:'Hotel',period:'Dec 2026',buy:4600,referencePrice:6900,capacity:150,bookings:89,searches:2100,conversion:.044,seasonal:1.15,signal:1.07,cancellations:.15,volatility:.31,soldOut:19,integration:'Supplier API',timing:'Buy now'},
];
export type PlanRow = Opportunity & { forecast:number; price:number; qty:number; spend:number; expectedProfit:number; downsideProfit:number; baseProfit:number; upsideProfit:number; expectedSold:number; expectedUnsold:number; unsoldExposure:number; objective:number; purchaseTiming:string; timingReason:string; strategy:string; strategyReason:string };
export type PlanOptions = { asOf?:string };
const dayMs=86400000;
export function timingFor(o:Opportunity, asOf:string) {
 if (!o.quoteExpiry) return {purchaseTiming:'Verify quote', timingReason:'No expiry date supplied; confirm the quote before buying.', expired:false};
 const days=Math.round((Date.parse(o.quoteExpiry+'T00:00:00Z')-Date.parse(asOf+'T00:00:00Z'))/dayMs);
 if(days<0)return {purchaseTiming:'Quote expired',timingReason:`Quote expired on ${o.quoteExpiry}; refresh the supplier quote.`,expired:true};
 if(days<=7)return {purchaseTiming:'Review now',timingReason:`Quote expires in ${days} day${days===1?'':'s'}; validate and decide before expiry.`,expired:false};
 if(o.previousBuy && o.buy>o.previousBuy*1.1)return {purchaseTiming:'Negotiate',timingReason:'Current cost is more than 10% above the previous quote.',expired:false};
 return {purchaseTiming:'Monitor quote',timingReason:`Quote expires ${o.quoteExpiry}; compare future quotes before deciding.`,expired:false};
}
export function trendFactor(o:Opportunity) {
 const bookingChange=o.previousBookings && o.previousBookings>0 ? (o.bookings/o.previousBookings-1)*.3 : 0;
 const searchChange=o.previousSearches && o.previousSearches>0 ? (o.searches/o.previousSearches-1)*.2 : 0;
 return Math.max(.8,Math.min(1.2,1+bookingChange+searchChange));
}
export function forecast(o:Opportunity) { return Math.max(0, (o.bookings*.55 + o.searches*o.conversion*.45)*trendFactor(o)*o.seasonal*o.signal*(1+o.soldOut/100*.2)*(1-o.cancellations)); }
const scenarios = [{mult:-1,prob:.25},{mult:0,prob:.5},{mult:1,prob:.25}];
function evaluate(o:Opportunity, qty:number, price:number, risk:number) {
 const f=Math.max(0,forecast(o)*Math.pow(price/o.referencePrice,-1.2)-(o.existingStock||0)); // illustrative constant elasticity
 const sold=scenarios.map(s=>Math.min(qty,Math.max(0,f*(1+s.mult*o.volatility))));
 const expectedSold=sold.reduce((a,x,i)=>a+x*scenarios[i].prob,0);
 const salvage=o.buy*(o.recoveryPct||0);
 const profits=sold.map(n=>n*price+(qty-n)*salvage-qty*o.buy);
 const expectedProfit=profits.reduce((sum,p,i)=>sum+p*scenarios[i].prob,0);
 const downsideProfit=profits[0], baseProfit=profits[1], upsideProfit=profits[2];
 const expectedUnsold=qty-expectedSold, unsoldExposure=expectedUnsold*(o.buy-salvage);
 // Penalize the shortfall from the mean in a low-demand scenario.
 const objective=expectedProfit-risk*(expectedProfit-downsideProfit);
 return {expectedSold,expectedUnsold,unsoldExposure,expectedProfit,downsideProfit,baseProfit,upsideProfit,objective};
}
function best(o:Opportunity,qty:number,risk:number) {
 const prices=[.90,.95,1,1.05,1.10].map(m=>Math.max(1,Math.round(o.referencePrice*m)));
 return prices.map(price=>({price,...evaluate(o,qty,price,risk)})).sort((a,b)=>b.objective-a.objective)[0];
}
export function createPlan(items:Opportunity[], budget:number, risk:number, options:PlanOptions={}):PlanRow[] {
 const asOf=options.asOf || new Date().toISOString().slice(0,10);
 const state=items.map(o=>({o,qty:0,calc:best(o,0,risk), timing:timingFor(o,asOf)})); let remaining=Math.max(0,budget);
 // Marginal return per rupee heuristic, not a globally optimal knapsack solver.
 while(true) { let chosen=-1, bestRatio=0, next:ReturnType<typeof best>|null=null;
  state.forEach((s,i)=>{if(s.timing.expired || s.qty>=s.o.capacity || s.o.buy>remaining)return; const n=best(s.o,s.qty+1,risk);const ratio=(n.objective-s.calc.objective)/s.o.buy;if(ratio>bestRatio+1e-9){chosen=i;bestRatio=ratio;next=n;}});
  if(chosen<0 || !next)break; state[chosen].qty++;state[chosen].calc=next;remaining-=state[chosen].o.buy;
 }
 return state.map(({o,qty,calc,timing})=>{
  const safePrebuy=qty>0 && calc.expectedSold/qty>=.8 && calc.downsideProfit>=0;
  const strategy=timing.expired?'Refresh supplier quote':qty===0?'Integrate / monitor':safePrebuy?'Consider pre-buy':'Negotiate flexible supply';
  const strategyReason=timing.expired?'Expired quotes cannot be allocated.':qty===0?'No units selected under the current budget and assumptions.':safePrebuy?'Expected sell-through ≥80% and low-scenario profit is non-negative.':'Downside or unsold exposure suggests flexible terms; review manually.';
  return {...o,forecast:forecast(o),qty,spend:qty*o.buy,...calc,purchaseTiming:timing.purchaseTiming,timingReason:timing.timingReason,strategy,strategyReason};
 });
}
