import assert from 'node:assert/strict';
import {buildTraffic,parseCsv,ROUTES,seasonalReference,shiftMonth,isoPlusDays} from '../src/lib/india-market';
assert.deepEqual(parseCsv('a,b\n"one, two","line\nnext"\n'),[['a','b'],['one, two','line\nnext']]);
const csv='Year,Month,City1,City2,PaxToCity2,PaxFromCity2\n2024,1,DELHI,PUNE,10,20\n2024,2,PUNE,DELHI,30,40\n2024,3,DELHI,PUNE,1,2\n2024,3,PUNE,DELHI,4,3\n2025,1,DELHI,PUNE,15,25\n2025,2,DELHI,PUNE,,20\n';
const route=ROUTES.find(r=>r.origin==='DEL'&&r.destination==='PNQ')!;const result=buildTraffic(csv,route);assert.deepEqual(result.monthly.map(r=>r.passengers),[10,40,null,15,null]);assert.equal(result.monthly[2].quality,'ambiguous');assert.equal(result.monthly[4].quality,'invalid');
const reversed=buildTraffic(csv,ROUTES.find(r=>r.origin==='PNQ'&&r.destination==='DEL')!);assert.deepEqual(reversed.monthly.map(r=>r.passengers),[20,30,null,25,20]);
assert.equal(seasonalReference(result.monthly)?.mae,5);assert.equal(shiftMonth('2025-12',1),'2026-01');assert.equal(isoPlusDays(new Date('2026-12-31T22:00:00Z'),1),'2027-01-01');
console.log('India market route parser, ambiguous records, no-zero-fill and baseline tests passed');
