import assert from 'node:assert/strict';
import raw from '../src/data/public-hotel-booking-daily.json';
import {addDays,backtest,predictBookingDay} from '../src/lib/public-travel-forecast';
assert.equal(raw.sourceRecords,119390);assert.equal(raw.recordsInWindow,31971);assert.equal(raw.rows.length,364);
const date='2016-06-29',hotel='City Hotel';
const a=predictBookingDay(raw.rows,hotel,date,1),b=predictBookingDay(raw.rows,hotel,date,2);
assert.ok(a!==null&&b!==null);
const changed=raw.rows.map(r=>r.hotel===hotel&&r.date>=date?{...r,requests:999999}:r);
assert.equal(predictBookingDay(changed,hotel,date,1),a);assert.equal(predictBookingDay(changed,hotel,date,2),b);
assert.equal(predictBookingDay(raw.rows.filter(r=>r.date!=='2016-06-28'),hotel,date,1),null);
assert.throws(()=>addDays('2016-02-30',1));
for(const h of [1,2] as const)for(const method of ['hybrid','seven-day'] as const){const r=backtest(raw.rows,hotel,'2016-05-02','2016-06-30',h,method);assert.equal(r.count,60);assert.ok(r.mae!==null&&r.mae>=0);console.log(h,method,r.mae?.toFixed(2));}
console.log('Public historical forecast, backtest and no-lookahead tests passed');
