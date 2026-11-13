import {NextRequest,NextResponse} from 'next/server';
import {unstable_cache} from 'next/cache';
import {buildTraffic,DGCA_URL,ROUTES,seasonalReference} from '@/lib/india-market';
const getTraffic=unstable_cache(async (origin:string,destination:string)=>{
 const route=ROUTES.find(r=>r.origin===origin&&r.destination===destination);if(!route)throw Error('Unsupported route');
 const response=await fetch(DGCA_URL,{cache:'no-store',signal:AbortSignal.timeout(25000)});if(!response.ok)throw Error('Source unavailable');
 const text=await response.text();if(text.length<1000||text.length>10_000_000)throw Error('Unexpected data size');const result=buildTraffic(text,route);
 if(!result.monthly.length)throw Error('No data for the selected route');
 return {route,...result,reference:seasonalReference(result.monthly),source:'DGCA via Vonter/india-aviation-traffic',sourceUrl:DGCA_URL,license:'ODbL 1.0',retrievedAt:new Date().toISOString()};
},['india-market-traffic-v1'],{revalidate:43200});
export async function GET(req:NextRequest){
 const origin=req.nextUrl.searchParams.get('origin'),destination=req.nextUrl.searchParams.get('destination');
 if(!origin||!destination||!ROUTES.some(r=>r.origin===origin&&r.destination===destination))return NextResponse.json({error:'Select a supported route.'},{status:400});
 try{return NextResponse.json(await getTraffic(origin,destination),{headers:{'Cache-Control':'public, max-age=300, s-maxage=43200'}})}
 catch{return NextResponse.json({error:'Indian traffic source is temporarily unavailable or could not be validated. Try again later.'},{status:503});}
}
