import {shiftMonth,type MonthlyTraffic} from './india-market';

/** Industry-wide passenger totals, not TBO bookings or demand for seats. The
 * backtest assumes an optimistic one-month reporting delay and revised data. */
type Method='last-observed'|'last-year'|'seasonal-ratio';
export type TrafficReplay={month:string;actual:number;prediction:number;method:Method;lastObserved:number;lastYear:number;selectionCount:number};
export type TrafficStudy={latestMonth:string|null;targetMonth:string|null;currentMonth:string;forecast:number|null;method:Method|null;status:'available'|'stale'|'insufficient'|'baseline-not-beaten';replays:TrafficReplay[];selectedMae:number|null;lastObservedMae:number|null;lastYearMae:number|null;commonCount:number;};
const validMonth=(x:string)=>/^\d{4}-(0[1-9]|1[0-2])$/.test(x);
const mean=(v:number[])=>v.reduce((a,b)=>a+b,0)/v.length;
function candidates(series:Map<string,number>,target:string):Record<Method,number|null>{
 // Pretend month target-2 is the latest published observation.
 const last=series.get(shiftMonth(target,-2)),year=series.get(shiftMonth(target,-12)),anchor=series.get(shiftMonth(target,-14));
 const ratio=last!==undefined&&year!==undefined&&anchor!==undefined&&anchor>0?last*Math.min(2,Math.max(.5,year/anchor)):null;
 return {'last-observed':last??null,'last-year':year??null,'seasonal-ratio':ratio};
}
function select(series:Map<string,number>,target:string):{prediction:number;method:Method;count:number}|null {
 const now=candidates(series,target);const errors:Record<Method,number[]>={'last-observed':[],'last-year':[],'seasonal-ratio':[]};
 // At target-2 only target-2 and earlier outcomes are assumed observed.
 for(let offset=2;offset<=13;offset++){
  const month=shiftMonth(target,-offset),actual=series.get(month),c=candidates(series,month);
  if(actual===undefined||Object.values(c).some(v=>v===null))continue;
  for(const method of Object.keys(errors) as Method[])errors[method].push(Math.abs(c[method]!-actual));
 }
 const count=errors['last-observed'].length;
 if(count>=8){const methods:Method[]=['last-observed','last-year','seasonal-ratio'];const eligible=methods.filter(k=>now[k]!==null);eligible.sort((a,b)=>mean(errors[a])-mean(errors[b]));const chosen=eligible[0];return chosen?{prediction:now[chosen]!,method:chosen,count}:null;}
 // Transparent fallback, not presented as a validated model.
 return now['last-year']!==null?{prediction:now['last-year'],method:'last-year',count}:now['last-observed']!==null?{prediction:now['last-observed'],method:'last-observed',count}:null;
}
export function studyTraffic(rows:MonthlyTraffic[],asOfMonth:string):TrafficStudy {
 if(!validMonth(asOfMonth))throw new Error('Invalid as-of month');
 const valid=rows.filter(r=>r.month<asOfMonth&&validMonth(r.month)&&r.quality==='ok'&&typeof r.passengers==='number'&&Number.isFinite(r.passengers)&&r.passengers>=0);
 const counts=new Map<string,number>();for(const row of rows)if(validMonth(row.month)&&row.month<asOfMonth)counts.set(row.month,(counts.get(row.month)??0)+1);
 const map=new Map(valid.filter(r=>counts.get(r.month)===1).map(r=>[r.month,r.passengers!]));const latestMonth=[...map.keys()].sort().at(-1)??null;
 // Fixed retrospective evaluation window. Model design was informed by the source; not an unseen holdout.
 const replays:TrafficReplay[]=[];
 for(let month='2024-01';month<='2025-12';month=shiftMonth(month,1)){
  const actual=map.get(month),choice=select(map,month),bench=candidates(map,month);
  if(actual!==undefined&&choice&&bench['last-observed']!==null&&bench['last-year']!==null)replays.push({month,actual,prediction:choice.prediction,method:choice.method,lastObserved:bench['last-observed'],lastYear:bench['last-year'],selectionCount:choice.count});
 }
 const count=replays.length,metric=(key:'prediction'|'lastObserved'|'lastYear')=>count?mean(replays.map(r=>Math.abs(r[key]-r.actual))):null;
 const selectedMae=metric('prediction'),lastObservedMae=metric('lastObserved'),lastYearMae=metric('lastYear');
 const targetMonth=latestMonth?shiftMonth(latestMonth,2):null;
 // Only a future month and a fully reported last month may be called a forecast.
 const fresh=latestMonth===shiftMonth(asOfMonth,-1)&&targetMonth!==null&&targetMonth>asOfMonth;
 const result:TrafficStudy={latestMonth,targetMonth,currentMonth:asOfMonth,forecast:null,method:null,status:'insufficient',replays,selectedMae,lastObservedMae,lastYearMae,commonCount:count};
 if(!latestMonth||!targetMonth)return result;
 if(!fresh){result.status='stale';return result;}
 if(count<12||selectedMae===null||lastObservedMae===null||lastYearMae===null)return result;
 if(!(selectedMae<lastObservedMae*.95&&selectedMae<lastYearMae*.95)){result.status='baseline-not-beaten';return result;}
 const next=select(map,targetMonth);if(!next||next.count<8)return result;
 return {...result,status:'available',forecast:Math.max(0,next.prediction),method:next.method};
}
