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
