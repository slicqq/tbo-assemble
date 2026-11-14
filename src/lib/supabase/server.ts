import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabasePublicConfig } from './config';

// Always verify user identity with Supabase getUser(), not a local cookie or getSession().
export async function supabaseServer() {
  const store = await cookies();
  const { url, key } = supabasePublicConfig();
  return createServerClient(url, key, {
    cookies: {
      getAll() { return store.getAll(); },
      setAll(changes) {
        try { changes.forEach(({ name, value, options }) => store.set(name, value, options)); }
        catch { /* Server components cannot write cookies; the proxy refreshes them. */ }
      },
    },
  });
}
