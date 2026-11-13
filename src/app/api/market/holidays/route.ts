import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
const countries=['SG','ID','IN','AE','TH'];
export async function GET(request:NextRequest) {
 const country=(request.nextUrl.searchParams.get('country')||'SG').toUpperCase();
 const yearText=request.nextUrl.searchParams.get('year')||String(new Date().getUTCFullYear());
 if(!countries.includes(country)|| !/^20\d{2}$/.test(yearText)) return NextResponse.json({error:'Unsupported country or year.'},{status:400});
 try {
  const upstream=await fetch(`https://date.nager.at/api/v3/PublicHolidays/${yearText}/${country}`,{cache:'no-store',signal:AbortSignal.timeout(8000)});
  if(upstream.status===204) return NextResponse.json({country,year:Number(yearText),holidays:[],message:'No data returned by the provider. Coverage may be unavailable; this does not mean there are no holidays.',fetchedAt:new Date().toISOString(),source:'Nager.Date'},{headers:{'Cache-Control':'no-store'}});
  if(!upstream.ok) throw new Error('upstream unavailable');
  const data=await upstream.json();
  if(!Array.isArray(data)) throw new Error('invalid upstream response');
  const holidays=data.filter((h:unknown):h is {date:string;name:string;global:boolean;counties:string[]|null} => !!h && typeof h==='object' && typeof (h as {date?:unknown}).date==='string' && typeof (h as {name?:unknown}).name==='string').map(h=>({date:h.date,name:h.name,global:h.global===true,counties:Array.isArray(h.counties)?h.counties:[]}));
  return NextResponse.json({country,year:Number(yearText),holidays,fetchedAt:new Date().toISOString(),source:'Nager.Date'}, {headers:{'Cache-Control':'no-store'}});
 }catch {return NextResponse.json({error:'Holiday data is temporarily unavailable. Please retry.'},{status:502,headers:{'Cache-Control':'no-store'}})}
}
