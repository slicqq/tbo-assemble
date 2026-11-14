import assert from 'node:assert/strict';
import {parsePrivateDraft} from '../src/lib/private-event-draft';
function form(values:Record<string,string>){const f=new FormData();for(const [k,v] of Object.entries(values))f.set(k,v);return f}
const valid={title:'  Example  ',location:' Pune ',starts_on:'2027-02-27',ends_on:'2027-03-01'};
assert.deepEqual(parsePrivateDraft(form(valid)).value,{title:'Example',location:'Pune',starts_on:'2027-02-27',ends_on:'2027-03-01'});
for(const bad of [{title:'   '},{title:'x'.repeat(121)},{location:'x'.repeat(121)},{starts_on:'2027-02-30'},{ends_on:'2026-01-01'},{starts_on:'9999-01-01'}])assert.ok(parsePrivateDraft(form({...valid,...bad})).error);
assert.ok(parsePrivateDraft(new FormData()).error);
console.log('Private event draft input validation passed');
