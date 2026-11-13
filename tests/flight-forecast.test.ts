import assert from 'node:assert/strict';
import {exampleHistory,parseHistoryCSV,forecastRoute} from '../src/lib/flight-forecast';
const asOf='2026-11-13',text=exampleHistory(asOf),rows=parseHistoryCSV(text);
assert.equal(rows.length,28);
const f=forecastRoute(rows,'BOM','DEL',asOf);assert.equal(f.historyRows,28);assert.ok(f.predictions.every(x=>x.bookings!==null&&x.minFare!==null));assert.ok(f.bookingsMetrics[0].count>=5&&f.bookingsMetrics[0].mae!==null);assert.ok(f.bookingsMetrics[1].count>=5);
const appended=rows.concat([{...rows[27],date:'2026-11-13',bookings:1000000,minFare:1},{...rows[27],date:'2026-11-14',bookings:1000000,minFare:1}]);const withFuture=forecastRoute(appended,'BOM','DEL',asOf);assert.deepEqual(withFuture.predictions,f.predictions);assert.equal(withFuture.ignoredRows,2);
const missing=forecastRoute(rows.filter(r=>r.date!=='2026-11-12'),'BOM','DEL',asOf);assert.equal(missing.predictions[0].bookings,null);assert.equal(missing.lookToBook,null);
assert.throws(()=>parseHistoryCSV(text+'\n'+text.split('\n')[1]),/duplicate/);assert.throws(()=>parseHistoryCSV(text.replace('BOM,DEL','BOM,BOM')),/invalid/);
console.log('Forecast, rolling backtest and no-look-ahead tests passed');
