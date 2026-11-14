import {redirect} from 'next/navigation';
import Link from 'next/link';
import {supabaseServer} from '@/lib/supabase/server';
import {Logout} from './logout';
import {DraftForm} from './draft-form';
export const dynamic='force-dynamic';
type Draft={id:string;title:string;location:string;starts_on:string;ends_on:string};
export default async function SecureAccount(){
 const client=await supabaseServer();
 const user=await client.auth.getUser().then(({data,error})=>error?null:data.user).catch(()=>null);
 if(!user)redirect('/login');
 // Explicit owner filter is defence in depth; the RLS policy applies regardless.
 const {data,error}=await client.from('private_event_drafts').select('id,title,location,starts_on,ends_on').eq('owner_id',user.id).order('created_at',{ascending:false}).limit(50);
 const drafts=(data??[]) as Draft[];
 const name=typeof user.user_metadata?.full_name==='string' ? user.user_metadata.full_name.trim().slice(0,100) : '';
 return <main className="min-h-screen bg-background p-5 sm:p-12"><div className="mx-auto max-w-5xl space-y-6">
  <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">TBO Assemble · Account preview</p><h1 className="mt-1 text-3xl font-bold">Your private drafts</h1><p className="mt-2 text-sm text-muted-foreground">{name ? <>Welcome, {name} · </> : null}Signed in as {user.email}</p></div><Logout/></div>
  <div className="rounded-2xl border bg-card p-5 text-sm leading-6 text-muted-foreground"><strong className="text-foreground">Separate from the shared dashboard.</strong> These basic drafts belong to your account. They do not yet support rooms or bookings. The seven existing shared events are unchanged and have not been assigned to anyone. <Link href="/legacy-login" className="underline">Old dashboard</Link> remains shared and is not private.</div>
  <div className="grid items-start gap-5 md:grid-cols-2"><section className="rounded-2xl border bg-card p-5 sm:p-6"><h2 className="text-lg font-semibold">Create an event draft</h2><p className="mb-5 mt-1 text-sm text-muted-foreground">Add the basics to your private account.</p><DraftForm/></section>
   <section className="rounded-2xl border bg-card p-5 sm:p-6"><h2 className="text-lg font-semibold">Your drafts</h2><p className="mb-4 mt-1 text-sm text-muted-foreground">Only drafts belonging to your account are shown. Most recent 50.</p>{error?<p role="alert" className="text-sm text-red-700">Could not load drafts. Please refresh or try again.</p>:drafts.length===0?<div className="rounded-xl bg-muted p-5 text-sm text-muted-foreground">No private drafts yet. Create one to get started.</div>:<ul className="space-y-3">{drafts.map(d=><li key={d.id} className="rounded-xl border p-4"><h3 className="break-words font-semibold">{d.title}</h3><p className="mt-1 text-sm text-muted-foreground">{d.location||'Location not set'}</p><p className="mt-2 text-xs text-muted-foreground">{d.starts_on} – {d.ends_on}</p></li>)}</ul>}</section></div>
  <div className="flex flex-wrap gap-5"><Link href="/dashboard" className="inline-block text-sm underline">Back to shared dashboard</Link><Link href="/inventory" className="inline-block text-sm underline">Explore the synthetic inventory demo</Link></div>
 </div></main>;
}
