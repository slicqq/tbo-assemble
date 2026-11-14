import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// Session refresh only. This proxy is NOT an authorization boundary: every
// protected page/route must independently verify the user and record ownership.
export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  let response = NextResponse.next({ request });
  if (!url || !key) return response;
  const client = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (changes) => {
        changes.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        changes.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  await client.auth.getUser();
  return response;
}
export const config = { matcher: ['/secure-account/:path*'] };
