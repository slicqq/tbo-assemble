/** Seven-day route-minimum experiment. All dates are UTC calendar days. */
export type FareObservation = { collection_day:string; departure_date:string; status:string; price_inr:number|null; provider_found_at:string|Date|null; provider_expires_at:string|Date|null };
type Pair = { start:string; departure:string; current:number; future:number };
const dayMs=86400000;
const addDays=(day:string,n:number)=>new Date(Date.parse(`${day}T00:00:00Z`)+dayMs*n).toISOString().slice(0,10);
const validPrice=(row:FareObservation)=>row.status==='ok' && typeof row.price_inr==='number' && Number.isFinite(row.price_inr) && row.price_inr>0;
export function makePairs(rows:FareObservation[]):Pair[]{
 const valid=rows.filter(validPrice); const byKey=new Map(valid.map(r=>[`${r.collection_day}|${r.departure_date}`,r]));
 const pairs:Pair[]=[];
 for(const row of valid){
  // The prospective pilot targets only +30/+23 days. Other lead times have different behaviour.
  if(addDays(row.collection_day,30)!==row.departure_date) continue;
  const future=byKey.get(`${addDays(row.collection_day,7)}|${row.departure_date}`);
  if(future && validPrice(future)) pairs.push({start:row.collection_day,departure:row.departure_date,current:row.price_inr!,future:future.price_inr!});
 }
 return pairs.sort((a,b)=>a.start.localeCompare(b.start));
}
// A regularised linear regression on current fare; this learns a relationship, not a guaranteed quote.
function fit(pairs:Pair[]){
 const x=pairs.map(p=>p.current),y=pairs.map(p=>p.future); const xm=x.reduce((a,b)=>a+b,0)/x.length,ym=y.reduce((a,b)=>a+b,0)/y.length;
 const covariance=x.reduce((sum,v,i)=>sum+(v-xm)*(y[i]-ym),0),variance=x.reduce((sum,v)=>sum+(v-xm)**2,0);
 const slope=covariance/(variance+1000000);return {slope,intercept:ym-slope*xm};
}
function predict(model:ReturnType<typeof fit>,current:number){return Math.max(1,model.intercept+model.slope*current)}
export function assessFareHistory(rows:FareObservation[],now=new Date()){
 const pairs=makePairs(rows),days=[...new Set(pairs.map(p=>p.start))].sort();
 const cutoff=days[Math.floor(days.length*.75)];
 // Train labels must already be known before the first test forecast is made.
 const train=cutoff?pairs.filter(p=>addDays(p.start,7)<cutoff):[];
 const test=cutoff?pairs.filter(p=>p.start>=cutoff):[];
 const base={pairCount:pairs.length,distinctDays:days.length,trainCount:train.length,testCount:test.length,firstTestDay:cutoff??null,minimumTrain:40,minimumTest:12,minimumDays:20};
 if(train.length<40||test.length<12||days.length<20)return {...base,status:'collecting' as const,forecast:null,mae:null,baselineMae:null,reason:'Not enough independent dates and seven-day pairs for a chronological test.'};
 const model=fit(train),mae=test.reduce((s,p)=>s+Math.abs(p.future-predict(model,p.current)),0)/test.length,baselineMae=test.reduce((s,p)=>s+Math.abs(p.future-p.current),0)/test.length;
 const metrics={...base,mae,baselineMae};
 if(!(mae<baselineMae))return {...metrics,status:'baseline-better' as const,forecast:null,reason:'The model did not beat the unchanged-fare baseline on the holdout.'};
 // Only a +30-day departure observed today is in the trained feature domain.
 const today=now.toISOString().slice(0,10),desired=addDays(today,30);
 const latest=rows.find(r=>r.collection_day===today&&r.departure_date===desired&&validPrice(r));
 const found=latest?.provider_found_at?new Date(latest.provider_found_at).getTime():NaN;
 const expiry=latest?.provider_expires_at?new Date(latest.provider_expires_at).getTime():NaN;
 const fresh=latest && Number.isFinite(found)&&found<=now.getTime()&&now.getTime()-found<=dayMs&&Number.isFinite(expiry)&&expiry>now.getTime();
 if(!fresh)return {...metrics,status:'no-fresh-fare' as const,forecast:null,reason:'No eligible fresh cached +30-day fare with known unexpired provider timestamp.'};
 const retrained=fit(pairs);return {...metrics,status:'ready' as const,forecast:{departureDate:desired,asOf:today,targetDate:addDays(today,7),currentFare:latest.price_inr!,estimatedFare:predict(retrained,latest.price_inr!)},reason:null};
}
