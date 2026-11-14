'use client';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { supabaseBrowser } from '@/lib/supabase/browser';
export function Logout() {
  const router = useRouter();
  return <Button variant="outline" onClick={async () => { await supabaseBrowser().auth.signOut(); router.replace('/login'); router.refresh(); }}>Sign out</Button>;
}
