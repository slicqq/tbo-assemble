import {NextRequest,NextResponse} from 'next/server';
import {ROUTES} from '@/lib/india-market';
import {assessFareHistory,type FareObservation} from '@/lib/seven-day-fare';
export const dynamic='force-dynamic';
export async function GET(req:NextRequest){
 const origin=req.nextUrl.searchParams.get('origin'),destination=req.nextUrl.searchParams.get('destination');
 if(!ROUTES.some(r=>r.origin===origin&&r.destination===destination))return NextResponse.json({error:'Select a supported route.'},{status:400});
 try{
  const {default:db}=await import('@/lib/db');
  const rows=await db.$queryRaw<FareObservation[]>`SELECT collection_day::text, departure_date::text, status, price_inr::float8 AS price_inr, provider_found_at, provider_expires_at FROM public.market_fare_observations WHERE origin=${origin} AND destination=${destination} AND collection_day >= (CURRENT_DATE - INTERVAL '180 days') ORDER BY collection_day DESC`;
  return NextResponse.json({route:{origin,destination},pilotEnabled:process.env.FARE_HISTORY_PILOT_ENABLED==='true',result:assessFareHistory(rows)},{headers:{'Cache-Control':'no-store'}});
 }catch{return NextResponse.json({error:'Fare history unavailable. Check the database and collector.'},{status:503});}
}
