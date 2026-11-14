/** Retrospective gross booking-record forecasting; not a current demand or room-night model. */
export type CohortRow = {date:string; hotel:string; previous7:number; previous21:number; next7:number};
type Model = {intercept:number; recent:number; earlier:number};
const trainEnd='2016-04-24', calibrationStart='2016-05-01', calibrationEnd='2016-05-24', testStart='2016-06-01', testEnd='2016-06-30';
const baseline=(r:CohortRow)=>r.previous7;
const predict=(m:Model,r:CohortRow)=>Math.max(0,m.intercept+m.recent*r.previous7+m.earlier*r.previous21/3);
const mae=(errors:number[])=>errors.reduce((s,x)=>s+Math.abs(x),0)/errors.length;

/** Fixed ridge regression fitted only on training labels. 3x3 Gaussian elimination. */
export function trainCohort(rows:CohortRow[]):Model {
 if(rows.length<20)throw new Error('At least 20 training examples required');
 const matrix=Array.from({length:3},()=>[0,0,0,0]);
 for(const r of rows){const x=[1,r.previous7,r.previous21/3];for(let i=0;i<3;i++){for(let j=0;j<3;j++)matrix[i][j]+=x[i]*x[j];matrix[i][3]+=x[i]*r.next7}}
 // Fixed ridge penalty; intercept is not penalised. Not tuned on the test window.
 matrix[1][1]+=100;matrix[2][2]+=100;
 for(let i=0;i<3;i++){let pivot=i;for(let k=i+1;k<3;k++)if(Math.abs(matrix[k][i])>Math.abs(matrix[pivot][i]))pivot=k;[matrix[i],matrix[pivot]]=[matrix[pivot],matrix[i]];if(Math.abs(matrix[i][i])<1e-12)throw new Error('Unable to fit model');const v=matrix[i][i];for(let j=i;j<4;j++)matrix[i][j]/=v;for(let k=0;k<3;k++){if(k===i)continue;const f=matrix[k][i];for(let j=i;j<4;j++)matrix[k][j]-=f*matrix[i][j]}}
 return {intercept:matrix[0][3],recent:matrix[1][3],earlier:matrix[2][3]};
}
export function assessHotelCohorts(rows:CohortRow[],hotel:string) {
 const selected=rows.filter(r=>r.hotel===hotel).sort((a,b)=>a.date.localeCompare(b.date));
 const train=selected.filter(r=>r.date<=trainEnd);
 const cal=selected.filter(r=>r.date>=calibrationStart&&r.date<=calibrationEnd);
 const test=selected.filter(r=>r.date>=testStart&&r.date<=testEnd);
 if(train.length<20||cal.length<20||test.length<20)throw new Error('Insufficient historical records');
 const model=trainCohort(train);
 const calibrationModelMae=mae(cal.map(r=>predict(model,r)-r.next7));
 const calibrationBaselineMae=mae(cal.map(r=>baseline(r)-r.next7));
 // Fix model choice before seeing any test outcome.
 const chosen=calibrationModelMae<calibrationBaselineMae?'trained' as const:'baseline' as const;
 const forecast=(r:CohortRow)=>chosen==='trained'?predict(model,r):baseline(r);
 const residuals=cal.map(r=>Math.abs(forecast(r)-r.next7)).sort((a,b)=>a-b);
 // Split calibration empirical absolute-error radius, nominal 80%, not a guarantee for dependent time series.
 const rank=Math.min(residuals.length,Math.ceil((residuals.length+1)*0.8));
 const radius=residuals[rank-1];
 const predictions=test.map(r=>{const estimate=forecast(r);return {date:r.date,estimate,lower:Math.max(0,estimate-radius),upper:estimate+radius,actual:r.next7,baseline:baseline(r)}});
 return {chosen,trainCount:train.length,calibrationCount:cal.length,testCount:test.length,calibrationModelMae,calibrationBaselineMae,
  modelMae:mae(test.map(r=>predict(model,r)-r.next7)),baselineMae:mae(test.map(r=>baseline(r)-r.next7)),selectedMae:mae(predictions.map(r=>r.estimate-r.actual)),
  coverage:predictions.filter(r=>r.actual>=r.lower&&r.actual<=r.upper).length/predictions.length,radius,predictions};
}
