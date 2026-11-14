export type PrivateEvent={id:string;title:string;location:string;starts_on:string;ends_on:string};
export type PrivateRoom={id:string;event_id:string;hotel_name:string;room_type:string;total_qty:number;rate:number};
export type WorkspaceState={ok:boolean;message:string};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function validWorkspaceId(value:FormDataEntryValue|null):value is string{return typeof value==='string'&&uuid.test(value)}
export function parsePrivateRoom(form:FormData):{value:{hotel_name:string;room_type:string;total_qty:number;rate:number};error:null}|{value:null;error:string}{
 const hotel=form.get('hotel_name'),type=form.get('room_type'),quantity=form.get('total_qty'),rate=form.get('rate');
 if(typeof hotel!=='string'||!hotel.trim()||hotel.trim().length>120||typeof type!=='string'||!type.trim()||type.trim().length>120)return {value:null,error:'Enter a hotel and room type of up to 120 characters.'};
 if(typeof quantity!=='string'||!/^\d+$/.test(quantity)||Number(quantity)<1||Number(quantity)>10000)return {value:null,error:'Enter a whole-number room quantity between 1 and 10,000.'};
 if(typeof rate!=='string'||!/^\d+(\.\d{1,2})?$/.test(rate)||Number(rate)>10000000)return {value:null,error:'Enter a rate between ₹0 and ₹1,00,00,000 with at most two decimal places.'};
 return {value:{hotel_name:hotel.trim(),room_type:type.trim(),total_qty:Number(quantity),rate:Number(rate)},error:null};
}
