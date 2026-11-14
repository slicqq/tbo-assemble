"use client";

import { useAuth } from "@/lib/auth-context";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

// This is navigation UX, not an authorization boundary. Legacy APIs remain shared.
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const [verified, setVerified] = useState(false);
  useEffect(() => {
    if (isAuthenticated) return;
    let active = true;
    (async () => {
      try {
        const {data, error} = await supabaseBrowser().auth.getUser();
        if (!active) return;
        if (!error && data.user) { setVerified(true); return; }
      } catch { /* No verified session. */ }
      if (active) { setVerified(false); router.replace("/login"); }
    })();
    return () => { active = false; };
  }, [isAuthenticated, router]);
  if (!isAuthenticated && !verified) return <div className="min-h-screen flex items-center justify-center bg-background"><p className="text-sm text-muted-foreground">Loading dashboard…</p></div>;
  return <>{children}</>;
}
