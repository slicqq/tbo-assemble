import type { Opportunity } from './procurement';
export const columns=['id','name','destination','kind','period','buy','referencePrice','capacity','bookings','searches','conversion','seasonal','signal','cancellations','volatility','soldOut','integration','timing'] as const;
export const optionalColumns=['existingStock','recoveryPct','previousBuy','quoteExpiry','previousBookings','previousSearches','minOrderUnits','fixedOrderFee'] as const;
export const csvTemplate=[[...columns,...optionalColumns].join(','),'sample-goa,Sample Goa hotel,Goa,Hotel,Dec 2026,6400,9200,160,125,3100,0.045,1.18,1.08,0.12,0.28,24,Direct contract,Buy now,10,0.2,6600,2026-12-20,110,2800,10,500'].join('\n');
export function parseCSV(text:string):string[][] {
 const rows:string[][]=[];let row:string[]=[];let value='';let inQuotes=false;let closed=false;
 for(let i=0;i<text.length;i++){const c=text[i];
  if(inQuotes){if(c==='"'){if(text[i+1]==='"'){value+='"';i++}else{inQuotes=false;closed=true}}else value+=c;continue}
  if(c==='"'){if(value.trim() || closed)throw new Error('Invalid quote in CSV.');inQuotes=true;continue}
  if(c===','||c==='\n'||c==='\r'){row.push(value.trim());value='';closed=false;if(c!==','){if(c==='\r'&&text[i+1]==='\n')i++;if(row.some(x=>x!==''))rows.push(row);row=[]}continue}
  if(closed && !/\s/.test(c))throw new Error('Unexpected character after quoted value.');if(!closed)value+=c;
 }
 if(inQuotes)throw new Error('Unclosed quote in CSV.');row.push(value.trim());if(row.some(x=>x!==''))rows.push(row);return rows;
}
export function readInventoryCSV(text:string):Opportunity[]{
 const rows=parseCSV(text.replace(/^\uFEFF/,''));if(rows.length<2)throw new Error('Include the header and at least one inventory row.');if(rows.length>21)throw new Error('Maximum 20 inventory rows per file.');
 const headers=rows[0];if(new Set(headers).size!==headers.length||columns.some(c=>!headers.includes(c)))throw new Error('Missing or duplicate columns. Download the template for the required header.');
 const ids=new Set<string>();let totalCapacity=0;
 return rows.slice(1).map((values,index)=>{const label=`Row ${index+2}`;if(values.length!==headers.length)throw new Error(`${label}: column count does not match the header.`);
 const o=Object.fromEntries(headers.map((h,i)=>[h,values[i]]));
 for(const f of ['id','name','destination','period','integration','timing'])if(!o[f]||o[f].length>120)throw new Error(`${label}: ${f} is required and must be at most 120 characters.`);
 if(ids.has(o.id))throw new Error(`${label}: id must be unique.`);ids.add(o.id);
 if(o.kind!=='Hotel'&&o.kind!=='Flight')throw new Error(`${label}: kind must be Hotel or Flight.`);
 const limits:Record<string,[number,number,boolean]>={buy:[1,10000000,false],referencePrice:[1,10000000,false],capacity:[0,500,true],bookings:[0,1000000,false],searches:[0,10000000,false],conversion:[0,1,false],seasonal:[0,5,false],signal:[0,5,false],cancellations:[0,1,false],volatility:[0,1,false],soldOut:[0,100,false]};
 const n:Record<string,number>={};for(const [key,[min,max,integer]] of Object.entries(limits)){if(o[key]===''||!Number.isFinite(Number(o[key])))throw new Error(`${label}: ${key} must be a number.`);const x=Number(o[key]);if(x<min||x>max||(integer&&!Number.isInteger(x)))throw new Error(`${label}: ${key} must be ${integer?'a whole number ':''}between ${min} and ${max}.`);n[key]=x;}
 totalCapacity+=n.capacity;if(totalCapacity>3000)throw new Error('Total capacity cannot exceed 3,000 units in this prototype.');
 for(const [field,min,max] of [['existingStock',0,1000000],['recoveryPct',0,1],['previousBuy',0,10000000],['previousBookings',0,1000000],['previousSearches',0,10000000]] as const){if(o[field]){const v=Number(o[field]);if(!Number.isFinite(v)||v<min||v>max||(field==='existingStock'&&!Number.isInteger(v)))throw new Error(`${label}: invalid ${field}.`);n[field]=v;}}
 if(o.minOrderUnits){const v=Number(o.minOrderUnits);if(!Number.isInteger(v)||v<1||v>n.capacity)throw new Error(`${label}: minOrderUnits must be a whole number from 1 to capacity.`);n.minOrderUnits=v;}
 if(o.fixedOrderFee){const v=Number(o.fixedOrderFee);if(!Number.isFinite(v)||v<0||v>10000000)throw new Error(`${label}: fixedOrderFee must be between 0 and 10000000 INR.`);n.fixedOrderFee=v;}
 if(o.quoteExpiry && (!/^\d{4}-\d{2}-\d{2}$/.test(o.quoteExpiry)||!Number.isFinite(Date.parse(o.quoteExpiry+'T00:00:00Z'))||new Date(o.quoteExpiry+'T00:00:00Z').toISOString().slice(0,10)!==o.quoteExpiry))throw new Error(`${label}: quoteExpiry must be a valid YYYY-MM-DD date.`);
 return {minOrderUnits:n.minOrderUnits,fixedOrderFee:n.fixedOrderFee,previousBookings:n.previousBookings||undefined,previousSearches:n.previousSearches||undefined,existingStock:n.existingStock||0,recoveryPct:n.recoveryPct||0,previousBuy:n.previousBuy||undefined,quoteExpiry:o.quoteExpiry||undefined,id:o.id,name:o.name,destination:o.destination,kind:o.kind,period:o.period,integration:o.integration,timing:o.timing,buy:n.buy,referencePrice:n.referencePrice,capacity:n.capacity,bookings:n.bookings,searches:n.searches,conversion:n.conversion,seasonal:n.seasonal,signal:n.signal,cancellations:n.cancellations,volatility:n.volatility,soldOut:n.soldOut} as Opportunity;
 });
}
