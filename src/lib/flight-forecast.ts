import {parseCSV} from './inventory-csv';
export type DailyHistory={date:string;origin:string;destination:string;bookings:number;cancellations:number;searches:number;minFare:number|null};
const required=['date','origin','destination','bookings','cancellations','searches','minFare'];
const day=86400000;
const validDate=(s:string)=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s+'T00:00:00Z'))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
export function parseHistoryCSV(text:string):DailyHistory[]{
 const lines=parseCSV(text.replace(/^\uFEFF/,''));if(lines.length<2||lines.length>5001)throw new Error('Provide 1–5000 daily rows with a header.');const headers=lines[0];if(new Set(headers).size!==headers.length||required.some(k=>!headers.includes(k)))throw new Error('Missing or duplicate columns. Use the template header.');const ids=new Set<string>();
 return lines.slice(1).map((row,i)=>{if(row.length!==headers.length)throw new Error(`Row ${i+2}: incorrect column count.`);const v=Object.fromEntries(headers.map((h,j)=>[h,row[j]]));
 if(!validDate(v.date)||!/^[A-Z]{3}$/.test(v.origin)||!/^[A-Z]{3}$/.test(v.destination)||v.origin===v.destination)throw new Error(`Row ${i+2}: invalid date or airport codes.`);
 const id=`${v.date}/${v.origin}/${v.destination}`;if(ids.has(id))throw new Error(`Row ${i+2}: duplicate route and date.`);ids.add(id);
 const num=(field:string)=>{if(!/^\d+$/.test(v[field])||Number(v[field])>10000000)throw new Error(`Row ${i+2}: ${field} must be a whole number from 0 to 10000000.`);return Number(v[field])};
 const bookings=num('bookings'),cancellations=num('cancellations'),searches=num('searches');if(cancellations>bookings)throw new Error(`Row ${i+2}: cancellations cannot exceed bookings for this baseline.`);
 const minFare=v.minFare===''?null:Number(v.minFare);if(minFare!==null&&(!Number.isFinite(minFare)||minFare<=0||minFare>10000000))throw new Error(`Row ${i+2}: minFare must be blank or a positive INR amount.`);
 return {date:v.date,origin:v.origin,destination:v.destination,bookings,cancellations,searches,minFare};});
}
export function exampleHistory(asOf:string){const end=Date.parse(asOf+'T00:00:00Z')-day;const header=required.join(',');const rows=Array.from({length:28},(_,i)=>{const dt=new Date(end-(27-i)*day).toISOString().slice(0,10);const bookings=40+(i%7)*3+Math.floor(i/7);const cancels=4+(i%3);return `${dt},BOM,DEL,${bookings},${cancels},${900+i*9},${5800+(i%7)*100+Math.floor(i/7)*30}`});return [header,...rows].join('\n')}
function estimate(history:DailyHistory[],target:string,field:'bookings'|'minFare'):number|null{
 if(history.length<7)return null;const latest=history.slice(-7);const targetMs=Date.parse(target+'T00:00:00Z');
 if(latest.some((r,i)=>i>0&&Date.parse(r.date+'T00:00:00Z')-Date.parse(latest[i-1].date+'T00:00:00Z')!==day))return null;
 const horizon=(targetMs-Date.parse(latest[6].date+'T00:00:00Z'))/day;if(horizon!==1&&horizon!==2)return null;
 const sameWeekday=history.filter(r=>{const diff=targetMs-Date.parse(r.date+'T00:00:00Z');return diff>0 && diff%(7*day)===0});
 const values=latest.map(r=>field==='bookings'?r.bookings-r.cancellations:r.minFare);if(values.some(x=>x===null))return null;
 const seasonals=sameWeekday.map(r=>field==='bookings'?r.bookings-r.cancellations:r.minFare).filter((n):n is number=>n!==null);if(!seasonals.length)return null;
 return .5*(values as number[]).reduce((a,b)=>a+b,0)/7+.5*seasonals.reduce((a,b)=>a+b,0)/seasonals.length;
}
export function forecastRoute(rows:DailyHistory[],origin:string,destination:string,asOf:string){
 if(!validDate(asOf))throw new Error('Invalid as-of date.');const matching=rows.filter(r=>r.origin===origin&&r.destination===destination);const past=matching.filter(r=>r.date<asOf).sort((a,b)=>a.date.localeCompare(b.date));const ignored=matching.length-past.length;
 const today=asOf,tomorrow=new Date(Date.parse(asOf+'T00:00:00Z')+day).toISOString().slice(0,10);
 const expectedLatest=new Date(Date.parse(asOf+'T00:00:00Z')-day).toISOString().slice(0,10);
 const timely=past.at(-1)?.date===expectedLatest;
 const predictions=[today,tomorrow].map(date=>({date,bookings:timely?estimate(past,date,'bookings'):null,minFare:timely?estimate(past,date,'minFare'):null}));
 const metrics=(field:'bookings'|'minFare',horizon:1|2)=>{const errors:number[]=[];for(let i=7;i<past.length;i++){const trainEnd=i-horizon+1;if(trainEnd<7)continue;const y=field==='bookings'?past[i].bookings-past[i].cancellations:past[i].minFare;if(y===null)continue;const predicted=estimate(past.slice(0,trainEnd),past[i].date,field);if(predicted!==null)errors.push(Math.abs(predicted-y))}return {count:errors.length,mae:errors.length>=5?errors.reduce((a,b)=>a+b,0)/errors.length:null}};
 const last7=past.slice(-7);const contiguous=last7.length===7 && last7.every((r,i)=>i===0||Date.parse(r.date+'T00:00:00Z')-Date.parse(last7[i-1].date+'T00:00:00Z')===day);return {predictions,historyRows:past.length,ignoredRows:ignored,lastDate:past.at(-1)?.date||null,bookingsMetrics:[metrics('bookings',1),metrics('bookings',2)],fareMetrics:[metrics('minFare',1),metrics('minFare',2)],lookToBook:timely&&contiguous&&last7.reduce((a,r)=>a+r.searches,0)>0?last7.reduce((a,r)=>a+r.bookings,0)/last7.reduce((a,r)=>a+r.searches,0):null};
}
