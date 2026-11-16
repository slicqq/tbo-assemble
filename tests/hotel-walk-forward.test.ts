import assert from 'node:assert/strict';
import raw from '../src/data/public-hotel-cohorts.json';
import {evaluateWalkForward,walkForward} from '../src/lib/hotel-walk-forward';
for(const hotel of ['City Hotel','Resort Hotel']){
 const date='2016-09-15',original=walkForward(raw.rows,hotel,date);assert.ok(original);
 // Neither the current outcome nor any not-yet-completed outcomes/features may influence it.
 const changed=raw.rows.map(r=>r.hotel===hotel&&r.date>'2016-09-08'?{...r,next7:999999,...(r.date>date?{previous7:888888,previous21:999999}:{})}:r);
 const replay=walkForward(changed,hotel,date);assert.ok(replay);
 for(const key of ['estimate','baseline','smoothed','trained','lower','upper','method','trainEnd','calibrationEnd'] as const)assert.equal(replay[key],original[key],key);
 assert.equal(original.trainEnd,'2016-09-08');assert.equal(original.calibrationEnd,'2016-09-08');
 const result=evaluateWalkForward(raw.rows,hotel,'2016-09-01','2016-09-30');
 assert.equal(result.count,30);assert.ok(result.coverage>=0&&result.coverage<=1);
 assert.ok(result.samples.every(r=>r.lower>=0&&r.lower<=r.estimate&&r.estimate<=r.upper));
 console.log(hotel,'selected',result.selectedMae.toFixed(2),'baseline',result.baselineMae.toFixed(2),'coverage',result.coverage,'trained days',result.trainedDays);
 // September holdout: the adaptive forecast (smoothed level unless the trained model wins calibration) beats "last 7 days".
 assert.ok(result.selectedMae<result.baselineMae,`${hotel}: beats the last-7-days baseline on the September holdout`);
 assert.equal(result.trainedDays+result.smoothedDays,result.count);
 // The smoothed level was chosen on development data, where it also beats the baseline.
 const dev=evaluateWalkForward(raw.rows,hotel,'2016-04-01','2016-06-30');
 assert.ok(dev.selectedMae<dev.baselineMae,`${hotel}: beats the baseline on April–June development data`);
}
assert.equal(walkForward(raw.rows,'City Hotel','2016-03-01'),null);
console.log('Walk-forward, delayed labels, selection and no-lookahead tests passed');
