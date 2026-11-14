import assert from 'node:assert/strict';
import raw from '../src/data/public-hotel-cohorts.json';
import {assessHotelCohorts} from '../src/lib/hotel-cohort-forecast';
assert.equal(raw.validSourceRecords,119390);assert.equal(raw.rows.length,428);
for(const hotel of ['City Hotel','Resort Hotel']) {
 const a=assessHotelCohorts(raw.rows,hotel);
 assert.equal(a.trainCount,55);assert.equal(a.calibrationCount,24);assert.equal(a.testCount,30);
 assert.ok(Number.isFinite(a.modelMae)&&Number.isFinite(a.baselineMae));
 assert.ok(a.coverage>=0&&a.coverage<=1);
 assert.ok(a.predictions.every(p=>p.lower>=0&&p.lower<=p.estimate&&p.estimate<=p.upper));
 // Changing test outcomes must not change forecasts, interval or pre-holdout method selection.
 const changed=raw.rows.map(r=>r.hotel===hotel&&r.date>='2016-06-01'?{...r,next7:999999}:r);
 const b=assessHotelCohorts(changed,hotel);
 assert.equal(a.chosen,b.chosen);assert.equal(a.radius,b.radius);
 assert.deepEqual(a.predictions.map(({date,estimate,lower,upper})=>({date,estimate,lower,upper})),b.predictions.map(({date,estimate,lower,upper})=>({date,estimate,lower,upper})));
 console.log(hotel,'chosen',a.chosen,'holdout trained MAE',a.modelMae.toFixed(2),'baseline MAE',a.baselineMae.toFixed(2),'coverage',a.coverage);
}
assert.throws(()=>assessHotelCohorts([], 'City Hotel'),/Insufficient/);
console.log('Cohort pipeline separation and retrospective tests passed');
