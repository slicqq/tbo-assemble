import {NextRequest,NextResponse} from 'next/server';
import {ROUTES} from '@/lib/india-market';
export const dynamic='force-dynamic';
export async function GET(req:NextRequest){
 const origin=req.nextUrl.searchParams.get('origin'),destination=req.nextUrl.searchParams.get('destination');if(!ROUTES.some(r=>r.origin===origin&&r.destination===destination))return NextResponse.json({error:'Select a supported route.'},{status:400});
 try {const {default:db}=await import('@/lib/db');const rows=await db.$queryRaw`SELECT collection_day::text, origin, destination, departure_date::text, observed_at, status, price_inr::float8 AS price_inr, airline, stops, provider_found_at, provider_expires_at, error FROM public.market_fare_observations WHERE origin = ${origin} AND destination = ${destination} ORDER BY observed_at DESC, departure_date ASC LIMIT 90`;
  return NextResponse.json({source:'Travelpayouts cached search fares',rows},{headers:{'Cache-Control':'no-store'}});
 }catch{return NextResponse.json({error:'Fare history is not available. Database or collector may not be configured.'},{status:503});}
}
