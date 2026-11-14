import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {shiftMonth,type MonthlyTraffic} from '../src/lib/india-market';
import {studyTraffic} from '../src/lib/india-traffic-forecast';
function series():MonthlyTraffic[]{const rows:MonthlyTraffic[]=[];let month='2021-01';for(let i=0;i<70;i++,month=shiftMonth(month,1)){const factor=[1,1.1,1.2,1.3,1.4,1.5,1.6,1.5,1.4,1.3,1.2,1.1][i%12];rows.push({month,passengers:Math.round((120+i*3)*factor),quality:'ok'});}return rows}
test('replay trains on the past only and scores fixed 2024–2025 against both baselines',()=>{
 const data=series(),a=studyTraffic(data,'2026-11');assert.equal(a.commonCount,24);assert.equal(a.latestMonth,'2026-10');assert.equal(a.targetMonth,'2026-12');
 assert.ok(a.selectedMae!==null&&a.lastObservedMae!==null&&a.lastYearMae!==null);assert.equal(a.status,'available');assert.ok(a.selectedMae<a.lastObservedMae*.95&&a.selectedMae<a.lastYearMae*.95);assert.notEqual(a.forecast,null);
 const modified=data.map(r=>r.month>='2025-06'?{...r,passengers:(r.passengers??0)+90000}:r);const b=studyTraffic(modified,'2026-11');
 const before=a.replays.find(r=>r.month==='2025-06')!,after=b.replays.find(r=>r.month==='2025-06')!;assert.equal(before.prediction,after.prediction);assert.equal(before.method,after.method);assert.notEqual(before.actual,after.actual);
});
test('stale, missing, duplicate-quality and future records never create fresh forecasts',()=>{
 const data=series(),stale=studyTraffic(data,'2027-02');assert.equal(stale.status,'stale');assert.equal(stale.forecast,null);
 const duplicate=studyTraffic([...data,data[data.length-1]],'2026-11');assert.equal(duplicate.status,'stale');
 const missing=data.map(r=>r.month==='2026-10'?{...r,passengers:null,quality:'ambiguous' as const}:r);assert.equal(studyTraffic(missing,'2026-11').status,'stale');
 const future=[...data,{month:'2026-11',passengers:999999,quality:'ok' as const},{month:'2026-12',passengers:999999,quality:'ok' as const}];const clean=studyTraffic(data,'2026-11'),withFuture=studyTraffic(future,'2026-11');assert.deepEqual(clean,withFuture);
 const flat=data.map(r=>({...r,passengers:100}));const noBenefit=studyTraffic(flat,'2026-11');assert.equal(noBenefit.status,'baseline-not-beaten');assert.equal(noBenefit.forecast,null);
 assert.throws(()=>studyTraffic(data,'2026-13'),/Invalid/);
});
