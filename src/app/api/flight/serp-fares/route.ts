import {NextRequest,NextResponse} from 'next/server';
import {ROUTES,isoPlusDays} from '@/lib/india-market';
import {parseSerpFare} from '@/lib/serpapi-fares';
export const dynamic='force-dynamic';
export const maxDuration=30;
const HEADERS={'Cache-Control':'no-store'};
class BudgetReached extends Error {}
export async function POST(req:NextRequest){
 if(!process.env.SERPAPI_KEY)return NextResponse.json({error:'SerpApi is not configured.'},{status:503,headers:HEADERS});
 let body:{origin?:unknown;destination?:unknown;departureDate?:unknown};
 try {body=await req.json()}catch{return NextResponse.json({error:'Invalid request.'},{status:400,headers:HEADERS})}
 const {origin,destination,departureDate}=body,now=new Date();
 if(!ROUTES.some(r=>r.origin===origin&&r.destination===destination)||typeof departureDate!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(departureDate)||departureDate<isoPlusDays(now,8)||departureDate>isoPlusDays(now,180)||!Number.isFinite(Date.parse(`${departureDate}T00:00:00Z`))||new Date(`${departureDate}T00:00:00Z`).toISOString().slice(0,10)!==departureDate)return NextResponse.json({error:'Choose a supported route and a departure 8–180 days from today (UTC).'}, {status:400,headers:HEADERS});
 // Reservation is atomic across serverless instances. Count even errors and timeouts; fail closed if DB unavailable.
 try{
  const {default:db}=await import('@/lib/db');
  await db.$transaction(async tx=>{
   const lock=await tx.$queryRaw<Array<{id:number}>>`SELECT id FROM public.serpapi_search_budget_lock WHERE id=1 FOR UPDATE`;
   if(lock.length!==1)throw new Error('Budget lock unavailable');
   const totals=await tx.$queryRaw<Array<{daily:bigint;rolling:bigint}>>`SELECT COALESCE(SUM(CASE WHEN usage_day = (NOW() AT TIME ZONE 'UTC')::date THEN attempts ELSE 0 END),0)::bigint AS daily, COALESCE(SUM(attempts),0)::bigint AS rolling FROM public.serpapi_search_usage WHERE usage_day >= (NOW() AT TIME ZONE 'UTC')::date - 29 AND usage_day <= (NOW() AT TIME ZONE 'UTC')::date`;
   if(Number(totals[0].daily)>=8||Number(totals[0].rolling)>=180)throw new BudgetReached();
   await tx.$executeRaw`INSERT INTO public.serpapi_search_usage(usage_day,attempts) VALUES ((NOW() AT TIME ZONE 'UTC')::date,1) ON CONFLICT (usage_day) DO UPDATE SET attempts=serpapi_search_usage.attempts+1`;
  });
 }catch(e){return NextResponse.json({error:e instanceof BudgetReached?'Search limit reached: up to 8 per UTC day and 180 in 30 days for this app.':'Search budget unavailable; no API call was made.'},{status:e instanceof BudgetReached?429:503,headers:HEADERS})}
 const query=new URLSearchParams({engine:'google_flights',api_key:process.env.SERPAPI_KEY,departure_id:String(origin),arrival_id:String(destination),outbound_date:departureDate,type:'2',travel_class:'1',adults:'1',currency:'INR',hl:'en',gl:'in'});
 try {
  const response=await fetch('https://serpapi.com/search.json?'+query,{signal:AbortSignal.timeout(25000),cache:'no-store'});const json=await response.json();
  // Never forward provider errors: they can contain request details or secrets.
  if(!response.ok||json.error||json.search_metadata?.status==='Error')return NextResponse.json({error:'SerpApi could not complete the search. Check the key, quota and route availability.'},{status:502,headers:HEADERS});
  return NextResponse.json({source:'Google Flights via SerpApi',origin,destination,departureDate,fetchedAt:new Date().toISOString(),...parseSerpFare(json)}, {headers:HEADERS});
 }catch{return NextResponse.json({error:'SerpApi did not respond. Please try again later; the attempt counted against the app safety limit.'},{status:502,headers:HEADERS})}
}
