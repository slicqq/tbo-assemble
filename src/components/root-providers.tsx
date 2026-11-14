'use client';
import { usePathname } from 'next/navigation';
import { AuthProvider } from '@/lib/auth-context';
import { Toaster } from '@/components/ui/toaster';
import type { ReactNode } from 'react';
// Inventory remains publicly accessible; it uses the shared navigation provider without an auth guard.
export function RootProviders({children}:{children:ReactNode}) {
 const path=usePathname();
 return <Toaster>{(path==='/' || path==='/flight-intelligence') ? children : <AuthProvider>{children}</AuthProvider>}</Toaster>;
}
