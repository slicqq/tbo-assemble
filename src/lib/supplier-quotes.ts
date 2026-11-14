import {parseCSV} from './inventory-csv';
import type {Opportunity} from './procurement-core';

export const quoteColumns=['quote_id','inventory_id','supplier','unit','unit_price_inr','available_units','minimum_units','observed_at_utc','expires_at_utc','cancellation_terms','taxes_fees'] as const;
export const quoteTemplate=[quoteColumns.join(','),'demo-quote-a,demo-hotel,Synthetic Supplier A,room-night,6400,60,10,2026-11-01T00:00:00Z,2026-12-01T23:59:59Z,Non-refundable,Excluded', 'demo-quote-b,demo-hotel,Synthetic Supplier B,room-night,6900,40,1,2026-11-01T00:00:00Z,2026-12-01T23:59:59Z,Free cancellation until deadline,Included'].join('\n');
export type SupplierQuote={quoteId:string;inventoryId:string;supplier:string;unit:'seat'|'room-night';unitPrice:number;availableUnits:number;minimumUnits:number;observedAt:string;expiresAt:string;cancellationTerms:string;taxesFees:string};
export type QuoteAssessment={quote:SupplierQuote;status:'current'|'expired'|'not-yet-observed'|'unmatched'|'unit-mismatch';itemName:string|null};
const time=(s:string)=>{if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(s))return NaN;const n=Date.parse(s);if(!Number.isFinite(n)||new Date(n).toISOString().replace('.000Z','Z')!==s)return NaN;return n};
export function readSupplierQuotes(text:string):SupplierQuote[]{
 const rows=parseCSV(text.replace(/^\uFEFF/,''));if(rows.length<2)throw Error('Include the header and at least one quote.');if(rows.length>101)throw Error('Maximum 100 quotes per file.');
 const headers=rows[0];if(headers.length!==quoteColumns.length||new Set(headers).size!==headers.length||quoteColumns.some(c=>!headers.includes(c)))throw Error('Columns must exactly match the supplier quote template.');
 const seen=new Set<string>();return rows.slice(1).map((values,index)=>{
  const label=`Row ${index+2}`;if(values.length!==headers.length)throw Error(`${label}: column count does not match the header.`);const r=Object.fromEntries(headers.map((h,i)=>[h,values[i]]));
  for(const field of ['quote_id','inventory_id','supplier','cancellation_terms','taxes_fees'])if(!r[field]||r[field].length>200)throw Error(`${label}: ${field} is required and must be at most 200 characters. Use Unknown for terms you do not have.`);
  if(seen.has(r.quote_id))throw Error(`${label}: quote_id must be unique.`);seen.add(r.quote_id);
  if(r.unit!=='seat'&&r.unit!=='room-night')throw Error(`${label}: unit must be seat or room-night.`);
  if(!/^(?:\d+)(?:\.\d{1,2})?$/.test(r.unit_price_inr))throw Error(`${label}: unit_price_inr must be a positive price with at most two decimal places.`);
  const price=Number(r.unit_price_inr);if(!Number.isFinite(price)||price<=0||price>10000000)throw Error(`${label}: unit price must be between 0 and 10,000,000 INR.`);
  for(const field of ['available_units','minimum_units'])if(!/^\d+$/.test(r[field])||!Number.isSafeInteger(Number(r[field]))||Number(r[field])>1000000)throw Error(`${label}: ${field} must be a whole number between 0 and 1,000,000.`);
  const available=Number(r.available_units),minimum=Number(r.minimum_units);if(minimum<1||minimum>available)throw Error(`${label}: minimum_units must be at least 1 and no greater than available_units.`);
  const observed=time(r.observed_at_utc),expires=time(r.expires_at_utc);if(!Number.isFinite(observed)||!Number.isFinite(expires)||expires<=observed)throw Error(`${label}: enter valid UTC timestamps as YYYY-MM-DDTHH:MM:SSZ; expiry must be after observation.`);
  return {quoteId:r.quote_id,inventoryId:r.inventory_id,supplier:r.supplier,unit:r.unit,unitPrice:price,availableUnits:available,minimumUnits:minimum,observedAt:r.observed_at_utc,expiresAt:r.expires_at_utc,cancellationTerms:r.cancellation_terms,taxesFees:r.taxes_fees};
 });
}
/** Current validates dates and matching only, not authenticity, terms or bookability. */
export function assessSupplierQuotes(quotes:SupplierQuote[],items:Opportunity[],now:Date):QuoteAssessment[]{
 const t=now.getTime();if(!Number.isFinite(t))throw Error('Invalid review time.');const inventory=new Map(items.map(i=>[i.id,i]));
 return quotes.map(quote=>{const item=inventory.get(quote.inventoryId);const status=!item?'unmatched':quote.unit!==(item.kind==='Flight'?'seat':'room-night')?'unit-mismatch':time(quote.observedAt)>t?'not-yet-observed':time(quote.expiresAt)<=t?'expired':'current';return {quote,status,itemName:item?.name??null};});
}
