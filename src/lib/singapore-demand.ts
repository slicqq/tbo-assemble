/** Fixed retrospective protocol for Singapore monthly gross hotel lettings.
 * This is a research estimate of aggregate occupied room nights, not TBO demand.
 */
import {forecastFrom,rollingForecasts} from './learned-demand';
export type MonthRow={month:string;occupiedRoomNights:number};
export type DemandSnapshot={sourceLastUpdated:string;accessedAt:string;rows:MonthRow[]};
type Method='seasonal'|'lag3'|'blend'|'learned';
/** Singapore's COVID period (border closures, quarantine-hotel use) until reopening on 1 Apr 2022: left out of the learned model's fit. */
export const SINGAPORE_SHOCK={from:'2020-02',to:'2022-03'} as const;
const HORIZON=3;
function historyOf(data:Map<string,number>){return [...data.entries()].sort((a,b)=>a[0].localeCompare(b[0])).map(([month,bookings])=>({month,bookings,...(month>=SINGAPORE_SHOCK.from&&month<=SINGAPORE_SHOCK.to?{exclude:true}:{})}))}
/** The planner's learned model (src/lib/learned-demand.ts), refitted for every target on data up to three months before it. */
function learnedForecasts(data:Map<string,number>){return new Map(rollingForecasts(historyOf(data),HORIZON).map(x=>[x.month,x.forecast]))}
export function addMonths(month:string,n:number):string {
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)||!Number.isInteger(n))throw Error('Invalid month');
 const [year,m]=month.split('-').map(Number),total=year*12+m-1+n;return `${Math.floor(total/12).toString().padStart(4,'0')}-${(total%12+1).toString().padStart(2,'0')}`;
}
function mapRows(rows:MonthRow[]){
 const result=new Map<string,number>();for(const row of rows){addMonths(row.month,0);if(result.has(row.month)||!Number.isSafeInteger(row.occupiedRoomNights)||row.occupiedRoomNights<0)throw Error('Invalid data');result.set(row.month,row.occupiedRoomNights)}return result;
}
function monthRange(first:string,last:string){const result:string[]=[];for(let m=first;m<=last;m=addMonths(m,1))result.push(m);return result}
const train=monthRange('2022-01','2023-12'),validation=monthRange('2024-01','2025-09'),holdout=monthRange('2025-10','2026-09');
function estimate(data:Map<string,number>,target:string,method:Method,weight:number,learned?:Map<string,number|null>){const season=data.get(addMonths(target,-12)),last=data.get(addMonths(target,-3));if(season===undefined||last===undefined)throw Error('Required month missing');if(method==='learned'){const v=learned?.get(target);if(v===undefined||v===null)throw Error('Learned forecast unavailable');return v}return method==='seasonal'?season:method==='lag3'?last:weight*season+(1-weight)*last}
function scores(data:Map<string,number>,months:string[],method:Method,weight:number,learned?:Map<string,number|null>){return months.map(month=>{const actual=data.get(month);if(actual===undefined)throw Error('Missing outcome');const prediction=estimate(data,month,method,weight,learned);return {month,actual,prediction,error:prediction-actual}})}
const mae=(points:{error:number}[])=>points.reduce((s,p)=>s+Math.abs(p.error),0)/points.length;
/** All parameter fitting and baseline selection happen before the final 12-month holdout.
 * Fixed split is by outcome month. Prior observed holdout months can be inputs only at lag >=3.
 * Two candidates: the fitted blend (weight fitted on the training months) and the planner's learned model (no tuned
 * parameters; refitted for each target on data up to three months before it, COVID months left out). The candidate with
 * the lower validation MAE is the one checked: it must beat both baselines by more than 5% on validation and holdout.
 * Public revised data do not prove historical release vintages; see documentation.
 */
export function evaluateSingapore(rows:MonthRow[]){
 const data=mapRows(rows);let weight=0,best=Infinity;
 for(let i=0;i<=20;i++){const w=i/20,v=mae(scores(data,train,'blend',w));if(v<best){best=v;weight=w}}
 const learned=learnedForecasts(data);
 const valSeason=mae(scores(data,validation,'seasonal',weight)),valLag=mae(scores(data,validation,'lag3',weight)),valBlend=mae(scores(data,validation,'blend',weight)),valLearned=mae(scores(data,validation,'learned',weight,learned));
 const fallback:Method=valSeason<=valLag?'seasonal':'lag3';
 // Candidate choice uses validation months only.
 const model:'blend'|'learned'=valLearned<valBlend?'learned':'blend';
 const testSeason=mae(scores(data,holdout,'seasonal',weight)),testLag=mae(scores(data,holdout,'lag3',weight)),testBlend=mae(scores(data,holdout,'blend',weight)),testLearned=mae(scores(data,holdout,'learned',weight,learned));
 const valModel=model==='learned'?valLearned:valBlend,testModel=model==='learned'?testLearned:testBlend;
 const passed=valModel<.95*valSeason&&valModel<.95*valLag&&testModel<.95*testSeason&&testModel<.95*testLag;
 const chosen:Method=passed?model:fallback;
 const calibration=scores(data,validation,chosen,weight,learned).map(p=>Math.abs(p.error)).sort((a,b)=>a-b);const radius=calibration[Math.ceil((calibration.length+1)*.8)-1];
 const examples=scores(data,holdout,chosen,weight,learned).map(p=>({...p,lower:Math.max(0,p.prediction-radius),upper:p.prediction+radius}));
 const coverage=examples.filter(p=>p.actual>=p.lower&&p.actual<=p.upper).length/examples.length;
 return {weight,passed,chosen,model,fallback,validation:{seasonal:valSeason,lag3:valLag,blend:valBlend,learned:valLearned,count:validation.length},holdout:{seasonal:testSeason,lag3:testLag,blend:testBlend,learned:testLearned,count:holdout.length,coverage,examples},radius,trainCount:train.length};
}
export function singaporeForecast(snapshot:DemandSnapshot,now:number){
 const ev=evaluateSingapore(snapshot.rows);const data=mapRows(snapshot.rows),last=[...data.keys()].sort().at(-1)!;
 if(!Number.isFinite(now))return {state:'clock' as const,ev,last};
 const capture=Date.parse(snapshot.accessedAt),release=Date.parse(snapshot.sourceLastUpdated+'T00:00:00Z');
 if(!Number.isFinite(capture)||!Number.isFinite(release)||capture>now||release>now||Date.parse(last+'-01T00:00:00Z')>now)return {state:'clock' as const,ev,last};
 const today=new Date(now).toISOString(),current=today.slice(0,7),target=addMonths(current,1);
 // For a next-calendar-month forecast use no observation newer than target minus 3 months.
 // If the pinned snapshot is not at least this recent, suppress rather than extrapolate stale inputs.
 if(last<addMonths(target,-3)||last>=current)return {state:'stale' as const,ev,last,target};
 const observed=data.get(addMonths(target,-3)),prior=data.get(addMonths(target,-12));if(observed===undefined||prior===undefined)return {state:'stale' as const,ev,last,target};
 const prediction=ev.chosen==='learned'?forecastFrom(historyOf(data),addMonths(target,-HORIZON),HORIZON):estimate(data,target,ev.chosen,ev.weight);
 if(prediction===null)return {state:'stale' as const,ev,last,target};
 return {state:'ready' as const,ev,last,target,prediction,lower:Math.max(0,prediction-ev.radius),upper:prediction+ev.radius};
}
