'use server';
import {revalidatePath} from 'next/cache';
import {supabaseServer} from '@/lib/supabase/server';
import {parsePrivateDraft} from '@/lib/private-event-draft';
import {parsePrivateRoom,validWorkspaceId,type WorkspaceState} from '@/lib/private-event-workspace';

async function context(){const client=await supabaseServer();const {data,error}=await client.auth.getUser();if(error||!data.user)throw new Error('session');return {client,owner:data.user.id}}
function refreshed(){revalidatePath('/dashboard/private-events');revalidatePath('/secure-account')}
const failure:WorkspaceState={ok:false,message:'Unable to save. Please check your session and try again.'};
export async function saveEvent(_state:WorkspaceState,form:FormData):Promise<WorkspaceState>{
 const parsed=parsePrivateDraft(form);if(!parsed.value)return {ok:false,message:parsed.error};
 const id=form.get('id');if(id!==null&&!validWorkspaceId(id))return {ok:false,message:'Invalid event.'};
 try{const {client,owner}=await context();
  const query=id===null?client.from('private_event_drafts').insert(parsed.value):client.from('private_event_drafts').update(parsed.value).eq('id',id).eq('owner_id',owner);
  const {data,error}=await query.select('id');if(error||data?.length!==1)return failure;
  refreshed();return {ok:true,message:id===null?'Private event created.':'Event updated.'};
 }catch{return failure}
}
export async function deleteEvent(_state:WorkspaceState,form:FormData):Promise<WorkspaceState>{
 const id=form.get('id');if(!validWorkspaceId(id))return {ok:false,message:'Invalid event.'};
 try{const {client,owner}=await context();const {data,error}=await client.from('private_event_drafts').delete().eq('id',id).eq('owner_id',owner).select('id');if(error||data?.length!==1)return failure;refreshed();return {ok:true,message:'Event and its private room blocks deleted.'}}catch{return failure}
}
export async function saveRoom(_state:WorkspaceState,form:FormData):Promise<WorkspaceState>{
 const event=form.get('event_id'),id=form.get('id');if(!validWorkspaceId(event)||(id!==null&&!validWorkspaceId(id)))return {ok:false,message:'Invalid event or room.'};
 const parsed=parsePrivateRoom(form);if(!parsed.value)return {ok:false,message:parsed.error};
 try{const {client,owner}=await context();
  const query=id===null?client.from('private_event_room_blocks').insert({...parsed.value,event_id:event}):client.from('private_event_room_blocks').update(parsed.value).eq('id',id).eq('event_id',event).eq('owner_id',owner);
  const {data,error}=await query.select('id');if(error||data?.length!==1)return failure;
  refreshed();return {ok:true,message:id===null?'Private room block added.':'Room block updated.'};
 }catch{return failure}
}
export async function deleteRoom(_state:WorkspaceState,form:FormData):Promise<WorkspaceState>{
 const id=form.get('id'),event=form.get('event_id');if(!validWorkspaceId(id)||!validWorkspaceId(event))return {ok:false,message:'Invalid event or room.'};
 try{const {client,owner}=await context();const {data,error}=await client.from('private_event_room_blocks').delete().eq('id',id).eq('event_id',event).eq('owner_id',owner).select('id');if(error||data?.length!==1)return failure;refreshed();return {ok:true,message:'Private room block deleted.'}}catch{return failure}
}
