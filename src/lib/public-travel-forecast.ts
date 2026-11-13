export type BookingDay={date:string;hotel:string;requests:number};
type Method='hybrid'|'seven-day';
const ms=86400000;
const validDate=(s:string)=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s+'T00:00:00Z'))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
export function addDays(date:string,days:number){if(!validDate(date))throw new Error('Invalid date.');return new Date(Date.parse(date+'T00:00:00Z')+days*ms).toISOString().slice(0,10)}
/** Forecast for the as-of day or following day, using only completed days before asOf. */
export function predictBookingDay(rows:BookingDay[],hotel:string,asOf:string,horizon:1|2,method:Method='hybrid') {
 if(!validDate(asOf))throw new Error('Invalid as-of date.');
 const series=rows.filter(r=>r.hotel===hotel&&r.date<asOf).sort((a,b)=>a.date.localeCompare(b.date));
 const byDate=new Map(series.map(r=>[r.date,r.requests]));
 const recent=Array.from({length:7},(_,i)=>byDate.get(addDays(asOf,i-7)));
 if(recent.some(v=>v===undefined))return null;
 const mean=recent.reduce<number>((s,v)=>s+(v??0),0)/7;
 if(method==='seven-day')return mean;
 const target=addDays(asOf,horizon-1);
 const weekdays=Array.from({length:4},(_,i)=>byDate.get(addDays(target,-7*(i+1))));
 if(weekdays.some(v=>v===undefined))return null;
 return 0.5*mean+0.5*weekdays.reduce<number>((s,v)=>s+(v??0),0)/4;
}
/** Rolling historical evaluation. Each target's prediction only sees dates before its as-of date. */
export function backtest(rows:BookingDay[],hotel:string,start:string,end:string,horizon:1|2,method:Method) {
 const actual=new Map(rows.filter(r=>r.hotel===hotel).map(r=>[r.date,r.requests]));
 const errors:number[]=[];
 for(let date=start;date<=end;date=addDays(date,1)){
  const predicted=predictBookingDay(rows,hotel,addDays(date,1-horizon),horizon,method); const observed=actual.get(date);
  if(predicted!==null&&observed!==undefined)errors.push(Math.abs(predicted-observed));
 }
 return {count:errors.length,mae:errors.length?errors.reduce((a,b)=>a+b,0)/errors.length:null};
}
