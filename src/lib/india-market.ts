export const ROUTES = [
 {origin:'BOM',destination:'DEL',from:'MUMBAI',to:'DELHI'},
 {origin:'DEL',destination:'BOM',from:'DELHI',to:'MUMBAI'},
 {origin:'DEL',destination:'PNQ',from:'DELHI',to:'PUNE'},
 {origin:'PNQ',destination:'DEL',from:'PUNE',to:'DELHI'},
 {origin:'BLR',destination:'DEL',from:'BENGALURU',to:'DELHI'},
 {origin:'DEL',destination:'BLR',from:'DELHI',to:'BENGALURU'},
] as const;
export const DGCA_URL='https://raw.githubusercontent.com/Vonter/india-aviation-traffic/main/aggregated/domestic/city.csv';
export type Route=(typeof ROUTES)[number];
export type MonthlyTraffic={month:string;passengers:number|null;quality:'ok'|'ambiguous'|'invalid'};
/** RFC4180-style parser; quoted commas, escaped quotes and line breaks are supported. */
export function parseCsv(input:string):string[][]{
 const out:string[][]=[];let row:string[]=[],field='',quoted=false;
 for(let i=0;i<input.length;i++) {const c=input[i];if(quoted){if(c==='"'&&input[i+1]==='"'){field+='"';i++}else if(c==='"')quoted=false;else field+=c}
 else if(c==='"'&&field==='')quoted=true;else if(c===','){row.push(field);field=''}else if(c==='\n'){row.push(field.replace(/\r$/, ''));out.push(row);row=[];field=''}else field+=c}
 if(quoted)throw Error('Unclosed quoted CSV field');if(field||row.length){row.push(field.replace(/\r$/, ''));out.push(row)}return out;
}
export function buildTraffic(csv:string, route:Route){
 const [header,...rows]=parseCsv(csv); const indices=['Year','Month','City1','City2','PaxToCity2','PaxFromCity2'].map(n=>header?.indexOf(n)??-1);if(indices.some(x=>x<0))throw Error('Unexpected source columns');
 const [y,m,c1,c2,to,from]=indices;const groups=new Map<string,Array<{value:number|null}>>();
 for(const r of rows){const a=r[c1]?.trim().toUpperCase(),b=r[c2]?.trim().toUpperCase();const forward=a===route.from&&b===route.to,reverse=a===route.to&&b===route.from;if(!forward&&!reverse)continue;
  const year=Number(r[y]),month=Number(r[m]);if(!Number.isInteger(year)||year<2015||year>2100||!Number.isInteger(month)||month<1||month>12)continue;
  const raw=r[forward?to:from]?.trim();const value=raw!==undefined&&raw!==''?Number(raw):NaN;const key=`${year}-${String(month).padStart(2,'0')}`;
  const list=groups.get(key)??[];list.push({value:Number.isInteger(value)&&value>=0?value:null});groups.set(key,list);
 }
 const monthly:MonthlyTraffic[]=[...groups.entries()].map(([month,items]):MonthlyTraffic=>({month,passengers:items.length===1?items[0].value:null,quality:items.length>1?'ambiguous':items[0].value===null?'invalid':'ok'})).sort((a,b)=>a.month.localeCompare(b.month));
 return {sourceRowCount:rows.filter(r=>r.some(Boolean)).length,monthly};
}
export function shiftMonth(month:string,n:number){const [y,m]=month.split('-').map(Number);return new Date(Date.UTC(y,m-1+n,1)).toISOString().slice(0,7)}
/** A fixed seasonal-naive reference. Predictions are independent of later targets. */
export function seasonalReference(rows:MonthlyTraffic[]){
 const map=new Map(rows.map(r=>[r.month,r.passengers]));const latest=rows.at(-1)?.month;if(!latest)return null;const target=shiftMonth(latest,1),prediction=map.get(shiftMonth(target,-12));
 const scored=rows.filter(r=>r.month>='2025-01'&&r.month<='2025-12'&&r.passengers!==null&&map.get(shiftMonth(r.month,-12))!=null).map(r=>Math.abs(r.passengers!-map.get(shiftMonth(r.month,-12))!));
 return {target,estimate:prediction??null,holdoutCount:scored.length,mae:scored.length?scored.reduce((a,b)=>a+b,0)/scored.length:null,holdout:'2025-01 to 2025-12'};
}
export function isoPlusDays(now:Date,days:number){const d=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()+days));return d.toISOString().slice(0,10)}
export const FARE_LEAD_DAYS=[1,7,30] as const;
