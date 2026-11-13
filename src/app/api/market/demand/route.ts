import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
const pages:Record<string,string>={Goa:'Goa',Dubai:'Dubai',Bali:'Bali',Jaipur:'Jaipur',Kerala:'Kerala',Singapore:'Singapore',Bangkok:'Bangkok'};
const dateParam=(d:Date)=>d.toISOString().slice(0,10).replaceAll('-','');
export async function GET(request:NextRequest){
 const destination=request.nextUrl.searchParams.get('destination')||'Goa';
 if(!Object.hasOwn(pages,destination))return NextResponse.json({error:'Unsupported destination.'},{status:400});
 const end=new Date();end.setUTCHours(0,0,0,0);end.setUTCDate(end.getUTCDate()-1);const start=new Date(end);start.setUTCDate(start.getUTCDate()-29);
 try{
  const url=`https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/user/${encodeURIComponent(pages[destination])}/daily/${dateParam(start)}/${dateParam(end)}`;
  const r=await fetch(url,{headers:{'User-Agent':'TBOInventoryPrototype/1.0 (public pageview research)'},signal:AbortSignal.timeout(10000),cache:'no-store'});
  if(!r.ok)throw new Error('upstream unavailable');const data=await r.json();
  if(!Array.isArray(data.items))throw new Error('invalid response');
  const points=data.items.filter((x:{timestamp?:unknown;views?:unknown})=>typeof x.timestamp==='string' && /^\d{10}$/.test(x.timestamp) && typeof x.views==='number' && Number.isFinite(x.views) && x.views>=0).map((x:{timestamp:string;views:number})=>({date:`${x.timestamp.slice(0,4)}-${x.timestamp.slice(4,6)}-${x.timestamp.slice(6,8)}`,views:x.views})).sort((a:{date:string},b:{date:string})=>a.date.localeCompare(b.date));
  if(points.length<14)throw new Error('not enough data');const days=points.slice(-14);
  for(let i=1;i<days.length;i++)if(Date.parse(days[i].date)-Date.parse(days[i-1].date)!==86400000)throw new Error('missing day');
  const previous=days.slice(0,7).reduce((a:number,p:{views:number})=>a+p.views,0),recent=days.slice(7).reduce((a:number,p:{views:number})=>a+p.views,0);
  return NextResponse.json({destination,article:pages[destination],days,previous, recent,changePct:previous?((recent-previous)/previous)*100:null,fetchedAt:new Date().toISOString(),source:'Wikimedia Pageviews API',unit:'daily pageviews'},{headers:{'Cache-Control':'no-store'}});
 }catch{return NextResponse.json({error:'Destination pageview data is unavailable or incomplete. Please retry.'},{status:502,headers:{'Cache-Control':'no-store'}})}
}
