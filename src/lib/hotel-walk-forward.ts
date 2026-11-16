/** A retrospective replay of inferred bookings, not a prospective real-world test. */
import {addDays} from './public-travel-forecast';
import {trainCohort, type CohortRow} from './hotel-cohort-forecast';
export type ReplayRow={date:string; estimate:number; baseline:number; smoothed:number; trained:number|null; lower:number; upper:number; actual:number; method:'trained'|'smoothed'; trainEnd:string; calibrationEnd:string;};
const mae=(values:number[])=>values.reduce((s,v)=>s+Math.abs(v),0)/values.length;

/**
 * Smoothed weekly level: half last week's bookings, half the weekly average of the three weeks before (same arrival
 * window). A decaying-weight average is steadier than last week alone. Chosen on April–June 2016 development data
 * (MAE City 29.7 vs 36.0, Resort 9.3 vs 10.7 for last week alone) before the July–September holdout was scored.
 */
export const smoothedLevel=(row:CohortRow)=>0.5*row.previous7+0.5*row.previous21/3;
/** Predict a historic date using only features and completed seven-day labels available before it. */
function candidate(series:CohortRow[],row:CohortRow):number|null {
 const latest=addDays(row.date,-7), earliest=addDays(row.date,-27);
 const train=series.filter(r=>r.date>=earliest&&r.date<=latest);
 if(train.length!==21)return null;
 const m=trainCohort(train);
 return Math.max(0,m.intercept+m.recent*row.previous7+m.earlier*row.previous21/3);
}
/** 28 completed earlier forecasts are replayed for model choice and interval calibration. */
export function walkForward(rows:CohortRow[],hotel:string,asOf:string):ReplayRow|null {
 const series=rows.filter(r=>r.hotel===hotel).sort((a,b)=>a.date.localeCompare(b.date));
 const sample=series.find(r=>r.date===asOf);if(!sample)return null;
 const calibrationEnd=addDays(asOf,-7),calibrationStart=addDays(calibrationEnd,-27);
 const calibration=series.filter(r=>r.date>=calibrationStart&&r.date<=calibrationEnd);
 if(calibration.length!==28)return null;
 // Each calibration prediction is generated using its own then-available training labels.
 const replays=calibration.map(row=>({row,trained:candidate(series,row)}));
 const complete=replays.filter((x):x is {row:CohortRow;trained:number}=>x.trained!==null);
 const trained=candidate(series,sample);
 // This 20% margin and 21-day training window were chosen by inspecting June development data.
 // July onwards is reserved for independent calendar holdout; fallback is the simple baseline.
 // The trained model must beat the smoothed level by 20% on the same calibration dates; otherwise the smoothed level is used.
 const selectModel=complete.length>=20&&trained!==null&&mae(complete.map(x=>x.trained-x.row.next7))<mae(complete.map(x=>smoothedLevel(x.row)-x.row.next7))*0.8;
 const method=selectModel?'trained' as const:'smoothed' as const;
 const residuals=(selectModel?complete.map(x=>Math.abs(x.trained-x.row.next7)):calibration.map(x=>Math.abs(smoothedLevel(x)-x.next7))).sort((a,b)=>a-b);
 const radius=residuals[Math.min(residuals.length,Math.ceil((residuals.length+1)*0.8))-1];
 const estimate=selectModel?trained!:smoothedLevel(sample);
 return {date:asOf,estimate,trained,baseline:sample.previous7,smoothed:smoothedLevel(sample),lower:Math.max(0,estimate-radius),upper:estimate+radius,actual:sample.next7,method,trainEnd:addDays(asOf,-7),calibrationEnd};
}
export function evaluateWalkForward(rows:CohortRow[],hotel:string,start:string,end:string){
 const samples:ReplayRow[]=[];
 for(let date=start;date<=end;date=addDays(date,1)){const p=walkForward(rows,hotel,date);if(p)samples.push(p)}
 if(!samples.length)throw new Error('No valid historical replay dates');
 return {samples,count:samples.length,selectedMae:mae(samples.map(x=>x.estimate-x.actual)),baselineMae:mae(samples.map(x=>x.baseline-x.actual)),coverage:samples.filter(x=>x.actual>=x.lower&&x.actual<=x.upper).length/samples.length,trainedDays:samples.filter(x=>x.method==='trained').length,smoothedDays:samples.filter(x=>x.method==='smoothed').length};
}
