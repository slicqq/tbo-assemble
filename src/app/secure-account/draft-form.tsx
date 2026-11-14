'use client';
import {useActionState,useEffect,useRef} from 'react';
import {createPrivateDraft} from './actions';
export function DraftForm(){
 const [state,action,pending]=useActionState(createPrivateDraft,{ok:false,message:''});
 const form=useRef<HTMLFormElement>(null);
 useEffect(()=>{if(state.ok)form.current?.reset()},[state]);
 const field='mt-1 w-full rounded-xl border border-input bg-background px-3 py-3 text-base text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring';
 return <form ref={form} action={action} className="space-y-4">
  <div><label htmlFor="draft-title" className="text-sm font-medium">Event name</label><input id="draft-title" name="title" required maxLength={120} className={field} placeholder="e.g. Client conference"/></div>
  <div><label htmlFor="draft-location" className="text-sm font-medium">Location <span className="text-muted-foreground">(optional)</span></label><input id="draft-location" name="location" maxLength={120} className={field} placeholder="e.g. Pune"/></div>
  <div className="grid gap-4 sm:grid-cols-2"><div><label htmlFor="draft-start" className="text-sm font-medium">Start date</label><input id="draft-start" name="starts_on" type="date" required min="1900-01-01" max="2100-12-31" className={field}/></div><div><label htmlFor="draft-end" className="text-sm font-medium">End date</label><input id="draft-end" name="ends_on" type="date" required min="1900-01-01" max="2100-12-31" className={field}/></div></div>
  <button disabled={pending} className="min-h-11 rounded-full bg-foreground px-5 text-sm font-semibold text-background disabled:opacity-50">{pending?'Saving…':'Create private draft'}</button>
  {state.message&&<p role="status" className={`text-sm ${state.ok?'text-green-700':'text-red-700'}`}>{state.message}</p>}
 </form>
}
