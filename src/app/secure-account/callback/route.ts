import { NextResponse, type NextRequest } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  if (code) {
    const client = await supabaseServer();
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(request.nextUrl.searchParams.get('flow') === 'recovery' ? '/secure-account/reset' : '/secure-account', request.url));
  }
  return NextResponse.redirect(new URL('/login?error=confirmation', request.url));
}
