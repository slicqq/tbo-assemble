export type FlightOffer={id:string;total:number;currency:string;airline:string;stops:number;departure:string;foundAt:string|null;expiresAt:string|null};
export type OfferResult={date:string;offers:FlightOffer[];error?:string};
export async function searchCachedFares(origin:string,destination:string,dates:string[],token:string,fetcher:typeof fetch=fetch):Promise<OfferResult[]>{
 return Promise.all(dates.map(async date=>{
  try{
   const p=new URLSearchParams({origin,destination,departure_at:date,currency:'inr',sorting:'price',one_way:'true',limit:'5',page:'1'});
   const response=await fetcher(`https://api.travelpayouts.com/aviasales/v3/prices_for_dates?${p}`,{headers:{'X-Access-Token':token,Accept:'application/json'},signal:AbortSignal.timeout(15000),cache:'no-store'});
   if(!response.ok)return {date,offers:[],error:`Cached fare lookup failed (provider status ${response.status}).`};
   const json=await response.json();if(json.success!==true||!Array.isArray(json.data))return {date,offers:[],error:'Provider returned an error or an unexpected response.'};
   if(String(json.currency||'').toLowerCase()!=='inr')return {date,offers:[],error:'Provider did not confirm INR currency; prices not shown.'};
   type Raw={price?:unknown;airline?:unknown;flight_number?:unknown;transfers?:unknown;departure_at?:unknown;found_at?:unknown;expires_at?:unknown};
   const offers:FlightOffer[]=json.data.flatMap((x:Raw,i:number)=>{const price=Number(x.price);if(!Number.isFinite(price)||price<=0||typeof x.departure_at!=='string'||x.departure_at.slice(0,10)!==date)return [];return [{id:String(i),total:price,currency:'INR',airline:typeof x.airline==='string'?x.airline:'Unknown',stops:typeof x.transfers==='number'?x.transfers:0,departure:x.departure_at,foundAt:typeof x.found_at==='string'?x.found_at:null,expiresAt:typeof x.expires_at==='string'?x.expires_at:null}]}).sort((a:FlightOffer,b:FlightOffer)=>a.total-b.total);
   return {date,offers};
  }catch{return {date,offers:[],error:'Cached fare service timed out or is unavailable.'}}
 }));
}
