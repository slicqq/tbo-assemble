import assert from 'node:assert/strict';
const base=process.env.TEST_BASE_URL || 'http://localhost:3000';
async function get(path){const r=await fetch(base+path);return {status:r.status,data:await r.json()};}
const demand=await get('/api/market/demand?destination=Goa');
assert.equal(demand.status,200);assert.equal(demand.data.destination,'Goa');assert.equal(demand.data.days.length,14);assert.ok(demand.data.recent>=0);assert.ok(demand.data.previous>=0);
assert.equal((await get('/api/market/demand?destination=BAD')).status,400);
const holidays=await get('/api/market/holidays?country=SG&year=2027');
assert.equal(holidays.status,200);assert.ok(Array.isArray(holidays.data.holidays));assert.equal(holidays.data.country,'SG');
const india=await get('/api/market/holidays?country=IN&year=2027');
assert.equal(india.status,200);assert.ok(Array.isArray(india.data.holidays));
assert.equal((await get('/api/market/holidays?country=NOPE&year=2027')).status,400);
assert.equal((await get('/api/market/holidays?country=SG&year=oops')).status,400);
console.log('Live market API integration checks passed');
