export type PricePoint={date:string;price:number};
type ResponseData={price_insights?:{lowest_price?:unknown;price_level?:unknown;typical_price_range?:unknown;price_history?:unknown};error?:unknown;search_metadata?:{created_at?:unknown;status?:unknown}};
const positive=(x:unknown):x is number=>typeof x==='number'&&Number.isFinite(x)&&x>0;
export function parseSerpFare(data:ResponseData,now=new Date()){
 const insight=data.price_insights??{},raw=Array.isArray(insight.price_history)?insight.price_history:[];
 const days=new Map<string,PricePoint>();
 for(const point of raw){if(!Array.isArray(point)||!positive(point[0])||!positive(point[1]))continue;const ms=point[0]*1000;if(ms>now.getTime()||ms<946684800000)continue;const d=new Date(ms);if(!Number.isFinite(d.getTime()))continue;const date=d.toISOString().slice(0,10);days.set(date,{date,price:point[1]});}
 const history=[...days.values()].sort((a,b)=>a.date.localeCompare(b.date));
 const a=insight.typical_price_range;const range=Array.isArray(a)&&a.length===2&&positive(a[0])&&positive(a[1])&&a[0]<=a[1]?[a[0],a[1]] as [number,number]:null;
 return {lowest:positive(insight.lowest_price)?insight.lowest_price:null,level:['low','typical','high'].includes(String(insight.price_level))?String(insight.price_level):null,typicalRange:range,history,sourceSearchTime:typeof data.search_metadata?.created_at==='string'?data.search_metadata.created_at:null};
}

type Pair={start:string;current:number;future:number};
const DAY=86400000;
const shift=(date:string,days:number)=>new Date(Date.parse(`${date}T00:00:00Z`)+days*DAY).toISOString().slice(0,10);
function fit(pairs:Pair[]){const x=pairs.reduce((s,p)=>s+p.current,0)/pairs.length,y=pairs.reduce((s,p)=>s+p.future,0)/pairs.length;const cov=pairs.reduce((s,p)=>s+(p.current-x)*(p.future-y),0),variance=pairs.reduce((s,p)=>s+(p.current-x)**2,0);const slope=cov/(variance+1000000);return {slope,intercept:y-slope*x}}
const estimate=(model:ReturnType<typeof fit>,price:number)=>model.intercept+model.slope*price;
/** Per-search time-series research, not the Travelpayouts model. No future labels used in training. */
export function evaluateSerpHistory(data:ReturnType<typeof parseSerpFare>,now=new Date()){
 const byDay=new Map(data.history.map(x=>[x.date,x.price]));const pairs:Pair[]=data.history.flatMap(p=>{const next=byDay.get(shift(p.date,7));return next===undefined?[]:[{start:p.date,current:p.price,future:next}]}).sort((a,b)=>a.start.localeCompare(b.start));
 const cutoff=pairs[Math.floor(pairs.length*.75)]?.start;
 const train=cutoff?pairs.filter(p=>shift(p.start,7)<cutoff):[],test=cutoff?pairs.filter(p=>p.start>=cutoff):[];
 const counts={pairCount:pairs.length,trainCount:train.length,testCount:test.length};
 if(train.length<25||test.length<10)return {...counts,status:'insufficient' as const,reason:'Not enough seven-day pairs for a chronological test.',forecast:null,mae:null,baselineMae:null,method:null};
 const model=fit(train),base=test.reduce((s,p)=>s+Math.abs(p.future-p.current),0)/test.length,modelMae=test.reduce((s,p)=>s+Math.abs(p.future-estimate(model,p.current)),0)/test.length;
 const latest=data.history.at(-1)?.date,today=now.toISOString().slice(0,10),searchTime=data.sourceSearchTime?Date.parse(data.sourceSearchTime):NaN;
 if(data.lowest===null||!latest||latest<shift(today,-2)||!Number.isFinite(searchTime)||searchTime>now.getTime()||now.getTime()-searchTime>DAY)return {...counts,status:'stale' as const,reason:'A recent provider search and price history are needed before showing an estimate.',forecast:null,mae:modelMae,baselineMae:base,method:null};
 const current=data.lowest,finalModel=fit(pairs),modelEstimate=estimate(finalModel,current),rangeMin=Math.min(...pairs.map(p=>p.current)),rangeMax=Math.max(...pairs.map(p=>p.current));
 const modelEligible=modelMae<base&&current>=rangeMin&&current<=rangeMax&&Number.isFinite(modelEstimate)&&modelEstimate>=current*.5&&modelEstimate<=current*2;
 return {...counts,status:'ready' as const,reason:null,forecast:modelEligible?modelEstimate:current,mae:modelMae,baselineMae:base,method:modelEligible?'regression' as const:'unchanged' as const,targetDate:shift(today,7),holdoutStart:cutoff};
}
