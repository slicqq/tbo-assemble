'use client';
import { usePathname } from 'next/navigation';
import { AuthProvider } from '@/lib/auth-context';
import { Toaster } from '@/components/ui/toaster';
import type { ReactNode } from 'react';
// The procurement demo has no authentication dependency; legacy routes keep their provider.
export function RootProviders({children}:{children:ReactNode}) {
 const path=usePathname();
 return <Toaster>{(path==='/' || path==='/inventory' || path==='/flight-intelligence') ? children : <AuthProvider>{children}</AuthProvider>}</Toaster>;
}
