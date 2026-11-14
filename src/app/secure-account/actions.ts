'use server';
import {revalidatePath} from 'next/cache';
import {supabaseServer} from '@/lib/supabase/server';
import {parsePrivateDraft} from '@/lib/private-event-draft';
export type DraftActionState={ok:boolean;message:string};
export async function createPrivateDraft(_state:DraftActionState,formData:FormData):Promise<DraftActionState>{
 const parsed=parsePrivateDraft(formData);
 if(!parsed.value)return {ok:false,message:parsed.error};
 try{
  const client=await supabaseServer();
  const {data:{user},error:authError}=await client.auth.getUser();
  if(authError||!user)return {ok:false,message:'Your session has expired. Please sign in again.'};
  // Supabase uses the signed-in user's token; PostgreSQL RLS and column grants
  // assign/check ownership. No privileged Prisma connection is used here.
  const {error}=await client.from('private_event_drafts').insert(parsed.value);
  if(error)return {ok:false,message:'Could not save the draft. Please try again.'};
  revalidatePath('/secure-account');
  return {ok:true,message:'Draft saved to your account.'};
 }catch{return {ok:false,message:'Could not verify your session or save the draft. Please try again.'}}
}
