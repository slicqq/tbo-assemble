'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Bookmark, FolderOpen, Save, Trash2 } from 'lucide-react';
import { supabaseBrowser } from '@/lib/supabase/browser';
import { PLAN_MODEL_VERSION, validatePlanInput, type PlanInput } from '@/lib/private-plan';

type Snapshot = { id:string; name:string; source:'synthetic'|'uploaded'; items:unknown; budget:number; risk:number; as_of:string; model_version:string; created_at:string };
export default function PrivatePlanSnapshots({ input, onLoad, hasUnappliedBudget }: { input:PlanInput; onLoad:(input:PlanInput)=>void; hasUnappliedBudget:boolean }) {
 const [owner,setOwner]=useState('');
 const [snapshots,setSnapshots]=useState<Snapshot[]>([]);
 const [name,setName]=useState('');
 const [busy,setBusy]=useState(false);
 const [notice,setNotice]=useState('');
 const [error,setError]=useState('');
 const epoch=useRef(0);
 const ownerRef=useRef('');
 const refresh=useCallback(async()=>{
   const run=++epoch.current;
   try {
     const client=supabaseBrowser();
     const {data,error:authError}=await client.auth.getUser();
     if(run!==epoch.current)return;
     if(authError||!data.user){ownerRef.current='';setOwner('');setSnapshots([]);return;}
     const ownerId=data.user.id;
     if(ownerRef.current!==ownerId){ownerRef.current=ownerId;setSnapshots([]);setNotice('');}
     setOwner(ownerId);
     const result=await client.from('private_inventory_plans').select('id,name,source,items,budget,risk,as_of,model_version,created_at').eq('owner_id',ownerId).order('created_at',{ascending:false}).limit(20);
     if(run!==epoch.current)return;
     if(result.error){setSnapshots([]);setError('Could not load saved plans. Please refresh or sign in again.');return;}
     setError('');setSnapshots((result.data??[]) as Snapshot[]);
   } catch {if(run===epoch.current){ownerRef.current='';setOwner('');setSnapshots([]);setError('Could not verify your account. Please refresh or sign in again.');}}
 },[]);
 useEffect(()=>{
   let subscription:{unsubscribe:()=>void}|undefined;
   try { const client=supabaseBrowser(); const {data}=client.auth.onAuthStateChange(()=>{setTimeout(()=>{void refresh()},0)}); subscription=data.subscription; }
   catch { /* refresh reports configuration failures */ }
   const timer=setTimeout(()=>{void refresh()},0);
   const epochRef=epoch;
   return ()=>{clearTimeout(timer);epochRef.current++;subscription?.unsubscribe()};
 },[refresh]);
 async function save(){
   setError('');setNotice('');
   const title=name.trim();if(!title||title.length>100){setError('Enter a plan name (up to 100 characters).');return;}
   if(hasUnappliedBudget){setError('Apply the budget before saving.');return;}
   setBusy(true);
   try {
     const clean=validatePlanInput(input);
     const client=supabaseBrowser();const {data,error:authError}=await client.auth.getUser();
     if(authError||!data.user||data.user.id!==owner)throw new Error('Please sign in again before saving.');
     const {error:insertError}=await client.from('private_inventory_plans').insert({name:title,source:clean.source,items:clean.items,budget:clean.budget,risk:clean.risk,as_of:clean.asOf,model_version:PLAN_MODEL_VERSION});
     if(insertError)throw new Error('Could not save the plan. Please try again.');
     setName('');setNotice('Inputs saved to your account. Results are recalculated when reopened.');await refresh();
   }catch(e){setError(e instanceof Error?e.message:'Could not save the plan.');}finally{setBusy(false);}
 }
 async function remove(snapshot:Snapshot){
   if(!window.confirm(`Delete “${snapshot.name}” from your saved plans?`))return;
   setError('');setNotice('');setBusy(true);
   try {
     const client=supabaseBrowser();const {data,error:authError}=await client.auth.getUser();
     if(authError||!data.user||data.user.id!==owner)throw new Error('Please sign in again before deleting.');
     const {data:deleted,error:deleteError}=await client.from('private_inventory_plans').delete().eq('id',snapshot.id).select('id');
     if(deleteError||!deleted?.length)throw new Error('Could not delete the saved plan. Please refresh and try again.');
     setNotice('Saved plan deleted. Current inputs have not been changed.');await refresh();
   }catch(e){setError(e instanceof Error?e.message:'Could not delete the saved plan.');}finally{setBusy(false);}
 }
 function load(snapshot:Snapshot){
   try{
     if(snapshot.model_version!==PLAN_MODEL_VERSION && snapshot.model_version!=='scenario-greedy-v2' && snapshot.model_version!=='scenario-grid-v3')throw new Error('This snapshot uses an unsupported model version and cannot be opened here.');
     const clean=validatePlanInput({items:snapshot.items,budget:Number(snapshot.budget),risk:snapshot.risk,asOf:snapshot.as_of,source:snapshot.source});
     onLoad(clean);setError('');setNotice(`Loaded “${snapshot.name}”. ${snapshot.model_version===PLAN_MODEL_VERSION?'':'Recalculated with the newer allocation model. '}Review the date and assumptions before using the results.`);
   }catch(e){setError(e instanceof Error?e.message:'Could not open the saved plan.');setNotice('');}
 }
 return <section id="saved-plans" className="panel saved-plans" aria-labelledby="saved-plans-heading">
  <div className="saved-plans-head"><div className="control-icon"><Bookmark size={18}/></div><div><h2 id="saved-plans-heading">Your saved plans</h2><p>Save your inputs and reopen them later. The current prototype recalculates results; it does not freeze recommendations.</p></div></div>
  {owner?<><div className="saved-plan-form"><label htmlFor="plan-name">Plan name</label><div><input id="plan-name" value={name} onChange={e=>setName(e.target.value)} maxLength={100} placeholder="e.g. December inventory"/><button disabled={busy} onClick={save}><Save size={15}/>{busy?'Saving…':'Save current plan'}</button></div></div>
   {snapshots.length>0?<ul className="saved-plan-list">{snapshots.map(s=><li key={s.id}><div><strong>{s.name}</strong><span>{s.source==='synthetic'?'Synthetic demo':'Uploaded inputs'} · review date {s.as_of} · budget ₹{Number(s.budget).toLocaleString('en-IN')}</span></div><div className="saved-plan-actions"><button disabled={busy} onClick={()=>load(s)} aria-label={`Open saved plan ${s.name}`}><FolderOpen size={15}/> Open</button><button disabled={busy} onClick={()=>remove(s)} aria-label={`Delete saved plan ${s.name}`}><Trash2 size={15}/> Delete</button></div></li>)}</ul>:<p className="saved-empty">No saved plans yet. Name your current inputs and save them to your account.</p>}
   <p className="saved-privacy">Saved plans are scoped to your account. Email ownership is currently unverified; do not upload sensitive data. Old shared event pages are separate and not private. Showing latest 20 snapshots.</p></>:<p className="saved-empty">Use the synthetic planner without signing in, or <Link href="/login">sign in</Link> to save plan inputs to your account. Do not upload sensitive data while email ownership is unverified.</p>}
  {error&&<p role="alert" className="saved-error">{error}</p>}{notice&&<p role="status" className="saved-success">{notice}</p>}
 </section>;
}
