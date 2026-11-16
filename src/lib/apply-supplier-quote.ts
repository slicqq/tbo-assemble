import {assessSupplierQuotes,type SupplierQuote} from './supplier-quotes';
import type {Opportunity} from './procurement-core';

/** Explicit, manual transfer. The model has date-only expiry, so never grant the
 * partial UTC expiry day; the last modeled date is the preceding UTC day. */
export function applySupplierQuote(items:Opportunity[],quote:SupplierQuote,now:Date,extraPerUnit=0):Opportunity[]{
 if(!Number.isFinite(extraPerUnit)||extraPerUnit<0||extraPerUnit>1000000||Math.abs(extraPerUnit*100-Math.round(extraPerUnit*100))>1e-6||quote.unitPrice+extraPerUnit>10000000)throw new Error('Invalid additional per-unit cost.');
 const timestamp=(s:string)=>{const t=Date.parse(s);return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(s)&&Number.isFinite(t)&&new Date(t).toISOString().replace('.000Z','Z')===s?t:NaN};
 const observed=timestamp(quote.observedAt),expiry=timestamp(quote.expiresAt);
 if(!Number.isFinite(observed)||!Number.isFinite(expiry)||expiry<=observed)throw new Error('Quote timestamps are invalid.');
 const assessment=assessSupplierQuotes([quote],items,now)[0];
 if(assessment.status!=='current')throw new Error('The quote is not currently eligible: check its ID, unit, observation and expiry.');
 const item=items.find(x=>x.id===quote.inventoryId);
 if(!item)throw new Error('The inventory item no longer exists.');
 if(!Number.isFinite(quote.unitPrice)||quote.unitPrice<1||quote.unitPrice>10000000)throw new Error('Planner purchase price must be between ₹1 and ₹1,00,00,000.');
 if(!Number.isSafeInteger(quote.availableUnits)||!Number.isSafeInteger(quote.minimumUnits)||quote.minimumUnits<1||quote.minimumUnits>quote.availableUnits)throw new Error('Quote quantities are invalid.');
 const capacity=Math.min(item.capacity,quote.availableUnits);
 if(quote.minimumUnits>capacity)throw new Error('Quote minimum exceeds the current planner capacity; update inventory before applying.');
 const lastFullDay=new Date(Date.UTC(new Date(expiry).getUTCFullYear(),new Date(expiry).getUTCMonth(),new Date(expiry).getUTCDate())-86400000).toISOString().slice(0,10);
 const today=now.toISOString().slice(0,10);
 if(lastFullDay<today)throw new Error('The quote expires today UTC. The planner uses whole dates, so it cannot safely apply this quote.');
 if(lastFullDay<'1900-01-01'||lastFullDay>'2100-12-31')throw new Error('Quote expiry is outside the supported planner date range.');
 const landed=Math.round((quote.unitPrice+extraPerUnit)*100)/100;
 return items.map(x=>x.id===item.id?{...x,previousBuy:x.buy,buy:landed,recoveryPct:extraPerUnit===0?x.recoveryPct:quote.unitPrice*(x.recoveryPct??0)/landed,capacity,...(x.allotmentCapacity!==undefined?{allotmentCapacity:Math.min(x.allotmentCapacity,capacity)}:{}),minOrderUnits:quote.minimumUnits,quoteExpiry:lastFullDay}:x);
}
