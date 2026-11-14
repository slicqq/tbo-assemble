'use client';
import { createBrowserClient } from '@supabase/ssr';
import { supabasePublicConfig } from './config';

export function supabaseBrowser() {
  const { url, key } = supabasePublicConfig();
  return createBrowserClient(url, key);
}
