import {timingSafeEqual} from 'node:crypto';
import {NextRequest,NextResponse} from 'next/server';
import {FARE_LEAD_DAYS,isoPlusDays,ROUTES} from '@/lib/india-market';
import {searchCachedFares} from '@/lib/travelpayouts';
export const dynamic='force-dynamic';
export const maxDuration=300;
function authorized(header:string|null,secret:string|undefined){if(!secret||!header)return false;const a=Buffer.from(header),b=Buffer.from(`Bearer ${secret}`);return a.length===b.length&&timingSafeEqual(a,b)}
function safeDate(value:string|null){if(!value)return null;const d=new Date(value);return Number.isFinite(d.getTime())?d:null}
export async function GET(req:NextRequest){
 if(!authorized(req.headers.get('authorization'),process.env.CRON_SECRET))return NextResponse.json({error:'Unauthorized'},{status:401});
 const token=process.env.TRAVELPAYOUTS_TOKEN;if(!token)return NextResponse.json({error:'Travelpayouts token is not configured.'},{status:503});
 if(!process.env.DATABASE_URL)return NextResponse.json({error:'Database is not configured.'},{status:503});
 try{
  const {default:db}=await import('@/lib/db');const now=new Date(),day=isoPlusDays(now,0);let ok=0,empty=0,errors=0;
  for(const route of ROUTES){const dates=FARE_LEAD_DAYS.map(n=>isoPlusDays(now,n));const results=await searchCachedFares(route.origin,route.destination,dates,token);
   for(const result of results){const offer=result.offers[0];const status=result.error?'error':offer?'ok':'empty';if(status==='ok')ok++;else if(status==='empty')empty++;else errors++;
    const found=safeDate(offer?.foundAt??null),expires=safeDate(offer?.expiresAt??null),price=offer?.total??null,airline=offer?.airline??null,stops=offer?.stops??null,err=result.error??null;
    await db.$executeRaw`INSERT INTO public.market_fare_observations (collection_day,origin,destination,departure_date,observed_at,status,price_inr,airline,stops,provider_found_at,provider_expires_at,error) VALUES (${day}::date,${route.origin},${route.destination},${result.date}::date,${now},${status},${price},${airline},${stops},${found},${expires},${err}) ON CONFLICT (collection_day,origin,destination,departure_date) DO UPDATE SET observed_at=EXCLUDED.observed_at,status=EXCLUDED.status,price_inr=EXCLUDED.price_inr,airline=EXCLUDED.airline,stops=EXCLUDED.stops,provider_found_at=EXCLUDED.provider_found_at,provider_expires_at=EXCLUDED.provider_expires_at,error=EXCLUDED.error WHERE market_fare_observations.status <> 'ok' OR EXCLUDED.status = 'ok'`;
   }
  }
  return NextResponse.json({collectedAt:now.toISOString(),checks:ok+empty+errors,ok,empty,errors},{status:errors===ok+empty+errors?502:200,headers:{'Cache-Control':'no-store'}});
 }catch(e){console.error('Scheduled fare collection failed',e instanceof Error?e.message:'unknown error');return NextResponse.json({error:'Collector failed. Check database and deployment logs.'},{status:503});}
}
