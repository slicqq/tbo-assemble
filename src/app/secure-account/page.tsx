import { redirect } from 'next/navigation';
import Link from 'next/link';
import { supabaseServer } from '@/lib/supabase/server';
import { Logout } from './logout';
export const dynamic = 'force-dynamic';
export default async function SecureAccount() {
  const client = await supabaseServer();
  // Malformed session cookies or a failed auth service must fail closed.
  const user = await client.auth.getUser().then(({ data, error }) => error ? null : data.user).catch(() => null);
  if (!user) redirect('/login');
  return <main className="min-h-screen bg-background p-6 sm:p-12"><div className="mx-auto max-w-3xl space-y-6">
    <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">TBO Assemble · Preview</p><h1 className="mt-1 text-3xl font-bold">Your account</h1><p className="mt-2 text-sm text-muted-foreground">Signed in as {user.email}</p></div><Logout /></div>
    <div className="rounded-2xl border bg-card p-6"><h2 className="text-lg font-semibold">Private event workspace is being prepared</h2><p className="mt-2 text-sm text-muted-foreground">Your account cannot access the existing shared events. Event ownership and API authorization are not yet connected. No existing records have been assigned or modified.</p><Link href="/inventory" className="mt-4 inline-block text-sm underline">Explore the synthetic demo</Link></div>
  </div></main>;
}
