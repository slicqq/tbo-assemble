import {NextRequest,NextResponse} from 'next/server';
import {xml2js} from 'xml-js';
export const dynamic='force-dynamic';
const cities:Record<string,string>={PNQ:'Pune',BOM:'Mumbai',DEL:'Delhi',GOI:'Goa',GOX:'Goa',JAI:'Jaipur',COK:'Kochi',DXB:'Dubai',SIN:'Singapore',BKK:'Bangkok',DPS:'Bali',BLR:'Bangalore',HYD:'Hyderabad',MAA:'Chennai'};
type XmlValue={_text?:string};
type RssItem={title?:XmlValue;link?:XmlValue;pubDate?:XmlValue;source?:XmlValue};
export async function GET(request:NextRequest){
 const destination=(request.nextUrl.searchParams.get('destination')||'').toUpperCase();if(!Object.hasOwn(cities,destination))return NextResponse.json({error:'News search currently supports PNQ, BOM, DEL, GOI, GOX, JAI, COK, DXB, SIN, BKK, DPS, BLR, HYD and MAA.'},{status:400});
 try {
  const p=new URLSearchParams({q:`"${cities[destination]}" (airport OR flight OR airline OR travel) when:7d`,hl:'en-IN',gl:'IN',ceid:'IN:en'});
  const response=await fetch(`https://news.google.com/rss/search?${p}`,{headers:{'User-Agent':'TBOInventoryIntelligence/1.0'},cache:'no-store',signal:AbortSignal.timeout(15000)});if(!response.ok)throw new Error();const xml=await response.text();if(xml.length>2_000_000)throw new Error();
  const parsed=xml2js(xml,{compact:true}) as unknown as {rss?:{channel?:{item?:RssItem|RssItem[]}}};if(!parsed.rss?.channel)throw new Error();const raw=parsed.rss.channel.item;const items=raw?(Array.isArray(raw)?raw:[raw]):[];
  const now=Date.now();const articles=items.flatMap(a=>{const title=a.title?._text,url=a.link?._text,date=a.pubDate?._text;if(typeof title!=='string'||typeof url!=='string'||typeof date!=='string')return [];const t=Date.parse(date);if(!Number.isFinite(t)||t>now||t<now-7*86400000)return [];if(!title.toLowerCase().includes(cities[destination].toLowerCase())||!/(flight|airline|airport|aviation|travel|touris|airspace|airways)/i.test(title))return [];try{const u=new URL(url);if(u.protocol!=='https:'||u.hostname!=='news.google.com')return []}catch{return []}return [{title:title.slice(0,300),url,domain:String(a.source?._text||'News source'),seenDate:new Date(t).toISOString(),language:'English'}]}).sort((a,b)=>Date.parse(b.seenDate)-Date.parse(a.seenDate)).slice(0,10);
  return NextResponse.json({destination,city:cities[destination],articles,fetchedAt:new Date().toISOString(),source:'Google News RSS',window:'last 7 days'}, {headers:{'Cache-Control':'no-store'}});
 }catch{return NextResponse.json({error:'News service unavailable or rate-limited. Retry later.'},{status:502,headers:{'Cache-Control':'no-store'}})}
}
