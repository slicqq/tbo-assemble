import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {quoteColumns,readSupplierQuotes,assessSupplierQuotes} from '../src/lib/supplier-quotes';
import {opportunities} from '../src/lib/procurement-core';
const headers=quoteColumns.join(',');
const row=['q1','goa','Supplier A','room-night','6400.25','60','10','2026-11-01T12:00:00Z','2026-11-20T12:00:00Z','Non-refundable','Excluded'];
const csv=(r:string[]=row)=>`${headers}\n${r.join(',')}`;
function changed(i:number,value:string){const r=[...row];r[i]=value;return r;}
test('valid quote parsing and precise expiration, product and unit checks',()=>{
 const quotes=readSupplierQuotes(csv());assert.equal(quotes[0].unitPrice,6400.25);assert.equal(quotes[0].minimumUnits,10);
 const at=(s:string)=>assessSupplierQuotes(quotes,opportunities,new Date(s))[0].status;
 assert.equal(at('2026-11-01T11:59:59Z'),'not-yet-observed');assert.equal(at('2026-11-01T12:00:00Z'),'current');assert.equal(at('2026-11-20T11:59:59Z'),'current');assert.equal(at('2026-11-20T12:00:00Z'),'expired');
 const unmatched=readSupplierQuotes(csv(changed(1,'missing')));assert.equal(assessSupplierQuotes(unmatched,opportunities,new Date('2026-11-02T00:00:00Z'))[0].status,'unmatched');
 const wrong=readSupplierQuotes(csv(changed(3,'seat')));assert.equal(assessSupplierQuotes(wrong,opportunities,new Date('2026-11-02T00:00:00Z'))[0].status,'unit-mismatch');
 assert.throws(()=>assessSupplierQuotes(quotes,opportunities,new Date('bad')),/Invalid review/);
});
test('reject malformed, ambiguous and incomplete files as a whole',()=>{
 assert.throws(()=>readSupplierQuotes('id,supplier\nx,y'),/Columns/);
 assert.throws(()=>readSupplierQuotes(`${csv()}\n${row.join(',')}`),/unique/);
 for(const [i,x] of [[4,'0'],[4,'1e3'],[4,'22.333'],[5,'4.5'],[6,'0'],[6,'61'],[7,'2026-02-30T00:00:00Z'],[7,'2026-11-01T12:00:00+05:30'],[8,'2026-11-01T12:00:00Z'],[9,''],[10,'']] as Array<[number,string]>)assert.throws(()=>readSupplierQuotes(csv(changed(i,x))),Error,`bad field ${i}: ${x}`);
 assert.throws(()=>readSupplierQuotes(`${headers}\n${Array.from({length:101},(_,i)=>changed(0,'q'+i).join(',')).join('\n')}`),/100 quotes/);
 const withComma=[...row];withComma[9]='"Flexible, conditions apply"';assert.equal(readSupplierQuotes(csv(withComma))[0].cancellationTerms,'Flexible, conditions apply');
});
