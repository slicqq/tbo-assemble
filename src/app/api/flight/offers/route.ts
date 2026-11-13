import {NextRequest,NextResponse} from 'next/server';
import {searchCachedFares} from '@/lib/travelpayouts';
export const dynamic='force-dynamic';
export async function GET(request:NextRequest){
 const o=(request.nextUrl.searchParams.get('origin')||'').toUpperCase(),d=(request.nextUrl.searchParams.get('destination')||'').toUpperCase(),date=request.nextUrl.searchParams.get('date')||'';
 if(!/^[A-Z]{3}$/.test(o)||!/^[A-Z]{3}$/.test(d)||o===d||!/^\d{4}-\d{2}-\d{2}$/.test(date))return NextResponse.json({error:'Enter distinct three-letter airport codes and a valid departure date.'},{status:400});
 const dep=new Date(date+'T00:00:00Z');const today=new Date();today.setUTCHours(0,0,0,0);
 if(!Number.isFinite(dep.getTime())||dep.toISOString().slice(0,10)!==date||dep<today||dep.getTime()>today.getTime()+360*86400000)return NextResponse.json({error:'Choose a valid departure date within the next 360 days (UTC).'}, {status:400});
 if(!process.env.TRAVELPAYOUTS_TOKEN)return NextResponse.json({error:'Optional cached fare data requires a free Travelpayouts account and API token. News, weather and CSV forecasting work without it.'},{status:503});
 const next=new Date(dep.getTime()+86400000).toISOString().slice(0,10);
 const results=await searchCachedFares(o,d,[date,next],process.env.TRAVELPAYOUTS_TOKEN);
 return NextResponse.json({origin:o,destination:d,environment:'cached',fetchedAt:new Date().toISOString(),source:'Travelpayouts / Aviasales Data API',results},{headers:{'Cache-Control':'no-store'}});
}
