import { parseCSV } from './inventory-csv';
import { forecastRoute, type DailyHistory } from './flight-forecast';

export type HotelHistory = { date:string; hotel:string; bookedRoomNights:number; cancelledRoomNights:number; searches:number };
const columns = ['date','hotel','bookedRoomNights','cancelledRoomNights','searches'] as const;
const day = 86400000;
function isDate(s:string) { return /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(Date.parse(s+'T00:00:00Z')) && new Date(s+'T00:00:00Z').toISOString().slice(0,10) === s; }
export function parseHotelHistoryCSV(text:string):HotelHistory[] {
 const rows = parseCSV(text.replace(/^\uFEFF/,''));
 if(rows.length < 2 || rows.length > 5001) throw new Error('Include a header and 1–5,000 daily rows.');
 const headers = rows[0]; if(new Set(headers).size !== headers.length || columns.some(c => !headers.includes(c))) throw new Error('Missing or duplicate columns. Download the sample for the required header.');
 const ids = new Set<string>();
 return rows.slice(1).map((row,index) => {
  if(row.length !== headers.length) throw new Error(`Row ${index+2}: incorrect column count.`);
  const v = Object.fromEntries(headers.map((h,i)=>[h,row[i]]));
  if(!isDate(v.date)) throw new Error(`Row ${index+2}: date must be a valid YYYY-MM-DD date.`);
  if(!v.hotel || v.hotel.length > 120) throw new Error(`Row ${index+2}: hotel is required and must be at most 120 characters.`);
  const id = `${v.date}\0${v.hotel.toLocaleLowerCase('en-US')}`;
  if(ids.has(id)) throw new Error(`Row ${index+2}: duplicate date and hotel.`); ids.add(id);
  const number = (field:string) => { if(!/^\d+$/.test(v[field]) || Number(v[field]) > 10000000) throw new Error(`Row ${index+2}: ${field} must be a whole number from 0 to 10000000.`); return Number(v[field]); };
  const bookedRoomNights=number('bookedRoomNights'),cancelledRoomNights=number('cancelledRoomNights'),searches=number('searches');
  if(cancelledRoomNights>bookedRoomNights) throw new Error(`Row ${index+2}: cancellations cannot exceed same-day booked room nights.`);
  return {date:v.date,hotel:v.hotel,bookedRoomNights,cancelledRoomNights,searches};
 });
}
export function exampleHotelCSV(asOf:string) {
 if(!isDate(asOf)) throw new Error('Invalid as-of date.');
 const end=Date.parse(asOf+'T00:00:00Z')-day;
 const rows=Array.from({length:28},(_,i)=>{const date=new Date(end-(27-i)*day).toISOString().slice(0,10);return `${date},Sample Goa Beach Hotel,${35+(i%7)*3+Math.floor(i/7)},${3+(i%3)},${500+i*7}`;});
 return [columns.join(','),...rows].join('\n');
}
export function forecastHotel(rows:HotelHistory[], hotel:string, asOf:string) {
 const selected=rows.filter(row => row.hotel.toLocaleLowerCase('en-US') === hotel.toLocaleLowerCase('en-US'));
 const compatible:DailyHistory[]=selected.map(row=>({date:row.date,origin:'HTL',destination:'ALL',bookings:row.bookedRoomNights,cancellations:row.cancelledRoomNights,searches:row.searches,minFare:null}));
 const forecast=forecastRoute(compatible,'HTL','ALL',asOf);
 const past=selected.filter(row=>row.date<asOf).sort((a,b)=>a.date.localeCompare(b.date));
 return { predictions: forecast.predictions.map(p=>({date:p.date,netRoomNights:p.bookings})), metrics:forecast.bookingsMetrics, historyRows:forecast.historyRows,ignoredRows:forecast.ignoredRows,lastDate:forecast.lastDate,history:past };
}
