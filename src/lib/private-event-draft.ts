export type DraftInput={title:string;location:string;starts_on:string;ends_on:string};
const validDate=(s:string)=>/^\d{4}-\d\d-\d\d$/.test(s) && s>='1900-01-01' && s<='2100-12-31' && Number.isFinite(Date.parse(s+'T00:00:00Z')) && new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
export function parsePrivateDraft(input:FormData):{value:DraftInput;error:null}|{value:null;error:string}{
 const title=input.get('title'),location=input.get('location'),start=input.get('starts_on'),end=input.get('ends_on');
 if(typeof title!=='string'||!title.trim()||title.trim().length>120)return {value:null,error:'Enter an event name of up to 120 characters.'};
 if(typeof location!=='string'||location.trim().length>120)return {value:null,error:'Location must be 120 characters or fewer.'};
 if(typeof start!=='string'||typeof end!=='string'||!validDate(start)||!validDate(end)||end<start)return {value:null,error:'Choose valid start and end dates, with the end on or after the start.'};
 return {value:{title:title.trim(),location:location.trim(),starts_on:start,ends_on:end},error:null};
}
